// functions/utils/admin/automations.ts
//
// The run record of the scheduled jobs: one row in automation_runs
// (migration 0068) for each run of a job, such as 'clearinghouse_sync', or
// 'daily:<phase>' and 'five_minute:<phase>' for the two runs of the
// daily-emails worker, so an admin can see when each last ran and how it
// went.
//
// recordRun opens the row before the job's work starts, with the outcome
// 'failed' and no finished_at, and closes it with the outcome and counts the
// work gives. So a run that never closes (the worker stopped part way) reads
// as failed, which is the truth an admin needs. A phase that throws is
// recorded as failed, and recordRun does not throw on.
//
// Recording is never the reason a job fails: when the table is not there
// yet (a build live before migration 0068 has run) or a write fails, the
// work still runs, its answer still comes back, and one log line says so,
// naming no person.
//
// detail is one plain line for the admin; never a secret, a token or an
// email address. Every detail, the work's own and a thrown error's words
// alike, goes through plainDetail before it is written: addresses, long
// runs that look like a token or a key, a link's query and the value after
// a word such as "token" or "secret" are each put as a plain mark, and the
// line is cut to MAX_DETAIL_LENGTH characters. A thrown value whose words
// cannot be read at all (an object with no prototype, a toString or a
// message that throws) is written as THROWN_UNREADABLE_DETAIL.
//
// Plain SQL over D1's prepare and bind, and no import at all, so the
// daily-emails worker can import it with nothing more in its bundle.

/** How a run went. */
export type RunOutcome = 'ok' | 'partial' | 'failed'

/** What a job's work gives back: how it went, how many it sent and failed, and one plain line. */
export interface RunReport {
  outcome: RunOutcome
  sentCount?: number | null
  failedCount?: number | null
  detail?: string | null
}

/** What recordRun answers for a phase that threw: failed, with the thrown words made plain. */
export interface ThrownRun {
  outcome: 'failed'
  sentCount: null
  failedCount: null
  detail: string
  thrown: true
}

/** A row of automation_runs, as lastRun reads it. */
export interface AutomationRun {
  id: number
  job: string
  started_at: string
  finished_at: string | null
  outcome: RunOutcome
  sent_count: number | null
  failed_count: number | null
  detail: string | null
  seen_at: string | null
  seen_by: string | null
}

/**
 * Each job's expected interval, the longest gap in days between two of its runs before an admin should look, for the
 * admin home that reads the run record (WS08). A job joins the list when it first records its runs:
 * club_monthly_check (WS09 step 14) lands on the first Monday of each month, and two first Mondays are at most five
 * weeks apart.
 */
export const EXPECTED_INTERVAL_DAYS: Readonly<Record<string, number>> = {
  club_monthly_check: 35,
}

/** The longest detail written. */
export const MAX_DETAIL_LENGTH = 200

/** The one log line when the run record cannot be written; it names no person, no job's data and no error's words. */
export const RUN_NOT_RECORDED_LOG = 'automation run: the run record could not be written; the job ran without it'

/** The one log line for a phase that threw; the job's name follows it. */
export const RUN_THREW_LOG = 'automation run: a phase threw and is recorded as failed:'

const OUTCOMES: readonly RunOutcome[] = ['ok', 'partial', 'failed']

/** A character that is not printed: the control characters and the two line separators. */
const isControl = (code: number) => code < 0x20 || (code >= 0x7f && code < 0xa0) || code === 0x2028 || code === 0x2029

