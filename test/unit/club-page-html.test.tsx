// @vitest-environment jsdom
//
// The strings of the club page the server writes before any script (WS09
// step 23, functions/utils/clubs/pageHtml.ts), one rule at a time: the words
// it shares with the app's page, read from domain/clubs/pageWords.ts by both;
// the link rule it keeps a copy of, held equal to the app's; the JSON-LD
// block's escaping; the body's sections, each only with something in it; and
// the description of at most 155 characters. Then the files: the one answer
// built in one place, its events through the listing rule, no email, officer
// or roster named, no cookie read, the constant read at each call, and no
// handler file added. Every club, place and address here is made up.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { cityLine as appCityLine, webLink as appWebLink } from '@/areas/clubs/clubPage'
import { eventDates as appEventDates } from '@/areas/clubs/clubPageRows'
import { ClubAbout } from '@/areas/clubs/components/ClubAbout'
import * as words from '../../domain/clubs/pageWords'
import { PAGE_DESCRIPTION_MAX } from '../../domain/clubs/pageMeta'
import type { ClubPageResponse } from '../../domain/contracts/clubPage'
import { clubJsonLd, clubLinks, clubPageBody, escapeHtml, jsonForScript, pageDescription, pageTitle, webLink } from '../../functions/utils/clubs/pageHtml'

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
/** A file's code with its comments taken out. */
const codeOf = (file: string) => read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
/** The written body with its wrapper's mark and its style element taken out: its words, their order and their tags. */
const plainOf = (body: string) => body.replace(/^<main data-club-written-page><style>[^<]*<\/style>/, '<main>')

afterEach(() => cleanup())

/** The bare club's answer: one sentence, how it meets and a place, and nothing else. */
function bare(): ClubPageResponse {
  return {
    club: { id: 'example-chess-club', slug: 'example-chess-club', name: 'Example Chess Club', city: 'Example City', region: null, color: '#1a2744', logo: null },
    sections: ['about', 'when_and_where', 'contact'],
    about: { text: 'A made up club.', cost: null, welcome: null, facebook: null, website: null, other: null, weekend_play: false, scholastic_friendly: false },
    statement: { text: 'Tuesdays at 7:00 PM', told: 'Last checked November 2026' },
    places: [{ name: 'Example Library', street: null, note: null, latitude: null, longitude: null }],
    contact: { name: 'Player One', goes_to: 'club' },
    suggestion: { goes_to: 'club_rep' },
    events: [],
    news: [{ id: 'n1', title: 'Example news', excerpt: 'A made up note.', news_date: '2026-11-01' }],
    nearest: [],
  }
}

