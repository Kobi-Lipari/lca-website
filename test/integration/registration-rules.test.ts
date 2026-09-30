// test/integration/registration-rules.test.ts
// Section entry rules, entry pricing, the waitlist and self-withdrawal,
// through the real endpoints.
import { beforeEach, describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import { emailOutbox, invoke, resetHarness, stripeSessions } from './harness'
import { seedAdmin, seedMember, seedRegistration, seedTournament } from './factories'

import { onRequestPost as registrationsPost } from '../../functions/api/registrations'
import { onRequestPatch as registrationPatch } from '../../functions/api/registrations/[id]'
import { onRequestPost as batchPost } from '../../functions/api/registrations/batch'
import { onRequestPost as waitlistPost } from '../../functions/api/admin/tournaments/[id]/waitlist'
import { onRequestPost as generatePost } from '../../functions/api/admin/tournaments/[id]/generate-pairings'
import { onRequestGet as publicGet } from '../../functions/api/tournaments/[id]'

beforeEach(resetHarness)

const register = (as: string, body: Record<string, unknown>) =>
  invoke(registrationsPost, { method: 'POST', as, body })

describe('section entry rules', () => {
  it('keeps a player out of a rating section they are too strong for, and lets others in', async () => {
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 0 }, { name: 'U1200', entryFee: 0 }] })
    const strong = await seedMember({ uscfRating: 1500 })
    const blocked = await register(strong, { tournamentId, section: 'U1200' })
    expect(blocked.status).toBe(400)
    expect((await blocked.json<{ error: string }>()).error).toMatch(/under 1200/)

    const fits = await seedMember({ uscfRating: 1100 })
    expect((await register(fits, { tournamentId, section: 'U1200' })).status).toBe(201)
    const unrated = await seedMember()
    expect((await register(unrated, { tournamentId, section: 'U1200' })).status).toBe(201)
  })

  it('follows the rules a director set over the ones implied by the name', async () => {
    const tournamentId = await seedTournament({
      sections: [{ name: 'U1200', entryFee: 0, rulesSet: true, ratingMax: 1399, unratedOk: false }],
    })
    const mid = await seedMember({ uscfRating: 1300 })
    expect((await register(mid, { tournamentId, section: 'U1200' })).status).toBe(201)
    const unrated = await seedMember()
    expect((await register(unrated, { tournamentId, section: 'U1200' })).status).toBe(400)
  })

  it('needs the player to confirm the grade range, and keeps only that', async () => {
    const tournamentId = await seedTournament({ sections: [{ name: 'K-5', entryFee: 0 }] })
    const kid = await seedMember()
    const none = await register(kid, { tournamentId, section: 'K-5' })
    expect(none.status).toBe(400)
    expect((await none.json<{ error: string }>()).error).toMatch(/5th grade or below/)
    // Confirming a wider range isn't enough.
    expect((await register(kid, { tournamentId, section: 'K-5', gradeRange: '0-8' })).status).toBe(400)
    expect((await register(kid, { tournamentId, section: 'K-5', gradeRange: '0-5' })).status).toBe(201)
    const reg = await env.DB.prepare('SELECT grade FROM registrations WHERE member_id = ?').bind(kid).first<{ grade: string }>()
    expect(reg?.grade).toBe('0-5')
  })

  it('checks each player in a family entry', async () => {
    const tournamentId = await seedTournament({ sections: [{ name: 'U800', entryFee: 0 }] })
    const parent = await seedMember()
    const child = await seedMember({ uscfRating: 950 })
    await env.DB.prepare('UPDATE members SET guardian_id = ? WHERE id = ?').bind(parent, child).run()
    const res = await invoke(batchPost, {
      method: 'POST', as: parent, body: { tournamentId, entries: [{ memberId: child, section: 'U800' }] },
    })
    expect(res.status).toBe(400)
    expect((await res.json<{ error: string }>()).error).toMatch(/under 800/)
  })
})

