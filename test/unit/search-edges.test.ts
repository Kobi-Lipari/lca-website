// test/unit/search-edges.test.ts
//
// The edges of the site's search (WS02 step 9) that test/unit/search.test.ts
// leaves, in its pure parts and with no database: functions/utils/search.ts
// and domain/format/searchText.ts, given rows of their own and stand-ins for
// the database and the edge's cache.
//
// - Louisiana's day at each midnight and on both sides of each clock change
//   of 2026 (Sunday, March 8 and Sunday, November 1), at the year's end and
//   on a leap day, and no day at all for an instant that is none;
// - the windows at the ends of months and years, each window's first day
//   counted in and the day before it left out;
// - a last day not written as the database writes days, in neither group,
//   and no bound ahead for an event or a partner event;
// - the registration tag at the last second of a close day in Louisiana and
//   at a close time of 7:00 PM, in standard time and in daylight time;
// - the Tournaments group's five rows shared by the LCA's events and the
//   partner events, the LCA's always first;
// - plain words in every row: each date with its weekday and its year, no
//   date as the database writes it, the tags' four tones alone, and a
//   partner row with no tag, no count, no fee and none of the words the
//   panel draws for it;
// - the query read as the endpoint reads it, in characters once normalised;
// - replays and requests at once through a stand-in cache, q read alone so
//   another parameter beside it splits no kept answer, and the work the
//   handler leaves for after the answer;
// - the endpoint's own words: headings, tags and lists in sentence case
//   with no dash and no old initials, and the refusal in one plain sentence;
// - the reads' text holding no value of its own, and the cache's key read
//   back from its address.
import { afterEach, describe, expect, it } from 'vitest'
import { normalizeSearchText } from '../../domain/format/searchText'
import {
  SEARCH_GROUPS,
  SEARCH_READ_LIMIT,
  SEARCH_REFUSED,
  SEARCH_TAGS,
  answerSearch,
  centralToday,
  eventGroupOf,
  readSearchRows,
  registrationTag,
  searchAnswer,
  searchCacheKey,
  searchWindows,
  type SearchCache,
  type SearchContext,
  type SearchRows,
} from '../../functions/utils/search'

/** Noon on Sunday, November 1, 2026 in Louisiana. */
const NOON = Date.parse('2026-11-01T18:00:00.000Z')

type Row<K extends keyof SearchRows> = SearchRows[K][number]

function rows(given: Partial<SearchRows> = {}): SearchRows {
  return { upcoming: [], results: [], partners: [], clubs: [], posts: [], champions: [], ...given }
}
const event = (over: Partial<Row<'upcoming'>> = {}): Row<'upcoming'> => ({
  id: 'fx-e1', name: 'Fixture Fall Open', date: '2026-11-14', end_date: null, location: 'Kenner, LA',
  registration_status: 'open', registration_closes_at: null, ...over,
})
const result = (over: Partial<Row<'results'>> = {}): Row<'results'> => ({ id: 'fx-r1', name: 'Fixture Summer Open', date: '2026-07-11', end_date: null, location: 'Baton Rouge, LA', ...over })
const partner = (over: Partial<Row<'partners'>> = {}): Row<'partners'> => ({
  id: 'fx-p1', name: 'Fixture Gulf Open', start_date: '2026-11-21', end_date: null, city: 'Lafayette', state: 'LA', link: 'https://example.org/gulf', ...over,
})
const club = (over: Partial<Row<'clubs'>> = {}): Row<'clubs'> => ({ id: 'fx-c1', name: 'Fixture Chess Club', city: 'Monroe', region: 'North Louisiana', ...over })
const post = (over: Partial<Row<'posts'>> = {}): Row<'posts'> => ({ slug: 'fixture-post', title: 'Fixture news', published_at: '2026-10-20', ...over })
const champion = (over: Partial<Row<'champions'>> = {}): Row<'champions'> => ({ year: 2026, title: 'Fixture State Champion', kind: 'state', ...over })

