// workers/daily-emails/src/index.ts
//
// The site scheduled-jobs Worker. Two crons, dispatched below:
//
//   0 12 * * *   daily tournament emails
//   */5 * * * *  campaign sweep
//
// The name is historical — it predates the sweep, and see the note in
// wrangler.toml for why renaming it would be worse than living with it.
//
// The daily half was migrated out of functions/cron/ (Pages Functions never
// run scheduled handlers — that logic had never executed in production).
// Changes made in that migration:
//  - sendEmail → trySendEmail: one bad address no longer aborts the loop.
//  - Sent-flags are only written when the send actually succeeded, so a
//    failed send retries on the next daily run instead of being lost.
//  - Each phase is isolated: a D1 error in one phase logs and moves on
//    rather than killing the remaining phases.
// The queries themselves are ported unchanged.
//
// Under the mail engine's rules (engineRulesOn() in
// functions/utils/mail/rules.ts, off until the newsletter is switched on)
// the daily run changes in three ways. Its reminder phases run before the
// rating lookups, so on the free plan the invocation's 50 outside calls go
// to mail first. Each phase reads one do-not-send gate over all its rows
// before its loop, and claims each row before its send with today's mark
// made conditional, sending only when the claim took: two runs over the
// same rows send each reminder once, and a run cut between a send and its
// mark can never send that reminder again. And on the free plan the run
// claims at most 25 reminder rows and gives the rating lookups what is
// left of 45 outside calls (dailyBudget in functions/utils/mail/plan.ts).
// A claim is given back only when the send's outcome is 'later', which also
// ends that phase; a 'never' (an address on the do-not-send list, a walk-in
// placeholder, an answer that may have come after the service took the
// message) keeps its mark and is not tried again.
//
// Only the registration-open query reads a row again on a later day. The
// week-before query names the day a week ahead and the attendee query the
// day each reminder falls on, so a row of theirs that the cap leaves
// unclaimed, or that a 'later' gives back, is not read again after its
// day; that holds with the rules off too, for a send that failed. So under
// the rules the attendee reminders and the week-before reminder run first
// and the registration-open reminders last, and the cap falls first on the
// rows that can wait. A 'later' among the attendee and week-before
// reminders is sent again in the same run, with the claim held, three
// sends at most, one second and then two seconds after the send before it,
// and from the run's first such 'later' each claim waits half a second;
// the second and third sends come out of the outside calls the rating
// lookups would have had. What a run still leaves of those rows is not
// sent, and the run logs how many rows of each such phase it left, naming
// no address: on the free plan a day with more than 25 of them together
// sends 25, and a reminder still answered later after its three sends ends
// its phase with the rows after it, as REDESIGN_STATUS.md records. With the
// rules off the run is today's, in today's order, marked only after a send
// that worked.

import {
  trySendEmail,
  sendEmailOutcome,
  registrationOpenReminderEmail,
  weekBeforeReminderEmail,
  attendeeReminderEmail,
  type EmailMessage,
} from '../../../functions/utils/email'
import { sweepPendingCampaigns } from '../../../functions/utils/admin/campaigns'
import { openLoopGate } from '../../../functions/utils/mail/gate'
import { dailyBudget } from '../../../functions/utils/mail/plan'
import { engineRulesOn } from '../../../functions/utils/mail/rules'
import { resolveSiteUrl } from '../../../functions/utils/site'
import { expireLapsedMemberships } from '../../../functions/utils/membership/membershipExpiry'
import { snapshotMemberRatings } from '../../../functions/utils/membership/ratingSnapshots'
import { hasPassed } from '../../../functions/utils/time'

interface Env {
  DB: D1Database
  RESEND_API_KEY: string
  FROM_EMAIL?: string
  SITE_URL?: string
  /**
   * The key the links in list mail are signed with, the same as the site's, and only while it is being changed the key
   * before it: secrets K sets on this worker before the newsletter is switched on. Without the key the sweep sends no
   * list campaign and its history says the key is missing (functions/utils/admin/campaigns.ts).
   */
  MAIL_LINK_SECRET?: string
  MAIL_LINK_SECRET_PREVIOUS?: string
}

