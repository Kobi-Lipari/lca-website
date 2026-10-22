// domain/events/sections.ts
// What a tournament's section is, in the two forms it is kept in, and the
// rules every writer and reader of sections shares. The server's one writer
// is functions/utils/events/sectionsRepo.ts; the request and response
// contracts are in domain/contracts/events.ts. This file imports no zod, so
// the site can use it at runtime.
//
// The two forms:
// - a row of tournament_sections (SectionRecord), with an id that survives a
//   rename, an optional cap and optional early and late prices
// - an element of the legacy tournaments.sections JSON (LegacySection), which
//   every reader still parses: the keys the admin sent, never an id, a cap or
//   a fees object

/**
 * One element of tournaments.sections, as an object.
 *
 * The setup form writes each known key with the type noted beside it. Events
 * saved earlier can hold a known key with a value of another type, and the
 * setup sends the stored list back as it found it, so the values are typed
 * unknown: columnsFromLegacy in sectionsRepo, like the 0053 sync trigger,
 * gives a key to its column only when its type is the column's and keeps it
 * in extra_json otherwise.
 */
export interface LegacySection {
  name: string
  /** A number: the regular price. Absent means the tournament's entry_fee. */
  entryFee?: unknown
  /** Text. */
  prizeFund?: unknown
  /** Numbers. */
  ratingMax?: unknown
  ratingMin?: unknown
  /** true or false. */
  unratedOk?: unknown
  /** Numbers. */
  gradeMin?: unknown
  gradeMax?: unknown
  /** true or false. */
  rulesSet?: unknown
  /** The prize list, an object. */
  prizes?: unknown
  /** Old rows can carry other keys; they are kept as they are. */
  [key: string]: unknown
}

/**
 * Prices a director sets for one tier only. null means worked out from the
 * tournament. `regular` marks the prices an answer showed (the regular
 * price is entryFee): fees that carry it were sent back as they were shown,
 * so they set nothing (sectionFeeOverrides).
 */
export interface SectionFeeOverrides {
  regular?: number
  early?: number | null
  late?: number | null
}

/**
 * The tier prices a section in a request sets: its fees, unless they carry
 * `regular`. Every answer gives a section its worked-out prices with
 * `regular` (savedSectionSchema), and the manage page and the setup wizard
 * send a section back as they got it; taking those as the section's own
 * prices would fix them where they stand, so they are ignored.
 */
export function sectionFeeOverrides(section: SectionInput): SectionFeeOverrides | undefined {
  return section.fees && section.fees.regular === undefined ? section.fees : undefined
}

/**
 * A section as the setup sends it to the writer. An id names the row being
 * edited; without one the section is matched by its name. cap and fees go
 * to the table only, never into the JSON. Leaving cap or a fee out keeps
 * what the row has; null clears it.
 */
export interface SectionInput extends LegacySection {
  id?: string
  cap?: number | null
  fees?: SectionFeeOverrides
}

/**
 * One element of the sections list a create or edit request sends: a
 * section, or a bare name. Very old events stored a section as its name, and
 * the setup sends the stored list back with the sections it adds, so a list
 * can mix the two. A name is the section { name } and stays a bare name in
 * the JSON.
 */
export type SectionListItem = string | SectionInput

/** The section a list element stands for. */
export function asSectionInput(item: SectionListItem): SectionInput {
  return typeof item === 'string' ? { name: item } : item
}

/** A row of tournament_sections, read back. */
export interface SectionRecord {
  id: string
  tournamentId: string
  position: number
  name: string
  /** null means the tournament's entry_fee. */
  feeRegular: number | null
  /** null means worked out from early_deadline and early_discount. */
  feeEarly: number | null
  /** null means worked out from late_after and late_fee. */
  feeLate: number | null
  cap: number | null
  prizeFund: string | null
  ratingMin: number | null
  ratingMax: number | null
  /** null when the setup never said, so the name decides. */
  unratedOk: boolean | null
  gradeMin: number | null
  gradeMax: number | null
  rulesSet: boolean
  prizes: unknown
  /** Keys of the legacy element that have no column of their own. */
  extra: Record<string, unknown> | null
  archivedAt: string | null
}

/** Section names are 1 to 80 characters. */
export const SECTION_NAME_MAX = 80

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * The sections of a legacy tournaments.sections value, as objects.
 *
 * Takes the column's text or an already parsed value. Text that is not JSON,
 * and JSON that is not an array, give no sections. A plain string element is
 * a section name ({ name }). An element without a text name, or with an
 * empty one, is skipped. When a name is given twice the first wins. Names
 * are kept exactly as stored, without trimming. This is how the 0053 sync
 * trigger reads the column, so both give the same list.
 */
