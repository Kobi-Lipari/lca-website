// test/unit/search.test.ts
//
// The site's search (WS02 step 9) in its pure parts, with no database: the
// normaliser and the match in domain/format/searchText.ts, and what
// functions/utils/search.ts does with what the reads return, given here as
// rows of its own and through a stand-in for the database and one for the
// edge's cache:
//
// - the normaliser: small letters, the marks taken off, "&" as "and", every
//   run of punctuation, dashes and symbols a space, the whole word "saint" as
//   "st", one space between words; the match, every word of the query
//   starting a word of the text, but "st", which finds only the whole word,
//   so a search for Saint never finds State; the query's bounds, 2 to 64
//   characters once normalised, counted as characters rather than as code
//   units;
// - Louisiana's day at an instant, either side of the clock going back on
//   Sunday, November 1, 2026, and the windows from it, three years back for
//   the results and 24 months for the news, a leap day included;
// - which group an event goes in by its last day, never both;
// - the answer: the groups in brief 1.4's order with their labels, an empty
//   one left out, five rows a group and twenty in all, each row's id, title,
//   second line and address, the tags by the registration endpoint's rule in
//   the status badge's own words, the partner events after the LCA's with
//   their organizers' pages, and the champions rows with no name;
// - the answer's key in the edge's cache, and its two ways: kept and read
//   back where there is a cache, and read from the database each time where
//   there is none, a cache that fails changing nothing.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SEARCH_QUERY_MAX, SEARCH_QUERY_MIN, matchesSearch, normalizeSearchText } from '../../domain/format/searchText'
import {
  SEARCH_ANSWER_MAX,
  SEARCH_CACHE_CONTROL,
  SEARCH_GROUP_MAX,
  SEARCH_GROUPS,
  SEARCH_READ_LIMIT,
  SEARCH_REFUSED,
  SEARCH_TAGS,
  answerSearch,
  centralToday,
  edgeCache,
  eventGroupOf,
  lastDayOf,
  readSearchRows,
  registrationTag,
  searchAnswer,
  searchCacheKey,
  searchWindows,
  type SearchCache,
  type SearchContext,
  type SearchRows,
} from '../../functions/utils/search'
import { STATUS_LABELS } from '../../src/lib/badgeStatus'

/** An en dash, written by code so that this file holds none. */
const EN_DASH = String.fromCharCode(0x2013)

/** Noon on Sunday, November 1, 2026 in Louisiana, after the clock went back. */
const NOON = Date.parse('2026-11-01T18:00:00.000Z')
const WINDOWS = searchWindows('2026-11-01')

type Row<K extends keyof SearchRows> = SearchRows[K][number]

/** Rows as the reads return them, every list empty unless given. */
function rows(given: Partial<SearchRows> = {}): SearchRows {
  return { upcoming: [], results: [], partners: [], clubs: [], posts: [], champions: [], ...given }
}
const event = (over: Partial<Row<'upcoming'>> = {}): Row<'upcoming'> => ({
  id: 'fx-t1', name: 'Fixture Fall Open', date: '2026-11-14', end_date: null, location: 'Kenner, LA',
  registration_status: 'open', registration_closes_at: null, ...over,
})
const result = (over: Partial<Row<'results'>> = {}): Row<'results'> => ({ id: 'fx-r1', name: 'Fixture Summer Open', date: '2026-07-11', end_date: null, location: 'Baton Rouge, LA', ...over })
const partner = (over: Partial<Row<'partners'>> = {}): Row<'partners'> => ({
  id: 'fx-p1', name: 'Fixture Gulf Open', start_date: '2026-11-21', end_date: null, city: 'Lafayette', state: 'LA', link: 'https://example.org/gulf-open', ...over,
})
const club = (over: Partial<Row<'clubs'>> = {}): Row<'clubs'> => ({ id: 'fx-c1', name: 'Fixture Chess Club', city: 'Monroe', region: 'North Louisiana', ...over })
const post = (over: Partial<Row<'posts'>> = {}): Row<'posts'> => ({ slug: 'fixture-post', title: 'Fixture news of the season', published_at: '2026-10-20', ...over })
const champion = (over: Partial<Row<'champions'>> = {}): Row<'champions'> => ({ year: 2026, title: 'Louisiana State Champion', kind: 'state', ...over })

