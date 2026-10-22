// functions/utils/events/sectionsRepo.ts
//
// The one writer of a tournament's sections (K2b). It writes the
// tournament_sections rows and the legacy tournaments.sections JSON in the
// same D1 batch, so a reader can use either, and a later change that moves a
// reader from the JSON to the table can be reverted on its own.
// test/unit/sections-writer-audit.test.ts fails if anything else under
// functions/ or workers/ writes the JSON column.
//
// buildSaveSections plans a save and returns the queries; the caller puts
// them in its own db.batch after its own tournament write (runBatch below),
// so an admin edit is one transaction. The order inside the plan matters:
//
// 0. guards: the plan is made from rows read before the batch, so the batch
//    first checks that those rows are still exactly as read (ids, names,
//    archived or not) and that no section being removed has gained an
//    entry or a game since. If either fails, the whole batch fails and
//    changes nothing; isSectionsConflict recognises that failure (and the
//    live-name index refusing a name another save just took), and the
//    handlers answer 409
// 1. sections the list leaves out are archived (archived_at, never deleted);
//    one that still has entries that are not withdrawn, or games, refuses
//    the whole save instead (decision 7)
// 2. every live row being renamed first takes a temporary name no section
//    can have (longer than the 80 characters a name may be, and holding the
//    row id), so swaps and rotations never meet the live-name unique index
// 3. each section of the list, in order: its row gets its final name, its
//    position and its fields (an archived row it names comes back), or a
//    new row is added with an id made here, never by the SQL default
// 4. entries of a renamed row take the new name (matched by section_id);
//    games and the report_settings.sections key move from the old name
// 5. tournaments.sections is written last, in today's shape
//
// The 0053 triggers stay installed. tournaments_sections_sync_update fires on
// step 5 and finds the table already as the JSON says (live rows with the
// final names, the left-out ones archived, the same columns it would copy),
// so it changes nothing; it is still what keeps the table in step when old
// code writes only the JSON. registrations_fill_section_update fires on
// step 4 and resolves the new name to the same row.
//
// It is also where every reader gets sections (K2e): loadSections and
// loadSectionsFor read the rows, sectionResponse gives a row the shape the
// endpoints answer with, and toTournamentResponse turns a tournaments row
// into an answer, so no handler returns the JSON column or parses it.
// test/unit/sections-reader-audit.test.ts fails on a parse of the column
// outside this file and domain/, and on a handler that answers with a
// SELECT * row without toTournamentResponse. The round schedule in that
// answer comes from the schedule rows (schedulesRepo.ts, K2g), never from
// the round_schedule column.
import { and, asc, count, desc, eq, inArray, isNull, sql, type SQL } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import type { Db } from '../../db/client'
import type { TournamentRow } from '../../types'
import { registrations, tournamentGames, tournamentSections, tournaments } from '../../db/schema'
import type { SavedSection, Schedule, ScheduleRound } from '../../../domain/contracts/events'
import type { ScheduleRecord } from '../../../domain/events/schedules'
import { roundScheduleResponse, scheduleResponse } from './schedulesRepo'
import {
  SECTION_NAME_MAX,
  asSectionInput,
  sectionHasEntriesMessage,
  sectionHasGamesMessage,
  sectionFeeOverrides,
  sectionListProblem,
  tierFees,
  toLegacySection,
  type LegacySection,
  type SectionInput,
  type SectionListItem,
  type SectionRecord,
  type TierTournament,
} from '../../../domain/events/sections'
import type { SectionWithRules } from '../../../domain/events/sectionRules'

export type SectionQuery = BatchItem<'sqlite'>

/**
 * What a failing guard raises. json_extract with a malformed path is an
 * error SQLite raises only for a row the guard's WHERE keeps, and its text
 * carries the path, so the error can be told apart from any other.
 */
const GUARD_PATH = '$sections changed'
const GUARD_ERROR = `bad JSON path: '${GUARD_PATH}`
/** The live-name index (0052) refusing a name: tournament_id and name, nothing else. */
const LIVE_NAME_TAKEN = 'UNIQUE constraint failed: tournament_sections.tournament_id, tournament_sections.name'

