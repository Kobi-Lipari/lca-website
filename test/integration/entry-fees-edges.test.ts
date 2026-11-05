// test/integration/entry-fees-edges.test.ts
//
// The edges of D24 on the setup save, PATCH /api/admin/tournaments/[id]
// (WS08 step 4), past the cases of test/integration/entry-fees.test.ts:
//   1. One helper decides: with canChargeFees made to refuse, all of D24's
//      list is refused, and made to allow, a one-event director passes; it is
//      asked about the person creationPerson reads, the event's own club and
//      creator and the constant the save read, and only once a save raises a
//      price.
//   2. What counts, tier by tier: a discount taken away and an own price
//      below regular cleared are raises; a late fee lowered or taken away is
//      not; a price equal at a tier is no raise and a cent more is; on a free
//      event a fee above $0 is refused wherever an entrant would pay it; and
//      the rule does not read the clock, nor when each tier applies, so a
//      save that changes when a tier applies but not its price passes, a
//      date moved earlier among them, though checkout then charges more.
//   3. The saves the manage page makes: a details save with a section
//      renamed, a stale page after an LCA admin's change, a section left out
//      and brought back, compared with its own archived row, an event with
//      no live section, and a section that pays the event's fee sent back,
//      which WS01's open follow-up "Bare-name section pinned to the event
//      fee" still pins.
//   4. The order of the checks: the membership rule before the fee rule, and
//      the fee rule before the writer's own checks of a list.
//   5. Replays, and a refused save that stores nothing else and adds nothing
//      to the activity log.
//   6. D24's list read from the person's grant at each request: a standing
//      director on an event another member made, a club rep on another
//      club's event, and a grant lost and given back.
//   7. Role safety in both states: no one the manage check refuses reaches
//      the rule.
//   8. With the constant unset, every kind of save the rule refuses passes
//      and stores what an LCA admin's same save stores, the constant set or
//      unset.
//   9. Q37 from the create on: a standing director's and the president's
//      event stays LCA-run, its membership switch locked on.
//  10. What an entrant pays: a new entry needs a live section; no entrant is
//      asked a price the rule never read, an entry left in an archived
//      section included, whichever comes first, the raise or the entry's
//      reinstatement; and a price stored below $0 set to $0 is no fee above
//      $0.
//  11. savedSectionFees beside the writer, on lists drawn at random, every
//      row the writer leaves read, the archived ones included.
// Every case reads the stored rows after the call. CREATION_ROLES_ON is false
// in the tree; it is read here through a getter on the mocked module, and
// canChargeFees through a wrapper on the mocked rules module, which asks the
// real rule unless a case gives it an answer.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { contracts, errorBodySchema } from '../../domain/contracts'
import { FEES_NEED_PAYOUT_ACCOUNT } from '../../domain/events/creation'
import { tierFees, type SectionListItem, type TierFees, type TierTournament } from '../../domain/events/sections'
import { priceEntry } from '../../domain/registration/pricing'
import { getDb } from '../../functions/db/client'
import { loadSections, savedSectionFees } from '../../functions/utils/events/sectionsRepo'
import { onRequestPost as createTournament } from '../../functions/api/admin/tournaments'
import { onRequestPatch as patchTournament } from '../../functions/api/admin/tournaments/[id]'
import { onRequestGet as getManage } from '../../functions/api/admin/tournaments/[id]/manage'
import { onRequestPost as offerSpot } from '../../functions/api/admin/tournaments/[id]/waitlist'
import { onRequestPost as register } from '../../functions/api/registrations'
import { onRequestPost as registerFamily } from '../../functions/api/registrations/batch'
import { onRequestPatch as patchRegistration } from '../../functions/api/registrations/[id]'
import {
  seedAdmin, seedClub, seedDirector, seedMember, seedPresident, seedRegistration, seedTournament, seedTournamentDirector, type SeedTournamentOptions,
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

/** What the save asked canChargeFees, and the answer a case gives in place of the real rule's. */
const fees = vi.hoisted(() => ({
  answer: null as boolean | null,
  asked: [] as Array<{ grant: string; memberId: string; repClubId: string | null; event: { clubId: string | null; createdBy: string | null }; rolesOn: boolean }>,
}))
vi.mock('../../domain/events/creation', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../domain/events/creation')>()
  return {
    ...real,
    canChargeFees: (...args: Parameters<typeof real.canChargeFees>) => {
      const [person, event, rolesOn] = args
      fees.asked.push({ grant: person.grant, memberId: person.memberId, repClubId: person.repClubId, event: { clubId: event.clubId, createdBy: event.createdBy }, rolesOn })
      return fees.answer ?? real.canChargeFees(...args)
    },
  }
})

beforeEach(() => {
  resetHarness()
  fees.asked.length = 0
})
afterEach(() => {
  flags.rolesOn = false
  fees.answer = null
})

const edit = contracts['admin/tournaments/[id]'].PATCH
const MEMBERSHIP_WORDS = "Only the organizing club's rep or an LCA admin can change whether an LCA membership is required"
const CLUB_WORDS = 'Only LCA admins can change the organizing club'
const EARLY_DEADLINE = '2026-09-01T00:00'
const LATE_AFTER = '2026-09-10T00:00'
/** The two states of CREATION_ROLES_ON, for the cases that run in both. */
const STATES: ReadonlyArray<readonly [string, boolean]> = [['unset', false], ['set', true]]

type Answer = Awaited<ReturnType<typeof invoke>>
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

/** Stores the tiers given after seeding, in one batch, each statement changing exactly its one row. A fee_regular of null pays the event's fee. */
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
async function expectRefused(res: Answer, tournamentId: string, before: Awaited<ReturnType<typeof snapshot>>, label = '') {
  expect(res.status, label).toBe(403)
  expect(await expectContract(res, errorBodySchema), label).toEqual({ error: FEES_NEED_PAYOUT_ACCOUNT })
  expect(await snapshot(tournamentId), label).toEqual(before)
}

/** The actions of the activity log's entries about the event, in order. */
async function auditActions(tournamentId: string): Promise<string[]> {
  const { results } = await env.DB.prepare("SELECT action FROM admin_audit_log WHERE detail LIKE '%' || ? || '%' ORDER BY rowid")
    .bind(`"tournament_id":"${tournamentId}"`).all<{ action: string }>()
  return results.map((r) => r.action)
}

/** The sections of the manage answer, as the page loads them. */
async function manageSections(as: string, tournamentId: string): Promise<Array<Record<string, unknown> & { id: string; name: string }>> {
  const res = await invoke(getManage, { as, params: { id: tournamentId } })
  expect(res.status).toBe(200)
  return (await res.json<{ tournament: { sections: Array<Record<string, unknown> & { id: string; name: string }> } }>()).tournament.sections
}

