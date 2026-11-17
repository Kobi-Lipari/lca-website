// test/unit/region-card-sort.test.ts
//
// My region's cards (domain/clubs/regionCards.ts): which club needs a
// check, the words of its last check, the This month counts, and the order:
// the cards that need a check first, then those with open items, then A to
// Z, with names that differ only in case or accents kept in a stable order.
// Every club here is made up.
import { describe, expect, it } from 'vitest'
import { CHECK_WINDOW_DAYS, checkCounts, checkWords, needsCheck, sortRegionCards, storedUtcMs } from '../../domain/clubs/regionCards'

const NOW = Date.parse('2026-11-14T19:00:00Z')
const card = (id: string, name: string, needs: boolean, open = 0) => ({ id, name, needsCheck: needs, openItems: Array.from({ length: open }, () => ({})) })
const ids = (cards: Array<{ id: string }>) => cards.map((c) => c.id)

describe('needsCheck and checkWords', () => {
  it('reads a club never checked as needing a check, in words', () => {
    expect(needsCheck(null, NOW)).toBe(true)
    expect(needsCheck(undefined, NOW)).toBe(true)
    expect(needsCheck('', NOW)).toBe(true)
    expect(checkWords(null, NOW)).toBe('Not checked yet')
  })

  it('counts a check for 90 days, the 90th day itself included, and not after', () => {
    expect(CHECK_WINDOW_DAYS).toBe(90)
    // Exactly 90 days before NOW.
    expect(needsCheck('2026-08-16 19:00:00', NOW)).toBe(false)
    expect(needsCheck('2026-08-16 18:59:59', NOW)).toBe(true)
    expect(needsCheck('2026-11-14 18:00:00', NOW)).toBe(false)
  })

  it('writes the month of the last check, "Checked" inside the 90 days and "Not checked since" after them', () => {
    expect(checkWords('2026-09-12 14:00:00', NOW)).toBe('Checked Sep 2026')
    expect(checkWords('2026-06-03 14:00:00', NOW)).toBe('Not checked since Jun 2026')
    // 9:30 PM Central on Wed, Sep 30, 2026, stored as Oct 1 in UTC, is September's.
    expect(checkWords('2026-10-01 02:30:00', NOW)).toBe('Checked Sep 2026')
  })

  it('reads a stored stamp as UTC, and nothing else as a stamp', () => {
    expect(storedUtcMs('2026-11-14 19:00:00')).toBe(NOW)
    expect(storedUtcMs(null)).toBeNull()
    expect(storedUtcMs('not a stamp')).toBeNull()
  })

  it('takes the time as a Date as well as epoch milliseconds', () => {
    expect(needsCheck('2026-09-12 14:00:00', new Date(NOW))).toBe(false)
  })
})

describe('sortRegionCards', () => {
  it('puts the cards that need a check first, then those with open items, then A to Z', () => {
    const cards = [
      card('a', 'Alpha Chess Club', false),
      card('b', 'Bravo Chess Club', false, 1),
      card('c', 'Charlie Chess Club', true),
      card('d', 'Delta Chess Club', true, 2),
      card('e', 'Echo Chess Club', false),
      card('f', 'Example Chess Club', true),
    ]
    expect(ids(sortRegionCards(cards))).toEqual(['d', 'c', 'f', 'b', 'a', 'e'])
  })

  it('sorts A to Z without regard to case or accents', () => {
    const cards = [card('1', 'zephyr Chess Club', false), card('2', 'Ébène Chess Club', false), card('3', 'apple Chess Club', false), card('4', 'Daisy Chess Club', false)]
    expect(ids(sortRegionCards(cards))).toEqual(['3', '4', '2', '1'])
  })

  it('keeps names that differ only in case or accents in a stable order, whatever order they come in', () => {
    const names = [card('x2', 'Example Chess Club', false), card('x1', 'Example Chess Club', false), card('x3', 'example chess club', false), card('x4', 'Exámple Chess Club', false)]
    const once = ids(sortRegionCards(names))
    expect(once).toEqual(['x1', 'x2', 'x4', 'x3'])
    for (const order of [[3, 2, 1, 0], [1, 3, 0, 2], [2, 0, 3, 1]]) {
      expect(ids(sortRegionCards(order.map((i) => names[i]))), order.join()).toEqual(once)
    }
  })

  it('returns a new list and leaves the one given as it was', () => {
    const cards = [card('b', 'Bravo Chess Club', false), card('a', 'Alpha Chess Club', false)]
    const sorted = sortRegionCards(cards)
    expect(ids(cards)).toEqual(['b', 'a'])
    expect(ids(sorted)).toEqual(['a', 'b'])
    expect(sortRegionCards([])).toEqual([])
  })
})

describe('checkCounts', () => {
  it('counts the clubs checked in the last 90 days and those not', () => {
    expect(checkCounts([card('a', 'A', false), card('b', 'B', true), card('c', 'C', true)])).toEqual({ checked: 1, notChecked: 2 })
    expect(checkCounts([])).toEqual({ checked: 0, notChecked: 0 })
  })
})