/**
 * True when a batch failed because the sections changed after its plan was
 * made: a guard of the plan failed, or another save took a live name first.
 * The handlers answer this with 409 and SECTIONS_CHANGED_MESSAGE.
 */
export function isSectionsConflict(err: unknown): boolean {
  // Drizzle may wrap the D1 error, so its causes are read too.
  for (let e: unknown = err, depth = 0; e != null && depth < 5; depth++) {
    const message = typeof e === 'object' && typeof (e as { message?: unknown }).message === 'string'
      ? (e as { message: string }).message
      : String(e)
    if (message.includes(GUARD_ERROR) || message.includes(LIVE_NAME_TAKEN)) return true
    e = typeof e === 'object' ? (e as { cause?: unknown }).cause : undefined
  }
  return false
}

/** D1 binds at most 100 parameters to one statement. */
export const D1_MAX_BOUND_PARAMETERS = 100

/** Ids per IN (...) list, leaving room for the statement's other parameters. */
const IN_LIST_SIZE = D1_MAX_BOUND_PARAMETERS - 10

function chunks<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** A new section id: 16 hex characters, like the ids the migrations made. */
export function newSectionId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16)
}

/**
 * The name a row holds for the moment between its old name and its new one.
 * No section can be named this: it is longer than any name the writer
 * accepts, and it holds the row's id.
 */
export function temporarySectionName(id: string): string {
  return `renaming ${id} ${'.'.repeat(SECTION_NAME_MAX)}`
}

type SectionRow = typeof tournamentSections.$inferSelect

/**
 * The rows of a tournament as one string: id, name and archived_at of each,
 * by id. The guard works out the same string in SQL from the table as it is
 * when the batch runs, so the two differ exactly when a row was added,
 * renamed, archived or brought back in between.
 */
export function sectionsFingerprint(rows: ReadonlyArray<Pick<SectionRecord, 'id' | 'name' | 'archivedAt'>>): string {
  return [...rows]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((r) => `${r.id}\u001f${r.name}\u001f${r.archivedAt ?? ''}`)
    .join('\u001e')
}

/**
 * A guard: fails the batch it is in when `condition` holds as the batch runs.
 * It is a select builder rather than db.run(sql), because Drizzle's D1 batch
 * cannot bind the parameters of a raw query.
 */
function guard(db: Db, tournamentId: string, condition: SQL): SectionQuery {
  return db.select({ guard: sql`json_extract('{}', ${sql.raw(`'${GUARD_PATH} '`)} || ${tournaments.id})` })
    .from(tournaments)
    .where(and(eq(tournaments.id, tournamentId), condition))
}

const inList = (values: readonly string[]) => sql`(${sql.join(values.map((v) => sql`${v}`), sql`, `)})`

/**
 * The guards of a plan (step 0): the rows are still the ones it was made
 * from, and the sections it archives have gained no entry that is not
 * withdrawn and no game. The lists are cut like the reads.
 */
function planGuards(db: Db, tournamentId: string, existing: readonly SectionRecord[], removed: readonly SectionRecord[]): SectionQuery[] {
  // The subquery's ORDER BY sets the group_concat order; the aggregate's own
  // ORDER BY needs SQLite 3.44, which not every D1 database may have.
  const out = [guard(db, tournamentId, sql`ifnull((
    SELECT group_concat(v, char(30)) FROM (
      SELECT id || char(31) || name || char(31) || ifnull(archived_at, '') AS v
      FROM tournament_sections WHERE tournament_id = ${tournamentId} ORDER BY id
    )), '') <> ${sectionsFingerprint(existing)}`)]
  for (const part of chunks(removed.map((r) => r.id), IN_LIST_SIZE)) {
    out.push(guard(db, tournamentId, sql`EXISTS (SELECT 1 FROM registrations
      WHERE tournament_id = ${tournamentId} AND withdrawn_at IS NULL AND section_id IN ${inList(part)})`))
  }
  for (const part of chunks(removed.map((r) => r.name), IN_LIST_SIZE)) {
    out.push(guard(db, tournamentId, sql`EXISTS (SELECT 1 FROM tournament_games
      WHERE tournament_id = ${tournamentId} AND section IN ${inList(part)})`))
  }
  return out
}