describe('one helper decides who may raise, with CREATION_ROLES_ON set (D24)', () => {
  beforeEach(() => {
    flags.rolesOn = true
  })

  it('with canChargeFees made to refuse, an LCA admin\'s, the organizing club\'s rep\'s, the president\'s and a standing director\'s raise are each refused with the payout words, and nothing is stored', async () => {
    fees.answer = false
    const clubId = await seedClub()
    const president = await seedMember({ role: 'lca_observer' })
    await seedPresident(president)
    const director = await seedDirector()
    const savers: ReadonlyArray<readonly [string, string, string]> = [
      ['an LCA admin', await seedAdmin(), await pricedEvent()],
      ['the organizing club\'s rep', await seedMember({ role: 'club_rep', clubId }), await pricedEvent({ clubId })],
      ['the president', president, await pricedEvent({ createdBy: president })],
      ['a standing director', director, await pricedEvent({ createdBy: director })],
    ]
    await seedTournamentDirector(savers[2][2], president)
    await seedTournamentDirector(savers[3][2], director)
    for (const [who, as, event] of savers) {
      const { Open } = await sectionIds(event)
      const before = await snapshot(event)
      await expectRefused(await patch(as, event, { sections: [{ id: Open, name: 'Open', entryFee: 25 }] }), event, before, who)
    }
    expect(fees.asked.map((a) => a.grant)).toEqual(['admin', 'club_rep', 'president', 'standing_director'])
  })

  it('with canChargeFees made to allow, a one-event director\'s save that raises a price at every tier passes and is stored', async () => {
    fees.answer = true
    const event = await pricedEvent()
    const director = await oneEventDirector(event)
    const { Open } = await sectionIds(event)
    const res = await patch(director, event, {
      entryFee: 30, lateAfter: LATE_AFTER, lateFee: 5,
      sections: [{ id: Open, name: 'Open', entryFee: 25, fees: { early: 30 } }, { name: 'U800', entryFee: 15 }],
    })
    expect(res.status).toBe(200)
    await expectContract(res, edit.response)
    expect(await paid(event)).toEqual({ Open: { regular: 25, early: 30, late: 30 }, U800: { regular: 15, early: null, late: 20 } })
    expect(await pricingOf(event)).toMatchObject({ entry_fee: 30, late_after: LATE_AFTER, late_fee: 5 })
    expect(fees.asked).toHaveLength(1)
  })

  it('is asked once a save raises a price, about the person creationPerson reads, the event\'s own club and creator, and the constant the save read; a save that raises nothing does not ask it', async () => {
    const creator = await seedDirector()
    const clubId = await seedClub()
    const event = await pricedEvent({ createdBy: creator, clubId })
    const director = await oneEventDirector(event)
    const { Open } = await sectionIds(event)
    const lowered = await patch(director, event, { name: 'Bayou Open', sections: [{ id: Open, name: 'Open', entryFee: 15 }] })
    expect(lowered.status).toBe(200)
    expect(fees.asked).toEqual([])
    expect(await sectionPrices(event, 'Open')).toEqual({ fee_regular: 15, fee_early: null, fee_late: null })
    for (const [rolesOn, status] of [[true, 403], [false, 200]] as const) {
      flags.rolesOn = rolesOn
      fees.asked.length = 0
      const res = await patch(director, event, { sections: [{ id: Open, name: 'Open', entryFee: 25 }] })
      expect(res.status, String(rolesOn)).toBe(status)
      expect(fees.asked, String(rolesOn)).toEqual([{ grant: 'none', memberId: director, repClubId: null, event: { clubId, createdBy: creator }, rolesOn }])
    }
    expect(await sectionPrices(event, 'Open')).toEqual({ fee_regular: 25, fee_early: null, fee_late: null })
  })
})

