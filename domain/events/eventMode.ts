// domain/events/eventMode.ts
// The one definition of the event-mode phases: where an LCA-run event stands
// for the people involved in it, from the week before until two days after.
// The member endpoint (GET /api/me/event-mode, WS02), the homepage hero (WS03)
// and the event-day view (WS13) all read the phase from here, so the strip,
// the hero and the event page never disagree about what moment it is.
//
// Everything here is pure: the caller reads the tournament row and its round
// schedule and passes plain values in. No database, no DOM, no host clock and
// no host time zone. Every boundary is a Louisiana wall-clock time turned into
// an instant through domain/format/centralTime.ts, so the phases change at
// the right moment on both clock-change Sundays whatever zone the code runs in.

import { lcaTimeToMs } from '../format/centralTime'
import { zonedParts } from '../format/date'

/** Every phase the brief names, in the order an event moves through them. */
export const EVENT_PHASES = [
  'week',
  'dayBefore',
  'checkin',
  'eventDay',
  'roundPosted',
  'roundInProgress',
  'between',
  'final',
  'after',
] as const

export type EventPhase = (typeof EVENT_PHASES)[number]

/**
 * What the phase is computed from. Plain values only, so the caller decides
 * how to read them (a D1 row on the server, an /api/me row in the browser).
 */
export interface EventPhaseInput {
  /** Day 1 as stored in `tournaments.date`: a Louisiana calendar day, "YYYY-MM-DD". */
  date: string
  /** The last day (`tournaments.end_date`), or null for a one-day event. */
  endDate: string | null
  /** `tournaments.status`. Only 'completed' changes the phase. */
  status: string
  /**
   * The first round time of each event day, keyed by the day ("YYYY-MM-DD")
   * with a 24-hour "HH:MM" value as `round_schedule` stores it. A day whose
   * value is null, blank or not a real time has a round whose time is not set
   * yet ("time to be announced"). A day with no key at all has no round: it is
   * an off day, as long as at least one day of the event has a key. With no
   * key for any event day, the schedule is not written yet and every day counts
   * as "time to be announced". Build this with `firstRoundTimesFromSchedule`,
   * which keeps the difference and leaves a day without a key only when every
   * round is dated inside the event; while any round is undated or dated
   * outside the event, each day with no round of its own is null instead.
   */
  firstRoundTimes: Readonly<Record<string, string | null | undefined>>
  /**
   * True when every section has a result for its last scheduled round (the
   * same test the homepage's results hero uses). Pass false when the event has
   * no rounds or no pairings yet.
   */
  lastRoundResultsComplete: boolean
}

/** How long event mode stays on after the event ends. */
export const AFTER_EVENT_MS = 48 * 60 * 60 * 1000

const DAY = /^\d{4}-\d{2}-\d{2}$/

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Event days, and the week before, start at 6:00 AM Louisiana time. */
const OPENING_HOUR = 6
const DAY_OPENS = `${pad(OPENING_HOUR)}:00`

/** A stored day as "YYYY-MM-DD", or null when it is not a real calendar day. */
function readDay(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const v = value.trim()
  if (!DAY.test(v)) return null
  const p = zonedParts(v)
  return p ? `${p.year}-${pad(p.month)}-${pad(p.day)}` : null
}

/** A stored clock time as "HH:MM", or null when it is blank or not a real time. */
function readClock(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return `${pad(h)}:${pad(min)}`
}

/** The calendar day `n` days after `day` (negative goes back). Pure calendar arithmetic. */
function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

/** The instant of a Louisiana wall-clock time on a calendar day. */
function at(day: string, clock: string): number {
  return lcaTimeToMs(`${day} ${clock}`)
}

function own(record: Readonly<Record<string, unknown>>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key)
}

interface EventDays {
  first: string
  last: string
}

/** Day 1 and the last day. An end date that is missing, unreadable or before day 1 means a one-day event. */
function eventDays(input: Pick<EventPhaseInput, 'date' | 'endDate'>): EventDays | null {
  const first = readDay(input.date)
  if (!first) return null
  const end = readDay(input.endDate)
  return { first, last: end && end > first ? end : first }
}

/**
 * When the event ends: 11:59 PM Louisiana time on its last day
 * (`end_date ?? date`). The 48 hours of `after` count from here.
 */