function parseJson(text: string | null): unknown {
  if (text == null) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function toRecord(row: SectionRow): SectionRecord {
  const extra = parseJson(row.extraJson)
  return {
    id: row.id,
    tournamentId: row.tournamentId,
    position: row.position,
    name: row.name,
    feeRegular: row.feeRegular,
    feeEarly: row.feeEarly,
    feeLate: row.feeLate,
    cap: row.cap,
    prizeFund: row.prizeFund,
    ratingMin: row.ratingMin,
    ratingMax: row.ratingMax,
    unratedOk: row.unratedOk == null ? null : row.unratedOk === 1,
    gradeMin: row.gradeMin,
    gradeMax: row.gradeMax,
    rulesSet: row.rulesSet === 1,
    prizes: parseJson(row.prizesJson),
    extra: typeof extra === 'object' && extra !== null && !Array.isArray(extra) ? (extra as Record<string, unknown>) : null,
    archivedAt: row.archivedAt,
  }
}

// Live rows first, by position; then archived ones, latest first.
const sectionOrder = [
  sql`${tournamentSections.archivedAt} IS NOT NULL`,
  desc(tournamentSections.archivedAt),
  asc(tournamentSections.position),
  sql`${tournamentSections}.rowid DESC`,
]

/** A tournament's sections: the live ones in order, and the archived ones after them when asked. */
export async function loadSections(
  db: Db,
  tournamentId: string,
  opts: { includeArchived?: boolean } = {},
): Promise<SectionRecord[]> {
  const rows = await db.select().from(tournamentSections)
    .where(opts.includeArchived
      ? eq(tournamentSections.tournamentId, tournamentId)
      : and(eq(tournamentSections.tournamentId, tournamentId), isNull(tournamentSections.archivedAt)))
    .orderBy(...sectionOrder)
  return rows.map(toRecord)
}

/**
 * The sections of many tournaments at once, by tournament id (an id with
 * no sections maps to []). The ids go in lists short enough for D1's limit
 * on bound parameters.
 */
export async function loadSectionsFor(
  db: Db,
  tournamentIds: readonly string[],
  opts: { includeArchived?: boolean } = {},
): Promise<Map<string, SectionRecord[]>> {
  const ids = [...new Set(tournamentIds)]
  const out = new Map<string, SectionRecord[]>(ids.map((id) => [id, []]))
  for (const part of chunks(ids, IN_LIST_SIZE)) {
    const rows = await db.select().from(tournamentSections)
      .where(opts.includeArchived
        ? inArray(tournamentSections.tournamentId, part)
        : and(inArray(tournamentSections.tournamentId, part), isNull(tournamentSections.archivedAt)))
      .orderBy(...sectionOrder)
    for (const row of rows) out.get(row.tournamentId)?.push(toRecord(row))
  }
  return out
}

/**
 * A section row in the form the entry rules take (eligibilityProblem in
 * domain/events/sectionRules.ts): the same answer the legacy JSON element
 * gave, because a column left null reads as a key left out.
 */
export function sectionWithRules(record: SectionRecord): SectionWithRules {
  return {
    name: record.name,
    ...(record.feeRegular != null ? { entryFee: record.feeRegular } : {}),
    ...(record.prizeFund != null ? { prizeFund: record.prizeFund } : {}),
    ratingMax: record.ratingMax,
    ratingMin: record.ratingMin,
    ...(record.unratedOk != null ? { unratedOk: record.unratedOk } : {}),
    gradeMin: record.gradeMin,
    gradeMax: record.gradeMax,
    rulesSet: record.rulesSet,
  }
}

/** The columns of a row that the legacy JSON element decides. */
export interface LegacyColumns {
  feeRegular: number | null
  prizeFund: string | null
  ratingMin: number | null
  ratingMax: number | null
  unratedOk: number | null
  gradeMin: number | null
  gradeMax: number | null
  rulesSet: number
  prizesJson: string | null
  extraJson: string | null
}

const isNumber = (v: unknown): v is number => typeof v === 'number'
const numberOrNull = (v: unknown) => v === null || isNumber(v)
const textOrNull = (v: unknown) => v === null || typeof v === 'string'
const flagOrNull = (v: unknown) => v === null || typeof v === 'boolean'
const objectOrNull = (v: unknown) => v === null || typeof v === 'object'

/** Known keys, and the JSON types their columns take (null included, which clears the column). */
const KNOWN_KEYS: Record<string, (v: unknown) => boolean> = {
  entryFee: numberOrNull,
  prizeFund: textOrNull,
  ratingMin: numberOrNull,
  ratingMax: numberOrNull,
  unratedOk: flagOrNull,
  gradeMin: numberOrNull,
  gradeMax: numberOrNull,
  rulesSet: flagOrNull,
  prizes: objectOrNull,
}

/**
 * The row columns for one legacy element, worked out exactly as the 0053
 * sync trigger works them out from the JSON (its step 4), so the trigger
 * finds nothing to change: a known key goes to its column only when its
 * type is the expected one, and every other key, or a known key of another
 * type, stays in extra_json.
 */
export function columnsFromLegacy(section: LegacySection): LegacyColumns {
  // What the JSON column will hold for this element.
  const element = JSON.parse(JSON.stringify(section)) as Record<string, unknown>
  const extra: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(element)) {
    if (key === 'name') continue
    const takes = KNOWN_KEYS[key]
    if (takes && takes(value)) continue
    extra[key] = value
  }
  const num = (v: unknown) => (isNumber(v) ? v : null)
  return {
    feeRegular: num(element.entryFee),
    prizeFund: typeof element.prizeFund === 'string' ? element.prizeFund : null,
    ratingMin: num(element.ratingMin),
    ratingMax: num(element.ratingMax),
    unratedOk: element.unratedOk === true ? 1 : element.unratedOk === false ? 0 : null,
    gradeMin: num(element.gradeMin),
    gradeMax: num(element.gradeMax),
    rulesSet: element.rulesSet === true ? 1 : 0,
    prizesJson: typeof element.prizes === 'object' && element.prizes !== null ? JSON.stringify(element.prizes) : null,
    extraJson: Object.keys(extra).length > 0 ? JSON.stringify(extra) : null,
  }
}

