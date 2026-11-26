// src/areas/clubs/directoryWords.ts
//
// The Clubs directory's own words (WS09 step 33), written once, so the page
// and its tests read one wording. Every count is counted from the clubs
// given, never typed in: the regions are those of REGIONS (five, by K's
// decision 14) that have a club in the answer.
import { regionChoices } from '@domain/clubs/order'

/** The page's one heading. */
export const DIRECTORY_TITLE = 'Chess clubs in Louisiana'

/** "1 club" or "{N} clubs". */
const clubsWord = (count: number) => (count === 1 ? '1 club' : `${count} clubs`)

/** How many of the regions have a club among the clubs given. */
export function regionsWithClubs(clubs: ReadonlyArray<{ region: string | null }>): number {
  return regionChoices(clubs).filter((choice) => choice.count > 0).length
}

/** The line under the heading: "25 clubs · 5 regions · Find the nearest, or look around the whole state." */
export function stripLine(clubs: number, regions: number): string {
  return `${clubsWord(clubs)} · ${regions === 1 ? '1 region' : `${regions} regions`} · Find the nearest, or look around the whole state.`
}

/** The second sentence of the caption over the list, which a visitor needs before a first visit. */
export const CONFIRM_FIRST = 'Meeting times are as each club states them; confirm before a first visit.'

/** The caption over the whole list: "All 25 clubs, A to Z. Meeting times are as each club states them; confirm before a first visit." */
export function listCaption(clubs: number): string {
  return `${clubs === 1 ? 'The 1 club' : `All ${clubs} clubs`}, A to Z. ${CONFIRM_FIRST}`
}

/** A card's words for a club that states no meeting time. The words are plain: the form opens from the club's page. */
export const THIN_CARD = 'Schedule not listed · Know when they meet? Suggest an update'

/** The one line where there is no map, and the list stands alone. */
export const NO_MAP = 'The map is not shown here. Every club is in the list.'

/** The map's one caption line: what its marks mean, in words. */
export const MAP_KEY = 'Solid pin: meeting times listed · Hollow pin: not listed yet · Circle: clubs in one town'

/** The button that brings the map back to the whole state. */
export const WHOLE_STATE = 'All of Louisiana'

/** The map's name, for a screen reader. */
export const MAP_NAME = 'Map of the clubs'

/** The link before the list that goes straight to the map. */
export const SKIP_TO_MAP = 'Skip to the map'

/** The one sentence when the answer holds no club. */
export const NO_CLUBS = 'No clubs are listed yet.'

/** While the list loads. */
export const LOADING = 'Loading the clubs...'

/** When the list is slow to come. */
export const SLOW = 'The list of clubs is taking longer than usual.'

/** When the list could not be loaded. */
export const FAILED = 'The list of clubs could not be loaded.'

/** The button that asks for the list again. */
export const TRY_AGAIN = 'Try again'

/** How long the list may take before the page says it is slow, in milliseconds. */
export const SLOW_AFTER_MS = 8000