describe('entry pricing', () => {
  it('takes the early and member discounts off at checkout', async () => {
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 25 }] })
    await env.DB.prepare(
      `UPDATE tournaments SET early_deadline = '2099-01-01', early_discount = 5, member_discount = 3 WHERE id = ?`,
    ).bind(tournamentId).run()
    const member = await seedMember({ membershipStatus: 'active' })
    const res = await register(member, { tournamentId, section: 'Open' })
    expect(res.status).toBe(201)
    const { payment } = await res.json<{ payment: { amount: number } }>()
    expect(payment.amount).toBe(17)
    expect(stripeSessions.at(-1)?.lineItems[0].amountCents).toBe(1700)

    const guest = await seedMember({ membershipStatus: 'expired' })
    const res2 = await register(guest, { tournamentId, section: 'Open' })
    expect((await res2.json<{ payment: { amount: number } }>()).payment.amount).toBe(20)
  })

  it('adds the late fee once the late date has passed', async () => {
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 25 }] })
    await env.DB.prepare(`UPDATE tournaments SET late_after = '2020-01-01T00:00', late_fee = 10 WHERE id = ?`)
      .bind(tournamentId).run()
    const res = await register(await seedMember(), { tournamentId, section: 'Open' })
    expect((await res.json<{ payment: { amount: number } }>()).payment.amount).toBe(35)
  })
})

describe('waitlist', () => {
  it('offers the waitlist when full, keeps waitlisted players out of the event, and lets the director bring them in', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ maxPlayers: 2, sections: [{ name: 'Open', entryFee: 0 }] })
    for (let i = 0; i < 2; i++) await seedRegistration({ tournamentId, memberId: await seedMember({ uscfRating: 1500 + i }) })

    const late = await seedMember()
    const full = await register(late, { tournamentId, section: 'Open' })
    expect(full.status).toBe(400)
    expect(await full.json()).toMatchObject({ full: true })

    const joined = await register(late, { tournamentId, section: 'Open', waitlist: true })
    expect(joined.status).toBe(201)
    const again = await register(late, { tournamentId, section: 'Open', waitlist: true })
    expect(again.status).toBe(409)

    const pub = await (await invoke(publicGet, { params: { id: tournamentId } }))
      .json<{ tournament: { waitlist_count: number }; roster: Array<{ member_id: string }> }>()
    expect(pub.tournament.waitlist_count).toBe(1)
    expect(pub.roster.map((r) => r.member_id)).not.toContain(late)

    const reg = await env.DB.prepare('SELECT id FROM registrations WHERE member_id = ?').bind(late).first<{ id: string }>()
    const offered = await invoke(waitlistPost, { method: 'POST', as: admin, params: { id: tournamentId }, body: { registrationId: reg!.id } })
    expect(offered.status).toBe(200)
    const after = await env.DB.prepare('SELECT waitlisted_at, payment_status FROM registrations WHERE id = ?')
      .bind(reg!.id).first<{ waitlisted_at: string | null; payment_status: string }>()
    expect(after).toEqual({ waitlisted_at: null, payment_status: 'paid' })
    expect(emailOutbox.length).toBeGreaterThan(0)

    const twice = await invoke(waitlistPost, { method: 'POST', as: admin, params: { id: tournamentId }, body: { registrationId: reg!.id } })
    expect(twice.status).toBe(404)
  })

  it('is only for the director to offer spots', async () => {
    const tournamentId = await seedTournament({ maxPlayers: 1, sections: [{ name: 'Open', entryFee: 0 }] })
    await seedRegistration({ tournamentId, memberId: await seedMember() })
    const late = await seedMember()
    await register(late, { tournamentId, section: 'Open', waitlist: true })
    const reg = await env.DB.prepare('SELECT id FROM registrations WHERE member_id = ?').bind(late).first<{ id: string }>()
    const res = await invoke(waitlistPost, { method: 'POST', as: late, params: { id: tournamentId }, body: { registrationId: reg!.id } })
    expect(res.status).toBe(403)
  })
})

describe('withdrawing yourself', () => {
  it('works until pairings are out, and never reinstates', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 0 }] })
    const me = await seedMember()
    const mine = await seedRegistration({ tournamentId, memberId: me })

    const out = await invoke(registrationPatch, { method: 'PATCH', as: me, params: { id: mine }, body: { withdrawn: true } })
    expect(out.status).toBe(200)
    const back = await invoke(registrationPatch, { method: 'PATCH', as: me, params: { id: mine }, body: { withdrawn: false } })
    expect(back.status).toBe(403)

    // Someone else, once round 1 is paired, has to ask the director.
    const other = await seedMember()
    const theirs = await seedRegistration({ tournamentId, memberId: other })
    await seedRegistration({ tournamentId, memberId: await seedMember() })
    const paired = await invoke(generatePost, { method: 'POST', as: admin, params: { id: tournamentId }, body: { round: 1, section: 'Open' } })
    expect(paired.status).toBe(201)
    const late = await invoke(registrationPatch, { method: 'PATCH', as: other, params: { id: theirs }, body: { withdrawn: true } })
    expect(late.status).toBe(403)
  })
})
