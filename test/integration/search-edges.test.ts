// test/integration/search-edges.test.ts
//
// GET /api/search (WS02 step 9) in the Workers runtime: the edges that
// test/integration/search.test.ts leaves, against the migrations' own rows
// and each test's, seeded here and never read from anywhere else. The clock
// is held at noon on Sunday, November 1, 2026 in Louisiana unless a test
// moves it. The rows a test adds stay for the tests after it in this file,
// so each test searches words of its own.
//
// - role safety through the endpoint itself: no hidden draft for a visitor,
//   a member, a club rep whose club holds it, a director who directs it or
//   an admin, though the list of tournaments shows the rep and the director
//   theirs; a token that is no token, a cookie, or an admin's sign-in with
//   one factor answered as anyone is, never with a 401; and OPTIONS
//   answered 204 with no data, whoever asks (D26);
// - what the database says now: a draft published found at once, an event
//   hidden again and a club taken away gone at once;
// - Louisiana's midnight in daylight time and in standard time, never
//   UTC's, and three years less a day counted in;
// - ties ordered as each group says: the LCA's events by name on the same
//   day, results by name on the same last day, partner events Louisiana's
//   first and then by day and name, posts by title on the same day, and the
//   honor roll's state list before its scholastic one in a year;
// - no bound ahead, the five places of the Tournaments group shared with the
//   LCA's events first, and an empty end date read as none;
// - D9 and the private columns: nothing found by a member's name, a partner
//   event's organizer or contact, a club's contact email or description, an
//   event's organizer, description or venue, or a champion's name, notes,
//   photo or row id, every champion of the honor roll's own rows tried; and
//   the columns each read returns, as the database itself reports them;
// - the edge's cache in this runtime: one entry for every spelling that
//   normalises alike, kept under the request's own origin, none for a
//   refused search, and a kept answer that keeps its contract;
// - the bound of 500 rows a read with more rows than that in a table, and
//   the schema's own refusal of a cancelled status.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { contracts } from '../../domain/contracts'
import { matchesSearch, normalizeSearchText } from '../../domain/format/searchText'
import { onRequestGet as searchGet, onRequestOptions as searchOptions } from '../../functions/api/search'
import { onRequestGet as tournamentsGet } from '../../functions/api/tournaments'
import type { Env } from '../../functions/types'
import { SEARCH_READ_LIMIT, answerSearch, readSearchRows, searchCacheKey, searchWindows } from '../../functions/utils/search'
import { seedAdmin, seedClub, seedMember, seedTournament, seedTournamentDirector } from './factories'
import { expectContract, flushWaitUntil, invoke, resetHarness } from './harness'

/** Noon on Sunday, November 1, 2026 in Louisiana. */
const NOON = '2026-11-01T18:00:00.000Z'
/** The address every request of the harness is made on. */
const ORIGIN = 'https://lca-website.pages.dev'

interface Item { id: string; title: string; meta?: string; href: string; tag?: { label: string; tone: string }; external?: boolean }
interface Group { type: string; label: string; items: Item[] }
interface Body { q: string; groups: Group[] }

const path = (q: string) => `/api/search?q=${encodeURIComponent(q)}`

/** A search answered from the database alone, as a visitor or as the member given. */
async function found(q: string, as?: string): Promise<Body> {
  const res = await invoke((context) => answerSearch(context, null), { path: path(q), ...(as ? { as } : {}) })
  expect(res.status).toBe(200)
  return res.json<Body>()
}
/** A search through the endpoint itself, its cache and all, its kept answer stored before the next. */
async function throughEndpoint(q: string, as?: string) {
  const res = await invoke(searchGet, { path: path(q), ...(as ? { as } : {}) })
  await flushWaitUntil()
  return res
}
const group = (body: Body, type: string) => body.groups.find((g) => g.type === type)
const idsIn = (body: Body, type: string) => group(body, type)?.items.map((i) => i.id) ?? []
const titlesIn = (body: Body, type: string) => group(body, type)?.items.map((i) => i.title) ?? []

