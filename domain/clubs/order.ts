// domain/clubs/order.ts
//
// How the Clubs page orders and narrows its list (WS09 step 32), and the
// words it writes for it, so the page and its tests read one wording:
//   - A to Z by the club's name, as GET /api/clubs orders it: SQLite's
//     ORDER BY name with its BINARY collation, which compares the name's
//     bytes in UTF-8, so a capital comes before a small letter, and an
//     accented letter after every letter without a mark. Comparing the
//     names character by character by their code points gives the same
//     order. Two clubs of one name go by id.
//   - Nearest first from a point, by straight-line miles
//     (domain/clubs/distance.ts, K's choice 5), each with "about N mi"; a
//     club with no point comes last, A to Z, with no distance; and one thin
//     divider, "Farther than 75 miles", before the first club farther than
//     that, drawn only when some clubs are within it and some are not.
//   - Neither order ever removes a club.
//   - A typed name narrows the list to the clubs whose names it matches, as
//     the site's search matches words (domain/format/searchText.ts), with
//     the caption "1 club matches kni · Show all 25".
//   - The filters (region, plays on weekends, scholastic friendly) narrow the
//     list and the pins together, with "5 clubs match · Clear filters", or
//     "No clubs match these filters. Clear filters." when none is left.
// Every count in a caption is counted from the clubs given, never typed.
//
// Pure code with no zod, no clock and no random source: the same clubs and
// the same choices always give the same list.
import { milesBetween, milesInWords, type MapPoint } from './distance'
import { REGIONS, type Region } from './regions'
import { matchesSearch, normalizeSearchText } from '../format/searchText'

/** What the orders read of a club. */
export interface OrderedClub {
  id: string
  name: string
}

/** What the nearest order reads of a club, beside its name: its point, or null when it has none. */
export interface PlacedClub extends OrderedClub {
  point: MapPoint | null
}

/** What the filters read of a club. */
export interface FilteredClub {
  region: string | null
  weekend_play: boolean
  scholastic_friendly: boolean
}

/** The miles past which a club sits under the divider. */
export const DIVIDER_MILES = 75

/** The divider's words. */
export const DIVIDER_WORDS = `Farther than ${DIVIDER_MILES} miles`

/** The link that brings back every club after a name narrowed the list. */
export const SHOW_ALL = 'Show all'

/** The link that clears the filters. */
export const CLEAR_FILTERS = 'Clear filters'

/** The caption when the filters leave no club. */
export const NO_FILTER_MATCH = `No clubs match these filters. ${CLEAR_FILTERS}.`

/** Two texts compared by their code points, as SQLite's BINARY collation compares their UTF-8 bytes. */
export function byCodePoints(a: string, b: string): number {
  const x = Array.from(a)
  const y = Array.from(b)
  const length = Math.min(x.length, y.length)
  for (let i = 0; i < length; i++) {
    const d = (x[i].codePointAt(0) ?? 0) - (y[i].codePointAt(0) ?? 0)
    if (d !== 0) return d < 0 ? -1 : 1
  }
  return x.length === y.length ? 0 : x.length < y.length ? -1 : 1
}

/** Two clubs A to Z by name, then by id. */
export function byName(a: OrderedClub, b: OrderedClub): number {
  return byCodePoints(a.name, b.name) || byCodePoints(a.id, b.id)
}

/** Every club, A to Z by name. */
export function aToZ<T extends OrderedClub>(clubs: readonly T[]): T[] {
  return [...clubs].sort(byName)
}

/** A club in the nearest order: its miles and their words, both null for a club with no point. */
export interface NearRow<T> {
  club: T
  miles: number | null
  distance: string | null
}

/** The nearest order: every club, and the index of the row the divider goes before, or null for none. */
export interface NearestOrder<T> {
  rows: Array<NearRow<T>>
  dividerBefore: number | null
}

/** Whether a distance is past the divider, as its words read: "about 76 mi" is, "about 75 mi" is not. */
export function pastDivider(miles: number): boolean {
  return Math.round(miles) > DIVIDER_MILES
}

/**
 * Every club, nearest first from a point: by miles, then A to Z, then by
 * id, with the clubs that have no point after them, A to Z. The divider goes
 * before the first club past DIVIDER_MILES, and only when some club with a
 * point is within it and some is past it.
 */