describe('what counts as a raise, tier by tier, for a one-event director with CREATION_ROLES_ON set (D24)', () => {
  beforeEach(() => {
    flags.rolesOn = true
  })

  it('a discount taken away raises the early price and is refused: its deadline cleared, the discount cleared or lowered, and a discount below $0, which the save stores as $0; a larger discount passes', async () => {
    const event = await pricedEvent()
    await setTiers(event, { earlyDeadline: EARLY_DEADLINE, earlyDiscount: 5 })
    const director = await oneEventDirector(event)
    for (const body of [{ earlyDeadline: null }, { earlyDeadline: '' }, { earlyDiscount: 0 }, { earlyDiscount: null }, { earlyDiscount: 2 }, { earlyDiscount: -5 }]) {
      const before = await snapshot(event)
      await expectRefused(await patch(director, event, body), event, before, JSON.stringify(body))
    }
    const larger = await patch(director, event, { earlyDiscount: 8 })
    expect(larger.status).toBe(200)
    expect(await pricingOf(event)).toMatchObject({ early_deadline: EARLY_DEADLINE, early_discount: 8 })
    expect((await paid(event)).Open).toEqual({ regular: 20, early: 12, late: null })
  })

  it('an own price below regular cleared raises that tier and is refused, and an own price above regular cleared lowers it and passes', async () => {
    const below = await pricedEvent()
    await setTiers(below, { sections: { Open: { feeEarly: 15, feeLate: 15 } } })
    const above = await pricedEvent()
    await setTiers(above, { sections: { Open: { feeEarly: 25, feeLate: 30 } } })
    for (const event of [below, above]) {
      const director = await oneEventDirector(event)
      const { Open } = await sectionIds(event)
      for (const tier of ['early', 'late'] as const) {
        const before = await snapshot(event)
        const res = await patch(director, event, { sections: [{ id: Open, name: 'Open', entryFee: 20, fees: { [tier]: null } }] })
        if (event === below) {
          await expectRefused(res, event, before, `below, ${tier}`)
        } else {
          expect(res.status, `above, ${tier}`).toBe(200)
        }
      }
    }
    expect(await sectionPrices(below, 'Open')).toEqual({ fee_regular: 20, fee_early: 15, fee_late: 15 })
    expect(await sectionPrices(above, 'Open')).toEqual({ fee_regular: 20, fee_early: null, fee_late: null })
  })

  it('a late fee lowered, a late fee below $0, which the save stores as $0, and a late date cleared each lower the late price and pass', async () => {
    const event = await pricedEvent()
    await setTiers(event, { lateAfter: LATE_AFTER, lateFee: 10 })
    const director = await oneEventDirector(event)
    expect((await patch(director, event, { lateFee: 5 })).status).toBe(200)
    expect((await paid(event)).Open).toEqual({ regular: 20, early: null, late: 25 })
    expect((await patch(director, event, { lateFee: -3 })).status).toBe(200)
    expect(await pricingOf(event)).toMatchObject({ late_after: LATE_AFTER, late_fee: 0 })
    await setTiers(event, { lateFee: 10 })
    expect((await patch(director, event, { lateAfter: null })).status).toBe(200)
    expect(await pricingOf(event)).toMatchObject({ late_after: null, late_fee: 10 })
    expect((await paid(event)).Open).toEqual({ regular: 20, early: null, late: null })
  })

  it('a price equal at a tier is no raise and a cent more is: own early and late prices equal to regular pass, and a regular, an own late price or the event\'s fee a cent up is refused', async () => {
    const event = await pricedEvent()
    const director = await oneEventDirector(event)
    const { Open } = await sectionIds(event)
    const equal = await patch(director, event, { sections: [{ id: Open, name: 'Open', entryFee: 20, fees: { early: 20, late: 20 } }] })
    expect(equal.status).toBe(200)
    expect(await sectionPrices(event, 'Open')).toEqual({ fee_regular: 20, fee_early: 20, fee_late: 20 })
    for (const sections of [[{ id: Open, name: 'Open', entryFee: 20.01 }], [{ id: Open, name: 'Open', entryFee: 20, fees: { late: 20.01 } }]]) {
      const before = await snapshot(event)
      await expectRefused(await patch(director, event, { sections }), event, before, JSON.stringify(sections))
    }
    await setTiers(event, { sections: { Open: { feeRegular: null } } })
    const before = await snapshot(event)
    await expectRefused(await patch(director, event, { entryFee: 20.01 }), event, before)
  })

  it('on a free event a fee above $0 is refused wherever an entrant would pay it, the event\'s fee where a section pays it and a free section\'s own fee, while a late fee with its date, which adds nothing to a free section, passes', async () => {
    const event = await seedTournament({ entryFee: 0, sections: [{ name: 'Open', entryFee: 0 }, { name: 'U1200', entryFee: 0 }] })
    await setTiers(event, { sections: { Open: { feeRegular: null } } })
    const director = await oneEventDirector(event)
    const { Open, U1200 } = await sectionIds(event)
    const before = await snapshot(event)
    await expectRefused(await patch(director, event, { entryFee: 10 }), event, before, 'the event\'s fee')
    await expectRefused(await patch(director, event, { sections: [{ id: Open, name: 'Open' }, { id: U1200, name: 'U1200', entryFee: 5 }] }), event, before, 'U1200')
    const late = await patch(director, event, { lateAfter: LATE_AFTER, lateFee: 5 })
    expect(late.status).toBe(200)
    expect(await pricingOf(event)).toMatchObject({ late_after: LATE_AFTER, late_fee: 5 })
    expect(await paid(event)).toEqual({ Open: { regular: 0, early: null, late: null }, U1200: { regular: 0, early: null, late: null } })
  })

  it('does not read the clock, nor when each tier applies: a late fee with a date already past and one with a date to come are each refused, a discount whose deadline has passed passes, and a save that changes when a tier applies but not its price passes, though checkout then charges more', async () => {
    for (const lateAfter of ['2026-01-10T00:00', '2027-01-09T00:00']) {
      const event = await pricedEvent()
      const director = await oneEventDirector(event)
      const before = await snapshot(event)
      await expectRefused(await patch(director, event, { lateAfter, lateFee: 5 }), event, before, lateAfter)
    }
    const event = await pricedEvent()
    const director = await oneEventDirector(event)
    const res = await patch(director, event, { earlyDeadline: '2026-01-05T00:00', earlyDiscount: 5 })
    expect(res.status).toBe(200)
    expect((await paid(event)).Open).toEqual({ regular: 20, early: 15, late: null })

    // The comparison reads what each tier costs, as tierFees gives it, and
    // not when it applies, as the rule stands: each save below changes no
    // tier's price, so it passes, while an entry made on the day between the
    // dates costs more after it. tierFees takes a section's own early and
    // late prices whatever the dates. Whether a save like these counts as a
    // raise is a question for K, in the follow-up on the fee tiers in
    // REDESIGN_STATUS.md.
    const between = Date.UTC(2026, 10, 20, 18)
    const timed: ReadonlyArray<readonly [string, Tiers, Record<string, string | null>, number, number]> = [
      ['a stored late date moved earlier', { lateAfter: '2026-12-10T00:00', lateFee: 10 }, { lateAfter: '2026-11-05T00:00' }, 20, 30],
      ['a stored early deadline moved earlier', { earlyDeadline: '2026-12-01T00:00', earlyDiscount: 5 }, { earlyDeadline: '2026-11-01T00:00' }, 15, 20],
      ['a late date added under a section\'s own late price', { sections: { Open: { feeLate: 30 } } }, { lateAfter: '2026-11-05T00:00' }, 20, 30],
      ['the early deadline cleared over a section\'s own early price', { earlyDeadline: '2026-12-01T00:00', sections: { Open: { feeEarly: 15 } } }, { earlyDeadline: null }, 15, 20],
    ]
    for (const [name, stored, save, costBefore, costAfter] of timed) {
      const dated = await pricedEvent()
      await setTiers(dated, stored)
      const other = await oneEventDirector(dated)
      const paidBefore = await paid(dated)
      const costOnTheDay = async () => priceEntry((await loadSections(getDb(env.DB), dated))[0], await pricingOf(dated), between).amount
      expect(await costOnTheDay(), name).toBe(costBefore)
      const saved = await patch(other, dated, save)
      expect(saved.status, name).toBe(200)
      expect(await pricingOf(dated), name)
        .toMatchObject(Object.fromEntries(Object.entries(save).map(([key, value]) => [EVENT_COLUMNS[key as keyof typeof EVENT_COLUMNS], value])))
      expect(await paid(dated), name).toEqual(paidBefore)
      expect(await costOnTheDay(), name).toBe(costAfter)
    }
  })
})

