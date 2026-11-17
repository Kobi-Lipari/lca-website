// functions/utils/clubs/monthlyCheck.ts
//
// The monthly check of the club listings (WS09 step 14): one email to each
// holder of an active regional seat whose seats keep at least one club,
// listing every club their seats keep, each with Still accurate, a signed
// link that needs no login for 30 days (functions/api/clubs/confirm/[token].ts),
// and Update, the club's page in My region after sign-in. The clubs are the
// ones My region shows a seat holder, by the seat rule of ./routing; an LCA
// admin who holds a seat gets the seat's clubs, not every club; a person
// holding two seats gets one email that lists each club once. Its
// words are drawn in ./emails, and each email goes through sendEmailOutcome
// with one gate read for the whole run.
//
// Two ways in:
// - A timed call (force false), which the daily-emails worker's five-minute
//   run makes from WS09 step 15. It returns at once, before any query and
//   before the run record, while CLUB_KEEPERS_ON is unset, while the
//   signing secret is missing or too short, and while isCheckDue(now) is
//   false: the check is due on the first Monday of the month from 8:00 AM
//   Central to the end of that day alone. When due it reads the month's
//   marks and the seat holders, and only when someone is left to send to
//   does it run, inside recordRun as the job club_monthly_check, at most
//   TIMED_SENDS people a run, the rest on the next run. Each person is
//   claimed in club_check_marks (migration 0069) before the send, by an
//   insert its key refuses the second time, so two runs at once never both
//   send to one person; a send worth another try gives the mark back and
//   ends the run, and one that will never go keeps it. Before 0069 has run
//   a timed call sends nothing and writes MARKS_MISSING_LOG: it never sends
//   unmarked.
// - A forced call (force true), the LCA admin's button
//   (functions/api/admin/clubs/monthly-check.ts). It ignores the due rule
//   and the marks: it reads and writes none, sends to every holder each
//   time it is pressed, at most PRESS_SENDS of them, and is marked manual
//   in the run's detail; its email says an LCA admin sent it by hand in
//   place of naming the first Monday. So a press never counts as the timed
//   send, and a press before the first Monday does not stop Monday's email.
//
// A person with no address that can be written to is counted as not sent,
// in numbers only. The run's detail holds the month in words and the
// numbers, and "manual" for a forced call: no id, no name, no address and
// no token. Nothing here logs a token, a person or an address.
//
// No package and nothing under functions/api or domain/contracts, so the
// daily-emails worker can import it at step 15 (test/unit/club-monthly-check.test.ts).

import { sendEmailOutcome, type EmailEnv } from '../email'
import { openLoopGate } from '../mail/gate'
import { engineRulesOn } from '../mail/rules'
import { resolveSiteUrl, type SiteEnv } from '../site'
import { MIN_SECRET_LENGTH, signToken } from '../tokens'
import { recordRun, type RunOutcome } from '../admin/automations'
import { CLUB_KEEPERS_ON } from './pages'
import { isMissingTableOrColumn } from './migrationLag'
import { seatHoldersWithClubs, type SeatClub } from './routing'
import { monthlyCheckEmail, type CheckClub } from './emails'
import { checkMonthKey, isCheckDue, monthInWords } from '../../../domain/clubs/monthlyCheck'

/** The bindings the check reads: the database, the mail service's key, the site's address and the signing secret. */
export interface MonthlyCheckEnv extends EmailEnv, SiteEnv {
  DB: D1Database
  SIGNING_SECRET?: string
}

/** The job's name in automation_runs. */
export const CHECK_JOB = 'club_monthly_check'

/** The purpose a Still accurate link is signed for; no other link reads as one. */
export const CONFIRM_PURPOSE = 'club_confirm'

/** How long a Still accurate link works: 30 days, 2,592,000 seconds. */
export const LINK_TTL_SECONDS = 30 * 24 * 60 * 60

/** The most people one timed run claims; the rest go on the next run, five minutes on. */
export const TIMED_SENDS = 10

/**
 * The most emails one press of the admin's button sends. A Pages Function on Workers Free may make 50 outside calls
 * and 50 queries (functions/utils/mail/plan.ts). A press makes one outside call to check the admin's sign-in and one
 * for each email, and no other; its queries are fixed, none for each person: the admin's member row, the seat
 * holders, the gate (one for each 90 addresses, once the mail engine's rules are on) and the run record's two. So the
 * outside calls decide: 50 less the sign-in's one leaves 49, and four are kept in hand.
 */
export const PRESS_SENDS = 45

/** The one log line of a timed call before migration 0069 has run; it names no person. */
export const MARKS_MISSING_LOG = 'club monthly check: the mark table of migration 0069 is not there yet; the timed check sends nothing until it is'

