// test/integration/entry-fees.test.ts
//
// D24 on the setup save, PATCH /api/admin/tournaments/[id] (the server half
// of criterion 15 of brief 1.4's WS08 section, WS08 step 4): once
// CREATION_ROLES_ON is set, a save by anyone canChargeFees does not let set a
// fee is refused with the payout words when it raises what an entrant pays,
// at any tier of any section, above the stored price; a save that leaves the
// prices as they are, or lowers one, passes.
//   1. A one-event director, a plain member with a director row: a section's
//      fee raised; three saves the writer would store at the event's fee;
//      the sections sent back as the manage answer gave them; the event's
//      fee raised and lowered, where a live section pays it and where only
//      an archived one does; a late fee and its date; a discount and its
//      deadline; a new section; a section's own early and late prices; and
//      no one the manage check refuses reaching the rule.
//   2. Everyone on D24's list raises a fee: a standing director on the event
//      they created and direct, the president on an event the president
//      created, an LCA admin and the organizing club's rep; and a standing
//      director's membership switch keeps today's rule (Q37).
//   3. With the constant unset, the one-event director's raise passes, as
//      today.
//   4. The comparison reads each section as the writer stores it: what
//      savedSectionFees answers before a save is what entrants pay in every
//      row the writer leaves, the archived ones included, for every way a
//      list can name a section, and for a create.
// Every case reads the stored rows after the call. CREATION_ROLES_ON is false
// in the tree; it is read here through a getter on the mocked module, as
// test/integration/tournament-create.test.ts reads it, so each case runs in
// the state its describe names. seedTournament stores no tier prices, so
// setTiers stores them after seeding.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { contracts, errorBodySchema } from '../../domain/contracts'
import { FEES_NEED_PAYOUT_ACCOUNT } from '../../domain/events/creation'
import { tierFees, type SectionListItem, type TierFees, type TierTournament } from '../../domain/events/sections'
import { getDb } from '../../functions/db/client'
import { loadSections, savedSectionFees } from '../../functions/utils/events/sectionsRepo'
import { onRequestPost as createTournament } from '../../functions/api/admin/tournaments'
import { onRequestPatch as patchTournament } from '../../functions/api/admin/tournaments/[id]'
import { onRequestGet as getManage } from '../../functions/api/admin/tournaments/[id]/manage'
import {
  seedAdmin, seedClub, seedDirector, seedMember, seedPresident, seedTournament, seedTournamentDirector, type SeedTournamentOptions,
} from './factories'
import { expectContract, invoke, resetHarness } from './harness'

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
})

const edit = contracts['admin/tournaments/[id]'].PATCH
const MEMBERSHIP_WORDS = "Only the organizing club's rep or an LCA admin can change whether an LCA membership is required"
const EARLY_DEADLINE = '2026-09-01T00:00'
const LATE_AFTER = '2026-09-10T00:00'

const patch = (as: string | undefined, tournamentId: string, body: Record<string, unknown>) =>
  invoke(patchTournament, { method: 'PATCH', as, params: { id: tournamentId }, body })

/** An event with one section, Open, at its own price of $20, the event's fee $20 as well. */
const pricedEvent = (opts: SeedTournamentOptions = {}) => seedTournament({ entryFee: 20, sections: [{ name: 'Open', entryFee: 20 }], ...opts })

/** The ids of the event's live sections, by name. */
async function sectionIds(tournamentId: string): Promise<Record<string, string>> {
  const { results } = await env.DB.prepare('SELECT id, name FROM tournament_sections WHERE tournament_id = ? AND archived_at IS NULL')
    .bind(tournamentId).all<{ id: string; name: string }>()
  return Object.fromEntries(results.map((r) => [r.name, r.id]))
}

/** Everything a save could store for the event: its row, and every row of its sections, archived ones too. */
async function snapshot(tournamentId: string) {
  const event = await env.DB.prepare('SELECT * FROM tournaments WHERE id = ?').bind(tournamentId).first()
  const { results } = await env.DB.prepare('SELECT * FROM tournament_sections WHERE tournament_id = ? ORDER BY id').bind(tournamentId).all()
  return { event, sections: results }
}