/** report_settings is cut to this many characters when the admin saves it. */
const REPORT_SETTINGS_MAX = 8000

/**
 * report_settings with its per-section keys (report_settings.sections, keyed
 * by section name) moved from old names to new ones, all at once so a swap
 * works. A key already holding a new name is replaced by the moved one.
 * Settings that are not a JSON object with a sections object are left as
 * they are, and so are settings the move would push past the 8000-character
 * cap (cutting them would break the JSON).
 */
export function renameReportSettingsKeys(text: string | null, renames: ReadonlyMap<string, string>): string | null {
  if (text == null || renames.size === 0) return text
  const settings = parseJson(text)
  if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) return text
  const sections = (settings as Record<string, unknown>).sections
  if (typeof sections !== 'object' || sections === null || Array.isArray(sections)) return text
  const targets = new Set(renames.values())
  const moved: Record<string, unknown> = {}
  let changed = false
  for (const [key, value] of Object.entries(sections as Record<string, unknown>)) {
    const to = renames.get(key)
    if (to !== undefined) {
      moved[to] = value
      changed = true
    } else if (targets.has(key)) {
      changed = true
    } else if (!(key in moved)) {
      moved[key] = value
    }
  }
  if (!changed) return text
  const next = JSON.stringify({ ...(settings as Record<string, unknown>), sections: moved })
  return next.length > REPORT_SETTINGS_MAX ? text : next
}

export interface SectionRename {
  id: string
  from: string
  to: string
}

export type SaveSectionsPlan =
  | { ok: true; queries: SectionQuery[]; renamed: SectionRename[] }
  | { ok: false; error: string }

export interface SaveSectionsOptions {
  /**
   * The report_settings text the caller stores in the same batch, before
   * these queries. Left out, the stored value is read.
   */
  reportSettings?: string | null
}

/**
 * Plans saving `input` as the tournament's sections and returns the queries
 * for one db.batch (see the order at the top of this file), or the reason
 * the list cannot be saved, in words for the director. An element of the
 * list can be a bare name (SectionListItem), which is the section { name }
 * and stays a bare name in the JSON.
 *
 * A section names its row by id; without an id it matches the live row of
 * its name, else the latest archived row of that name (which comes back,
 * as the 0053 trigger does), else it is new. An id that is not one of this
 * tournament's sections is refused. Leaving cap or a fee out keeps what
 * the row has.
 */