describe('the saves the manage page makes, by a one-event director with CREATION_ROLES_ON set', () => {
  beforeEach(() => {
    flags.rolesOn = true
  })

  it('the details save, every section as the answer gave it with one renamed and its prize fund changed, passes with no price changed, and the renamed row keeps its prices', async () => {
    const event = await seedTournament()
    await setTiers(event, { earlyDeadline: EARLY_DEADLINE, earlyDiscount: 5, sections: { Open: { feeLate: 32 } } })
    const director = await oneEventDirector(event)
    const ids = await sectionIds(event)
    const sections = (await manageSections(director, event)).map((s) => (s.name === 'Open' ? { ...s, name: 'Championship', prizeFund: '$500 guaranteed' } : s))
    const before = await paid(event)
    const res = await patch(director, event, { name: 'Renamed Open', sections })
    expect(res.status).toBe(200)
    await expectContract(res, edit.response)
    expect(await paid(event)).toEqual({ Championship: before.Open, U1200: before.U1200 })
    expect(await sectionIds(event)).toEqual({ Championship: ids.Open, U1200: ids.U1200 })
    expect(await env.DB.prepare('SELECT name, prize_fund, fee_regular, fee_early, fee_late FROM tournament_sections WHERE id = ?').bind(ids.Open).first())
      .toEqual({ name: 'Championship', prize_fund: '$500 guaranteed', fee_regular: 25, fee_early: null, fee_late: 32 })
    expect((await env.DB.prepare('SELECT name FROM tournaments WHERE id = ?').bind(event).first<{ name: string }>())?.name).toBe('Renamed Open')
  })

  it('a stale page, its sections sent back as it loaded them after an LCA admin lowered a price, is a raise and is refused, the admin\'s price staying; after the admin raised it instead, the same page lowers it back and passes', async () => {
    const event = await pricedEvent({ sections: [{ name: 'Open', entryFee: 20 }, { name: 'U1200', entryFee: 0 }] })
    const director = await oneEventDirector(event)
    const admin = await seedAdmin()
    const loaded = await manageSections(director, event)
    const { Open, U1200 } = await sectionIds(event)
    const adminSets = async (entryFee: number) => {
      const res = await patch(admin, event, { sections: [{ id: Open, name: 'Open', entryFee }, { id: U1200, name: 'U1200', entryFee: 0 }] })
      expect(res.status).toBe(200)
    }
    await adminSets(15)
    const before = await snapshot(event)
    await expectRefused(await patch(director, event, { sections: loaded }), event, before)
    expect((await sectionPrices(event, 'Open'))?.fee_regular).toBe(15)
    await adminSets(30)
    expect((await patch(director, event, { sections: loaded })).status).toBe(200)
    expect((await sectionPrices(event, 'Open'))?.fee_regular).toBe(20)
  })

  it('a section left out is archived and passes, whatever its price; brought back from the archive it is compared with its own row: at the price the row kept or below it, by its id or by its name, it passes, and above it, or as a bare name at the event\'s higher fee, it is refused', async () => {
    const event = await pricedEvent({ sections: [{ name: 'Open', entryFee: 20 }, { name: 'U1600', entryFee: 15 }] })
    const director = await oneEventDirector(event)
    const { Open, U1600 } = await sectionIds(event)
    const open = { id: Open, name: 'Open', entryFee: 20 }
    const leaveOut = async () => {
      expect((await patch(director, event, { sections: [open] })).status).toBe(200)
      expect(await sectionIds(event)).toEqual({ Open })
    }
    await leaveOut()
    for (const back of [{ id: U1600, name: 'U1600', entryFee: 25 }, { name: 'U1600', entryFee: 15.01 }, 'U1600', { id: U1600, name: 'U1600', entryFee: 15, fees: { late: 18 } }]) {
      const before = await snapshot(event)
      await expectRefused(await patch(director, event, { sections: [open, back] }), event, before, JSON.stringify(back))
    }
    for (const [back, regular] of [[{ id: U1600, name: 'U1600', entryFee: 15 }, 15], [{ name: 'U1600', entryFee: 15 }, 15], [{ id: U1600, name: 'U1600', entryFee: 0 }, 0]] as const) {
      const res = await patch(director, event, { sections: [open, back] })
      expect(res.status, JSON.stringify(back)).toBe(200)
      expect((await sectionIds(event)).U1600, JSON.stringify(back)).toBe(U1600)
      expect(await sectionPrices(event, 'U1600'), JSON.stringify(back)).toEqual({ fee_regular: regular, fee_early: null, fee_late: null })
      await leaveOut()
    }
  })

  it('a free section brought back from the archive keeps the own late price its row kept, which raises nothing; brought back with a late price above it, it is refused, and with that price cleared it passes', async () => {
    const event = await pricedEvent({ sections: [{ name: 'Open', entryFee: 20 }, { name: 'Reserve', entryFee: 0 }] })
    await setTiers(event, { sections: { Reserve: { feeLate: 12 } } })
    const { Open, Reserve } = await sectionIds(event)
    const open = { id: Open, name: 'Open', entryFee: 20 }
    expect((await patch(await seedAdmin(), event, { sections: [open] })).status).toBe(200)
    const director = await oneEventDirector(event)
    for (const back of [{ id: Reserve, name: 'Reserve', entryFee: 0, fees: { late: 15 } }, { name: 'Reserve', entryFee: 0, fees: { late: 12.01 } }]) {
      const before = await snapshot(event)
      await expectRefused(await patch(director, event, { sections: [open, back] }), event, before, JSON.stringify(back))
    }
    const kept = await patch(director, event, { sections: [open, { name: 'Reserve', entryFee: 0 }] })
    expect(kept.status).toBe(200)
    expect((await sectionIds(event)).Reserve).toBe(Reserve)
    expect(await sectionPrices(event, 'Reserve')).toEqual({ fee_regular: 0, fee_early: null, fee_late: 12 })
    const cleared = await patch(director, event, { sections: [open, { id: Reserve, name: 'Reserve', entryFee: 0, fees: { late: null } }] })
    expect(cleared.status).toBe(200)
    expect(await sectionPrices(event, 'Reserve')).toEqual({ fee_regular: 0, fee_early: null, fee_late: null })
  })

  it('an event with no live section: the event\'s fee raised passes, since no entrant pays it, and a section brought in at that fee is refused while one at $0 passes', async () => {
    const event = await pricedEvent()
    expect((await patch(await seedAdmin(), event, { sections: [] })).status).toBe(200)
    expect(await sectionIds(event)).toEqual({})
    const director = await oneEventDirector(event)
    expect((await patch(director, event, { entryFee: 40 })).status).toBe(200)
    expect((await pricingOf(event)).entry_fee).toBe(40)
    for (const section of ['Open', { name: 'Open' }, { name: 'Open', entryFee: null }, { name: 'Blitz' }]) {
      const before = await snapshot(event)
      await expectRefused(await patch(director, event, { sections: [section] }), event, before, JSON.stringify(section))
    }
    const free = await patch(director, event, { sections: [{ name: 'Open', entryFee: 0 }] })
    expect(free.status).toBe(200)
    expect(await paid(event)).toEqual({ Open: { regular: 0, early: null, late: null } })
  })

  it('a section that pays the event\'s fee, sent back as the manage answer gives it, is pinned at that fee, as WS01\'s open follow-up "Bare-name section pinned to the event fee" says, which changes no price and passes; the event\'s fee raised after it is then no raise', async () => {
    const event = await pricedEvent({ sections: [{ name: 'Open', entryFee: 20 }, { name: 'U1600', entryFee: 20 }] })
    await setTiers(event, { sections: { U1600: { feeRegular: null } } })
    const director = await oneEventDirector(event)
    const before = await paid(event)
    expect((await patch(director, event, { sections: await manageSections(director, event) })).status).toBe(200)
    expect(await paid(event)).toEqual(before)
    expect(await sectionPrices(event, 'U1600')).toEqual({ fee_regular: 20, fee_early: null, fee_late: null })
    expect((await patch(director, event, { entryFee: 30 })).status).toBe(200)
    expect(await paid(event)).toEqual(before)
  })
})