const answer = (given: Partial<SearchRows>, q: string, now = NOON) => searchAnswer(rows(given), normalizeSearchText(q), now)
const ids = (given: Partial<SearchRows>, q: string) => answer(given, q).groups.flatMap((g) => g.items.map((i) => i.id))

// ── The normaliser and the match ───────────────────────────────────────────

describe('normalizeSearchText', () => {
  it.each([
    ['Café Échecs', 'cafe echecs'],
    ['Saint Martin Open', 'st martin open'],
    ['St. Martin Open', 'st martin open'],
    ['SAINT-MARTIN', 'st martin'],
    ['Chess & Checkers', 'chess and checkers'],
    ['A&M', 'a and m'],
    ['  Morphy   2026 ', 'morphy 2026'],
    ['K-12 U1200', 'k 12 u1200'],
    ['Saints', 'saints'],
    ['Sainte Marie', 'sainte marie'],
    ['İstanbul', 'istanbul'],
    ['Ñandú', 'nandu'],
    ['Jean-Étienne Open', 'jean etienne open'],
    ["Louisiana's chess", 'louisiana s chess'],
    [`2025${EN_DASH}26 tournament calendar published`, '2025 26 tournament calendar published'],
    ['!!!', ''],
    ['', ''],
  ])('%j reads as %j', (text, normalised) => {
    expect(normalizeSearchText(text)).toBe(normalised)
  })

  it('gives the same text again when given its own answer', () => {
    for (const text of ['Café Échecs', 'St. Martin & Saint Rose', `Fall ${EN_DASH} Open`]) {
      const once = normalizeSearchText(text)
      expect(normalizeSearchText(once)).toBe(once)
    }
  })
})

describe('matchesSearch', () => {
  it.each([
    ['paul morphy open', 'morph', true],
    ['paul morphy open', 'orphy', false],
    ['paul morphy open', 'open paul', true],
    ['paul morphy open', 'paul blitz', false],
    ['st martin open', 'st martin', true],
    ['st martin open', 'sain', false],
    ['st tammany chess club', 'st', true],
    ['louisiana state champion', 'st', false],
    ['baton rouge street chess', 'st', false],
    ['louisiana state champion', 'sta', true],
    ['cafe echecs', 'cafe', true],
    ['chess and checkers', 'and', true],
    ['anything', '', false],
    ['', 'x', false],
  ] as const)('%j for %j: %s', (text, query, found) => {
    expect(matchesSearch(text, query)).toBe(found)
  })

  it('finds "Saint" in "St." and "St." in "Saint", "&" in "and", and a stored mark by its plain letter, once both sides are normalised', () => {
    const finds = (stored: string, asked: string) => matchesSearch(normalizeSearchText(stored), normalizeSearchText(asked))
    expect(finds('St. Martin Open', 'Saint Martin')).toBe(true)
    expect(finds('Saint Martin Open', 'st. martin')).toBe(true)
    expect(finds('Chess and Checkers Club', 'chess & checkers')).toBe(true)
    expect(finds('Chess & Checkers Club', 'chess and checkers')).toBe(true)
    expect(finds('Café Échecs', 'cafe')).toBe(true)
    expect(finds('Cafe Echecs', 'café')).toBe(true)
  })

  it('finds "Saint" and "St." only as a whole word, so a search for Saint never finds State, Street or Stanley', () => {
    const finds = (stored: string, asked: string) => matchesSearch(normalizeSearchText(stored), normalizeSearchText(asked))
    for (const asked of ['Saint', 'St.', 'st']) {
      expect(finds('St. Tammany Chess Club', asked), asked).toBe(true)
      expect(finds('Saint Tammany Chess Club', asked), asked).toBe(true)
      for (const stored of ['Louisiana State Champion', 'Stanley Steamer Classic', 'Baton Rouge Street Chess']) expect(finds(stored, asked), `${stored} for ${asked}`).toBe(false)
    }
    expect(finds('Louisiana State Champion', 'state')).toBe(true)
    expect(finds('Saint Tammany Saints Open', 'saints')).toBe(true)
  })
})