export async function buildSaveSections(
  db: Db,
  tournamentId: string,
  list: readonly SectionListItem[],
  opts: SaveSectionsOptions = {},
): Promise<SaveSectionsPlan> {
  const input: SectionInput[] = list.map(asSectionInput)
  const problem = sectionListProblem(input)
  if (problem) return { ok: false, error: problem }

  const existing = await loadSections(db, tournamentId, { includeArchived: true })
  const byId = new Map(existing.map((r) => [r.id, r]))
  const claimed = new Set<string>()
  const matches: Array<SectionRecord | null> = input.map(() => null)

  input.forEach((section, i) => {
    if (section.id === undefined) return
    const row = byId.get(section.id)
    if (row) {
      matches[i] = row
      claimed.add(row.id)
    }
  })
  if (input.some((s, i) => s.id !== undefined && !matches[i])) {
    return { ok: false, error: 'One of these sections is not part of this event. Reload the page and try again.' }
  }
  input.forEach((section, i) => {
    if (section.id !== undefined) return
    const row = existing.find((r) => r.archivedAt === null && r.name === section.name && !claimed.has(r.id))
      ?? existing.find((r) => r.archivedAt !== null && r.name === section.name && !claimed.has(r.id))
    if (row) {
      matches[i] = row
      claimed.add(row.id)
    }
  })

  // Sections the list leaves out. Decision 7: only an empty one is archived.
  const removed = existing.filter((r) => r.archivedAt === null && !claimed.has(r.id))
  if (removed.length > 0) {
    const entries = new Map<string, number>()
    for (const part of chunks(removed.map((r) => r.id), IN_LIST_SIZE)) {
      const rows = await db.select({ sectionId: registrations.sectionId, n: count() }).from(registrations)
        .where(and(
          eq(registrations.tournamentId, tournamentId),
          isNull(registrations.withdrawnAt),
          inArray(registrations.sectionId, part),
        ))
        .groupBy(registrations.sectionId)
      for (const row of rows) if (row.sectionId) entries.set(row.sectionId, row.n)
    }
    const games = new Set<string>()
    for (const part of chunks(removed.map((r) => r.name), IN_LIST_SIZE)) {
      const rows = await db.selectDistinct({ section: tournamentGames.section }).from(tournamentGames)
        .where(and(eq(tournamentGames.tournamentId, tournamentId), inArray(tournamentGames.section, part)))
      for (const row of rows) games.add(row.section)
    }
    for (const row of removed) {
      const n = entries.get(row.id) ?? 0
      if (n > 0) return { ok: false, error: sectionHasEntriesMessage(row.name, n) }
    }
    for (const row of removed) {
      if (games.has(row.name)) return { ok: false, error: sectionHasGamesMessage(row.name) }
    }
  }

  // 0. The guards, so a plan made from rows that have since changed fails as a whole.
  const queries: SectionQuery[] = planGuards(db, tournamentId, existing, removed)

  // 1. Archive the sections left out.
  for (const part of chunks(removed.map((r) => r.id), IN_LIST_SIZE)) {
    queries.push(db.update(tournamentSections)
      .set({ archivedAt: sql`datetime('now')` })
      .where(inArray(tournamentSections.id, part)))
  }

  // 2. Live rows being renamed step aside under a temporary name.
  const renamed: SectionRename[] = []
  input.forEach((section, i) => {
    const row = matches[i]
    if (!row || row.name === section.name) return
    renamed.push({ id: row.id, from: row.name, to: section.name })
    if (row.archivedAt === null) {
      queries.push(db.update(tournamentSections)
        .set({ name: temporarySectionName(row.id) })
        .where(eq(tournamentSections.id, row.id)))
    }
  })

  // 3. Final names, order and fields; new rows.
  const legacy: Array<LegacySection | string> = []
  input.forEach((section, position) => {
    legacy.push(toLegacySection(list[position]))
    const columns = { position, name: section.name, ...columnsFromLegacy(toLegacySection(section)), archivedAt: null }
    // Prices shown by an answer and sent back as they were set nothing.
    const fees = sectionFeeOverrides(section)
    const row = matches[position]
    if (row) {
      queries.push(db.update(tournamentSections)
        .set({
          ...columns,
          ...(section.cap !== undefined ? { cap: section.cap } : {}),
          ...(fees?.early !== undefined ? { feeEarly: fees.early } : {}),
          ...(fees?.late !== undefined ? { feeLate: fees.late } : {}),
        })
        .where(eq(tournamentSections.id, row.id)))
    } else {
      queries.push(db.insert(tournamentSections).values({
        id: newSectionId(),
        tournamentId,
        ...columns,
        cap: section.cap ?? null,
        feeEarly: fees?.early ?? null,
        feeLate: fees?.late ?? null,
      }))
    }
  })

  // 4. What hangs off a renamed section. Entries follow their section_id.
  //    Games and report settings are keyed by name, so they move only with
  //    a row that was live (and so owned the name), in two steps like the
  //    rows themselves so that a swap does not mix them up.
  const wasLive = new Set(existing.filter((r) => r.archivedAt === null).map((r) => r.id))
  for (const r of renamed) {
    queries.push(db.update(registrations)
      .set({ section: r.to })
      .where(and(eq(registrations.tournamentId, tournamentId), eq(registrations.sectionId, r.id))))
  }
  const liveRenames = renamed.filter((r) => wasLive.has(r.id))
  for (const r of liveRenames) {
    queries.push(db.update(tournamentGames)
      .set({ section: temporarySectionName(r.id) })
      .where(and(eq(tournamentGames.tournamentId, tournamentId), eq(tournamentGames.section, r.from))))
  }
  for (const r of liveRenames) {
    queries.push(db.update(tournamentGames)
      .set({ section: r.to })
      .where(and(eq(tournamentGames.tournamentId, tournamentId), eq(tournamentGames.section, temporarySectionName(r.id)))))
  }

  let reportSettings: string | null | undefined
  if (liveRenames.length > 0) {
    const current = opts.reportSettings !== undefined
      ? opts.reportSettings
      : (await db.select({ reportSettings: tournaments.reportSettings }).from(tournaments)
        .where(eq(tournaments.id, tournamentId)))[0]?.reportSettings ?? null
    const next = renameReportSettingsKeys(current, new Map(liveRenames.map((r) => [r.from, r.to])))
    if (next !== current) reportSettings = next
  }

  // 5. The legacy JSON, last.
  queries.push(db.update(tournaments)
    .set({ sections: JSON.stringify(legacy), ...(reportSettings !== undefined ? { reportSettings } : {}) })
    .where(eq(tournaments.id, tournamentId)))

  return { ok: true, queries, renamed }
}