/** The event's pricing columns, as tierFees reads them. */
async function pricingOf(tournamentId: string): Promise<TierTournament> {
  const row = await env.DB.prepare('SELECT entry_fee, early_deadline, early_discount, late_after, late_fee FROM tournaments WHERE id = ?')
    .bind(tournamentId).first<TierTournament>()
  if (!row) throw new Error(`no event ${tournamentId}`)
  return row
}

/** The event's pricing columns and each live section's own prices, in order: every price a save could change. */
async function prices(tournamentId: string) {
  const { results } = await env.DB.prepare(
    'SELECT name, fee_regular, fee_early, fee_late FROM tournament_sections WHERE tournament_id = ? AND archived_at IS NULL ORDER BY position',
  ).bind(tournamentId).all()
  return { event: await pricingOf(tournamentId), sections: results }
}

/** What an entrant pays in each live section, early, regular and late, as every answer shows it. */
async function paid(tournamentId: string): Promise<Record<string, TierFees>> {
  const pricing = await pricingOf(tournamentId)
  return Object.fromEntries((await loadSections(getDb(env.DB), tournamentId)).map((s) => [s.name, tierFees(s, pricing)]))
}

/** One live section's own prices, as stored. */
async function sectionPrices(tournamentId: string, name: string) {
  return env.DB.prepare('SELECT fee_regular, fee_early, fee_late FROM tournament_sections WHERE tournament_id = ? AND name = ? AND archived_at IS NULL')
    .bind(tournamentId, name).first<{ fee_regular: number | null; fee_early: number | null; fee_late: number | null }>()
}

/** The tier prices seedTournament cannot store: the event's tier columns, and each live section's own prices by its name. */
interface Tiers {
  earlyDeadline?: string | null
  earlyDiscount?: number
  lateAfter?: string | null
  lateFee?: number
  sections?: Record<string, { feeRegular?: number | null; feeEarly?: number | null; feeLate?: number | null }>
}
const EVENT_COLUMNS = { earlyDeadline: 'early_deadline', earlyDiscount: 'early_discount', lateAfter: 'late_after', lateFee: 'late_fee' } as const
const SECTION_COLUMNS = { feeRegular: 'fee_regular', feeEarly: 'fee_early', feeLate: 'fee_late' } as const

/**
 * Stores the tiers given, after seeding: one UPDATE of the event's row for
 * its tier columns and one of each section named for its own prices, in one
 * batch, each changing exactly its one row. A fee_regular of null is a
 * section that pays the event's fee.
 */
async function setTiers(tournamentId: string, tiers: Tiers): Promise<void> {
  const statements: D1PreparedStatement[] = []
  const event = (Object.keys(EVENT_COLUMNS) as Array<keyof typeof EVENT_COLUMNS>).filter((key) => key in tiers)
  if (event.length > 0) {
    statements.push(env.DB.prepare(`UPDATE tournaments SET ${event.map((key) => `${EVENT_COLUMNS[key]} = ?`).join(', ')} WHERE id = ?`)
      .bind(...event.map((key) => tiers[key] ?? null), tournamentId))
  }
  for (const [name, own] of Object.entries(tiers.sections ?? {})) {
    const columns = (Object.keys(SECTION_COLUMNS) as Array<keyof typeof SECTION_COLUMNS>).filter((key) => key in own)
    statements.push(env.DB.prepare(
      `UPDATE tournament_sections SET ${columns.map((key) => `${SECTION_COLUMNS[key]} = ?`).join(', ')} WHERE tournament_id = ? AND name = ? AND archived_at IS NULL`,
    ).bind(...columns.map((key) => own[key] ?? null), tournamentId, name))
  }
  const results = await env.DB.batch(statements)
  for (const result of results) expect(result.meta.changes).toBe(1)
}

/** A plain member who directs the event by a director row: a one-event director. */
async function oneEventDirector(tournamentId: string): Promise<string> {
  const member = await seedMember()
  await seedTournamentDirector(tournamentId, member)
  return member
}

/** Expects the payout words with 403, and nothing of the event stored. */
async function expectRefused(res: Awaited<ReturnType<typeof patch>>, tournamentId: string, before: Awaited<ReturnType<typeof snapshot>>) {
  expect(res.status).toBe(403)
  expect(await expectContract(res, errorBodySchema)).toEqual({ error: FEES_NEED_PAYOUT_ACCOUNT })
  expect(await snapshot(tournamentId)).toEqual(before)
}

