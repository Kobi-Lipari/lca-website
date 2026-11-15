// test/integration/club-events-edges.test.ts
//
// The edges of a regional representative's club events (WS09 step 17) that
// club-events.test.ts leaves, on a database built from the migrations, with
// REGION_EVENTS_ON and CREATION_ROLES_ON read through getters on their own
// modules and no rule mocked:
// - creating at the seat's edges: a club in a region the seat added, a club
//   with no region, an ended term and an open seat, and two creates at once;
// - stale data: a club that moves out of the region, or is deleted, after the
//   event is drafted;
// - a marked event's fee rule for a club rep of another club who is named a
//   director there, with an event not marked as the contrast;
// - the directors and the membership switch after approval and after publish;
// - a refused publish and an approved one, replayed;
// - checkpoint S's answer for the club's admin page: a representative is not
//   shown a club's hidden drafts there, the ones they draft included;
// - GET /api/me/tournament-creation for a seat holder, as step 16 left it;
// - the words of the two refusals: no dash, "US Chess" and not the old name.
// Every club and person here is made up.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { contracts } from '../../domain/contracts'
import { WAITING_FOR_APPROVAL } from '../../domain/events/approval'
import { FEES_NEED_PAYOUT_ACCOUNT, LCA_RUN_ONLY } from '../../domain/events/creation'
import { onRequestGet as adminClubGet } from '../../functions/api/admin/clubs/[id]'
import { onRequestPost as createTournament } from '../../functions/api/admin/tournaments'
import { onRequestPatch as patchTournament } from '../../functions/api/admin/tournaments/[id]'
import {
  onRequestDelete as removeDirector,
  onRequestPost as assignDirector,
} from '../../functions/api/admin/tournaments/[id]/directors'
import { onRequestGet as manageGet } from '../../functions/api/admin/tournaments/[id]/manage'
import { onRequestGet as creationGet } from '../../functions/api/me/tournament-creation'
import { seedAdmin, seedClub, seedMember, seedTournament, seedTournamentDirector } from './factories'
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
const APPROVED_AT = '2026-11-16 09:30:00'

async function clubIn(region: string | null, name: string): Promise<string> {
  const id = await seedClub({ name: `${name} ${++seq}` })
  await env.DB.prepare('UPDATE clubs SET region = ? WHERE id = ?').bind(region, id).run()
  return id
}

/** A regional seat over the regions, held now by the member when one is given; returns the term's id, or null for a seat nobody holds. */
async function regionalSeat(memberId: string | null, regions: readonly string[] = [REGION]): Promise<string | null> {
  const seat = `seat-region-${++seq}`
  await env.DB.prepare(
    `INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active)
     VALUES (?, 'Example Region Representative', '', 99, ?, 'regional_rep', 1)`,
  ).bind(seat, seat).run()
  for (const region of regions) await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(seat, region).run()
  if (!memberId) return null
  const term = `term-region-${++seq}`
  await env.DB.prepare('INSERT INTO board_seat_assignments (id, seat_id, member_id) VALUES (?, ?, ?)').bind(term, seat, memberId).run()
  return term
}

async function count(sql: string, ...args: unknown[]): Promise<number> {
  return (await env.DB.prepare(sql).bind(...args).first<{ n: number }>())?.n ?? 0
}

interface Row {
  id: string
  club_id: string | null
  created_by: string | null
  is_visible: number
  needs_lca_approval: number
  requires_lca_membership: number
}
const row = (id: string) => env.DB.prepare('SELECT id, club_id, created_by, is_visible, needs_lca_approval, requires_lca_membership FROM tournaments WHERE id = ?').bind(id).first<Row>()

async function create(as: string, extra: Record<string, unknown> = {}) {
  const name = `Example Edge Open ${++seq}`
  const res = await invoke(createTournament, { method: 'POST', as, body: { name, location: 'Kenner, LA', date: '2026-12-12', entryFee: 0, ...extra } })
  const { results } = await env.DB.prepare('SELECT id, club_id, created_by, is_visible, needs_lca_approval, requires_lca_membership FROM tournaments WHERE name = ?').bind(name).all<Row>()
  return { res, rows: results }
}