/** Runs queries as one D1 batch (one transaction). An empty list does nothing. */
export async function runBatch(db: Db, queries: readonly SectionQuery[]): Promise<void> {
  if (queries.length === 0) return
  await db.batch(queries as unknown as [SectionQuery, ...SectionQuery[]])
}

/** Plans and runs a save on its own. Returns the reason when it cannot be saved. */
export async function saveSections(
  db: Db,
  tournamentId: string,
  input: readonly SectionListItem[],
  opts: SaveSectionsOptions = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  const plan = await buildSaveSections(db, tournamentId, input, opts)
  if (!plan.ok) return plan
  await runBatch(db, plan.queries)
  return { ok: true }
}

/**
 * The keys of a section answer (savedSectionSchema). A key of the same name
 * in a row's extra_json is never echoed: the answer's own value wins.
 */
const SAVED_SECTION_KEYS = new Set([
  'id', 'name', 'entryFee', 'prizeFund', 'ratingMax', 'ratingMin', 'unratedOk',
  'gradeMin', 'gradeMax', 'rulesSet', 'prizes', 'cap', 'fees',
])

/**
 * The keys the JSON element had that no column holds (extra_json), less any
 * that clash with a key of the answer, such as a known key stored with an
 * unexpected type.
 */
function extraKeys(extra: Record<string, unknown> | null): Record<string, unknown> {
  if (!extra) return {}
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(extra)) {
    if (!SAVED_SECTION_KEYS.has(key)) out[key] = value
  }
  return out
}