describe('the words the server\'s page shares with the app\'s', () => {
  it('are one set of functions: the app\'s helpers are the shared ones', () => {
    expect(appCityLine).toBe(words.cityLine)
    expect(appEventDates).toBe(words.eventDates)
    expect(words.cityLine('Example City', 'Example Region')).toBe('Chess club in Example City, Louisiana · Example Region')
    expect(words.eventDates({ date: '2026-12-12', end_date: '2026-12-13' })).toBe('Sat, Dec 12, 2026 to Sun, Dec 13, 2026')
  })

  it('are read by the app\'s three sections from the shared file, with no copy of their own', () => {
    const C = 'src/areas/clubs/components/'
    const about = codeOf(`${C}ClubAbout.tsx`)
    expect(about).toContain('import { ABOUT_LABELS, ABOUT_TICKS, aboutHeading } from \'@domain/clubs/pageWords\'')
    expect(about).not.toMatch(/'Who is welcome'|'Find us online'|"Cost"|`About \$\{name\}`/)
    const where = codeOf(`${C}WhenAndWhere.tsx`)
    expect(where).toContain('import { STATEMENT_LABEL, whenAndWhereHeading } from \'@domain/clubs/pageWords\'')
    expect(where).not.toMatch(/`When and where \$\{name\} meets`|'How the club meets'/)
    expect(codeOf(`${C}ClubEvents.tsx`)).toContain('<SectionHeading compact={false}>{EVENTS_HEADING}</SectionHeading>')
    // The shared file is plain code the site's bundle can carry: no zod and nothing from the site or the server.
    expect(codeOf('domain/clubs/pageWords.ts')).not.toMatch(/zod|functions\/|src\/|@\//)
  })

  it('keeps the link rule equal to the app\'s, and the links\' words equal to what the app\'s About draws', () => {
    const tries = [
      null, '', '   ', 'example.org', 'ftp://example.org', 'javascript:alert(1)', 'https://', 'https://example.org', ' https://www.example.org/chess ',
      'https://user@example.org', 'https://user:secret@example.org/a', 'https://example.org/@example-chess-club', 'http://example.org/a?q=<b>&r="x"',
      'https://exa mple.org', 'HTTPS://EXAMPLE.ORG/A',
    ]
    for (const url of tries) expect(webLink(url), String(url)).toBe(appWebLink(url))
    const about = { ...bare().about, facebook: 'https://www.facebook.com/example-chess-club', website: 'https://www.example.org/chess', other: 'https://example.org/ratings' }
    const { container } = render(<ClubAbout name="Example Chess Club" about={about} />)
    const drawn = [...container.querySelectorAll('a')].map((a) => [a.getAttribute('href'), a.textContent?.trim()])
    expect(drawn).toEqual(clubLinks(about).map((link) => [link.href, link.words]))
  })
})

describe('the server\'s page in strings', () => {
  it('writes the bare club\'s own sections and nothing else: no News, no told line, and Contact\'s heading and line (WS09 step 26)', () => {
    const body = plainOf(clubPageBody(bare()))
    expect(body).toBe('<main><h1>Example Chess Club</h1><p>Chess club in Example City, Louisiana</p><p>Tuesdays at 7:00 PM</p>'
      + '<section id="about"><h2>About Example Chess Club</h2><p>A made up club.</p></section>'
      + '<section id="when-and-where"><h2>When and where Example Chess Club meets</h2><ul><li><p>Example Library</p></li></ul></section>'
      + '<section><h2>Contact</h2><p>You can send the club a message through this site. Its address stays private.</p></section>' + '</main>')
  })

  it('writes no heading with nothing under it: a link the page would not draw writes no About', () => {
    const answer = { ...bare(), about: { ...bare().about, text: null, other: 'https://user@example.org' }, places: [] }
    expect(plainOf(clubPageBody(answer))).toBe('<main><h1>Example Chess Club</h1><p>Chess club in Example City, Louisiana</p><p>Tuesdays at 7:00 PM</p>' + '<section><h2>Contact</h2><p>You can send the club a message through this site. Its address stays private.</p></section>' + '</main>')
  })

  it('escapes a club\'s words for HTML text and attributes', () => {
    expect(escapeHtml('<a href="x">&\'</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;')
    const answer = { ...bare(), club: { ...bare().club, name: '</main><script>alert(1)</script>' }, about: { ...bare().about, website: 'https://example.org/"onclick="x' } }
    const body = clubPageBody(answer)
    expect(body).not.toContain('<script>')
    expect(body).toContain('<h1>&lt;/main&gt;&lt;script&gt;alert(1)&lt;/script&gt;</h1>')
    expect(body).toContain('href="https://example.org/&quot;onclick=&quot;x"')
  })

  it('writes the JSON-LD block so no value can end it or start a tag', () => {
    const value = { name: '</script><!-- & \u2028\u2029 >' }
    const written = jsonForScript(value)
    expect(written).not.toMatch(/[<>&\u2028\u2029]/)
    expect(JSON.parse(written)).toEqual(value)
    const answer = { ...bare(), club: { ...bare().club, name: '</script><script>alert(1)</script>' } }
    const block = clubJsonLd(answer, 'https://www.example.org')
    expect(block.startsWith('<script type="application/ld+json">')).toBe(true)
    expect(block.split('</script>')).toHaveLength(2)
    expect(block.endsWith('</script>')).toBe(true)
  })

  it('gives a description of at most 155 characters, and the line under the name for a club that wrote neither', () => {
    const long = { ...bare(), about: { ...bare().about, text: 'Example words. '.repeat(30) } }
    expect(pageDescription(long).length).toBeLessThanOrEqual(PAGE_DESCRIPTION_MAX)
    expect(pageDescription(long).endsWith('Tuesdays at 7:00 PM')).toBe(true)
    const none = { ...bare(), about: { ...bare().about, text: null }, statement: { text: null, told: '' } }
    expect(pageDescription(none)).toBe('Chess club in Example City, Louisiana')
    expect(pageTitle(bare())).toBe('Example Chess Club · Chess club in Example City, Louisiana · Louisiana Chess Association')
  })
})

describe('the files', () => {
  const SHARED = 'functions/utils/clubs/pageAnswer.ts'
  const ENDPOINT = 'functions/api/clubs/[id]/page.ts'
  const ROUTE = 'functions/clubs/[id].ts'
  const HTML = 'functions/utils/clubs/pageHtml.ts'

  it('build the one answer in one place, which both the endpoint and the route call, its events through the listing rule', () => {
    const shared = codeOf(SHARED)
    expect(shared).toContain('WHERE t.club_id = ? AND ${listedWhere(\'t\')}')
    expect(shared).not.toContain('is_visible')
    expect(codeOf(ENDPOINT)).toContain('return jsonResponse(await clubPageAnswer(db, club), 200, headers)')
    expect(codeOf(ROUTE)).toContain('const answer = await clubPageAnswer(db, club)')
    for (const file of [ENDPOINT, ROUTE, HTML]) expect(codeOf(file), file).not.toMatch(/FROM tournaments|FROM club_places|FROM club_news|fetch\(/)
    // The order is written once: a current slug, then an old slug, then an id.
    const order = ['FROM clubs WHERE slug = ?', 'FROM club_slug_history WHERE old_slug = ?', 'FROM clubs WHERE id = ?'].map((sql) => shared.indexOf(sql))
    for (const at of order) expect(at).toBeGreaterThan(-1)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    for (const file of [ENDPOINT, ROUTE, 'functions/api/clubs/[id].ts']) expect(codeOf(file), file).not.toContain('club_slug_history')
  })

  it('name no email, officer or roster, and read no cookie or sign-in', () => {
    for (const file of [SHARED, HTML, ROUTE]) {
      expect(codeOf(file), file).not.toMatch(/contact_email|club_officers|registrations r\.|CLUB_EMAIL_HIDDEN|mailto:/)
    }
    expect(codeOf(HTML)).not.toMatch(/registrations|members/)
    for (const file of [HTML, ROUTE]) expect(codeOf(file), file).not.toMatch(/[Cc]ookie|Authorization|requireClubRep|utils\/auth/)
  })

  it('read the constant inside the handler at each call, and add no handler file', () => {
    const route = codeOf(ROUTE)
    expect(route).toContain('  if (!CLUB_PAGES_ON) return todaysPreview(context)\n')
    expect(route.match(/CLUB_PAGES_ON/g)).toHaveLength(2)
    expect(route.match(/export const onRequest\w+/g)).toEqual(['export const onRequestGet'])
    for (const file of [SHARED, HTML, 'domain/clubs/pageWords.ts']) expect(codeOf(file), file).not.toMatch(/onRequest/)
    // The route keeps today's code for the switch-off, line for line.
    expect(route).toContain('`SELECT name, city, meeting_schedule, location, description, image_url FROM clubs WHERE id = ?`')
    expect(codeOf('functions/api/clubs/[id].ts').replace(/^import \{ CLUB_PAGES_ON \} from .*$/m, '').replace('CLUB_PAGES_ON ? { results: [] } : ', '')).not.toMatch(/clubs\/pages|CLUB_PAGES_ON/) // WS09 step 37 reads it for the officers alone.
  })
})
