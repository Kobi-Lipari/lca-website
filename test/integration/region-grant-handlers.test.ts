// test/integration/region-grant-handlers.test.ts
//
// The regional representative's grant (WS09 step 16) as the handlers that
// read it answer, on a database built from the migrations, with
// REGION_EVENTS_ON set through a getter on its own module and no mock of
// rolesOn's rules:
// - creating (POST /api/admin/tournaments): a seat holder with no stronger
//   grant creates for a club in the seat's regions, an added region included,
//   and not for a club outside them, not an LCA-run event, and, with an ended
//   term or no seat, not at all; the event is a hidden draft with its creator
//   written and, since WS09 step 17, marked for approval; a fee above $0 is
//   refused with the payout-account words and nothing written, with
//   CREATION_ROLES_ON unset and with it set; a club rep who also holds a seat
//   keeps today's rule on their own club and, since WS09 step 17, creates for
//   another club in the region at $0 as its representative; an LCA admin with
//   a seat charges as today;
// - naming directors (POST .../directors): on a club event in the region the
//   seat holder drafted, and not on one someone else drafted or one outside
//   the region; nothing written when refused;
// - GET /api/me/tournament-creation answers the grant regional_rep under its
//   contract once the switch is set, 401 signed out, and today's answer while
//   it is unset;
// - with the switch unset every one of these answers as on the base.
// CREATION_ROLES_ON is read through a getter on the mocked creation module
// and put back after each case.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { contracts } from '../../domain/contracts'
import { mayList } from '../../domain/events/approval'
import { FEES_NEED_PAYOUT_ACCOUNT } from '../../domain/events/creation'
import { onRequestDelete as deleteMember } from '../../functions/api/admin/members/[id]'
import { onRequestPost as createTournament } from '../../functions/api/admin/tournaments'
import { onRequestPost as assignDirector } from '../../functions/api/admin/tournaments/[id]/directors'
import { onRequestGet as creationGet } from '../../functions/api/me/tournament-creation'
import { seedAdmin, seedClub, seedMember, seedTournament } from './factories'
import { expectContract, invoke, resetHarness } from './harness'

const flags = vi.hoisted(() => ({ rolesOn: false, regionOn: false }))
vi.mock('../../functions/utils/events/creation', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/events/creation')>()
  return {
    ...real,
    get CREATION_ROLES_ON() {
      return flags.rolesOn
    },
  }
})
vi.mock('../../functions/utils/clubs/pages', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/clubs/pages')>()
  return {
    ...real,
    get REGION_EVENTS_ON() {
      return flags.regionOn
    },
  }
})

beforeEach(resetHarness)
afterEach(() => {
  flags.rolesOn = false
  flags.regionOn = false
})

let seq = 0
const REGION = 'Example Bayou Region'
const ADDED = 'Example Prairie Region'
const FAR = 'Example Far Region'

async function clubIn(region: string, name: string): Promise<string> {
  const id = await seedClub({ name: `${name} ${++seq}` })
  await env.DB.prepare('UPDATE clubs SET region = ? WHERE id = ?').bind(region, id).run()
  return id
}

/** A regional seat over the regions, held now by the member when one is given; returns the term's id. */
async function regionalSeat(memberId: string, regions: readonly string[] = [REGION]): Promise<string> {
  const seat = `seat-region-${++seq}`
  await env.DB.prepare(
    `INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active)
     VALUES (?, 'Example Region Representative', '', 99, ?, 'regional_rep', 1)`,
  ).bind(seat, seat).run()
  for (const region of regions) await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(seat, region).run()
  const term = `term-region-${++seq}`
  await env.DB.prepare('INSERT INTO board_seat_assignments (id, seat_id, member_id) VALUES (?, ?, ?)').bind(term, seat, memberId).run()
  return term
}

async function count(sql: string, ...args: unknown[]): Promise<number> {
  const row = await env.DB.prepare(sql).bind(...args).first<{ n: number }>()
  return row?.n ?? 0
}

