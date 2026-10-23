// test/integration/nav-personas.test.ts
//
// The people of test/unit/fixtures/navPersonas.ts against the real server.
// In the browser tests, test/a11y/signedIn.ts answers the site's calls for a
// signed-in person with that person's answers, shaped, the persona list
// says, as the server answers them. Here the server answers the same calls
// for the same people, on a database built from the migrations with
// scripts/seed/fixtures.sql loaded, as the browser tests' databases are:
//
// - the people the seed already holds are read as they stand, but for the
//   role the list gives them, since the seed gives every member the plain
//   member's; everyone else is written in as the list describes them (the
//   member and their children, the events they direct, their seats and the
//   regions a regional seat covers), and nothing else
// - for every person, GET /api/me and GET /api/board/my-seats answer what the
//   person's answers say, field for field and with the same kind of value,
//   apart from the moment of the day a row was written, and with the same
//   children, seats and entries both ways: none the server lists is missing
//   from the list, and the list adds none
// - what the site works out from those answers (the board inbox, the clubs a
//   regional seat covers, the events directed, the children) is what the
//   list says the person holds
// - POST /api/me answers 201 and the member, as the helper answers it, and a
//   second one, as the site sends on a page load, writes nothing new
// - role safety: without a sign-in, or with a made-up token, the three
//   calls answer 401 and never the data. The planted session itself is
//   refused by the browser tests' servers, whose sign-in address is a closed
//   port (test/a11y/signed-in-edges.spec.ts); this file's stand-in for the
//   sign-in service accepts any token that names a member, so it is not the
//   place to show that.
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import SEED from '../../scripts/seed/fixtures.sql?raw'
import { invoke, resetHarness } from './harness'
import { splitSql } from '../shared/splitSql'
import { navPersonas, type NavPersona } from '../unit/fixtures/navPersonas'

import { onRequestGet as meGet, onRequestPost as mePost } from '../../functions/api/me'
import { onRequestGet as mySeatsGet } from '../../functions/api/board/my-seats'

beforeEach(resetHarness)

type Row = Record<string, unknown>
type SignedIn = NavPersona & { answers: NonNullable<NavPersona['answers']>; user: NonNullable<NavPersona['user']> }

/** The database's own day, as it writes a date. */
async function databaseDay(): Promise<string> {
  return (await env.DB.prepare(`SELECT date('now') AS day`).first<{ day: string }>())!.day
}

let PEOPLE: SignedIn[] = []
const SEEDED = new Set<string>()

