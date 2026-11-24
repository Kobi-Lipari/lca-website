// test/integration/club-page-review-fixes.test.ts
// GET /clubs/[id] after checkpoint W's review, through the route against the
// real database, one fix at a time:
//
// - the word Facebook is written on a link only when it goes to Facebook's
//   own site; another site in the Facebook field is written by its site, the
//   link is still there, and the structured data and the public answer keep
//   the address as the club saved it
// - the three sections carry the ids the drawn page gives them
// - how the club meets keeps its single line breaks as <br> in the cover's
//   line and in When and where, a blank line starts a paragraph, a club's
//   words are escaped line by line, and the title, the description, the
//   share card, the structured data and the sitemap hold the words on one line
// - every reader gets the same bytes, and the route sets no header of its own
//
// CLUB_PAGES_ON is set and unset through a getter on a mock of its module, as
// club-page-route.test.ts does; no case reads how it ships. Every club,
// person and place here is made up.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { env } from 'cloudflare:test'
import type { Env } from '../../functions/types'
import { accessToken } from './harness'
import { seedAdmin, seedClub, seedMember, seedTournament } from './factories'

import { onRequestGet as routeGet } from '../../functions/clubs/[id]'
import { onRequestGet as pageGet } from '../../functions/api/clubs/[id]/page'
import { onRequestGet as sitemapGet } from '../../functions/sitemap.xml'
import { PAGE_SECTION_IDS } from '../../domain/clubs/pageWords'

const flags = vi.hoisted(() => ({ pagesOn: false }))
vi.mock('../../functions/utils/clubs/pages', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/clubs/pages')>()
  return {
    ...real,
    get CLUB_PAGES_ON() {
      return flags.pagesOn
    },
  }
})
afterEach(() => {
  flags.pagesOn = false
  vi.restoreAllMocks()
})

const SHELL = Object.values(import.meta.glob('../../index.html', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)[0]
const SITE = 'https://www.louisianachess.org'

let made = 0
const mark = () => `${++made}${crypto.randomUUID().slice(0, 6)}`

function contextFor(url: string, params: Record<string, string>, headers: Record<string, string> = {}) {
  return {
    request: new Request(url, { headers }),
    env: env as unknown as Env,
    params,
    data: {},
    functionPath: new URL(url).pathname,
    waitUntil: () => {},
    passThroughOnException: () => {},
    next: async () => new Response(SHELL, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }),
  } as unknown as EventContext<Env, string, Record<string, unknown>>
}

const pageOf = async (part: string, headers: Record<string, string> = {}) => {
  const res = await routeGet(contextFor(`${SITE}/clubs/${part}`, { id: part }, headers))
  expect(res.status, part).toBe(200)
  return { text: await res.text(), headers: Object.fromEntries([...res.headers.entries()].sort()) }
}

interface ClubWords {
  name?: string
  meet?: string | null
  about?: string | null
  facebook?: string | null
  website?: string | null
}

/** A made-up club with a slug, the words given, one place and one listed event. */
async function makeClub(words: ClubWords = {}) {
  const m = mark()
  const id = await seedClub({ id: `example-club-id-${m}`, name: words.name ?? `Example Chess Club ${m}`, city: 'Example City' })
  const slug = `example-chess-club-${m}`
  await env.DB.prepare(
    `UPDATE clubs SET slug = ?, how_we_meet_text = ?, about_text = ?, facebook_url = ?, website_url = ? WHERE id = ?`,
  ).bind(slug, words.meet ?? 'Tuesdays at 7:00 PM', words.about ?? 'A made up club.', words.facebook ?? null, words.website ?? null, id).run()
  await env.DB.prepare(`INSERT INTO club_places (club_id, name, street, note, sort) VALUES (?, 'Example Library', '1 Example Street', NULL, 0)`).bind(id).run()
  return { id, slug }
}

const between = (text: string, from: string, to: string) => {
  const start = text.indexOf(from)
  if (start < 0) return ''
  const end = text.indexOf(to, start + from.length)
  return end < 0 ? '' : text.slice(start + from.length, end)
}
const rootOf = (html: string) => between(html, '<div id="root">', '</div>\n')
const headOf = (html: string) => between(html, '<head>', '</head>')
const jsonLdOf = (html: string) => JSON.parse(between(html, '<script type="application/ld+json">', '</script>')) as Record<string, unknown>
const linksOnline = (html: string) => between(rootOf(html), '<h3>Find us online</h3>', '</ul>')

