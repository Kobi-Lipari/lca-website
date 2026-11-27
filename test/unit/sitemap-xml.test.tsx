// @vitest-environment jsdom
// test/unit/sitemap-xml.test.tsx
// The sitemap's document (functions/sitemap.xml.ts, WS09 step 24) read back
// by an XML parser, the DOMParser jsdom gives, which refuses a document that
// is not well formed: the urlset in the protocol's namespace, each url with
// its loc and, only where the club has a readable last change, its lastmod;
// every value escaped and encoded, read back as the made-up club and event
// had it; and told_updated_at turned into the protocol's form from each shape
// the column can hold. The database is a stand-in that answers the three
// reads the file makes from rows held here. CLUB_PAGES_ON is set through a
// getter on a mock of its module; no case reads how it ships. Every club
// and event here is made up. The file is .tsx, as every unit test that asks
// for jsdom is (test/unit/test-setup.test.ts), though it draws nothing.
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Env } from '../../functions/types'
import { onRequestGet } from '../../functions/sitemap.xml'

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
})

const SITE = 'https://www.example.org'
const NAMESPACE = 'http://www.sitemaps.org/schemas/sitemap/0.9'

interface Club {
  id: string
  slug: string | null
  told_updated_at: string | null
}

/** A stand-in for the database: the clubs list, the events list and the club finder's three lookups, from rows held here. */
function standIn(clubs: Club[], events: string[]) {
  const asked: string[] = []
  const statement = (sql: string, binds: unknown[] = []) => ({
    bind: (...values: unknown[]) => statement(sql, values),
    all: async () => {
      asked.push(sql)
      if (/FROM clubs ORDER BY/.test(sql)) return { results: clubs }
      if (/FROM tournaments t WHERE/.test(sql)) return { results: events.map((id) => ({ id })) }
      throw new Error(`a read the stand-in does not know: ${sql}`)
    },
    first: async () => {
      asked.push(sql)
      const [value] = binds
      if (/club_slug_history/.test(sql)) return null
      if (/WHERE slug = \?/.test(sql)) return clubs.find((c) => c.slug === value) ?? null
      if (/WHERE id = \?/.test(sql)) return clubs.find((c) => c.id === value) ?? null
      throw new Error(`a read the stand-in does not know: ${sql}`)
    },
  })
  return { db: { prepare: (sql: string) => statement(sql) } as unknown as D1Database, asked }
}

async function sitemapOf(clubs: Club[], events: string[] = []) {
  flags.pagesOn = true
  const { db } = standIn(clubs, events)
  const context = {
    request: new Request(`${SITE}/sitemap.xml`),
    env: { DB: db, SITE_URL: SITE } as unknown as Env,
    params: {},
    data: {},
    functionPath: '/sitemap.xml',
    waitUntil: () => {},
    passThroughOnException: () => {},
    next: async () => new Response('the shell', { status: 200 }),
  } as unknown as Parameters<typeof onRequestGet>[0]
  const res = await onRequestGet(context)
  expect(res.status).toBe(200)
  return res.text()
}

/** The document as a parser reads it, failing where the parser finds it not well formed. */
function parsed(xml: string): XMLDocument {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  expect(doc.getElementsByTagName('parsererror')).toHaveLength(0)
  return doc
}

/** Each url's loc and lastmod as the parser reads them. */
function urlsOf(doc: XMLDocument) {
  return [...doc.documentElement.children].map((url) => {
    expect(url.localName).toBe('url')
    expect(url.namespaceURI).toBe(NAMESPACE)
    const names = [...url.children].map((child) => child.localName)
    expect(['loc', 'loc,lastmod']).toContain(names.join(','))
    return { loc: url.children[0].textContent ?? '', lastmod: url.children[1]?.textContent ?? null }
  })
}

