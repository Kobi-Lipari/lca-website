// test/integration/pricing-no-member-discount.test.ts
// There is no member price (decision D11). A player with an active LCA
// membership and one without, entering the same section at the same moment,
// are charged the same, in every tier (early, regular, late, and a section's
// own early or late price), through every path that charges an entry: the
// single entry, the family entry and a waitlist offer. Each event has a
// member_discount set in its row, which nothing reads any more. The admin
// create and edit still accept memberDiscount, so the current setup form
// keeps working, and drop it. Every answer carrying a tournament says
// member_discount 0 whatever the column holds, so a tab still running the
// earlier site code (which took it off the price) shows what Stripe charges.
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { onRequestPost as registerPost } from '../../functions/api/registrations'
import { onRequestPost as batchPost } from '../../functions/api/registrations/batch'
import { onRequestPost as waitlistPost } from '../../functions/api/admin/tournaments/[id]/waitlist'
import { onRequestPost as createTournament } from '../../functions/api/admin/tournaments'
import { onRequestPatch as patchTournament } from '../../functions/api/admin/tournaments/[id]'
import { onRequestGet as manageGet } from '../../functions/api/admin/tournaments/[id]/manage'
import { onRequestGet as detailGet } from '../../functions/api/tournaments/[id]'
import { onRequestGet as listGet } from '../../functions/api/tournaments'
import { contracts } from '../../domain/contracts'
import { seedAdmin, seedMember, seedRegistration, seedTournament } from './factories'
import { expectContract, invoke, resetHarness, stripeSessions } from './harness'

beforeEach(resetHarness)

interface Tier {
  label: string
  /** Columns set on the tournament row, member_discount always among them. */
  columns: string
  /** Columns set on the Open section's row, for a section's own tier price. */
  own?: string
  charged: number
}

// Open is $25. Every event also holds member_discount = 7, which must change nothing.
const TIERS: Tier[] = [
  { label: 'regular', columns: 'member_discount = 7', charged: 25 },
  { label: 'early', columns: `member_discount = 7, early_deadline = '2099-01-01', early_discount = 5`, charged: 20 },
  { label: 'late', columns: `member_discount = 7, late_after = '2020-01-01T00:00', late_fee = 10`, charged: 35 },
  { label: 'early and late at once', columns: `member_discount = 7, early_deadline = '2099-01-01', early_discount = 5, late_after = '2020-01-01T00:00', late_fee = 10`, charged: 30 },
  { label: "the section's own early price", columns: `member_discount = 7, early_deadline = '2099-01-01', early_discount = 5`, own: 'fee_early = 18', charged: 18 },
  { label: "the section's own late price", columns: `member_discount = 7, late_after = '2020-01-01T00:00', late_fee = 10`, own: 'fee_late = 40', charged: 40 },
  { label: 'a member discount as large as the fee', columns: 'member_discount = 25', charged: 25 },
]

async function eventAt(tier: Tier): Promise<string> {
  const tournamentId = await seedTournament({ entryFee: 25, sections: [{ name: 'Open', entryFee: 25 }, { name: 'Reserve', entryFee: 15 }] })
  await env.DB.prepare(`UPDATE tournaments SET ${tier.columns} WHERE id = ?`).bind(tournamentId).run()
  if (tier.own) {
    await env.DB.prepare(`UPDATE tournament_sections SET ${tier.own} WHERE tournament_id = ? AND name = 'Open'`).bind(tournamentId).run()
  }
  return tournamentId
}

describe('a member and a non-member pay the same', () => {
  it.each(TIERS)('single entry, $label', async (tier) => {
    const tournamentId = await eventAt(tier)
    const charged: number[] = []
    const cents: Array<number | undefined> = []
    for (const membershipStatus of ['active', 'pending', 'expired']) {
      const res = await invoke(registerPost, { method: 'POST', as: await seedMember({ membershipStatus }), body: { tournamentId, section: 'Open' } })
      expect(res.status, membershipStatus).toBe(201)
      charged.push((await res.json<{ payment: { amount: number } }>()).payment.amount)
      cents.push(stripeSessions.at(-1)?.lineItems[0].amountCents)
    }
    expect(charged).toEqual([tier.charged, tier.charged, tier.charged])
    expect(cents).toEqual([tier.charged * 100, tier.charged * 100, tier.charged * 100])
  })

  it.each(TIERS)('family entry, $label: the parent who is a member and the child who is not', async (tier) => {
    const tournamentId = await eventAt(tier)
    const parent = await seedMember({ membershipStatus: 'active' })
    const child = await seedMember({ membershipStatus: 'pending' })
    await env.DB.prepare('UPDATE members SET guardian_id = ? WHERE id = ?').bind(parent, child).run()
    const res = await invoke(batchPost, {
      method: 'POST', as: parent, body: { tournamentId, entries: [{ section: 'Open' }, { memberId: child, section: 'Open' }] },
    })
    expect(res.status).toBe(201)
    const body = await res.json<{ registrations: Array<{ memberId: string; amount: number }>; total: number }>()
    expect(body.registrations.map((r) => [r.memberId, r.amount])).toEqual([[parent, tier.charged], [child, tier.charged]])
    expect(body.total).toBe(tier.charged * 2)
    expect(stripeSessions.at(-1)?.lineItems.map((l) => l.amountCents)).toEqual([tier.charged * 100, tier.charged * 100])
  })

  it.each(TIERS)('waitlist offer, $label', async (tier) => {
    const tournamentId = await eventAt(tier)
    const admin = await seedAdmin()
    const offered: number[] = []
    for (const membershipStatus of ['active', 'pending']) {
      const memberId = await seedMember({ membershipStatus })
      const reg = await seedRegistration({ tournamentId, memberId, section: 'Open', paymentStatus: 'pending' })
      await env.DB.prepare(`UPDATE registrations SET waitlisted_at = datetime('now') WHERE id = ?`).bind(reg).run()
      const res = await invoke(waitlistPost, { method: 'POST', as: admin, params: { id: tournamentId }, body: { registrationId: reg } })
      expect(res.status, membershipStatus).toBe(200)
      offered.push((await res.json<{ amount: number }>()).amount)
      expect(await env.DB.prepare('SELECT amount FROM payments WHERE id = ?').bind(`pay-${reg}`).first(), membershipStatus)
        .toEqual({ amount: tier.charged })
    }
    expect(offered).toEqual([tier.charged, tier.charged])
  })
})

