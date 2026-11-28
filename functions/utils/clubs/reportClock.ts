// functions/utils/clubs/reportClock.ts
//
// The 14 days (WS09 step 29): a visitor's suggestion for a club's listing
// (./suggestions.ts) that no keeper has answered in 14 days is passed on, by
// email, to the LCA admins, and to the representatives of the club's region
// as well when the club's rep had it first.
//
// When it is due: isSuggestionOverdue in domain/clubs/regionCards.ts, the one
// place the rule and its figure are written. The run reads the open
// suggestions not yet passed on, oldest first, and keeps those the rule says
// are due.
//
// Who it goes to, read from the club as it is at the run by keeperOf in
// ./routing (through ./emails), and stored nowhere:
//   - the club has a rep (the rep had it first): the representatives of the
//     club's region and the LCA admins;
//   - it has none and someone holds its region's seat (the representatives
//     had it first): the LCA admins;
//   - neither (the LCA admins had it first): the LCA admins again, as a
//     reminder.
// One email to each person, so no one sees another's address. A person who is
// both an LCA admin and a holder of the seat is written to once, as an LCA
// admin. A guest is never one of them, by the routing's own rule. As step 28
// does, no email goes to the address the visitor typed, even where it is a
// keeper's own.
//
// The run, runReportClock(env, now):
//   - returns before it reads anything while CLUB_KEEPERS_ON is unset;
//   - returns before the run record is written when nothing is due, so a run
//     with nothing to do writes no row of automation_runs;
//   - otherwise runs inside recordRun as the job club_report_clock, with the
//     counts alone in its detail, and "manual" there for an LCA admin's
//     press.
// At most MAX_SENDS emails a run, since the site sends about 100 a day in all
// until it sends through Amazon SES. The first suggestion of a run that
// costs an email is always sent to all its people, and a later one is
// started only while the run's total stays at MAX_SENDS or under, so no
// suggestion is ever half sent; the first one that does not fit, and every
// one after it, waits for the next run, oldest first. A suggestion with no
// one to write to costs no email, so it never holds a later one back.
//
// Each suggestion is claimed before its emails go, by setting escalated_at
// in a statement guarded by "escalated_at IS NULL AND status = 'open'", so
// of two runs at once only one sends it, and one a keeper answered, applied
// or dismissed since the read is not mailed. When none of its emails was
// taken the claim is given back in the same manner, at the loop's end and in
// one batch, on every way out of the loop, a thrown error included, so
// escalated_at stands only for a suggestion at least one of whose emails was
// taken (unless the batch itself fails, which is logged), and one
// none of whose emails was taken stays due for the next run, with one fixed
// log line. A failed send is logged in fixed words alone, never in the words
// its failure carries, since a mail service's refusal may name the address
// it refused; no log line here holds an address or the visitor's words.
//
// Its emails go through sendEmail in the run's own try and catch, as the
// keeper's email of step 28 goes, with one read of the mail gate for the
// run's addresses once the mail engine's rules are on, as the monthly check
// reads it. The links are built on the site's own address (resolveSiteUrl
// with no request), never on a request's.
//
// No package and nothing under functions/api or domain/contracts, so the
// daily-emails worker can import it once its one line lands
// (test/unit/club-report-clock.test.ts holds the same rule
// test/unit/mail-worker-closure.test.ts holds for a file the worker reaches).

import { sendEmail, type EmailEnv } from '../email'
import { openLoopGate, type MailGate } from '../mail/gate'
import { engineRulesOn } from '../mail/rules'
import { resolveSiteUrl, type SiteEnv } from '../site'
import { recordRun, type RunOutcome } from '../admin/automations'
import { CLUB_KEEPERS_ON } from './pages'
import {
  keeperOf, lcaAdmins, overdueSuggestionEmail, regionRepresentativesOf, suggestionLink, type Keeper, type OverdueFirst,
} from './emails'
import { SUGGESTION_DUE_DAYS, isSuggestionOverdue, wholeDaysSince } from '../../../domain/clubs/regionCards'
import { suggestionLabel } from '../../../domain/clubs/suggestion'

/** The bindings the run reads: the database, the mail service's key and the site's address. */
export interface ReportClockEnv extends EmailEnv, SiteEnv {
  DB: D1Database
}

/** The job's name in automation_runs. */
export const CLOCK_JOB = 'club_report_clock'

/** The most emails one run sends, unless its first suggestion alone needs more. */
export const MAX_SENDS = 10

/** The one log line for an email that did not go; it names no person, no address and none of the visitor's words. */
export const CLOCK_NOT_SENT_LOG = 'club report clock: an email about an overdue suggestion was not sent.'

/** The one log line when none of a suggestion's emails was taken; it stays due and is tried again at the next run. */
export const CLOCK_NONE_TAKEN_LOG = 'club report clock: no email about an overdue suggestion was taken; it is tried again at the next run.'

/** The one log line when a claim could not be given back; the suggestion reads as passed on. It names nothing more. */
export const CLOCK_CLAIM_KEPT_LOG = 'club report clock: a claim could not be given back after no email was taken; it is kept.'

