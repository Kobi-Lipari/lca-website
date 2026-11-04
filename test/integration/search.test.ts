// test/integration/search.test.ts
//
// GET /api/search (WS02 step 9) in the Workers runtime, against the
// migrations' own rows (25 clubs, three posts and the honor roll) and each
// test's, seeded here and never read from anywhere else. The clock is held
// at noon on Sunday, November 1, 2026 in Louisiana, or at 10:30 PM that
// evening, when UTC's date is already Monday, so the windows are known. The
// rows a test adds stay for the tests after it in this file, so each test
// searches words of its own.
//
// The content cases answer through answerSearch with no cache, so no answer
// kept by an earlier case serves a later one; the cache's own case calls the
// handler itself and says what the runtime gave for the Cache API.
//
// - no hidden draft, for a visitor or an admin, in either group (D26);
// - the Tournaments and Results groups by Louisiana's day: today, yesterday,
//   three years to the day, three years and a day, an end date past today,
//   and no event in two groups;
// - the partner events after the LCA's, Louisiana's first, each with its
//   organizer's page and external, no tag; none with no web address, and
//   none of the LCA's own;
// - the clubs with their regions, the posts of the window alone, and the
//   honor roll by year and title, a champion's name read nowhere (D9);
// - "Saint" against a stored "St.", and alone never the start of "State";
//   "&" against a stored "and"; and a stored letter with its mark found by
//   its plain letter;
// - five rows a group and twenty in all;
// - the answer's keys exactly the brief's, no member's name or email, no fee
//   and no count, and the same signed out, as a member and as an admin;
// - a 400 in plain words for a search too short, too long or missing;
// - the rows each of the six reads returned.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizeSearchText } from '../../domain/format/searchText'
import { onRequestGet as searchGet } from '../../functions/api/search'
import { SEARCH_READ_LIMIT, answerSearch, readSearchRows, searchWindows } from '../../functions/utils/search'
import { seedAdmin, seedClub, seedMember, seedRegistration, seedTournament } from './factories'
import { flushWaitUntil, invoke, resetHarness } from './harness'

/** Noon on Sunday, November 1, 2026 in Louisiana. */
const NOON = '2026-11-01T18:00:00.000Z'

interface Item { id: string; title: string; meta?: string; href: string; tag?: { label: string; tone: string }; external?: boolean }
interface Group { type: string; label: string; items: Item[] }
interface Body { q: string; groups: Group[] }

/** A search answered from the database alone, as a visitor or as the member given. */
async function search(q: string | null, as?: string) {
  const path = q === null ? '/api/search' : `/api/search?q=${encodeURIComponent(q)}`
  return invoke((context) => answerSearch(context, null), { path, ...(as ? { as } : {}) })
}
async function found(q: string, as?: string): Promise<Body> {
  const res = await search(q, as)
  expect(res.status).toBe(200)
  return res.json<Body>()
}
const group = (body: Body, type: string) => body.groups.find((g) => g.type === type)
const idsIn = (body: Body, type: string) => group(body, type)?.items.map((i) => i.id) ?? []