/** One plain line from any text: no address, no token, no secret, no line break, at most MAX_DETAIL_LENGTH characters. */
export function plainDetail(text: unknown): string {
  // A value with no text to give (an object with no prototype, or one whose toString throws) is read as no text, so
  // this never throws.
  let raw: string
  try {
    raw = String(text ?? '')
  } catch {
    raw = ''
  }
  // Anything that is not printed becomes a space.
  const printable = [...raw].map((c) => (isControl(c.codePointAt(0) ?? 0) ? ' ' : c)).join('')
  const line = printable
    // An at sign written percent-encoded, once or twice, as a link's query or a form body holds it, so the address rule
    // below sees the address.
    .replace(/%(?:25)*40/gi, '@')
    // An email address, or anything shaped like one.
    .replace(/[^\s@<>()[\]"',;:]*@[^\s@<>()[\]"',;:]+/g, '[address]')
    // A link's query and fragment, where a token or a key would ride.
    .replace(/(\bhttps?:\/\/[^\s?#]*)[?#]\S*/gi, '$1?[hidden]')
    // The value after a word that names a secret: "token=...", "secret: ..." and "Bearer ...".
    .replace(/\b(token|secret|password|passwd|key|apikey|api_key|signature|sig|authorization|cookie|session)(\s*[:=]\s*)("[^"]*"|'[^']*'|\S+)/gi, '$1$2[hidden]')
    .replace(/\b(bearer|basic)\s+\S+/gi, '$1 [hidden]')
    // A long run of letters, digits and the marks a token is written in.
    .replace(/[A-Za-z0-9+/_=.-]{24,}/g, '[hidden]')
    .replace(/\s+/g, ' ')
    .trim()
  // The cut never splits a character written as a pair: a first half left at the end is dropped.
  return line.length > MAX_DETAIL_LENGTH ? `${line.slice(0, MAX_DETAIL_LENGTH - 3).replace(/[\uD800-\uDBFF]$/, '').trimEnd()}...` : line
}

/** The detail of a phase that threw something whose words cannot be read at all. */
export const THROWN_UNREADABLE_DETAIL = 'The phase threw; its words could not be read.'

/** A thrown value's words made plain: an Error's message, or the value itself; never throws. */
function thrownDetail(err: unknown): string {
  try {
    const words = String((err instanceof Error ? err.message : err) ?? '')
    return plainDetail(words)
  } catch {
    return THROWN_UNREADABLE_DETAIL
  }
}

/** A count as the row holds it: a whole number of zero or more, or null. */
function countOf(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
}

/**
 * Runs one phase of a job and records the run: a row opened before the work starts and closed with the outcome, the
 * counts and the detail it gives. Answers what the work gave, or a ThrownRun when it threw; never throws itself.
 */
export async function recordRun<T extends RunReport>(db: D1Database, job: string, fn: () => Promise<T>): Promise<T | ThrownRun> {
  let id: number | null = null
  try {
    const opened = await db.prepare("INSERT INTO automation_runs (job, outcome) VALUES (?, 'failed') RETURNING id").bind(job).first<{ id: number }>()
    id = opened?.id ?? null
    if (id === null) console.warn(RUN_NOT_RECORDED_LOG)
  } catch {
    console.warn(RUN_NOT_RECORDED_LOG)
  }

  let answer: T | ThrownRun
  try {
    answer = await fn()
  } catch (err) {
    console.warn(RUN_THREW_LOG, job)
    answer = { outcome: 'failed', sentCount: null, failedCount: null, detail: thrownDetail(err), thrown: true }
  }

  if (id !== null) {
    try {
      // Read inside the try, so a report that cannot be read leaves the run reading as failed rather than throwing.
      const outcome: RunOutcome = OUTCOMES.includes(answer?.outcome) ? answer.outcome : 'failed'
      const detail = answer?.detail === undefined || answer?.detail === null ? null : plainDetail(answer.detail)
      await db.prepare(
        "UPDATE automation_runs SET finished_at = datetime('now'), outcome = ?, sent_count = ?, failed_count = ?, detail = ? WHERE id = ?",
      ).bind(outcome, countOf(answer?.sentCount), countOf(answer?.failedCount), detail === '' ? null : detail, id).run()
    } catch {
      console.warn(RUN_NOT_RECORDED_LOG)
    }
  }
  return answer
}

/** The latest run of a job, the later row first when two started in the same second; null when it has never run. */
export async function lastRun(db: D1Database, job: string): Promise<AutomationRun | null> {
  return db.prepare(
    `SELECT id, job, started_at, finished_at, outcome, sent_count, failed_count, detail, seen_at, seen_by
     FROM automation_runs WHERE job = ? ORDER BY started_at DESC, id DESC LIMIT 1`,
  ).bind(job).first<AutomationRun>()
}
