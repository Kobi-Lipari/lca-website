// test/integration/club-fixtures-page.test.ts
// The two fixture clubs of scripts/seed/fixtures.sql as the new club page
// reads them (WS09 step 24, the browser half). The browser tests' clubs build
// draws /clubs/<short address> for 'fx-club-capital' and 'fx-club-north'; the
// browser needs a server, so this file holds the same things in the Workers
// runtime, on a database built from the migrations with the seed loaded:
//
// - the seed loads a second time without error and writes the same rows (the
//   clubs, and the three places with their fixed ids)
// - each club's slug is what the slug rule makes of its name, is not a word
//   the club pages keep for themselves, and is held by no other club
// - what the fixtures say is made up and plain: addresses and links on
//   example.org, contact names "Player One" and "Player Two", times written
//   "7:00 PM", no dash of either length, "US Chess" never the old initials
// - with CLUB_PAGES_ON set: GET /api/clubs/<slug>/page answers 200 to a
//   signed-out request, in the shape of its contract, with each part the
//   fixture fills (About, how the club meets, the cost, who is welcome, the
//   two ticks, the places, the Facebook link on the one that has it, the
//   contact name, "Last checked October 2026") and no address of the club
//   anywhere in the body; GET /clubs/<slug> writes the page (one h1, the
//   club's name, a title, a canonical link to the short address) with no
//   address of the club; the club's id answers 301 to the short address; and
//   /sitemap.xml lists both short addresses
// - with it unset: the same read answers 404 in the one
//   body to a signed-out request and to a signed-in member, and never the
//   data, the route is today's shell with no redirect, and the sitemap is
//   passed on
// CLUB_PAGES_ON is set and unset through a getter on a mock of its module, as
// test/integration/club-page-route.test.ts does. Every club and person is made
// up.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { env } from 'cloudflare:test'
import SEED from '../../scripts/seed/fixtures.sql?raw'
import type { Env } from '../../functions/types'
import { expectContract, invoke, resetHarness } from './harness'
import { seedMember } from './factories'
import { splitSql } from '../shared/splitSql'

import { onRequestGet as pageGet, CLUB_PAGE_NOT_FOUND } from '../../functions/api/clubs/[id]/page'
import { onRequestGet as routeGet } from '../../functions/clubs/[id]'
import { onRequestGet as sitemapGet } from '../../functions/sitemap.xml'
import { clubPageResponseSchema } from '../../domain/contracts/clubPage'
import { RESERVED_SLUGS, slugFor } from '../../domain/clubs/slug'

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
beforeEach(resetHarness)
afterEach(() => {
  flags.pagesOn = false
  vi.restoreAllMocks()
})

const SHELL = Object.values(import.meta.glob('../../index.html', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)[0]
const SITE = 'https://www.louisianachess.org'

const CAPITAL = { id: 'fx-club-capital', name: 'Fixture Capital Chess Club', slug: 'fixture-capital-chess-club', contact: 'capital-club@example.org' }
const NORTH = { id: 'fx-club-north', name: 'Fixture North Chess Club', slug: 'fixture-north-chess-club', contact: 'north-club@example.org' }
const CLUBS = [CAPITAL, NORTH]

async function loadSeed(): Promise<void> {
  for (const statement of splitSql(SEED)) await env.DB.prepare(statement).run()
}

async function fixtureRows(): Promise<{ clubs: unknown[]; places: unknown[] }> {
  const clubs = (await env.DB.prepare(`SELECT * FROM clubs WHERE id LIKE 'fx-%' ORDER BY id`).all()).results
  const places = (await env.DB.prepare(`SELECT * FROM club_places WHERE club_id LIKE 'fx-%' ORDER BY id`).all()).results
  return { clubs, places }
}

/** The route's context for /clubs/<part>, with the shell as the next answer. */
function routeContext(part: string) {
  return {
    request: new Request(`${SITE}/clubs/${part}`),
    env: env as unknown as Env,
    params: { id: part },
    data: {},
    functionPath: `/clubs/${part}`,
    waitUntil: () => {},
    passThroughOnException: () => {},
    next: async () => new Response(SHELL, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }),
  } as unknown as EventContext<Env, string, Record<string, unknown>>
}

function sitemapContext() {
  return {
    request: new Request(`${SITE}/sitemap.xml`),
    env: env as unknown as Env,
    params: {},
    data: {},
    functionPath: '/sitemap.xml',
    waitUntil: () => {},
    passThroughOnException: () => {},
    next: async () => new Response(SHELL, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }),
  } as unknown as EventContext<Env, string, Record<string, unknown>>
}

const h1s = (html: string) => [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => m[1])

