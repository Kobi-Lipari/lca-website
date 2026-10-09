// test/integration/registration-section-reads.test.ts
// The player endpoints read sections and prices from the tournament_sections
// table and the live tournament columns, never from the legacy JSON. Each
// test changes the table (or the tournament columns) behind the JSON's back,
// so an answer that follows the change can only have come from the table.
// Triggers stay installed here, as in production.
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { onRequestPost as registerPost } from '../../functions/api/registrations'
import { onRequestPost as batchPost } from '../../functions/api/registrations/batch'
import { onRequestPatch as registrationPatch } from '../../functions/api/registrations/[id]'
import { seedAdmin, seedMember, seedRegistration, seedTournament } from './factories'
import { invoke, resetHarness, stripeSessions } from './harness'

beforeEach(resetHarness)

const setSection = (tournamentId: string, name: string, set: string, ...binds: unknown[]) =>
  env.DB.prepare(`UPDATE tournament_sections SET ${set} WHERE tournament_id = ? AND name = ? AND archived_at IS NULL`)
    .bind(...binds, tournamentId, name).run()

const setTournament = (tournamentId: string, set: string, ...binds: unknown[]) =>
  env.DB.prepare(`UPDATE tournaments SET ${set} WHERE id = ?`).bind(...binds, tournamentId).run()

const jsonOf = async (tournamentId: string) =>
  (await env.DB.prepare('SELECT sections FROM tournaments WHERE id = ?').bind(tournamentId).first<{ sections: string }>())?.sections

const regCount = async (tournamentId: string) =>
  (await env.DB.prepare('SELECT COUNT(*) AS n FROM registrations WHERE tournament_id = ?').bind(tournamentId).first<{ n: number }>())?.n

interface Entered { payment: { id: string; amount: number; status: string }; registration: { payment_status: string }; paymentUrl: string | null }

describe('single entry reads the section row', () => {
  it('charges the fee on the row, not the one in the JSON', async () => {
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 25 }] })
    const before = await jsonOf(tournamentId)
    await setSection(tournamentId, 'Open', 'fee_regular = ?', 40)
    expect(await jsonOf(tournamentId)).toBe(before)
    const res = await invoke(registerPost, { method: 'POST', as: await seedMember(), body: { tournamentId, section: 'Open' } })
    expect(res.status).toBe(201)
    expect((await res.json<Entered>()).payment.amount).toBe(40)
    expect(stripeSessions.at(-1)?.amountCents).toBe(4000)
  })

  it('uses the event fee for a section whose row has no fee of its own', async () => {
    const tournamentId = await seedTournament({ entryFee: 18, sections: [{ name: 'Open', entryFee: 25 }] })
    await setSection(tournamentId, 'Open', 'fee_regular = NULL')
    const res = await invoke(registerPost, { method: 'POST', as: await seedMember(), body: { tournamentId, section: 'Open' } })
    expect((await res.json<Entered>()).payment.amount).toBe(18)
  })

  it('does not offer a section the JSON lists but the table does not', async () => {
    const tournamentId = await seedTournament()
    await env.DB.prepare(`DELETE FROM tournament_sections WHERE tournament_id = ? AND name = 'U1200'`).bind(tournamentId).run()
    expect(await jsonOf(tournamentId)).toContain('U1200')
    const member = await seedMember()
    const res = await invoke(registerPost, { method: 'POST', as: member, body: { tournamentId, section: 'U1200' } })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Invalid section' })
    expect(await regCount(tournamentId)).toBe(0)
  })

  it('offers a section the table has and the JSON does not', async () => {
    const tournamentId = await seedTournament()
    await env.DB.prepare(`INSERT INTO tournament_sections (id, tournament_id, position, name, fee_regular) VALUES ('only-in-table', ?, 5, 'Scholastic', 7)`)
      .bind(tournamentId).run()
    expect(await jsonOf(tournamentId)).not.toContain('Scholastic')
    const res = await invoke(registerPost, { method: 'POST', as: await seedMember(), body: { tournamentId, section: 'Scholastic' } })
    expect(res.status).toBe(201)
    expect((await res.json<Entered>()).payment.amount).toBe(7)
    expect((await env.DB.prepare('SELECT section_id FROM registrations WHERE tournament_id = ?').bind(tournamentId).first())).toEqual({ section_id: 'only-in-table' })
  })

  it('applies the rating rule on the row', async () => {
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 0 }] })
    await setSection(tournamentId, 'Open', 'rules_set = 1, rating_min = ?', 1500)
    const low = await seedMember({ uscfRating: 1200 })
    const refused = await invoke(registerPost, { method: 'POST', as: low, body: { tournamentId, section: 'Open' } })
    expect(refused.status).toBe(400)
    expect((await refused.json<{ error: string }>()).error).toMatch(/1500 and up/)
    expect(await regCount(tournamentId)).toBe(0)
    const ok = await invoke(registerPost, { method: 'POST', as: await seedMember({ uscfRating: 1600 }), body: { tournamentId, section: 'Open' } })
    expect(ok.status).toBe(201)
  })
})

