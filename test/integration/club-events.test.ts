// test/integration/club-events.test.ts
//
// A regional representative's club events (WS09 step 17), as the handlers
// answer on a database built from the migrations, with REGION_EVENTS_ON and
// CREATION_ROLES_ON read through getters on their own modules and no rule
// mocked:
// - the four grants: creating for a club in the region (hidden, marked for an
//   LCA admin's approval, at $0), naming directors and changing the
//   membership switch on the representative's own draft, and running every
//   club event in the region, a club rep's own among them;
// - every caller of canManageTournament and of the two helpers that wrap it,
//   one row each: the region's representative gets through, another region's
//   representative is refused, and so is the same representative with the
//   constant unset; an LCA-run event, a club with no region, an ended seat
//   and an open seat give nothing, and a seat's added region counts;
// - the refusals: a publish before approval is 409 with the wait's words for
//   everyone, an LCA admin included, with nothing written; a fee above $0 is
//   refused a representative on every price the create and the save write, in
//   both states of CREATION_ROLES_ON; on a marked event a director the
//   representative names is refused a raised fee too;
// - with the constant unset nothing reads a seat and every answer is today's,
//   and with it set an LCA admin, a club's own rep and an assigned director
//   cost on the manage check what they cost before;
// - on a database the migration has not reached a club rep's fee save and
//   publish answer as on the base.
import { env } from 'cloudflare:test'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { WAITING_FOR_APPROVAL } from '../../domain/events/approval'
import { FEES_NEED_PAYOUT_ACCOUNT, LCA_RUN_ONLY } from '../../domain/events/creation'
import { onRequestPost as createTournament } from '../../functions/api/admin/tournaments'
import type { Env } from '../../functions/types'
import { onRequestPatch as patchTournament } from '../../functions/api/admin/tournaments/[id]'
import { onRequestPost as announce } from '../../functions/api/admin/tournaments/[id]/announce'
import {
  onRequestDelete as removeDirector,
  onRequestGet as getDirectors,
  onRequestPost as assignDirector,
} from '../../functions/api/admin/tournaments/[id]/directors'
import { onRequestPost as postGames } from '../../functions/api/admin/tournaments/[id]/games'
import { onRequestPatch as patchGame } from '../../functions/api/admin/tournaments/[id]/games/[gameId]'
import { onRequestPost as generatePairings } from '../../functions/api/admin/tournaments/[id]/generate-pairings'
import { onRequestGet as manageGet } from '../../functions/api/admin/tournaments/[id]/manage'
import { onRequestGet as ratingReport } from '../../functions/api/admin/tournaments/[id]/rating-report'
import { onRequestPatch as registrationSettings } from '../../functions/api/admin/tournaments/[id]/registration'
import { onRequestDelete as deleteRound } from '../../functions/api/admin/tournaments/[id]/rounds/[round]'
import { onRequestPost as offerWaitlist } from '../../functions/api/admin/tournaments/[id]/waitlist'
import { onRequestPost as walkIn } from '../../functions/api/admin/tournaments/[id]/walk-ins'
import { onRequestPost as payoutRequest } from '../../functions/api/me/payout-request'
import { onRequestPatch as patchRegistration } from '../../functions/api/registrations/[id]'
import { onRequestPost as payRegistration } from '../../functions/api/registrations/[id]/pay'
import { onRequestGet as tournamentsGet } from '../../functions/api/tournaments'
import { onRequestGet as tournamentGet } from '../../functions/api/tournaments/[id]'
import { seedAdmin, seedClub, seedMember, seedPresident, seedRegistration, seedTournament, seedTournamentDirector } from './factories'
import { invoke, resetHarness } from './harness'
import { countingDb } from './mailRuns'
import { migrationModules, splitSql } from './setup'

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
const NAMING_WORDS = 'Only admins and the organizing club\'s rep can assign directors'
const MEMBERSHIP_WORDS = 'Only the organizing club\'s rep or an LCA admin can change whether an LCA membership is required'
const LATE_AFTER = '2026-12-01T00:00'
const EARLY_DEADLINE = '2026-11-20T00:00'

/** A club in the region, or in none. */
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

interface StoredEvent {
  id: string
  club_id: string | null
  created_by: string | null
  is_visible: number
  needs_lca_approval: number
  entry_fee: number
  requires_lca_membership: number
  name: string
}

const stored = (id: string) => env.DB.prepare('SELECT id, club_id, created_by, is_visible, needs_lca_approval, entry_fee, requires_lca_membership, name FROM tournaments WHERE id = ?')
  .bind(id).first<StoredEvent>()

/** A create with the wizard's least body and what it adds; the rows it wrote, by its name. */
async function create(as: string, extra: Record<string, unknown> = {}) {
  const name = `Example Region Open ${++seq}`
  const res = await invoke(createTournament, { method: 'POST', as, body: { name, location: 'Kenner, LA', date: '2026-12-12', entryFee: 0, ...extra } })
  const { results } = await env.DB.prepare('SELECT id, club_id, created_by, is_visible, needs_lca_approval, entry_fee, requires_lca_membership, name FROM tournaments WHERE name = ?')
    .bind(name).all<StoredEvent>()
  const directors = results[0] ? await count('SELECT COUNT(*) AS n FROM tournament_directors WHERE tournament_id = ?', results[0].id) : 0
  return { res, rows: results, directors }
}

const save = (as: string, id: string, body: Record<string, unknown>, extra: { env?: Partial<Env> } = {}) =>
  invoke(patchTournament, { method: 'PATCH', as, params: { id }, body, ...extra })