async function phase(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn()
  } catch (err) {
    console.error(`daily-emails phase "${name}" failed:`, err instanceof Error ? err.message : err)
  }
}

/** The cron expression, verbatim from wrangler.toml, that runs the sweep. */
const SWEEP_CRON = '*/5 * * * *'

/**
 * Picks up mass-email campaigns that were left half-sent.
 *
 * A campaign is sent by the admin request that created it, in waitUntil —
 * durable enough most of the time, and not durable at all when the isolate
 * is evicted mid-send. Without this the leftover recipients simply never
 * receive anything and the campaign shows "sending" forever. Claiming makes
 * it safe to run while the original send is still going.
 */
async function sweepCampaigns(env: Env): Promise<void> {
  const result = await sweepPendingCampaigns(env)
  // Silent when there was nothing to do, which is almost every run.
  if (result.campaignsTouched > 0) {
    console.log(
      `campaign sweep: ${result.sent} sent, ${result.failed} failed across ${result.campaignsTouched} campaign(s)`,
    )
  }
}

/**
 * One reminder a phase found due: its address, its email, and its row's three statements. Today's mark is written
 * after a send that worked; under the rules the claim, the same mark made conditional, is written before the send,
 * and the release gives the claim back.
 */
interface DueReminder {
  to: string
  message: () => Omit<EmailMessage, 'to'>
  mark: () => D1PreparedStatement
  claim: () => D1PreparedStatement
  release: () => D1PreparedStatement
}

interface ReminderTournament {
  tournament_id: string; name: string; date: string; end_date: string | null
  location: string; venue: string | null
}

const eventOf = (siteUrl: string, row: ReminderTournament) => ({
  name: row.name,
  date: row.date,
  endDate: row.end_date,
  location: row.location,
  venue: row.venue,
  url: `${siteUrl}/tournaments/${row.tournament_id}`,
})

// 2. The registration-open reminders due: subscribers to an event whose registration is now open.
async function dueRegistrationOpen(env: Env, siteUrl: string): Promise<DueReminder[]> {
  const newlyOpenedReminders = await env.DB.prepare(
    `SELECT tr.id, tr.email, tr.member_id,
            t.id as tournament_id, t.name, t.date, t.end_date, t.location, t.venue,
            m.full_name
     FROM tournament_reminders tr
     JOIN tournaments t ON tr.tournament_id = t.id
     JOIN members m ON tr.member_id = m.id
     WHERE t.registration_status = 'open'
       AND tr.sent_registration_open = 0
       AND tr.registration_opened_notified_at IS NULL`,
  ).all<ReminderTournament & { id: string; email: string; member_id: string; full_name: string }>()

  return newlyOpenedReminders.results.map((row) => ({
    to: row.email,
    message: () => registrationOpenReminderEmail({ siteUrl, memberName: row.full_name, tournament: eventOf(siteUrl, row) }),
    mark: () => env.DB.prepare('UPDATE tournament_reminders SET sent_registration_open = 1 WHERE id = ?').bind(row.id),
    // Both marks, as the notice sent when registration opens writes them, so neither sends it again.
    claim: () => env.DB.prepare(
      `UPDATE tournament_reminders SET sent_registration_open = 1, registration_opened_notified_at = datetime('now')
        WHERE id = ? AND sent_registration_open = 0`,
    ).bind(row.id),
    release: () => env.DB.prepare(
      'UPDATE tournament_reminders SET sent_registration_open = 0, registration_opened_notified_at = NULL WHERE id = ?',
    ).bind(row.id),
  }))
}