describe('the query\'s bounds', () => {
  it('are 2 and 64 characters once normalised', () => {
    expect([SEARCH_QUERY_MIN, SEARCH_QUERY_MAX]).toEqual([2, 64])
    expect(SEARCH_REFUSED).toBe('Search for 2 to 64 letters or numbers.')
  })

  it.each([
    ['one letter', 'a', 400],
    ['two letters', 'ab', 200],
    ['64 letters', 'x'.repeat(64), 200],
    ['65 letters', 'x'.repeat(65), 400],
    ['64 letters with their marks, each two characters before', 'é'.repeat(64), 200],
    ['64 letters each written as two code units', String.fromCodePoint(0x1d49c).repeat(64), 200],
    ['65 of them', String.fromCodePoint(0x1d49c).repeat(65), 400],
    ['punctuation alone', '?!', 400],
    ['nothing', '', 400],
  ])('%s: %s', async (_what, q, status) => {
    const { db } = fakeDatabase({})
    const res = await answerSearch(contextFor(`/api/search?q=${encodeURIComponent(q)}`, db), null)
    expect(res.status).toBe(status)
  })

  it('answers 400 with the error\'s words, no Cache-Control and no read for no q at all', async () => {
    const { db, batches } = fakeDatabase({})
    const res = await answerSearch(contextFor('/api/search', db), null)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: SEARCH_REFUSED })
    expect(res.headers.get('Cache-Control')).toBeNull()
    expect(batches()).toBe(0)
  })
})

// ── The day and the windows ────────────────────────────────────────────────

describe('Louisiana\'s day', () => {
  it.each([
    ['10:30 PM on Sunday in Louisiana, when UTC\'s date is Monday', '2026-11-02T04:30:00.000Z', '2026-11-01'],
    ['1:30 AM on Sunday, daylight time, before the clock goes back at 2:00 AM', '2026-11-01T06:30:00.000Z', '2026-11-01'],
    ['11:59 PM on Saturday in Louisiana', '2026-11-01T04:59:00.000Z', '2026-10-31'],
    ['noon on Sunday', '2026-11-01T18:00:00.000Z', '2026-11-01'],
  ])('%s', (_when, instant, day) => {
    expect(centralToday(Date.parse(instant))).toBe(day)
  })

  it('gives three years back for the results and 24 months back for the news, both counted in', () => {
    expect(searchWindows('2026-11-01')).toEqual({ today: '2026-11-01', resultsFrom: '2023-11-01', newsFrom: '2024-11-01' })
    expect(searchWindows('2026-01-15')).toEqual({ today: '2026-01-15', resultsFrom: '2023-01-15', newsFrom: '2024-01-15' })
  })

  it('takes a leap day back to the last day of a February that has none', () => {
    expect(searchWindows('2028-02-29')).toEqual({ today: '2028-02-29', resultsFrom: '2025-02-28', newsFrom: '2026-02-28' })
  })
})

describe('an event\'s group by its last day', () => {
  it.each([
    ['today', '2026-11-01', 'tournaments'],
    ['yesterday', '2026-10-31', 'results'],
    ['three years less a day ago', '2023-11-02', 'results'],
    ['three years ago to the day', '2023-11-01', 'results'],
    ['three years and a day ago', '2023-10-31', null],
    ['a day written in words', 'Saturday, March 14, 2026', null],
    ['no such day', '2026-13-45', null],
  ])('a last day of %s goes in %s', (_when, last, group) => {
    expect(eventGroupOf(last, WINDOWS)).toBe(group)
  })

  it('takes the end date as the last day, and the first day when there is none or an empty one', () => {
    expect(lastDayOf('2026-11-01', null)).toBe('2026-11-01')
    expect(lastDayOf('2026-10-31', null)).toBe('2026-10-31')
    expect(lastDayOf('2026-10-30', '2026-11-01')).toBe('2026-11-01')
    expect(lastDayOf('2026-10-31', '')).toBe('2026-10-31')
    expect(eventGroupOf(lastDayOf('2026-10-30', '2026-11-01'), WINDOWS)).toBe('tournaments')
  })
})

// ── The answer ─────────────────────────────────────────────────────────────