const save = (as: string, id: string, body: Record<string, unknown>) => invoke(patchTournament, { method: 'PATCH', as, params: { id }, body })
const name = (as: string, id: string, memberId: string) => invoke(assignDirector, { method: 'POST', as, params: { id }, body: { memberId } })
const unname = (as: string, id: string, memberId: string) => invoke(removeDirector, { method: 'DELETE', as, params: { id }, body: { memberId } })
const error = async (res: { json: <T>() => Promise<T> }) => (await res.json<{ error: string }>()).error

async function mark(id: string, approvedAt: string | null = null): Promise<void> {
  await env.DB.prepare('UPDATE tournaments SET needs_lca_approval = 1, approved_at = ? WHERE id = ?').bind(approvedAt, id).run()
}

async function draftBy(memberId: string, clubId: string | null): Promise<string> {
  const id = await seedTournament({ clubId, createdBy: memberId, entryFee: 0, sections: [{ name: 'Open', entryFee: 0 }], isVisible: false })
  if (clubId) await mark(id)
  return id
}

const openFee = async (id: string) => (await env.DB.prepare("SELECT fee_regular FROM tournament_sections WHERE tournament_id = ? AND name = 'Open' AND archived_at IS NULL").bind(id).first<{ fee_regular: number }>())?.fee_regular
async function openSection(id: string): Promise<string> {
  return (await env.DB.prepare("SELECT id FROM tournament_sections WHERE tournament_id = ? AND name = 'Open' AND archived_at IS NULL").bind(id).first<{ id: string }>())!.id
}

describe('creating at the seat\'s edges, with REGION_EVENTS_ON set', () => {
  beforeEach(() => {
    flags.regionOn = true
  })

  it('creates for a club in a region the seat added, hidden and marked, and not for a club in none of its regions', async () => {
    const representative = await seedMember()
    await regionalSeat(representative, [FAR, ADDED])
    const prairie = await clubIn(ADDED, 'Example Prairie Club')
    const bayou = await clubIn(REGION, 'Example Bayou Club')
    const made = await create(representative, { clubId: prairie })
    expect(made.res.status).toBe(201)
    expect(made.rows[0]).toMatchObject({ club_id: prairie, created_by: representative, is_visible: 0, needs_lca_approval: 1 })
    const refused = await create(representative, { clubId: bayou })
    expect(refused.res.status).toBe(403)
    expect(refused.rows).toHaveLength(0)
  })

  it('refuses a club with no region, an ended term and an open seat, writing nothing, with the words every member gets', async () => {
    const representative = await seedMember()
    await regionalSeat(representative)
    const noRegion = await clubIn(null, 'Example Pawns Club')
    const inRegion = await clubIn(REGION, 'Example Bayou Club')
    const unregioned = await create(representative, { clubId: noRegion })
    expect(unregioned.res.status).toBe(403)
    expect(unregioned.rows).toHaveLength(0)

    const ended = await seedMember()
    const term = await regionalSeat(ended)
    await env.DB.prepare("UPDATE board_seat_assignments SET ended_at = datetime('now') WHERE id = ?").bind(term).run()
    const endedMade = await create(ended, { clubId: inRegion })
    expect(endedMade.res.status).toBe(403)
    expect(await error(endedMade.res)).toBe('Forbidden')
    expect(endedMade.rows).toHaveLength(0)

    await regionalSeat(null)
    const bystander = await seedMember()
    const open = await create(bystander, { clubId: inRegion })
    expect(open.res.status).toBe(403)
    expect(open.rows).toHaveLength(0)
  })

  it('writes two creates made at once as two events, each hidden, marked and the representative\'s own', async () => {
    const representative = await seedMember()
    await regionalSeat(representative)
    const club = await clubIn(REGION, 'Example Bayou Club')
    const [a, b] = await Promise.all([create(representative, { clubId: club }), create(representative, { clubId: club })])
    expect([a.res.status, b.res.status]).toEqual([201, 201])
    expect(a.rows).toHaveLength(1)
    expect(b.rows).toHaveLength(1)
    expect(a.rows[0].id).not.toBe(b.rows[0].id)
    for (const made of [a, b]) expect(made.rows[0]).toMatchObject({ club_id: club, created_by: representative, is_visible: 0, needs_lca_approval: 1 })
    expect(await count('SELECT COUNT(*) AS n FROM tournament_directors WHERE tournament_id IN (?, ?)', a.rows[0].id, b.rows[0].id)).toBe(0)
  })

  it('refuses a standing director who holds a seat a paid entry on a club in the region with the payout-account words, and creates their LCA-run event by today\'s rule', async () => {
    flags.rolesOn = true
    const club = await clubIn(REGION, 'Example Bayou Club')
    const director = await seedMember({ role: 'tournament_director' })
    await regionalSeat(director)
    const paid = await create(director, { clubId: club, entryFee: 10 })
    expect(paid.res.status).toBe(403)
    expect(await error(paid.res)).toBe(FEES_NEED_PAYOUT_ACCOUNT)
    // With no club named, the director's own LCA-run rule still applies, and is not the representative's.
    const lcaRun = await create(director, { entryFee: 10 })
    expect(lcaRun.res.status).toBe(201)
    expect(lcaRun.rows[0]).toMatchObject({ club_id: null, needs_lca_approval: 0 })
  })
})