// 3. The week-before opt-in reminders due (7 days away, not yet registered).
async function dueWeekBefore(env: Env, siteUrl: string, today: Date): Promise<DueReminder[]> {
  const sevenDaysFromNow = new Date(today)
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)
  const sevenDaysStr = sevenDaysFromNow.toISOString().split('T')[0]

  const weekBeforeReminders = await env.DB.prepare(
    `SELECT tr.id, tr.email, tr.member_id,
            t.id as tournament_id, t.name, t.date, t.end_date, t.location, t.venue,
            m.full_name
     FROM tournament_reminders tr
     JOIN tournaments t ON tr.tournament_id = t.id
     JOIN members m ON tr.member_id = m.id
     WHERE date(t.date) = ?
       AND tr.sent_week_before = 0
       AND NOT EXISTS (
         SELECT 1 FROM registrations r
         WHERE r.tournament_id = t.id AND r.member_id = tr.member_id
       )`,
  ).bind(sevenDaysStr).all<ReminderTournament & { id: string; email: string; member_id: string; full_name: string }>()

  return weekBeforeReminders.results.map((row) => ({
    to: row.email,
    message: () => weekBeforeReminderEmail({ siteUrl, memberName: row.full_name, tournament: eventOf(siteUrl, row) }),
    mark: () => env.DB.prepare('UPDATE tournament_reminders SET sent_week_before = 1 WHERE id = ?').bind(row.id),
    claim: () => env.DB.prepare('UPDATE tournament_reminders SET sent_week_before = 1 WHERE id = ? AND sent_week_before = 0').bind(row.id),
    release: () => env.DB.prepare('UPDATE tournament_reminders SET sent_week_before = 0 WHERE id = ?').bind(row.id),
  }))
}

// 4 & 5. The attendee reminders due (reminder 1 and 2).
async function dueAttendee(env: Env, siteUrl: string, todayStr: string, reminderNum: 1 | 2): Promise<DueReminder[]> {
  const daysCol = `reminder_${reminderNum}_days_before`
  const enabledCol = `reminder_${reminderNum}_enabled`

  const attendees = await env.DB.prepare(
    `SELECT r.member_id, r.tournament_id, r.section,
            t.name, t.date, t.end_date, t.location, t.venue,
            t.${daysCol} as days_before,
            m.email, m.full_name
     FROM registrations r
     JOIN tournaments t ON r.tournament_id = t.id
     JOIN members m ON r.member_id = m.id
     WHERE t.${enabledCol} = 1
       AND r.withdrawn_at IS NULL
       AND r.payment_status = 'paid'
       AND m.email NOT LIKE '%@walkin.lca.invalid'
       AND date(t.date, '-' || t.${daysCol} || ' days') = ?
       AND NOT EXISTS (
         SELECT 1 FROM tournament_attendee_reminders tar
         WHERE tar.tournament_id = r.tournament_id
           AND tar.member_id = r.member_id
           AND tar.reminder_number = ?
       )`,
  ).bind(todayStr, reminderNum).all<ReminderTournament & {
    member_id: string; section: string; days_before: number; email: string; full_name: string
  }>()

  return attendees.results.map((row) => {
    const remId = `ar-${row.tournament_id}-${row.member_id}-${reminderNum}`
    // INSERT OR IGNORE, as today: the row's existence is the mark, so the insert is its own claim.
    const insert = () => env.DB.prepare(
      `INSERT OR IGNORE INTO tournament_attendee_reminders
       (id, tournament_id, member_id, reminder_number)
       VALUES (?, ?, ?, ?)`,
    ).bind(remId, row.tournament_id, row.member_id, reminderNum)
    return {
      to: row.email,
      message: () => attendeeReminderEmail({
        siteUrl,
        memberName: row.full_name,
        section: row.section,
        daysUntil: row.days_before,
        tournament: eventOf(siteUrl, row),
      }),
      mark: insert,
      claim: insert,
      release: () => env.DB.prepare('DELETE FROM tournament_attendee_reminders WHERE id = ?').bind(remId),
    }
  })
}

/** Today's loop: each reminder sent, and marked only after a send that worked. */
async function sendAsToday(env: Env, due: DueReminder[]): Promise<void> {
  for (const reminder of due) {
    const ok = await trySendEmail(env, { ...reminder.message(), to: reminder.to })
    if (!ok) continue // retry on the next run; don't burn the flag
    await reminder.mark().run()
  }
}

/** Under the rules, the most sends one reminder row of a phase that names one day takes in a run: the first and two more. */
const LATER_TRIES = 3

/** The wait before such a row's next send after a 'later', times the sends made for it: one second, then two. */
const LATER_WAIT_MS = 1000

/** The wait before each claim once a send of the run has been answered 'later', so the run sends more slowly. */
const SLOWED_GAP_MS = 500