describe('prices follow the live tournament columns', () => {
  it('overlap: early and late tiers both open, with a member discount, charges the sum', async () => {
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 40 }] })
    await setTournament(tournamentId,
      `early_deadline = '2099-01-01', early_discount = 5, member_discount = 3, late_after = '2020-01-01T00:00', late_fee = 12.5`)
    const member = await invoke(registerPost, { method: 'POST', as: await seedMember({ membershipStatus: 'active' }), body: { tournamentId, section: 'Open' } })
    expect((await member.json<Entered>()).payment.amount).toBe(44.5)
    expect(stripeSessions.at(-1)?.amountCents).toBe(4450)
    const guest = await invoke(registerPost, { method: 'POST', as: await seedMember({ membershipStatus: 'expired' }), body: { tournamentId, section: 'Open' } })
    expect((await guest.json<Entered>()).payment.amount).toBe(47.5)
  })

  it('a changed column changes the next price at once', async () => {
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 30 }] })
    const first = await invoke(registerPost, { method: 'POST', as: await seedMember(), body: { tournamentId, section: 'Open' } })
    expect((await first.json<Entered>()).payment.amount).toBe(30)
    await setTournament(tournamentId, `late_after = '2020-01-01T00:00', late_fee = 6`)
    const second = await invoke(registerPost, { method: 'POST', as: await seedMember(), body: { tournamentId, section: 'Open' } })
    expect((await second.json<Entered>()).payment.amount).toBe(36)
    await setTournament(tournamentId, `late_fee = 0`)
    const third = await invoke(registerPost, { method: 'POST', as: await seedMember(), body: { tournamentId, section: 'Open' } })
    expect((await third.json<Entered>()).payment.amount).toBe(30)
  })

  it('discounts that reach past the fee make the entry free: no checkout, a completed payment, paid at once', async () => {
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 10 }] })
    await setTournament(tournamentId, `early_deadline = '2099-01-01', early_discount = 8, member_discount = 8`)
    const sessionsBefore = stripeSessions.length
    const res = await invoke(registerPost, { method: 'POST', as: await seedMember({ membershipStatus: 'active' }), body: { tournamentId, section: 'Open' } })
    expect(res.status).toBe(201)
    const body = await res.json<Entered>()
    expect(body.payment).toMatchObject({ amount: 0, status: 'completed' })
    expect(body.registration.payment_status).toBe('paid')
    expect(body.paymentUrl).toBeNull()
    expect(stripeSessions).toHaveLength(sessionsBefore)
  })

  it("a section's own early and late price on the row replaces the worked-out line", async () => {
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 40 }] })
    await setSection(tournamentId, 'Open', 'fee_early = 32, fee_late = 55')
    await setTournament(tournamentId, `early_deadline = '2099-01-01'`)
    const earlyEntry = await invoke(registerPost, { method: 'POST', as: await seedMember(), body: { tournamentId, section: 'Open' } })
    expect((await earlyEntry.json<Entered>()).payment.amount).toBe(32)
    await setTournament(tournamentId, `early_deadline = NULL, late_after = '2020-01-01T00:00'`)
    const lateEntry = await invoke(registerPost, { method: 'POST', as: await seedMember(), body: { tournamentId, section: 'Open' } })
    expect((await lateEntry.json<Entered>()).payment.amount).toBe(55)
  })

  it('an early deadline that has passed gives no discount', async () => {
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 30 }] })
    await setTournament(tournamentId, `early_deadline = '2020-01-01', early_discount = 10`)
    const res = await invoke(registerPost, { method: 'POST', as: await seedMember(), body: { tournamentId, section: 'Open' } })
    expect((await res.json<Entered>()).payment.amount).toBe(30)
  })
})