describe('GET /clubs/[id]: the word Facebook only on a link to Facebook', () => {
  it('writes Facebook for Facebook\'s own hosts, and the site\'s name for any other host, keeping the link', async () => {
    flags.pagesOn = true
    const cases: Array<[string, string]> = [
      ['https://www.facebook.com/example-chess-club', 'Facebook'],
      ['https://m.facebook.com/example-chess-club', 'Facebook'],
      ['https://fb.me/example-chess-club', 'Facebook'],
      ['https://facebook.com.example.net/example-chess-club', 'facebook.com.example.net'],
      ['https://example.net/facebook.com/example-chess-club', 'example.net'],
      ['https://www.example.org/example-chess-club', 'example.org'],
    ]
    for (const [url, words] of cases) {
      const club = await makeClub({ facebook: url })
      const html = (await pageOf(club.slug)).text
      expect(linksOnline(html), url).toBe(`<ul><li><a href="${url}" rel="noopener noreferrer">${words}</a></li>`)
      // The structured data keeps the address as the club saved it.
      expect(jsonLdOf(html).sameAs, url).toEqual([url])
      if (words !== 'Facebook') expect(rootOf(html), url).not.toContain('Facebook')
    }
  })

  it('draws no link and no word for an address with a name before its host, and keeps the public answer as saved', async () => {
    flags.pagesOn = true
    const url = 'https://facebook.com@example.net/example-chess-club'
    const club = await makeClub({ facebook: url })
    const html = (await pageOf(club.slug)).text
    expect(rootOf(html)).not.toContain('Facebook')
    expect(rootOf(html)).not.toContain('Find us online')
    const answer = await pageGet(contextFor(`${SITE}/api/clubs/${club.slug}/page`, { id: club.slug }))
    expect(answer.status).toBe(200)
    // A save accepts what it did before: the answer still carries the address, whoever reads it.
    expect(((await answer.json()) as { about: { facebook: string | null } }).about.facebook).toBe(url)
  })

  it('writes the same list of links for the same club to every reader', async () => {
    flags.pagesOn = true
    const club = await makeClub({ facebook: 'https://example.net/example-chess-club', website: 'https://www.example.org/chess' })
    const anonymous = await pageOf(club.slug)
    const member = await seedMember()
    const admin = await seedAdmin()
    for (const who of [member, admin]) {
      const signedIn = await pageOf(club.slug, { Authorization: `Bearer ${accessToken(who)}` })
      expect(signedIn.text).toBe(anonymous.text)
      expect(signedIn.headers).toEqual(anonymous.headers)
    }
    expect(linksOnline(anonymous.text)).toContain('>example.net</a>')
    expect(linksOnline(anonymous.text)).toContain('>Website: example.org</a>')
  })
})

describe('GET /clubs/[id]: the sections\' ids', () => {
  it('carries the drawn page\'s three ids on the three sections, each once', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    await seedTournament({ clubId: club.id, name: 'Example Winter Open', date: '2026-12-12' })
    const html = (await pageOf(club.slug)).text
    const body = rootOf(html)
    for (const id of [PAGE_SECTION_IDS.about, PAGE_SECTION_IDS.when_and_where, PAGE_SECTION_IDS.events]) {
      expect(body.split(`<section id="${id}">`).length - 1, id).toBe(1)
    }
    expect(PAGE_SECTION_IDS).toEqual({ about: 'about', when_and_where: 'when-and-where', events: 'events' })
    // Every id on the page belongs to one of the three, and no other element has one.
    const ids = [...body.matchAll(/\sid="([^"]*)"/g)].map((m) => m[1])
    for (const id of ids) expect(Object.values(PAGE_SECTION_IDS), id).toContain(id)
    expect(body).not.toMatch(/<(?!section)[a-z0-9]+[^>]*\sid=/)
  })
})

describe('GET /clubs/[id]: how the club meets', () => {
  const MEET = 'Fridays at 6:30 PM\nBring a board <if you can>\n\nNo meeting on holidays & storm days'

  it('writes a single line break as <br> between the escaped lines, and a blank line as a new paragraph', async () => {
    flags.pagesOn = true
    const club = await makeClub({ meet: MEET })
    const body = rootOf((await pageOf(club.slug)).text)
    expect(body).toContain('<p>Fridays at 6:30 PM<br>Bring a board &lt;if you can&gt;</p><p>No meeting on holidays &amp; storm days</p>')
    expect(body).not.toContain('<if you can>')
  })

  it('holds the words on one line in the title, the description, the share card, the structured data and the sitemap', async () => {
    flags.pagesOn = true
    const club = await makeClub({ meet: MEET, about: null })
    const html = (await pageOf(club.slug)).text
    const head = headOf(html)
    const lines = (text: string) => text.split(new RegExp('\\r?\\n|\\u2028|\\u2029'))
    expect(lines(between(head, '<title>', '</title>'))).toHaveLength(1)
    for (const tag of ['name="description"', 'property="og:description"', 'name="twitter:description"', 'property="og:title"', 'name="twitter:title"']) {
      const content = new RegExp(`${tag}\\s+content="([^"]*)"`).exec(head)?.[1] ?? ''
      expect(content.length, tag).toBeGreaterThan(0)
      expect(lines(content), tag).toHaveLength(1)
      expect(content, tag).not.toContain('<br>')
    }
    const ld = jsonLdOf(html)
    expect(lines(String(ld.description))).toHaveLength(1)
    expect(String(ld.description)).not.toContain('<br>')

    const sitemap = await sitemapGet(contextFor(`${SITE}/sitemap.xml`, {}))
    expect(sitemap.status).toBe(200)
    const xml = await sitemap.text()
    expect(xml).toContain(`${SITE}/clubs/${club.slug}`)
    expect(xml).not.toContain('Bring a board')
    expect(xml).not.toContain('<br')
  })

  it('writes one line, with no break element, for words that have no line break', async () => {
    flags.pagesOn = true
    const club = await makeClub({ meet: 'Tuesdays at 7:00 PM' })
    const body = rootOf((await pageOf(club.slug)).text)
    expect(body).toContain('<p>Tuesdays at 7:00 PM</p>')
    expect(body).not.toContain('<br')
  })

  it('answers today\'s preview, with no sections and no break element, while CLUB_PAGES_ON is unset', async () => {
    flags.pagesOn = false
    const club = await makeClub({ meet: MEET, facebook: 'https://example.net/example-chess-club' })
    const res = await routeGet(contextFor(`${SITE}/clubs/${club.id}`, { id: club.id }))
    const text = await res.text()
    expect(text).not.toContain('<section')
    expect(text).not.toContain('<br>')
    expect(text).not.toContain('data-club-written-page')
  })
})