async function create(as: string, clubId: string | null, entryFee = 0) {
  const name = `Example Region Open ${++seq}`
  const res = await invoke(createTournament, {
    method: 'POST',
    as,
    body: { name, location: 'Kenner, LA', date: '2026-12-12', entryFee, ...(clubId ? { clubId } : {}) },
  })
  const rows = await env.DB.prepare('SELECT id, club_id, created_by, is_visible, needs_lca_approval, approved_at, approved_by FROM tournaments WHERE name = ?')
    .bind(name).all<{ id: string; club_id: string | null; created_by: string; is_visible: number; needs_lca_approval: number; approved_at: string | null; approved_by: string | null }>()
  return { res, rows: rows.results }
}

describe('creating, with REGION_EVENTS_ON set and CREATION_ROLES_ON unset', () => {
  beforeEach(() => {
    flags.regionOn = true
  })

  it('lets a seat holder create a $0 hidden draft for a club in the seat\'s region, with its creator written and marked for approval (WS09 step 17)', async () => {
    const club = await clubIn(REGION, 'Example Chess Club')
    const id = await seedMember()
    await regionalSeat(id)
    const { res, rows } = await create(id, club)
    expect(res.status).toBe(201)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ club_id: club, created_by: id, is_visible: 0, needs_lca_approval: 1, approved_at: null, approved_by: null })
    const answer = await res.json<{ tournament: Record<string, unknown> }>()
    expect(answer.tournament).toMatchObject({ needs_lca_approval: 1, approval_requested_at: null, approved_at: null, approved_by: null })
  })

  it('counts a seat\'s added region, and not a region the seat does not keep', async () => {
    const added = await clubIn(ADDED, 'Example Prairie Club')
    const far = await clubIn(FAR, 'Example Rooks Club')
    const id = await seedMember()
    await regionalSeat(id, [REGION, ADDED])
    expect((await create(id, added)).res.status).toBe(201)
    const outside = await create(id, far)
    expect(outside.res.status).toBe(403)
    expect(outside.rows).toHaveLength(0)
  })

  it('refuses an LCA-run event, and writes nothing', async () => {
    await clubIn(REGION, 'Example Chess Club')
    const id = await seedMember()
    await regionalSeat(id)
    const { res, rows } = await create(id, null)
    expect(res.status).toBe(403)
    expect(rows).toHaveLength(0)
  })

  it('refuses an ended term and a member with no seat, whatever the club, and lets a current holder in', async () => {
    const club = await clubIn(REGION, 'Example Chess Club')
    const ended = await seedMember()
    const term = await regionalSeat(ended)
    await env.DB.prepare("UPDATE board_seat_assignments SET ended_at = datetime('now') WHERE id = ?").bind(term).run()
    const plain = await seedMember()
    const open = await seedMember()
    await regionalSeat(open)
    for (const who of [ended, plain]) {
      const { res, rows } = await create(who, club)
      expect(res.status, who).toBe(403)
      expect(rows, who).toHaveLength(0)
    }
    expect((await create(open, club)).res.status).toBe(201)
  })

  it.each([false, true])('refuses a fee above $0 on a club in the region with CREATION_ROLES_ON %s, with the payout-account words and nothing written', async (rolesOn) => {
    flags.rolesOn = rolesOn
    const club = await clubIn(REGION, 'Example Chess Club')
    const id = await seedMember()
    await regionalSeat(id)
    const { res, rows } = await create(id, club, 25)
    expect(res.status).toBe(403)
    expect((await res.json<{ error: string }>()).error).toBe(FEES_NEED_PAYOUT_ACCOUNT)
    expect(rows).toHaveLength(0)
    expect((await create(id, club, 0)).res.status).toBe(201)
  })

  it.each([false, true])('keeps a club rep who holds a seat on today\'s rule on their own club, and lets them create for another club in the region as its representative, hidden, marked and at $0 (WS09 step 17), with CREATION_ROLES_ON %s', async (rolesOn) => {
    flags.rolesOn = rolesOn
    const own = await clubIn(REGION, 'Example Chess Club')
    const other = await clubIn(REGION, 'Example Knights Club')
    const id = await seedMember({ role: 'club_rep', clubId: own })
    await regionalSeat(id)
    // A club rep's event is its club's, whatever the body names, so its fee follows today's rule.
    const ownFee = await create(id, own, 30)
    expect(ownFee.res.status).toBe(201)
    expect(ownFee.rows[0]).toMatchObject({ club_id: own, created_by: id })
    // Another club in the region: created as its representative.
    const otherFree = await create(id, other, 0)
    expect(otherFree.res.status).toBe(201)
    expect(otherFree.rows).toHaveLength(1)
    expect(otherFree.rows[0]).toMatchObject({ club_id: other, created_by: id, is_visible: 0, needs_lca_approval: 1 })
  })

  it.each([false, true])('lets an LCA admin who holds a seat charge as today, on a club in the region and on an LCA-run event, with CREATION_ROLES_ON %s', async (rolesOn) => {
    flags.rolesOn = rolesOn
    const club = await clubIn(REGION, 'Example Chess Club')
    const id = await seedAdmin()
    await regionalSeat(id)
    expect((await create(id, club, 25)).res.status).toBe(201)
    expect((await create(id, null, 25)).res.status).toBe(201)
  })

  it('answers as on the base with the switch unset: the same seat holder is refused a $0 event in their own region', async () => {
    flags.regionOn = false
    const club = await clubIn(REGION, 'Example Chess Club')
    const id = await seedMember()
    await regionalSeat(id)
    const { res, rows } = await create(id, club, 0)
    expect(res.status).toBe(403)
    expect(rows).toHaveLength(0)
  })

  it('role safety: a signed-out caller gets 401 and a plain member 403, and no event is written', async () => {
    const club = await clubIn(REGION, 'Example Chess Club')
    const before = await count('SELECT COUNT(*) AS n FROM tournaments')
    const anonymous = await invoke(createTournament, { method: 'POST', body: { name: 'Example Region Open', location: 'Kenner, LA', date: '2026-12-12', entryFee: 0, clubId: club } })
    expect(anonymous.status).toBe(401)
    const member = await seedMember()
    expect((await create(member, club)).res.status).toBe(403)
    expect(await count('SELECT COUNT(*) AS n FROM tournaments')).toBe(before)
  })
})