export function nearestFirst<T extends PlacedClub>(clubs: readonly T[], from: MapPoint): NearestOrder<T> {
  const placed: Array<NearRow<T> & { miles: number }> = []
  const unplaced: T[] = []
  for (const club of clubs) {
    if (club.point) {
      const miles = milesBetween(from, club.point)
      placed.push({ club, miles, distance: milesInWords(miles) })
    } else unplaced.push(club)
  }
  placed.sort((a, b) => a.miles - b.miles || byName(a.club, b.club))
  const rows: Array<NearRow<T>> = [...placed, ...aToZ(unplaced).map((club) => ({ club, miles: null, distance: null }))]
  const first = placed.findIndex((row) => pastDivider(row.miles))
  return { rows, dividerBefore: first > 0 ? first : null }
}

/** Clubs whose names a typed name matches, in the order given; every club when the text has no word in it. */
export function matchingName<T extends OrderedClub>(clubs: readonly T[], text: string): T[] {
  const query = normalizeSearchText(text)
  if (query === '') return [...clubs]
  return clubs.filter((club) => matchesSearch(normalizeSearchText(club.name), query))
}

/** "1 club matches" or "{N} clubs match". */
function matchWords(count: number): string {
  return count === 1 ? '1 club matches' : `${count} clubs match`
}

/** The caption over a list a name narrowed: "1 club matches kni · Show all 25", the text as typed, trimmed. */
export function nameCaption(matches: number, text: string, total: number): string {
  return `${matchWords(matches)} ${text.trim()} · ${SHOW_ALL} ${total}`
}

/** The filters the page offers: one region or none, and the two ticks. */
export interface DirectoryFilters {
  region: Region | null
  weekends: boolean
  scholastic: boolean
}

/** No filter at all. */
export const NO_FILTERS: DirectoryFilters = { region: null, weekends: false, scholastic: false }

/** Whether any filter is chosen. */
export function anyFilter(filters: DirectoryFilters): boolean {
  return filters.region !== null || filters.weekends || filters.scholastic
}

/** Whether a club passes every chosen filter. The two ticks pass only a club that says so itself. */
export function passesFilters(club: FilteredClub, filters: DirectoryFilters): boolean {
  if (filters.region !== null && club.region !== filters.region) return false
  if (filters.weekends && !club.weekend_play) return false
  if (filters.scholastic && !club.scholastic_friendly) return false
  return true
}

/** The caption over a list the filters narrowed: "5 clubs match · Clear filters", or the words for none. */
export function filterCaption(matches: number): string {
  return matches === 0 ? NO_FILTER_MATCH : `${matchWords(matches)} · ${CLEAR_FILTERS}`
}

/** The Region filter's choices: each of REGIONS, in its order, with the count of clubs given that are in it. */
export function regionChoices(clubs: ReadonlyArray<Pick<FilteredClub, 'region'>>): Array<{ region: Region; count: number }> {
  return REGIONS.map((region) => ({ region, count: clubs.filter((club) => club.region === region).length }))
}

/** What the page has chosen: a point to order from or none, a typed name or none, and the filters. */
export interface DirectoryChoices {
  from: MapPoint | null
  name: string
  filters: DirectoryFilters
}

/** The list the page draws, the pins the map draws and the caption over them. */
export interface DirectoryView<T> {
  rows: Array<NearRow<T>>
  dividerBefore: number | null
  /** The clubs the map pins, in the list's order: those of the list that have a point. */
  pins: T[]
  /** The caption for a narrowed list, or null when the list holds every club. */
  caption: string | null
}

/**
 * The list for the page's choices: the filters narrow it, then a typed name,
 * and then it is ordered, nearest first from a point or else A to Z. The
 * pins are the list's own clubs, so a filter acts on both together. "Show
 * all" brings back the clubs the filters leave, so its count is theirs.
 */
export function directoryView<T extends PlacedClub & FilteredClub>(clubs: readonly T[], choices: DirectoryChoices): DirectoryView<T> {
  const filtered = clubs.filter((club) => passesFilters(club, choices.filters))
  const named = matchingName(filtered, choices.name)
  const ordered = choices.from
    ? nearestFirst(named, choices.from)
    : { rows: aToZ(named).map((club) => ({ club, miles: null, distance: null })), dividerBefore: null }
  const pins = ordered.rows.filter((row) => row.club.point !== null).map((row) => row.club)
  const narrowedByName = normalizeSearchText(choices.name) !== ''
  let caption: string | null = null
  if (anyFilter(choices.filters) && filtered.length === 0) caption = NO_FILTER_MATCH
  else if (narrowedByName) caption = nameCaption(named.length, choices.name, filtered.length)
  else if (anyFilter(choices.filters)) caption = filterCaption(filtered.length)
  return { rows: ordered.rows, dividerBefore: ordered.dividerBefore, pins, caption }
}