describe('stale data, with REGION_EVENTS_ON set', () => {
  beforeEach(() => {
    flags.regionOn = true
  })

  it('stops running an event when its club moves out of the region, and starts again when it moves back', async () => {
    const representative = await seedMember()
    await regionalSeat(representative)
    const club = await clubIn(REGION, 'Example Bayou Club')
    const draft = await draftBy(representative, club)
    expect((await save(representative, draft, { venue: 'Example Hall' })).status).toBe(200)
    const before = await row(draft)
    await env.DB.prepare('UPDATE clubs SET region = ? WHERE id = ?').bind(FAR, club).run()
    for (const attempt of [
      () => save(representative, draft, { venue: 'Example Second Hall' }),
      () => save(representative, draft, { requiresLcaMembership: true }),
      () => name(representative, draft, 'member-example-nobody'),
      () => invoke(manageGet, { as: representative, params: { id: draft } }),
    ]) {
      expect((await attempt()).status).toBe(403)
    }
    expect(await row(draft)).toEqual(before)
    await env.DB.prepare('UPDATE clubs SET region = ? WHERE id = ?').bind(REGION, club).run()
    expect((await save(representative, draft, { venue: 'Example Third Hall' })).status).toBe(200)
  })

  it('leaves an event whose club was deleted marked: the representative gets nothing and a publish is still refused, an LCA admin\'s included', async () => {
    const representative = await seedMember()
    await regionalSeat(representative)
    const admin = await seedAdmin()
    const club = await clubIn(REGION, 'Example Bayou Club')
    const draft = await draftBy(representative, club)
    await env.DB.prepare('UPDATE tournaments SET club_id = NULL WHERE club_id = ?').bind(club).run()
    expect((await save(representative, draft, { venue: 'Example Hall' })).status).toBe(403)
    expect((await name(representative, draft, await seedMember())).status).toBe(403)
    const refused = await save(admin, draft, { isVisible: true })
    expect(refused.status).toBe(409)
    expect(await error(refused)).toBe(WAITING_FOR_APPROVAL)
    expect(await row(draft)).toMatchObject({ is_visible: 0, club_id: null })
  })
})

describe('a raised fee on a marked event, for a club rep of another club named a director there', () => {
  it.each([false, true])('is refused on the marked event and goes through on the same event unmarked, CREATION_ROLES_ON %s', async (rolesOn) => {
    flags.rolesOn = rolesOn
    flags.regionOn = true
    const representative = await seedMember()
    await regionalSeat(representative)
    const club = await clubIn(REGION, 'Example Bayou Club')
    const otherClub = await clubIn(REGION, 'Example Knights Club')
    const outsider = await seedMember({ role: 'club_rep', clubId: otherClub })
    const draft = await draftBy(representative, club)
    await seedTournamentDirector(draft, outsider)
    const Open = await openSection(draft)
    const raise = (fee: number) => ({ sections: [{ id: Open, name: 'Open', entryFee: fee }] })
    const refused = await save(outsider, draft, raise(10))
    expect(refused.status).toBe(403)
    expect(await error(refused)).toBe(FEES_NEED_PAYOUT_ACCOUNT)
    expect(await openFee(draft)).toBe(0)
    // The mark is what holds the fee: on the same event unmarked, D24's own rule is all that applies.
    await env.DB.prepare('UPDATE tournaments SET needs_lca_approval = 0 WHERE id = ?').bind(draft).run()
    expect((await save(outsider, draft, raise(10))).status).toBe(200)
    expect(await openFee(draft)).toBe(10)
  })
})