describe('the answer\'s groups', () => {
  it('names the five groups in brief 1.4\'s order with their headings', () => {
    expect(SEARCH_GROUPS).toEqual([['tournaments', 'Tournaments'], ['clubs', 'Clubs'], ['news', 'News'], ['results', 'Results'], ['champions', 'Champions']])
    expect([SEARCH_GROUP_MAX, SEARCH_ANSWER_MAX, SEARCH_READ_LIMIT]).toEqual([5, 20, 500])
  })

  it('gives the query as normalised and the groups that hold a match, in order, an empty group left out', () => {
    const body = answer({ upcoming: [event({ name: 'Fixture Kenner Open' })], posts: [post({ title: 'Kenner results are in' })], clubs: [club()] }, '  KENNER ')
    expect(body.q).toBe('kenner')
    expect(body.groups.map((g) => [g.type, g.label])).toEqual([['tournaments', 'Tournaments'], ['news', 'News']])
  })

  it('gives no group at all when nothing matches', () => {
    expect(answer({ upcoming: [event()], clubs: [club()] }, 'zzz')).toEqual({ q: 'zzz', groups: [] })
  })

  it('keeps five rows a group, each group\'s first five in its own order, and twenty in all, a later group taking what the earlier leave', () => {
    const six = <T>(make: (i: number) => T) => Array.from({ length: 6 }, (_, i) => make(i))
    const body = answer({
      upcoming: six((i) => event({ id: `fx-t${i}`, name: `Fixture Open ${i}` })),
      clubs: six((i) => club({ id: `fx-c${i}`, name: `Fixture Club ${i}` })),
      posts: six((i) => post({ slug: `fx-n${i}`, title: `Fixture news ${i}` })),
      results: six((i) => result({ id: `fx-r${i}`, name: `Fixture Result ${i}` })),
      champions: six((i) => champion({ year: 2020 + i, title: 'Fixture Champion' })),
    }, 'fixture')
    expect(body.groups.map((g) => [g.type, g.items.length])).toEqual([['tournaments', 5], ['clubs', 5], ['news', 5], ['results', 5]])
    expect(body.groups.flatMap((g) => g.items)).toHaveLength(20)
    expect(body.groups[0].items.map((i) => i.id)).toEqual(['event:fx-t0', 'event:fx-t1', 'event:fx-t2', 'event:fx-t3', 'event:fx-t4'])
    // With a group short of five, the champions get the room left.
    const short = answer({ upcoming: [event({ name: 'Fixture Open' })], clubs: six((i) => club({ id: `fx-c${i}`, name: `Fixture Club ${i}` })), champions: six((i) => champion({ year: 2020 + i, title: 'Fixture Champion' })) }, 'fixture')
    expect(short.groups.map((g) => [g.type, g.items.length])).toEqual([['tournaments', 1], ['clubs', 5], ['champions', 5]])
  })

  it('gives every row an id of its own across the groups', () => {
    const all = ids({
      upcoming: [event({ id: 'same' })], results: [result({ id: 'other', name: 'Fixture Open Result' })], partners: [partner({ id: 'same' })],
      clubs: [club({ id: 'same' })], posts: [post({ slug: 'same' })],
    }, 'fixture')
    expect(all).toEqual(['event:same', 'partner:same', 'club:same', 'news:same', 'event:other'])
    expect(new Set(all).size).toBe(all.length)
  })
})

