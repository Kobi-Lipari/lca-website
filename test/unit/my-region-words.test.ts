// The pure parts of My region (WS09 step 11) in src/areas/clubs/region.ts,
// and a read of the files that draw it and of this step's tests for the
// words and habits the site keeps: no long dash, "US Chess" and never the old
// name, no window.confirm, no gold as text, no call made from a page, and
// only types taken from domain/contracts. Every name here is made up.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { clubsToConfirm, clubsWord, confirmAllWords, initialsOf, namesInWords, withConfirmed } from '@/areas/clubs/region'
import type { RegionClub, WorkspaceRegionResponse } from '@domain/contracts'

function card(id: string, needsCheck: boolean, extra: Partial<RegionClub> = {}): RegionClub {
  return {
    id, name: `Example Club ${id}`, city: 'Example City', region: 'Bayou Region', color: null, logoUrl: null, statement: null,
    lastConfirmedAt: needsCheck ? null : '2026-11-02 15:00:00', lastCheckWords: needsCheck ? 'Not checked yet' : 'Checked Nov 2026', needsCheck, events: 0, openItems: [], ...extra,
  }
}
const answer = (clubs: RegionClub[], checked: number, notChecked: number): WorkspaceRegionResponse => ({
  clubs, thisMonth: { nextCheck: { day: '2026-12-07', date: 'Mon, Dec 7, 2026', time: '8:00 AM' }, checked, notChecked }, regions: [],
})
const done = (id: string) => ({ id, lastConfirmedAt: '2026-11-15 18:00:00', lastCheckWords: 'Checked Nov 2026' })

describe('clubsToConfirm', () => {
  it('keeps each club that needs a check and has no open item, in the cards\' order', () => {
    const item = { kind: 'report' } as unknown as RegionClub['openItems'][number]
    const clubs = [card('a', true), card('b', true, { openItems: [item] }), card('c', false), card('d', true), card('e', false, { openItems: [item] })]
    expect(clubsToConfirm(clubs).map((c) => c.id)).toEqual(['a', 'd'])
  })

  it('is empty for no clubs, for clubs all checked and for clubs all held by an open item', () => {
    const item = { kind: 'suggestion' } as unknown as RegionClub['openItems'][number]
    expect(clubsToConfirm([])).toEqual([])
    expect(clubsToConfirm([card('a', false), card('b', false)])).toEqual([])
    expect(clubsToConfirm([card('a', true, { openItems: [item] })])).toEqual([])
  })
})

describe('withConfirmed', () => {
  it('stamps the one card in its place and moves the counts by one', () => {
    const before = answer([card('a', true), card('b', true), card('c', false)], 1, 2)
    const after = withConfirmed(before, done('b'))
    expect(after.clubs.map((c) => c.id)).toEqual(['a', 'b', 'c'])
    expect(after.clubs[1]).toMatchObject({ needsCheck: false, lastCheckWords: 'Checked Nov 2026', lastConfirmedAt: '2026-11-15 18:00:00' })
    expect(after.clubs[0]).toBe(before.clubs[0])
    expect(after.thisMonth).toMatchObject({ checked: 2, notChecked: 1 })
    expect(before.thisMonth).toMatchObject({ checked: 1, notChecked: 2 })
  })

  it('does not move the counts a second time for a club already checked, and refreshes its stamp', () => {
    const before = answer([card('a', false)], 1, 0)
    const after = withConfirmed(before, done('a'))
    expect(after.thisMonth).toMatchObject({ checked: 1, notChecked: 0 })
    expect(after.clubs[0].lastConfirmedAt).toBe('2026-11-15 18:00:00')
  })

  it('never takes the not checked count below none, and leaves an answer alone for a club it does not hold', () => {
    const stale = answer([card('a', true)], 0, 0)
    expect(withConfirmed(stale, done('a')).thisMonth).toMatchObject({ checked: 1, notChecked: 0 })
    expect(withConfirmed(stale, done('zzz'))).toBe(stale)
  })
})

