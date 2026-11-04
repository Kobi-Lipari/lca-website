// test/integration/tournament-create-edges.test.ts
//
// The edges of the widened create (WS08 step 3: criterion 12, D20, Q2 and
// Q37), each in the state its name gives:
// - CREATION_ROLES_ON and the President seat are read at each request: the
//   same standing director and the same president are refused, let through
//   and refused again as the constant is unset, set and unset; a term that
//   ends between two creates takes the second, and one that starts between
//   them gives it; a term on another seat gives nothing;
// - the checks keep today's order: the first refusal before the body is
//   read, the body before any check of the club, the LCA-run refusal before
//   the club is looked up and before the membership requirement is checked,
//   and an LCA admin's missing club still 404;
// - a one-event director, a member with a director row on another event (a
//   standing director's own among them), is refused in both states, and
//   keeps its row;
// - only an LCA admin chooses an event's id: a standing director, the
//   president and a club rep who holds the seat get the slug's id, the
//   director row going to that id;
// - a standing director whose account still names a club, as an account
//   moved off club_rep can, creates LCA-run events only, as any standing
//   director;
// - a club rep's event, its seat or not, may still ask for the membership
//   requirement, and its LCA-run refusal is today's.
// CREATION_ROLES_ON is false in the tree. It is read here through a getter on
// the mocked module and put back to unset after every case.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LCA_RUN_ONLY } from '../../domain/events/creation'
import { LCA_RUN_NEEDS_MEMBERSHIP } from '../../domain/membership/requirement'
import { onRequestPost as createTournament } from '../../functions/api/admin/tournaments'
import { seedClub, seedMember, seedPresident } from './factories'
import { invoke, resetHarness } from './harness'

const flags = vi.hoisted(() => ({ rolesOn: false }))
vi.mock('../../functions/utils/events/creation', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/events/creation')>()
  return {
    ...real,
    get CREATION_ROLES_ON() {
      return flags.rolesOn
    },
  }
})

beforeEach(resetHarness)
afterEach(() => {
  flags.rolesOn = false
  vi.restoreAllMocks()
})

const STATES: ReadonlyArray<readonly [string, boolean]> = [['unset', false], ['set', true]]

let seq = 0
const body = (extra: Record<string, unknown> = {}) => ({
  name: `Edge probe ${++seq}`, location: 'Monroe, LA', date: '2026-12-19', entryFee: 10, ...extra,
})
const create = (as: string, extra: Record<string, unknown> = {}) => invoke(createTournament, { method: 'POST', as, body: body(extra) })

const count = async (sql: string, ...args: unknown[]) => (await env.DB.prepare(sql).bind(...args).first<{ n: number }>())?.n ?? 0
const events = () => count('SELECT COUNT(*) AS n FROM tournaments')
const directorRowsOf = (member: string) => count('SELECT COUNT(*) AS n FROM tournament_directors WHERE member_id = ?', member)
const idOf = async (res: Awaited<ReturnType<typeof create>>) => (await res.json<{ tournament: { id: string } }>()).tournament.id

async function seatedMember(role = 'lca_observer'): Promise<string> {
  const id = await seedMember({ role })
  await seedPresident(id)
  return id
}

describe('the constant and the seat are read at each request', () => {
  it('the same standing director and the same president are refused, let through and refused again as the constant is unset, set and unset', async () => {
    for (const [who, as] of [['a standing director', await seedMember({ role: 'tournament_director' })], ['the president', await seatedMember()]] as const) {
      const answers: number[] = []
      for (const rolesOn of [false, true, false]) {
        flags.rolesOn = rolesOn
        answers.push((await create(as)).status)
      }
      expect(answers, who).toEqual([403, 201, 403])
      expect(await directorRowsOf(as), who).toBe(1)
    }
  })

  it('with the constant set, a term on the President seat that ends between two creates takes the second, and one that starts between them gives it', async () => {
    flags.rolesOn = true
    const leaving = await seatedMember()
    expect((await create(leaving)).status).toBe(201)
    await env.DB.prepare("UPDATE board_seat_assignments SET ended_at = datetime('now') WHERE member_id = ? AND ended_at IS NULL").bind(leaving).run()
    const refused = await create(leaving)
    expect(refused.status).toBe(403)
    expect(await refused.json()).toEqual({ error: 'Forbidden' })

    const arriving = await seedMember({ role: 'lca_observer' })
    expect((await create(arriving)).status).toBe(403)
    await seedPresident(arriving)
    expect((await create(arriving)).status).toBe(201)
    expect([await directorRowsOf(leaving), await directorRowsOf(arriving)]).toEqual([1, 1])
  })

  it('with the constant set, a current term on another seat, the Vice President\'s, gives no create', async () => {
    flags.rolesOn = true
    const member = await seedMember({ role: 'lca_observer' })
    const seat = await env.DB.prepare("SELECT id FROM board_members WHERE slug = 'vice-president'").first<{ id: string }>()
    expect(seat).not.toBeNull()
    await env.DB.prepare('INSERT INTO board_seat_assignments (id, seat_id, member_id) VALUES (?, ?, ?)').bind(`edge-term-${++seq}`, seat!.id, member).run()
    const before = await events()
    const res = await create(member)
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Forbidden' })
    expect(await events()).toBe(before)
  })
})

