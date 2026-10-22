// functions/utils/events/schedulesRepo.ts
//
// The one writer and reader of a tournament's round schedules (K2g). It
// writes the tournament_schedules and tournament_schedule_rounds rows and
// the legacy tournaments.round_schedule JSON in the same D1 batch, and every
// endpoint that answers with a tournament reads the schedules here.
// test/unit/schedules-audit.test.ts fails if anything else under functions/
// or workers/ writes the JSON column, or reads or parses it.
//
// Every tournament already has a live primary schedule: the 0053 insert
// trigger makes one for each new tournament, and the backfill made one for
// every older one. So the writer matches that primary rather than adding
// another.
//
// buildSaveSchedules plans a save and returns the queries; the caller puts
// them in its own db.batch after its own writes (runBatch in sectionsRepo),
// so an admin edit is one transaction. The order inside the plan matters:
//
// 0. guards: the plan is made from rows read before the batch, so the batch
//    first checks that the schedule rows are still exactly as read (ids,
//    primary or not, merge round, archived or not), and that no schedule
//    being removed has gained an entry since. If either fails the whole
//    batch fails and changes nothing; isSchedulesConflict recognises that
//    failure (and the one-live-primary index refusing a second primary),
//    and the handler answers 409
// 1. schedules the list leaves out are archived (never deleted); one that
//    still has entries that are not withdrawn refuses the save instead
// 2. a live primary that stops being the primary is demoted, so the
//    partial unique index on one live primary per tournament never sees
//    two; this comes before any row is made the primary or added as one
// 3. each schedule of the list, in order: its row gets its label, time
//    control, position, primary flag and merge round, or a new row is
//    added with an id made here, never by the SQL default
// 4. a schedule whose rounds changed has them deleted and written again
// 5. tournaments.round_schedule is written last, in today's shape: the
//    primary's rounds as [{ round, date, time }]
//
// The 0053 triggers stay installed. tournaments_sections_sync_update fires
// on step 5 (it is AFTER UPDATE OF sections, round_schedule) and finds the
// table already final: a live primary exists, and the rounds it would make
// from the JSON are the primary's rows exactly, so it changes nothing. It is
// still what keeps the table in step when old code writes only the JSON.
import { and, asc, count, desc, eq, inArray, isNull, sql, type SQL } from 'drizzle-orm'
import type { Db } from '../../db/client'
import { registrations, tournamentScheduleRounds, tournamentSchedules, tournaments } from '../../db/schema'
import type { Schedule, ScheduleRound } from '../../../domain/contracts/events'
import {
  OTHER_SCHEDULE_LABEL,
  PRIMARY_SCHEDULE_LABEL,
  normalizeRoundSchedule,
  primarySchedule,
  roundScheduleJson,
  scheduleHasEntriesMessage,
  validateSchedules,
  type ScheduleInput,
  type ScheduleRecord,
  type ScheduleRoundRecord,
} from '../../../domain/events/schedules'
import type { SectionQuery } from './sectionsRepo'

export type ScheduleQuery = SectionQuery

/**
 * What a failing guard raises: json_extract with a malformed path, as in
 * sectionsRepo, with its own path so the two can be told apart.
 */
const GUARD_PATH = '$schedules changed'
const GUARD_ERROR = `bad JSON path: '${GUARD_PATH}`
/** The one-live-primary index (0052) refusing a second primary. */
const PRIMARY_TAKEN = 'UNIQUE constraint failed: tournament_schedules.tournament_id'

/**
 * True when a batch failed because the schedules changed after its plan was
 * made: a guard of the plan failed, or another save made a primary first.
 * The handler answers this with 409 and SCHEDULES_CHANGED_MESSAGE.
 */
export function isSchedulesConflict(err: unknown): boolean {
  // Drizzle may wrap the D1 error, so its causes are read too.
  for (let e: unknown = err, depth = 0; e != null && depth < 5; depth++) {
    const message = typeof e === 'object' && typeof (e as { message?: unknown }).message === 'string'
      ? (e as { message: string }).message
      : String(e)
    if (message.includes(GUARD_ERROR) || message.includes(PRIMARY_TAKEN)) return true
    e = typeof e === 'object' ? (e as { cause?: unknown }).cause : undefined
  }
  return false
}