describe('the directors and the membership switch on the representative\'s own draft, whatever its state', () => {
  beforeEach(() => {
    flags.regionOn = true
  })

  it('names and removes a director after approval and after the event lists, and an assigned director still cannot change the switch', async () => {
    const representative = await seedMember()
    await regionalSeat(representative)
    const club = await clubIn(REGION, 'Example Bayou Club')
    const draft = await draftBy(representative, club)
    await mark(draft, APPROVED_AT)
    expect((await save(representative, draft, { isVisible: true })).status).toBe(200)
    const first = await seedMember()
    const second = await seedMember()
    expect((await name(representative, draft, first)).status).toBe(201)
    expect((await name(representative, draft, second)).status).toBe(201)
    expect((await unname(representative, draft, first)).status).toBe(200)
    expect(await count('SELECT COUNT(*) AS n FROM tournament_directors WHERE tournament_id = ?', draft)).toBe(1)
    expect((await save(representative, draft, { requiresLcaMembership: true })).status).toBe(200)
    const refused = await save(second, draft, { requiresLcaMembership: false })
    expect(refused.status).toBe(403)
    expect(await row(draft)).toMatchObject({ requires_lca_membership: 1, is_visible: 1 })
  })

  it('refuses another region\'s representative the removal of a director too, and keeps the row', async () => {
    const representative = await seedMember()
    await regionalSeat(representative)
    const other = await seedMember()
    await regionalSeat(other, [FAR])
    const club = await clubIn(REGION, 'Example Bayou Club')
    const draft = await draftBy(representative, club)
    const director = await seedMember()
    await seedTournamentDirector(draft, director)
    expect((await unname(other, draft, director)).status).toBe(403)
    expect(await count('SELECT COUNT(*) AS n FROM tournament_directors WHERE tournament_id = ?', draft)).toBe(1)
  })

  it('does not let the representative name or remove directors on an event another representative of the same region drafted', async () => {
    const first = await seedMember()
    await regionalSeat(first)
    const second = await seedMember()
    await regionalSeat(second)
    const club = await clubIn(REGION, 'Example Bayou Club')
    const draft = await draftBy(first, club)
    const director = await seedMember()
    await seedTournamentDirector(draft, director)
    const before = await row(draft)
    expect((await name(second, draft, await seedMember())).status).toBe(403)
    expect((await unname(second, draft, director)).status).toBe(403)
    expect((await save(second, draft, { requiresLcaMembership: true })).status).toBe(403)
    expect(await row(draft)).toEqual(before)
    // The second representative runs it all the same, as every club event in the region.
    expect((await save(second, draft, { venue: 'Example Hall' })).status).toBe(200)
  })
})

describe('a publish, replayed', () => {
  beforeEach(() => {
    flags.regionOn = true
  })

  it('is refused the same way every time before approval, and written once after it', async () => {
    const representative = await seedMember()
    await regionalSeat(representative)
    const admin = await seedAdmin()
    const club = await clubIn(REGION, 'Example Bayou Club')
    const draft = await draftBy(representative, club)
    const log = () => count("SELECT COUNT(*) AS n FROM admin_audit_log WHERE action = 'tournament_publish'")
    const logged = await log()
    for (let turn = 0; turn < 2; turn += 1) {
      for (const who of [representative, admin]) {
        const res = await save(who, draft, { isVisible: true })
        expect(res.status).toBe(409)
        expect(await res.json()).toEqual({ error: WAITING_FOR_APPROVAL })
      }
    }
    expect(await row(draft)).toMatchObject({ is_visible: 0, needs_lca_approval: 1 })
    expect(await log()).toBe(logged)
    await mark(draft, APPROVED_AT)
    for (let turn = 0; turn < 2; turn += 1) expect((await save(representative, draft, { isVisible: true })).status).toBe(200)
    expect(await row(draft)).toMatchObject({ is_visible: 1 })
    expect(await log()).toBe(logged + 1)
  })

  it('answers a publish of a marked event 401 signed out and 403 to another region\'s representative and to a plain member, never the wait\'s 409, and writes nothing', async () => {
    const representative = await seedMember()
    await regionalSeat(representative)
    const other = await seedMember()
    await regionalSeat(other, [FAR])
    const plain = await seedMember()
    const club = await clubIn(REGION, 'Example Bayou Club')
    const draft = await draftBy(representative, club)
    const before = await row(draft)
    expect((await invoke(patchTournament, { method: 'PATCH', params: { id: draft }, body: { isVisible: true } })).status).toBe(401)
    for (const who of [other, plain]) {
      const res = await save(who, draft, { isVisible: true })
      expect(res.status).toBe(403)
      expect(await error(res)).not.toBe(WAITING_FOR_APPROVAL)
    }
    expect(await row(draft)).toEqual(before)
  })

  it('refuses a save that publishes and raises a fee at once with the publish\'s 409 and writes neither', async () => {
    const representative = await seedMember()
    await regionalSeat(representative)
    const admin = await seedAdmin()
    const club = await clubIn(REGION, 'Example Bayou Club')
    const draft = await draftBy(representative, club)
    const Open = await openSection(draft)
    const res = await save(admin, draft, { isVisible: true, sections: [{ id: Open, name: 'Open', entryFee: 10 }] })
    expect(res.status).toBe(409)
    expect(await row(draft)).toMatchObject({ is_visible: 0 })
    expect(await openFee(draft)).toBe(0)
  })
})

