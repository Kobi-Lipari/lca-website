// test/integration/sitemap.test.ts
// GET /sitemap.xml (WS09 step 24). With CLUB_PAGES_ON unset the request is
// passed on with context.next() and the answer is what the site answers
// there, byte for byte, with nothing read from the database. With it set:
// every club page the club route serves, once, at the address of its
// canonical link, with told_updated_at as its last change where it reads as
// a date; every listed event's page and never a hidden draft; nothing else;
// every address on this site's own host whatever the request says; the
// document well formed, read back by a strict reader of its grammar, and
// escaped; the XML content type and an hour of caching; the same bytes for
// every reader; and a 503 in plain words, kept by no one, when the database
// fails. CLUB_PAGES_ON is set and unset here through a getter on a mock of
// its module, as test/integration/club-page-route.test.ts does; no case
// reads how it ships. Every club, event and person here is made up.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { env } from 'cloudflare:test'
import type { Env } from '../../functions/types'
import { accessToken, invoke } from './harness'
import { seedAdmin, seedClub, seedMember, seedTournament } from './factories'
import { countingDb } from './mailRuns'

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

/** The site's own shell, index.html, as the build serves it. */
const SHELL = Object.values(import.meta.glob('../../index.html', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)[0]
const SITE = 'https://www.louisianachess.org'
const NAMESPACE = 'http://www.sitemaps.org/schemas/sitemap/0.9'
const UNAVAILABLE = 'The sitemap cannot be read just now. Please try again in a few minutes.'

let made = 0
const mark = () => `${++made}${crypto.randomUUID().slice(0, 6)}`

interface Asked {
  url?: string
  db?: D1Database
  headers?: Record<string, string>
  siteUrl?: string
  next?: () => Promise<Response>
}

const shellAnswer = () => new Response(SHELL, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', ETag: '"shell-1"' } })

/** The route's context, as Pages builds it, with the shell as the next answer unless the case gives its own. */
function contextFor({ url = `${SITE}/sitemap.xml`, db, headers = {}, siteUrl, next = async () => shellAnswer() }: Asked = {}) {
  return {
    request: new Request(url, { headers }),
    env: { ...(env as unknown as Env), ...(db ? { DB: db } : {}), ...(siteUrl === undefined ? {} : { SITE_URL: siteUrl }) },
    params: {},
    data: {},
    functionPath: '/sitemap.xml',
    waitUntil: () => {},
    passThroughOnException: () => {},
    next,
  } as unknown as EventContext<Env, string, Record<string, unknown>>
}

/** An answer as its status, its headers and its bytes. */
async function answerOf(res: Response) {
  return { status: res.status, headers: Object.fromEntries([...res.headers.entries()].sort()), text: await res.text() }
}
const sitemap = async (asked: Asked = {}) => answerOf(await sitemapGet(contextFor(asked)))

/** A database every touch of which is written down and refused, so a case can show nothing was read. */
function untouchedDb() {
  const touched: string[] = []
  const db = new Proxy({}, {
    get(_target, key) {
      touched.push(String(key))
      throw new Error('the database was read')
    },
  }) as D1Database
  return { db, touched }
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
/** A text node's value: every reference one of the five XML names, and no bare "&", "<" or ">". */
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

/**
 * The document read by its grammar, failing on anything outside it: the XML
 * declaration, one urlset in the protocol's namespace, and in it only url
 * elements, each a loc and at most one lastmod after it, every value read
 * back through its references.
 */
function readSitemap(xml: string): Url[] {
  const head = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="${NAMESPACE}">\n`
  if (!xml.startsWith(head)) throw new Error(`not the protocol's head: ${xml.slice(0, 120)}`)
  if (!xml.endsWith('</urlset>\n')) throw new Error('the urlset is not closed at the end')
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

/** The sitemap's urls, with the constant set, for a request as the case asks it. */
async function urlsFor(asked: Asked = {}) {
  flags.pagesOn = true
  const res = await sitemap(asked)
  expect(res.status, res.text.slice(0, 120)).toBe(200)
  return readSitemap(res.text)
}

/** A made-up club with a slug unless the case says none. */
async function makeClub(opts: { id?: string; slug?: string | null; told?: string | null } = {}) {
  const m = mark()
  const id = await seedClub({ id: opts.id ?? `example-club-id-${m}`, name: `Example Chess Club ${m}`, city: 'Example City' })
  const slug = opts.slug === undefined ? `example-chess-club-${m}` : opts.slug
  await env.DB.prepare('UPDATE clubs SET slug = ?, told_updated_at = ? WHERE id = ?').bind(slug, opts.told ?? null, id).run()
  return { id, slug, m }
}

const clubLoc = (address: string) => `${SITE}/clubs/${encodeURIComponent(address)}`
const eventLoc = (id: string) => `${SITE}/tournaments/${encodeURIComponent(id)}`

/** The club route's context, as Pages builds it, for an address part sent encoded, as a browser sends it. */
function routeAt(address: string) {
  const part = encodeURIComponent(address)
  return { ...contextFor({ url: `${SITE}/clubs/${part}` }), params: { id: part }, functionPath: `/clubs/${part}` } as unknown as Parameters<typeof routeGet>[0]
}
/** The canonical link in a page the route wrote, read back from its attribute, or null where it has none. */
const canonicalIn = (html: string) => {
  const href = /<link rel="canonical" href="([^"]*)" \/>/.exec(html)?.[1]
  return href === undefined ? null : href.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}
/** The club route's canonical link for an address, or null where the route serves no club page there. */
async function canonicalOf(address: string): Promise<string | null> {
  const res = await routeGet(routeAt(address))
  return res.status === 200 ? canonicalIn(await res.text()) : null
}

describe('GET /sitemap.xml with CLUB_PAGES_ON unset', () => {
  it('passed on with the constant unset: the next answer itself, byte for byte, with nothing read', async () => {
    await makeClub({ told: '2026-11-02 15:00:00' })
    const { db, touched } = untouchedDb()
    let asked = 0
    const shell = shellAnswer()
    const res = await sitemapGet(contextFor({ db, next: async () => { asked++; return shell } }))
    expect(res).toBe(shell)
    expect(asked).toBe(1)
    expect(touched).toEqual([])
    expect(await answerOf(res)).toEqual(await answerOf(shellAnswer()))
    // A signed-in reader and a query change nothing: still the next answer, still nothing read.
    const admin = await seedAdmin()
    const token = accessToken(admin)
    const again = await sitemap({ db, url: `${SITE}/sitemap.xml?page=2`, headers: { Authorization: `Bearer ${token}`, Cookie: `sb-access-token=${token}` } })
    expect(again).toEqual(await answerOf(shellAnswer()))
    expect(touched).toEqual([])
  })
})

describe('GET /sitemap.xml with CLUB_PAGES_ON set', () => {
  it('every club page with its last change, in the protocol\'s form, and none where the club has none or it is not a date', async () => {
    const told = await makeClub({ told: '2026-11-02 15:00:00' })
    const withZone = await makeClub({ told: '2026-11-03T09:30:00-06:00' })
    const never = await makeClub({ told: null })
    const garbled = await makeClub({ told: 'last Tuesday' })
    const impossible = await makeClub({ told: '2026-02-30 10:00:00' })
    const bare = await makeClub({ slug: null, told: '2026-10-31 23:59:59' })
    const urls = await urlsFor()
    const at = (loc: string) => urls.filter((u) => u.loc === loc)
    expect(at(clubLoc(told.slug!))).toEqual([{ loc: clubLoc(told.slug!), lastmod: '2026-11-02T15:00:00Z' }])
    expect(at(clubLoc(withZone.slug!))).toEqual([{ loc: clubLoc(withZone.slug!), lastmod: '2026-11-03T15:30:00Z' }])
    for (const club of [never, garbled, impossible]) expect(at(clubLoc(club.slug!)), club.slug!).toEqual([{ loc: clubLoc(club.slug!), lastmod: null }])
    // A club with no slug is listed at its id, the address its page is served at.
    expect(at(clubLoc(bare.id))).toEqual([{ loc: clubLoc(bare.id), lastmod: '2026-10-31T23:59:59Z' }])
    // Each lastmod the protocol's W3C form.
    for (const url of urls) if (url.lastmod !== null) expect(url.lastmod).toMatch(/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}Z)?$/)
  })

  it('gives each club page at the address of its canonical link, once, and only the pages the club route serves', async () => {
    const plain = await makeClub()
    const bare = await makeClub({ slug: null })
    // A club with no slug whose id another club holds as its slug: /clubs/{id} is the other club's page.
    const shadowed = await makeClub({ slug: null })
    const holder = await makeClub({ slug: shadowed.id })
    // A club with no slug whose id is another club's old slug: that address is sent on to the other club.
    const moved = await makeClub({ slug: null })
    const mover = await makeClub()
    await env.DB.prepare('INSERT INTO club_slug_history (old_slug, club_id) VALUES (?, ?)').bind(moved.id, mover.id).run()
    // A club with no slug whose id is a word the club pages keep for their own addresses.
    const reserved = 'reply'
    expect(RESERVED_SLUGS).toContain(reserved)
    await makeClub({ id: reserved, slug: null })
    // An old slug of a listed club is never itself listed.
    const old = `example-old-address-${mark()}`
    await env.DB.prepare('INSERT INTO club_slug_history (old_slug, club_id) VALUES (?, ?)').bind(old, plain.id).run()

    const urls = await urlsFor()
    const clubLocs = urls.map((u) => u.loc).filter((loc) => loc.startsWith(`${SITE}/clubs/`))
    expect(new Set(clubLocs).size).toBe(clubLocs.length)

    // The club route is the measure: for every club, its page where the route serves one.
    const { results } = await env.DB.prepare('SELECT id, slug FROM clubs').all<{ id: string; slug: string | null }>()
    const served: string[] = []
    for (const club of results ?? []) {
      const canonical = await canonicalOf(club.slug ?? club.id)
      if (canonical !== null) served.push(canonical)
    }
    expect([...clubLocs].sort()).toEqual([...new Set(served)].sort())

    for (const club of [plain, bare, holder, mover]) expect(clubLocs, club.id).toContain(clubLoc(club.slug ?? club.id))
    for (const absent of [clubLoc(old), clubLoc(reserved), clubLoc(moved.id)]) expect(clubLocs, absent).not.toContain(absent)
    // The shadowed club's id is the holder's slug, listed once, for the holder.
    expect(clubLocs.filter((loc) => loc === clubLoc(shadowed.id))).toHaveLength(1)
    expect(await canonicalOf(plain.slug!)).toBe(clubLoc(plain.slug!))
  })

  it('a hidden draft is absent, and every listed event\'s page is in it at the address the site gives an event', async () => {
    const club = await makeClub()
    const listed = await seedTournament({ name: 'Example Open', date: '2026-12-05', clubId: club.id })
    const elsewhere = await seedTournament({ name: 'Example Quick Chess', date: '2026-10-24' })
    const draft = await seedTournament({ name: 'Example Draft Event', date: '2026-12-12', clubId: club.id, isVisible: false })
    const urls = await urlsFor()
    const eventLocs = urls.map((u) => u.loc).filter((loc) => loc.startsWith(`${SITE}/tournaments/`))
    expect(eventLocs).toContain(eventLoc(listed))
    expect(eventLocs).toContain(eventLoc(elsewhere))
    expect(eventLocs).not.toContain(eventLoc(draft))
    expect(urls.some((u) => u.loc.includes(encodeURIComponent(draft)))).toBe(false)
    // Every listed event, once, and no lastmod, since an event keeps no time of its last change.
    const { results } = await env.DB.prepare('SELECT id FROM tournaments WHERE is_visible = 1').all<{ id: string }>()
    expect([...eventLocs].sort()).toEqual((results ?? []).map((r) => eventLoc(r.id)).sort())
    for (const url of urls.filter((u) => u.loc.startsWith(`${SITE}/tournaments/`))) expect(url.lastmod).toBeNull()
  })

  it('lists nothing but club and event pages: no admin, member, workspace or form address, no old slug and no query', async () => {
    await makeClub({ told: '2026-11-02 15:00:00' })
    await seedTournament({ name: 'Example Open', date: '2026-12-05' })
    const urls = await urlsFor({ url: `${SITE}/sitemap.xml?extra=/admin` })
    expect(urls.length).toBeGreaterThan(1)
    // One path part under /clubs/ or /tournaments/ and nothing after it: no other page, no page under an event and no query.
    for (const { loc } of urls) expect(loc, loc).toMatch(/^https:\/\/www\.louisianachess\.org\/(?:clubs|tournaments)\/[^/?#]+$/)
  })

  it('keeps every address on this site\'s own host, whatever the request\'s host, headers or query say', async () => {
    const club = await makeClub()
    const event = await seedTournament({ name: 'Example Open', date: '2026-12-05' })
    const tries: Asked[] = [
      { url: 'https://elsewhere.example.org/sitemap.xml' },
      { url: `${SITE}/sitemap.xml?host=elsewhere.example.org&site=https://elsewhere.example.org` },
      {
        headers: {
          Host: 'elsewhere.example.org', 'X-Forwarded-Host': 'elsewhere.example.org', Forwarded: 'host=elsewhere.example.org;proto=http',
          'X-Forwarded-Proto': 'http', Origin: 'https://elsewhere.example.org', Referer: 'https://elsewhere.example.org/',
        },
      },
      { url: 'http://localhost:8788/sitemap.xml', siteUrl: `${SITE}/` },
    ]
    flags.pagesOn = true
    const plain = (await sitemap()).text
    for (const asked of tries) {
      const urls = await urlsFor(asked)
      for (const { loc } of urls) expect(loc.startsWith(`${SITE}/`), `${JSON.stringify(asked)} ${loc}`).toBe(true)
      expect(urls.map((u) => u.loc)).toEqual(expect.arrayContaining([clubLoc(club.slug!), eventLoc(event)]))
      expect((await sitemap(asked)).text, JSON.stringify(asked)).toBe(plain)
    }
  })

  it('is well formed, every value escaped and encoded, read back as it was, with the XML type and an hour of caching', async () => {
    const m = mark()
    const slugs = [`example & club <${m}>`, `"example" club ${m}`, `example's club ${m}`, `example club ${m}`]
    for (const slug of slugs) await makeClub({ slug })
    const odd = await seedTournament({ id: `example-event & "${m}" <x>`, name: 'Example Open', date: '2026-12-05' })
    flags.pagesOn = true
    const res = await sitemap()
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toBe('application/xml; charset=utf-8')
    expect(res.headers['cache-control']).toBe('public, max-age=3600')
    // No character XML gives a meaning stands bare in a value, and every reference is one XML names.
    for (const value of res.text.match(/<(loc|lastmod)>[^<]*<\/\1>/g) ?? []) expect(value.replace(/^<\w+>|<\/\w+>$/g, '')).not.toMatch(/[<>"']|&(?!amp;|lt;|gt;|quot;|apos;)/)
    const urls = readSitemap(res.text)
    const read = urls.map((u) => u.loc)
    for (const slug of slugs) {
      const loc = clubLoc(slug)
      expect(read, slug).toContain(loc)
      expect(decodeURIComponent(loc.slice(`${SITE}/clubs/`.length))).toBe(slug)
      expect(await canonicalOf(slug), slug).toBe(loc)
    }
    expect(read).toContain(eventLoc(odd))
    expect(res.text).toContain(`${SITE}/clubs/example&apos;s%20club%20${m}`)
  })

  it('answers 503 in plain words when the database fails, never half a sitemap, never the shell and never kept', async () => {
    flags.pagesOn = true
    await makeClub()
    let asked = 0
    const failures = [
      countingDb({ refuse: 'FROM clubs' }).db,
      countingDb({ refuse: 'FROM tournaments' }).db,
      { prepare: () => { throw new Error('D1_ERROR: the database is not reachable: SQLITE_BUSY') } } as unknown as D1Database,
    ]
    vi.spyOn(console, 'error').mockImplementation(() => {})
    for (const db of failures) {
      const res = await sitemap({ db, next: async () => { asked++; return shellAnswer() } })
      expect(res.status).toBe(503)
      expect(res.text).toBe(UNAVAILABLE)
      expect(res.headers['content-type']).toBe('text/plain; charset=utf-8')
      expect(res.headers['cache-control']).toBe('no-store')
      expect(res.text).not.toMatch(/urlset|<|D1|SQLITE|table|reachable/i)
    }
    expect(asked).toBe(0)
  })

  it('gives the same bytes to everyone: a visitor, a member, the club\'s rep and an LCA admin, a hidden draft absent for each', async () => {
    const club = await makeClub({ told: '2026-11-02 15:00:00' })
    const draft = await seedTournament({ name: 'Example Draft Event', date: '2026-12-12', clubId: club.id, isVisible: false })
    const listed = await seedTournament({ name: 'Example Open', date: '2026-12-05', clubId: club.id })
    const m = mark()
    const member = await seedMember({ fullName: 'Player One', email: `player.one.${m}@example.org` })
    const rep = await seedMember({ role: 'club_rep', clubId: club.id, fullName: 'Player Two', email: `player.two.${m}@example.org` })
    const admin = await seedMember({ role: 'lca_admin', fullName: 'Player Three', email: `player.three.${m}@example.org` })
    flags.pagesOn = true
    const visitor = await invoke(sitemapGet, { path: '/sitemap.xml' })
    const visitorAnswer = await answerOf(visitor.response)
    expect(visitorAnswer.status).toBe(200)
    expect(visitorAnswer.text).toContain(eventLoc(listed))
    expect(visitorAnswer.text).not.toContain(encodeURIComponent(draft))
    for (const who of [member, rep, admin]) {
      const signedIn = await invoke(sitemapGet, { path: '/sitemap.xml', as: who, headers: { Cookie: `sb-access-token=${accessToken(who)}` } })
      expect(await answerOf(signedIn.response), who).toEqual(visitorAnswer)
    }
  })
})
