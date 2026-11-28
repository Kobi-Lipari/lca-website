// @vitest-environment jsdom
//
// The plain-language rules for the rest of the new club page (WS09 step
// 22), held on the files it adds and changes and on what a person reads: no
// long dash anywhere, "US Chess" and never its old initials, no mention in
// a file of how it was made, made-up addresses only in the tests, a club's
// colour never words and no gold, raw colour or fetch in the new files, a
// weekday on every full date the page draws, no clock time of its own, and
// no word of "null", "undefined" or a bare true or false. The page is drawn
// from the fuller club's answer with every block of this step. The patterns
// are put together here from parts, so this file holds none of what it
// looks for.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { cleanup, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ClubPageView } from '@/areas/clubs/components/ClubPage'
import { restAnswer } from './helpers/clubPageRest'

vi.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) } } }))
vi.mock('@/areas/clubs/components/LCAMap', () => ({ LCAMap: () => null }))

afterEach(cleanup)

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const codeOf = (file: string) => read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const LONG_DASH = new RegExp(`[${String.fromCharCode(0x2014)}${String.fromCharCode(0x2013)}]`)
const OLD_INITIALS = new RegExp(`\\b${['US', 'CF'].join('')}\\b`)
const MADE_WITH = new RegExp(`\\b(?:${['cla' + 'ude', 'anthr' + 'opic', 'chat' + 'gpt', 'open' + 'ai', 'copi' + 'lot', 'gem' + 'ini', 'l' + 'lm', 'assist' + 'ant', 'co-' + 'authored', 'generated ' + 'with', 'A' + 'I-generated'].join('|')})\\b`, 'i')
const CAPITAL_INITIALS = new RegExp(`\\b${'A' + 'I'}\\b`)
const TOOLING = new RegExp(`\\b(?:${['sub' + 'agent', 'work' + 'flow'].join('|')})\\b`, 'i')

const C = 'src/areas/clubs/components/'
/** The files this step adds to the page. */
const NEW_SOURCE = [`${C}ClubEvents.tsx`, `${C}ClubNews.tsx`, `${C}NearbyClubs.tsx`, `${C}ClubFootLine.tsx`, `${C}ClubBar.tsx`, 'src/areas/clubs/clubPageRows.ts']
/** The files of the page this step changes. */
const CHANGED_SOURCE = [`${C}ClubPage.tsx`, `${C}ClubCover.tsx`, `${C}SectionNav.tsx`, 'src/areas/clubs/clubPage.ts']
/** The tests this step adds. */
const NEW_TESTS = [
  'test/unit/helpers/clubPageRest.ts', 'test/unit/club-events.test.tsx', 'test/unit/club-page-rest.test.tsx', 'test/unit/club-page-phone.test.tsx',
  'test/unit/club-page-mends.test.ts', 'test/unit/club-page-rest-edges.test.tsx', 'test/unit/club-page-rest-words.test.tsx', 'test/unit/redesign-status-ws09-step22.test.ts',
]