describe('the order of the checks, with CREATION_ROLES_ON set', () => {
  beforeEach(() => {
    flags.rolesOn = true
  })

  it('the membership rule answers before the fee rule: a one-event director who sends the membership switch with a raise gets the membership words, and nothing is stored', async () => {
    const event = await pricedEvent({ clubId: await seedClub() })
    const director = await oneEventDirector(event)
    const { Open } = await sectionIds(event)
    const before = await snapshot(event)
    const res = await patch(director, event, { requiresLcaMembership: true, sections: [{ id: Open, name: 'Open', entryFee: 25 }] })
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: MEMBERSHIP_WORDS })
    expect(await snapshot(event)).toEqual(before)
    expect(fees.asked).toEqual([])
  })

  it('a list with a repeated name is answered with the payout words when it also raises a price, and with the writer\'s words when it does not, nothing stored either way', async () => {
    const event = await pricedEvent()
    const director = await oneEventDirector(event)
    const { Open } = await sectionIds(event)
    const before = await snapshot(event)
    await expectRefused(await patch(director, event, { sections: [{ id: Open, name: 'Open', entryFee: 20 }, { name: 'Open', entryFee: 15 }] }), event, before)
    const res = await patch(director, event, { sections: [{ id: Open, name: 'Open', entryFee: 20 }, { name: 'Open', entryFee: 0 }] })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Two sections are named “Open”. Give each section its own name.' })
    expect(await snapshot(event)).toEqual(before)
  })

  it('a section left out that still has an entry is refused with the writer\'s words when the save raises nothing, and with the payout words when it also raises a price', async () => {
    const event = await pricedEvent({ sections: [{ name: 'Open', entryFee: 20 }, { name: 'Reserve', entryFee: 15 }] })
    await seedRegistration({ tournamentId: event, memberId: await seedMember(), section: 'Reserve' })
    const director = await oneEventDirector(event)
    const { Open } = await sectionIds(event)
    const before = await snapshot(event)
    const kept = await patch(director, event, { sections: [{ id: Open, name: 'Open', entryFee: 20 }] })
    expect(kept.status).toBe(400)
    expect(await kept.json()).toEqual({ error: '1 entry is in the Reserve section. Move it to another section first.' })
    expect(await snapshot(event)).toEqual(before)
    await expectRefused(await patch(director, event, { sections: [{ id: Open, name: 'Open', entryFee: 25 }] }), event, before)
  })

  it('an id from another event is read as a new section: above $0 it is refused with the payout words, and at $0 the writer refuses it in its own words', async () => {
    const event = await pricedEvent()
    const director = await oneEventDirector(event)
    const { Open } = await sectionIds(event)
    const foreign = (await sectionIds(await pricedEvent())).Open
    const before = await snapshot(event)
    await expectRefused(await patch(director, event, { sections: [{ id: Open, name: 'Open', entryFee: 20 }, { id: foreign, name: 'Reserve', entryFee: 20 }] }), event, before)
    const res = await patch(director, event, { sections: [{ id: Open, name: 'Open', entryFee: 20 }, { id: foreign, name: 'Reserve', entryFee: 0 }] })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'One of these sections is not part of this event. Reload the page and try again.' })
    expect(await snapshot(event)).toEqual(before)
  })
})

describe('replays, and a refused save, with CREATION_ROLES_ON set', () => {
  beforeEach(() => {
    flags.rolesOn = true
  })

  it('a lowered price sent twice passes twice, the second storing nothing new; a refused raise sent twice is refused twice; and an LCA admin\'s raise sent twice passes twice, stored once', async () => {
    const event = await pricedEvent()
    const director = await oneEventDirector(event)
    const { Open } = await sectionIds(event)
    const lower = { sections: [{ id: Open, name: 'Open', entryFee: 15 }] }
    expect((await patch(director, event, lower)).status).toBe(200)
    const once = await snapshot(event)
    expect((await patch(director, event, lower)).status).toBe(200)
    expect(await snapshot(event)).toEqual(once)
    const raise = { sections: [{ id: Open, name: 'Open', entryFee: 25 }] }
    for (const attempt of ['first', 'second']) await expectRefused(await patch(director, event, raise), event, once, attempt)
    const admin = await seedAdmin()
    expect((await patch(admin, event, raise)).status).toBe(200)
    const raised = await snapshot(event)
    expect((await patch(admin, event, raise)).status).toBe(200)
    expect(await snapshot(event)).toEqual(raised)
    expect(await sectionPrices(event, 'Open')).toEqual({ fee_regular: 25, fee_early: null, fee_late: null })
  })

  it('a refused save that would also rename and publish the event writes neither and adds nothing to the activity log; the same save without the raise publishes it, with its one entry', async () => {
    const event = await pricedEvent({ isVisible: false })
    const director = await oneEventDirector(event)
    const { Open } = await sectionIds(event)
    const before = await snapshot(event)
    const log = await auditActions(event)
    await expectRefused(await patch(director, event, { name: 'Published Open', isVisible: true, sections: [{ id: Open, name: 'Open', entryFee: 25 }] }), event, before)
    expect(await auditActions(event)).toEqual(log)
    const res = await patch(director, event, { name: 'Published Open', isVisible: true, sections: [{ id: Open, name: 'Open', entryFee: 20 }] })
    expect(res.status).toBe(200)
    expect(await env.DB.prepare('SELECT name, is_visible FROM tournaments WHERE id = ?').bind(event).first()).toEqual({ name: 'Published Open', is_visible: 1 })
    expect(await auditActions(event)).toEqual([...log, 'tournament_publish'])
  })
})

describe('D24\'s list is read from the person\'s grant, at each request, with CREATION_ROLES_ON set', () => {
  beforeEach(() => {
    flags.rolesOn = true
  })

  /** Raises Open from $20 to $25 and answers the status, the price stored when it passed. */
  async function raise(as: string, event: string): Promise<number> {
    const { Open } = await sectionIds(event)
    const res = await patch(as, event, { sections: [{ id: Open, name: 'Open', entryFee: 25 }] })
    if (res.status === 200) expect(await sectionPrices(event, 'Open')).toEqual({ fee_regular: 25, fee_early: null, fee_late: null })
    else expect(await sectionPrices(event, 'Open')).toEqual({ fee_regular: 20, fee_early: null, fee_late: null })
    return res.status
  }

  it('a standing director who directs an event an LCA admin created, by a director row, raises its fee', async () => {
    const event = await pricedEvent({ createdBy: await seedAdmin() })
    const director = await seedDirector()
    await seedTournamentDirector(event, director)
    expect(await raise(director, event)).toBe(200)
  })

  it('a club rep who directs another club\'s event by a director row raises its fee, D24\'s list reading the grant and not the event', async () => {
    const event = await pricedEvent({ clubId: await seedClub() })
    const rep = await seedMember({ role: 'club_rep', clubId: await seedClub() })
    await seedTournamentDirector(event, rep)
    expect(await raise(rep, event)).toBe(200)
  })

  it('a standing director whose role is taken away keeps their event by its director row and is refused a raise as any one-event director, and passes once the role is back', async () => {
    const director = await seedDirector()
    const event = await pricedEvent({ createdBy: director })
    await seedTournamentDirector(event, director)
    await env.DB.prepare("UPDATE members SET role = 'member' WHERE id = ?").bind(director).run()
    expect(await raise(director, event)).toBe(403)
    await env.DB.prepare("UPDATE members SET role = 'tournament_director' WHERE id = ?").bind(director).run()
    expect(await raise(director, event)).toBe(200)
  })

  it('the president whose term has ended is refused a raise on the event the president created and directs, and a new term gives it back', async () => {
    const president = await seedMember({ role: 'lca_observer' })
    await seedPresident(president)
    const event = await pricedEvent({ createdBy: president })
    await seedTournamentDirector(event, president)
    await env.DB.prepare("UPDATE board_seat_assignments SET ended_at = datetime('now') WHERE member_id = ?").bind(president).run()
    expect(await raise(president, event)).toBe(403)
    await seedPresident(president)
    expect(await raise(president, event)).toBe(200)
  })
})