const answer = (given: Partial<SearchRows>, q: string, now = NOON) => searchAnswer(rows(given), normalizeSearchText(q), now)
const ids = (given: Partial<SearchRows>, q: string, now = NOON) => answer(given, q, now).groups.flatMap((g) => g.items.map((i) => i.id))

/** The day before a day, as the database writes days. */
function dayBefore(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10)
}

// ── Louisiana's day ────────────────────────────────────────────────────────

describe('Louisiana\'s day at each midnight and across both clock changes of 2026', () => {
  it.each([
    ['the last moment of Saturday, March 7, before the clock goes forward', '2026-03-08T05:59:59.999Z', '2026-03-07'],
    ['midnight starting Sunday, March 8, in standard time', '2026-03-08T06:00:00.000Z', '2026-03-08'],
    ['1:59 AM on Sunday, March 8, the last minute before the clock goes forward', '2026-03-08T07:59:00.000Z', '2026-03-08'],
    ['3:00 AM on Sunday, March 8, the first minute after it', '2026-03-08T08:00:00.000Z', '2026-03-08'],
    ['the last moment of Sunday, March 8, in daylight time', '2026-03-09T04:59:59.999Z', '2026-03-08'],
    ['midnight starting Monday, March 9, in daylight time', '2026-03-09T05:00:00.000Z', '2026-03-09'],
    ['midnight starting Saturday, July 4, in daylight time', '2026-07-04T05:00:00.000Z', '2026-07-04'],
    ['the last moment of Friday, July 3', '2026-07-04T04:59:59.999Z', '2026-07-03'],
    ['the last moment of Saturday, October 31, in daylight time', '2026-11-01T04:59:59.999Z', '2026-10-31'],
    ['midnight starting Sunday, November 1, in daylight time', '2026-11-01T05:00:00.000Z', '2026-11-01'],
    ['1:30 AM on Sunday, November 1, the second time that hour comes, in standard time', '2026-11-01T07:30:00.000Z', '2026-11-01'],
    ['the last moment of Sunday, November 1, in standard time, when UTC\'s date is Monday', '2026-11-02T05:59:59.999Z', '2026-11-01'],
    ['midnight starting Monday, November 2, in standard time', '2026-11-02T06:00:00.000Z', '2026-11-02'],
    ['the last moment of Thursday, December 31, when UTC\'s year has turned', '2027-01-01T05:59:59.999Z', '2026-12-31'],
    ['midnight starting Friday, January 1, 2027', '2027-01-01T06:00:00.000Z', '2027-01-01'],
    ['midnight starting Tuesday, February 29, 2028, a leap day', '2028-02-29T06:00:00.000Z', '2028-02-29'],
    ['the last moment of that leap day', '2028-03-01T05:59:59.999Z', '2028-02-29'],
  ])('%s is %s', (_when, instant, day) => {
    expect(centralToday(Date.parse(instant))).toBe(day)
  })

  it('gives no day at all for an instant that is none, rather than a wrong one', () => {
    expect(() => centralToday(Number.NaN)).toThrow(Error)
  })

  it('moves an event from Tournaments to Results at Louisiana\'s midnight, not at UTC\'s', () => {
    const saturday = [event({ id: 'fx-sat', date: '2026-10-31' })]
    // 7:00 PM on Saturday, October 31 in Louisiana, when UTC's date is already Sunday.
    expect(ids({ upcoming: saturday }, 'fixture', Date.parse('2026-11-01T00:00:00.000Z'))).toEqual(['event:fx-sat'])
    expect(ids({ upcoming: saturday }, 'fixture', Date.parse('2026-11-01T04:59:59.999Z'))).toEqual(['event:fx-sat'])
    // From midnight in Louisiana the same event is a result, and no longer an upcoming one.
    const after = Date.parse('2026-11-01T05:00:00.000Z')
    expect(ids({ upcoming: saturday }, 'fixture', after)).toEqual([])
    expect(ids({ results: [result({ id: 'fx-sat', name: 'Fixture Fall Open', date: '2026-10-31' })] }, 'fixture', after)).toEqual(['event:fx-sat'])
  })
})