/** D1 binds at most 100 parameters to one statement; ids per IN (...) list leave room for the rest. */
const IN_LIST_SIZE = 90

/** Round rows per INSERT: four parameters each, under D1's 100. */
const ROUNDS_PER_INSERT = 20

function chunks<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** A new schedule id: 16 hex characters, like the ids the migrations made. */
export function newScheduleId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16)
}

/**
 * The schedule rows of a tournament as one string: id, primary flag, merge
 * round and archived_at of each, by id. The guard works out the same string
 * in SQL from the table as it is when the batch runs.
 */
export function schedulesFingerprint(rows: ReadonlyArray<Pick<ScheduleRecord, 'id' | 'isPrimary' | 'mergeRound' | 'archivedAt'>>): string {
  return [...rows]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((r) => `${r.id}\u001f${r.isPrimary ? 1 : 0}\u001f${r.mergeRound ?? ''}\u001f${r.archivedAt ?? ''}`)
    .join('\u001e')
}

/** A guard: fails the batch it is in when `condition` holds as the batch runs (see sectionsRepo). */
function guard(db: Db, tournamentId: string, condition: SQL): ScheduleQuery {
  return db.select({ guard: sql`json_extract('{}', ${sql.raw(`'${GUARD_PATH} '`)} || ${tournaments.id})` })
    .from(tournaments)
    .where(and(eq(tournaments.id, tournamentId), condition))
}

const inList = (values: readonly string[]) => sql`(${sql.join(values.map((v) => sql`${v}`), sql`, `)})`

function planGuards(db: Db, tournamentId: string, existing: readonly ScheduleRecord[], removed: readonly ScheduleRecord[]): ScheduleQuery[] {
  const out = [guard(db, tournamentId, sql`ifnull((
    SELECT group_concat(v, char(30)) FROM (
      SELECT id || char(31) || is_primary || char(31) || ifnull(merge_round, '') || char(31) || ifnull(archived_at, '') AS v
      FROM tournament_schedules WHERE tournament_id = ${tournamentId} ORDER BY id
    )), '') <> ${schedulesFingerprint(existing)}`)]
  for (const part of chunks(removed.map((r) => r.id), IN_LIST_SIZE)) {
    out.push(guard(db, tournamentId, sql`EXISTS (SELECT 1 FROM registrations
      WHERE tournament_id = ${tournamentId} AND withdrawn_at IS NULL AND schedule_id IN ${inList(part)})`))
  }
  return out
}

type ScheduleRow = typeof tournamentSchedules.$inferSelect
type RoundRow = typeof tournamentScheduleRounds.$inferSelect

// Live rows first, by position; then archived ones, latest first; each
// schedule's rounds by number.
const scheduleOrder = [
  sql`${tournamentSchedules.archivedAt} IS NOT NULL`,
  desc(tournamentSchedules.archivedAt),
  asc(tournamentSchedules.position),
  sql`${tournamentSchedules}.rowid`,
  asc(tournamentScheduleRounds.round),
]

/** Folds joined rows (a schedule repeated once per round) into records, in the order given. */
function toRecords(rows: ReadonlyArray<{ schedule: ScheduleRow; round: RoundRow | null }>): ScheduleRecord[] {
  const out: ScheduleRecord[] = []
  const byId = new Map<string, ScheduleRecord>()
  for (const { schedule, round } of rows) {
    let record = byId.get(schedule.id)
    if (!record) {
      record = {
        id: schedule.id,
        tournamentId: schedule.tournamentId,
        position: schedule.position,
        label: schedule.label,
        timeControl: schedule.timeControl,
        isPrimary: schedule.isPrimary === 1,
        mergeRound: schedule.mergeRound,
        archivedAt: schedule.archivedAt,
        rounds: [],
      }
      byId.set(schedule.id, record)
      out.push(record)
    }
    if (round) record.rounds.push({ round: round.round, date: round.date, time: round.time })
  }
  return out
}

