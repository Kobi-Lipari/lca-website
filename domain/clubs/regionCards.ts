// domain/clubs/regionCards.ts
//
// My region's cards: whether a club needs a check, the words of its last
// check, the This month counts, and the order the cards are drawn in.
//
// A club's last check is its last_confirmed_at, which a keeper's save and
// Still accurate both set, stored in UTC by datetime('now'). A club with
// none has never been checked: migration 0067 stamps told_updated_at on
// every club and never writes last_confirmed_at, so that stamp alone, with
// no saver and no check, is not a check.
//
// Pure code: the time is an argument, and nothing here makes a query.

import { checkMonthWords } from './monthlyCheck'

/** A check counts for this many days. */
export const CHECK_WINDOW_DAYS = 90

const DAY_MS = 24 * 60 * 60 * 1000

/** A UTC stamp from datetime('now') ("2026-11-14 19:00:00") as epoch milliseconds, or null. */
export function storedUtcMs(stamp: string | null | undefined): number | null {
  if (!stamp) return null
  const ms = Date.parse(`${stamp.trim().replace(' ', 'T')}Z`)
  return Number.isFinite(ms) ? ms : null
}

/**
 * Whole days from a stored UTC stamp to now, by the rule above, never below 0,
 * and 0 for a stamp that cannot be read: the age of a visitor's suggestion
 * (WS09 step 28), which the server reads and the pages are handed. It lives
 * here and not beside the suggestion's words (../clubs/suggestion.ts) so that
 * the pages that draw those words do not take this file in with them.
 */
export function wholeDaysSince(stamp: string | null | undefined, nowMs: number): number {
  const at = storedUtcMs(stamp)
  if (at === null) return 0
  return Math.max(0, Math.floor((nowMs - at) / DAY_MS))
}

/**
 * True when the club has never been checked, or its last check is more than
 * 90 days before `now`. A check exactly 90 days old still counts.
 */
export function needsCheck(lastConfirmedAt: string | null | undefined, now: Date | number): boolean {
  const at = storedUtcMs(lastConfirmedAt)
  if (at === null) return true
  const nowMs = now instanceof Date ? now.getTime() : now
  return nowMs - at > CHECK_WINDOW_DAYS * DAY_MS
}

/**
 * The card's stamp row in words: "Checked Sep 2026" inside the 90 days,
 * "Not checked since Jun 2026" after them, and "Not checked yet" for a club
 * never checked. The month is read in Central time (checkMonthWords).
 */
export function checkWords(lastConfirmedAt: string | null | undefined, now: Date | number): string {
  if (storedUtcMs(lastConfirmedAt) === null) return 'Not checked yet'
  const month = checkMonthWords(lastConfirmedAt)
  return needsCheck(lastConfirmedAt, now) ? `Not checked since ${month}` : `Checked ${month}`
}

/** What the order reads of a card. */
export interface SortableCard {
  id: string
  name: string
  needsCheck: boolean
  openItems: readonly unknown[]
}

/** A name with its accents taken off and its letters in lower case, for the A to Z. */
function plainName(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Plain code unit order, the same in every browser and runtime. */
function byCodeUnits(a: string, b: string): number {
  if (a === b) return 0
  return a < b ? -1 : 1
}

/**
 * The cards in My region's order: those that need a check first, then
 * those with open items, then A to Z by name. Names that differ only in
 * case or accents keep a stable order: by the name as written, then by the
 * club's id. A new list is returned; the one given is not changed.
 */
export function sortRegionCards<T extends SortableCard>(cards: readonly T[]): T[] {
  return [...cards].sort((a, b) =>
    Number(b.needsCheck) - Number(a.needsCheck)
    || Number(b.openItems.length > 0) - Number(a.openItems.length > 0)
    || byCodeUnits(plainName(a.name), plainName(b.name))
    || byCodeUnits(a.name, b.name)
    || byCodeUnits(a.id, b.id))
}

/** This month's counts: how many of the cards were checked in the last 90 days, and how many not. */
export function checkCounts(cards: ReadonlyArray<{ needsCheck: boolean }>): { checked: number; notChecked: number } {
  const notChecked = cards.filter((c) => c.needsCheck).length
  return { checked: cards.length - notChecked, notChecked }
}
