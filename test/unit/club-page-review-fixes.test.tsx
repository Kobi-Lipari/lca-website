// @vitest-environment jsdom
//
// The new club page after checkpoint W's review, one fix at a time, on the
// page the site draws and the page the server writes before any script:
//
// - the word Facebook goes on a link only when the link goes to Facebook's
//   own site, read from the parsed address (domain/clubs/facebook.ts); any
//   other site in the Facebook field is named by its site, on both pages,
//   and the link is still drawn; the structured data keeps the address
// - the club's words that sit in a row (the cover's meeting words, a
//   section heading's words) and the boxes of About can shrink, and a long
//   run with no space in it breaks anywhere, as can an event's name and a
//   nearby club's name, so the page never widens
// - the written page's three sections carry the same ids as the drawn page's
// - how the club meets keeps its line breaks on the cover, and the written
//   page writes a single line break as <br>, while the title, the
//   description, the share card, the structured data and the sitemap stay
//   on one line
//
// Every club, place and address here is made up.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { cleanup, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'

import { SECTION_IDS } from '@/areas/clubs/clubPage'
import { ClubAbout, SectionHeading } from '@/areas/clubs/components/ClubAbout'
import { ClubCover } from '@/areas/clubs/components/ClubCover'
import { ClubEvents } from '@/areas/clubs/components/ClubEvents'
import { NearbyClubs } from '@/areas/clubs/components/NearbyClubs'
import { isFacebookAddress } from '../../domain/clubs/facebook'
import { PAGE_SECTION_IDS } from '../../domain/clubs/pageWords'
import type { ClubPageResponse } from '../../domain/contracts/clubPage'
import { clip } from '../../functions/utils/events/linkPreview'
import { clubJsonLd, clubLinks, clubPageBody, pageDescription, pageTitle } from '../../functions/utils/clubs/pageHtml'

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
/** A file's code with its comments taken out. */
const codeOf = (file: string) => read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
/** An element's classes, one by one. */
const classesOf = (el: Element | null) => (el?.getAttribute('class') ?? '').split(/\s+/)

afterEach(() => cleanup())

function answer(): ClubPageResponse {
  return {
    club: { id: 'example-chess-club', slug: 'example-chess-club', name: 'Example Chess Club', city: 'Example City', region: null, color: '#1a2744', logo: null },
    sections: ['about', 'when_and_where', 'events', 'contact'],
    about: { text: 'A made up club.', cost: null, welcome: null, facebook: null, website: null, other: null, weekend_play: false, scholastic_friendly: false },
    statement: { text: 'Tuesdays at 7:00 PM', told: 'Last checked November 2026' },
    places: [{ name: 'Example Library', street: null, note: null, latitude: null, longitude: null }],
    contact: { name: 'Player One' },
    events: [{ id: 'example-open', name: 'Example Open', date: '2026-12-12', end_date: null, status: 'upcoming', registration_status: 'open', max_players: null, registered_count: 0 }],
    news: [],
    nearest: [],
  }
}

/** The drawn About's links, each as its address, its words and the name a screen reader hears. */
function drawnLinks(about: ClubPageResponse['about']) {
  const { container } = render(<ClubAbout name="Example Chess Club" about={about} />)
  const links = [...container.querySelectorAll('a')].map((a) => [a.getAttribute('href'), a.textContent?.trim(), a.getAttribute('aria-label')])
  const words = container.textContent ?? ''
  cleanup()
  return { links, words }
}