const name = (as: string, id: string, memberId: string) => invoke(assignDirector, { method: 'POST', as, params: { id }, body: { memberId } })
const unname = (as: string, id: string, memberId: string) => invoke(removeDirector, { method: 'DELETE', as, params: { id }, body: { memberId } })
const error = async (res: { json: <T>() => Promise<T> }) => (await res.json<{ error: string }>()).error

/** Marks the event for approval, as a representative's create does, approved when a time is given. */
async function mark(id: string, approvedAt: string | null = null): Promise<void> {
  await env.DB.prepare('UPDATE tournaments SET needs_lca_approval = 1, approved_at = ? WHERE id = ?').bind(approvedAt, id).run()
}

/** What the event's Open section charges at its regular tier. */
const openFee = async (id: string) => (await env.DB.prepare("SELECT fee_regular FROM tournament_sections WHERE tournament_id = ? AND name = 'Open' AND archived_at IS NULL").bind(id).first<{ fee_regular: number }>())?.fee_regular

/** The live sections' ids, by name. */
async function sectionIds(id: string): Promise<Record<string, string>> {
  const { results } = await env.DB.prepare('SELECT id, name FROM tournament_sections WHERE tournament_id = ? AND archived_at IS NULL').bind(id).all<{ id: string; name: string }>()
  return Object.fromEntries(results.map((r) => [r.name, r.id]))
}

/**
 * The world most cases use: a club in the region with its own rep and the
 * rep's own hidden paid event, a club in another region, the region's
 * representative, another region's representative and an LCA admin.
 */
async function world() {
  const club = await clubIn(REGION, 'Example Chess Club')
  const farClub = await clubIn(FAR, 'Example Rooks Club')
  const rep = await seedMember({ role: 'club_rep', clubId: club })
  const event = await seedTournament({ clubId: club, createdBy: rep, entryFee: 20, sections: [{ name: 'Open', entryFee: 20 }], isVisible: false })
  const representative = await seedMember()
  await regionalSeat(representative)
  const other = await seedMember()
  await regionalSeat(other, [FAR])
  const admin = await seedAdmin()
  return { club, farClub, rep, event, representative, other, admin }
}

/** A draft the representative made for the club, as their create writes it: hidden, theirs, marked. */
async function draftBy(memberId: string, clubId: string | null): Promise<string> {
  const id = await seedTournament({ clubId, createdBy: memberId, entryFee: 0, sections: [{ name: 'Open', entryFee: 0 }], isVisible: false })
  if (clubId) await mark(id)
  return id
}