describe('the fee rule on a save, with CREATION_ROLES_ON set: a one-event director (D24)', () => {
  beforeEach(() => {
    flags.rolesOn = true
  })

  it('raising a section\'s fee from $20 to $25 is refused with the payout words, and nothing is stored', async () => {
    const event = await pricedEvent()
    const director = await oneEventDirector(event)
    const { Open } = await sectionIds(event)
    const before = await snapshot(event)
    await expectRefused(await patch(director, event, { sections: [{ id: Open, name: 'Open', entryFee: 25 }] }), event, before)
    expect(await sectionPrices(event, 'Open')).toEqual({ fee_regular: 20, fee_early: null, fee_late: null })
  })

  it('three saves the writer would store at the event\'s $25 fee, which would make the free U1200 cost $25, are each refused, and U1200 stays at $0', async () => {
    const event = await seedTournament()
    const director = await oneEventDirector(event)
    const { Open, U1200 } = await sectionIds(event)
    const saves: ReadonlyArray<readonly [string, unknown[]]> = [
      ['bare names', ['Open', 'U1200']],
      ['each section by its id with no fee', [{ id: Open, name: 'Open' }, { id: U1200, name: 'U1200' }]],
      ['each section by its id with a fee of null', [{ id: Open, name: 'Open', entryFee: null }, { id: U1200, name: 'U1200', entryFee: null }]],
    ]
    for (const [name, sections] of saves) {
      const before = await snapshot(event)
      const res = await patch(director, event, { sections })
      expect(res.status, name).toBe(403)
      expect(await res.json(), name).toEqual({ error: FEES_NEED_PAYOUT_ACCOUNT })
      expect(await snapshot(event), name).toEqual(before)
      expect((await sectionPrices(event, 'U1200'))?.fee_regular, name).toBe(0)
    }
  })

  it('the sections sent back exactly as the manage answer gave them pass, and no stored price changes', async () => {
    const event = await seedTournament()
    await setTiers(event, { earlyDeadline: EARLY_DEADLINE, earlyDiscount: 5, lateAfter: LATE_AFTER, lateFee: 10, sections: { Open: { feeEarly: 22 } } })
    const director = await oneEventDirector(event)
    const manage = await invoke(getManage, { as: director, params: { id: event } })
    expect(manage.status).toBe(200)
    const { tournament } = await manage.json<{ tournament: { sections: Array<{ fees: { regular: number } }> } }>()
    // Each section as the answer gives it, its fees carrying the regular price.
    for (const section of tournament.sections) expect(typeof section.fees.regular).toBe('number')
    const before = { prices: await prices(event), paid: await paid(event) }
    const res = await patch(director, event, { sections: tournament.sections })
    expect(res.status).toBe(200)
    await expectContract(res, edit.response)
    expect({ prices: await prices(event), paid: await paid(event) }).toEqual(before)
  })

  it('raising the event\'s fee from $20 to $30 is refused where a section pays it, and lowering it to $10 passes', async () => {
    const event = await pricedEvent()
    await setTiers(event, { sections: { Open: { feeRegular: null } } })
    const director = await oneEventDirector(event)
    const before = await snapshot(event)
    await expectRefused(await patch(director, event, { entryFee: 30 }), event, before)
    const lowered = await patch(director, event, { entryFee: 10 })
    expect(lowered.status).toBe(200)
    expect((await pricingOf(event)).entry_fee).toBe(10)
    expect(await sectionPrices(event, 'Open')).toEqual({ fee_regular: null, fee_early: null, fee_late: null })
    expect((await paid(event)).Open).toEqual({ regular: 10, early: null, late: null })
  })

  it('raising the event\'s fee where every section has a price of its own passes, since no entrant pays it', async () => {
    const event = await pricedEvent({ sections: [{ name: 'Open', entryFee: 20 }, { name: 'U1200', entryFee: 0 }] })
    const director = await oneEventDirector(event)
    const before = await paid(event)
    const res = await patch(director, event, { entryFee: 30 })
    expect(res.status).toBe(200)
    expect((await pricingOf(event)).entry_fee).toBe(30)
    expect(await paid(event)).toEqual(before)
  })

  it('raising the event\'s fee where only an archived section pays it is refused, left out in the same save or archived before it, since the waitlist\'s offer prices an entry left in it from its row; lowering it passes', async () => {
    const event = await pricedEvent({ sections: [{ name: 'Open', entryFee: 20 }, { name: 'Reserve', entryFee: 20 }] })
    await setTiers(event, { sections: { Reserve: { feeRegular: null } } })
    const director = await oneEventDirector(event)
    const { Open } = await sectionIds(event)
    const open = { id: Open, name: 'Open', entryFee: 20 }
    const before = await snapshot(event)
    await expectRefused(await patch(director, event, { entryFee: 30, sections: [open] }), event, before)
    expect((await patch(director, event, { sections: [open] })).status).toBe(200)
    expect(await sectionIds(event)).toEqual({ Open })
    const archived = await snapshot(event)
    await expectRefused(await patch(director, event, { entryFee: 30 }), event, archived)
    const lowered = await patch(director, event, { entryFee: 15 })
    expect(lowered.status).toBe(200)
    expect((await pricingOf(event)).entry_fee).toBe(15)
    expect(await env.DB.prepare('SELECT fee_regular, archived_at IS NOT NULL AS archived FROM tournament_sections WHERE tournament_id = ? AND name = ?').bind(event, 'Reserve').first())
      .toEqual({ fee_regular: null, archived: 1 })
  })

  it('a late fee that appears where a late date is stored is refused; one with no date passes, since no price changes, and a date that then makes it real is refused', async () => {
    const dated = await pricedEvent()
    await setTiers(dated, { lateAfter: LATE_AFTER })
    const director = await oneEventDirector(dated)
    const before = await snapshot(dated)
    await expectRefused(await patch(director, dated, { lateFee: 5 }), dated, before)

    const undated = await pricedEvent()
    const other = await oneEventDirector(undated)
    const paidBefore = await paid(undated)
    const res = await patch(other, undated, { lateFee: 5 })
    expect(res.status).toBe(200)
    expect(await pricingOf(undated)).toMatchObject({ late_after: null, late_fee: 5 })
    expect(await paid(undated)).toEqual(paidBefore)
    const stored = await snapshot(undated)
    await expectRefused(await patch(other, undated, { lateAfter: LATE_AFTER }), undated, stored)
  })

  it('a discount that appears with its deadline passes, and so does a deadline that makes a stored discount real: a discount lowers the early price', async () => {
    const event = await pricedEvent()
    const director = await oneEventDirector(event)
    const res = await patch(director, event, { earlyDeadline: EARLY_DEADLINE, earlyDiscount: 5 })
    expect(res.status).toBe(200)
    expect(await pricingOf(event)).toMatchObject({ early_deadline: EARLY_DEADLINE, early_discount: 5 })
    expect((await paid(event)).Open).toEqual({ regular: 20, early: 15, late: null })

    const discounted = await pricedEvent()
    await setTiers(discounted, { earlyDiscount: 5 })
    const other = await oneEventDirector(discounted)
    expect((await paid(discounted)).Open.early).toBeNull()
    const dated = await patch(other, discounted, { earlyDeadline: EARLY_DEADLINE })
    expect(dated.status).toBe(200)
    expect(await pricingOf(discounted)).toMatchObject({ early_deadline: EARLY_DEADLINE, early_discount: 5 })
    expect((await paid(discounted)).Open).toEqual({ regular: 20, early: 15, late: null })
  })

  it('a new section at $0 passes, and one at $15 is refused', async () => {
    const event = await pricedEvent()
    const director = await oneEventDirector(event)
    const { Open } = await sectionIds(event)
    const before = await snapshot(event)
    await expectRefused(await patch(director, event, { sections: [{ id: Open, name: 'Open', entryFee: 20 }, { name: 'U800', entryFee: 15 }] }), event, before)
    expect(await sectionPrices(event, 'U800')).toBeNull()
    const free = await patch(director, event, { sections: [{ id: Open, name: 'Open', entryFee: 20 }, { name: 'U800', entryFee: 0 }] })
    expect(free.status).toBe(200)
    expect(await sectionPrices(event, 'U800')).toEqual({ fee_regular: 0, fee_early: null, fee_late: null })
    expect(await sectionPrices(event, 'Open')).toEqual({ fee_regular: 20, fee_early: null, fee_late: null })
  })

  it('a section\'s own early price below regular passes, whether its row had none or a higher one, and one above regular is refused', async () => {
    for (const stored of [null, 15]) {
      const event = await pricedEvent()
      if (stored !== null) await setTiers(event, { sections: { Open: { feeEarly: stored } } })
      const director = await oneEventDirector(event)
      const { Open } = await sectionIds(event)
      const res = await patch(director, event, { sections: [{ id: Open, name: 'Open', entryFee: 20, fees: { early: 10 } }] })
      expect(res.status, `stored early ${stored}`).toBe(200)
      expect(await sectionPrices(event, 'Open'), `stored early ${stored}`).toEqual({ fee_regular: 20, fee_early: 10, fee_late: null })
    }
    const event = await pricedEvent()
    const director = await oneEventDirector(event)
    const { Open } = await sectionIds(event)
    const before = await snapshot(event)
    await expectRefused(await patch(director, event, { sections: [{ id: Open, name: 'Open', entryFee: 20, fees: { early: 25 } }] }), event, before)
  })

  it('a section\'s own late price above regular is refused, where its row has none, and one below regular passes', async () => {
    const event = await pricedEvent()
    const director = await oneEventDirector(event)
    const { Open } = await sectionIds(event)
    const before = await snapshot(event)
    await expectRefused(await patch(director, event, { sections: [{ id: Open, name: 'Open', entryFee: 20, fees: { late: 25 } }] }), event, before)
    const res = await patch(director, event, { sections: [{ id: Open, name: 'Open', entryFee: 20, fees: { late: 15 } }] })
    expect(res.status).toBe(200)
    expect(await sectionPrices(event, 'Open')).toEqual({ fee_regular: 20, fee_early: null, fee_late: 15 })
  })

  it('no one the manage check refuses reaches the rule: a signed-out visitor gets 401 and a member who does not direct the event 403 "Forbidden", and nothing is stored', async () => {
    const event = await pricedEvent()
    const { Open } = await sectionIds(event)
    const raise = { sections: [{ id: Open, name: 'Open', entryFee: 25 }] }
    const before = await snapshot(event)
    const visitor = await patch(undefined, event, raise)
    expect(visitor.status).toBe(401)
    await expectContract(visitor, errorBodySchema)
    const member = await patch(await seedMember(), event, raise)
    expect(member.status).toBe(403)
    expect(await member.json()).toEqual({ error: 'Forbidden' })
    expect(await snapshot(event)).toEqual(before)
  })
})