describe('the word Facebook, only on a link to Facebook\'s own site', () => {
  it('reads the host of the parsed address: Facebook\'s own hosts and the hosts under them, and nothing that only holds the word', () => {
    for (const url of [
      'https://www.facebook.com/example-chess-club', 'https://facebook.com/example-chess-club', 'HTTPS://M.FACEBOOK.COM/example-chess-club',
      'https://web.facebook.com/groups/example', 'https://fb.com/example-chess-club', 'https://www.fb.com/example', 'https://fb.me/example',
      'http://facebook.com/example',
    ]) expect(isFacebookAddress(url), url).toBe(true)
    for (const url of [
      'https://facebook.com.example.net/', 'https://example.net/facebook.com', 'https://facebook.com@example.net/', 'https://notfacebook.com/example',
      'https://example.net/?next=https://www.facebook.com/', 'https://fb.me.example.net/', 'https://example.fb.me/', 'https://facebook.example.net/',
      'facebook.com/example-chess-club', 'ftp://facebook.com/example', 'https://', '', '   ', null, undefined,
    ]) expect(isFacebookAddress(url), String(url)).toBe(false)
  })

  it('labels the link on both pages: Facebook for Facebook, the site for a look-alike host and for a plain other host', () => {
    const cases: Array<[string, string]> = [
      ['https://www.facebook.com/example-chess-club', 'Facebook'],
      ['https://facebook.com.example.net/example-chess-club', 'facebook.com.example.net'],
      ['https://example.net/example-chess-club', 'example.net'],
      ['https://www.example.org/facebook.com/example-chess-club', 'example.org'],
    ]
    for (const [url, words] of cases) {
      const about = { ...answer().about, facebook: url }
      expect(clubLinks(about), url).toEqual([{ href: url, words }])
      expect(drawnLinks(about).links, url).toEqual([[url, words, `${words} (opens in a new tab)`]])
      const body = clubPageBody({ ...answer(), about })
      expect(body, url).toContain(`<li><a href="${url}" rel="noopener noreferrer">${words}</a></li>`)
      if (words !== 'Facebook') expect(body, url).not.toContain('>Facebook<')
    }
  })

  it('draws no link and no word Facebook for an address with a name before its host, on either page', () => {
    const url = 'https://facebook.com@example.net/example-chess-club'
    const about = { ...answer().about, text: 'A made up club.', facebook: url }
    expect(clubLinks(about)).toEqual([])
    const drawn = drawnLinks(about)
    expect(drawn.links).toEqual([])
    expect(drawn.words).not.toContain('Facebook')
    expect(clubPageBody({ ...answer(), about })).not.toContain('Facebook')
  })

  it('keeps the structured data\'s list of the club\'s own pages as the addresses are', () => {
    const url = 'https://facebook.com.example.net/example-chess-club'
    const block = clubJsonLd({ ...answer(), about: { ...answer().about, facebook: url } }, 'https://www.example.org')
    const data = JSON.parse(block.replace(/^<script type="application\/ld\+json">/, '').replace(/<\/script>$/, ''))
    expect(data.sameAs).toEqual([url])
  })

  it('is one rule: both pages ask the shared helper, and neither puts the word on a link by itself', () => {
    const about = codeOf('src/areas/clubs/components/ClubAbout.tsx')
    const html = codeOf('functions/utils/clubs/pageHtml.ts')
    expect(about).toContain('import { isFacebookAddress } from \'@domain/clubs/facebook\'')
    expect(html).toContain('import { isFacebookAddress } from \'../../../domain/clubs/facebook\'')
    for (const code of [about, html]) {
      expect(code).toContain('words: isFacebookAddress(facebook) ? \'Facebook\' : siteOf(facebook)')
      expect(code).not.toMatch(/words: 'Facebook' \}/)
    }
    // The helper is plain code with nothing of the site or the server in it.
    expect(codeOf('domain/clubs/facebook.ts')).not.toMatch(/\bimport\b/)
  })
})

describe('a long run with no space in it never widens the page', () => {
  it('the cover\'s meeting words can shrink below their longest run, break anywhere, and keep the club\'s line breaks', () => {
    const statement = 'Fridays at 6:30 PM.\nChanges are posted at https://example.org/examplechessclubmeetingchangesandclosures.'
    for (const compact of [false, true]) {
      const { container } = render(<ClubCover club={answer().club} statement={statement} compact={compact} />)
      const words = [...container.querySelectorAll('span')].find((span) => span.textContent === statement)
      expect(words, 'the meeting words, line break and all').toBeDefined()
      expect(classesOf(words!)).toEqual(expect.arrayContaining(['min-w-0', '[overflow-wrap:anywhere]', 'whitespace-pre-line']))
      expect(classesOf(words!.parentElement)).toEqual(expect.arrayContaining(['flex']))
      cleanup()
    }
  })

  it('a section heading\'s words sit in a span that can shrink and break anywhere, beside the bar', () => {
    for (const compact of [false, true]) {
      const { container } = render(<SectionHeading compact={compact}>About Example Chess Club</SectionHeading>)
      const heading = container.querySelector(compact ? 'p' : 'h2')!
      expect(heading.textContent).toBe('About Example Chess Club')
      const [bar, words] = [...heading.children]
      expect(bar.getAttribute('aria-hidden')).toBe('true')
      expect(words.textContent).toBe('About Example Chess Club')
      expect(classesOf(words)).toEqual(expect.arrayContaining(['min-w-0', '[overflow-wrap:anywhere]']))
      cleanup()
    }
  })

  it('About\'s words, its column of boxes and each box can shrink below a long run in them', () => {
    const run = `Example${'x'.repeat(90)}`
    const about = { ...answer().about, text: `First words. ${run}.\n\nMore words.`, cost: run, welcome: run }
    const { container } = render(<ClubAbout name="Example Chess Club" about={about} />)
    const boxes = [...container.querySelectorAll('h3')].map((h3) => h3.parentElement!)
    expect(boxes.map((box) => box.querySelector('h3')!.textContent)).toEqual(['Cost', 'Who is welcome'])
    for (const box of boxes) expect(classesOf(box)).toContain('min-w-0')
    expect(classesOf(boxes[0].parentElement)).toContain('min-w-0')
    const words = [...container.querySelectorAll('p')].find((p) => p.textContent === `First words. ${run}.`)!.parentElement
    expect(classesOf(words)).toEqual(expect.arrayContaining(['min-w-0', 'break-words']))
  })

  it('an event\'s name and a nearby club\'s name break anywhere inside their links', () => {
    const run = `Example${'x'.repeat(90)}`
    const { container } = render(
      <MemoryRouter>
        <ClubEvents id="events" events={[{ ...answer().events[0], name: run }]} />
        <NearbyClubs city="Example City" nearest={[{ name: run, city: 'Example Town', slug: 'example-town-chess-club', statement: null, distance: 'about 12 mi' }]} />
      </MemoryRouter>,
    )
    const named = [...container.querySelectorAll('a')].filter((a) => a.textContent === run)
    expect(named).toHaveLength(2)
    for (const link of named) expect(classesOf(link)).toContain('[overflow-wrap:anywhere]')
  })
})