describe('the checks keep today\'s order', () => {
  it.each(STATES)('with the constant %s, a plain member and an auditor are refused before the body is read', async (_state, rolesOn) => {
    flags.rolesOn = rolesOn
    for (const role of ['member', 'lca_auditor']) {
      const res = await invoke(createTournament, { method: 'POST', as: await seedMember({ role }), body: {} })
      expect(res.status, role).toBe(403)
      expect(await res.json(), role).toEqual({ error: 'Forbidden' })
    }
  })

  it('with the constant unset, a standing director and the president are refused before the body is read, as today', async () => {
    for (const as of [await seedMember({ role: 'tournament_director' }), await seatedMember()]) {
      const res = await invoke(createTournament, { method: 'POST', as, body: { location: 'Monroe, LA' } })
      expect(res.status).toBe(403)
      expect(await res.json()).toEqual({ error: 'Forbidden' })
    }
  })

  it('with the constant set, a standing director and the president who send no name are answered 400, club or none, before the club is checked', async () => {
    flags.rolesOn = true
    const club = await seedClub()
    for (const as of [await seedMember({ role: 'tournament_director' }), await seatedMember()]) {
      for (const extra of [{}, { clubId: club }]) {
        const res = await create(as, { ...extra, name: '' })
        expect(res.status).toBe(400)
        expect(await res.json()).toEqual({ error: 'name, location, date, and entryFee are required' })
      }
    }
  })

  it('with the constant set, a club that does not exist and a club with the requirement left out are refused the president and a standing director with the LCA-run words', async () => {
    flags.rolesOn = true
    const club = await seedClub()
    const before = await events()
    for (const as of [await seedMember({ role: 'tournament_director' }), await seatedMember()]) {
      for (const extra of [{ clubId: 'no-such-club' }, { clubId: club, requiresLcaMembership: false }, { clubId: club, requiresLcaMembership: true }]) {
        const res = await create(as, extra)
        expect(res.status, JSON.stringify(extra)).toBe(403)
        expect(await res.json(), JSON.stringify(extra)).toEqual({ error: LCA_RUN_ONLY })
      }
      expect(await directorRowsOf(as)).toBe(0)
    }
    expect(await events()).toBe(before)
  })

  it.each(STATES)('with the constant %s, an LCA admin naming a club that does not exist is answered 404, as today', async (_state, rolesOn) => {
    flags.rolesOn = rolesOn
    const res = await create(await seedMember({ role: 'lca_admin' }), { clubId: 'no-such-club' })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Club not found' })
  })

  it('with the constant set, a standing director\'s LCA-run event that leaves the requirement out is answered 400 with today\'s words, and one that asks for it is created with it', async () => {
    flags.rolesOn = true
    const director = await seedMember({ role: 'tournament_director' })
    const refused = await create(director, { requiresLcaMembership: false })
    expect(refused.status).toBe(400)
    expect(await refused.json()).toEqual({ error: LCA_RUN_NEEDS_MEMBERSHIP })
    const made = await create(director, { requiresLcaMembership: true })
    expect(made.status).toBe(201)
    const row = await env.DB.prepare('SELECT club_id, requires_lca_membership FROM tournaments WHERE id = ?').bind(await idOf(made)).first()
    expect(row).toEqual({ club_id: null, requires_lca_membership: 1 })
  })
})