/** A real wait; the tests take its time out through a spy on setTimeout. */
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * The daily run's reminders under the rules: the rows it may still claim on this plan, the sends it has tried, first
 * and repeated, each one outside call, which the rating lookups take what is left of, and whether a send of the run has
 * been answered 'later'.
 */
class ReminderBudget {
  private readonly cap = dailyBudget()
  private claimed = 0
  private tried = 0
  /** Set by the run's first 'later' that a row is sent again for: from then on each claim waits SLOWED_GAP_MS. */
  slowed = false

  /** True once the run has claimed every row it may or tried every send it may; of the rows past it, only registration-open rows wait. */
  get spent(): boolean {
    return (this.cap.reminders !== null && this.claimed >= this.cap.reminders)
      || (this.cap.outsideCalls !== null && this.tried >= this.cap.outsideCalls)
  }

  /** Counts one claim and its first send, which is one outside call. */
  take(): void {
    this.claimed++
    this.tried++
  }

  /** Counts one more send for the row in hand, or answers false when the plan has no outside call left for it. */
  again(): boolean {
    if (this.cap.outsideCalls !== null && this.tried >= this.cap.outsideCalls) return false
    this.tried++
    return true
  }

  /** The rating lookups' limit: what is left of the run's outside calls after its sends, or none on a plan with no cap. */
  ratingLimit(): number | undefined {
    return this.cap.outsideCalls === null ? undefined : Math.max(0, this.cap.outsideCalls - this.tried)
  }
}

/**
 * One phase's loop under the rules: one gate over all its rows, each row claimed before its send. In a phase whose
 * query names one day (`oneDay`: the attendee reminders and the week-before reminder), a 'later' is sent again with the
 * claim held, three sends at most, since no later day reads the row; still 'later' after that, the claim goes back and
 * the phase ends, as in the registration-open phase at its first 'later'. Such a phase runs even when the budget is
 * spent, reading no gate and making no claim, so that the rows it leaves are counted in the log, which names no address.
 */
async function sendClaimed(env: Env, name: string, due: DueReminder[], budget: ReminderBudget, oneDay: boolean): Promise<void> {
  let left = due.length
  try {
    if (due.length === 0 || budget.spent) return
    const gate = await openLoopGate(env.DB, due.map((reminder) => reminder.to))
    for (const reminder of due) {
      if (budget.spent) return
      // Before the claim, so that no claim is held across the gap.
      if (budget.slowed) await wait(SLOWED_GAP_MS)
      budget.take()
      const claim = await reminder.claim().run()
      // Another run has the row: it sends the reminder, so this one does not.
      if (claim.meta.changes !== 1) {
        left--
        continue
      }
      const message = { ...reminder.message(), to: reminder.to }
      let outcome = await sendEmailOutcome(env, message, gate)
      for (let sends = 1; oneDay && outcome === 'later' && sends < LATER_TRIES && budget.again(); sends++) {
        budget.slowed = true
        await wait(LATER_WAIT_MS * sends)
        outcome = await sendEmailOutcome(env, message, gate)
      }
      if (outcome === 'later') {
        // Proved not taken: the claim goes back and the phase stops here. A later run reads a registration-open row
        // again; the rows of the other phases are read again only by another run on the same day (see the header).
        await reminder.release().run()
        return
      }
      left--
    }
  } finally {
    if (oneDay && left > 0) console.warn(`daily-emails: ${left} row(s) of "${name}" not sent today`)
  }
}

/**
 * Records each member's US Chess rating: at most `limit` lookups when one is given, and with `stampUnanswered` a
 * checked time for an ID whose lookup finds nothing, which the run asks for under the rules.
 */
async function ratingSnapshots(env: Env, opts: { limit?: number; stampUnanswered?: boolean } = {}): Promise<void> {
  const { checked, changed, unreachable } = await snapshotMemberRatings(env.DB, opts)
  // Quiet on a normal night: ratings move a few times a year each.
  if (changed > 0 || unreachable > 0) {
    console.log(
      `rating snapshots: ${changed} change(s) across ${checked} member(s)` +
      (unreachable > 0 ? `, ${unreachable} unreachable` : ''),
    )
  }
}