describe('family entry reads the section rows once and prices each player', () => {
  async function household() {
    const parent = await seedMember({ membershipStatus: 'active' })
    const child = await seedMember({ membershipStatus: 'expired', uscfRating: 900 })
    await env.DB.prepare('UPDATE members SET guardian_id = ? WHERE id = ?').bind(parent, child).run()
    return { parent, child }
  }

  it('takes each fee from the rows and the member discount only for the member', async () => {
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 25 }, { name: 'Reserve', entryFee: 15 }] })
    await setSection(tournamentId, 'Reserve', 'fee_regular = 20')
    await setTournament(tournamentId, `member_discount = 5, early_deadline = '2099-01-01', early_discount = 2`)
    const { parent, child } = await household()
    const res = await invoke(batchPost, {
      method: 'POST', as: parent, body: { tournamentId, entries: [{ section: 'Open' }, { memberId: child, section: 'Reserve' }] },
    })
    expect(res.status).toBe(201)
    const body = await res.json<{ registrations: Array<{ memberId: string; amount: number }>; total: number }>()
    // Parent: 25 - 2 - 5. Child (not an active member): 20 - 2.
    expect(body.registrations.map((r) => [r.memberId, r.amount])).toEqual([[parent, 18], [child, 18]])
    expect(body.total).toBe(36)
    expect(stripeSessions.at(-1)?.lineItems.map((l) => l.amountCents)).toEqual([1800, 1800])
  })

  it('refuses a section that is only in the JSON, and writes nothing for anyone', async () => {
    const tournamentId = await seedTournament()
    await env.DB.prepare(`DELETE FROM tournament_sections WHERE tournament_id = ? AND name = 'U1200'`).bind(tournamentId).run()
    const { parent, child } = await household()
    const res = await invoke(batchPost, {
      method: 'POST', as: parent, body: { tournamentId, entries: [{ section: 'Open' }, { memberId: child, section: 'U1200' }] },
    })
    expect(res.status).toBe(400)
    expect(Object.keys(await res.json())).toEqual(['error'])
    expect(await regCount(tournamentId)).toBe(0)
    expect(stripeSessions).toHaveLength(0)
  })

  it('applies the row rules to each player and names the player', async () => {
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 0 }] })
    await setSection(tournamentId, 'Open', 'rules_set = 1, rating_max = 1000')
    const { parent, child } = await household()
    await env.DB.prepare('UPDATE members SET uscf_rating = 1800 WHERE id = ?').bind(parent).run()
    const res = await invoke(batchPost, {
      method: 'POST', as: parent, body: { tournamentId, entries: [{ memberId: child, section: 'Open' }, { section: 'Open' }] },
    })
    expect(res.status).toBe(400)
    expect((await res.json<{ error: string }>()).error).toMatch(/^Member .*: Open is for players rated under 1001/)
    expect(await regCount(tournamentId)).toBe(0)
  })

  it('more than nine players is 400 with { error } and nothing is written', async () => {
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 0 }] })
    const parent = await seedMember()
    const entries: Array<{ memberId?: string; section: string }> = [{ section: 'Open' }]
    for (let i = 0; i < 9; i++) {
      const kid = await seedMember()
      await env.DB.prepare('UPDATE members SET guardian_id = ? WHERE id = ?').bind(parent, kid).run()
      entries.push({ memberId: kid, section: 'Open' })
    }
    const res = await invoke(batchPost, { method: 'POST', as: parent, body: { tournamentId, entries } })
    expect(res.status).toBe(400)
    expect(Object.keys(await res.json())).toEqual(['error'])
    expect(await regCount(tournamentId)).toBe(0)
  })
})