describe('the fee rule on a save, with CREATION_ROLES_ON set: D24\'s list raises a fee', () => {
  beforeEach(() => {
    flags.rolesOn = true
  })

  /** Raises Open from $20 to $25 and expects it stored. */
  async function raises(as: string, event: string) {
    const { Open } = await sectionIds(event)
    const res = await patch(as, event, { sections: [{ id: Open, name: 'Open', entryFee: 25 }] })
    expect(res.status).toBe(200)
    await expectContract(res, edit.response)
    expect(await sectionPrices(event, 'Open')).toEqual({ fee_regular: 25, fee_early: null, fee_late: null })
  }

  it('a standing director raises a fee on the event they created and direct', async () => {
    const director = await seedDirector()
    const event = await pricedEvent({ createdBy: director })
    await seedTournamentDirector(event, director)
    await raises(director, event)
  })

  it('the president raises a fee on an event the president created and directs', async () => {
    const president = await seedMember({ role: 'lca_observer' })
    await seedPresident(president)
    const event = await pricedEvent({ createdBy: president })
    await seedTournamentDirector(event, president)
    await raises(president, event)
  })

  it('an LCA admin and the organizing club\'s rep each raise a fee', async () => {
    const clubId = await seedClub()
    await raises(await seedAdmin(), await pricedEvent({ clubId }))
    await raises(await seedMember({ role: 'club_rep', clubId }), await pricedEvent({ clubId }))
  })

  it('a standing director who sends the membership switch on their LCA-run event gets today\'s 403, and the event still requires a membership (Q37)', async () => {
    const director = await seedDirector()
    const event = await pricedEvent({ createdBy: director })
    await seedTournamentDirector(event, director)
    for (const requiresLcaMembership of [false, true]) {
      const before = await snapshot(event)
      const res = await patch(director, event, { requiresLcaMembership })
      expect(res.status, String(requiresLcaMembership)).toBe(403)
      expect(await res.json()).toEqual({ error: MEMBERSHIP_WORDS })
      expect(await snapshot(event)).toEqual(before)
    }
    const row = await env.DB.prepare('SELECT club_id, requires_lca_membership FROM tournaments WHERE id = ?').bind(event).first()
    expect(row).toEqual({ club_id: null, requires_lca_membership: 1 })
  })
})