/** The one log line for a person whose send could not be made; it names no person and no address. */
export const SEND_FAILED_LOG = 'club monthly check: one person\'s email could not be made or marked; it is counted as not sent'

/** The one log line when a mark could not be given back; the person waits for the next month. It names no person. */
export const MARK_KEPT_LOG = 'club monthly check: a mark could not be given back after a send worth another try; it is kept'

/** The pause between one email and the next, the pace the save notice keeps. */
const SEND_INTERVAL_MS = 400

/** Why a call tried nothing: the switch is off, no signing key, not due, no mark table yet, or nobody left to send to. */
export type CheckStop = 'closed' | 'key_missing' | 'not_due' | 'marks_missing' | 'nobody'

/** What a call did, in numbers only. */
export interface MonthlyCheckAnswer {
  /** Why nothing was tried; null when sending was tried. */
  stopped: CheckStop | null
  /** The month in words, in Central time: "December 2026". */
  month: string
  /** The people this call was for: every holder for a press, and those not yet marked this month for a timed call. */
  people: number
  sent: number
  /** Not sent: no address that can be written to, or the mail service did not take it. */
  notSent: number
  /** Not tried by this call: past the press's bound, or left for the next timed run. */
  notReached: number
}

/** One person the check goes to, with every club their seats keep, each once. */
interface Person {
  id: string
  fullName: string
  email: string
  addressable: boolean
  clubs: Array<{ id: string; name: string; city: string; statement: string | null }>
}

/** True when the signing secret is long enough to sign with. Read at each call. */
export function signingKeyReady(env: { SIGNING_SECRET?: string }): boolean {
  return typeof env.SIGNING_SECRET === 'string' && env.SIGNING_SECRET.length >= MIN_SECRET_LENGTH
}

/** The rows of the seat rule as people, in the read's order, each club once for each person. */
function peopleOf(rows: readonly SeatClub[]): Person[] {
  const byId = new Map<string, Person>()
  for (const row of rows) {
    let person = byId.get(row.member_id)
    if (!person) {
      person = { id: row.member_id, fullName: row.full_name, email: row.email.trim(), addressable: Number(row.addressable) === 1, clubs: [] }
      byId.set(row.member_id, person)
    }
    if (!person.clubs.some((club) => club.id === row.club_id)) {
      person.clubs.push({ id: row.club_id, name: row.club_name, city: row.club_city, statement: row.club_statement })
    }
  }
  return [...byId.values()]
}

/** Every holder of an active regional seat whose seats keep at least one club, as the check reads them. */
async function seatHolders(db: D1Database): Promise<Person[]> {
  return peopleOf(await seatHoldersWithClubs(db))
}

/** How many people the check goes to now: the number the admin's button names in its question. One query. */
export async function monthlyCheckPeople(db: D1Database): Promise<number> {
  return (await seatHolders(db)).length
}

/** The members marked for this month's check. Rejects on a database before 0069. */
async function marksOf(db: D1Database, month: string): Promise<Set<string>> {
  const { results } = await db.prepare('SELECT member_id FROM club_check_marks WHERE month = ?').bind(month).all<{ member_id: string }>()
  return new Set((results ?? []).map((row) => row.member_id))
}

/** One person's email, with a signed Still accurate link for each club and the club's page in My region for Update; `byHand` for a forced call's copy. */
async function messageFor(env: MonthlyCheckEnv, siteUrl: string, person: Person, month: string, now: Date, byHand: boolean) {
  const clubs: CheckClub[] = []
  for (const club of person.clubs) {
    const token = await signToken(env.SIGNING_SECRET, CONFIRM_PURPOSE, { club: club.id, member: person.id }, LINK_TTL_SECONDS, now)
    clubs.push({
      name: club.name,
      city: club.city,
      statement: club.statement,
      confirmUrl: `${siteUrl}/clubs/confirm/${encodeURIComponent(token)}`,
      updateUrl: `${siteUrl}/workspace/region/clubs/${encodeURIComponent(club.id)}`,
    })
  }
  const linksEnd = new Date(now.getTime() + LINK_TTL_SECONDS * 1000)
  return { ...monthlyCheckEmail({ siteUrl, fullName: person.fullName, month, linksEnd, clubs, byHand }), to: person.email }
}

/** Gives a person's mark back after a send worth another try, so the next run tries again; a failure is logged and the mark kept. */
async function giveBack(db: D1Database, memberId: string, month: string): Promise<void> {
  try {
    await db.prepare('DELETE FROM club_check_marks WHERE member_id = ? AND month = ?').bind(memberId, month).run()
  } catch {
    console.warn(MARK_KEPT_LOG)
  }
}