export default {
  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    if (controller.cron === SWEEP_CRON) {
      await phase('campaign sweep', () => sweepCampaigns(env))
      return
    }

    // No request to derive an origin from out here, so this is config or the
    // built-in default — never a deployment URL that happened to be in scope.
    const SITE_URL = resolveSiteUrl(env)

    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]

    // 1. Auto-open tournaments where registration_opens_at <= today
    await phase('auto-open', async () => {
      await env.DB.prepare(
        `UPDATE tournaments
         SET registration_status = 'open'
         WHERE registration_status = 'draft'
           AND registration_opens_at IS NOT NULL
           AND registration_opens_at <= ?`,
      ).bind(todayStr).run()
    })

    // 1b. Auto-close registrations past their closing datetime
    // Close times are Central wall-clock values, so compare as instants in
    // code rather than as strings in SQL (utils/time).
    await phase('auto-close', async () => {
      const { results } = await env.DB.prepare(
        `SELECT id, registration_closes_at FROM tournaments
          WHERE registration_closes_at IS NOT NULL AND registration_status = 'open'`,
      ).all<{ id: string; registration_closes_at: string }>()
      for (const t of results ?? []) {
        if (!hasPassed(t.registration_closes_at)) continue
        await env.DB.prepare(`UPDATE tournaments SET registration_status = 'closed' WHERE id = ?`).bind(t.id).run()
      }
    })

    // 1c. Lapse memberships whose paid term has ended. Semantics and the
    //     reasoning behind them live in functions/utils/membership/membershipExpiry.ts,
    //     where they can be tested — this Worker has no harness of its own.
    await phase('membership expiry', async () => {
      const { lapsed } = await expireLapsedMemberships(env.DB, todayStr)
      // Silent on the usual day, when nobody lapsed.
      if (lapsed > 0) console.log(`membership expiry: ${lapsed} membership(s) lapsed`)
    })

    if (engineRulesOn()) {
      // Under the rules: the reminders first, within the plan's budget, then the rating lookups with what is left.
      // The reminders whose queries name one day go first and the registration-open reminders, whose rows a later run
      // reads again, last, so the cap falls first on the rows that can wait (see the header).
      const budget = new ReminderBudget()
      // A phase whose query names one day reads its rows even once the budget is spent, so the rows it leaves are
      // counted in the log; the registration-open phase, whose rows a later run reads again, does not.
      const remind = (name: string, due: () => Promise<DueReminder[]>, oneDay: boolean) =>
        phase(name, async () => {
          if (budget.spent && !oneDay) return
          await sendClaimed(env, name, await due(), budget, oneDay)
        })
      for (const reminderNum of [1, 2] as const) {
        await remind(`attendee reminder ${reminderNum}`, () => dueAttendee(env, SITE_URL, todayStr, reminderNum), true)
      }
      await remind('week-before reminders', () => dueWeekBefore(env, SITE_URL, today), true)
      await remind('registration-open reminders', () => dueRegistrationOpen(env, SITE_URL), false)
      await phase('rating snapshots', () => {
        const limit = budget.ratingLimit()
        return ratingSnapshots(env, { ...(limit === undefined ? {} : { limit }), stampUnanswered: true })
      })
      return
    }

    // 1d. Record each member's US Chess rating.
    //
    // Last of the bookkeeping phases on purpose: it makes one outbound call
    // per member with a USCF id, so it is the slowest thing here and the most
    // likely to be interrupted. Nothing below depends on it, and a partial
    // pass is fine — the next night picks up where it left off, because
    // members are ordered by how long it has been since they were checked.
    await phase('rating snapshots', () => ratingSnapshots(env))

    // 2. Send registration-open reminders
    await phase('registration-open reminders', async () => {
      await sendAsToday(env, await dueRegistrationOpen(env, SITE_URL))
    })

    // 3. Send week-before opt-in reminders (7 days away, not yet registered)
    await phase('week-before reminders', async () => {
      await sendAsToday(env, await dueWeekBefore(env, SITE_URL, today))
    })

    // 4 & 5. Send attendee reminders (reminder 1 and 2)
    for (const reminderNum of [1, 2] as const) {
      await phase(`attendee reminder ${reminderNum}`, async () => {
        await sendAsToday(env, await dueAttendee(env, SITE_URL, todayStr, reminderNum))
      })
    }
  },
}