// ── The windows ────────────────────────────────────────────────────────────

describe('the windows at the ends of months and years', () => {
  it.each([
    ['2026-03-31', '2023-03-31', '2024-03-31'],
    ['2026-01-01', '2023-01-01', '2024-01-01'],
    ['2026-12-31', '2023-12-31', '2024-12-31'],
    ['2024-02-29', '2021-02-28', '2022-02-28'],
    ['2027-02-28', '2024-02-28', '2025-02-28'],
    ['2028-02-28', '2025-02-28', '2026-02-28'],
    ['2028-03-01', '2025-03-01', '2026-03-01'],
  ])('from %s: results from %s and news from %s', (today, resultsFrom, newsFrom) => {
    expect(searchWindows(today)).toEqual({ today, resultsFrom, newsFrom })
  })

  it.each(['2026-11-01', '2026-03-31', '2024-02-29', '2028-02-29', '2027-01-01'])('from %s, counts each window\'s first day in and leaves the day before it out', (today) => {
    const windows = searchWindows(today)
    expect(eventGroupOf(windows.resultsFrom, windows)).toBe('results')
    expect(eventGroupOf(dayBefore(windows.resultsFrom), windows)).toBeNull()
    expect(eventGroupOf(dayBefore(today), windows)).toBe('results')
    expect(eventGroupOf(today, windows)).toBe('tournaments')
    // The news window the same way, the answer built with these windows.
    const news = (published: string) => searchAnswer(rows({ posts: [post({ published_at: published })] }), 'fixture news', NOON, windows).groups.map((g) => g.type)
    expect(news(windows.newsFrom)).toEqual(['news'])
    expect(news(dayBefore(windows.newsFrom))).toEqual([])
  })
})

// ── Days that are not days, and no bound ahead ─────────────────────────────

describe('an event\'s last day that is not a day as the database writes days', () => {
  const windows = searchWindows('2026-11-01')

  it.each([
    ['a day that no calendar has', '2026-02-29'],
    ['a day with no leading zero', '2026-11-1'],
    ['a day with a time after it', '2026-11-01T10:00'],
    ['a day with a space before it', ' 2026-11-01'],
    ['a day written with slashes', '2026/11/01'],
    ['nothing', ''],
  ])('goes in neither group for %s', (_what, last) => {
    expect(eventGroupOf(last, windows)).toBeNull()
  })

  it('leaves out a partner event whose last day is not a day, and keeps one whose empty end date leaves its first day as its last', () => {
    expect(ids({ partners: [partner({ end_date: '2026-11-1' })] }, 'fixture')).toEqual([])
    expect(ids({ partners: [partner({ start_date: '2026-11-01', end_date: '' })] }, 'fixture')).toEqual(['partner:fx-p1'])
    expect(ids({ partners: [partner({ start_date: '2026-10-31', end_date: '' })] }, 'fixture')).toEqual([])
  })
})

describe('no bound ahead', () => {
  it('keeps an LCA event two years ahead and a partner event more than 180 days ahead', () => {
    const far = answer({
      upcoming: [event({ id: 'fx-far', date: '2028-10-07' })],
      partners: [partner({ id: 'fx-p-far', start_date: '2027-12-04' })],
    }, 'fixture')
    expect(far.groups.map((g) => [g.type, g.items.map((i) => i.id)])).toEqual([['tournaments', ['event:fx-far', 'partner:fx-p-far']]])
    expect(far.groups[0].items[1].meta).toBe('Sat, Dec 4, 2027 · Lafayette')
    expect(eventGroupOf('2099-12-31', searchWindows('2026-11-01'))).toBe('tournaments')
  })

  it('sends a partner event to its organizer\'s page as stored, the spaces around it taken off', () => {
    expect(answer({ partners: [partner({ link: '  https://example.org/gulf-open  ' })] }, 'fixture').groups[0].items[0].href).toBe('https://example.org/gulf-open')
  })
})

// ── The registration tag ───────────────────────────────────────────────────

