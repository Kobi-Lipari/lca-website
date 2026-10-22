// domain/events/schedules.ts
// What a tournament's round schedule is, and the rules every writer and
// reader of schedules shares. The server's one writer and reader is
// functions/utils/events/schedulesRepo.ts; the request and response
// contracts are in domain/contracts/events.ts. This file imports no zod, so
// the site can use it at runtime.
//
// Every tournament has one primary (main) schedule, kept in
// tournament_schedules with its rounds in tournament_schedule_rounds. An
// event can add other schedules that merge into the primary: a 2-day
// schedule beside a 3-day one, say, plays its own rounds 1 and 2 on
// Saturday morning and from round 3 (its merge round) plays with everyone
// else on the primary's times. A player's choice is registrations.schedule_id;
// until the entry form offers the choice (WS06) every entry is on the primary.
//
// The legacy tournaments.round_schedule JSON holds the primary's rounds in
// today's shape, [{ round, date, time }], and is written by the writer only
// (a mirror kept for old code until the JSON columns are retired).

/** One round of a schedule as stored. date and time are text as the setup wrote them, blanks included; null means not set. */
export interface ScheduleRoundRecord {
  round: number
  date: string | null
  time: string | null
}

/** A row of tournament_schedules with its rounds, read back. */
export interface ScheduleRecord {
  id: string
  tournamentId: string
  position: number
  label: string
  /** null means the tournament's own time control. */
  timeControl: string | null
  isPrimary: boolean
  /** The first round this schedule plays with the primary; null on the primary. */
  mergeRound: number | null
  archivedAt: string | null
  /** By round number. */
  rounds: ScheduleRoundRecord[]
}

/**
 * A schedule as a save takes it. An id names the row being edited; a
 * primary without one is the event's existing primary (every event has
 * one), and any other schedule without one is new. label and timeControl
 * left out keep what the row has.
 */
export interface ScheduleInput {
  id?: string
  label?: string
  timeControl?: string | null
  isPrimary: boolean
  mergeRound?: number | null
  rounds: ReadonlyArray<{ round: number; date?: string | null; time?: string | null }>
}

/** The least a schedule needs for the rules below. */
export interface ScheduleShape<R extends { round: number } = { round: number }> {
  id?: string
  label?: string
  isPrimary: boolean
  mergeRound?: number | null
  rounds: readonly R[]
}

/** Schedule labels are 1 to 80 characters, like section names. */
export const SCHEDULE_LABEL_MAX = 80

/** The label the 0052 default gives a primary schedule. */
export const PRIMARY_SCHEDULE_LABEL = 'Main schedule'

/** The label a second schedule gets when the setup sends none. */
export const OTHER_SCHEDULE_LABEL = 'Second schedule'

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * A JSON round number read the way SQLite's CAST(x AS INTEGER) reads it, as
 * the 0053 trigger does: a whole number as it is, a fraction cut toward
 * zero, text by its leading whole number (after leading spaces; 0 when it
 * has none). Anything else, or a number past the safe range, is no round.
 */
function castRound(value: unknown): number | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    const n = Math.trunc(value)
    return Number.isSafeInteger(n) ? n : null
  }
  if (typeof value === 'string') {
    const m = /^[ \t\n\v\f\r]*([+-]?\d+)/.exec(value)
    if (!m) return 0
    const n = Number(m[1])
    return Number.isSafeInteger(n) ? n : null
  }
  return null
}

/**
 * The rounds of a legacy round_schedule value, as the rows the 0053 sync
 * trigger makes of it (its step 6), sorted by round.
 *
 * Takes the column's text or an already parsed value. Text that is not
 * JSON, and JSON that is not an array, give no rounds. Only objects count;
 * the round is read as SQLite casts it and must be 1 or more; a round given
 * twice keeps its first entry; date and time are kept only when they are
 * text (blank text included), and are null otherwise. Other keys are
 * dropped. Times are free text from the setup form and are never
 * reformatted.
 */
export function normalizeRoundSchedule(value: unknown): ScheduleRoundRecord[] {
  let parsed: unknown = value
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value)
    } catch {
      return []
    }
  }
  if (!Array.isArray(parsed)) return []
  const byRound = new Map<number, ScheduleRoundRecord>()
  for (const element of parsed) {
    if (!isPlainObject(element)) continue
    const round = castRound(element.round)
    if (round === null || round < 1 || byRound.has(round)) continue
    byRound.set(round, {
      round,
      date: typeof element.date === 'string' ? element.date : null,
      time: typeof element.time === 'string' ? element.time : null,
    })
  }
  return [...byRound.values()].sort((a, b) => a.round - b.round)
}

/**
 * The legacy round_schedule JSON for a primary schedule's rounds, in
 * today's shape: [{ round, date, time }] by round. The 0053 trigger reads
 * this back into exactly these rows.
 */
export function roundScheduleJson(rounds: readonly ScheduleRoundRecord[]): string {
  return JSON.stringify([...rounds]
    .sort((a, b) => a.round - b.round)
    .map((r) => ({ round: r.round, date: r.date, time: r.time })))
}

const quoted = (label: string | undefined) => `“${label ?? 'second'}”`