describe('the Tournaments and Results groups', () => {
  it('gives an LCA event its days with their weekdays and year, its place, its page and its registration in words', () => {
    const [one] = answer({ upcoming: [event()] }, 'fall').groups[0].items
    expect(one).toEqual({
      id: 'event:fx-t1', title: 'Fixture Fall Open', meta: 'Sat, Nov 14, 2026 · Kenner, LA', href: '/tournaments/fx-t1',
      tag: { label: 'Registration open', tone: 'open' },
    })
    const [two] = answer({ upcoming: [event({ date: '2026-11-14', end_date: '2026-11-15' })] }, 'fall').groups[0].items
    expect(two.meta).toBe('Sat, Nov 14, 2026 to Sun, Nov 15, 2026 · Kenner, LA')
  })

  it('puts an event of today in Tournaments and one of yesterday in Results, one three years and a day old in neither, and none in two', () => {
    const today = event({ id: 'fx-today', name: 'Fixture Today Open', date: '2026-11-01' })
    const yesterday = result({ id: 'fx-yesterday', name: 'Fixture Yesterday Open', date: '2026-10-31' })
    const old = result({ id: 'fx-old', name: 'Fixture Old Open', date: '2023-10-31' })
    // A row read into the wrong list, as a clock that moved between the reads would give, still goes by its own last day.
    const misplaced = event({ id: 'fx-misplaced', name: 'Fixture Misplaced Open', date: '2026-10-31' })
    const body = answer({ upcoming: [today, misplaced], results: [yesterday, old] }, 'fixture open')
    expect(body.groups.map((g) => [g.type, g.items.map((i) => i.id)])).toEqual([['tournaments', ['event:fx-today']], ['results', ['event:fx-yesterday']]])
  })

  it('gives a result its last day with its weekday and year, its place, its page and the final tag, matched by its year too', () => {
    const body = answer({ results: [result({ date: '2026-07-11', end_date: '2026-07-12' })] }, 'summer 2026')
    expect(body.groups[0].items).toEqual([{
      id: 'event:fx-r1', title: 'Fixture Summer Open', meta: 'Sun, Jul 12, 2026 · Baton Rouge, LA', href: '/tournaments/fx-r1',
      tag: { label: 'Final standings', tone: 'final' },
    }])
    expect(answer({ results: [result()] }, '2025').groups).toEqual([])
  })

  it('matches an event by its name and its place and by nothing else', () => {
    expect(ids({ upcoming: [event()] }, 'kenner')).toEqual(['event:fx-t1'])
    expect(ids({ upcoming: [event()] }, 'fixture fall')).toEqual(['event:fx-t1'])
    expect(ids({ upcoming: [event()] }, 'registration')).toEqual([])
    expect(ids({ upcoming: [event()] }, 'fx t1')).toEqual([])
  })

  it('leaves out an event with no name, and one whose last day is no day', () => {
    expect(ids({ upcoming: [event({ name: '   ', location: 'Fixture Hall' })] }, 'fixture')).toEqual([])
    expect(ids({ upcoming: [event({ date: 'Saturday, November 14' })] }, 'fixture')).toEqual([])
  })
})

describe('the tags', () => {
  it('are the status badge\'s own words for open, soon and closed', () => {
    expect(SEARCH_TAGS.open.label).toBe(STATUS_LABELS.open)
    expect(SEARCH_TAGS.soon.label).toBe(STATUS_LABELS.soon)
    expect(SEARCH_TAGS.closed.label).toBe(STATUS_LABELS.closed)
    expect(SEARCH_TAGS.final).toEqual({ label: 'Final standings', tone: 'final' })
  })

  it.each([
    ['open with no close time', 'open', null, 'open'],
    ['open, its close time still to come', 'open', '2026-11-13T18:00', 'open'],
    ['open, its close time passed this morning in Louisiana', 'open', '2026-11-01T09:00', 'closed'],
    ['open, its close day yesterday', 'open', '2026-10-31', 'closed'],
    ['closed', 'closed', null, 'closed'],
    ['a draft', 'draft', null, 'soon'],
    ['a status the site does not know', 'paused', null, 'closed'],
  ])('reads a registration %s as %s', (_what, status, closesAt, tone) => {
    expect(registrationTag(status, closesAt, NOON).tone).toBe(tone)
  })

  it('carries no count: a full event still reads Registration open', () => {
    const [row] = answer({ upcoming: [event()] }, 'fall').groups[0].items
    expect(JSON.stringify(row)).not.toMatch(/count|max_players|entry_fee|fee/)
  })
})