describe('the registration tag at the edges of Louisiana\'s day', () => {
  it.each([
    ['a close day of today, at its last second but one in Louisiana', '2026-11-01', '2026-11-02T05:59:58.999Z', 'open'],
    ['a close day of today, at its last second, 11:59:59 PM in Louisiana', '2026-11-01', '2026-11-02T05:59:59.000Z', 'closed'],
    ['a close time of 7:00 PM on Sunday, November 1, in standard time, a moment before', '2026-11-01T19:00', '2026-11-02T00:59:59.999Z', 'open'],
    ['a close time of 7:00 PM on Sunday, November 1, in standard time, at 7:00 PM', '2026-11-01T19:00', '2026-11-02T01:00:00.000Z', 'closed'],
    ['a close time of 7:00 PM on Saturday, July 4, in daylight time, a moment before', '2026-07-04T19:00', '2026-07-04T23:59:59.999Z', 'open'],
    ['a close time of 7:00 PM on Saturday, July 4, in daylight time, at 7:00 PM', '2026-07-04T19:00', '2026-07-05T00:00:00.000Z', 'closed'],
    ['a close instant written in UTC, a moment before', '2026-11-02T01:00:00Z', '2026-11-02T00:59:59.999Z', 'open'],
    ['a close instant written in UTC, at it', '2026-11-02T01:00:00Z', '2026-11-02T01:00:00.000Z', 'closed'],
  ])('reads an open registration with %s as %s', (_what, closesAt, now, tone) => {
    const tag = registrationTag('open', closesAt, Date.parse(now))
    expect(tag.tone).toBe(tone)
    expect(tag.label).toBe(tone === 'open' ? 'Registration open' : 'Registration closed')
  })

  it('reads a draft as opening soon and a closed registration as closed whatever its close time says', () => {
    expect(registrationTag('draft', '2026-10-01', NOON)).toEqual({ label: 'Opens soon', tone: 'soon' })
    expect(registrationTag('closed', '2027-01-01', NOON)).toEqual({ label: 'Registration closed', tone: 'closed' })
  })
})

// ── The Tournaments group's five ───────────────────────────────────────────

describe('the Tournaments group\'s five rows, shared by the LCA\'s events and the partner events', () => {
  const lca = (n: number) => Array.from({ length: n }, (_, i) => event({ id: `fx-e${i}`, name: `Fixture Open ${i}`, date: `2026-12-${String(10 + i).padStart(2, '0')}` }))
  const gulf = [
    partner({ id: 'fx-la', name: 'Fixture Open Bayou', start_date: '2026-11-05', state: 'LA' }),
    partner({ id: 'fx-ms', name: 'Fixture Open Coast', start_date: '2026-11-03', city: 'Biloxi', state: 'MS' }),
  ]

  it('gives four LCA events the first four places and the first partner event the fifth, though both partner events start sooner', () => {
    expect(ids({ upcoming: lca(4), partners: gulf }, 'fixture open')).toEqual(['event:fx-e0', 'event:fx-e1', 'event:fx-e2', 'event:fx-e3', 'partner:fx-la'])
  })

  it('gives five LCA events every place, and no partner event any', () => {
    expect(ids({ upcoming: lca(5), partners: gulf }, 'fixture open')).toEqual(['event:fx-e0', 'event:fx-e1', 'event:fx-e2', 'event:fx-e3', 'event:fx-e4'])
  })

  it('gives partner events every place when no LCA event matches, in the order the read gave them', () => {
    const six = Array.from({ length: 6 }, (_, i) => partner({ id: `fx-p${i}`, name: `Fixture Gulf ${i}`, start_date: `2026-12-0${i + 1}` }))
    expect(ids({ upcoming: lca(3), partners: six }, 'fixture gulf')).toEqual(['partner:fx-p0', 'partner:fx-p1', 'partner:fx-p2', 'partner:fx-p3', 'partner:fx-p4'])
  })
})

// ── Plain words ────────────────────────────────────────────────────────────

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DATE = new RegExp(`\\b(${WEEKDAYS.join('|')}), (${MONTHS.join('|')}) (\\d{1,2}), (\\d{4})\\b`, 'g')