export function eventEndMs(input: Pick<EventPhaseInput, 'date' | 'endDate'>): number | null {
  const days = eventDays(input)
  return days ? at(days.last, '23:59') : null
}

/**
 * The span event mode is on: from 6:00 AM Louisiana time six days before
 * day 1, up to (not including) the event's end plus 48 hours. The 48 hours
 * are real elapsed time, so across the November clock change the window
 * closes at 10:59 PM rather than 11:59 PM.
 */
export function eventModeWindow(
  input: Pick<EventPhaseInput, 'date' | 'endDate'>,
): { start: number; end: number } | null {
  const days = eventDays(input)
  if (!days) return null
  return {
    start: at(addDays(days.first, -6), DAY_OPENS),
    end: at(days.last, '23:59') + AFTER_EVENT_MS,
  }
}

/** The first round day after `day`, up to the last day, or null when none is left. */
function nextRoundDay(
  times: EventPhaseInput['firstRoundTimes'],
  day: string,
  last: string,
): string | null {
  let next: string | null = null
  for (const key of Object.keys(times)) {
    if (key > day && key <= last && readDay(key) === key && (next === null || key < next)) next = key
  }
  return next
}

/** True when at least one day of the event has a key, so a day with no key is an off day. */
function scheduleNamesEventDays(times: EventPhaseInput['firstRoundTimes'], days: EventDays): boolean {
  return Object.keys(times).some((key) => key >= days.first && key <= days.last && readDay(key) === key)
}

/**
 * The event-mode phase at `now`, or null outside the window.
 *
 * The brief's Phase 0 rules (WS02, "Event mode"; DESIGN_REPLAN_phase0.md,
 * "Window and phases"), all in Louisiana time:
 * - `week`: from 6:00 AM six days before day 1 until midnight starting the
 *   day before.
 * - `dayBefore`: the calendar day before day 1.
 * - `checkin`: each event day from 6:00 AM until that day's first round
 *   time. A day whose round has no time set stays in `checkin` all day.
 * - `eventDay`: from that day's first round time to the end of the day.
 * - `final`: the event is marked completed, or every section has a result
 *   for its last scheduled round. It wins over the phases above and lasts
 *   until the event ends (11:59 PM on its last day).
 * - `after`: from the end of a final event until the end plus 48 hours.
 *
 * Where this goes beyond the brief (recorded as WS01 deviations and
 * decisions in REDESIGN_STATUS.md, step 5):
 * - `eventDay` does not stop at 11:59 PM, as the brief says. It runs until
 *   6:00 AM the next morning, so a round still being played after midnight
 *   keeps its day and the night has a phase. On the last day this runs past
 *   the event's end.
 * - An event that is not final reaches `after` at 6:00 AM the morning after
 *   its last day, not at 11:59 PM, and stays there until the window closes.
 *   The brief starts `after` only from `final`. The strip wording
 *   (src/lib/eventModeCopy.ts) reads `status` and `lastRoundResultsComplete`
 *   to choose between "final standings posted" and "results still coming in".
 * - `dayBefore` runs on through the night until 6:00 AM on day 1, the gap
 *   the brief leaves between the calendar day before and check-in.
 * - A day inside the event with no round in the schedule (no key in
 *   `firstRoundTimes` while other event days have one) is not a playing
 *   day. It is `dayBefore` when the next round day is tomorrow, `week` when
 *   it is further off, and `eventDay` when no round day is left. Such a day
 *   starts at 6:00 AM, like every event day. `firstRoundTimesFromSchedule`
 *   leaves a day without a key only when every round is dated inside the
 *   event, so a schedule still being written never makes an off day.
 *
 * Phases change at 6:00 AM, never at midnight, except `week` to `dayBefore`
 * before day 1, which the brief sets at midnight.
 *
 * `roundPosted`, `roundInProgress` and `between` are part of the type but
 * are never returned yet. They need round publications and the live state
 * from WS07; when those exist they become inputs here, `checkin` ends when
 * round 1 is published, and `eventDay` is no longer produced.
 */