describe.each(STATES)('role safety, with CREATION_ROLES_ON %s', (_state, rolesOn) => {
  beforeEach(() => {
    flags.rolesOn = rolesOn
  })

  it('a director of another event, a club rep of another club, a guest with a director row on this event and a signed-out visitor never reach the rule, and nothing is stored', async () => {
    const event = await pricedEvent({ clubId: await seedClub() })
    const otherDirector = await oneEventDirector(await pricedEvent())
    const otherRep = await seedMember({ role: 'club_rep', clubId: await seedClub() })
    const guest = await seedMember({ role: 'guest' })
    await seedTournamentDirector(event, guest)
    const { Open } = await sectionIds(event)
    const raise = { sections: [{ id: Open, name: 'Open', entryFee: 25 }] }
    const before = await snapshot(event)
    for (const [who, as] of [['a director of another event', otherDirector], ['a club rep of another club', otherRep], ['a guest', guest]] as const) {
      const res = await patch(as, event, raise)
      expect(res.status, who).toBe(403)
      expect(await res.json(), who).toEqual({ error: 'Forbidden' })
    }
    const visitor = await patch(undefined, event, raise)
    expect(visitor.status).toBe(401)
    await expectContract(visitor, errorBodySchema)
    expect(await snapshot(event)).toEqual(before)
    expect(fees.asked).toEqual([])
  })
})

describe('with CREATION_ROLES_ON unset, as today (D24, criterion 15)', () => {
  /** An event with a section of each kind: Open at its own $20, U1600 at the event's $20 and U1200 free, with a $5 discount until its deadline. */
  async function everyKind() {
    const event = await seedTournament({ entryFee: 20, sections: [{ name: 'Open', entryFee: 20 }, { name: 'U1600', entryFee: 20 }, { name: 'U1200', entryFee: 0 }] })
    await setTiers(event, { earlyDeadline: EARLY_DEADLINE, earlyDiscount: 5, sections: { U1600: { feeRegular: null } } })
    return { event, ids: await sectionIds(event) }
  }
  const all = (ids: Record<string, string>, open: Record<string, unknown> = {}, u1200: Record<string, unknown> = {}) => [
    { id: ids.Open, name: 'Open', entryFee: 20, ...open },
    { id: ids.U1600, name: 'U1600' },
    { id: ids.U1200, name: 'U1200', entryFee: 0, ...u1200 },
  ]
  const RAISES: ReadonlyArray<readonly [string, (ids: Record<string, string>) => Record<string, unknown>]> = [
    ['a section\'s fee raised', (ids) => ({ sections: all(ids, { entryFee: 25 }) })],
    ['bare names, which put the free U1200 at the event\'s fee', () => ({ sections: ['Open', 'U1600', 'U1200'] })],
    ['the event\'s fee raised where U1600 pays it', () => ({ entryFee: 30 })],
    ['a late fee with its date', () => ({ lateAfter: LATE_AFTER, lateFee: 5 })],
    ['the discount taken away', () => ({ earlyDeadline: null })],
    ['an own early price above regular', (ids) => ({ sections: all(ids, { fees: { early: 25 } }) })],
    ['a free section\'s own late price', (ids) => ({ sections: all(ids, {}, { fees: { late: 5 } }) })],
    ['a new section at $15', (ids) => ({ sections: [...all(ids), { name: 'U800', entryFee: 15 }] })],
  ]

  it.each(RAISES)('%s: refused a one-event director with the constant set, and with it unset passing and storing what an LCA admin\'s same save stores, the constant set or unset', async (_name, bodyFor) => {
    const admin = await seedAdmin()
    flags.rolesOn = true
    const refused = await everyKind()
    const before = await snapshot(refused.event)
    await expectRefused(await patch(await oneEventDirector(refused.event), refused.event, bodyFor(refused.ids)), refused.event, before)
    const untouched = await prices(refused.event)
    const stored: Array<Awaited<ReturnType<typeof prices>>> = []
    for (const [rolesOn, who] of [[false, 'a one-event director'], [false, 'an LCA admin'], [true, 'an LCA admin']] as const) {
      flags.rolesOn = rolesOn
      const { event, ids } = await everyKind()
      const as = who === 'an LCA admin' ? admin : await oneEventDirector(event)
      const res = await patch(as, event, bodyFor(ids))
      expect(res.status, `${who}, ${rolesOn ? 'set' : 'unset'}`).toBe(200)
      await expectContract(res, edit.response)
      stored.push(await prices(event))
    }
    expect(stored[0]).not.toEqual(untouched)
    expect(stored[1]).toEqual(stored[0])
    expect(stored[2]).toEqual(stored[0])
  })
})

describe('Q37 from the create on: a standing director\'s and the president\'s event stays LCA-run, its membership switch locked on', () => {
  it.each([['a standing director'], ['the president']])('%s creates an LCA-run event, then is refused a club for it and the membership switch off or on, each in today\'s words, while their own raise passes; the event keeps no club and requires LCA membership', async (who) => {
    flags.rolesOn = true
    let creator: string
    if (who === 'the president') {
      creator = await seedMember({ role: 'lca_observer' })
      await seedPresident(creator)
    } else {
      creator = await seedDirector()
    }
    const created = await invoke(createTournament, { method: 'POST', as: creator, body: { name: 'Bayou Open', location: 'Houma, LA', date: '2026-12-05', entryFee: 20 } })
    expect(created.status).toBe(201)
    const event = (await created.json<{ tournament: { id: string } }>()).tournament.id
    const club = await seedClub()
    const refusals: ReadonlyArray<readonly [Record<string, unknown>, string]> = [
      [{ clubId: club }, CLUB_WORDS],
      [{ clubId: club, requiresLcaMembership: false }, CLUB_WORDS],
      [{ requiresLcaMembership: false }, MEMBERSHIP_WORDS],
      [{ requiresLcaMembership: true }, MEMBERSHIP_WORDS],
    ]
    for (const [body, words] of refusals) {
      const before = await snapshot(event)
      const res = await patch(creator, event, body)
      expect(res.status, JSON.stringify(body)).toBe(403)
      expect(await res.json(), JSON.stringify(body)).toEqual({ error: words })
      expect(await snapshot(event)).toEqual(before)
    }
    const { Open } = await sectionIds(event)
    expect((await patch(creator, event, { sections: [{ id: Open, name: 'Open', entryFee: 30 }] })).status).toBe(200)
    expect(await env.DB.prepare('SELECT club_id, requires_lca_membership FROM tournaments WHERE id = ?').bind(event).first())
      .toEqual({ club_id: null, requires_lca_membership: 1 })
    expect(await sectionPrices(event, 'Open')).toEqual({ fee_regular: 30, fee_early: null, fee_late: null })
  })

  it('with the constant unset, a standing director who directs an LCA-run event by a director row is refused the membership switch in today\'s words, as before', async () => {
    const director = await seedDirector()
    const event = await pricedEvent({ createdBy: director })
    await seedTournamentDirector(event, director)
    const before = await snapshot(event)
    const res = await patch(director, event, { requiresLcaMembership: false })
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: MEMBERSHIP_WORDS })
    expect(await snapshot(event)).toEqual(before)
  })
})