describe('plain words in every row', () => {
  const full = answer({
    upcoming: [event({ id: 'fx-one', date: '2026-11-14' }), event({ id: 'fx-two', name: 'Fixture Two Day Open', date: '2026-11-28', end_date: '2026-11-29' })],
    partners: [partner({ id: 'fx-la', start_date: '2026-12-05' }), partner({ id: 'fx-al', name: 'Fixture Mobile Open', start_date: '2027-01-09', city: 'Mobile', state: 'AL' })],
    clubs: [club()],
    posts: [post({ title: 'Fixture news of the fall', published_at: '2026-10-20' })],
    results: [result({ id: 'fx-done', date: '2026-07-11', end_date: '2026-07-12' })],
    champions: [champion(), champion({ title: 'Fixture K-8', kind: 'scholastic' })],
  }, 'fixture')
  const items = full.groups.flatMap((g) => g.items)

  it('reads every group, so the checks below are not blind', () => {
    expect(full.groups.map((g) => g.type)).toEqual(['tournaments', 'clubs', 'news', 'results', 'champions'])
  })

  it('gives every date its weekday, the right one, and its year, and never a date as the database writes it', () => {
    let dates = 0
    for (const item of items) {
      const text = `${item.title} ${item.meta ?? ''}`
      expect(text, item.id).not.toMatch(/\b\d{4}-\d{2}-\d{2}\b/)
      // A month's name never stands without the weekday before it.
      for (const month of text.matchAll(new RegExp(`\\b(?:${MONTHS.join('|')}) \\d{1,2}\\b`, 'g'))) {
        expect(text.slice(Math.max(0, (month.index ?? 0) - 5), month.index), `${item.id}: ${month[0]}`).toMatch(new RegExp(`(?:${WEEKDAYS.join('|')}), $`))
      }
      for (const [whole, weekday, month, day, year] of text.matchAll(DATE)) {
        dates += 1
        expect(WEEKDAYS[new Date(Date.UTC(Number(year), MONTHS.indexOf(month), Number(day))).getUTCDay()], `${item.id}: ${whole}`).toBe(weekday)
      }
    }
    // The two LCA events (three dates), the two partner events, the post and the result.
    expect(dates).toBe(7)
    expect(items.find((i) => i.id === 'event:fx-two')!.meta).toBe('Sat, Nov 28, 2026 to Sun, Nov 29, 2026 · Kenner, LA')
  })

  it('gives tags in four tones alone: open, soon and closed for an LCA event and final for a result', () => {
    const tones = new Set(items.flatMap((i) => (i.tag ? [i.tag.tone] : [])))
    for (const tone of tones) expect(['open', 'soon', 'closed', 'final']).toContain(tone)
    for (const item of items) {
      if (item.id.startsWith('event:')) expect(item.tag, item.id).toBeDefined()
      else expect(item.tag, item.id).toBeUndefined()
    }
  })

  it('gives a partner event no tag, no count, no fee and none of the words the panel draws for it: no register word, no "Partner event", no organizer\'s site', () => {
    const partners = items.filter((i) => i.id.startsWith('partner:'))
    expect(partners).toHaveLength(2)
    for (const item of partners) {
      expect(Object.keys(item).sort(), item.id).toEqual(['external', 'href', 'id', 'meta', 'title'])
      expect(item.external).toBe(true)
      expect(JSON.stringify(item), item.id).not.toMatch(/regist|partner event|organizer|count|fee|↗/i)
    }
    expect(partners.map((i) => i.meta)).toEqual(['Sat, Dec 5, 2026 · Lafayette', 'Sat, Jan 9, 2027 · Mobile, AL'])
  })
})

// ── Matching ───────────────────────────────────────────────────────────────

