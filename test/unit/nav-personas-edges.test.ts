// test/unit/nav-personas-edges.test.ts
//
// The edges of the persona list, test/unit/fixtures/navPersonas.ts, beside
// the cases of test/unit/nav.test.ts:
//
// - the dates hold in Louisiana's calendar on any day: worked out at
//   midnight and at 11:59 PM in America/Chicago, on both sides of the clocks
//   going back (Sunday, November 1, 2026) and forward (Sunday, March 14,
//   2027), and across the new year, the member whose membership ends within
//   30 days still has one good today that ends within 30 days, the expired
//   member's ended before today, everyone else's runs more than 30 days, and
//   every upcoming event is still to come; read with the site's own rule for
//   a membership on a day (hasActiveMembershipOn in domain/membership)
// - every person is one person: keys, titles, member ids and addresses are
//   their own, and a child's id is nobody else's
// - one event reads the same wherever it appears, an entry is the person's
//   or their child's, a person's entries come newest first, as GET /api/me
//   lists them, and a regional seat manages only the clubs of its regions,
//   which are regions the site knows
// - today's account links come in the order today's header gives them
// - where a person is one the seed already holds, it is that person, with
//   the seed's name, address, membership, club and rating, and with every
//   child, seat and entry the seed gives them and no other; every other
//   person is made up with a name and an address the seed does not use
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { hasActiveMembershipOn } from '@domain/membership/requirement'
import { REGIONS } from '@/lib/regions'
import { PERSONA_KEYS, TODAYS_ACCOUNT_LINKS, navPersonas, type NavPersona } from './fixtures/navPersonas'

const ROOT = resolve(__dirname, '../..')
const SEED = readFileSync(join(ROOT, 'scripts/seed/fixtures.sql'), 'utf8')

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** The calendar day in Louisiana at an instant, as the database writes a date. */
const louisianaDay = (at: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(at)
/** The time in Louisiana at an instant, as the site writes one ("11:59 PM"), with the clock it is on. */
const louisianaTime = (at: Date) =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(at)
/** Whole days from one date to another, both written YYYY-MM-DD. */
const daysFrom = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)

/** The instants the list is worked out for, each named as a person in Louisiana would read it. */
const INSTANTS: Array<[string, Date]> = [
  ['Friday, October 23, 2026 at 12:00 AM CDT', new Date('2026-10-23T05:00:00Z')],
  ['Friday, October 23, 2026 at 11:59 PM CDT', new Date('2026-10-24T04:59:00Z')],
  ['Sunday, November 1, 2026 at 1:30 AM CDT', new Date('2026-11-01T06:30:00Z')],
  ['Sunday, November 1, 2026 at 1:30 AM CST', new Date('2026-11-01T07:30:00Z')],
  ['Saturday, November 21, 2026 at 11:59 PM CST', new Date('2026-11-22T05:59:00Z')],
  ['Thursday, December 31, 2026 at 11:59 PM CST', new Date('2027-01-01T05:59:00Z')],
  ['Saturday, March 13, 2027 at 11:30 PM CST', new Date('2027-03-14T05:30:00Z')],
  ['Sunday, March 14, 2027 at 1:59 AM CST', new Date('2027-03-14T07:59:00Z')],
  ['Sunday, March 14, 2027 at 3:00 AM CDT', new Date('2027-03-14T08:00:00Z')],
]

const signedIn = (people: NavPersona[]) => people.filter((p): p is NavPersona & { answers: NonNullable<NavPersona['answers']> } => p.answers !== null)

