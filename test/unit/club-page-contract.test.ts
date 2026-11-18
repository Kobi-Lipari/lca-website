// test/unit/club-page-contract.test.ts
// The strictness of the club page's contract (domain/contracts/clubPage.ts,
// WS09 step 20), part by part: every object in the answer refuses a key it
// does not name, so no email, officer, roster, member's id or keeper's id can
// be added anywhere in the body without this file and the contract saying so;
// the colour, the sections, the two lists' limits and the events' keys are
// held; and the registry carries the route.
import { describe, expect, it } from 'vitest'
import { clubPageEventSchema, clubPageResponseSchema } from '../../domain/contracts/clubPage'
import { contracts } from '../../domain/contracts'

const event = { id: 'event-1', name: 'Example Open', date: '2026-12-05', end_date: null, status: 'upcoming', registration_status: 'open', max_players: 30, registered_count: 2 }
const place = { name: 'Example Hall', street: '1 Example Street', note: null, latitude: 30.4, longitude: -91.2 }
const near = { name: 'Example Near Club', city: 'Example Town', slug: 'example-near-club', statement: null, distance: 'about 12 mi' }
const sample = () => ({
  club: { id: 'example-club', slug: 'example-club', name: 'Example Chess Club', city: 'Example City', region: null, color: '#1a2744', logo: null },
  sections: ['about', 'when_and_where', 'events', 'contact'],
  about: { text: 'A made up club.', cost: null, welcome: null, facebook: null, website: null, other: null, weekend_play: false, scholastic_friendly: false },
  statement: { text: 'Tuesdays at 7:00 PM', told: 'Last checked November 2026' },
  places: [place],
  contact: { name: 'Contact P.', goes_to: 'club' },
  events: [event],
  news: [{ id: 'news-1', title: 'Example News', excerpt: 'Example excerpt', news_date: '2026-11-01' }],
  nearest: [near],
})
const parses = (value: unknown) => clubPageResponseSchema.safeParse(value).success

describe('the club page contract', () => {
  it('takes the answer a club page sends', () => {
    expect(parses(sample())).toBe(true)
  })

  it('refuses a key it does not name at the top and inside every object of the answer', () => {
    const extra = { contact_email: 'club@example.org' }
    const base = sample()
    expect(parses({ ...base, ...extra })).toBe(false)
    expect(parses({ ...base, club: { ...base.club, ...extra } })).toBe(false)
    expect(parses({ ...base, about: { ...base.about, ...extra } })).toBe(false)
    expect(parses({ ...base, statement: { ...base.statement, told_by: 'member-1' } })).toBe(false)
    expect(parses({ ...base, contact: { ...base.contact, ...extra } })).toBe(false)
    expect(parses({ ...base, places: [{ ...place, ...extra }] })).toBe(false)
    expect(parses({ ...base, events: [{ ...event, created_by: 'member-1' }] })).toBe(false)
    expect(parses({ ...base, news: [{ ...base.news[0], ...extra }] })).toBe(false)
    expect(parses({ ...base, nearest: [{ ...near, ...extra }] })).toBe(false)
    expect(clubPageEventSchema.safeParse({ ...event, approved_by: 'member-1' }).success).toBe(false)
  })

  it('refuses the keys the page must never carry, wherever they are put', () => {
    const base = sample()
    for (const key of ['officers', 'roster', 'members', 'member_count', 'keeper_id', 'told_by', 'confirmed_by', 'last_confirmed_at', 'approval_requested_at']) {
      expect(parses({ ...base, [key]: [] }), key).toBe(false)
      expect(parses({ ...base, club: { ...base.club, [key]: 'x' } }), key).toBe(false)
    }
  })

  it('refuses a missing part, so a page never meets a hole', () => {
    const base = sample() as Record<string, unknown>
    for (const key of Object.keys(base)) {
      const rest = { ...base }
      delete rest[key]
      expect(parses(rest), key).toBe(false)
    }
  })

  it('holds the colour to a # and six lower-case digits, and the sections to the six names', () => {
    const base = sample()
    for (const color of ['#C8A94A', 'gold', '#fff', '#1a27449', '']) expect(parses({ ...base, club: { ...base.club, color } }), color).toBe(false)
    expect(parses({ ...base, sections: ['about', 'roster'] })).toBe(false)
    expect(parses({ ...base, sections: ['about', 'when_and_where', 'events', 'news', 'photos', 'contact'] })).toBe(true)
  })

  it('holds the places to two and the nearest clubs to three', () => {
    const base = sample()
    expect(parses({ ...base, places: [place, place] })).toBe(true)
    expect(parses({ ...base, places: [place, place, place] })).toBe(false)
    expect(parses({ ...base, nearest: [near, near, near] })).toBe(true)
    expect(parses({ ...base, nearest: [near, near, near, near] })).toBe(false)
  })

  it('holds an event to its keys: a date and the end date or null, a status, a Register state and the counts as whole numbers', () => {
    const base = sample()
    const withEvent = (change: Record<string, unknown>) => parses({ ...base, events: [{ ...event, ...change }] })
    expect(withEvent({ end_date: '2026-12-06' })).toBe(true)
    expect(withEvent({ max_players: null })).toBe(true)
    expect(withEvent({ date: 'Sat, Dec 5' })).toBe(false)
    expect(withEvent({ status: 'hidden' })).toBe(false)
    expect(withEvent({ registration_status: 'full' })).toBe(false)
    expect(withEvent({ registered_count: -1 })).toBe(false)
    expect(withEvent({ registered_count: 1.5 })).toBe(false)
    expect(withEvent({ registered_count: null })).toBe(false)
  })

  it('is the registry\'s contract for GET /api/clubs/[id]/page, a read with no request body', () => {
    const route = contracts['clubs/[id]/page']
    expect(Object.keys(route)).toEqual(['GET'])
    expect(route.GET.response).toBe(clubPageResponseSchema)
    expect('request' in route.GET ? route.GET.request : undefined).toBeUndefined()
  })
})