describe('creating, with REGION_EVENTS_ON set', () => {
  beforeEach(() => {
    flags.regionOn = true
  })

  it('lets a representative create for a club in the region: hidden, marked for approval, at $0, with their name as its creator', async () => {
    const { club, representative } = await world()
    const { res, rows, directors } = await create(representative, { clubId: club })
    expect(res.status).toBe(201)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ club_id: club, created_by: representative, is_visible: 0, needs_lca_approval: 1, entry_fee: 0, requires_lca_membership: 0 })
    expect(directors).toBe(0)
    expect((await res.json<{ tournament: { needs_lca_approval: number; is_visible: number } }>()).tournament).toMatchObject({ needs_lca_approval: 1, is_visible: 0 })
  })

  it('creates the event hidden whatever the body asks for its visibility', async () => {
    const { club, representative } = await world()
    const { res, rows } = await create(representative, { clubId: club, isVisible: true, is_visible: 1 })
    expect(res.status).toBe(201)
    expect(rows[0]).toMatchObject({ is_visible: 0, needs_lca_approval: 1 })
  })

  it('lets the representative decide the membership switch on the event they create', async () => {
    const { club, representative } = await world()
    expect((await create(representative, { clubId: club, requiresLcaMembership: true })).rows[0]).toMatchObject({ requires_lca_membership: 1, needs_lca_approval: 1 })
    expect((await create(representative, { clubId: club, requiresLcaMembership: false })).rows[0]).toMatchObject({ requires_lca_membership: 0 })
  })

  it('refuses a club outside the region 403, and writes nothing', async () => {
    const { farClub, representative } = await world()
    const { res, rows } = await create(representative, { clubId: farClub })
    expect(res.status).toBe(403)
    expect(await error(res)).toBe('Forbidden')
    expect(rows).toHaveLength(0)
  })

  it('refuses the representative an LCA-run event, and writes nothing', async () => {
    const { representative } = await world()
    const { res, rows } = await create(representative)
    expect(res.status).toBe(403)
    expect(rows).toHaveLength(0)
  })

  it.each([false, true])('refuses a paid entry on a create, at every price the create writes, with the payout-account words and nothing written, CREATION_ROLES_ON %s', async (rolesOn) => {
    flags.rolesOn = rolesOn
    const { club, representative } = await world()
    for (const [label, extra] of [
      ['the entry fee', { entryFee: 25 }],
      ['a section\'s fee', { sections: [{ name: 'Open', entryFee: 0 }, { name: 'U1200', entryFee: 15 }] }],
      ['a section\'s late price', { sections: [{ name: 'Open', entryFee: 0, fees: { late: 10 } }] }],
      ['a section\'s early price', { sections: [{ name: 'Open', entryFee: 0, fees: { early: 5 } }] }],
      ['a bare section name at the event\'s fee', { entryFee: 25, sections: ['Open'] }],
    ] as const) {
      const { res, rows } = await create(representative, { clubId: club, ...extra })
      expect(res.status, label).toBe(403)
      expect(await error(res), label).toBe(FEES_NEED_PAYOUT_ACCOUNT)
      expect(rows, label).toHaveLength(0)
    }
    expect((await create(representative, { clubId: club })).res.status).toBe(201)
  })

  it.each([false, true])('lets a club rep who holds a seat create for another club in the region as the representative, free, and for their own club by today\'s rule, CREATION_ROLES_ON %s', async (rolesOn) => {
    flags.rolesOn = rolesOn
    const { club, farClub } = await world()
    const neighbour = await clubIn(REGION, 'Example Knights Club')
    const rep = await seedMember({ role: 'club_rep', clubId: club })
    await regionalSeat(rep)
    const asRepresentative = await create(rep, { clubId: neighbour })
    expect(asRepresentative.res.status).toBe(201)
    expect(asRepresentative.rows[0]).toMatchObject({ club_id: neighbour, created_by: rep, is_visible: 0, needs_lca_approval: 1 })
    const paid = await create(rep, { clubId: neighbour, entryFee: 25 })
    expect(paid.res.status).toBe(403)
    expect(await error(paid.res)).toBe(FEES_NEED_PAYOUT_ACCOUNT)
    for (const extra of [{ clubId: club, entryFee: 30 }, { entryFee: 30 }]) {
      const own = await create(rep, extra)
      expect(own.res.status).toBe(201)
      expect(own.rows[0]).toMatchObject({ club_id: club, needs_lca_approval: 0, entry_fee: 30 })
    }
    const far = await create(rep, { clubId: farClub })
    expect(far.res.status).toBe(403)
    expect(await error(far.res)).toBe('Club reps can only create tournaments for their club')
  })

  it.each(['the president', 'a standing director'])('lets %s who holds a seat create for a club in the region as the representative, hidden, marked, free and with no director row, and an LCA-run event by today\'s rule', async (who) => {
    flags.rolesOn = true
    const { club } = await world()
    const id = who === 'the president' ? await seedMember({ role: 'lca_observer' }) : await seedMember({ role: 'tournament_director' })
    if (who === 'the president') await seedPresident(id)
    await regionalSeat(id)
    const asRepresentative = await create(id, { clubId: club })
    expect(asRepresentative.res.status).toBe(201)
    expect(asRepresentative.rows[0]).toMatchObject({ club_id: club, created_by: id, is_visible: 0, needs_lca_approval: 1 })
    expect(asRepresentative.directors).toBe(0)
    expect((await create(id, { clubId: club, entryFee: 25 })).res.status).toBe(403)
    const lcaRun = await create(id, { entryFee: 25 })
    expect(lcaRun.res.status).toBe(201)
    expect(lcaRun.rows[0]).toMatchObject({ club_id: null, needs_lca_approval: 0, entry_fee: 25, requires_lca_membership: 1 })
    expect(lcaRun.directors).toBe(1)
  })

  it('lets an LCA admin who holds a seat create as today, unmarked and charging', async () => {
    const { club, admin } = await world()
    await regionalSeat(admin)
    const made = await create(admin, { clubId: club, entryFee: 25 })
    expect(made.res.status).toBe(201)
    expect(made.rows[0]).toMatchObject({ club_id: club, needs_lca_approval: 0, entry_fee: 25 })
  })

  it('refuses another region\'s representative on the create, the directors, the membership switch and a setup save', async () => {
    const { club, representative, other } = await world()
    const draft = await draftBy(representative, club)
    const made = await create(other, { clubId: club })
    expect(made.res.status).toBe(403)
    expect(made.rows).toHaveLength(0)
    const before = await stored(draft)
    expect((await name(other, draft, await seedMember())).status).toBe(403)
    expect((await save(other, draft, { requiresLcaMembership: false })).status).toBe(403)
    expect((await save(other, draft, { venue: 'Example Hall' })).status).toBe(403)
    expect(await stored(draft)).toEqual(before)
    expect(await count('SELECT COUNT(*) AS n FROM tournament_directors WHERE tournament_id = ?', draft)).toBe(0)
  })
})

describe('with REGION_EVENTS_ON unset, as on the base', () => {
  it('refuses the representative all four: the create, the directors, the membership switch and a setup save', async () => {
    const { club, event, representative } = await world()
    const draft = await draftBy(representative, club)
    const made = await create(representative, { clubId: club })
    expect(made.res.status).toBe(403)
    expect(await error(made.res)).toBe('Forbidden')
    expect(made.rows).toHaveLength(0)
    expect((await name(representative, draft, await seedMember())).status).toBe(403)
    expect((await save(representative, draft, { requiresLcaMembership: true })).status).toBe(403)
    expect((await save(representative, event, { venue: 'Example Hall' })).status).toBe(403)
  })

  it.each([false, true])('gives the three who hold a seat today\'s refusals word for word, CREATION_ROLES_ON %s', async (rolesOn) => {
    flags.rolesOn = rolesOn
    const { club } = await world()
    const neighbour = await clubIn(REGION, 'Example Knights Club')
    const rep = await seedMember({ role: 'club_rep', clubId: club })
    await regionalSeat(rep)
    const repMade = await create(rep, { clubId: neighbour })
    expect(repMade.res.status).toBe(403)
    expect(await error(repMade.res)).toBe('Club reps can only create tournaments for their club')
    const president = await seedMember({ role: 'lca_observer' })
    await seedPresident(president)
    await regionalSeat(president)
    const director = await seedMember({ role: 'tournament_director' })
    await regionalSeat(director)
    for (const id of [president, director]) {
      const made = await create(id, { clubId: neighbour })
      expect(made.res.status).toBe(403)
      expect(await error(made.res)).toBe(rolesOn ? LCA_RUN_ONLY : 'Forbidden')
      expect(made.rows).toHaveLength(0)
    }
  })
})

