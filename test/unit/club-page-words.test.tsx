// @vitest-environment jsdom
//
// The plain-language rules for the new club page (WS09 step 21), held on
// what a person reads and on the files that make it: no long dash anywhere,
// "US Chess" and never its old initials, a half written as the half sign and
// never as a decimal, no word of "null", "undefined" or a bare true or false
// on the page, sample content that is plainly made up (example.org and
// Example names), and no mention in a file of how it was made. The page is
// drawn from a fuller club's answer, with a keeper's line, and the words are
// read from the page as it stands. The patterns are put together here from
// parts, so this file holds none of what it looks for.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { cleanup, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ClubPageView } from '@/areas/clubs/components/ClubPage'
import { clubPageResponseSchema } from '@domain/contracts'
import { bareAnswer, fullAnswer } from './helpers/clubPageAnswer'

vi.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) } } }))
vi.mock('@/areas/clubs/components/LCAMap', () => ({ LCAMap: () => null }))

afterEach(cleanup)

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

const EM = String.fromCharCode(0x2014)
const EN = String.fromCharCode(0x2013)
const LONG_DASH = new RegExp(`[${EM}${EN}]`)
const OLD_INITIALS = new RegExp(`\\b${['US', 'CF'].join('')}\\b`)
const MADE_WITH = new RegExp(`\\b(?:${['cla' + 'ude', 'anthr' + 'opic', 'chat' + 'gpt', 'open' + 'ai', 'copi' + 'lot', 'gem' + 'ini', 'l' + 'lm', 'assist' + 'ant', 'co-' + 'authored', 'generated ' + 'with', 'A' + 'I-generated'].join('|')})\\b`, 'i')
const CAPITAL_INITIALS = new RegExp(`\\b${'A' + 'I'}\\b`)
const TOOLING = new RegExp(`\\b(?:${['sub' + 'agent', 'work' + 'flow'].join('|')})\\b`, 'i')

/** The new page's source files, and the tests written for it. */
const SOURCE = [
  'src/areas/clubs/clubPage.ts', 'src/areas/clubs/components/ClubPage.tsx', 'src/areas/clubs/components/ClubCover.tsx',
  'src/areas/clubs/components/AuthorLine.tsx', 'src/areas/clubs/components/SectionNav.tsx', 'src/areas/clubs/components/ClubAbout.tsx',
  'src/areas/clubs/components/WhenAndWhere.tsx', 'src/areas/clubs/components/PagePreview.tsx', 'src/pages/ClubListingPage.tsx',
]
const CHANGED = [
  'src/areas/clubs/clubMap.ts', 'src/areas/clubs/components/LCAMap.tsx', 'src/areas/clubs/components/ClubEditor.tsx', 'src/areas/clubs/previews.ts', 'src/App.tsx',
]
const TESTS = [
  'test/unit/helpers/clubPageAnswer.ts', 'test/unit/club-page-bare.test.tsx', 'test/unit/club-page-full.test.tsx', 'test/unit/club-page-off.test.tsx',
  'test/unit/club-page-edges.test.tsx', 'test/unit/club-page-helpers.test.ts', 'test/unit/club-page-words.test.tsx',
  'test/unit/club-editor-page-preview.test.tsx', 'test/unit/club-map-places.test.tsx', 'test/unit/club-map-places-edges.test.tsx',
  'test/unit/club-pages-no-dates.test.tsx', 'test/unit/redesign-status-ws09-step21.test.ts',
]

describe('the files', () => {
  it.each([...SOURCE, ...CHANGED, ...TESTS])('%s has no long dash, comments and test names included', (file) => {
    expect(read(file)).not.toMatch(LONG_DASH)
  })

  it.each([...SOURCE, ...TESTS])('%s has no mention of how it was made, and none of the build\'s own job words', (file) => {
    const text = read(file)
    expect(text).not.toMatch(MADE_WITH)
    expect(text).not.toMatch(CAPITAL_INITIALS)
    expect(text).not.toMatch(TOOLING)
  })

  it.each([...SOURCE, ...TESTS])('%s never writes the old initials of US Chess', (file) => {
    expect(read(file)).not.toMatch(OLD_INITIALS)
  })

  it.each(TESTS)('%s uses only made-up addresses: example.org, example.com or example.net', (file) => {
    const text = read(file)
    const hosts = [...text.matchAll(/\b[\w.+-]+@([a-z0-9-]+(?:\.[a-z0-9-]+)+)\b/gi)].map((m) => m[1].toLowerCase())
    for (const host of hosts) expect(host, file).toMatch(/^(?:[a-z0-9-]+\.)*example\.(?:org|com|net)$/)
    const links = [...text.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)].map((m) => m[1].toLowerCase())
    for (const host of links) {
      // The two real hosts a test may name are the maps link the site builds and Facebook's own address for the Facebook link.
      expect(host, file).toMatch(/^(?:[a-z0-9-]+\.)*example\.(?:org|com|net)$|^(?:www\.)?google\.com$|^(?:www\.)?facebook\.com$|^(?:www\.)?localhost$/)
    }
  })
})

describe('what the page says', () => {
  const draw = (answer = fullAnswer(), keeper: Parameters<typeof ClubPageView>[0]['keeper'] = null) => {
    const view = render(<MemoryRouter><ClubPageView answer={answer} keeper={keeper} /></MemoryRouter>)
    return (view.container.textContent ?? '').replace(/\s+/g, ' ')
  }

  it('has no long dash, no old initials, no decimal half and no stray word of code, for a fuller club with a keeper\'s line', () => {
    const words = draw(fullAnswer(), { kind: 'region', region: 'Bayou Region', edit: '/workspace/region/clubs/c-example' })
    expect(words).toMatch(/You can edit this page as the Bayou Region representative/)
    expect(words).not.toMatch(LONG_DASH)
    expect(words).not.toMatch(OLD_INITIALS)
    expect(words).not.toMatch(/\d\.5\b/)
    expect(words).not.toMatch(/\b(?:null|undefined|NaN|true|false)\b|\[object|\{\{|\}\}/)
  })

  it('has none of them for the bare club either, and no dangling dot or comma where a part is missing', () => {
    const bare = bareAnswer()
    const noRegion = clubPageResponseSchema.parse({ ...bare, club: { ...bare.club, region: null, city: '' } })
    for (const answer of [bare, noRegion]) {
      const words = draw(answer)
      expect(words).not.toMatch(LONG_DASH)
      expect(words).not.toMatch(/\b(?:null|undefined|NaN)\b/)
      expect(words).not.toMatch(/·\s*(?:·|$)|,\s*,|\s,|\.\s*\./)
      cleanup()
    }
    const words = draw(noRegion)
    expect(words).toContain('Chess club in Louisiana')
    expect(words).not.toContain('Chess club in Louisiana ·')
  })

  it('names the association "US Chess" wherever it names it, and the page names it nowhere on its own', () => {
    const words = draw()
    expect(words).not.toMatch(/\bUS Chess\b/)
    expect(words).not.toMatch(OLD_INITIALS)
  })

  it('says every time as the club or the server wrote it, and writes none of its own', () => {
    const words = draw(bareAnswer())
    // The statement is the club's, with its time as "7:00 PM"; the page adds no clock time of its own.
    expect(words).toContain('7:00 PM')
    const stripped = words.replaceAll('First and third Tuesdays at 7:00 PM at Example Library.', '')
    expect(stripped).not.toMatch(/\b\d{1,2}:\d{2}\b|\b\d{1,2}\s?(?:AM|PM|am|pm)\b/)
  })
})