describe('the dates, in Louisiana\'s calendar', () => {
  it('names each instant as Louisiana reads it, with the weekday its date falls on', () => {
    for (const [name, at] of INSTANTS) {
      const [, weekday, month, day, year, time] = /^(\w+), (\w+) (\d+), (\d{4}) at (.+)$/.exec(name)!
      expect(louisianaDay(at), name).toBe(`${year}-${String(MONTHS.indexOf(month) + 1).padStart(2, '0')}-${day.padStart(2, '0')}`)
      expect(WEEKDAYS[new Date(Date.UTC(Number(year), MONTHS.indexOf(month), Number(day))).getUTCDay()], name).toBe(weekday)
      expect(louisianaTime(at), name).toBe(time)
    }
  })

  it.each(INSTANTS)('%s: renews within 30 days, expired before today, the rest good for more than 30 days, upcoming events still to come', (_name, at) => {
    const today = louisianaDay(at)
    const people = signedIn(navPersonas(at))
    const member = (key: string) => people.find((p) => p.key === key)!.answers.me.member

    const soon = member('renews-soon')
    expect(hasActiveMembershipOn(soon, today)).toBe(true)
    expect(daysFrom(today, soon.membership_expiry!)).toBeGreaterThanOrEqual(1)
    expect(daysFrom(today, soon.membership_expiry!)).toBeLessThanOrEqual(30)

    const lapsed = member('expired-member')
    expect(lapsed.membership_status).toBe('expired')
    expect(hasActiveMembershipOn(lapsed, today)).toBe(false)
    expect(daysFrom(today, lapsed.membership_expiry!)).toBeLessThan(0)

    // Only those two sit near the end of a membership, so the join slot has
    // one person for Renew within 30 days and one for Renew once lapsed.
    for (const person of people.filter((p) => p.key !== 'renews-soon' && p.key !== 'expired-member')) {
      const own = person.answers.me.member
      expect(hasActiveMembershipOn(own, today), person.key).toBe(true)
      expect(daysFrom(today, own.membership_expiry!), person.key).toBeGreaterThan(30)
      for (const child of person.answers.me.children) {
        expect(hasActiveMembershipOn(child, today), child.full_name).toBe(true)
        expect(daysFrom(today, child.membership_expiry!), child.full_name).toBeGreaterThan(30)
      }
    }
    // An event a person directs while it is upcoming is still to come, and so
    // is every entry in it.
    const upcoming = new Set(people.flatMap((p) => p.answers.me.directedTournaments.filter((e) => e.status === 'upcoming').map((e) => e.id)))
    expect(upcoming.size).toBeGreaterThan(0)
    for (const person of people) {
      for (const event of person.answers.me.directedTournaments.filter((e) => upcoming.has(e.id))) {
        expect(daysFrom(today, event.date), `${person.key} directs ${event.id}`).toBeGreaterThan(0)
      }
      for (const entry of person.answers.me.registrations.filter((e) => upcoming.has(e.tournament_id))) {
        expect(daysFrom(today, entry.tournament_date!), `${person.key}: ${entry.id}`).toBeGreaterThan(0)
      }
    }
  })

  it('writes every date and time as the database stores them', () => {
    const DATE = /^\d{4}-\d{2}-\d{2}$/
    const TIME = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/
    for (const [, at] of INSTANTS) {
      for (const person of signedIn(navPersonas(at))) {
        const { me, mySeats } = person.answers
        expect(me.member.membership_expiry).toMatch(DATE)
        expect(me.member.created_at).toMatch(TIME)
        for (const child of me.children) {
          expect(child.membership_expiry).toMatch(DATE)
          expect(child.created_at).toMatch(TIME)
        }
        for (const entry of me.registrations) {
          expect(entry.registered_at).toMatch(TIME)
          expect(entry.tournament_date).toMatch(DATE)
        }
        for (const event of me.directedTournaments) expect(event.date).toMatch(DATE)
        for (const seat of mySeats.seats) expect(seat.started_at).toMatch(TIME)
      }
    }
  })
})