describe('running the region\'s club events, with REGION_EVENTS_ON set', () => {
  beforeEach(() => {
    flags.regionOn = true
  })

  it('lets the representative save a club rep\'s own event in the region, and refuses them its directors and its membership switch', async () => {
    const { event, rep, representative } = await world()
    const saved = await save(representative, event, { venue: 'Example Hall', name: 'Example Fall Open' })
    expect(saved.status).toBe(200)
    expect(await stored(event)).toMatchObject({ name: 'Example Fall Open', created_by: rep, needs_lca_approval: 0 })
    const named = await name(representative, event, await seedMember())
    expect(named.status).toBe(403)
    expect(await error(named)).toBe(NAMING_WORDS)
    const before = await stored(event)
    const membership = await save(representative, event, { requiresLcaMembership: !before?.requires_lca_membership })
    expect(membership.status).toBe(403)
    expect(await error(membership)).toBe(MEMBERSHIP_WORDS)
    expect(await stored(event)).toEqual(before)
  })

  it('lets the representative publish a club rep\'s own event, take it off the site, and change its name, date and place, since it is not marked', async () => {
    const { event, rep, representative, other } = await world()
    const where = () => env.DB.prepare('SELECT is_visible, name, date, location FROM tournaments WHERE id = ?').bind(event).first()
    expect((await save(representative, event, { isVisible: true })).status).toBe(200)
    expect(await stored(event)).toMatchObject({ is_visible: 1, needs_lca_approval: 0, created_by: rep })
    expect((await save(representative, event, { isVisible: false })).status).toBe(200)
    expect(await stored(event)).toMatchObject({ is_visible: 0 })
    expect((await save(representative, event, { name: 'Example Winter Open', date: '2026-12-19', location: 'Metairie, LA' })).status).toBe(200)
    expect(await where()).toEqual({ is_visible: 0, name: 'Example Winter Open', date: '2026-12-19', location: 'Metairie, LA' })
    // Another region's representative is refused each of the same saves, and nothing moves.
    for (const body of [{ isVisible: true }, { date: '2026-12-26' }]) expect((await save(other, event, body)).status).toBe(403)
    expect(await where()).toEqual({ is_visible: 0, name: 'Example Winter Open', date: '2026-12-19', location: 'Metairie, LA' })
  })

  it('lets the representative name a director on their own draft and remove them', async () => {
    const { club, representative } = await world()
    const draft = await draftBy(representative, club)
    const director = await seedMember()
    expect((await name(representative, draft, director)).status).toBe(201)
    expect(await count('SELECT COUNT(*) AS n FROM tournament_directors WHERE tournament_id = ? AND member_id = ?', draft, director)).toBe(1)
    expect((await unname(representative, draft, director)).status).toBe(200)
    expect(await count('SELECT COUNT(*) AS n FROM tournament_directors WHERE tournament_id = ?', draft)).toBe(0)
  })

  it('lets the representative change the membership switch on their own draft, whatever its state, and not the director they named', async () => {
    const { club, representative } = await world()
    const draft = await draftBy(representative, club)
    expect((await save(representative, draft, { requiresLcaMembership: true })).status).toBe(200)
    expect(await stored(draft)).toMatchObject({ requires_lca_membership: 1 })
    await env.DB.prepare("UPDATE tournaments SET approved_at = '2026-11-16 09:30:00', is_visible = 1 WHERE id = ?").bind(draft).run()
    expect((await save(representative, draft, { requiresLcaMembership: false })).status).toBe(200)
    expect(await stored(draft)).toMatchObject({ requires_lca_membership: 0 })
    const director = await seedMember()
    await seedTournamentDirector(draft, director)
    const refused = await save(director, draft, { requiresLcaMembership: true })
    expect(refused.status).toBe(403)
    expect(await error(refused)).toBe(MEMBERSHIP_WORDS)
    expect(await stored(draft)).toMatchObject({ requires_lca_membership: 0 })
  })

  it.each([false, true])('on a club rep\'s own paid event in the region lets the representative keep or lower a fee and refuses any raise, at every price the save writes, CREATION_ROLES_ON %s', async (rolesOn) => {
    flags.rolesOn = rolesOn
    const { event, representative } = await world()
    await env.DB.prepare('UPDATE tournaments SET early_deadline = ?, early_discount = 5, late_after = ?, late_fee = 5 WHERE id = ?').bind(EARLY_DEADLINE, LATE_AFTER, event).run()
    const { Open } = await sectionIds(event)
    for (const [label, body] of [
      ['the entry fee, for a section that takes it', { entryFee: 30, sections: ['Open'] }],
      ['a section\'s fee', { sections: [{ id: Open, name: 'Open', entryFee: 30 }] }],
      ['a new priced section', { sections: [{ id: Open, name: 'Open', entryFee: 20 }, { name: 'U800', entryFee: 15 }] }],
      ['a section\'s late price', { sections: [{ id: Open, name: 'Open', entryFee: 20, fees: { late: 40 } }] }],
      ['the late fee', { lateFee: 10 }],
      ['a smaller early discount', { earlyDiscount: 0 }],
    ] as const) {
      const res = await save(representative, event, body)
      expect(res.status, label).toBe(403)
      expect(await error(res), label).toBe(FEES_NEED_PAYOUT_ACCOUNT)
      expect(await stored(event), label).toMatchObject({ entry_fee: 20 })
      expect(await openFee(event), label).toBe(20)
    }
    // A fee not changed, and one lowered, go through.
    expect((await save(representative, event, { venue: 'Example Hall', entryFee: 20, sections: [{ id: Open, name: 'Open', entryFee: 20 }] })).status).toBe(200)
    expect((await save(representative, event, { entryFee: 15, sections: [{ id: Open, name: 'Open', entryFee: 15 }], lateFee: 0, earlyDiscount: 10 })).status).toBe(200)
    expect(await stored(event)).toMatchObject({ entry_fee: 15 })
    expect(await openFee(event)).toBe(15)
  })

  it('refuses a publish 409 before approval to the representative, the director they named and an LCA admin, and writes nothing', async () => {
    const { club, representative, admin } = await world()
    const draft = await draftBy(representative, club)
    const director = await seedMember()
    await seedTournamentDirector(draft, director)
    const before = await env.DB.prepare('SELECT * FROM tournaments WHERE id = ?').bind(draft).first()
    const log = await count('SELECT COUNT(*) AS n FROM admin_audit_log')
    for (const who of [representative, director, admin]) {
      const res = await save(who, draft, { isVisible: true, name: 'Example Changed Name' })
      expect(res.status, who).toBe(409)
      expect(await res.json(), who).toEqual({ error: WAITING_FOR_APPROVAL })
    }
    expect(await env.DB.prepare('SELECT * FROM tournaments WHERE id = ?').bind(draft).first()).toEqual(before)
    expect(await count('SELECT COUNT(*) AS n FROM admin_audit_log')).toBe(log)
    // A save that does not publish goes through, and once approved the event may list.
    expect((await save(representative, draft, { isVisible: false, venue: 'Example Hall' })).status).toBe(200)
    await mark(draft, '2026-11-16 09:30:00')
    expect((await save(representative, draft, { isVisible: true })).status).toBe(200)
    expect(await stored(draft)).toMatchObject({ is_visible: 1 })
  })

  it('lets an event not marked list as today: the club rep publishes their own event', async () => {
    const { event, rep } = await world()
    expect((await save(rep, event, { isVisible: true })).status).toBe(200)
    expect(await stored(event)).toMatchObject({ is_visible: 1, needs_lca_approval: 0 })
  })

  it.todo('a publish date is refused before approval')

  it.each([false, true])('on an event marked for approval refuses a raised fee to the director the representative named, approved or not, and not to an LCA admin or the club\'s own rep, CREATION_ROLES_ON %s', async (rolesOn) => {
    flags.rolesOn = rolesOn
    const { club, rep, representative, admin } = await world()
    const draft = await draftBy(representative, club)
    const director = await seedMember()
    const standing = await seedMember({ role: 'tournament_director' })
    for (const id of [director, standing]) await seedTournamentDirector(draft, id)
    const { Open } = await sectionIds(draft)
    const raise = (fee: number) => ({ sections: [{ id: Open, name: 'Open', entryFee: fee }] })
    for (const approvedAt of [null, '2026-11-16 09:30:00']) {
      await mark(draft, approvedAt)
      for (const who of [director, standing, representative]) {
        const res = await save(who, draft, raise(10))
        expect(res.status, `${who} ${approvedAt}`).toBe(403)
        expect(await error(res)).toBe(FEES_NEED_PAYOUT_ACCOUNT)
      }
      expect(await openFee(draft)).toBe(0)
      // A save that raises nothing goes through for the director.
      expect((await save(director, draft, { venue: 'Example Hall' })).status).toBe(200)
    }
    expect((await save(admin, draft, raise(10))).status).toBe(200)
    expect((await save(rep, draft, raise(15))).status).toBe(200)
    expect(await openFee(draft)).toBe(15)
  })

  it('leaves an event not marked as on the base for a director: with CREATION_ROLES_ON unset the director of a club rep\'s own event may raise its fee', async () => {
    const { event } = await world()
    const director = await seedMember()
    await seedTournamentDirector(event, director)
    const { Open } = await sectionIds(event)
    expect((await save(director, event, { sections: [{ id: Open, name: 'Open', entryFee: 30 }] })).status).toBe(200)
    expect(await openFee(event)).toBe(30)
  })
})