/** The pause between one email and the next, the pace the keeper's email keeps. */
const SEND_INTERVAL_MS = 400

/** Why a run tried nothing: the switch is off, or nothing is due. */
export type ClockStop = 'closed' | 'nothing_due'

/** What a run did, in numbers only. */
export interface ReportClockAnswer {
  /** Why nothing was tried; null when sending was tried. */
  stopped: ClockStop | null
  /** The suggestions due at the read, less any a keeper or another run took first. */
  due: number
  /** The suggestions passed on: at least one of their emails was taken. */
  passedOn: number
  /** Emails the mail service took. */
  sent: number
  /** Emails it did not take, or that could not be made. */
  notSent: number
  /** Suggestions left for the next run, past this run's MAX_SENDS. */
  notReached: number
}

/** One open suggestion not yet passed on, as the run reads it. */
interface DueRow {
  id: number
  club_id: string
  field: string
  message: string
  status: string
  created_at: string
  escalated_at: string | null
  has_address: number
  /** The visitor's own address, lowercased, only to be sure no email goes to it; '' for none. Never written or logged. */
  typed: string
  club_name: string
  club_slug: string | null
  club_region: string | null
}

/** One person a suggestion goes to, with the role they get it in. */
interface Copy {
  person: Keeper
  kind: 'region' | 'lca'
}

/** The open suggestions not yet passed on, oldest first, with their clubs. One query. */
async function openNotPassedOn(db: D1Database): Promise<DueRow[]> {
  const { results } = await db.prepare(
    `SELECT r.id, r.club_id, r.field, r.message, r.status, r.created_at, r.escalated_at,
            (r.reporter_email IS NOT NULL AND TRIM(r.reporter_email) <> '') AS has_address,
            LOWER(TRIM(COALESCE(r.reporter_email, ''))) AS typed,
            c.name AS club_name, c.slug AS club_slug, c.region AS club_region
       FROM club_reports r
       JOIN clubs c ON c.id = r.club_id
      WHERE r.kind = 'suggestion' AND r.status = 'open' AND r.escalated_at IS NULL
      ORDER BY r.created_at, r.id`,
  ).all<DueRow>()
  return results ?? []
}

/** The suggestions due at `nowMs`, by the rule of the 14 days, oldest first. */
async function dueRows(db: D1Database, nowMs: number): Promise<DueRow[]> {
  return (await openNotPassedOn(db)).filter((row) => isSuggestionOverdue({
    status: row.status,
    passedOnAt: row.escalated_at,
    ageDays: wholeDaysSince(row.created_at, nowMs),
  }))
}

/** How many suggestions are due now: the number the admin's button names in its question. One query. */
export async function overdueSuggestionCount(db: D1Database, now: Date): Promise<number> {
  return (await dueRows(db, now.getTime())).length
}

/** A run's stamp, as datetime('now') writes one: "2026-11-23 18:00:00", in UTC. */
function storedStamp(now: Date): string {
  return now.toISOString().slice(0, 19).replace('T', ' ')
}

/** The run record's outcome: ok when every email tried went and none waits, partial when some went, failed when none did. */
function outcomeOf(answer: ReportClockAnswer): RunOutcome {
  if (answer.notSent === 0 && answer.notReached === 0 && answer.passedOn === answer.due) return 'ok'
  return answer.sent > 0 ? 'partial' : 'failed'
}

/**
 * Passes on the suggestions due at `now`, at most MAX_SENDS emails, and answers what it did in numbers. `manual` marks
 * an LCA admin's press in the run's detail. Throws only when the database cannot be read at all before the run
 * starts; once it starts, recordRun catches what is thrown and the numbers so far come back.
 */