describe('what a row is matched on', () => {
  it('matches a result by the year of its last day: an event over the new year by the year it ended in', () => {
    const overNewYear = [result({ id: 'fx-ny', name: 'Fixture New Year Open', date: '2025-12-31', end_date: '2026-01-01' })]
    expect(ids({ results: overNewYear }, 'new year 2026')).toEqual(['event:fx-ny'])
    expect(ids({ results: overNewYear }, 'new year 2025')).toEqual([])
    expect(answer({ results: overNewYear }, '2026').groups[0].items[0].meta).toBe('Thu, Jan 1, 2026 · Baton Rouge, LA')
  })

  it('matches an upcoming event by its name and place, never by its year', () => {
    expect(ids({ upcoming: [event()] }, '2026')).toEqual([])
    expect(ids({ upcoming: [event()] }, 'kenner la')).toEqual(['event:fx-e1'])
  })

  it('gives one row for co-champions, whose rows read alike, and matches a champions row by a year\'s first digits', () => {
    const twice = [champion({ year: 2019 }), champion({ year: 2019 })]
    expect(ids({ champions: twice }, '2019')).toEqual(['champions:state:2019:fixture-state-champion'])
    expect(ids({ champions: twice }, '201')).toEqual(['champions:state:2019:fixture-state-champion'])
    expect(ids({ champions: twice }, '019')).toEqual([])
  })
})

// ── The query, through a stand-in for the database ─────────────────────────

/** A stand-in for the D1 binding: canned rows for each read, and how many batches were sent. */
function fakeDatabase(given: Partial<SearchRows>) {
  const asked: Array<{ sql: string; binds: unknown[] }> = []
  let batches = 0
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
      batches += 1
      asked.push(...statements)
      return statements.map(({ sql }) => ({ results: rowsFor(sql), success: true, meta: {} }))
    },
  }
  return { db: db as unknown as D1Database, asked, batches: () => batches }
}

/** A request's context as Pages hands it over, with the work handed to waitUntil collected. */
function contextFor(path: string, db: D1Database, work: Promise<unknown>[] = []): SearchContext {
  return {
    request: new Request(`https://lca-website.pages.dev${path}`),
    env: { DB: db },
    waitUntil: (promise: Promise<unknown>) => { work.push(promise) },
  } as unknown as SearchContext
}
const ask = (q: string) => `/api/search?q=${encodeURIComponent(q)}`

describe('the query, as the endpoint reads it', () => {
  it.each([
    ['"&" alone, read as "and"', '&', 200, 'and'],
    ['"Saint" alone, read as "st"', 'Saint', 200, 'st'],
    ['one letter with its mark, a single letter once the mark is off', ' é ', 400, null],
    ['signs that are no letters or numbers', '\u{1F642}\u{1F642}', 400, null],
    ['32 one-letter words, 63 characters with their spaces', Array.from({ length: 32 }, () => 'a').join(' '), 200, Array.from({ length: 32 }, () => 'a').join(' ')],
    ['33 one-letter words, 65 characters with their spaces', Array.from({ length: 33 }, () => 'a').join(' '), 400, null],
    ['two letters among 200 marks of punctuation', `${'!'.repeat(100)}ab${'?'.repeat(100)}`, 200, 'ab'],
    ['two letters apart, three characters with the space', 'a\tb', 200, 'a b'],
  ])('%s: %s', async (_what, q, status, normalised) => {
    const { db, batches } = fakeDatabase({})
    const res = await answerSearch(contextFor(ask(q), db), null)
    expect(res.status).toBe(status)
    if (status === 200) {
      expect((await res.json() as { q: string }).q).toBe(normalised)
      expect(batches()).toBe(1)
    } else {
      expect(await res.json()).toEqual({ error: 'Search for 2 to 64 letters or numbers.' })
      expect(batches()).toBe(0)
    }
  })

  it('answers every spelling that normalises alike with the same query and the same rows', async () => {
    const { db } = fakeDatabase({ clubs: [club({ name: 'Saint Martin Chess Club' })] })
    const bodies = []
    for (const q of ['Saint Martin', 'ST. MARTIN', '  st   martin  ', 'Saint-Martin']) bodies.push(await (await answerSearch(contextFor(ask(q), db), null)).text())
    expect(new Set(bodies).size).toBe(1)
    expect(JSON.parse(bodies[0]).q).toBe('st martin')
  })
})