describe('the written page\'s sections carry the drawn page\'s ids', () => {
  it('both sides read the same three ids, and the drawn page keeps its fourth for News', () => {
    expect(PAGE_SECTION_IDS).toEqual({ about: 'about', when_and_where: 'when-and-where', events: 'events' })
    expect(SECTION_IDS).toEqual({ ...PAGE_SECTION_IDS, news: 'news', contact: 'contact' })
    const body = clubPageBody(answer())
    expect(body).toContain(`<section id="${SECTION_IDS.about}"><h2>About Example Chess Club</h2>`)
    expect(body).toContain(`<section id="${SECTION_IDS.when_and_where}"><h2>When and where Example Chess Club meets</h2>`)
    expect(body).toContain(`<section id="${SECTION_IDS.events}"><h2>Events</h2>`)
    // Since checkpoint X took checkpoint W in, the written page also writes Contact, as WS09 step 26 built it: with no id.
    expect(body).toContain('<section><h2>Contact</h2>')
    expect(body.match(/<section[^>]*>/g)).toEqual(['<section id="about">', '<section id="when-and-where">', '<section id="events">', '<section>'])
  })
})

describe('how the club meets keeps its line breaks, and the one-line forms stay one line', () => {
  const TWO_LINES = 'Tuesdays at 7:00 PM, Example Library\nSaturdays at 10:00 AM, Example Hall'

  it('the written page writes a single line break as <br> between the escaped lines, and a blank line still starts a new paragraph', () => {
    expect(clubPageBody({ ...answer(), statement: { text: TWO_LINES, told: '' } }))
      .toContain('<p>Chess club in Example City, Louisiana</p><p>Tuesdays at 7:00 PM, Example Library<br>Saturdays at 10:00 AM, Example Hall</p>')
    expect(clubPageBody({ ...answer(), statement: { text: 'Tuesdays at 7:00 PM\r\n  Example Library\n\nSaturdays <b>&</b>\nExample Hall', told: '' } }))
      .toContain('<p>Tuesdays at 7:00 PM<br>Example Library</p><p>Saturdays &lt;b&gt;&amp;&lt;/b&gt;<br>Example Hall</p>')
  })

  it('the cover draws the two lines as the club wrote them', () => {
    const { container } = render(<ClubCover club={answer().club} statement={TWO_LINES} />)
    const words = [...container.querySelectorAll('span')].find((span) => span.textContent === TWO_LINES)
    expect(classesOf(words!)).toContain('whitespace-pre-line')
  })

  it('the title, the description, the share card and the structured data hold no line break, and the sitemap writes no meeting words', () => {
    const two = { ...answer(), club: { ...answer().club, name: 'Example\nChess Club', city: 'Example\nCity' }, about: { ...answer().about, text: 'A made up\nclub.' }, statement: { text: TWO_LINES, told: '' } }
    expect(pageTitle(two)).toBe('Example Chess Club · Chess club in Example City, Louisiana · Louisiana Chess Association')
    const description = pageDescription(two)
    expect(description).not.toMatch(/[\r\n]/)
    expect(description).toContain('Tuesdays at 7:00 PM, Example Library Saturdays at 10:00 AM, Example Hall')
    expect(clip(two.club.name, 90)).toBe('Example Chess Club')
    expect(clip(description, 200)).not.toMatch(/[\r\n]/)
    // The structured data carries the meeting words only inside its description, on one line.
    const meets = { ...answer(), statement: { text: TWO_LINES, told: '' } }
    const data = JSON.parse(clubJsonLd(meets, 'https://www.example.org').replace(/^<script type="application\/ld\+json">/, '').replace(/<\/script>$/, ''))
    expect(data.description).toBe(pageDescription(meets))
    expect(JSON.stringify(data)).not.toMatch(/\\n|\\r/)
    expect(codeOf('functions/sitemap.xml.ts')).not.toMatch(/how_we_meet_text|statement/)
  })
})