export async function runReportClock(
  env: ReportClockEnv,
  now: Date,
  options: { pauseMs?: number; manual?: boolean } = {},
): Promise<ReportClockAnswer> {
  const none = (stopped: ClockStop): ReportClockAnswer => ({ stopped, due: 0, passedOn: 0, sent: 0, notSent: 0, notReached: 0 })
  if (!CLUB_KEEPERS_ON) return none('closed')

  const due = await dueRows(env.DB, now.getTime())
  if (due.length === 0) return none('nothing_due')

  const answer: ReportClockAnswer = { stopped: null, due: due.length, passedOn: 0, sent: 0, notSent: 0, notReached: 0 }
  const pauseMs = options.pauseMs ?? SEND_INTERVAL_MS
  const siteUrl = resolveSiteUrl(env)
  const stamp = storedStamp(now)

  await recordRun(env.DB, CLOCK_JOB, async () => {
    // Who each suggestion goes to, read before anything is sent, so the run knows which fit and reads the gate once.
    let admins: Keeper[] | null = null
    const adminsNow = async () => (admins ??= await lcaAdmins(env.DB))
    const planned: Array<{ row: DueRow; first: OverdueFirst; copies: Copy[] }> = []
    let total = 0
    for (const row of due) {
      const first = await keeperOf(env.DB, row.club_id)
      const lca = first.kind === 'admins' ? first.people : await adminsNow()
      const region = first.kind === 'club_rep' ? await regionRepresentativesOf(env.DB, row.club_id) : []
      const copies = copiesOf(region, lca, row.typed)
      // The first suggestion that costs an email always goes whole; a later one only while the run's total stays
      // within the bound. One with no one to write to costs none, so it never holds a later one back.
      if (total > 0 && total + copies.length > MAX_SENDS) break
      planned.push({ row, first: first.kind === 'admins' ? 'lca' : first.kind, copies })
      total += copies.length
      if (total >= MAX_SENDS) break
    }
    answer.notReached = due.length - planned.length

    const addresses = planned.flatMap((p) => p.copies.map((c) => c.person.email))
    const gate: MailGate | undefined = engineRulesOn() && addresses.length > 0 ? await openLoopGate(env.DB, addresses) : undefined

    let sends = 0
    // Every claim held while none of its emails has been taken. A claim leaves this set the moment one of its
    // emails is taken; whatever is left in it when the loop ends, however it ends (a thrown error included), is
    // given back in the finally below, so escalated_at never stands for a suggestion no email went for.
    const untaken = new Set<number>()
    try {
      for (const { row, first, copies } of planned) {
        // No one with an address to write to: nothing is claimed, and the suggestion stays due.
        if (copies.length === 0) {
          console.warn(CLOCK_NONE_TAKEN_LOG)
          continue
        }
        // The claim: only one run sends a suggestion, and one answered since the read is not sent at all.
        const claim = await env.DB.prepare(
          `UPDATE club_reports SET escalated_at = ?
            WHERE id = ? AND kind = 'suggestion' AND escalated_at IS NULL AND status = 'open'`,
        ).bind(stamp, row.id).run()
        if ((claim.meta?.changes ?? 0) !== 1) {
          answer.due--
          continue
        }
        untaken.add(row.id)
        let taken = 0
        for (const copy of copies) {
          if (sends++ > 0 && pauseMs > 0) await new Promise((resolve) => setTimeout(resolve, pauseMs))
          try {
            const mail = overdueSuggestionEmail({
              siteUrl,
              clubName: row.club_name,
              region: row.club_region,
              first,
              kind: copy.kind,
              choice: suggestionLabel(row.field),
              message: row.message,
              hasAddress: Number(row.has_address) === 1,
              waitedDays: wholeDaysSince(row.created_at, now.getTime()),
              dueDays: SUGGESTION_DUE_DAYS,
              link: suggestionLink(siteUrl, { id: row.club_id, slug: row.club_slug }, copy.kind, row.id),
            })
            // The reply-to is left to sendEmail, LCA's own: never the visitor's.
            await sendEmail(env, { ...mail, to: copy.person.email }, gate)
            taken++
            untaken.delete(row.id)
            answer.sent++
          } catch {
            // The failure's own words are not logged: a service's refusal may name the address it refused.
            console.warn(CLOCK_NOT_SENT_LOG)
            answer.notSent++
          }
        }
        if (taken > 0) {
          answer.passedOn++
          continue
        }
        console.warn(CLOCK_NONE_TAKEN_LOG)
      }
    } finally {
      // Every claim no email was taken for goes back in one batch, one query however many there are, on every way
      // out of the loop.
      if (untaken.size > 0) {
        try {
          await env.DB.batch([...untaken].map((id) => env.DB.prepare('UPDATE club_reports SET escalated_at = NULL WHERE id = ? AND escalated_at = ?').bind(id, stamp)))
        } catch {
          console.warn(CLOCK_CLAIM_KEPT_LOG)
        }
      }
    }
    return {
      outcome: outcomeOf(answer),
      sentCount: answer.sent,
      failedCount: answer.notSent,
      detail: `${options.manual ? 'manual: ' : ''}${answer.passedOn} passed on, ${answer.sent} sent, ${answer.notSent} not sent, ${answer.notReached} left for the next run`,
    }
  })
  return answer
}

/**
 * The people one suggestion goes to: the region's representatives given, then the LCA admins, each once by member id
 * and by address, an LCA admin who also holds the seat written to as an LCA admin, and never the visitor's own
 * address.
 */
function copiesOf(region: readonly Keeper[], lca: readonly Keeper[], typed: string): Copy[] {
  const key = (person: Keeper) => person.email.trim().toLowerCase()
  const adminIds = new Set(lca.map((person) => person.id))
  const adminAddresses = new Set(lca.map(key))
  const seenIds = new Set<string>()
  const seenAddresses = new Set<string>(typed ? [typed] : [])
  const copies: Copy[] = []
  const add = (person: Keeper, kind: Copy['kind']) => {
    const address = key(person)
    if (!address || seenIds.has(person.id) || seenAddresses.has(address)) return
    seenIds.add(person.id)
    seenAddresses.add(address)
    copies.push({ person, kind })
  }
  for (const person of region) if (!adminIds.has(person.id) && !adminAddresses.has(key(person))) add(person, 'region')
  for (const person of lca) add(person, 'lca')
  return copies
}