// ── Replays and requests at once ───────────────────────────────────────────

/** A stand-in for the edge's cache: answers kept by key, and how often each was asked of it. */
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

const work: Promise<unknown>[] = []
async function flush() {
  while (work.length > 0) await Promise.all(work.splice(0))
}
afterEach(() => {
  work.length = 0
})

describe('replays and requests at once, through a stand-in cache', () => {
  const given = { clubs: [club({ name: 'Fixture Replay Club' })] }

  it('answers the same search three times with the same bytes and headers, reading the database once and keeping one answer', async () => {
    const { db, batches } = fakeDatabase(given)
    const { cache, kept, calls } = fakeCache()
    const answers = []
    for (let i = 0; i < 3; i++) {
      const res = await answerSearch(contextFor(ask('replay'), db, work), cache)
      answers.push({ status: res.status, text: await res.text(), headers: JSON.stringify([...res.headers.entries()]) })
      await flush()
    }
    expect(new Set(answers.map((a) => JSON.stringify(a))).size).toBe(1)
    expect(answers[0].status).toBe(200)
    expect(batches()).toBe(1)
    expect(calls).toEqual({ match: 3, put: 1 })
    expect(kept.size).toBe(1)
  })

  it('answers two searches asked at once, before either is kept, each from the database and alike, and keeps one answer for both', async () => {
    const { db, batches } = fakeDatabase(given)
    const { cache, kept } = fakeCache()
    const [one, two] = await Promise.all([
      answerSearch(contextFor(ask('Fixture Replay'), db, work), cache),
      answerSearch(contextFor(ask('fixture  replay'), db, work), cache),
    ])
    expect([one.status, two.status]).toEqual([200, 200])
    expect(await one.text()).toBe(await two.text())
    await flush()
    expect(batches()).toBe(2)
    expect([...kept.keys()]).toEqual([searchCacheKey('https://lca-website.pages.dev', 'fixture replay')])
  })

  it('reads q alone: another parameter beside it changes neither the answer nor the key the answer is kept under', async () => {
    const { db, batches } = fakeDatabase({ clubs: [club({ name: 'Fixture Param Club' })] })
    const { cache, kept } = fakeCache()
    const one = await (await answerSearch(contextFor('/api/search?q=param&type=clubs&page=2', db, work), cache)).text()
    await flush()
    const two = await (await answerSearch(contextFor('/api/search?page=9&q=Param', db, work), cache)).text()
    await flush()
    expect(two).toBe(one)
    expect(JSON.parse(one).groups[0].items[0].title).toBe('Fixture Param Club')
    expect(batches()).toBe(1)
    expect([...kept.keys()]).toEqual([searchCacheKey('https://lca-website.pages.dev', 'param')])
  })

  it('leaves work for after the answer only on a miss with a cache: none on a hit and none with no cache', async () => {
    const { db } = fakeDatabase(given)
    const { cache } = fakeCache()
    const handed: Promise<unknown>[] = []
    await answerSearch(contextFor(ask('replay club'), db, handed), cache)
    expect(handed).toHaveLength(1)
    await Promise.all(handed.splice(0))
    await answerSearch(contextFor(ask('replay club'), db, handed), cache)
    expect(handed).toHaveLength(0)
    await answerSearch(contextFor(ask('replay club'), db, handed), null)
    expect(handed).toHaveLength(0)
  })

  it('gives back the kept answer as it was kept, with its own Cache-Control, while the database would now say otherwise', async () => {
    const before = fakeDatabase(given)
    const { cache } = fakeCache()
    const first = await (await answerSearch(contextFor(ask('replay'), before.db, work), cache)).text()
    await flush()
    const after = fakeDatabase({ clubs: [club({ name: 'Fixture Replay Club' }), club({ id: 'fx-c2', name: 'Fixture Replay Knights' })] })
    const again = await answerSearch(contextFor(ask('replay'), after.db, work), cache)
    expect(await again.text()).toBe(first)
    expect(again.headers.get('Cache-Control')).toBe('public, max-age=60')
    expect(after.batches()).toBe(0)
  })
})