/** What a call answered, read so each caller's rows compare: the status, or what the special rows read. */
type Reading = string

interface Caller {
  /** The address and method. */
  label: string
  /** The handler's file, under functions/. */
  file: string
  /** guarded: 403 when refused; detail: the hidden draft answers 404 when refused; payout: the ticket names the event only for a manager. */
  kind: 'guarded' | 'detail' | 'payout'
  run: (as: string) => Promise<Reading>
}

/** Every caller of canManageTournament, requireTournamentManager and requireTournamentView, one row each, on the club rep's own hidden event. */
function callers(event: string, entry: string): Caller[] {
  const status = async (pending: Promise<{ status: number }>) => String((await pending).status)
  const at = (id = event) => ({ id })
  return [
    { label: 'PATCH /api/admin/tournaments/[id]', file: 'api/admin/tournaments/[id].ts', kind: 'guarded', run: (as) => status(invoke(patchTournament, { method: 'PATCH', as, params: at(), body: { venue: 'Example Hall' } })) },
    { label: 'PATCH /api/admin/tournaments/[id]/registration', file: 'api/admin/tournaments/[id]/registration.ts', kind: 'guarded', run: (as) => status(invoke(registrationSettings, { method: 'PATCH', as, params: at(), body: {} })) },
    { label: 'POST /api/admin/tournaments/[id]/games', file: 'api/admin/tournaments/[id]/games.ts', kind: 'guarded', run: (as) => status(invoke(postGames, { method: 'POST', as, params: at(), body: {} })) },
    { label: 'PATCH /api/admin/tournaments/[id]/games/[gameId]', file: 'api/admin/tournaments/[id]/games/[gameId].ts', kind: 'guarded', run: (as) => status(invoke(patchGame, { method: 'PATCH', as, params: { id: event, gameId: 'example-no-such-game' }, body: {} })) },
    { label: 'POST /api/admin/tournaments/[id]/generate-pairings', file: 'api/admin/tournaments/[id]/generate-pairings.ts', kind: 'guarded', run: (as) => status(invoke(generatePairings, { method: 'POST', as, params: at(), body: {} })) },
    { label: 'DELETE /api/admin/tournaments/[id]/rounds/[round]', file: 'api/admin/tournaments/[id]/rounds/[round].ts', kind: 'guarded', run: (as) => status(invoke(deleteRound, { method: 'DELETE', as, params: { id: event, round: '9' }, path: `/api/admin/tournaments/${event}/rounds/9?section=Open` })) },
    { label: 'POST /api/admin/tournaments/[id]/waitlist', file: 'api/admin/tournaments/[id]/waitlist.ts', kind: 'guarded', run: (as) => status(invoke(offerWaitlist, { method: 'POST', as, params: at(), body: {} })) },
    { label: 'POST /api/admin/tournaments/[id]/walk-ins', file: 'api/admin/tournaments/[id]/walk-ins.ts', kind: 'guarded', run: (as) => status(invoke(walkIn, { method: 'POST', as, params: at(), body: {} })) },
    { label: 'PATCH /api/registrations/[id]', file: 'api/registrations/[id].ts', kind: 'guarded', run: (as) => status(invoke(patchRegistration, { method: 'PATCH', as, params: { id: entry }, body: {} })) },
    { label: 'POST /api/registrations/[id]/pay', file: 'api/registrations/[id]/pay.ts', kind: 'guarded', run: (as) => status(invoke(payRegistration, { method: 'POST', as, params: { id: entry }, body: {} })) },
    { label: 'GET /api/admin/tournaments/[id]/manage', file: 'api/admin/tournaments/[id]/manage.ts', kind: 'guarded', run: (as) => status(invoke(manageGet, { as, params: at() })) },
    { label: 'GET /api/admin/tournaments/[id]/rating-report', file: 'api/admin/tournaments/[id]/rating-report.ts', kind: 'guarded', run: (as) => status(invoke(ratingReport, { as, params: at() })) },
    { label: 'POST /api/admin/tournaments/[id]/announce', file: 'api/admin/tournaments/[id]/announce.ts', kind: 'guarded', run: (as) => status(invoke(announce, { method: 'POST', as, params: at(), body: {} })) },
    { label: 'GET /api/admin/tournaments/[id]/directors', file: 'api/admin/tournaments/[id]/directors.ts', kind: 'guarded', run: (as) => status(invoke(getDirectors, { as, params: at() })) },
    { label: 'GET /api/tournaments/[id]', file: 'api/tournaments/[id].ts', kind: 'detail', run: (as) => status(invoke(tournamentGet, { as, params: at() })) },
    {
      label: 'POST /api/me/payout-request',
      file: 'api/me/payout-request.ts',
      kind: 'payout',
      run: async (as) => {
        // The request is open only while CREATION_ROLES_ON is set; the manage check decides whether the ticket names the event.
        const was = flags.rolesOn
        flags.rolesOn = true
        try {
          const res = await invoke(payoutRequest, { method: 'POST', as, body: { tournamentId: event }, path: '/api/me/payout-request' })
          expect(res.status).toBe(201)
          const ticket = await env.DB.prepare('SELECT about_id FROM support_tickets WHERE member_id = ? AND kind = \'payout_request\'').bind(as).first<{ about_id: string | null }>()
          return String(ticket?.about_id ?? null)
        } finally {
          flags.rolesOn = was
        }
      },
    },
  ]
}