/** A tournament with the columns its factory does not take. */
async function tournament(opts: Parameters<typeof seedTournament>[0] & { endDate?: string | null; location?: string } = {}) {
  const { endDate = null, location = 'Kenner, LA', ...rest } = opts
  const id = await seedTournament(rest)
  await env.DB.prepare('UPDATE tournaments SET end_date = ?, location = ? WHERE id = ?').bind(endDate, location, id).run()
  return id
}
let partners = 0
async function partner(row: { name: string; start: string; end?: string | null; city?: string | null; state?: string | null; link?: string | null; organizer?: string; contact?: string }) {
  const id = `fx-edge-partner-${++partners}`
  await env.DB.prepare(
    `INSERT INTO clearinghouse (id, name, start_date, end_date, organizer, city, state, contact, link, is_lca)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
  ).bind(id, row.name, row.start, row.end ?? null, row.organizer ?? null, row.city ?? null, row.state ?? null, row.contact ?? null, row.link === undefined ? 'https://example.org/event' : row.link).run()
  return id
}
let posts = 0
async function post(title: string, publishedAt: string) {
  const slug = `fixture-edge-post-${++posts}`
  await env.DB.prepare(`INSERT INTO lca_posts (id, slug, title, summary, status, published_at) VALUES (?, ?, ?, 'A fixture post.', 'published', ?)`)
    .bind(`fx-edge-post-${posts}`, slug, title, publishedAt).run()
  return slug
}
async function champion(row: { year: number; title: string; champion?: string; kind?: 'state' | 'scholastic'; id?: string; notes?: string | null; photo?: string | null }) {
  await env.DB.prepare(`INSERT INTO state_champions (id, year, title, champion, notes, kind, photo_url) VALUES (COALESCE(?, lower(hex(randomblob(8)))), ?, ?, ?, ?, ?, ?)`)
    .bind(row.id ?? null, row.year, row.title, row.champion ?? 'Fixture Holder', row.notes ?? null, row.kind ?? 'state', row.photo ?? null).run()
}

/** The edge's cache where this runtime gives one, and none where it does not. */
const edge = (): Cache | null => (typeof caches === 'undefined' ? null : ((caches as Partial<CacheStorage>).default ?? null))

beforeEach(() => {
  resetHarness()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(NOON))
})
afterEach(() => {
  vi.useRealTimers()
})

// ── Role safety ────────────────────────────────────────────────────────────

describe('GET /api/search: no hidden draft, whoever asks (D26)', () => {
  it('through the endpoint itself, gives no draft to a visitor, a member, a club rep whose club holds it, a director who directs it or an admin, though the list of tournaments shows the rep and the director theirs', async () => {
    const clubId = await seedClub({ name: 'Fixture Rep Club', city: 'Ruston' })
    const rep = await seedMember({ role: 'club_rep', clubId })
    const director = await seedMember({ role: 'tournament_director' })
    const member = await seedMember()
    const admin = await seedAdmin()
    const repDraft = await tournament({ name: 'Caracal Rep Draft Open', date: '2026-11-21', isVisible: false, clubId })
    const directedDraft = await tournament({ name: 'Caracal Directed Draft Open', date: '2026-11-22', isVisible: false })
    await seedTournamentDirector(directedDraft, director)
    const pastDraft = await tournament({ name: 'Caracal Past Draft Open', date: '2026-05-02', isVisible: false, clubId })
    const listed = await tournament({ name: 'Caracal Listed Open', date: '2026-11-23' })
    const past = await tournament({ name: 'Caracal Spring Open', date: '2026-04-11' })

    // The setup is real: the list of tournaments shows the rep and the director their own drafts.
    const listOf = async (as: string) => (await (await invoke(tournamentsGet, { as })).json<{ tournaments: Array<{ id: string }> }>()).tournaments.map((t) => t.id)
    expect(await listOf(rep)).toContain(repDraft)
    expect(await listOf(director)).toContain(directedDraft)

    // Each viewer asks with a spelling of its own, so each answer is read from the database and none is a kept one.
    const asked: Array<[string | undefined, string]> = [[undefined, 'caracal'], [member, 'caracal open'], [rep, 'open caracal'], [director, 'caracal o'], [admin, 'caracal op']]
    const groupsSeen = new Set<string>()
    for (const [as, q] of asked) {
      const res = await throughEndpoint(q, as)
      expect(res.status, String(as)).toBe(200)
      expect(res.response.headers.get('Cache-Control')).toBe('public, max-age=60')
      const body = await res.json<Body>()
      expect(idsIn(body, 'tournaments'), String(as)).toEqual([`event:${listed}`])
      expect(idsIn(body, 'results'), String(as)).toEqual([`event:${past}`])
      const text = JSON.stringify(body)
      for (const draft of [repDraft, directedDraft, pastDraft]) expect(text, String(as)).not.toContain(draft)
      expect(text).not.toContain('Draft')
      groupsSeen.add(JSON.stringify(body.groups))
    }
    // The same rows for every viewer.
    expect(groupsSeen.size).toBe(1)
  })

  it('answers a request with a token that is no token, or a cookie of its own, with the public answer and never a 401, and an admin signed in with one factor alike', async () => {
    const listed = await tournament({ name: 'Numbat Token Open', date: '2026-11-24' })
    const plain = await (await invoke((context) => answerSearch(context, null), { path: path('numbat token') })).response.text()
    for (const headers of [{ Authorization: 'Bearer not-a-token' }, { Authorization: 'Basic Zml4dHVyZTpmaXh0dXJl' }, { Cookie: 'sb-access-token=fixture; lca=1' }]) {
      const res = await invoke((context) => answerSearch(context, null), { path: path('numbat token'), headers })
      expect(res.status, JSON.stringify(headers)).toBe(200)
      expect(await res.response.text(), JSON.stringify(headers)).toBe(plain)
    }
    // The admin's own pages refuse a sign-in with its first factor alone; the search, which reads no sign-in, answers it as it answers anyone.
    const admin = await seedAdmin()
    const weak = await invoke((context) => answerSearch(context, null), { path: path('numbat token'), as: admin, aal: 'aal1' })
    expect(weak.status).toBe(200)
    expect(await weak.response.text()).toBe(plain)
    expect(idsIn(JSON.parse(plain) as Body, 'tournaments')).toEqual([`event:${listed}`])
  })

  it('answers OPTIONS with 204, the CORS headers and no body at all, for a visitor and for an admin', async () => {
    const admin = await seedAdmin()
    for (const as of [undefined, admin]) {
      const res = await invoke(searchOptions, { method: 'OPTIONS', path: path('caracal'), ...(as ? { as } : {}) })
      expect(res.status, String(as)).toBe(204)
      expect(await res.response.text()).toBe('')
      expect(res.response.headers.get('Access-Control-Allow-Origin')).toBe('*')
      expect(res.response.headers.get('Access-Control-Allow-Methods')).toContain('GET')
      expect(res.response.headers.get('Cache-Control')).toBeNull()
    }
  })
})

// ── What the database says now ─────────────────────────────────────────────

describe('GET /api/search: what the database says now', () => {
  it('finds a draft once it is published and loses an event once it is hidden again, and a club once it is taken away, at once', async () => {
    const id = await tournament({ name: 'Fennec Late Open', date: '2026-12-01', isVisible: false })
    expect(await found('fennec late')).toEqual({ q: 'fennec late', groups: [] })
    await env.DB.prepare('UPDATE tournaments SET is_visible = 1 WHERE id = ?').bind(id).run()
    expect(idsIn(await found('fennec late'), 'tournaments')).toEqual([`event:${id}`])
    await env.DB.prepare('UPDATE tournaments SET is_visible = 0 WHERE id = ?').bind(id).run()
    expect(await found('fennec late')).toEqual({ q: 'fennec late', groups: [] })
    const club = await seedClub({ name: 'Fennec Chess Club', city: 'Bastrop' })
    expect(idsIn(await found('fennec chess'), 'clubs')).toEqual([`club:${club}`])
    await env.DB.prepare('DELETE FROM clubs WHERE id = ?').bind(club).run()
    expect(await found('fennec chess')).toEqual({ q: 'fennec chess', groups: [] })
  })
})

// ── Louisiana's midnight ───────────────────────────────────────────────────

describe('GET /api/search: Louisiana\'s midnight, in daylight time and in standard time', () => {
  it('moves each event from Tournaments to Results at midnight in Louisiana, never at UTC\'s', async () => {
    const saturday = await tournament({ name: 'Gerenuk Saturday Open', date: '2026-10-31' })
    const sunday = await tournament({ name: 'Gerenuk Sunday Open', date: '2026-11-01' })
    const at = async (instant: string) => {
      vi.setSystemTime(new Date(instant))
      const body = await found('gerenuk')
      return [idsIn(body, 'tournaments'), idsIn(body, 'results')]
    }
    // 7:00 PM on Saturday, October 31 in Louisiana, when UTC's date is already Sunday.
    expect(await at('2026-11-01T00:00:00.000Z')).toEqual([[`event:${saturday}`, `event:${sunday}`], []])
    // The last moment of Saturday in Louisiana, in daylight time.
    expect(await at('2026-11-01T04:59:59.999Z')).toEqual([[`event:${saturday}`, `event:${sunday}`], []])
    // Midnight starting Sunday, November 1, in daylight time.
    expect(await at('2026-11-01T05:00:00.000Z')).toEqual([[`event:${sunday}`], [`event:${saturday}`]])
    // The last moment of Sunday in Louisiana, in standard time, when UTC's date is already Monday.
    expect(await at('2026-11-02T05:59:59.999Z')).toEqual([[`event:${sunday}`], [`event:${saturday}`]])
    // Midnight starting Monday, November 2, in standard time: both are results, the later first.
    expect(await at('2026-11-02T06:00:00.000Z')).toEqual([[], [`event:${sunday}`, `event:${saturday}`]])
  })

  it('counts an event of three years less a day ago among the results, and a post of 24 months less a day among the news', async () => {
    const event = await tournament({ name: 'Gharial Old Open', date: '2023-11-02' })
    const slug = await post('Gharial news of long ago', '2024-11-02')
    const body = await found('gharial')
    expect(idsIn(body, 'results')).toEqual([`event:${event}`])
    expect(idsIn(body, 'news')).toEqual([`news:${slug}`])
    expect(group(body, 'results')!.items[0].meta).toBe('Thu, Nov 2, 2023 · Kenner, LA')
  })
})

// ── Ties ───────────────────────────────────────────────────────────────────

describe('GET /api/search: ties, ordered as each group says', () => {
  it('orders the LCA\'s events of one day by name, and results of one last day by name after a later one', async () => {
    for (const name of ['Tayra Open Charlie', 'Tayra Open Alpha', 'Tayra Open Bravo']) await tournament({ name, date: '2026-12-12' })
    for (const name of ['Tayra Final Zulu', 'Tayra Final Echo']) await tournament({ name, date: '2026-08-08' })
    await tournament({ name: 'Tayra Final Kilo', date: '2026-08-07', endDate: '2026-08-09' })
    const body = await found('tayra')
    expect(titlesIn(body, 'tournaments')).toEqual(['Tayra Open Alpha', 'Tayra Open Bravo', 'Tayra Open Charlie'])
    expect(titlesIn(body, 'results')).toEqual(['Tayra Final Kilo', 'Tayra Final Echo', 'Tayra Final Zulu'])
  })

  it('orders partner events Louisiana\'s first, by name on the same day, then the rest of the Gulf South by day and name, though they start sooner', async () => {
    await partner({ name: 'Fossa Bayou Yankee', start: '2026-12-05', city: 'Houma', state: 'LA' })
    await partner({ name: 'Fossa Bayou Delta', start: '2026-12-05', city: 'Houma', state: 'LA' })
    await partner({ name: 'Fossa Coast Kilo', start: '2026-11-10', city: 'Gulfport', state: 'MS' })
    await partner({ name: 'Fossa Bay Alpha', start: '2026-11-10', city: 'Mobile', state: 'AL' })
    const items = group(await found('fossa'), 'tournaments')!.items
    expect(items.map((i) => i.title)).toEqual(['Fossa Bayou Delta', 'Fossa Bayou Yankee', 'Fossa Bay Alpha', 'Fossa Coast Kilo'])
    expect(items.map((i) => i.meta)).toEqual(['Sat, Dec 5, 2026 · Houma', 'Sat, Dec 5, 2026 · Houma', 'Tue, Nov 10, 2026 · Mobile, AL', 'Tue, Nov 10, 2026 · Gulfport, MS'])
  })

  it('orders posts of one day by title after a newer one, and the honor roll by year, its state list before its scholastic one, then by title', async () => {
    await post('Genet news Zebra', '2026-09-09')
    await post('Genet news Apple', '2026-09-09')
    await post('Genet news Mango', '2026-09-10')
    await champion({ year: 2017, title: 'Genet Blitz Champion' })
    await champion({ year: 2017, title: 'Genet K-5', kind: 'scholastic' })
    await champion({ year: 2017, title: 'Genet Amateur Champion' })
    await champion({ year: 2018, title: 'Genet K-8', kind: 'scholastic' })
    const body = await found('genet')
    expect(titlesIn(body, 'news')).toEqual(['Genet news Mango', 'Genet news Apple', 'Genet news Zebra'])
    expect(titlesIn(body, 'champions')).toEqual(['2018 Genet K-8', '2017 Genet Amateur Champion', '2017 Genet Blitz Champion', '2017 Genet K-5'])
  })
})

// ── No bound ahead, the five shared, an empty end date ─────────────────────

describe('GET /api/search: no bound ahead, the five places shared, and an empty end date', () => {
  it('keeps an LCA event two years ahead and a partner event 400 days ahead, the LCA\'s first', async () => {
    const lca = await tournament({ name: 'Hyrax Future Open', date: '2028-10-07' })
    const far = await partner({ name: 'Hyrax Gulf Open', start: '2027-12-06', city: 'Biloxi', state: 'MS' })
    expect(idsIn(await found('hyrax'), 'tournaments')).toEqual([`event:${lca}`, `partner:${far}`])
  })

  it('gives four LCA events the first four places and the Louisiana partner event the fifth, though both partner events start sooner', async () => {
    const lca = []
    for (let i = 1; i <= 4; i++) lca.push(await tournament({ name: `Binturong Open ${i}`, date: `2026-12-1${i}` }))
    await partner({ name: 'Binturong Coast Open', start: '2026-11-03', city: 'Biloxi', state: 'MS' })
    const la = await partner({ name: 'Binturong Bayou Open', start: '2026-11-04', city: 'Thibodaux', state: 'LA' })
    expect(idsIn(await found('binturong'), 'tournaments')).toEqual([...lca.map((id) => `event:${id}`), `partner:${la}`])
  })

  it('reads an empty end date as none, for an LCA event and for a partner event', async () => {
    const yesterday = await tournament({ name: 'Ibex Saturday Open', date: '2026-10-31', endDate: '' })
    const today = await tournament({ name: 'Ibex Sunday Open', date: '2026-11-01', endDate: '' })
    const partnerToday = await partner({ name: 'Ibex Gulf Sunday', start: '2026-11-01', end: '', state: 'LA', city: 'Opelousas' })
    await partner({ name: 'Ibex Gulf Saturday', start: '2026-10-31', end: '', state: 'LA', city: 'Opelousas' })
    const body = await found('ibex')
    expect(idsIn(body, 'tournaments')).toEqual([`event:${today}`, `partner:${partnerToday}`])
    expect(idsIn(body, 'results')).toEqual([`event:${yesterday}`])
    expect(group(body, 'tournaments')!.items[0].meta).toBe('Sun, Nov 1, 2026 · Kenner, LA')
  })

  it('keeps a published post dated ahead and one of today, newest first, as the news page lists every published post', async () => {
    const ahead = await post('Jerboa news ahead', '2027-01-15')
    const today = await post('Jerboa news today', '2026-11-01')
    expect(idsIn(await found('jerboa'), 'news')).toEqual([`news:${ahead}`, `news:${today}`])
  })

  it('finds a result by its city and the year it ended, and not by another year', async () => {
    const id = await tournament({ name: 'Dhole Summer Open', date: '2025-06-14', location: 'Shreveport, LA' })
    expect(idsIn(await found('shreveport 2025'), 'results')).toEqual([`event:${id}`])
    expect(idsIn(await found('dhole 2025'), 'results')).toEqual([`event:${id}`])
    expect(await found('dhole 2024')).toEqual({ q: 'dhole 2024', groups: [] })
  })
})

// ── D9 and the private columns ─────────────────────────────────────────────

describe('GET /api/search: no column that is a person\'s name or private is read or matched (D9)', () => {
  it('finds nothing by a member\'s name, a partner event\'s organizer or contact, a club\'s contact email or description, an event\'s organizer, description or venue, or a champion\'s name, notes, photo or row id', async () => {
    await seedMember({ fullName: 'Zorilla Memberperson', email: 'zorilla.member@test.lca' })
    await partner({ name: 'Plain Gulf Classic', start: '2026-12-02', city: 'Hattiesburg', state: 'MS', organizer: 'Xenops Organizerperson', contact: 'xenops.contact@example.org' })
    const club = await seedClub({ name: 'Plain Chess Circle', city: 'Zachary' })
    await env.DB.prepare('UPDATE clubs SET contact_email = ?, description = ? WHERE id = ?').bind('wrenfield.club@example.org', 'Run by Wrenfield Clubperson', club).run()
    const event = await tournament({ name: 'Plain Winter Classic', date: '2026-12-19' })
    await env.DB.prepare('UPDATE tournaments SET organizer = ?, description = ?, venue = ? WHERE id = ?').bind('Vireo Organizerperson', 'Directed by Quillon Directorperson', 'Tanglewood Hall', event).run()
    await champion({ year: 2015, title: 'Plain Rapid Champion', champion: 'Sora Fixtureperson', id: 'lca-state-2015-plain-rapid-champion-sora-fixtureperson', notes: 'Coached by Umbra Coachperson', photo: '/champions/photos/state-2015-tanager-fixtureperson.jpg' })

    // The rows are there, found by their own words.
    expect(idsIn(await found('plain gulf classic'), 'tournaments')).toHaveLength(1)
    expect(idsIn(await found('plain chess circle'), 'clubs')).toEqual([`club:${club}`])
    expect(idsIn(await found('plain winter classic'), 'tournaments')).toEqual([`event:${event}`])
    expect(idsIn(await found('plain rapid champion'), 'champions')).toEqual(['champions:state:2015:plain-rapid-champion'])

    for (const q of [
      'zorilla', 'zorilla memberperson', 'zorilla.member@test.lca', 'xenops', 'xenops organizerperson', 'xenops.contact', 'wrenfield', 'wrenfield.club@example.org',
      'vireo', 'quillon', 'tanglewood', 'sora', 'sora fixtureperson', 'umbra', 'coached', 'tanager', 'photos', 'lca state 2015 plain',
    ]) {
      expect(await found(q), q).toEqual({ q: normalizeSearchText(q), groups: [] })
    }
  })

  it('finds no Champions row by the name of any champion on the honor roll\'s own rows: every one tried, each row found explained by its year and title alone', async () => {
    const { results } = await env.DB.prepare(`SELECT DISTINCT champion FROM state_champions WHERE id LIKE 'lca-%' AND champion <> 'Sora Fixtureperson'`).all<{ champion: string }>()
    expect(results.length).toBeGreaterThan(50)
    for (const { champion: name } of results) {
      const q = normalizeSearchText(name)
      if (Array.from(q).length < 2 || Array.from(q).length > 64) continue
      const body = await found(name)
      for (const item of group(body, 'champions')?.items ?? []) {
        // A champions row comes back only when its own year and title answer the search, never for the name.
        expect(matchesSearch(normalizeSearchText(item.title), q), `${item.id} for a champion's name`).toBe(true)
      }
      for (const g of body.groups.filter((g) => g.type !== 'news')) {
        for (const item of g.items) expect(`${item.title} ${item.meta ?? ''}`.toLowerCase(), item.id).not.toContain(name.toLowerCase())
      }
    }
  })

  it('reads from each table only the columns its rows need, as the database itself reports them', async () => {
    await tournament({ name: 'Kiang Columns Open', date: '2026-12-03' })
    await tournament({ name: 'Kiang Columns Result', date: '2026-03-07' })
    await partner({ name: 'Kiang Gulf Columns', start: '2026-12-04', organizer: 'Kiang Organizerperson', contact: 'kiang@example.org' })
    const rows = await readSearchRows(env.DB, searchWindows('2026-11-01'))
    const columns = (list: object[]) => {
      expect(list.length).toBeGreaterThan(0)
      return [...new Set(list.flatMap((row) => Object.keys(row)))].sort()
    }
    expect(columns(rows.upcoming)).toEqual(['date', 'end_date', 'id', 'location', 'name', 'registration_closes_at', 'registration_status'])
    expect(columns(rows.results)).toEqual(['date', 'end_date', 'id', 'location', 'name'])
    expect(columns(rows.partners)).toEqual(['city', 'end_date', 'id', 'link', 'name', 'start_date', 'state'])
    expect(columns(rows.clubs)).toEqual(['city', 'id', 'name', 'region'])
    expect(columns(rows.posts)).toEqual(['published_at', 'slug', 'title'])
    expect(columns(rows.champions)).toEqual(['kind', 'title', 'year'])
  })
})