describe('the fee rule on a save, with CREATION_ROLES_ON unset, as today', () => {
  it('a one-event director raises a section\'s fee', async () => {
    const event = await pricedEvent()
    const director = await oneEventDirector(event)
    const { Open } = await sectionIds(event)
    const res = await patch(director, event, { sections: [{ id: Open, name: 'Open', entryFee: 25 }] })
    expect(res.status).toBe(200)
    expect(await sectionPrices(event, 'Open')).toEqual({ fee_regular: 25, fee_early: null, fee_late: null })
  })
})

describe('the comparison reads each section as the writer stores it', () => {
  /**
   * An event with a section of each kind: Open at its own $25 with its own
   * early and late prices; U1600 at the event's fee; U1200 free; and U800,
   * with its own late price, archived by an LCA admin's save that left it
   * out. The event has an early discount and a late fee, each with its date.
   */
  async function everyKind(admin: string) {
    const event = await seedTournament({
      entryFee: 25,
      sections: [{ name: 'Open', entryFee: 25 }, { name: 'U1600', entryFee: 25 }, { name: 'U1200', entryFee: 0 }, { name: 'U800', entryFee: 10 }],
    })
    await setTiers(event, {
      earlyDeadline: EARLY_DEADLINE, earlyDiscount: 5, lateAfter: LATE_AFTER, lateFee: 10,
      sections: { Open: { feeEarly: 18, feeLate: 32 }, U800: { feeLate: 12 } },
    })
    const ids = await sectionIds(event)
    const archived = await patch(admin, event, {
      sections: [{ id: ids.Open, name: 'Open', entryFee: 25 }, { id: ids.U1600, name: 'U1600', entryFee: 25 }, { id: ids.U1200, name: 'U1200', entryFee: 0 }],
    })
    expect(archived.status).toBe(200)
    await setTiers(event, { sections: { U1600: { feeRegular: null } } })
    return { event, ids }
  }

  it('savedSectionFees, worked out before an LCA admin\'s save, gives what entrants pay in every row the writer leaves, the archived ones included, for every way a list names a section', async () => {
    const admin = await seedAdmin()
    const lists: ReadonlyArray<readonly [string, (ids: Record<string, string>, manage: SectionListItem[]) => SectionListItem[], Record<string, unknown>?]> = [
      ['bare names', () => ['Open', 'U1600', 'U1200']],
      ['ids with no fee', (ids) => [{ id: ids.Open, name: 'Open' }, { id: ids.U1600, name: 'U1600' }, { id: ids.U1200, name: 'U1200' }]],
      ['ids with a fee of null', (ids) => [{ id: ids.Open, name: 'Open', entryFee: null }, { id: ids.U1600, name: 'U1600', entryFee: null }, { id: ids.U1200, name: 'U1200', entryFee: null }]],
      ['a fee that is not a number', (ids) => [{ id: ids.Open, name: 'Open', entryFee: '30' }, { id: ids.U1600, name: 'U1600', entryFee: 25 }, { id: ids.U1200, name: 'U1200', entryFee: 0 }]],
      ['a section renamed by its id', (ids) => [{ id: ids.Open, name: 'Championship', entryFee: 25 }, { id: ids.U1600, name: 'U1600' }, { id: ids.U1200, name: 'U1200', entryFee: 0 }]],
      ['the archived section brought back by its name', (ids) => [{ id: ids.Open, name: 'Open', entryFee: 25 }, { name: 'U800' }]],
      ['two sections left out', (ids) => [{ id: ids.Open, name: 'Open', entryFee: 25 }]],
      ['the manage answer sent back', (_ids, manage) => manage],
      ['the manage answer sent back with the event\'s fee raised', (_ids, manage) => manage, { entryFee: 30 }],
      ['own early and late prices, one cleared', (ids) => [
        { id: ids.Open, name: 'Open', entryFee: 25, fees: { early: null, late: 35 } }, { id: ids.U1600, name: 'U1600', fees: { early: 15 } }, { id: ids.U1200, name: 'U1200', entryFee: 0 },
      ]],
      ['a new section with prices of its own', (ids) => [{ id: ids.Open, name: 'Open', entryFee: 25 }, { name: 'U2000', entryFee: 30, fees: { early: 25, late: 40 } }]],
      ['a name whose row another element takes by its id', (ids) => [{ id: ids.Open, name: 'Premier', entryFee: 25 }, { name: 'Open', entryFee: 20 }, { id: ids.U1200, name: 'U1200', entryFee: 0 }]],
      ['the event\'s columns changed with bare names', () => ['Open', 'U1600', 'U1200'], { entryFee: 40, earlyDiscount: 0, lateFee: 15 }],
    ]
    for (const [name, listFor, eventChange] of lists) {
      const { event, ids } = await everyKind(admin)
      const manage = (await (await invoke(getManage, { as: admin, params: { id: event } })).json<{ tournament: { sections: SectionListItem[] } }>()).tournament.sections
      const list = listFor(ids, manage)
      const stored = await loadSections(getDb(env.DB), event, { includeArchived: true })
      const res = await patch(admin, event, { ...eventChange, sections: list })
      expect(res.status, name).toBe(200)
      const pricing = await pricingOf(event)
      const rows = await loadSections(getDb(env.DB), event, { includeArchived: true })
      const live = rows.filter((row) => row.archivedAt === null)
      const modelled = savedSectionFees(stored, list, pricing)
      // The list's elements first: the live rows the writer leaves, in order.
      const sent = modelled.slice(0, list.length)
      expect(sent.map((entry) => entry.fees), name).toEqual(live.map((row) => tierFees(row, pricing)))
      // Each element became the row the model matched it to, or a new one.
      const known = new Set(stored.map((row) => row.id))
      expect(sent.map((entry) => (entry.key.startsWith('new:') ? 'new' : entry.key)), name).toEqual(live.map((row) => (known.has(row.id) ? row.id : 'new')))
      // Then every row the list does not take, each archived after the save at its own prices.
      const archived = rows.filter((row) => row.archivedAt !== null)
      expect(modelled.length, name).toBe(rows.length)
      expect(Object.fromEntries(modelled.slice(list.length).map((entry) => [entry.key, entry.fees])), name)
        .toEqual(Object.fromEntries(archived.map((row) => [row.id, tierFees(row, pricing)])))
    }
  })

  it('and a create, from no rows: the list the create checks is what entrants pay in the sections it makes', async () => {
    const admin = await seedAdmin()
    const sections: SectionListItem[] = ['Open', { name: 'U1200', entryFee: 0, fees: { late: 5 } }, { name: 'U800', entryFee: '15' }, { name: 'Reserve', entryFee: 10, fees: { early: 8 } }]
    const res = await invoke(createTournament, { method: 'POST', as: admin, body: { name: 'Model Open', location: 'Kenner, LA', date: '2026-12-05', entryFee: 20, sections } })
    expect(res.status).toBe(201)
    const { tournament } = await res.json<{ tournament: { id: string } }>()
    const pricing = await pricingOf(tournament.id)
    const live = await loadSections(getDb(env.DB), tournament.id)
    expect(savedSectionFees([], sections, { entry_fee: 20 }).map((entry) => entry.fees)).toEqual(live.map((row) => tierFees(row, pricing)))
    expect(live.map((row) => tierFees(row, pricing))).toEqual([
      { regular: 20, early: null, late: null },
      { regular: 0, early: null, late: 5 },
      { regular: 20, early: null, late: null },
      { regular: 10, early: 8, late: null },
    ])
  })
})