function selectSchedules(db: Db, where: SQL | undefined) {
  return db.select({ schedule: tournamentSchedules, round: tournamentScheduleRounds })
    .from(tournamentSchedules)
    .leftJoin(tournamentScheduleRounds, eq(tournamentScheduleRounds.scheduleId, tournamentSchedules.id))
    .where(where)
    .orderBy(...scheduleOrder)
}

/** A tournament's schedules with their rounds: the live ones in order, and the archived ones after them when asked. */
export async function loadSchedules(
  db: Db,
  tournamentId: string,
  opts: { includeArchived?: boolean } = {},
): Promise<ScheduleRecord[]> {
  return toRecords(await selectSchedules(db, opts.includeArchived
    ? eq(tournamentSchedules.tournamentId, tournamentId)
    : and(eq(tournamentSchedules.tournamentId, tournamentId), isNull(tournamentSchedules.archivedAt))))
}

/**
 * The schedules of many tournaments at once, by tournament id (an id with
 * none maps to []). One query per list of ids, the lists short enough for
 * D1's limit on bound parameters.
 */
export async function loadSchedulesFor(
  db: Db,
  tournamentIds: readonly string[],
  opts: { includeArchived?: boolean } = {},
): Promise<Map<string, ScheduleRecord[]>> {
  const ids = [...new Set(tournamentIds)]
  const out = new Map<string, ScheduleRecord[]>(ids.map((id) => [id, []]))
  for (const part of chunks(ids, IN_LIST_SIZE)) {
    const records = toRecords(await selectSchedules(db, opts.includeArchived
      ? inArray(tournamentSchedules.tournamentId, part)
      : and(inArray(tournamentSchedules.tournamentId, part), isNull(tournamentSchedules.archivedAt))))
    for (const record of records) out.get(record.tournamentId)?.push(record)
  }
  return out
}

/** One round as an answer gives it: a date or time not set is '' (the setup form's blank). */
export function scheduleRoundResponse(round: ScheduleRoundRecord): ScheduleRound {
  return { round: round.round, date: round.date ?? '', time: round.time ?? '' }
}

/** A live schedule as every endpoint that returns a tournament answers it (scheduleSchema). */
export function scheduleResponse(record: ScheduleRecord): Schedule {
  return {
    id: record.id,
    label: record.label,
    timeControl: record.timeControl,
    isPrimary: record.isPrimary,
    mergeRound: record.isPrimary ? null : record.mergeRound,
    rounds: record.rounds.map(scheduleRoundResponse),
  }
}

/**
 * The round_schedule of an answer: the primary schedule's rounds, in the
 * shape the column held them ([] when the event has no rounds yet).
 */
export function roundScheduleResponse(schedules: readonly ScheduleRecord[]): ScheduleRound[] {
  const primary = primarySchedule(schedules.filter((s) => s.archivedAt === null))
  return primary ? primary.rounds.map(scheduleRoundResponse) : []
}

/**
 * What a save takes: the setup form's roundSchedule (the primary's rounds
 * as the legacy JSON holds them; null clears them, and is stored as the
 * JSON null the column held before), or the whole list of live schedules.
 */
export type SaveSchedulesInput =
  | { roundSchedule: readonly unknown[] | null }
  | { schedules: readonly ScheduleInput[] }

export interface SaveSchedulesOptions {
  /** The event's round count after the save: a merge round must fall from 2 to this. */
  roundCount: number
}

export type SaveSchedulesPlan =
  | { ok: true; queries: ScheduleQuery[] }
  | { ok: false; error: string }

/** A schedule as the plan will leave it. */
interface Planned {
  row: ScheduleRecord | null
  id: string
  label: string
  timeControl: string | null
  isPrimary: boolean
  mergeRound: number | null
  rounds: ScheduleRoundRecord[]
}

const sameRounds = (a: readonly ScheduleRoundRecord[], b: readonly ScheduleRoundRecord[]) =>
  a.length === b.length && a.every((r, i) => r.round === b[i].round && r.date === b[i].date && r.time === b[i].time)

