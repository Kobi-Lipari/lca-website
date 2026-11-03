// test/unit/search-addresses.test.ts
//
// Where the search's rows go (WS02 step 9): every address an answer gives
// inside the site is a page the site's router draws (src/App.tsx), an id
// that holds a space or a slash still one part of its address; a champions
// row's address names a section the champions page draws for its list
// (src/pages/ChampionsPage.tsx), never a person's own entry; and a partner
// event's address is its organizer's web page, outside the site and marked
// so. The rows are this file's own, given to the answer's code as the reads
// would return them.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { normalizeSearchText } from '../../domain/format/searchText'
import { searchAnswer, type SearchRows } from '../../functions/utils/search'

const ROOT = join(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

/** Noon on Sunday, November 1, 2026 in Louisiana. */
const NOON = Date.parse('2026-11-01T18:00:00.000Z')

/** The site's pages, as its router names them, each made a pattern of its path. */
const ROUTES = [...read('src/App.tsx').matchAll(/<Route\s+path="([^"]+)"/g)].map(([, path]) => path)
const routePattern = (path: string) => new RegExp(`^${path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/:[A-Za-z]+/g, '[^/]+').replace(/\*/g, '.*')}$`)
const isPage = (pathname: string) => ROUTES.some((route) => routePattern(route).test(pathname))

/** Rows of every group, some with ids that hold a space or a slash. */
const ROWS: SearchRows = {
  upcoming: [
    { id: 'fx-e1', name: 'Fixture Fall Open', date: '2026-11-14', end_date: null, location: 'Kenner, LA', registration_status: 'open', registration_closes_at: null },
    { id: 'fx e/2', name: 'Fixture Odd Id Open', date: '2026-11-15', end_date: null, location: 'Kenner, LA', registration_status: 'draft', registration_closes_at: null },
  ],
  results: [{ id: 'fx-r1', name: 'Fixture Summer Open', date: '2026-07-11', end_date: null, location: 'Baton Rouge, LA' }],
  partners: [{ id: 'fx-p1', name: 'Fixture Gulf Open', start_date: '2026-11-21', end_date: null, city: 'Biloxi', state: 'MS', link: 'https://example.org/gulf?ref=lca#top' }],
  clubs: [{ id: 'fx c/1', name: 'Fixture Chess Club', city: 'Monroe', region: null }],
  posts: [{ slug: 'fixture-news-of-the-fall', title: 'Fixture news', published_at: '2026-10-20' }],
  champions: [{ year: 2026, title: 'Fixture State Champion', kind: 'state' }, { year: 2025, title: 'Fixture K-8', kind: 'scholastic' }],
}
const items = searchAnswer(ROWS, normalizeSearchText('fixture'), NOON).groups.flatMap((g) => g.items)

describe('where the search\'s rows go', () => {
  it('reads the site\'s pages and every row, so the checks below are not blind', () => {
    expect(ROUTES.length).toBeGreaterThan(10)
    for (const route of ['/tournaments/:id', '/clubs/:id', '/news/:slug', '/champions']) expect(ROUTES).toContain(route)
    expect(items.map((i) => i.id.split(':')[0])).toEqual(['event', 'event', 'partner', 'club', 'news', 'event', 'champions', 'champions'])
  })

  it('sends every row inside the site to a page the router draws, an id with a space or a slash kept to one part of the address', () => {
    for (const item of items.filter((i) => !i.external)) {
      expect(item.href.startsWith('/'), item.id).toBe(true)
      expect(item.href.startsWith('//'), item.id).toBe(false)
      const { pathname } = new URL(item.href, 'https://www.louisianachess.org')
      expect(isPage(pathname), `${item.id}: ${item.href}`).toBe(true)
    }
    expect(items.find((i) => i.id === 'event:fx e/2')!.href).toBe('/tournaments/fx%20e%2F2')
    expect(items.find((i) => i.id === 'club:fx c/1')!.href).toBe('/clubs/fx%20c%2F1')
  })

  it('sends a champions row to its list\'s section on the champions page, a section the page draws for each of its two lists, never a person\'s entry', () => {
    const page = read('src/pages/ChampionsPage.tsx')
    expect(page).toContain('<section id={`${kind}-champions`}')
    for (const kind of ['state', 'scholastic']) expect(page).toContain(`kind="${kind}"`)
    const champions = items.filter((i) => i.id.startsWith('champions:'))
    expect(champions.map((i) => i.href)).toEqual(['/champions#state-champions', '/champions#scholastic-champions'])
  })

  it('sends a partner event to its organizer\'s web page as stored, outside the site and marked so, and no row to an address that runs code', () => {
    const [partner] = items.filter((i) => i.id.startsWith('partner:'))
    expect(partner.href).toBe('https://example.org/gulf?ref=lca#top')
    expect(partner.external).toBe(true)
    for (const item of items) expect(item.href.toLowerCase(), item.id).not.toMatch(/^\s*(?:javascript|data|vbscript):/)
    for (const item of items.filter((i) => i.external)) expect(['https:', 'http:']).toContain(new URL(item.href).protocol)
  })
})