describe('moving an entry reads the section rows', () => {
  async function pendingEntry(tournamentId: string, memberId: string, section: string, amount: number) {
    const reg = await seedRegistration({ tournamentId, memberId, section, paymentStatus: 'pending' })
    await env.DB.prepare(`INSERT INTO payments (id, member_id, amount, type, reference_id, status) VALUES (?, ?, ?, 'tournament', ?, 'pending')`)
      .bind(`pay-${reg}`, memberId, amount, reg).run()
    return reg
  }
  const amountOf = async (reg: string) =>
    (await env.DB.prepare('SELECT amount FROM payments WHERE id = ?').bind(`pay-${reg}`).first<{ amount: number }>())?.amount

  it('reprices a pending payment from the rows, not from the JSON', async () => {
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 25 }, { name: 'Reserve', entryFee: 15 }] })
    await setSection(tournamentId, 'Open', 'fee_regular = 30')
    await setSection(tournamentId, 'Reserve', 'fee_regular = 12')
    const player = await seedMember()
    const reg = await pendingEntry(tournamentId, player, 'Open', 30)
    const res = await invoke(registrationPatch, { method: 'PATCH', as: await seedAdmin(), params: { id: reg }, body: { section: 'Reserve' } })
    expect(res.status).toBe(200)
    expect((await res.json<{ feeNote: string | null }>()).feeNote).toBeNull()
    expect(await amountOf(reg)).toBe(12)
  })

  it('leaves the payment alone when the two sections cost the same', async () => {
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 20 }, { name: 'Reserve', entryFee: 20 }] })
    const reg = await pendingEntry(tournamentId, await seedMember(), 'Open', 17)
    const res = await invoke(registrationPatch, { method: 'PATCH', as: await seedAdmin(), params: { id: reg }, body: { section: 'Reserve' } })
    expect(res.status).toBe(200)
    expect(await amountOf(reg)).toBe(17)
  })

  it('refuses a section that is only in the JSON', async () => {
    const tournamentId = await seedTournament()
    await env.DB.prepare(`DELETE FROM tournament_sections WHERE tournament_id = ? AND name = 'U1200'`).bind(tournamentId).run()
    const reg = await pendingEntry(tournamentId, await seedMember(), 'Open', 25)
    const res = await invoke(registrationPatch, { method: 'PATCH', as: await seedAdmin(), params: { id: reg }, body: { section: 'U1200' } })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Invalid section' })
    expect(await amountOf(reg)).toBe(25)
  })

  it('an entry in a section that was archived since can still change byes, and moves out at the archived fee', async () => {
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 25 }, { name: 'Reserve', entryFee: 15 }] })
    const player = await seedMember()
    const reg = await pendingEntry(tournamentId, player, 'Open', 25)
    await setSection(tournamentId, 'Open', 'fee_regular = 40')
    await env.DB.prepare(`UPDATE payments SET amount = 40 WHERE id = ?`).bind(`pay-${reg}`).run()
    await env.DB.prepare(`UPDATE tournament_sections SET archived_at = datetime('now') WHERE tournament_id = ? AND name = 'Open'`).bind(tournamentId).run()

    const byes = await invoke(registrationPatch, { method: 'PATCH', as: player, params: { id: reg }, body: { byeRounds: [2] } })
    expect(byes.status).toBe(200)
    expect(await byes.json()).toMatchObject({ registration: { section: 'Open', bye_rounds: [2] } })

    const move = await invoke(registrationPatch, { method: 'PATCH', as: player, params: { id: reg }, body: { section: 'Reserve' } })
    expect(move.status).toBe(200)
    expect(await amountOf(reg)).toBe(15)
  })

  it('an entry with no section_id yet is moved by name and ends with the new id', async () => {
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 25 }, { name: 'Reserve', entryFee: 15 }] })
    const reg = await pendingEntry(tournamentId, await seedMember(), 'Open', 25)
    await env.DB.prepare('UPDATE registrations SET section_id = NULL WHERE id = ?').bind(reg).run()
    const res = await invoke(registrationPatch, { method: 'PATCH', as: await seedAdmin(), params: { id: reg }, body: { section: 'Reserve' } })
    expect(res.status).toBe(200)
    const row = await env.DB.prepare(
      `SELECT r.section, r.section_id, s.name FROM registrations r JOIN tournament_sections s ON s.id = r.section_id WHERE r.id = ?`,
    ).bind(reg).first<{ section: string; section_id: string; name: string }>()
    expect(row).toMatchObject({ section: 'Reserve', name: 'Reserve' })
    expect(await amountOf(reg)).toBe(15)
  })

  it('asking for the section the entry is already in changes nothing', async () => {
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 25 }, { name: 'Reserve', entryFee: 15 }] })
    const reg = await pendingEntry(tournamentId, await seedMember(), 'Open', 25)
    const before = await env.DB.prepare('SELECT * FROM registrations WHERE id = ?').bind(reg).first()
    const res = await invoke(registrationPatch, { method: 'PATCH', as: await seedAdmin(), params: { id: reg }, body: { section: 'Open' } })
    expect(res.status).toBe(200)
    expect(await env.DB.prepare('SELECT * FROM registrations WHERE id = ?').bind(reg).first()).toEqual(before)
    expect(await amountOf(reg)).toBe(25)
  })
})