describe('the partner events', () => {
  it('come after the LCA events in the Tournaments group, Louisiana\'s first, each with its organizer\'s page, external, and no tag', () => {
    const body = answer({
      upcoming: [event({ id: 'fx-t1', name: 'Fixture Open LCA', date: '2026-12-05' })],
      partners: [
        partner({ id: 'fx-la', name: 'Fixture Open Lafayette', start_date: '2026-12-01', city: 'Lafayette', state: 'LA', link: 'https://example.org/la' }),
        partner({ id: 'fx-ms', name: 'Fixture Open Biloxi', start_date: '2026-11-20', city: 'Biloxi', state: 'MS', link: 'http://example.org/ms' }),
        partner({ id: 'fx-al', name: 'Fixture Open Alabama', start_date: '2026-11-25', city: null, state: 'AL', link: 'https://example.org/al' }),
      ],
    }, 'fixture open')
    expect(body.groups).toHaveLength(1)
    expect(body.groups[0].items).toEqual([
      { id: 'event:fx-t1', title: 'Fixture Open LCA', meta: 'Sat, Dec 5, 2026 · Kenner, LA', href: '/tournaments/fx-t1', tag: { label: 'Registration open', tone: 'open' } },
      { id: 'partner:fx-la', title: 'Fixture Open Lafayette', meta: 'Tue, Dec 1, 2026 · Lafayette', href: 'https://example.org/la', external: true },
      { id: 'partner:fx-ms', title: 'Fixture Open Biloxi', meta: 'Fri, Nov 20, 2026 · Biloxi, MS', href: 'http://example.org/ms', external: true },
      { id: 'partner:fx-al', title: 'Fixture Open Alabama', meta: 'Wed, Nov 25, 2026 · AL', href: 'https://example.org/al', external: true },
    ])
  })

  it('leaves out a partner event with no web address to send the visitor to', () => {
    for (const link of [null, '', '   ', 'not an address', 'mailto:td@example.org', 'javascript:alert(1)']) {
      expect(ids({ partners: [partner({ link })] }, 'fixture'), String(link)).toEqual([])
    }
  })

  it('keeps one under way until its last day has passed, and leaves out one whose last day was yesterday', () => {
    expect(ids({ partners: [partner({ start_date: '2026-10-31', end_date: '2026-11-01' })] }, 'fixture')).toEqual(['partner:fx-p1'])
    expect(ids({ partners: [partner({ start_date: '2026-10-30', end_date: '2026-10-31' })] }, 'fixture')).toEqual([])
  })

  it('matches a partner event by its name, city and state alone', () => {
    expect(ids({ partners: [partner({ state: 'MS', city: 'Biloxi' })] }, 'biloxi ms')).toEqual(['partner:fx-p1'])
    expect(ids({ partners: [partner()] }, 'example')).toEqual([])
  })
})

describe('the Clubs, News and Champions groups', () => {
  it('gives a club its city and its region, and only a region the site knows', () => {
    expect(answer({ clubs: [club()] }, 'monroe').groups[0].items).toEqual([{ id: 'club:fx-c1', title: 'Fixture Chess Club', meta: 'Monroe · North Louisiana', href: '/clubs/fx-c1' }])
    expect(answer({ clubs: [club({ region: null })] }, 'fixture').groups[0].items[0].meta).toBe('Monroe')
    expect(answer({ clubs: [club({ region: 'Somewhere Else' })] }, 'fixture').groups[0].items[0].meta).toBe('Monroe')
    expect(ids({ clubs: [club()] }, 'north louisiana')).toEqual(['club:fx-c1'])
    expect(ids({ clubs: [club({ region: 'Somewhere Else' })] }, 'somewhere')).toEqual([])
  })

  it('gives a post its published day with its weekday and year and its page, matched by its title alone', () => {
    expect(answer({ posts: [post()] }, 'season').groups[0].items).toEqual([{ id: 'news:fixture-post', title: 'Fixture news of the season', meta: 'Tue, Oct 20, 2026', href: '/news/fixture-post' }])
    expect(ids({ posts: [post()] }, 'fixture post')).toEqual([])
    expect(ids({ posts: [post({ published_at: '2024-10-31' })] }, 'season')).toEqual([])
    expect(ids({ posts: [post({ published_at: '2024-11-01' })] }, 'season')).toEqual(['news:fixture-post'])
  })

  it('gives a champions row its year and title, its list, the list\'s place on the champions page and an id with no name', () => {
    const body = answer({ champions: [champion(), champion({ year: 2026, title: 'K-12', kind: 'scholastic' })] }, '2026')
    expect(body.groups[0].items).toEqual([
      { id: 'champions:state:2026:louisiana-state-champion', title: '2026 Louisiana State Champion', meta: 'State champions', href: '/champions#state-champions' },
      { id: 'champions:scholastic:2026:k-12', title: '2026 K-12', meta: 'Scholastic champions', href: '/champions#scholastic-champions' },
    ])
    expect(ids({ champions: [champion()] }, 'state champion')).toEqual(['champions:state:2026:louisiana-state-champion'])
  })

  it('gives one row for two titles that read alike once normalised', () => {
    expect(ids({ champions: [champion({ title: 'K-12', kind: 'scholastic' }), champion({ title: 'K 12', kind: 'scholastic' })] }, 'k 12')).toEqual(['champions:scholastic:2026:k-12'])
  })
})

// ── The reads, through a stand-in for the database ─────────────────────────