describe('what an entrant pays, with CREATION_ROLES_ON set', () => {
  beforeEach(() => {
    flags.rolesOn = true
  })

  it('a new entry needs a live section: with every section archived, an entry and a family entry are refused, and nothing is written', async () => {
    const event = await pricedEvent()
    expect((await patch(await seedAdmin(), event, { sections: [] })).status).toBe(200)
    const player = await seedMember({ fullName: 'Dana Broussard' })
    const one = await invoke(register, { method: 'POST', as: player, body: { tournamentId: event, section: 'Open' } })
    expect(one.status).toBe(400)
    expect(await one.json()).toEqual({ error: 'Invalid section' })
    const family = await invoke(registerFamily, { method: 'POST', as: player, body: { tournamentId: event, entries: [{ section: 'Open' }] } })
    expect(family.status).toBe(400)
    expect(await family.json()).toEqual({ error: 'Choose a valid section for Dana Broussard' })
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM registrations WHERE tournament_id = ?').bind(event).first()).toEqual({ n: 0 })
  })

  it('no entrant is asked a price the rule never read: an entry on the waitlist, withdrawn, its section left out and the entry reinstated, is offered its spot after a one-event director raised the event\'s fee at no more than its section cost', async () => {
    const event = await seedTournament({ entryFee: 20, maxPlayers: 1, sections: [{ name: 'Open', entryFee: 20 }, { name: 'Reserve', entryFee: 20 }] })
    await setTiers(event, { sections: { Reserve: { feeRegular: null } } })
    const director = await oneEventDirector(event)
    const { Open } = await sectionIds(event)
    await seedRegistration({ tournamentId: event, memberId: await seedMember(), section: 'Open' })
    const waiting = await invoke(register, { method: 'POST', as: await seedMember(), body: { tournamentId: event, section: 'Reserve', waitlist: true } })
    expect(waiting.status).toBe(201)
    const registrationId = (await waiting.json<{ registration: { id: string } }>()).registration.id
    const steps: Record<string, number> = {}
    steps.withdraw = (await invoke(patchRegistration, { method: 'PATCH', as: director, params: { id: registrationId }, body: { withdrawn: true } })).status
    steps.leaveOut = (await patch(director, event, { sections: [{ id: Open, name: 'Open', entryFee: 20 }] })).status
    steps.reinstate = (await invoke(patchRegistration, { method: 'PATCH', as: director, params: { id: registrationId }, body: { withdrawn: false } })).status
    steps.raise = (await patch(director, event, { entryFee: 100 })).status
    steps.offer = (await invoke(offerSpot, { method: 'POST', as: director, params: { id: event }, body: { registrationId } })).status
    const payment = await env.DB.prepare("SELECT amount FROM payments WHERE reference_id = ? AND type = 'tournament'").bind(registrationId).first<{ amount: number }>()
    expect(payment?.amount ?? 0, `the answers: ${JSON.stringify(steps)}`).toBeLessThanOrEqual(20)
  })

  it('and with the event\'s fee raised before the entry is reinstated, while no entry is in the archived section: the raise is refused with the payout words and stores nothing, and the offer asks the section\'s $20', async () => {
    const event = await seedTournament({ entryFee: 20, maxPlayers: 1, sections: [{ name: 'Open', entryFee: 20 }, { name: 'Reserve', entryFee: 20 }] })
    await setTiers(event, { sections: { Reserve: { feeRegular: null } } })
    const director = await oneEventDirector(event)
    const { Open } = await sectionIds(event)
    await seedRegistration({ tournamentId: event, memberId: await seedMember(), section: 'Open' })
    const waiting = await invoke(register, { method: 'POST', as: await seedMember(), body: { tournamentId: event, section: 'Reserve', waitlist: true } })
    expect(waiting.status).toBe(201)
    const registrationId = (await waiting.json<{ registration: { id: string } }>()).registration.id
    expect((await invoke(patchRegistration, { method: 'PATCH', as: director, params: { id: registrationId }, body: { withdrawn: true } })).status).toBe(200)
    expect((await patch(director, event, { sections: [{ id: Open, name: 'Open', entryFee: 20 }] })).status).toBe(200)
    const before = await snapshot(event)
    await expectRefused(await patch(director, event, { entryFee: 100 }), event, before)
    expect((await invoke(patchRegistration, { method: 'PATCH', as: director, params: { id: registrationId }, body: { withdrawn: false } })).status).toBe(200)
    const offer = await invoke(offerSpot, { method: 'POST', as: director, params: { id: event }, body: { registrationId } })
    expect(offer.status).toBe(200)
    expect(await offer.json()).toEqual({ success: true, amount: 20 })
    expect(await env.DB.prepare("SELECT amount FROM payments WHERE reference_id = ? AND type = 'tournament'").bind(registrationId).first()).toEqual({ amount: 20 })
  })

  it('a price stored below $0, as an LCA admin\'s save of an event fee below $0 stores it, set to $0 by a one-event director is no fee above $0 and passes', async () => {
    const event = await pricedEvent()
    await setTiers(event, { sections: { Open: { feeRegular: null } } })
    expect((await patch(await seedAdmin(), event, { entryFee: -5 })).status).toBe(200)
    expect((await paid(event)).Open.regular).toBe(-5)
    const director = await oneEventDirector(event)
    const res = await patch(director, event, { entryFee: 0 })
    expect(res.status, JSON.stringify(await res.json())).toBe(200)
    expect((await paid(event)).Open).toEqual({ regular: 0, early: null, late: null })
  })
})