describe('memberDiscount is accepted and dropped by the admin create and edit', () => {
  const memberDiscountOf = async (tournamentId: string) =>
    (await env.DB.prepare('SELECT member_discount FROM tournaments WHERE id = ?').bind(tournamentId).first<{ member_discount: number }>())?.member_discount

  it('an edit that sends it, as the setup form did, saves the rest and leaves member_discount alone', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ entryFee: 25, sections: [{ name: 'Open', entryFee: 25 }] })
    await env.DB.prepare('UPDATE tournaments SET member_discount = 3 WHERE id = ?').bind(tournamentId).run()
    const res = await invoke(patchTournament, {
      method: 'PATCH', as: admin, params: { id: tournamentId }, body: { memberDiscount: 9, earlyDeadline: '2099-01-01T00:00', earlyDiscount: 4 },
    })
    expect(res.status).toBe(200)
    const { tournament } = await expectContract(res, contracts['admin/tournaments/[id]'].PATCH.response)
    expect(tournament.early_discount).toBe(4)
    // Stored as it was, answered as 0.
    expect(tournament.member_discount).toBe(0)
    expect(await memberDiscountOf(tournamentId)).toBe(3)

    const entry = await invoke(registerPost, { method: 'POST', as: await seedMember({ membershipStatus: 'active' }), body: { tournamentId, section: 'Open' } })
    expect((await entry.json<{ payment: { amount: number } }>()).payment.amount).toBe(21)
  })

  it('a create that sends it is taken, and member_discount stays at its default of 0', async () => {
    const admin = await seedAdmin()
    const res = await invoke(createTournament, {
      method: 'POST', as: admin, body: { name: 'No Member Price Open', location: 'Kenner, LA', date: '2026-10-24', entryFee: 25, memberDiscount: 5 },
    })
    expect(res.status).toBe(201)
    const { tournament } = await expectContract(res, contracts['admin/tournaments'].POST.response)
    expect(tournament.member_discount).toBe(0)
    expect(await memberDiscountOf(tournament.id)).toBe(0)
  })
})

describe('an event stored with a member_discount answers 0', () => {
  async function storedWithDiscount(): Promise<string> {
    const tournamentId = await seedTournament({ entryFee: 25, sections: [{ name: 'Open', entryFee: 25 }] })
    await env.DB.prepare('UPDATE tournaments SET member_discount = 5 WHERE id = ?').bind(tournamentId).run()
    return tournamentId
  }
  const stored = async (tournamentId: string) =>
    (await env.DB.prepare('SELECT member_discount FROM tournaments WHERE id = ?').bind(tournamentId).first<{ member_discount: number }>())?.member_discount

  it('on the public detail, signed out and signed in, within the contract', async () => {
    const tournamentId = await storedWithDiscount()
    for (const as of [undefined, await seedMember({ membershipStatus: 'active' })]) {
      const res = await invoke(detailGet, { as, params: { id: tournamentId } })
      expect(res.status).toBe(200)
      const { tournament } = await expectContract(res, contracts['tournaments/[id]'].GET.response)
      expect(tournament.member_discount).toBe(0)
      expect(tournament.entry_fee).toBe(25)
    }
    expect(await stored(tournamentId)).toBe(5)
  })

  it('on the public list, within the contract', async () => {
    const tournamentId = await storedWithDiscount()
    const res = await invoke(listGet, {})
    expect(res.status).toBe(200)
    const { tournaments } = await expectContract(res, contracts.tournaments.GET.response)
    expect(tournaments.find((t) => t.id === tournamentId)?.member_discount).toBe(0)
    expect(await stored(tournamentId)).toBe(5)
  })

  it('on the manage answer the setup page reads', async () => {
    const tournamentId = await storedWithDiscount()
    const res = await invoke(manageGet, { as: await seedAdmin(), params: { id: tournamentId } })
    expect(res.status).toBe(200)
    const { tournament } = await expectContract(res, contracts['admin/tournaments/[id]/manage'].GET.response)
    expect(tournament.member_discount).toBe(0)
    expect(await stored(tournamentId)).toBe(5)
  })
})