/** A request's rounds as rows: by round, a date or time left out stored as null. */
function inputRounds(rounds: ScheduleInput['rounds']): ScheduleRoundRecord[] {
  return rounds
    .map((r) => ({ round: r.round, date: r.date ?? null, time: r.time ?? null }))
    .sort((a, b) => a.round - b.round)
}

/**
 * Plans saving the schedules of a tournament and returns the queries for
 * one db.batch (see the order at the top of this file), or the reason the
 * schedules cannot be saved, in words for the director.
 *
 * With roundSchedule, the primary's rounds are replaced and every other
 * schedule is kept (and checked again against the round count). With
 * schedules, the list is the whole set of live schedules: an id names a
 * live row of this event (any other id is refused), a primary without one
 * is the existing primary, any other schedule without one is new, and a
 * live schedule left out is archived, which is refused while it has
 * entries that are not withdrawn.
 */
export async function buildSaveSchedules(
  db: Db,
  tournamentId: string,
  input: SaveSchedulesInput,
  opts: SaveSchedulesOptions,
): Promise<SaveSchedulesPlan> {
  const existing = await loadSchedules(db, tournamentId, { includeArchived: true })
  const live = existing.filter((s) => s.archivedAt === null)
  const livePrimary = primarySchedule(live)

  let planned: Planned[]
  let mirror: string
  if ('roundSchedule' in input) {
    const rounds = normalizeRoundSchedule(input.roundSchedule ?? [])
    planned = live.map((s) => ({
      row: s, id: s.id, label: s.label, timeControl: s.timeControl, isPrimary: s.isPrimary, mergeRound: s.mergeRound,
      rounds: s.isPrimary ? rounds : s.rounds,
    }))
    if (!livePrimary) {
      planned.unshift({ row: null, id: newScheduleId(), label: PRIMARY_SCHEDULE_LABEL, timeControl: null, isPrimary: true, mergeRound: null, rounds })
    }
    // roundSchedule: null keeps the JSON null the column held before.
    mirror = input.roundSchedule === null ? 'null' : roundScheduleJson(rounds)
  } else {
    const byId = new Map(live.map((s) => [s.id, s]))
    if (input.schedules.some((s) => s.id !== undefined && !byId.has(s.id))) {
      return { ok: false, error: 'One of these schedules is not part of this event. Reload the page and try again.' }
    }
    const claimed = new Set(input.schedules.map((s) => s.id).filter((id): id is string => id !== undefined))
    planned = input.schedules.map((s) => {
      let row = s.id !== undefined ? byId.get(s.id) ?? null : null
      if (!row && s.isPrimary && livePrimary && !claimed.has(livePrimary.id)) {
        row = livePrimary
        claimed.add(livePrimary.id)
      }
      return {
        row,
        id: row?.id ?? newScheduleId(),
        label: s.label ?? row?.label ?? (s.isPrimary ? PRIMARY_SCHEDULE_LABEL : OTHER_SCHEDULE_LABEL),
        timeControl: s.timeControl !== undefined ? s.timeControl : row?.timeControl ?? null,
        isPrimary: s.isPrimary,
        mergeRound: s.mergeRound ?? null,
        rounds: inputRounds(s.rounds),
      }
    })
    mirror = roundScheduleJson(primarySchedule(planned)?.rounds ?? [])
  }

  const problem = validateSchedules(planned, opts.roundCount)
  if (problem) return { ok: false, error: problem }

  // Schedules the list leaves out: only one without entries is archived.
  const kept = new Set(planned.map((p) => p.row?.id).filter((id): id is string => id !== undefined))
  const removed = live.filter((s) => !kept.has(s.id))
  if (removed.length > 0) {
    const entries = new Map<string, number>()
    for (const part of chunks(removed.map((s) => s.id), IN_LIST_SIZE)) {
      const rows = await db.select({ scheduleId: registrations.scheduleId, n: count() }).from(registrations)
        .where(and(
          eq(registrations.tournamentId, tournamentId),
          isNull(registrations.withdrawnAt),
          inArray(registrations.scheduleId, part),
        ))
        .groupBy(registrations.scheduleId)
      for (const row of rows) if (row.scheduleId) entries.set(row.scheduleId, row.n)
    }
    for (const s of removed) {
      const n = entries.get(s.id) ?? 0
      if (n > 0) return { ok: false, error: scheduleHasEntriesMessage(s.label, n) }
    }
  }

  // 0. Guards.
  const queries: ScheduleQuery[] = planGuards(db, tournamentId, existing, removed)

  // 1. Archive the schedules left out.
  for (const part of chunks(removed.map((s) => s.id), IN_LIST_SIZE)) {
    queries.push(db.update(tournamentSchedules)
      .set({ archivedAt: sql`datetime('now')` })
      .where(inArray(tournamentSchedules.id, part)))
  }

  // 2. A live primary that stays but stops being the primary steps down first.
  for (const p of planned) {
    if (p.row && p.row.isPrimary && !p.isPrimary) {
      queries.push(db.update(tournamentSchedules).set({ isPrimary: 0 }).where(eq(tournamentSchedules.id, p.row.id)))
    }
  }

  // 3. Each schedule's own fields, or a new row.
  planned.forEach((p, position) => {
    const fields = {
      position,
      label: p.label,
      timeControl: p.timeControl,
      isPrimary: p.isPrimary ? 1 : 0,
      mergeRound: p.isPrimary ? null : p.mergeRound,
    }
    if (p.row) {
      const r = p.row
      const unchanged = r.position === fields.position && r.label === fields.label && r.timeControl === fields.timeControl
        && r.isPrimary === p.isPrimary && r.mergeRound === fields.mergeRound
      if (!unchanged) queries.push(db.update(tournamentSchedules).set(fields).where(eq(tournamentSchedules.id, r.id)))
    } else {
      queries.push(db.insert(tournamentSchedules).values({ id: p.id, tournamentId, ...fields }))
    }
  })

  // 4. Rounds that changed: written again whole.
  for (const p of planned) {
    if (p.row && sameRounds(p.row.rounds, p.rounds)) continue
    if (p.row) queries.push(db.delete(tournamentScheduleRounds).where(eq(tournamentScheduleRounds.scheduleId, p.id)))
    for (const part of chunks(p.rounds, ROUNDS_PER_INSERT)) {
      queries.push(db.insert(tournamentScheduleRounds).values(part.map((r) => ({ scheduleId: p.id, ...r }))))
    }
  }

  // 5. The legacy JSON, last.
  queries.push(db.update(tournaments).set({ roundSchedule: mirror }).where(eq(tournaments.id, tournamentId)))

  return { ok: true, queries }
}