/** A stand-in for the D1 binding: canned rows for each of the six reads, and what was asked of it. */
function fakeDatabase(given: Partial<SearchRows>) {
  const asked: Array<{ sql: string; binds: unknown[] }> = []
  let batched = 0
  const rowsFor = (sql: string) => {
    const all = rows(given)
    if (/FROM clearinghouse/.test(sql)) return all.partners
    if (/FROM clubs/.test(sql)) return all.clubs
    if (/FROM lca_posts/.test(sql)) return all.posts
    if (/FROM state_champions/.test(sql)) return all.champions
    if (/FROM tournaments/.test(sql)) return /registration_status/.test(sql) ? all.upcoming : all.results
    throw new Error(`no rows for ${sql}`)
  }
  const db = {
    prepare: (sql: string) => ({ bind: (...binds: unknown[]) => ({ sql, binds }) }),
    batch: async (statements: Array<{ sql: string; binds: unknown[] }>) => {
      batched += 1
      asked.push(...statements)
      return statements.map(({ sql }) => ({ results: rowsFor(sql), success: true, meta: {} }))
    },
  }
  return { db: db as unknown as D1Database, asked, batches: () => batched }
}

/** A request's context as Pages hands it over, with the work handed to waitUntil collected. */
const work: Promise<unknown>[] = []
function contextFor(path: string, db: D1Database): SearchContext {
  return {
    request: new Request(`https://lca-website.pages.dev${path}`),
    env: { DB: db },
    waitUntil: (promise: Promise<unknown>) => { work.push(promise) },
  } as unknown as SearchContext
}
async function flush() {
  while (work.length > 0) await Promise.all(work.splice(0))
}

describe('the six reads', () => {
  it('go in one batch, each bounded at 500 rows, bound to Louisiana\'s day and its windows and never to SQLite\'s own day', async () => {
    const { db, asked, batches } = fakeDatabase({})
    await readSearchRows(db, WINDOWS)
    expect(batches()).toBe(1)
    expect(asked).toHaveLength(6)
    expect(asked.map((s) => s.binds)).toEqual([
      ['2026-11-01', 500], ['2026-11-01', '2023-11-01', 500], ['2026-11-01', 500], [500], ['2024-11-01', 500], [500],
    ])
    for (const { sql } of asked) {
      expect(sql).toMatch(/LIMIT \?\s*$/)
      expect(sql).not.toMatch(/date\('now'\)|SELECT \*|\.\*/)
    }
  })

  it('read the honor roll by its year, title and list alone, and no column that holds a person\'s name anywhere', async () => {
    const { db, asked } = fakeDatabase({})
    await readSearchRows(db, WINDOWS)
    const champions = asked.find((s) => /FROM state_champions/.test(s.sql))!.sql
    expect(champions).toMatch(/SELECT DISTINCT year, title, kind\s+FROM state_champions/)
    for (const { sql } of asked) expect(sql).not.toMatch(/\b(?:champion|notes|photo_url|organizer|contact|contact_email|description|members|registrations|email)\b/)
  })
})

// ── The edge's cache ───────────────────────────────────────────────────────

/** A stand-in for the edge's cache: answers kept by key. */
function fakeCache() {
  const kept = new Map<string, Response>()
  const calls = { match: 0, put: 0 }
  const cache: SearchCache = {
    match: async (key) => {
      calls.match += 1
      return kept.get(key)?.clone()
    },
    put: async (key, response) => {
      calls.put += 1
      kept.set(key, response)
    },
  }
  return { cache, kept, calls }
}

afterEach(() => {
  vi.unstubAllGlobals()
  work.length = 0
})

describe('the answer\'s key in the edge\'s cache', () => {
  it('is an address on the request\'s own origin holding search:v1: and the normalised query', () => {
    expect(searchCacheKey('https://www.louisianachess.org', 'st martin')).toBe('https://www.louisianachess.org/api/search?key=search%3Av1%3Ast%20martin')
  })

  it('is one for every search that normalises alike, and another for one that does not', () => {
    const key = (q: string) => searchCacheKey('https://lca-website.pages.dev', normalizeSearchText(q))
    expect(key('Saint Martin')).toBe(key('st. martin'))
    expect(key('  SAINT   martin ')).toBe(key('st martin'))
    expect(key('st martin open')).not.toBe(key('st martin'))
  })
})