describe('the sitemap read back by an XML parser', () => {
  it('is a urlset in the protocol\'s namespace, each url a loc and, where the club has one, a lastmod', async () => {
    const xml = await sitemapOf(
      [
        { id: 'example-chess-club', slug: 'example-chess-club', told_updated_at: '2026-11-02 15:00:00' },
        { id: 'example-quiet-club', slug: 'example-quiet-club', told_updated_at: null },
      ],
      ['example-open'],
    )
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n')).toBe(true)
    const doc = parsed(xml)
    expect(doc.documentElement.localName).toBe('urlset')
    expect(doc.documentElement.namespaceURI).toBe(NAMESPACE)
    expect(urlsOf(doc)).toEqual([
      { loc: `${SITE}/clubs/example-chess-club`, lastmod: '2026-11-02T15:00:00Z' },
      { loc: `${SITE}/clubs/example-quiet-club`, lastmod: null },
      { loc: `${SITE}/tournaments/example-open`, lastmod: null },
    ])
  })

  it('escapes and encodes a slug or an id holding "&", "<", a quote, an apostrophe or a space, and reads each back as it was', async () => {
    const slugs = ['example & club', 'example <club>', 'the "example" club', "example's club", 'example  club']
    const clubs = slugs.map((slug, i) => ({ id: `example-club-${i}`, slug, told_updated_at: null }))
    // A club with no slug is listed at its id, which the finder looks up.
    clubs.push({ id: 'Example Chess Club & <Friends>', slug: null, told_updated_at: null })
    const events = ['example open & "rapid" <one>', "example's quick chess"]
    const xml = await sitemapOf(clubs, events)
    const read = urlsOf(parsed(xml)).map((u) => u.loc)
    const back = read.map((loc) => {
      const [, kind, part] = /^https:\/\/www\.example\.org\/(clubs|tournaments)\/([^/?#]+)$/.exec(loc) ?? []
      expect(kind, loc).toBeDefined()
      return `${kind}:${decodeURIComponent(part)}`
    })
    expect(back.sort()).toEqual([...slugs.map((s) => `clubs:${s}`), 'clubs:Example Chess Club & <Friends>', ...events.map((e) => `tournaments:${e}`)].sort())
    // Nothing a value holds stands bare in the bytes.
    for (const value of xml.match(/<loc>[^<]*<\/loc>/g) ?? []) expect(value.slice(5, -6)).not.toMatch(/[<>"' ]|&(?!amp;|apos;)/)
  })

  it('writes told_updated_at in the protocol\'s form from each shape it can hold, and no lastmod where it is not a real date', async () => {
    const stored: Array<[string | null, string | null]> = [
      ['2026-11-02 15:00:00', '2026-11-02T15:00:00Z'],
      ['2026-11-02T15:00:00', '2026-11-02T15:00:00Z'],
      ['2026-11-02T15:00:00.250Z', '2026-11-02T15:00:00Z'],
      ['2026-11-02T09:00:00-06:00', '2026-11-02T15:00:00Z'],
      ['2026-11-02 15:00', '2026-11-02T15:00:00Z'],
      ['2026-11-02', '2026-11-02'],
      ['  2026-11-02 15:00:00  ', '2026-11-02T15:00:00Z'],
      ['2026-02-30 10:00:00', null],
      ['2026-13-01 10:00:00', null],
      ['2026-11-02 24:00:00', null],
      ['2026-11-02 15:61:00', null],
      ['Sat, Oct 24', null],
      ['', null],
      ['   ', null],
      [null, null],
    ]
    const clubs = stored.map(([told], i) => ({ id: `example-club-${i}`, slug: `example-club-${String(i).padStart(2, '0')}`, told_updated_at: told }))
    const urls = urlsOf(parsed(await sitemapOf(clubs)))
    const bySlug = new Map(urls.map((u) => [u.loc.slice(`${SITE}/clubs/`.length), u.lastmod]))
    stored.forEach(([told, lastmod], i) => expect(bySlug.get(`example-club-${String(i).padStart(2, '0')}`), String(told)).toBe(lastmod))
  })

  it('is an empty urlset, still well formed, when there is no club and no listed event', async () => {
    const doc = parsed(await sitemapOf([], []))
    expect(doc.documentElement.localName).toBe('urlset')
    expect(doc.documentElement.children).toHaveLength(0)
  })
})
