// test/integration/sitemap-edges.test.ts
// The edges of GET /sitemap.xml (WS09 step 24), beside test/integration/sitemap.test.ts:
// clubs whose stored slug or id is not in the form the club route finds them
// by, measured against the club route itself; events whose id holds a character
// an address reads in its own way; the site's host as configured, as unset and
// as a trailing slash writes it, each against the canonical link the club route
// writes under the same setting; ties and repeated asks; the stored time of a
// last change across a daylight saving change and a midnight in America/Chicago;
// events past, multi-day and with no end date; a failure in the club finder's
// own lookups; and a request whose headers cannot be read. CLUB_PAGES_ON is set
// through a getter on a mock of its module, as sitemap.test.ts does; no case
// reads how it ships. Every club, event and person here is made up.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { env } from 'cloudflare:test'
import type { Env } from '../../functions/types'
import { seedClub, seedTournament } from './factories'

import { onRequestGet as sitemapGet } from '../../functions/sitemap.xml'
import { onRequestGet as routeGet } from '../../functions/clubs/[id]'
import { RESERVED_SLUGS } from '../../domain/clubs/slug'

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

/** The site's own shell, index.html, as the build serves it: the page the club route writes its canonical link into. */
const SHELL = Object.values(import.meta.glob('../../index.html', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)[0]
const SITE = 'https://www.louisianachess.org'
const NAMESPACE = 'http://www.sitemaps.org/schemas/sitemap/0.9'
const UNAVAILABLE = 'The sitemap cannot be read just now. Please try again in a few minutes.'

let made = 0
const mark = () => `${++made}${crypto.randomUUID().slice(0, 6)}`

interface Asked {
  url?: string
  db?: D1Database
  siteUrl?: string
}

function contextFor({ url = `${SITE}/sitemap.xml`, db, siteUrl }: Asked = {}) {
  return {
    request: new Request(url),
    env: { ...(env as unknown as Env), ...(db ? { DB: db } : {}), ...(siteUrl === undefined ? {} : { SITE_URL: siteUrl }) },
    params: {},
    data: {},
    functionPath: '/sitemap.xml',
    waitUntil: () => {},
    passThroughOnException: () => {},
    next: async () => new Response(SHELL, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }),
  } as unknown as EventContext<Env, string, Record<string, unknown>>
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
function textOf(raw: string): string {
  if (/[<>]/.test(raw)) throw new Error(`a markup character in a value: ${raw}`)
  return raw.replace(/&([^;]*);?/g, (whole, name: string) => {
    if (!whole.endsWith(';') || !(name in ENTITIES)) throw new Error(`a reference XML does not name: ${whole}`)
    return ENTITIES[name]
  })
}

interface Url {
  loc: string
  lastmod: string | null
}

/** The document read by its grammar, failing on anything outside it. */
function readSitemap(xml: string): Url[] {
  const head = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="${NAMESPACE}">\n`
  if (!xml.startsWith(head) || !xml.endsWith('</urlset>\n')) throw new Error(`not the protocol's document: ${xml.slice(0, 120)}`)
  let rest = xml.slice(head.length, xml.length - '</urlset>\n'.length)
  const urls: Url[] = []
  const element = /^ {2}<url>\n {4}<loc>([^<]*)<\/loc>\n(?: {4}<lastmod>([^<]*)<\/lastmod>\n)? {2}<\/url>\n/
  while (rest !== '') {
    const found = element.exec(rest)
    if (!found) throw new Error(`not a url element: ${rest.slice(0, 120)}`)
    urls.push({ loc: textOf(found[1]), lastmod: found[2] === undefined ? null : textOf(found[2]) })
    rest = rest.slice(found[0].length)
  }
  return urls
}

/**
 * The real database with every statement whose text holds `refuse` failing as
 * the database fails: its answer rejects on a later turn, once the caller has
 * the promise in hand, and nothing else of it is changed.
 */
function failingDb(refuse: string): D1Database {
  const wrap = (statement: D1PreparedStatement, sql: string): D1PreparedStatement => {
    const answer = <T>(work: () => Promise<T>): Promise<T> =>
      sql.includes(refuse)
        ? new Promise<T>((_resolve, reject) => setTimeout(() => reject(new Error(`D1_ERROR: no such table: ${refuse}: SQLITE_ERROR`)), 0))
        : work()
    return {
      bind: (...values: unknown[]) => wrap(statement.bind(...values), sql),
      first: (column?: string) => answer(() => (column === undefined ? statement.first() : statement.first(column))),
      run: () => answer(() => statement.run()),
      all: () => answer(() => statement.all()),
      raw: (options?: { columnNames?: boolean }) => answer(() => statement.raw(options as { columnNames: true })),
    } as unknown as D1PreparedStatement
  }
  return { prepare: (sql: string) => wrap(env.DB.prepare(sql), sql) } as unknown as D1Database
}

/** The sitemap as asked, with the constant set, as its status and its text. */
async function asked(opts: Asked = {}) {
  flags.pagesOn = true
  const res = await sitemapGet(contextFor(opts))
  return { res, text: await res.text() }
}
async function urlsFor(opts: Asked = {}) {
  const { res, text } = await asked(opts)
  expect(res.status, text.slice(0, 120)).toBe(200)
  return readSitemap(text)
}

async function makeClub(opts: { id?: string; slug?: string | null; told?: string | null } = {}) {
  const m = mark()
  const id = await seedClub({ id: opts.id ?? `example-club-id-${m}`, name: `Example Chess Club ${m}`, city: 'Example City' })
  const slug = opts.slug === undefined ? `example-chess-club-${m}` : opts.slug
  await env.DB.prepare('UPDATE clubs SET slug = ?, told_updated_at = ? WHERE id = ?').bind(slug, opts.told ?? null, id).run()
  return { id, slug, m }
}

const clubLoc = (address: string, site = SITE) => `${site}/clubs/${encodeURIComponent(address)}`
const eventLoc = (id: string, site = SITE) => `${site}/tournaments/${encodeURIComponent(id)}`

/** The club route's canonical link for an address, under the same site setting, or null where the route serves no page there. */
async function canonicalOf(address: string, opts: Asked = {}): Promise<string | null> {
  const part = encodeURIComponent(address)
  const base = contextFor({ ...opts, url: `${opts.url ? new URL(opts.url).origin : SITE}/clubs/${part}` })
  const res = await routeGet({ ...base, params: { id: part }, functionPath: `/clubs/${part}` } as unknown as Parameters<typeof routeGet>[0])
  if (res.status !== 200) return null
  const href = /<link rel="canonical" href="([^"]*)" \/>/.exec(await res.text())?.[1]
  return href === undefined ? null : href.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}