describe.each(STATES)('a one-event director, with the constant %s (criterion 12)', (_state, rolesOn) => {
  beforeEach(() => {
    flags.rolesOn = rolesOn
  })

  it('a member who directs another event, a standing director\'s among them, is refused with "Forbidden", and its row gives it nothing to create with', async () => {
    flags.rolesOn = true
    const standing = await seedMember({ role: 'tournament_director' })
    const made = await create(standing)
    expect(made.status).toBe(201)
    const directed = await idOf(made)
    const oneEvent = await seedMember()
    await env.DB.prepare('INSERT INTO tournament_directors (tournament_id, member_id) VALUES (?, ?)').bind(directed, oneEvent).run()
    flags.rolesOn = rolesOn
    const before = await events()
    const res = await create(oneEvent)
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Forbidden' })
    expect(await events()).toBe(before)
    expect(await directorRowsOf(oneEvent)).toBe(1)
  })
})

describe('only an LCA admin chooses an event\'s id', () => {
  it('with the constant set, a standing director, the president and a club rep who holds the seat get the slug\'s id, the director row going to it, and an LCA admin gets its own', async () => {
    flags.rolesOn = true
    const club = await seedClub()
    const seatedRep = await seedMember({ role: 'club_rep', clubId: club })
    await seedPresident(seatedRep)
    const people: ReadonlyArray<readonly [string, string, boolean]> = [
      ['a standing director', await seedMember({ role: 'tournament_director' }), true],
      ['the president', await seatedMember(), true],
      ['a club rep who holds the seat', seatedRep, false],
    ]
    for (const [who, as, row] of people) {
      const chosen = `chosen-id-${++seq}`
      const res = await create(as, { id: chosen })
      expect(res.status, who).toBe(201)
      const id = await idOf(res)
      expect(id, who).not.toBe(chosen)
      expect(id, who).toMatch(/^edge-probe-\d+-[0-9a-z]+$/)
      expect(await count('SELECT COUNT(*) AS n FROM tournaments WHERE id = ?', chosen), who).toBe(0)
      const rows = (await env.DB.prepare('SELECT tournament_id FROM tournament_directors WHERE member_id = ?').bind(as).all<{ tournament_id: string }>()).results
      expect(rows.map((r) => r.tournament_id), who).toEqual(row ? [id] : [])
    }
    const chosen = `chosen-id-${++seq}`
    const admin = await create(await seedMember({ role: 'lca_admin' }), { id: chosen })
    expect(admin.status).toBe(201)
    expect(await idOf(admin)).toBe(chosen)
  })
})

describe('a standing director whose account still names a club', () => {
  it('with the constant set, creates LCA-run events only, as any standing director, and is written as its first director', async () => {
    flags.rolesOn = true
    const club = await seedClub()
    const director = await seedMember({ role: 'tournament_director', clubId: club })
    const named = await create(director, { clubId: club })
    expect(named.status).toBe(403)
    expect(await named.json()).toEqual({ error: LCA_RUN_ONLY })
    const made = await create(director)
    expect(made.status).toBe(201)
    const id = await idOf(made)
    expect(await env.DB.prepare('SELECT club_id, requires_lca_membership FROM tournaments WHERE id = ?').bind(id).first()).toEqual({ club_id: null, requires_lca_membership: 1 })
    expect(await directorRowsOf(director)).toBe(1)
  })
})

describe.each(STATES)('a club rep\'s own club, with the constant %s (Q2)', (_state, rolesOn) => {
  beforeEach(() => {
    flags.rolesOn = rolesOn
  })

  it('a club rep, and one who holds the seat, naming its own club, creates its club\'s draft and may ask for the membership requirement', async () => {
    for (const seat of [false, true]) {
      const club = await seedClub()
      const rep = await seedMember({ role: 'club_rep', clubId: club })
      if (seat) await seedPresident(rep)
      for (const [extra, required] of [[{ clubId: club }, 0], [{ requiresLcaMembership: true }, 1], [{ clubId: club, requiresLcaMembership: false }, 0]] as const) {
        const res = await create(rep, extra)
        expect(res.status, JSON.stringify(extra)).toBe(201)
        const row = await env.DB.prepare('SELECT club_id, is_visible, requires_lca_membership FROM tournaments WHERE id = ?').bind(await idOf(res)).first()
        expect(row, JSON.stringify(extra)).toEqual({ club_id: club, is_visible: 0, requires_lca_membership: required })
      }
      expect(await directorRowsOf(rep)).toBe(0)
    }
  })
})