/**
 * The reason the event's live schedules no longer fit a new round count (a
 * merge round past the last round), or null. For an edit that changes the
 * round count without sending the schedules.
 */
export async function schedulesProblemForRounds(db: Db, tournamentId: string, roundCount: number): Promise<string | null> {
  const live = await loadSchedules(db, tournamentId)
  if (!live.some((s) => !s.isPrimary)) return null
  return validateSchedules(live, roundCount)
}

/**
 * The batch side of schedulesProblemForRounds: a guard that fails the batch
 * when, as it runs, a live second schedule of the event merges past the
 * event's last round (or has no merge round). It reads the round count from
 * the tournaments row inside the batch, so it goes after the batch's own
 * update of that row and after its schedule writes. A save that lands
 * between the handler's reads and its batch (a new round count, or a second
 * schedule) would otherwise leave a merge round the event no longer reaches.
 * The failure is one isSchedulesConflict knows, so the handler answers 409.
 */
export function schedulesFitRoundsGuard(db: Db, tournamentId: string): ScheduleQuery {
  return guard(db, tournamentId, sql`EXISTS (SELECT 1 FROM tournament_schedules
    WHERE tournament_id = ${tournamentId} AND archived_at IS NULL AND is_primary = 0
      AND (merge_round IS NULL OR merge_round > ${tournaments.rounds}))`)
}