/** The run record's outcome: ok when every email tried went, partial when some did, failed when none did. */
function outcomeOf(answer: MonthlyCheckAnswer, force: boolean): RunOutcome {
  if (answer.notSent === 0 && (!force || answer.notReached === 0)) return 'ok'
  return answer.sent > 0 ? 'partial' : 'failed'
}

/**
 * Runs the monthly check at `now`. A timed call (force false) sends only while it is due and only to people not yet
 * marked this month, at most TIMED_SENDS a run; a forced call (force true) sends to every holder, at most PRESS_SENDS,
 * and reads and writes no mark. Answers what it did in numbers. Throws only when the database cannot be read at all
 * before the run starts; once the run starts, recordRun catches what is thrown and the numbers so far come back.
 */
export async function runMonthlyCheck(
  env: MonthlyCheckEnv,
  now: Date,
  force: boolean,
  options: { pauseMs?: number; request?: Request } = {},
): Promise<MonthlyCheckAnswer> {
  const month = monthInWords(now)
  const none = (stopped: CheckStop): MonthlyCheckAnswer => ({ stopped, month, people: 0, sent: 0, notSent: 0, notReached: 0 })
  // The three checks a timed call makes before any query: the switch, the key and the day.
  if (!CLUB_KEEPERS_ON) return none('closed')
  if (!signingKeyReady(env)) return none('key_missing')
  if (!force && !isCheckDue(now)) return none('not_due')

  const key = checkMonthKey(now)
  let marked = new Set<string>()
  if (!force) {
    try {
      marked = await marksOf(env.DB, key)
    } catch (err) {
      if (!isMissingTableOrColumn(err)) throw err
      console.warn(MARKS_MISSING_LOG)
      return none('marks_missing')
    }
  }
  const people = (await seatHolders(env.DB)).filter((person) => force || !marked.has(person.id))
  if (people.length === 0) return none('nobody')

  const answer: MonthlyCheckAnswer = { stopped: null, month, people: people.length, sent: 0, notSent: 0, notReached: 0 }
  const pauseMs = options.pauseMs ?? SEND_INTERVAL_MS
  const siteUrl = resolveSiteUrl(env, options.request)
  const pause = () => new Promise((resolve) => setTimeout(resolve, pauseMs))

  await recordRun(env.DB, CHECK_JOB, async () => {
    // The people this run may try, for the one gate read over their addresses.
    const tried = force ? people.filter((person) => person.addressable).slice(0, PRESS_SENDS) : people.slice(0, TIMED_SENDS)
    const addresses = tried.filter((person) => person.addressable).map((person) => person.email)
    const gate = engineRulesOn() && addresses.length > 0 ? await openLoopGate(env.DB, addresses) : undefined
    const triedIds = new Set(tried.map((person) => person.id))
    let sends = 0
    let held = false
    for (const person of people) {
      if (force && !person.addressable) {
        answer.notSent++
        continue
      }
      // Past this run's bound, or after the mail service asked for a pause: the next run, or the next press, has them.
      if (held || !triedIds.has(person.id)) {
        answer.notReached++
        continue
      }
      try {
        if (!force) {
          const claim = await env.DB.prepare('INSERT INTO club_check_marks (member_id, month) VALUES (?, ?) ON CONFLICT DO NOTHING')
            .bind(person.id, key)
            .run()
          // Another run has this person: it sends their email, so this one does not.
          if (claim.meta.changes !== 1) {
            answer.people--
            continue
          }
          // No address to write to: it will never go, so the mark is kept and the person is counted.
          if (!person.addressable) {
            answer.notSent++
            continue
          }
        }
        if (sends++ > 0 && pauseMs > 0) await pause()
        const outcome = await sendEmailOutcome(env, await messageFor(env, siteUrl, person, month, now, force), gate)
        if (outcome === 'sent') {
          answer.sent++
          continue
        }
        answer.notSent++
        if (outcome === 'later') {
          // Worth another try: the mark goes back, and the run ends here, as the other loops do at a 'later'.
          held = true
          if (!force) await giveBack(env.DB, person.id, key)
        }
      } catch {
        console.warn(SEND_FAILED_LOG)
        answer.notSent++
      }
    }
    const left = force ? 'not reached' : 'left for the next run'
    return {
      outcome: outcomeOf(answer, force),
      sentCount: answer.sent,
      failedCount: answer.notSent,
      detail: `${month}${force ? ', manual' : ''}: ${answer.sent} sent, ${answer.notSent} not sent, ${answer.notReached} ${left}`,
    }
  })
  return answer
}