describe('the words', () => {
  it('says a club or clubs', () => {
    expect(clubsWord(0)).toBe('0 clubs')
    expect(clubsWord(1)).toBe('1 club')
    expect(clubsWord(12)).toBe('12 clubs')
  })

  it('lists names in a sentence', () => {
    expect(namesInWords([])).toBe('')
    expect(namesInWords(['A'])).toBe('A')
    expect(namesInWords(['A', 'B'])).toBe('A and B')
    expect(namesInWords(['A', 'B', 'C'])).toBe('A, B and C')
  })

  it('says what a run did, naming each club that was not marked', () => {
    expect(confirmAllWords(3, [])).toBe('3 clubs marked still accurate.')
    expect(confirmAllWords(1, [])).toBe('1 club marked still accurate.')
    expect(confirmAllWords(2, ['Example Rooks Club'])).toBe('2 of 3 clubs marked still accurate. Not marked: Example Rooks Club. It is as it was.')
    expect(confirmAllWords(1, ['A', 'B'])).toBe('1 of 3 clubs marked still accurate. Not marked: A and B. They are as they were.')
    expect(confirmAllWords(0, ['A'])).toBe('None of the 1 club could be marked still accurate. Not marked: A. It is as it was.')
  })

  it('takes the initials of the first two words, or the first two letters of one word', () => {
    expect(initialsOf('Example Chess Club')).toBe('EC')
    expect(initialsOf('Example')).toBe('EX')
    expect(initialsOf('  baton rouge chess ')).toBe('BR')
    expect(initialsOf('X')).toBe('X')
    expect(initialsOf('---')).toBe('?')
    expect(initialsOf('')).toBe('?')
  })
})

describe('the files of My region and this step\'s tests', () => {
  const ROOT = resolve(__dirname, '../..')
  const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
  const DRAWING = [
    'src/pages/MyRegionPage.tsx', 'src/areas/clubs/components/ThisMonthBar.tsx', 'src/areas/clubs/components/RegionClubCard.tsx',
    'src/areas/clubs/components/RegionHelp.tsx', 'src/areas/clubs/region.ts',
  ]
  const TESTS = [
    'test/unit/my-region-page.test.tsx', 'test/unit/my-region-ways-in.test.tsx', 'test/unit/my-region-edges.test.tsx',
    'test/unit/my-region-guard.test.tsx', 'test/unit/my-region-words.test.ts', 'test/unit/club-pages-no-dates.test.tsx',
    'test/unit/redesign-status-ws09-step11.test.ts',
  ]
  const LONG_DASH = new RegExp('[\\u2013\\u2014]')
  // Built from parts so this file does not hold the words it keeps out.
  const OLD_NAME = new RegExp(['US', 'CF'].join(''))
  const BUILD_WORDS = new RegExp(['\\bA', 'I\\b|clau', 'de|anthro', 'pic|chat', 'gpt|copi', 'lot|\\bLL', 'M\\b'].join(''))

  it('writes no long dash, no old name for US Chess and no mention of what built it, in code, comments or test names', () => {
    for (const file of [...DRAWING, ...TESTS]) {
      const text = read(file)
      expect(text, file).not.toMatch(LONG_DASH)
      expect(text, file).not.toMatch(OLD_NAME)
      expect(text, file).not.toMatch(BUILD_WORDS)
    }
  })

  it('asks its one question in the site\'s dialog, never in the browser\'s own', () => {
    for (const file of DRAWING) expect(read(file), file).not.toMatch(/window\.confirm|\bconfirm\(|\balert\(|\bprompt\(/)
    expect(read('src/areas/clubs/components/ThisMonthBar.tsx')).toContain('@/components/ui/dialog')
  })

  it('never draws gold as text, and gives the stamp\'s amber tint beside its words', () => {
    for (const file of DRAWING) expect(read(file), file).not.toMatch(/text-(?:lca-)?gold|text-brand-gold|text-accent-gold|text-yellow|text-amber/)
    expect(read('src/areas/clubs/components/RegionClubCard.tsx')).toContain('{club.lastCheckWords}')
  })

  it('makes no call from a page or a component, and imports only types from domain/contracts', () => {
    for (const file of DRAWING) {
      const code = read(file)
      expect(code, file).not.toMatch(/\bfetch\(/)
      expect(code, file).not.toMatch(/^import (?!type\b)[^\n]*@domain\/contracts/m)
      expect(code, file).not.toMatch(/localStorage\.(?:get|set)Item\([^)]*(?:email|token)/i)
    }
  })

  it('draws no address of a person: no email field is read from the answer', () => {
    for (const file of DRAWING) expect(read(file), file).not.toMatch(/\.email\b|mailto:/i)
  })
})
