// test/unit/search-contract.test.ts
//
// The contract of GET /api/search (domain/contracts/search.ts, WS02 step 9)
// on its own, beside the integration test that checks the endpoint against
// it: registered as 'search' with GET alone, its query and its answer, and
// exported from the contracts' index; an answer built by the endpoint's own
// code from rows of every group, read back unchanged; and every shape brief
// 1.4's union does not allow refused: a sixth row in a group or a group with
// none, a sixth group, a Players group or any other, a tone the brief does
// not name, an empty title or address, and a field the brief does not name,
// on a row, on a tag or on the answer, a count, an email or a champion's
// name among them.
import { describe, expect, it } from 'vitest'
import * as fromIndex from '../../domain/contracts'
import {
  searchGroupSchema,
  searchItemSchema,
  searchQuerySchema,
  searchResponseSchema,
  searchTagSchema,
  type SearchResponse,
} from '../../domain/contracts/search'
import { normalizeSearchText } from '../../domain/format/searchText'
import { searchAnswer, type SearchRows } from '../../functions/utils/search'

/** Noon on Sunday, November 1, 2026 in Louisiana. */
const NOON = Date.parse('2026-11-01T18:00:00.000Z')

/** Rows of every group, as the six reads would return them. */
const EVERY_GROUP: SearchRows = {
  upcoming: [{ id: 'fx-e1', name: 'Fixture Fall Open', date: '2026-11-14', end_date: '2026-11-15', location: 'Kenner, LA', registration_status: 'open', registration_closes_at: null }],
  results: [{ id: 'fx-r1', name: 'Fixture Summer Open', date: '2026-07-11', end_date: null, location: 'Baton Rouge, LA' }],
  partners: [{ id: 'fx-p1', name: 'Fixture Gulf Open', start_date: '2026-11-21', end_date: null, city: 'Biloxi', state: 'MS', link: 'https://example.org/gulf' }],
  clubs: [{ id: 'fx-c1', name: 'Fixture Chess Club', city: 'Monroe', region: 'North Louisiana' }],
  posts: [{ slug: 'fixture-news', title: 'Fixture news', published_at: '2026-10-20' }],
  champions: [{ year: 2026, title: 'Fixture State Champion', kind: 'state' }, { year: 2025, title: 'Fixture K-8', kind: 'scholastic' }],
}
const full = (): SearchResponse => searchAnswer(EVERY_GROUP, normalizeSearchText('Fixture'), NOON)

/** A row, a group and an answer the contract allows, to be changed one way at a time. */
const item = { id: 'club:fx-c1', title: 'Fixture Chess Club', meta: 'Monroe', href: '/clubs/fx-c1' }
const group = { type: 'clubs', label: 'Clubs', items: [item] }

describe('the contract in the registry', () => {
  it('is registered as search, with GET alone, its query and its answer, and no body to send', () => {
    const { search } = fromIndex.contracts
    expect(Object.keys(search)).toEqual(['GET'])
    expect(search.GET.query).toBe(searchQuerySchema)
    expect(search.GET.response).toBe(searchResponseSchema)
    expect('request' in search.GET).toBe(false)
  })

  it('is exported from the contracts\' index, the same schemas', () => {
    expect(fromIndex.searchQuerySchema).toBe(searchQuerySchema)
    expect(fromIndex.searchResponseSchema).toBe(searchResponseSchema)
    expect(fromIndex.searchItemSchema).toBe(searchItemSchema)
  })
})

describe('the query', () => {
  it.each([
    ['a search', { q: 'morphy' }, true],
    ['an empty search, which the endpoint refuses itself once normalised', { q: '' }, true],
    ['a search with another field beside it', { q: 'morphy', page: '2' }, true],
    ['no search at all', {}, false],
    ['a number', { q: 7 }, false],
    ['a list', { q: ['morphy', 'open'] }, false],
  ])('reads %s: %s', (_what, query, ok) => {
    expect(searchQuerySchema.safeParse(query).success).toBe(ok)
  })
})