describe('naming directors, with REGION_EVENTS_ON set', () => {
  beforeEach(() => {
    flags.regionOn = true
  })

  async function draft(clubId: string | null, createdBy: string | null) {
    const event = await seedTournament({ clubId, entryFee: 0, isVisible: false })
    await env.DB.prepare('UPDATE tournaments SET created_by = ? WHERE id = ?').bind(createdBy, event).run()
    return event
  }
  const name = (as: string, event: string, memberId: string) => invoke(assignDirector, { method: 'POST', as, params: { id: event }, body: { memberId } })

  it.each([false, true])('lets a seat holder name a director on a club event in the region they drafted, with CREATION_ROLES_ON %s', async (rolesOn) => {
    flags.rolesOn = rolesOn
    const club = await clubIn(REGION, 'Example Chess Club')
    const id = await seedMember()
    await regionalSeat(id)
    const event = await draft(club, id)
    const director = await seedMember()
    expect((await name(id, event, director)).status).toBe(201)
    expect(await count('SELECT COUNT(*) AS n FROM tournament_directors WHERE tournament_id = ? AND member_id = ?', event, director)).toBe(1)
  })

  it('refuses a club event in the region that someone else drafted, one outside the region, and an LCA-run event, writing no director', async () => {
    const club = await clubIn(REGION, 'Example Chess Club')
    const far = await clubIn(FAR, 'Example Rooks Club')
    const id = await seedMember()
    await regionalSeat(id)
    const other = await seedMember()
    const director = await seedMember()
    for (const [label, event] of [
      ['another person\'s draft', await draft(club, other)],
      ['no known drafter', await draft(club, null)],
      ['outside the region', await draft(far, id)],
      ['an LCA-run event', await draft(null, id)],
    ] as const) {
      expect((await name(id, event, director)).status, label).toBe(403)
      expect(await count('SELECT COUNT(*) AS n FROM tournament_directors WHERE tournament_id = ?', event), label).toBe(0)
    }
  })

  it('refuses the same seat holder with the switch unset', async () => {
    flags.regionOn = false
    const club = await clubIn(REGION, 'Example Chess Club')
    const id = await seedMember()
    await regionalSeat(id)
    const event = await draft(club, id)
    expect((await name(id, event, await seedMember())).status).toBe(403)
    expect(await count('SELECT COUNT(*) AS n FROM tournament_directors WHERE tournament_id = ?', event)).toBe(0)
  })

  it('role safety: a signed-out caller gets 401 and a member with no seat 403', async () => {
    const club = await clubIn(REGION, 'Example Chess Club')
    const maker = await seedMember()
    const event = await draft(club, maker)
    const director = await seedMember()
    expect((await invoke(assignDirector, { method: 'POST', params: { id: event }, body: { memberId: director } })).status).toBe(401)
    expect((await name(maker, event, director)).status).toBe(403)
    expect(await count('SELECT COUNT(*) AS n FROM tournament_directors WHERE tournament_id = ?', event)).toBe(0)
  })
})