/** A tournament with the columns its factory does not take. */
async function tournament(opts: Parameters<typeof seedTournament>[0] & { endDate?: string | null; location?: string } = {}) {
  const { endDate = null, location = 'Kenner, LA', ...rest } = opts
  const id = await seedTournament(rest)
  await env.DB.prepare('UPDATE tournaments SET end_date = ?, location = ? WHERE id = ?').bind(endDate, location, id).run()
  return id
}
let partners = 0
async function partner(row: { name: string; start: string; end?: string | null; city?: string | null; state?: string | null; link?: string | null; isLca?: 0 | 1 }) {
  const id = `fx-partner-${++partners}`
  await env.DB.prepare(
    `INSERT INTO clearinghouse (id, name, start_date, end_date, organizer, city, state, contact, link, is_lca)
     VALUES (?, ?, ?, ?, 'Fixture Organizerperson', ?, ?, 'fixture-organizer@example.org', ?, ?)`,
  ).bind(id, row.name, row.start, row.end ?? null, row.city ?? null, row.state ?? null, row.link === undefined ? 'https://example.org/event' : row.link, row.isLca ?? 0).run()
  return id
}
let posts = 0
async function post(row: { title: string; status?: 'draft' | 'published'; publishedAt?: string | null }) {
  const slug = `fixture-post-${++posts}`
  await env.DB.prepare(
    `INSERT INTO lca_posts (id, slug, title, summary, status, published_at) VALUES (?, ?, ?, 'A fixture post.', ?, ?)`,
  ).bind(`fx-post-${posts}`, slug, row.title, row.status ?? 'published', row.publishedAt === undefined ? '2026-09-01' : row.publishedAt).run()
  return slug
}
async function champion(row: { year: number; title: string; champion: string; kind?: 'state' | 'scholastic' }) {
  await env.DB.prepare(
    `INSERT INTO state_champions (year, title, champion, notes, kind, photo_url) VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(row.year, row.title, row.champion, `Won by ${row.champion}`, row.kind ?? 'state', `/champions/photos/${row.champion.toLowerCase().replace(/\s+/g, '-')}.jpg`).run()
}

beforeEach(() => {
  resetHarness()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(NOON))
})
afterEach(() => {
  vi.useRealTimers()
})

describe('GET /api/search: listed events alone (D26)', () => {
  it('never returns a hidden draft whose name matches, to a visitor or to an admin, in either group', async () => {
    const upcomingDraft = await tournament({ name: 'Quillfeather Draft Open', date: '2026-11-20', isVisible: false })
    const pastDraft = await tournament({ name: 'Quillfeather Draft Classic', date: '2026-06-06', isVisible: false })
    const upcoming = await tournament({ name: 'Quillfeather Rapid', date: '2026-11-21' })
    const past = await tournament({ name: 'Quillfeather Blitz', date: '2026-05-02' })
    const admin = await seedAdmin()
    for (const viewer of [undefined, admin]) {
      const body = await found('quillfeather', viewer)
      expect(idsIn(body, 'tournaments'), String(viewer)).toEqual([`event:${upcoming}`])
      expect(idsIn(body, 'results'), String(viewer)).toEqual([`event:${past}`])
      const text = JSON.stringify(body)
      expect(text).not.toContain(upcomingDraft)
      expect(text).not.toContain(pastDraft)
      expect(text).not.toContain('Draft')
    }
  })
})

describe('GET /api/search: the Tournaments and Results groups by Louisiana\'s day', () => {
  it('puts today\'s event and one that ends today in Tournaments, yesterday\'s and one of three years ago to the day in Results, one three years and a day old in neither, and none in two', async () => {
    const today = await tournament({ name: 'Marmoset Today Open', date: '2026-11-01' })
    const span = await tournament({ name: 'Marmoset Weekend Open', date: '2026-10-30', endDate: '2026-11-01' })
    const yesterday = await tournament({ name: 'Marmoset Yesterday Open', date: '2026-10-31' })
    const edge = await tournament({ name: 'Marmoset Edge Open', date: '2023-11-01' })
    await tournament({ name: 'Marmoset Old Open', date: '2023-10-31' })
    // Marked completed before its day, and left as upcoming after it: the dates decide, not the status.
    const early = await tournament({ name: 'Marmoset Early Open', date: '2026-11-07', status: 'completed' })
    const late = await tournament({ name: 'Marmoset Late Open', date: '2026-10-03', status: 'upcoming' })
    const body = await found('marmoset')
    expect(idsIn(body, 'tournaments')).toEqual([`event:${span}`, `event:${today}`, `event:${early}`])
    expect(idsIn(body, 'results')).toEqual([`event:${yesterday}`, `event:${late}`, `event:${edge}`])
    expect(group(body, 'tournaments')!.items[0].meta).toBe('Fri, Oct 30, 2026 to Sun, Nov 1, 2026 · Kenner, LA')
    expect(group(body, 'results')!.items[0]).toEqual({
      id: `event:${yesterday}`, title: 'Marmoset Yesterday Open', meta: 'Sat, Oct 31, 2026 · Kenner, LA', href: `/tournaments/${yesterday}`,
      tag: { label: 'Final standings', tone: 'final' },
    })
    const all = body.groups.flatMap((g) => g.items.map((i) => i.id))
    expect(new Set(all).size).toBe(all.length)
    expect(JSON.stringify(body)).not.toContain('Marmoset Old Open')
  })

  it('still counts Sunday as today at 10:30 PM in Louisiana, when UTC\'s date is already Monday', async () => {
    vi.setSystemTime(new Date('2026-11-02T04:30:00.000Z'))
    const sunday = await tournament({ name: 'Narwhal Sunday Open', date: '2026-11-01' })
    const saturday = await tournament({ name: 'Narwhal Saturday Open', date: '2026-10-31' })
    const body = await found('narwhal')
    expect(idsIn(body, 'tournaments')).toEqual([`event:${sunday}`])
    expect(idsIn(body, 'results')).toEqual([`event:${saturday}`])
  })

  it('gives an upcoming event its registration in words, by the registration endpoint\'s rule', async () => {
    const open = await tournament({ name: 'Kinkajou Open', date: '2026-11-14' })
    const closing = await tournament({ name: 'Kinkajou Closed Early', date: '2026-11-15', registrationClosesAt: '2026-11-01T09:00' })
    const draft = await tournament({ name: 'Kinkajou Soon', date: '2026-11-16', registrationStatus: 'draft' })
    const closed = await tournament({ name: 'Kinkajou Shut', date: '2026-11-17', registrationStatus: 'closed' })
    const tags = Object.fromEntries(group(await found('kinkajou'), 'tournaments')!.items.map((i) => [i.id, i.tag]))
    expect(tags).toEqual({
      [`event:${open}`]: { label: 'Registration open', tone: 'open' },
      [`event:${closing}`]: { label: 'Registration closed', tone: 'closed' },
      [`event:${draft}`]: { label: 'Opens soon', tone: 'soon' },
      [`event:${closed}`]: { label: 'Registration closed', tone: 'closed' },
    })
  })
})

describe('GET /api/search: the partner events', () => {
  it('come after the LCA events in the Tournaments group, Louisiana\'s first, each external with its organizer\'s page and no tag; none with no web address and none of the LCA\'s own', async () => {
    const lca = await tournament({ name: 'Ocelot Club Open', date: '2026-12-05' })
    const la = await partner({ name: 'Ocelot Bayou Open', start: '2026-12-01', city: 'Lafayette', state: 'LA', link: 'https://example.org/bayou' })
    const ms = await partner({ name: 'Ocelot Coast Open', start: '2026-11-20', city: 'Biloxi', state: 'MS', link: 'https://example.org/coast' })
    const underWay = await partner({ name: 'Ocelot Long Open', start: '2026-10-30', end: '2026-11-02', city: 'Mobile', state: 'AL', link: 'https://example.org/long' })
    await partner({ name: 'Ocelot Nowhere Open', start: '2026-11-22', state: 'LA', link: null })
    await partner({ name: 'Ocelot Twin Open', start: '2026-11-23', state: 'LA', link: 'https://www.louisianachess.org/tournaments/x', isLca: 1 })
    await partner({ name: 'Ocelot Past Open', start: '2026-10-24', state: 'LA' })
    const body = await found('ocelot')
    expect(body.groups.map((g) => g.type)).toEqual(['tournaments'])
    expect(group(body, 'tournaments')!.items).toEqual([
      { id: `event:${lca}`, title: 'Ocelot Club Open', meta: 'Sat, Dec 5, 2026 · Kenner, LA', href: `/tournaments/${lca}`, tag: { label: 'Registration open', tone: 'open' } },
      { id: `partner:${la}`, title: 'Ocelot Bayou Open', meta: 'Tue, Dec 1, 2026 · Lafayette', href: 'https://example.org/bayou', external: true },
      { id: `partner:${underWay}`, title: 'Ocelot Long Open', meta: 'Fri, Oct 30, 2026 · Mobile, AL', href: 'https://example.org/long', external: true },
      { id: `partner:${ms}`, title: 'Ocelot Coast Open', meta: 'Fri, Nov 20, 2026 · Biloxi, MS', href: 'https://example.org/coast', external: true },
    ])
    // The organizer and the contact are never read.
    expect(JSON.stringify(body)).not.toMatch(/Organizerperson|fixture-organizer/)
  })
})

describe('GET /api/search: clubs, posts and the honor roll', () => {
  it('gives a club its city and its region, and one with no region its city alone', async () => {
    const chess = await seedClub({ name: 'Pangolin Chess Club', city: 'Ruston' })
    await env.DB.prepare('UPDATE clubs SET region = ? WHERE id = ?').bind('North Louisiana', chess).run()
    const knights = await seedClub({ name: 'Pangolin Knights', city: 'Hammond' })
    expect(group(await found('pangolin'), 'clubs')!.items).toEqual([
      { id: `club:${chess}`, title: 'Pangolin Chess Club', meta: 'Ruston · North Louisiana', href: `/clubs/${chess}` },
      { id: `club:${knights}`, title: 'Pangolin Knights', meta: 'Hammond', href: `/clubs/${knights}` },
    ])
  })

  it('gives the posts published in the last 24 months alone, never a draft, newest first', async () => {
    const recent = await post({ title: 'Quetzal season opens', publishedAt: '2026-09-01' })
    const edge = await post({ title: 'Quetzal two years on', publishedAt: '2024-11-01' })
    await post({ title: 'Quetzal draft notes', status: 'draft', publishedAt: '2026-10-01' })
    await post({ title: 'Quetzal old notes', publishedAt: '2024-10-31' })
    await post({ title: 'Quetzal undated notes', publishedAt: null })
    expect(group(await found('quetzal'), 'news')!.items).toEqual([
      { id: `news:${recent}`, title: 'Quetzal season opens', meta: 'Tue, Sep 1, 2026', href: `/news/${recent}` },
      { id: `news:${edge}`, title: 'Quetzal two years on', meta: 'Fri, Nov 1, 2024', href: `/news/${edge}` },
    ])
  })

  it('gives the honor roll by year and title, one row for co-champions, and never a champion\'s name, so a search of the name finds no Champions row (D9)', async () => {
    await champion({ year: 2019, title: 'Wombat Rapid Champion', champion: 'Zanzibar Fixtureperson' })
    await champion({ year: 2019, title: 'Wombat Rapid Champion', champion: 'Yonderly Fixtureperson' })
    await champion({ year: 2018, title: 'Wombat K-8', champion: 'Xerxes Fixtureperson', kind: 'scholastic' })
    const body = await found('wombat')
    expect(body.groups.map((g) => g.type)).toEqual(['champions'])
    expect(group(body, 'champions')!.items).toEqual([
      { id: 'champions:state:2019:wombat-rapid-champion', title: '2019 Wombat Rapid Champion', meta: 'State champions', href: '/champions#state-champions' },
      { id: 'champions:scholastic:2018:wombat-k-8', title: '2018 Wombat K-8', meta: 'Scholastic champions', href: '/champions#scholastic-champions' },
    ])
    expect(JSON.stringify(body)).not.toMatch(/Fixtureperson|Zanzibar|Yonderly|Xerxes|photos|Won by/)
    for (const name of ['Zanzibar', 'zanzibar fixtureperson', 'Fixtureperson', 'Xerxes']) expect(await found(name), name).toEqual({ q: name.toLowerCase(), groups: [] })
  })
})

describe('GET /api/search: matching the stored words', () => {
  it('finds a stored "St." for "Saint", a stored "and" for "&" and the other way, and a stored letter with its mark by its plain letter', async () => {
    const ignatius = await seedClub({ name: 'St. Ignatius Chess Club', city: 'Gonzales' })
    const checkers = await tournament({ name: 'Xylophone Chess & Checkers Open', date: '2026-11-28' })
    const knights = await tournament({ name: 'Xylophone Bishops and Knights', date: '2026-11-29' })
    const yukon = await seedClub({ name: 'Café Yukon Échecs', city: 'Thibodaux' })
    expect(idsIn(await found('Saint Ignatius'), 'clubs')).toEqual([`club:${ignatius}`])
    expect(idsIn(await found('st ignatius'), 'clubs')).toEqual([`club:${ignatius}`])
    // "Saint" alone finds the word whole, never the start of State: none of the honor roll's State titles.
    const saint = await found('Saint')
    expect(saint.q).toBe('st')
    expect(group(saint, 'champions'), 'the honor roll\'s State titles').toBeUndefined()
    expect(idsIn(saint, 'clubs')).toContain(`club:${ignatius}`)
    for (const item of saint.groups.flatMap((g) => g.items)) expect(` ${normalizeSearchText(`${item.title} ${item.meta ?? ''}`)} `, item.id).toContain(' st ')
    expect(await found('St.')).toEqual(saint)
    expect(idsIn(await found('xylophone chess and checkers'), 'tournaments')).toEqual([`event:${checkers}`])
    expect(idsIn(await found('xylophone bishops & knights'), 'tournaments')).toEqual([`event:${knights}`])
    expect(idsIn(await found('cafe yukon echecs'), 'clubs')).toEqual([`club:${yukon}`])
    expect(idsIn(await found('CAFÉ YUKON'), 'clubs')).toEqual([`club:${yukon}`])
  })

  it('matches a word only where a word of the row starts with it', async () => {
    const id = await seedClub({ name: 'Mongoose Morphy Club', city: 'Slidell' })
    expect(idsIn(await found('mongoose morph'), 'clubs')).toEqual([`club:${id}`])
    expect(await found('ongoose')).toEqual({ q: 'ongoose', groups: [] })
  })
})

describe('GET /api/search: the caps', () => {
  it('keeps five rows a group and twenty in all, a group the twenty leave no room for left out', async () => {
    for (let i = 0; i < 6; i++) {
      await tournament({ name: `Vicuna Open ${i}`, date: `2026-12-${String(10 + i).padStart(2, '0')}` })
      await tournament({ name: `Vicuna Result ${i}`, date: `2026-0${i + 1}-15` })
      await seedClub({ name: `Vicuna Club ${i}`, city: 'Alexandria' })
      await post({ title: `Vicuna news ${i}`, publishedAt: `2026-0${i + 1}-20` })
      await champion({ year: 2000 + i, title: 'Vicuna Champion', champion: `Fixture Holder ${i}` })
    }
    const body = await found('vicuna')
    expect(body.groups.map((g) => [g.type, g.items.length])).toEqual([['tournaments', 5], ['clubs', 5], ['news', 5], ['results', 5]])
    expect(body.groups.flatMap((g) => g.items)).toHaveLength(20)
    expect(group(body, 'tournaments')!.items.map((i) => i.title)).toEqual(['Vicuna Open 0', 'Vicuna Open 1', 'Vicuna Open 2', 'Vicuna Open 3', 'Vicuna Open 4'])
    expect(group(body, 'news')!.items.map((i) => i.title)).toEqual(['Vicuna news 5', 'Vicuna news 4', 'Vicuna news 3', 'Vicuna news 2', 'Vicuna news 1'])
    expect(group(body, 'results')!.items.map((i) => i.title)).toEqual(['Vicuna Result 5', 'Vicuna Result 4', 'Vicuna Result 3', 'Vicuna Result 2', 'Vicuna Result 1'])
  })
})

describe('GET /api/search: nothing private, and the same for everyone', () => {
  it('holds only the brief\'s keys, no member\'s name or email, no fee and no count, and the same answer and headers signed out, as a member and as an admin', async () => {
    const event = await tournament({ name: 'Aardwolf Open', date: '2026-11-21', entryFee: 35, maxPlayers: 40 })
    const player = await seedMember({ fullName: 'Aardwolf Memberperson', email: 'aardwolf.member@test.lca' })
    await seedRegistration({ tournamentId: event, memberId: player })
    const club = await seedClub({ name: 'Aardwolf Chess Club', city: 'Houma' })
    await env.DB.prepare('UPDATE clubs SET contact_email = ?, description = ? WHERE id = ?').bind('aardwolf.club@test.lca', 'Run by Aardwolf Memberperson', club).run()
    await post({ title: 'Aardwolf news' })
    const admin = await seedAdmin()
    const answers = []
    for (const viewer of [undefined, player, admin]) {
      const res = await search('aardwolf', viewer)
      expect(res.status).toBe(200)
      answers.push({ text: await res.response.clone().text(), headers: [...res.response.headers.entries()] })
    }
    expect(new Set(answers.map((a) => a.text)).size).toBe(1)
    expect(new Set(answers.map((a) => JSON.stringify(a.headers))).size).toBe(1)
    expect(answers[0].headers).toEqual(expect.arrayContaining([['cache-control', 'public, max-age=60']]))
    expect(answers[0].headers.map(([name]) => name)).not.toContain('vary')
    const body = JSON.parse(answers[0].text) as Body
    expect(Object.keys(body).sort()).toEqual(['groups', 'q'])
    expect(body.groups.map((g) => g.type)).toEqual(['tournaments', 'clubs', 'news'])
    for (const g of body.groups) {
      expect(Object.keys(g).sort()).toEqual(['items', 'label', 'type'])
      for (const item of g.items) {
        for (const key of Object.keys(item)) expect(['external', 'href', 'id', 'meta', 'tag', 'title']).toContain(key)
        if (item.tag) expect(Object.keys(item.tag).sort()).toEqual(['label', 'tone'])
      }
    }
    expect(answers[0].text).not.toMatch(/Memberperson|@test\.lca|count|fee|email|registration_|max_players|description/)
  })
})

describe('GET /api/search: the query', () => {
  it.each([
    ['one letter', 'a'],
    ['65 letters', 'b'.repeat(65)],
    ['punctuation alone', '?!'],
    ['nothing', ''],
    ['no q at all', null],
  ])('answers 400 in plain words for %s, with no Cache-Control', async (_what, q) => {
    const res = await search(q)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Search for 2 to 64 letters or numbers.' })
    expect(res.response.headers.get('Cache-Control')).toBeNull()
  })

  it('takes the first q when the address names two, and answers the query as normalised', async () => {
    const res = await invoke((context) => answerSearch(context, null), { path: '/api/search?q=Saint%20Ignatius&q=other' })
    expect((await res.json<Body>()).q).toBe('st ignatius')
  })
})

describe('GET /api/search: the edge\'s cache in this runtime', () => {
  it('answers through the handler, and a repeated search within the minute from the cache where the runtime has one, from the database where it has none', async () => {
    const runtime = { caches: typeof caches, default: typeof (globalThis as { caches?: { default?: unknown } }).caches?.default }
    console.info(`The Cache API in this runtime: typeof caches is ${runtime.caches}, typeof caches.default is ${runtime.default}`)
    await seedClub({ name: 'Bandicoot Chess Club', city: 'Lake Charles' })
    const first = await invoke(searchGet, { path: '/api/search?q=bandicoot' })
    expect(first.status).toBe(200)
    expect(first.response.headers.get('Cache-Control')).toBe('public, max-age=60')
    expect(idsIn(await first.json<Body>(), 'clubs')).toHaveLength(1)
    await flushWaitUntil()
    await seedClub({ name: 'Bandicoot Knights', city: 'Sulphur' })
    const second = await invoke(searchGet, { path: '/api/search?q=Bandicoot' })
    expect(second.status).toBe(200)
    const again = idsIn(await second.json<Body>(), 'clubs')
    if (runtime.default === 'object') expect(again, 'kept for a minute, so the club added since is not in it').toHaveLength(1)
    else expect(again, 'no cache, so the club added since is read').toHaveLength(2)
  })
})

describe('GET /api/search: the reads', () => {
  it('bounds each of the six reads at 500 rows and says how many each returned here', async () => {
    const rows = await readSearchRows(env.DB, searchWindows('2026-11-01'))
    const counts = Object.fromEntries(Object.entries(rows).map(([read, list]) => [read, list.length]))
    console.info(`Rows each read returned, in this file's database: ${JSON.stringify(counts)}`)
    for (const [read, n] of Object.entries(counts)) expect(n, read).toBeLessThanOrEqual(SEARCH_READ_LIMIT)
    // The migrations' own rows are among them: 25 clubs, three posts of the window and the honor roll's pairs of year and title.
    expect(counts.clubs).toBeGreaterThanOrEqual(25)
    expect(counts.posts).toBeGreaterThanOrEqual(3)
    expect(counts.champions).toBeGreaterThanOrEqual(151)
  })
})