// ── The endpoint's own words ───────────────────────────────────────────────

describe('the endpoint\'s own words', () => {
  /** US Chess's old initials, put together so that this file does not hold them. */
  const OLD_INITIALS = new RegExp(`\\b${'US' + 'CF'}\\b`)
  const champions = answer({ champions: [champion(), champion({ title: 'Fixture K-8', kind: 'scholastic' })] }, 'fixture').groups[0].items.map((i) => i.meta!)
  const labels = [...SEARCH_GROUPS.map(([, label]) => label), ...Object.values(SEARCH_TAGS).map((t) => t.label), ...champions]

  it('give each heading, tag and list in sentence case, with no dash and no old initials of US Chess', () => {
    expect(champions).toEqual(['State champions', 'Scholastic champions'])
    for (const label of labels) {
      expect(label, label).toMatch(/^[A-Z][a-z]*(?: [a-z]+)*$/)
      expect(label, label).not.toMatch(/[\u2013\u2014]/)
      expect(label, label).not.toMatch(OLD_INITIALS)
    }
  })

  it('refuse a search in one plain sentence that says what to type, with no code word in it', () => {
    expect(SEARCH_REFUSED).toMatch(/^[A-Z][^.]*\.$/)
    expect(SEARCH_REFUSED).toContain('letters or numbers')
    expect(SEARCH_REFUSED).not.toMatch(/\bq\b|query|param|normali|code point|[\u2013\u2014]/i)
  })
})

// ── The reads and the key ──────────────────────────────────────────────────

describe('the reads hold no value in their text', () => {
  it('write no day, no clock of SQLite\'s own, no LIKE and no quoted value but the lists\' fixed words, every day bound instead', async () => {
    const { db, asked } = fakeDatabase({})
    await readSearchRows(db, searchWindows('2026-11-01'))
    expect(asked).toHaveLength(6)
    for (const { sql, binds } of asked) {
      expect(sql).not.toMatch(/\d{4}-\d{2}-\d{2}/)
      expect(sql).not.toMatch(/\b(?:date|datetime|julianday|strftime|unixepoch)\s*\(|'now'/i)
      // The words are matched in code, once normalised, never by SQLite's own folding of plain letters.
      expect(sql).not.toMatch(/\b(?:LIKE|GLOB|MATCH)\b|\b(?:lower|upper)\s*\(/i)
      // The only quoted words are the fixed ones each list is read by: published posts, the honor roll's two lists, Louisiana first, an empty end date.
      for (const quoted of sql.match(/'[^']*'/g) ?? []) expect(['\'published\'', '\'state\'', '\'scholastic\'', '\'LA\'', '\'\'']).toContain(quoted)
      expect(binds.at(-1)).toBe(SEARCH_READ_LIMIT)
      for (const bound of binds.slice(0, -1)) expect(['2026-11-01', '2023-11-01', '2024-11-01']).toContain(bound)
    }
  })

  it('gives empty lists for reads that return no rows list at all', async () => {
    const db = {
      prepare: () => ({ bind: () => ({}) }),
      batch: async () => [{}, { results: undefined }, {}, {}, {}],
    } as unknown as D1Database
    expect(await readSearchRows(db, searchWindows('2026-11-01'))).toEqual(rows())
  })
})

describe('the answer\'s key in the edge\'s cache, read back from its address', () => {
  it.each(['st martin', 'k 12 u1200', 'trøndelag open', 'and'])('holds search:v1: and %j on the request\'s own origin, under its own path', (q) => {
    for (const origin of ['https://lca-website.pages.dev', 'https://www.louisianachess.org']) {
      const key = new URL(searchCacheKey(origin, q))
      expect(key.origin).toBe(origin)
      expect(key.pathname).toBe('/api/search')
      expect([...key.searchParams.keys()]).toEqual(['key'])
      expect(key.searchParams.get('key')).toBe(`search:v1:${q}`)
    }
  })
})