describe('answering through the cache and without one', () => {
  const given = { clubs: [club({ name: 'Saint Martin Chess Club' })] }

  it('reads the database on a miss, keeps the answer for a minute under its key, and answers the next search alike from the cache with no read', async () => {
    const { db, batches } = fakeDatabase(given)
    const { cache, kept, calls } = fakeCache()
    const first = await answerSearch(contextFor('/api/search?q=Saint%20Martin', db), cache)
    expect(first.status).toBe(200)
    expect(first.headers.get('Cache-Control')).toBe(SEARCH_CACHE_CONTROL)
    expect(SEARCH_CACHE_CONTROL).toBe('public, max-age=60')
    expect(first.headers.get('Vary')).toBeNull()
    const body = await first.json()
    expect(body).toEqual({ q: 'st martin', groups: [{ type: 'clubs', label: 'Clubs', items: [{ id: 'club:fx-c1', title: 'Saint Martin Chess Club', meta: 'Monroe · North Louisiana', href: '/clubs/fx-c1' }] }] })
    await flush()
    expect(batches()).toBe(1)
    expect([...kept.keys()]).toEqual(['https://lca-website.pages.dev/api/search?key=search%3Av1%3Ast%20martin'])
    expect(kept.values().next().value!.headers.get('Cache-Control')).toBe('public, max-age=60')
    const second = await answerSearch(contextFor('/api/search?q=st.+martin', db), cache)
    expect(await second.json()).toEqual(body)
    expect(second.headers.get('Cache-Control')).toBe('public, max-age=60')
    await flush()
    expect(batches()).toBe(1)
    expect(calls).toEqual({ match: 2, put: 1 })
  })

  it('reads the database for every search where there is no cache', async () => {
    const { db, batches } = fakeDatabase(given)
    for (const q of ['saint martin', 'saint martin', 'st martin']) {
      const res = await answerSearch(contextFor(`/api/search?q=${encodeURIComponent(q)}`, db), null)
      expect(res.status).toBe(200)
      expect(res.headers.get('Cache-Control')).toBe('public, max-age=60')
    }
    expect(work).toEqual([])
    expect(batches()).toBe(3)
  })

  it('answers from the database when the cache cannot be read, and changes nothing when an answer cannot be kept', async () => {
    const { db, batches } = fakeDatabase(given)
    const broken: SearchCache = {
      match: async () => { throw new Error('the cache is away') },
      put: async () => { throw new Error('the cache is full') },
    }
    const res = await answerSearch(contextFor('/api/search?q=martin', db), broken)
    expect(res.status).toBe(200)
    expect((await res.json()).groups[0].items[0].id).toBe('club:fx-c1')
    await expect(flush()).resolves.toBeUndefined()
    expect(batches()).toBe(1)
    const throws: SearchCache = {
      match: () => { throw new Error('thrown at once') },
      put: () => { throw new Error('thrown at once') },
    }
    expect((await answerSearch(contextFor('/api/search?q=martin', db), throws)).status).toBe(200)
    await expect(flush()).resolves.toBeUndefined()
  })

  it('keeps no answer to a search it refuses', async () => {
    const { db, batches } = fakeDatabase(given)
    const { cache, calls } = fakeCache()
    const res = await answerSearch(contextFor('/api/search?q=a', db), cache)
    expect(res.status).toBe(400)
    await flush()
    expect(calls).toEqual({ match: 0, put: 0 })
    expect(batches()).toBe(0)
  })

  it('reads no Authorization header and no cookie: a request that carries both gets the same answer', async () => {
    const { db } = fakeDatabase(given)
    const plain = await answerSearch(contextFor('/api/search?q=martin', db), null)
    const context = contextFor('/api/search?q=martin', db)
    const signedIn = { ...context, request: new Request(context.request.url, { headers: { Authorization: 'Bearer fx-token', Cookie: 'fx=1' } }) }
    const withBoth = await answerSearch(signedIn, null)
    expect(await withBoth.text()).toBe(await plain.text())
    expect([...withBoth.headers.entries()]).toEqual([...plain.headers.entries()])
  })
})

describe('the edge\'s cache, where the runtime has one', () => {
  it('is the runtime\'s default cache', () => {
    const store = { match: async () => undefined, put: async () => {} }
    vi.stubGlobal('caches', { default: store })
    expect(edgeCache()).toBe(store)
  })

  it('is none where the runtime has no caches, or no default among them', () => {
    expect(typeof (globalThis as { caches?: unknown }).caches).toBe('undefined')
    expect(edgeCache()).toBeNull()
    vi.stubGlobal('caches', {})
    expect(edgeCache()).toBeNull()
  })
})