/**
 * A section as every endpoint that returns a tournament answers it
 * (savedSectionSchema), priced from the tournament's own columns. The
 * fields the JSON element had keep their names and types: prizeFund,
 * unratedOk and prizes are left out when the row has none, as the element
 * left them out. Keys the element had that no column holds (extra_json)
 * come back too, because the manage page sends its sections back as it
 * loaded them and the writer keeps only the keys it is sent. The id, the
 * cap and the three prices are added.
 */
export function sectionResponse(record: SectionRecord, tournament: TierTournament): SavedSection {
  const fees = tierFees(record, tournament)
  return {
    ...extraKeys(record.extra),
    id: record.id,
    name: record.name,
    entryFee: fees.regular,
    ...(record.prizeFund != null ? { prizeFund: record.prizeFund } : {}),
    ratingMax: record.ratingMax,
    ratingMin: record.ratingMin,
    ...(record.unratedOk != null ? { unratedOk: record.unratedOk } : {}),
    gradeMin: record.gradeMin,
    gradeMax: record.gradeMax,
    rulesSet: record.rulesSet,
    ...(record.prizes != null ? { prizes: record.prizes as SavedSection['prizes'] } : {}),
    cap: record.cap,
    fees,
  }
}

/** A tournaments row as an endpoint answers it: see toTournamentResponse. */
export type TournamentResponse<Row extends TournamentRow = TournamentRow> =
  Omit<Row, 'sections' | 'round_schedule'> & {
    sections: SavedSection[]
    round_schedule: ScheduleRound[]
    schedules: Schedule[]
  }

/**
 * A tournaments row (SELECT *, with or without joined columns) as an
 * endpoint answers it: the JSON text of sections and round_schedule is
 * dropped, `sections` are the rows given (live ones, as loadSections reads
 * them, unless the caller wants history), priced from the row,
 * round_schedule is the primary schedule's rounds in the shape the column
 * held them, and `schedules` are the live schedules given (loadSchedules).
 * member_discount is answered as 0 (retired, see below). Every other column
 * is passed on as it is.
 */
export function toTournamentResponse<Row extends TournamentRow>(
  row: Row,
  sections: readonly SectionRecord[],
  schedules: readonly ScheduleRecord[],
): TournamentResponse<Row> {
  // Both JSON columns are replaced, so neither text leaves the server.
  const live = schedules.filter((s) => s.archivedAt === null)
  const answer = {
    ...row,
    // member_discount is retired: there is no member price and checkout
    // never applies it, but the column still holds old amounts. Answer 0 so
    // a page still running the earlier site code (which subtracted it) shows
    // the price Stripe will charge. The stored value is left alone.
    member_discount: 0,
    sections: sections.map((s) => sectionResponse(s, row)),
    round_schedule: roundScheduleResponse(live),
    schedules: live.map(scheduleResponse),
  }
  return answer as unknown as TournamentResponse<Row>
}

/**
 * The live sections of many tournaments, each priced from its own
 * tournament, by tournament id (an id with no sections maps to []). For a
 * reader whose query does not select the pricing columns: one query per
 * list of ids, joined to tournaments, cut like loadSectionsFor.
 */
export async function sectionResponsesFor(db: Db, tournamentIds: readonly string[]): Promise<Map<string, SavedSection[]>> {
  const ids = [...new Set(tournamentIds)]
  const out = new Map<string, SavedSection[]>(ids.map((id) => [id, []]))
  for (const part of chunks(ids, IN_LIST_SIZE)) {
    const rows = await db
      .select({
        section: tournamentSections,
        tier: {
          entry_fee: tournaments.entryFee,
          early_deadline: tournaments.earlyDeadline,
          early_discount: tournaments.earlyDiscount,
          late_after: tournaments.lateAfter,
          late_fee: tournaments.lateFee,
        },
      })
      .from(tournamentSections)
      .innerJoin(tournaments, eq(tournaments.id, tournamentSections.tournamentId))
      .where(and(inArray(tournamentSections.tournamentId, part), isNull(tournamentSections.archivedAt)))
      .orderBy(...sectionOrder)
    for (const row of rows) out.get(row.section.tournamentId)?.push(sectionResponse(toRecord(row.section), row.tier))
  }
  return out
}
