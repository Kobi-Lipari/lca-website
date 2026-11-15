// test/unit/region-card-edges.test.ts
//
// More cases for My region's cards (domain/clubs/regionCards.ts): stamps
// ahead of now or unreadable, the month across the turn of the year and at
// midnight Central, the plain words, and the order under full ties. Every
// club here is made up.
import { describe, expect, it } from 'vitest'
import { checkCounts, checkWords, needsCheck, sortRegionCards } from '../../domain/clubs/regionCards'

const NOW = Date.parse('2026-11-14T19:00:00Z')
const card = (id: string, name: string, needs: boolean, open = 0) => ({ id, name, needsCheck: needs, openItems: Array.from({ length: open }, () => ({})) })
const ids = (cards: Array<{ id: string }>) => cards.map((c) => c.id)

describe('stale, future and unreadable stamps, and the plain words', () => {
  it('counts a stamp ahead of now as a check that holds, and one that cannot be read as never checked', () => {
    expect(needsCheck('2026-11-20 19:00:00', NOW)).toBe(false)
    expect(checkWords('2026-11-20 19:00:00', NOW)).toBe('Checked Nov 2026')
    expect(needsCheck('garbage', NOW)).toBe(true)
    expect(checkWords('garbage', NOW)).toBe('Not checked yet')
  })

  it('keeps the month of a stamp across the turn of the year and at midnight Central', () => {
    expect(checkWords('2026-01-01 03:00:00', NOW)).toBe('Not checked since Dec 2025')
    expect(checkWords('2026-09-01 04:59:59', NOW)).toBe('Checked Aug 2026')
    expect(checkWords('2026-09-01 05:00:00', NOW)).toBe('Checked Sep 2026')
  })

  it('writes no banned word: not the old initials, no ".5" and no long dash', () => {
    for (const stamp of [null, '2026-09-12 14:00:00', '2026-03-12 14:00:00']) {
      const words = checkWords(stamp, NOW)
      expect(words).not.toMatch(new RegExp(['US', 'CF'].join('')))
      expect(words).not.toMatch(new RegExp(`\\.5|[${String.fromCharCode(0x2013, 0x2014)}]`))
    }
  })

  it('reads the 90 days as elapsed time, whichever side of the November clock change the stamp falls on', () => {
    // From Aug 16 to Nov 14, 2026 the clocks went back on Sun, Nov 1: 90 days are 2,160 hours, not 90 calendar days.
    const start = Date.parse('2026-08-16T19:00:00Z')
    expect(needsCheck('2026-08-16 19:00:00', start + 90 * 24 * 3600_000)).toBe(false)
    expect(needsCheck('2026-08-16 19:00:00', start + 90 * 24 * 3600_000 + 1000)).toBe(true)
  })
})

describe('sortRegionCards, ties and the order of the three rules', () => {
  it('orders needs a check, then open items, then A to Z, and a card with both outranks each alone', () => {
    const cards = [
      card('plain', 'Alpha Chess Club', false),
      card('open', 'Beta Chess Club', false, 3),
      card('check', 'Charlie Chess Club', true),
      card('both', 'Zulu Chess Club', true, 1),
    ]
    expect(ids(sortRegionCards(cards))).toEqual(['both', 'check', 'open', 'plain'])
  })

  it('gives the same list however the cards arrive, for a full set of ties by name and by id', () => {
    const cards = [
      card('3', 'Example Chess Club', true), card('1', 'Example Chess Club', true), card('2', 'example chess club', true),
      card('5', 'Éxample Chess Club', false), card('4', 'Example Chess Club', false), card('6', 'Example Chess Club', false, 1),
    ]
    const want = ids(sortRegionCards(cards))
    expect(want).toEqual(['1', '3', '2', '6', '4', '5'])
    for (let seed = 1; seed <= 20; seed++) {
      const shuffled = [...cards]
      let x = seed
      for (let i = shuffled.length - 1; i > 0; i--) {
        x = (x * 48271) % 2147483647
        const j = x % (i + 1)
        ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }
      expect(ids(sortRegionCards(shuffled)), `order ${seed}`).toEqual(want)
    }
  })

  it('counts every club as checked or not, with none lost', () => {
    const cards = [card('a', 'A', false), card('b', 'B', false), card('c', 'C', true), card('d', 'D', true), card('e', 'E', true)]
    const counts = checkCounts(cards)
    expect(counts).toEqual({ checked: 2, notChecked: 3 })
    expect(counts.checked + counts.notChecked).toBe(cards.length)
  })
})