describe('GET /api/me/tournament-creation for a seat holder', () => {
  const contract = contracts['me/tournament-creation'].GET

  it('answers the grant regional_rep under its contract once the switch is set, with CREATION_ROLES_ON unset and set, and no LCA-run create', async () => {
    const id = await seedMember()
    await regionalSeat(id)
    flags.regionOn = true
    for (const rolesOn of [false, true]) {
      flags.rolesOn = rolesOn
      const answer = await expectContract(await invoke(creationGet, { as: id }), contract.response)
      expect(answer, String(rolesOn)).toMatchObject({ grant: 'regional_rep', canCreate: false, clubId: null })
    }
  })

  it('answers the grant none while the switch is unset, as on the base, and 401 signed out in both states', async () => {
    const id = await seedMember()
    await regionalSeat(id)
    expect(await expectContract(await invoke(creationGet, { as: id }), contract.response)).toEqual({ grant: 'none', canCreate: false, canChargeFees: true, clubId: null })
    expect((await invoke(creationGet, {})).status).toBe(401)
    flags.regionOn = true
    expect((await invoke(creationGet, {})).status).toBe(401)
  })

  it('never gives a member without a seat the grant, with the switch set', async () => {
    flags.regionOn = true
    const id = await seedMember()
    expect((await expectContract(await invoke(creationGet, { as: id }), contract.response)).grant).toBe('none')
  })
})

describe('the wait, read from stored rows', () => {
  async function stored(id: string) {
    const row = await env.DB.prepare('SELECT needs_lca_approval, approved_at FROM tournaments WHERE id = ?').bind(id).first<{ needs_lca_approval: number; approved_at: string | null }>()
    if (!row) throw new Error(`no event ${id}`)
    return row
  }

  it('reads false for a marked event until approved_at is set, true once set, and true for an event nobody marked', async () => {
    const club = await clubIn(REGION, 'Example Chess Club')
    const marked = await seedTournament({ clubId: club, entryFee: 0, isVisible: false })
    const plain = await seedTournament({ clubId: club, entryFee: 0, isVisible: false })
    await env.DB.prepare('UPDATE tournaments SET needs_lca_approval = 1, approval_requested_at = ? WHERE id = ?').bind('2026-11-15 18:00:00', marked).run()
    expect(mayList(await stored(marked))).toBe(false)
    expect(mayList(await stored(plain))).toBe(true)
    await env.DB.prepare('UPDATE tournaments SET approved_at = ? WHERE id = ?').bind('2026-11-16 09:30:00', marked).run()
    expect(mayList(await stored(marked))).toBe(true)
  })

  it('still lists after the member who approved it is deleted: approved_by is cleared and approved_at stays', async () => {
    const club = await clubIn(REGION, 'Example Chess Club')
    const admin = await seedAdmin()
    const approver = await seedMember({ fullName: 'Player One', email: 'player.one@example.org' })
    const event = await seedTournament({ clubId: club, entryFee: 0, isVisible: false })
    await env.DB.prepare('UPDATE tournaments SET needs_lca_approval = 1, approved_at = ?, approved_by = ? WHERE id = ?').bind('2026-11-16 09:30:00', approver, event).run()
    expect((await invoke(deleteMember, { method: 'DELETE', as: admin, params: { id: approver } })).status).toBe(200)
    const row = await env.DB.prepare('SELECT approved_by, approved_at FROM tournaments WHERE id = ?').bind(event).first<{ approved_by: string | null; approved_at: string | null }>()
    expect(row).toEqual({ approved_by: null, approved_at: '2026-11-16 09:30:00' })
    expect(mayList(await stored(event))).toBe(true)
  })
})