describe('the club\'s admin answer, as checkpoint S left it', () => {
  it.each([false, true])('shows a representative no hidden draft of the club, the ones they draft and a club rep\'s own included, and shows an LCA admin every one, with REGION_EVENTS_ON %s', async (regionOn) => {
    flags.regionOn = regionOn
    const club = await clubIn(REGION, 'Example Bayou Club')
    const representative = await seedMember()
    await regionalSeat(representative)
    const rep = await seedMember({ role: 'club_rep', clubId: club })
    const admin = await seedAdmin()
    const mine = await draftBy(representative, club)
    const theirs = await seedTournament({ clubId: club, createdBy: rep, isVisible: false })
    const listed = await seedTournament({ clubId: club, createdBy: rep, isVisible: true })
    const events = async (who: string) => {
      const res = await invoke(adminClubGet, { as: who, params: { id: club } })
      expect(res.status).toBe(200)
      return (await res.json<{ tournaments: Array<{ id: string }> }>()).tournaments.map((t) => t.id).sort()
    }
    expect(await events(representative)).toEqual([listed])
    expect(await events(admin)).toEqual([mine, theirs, listed].sort())
    expect(await events(rep)).toEqual([mine, theirs, listed].sort())
  })
})

describe('GET /api/me/tournament-creation for a seat holder, as step 16 left it', () => {
  const contract = contracts['me/tournament-creation'].GET

  it('answers regional_rep, no create and a fee answer for an LCA-run event: yes while CREATION_ROLES_ON is unset and no once it is set, so no page takes a representative\'s fee from it', async () => {
    const id = await seedMember()
    await regionalSeat(id)
    flags.regionOn = true
    flags.rolesOn = false
    expect(await expectContract(await invoke(creationGet, { as: id }), contract.response)).toEqual({ grant: 'regional_rep', canCreate: false, canChargeFees: true, clubId: null })
    flags.rolesOn = true
    expect(await expectContract(await invoke(creationGet, { as: id }), contract.response)).toEqual({ grant: 'regional_rep', canCreate: false, canChargeFees: false, clubId: null })
  })

  it('answers a representative who creates a paid event on the club the same words the create does: refused', async () => {
    const id = await seedMember()
    await regionalSeat(id)
    const club = await clubIn(REGION, 'Example Bayou Club')
    flags.regionOn = true
    flags.rolesOn = false
    expect(await expectContract(await invoke(creationGet, { as: id }), contract.response)).toMatchObject({ canChargeFees: true })
    const paid = await create(id, { clubId: club, entryFee: 10 })
    expect(paid.res.status).toBe(403)
    expect(await error(paid.res)).toBe(FEES_NEED_PAYOUT_ACCOUNT)
  })
})

describe('the words of the two refusals', () => {
  it('carry no dash, no old name for US Chess and no half written as a decimal', () => {
    for (const words of [WAITING_FOR_APPROVAL, FEES_NEED_PAYOUT_ACCOUNT, LCA_RUN_ONLY]) {
      // The two dashes and the old initials are built from parts, so this file holds none of them.
      expect(words).not.toMatch(new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`))
      expect(words).not.toMatch(new RegExp(`\\b${'US' + 'CF'}\\b`))
      expect(words).not.toMatch(/\.5\b/)
      expect(words.endsWith('.')).toBe(true)
    }
  })
})