describe('GET /sitemap.xml, club addresses against the club route', () => {
  it('lists a club exactly where the route serves it, for slugs and ids in forms the finder reads in its own way', async () => {
    const m = mark()
    expect(RESERVED_SLUGS).toContain('reply')
    // Each club's stored address in a form the finder trims, lowers, refuses or reads as another club's.
    const upper = await makeClub({ slug: `Example-Upper-${m}` })
    const padded = await makeClub({ slug: ` example-padded-${m} ` })
    const tooLong = await makeClub({ slug: `example-${'x'.repeat(220)}-${m}` })
    const emptySlug = await makeClub({ slug: '' })
    const reservedSlug = await makeClub({ slug: 'reply' })
    const caseId = await makeClub({ id: `Example-Case-Id-${m}`, slug: null })
    const caseHolder = await makeClub({ slug: `example-case-id-${m}` })
    const spaced = await makeClub({ slug: `example spaced ${m}` })
    const plain = await makeClub()
    const urls = await urlsFor()
    const clubLocs = urls.map((u) => u.loc).filter((loc) => loc.startsWith(`${SITE}/clubs/`))
    expect(new Set(clubLocs).size).toBe(clubLocs.length)

    // The route is the measure: each club asked at the address the sitemap would list it at.
    const { results } = await env.DB.prepare('SELECT id, slug FROM clubs').all<{ id: string; slug: string | null }>()
    const served: string[] = []
    for (const club of results ?? []) {
      const canonical = await canonicalOf(club.slug ?? club.id, { siteUrl: SITE })
      if (canonical !== null) served.push(canonical)
    }
    expect([...clubLocs].sort()).toEqual([...new Set(served)].sort())
    // Pages the route is shown not to serve at these addresses are not listed; the ones it serves are.
    for (const club of [plain, spaced, caseHolder]) expect(clubLocs, String(club.slug)).toContain(clubLoc(club.slug!))
    for (const club of [upper, padded, tooLong, reservedSlug]) expect(clubLocs, String(club.slug).slice(0, 40)).not.toContain(clubLoc(club.slug!))
    // A club with an empty slug has an empty address: nothing is listed at /clubs/ itself.
    expect(clubLocs).not.toContain(`${SITE}/clubs/`)
    expect(emptySlug.slug).toBe('')
    expect(clubLocs).not.toContain(clubLoc(caseId.id))
  })

  it('never lists an id the address bar would rewrite, which would name another page', async () => {
    await makeClub({ id: '..', slug: null })
    await makeClub({ id: '.', slug: null })
    const urls = await urlsFor()
    for (const { loc } of urls) expect(loc, loc).toMatch(/^https:\/\/www\.louisianachess\.org\/(?:clubs|tournaments)\/[^/?#]+$/)
    expect(urls.map((u) => u.loc)).not.toContain(`${SITE}/`)
    expect(urls.map((u) => u.loc)).not.toContain(`${SITE}/clubs/`)
  })
})

describe('GET /sitemap.xml, event addresses', () => {
  it('writes an event id holding a slash, a question mark, a hash, a space or an accent as one encoded part, read back as the id', async () => {
    const m = mark()
    const ids = [`example-event/${m}`, `example event ? ${m}`, `example-event#${m}`, `example-événement-${m}`, `example-100%-${m}`]
    for (const id of ids) await seedTournament({ id, name: 'Example Open', date: '2026-12-05' })
    const urls = await urlsFor()
    const locs = urls.map((u) => u.loc)
    for (const id of ids) {
      expect(locs, id).toContain(eventLoc(id))
      const part = eventLoc(id).slice(`${SITE}/tournaments/`.length)
      expect(part).not.toMatch(/[/?#\s]/)
      expect(decodeURIComponent(part)).toBe(id)
    }
    for (const { loc } of urls) expect(loc, loc).toMatch(/^https:\/\/www\.louisianachess\.org\/(?:clubs|tournaments)\/[^/?#]+$/)
  })

  it('never lists an event whose id is "." or "..", an address the address bar reads as another page', async () => {
    await seedTournament({ id: '..', name: 'Example Open', date: '2026-12-05' })
    await seedTournament({ id: '.', name: 'Example Quick Chess', date: '2026-12-06' })
    const locs = (await urlsFor()).map((u) => u.loc)
    expect(locs).not.toContain(`${SITE}/`)
    expect(locs).not.toContain(`${SITE}/tournaments/`)
    for (const loc of locs) expect(loc, loc).toMatch(/^https:\/\/www\.louisianachess\.org\/(?:clubs|tournaments)\/[^/?#]+$/)
  })

  it('lists every listed event whatever its date, end date or status, and a hidden one of each kind never', async () => {
    const m = mark()
    const past = await seedTournament({ id: `example-past-${m}`, name: 'Example Past Open', date: '2019-03-02', status: 'completed' })
    const noEnd = await seedTournament({ id: `example-noend-${m}`, name: 'Example One Day', date: '2026-12-05' })
    const multi = await seedTournament({ id: `example-multi-${m}`, name: 'Example Weekend', date: '2026-12-12' })
    await env.DB.prepare('UPDATE tournaments SET end_date = ? WHERE id = ?').bind('2026-12-13', multi).run()
    const nullEnd = await env.DB.prepare('SELECT end_date FROM tournaments WHERE id = ?').bind(noEnd).first<{ end_date: string | null }>()
    expect(nullEnd?.end_date).toBeNull()
    const hiddenPast = await seedTournament({ id: `example-hidden-past-${m}`, name: 'Example Hidden Past', date: '2019-04-06', status: 'completed', isVisible: false })
    const hiddenMulti = await seedTournament({ id: `example-hidden-multi-${m}`, name: 'Example Hidden Weekend', date: '2026-12-19', isVisible: false })
    const locs = (await urlsFor()).map((u) => u.loc)
    for (const id of [past, noEnd, multi]) expect(locs, id).toContain(eventLoc(id))
    for (const id of [hiddenPast, hiddenMulti]) expect(locs, id).not.toContain(eventLoc(id))
  })
})

describe('GET /sitemap.xml, the site\'s host as configured', () => {
  it('writes the host of the site setting, as the canonical link does, with or without a trailing slash', async () => {
    const club = await makeClub()
    const event = await seedTournament({ name: 'Example Open', date: '2026-12-05' })
    for (const siteUrl of ['https://staging.example.org', 'https://staging.example.org/', 'https://staging.example.org///']) {
      const site = 'https://staging.example.org'
      const urls = await urlsFor({ siteUrl })
      expect(urls.map((u) => u.loc), siteUrl).toEqual(expect.arrayContaining([clubLoc(club.slug!, site), eventLoc(event, site)]))
      for (const { loc } of urls) expect(loc.startsWith(`${site}/`), `${siteUrl} ${loc}`).toBe(true)
    }
  })

  it('writes the request\'s own origin only where the setting is empty, the very host the canonical link writes then', async () => {
    const club = await makeClub()
    const event = await seedTournament({ name: 'Example Open', date: '2026-12-05' })
    const origin = 'http://localhost:8788'
    const urls = await urlsFor({ url: `${origin}/sitemap.xml?host=elsewhere.example.org`, siteUrl: '' })
    expect(urls.map((u) => u.loc)).toEqual(expect.arrayContaining([clubLoc(club.slug!, origin), eventLoc(event, origin)]))
    for (const { loc } of urls) expect(loc.startsWith(`${origin}/`), loc).toBe(true)
  })

  it('agrees with the club route\'s canonical link under each setting', async () => {
    const club = await makeClub()
    for (const opts of [{ siteUrl: SITE }, { siteUrl: 'https://staging.example.org/' }, { siteUrl: '', url: 'http://localhost:8788/sitemap.xml' }]) {
      const part = encodeURIComponent(club.slug!)
      const origin = opts.url ? new URL(opts.url).origin : SITE
      const base = contextFor({ ...opts, url: `${origin}/clubs/${part}` })
      flags.pagesOn = true
      const res = await routeGet({
        ...base,
        params: { id: part },
        functionPath: `/clubs/${part}`,
      } as unknown as Parameters<typeof routeGet>[0])
      expect(res.status).toBe(200)
      const canonical = /<link rel="canonical" href="([^"]*)" \/>/.exec(await res.text())?.[1]
      const listed = (await urlsFor(opts)).map((u) => u.loc)
      expect(canonical, JSON.stringify(opts)).toBeDefined()
      expect(listed, JSON.stringify(opts)).toContain(canonical)
    }
  })
})

describe('GET /sitemap.xml, ties and repeated asks', () => {
  it('gives the same bytes on every ask, and orders ties by address, whatever the order they were stored in', async () => {
    const m = mark()
    // Two events on one date and two clubs sharing a starting word, stored in the reverse of their order.
    const eventB = await seedTournament({ id: `example-tie-b-${m}`, name: 'Example Tie B', date: '2026-12-26' })
    const eventA = await seedTournament({ id: `example-tie-a-${m}`, name: 'Example Tie A', date: '2026-12-26' })
    const later = await seedTournament({ id: `example-tie-later-${m}`, name: 'Example Later', date: '2027-01-30' })
    const clubB = await makeClub({ slug: `example-tie-b-${m}` })
    const clubA = await makeClub({ slug: `example-tie-a-${m}` })
    const first = await asked()
    const second = await asked()
    const third = await asked()
    expect(first.res.status).toBe(200)
    expect(second.text).toBe(first.text)
    expect(third.text).toBe(first.text)
    const locs = readSitemap(first.text).map((u) => u.loc)
    const at = (loc: string) => locs.indexOf(loc)
    expect(at(clubLoc(clubA.slug!))).toBeGreaterThanOrEqual(0)
    expect(at(clubLoc(clubA.slug!))).toBeLessThan(at(clubLoc(clubB.slug!)))
    expect(at(eventLoc(later))).toBeGreaterThanOrEqual(0)
    expect(at(eventLoc(later))).toBeLessThan(at(eventLoc(eventA)))
    expect(at(eventLoc(eventA))).toBeLessThan(at(eventLoc(eventB)))
    // A club page comes before an event page, as the document is written.
    expect(Math.max(at(clubLoc(clubA.slug!)), at(clubLoc(clubB.slug!)))).toBeLessThan(Math.min(at(eventLoc(later)), at(eventLoc(eventA)), at(eventLoc(eventB))))
  })
})

describe('GET /sitemap.xml, a last change across a daylight saving change and a midnight in America/Chicago', () => {
  it('writes each stored time to the instant it names, in UTC, and none where the offset or the clock is impossible', async () => {
    const stored: Array<[string, string | null]> = [
      // Spring forward, Sunday, March 8, 2026: 2:00 AM CST became 3:00 AM CDT.
      ['2026-03-08T01:59:59-06:00', '2026-03-08T07:59:59Z'],
      ['2026-03-08T03:00:00-05:00', '2026-03-08T08:00:00Z'],
      // Fall back, Sunday, November 1, 2026: 1:30 AM happened twice, once in CDT and once in CST.
      ['2026-11-01T01:30:00-05:00', '2026-11-01T06:30:00Z'],
      ['2026-11-01T01:30:00-06:00', '2026-11-01T07:30:00Z'],
      // Midnight in Chicago, in each offset, and the one second before it.
      ['2026-11-01T00:00:00-05:00', '2026-11-01T05:00:00Z'],
      ['2026-11-30T00:00:00-06:00', '2026-11-30T06:00:00Z'],
      ['2026-11-29T23:59:59-06:00', '2026-11-30T05:59:59Z'],
      // A year rolled over by the offset, and by the stored clock at the end of the year.
      ['2026-12-31T23:59:59-06:00', '2027-01-01T05:59:59Z'],
      ['2026-12-31 23:59:59', '2026-12-31T23:59:59Z'],
      ['2026-12-31 00:00:00', '2026-12-31T00:00:00Z'],
      // A leap day that exists, and one that does not.
      ['2028-02-29 12:00:00', '2028-02-29T12:00:00Z'],
      ['2027-02-29 12:00:00', null],
      ['2026-04-31', null],
      // A clock or an offset no calendar has.
      ['2026-11-01T24:00:00Z', null],
      ['2026-11-01 12:60:00', null],
      ['2026-11-01 12:00:60', null],
      ['2026-11-01T12:00:00+25:00', null],
      ['2026-11-01T12:00:00 CST', null],
    ]
    const made = await Promise.all(stored.map(async ([told]) => ({ told, club: await makeClub({ told }) })))
    const urls = await urlsFor()
    const lastmods = new Map(urls.map((u) => [u.loc, u.lastmod]))
    for (const [i, [told, expected]] of stored.entries()) {
      expect(lastmods.get(clubLoc(made[i].club.slug!)), told).toBe(expected)
    }
  })
})

describe('GET /sitemap.xml, a failure in the club finder\'s own lookups', () => {
  it('answers 503 in plain words when the lookup for a club with no slug fails, and a later ask answers the whole list', async () => {
    const bare = await makeClub({ slug: null })
    const keeper = await makeClub()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    for (const refuse of ['club_slug_history', 'FROM clubs WHERE slug']) {
      const { res, text } = await asked({ db: failingDb(refuse) })
      expect(res.status, refuse).toBe(503)
      expect(text, refuse).toBe(UNAVAILABLE)
      expect(res.headers.get('Cache-Control')).toBe('no-store')
      expect(res.headers.get('Content-Type')).toBe('text/plain; charset=utf-8')
      expect(text).not.toContain(bare.id)
      expect(text).not.toMatch(/club_slug_history|SQLITE|D1_ERROR|urlset/)
    }
    // Nothing of the failure is kept: the next ask, on a database that answers, is the whole list.
    const urls = await urlsFor()
    expect(urls.map((u) => u.loc)).toEqual(expect.arrayContaining([clubLoc(bare.id), clubLoc(keeper.slug!)]))
  })

  it('answers 503 when the failure comes after the first rows were read, not a list of what was read before it', async () => {
    await makeClub()
    await seedTournament({ name: 'Example Open', date: '2026-12-05' })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let reads = 0
    const db = {
      prepare: (sql: string) => {
        const real = env.DB.prepare(sql)
        const wrap = (statement: D1PreparedStatement): D1PreparedStatement =>
          ({
            bind: (...values: unknown[]) => wrap(statement.bind(...values)),
            first: (...a: unknown[]) => (statement.first as (...x: unknown[]) => Promise<unknown>)(...a),
            all: async () => {
              reads++
              // The clubs list is read; the events list is the one that fails.
              if (/FROM tournaments/.test(sql)) throw new Error('D1_ERROR: the database was lost')
              return statement.all()
            },
          }) as unknown as D1PreparedStatement
        return wrap(real)
      },
    } as unknown as D1Database
    const { res, text } = await asked({ db })
    expect(reads).toBeGreaterThanOrEqual(2)
    expect(res.status).toBe(503)
    expect(text).toBe(UNAVAILABLE)
    expect(text).not.toContain('<url>')
  })
})

describe('GET /sitemap.xml, a request that cannot be read for who is asking', () => {
  it('answers with the headers of the request closed to the file, so it reads none of them', async () => {
    const club = await makeClub({ told: '2026-11-02 15:00:00' })
    flags.pagesOn = true
    const plain = await (await sitemapGet(contextFor())).text()
    const context = contextFor()
    for (const key of ['headers', 'body', 'cache']) {
      Object.defineProperty(context.request, key, {
        get() {
          throw new Error(`the request's ${key} was read`)
        },
      })
    }
    const res = await sitemapGet(context)
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toBe(plain)
    expect(readSitemap(text).map((u) => u.loc)).toContain(clubLoc(club.slug!))
  })
})