describe('every person is one person', () => {
  const people = navPersonas(new Date(Date.UTC(2026, 9, 23, 12)))
  const inside = signedIn(people)

  it('has a key, a title, a member id and an address of its own, and no child shares an id with anyone', () => {
    const unique = (values: string[]) => expect(new Set(values).size, values.join(', ')).toBe(values.length)
    unique(people.map((p) => p.key))
    expect(people.map((p) => p.key)).toEqual([...PERSONA_KEYS])
    unique(people.map((p) => p.title))
    unique(inside.map((p) => p.answers.me.member.id))
    unique(inside.map((p) => p.answers.me.member.email))
    unique([...inside.map((p) => p.answers.me.member.id), ...inside.flatMap((p) => p.answers.me.children.map((c) => c.id))])
  })

  it('keeps one event the same wherever it appears', () => {
    const seen = new Map<string, string>()
    const note = (id: string, what: string) => {
      const before = seen.get(id)
      if (before !== undefined) expect(what, id).toBe(before)
      seen.set(id, what)
    }
    for (const person of inside) {
      for (const event of person.answers.me.directedTournaments) note(event.id, `${event.name} on ${event.date}`)
      for (const entry of person.answers.me.registrations) note(entry.tournament_id, `${entry.tournament_name} on ${entry.tournament_date}`)
    }
    expect(seen.get('fx-t-open')).toMatch(/^Fixture Fall Open on /)
  })

  it('enters only the person or their children, newest first as GET /api/me lists them, and marks a child\'s entry as the child\'s', () => {
    for (const person of inside) {
      const self = person.answers.me.member
      const names = new Map([[self.id, self.full_name], ...person.answers.me.children.map((c) => [c.id, c.full_name] as [string, string])])
      for (const entry of person.answers.me.registrations) {
        expect(names.has(entry.member_id), `${person.key}: ${entry.id}`).toBe(true)
        expect(entry.is_child_entry, entry.id).toBe(entry.member_id === self.id ? 0 : 1)
        expect(entry.player_name, entry.id).toBe(names.get(entry.member_id))
      }
      const made = person.answers.me.registrations.map((e) => e.registered_at)
      expect([...made].sort().reverse(), person.key).toEqual(made)
    }
  })

  it('gives a regional seat only the clubs of its regions, every region one the site knows, and an officer seat none', () => {
    for (const person of inside) {
      const { seats, managedClubs } = person.answers.mySeats
      const regions = seats.filter((s) => s.category === 'regional_rep').flatMap((s) => s.regions ?? [])
      for (const seat of seats) {
        if (seat.category === 'regional_rep') expect((seat.regions ?? []).length, seat.id).toBeGreaterThan(0)
        else expect(seat.regions ?? [], seat.id).toEqual([])
        for (const region of seat.regions ?? []) expect(REGIONS as readonly string[], region).toContain(region)
      }
      for (const club of managedClubs) expect(regions, `${person.key}: ${club.id}`).toContain(club.region)
      if (regions.length === 0) expect(managedClubs, person.key).toEqual([])
    }
  })

  it('lists today\'s account links in the order today\'s header gives them', () => {
    for (const person of people) {
      const order = person.todaysRoleLinks.map((link) => (TODAYS_ACCOUNT_LINKS as readonly string[]).indexOf(link))
      expect(order.every((i) => i >= 0), person.key).toBe(true)
      expect([...order].sort((a, b) => a - b), person.key).toEqual(order)
    }
  })

  it('holds everything a person can hold at once in the last person', () => {
    const all = inside.find((p) => p.key === 'everything')!
    expect(all.answers.me.member.role).toBe('lca_admin')
    expect(all.aal).toBe('aal2')
    expect(all.answers.me.children.length).toBeGreaterThanOrEqual(2)
    expect(all.answers.me.directedTournaments.length).toBeGreaterThan(0)
    expect(all.answers.mySeats.seats.map((s) => s.category).sort()).toEqual(['officer', 'regional_rep'])
    expect(all.answers.mySeats.managedClubs.length).toBeGreaterThan(0)
    expect(all.holds).toEqual({ role: 'lca_admin', isBoardMember: true, managedClubs: 1, directedEvents: 1, hasChildren: true })
  })
})