export function normalizeLegacySections(value: unknown): LegacySection[] {
  let parsed: unknown = value
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value)
    } catch {
      return []
    }
  }
  if (!Array.isArray(parsed)) return []
  const seen = new Set<string>()
  const out: LegacySection[] = []
  for (const element of parsed) {
    let section: LegacySection | null = null
    if (typeof element === 'string') {
      section = { name: element }
    } else if (isPlainObject(element) && typeof element.name === 'string') {
      section = { ...element, name: element.name }
    }
    if (!section || section.name === '' || seen.has(section.name)) continue
    seen.add(section.name)
    out.push(section)
  }
  return out
}

/**
 * The legacy element for a section the admin sent: the same keys (known
 * keys first, then the rest), without id, cap or fees, and without keys
 * whose value is undefined (JSON has no undefined, so they were never
 * sent). A bare name stays a bare name.
 */
export function toLegacySection(section: SectionInput): LegacySection
export function toLegacySection(section: SectionListItem): LegacySection | string
export function toLegacySection(section: SectionListItem): LegacySection | string {
  if (typeof section === 'string') return section
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(section)) {
    if (key === 'id' || key === 'cap' || key === 'fees' || value === undefined) continue
    out[key] = value
  }
  return out as LegacySection
}

/** The first name that appears twice, or null. Names match exactly, as the database matches them. */
export function repeatedSectionName(names: readonly string[]): string | null {
  const seen = new Set<string>()
  for (const name of names) {
    if (seen.has(name)) return name
    seen.add(name)
  }
  return null
}

/**
 * What is wrong with a list of sections the setup sent, in words for the
 * director, or null when it can be saved. Checks only what the list says
 * about itself: every live name differs and no row is listed twice. Whether
 * an id belongs to the event, and whether a section left out still has
 * entries, needs the database and is checked by the writer.
 */
export function sectionListProblem(sections: readonly SectionInput[]): string | null {
  for (const s of sections) {
    if (typeof s.name !== 'string' || s.name.trim() === '') return 'Every section needs a name.'
    if (s.name.length > SECTION_NAME_MAX) return `Section names can be at most ${SECTION_NAME_MAX} characters.`
  }
  const repeated = repeatedSectionName(sections.map((s) => s.name))
  if (repeated !== null) return `Two sections are named “${repeated}”. Give each section its own name.`
  const ids = sections.map((s) => s.id).filter((id): id is string => typeof id === 'string')
  if (repeatedSectionName(ids) !== null) return 'The same section is listed twice.'
  return null
}

/** The refusal when a section the setup left out still has entries (decision 7). */
export function sectionHasEntriesMessage(sectionName: string, entries: number): string {
  return entries === 1
    ? `1 entry is in the ${sectionName} section. Move it to another section first.`
    : `${entries} entries are in the ${sectionName} section. Move them to another section first.`
}

/** The refusal when a section the setup left out has games. */
export function sectionHasGamesMessage(sectionName: string): string {
  return `Games have been paired in the ${sectionName} section, so it cannot be removed.`
}

/**
 * The refusal when the sections changed between reading them and saving
 * (another save, or a section being removed gained an entry or a game).
 */
export const SECTIONS_CHANGED_MESSAGE = 'These sections changed while you were saving. Reload the page and try again.'

/** The tournament columns tier prices are worked out from. */
export interface TierTournament {
  entry_fee: number
  early_deadline?: string | null
  early_discount?: number | null
  late_after?: string | null
  late_fee?: number | null
}

/** A section's own prices, as stored (null means not set). */
export interface TierSection {
  feeRegular?: number | null
  feeEarly?: number | null
  feeLate?: number | null
}

export interface TierFees {
  regular: number
  /** null when the event has no early price. */
  early: number | null
  /** null when the event has no late price. */
  late: number | null
}

const cents = (n: number) => Math.round(n * 100) / 100

/**
 * The regular, early and late price of a section.
 *
 * Regular is the section's fee_regular, else the tournament's entry_fee. A
 * price the section sets for a tier is used as it is. Otherwise the tier is
 * worked out from the tournament's own columns, as checkout does
 * (domain/registration/pricing.ts): early is regular less early_discount
 * when an early_deadline is set, late is regular plus late_fee when a
 * late_after is set, never below zero, and a free section has neither.
 * Which tier applies today is the caller's question (the deadlines are
 * Central wall-clock times; see hasPassed in domain/format/centralTime.ts).
 */
export function tierFees(section: TierSection, tournament: TierTournament): TierFees {
  const regular = section.feeRegular ?? tournament.entry_fee
  const discount = tournament.early_discount ?? 0
  const lateFee = tournament.late_fee ?? 0
  const derivedEarly = regular > 0 && tournament.early_deadline && discount > 0 ? Math.max(0, cents(regular - discount)) : null
  const derivedLate = regular > 0 && tournament.late_after && lateFee > 0 ? cents(regular + lateFee) : null
  return {
    regular,
    early: section.feeEarly ?? derivedEarly,
    late: section.feeLate ?? derivedLate,
  }
}