describe('savedSectionFees beside the writer, on lists drawn at random', () => {
  /** A small seeded generator, so a failing list can be drawn again. */
  function generator(seed: number) {
    let state = seed >>> 0
    const next = () => {
      state = (state + 0x6d2b79f5) >>> 0
      let t = state
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
    const pick = <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)]
    const shuffled = <T>(items: readonly T[]): T[] => {
      const out = [...items]
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        ;[out[i], out[j]] = [out[j], out[i]]
      }
      return out
    }
    return { next, pick, shuffled }
  }
  const NAMES = ['Open', 'Reserve', 'U1800', 'U1600', 'U1400', 'U1200', 'U1000', 'Blitz', 'Scholastic', 'K to 3']
  /** The names archived rows take: one always live, one sometimes, and one never, given twice so two rows often share it. */
  const ARCHIVED_NAMES = ['Reserve', 'U1800', 'Blitz', 'Blitz']
  const FEES: ReadonlyArray<unknown> = [undefined, null, 0, 10, 25, 32.5, '15']
  const OWN = [null, null, 12, 18, 30]

  it('for every list, the prices it answers before the save are what entrants pay in every row the writer leaves, live and archived, and each element becomes the row it was matched to, or a new one', async () => {
    const admin = await seedAdmin()
    /** How many lists took each path, so the draw is known to reach them all. */
    const reached = { renamed: 0, broughtBack: 0, added: 0, leftOut: 0, eventFee: 0, echoedFees: 0, nameAmongArchived: 0, nameBeforeId: 0 }
    for (let seed = 1; seed <= 50; seed++) {
      const { next, pick, shuffled } = generator(seed)
      const live = NAMES.slice(0, 2 + Math.floor(next() * 3))
      const event = await seedTournament({ entryFee: pick([0, 20, 25]), sections: live.map((name) => ({ name, entryFee: pick([0, 15, 20, 25]) })) })
      await setTiers(event, {
        earlyDeadline: next() < 0.5 ? EARLY_DEADLINE : null, earlyDiscount: pick([0, 5]),
        lateAfter: next() < 0.5 ? LATE_AFTER : null, lateFee: pick([0, 10]),
        sections: Object.fromEntries(live.map((name) => [name, { feeRegular: pick([null, 0, 15, 20]), feeEarly: pick(OWN), feeLate: pick(OWN) }])),
      })
      // Archived rows a minute apart, some named like a live section, some not, and often two of one name.
      const archivedRows = Math.floor(next() * 4)
      for (let i = 0; i < archivedRows; i++) {
        await env.DB.prepare(
          `INSERT INTO tournament_sections (id, tournament_id, position, name, fee_regular, fee_early, fee_late, archived_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, datetime('2026-08-01 18:00:00', ?))`,
        ).bind(`arch-${seed}-${i}`, event, i, pick(ARCHIVED_NAMES), pick([null, 0, 15]), pick(OWN), pick(OWN), `+${i} minutes`).run()
      }
      const stored = await loadSections(getDb(env.DB), event, { includeArchived: true })
      // A list the writer takes: each row named once at most by its id, every name once.
      const names = new Set<string>()
      const list: SectionListItem[] = []
      const fresh = () => {
        const name = `${pick(NAMES)} ${Math.floor(next() * 100)}`
        return names.has(name) ? null : name
      }
      for (const row of shuffled(stored)) {
        const roll = next()
        if (roll < 0.25) continue
        const entryFee = pick(FEES)
        const fees = pick([undefined, undefined, { regular: 20, early: 1, late: 99 }, { early: pick(OWN) }, { late: pick(OWN) }, { early: null, late: pick(OWN) }])
        if (roll < 0.6) {
          const name = next() < 0.3 ? fresh() : row.name
          if (name === null || names.has(name)) continue
          names.add(name)
          list.push({ id: row.id, name, ...(entryFee === undefined ? {} : { entryFee }), ...(fees ? { fees } : {}) })
        } else if (!names.has(row.name)) {
          names.add(row.name)
          list.push(next() < 0.3 ? row.name : { name: row.name, ...(entryFee === undefined ? {} : { entryFee }), ...(fees ? { fees } : {}) })
        }
      }
      const added = Math.floor(next() * 3)
      for (let i = 0; i < added; i++) {
        const name = next() < 0.5 ? pick([...ARCHIVED_NAMES, ...NAMES]) : fresh()
        if (name === null || names.has(name)) continue
        names.add(name)
        const entryFee = pick(FEES)
        list.splice(Math.floor(next() * (list.length + 1)), 0, { name, ...(entryFee === undefined ? {} : { entryFee }), ...(next() < 0.4 ? { fees: { late: pick(OWN) } } : {}) })
      }
      // Often a name sent ahead of the element that renames, by its id, the live row of that name: ids are matched first.
      const renamed = list.filter((item): item is Exclude<SectionListItem, string> => typeof item !== 'string' && item.id !== undefined)
        .map((item) => stored.find((row) => row.id === item.id && row.archivedAt === null && row.name !== item.name))
        .filter((row): row is NonNullable<typeof row> => row !== undefined && !names.has(row.name))
      if (renamed.length > 0 && next() < 0.7) {
        const name = pick(renamed).name
        names.add(name)
        list.unshift(next() < 0.5 ? name : { name, entryFee: pick(FEES) })
      }
      const change = pick([{}, { entryFee: 30 }, { earlyDeadline: EARLY_DEADLINE, earlyDiscount: 3 }, { lateAfter: null }, { lateFee: 7 }])
      const res = await patch(admin, event, { ...change, sections: list })
      expect(res.status, `seed ${seed}: ${JSON.stringify(await res.json())}`).toBe(200)
      const pricing = await pricingOf(event)
      const rows = await loadSections(getDb(env.DB), event, { includeArchived: true })
      const after = rows.filter((row) => row.archivedAt === null)
      const modelled = savedSectionFees(stored, list, pricing)
      // The list's elements first, the live rows the writer leaves, then every row the list does not take, archived after the save.
      const sent = modelled.slice(0, list.length)
      expect(sent.map((entry) => entry.fees), `seed ${seed}`).toEqual(after.map((row) => tierFees(row, pricing)))
      const known = new Set(stored.map((row) => row.id))
      expect(sent.map((entry) => (entry.key.startsWith('new:') ? 'new' : entry.key)), `seed ${seed}`)
        .toEqual(after.map((row) => (known.has(row.id) ? row.id : 'new')))
      expect(modelled.length, `seed ${seed}`).toBe(rows.length)
      expect(Object.fromEntries(modelled.slice(list.length).map((entry) => [entry.key, entry.fees])), `seed ${seed}`)
        .toEqual(Object.fromEntries(rows.filter((row) => row.archivedAt !== null).map((row) => [row.id, tierFees(row, pricing)])))
      const byId = new Map(stored.map((row) => [row.id, row]))
      const kept = new Set(after.map((row) => row.id))
      if (after.some((row) => byId.has(row.id) && byId.get(row.id)!.name !== row.name)) reached.renamed++
      if (after.some((row) => byId.get(row.id)?.archivedAt != null)) reached.broughtBack++
      if (after.some((row) => !byId.has(row.id))) reached.added++
      if (stored.some((row) => row.archivedAt === null && !kept.has(row.id))) reached.leftOut++
      if (after.some((row) => row.feeRegular === null)) reached.eventFee++
      if (list.some((item) => typeof item !== 'string' && item.fees?.regular !== undefined)) reached.echoedFees++
      // A name sent without an id where two archived rows share it, so the writer's choice of the latest is read.
      const archivedNames = stored.filter((row) => row.archivedAt !== null).map((row) => row.name)
      if (list.some((item) => {
        const name = typeof item === 'string' ? item : item.id === undefined ? item.name : null
        return name !== null && archivedNames.filter((n) => n === name).length >= 2
      })) reached.nameAmongArchived++
      const idAt = new Map(list.flatMap((item, i) => (typeof item !== 'string' && item.id !== undefined ? [[byId.get(item.id)?.name, i] as const] : [])))
      if (list.some((item, i) => {
        const name = typeof item === 'string' ? item : item.id === undefined ? item.name : null
        return name !== null && (idAt.get(name) ?? -1) > i
      })) reached.nameBeforeId++
    }
    for (const [path, lists] of Object.entries(reached)) expect(lists, path).toBeGreaterThanOrEqual(3)
  })
})