// ── The edge's cache in this runtime ───────────────────────────────────────

describe('GET /api/search: the edge\'s cache in this runtime', () => {
  it('keeps one answer for every spelling that normalises alike, under its key, and gives it back to the next of them', async () => {
    await seedClub({ name: 'Saint Jaguarundi Chess Club', city: 'Kaplan' })
    const first = await throughEndpoint('Saint Jaguarundi')
    expect(first.status).toBe(200)
    const body = await first.json<Body>()
    expect(idsIn(body, 'clubs')).toHaveLength(1)
    await seedClub({ name: 'St. Jaguarundi Knights', city: 'Crowley' })
    const second = await throughEndpoint('st.  jaguarundi')
    const again = await second.json<Body>()
    const cache = edge()
    if (cache) {
      expect(again, 'the answer kept for "st jaguarundi", the club added since not in it').toEqual(body)
      const kept = await cache.match(searchCacheKey(ORIGIN, 'st jaguarundi'))
      expect(kept, 'kept under the normalised search').toBeDefined()
      expect(await kept!.json()).toEqual(body)
    } else {
      expect(idsIn(again, 'clubs'), 'no cache, so the club added since is read').toHaveLength(2)
    }
  })

  it('keeps an answer under the request\'s own origin, apart from the same search on another origin', async () => {
    await seedClub({ name: 'Kinkajou Origin Club', city: 'Minden' })
    const elsewhere = 'https://www.louisianachess.org'
    const pending: Promise<unknown>[] = []
    const context = {
      request: new Request(`${elsewhere}${path('kinkajou origin')}`),
      env: env as unknown as Env,
      params: {},
      data: {},
      functionPath: '/api/search',
      waitUntil: (work: Promise<unknown>) => { pending.push(work) },
      passThroughOnException: () => {},
      next: async () => new Response(null, { status: 404 }),
    } as unknown as EventContext<Env, string, unknown>
    const res = await searchGet(context)
    expect(res.status).toBe(200)
    await Promise.all(pending)
    const cache = edge()
    if (cache) {
      expect(await cache.match(searchCacheKey(elsewhere, 'kinkajou origin')), 'kept on its own origin').toBeDefined()
      expect(await cache.match(searchCacheKey(ORIGIN, 'kinkajou origin')), 'nothing kept on the other').toBeUndefined()
    } else {
      expect(pending).toEqual([])
    }
  })

  it('keeps no answer to a search it refuses', async () => {
    for (const q of ['a', 'é', 'b'.repeat(65)]) {
      const res = await throughEndpoint(q)
      expect(res.status, q).toBe(400)
      expect(res.response.headers.get('Cache-Control'), q).toBeNull()
      const cache = edge()
      if (cache) expect(await cache.match(searchCacheKey(ORIGIN, normalizeSearchText(q))), q).toBeUndefined()
    }
  })

  it('gives back a kept answer that keeps its contract and its Cache-Control, the same to a visitor, a member and an admin', async () => {
    await tournament({ name: 'Margay Kept Open', date: '2026-11-28' })
    await seedClub({ name: 'Margay Kept Club', city: 'Eunice' })
    const member = await seedMember()
    const admin = await seedAdmin()
    const answers = []
    for (const as of [undefined, member, admin]) {
      const res = await throughEndpoint('margay kept', as)
      expect(res.status).toBe(200)
      expect(res.response.headers.get('Cache-Control')).toBe('public, max-age=60')
      const body = await expectContract(res, contracts['search'].GET.response)
      expect(body.groups.map((g) => g.type)).toEqual(['tournaments', 'clubs'])
      answers.push(JSON.stringify(body))
    }
    expect(new Set(answers).size).toBe(1)
  })
})