describe('an answer built by the endpoint\'s own code', () => {
  it('holds every group and reads back unchanged, field for field', () => {
    const body = full()
    expect(body.groups.map((g) => g.type)).toEqual(['tournaments', 'clubs', 'news', 'results', 'champions'])
    const parsed = searchResponseSchema.safeParse(JSON.parse(JSON.stringify(body)))
    expect(parsed.success).toBe(true)
    expect(parsed.data).toEqual(body)
  })

  it('reads back an answer with no group, the answer to a search that finds nothing', () => {
    const none = searchAnswer(EVERY_GROUP, 'zzyzx', NOON)
    expect(searchResponseSchema.parse(none)).toEqual({ q: 'zzyzx', groups: [] })
  })
})

describe('the shapes the brief\'s union does not allow', () => {
  const answerWith = (groups: unknown[]) => ({ q: 'fixture', groups })

  it('allows one to five rows a group and one to five groups', () => {
    expect(searchResponseSchema.safeParse(answerWith([{ ...group, items: Array.from({ length: 5 }, (_, i) => ({ ...item, id: `club:${i}` })) }])).success).toBe(true)
    expect(searchResponseSchema.safeParse(answerWith(Array.from({ length: 5 }, () => group))).success).toBe(true)
  })

  it.each([
    ['a sixth row in a group', answerWith([{ ...group, items: Array.from({ length: 6 }, (_, i) => ({ ...item, id: `club:${i}` })) }])],
    ['a group with no row', answerWith([{ ...group, items: [] }])],
    ['a sixth group', answerWith(Array.from({ length: 6 }, () => group))],
    ['a Players group, which search never has', answerWith([{ ...group, type: 'players', label: 'Players' }])],
    ['a Pages group, which the panel draws itself', answerWith([{ ...group, type: 'pages', label: 'Pages' }])],
    ['a group with no heading', answerWith([{ ...group, label: '' }])],
    ['a group with a field the brief does not name', answerWith([{ ...group, total: 9 }])],
    ['a row with no title', answerWith([{ ...group, items: [{ ...item, title: '' }] }])],
    ['a row with no address', answerWith([{ ...group, items: [{ ...item, href: '' }] }])],
    ['a row with no id', answerWith([{ ...group, items: [{ ...item, id: '' }] }])],
    ['a row with a count', answerWith([{ ...group, items: [{ ...item, count: 12 }] }])],
    ['a row with an email', answerWith([{ ...group, items: [{ ...item, email: 'fixture@example.org' }] }])],
    ['a row with a champion\'s name', answerWith([{ ...group, items: [{ ...item, champion: 'Fixture Person' }] }])],
    ['a row that leaves the site in words rather than true or false', answerWith([{ ...group, items: [{ ...item, external: 'yes' }] }])],
    ['a tag in a tone the brief does not name', answerWith([{ ...group, items: [{ ...item, tag: { label: 'Full', tone: 'full' } }] }])],
    ['a tag with no words', answerWith([{ ...group, items: [{ ...item, tag: { label: '', tone: 'open' } }] }])],
    ['a tag with a count beside its words', answerWith([{ ...group, items: [{ ...item, tag: { label: 'Registration open', tone: 'open', count: 12 } }] }])],
    ['an answer with a field the brief does not name', { ...answerWith([group]), total: 1 }],
    ['an answer with no search', { groups: [group] }],
  ])('refuses %s', (_what, body) => {
    expect(searchResponseSchema.safeParse(body).success).toBe(false)
  })

  it('names the six tones of the brief\'s union, though the endpoint sends four', () => {
    for (const tone of ['open', 'soon', 'closed', 'partner', 'lca', 'final']) expect(searchTagSchema.safeParse({ label: 'Words', tone }).success, tone).toBe(true)
    const sent = new Set(full().groups.flatMap((g) => g.items.flatMap((i) => (i.tag ? [i.tag.tone] : []))))
    for (const tone of sent) expect(['open', 'soon', 'closed', 'final']).toContain(tone)
  })

  it('names the five groups of the brief\'s union, in its order', () => {
    expect(searchGroupSchema.shape.type.options).toEqual(['tournaments', 'clubs', 'news', 'results', 'champions'])
  })
})