/**
 * What is wrong with a list of schedules for an event of `roundCount`
 * rounds, in words for the director, or null when it can be saved.
 *
 * - exactly one schedule is the primary, and it has no merge round
 * - every round number is a whole number of 1 or more, given once per schedule
 * - every other schedule has a merge round from 2 to the event's round
 *   count, and lists exactly its own rounds 1 to the merge round less one;
 *   from the merge round on its players play on the primary's times
 * - labels, when given, are 1 to 80 characters and differ; an id is listed once
 *
 * The primary's rounds are not held to the round count: the setup form
 * keeps them in step with it, and an event saved earlier may differ.
 */
export function validateSchedules(schedules: readonly ScheduleShape[], roundCount: number): string | null {
  const primaries = schedules.filter((s) => s.isPrimary)
  if (primaries.length !== 1) return 'Mark exactly one schedule as the main schedule.'

  const labels = new Set<string>()
  const ids = new Set<string>()
  for (const s of schedules) {
    if (s.label !== undefined) {
      if (s.label.trim() === '') return 'Every schedule needs a name.'
      if (s.label.length > SCHEDULE_LABEL_MAX) return `Schedule names can be at most ${SCHEDULE_LABEL_MAX} characters.`
      if (labels.has(s.label)) return `Two schedules are named “${s.label}”. Give each schedule its own name.`
      labels.add(s.label)
    }
    if (s.id !== undefined) {
      if (ids.has(s.id)) return 'The same schedule is listed twice.'
      ids.add(s.id)
    }
    const seen = new Set<number>()
    for (const r of s.rounds) {
      if (!Number.isInteger(r.round) || r.round < 1) return 'Round numbers are whole numbers from 1 up.'
      if (seen.has(r.round)) return `Round ${r.round} is listed twice in the ${s.isPrimary ? 'main' : quoted(s.label)} schedule.`
      seen.add(r.round)
    }
  }

  for (const s of schedules) {
    if (s.isPrimary) {
      if (s.mergeRound != null) return 'The main schedule has no merge round.'
      continue
    }
    const name = quoted(s.label)
    const merge = s.mergeRound
    if (roundCount < 2) return `The ${name} schedule needs an event of at least 2 rounds to merge into the main schedule.`
    if (merge == null || !Number.isInteger(merge) || merge < 2 || merge > roundCount) {
      return `The ${name} schedule must join the main schedule at a round from 2 to ${roundCount}.`
    }
    const own = new Set(s.rounds.map((r) => r.round))
    const extra = s.rounds.find((r) => r.round >= merge)
    if (extra) {
      return `From round ${merge} the ${name} schedule plays on the main schedule's times, so it lists only rounds 1 to ${merge - 1}.`
    }
    for (let round = 1; round < merge; round++) {
      if (!own.has(round)) {
        return `The ${name} schedule needs its own time for each round from 1 to ${merge - 1} (round ${round} is missing).`
      }
    }
  }
  return null
}

/** The primary schedule of a list, or null when it has none. */
export function primarySchedule<S extends { isPrimary: boolean }>(schedules: readonly S[]): S | null {
  return schedules.find((s) => s.isPrimary) ?? null
}

/**
 * The schedule whose times a player on `scheduleId` keeps in `round`, for
 * the pairing side: before its merge round a player on another schedule
 * plays with that schedule's players, and from the merge round on with
 * everyone on the primary. A player on the primary, with no schedule
 * (null), or on a schedule the list does not have is on the primary.
 * Null only when the list has no primary.
 */
export function scheduleForRound<S extends ScheduleShape>(schedules: readonly S[], scheduleId: string | null | undefined, round: number): S | null {
  const primary = primarySchedule(schedules)
  const own = scheduleId == null ? undefined : schedules.find((s) => s.id === scheduleId)
  if (!own || own.isPrimary || own.mergeRound == null) return primary
  return round < own.mergeRound ? own : primary
}

/**
 * A player's own list of rounds: on another schedule, that schedule's
 * rounds before its merge round and the primary's from the merge round on;
 * on the primary (or with no schedule, or one the list does not have), the
 * primary's. By round number.
 */
export function roundsFor<R extends { round: number }, S extends ScheduleShape<R>>(
  schedules: readonly S[],
  scheduleId: string | null | undefined,
): R[] {
  const primary = primarySchedule(schedules)
  const own = scheduleId == null ? undefined : schedules.find((s) => s.id === scheduleId)
  const primaryRounds = primary ? [...primary.rounds] : []
  if (!own || own.isPrimary || own.mergeRound == null) return primaryRounds.sort((a, b) => a.round - b.round)
  const merge = own.mergeRound
  return [
    ...own.rounds.filter((r) => r.round < merge),
    ...primaryRounds.filter((r) => r.round >= merge),
  ].sort((a, b) => a.round - b.round)
}

/** The refusal when a schedule the setup left out still has entries. */
export function scheduleHasEntriesMessage(label: string, entries: number): string {
  return entries === 1
    ? `1 entry is on the ${quoted(label)} schedule. Move it to another schedule first.`
    : `${entries} entries are on the ${quoted(label)} schedule. Move them to another schedule first.`
}

/** The refusal when the schedules changed between reading them and saving. */
export const SCHEDULES_CHANGED_MESSAGE = 'These schedules changed while you were saving. Reload the page and try again.'

/** The refusal when a request sends both forms of the round times. */
export const SCHEDULE_FORMS_MESSAGE = 'Send the round times as roundSchedule or as schedules, not both.'