// ── The bound and the schema ───────────────────────────────────────────────

describe('GET /api/search: the bound of 500 rows a read, and the schema', () => {
  it('reads at most 500 clubs, by name, however many the table holds, and still answers', async () => {
    const before = (await env.DB.prepare('SELECT COUNT(*) AS n FROM clubs').first<{ n: number }>())!.n
    const extra = SEARCH_READ_LIMIT + 100 - before
    await env.DB.prepare(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ?)
       INSERT INTO clubs (id, name, city) SELECT 'fx-bulk-' || i, 'Kudu Bulk Club ' || substr('0000' || i, -4), 'Alexandria' FROM n`,
    ).bind(extra).run()
    try {
      expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM clubs').first<{ n: number }>())!.n).toBe(SEARCH_READ_LIMIT + 100)
      const { clubs } = await readSearchRows(env.DB, searchWindows('2026-11-01'))
      expect(clubs).toHaveLength(SEARCH_READ_LIMIT)
      const names = clubs.map((c) => c.name)
      expect([...names].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))).toEqual(names)
      const body = await found('kudu bulk')
      expect(group(body, 'clubs')!.items.map((i) => i.title)).toEqual(['Kudu Bulk Club 0001', 'Kudu Bulk Club 0002', 'Kudu Bulk Club 0003', 'Kudu Bulk Club 0004', 'Kudu Bulk Club 0005'])
    } finally {
      await env.DB.prepare(`DELETE FROM clubs WHERE id LIKE 'fx-bulk-%'`).run()
    }
  })

  it('has no cancelled status for a tournament: the schema refuses one, so none needs leaving out', async () => {
    await expect(
      env.DB.prepare(`INSERT INTO tournaments (id, name, location, date, status) VALUES ('fx-cancelled', 'Fixture Cancelled Open', 'Kenner, LA', '2026-12-05', 'cancelled')`).run(),
    ).rejects.toThrow(/CHECK constraint failed/)
    for (const status of ['upcoming', 'active', 'completed']) {
      await env.DB.prepare(`INSERT INTO tournaments (id, name, location, date, status) VALUES (?, 'Fixture Status Open', 'Kenner, LA', '2026-12-05', ?)`).bind(`fx-status-${status}`, status).run()
    }
    await env.DB.prepare(`DELETE FROM tournaments WHERE id LIKE 'fx-status-%'`).run()
  })
})