/** The table's world: the club rep's own hidden paid event in the region, with one paid entry of a player's. */
async function tableWorld() {
  const base = await world()
  const player = await seedMember({ fullName: 'Player One', email: 'player.one@example.org' })
  const entry = await seedRegistration({ tournamentId: base.event, memberId: player, paymentStatus: 'paid' })
  return { ...base, entry, rows: callers(base.event, entry) }
}

const through = (row: Caller, reading: Reading, event: string, admin: Reading | undefined) => {
  if (row.kind === 'detail') return expect(reading, row.label).toBe('200')
  if (row.kind === 'payout') return expect(reading, row.label).toBe(event)
  expect(['401', '403'], row.label).not.toContain(reading)
  expect(reading, row.label).toBe(admin)
}
const refused = (row: Caller, reading: Reading) => expect(reading, row.label).toBe(row.kind === 'detail' ? '404' : row.kind === 'payout' ? 'null' : '403')

describe('every caller of canManageTournament', () => {
  it('names every caller under functions/ and workers/, and no file the mail stream holds calls it', () => {
    const sources = import.meta.glob(['../../functions/**/*.ts', '../../workers/*/src/**/*.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>
    const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    const calling = Object.entries(sources)
      .filter(([path]) => !path.endsWith('/functions/utils/auth.ts') && !path.endsWith('/functions/utils/admin/permissions.ts'))
      .filter(([, text]) => /\b(?:canManageTournament|requireTournamentManager|requireTournamentView)\(/.test(code(text)))
      .map(([path]) => path.replace('../../functions/', ''))
      .sort()
    expect(calling).toEqual([...new Set(callers('e', 'r').map((r) => r.file))].sort())
    expect(calling.filter((path) => /utils\/mail\/|utils\/admin\/campaigns\.ts|workers\//.test(path))).toEqual([])
  })

  it('lets the region\'s representative through every caller on a club rep\'s own event in the region, as an LCA admin gets through, with REGION_EVENTS_ON set', async () => {
    flags.regionOn = true
    const { rows, representative, admin, event } = await tableWorld()
    for (const row of rows) {
      const reference = row.kind === 'guarded' ? await row.run(admin) : undefined
      through(row, await row.run(representative), event, reference)
    }
  })

  it('refuses another region\'s representative on every caller, with REGION_EVENTS_ON set', async () => {
    flags.regionOn = true
    const { rows, other } = await tableWorld()
    for (const row of rows) refused(row, await row.run(other))
  })

  it('refuses the same representative on every caller with REGION_EVENTS_ON unset, as on the base', async () => {
    const { rows, representative } = await tableWorld()
    for (const row of rows) refused(row, await row.run(representative))
  })

  it('gives nothing for an LCA-run event, a club with no region, an ended seat or an open seat, and counts a seat\'s added region', async () => {
    flags.regionOn = true
    const { representative } = await world()
    const manage = async (as: string, id: string) => (await invoke(manageGet, { as, params: { id } })).status
    const lcaRun = await seedTournament({ clubId: null, entryFee: 0, isVisible: false })
    const noRegion = await seedTournament({ clubId: await clubIn(null, 'Example Pawns Club'), entryFee: 0, isVisible: false })
    expect(await manage(representative, lcaRun)).toBe(403)
    expect(await manage(representative, noRegion)).toBe(403)
    const inRegion = await seedTournament({ clubId: await clubIn(REGION, 'Example Bishops Club'), entryFee: 0, isVisible: false })
    const ended = await seedMember()
    const term = await regionalSeat(ended)
    await env.DB.prepare("UPDATE board_seat_assignments SET ended_at = datetime('now') WHERE id = ?").bind(term).run()
    expect(await manage(ended, inRegion)).toBe(403)
    await regionalSeat(null)
    expect(await manage(await seedMember(), inRegion)).toBe(403)
    const added = await seedMember()
    await regionalSeat(added, [FAR, ADDED])
    const prairie = await seedTournament({ clubId: await clubIn(ADDED, 'Example Prairie Club'), entryFee: 0, isVisible: false })
    expect(await manage(added, prairie)).toBe(200)
    expect(await manage(representative, inRegion)).toBe(200)
  })
})

describe('what a manager reads', () => {
  it('gives the representative the region\'s hidden drafts and the four keys in the public list and detail, and a visitor, another region\'s representative and everyone with the constant unset none of them', async () => {
    const { event, representative, other } = await world()
    const listed = async (as?: string) => (await (await invoke(tournamentsGet, { as })).json<{ tournaments: Array<Record<string, unknown>> }>()).tournaments.find((t) => t.id === event)
    expect(await listed(representative)).toBeUndefined()
    flags.regionOn = true
    const row = await listed(representative)
    expect(row).toBeDefined()
    expect(row).toMatchObject({ needs_lca_approval: 0, approval_requested_at: null, approved_at: null, approved_by: null })
    const detail = await invoke(tournamentGet, { as: representative, params: { id: event } })
    expect(detail.status).toBe(200)
    expect((await detail.json<{ tournament: Record<string, unknown> }>()).tournament).toHaveProperty('needs_lca_approval', 0)
    expect(await listed(other)).toBeUndefined()
    expect(await listed()).toBeUndefined()
    await env.DB.prepare('UPDATE tournaments SET is_visible = 1 WHERE id = ?').bind(event).run()
    for (const as of [undefined, other]) {
      const seen = await listed(as)
      expect(seen).toBeDefined()
      for (const key of ['needs_lca_approval', 'approval_requested_at', 'approved_at', 'approved_by', 'created_by']) expect(Object.hasOwn(seen!, key), key).toBe(false)
    }
  })
})

describe('what the constant costs', () => {
  const statements = (ran: Array<{ sql: string }>) => ran.map((r) => r.sql)
  const readsASeat = (ran: Array<{ sql: string }>) => ran.filter((r) => /seat_regions|board_seat_assignments/.test(r.sql))

  it('with REGION_EVENTS_ON unset reads no seat, and a seat holder refused and one admitted make exactly the queries of the same person with no seat, on all four grants and the fee check', async () => {
    const { club, event } = await world()
    const second = await seedTournament({ clubId: club, entryFee: 20, sections: [{ name: 'Open', entryFee: 20 }], isVisible: false })
    const seated = await seedMember()
    await regionalSeat(seated)
    const plain = await seedMember()
    const seatedDirector = await seedMember()
    await regionalSeat(seatedDirector)
    const plainDirector = await seedMember()
    await seedTournamentDirector(event, seatedDirector)
    await seedTournamentDirector(second, plainDirector)
    const seatedRep = await seedMember({ role: 'club_rep', clubId: club })
    await regionalSeat(seatedRep)
    const plainRep = await seedMember({ role: 'club_rep', clubId: club })
    const runs = async (as: string, id: string) => {
      const out: string[][] = []
      for (const call of [
        (DB: D1Database) => invoke(manageGet, { as, params: { id }, env: { DB } }),
        (DB: D1Database) => invoke(createTournament, { method: 'POST', as, body: { name: 'Example Count Open', location: 'Kenner, LA', date: '2026-12-12', entryFee: 0, clubId: club }, env: { DB } }),
        (DB: D1Database) => invoke(assignDirector, { method: 'POST', as, params: { id }, body: { memberId: plain }, env: { DB } }),
        (DB: D1Database) => save(as, id, { requiresLcaMembership: true }, { env: { DB } }),
        (DB: D1Database) => save(as, id, { entryFee: 30 }, { env: { DB } }),
      ]) {
        const { db, ran } = countingDb()
        await call(db)
        expect(readsASeat(ran)).toEqual([])
        out.push(statements(ran))
      }
      return out
    }
    expect(await runs(seated, event)).toEqual(await runs(plain, event))
    expect(await runs(seatedDirector, event)).toEqual(await runs(plainDirector, second))
    expect(await runs(seatedRep, event)).toEqual(await runs(plainRep, second))
  })

  it('with REGION_EVENTS_ON set costs an LCA admin, a club\'s own rep and an assigned director on the manage check what it costs with it unset, and reads the seat for no one of them', async () => {
    const { event, rep, admin } = await world()
    const director = await seedMember()
    await seedTournamentDirector(event, director)
    for (const who of [admin, rep, director]) {
      const reading = async () => {
        const { db, ran } = countingDb()
        expect((await invoke(manageGet, { as: who, params: { id: event }, env: { DB: db } })).status).toBe(200)
        return ran
      }
      const unset = await reading()
      flags.regionOn = true
      const set = await reading()
      flags.regionOn = false
      expect(statements(set), who).toEqual(statements(unset))
      expect(readsASeat(set), who).toEqual([])
    }
  })
})

describe('on a database the migration has not reached', () => {
  const FOUR = ['needs_lca_approval', 'approval_requested_at', 'approved_at', 'approved_by'] as const
  let club = ''
  let rep = ''
  beforeAll(async () => {
    club = await clubIn(REGION, 'Example Chess Club')
    rep = await seedMember({ role: 'club_rep', clubId: club })
    for (const column of [...FOUR].reverse()) await env.DB.prepare(`ALTER TABLE tournaments DROP COLUMN ${column}`).run()
  })
  afterAll(async () => {
    const path = Object.keys(migrationModules).find((p) => p.endsWith('/0070_club_event_approval.sql'))
    for (const statement of splitSql(migrationModules[path!])) await env.DB.prepare(statement).run()
  })

  it.each([false, true])('answers a club rep\'s fee save and publish as on the base, with REGION_EVENTS_ON %s and in both states of CREATION_ROLES_ON', async (regionOn) => {
    flags.regionOn = regionOn
    for (const rolesOn of [false, true]) {
      flags.rolesOn = rolesOn
      const event = await seedTournament({ clubId: club, createdBy: rep, entryFee: 20, sections: [{ name: 'Open', entryFee: 20 }], isVisible: false })
      const { Open } = await sectionIds(event)
      expect((await save(rep, event, { entryFee: 30, sections: [{ id: Open, name: 'Open', entryFee: 30 }] })).status).toBe(200)
      expect((await save(rep, event, { isVisible: true })).status).toBe(200)
      expect(await env.DB.prepare('SELECT entry_fee, is_visible FROM tournaments WHERE id = ?').bind(event).first()).toEqual({ entry_fee: 30, is_visible: 1 })
      expect(await openFee(event)).toBe(30)
    }
  })
})

describe('role safety', () => {
  it('answers a signed-out caller 401 and a plain member 403 on the create, the save, the directors and the manage page, with the constant set, and writes nothing', async () => {
    flags.regionOn = true
    const { club, event } = await world()
    const member = await seedMember()
    const before = await count('SELECT COUNT(*) AS n FROM tournaments')
    const body = { name: 'Example Region Open', location: 'Kenner, LA', date: '2026-12-12', entryFee: 0, clubId: club }
    expect((await invoke(createTournament, { method: 'POST', body })).status).toBe(401)
    expect((await invoke(createTournament, { method: 'POST', as: member, body })).status).toBe(403)
    expect((await invoke(patchTournament, { method: 'PATCH', params: { id: event }, body: { venue: 'Example Hall' } })).status).toBe(401)
    expect((await save(member, event, { venue: 'Example Hall' })).status).toBe(403)
    expect((await invoke(assignDirector, { method: 'POST', params: { id: event }, body: { memberId: member } })).status).toBe(401)
    expect((await name(member, event, member)).status).toBe(403)
    expect((await invoke(manageGet, { params: { id: event } })).status).toBe(401)
    expect((await invoke(manageGet, { as: member, params: { id: event } })).status).toBe(403)
    expect(await count('SELECT COUNT(*) AS n FROM tournaments')).toBe(before)
    expect(await count('SELECT COUNT(*) AS n FROM tournament_directors WHERE tournament_id = ?', event)).toBe(0)
  })
})