describe('the people the seed already holds', () => {
  /** The seed's members: id, address, name, status, days to the end of the membership, type, club and rating. */
  const SEEDED = new Map(
    [...SEED.matchAll(/\('(fx-m-[a-z0-9-]+)', '([^']+)', '([^']+)', '(\w+)', date\('now', '([+-]\d+) days'\), '(\w+)', '(\w+)', (NULL|'[^']+'), (NULL|\d+), (NULL|'[^']+')\)/g)].map(
      ([, id, email, name, status, days, type, , club, rating, guardian]) => [
        id,
        { email, name, status, days: Number(days), type, club: club === 'NULL' ? null : club.slice(1, -1), rating: rating === 'NULL' ? null : Number(rating), guardian: guardian === 'NULL' ? null : guardian.slice(1, -1) },
      ],
    ),
  )
  /** The seed's clubs: id, name and region. */
  const CLUBS = new Map([...SEED.matchAll(/\('(fx-club-[a-z]+)', '([^']+)',[\s\S]*?'#[0-9a-f]{6}', '([^']+)', -?\d/g)].map(([, id, name, region]) => [id, { name, region }]))
  /** The seed's seats: id, role, slug and kind, with the member who holds each and since how many days. */
  const SEATS = new Map([...SEED.matchAll(/\('(fx-seat-[a-z]+)', '([^']+)', '[^']+', \d+, '([^']+)', '(\w+)', 1, 0\)/g)].map(([, id, role, slug, category]) => [id, { role, slug, category }]))
  const HOLDERS = new Map([...SEED.matchAll(/\('fx-assign-[a-z]+', '(fx-seat-[a-z]+)', '(fx-m-[a-z0-9-]+)', datetime\('now', '-(\d+) days'\), NULL\)/g)].map(([, seat, member, days]) => [seat, { member, days: Number(days) }]))
  const SEAT_REGIONS = [...SEED.matchAll(/\('(fx-seat-[a-z]+)', '([A-Za-z ]+)'\);/g)].map(([, seat, region]) => [seat, region])
  /** The seed's entries: id, event, member, section and payment, and how many days ago. */
  const ENTRIES = new Map([...SEED.matchAll(/\('(fx-r-[a-z0-9-]+)', '(fx-t-[a-z]+)', '(fx-m-[a-z0-9-]+)', '(\w+)', '(\w+)', (?:NULL|\d+), (?:NULL|'[^']+'), datetime\('now', '-(\d+) days'\)\)/g)].map(
    ([, id, event, member, section, payment, days]) => [id, { event, member, section, payment, days: Number(days) }],
  ))
  /** The seed's events: id, name, place and days from the load. */
  const EVENTS = new Map([...SEED.matchAll(/'(fx-t-[a-z]+)', '([^']+)', '([^']+)', (?:'[^']+', )?date\('now', '([+-]\d+) days'\)/g)].map(([, id, name, place, days]) => [id, { name, place, days: Number(days) }]))

  const TODAY = new Date(Date.UTC(2026, 9, 23, 12))
  const day = (date: string) => daysFrom('2026-10-23', date.slice(0, 10))
  const inside = signedIn(navPersonas(TODAY))

  it('reads the seed', () => {
    expect([...SEEDED.keys()]).toEqual(['fx-m-guardian', 'fx-m-child-1', 'fx-m-child-2', 'fx-m-p1', 'fx-m-p2', 'fx-m-p3', 'fx-m-p4', 'fx-m-p5'])
    expect([...CLUBS.keys()]).toEqual(['fx-club-capital', 'fx-club-north'])
    expect([...SEATS.keys()]).toEqual(['fx-seat-officer', 'fx-seat-rep'])
    expect([...HOLDERS.keys()]).toEqual(['fx-seat-officer', 'fx-seat-rep'])
    expect(SEAT_REGIONS).toEqual([['fx-seat-rep', 'North Louisiana']])
    expect(ENTRIES.size).toBe(8)
    expect([...EVENTS.keys()]).toEqual(['fx-t-open', 'fx-t-quads', 'fx-t-legacy', 'fx-t-done'])
  })

  it('uses the seed\'s own people where they fit, as the seed holds them', () => {
    const reused = inside.filter((p) => SEEDED.has(p.answers.me.member.id))
    expect(reused.map((p) => p.key)).toEqual(['active-member', 'expired-member', 'parent', 'regional-rep', 'officer'])
    for (const person of reused) {
      const own = person.answers.me.member
      const seed = SEEDED.get(own.id)!
      expect([own.email, own.full_name, own.membership_status, own.membership_type, own.club_id, own.uscf_rating], person.key).toEqual([seed.email, seed.name, seed.status, seed.type, seed.club, seed.rating])
      expect(day(own.membership_expiry!), person.key).toBe(seed.days)
      expect(seed.guardian, person.key).toBeNull()
      for (const child of person.answers.me.children) {
        const row = SEEDED.get(child.id)
        expect(row, child.id).toBeDefined()
        expect([child.full_name, child.membership_status, child.membership_type, child.uscf_rating, row!.guardian]).toEqual([row!.name, row!.status, row!.type, row!.rating, own.id])
        expect(day(child.membership_expiry!), child.id).toBe(row!.days)
      }
      // Every child the seed gives this person is in the list.
      expect(person.answers.me.children.map((c) => c.id).sort()).toEqual([...SEEDED].filter(([, r]) => r.guardian === own.id).map(([id]) => id).sort())
      for (const seat of person.answers.mySeats.seats) {
        const seeded = SEATS.get(seat.id)!
        expect([seat.role, seat.slug, seat.category], seat.id).toEqual([seeded.role, seeded.slug, seeded.category])
        expect(HOLDERS.get(seat.id)!.member, seat.id).toBe(own.id)
        expect(day(seat.started_at), seat.id).toBe(-HOLDERS.get(seat.id)!.days)
        expect(seat.regions ?? []).toEqual(SEAT_REGIONS.filter(([s]) => s === seat.id).map(([, r]) => r))
      }
      // Every seat the seed gives this person is in the list.
      expect(person.answers.mySeats.seats.map((s) => s.id).sort()).toEqual([...HOLDERS].filter(([, h]) => h.member === own.id).map(([seat]) => seat).sort())
      for (const entry of person.answers.me.registrations) {
        const seeded = ENTRIES.get(entry.id)
        expect(seeded, entry.id).toBeDefined()
        expect([entry.tournament_id, entry.member_id, entry.section, entry.payment_status]).toEqual([seeded!.event, seeded!.member, seeded!.section, seeded!.payment])
        expect(day(entry.registered_at), entry.id).toBe(-seeded!.days)
        const event = EVENTS.get(entry.tournament_id)!
        expect([entry.tournament_name, entry.tournament_location, day(entry.tournament_date!)]).toEqual([event.name, event.place, event.days])
      }
      // Every entry the seed gives this person or a child of theirs is in the
      // list, since GET /api/me lists both (functions/api/me.ts).
      const family = new Set([own.id, ...[...SEEDED].filter(([, r]) => r.guardian === own.id).map(([id]) => id)])
      expect(person.answers.me.registrations.map((e) => e.id).sort(), person.key).toEqual([...ENTRIES].filter(([, e]) => family.has(e.member)).map(([id]) => id).sort())
    }
  })

  it('gives every club and every event a person names the seed\'s name, region, place and date', () => {
    for (const person of inside) {
      const own = person.answers.me.member
      if (own.club_id !== null) expect(CLUBS.has(own.club_id), `${person.key}: ${own.club_id}`).toBe(true)
      for (const club of person.answers.mySeats.managedClubs) {
        expect({ name: club.name, region: club.region }, club.id).toEqual(CLUBS.get(club.id))
      }
      for (const event of person.answers.me.directedTournaments) {
        const seeded = EVENTS.get(event.id)
        expect(seeded, event.id).toBeDefined()
        expect([event.name, day(event.date)]).toEqual([seeded!.name, seeded!.days])
      }
    }
  })

  it('makes up everyone else with a name and an address the seed does not use', () => {
    const seededNames = new Set([...SEEDED.values()].map((r) => r.name))
    const seededEmails = new Set([...SEEDED.values()].map((r) => r.email))
    for (const person of inside.filter((p) => !SEEDED.has(p.answers.me.member.id))) {
      const own = person.answers.me.member
      expect(seededNames.has(own.full_name), own.full_name).toBe(false)
      expect(seededEmails.has(own.email), own.email).toBe(false)
      for (const child of person.answers.me.children) {
        expect(SEEDED.has(child.id), child.id).toBe(false)
        expect(seededNames.has(child.full_name), child.full_name).toBe(false)
      }
    }
  })
})