describe('the files', () => {
  it.each([...NEW_SOURCE, ...CHANGED_SOURCE, ...NEW_TESTS])('%s has no long dash, comments and test names included', (file) => {
    expect(read(file)).not.toMatch(LONG_DASH)
  })

  it.each([...NEW_SOURCE, ...CHANGED_SOURCE, ...NEW_TESTS])('%s has no mention of how it was made, none of the build\'s own job words, and never the old initials of US Chess', (file) => {
    const text = read(file)
    for (const rule of [MADE_WITH, CAPITAL_INITIALS, TOOLING, OLD_INITIALS]) expect(text).not.toMatch(rule)
  })

  it.each(NEW_TESTS)('%s uses only made-up addresses, and reads no setting from the environment', (file) => {
    const text = read(file)
    for (const m of text.matchAll(/\b[\w.+-]+@([a-z0-9-]+(?:\.[a-z0-9-]+)+)\b/gi)) expect(m[1].toLowerCase(), file).toMatch(/^(?:[a-z0-9-]+\.)*example\.(?:org|com|net)$/)
    // A host, after any name or password a test writes before an "@" to see it refused.
    for (const m of text.matchAll(/https?:\/\/(?:[^\s/@'"`]*@)?([a-z0-9.-]+)/gi)) {
      expect(m[1].toLowerCase(), file).toMatch(/^(?:[a-z0-9-]+\.)*example\.(?:org|com|net)$|^(?:www\.)?google\.com$|^(?:www\.)?facebook\.com$|^(?:www\.)?localhost$/)
    }
    expect(text).not.toMatch(/process\.env|import\.meta\.env/)
  })

  it.each([...NEW_SOURCE, ...CHANGED_SOURCE])('%s never makes a club\'s colour words, fetches nothing itself, and imports only types from domain/contracts', (file) => {
    const code = codeOf(file)
    const imports = code.match(/^import[\s\S]*?from '[^']+'/gm) ?? []
    expect(imports.join('\n')).not.toMatch(/clubTextColor|clubTextOnDark|clubColors/)
    expect(code).not.toMatch(/clubTextColor|clubTextOnDark|\bfetch\(|sendBeacon|XMLHttpRequest/)
    for (const line of code.split('\n').filter((l) => /from '@domain\/contracts'/.test(l))) expect(line).toMatch(/^import type /)
  })

  it.each(NEW_SOURCE)('%s has no gold, no white or black words, no raw colour and no clock of its own', (file) => {
    const code = codeOf(file)
    expect(code).not.toMatch(/gold|text-white|text-black|brand-navy|lca-navy|lca-gold/i)
    expect(code).not.toMatch(/#[0-9a-f]{3,8}\b/i)
    expect(code).not.toMatch(/\b(?:text|bg|border)-(?:red|green|blue|yellow|amber|orange|gray|slate|zinc|neutral|stone|emerald)-\d/)
    expect(code).not.toMatch(/new Date\(|Date\.now\(|toLocale(?:Date|Time)?String|Intl\.DateTimeFormat|formatTime/)
    expect(code).not.toMatch(/\b(?:Tonight|Meets today)\b|Checked /)
  })
})

describe('what the page says', () => {
  /** The page's words, each piece of text apart from the next, as a screen reader moves from one to the next. */
  const words = () => {
    const view = render(<MemoryRouter><ClubPageView answer={restAnswer()} keeper={null} /></MemoryRouter>)
    const texts: string[] = []
    const walker = document.createTreeWalker(view.container, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) texts.push(node.textContent ?? '')
    return texts.join(' ').replace(/\s+/g, ' ')
  }

  it('has no long dash, no old initials, no decimal half and no stray word of code', () => {
    const text = words()
    expect(text).not.toMatch(LONG_DASH)
    expect(text).not.toMatch(OLD_INITIALS)
    expect(text).not.toMatch(/\d\.5\b/)
    expect(text).not.toMatch(/\b(?:null|undefined|NaN|true|false)\b|\[object|\{\{|\}\}|Invalid Date/)
  })

  it('puts a weekday on every full date it draws', () => {
    const text = words()
    const dates = [...text.matchAll(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}, \d{4}\b/g)]
    expect(dates.length).toBeGreaterThanOrEqual(6)
    for (const found of dates) expect(text.slice(Math.max(0, (found.index ?? 0) - 5), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), $/)
  })

  it('writes no clock time of its own: every time on the page is a club\'s own words', () => {
    const answer = restAnswer()
    let text = words()
    const own = [answer.statement.text ?? '', answer.about.text ?? '', ...answer.nearest.map((c) => c.statement ?? '')].flatMap((t) => t.split(/\n+/))
    for (const part of own) if (part.trim()) text = text.replaceAll(part.trim().replace(/\s+/g, ' '), '')
    expect(text).not.toMatch(/\b\d{1,2}:\d{2}\s?(?:AM|PM|am|pm)\b|\b\d{1,2}\s?(?:AM|PM|am|pm)\b/)
  })

  it('names the association in full in the foot line, and "US Chess" nowhere of its own', () => {
    const text = words()
    expect(text).toContain('a club listed by the Louisiana Chess Association')
    expect(text).not.toMatch(/\bUS Chess\b/)
  })
})
