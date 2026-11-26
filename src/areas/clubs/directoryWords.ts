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

// The place, Near me, the two orders and the filters (WS09 step 34).

/** The one field's label. */
export const FIELD_LABEL = 'City, ZIP or club name'

/** What the field's small question mark says: how the field is used, and what becomes of a place. */
export const FIELD_HELP = 'Type a city or ZIP to list the nearest clubs first, or part of a club\'s name to find it. Near me finds the nearest ZIP on this device: your device\'s exact position never leaves it, and only that ZIP is kept in the page\'s address.'

/** The button that asks the device where it is, once, on its press. */
export const NEAR_ME = 'Near me'

/** While the device is asked. */
export const FINDING = 'Finding the nearest ZIP...'

/** The pill once a place is known: "Near you: Baton Rouge 70808". */
export function nearYou(town: string, zip: string): string {
  return `Near you: ${town} ${zip}`
}

/** The pill's button, which goes back to A to Z and the whole state. */
export const CLEAR_PLACE = 'Clear location'

/** When the device would not say, or could not. */
export const NOT_FOUND = 'We couldn\'t get your location. Type a city or ZIP.'

/** When the browser has no way to ask the device. */
export const NO_SUPPORT = 'This browser can\'t share a location. Type a city or ZIP.'

/** When the device has not answered in time. */
export const TOO_LONG = 'Finding your location took too long. Type a city or ZIP.'

/** How long the page waits for the device, in milliseconds, before it says so. */
export const DEVICE_WAIT_MS = 10000

/** A place typed or found outside Louisiana. */
export const OUTSIDE = 'That\'s outside Louisiana. Type a Louisiana city or ZIP.'

/** A typed town with no club of its own: "No club in Natchitoches yet. The nearest are listed first." */
export function noClubIn(town: string): string {
  return `No club in ${town} yet. The nearest are listed first.`
}

/** The link after it, to the form that starts a club. */
export const START_A_CLUB = 'Start a club?'

/** The two orders' group, and each order's button. */
export const ORDER_LABEL = 'Order'
export const A_TO_Z = 'A to Z'
export const NEAREST = 'Nearest'

/** Beside Nearest while no place is known: why it cannot be chosen yet. */
export const NEAREST_WHY = 'Press Near me, or type a place'

/** The thin divider before the clubs with no point, after the last club with a distance. */
export const NO_DISTANCE = 'Distance not known'

/** The list's name in each order. */
export const LIST_A_TO_Z = 'Clubs, A to Z'
export const LIST_NEAREST = 'Clubs, nearest first'

/** The caption over the whole list, nearest first: "All 25 clubs, nearest first. Meeting times are as each club states them; confirm before a first visit." */
export function nearestCaption(clubs: number): string {
  return `${clubs === 1 ? 'The 1 club' : `All ${clubs} clubs`}, nearest first. ${CONFIRM_FIRST}`
}

/** The Filters button, with how many filters are on: "Filters" or "Filters · 2 on". */
export function filtersButton(on: number): string {
  return on === 0 ? 'Filters' : `Filters · ${on} on`
}

/** The panel's parts. */
export const REGION = 'Region'
export const OWN_WORD = 'Only clubs that say so themselves'
export const WEEKENDS = 'Plays on weekends'
export const SCHOLASTIC = 'Scholastic friendly'
export const CLEAR = 'Clear'
export const DONE = 'Done'

/** How long the field waits for the typing to pause before it reads what was typed, in milliseconds. */
export const TYPING_PAUSE_MS = 600

/** A town's name as the points file keeps it ("st francisville") written for the page ("St. Francisville"). */
export function townWords(key: string): string {
  return key
    .split(' ')
    .filter(Boolean)
    .map((word) => (word === 'st' ? 'St.' : word.replace(/(^|[-'])(\p{L})/gu, (_, before: string, letter: string) => before + letter.toUpperCase())))
    .join(' ')
}