describe('the fixture clubs\' listing lines in scripts/seed/fixtures.sql', () => {
  it('load a second time without error and write the same rows', async () => {
    await loadSeed()
    const first = await fixtureRows()
    await loadSeed()
    const second = await fixtureRows()
    expect(second).toEqual(first)
    expect(first.clubs).toHaveLength(2)
    expect(first.places.map((p) => (p as { id: number }).id)).toEqual([90001, 90002, 90003])
  })

  it('give each club the slug the slug rule makes of its name, not reserved and held by no other club', async () => {
    await loadSeed()
    for (const club of CLUBS) {
      const row = await env.DB.prepare('SELECT slug, name FROM clubs WHERE id = ?').bind(club.id).first<{ slug: string; name: string }>()
      expect(row?.name).toBe(club.name)
      expect(row?.slug).toBe(slugFor(club.name))
      expect(row?.slug).toBe(club.slug)
      expect(RESERVED_SLUGS).not.toContain(row?.slug)
      const held = await env.DB.prepare(
        `SELECT COUNT(*) AS n FROM clubs WHERE id <> ? AND (slug = ? OR id = ?)`,
      ).bind(club.id, club.slug, club.slug).first<{ n: number }>()
      expect(held?.n).toBe(0)
    }
  })

  it('say only made-up things, plainly: example.org, Player One and Player Two, "7:00 PM", no dash, never the old initials', async () => {
    await loadSeed()
    const { clubs, places } = await fixtureRows()
    const rows = clubs as Record<string, string | number | null>[]
    expect(rows.map((r) => r.contact_name_public)).toEqual(['Player One', 'Player Two'])
    const words = JSON.stringify([...rows, ...places])
    expect(words).not.toMatch(/[\u2013\u2014]/)
    // US Chess's old initials, put together so that this file does not hold them.
    expect(words).not.toMatch(new RegExp(`\\b${'US' + 'CF'}\\b`))
    for (const url of words.match(/https?:\/\/[^"\\\s]+/g) ?? []) expect(url, url).toMatch(/^https:\/\/example\.org\//)
    for (const address of words.match(/[\w.+-]+@[\w.-]+/g) ?? []) expect(address, address).toMatch(/@example\.org$/)
    for (const row of rows) {
      expect(String(row.how_we_meet_text)).toMatch(/\d{1,2}:\d{2} [AP]M/)
      expect(String(row.how_we_meet_text)).not.toMatch(/\d:\d{2}(?! [AP]M)/)
    }
    // One club each way on the two ticks, a Facebook link on one, a website on the other.
    expect(rows.map((r) => [r.weekend_play, r.scholastic_friendly])).toEqual([[1, 0], [0, 1]])
    expect(rows.map((r) => [r.facebook_url !== null, r.website_url !== null])).toEqual([[true, false], [false, true]])
  })
})

describe('GET /api/clubs/[id]/page for the fixture clubs, with CLUB_PAGES_ON set', () => {
  beforeEach(async () => {
    flags.pagesOn = true
    await loadSeed()
  })

  it('answers 200 to a signed-out request in the shape of its contract, with what each fixture fills', async () => {
    const capital = await expectContract(await invoke(pageGet, { params: { id: CAPITAL.slug } }), clubPageResponseSchema)
    expect(capital.club).toMatchObject({ id: CAPITAL.id, slug: CAPITAL.slug, name: CAPITAL.name, city: 'Baton Rouge', region: 'Baton Rouge / East Central' })
    expect(capital.about.text).toMatch(/^A made-up club for tests\./)
    expect(capital.about).toMatchObject({
      cost: 'Free for a first visit, then $5 a night.',
      welcome: 'Players of every age and level.',
      weekend_play: true,
      scholastic_friendly: false,
      facebook: 'https://example.org/fixture-capital-chess-club-on-facebook',
      website: null,
    })
    expect(capital.statement.text).toBe('Tuesdays at 7:00 PM, and the first Saturday of the month at 10:00 AM.')
    expect(capital.statement.told).toBe('Last checked October 2026')
    expect(capital.places.map((p) => p.name)).toEqual(['Fixture Community Center', 'Fixture Branch Library'])
    expect(capital.places[0]).toMatchObject({ street: '100 Example St, Baton Rouge, LA', note: 'Use the side door by the parking lot.' })
    expect(capital.contact).toEqual({ name: 'Player One' })

    const north = await expectContract(await invoke(pageGet, { params: { id: NORTH.slug } }), clubPageResponseSchema)
    expect(north.club).toMatchObject({ id: NORTH.id, slug: NORTH.slug, name: NORTH.name, region: 'North Louisiana' })
    expect(north.about).toMatchObject({ weekend_play: false, scholastic_friendly: true, facebook: null, website: 'https://example.org/fixture-north-chess-club' })
    // Its meeting words end with a made-up address with no place to break, which the browser tests' reflow check meets at 320 pixels.
    expect(north.statement.text).toBe('Fridays at 6:30 PM. Lessons for new players on Saturdays at 10:00 AM. Changes are posted at https://example.org/fixturenorthchessclubmeetingchangesandclosures.')
    expect(north.places.map((p) => p.name)).toEqual(['Fixture Library'])
    expect(north.contact).toEqual({ name: 'Player Two' })
  })

  it('lists the places in the order the seed wrote them, a place added later after them, and two at most', async () => {
    await env.DB.prepare(`INSERT INTO club_places (club_id, name, sort) VALUES ('fx-club-north', 'Example Stray Hall', 5)`).run()
    await env.DB.prepare(`INSERT INTO club_places (club_id, name, sort) VALUES ('fx-club-capital', 'Example Third Hall', 9)`).run()
    const capital = await expectContract(await invoke(pageGet, { params: { id: CAPITAL.slug } }), clubPageResponseSchema)
    expect(capital.places).toHaveLength(2)
    const north = await expectContract(await invoke(pageGet, { params: { id: NORTH.slug } }), clubPageResponseSchema)
    expect(north.places.map((p) => p.name)).toEqual(['Fixture Library', 'Example Stray Hall'])
  })

  it('carries no address of either club anywhere in its answer, and no sign of one', async () => {
    for (const club of CLUBS) {
      const res = await invoke(pageGet, { params: { id: club.slug } })
      expect(res.status).toBe(200)
      const body = await res.response.clone().text()
      expect(body).not.toContain(club.contact)
      expect(body).not.toContain('@')
      expect(body).not.toMatch(/mailto:/i)
      const other = CLUBS.find((c) => c !== club)!
      expect(body).not.toContain(other.contact)
    }
  })

  it('writes the page for the short address: one h1 with the club\'s name, a title, a canonical link, no address of the club', async () => {
    for (const club of CLUBS) {
      const res = await routeGet(routeContext(club.slug))
      expect(res.status).toBe(200)
      const html = await res.text()
      expect(h1s(html)).toEqual([club.name])
      expect(html).toMatch(/<title>[^<]*Fixture[^<]*<\/title>/)
      expect(html).toContain(`<link rel="canonical" href="${SITE}/clubs/${club.slug}"`)
      expect(html).not.toContain(club.contact)
      expect(html).not.toMatch(/mailto:/i)
    }
  })

  it('answers 301 to the short address for the club\'s id, and serves the target', async () => {
    for (const club of CLUBS) {
      const res = await routeGet(routeContext(club.id))
      expect(res.status).toBe(301)
      expect(res.headers.get('Location')).toBe(`/clubs/${club.slug}`)
      expect((await routeGet(routeContext(club.slug))).status).toBe(200)
    }
  })

  it('lists both short addresses in the sitemap, with the day the listing was last told', async () => {
    const res = await sitemapGet(sitemapContext())
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toMatch(/^application\/xml/)
    const xml = await res.text()
    for (const club of CLUBS) {
      const entry = xml.split('<url>').find((part) => part.includes(`<loc>${SITE}/clubs/${club.slug}</loc>`))
      expect(entry, club.slug).toBeDefined()
      expect(entry).toMatch(/<lastmod>2026-10-06/)
      expect(xml).not.toContain(`/clubs/${club.id}<`)
    }
  })

  it('answers the one 404 body for a short address no club holds', async () => {
    const res = await invoke(pageGet, { params: { id: 'fixture-no-such-chess-club' } })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: CLUB_PAGE_NOT_FOUND })
  })
})

describe('the fixture clubs with CLUB_PAGES_ON unset', () => {
  beforeEach(loadSeed)

  it('answers 404 to a signed-out request and to a signed-in member, and never the club\'s data', async () => {
    const member = await seedMember({ email: 'player.three@example.org' })
    for (const as of [undefined, member]) {
      for (const club of CLUBS) {
        const res = await invoke(pageGet, { params: { id: club.slug }, ...(as ? { as } : {}) })
        expect(res.status).toBe(404)
        const body = await res.response.clone().text()
        expect(JSON.parse(body)).toEqual({ error: CLUB_PAGE_NOT_FOUND })
        expect(body).not.toContain(club.name)
        expect(body).not.toContain(club.contact)
      }
    }
  })

  it('leaves the route as today\'s shell, with no redirect, and passes the sitemap on', async () => {
    for (const club of CLUBS) {
      const byId = await routeGet(routeContext(club.id))
      expect(byId.status).not.toBe(301)
      expect(byId.headers.get('Location')).toBeNull()
      expect(h1s(await (await routeGet(routeContext(club.slug))).text())).toEqual([])
    }
    const res = await sitemapGet(sitemapContext())
    expect(res.status).toBe(200)
    expect(await res.text()).toBe(SHELL)
  })
})