/** Writes in a person the seed does not hold, as the list describes them. */
async function writeIn(person: SignedIn) {
  const own = person.answers.me.member
  await env.DB.prepare(
    `INSERT INTO members (id, email, full_name, uscf_id, uscf_rating, membership_status, membership_expiry, membership_type, role, club_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(own.id, own.email, own.full_name, own.uscf_id, own.uscf_rating, own.membership_status, own.membership_expiry, own.membership_type ?? null, own.role, own.club_id, own.created_at).run()
  for (const child of person.answers.me.children) {
    await env.DB.prepare(
      `INSERT INTO members (id, email, full_name, uscf_id, uscf_rating, membership_status, membership_expiry, membership_type, role, club_id, guardian_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'member', ?, ?, ?)`,
    ).bind(child.id, own.email, child.full_name, child.uscf_id, child.uscf_rating, child.membership_status, child.membership_expiry, child.membership_type, own.club_id, own.id, child.created_at).run()
  }
}

/** Gives a person, seeded or written in, the role, the events and the seats the list gives them. */
async function giveHoldings(person: SignedIn) {
  const own = person.answers.me.member
  await env.DB.prepare('UPDATE members SET role = ? WHERE id = ?').bind(own.role, own.id).run()
  for (const event of person.answers.me.directedTournaments) {
    await env.DB.prepare('INSERT OR IGNORE INTO tournament_directors (tournament_id, member_id) VALUES (?, ?)').bind(event.id, own.id).run()
  }
  let order = 100
  for (const seat of person.answers.mySeats.seats) {
    const exists = await env.DB.prepare('SELECT 1 AS one FROM board_members WHERE id = ?').bind(seat.id).first()
    if (exists) continue
    await env.DB.prepare(
      `INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active, is_shared) VALUES (?, ?, ?, ?, ?, ?, 1, 0)`,
    ).bind(seat.id, seat.role, own.full_name, order++, seat.slug, seat.category).run()
    await env.DB.prepare(`INSERT INTO board_seat_assignments (id, seat_id, member_id, started_at) VALUES (?, ?, ?, ?)`)
      .bind(`fx-assign-${seat.id}`, seat.id, own.id, seat.started_at).run()
    for (const region of seat.regions ?? []) {
      await env.DB.prepare('INSERT OR IGNORE INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(seat.id, region).run()
    }
  }
}

beforeAll(async () => {
  // The seed writes its dates from the day it is loaded and the list from
  // the day it is worked out for; both are the database's day, and the seed
  // is loaded again if that day turned while it loaded.
  let day = ''
  for (let tries = 0; tries < 2 && day === ''; tries++) {
    const before = await databaseDay()
    for (const statement of splitSql(SEED)) await env.DB.prepare(statement).run()
    if ((await databaseDay()) === before) day = before
  }
  expect(day).not.toBe('')
  PEOPLE = navPersonas(new Date(`${day}T12:00:00Z`)).filter((p): p is SignedIn => p.answers !== null && p.user !== null)
  for (const { id } of (await env.DB.prepare(`SELECT id FROM members WHERE id LIKE 'fx-m-%'`).all<{ id: string }>()).results) SEEDED.add(id)
  for (const person of PEOPLE) {
    if (!SEEDED.has(person.answers.me.member.id)) await writeIn(person)
    await giveHoldings(person)
  }
})

/** The kind of a JSON value: null, or its type. */
const kindOf = (value: unknown) => (value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value)

/**
 * Every field the list gives is one the server sends, with the same kind of
 * value and the same value, but for the fields that hold the moment a row was
 * written, where only the day has to agree, or the kind, for created_at.
 */
function sameAsServer(said: object, sent: Row, where: string, timeOfDay: string[] = []) {
  for (const [field, value] of Object.entries(said)) {
    expect(Object.hasOwn(sent, field), `${where}: the server sends no ${field}`).toBe(true)
    expect(kindOf(sent[field]), `${where}.${field}`).toBe(kindOf(value))
    if (field === 'created_at') continue
    if (timeOfDay.includes(field)) expect(String(sent[field]).slice(0, 10), `${where}.${field}`).toBe(String(value).slice(0, 10))
    else expect(sent[field], `${where}.${field}`).toEqual(value)
  }
}

describe('the people of the persona list, as the server answers for them', () => {
  it('holds the eleven people who sign in, five of them the seed\'s own', () => {
    expect(PEOPLE).toHaveLength(11)
    expect(PEOPLE.filter((p) => SEEDED.has(p.answers.me.member.id) && !p.answers.me.member.id.startsWith('fx-m-child')).map((p) => p.key).sort()).toEqual(
      ['active-member', 'expired-member', 'officer', 'parent', 'regional-rep'],
    )
  })

  it('answers GET /api/me with the member, the children, the events directed and the entries the list gives, no more and no fewer', async () => {
    for (const person of PEOPLE) {
      const res = await invoke(meGet, { as: person.user.id, aal: person.aal ?? 'aal1', path: '/api/me' })
      expect(res.status, person.key).toBe(200)
      const body = await res.json<{ member: Row; registrations: Row[]; directedTournaments: Row[]; children: Row[] }>()
      const said = person.answers.me
      sameAsServer(said.member, body.member, `${person.key} member`)
      expect(body.children.map((c) => c.id), person.key).toEqual(said.children.map((c) => c.id))
      said.children.forEach((child, i) => sameAsServer(child, body.children[i], `${person.key} child ${child.id}`))
      expect([...body.directedTournaments].sort((a, b) => String(a.id).localeCompare(String(b.id))), person.key).toEqual(
        [...said.directedTournaments].sort((a, b) => a.id.localeCompare(b.id)),
      )
      // The same entries both ways: the person's own and their children's,
      // which the server lists newest first, with ties in no fixed order.
      expect(body.registrations.map((r) => String(r.id)).sort(), person.key).toEqual(said.registrations.map((r) => r.id).sort())
      for (const entry of said.registrations) {
        const sent = body.registrations.find((r) => r.id === entry.id)
        expect(sent, `${person.key}: the server does not list ${entry.id}`).toBeDefined()
        sameAsServer(entry, sent!, `${person.key} entry ${entry.id}`, ['registered_at'])
      }
    }
  })

  it('answers GET /api/board/my-seats with the seats and the clubs the list gives', async () => {
    for (const person of PEOPLE) {
      const res = await invoke(mySeatsGet, { as: person.user.id, aal: person.aal ?? 'aal1', path: '/api/board/my-seats' })
      expect(res.status, person.key).toBe(200)
      const body = await res.json<{ seats: Row[]; managedClubs: Row[] }>()
      const said = person.answers.mySeats
      expect(body.seats.map((s) => s.id), person.key).toEqual(said.seats.map((s) => s.id))
      said.seats.forEach((seat, i) => sameAsServer(seat, body.seats[i], `${person.key} seat ${seat.id}`, ['started_at']))
      expect(body.managedClubs, person.key).toEqual(said.managedClubs)
    }
  })

  it('gives each person, from the server\'s answers, what the list says the person holds', async () => {
    const VIEW_ONLY = ['lca_observer', 'lca_officer']
    for (const person of PEOPLE) {
      const me = await (await invoke(meGet, { as: person.user.id, path: '/api/me' })).json<{ member: { role: string }; directedTournaments: Row[]; children: Row[] }>()
      const mine = await (await invoke(mySeatsGet, { as: person.user.id, path: '/api/board/my-seats' })).json<{ seats: Row[]; managedClubs: Row[] }>()
      const role = me.member.role
      // As src/contexts/AuthContext.tsx works it out.
      const isBoardMember = mine.seats.length > 0 || role === 'lca_admin' || VIEW_ONLY.includes(role)
      expect({ role, isBoardMember, managedClubs: mine.managedClubs.length, directedEvents: me.directedTournaments.length, hasChildren: me.children.length > 0 }, person.key).toEqual(person.holds)
    }
  })
})

describe('POST /api/me, as the site sends it on every page load', () => {
  it('answers 201 and the member the list gives, and the second one writes nothing new', async () => {
    for (const person of PEOPLE) {
      const first = await invoke(mePost, { method: 'POST', as: person.user.id, path: '/api/me' })
      expect(first.status, person.key).toBe(201)
      const { member } = await first.json<{ member: Row }>()
      // The test's stand-in for the sign-in service gives every person an
      // address of its own, which the server copies, as it copies a changed
      // address; every other field is the list's.
      const rest = Object.fromEntries(Object.entries(person.answers.synced.member).filter(([field]) => field !== 'email'))
      sameAsServer(rest, member, `${person.key} after POST`)
      const second = await invoke(mePost, { method: 'POST', as: person.user.id, path: '/api/me' })
      expect(second.status, person.key).toBe(201)
      expect(await second.json<{ member: Row }>(), person.key).toEqual({ member })
      const rows = await env.DB.prepare('SELECT COUNT(*) AS n FROM members WHERE id = ?').bind(person.user.id).first<{ n: number }>()
      expect(rows?.n, person.key).toBe(1)
    }
  })
})

describe('role safety: the three calls the helper answers', () => {
  const CALLS = [
    ['GET /api/me', meGet, 'GET'],
    ['POST /api/me', mePost, 'POST'],
    ['GET /api/board/my-seats', mySeatsGet, 'GET'],
  ] as const

  it.each(CALLS)('%s answers 401 without a sign-in, and never the data', async (_name, handler, method) => {
    const res = await invoke(handler, { method })
    expect(res.status).toBe(401)
    const body = JSON.stringify(await res.json())
    expect(body).not.toMatch(/member|seats|managedClubs|Fixture|fx-/)
  })

  it.each(CALLS)('%s answers 401 to a made-up token, and never the data', async (_name, handler, method) => {
    const res = await invoke(handler, { method, headers: { Authorization: 'Bearer invalid-planted-session' } })
    expect(res.status).toBe(401)
    expect(JSON.stringify(await res.json())).not.toMatch(/member|seats|managedClubs|Fixture|fx-/)
  })
})