export function eventPhase(input: EventPhaseInput, now: number | Date): EventPhase | null {
  const t = typeof now === 'number' ? now : now.getTime()
  if (!Number.isFinite(t)) return null
  const days = eventDays(input)
  const span = eventModeWindow(input)
  if (!days || !span) return null
  if (t < span.start || t >= span.end) return null

  if (input.status === 'completed' || input.lastRoundResultsComplete) {
    return t < at(days.last, '23:59') ? 'final' : 'after'
  }

  // The event day `now` belongs to: before 6:00 AM it is still the day before.
  const p = zonedParts(t)
  if (!p || p.hour === undefined) return null
  const today = `${p.year}-${pad(p.month)}-${pad(p.day)}`
  const day = p.hour < OPENING_HOUR ? addDays(today, -1) : today

  if (day < days.first) return t < at(addDays(days.first, -1), '00:00') ? 'week' : 'dayBefore'
  if (day > days.last) return 'after'

  const times = input.firstRoundTimes
  if (!own(times, day) && scheduleNamesEventDays(times, days)) {
    // No round on this day: an off day between (or after) the playing days.
    const next = nextRoundDay(times, day, days.last)
    if (next === null) return 'eventDay'
    return next === addDays(day, 1) ? 'dayBefore' : 'week'
  }
  const clock = own(times, day) ? readClock(times[day]) : null
  if (clock === null) return 'checkin'
  return t < at(day, clock) ? 'checkin' : 'eventDay'
}

/**
 * The key a hidden strip is stored under: `${eventId}:${phase}:${round ?? 0}`.
 * The strip, the phone's event bar and the Menu sheet's hide item all use it,
 * so a new phase or a new round always brings the strip back.
 *
 * That holds only when the caller passes a round for every phase that can
 * come back. `week` and `dayBefore` return on off days between playing days,
 * and `checkin` and `eventDay` return on each playing day, so for those four
 * the caller passes a round number from the schedule: for `week` and
 * `dayBefore`, the first round of the next playing day (1 before day 1, 2 on
 * the off days after a weekly event's round 1); for `checkin` and `eventDay`,
 * the first round of that day. Without it, a strip hidden on the day before
 * day 1 stays hidden on the day before round 2, because both keys end in
 * `:0`. The round phases pass their own round; `final` and `after` happen
 * once and may leave it out.
 */
export function phaseKey(eventId: string | number, phase: EventPhase, round?: number | null): string {
  return `${eventId}:${phase}:${round ?? 0}`
}

/** One `round_schedule` entry as stored; blank strings mean "not set yet". */
export interface RoundScheduleEntry {
  date?: string | null
  time?: string | null
}

/** The longest event the schedule helper fills day by day (a season-long weekly event fits). */
const MAX_EVENT_DAYS = 400

/**
 * The `firstRoundTimes` input from a tournament's `round_schedule` and its
 * `date` and `end_date`: for each event day that has a round, its earliest
 * round time ("HH:MM"), or null when no round that day has a time yet.
 *
 * A day with no key is an off day to `eventPhase`, so a day is left without
 * a key only when the whole schedule is dated inside the event. When any
 * round has a blank or unreadable date, or a date outside the event (a typo,
 * or a schedule left on the old dates after the event moved), the schedule
 * is still being written: every event day with no round of its own gets
 * null ("time to be announced") rather than counting as a day with no play.
 * Rounds dated outside the event are left out.
 */
export function firstRoundTimesFromSchedule(
  schedule: ReadonlyArray<RoundScheduleEntry | null | undefined> | null | undefined,
  date: string,
  endDate: string | null,
): Record<string, string | null> {
  const days = eventDays({ date, endDate })
  const out: Record<string, string | null> = {}
  let incomplete = false
  for (const entry of schedule ?? []) {
    if (!entry || typeof entry !== 'object') continue
    const day = readDay(entry.date)
    if (!day || (days && (day < days.first || day > days.last))) {
      incomplete = true
      continue
    }
    const clock = readClock(entry.time)
    const current = own(out, day) ? out[day] : null
    out[day] = clock !== null && (current === null || clock < current) ? clock : current
  }
  if (incomplete && days) {
    let day = days.first
    for (let i = 0; i < MAX_EVENT_DAYS && day <= days.last; i += 1, day = addDays(day, 1)) {
      if (!own(out, day)) out[day] = null
    }
  }
  return out
}
