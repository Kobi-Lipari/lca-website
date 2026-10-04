// test/integration/registration-races.test.ts
//
// Two requests that arrive together. Each checks "is there a seat" and "is
// this member already entered", and writes several statements later (for a
// paid section, a Stripe call later). With the check and the write apart,
// both requests pass the check: the event goes over its limit, or one member
// ends up entered twice.
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { invoke, resetHarness } from './harness'
import { seedMember, seedRegistration, seedTournament } from './factories'

import { onRequestPost as registrationsPost } from '../../functions/api/registrations'
import { onRequestPost as batchPost } from '../../functions/api/registrations/batch'

beforeEach(resetHarness)

const count = async (sql: string, ...binds: unknown[]) =>
  (await env.DB.prepare(sql).bind(...binds).first<{ n: number }>())?.n ?? 0

const entered = (tournamentId: string) =>
  count('SELECT COUNT(*) n FROM registrations WHERE tournament_id = ?', tournamentId)

const paymentRows = (tournamentId: string) =>
  count(`SELECT COUNT(*) n FROM payments WHERE type = 'tournament' AND reference_id LIKE ?`, `reg-${tournamentId}-%`)

const register = (memberId: string, tournamentId: string) =>
  invoke(registrationsPost, { method: 'POST', as: memberId, body: { tournamentId, section: 'Open' } })

describe('two people going for the last seat at the same moment', () => {
  it.each([
    ['a free section', 0],
    ['a paid section', 20],
  ])('%s: one gets it and the other is told the event is full', async (_label, entryFee) => {
    const tournamentId = await seedTournament({ maxPlayers: 1, sections: [{ name: 'Open', entryFee }] })
    const a = await seedMember()
    const b = await seedMember()

    const results = await Promise.all([register(a, tournamentId), register(b, tournamentId)])

    expect(results.map((r) => r.status).sort()).toEqual([201, 400])
    const turnedAway = results.find((r) => r.status === 400)!
    expect(await turnedAway.json()).toMatchObject({ full: true })
    expect(await entered(tournamentId)).toBe(1)
    expect(await paymentRows(tournamentId)).toBe(1)
  })

  it.each([
    ['a free section', 0],
    ['a paid section', 20],
  ])('%s: the one who misses it, having asked for the waitlist, is put on the waitlist', async (_label, entryFee) => {
    const tournamentId = await seedTournament({ maxPlayers: 1, sections: [{ name: 'Open', entryFee }] })
    const a = await seedMember()
    const b = await seedMember()
    // "A seat, or the waitlist if there is none."
    const join = (memberId: string) => invoke(registrationsPost, {
      method: 'POST', as: memberId, body: { tournamentId, section: 'Open', waitlist: true },
    })

    const results = await Promise.all([join(a), join(b)])

    expect(results.map((r) => r.status)).toEqual([201, 201])
    const bodies = await Promise.all(results.map((r) =>
      r.json<{ registration: { waitlisted?: boolean }; paymentUrl: string | null }>()))
    const waiting = bodies.filter((body) => body.registration.waitlisted)
    expect(waiting.length).toBe(1)
    expect(waiting[0].paymentUrl).toBeNull()

    expect(await count(
      'SELECT COUNT(*) n FROM registrations WHERE tournament_id = ? AND waitlisted_at IS NULL', tournamentId,
    )).toBe(1)
    expect(await count(
      'SELECT COUNT(*) n FROM registrations WHERE tournament_id = ? AND waitlisted_at IS NOT NULL', tournamentId,
    )).toBe(1)
    // The waitlist costs nothing until a spot is offered: the only payment
    // row is the one for the seat.
    expect(await paymentRows(tournamentId)).toBe(1)
  })
})

describe('one member submitting the form twice at the same moment', () => {
  it.each([
    ['a free section', 0],
    ['a paid section', 20],
  ])('%s: entered once, with one payment row', async (_label, entryFee) => {
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee }] })
    const member = await seedMember()

    const results = await Promise.all([register(member, tournamentId), register(member, tournamentId)])

    expect(results.map((r) => r.status).sort()).toEqual([201, 409])
    expect(await entered(tournamentId)).toBe(1)
    expect(await paymentRows(tournamentId)).toBe(1)
  })
})

describe('one member joining the waitlist twice at the same moment', () => {
  it('is on it once', async () => {
    const tournamentId = await seedTournament({ maxPlayers: 1, sections: [{ name: 'Open', entryFee: 20 }] })
    await seedRegistration({ tournamentId, memberId: await seedMember() })
    const member = await seedMember()
    const join = () => invoke(registrationsPost, {
      method: 'POST', as: member, body: { tournamentId, section: 'Open', waitlist: true },
    })

    const results = await Promise.all([join(), join()])

    expect(results.map((r) => r.status).sort()).toEqual([201, 409])
    expect(await count(
      'SELECT COUNT(*) n FROM registrations WHERE tournament_id = ? AND member_id = ?', tournamentId, member,
    )).toBe(1)
  })
})

describe('two families going for the last two seats at the same moment', () => {
  const family = async () => {
    const parent = await seedMember()
    const kids = [await seedMember(), await seedMember()]
    await env.DB.prepare('UPDATE members SET guardian_id = ? WHERE id IN (?, ?)').bind(parent, ...kids).run()
    return { parent, kids }
  }
  const registerFamily = (f: { parent: string; kids: string[] }, tournamentId: string) =>
    invoke(batchPost, {
      method: 'POST', as: f.parent,
      body: { tournamentId, entries: f.kids.map((memberId) => ({ memberId, section: 'Open' })) },
    })

  it('one family gets both seats, the other gets none and no payment rows', async () => {
    const tournamentId = await seedTournament({ maxPlayers: 2, sections: [{ name: 'Open', entryFee: 20 }] })
    const one = await family()
    const two = await family()

    const results = await Promise.all([registerFamily(one, tournamentId), registerFamily(two, tournamentId)])

    expect(results.map((r) => r.status).sort()).toEqual([201, 400])
    expect(await entered(tournamentId)).toBe(2)
    expect(await paymentRows(tournamentId)).toBe(2)
    // Both seats went to the same family.
    expect(await count(
      'SELECT COUNT(DISTINCT m.guardian_id) n FROM registrations r JOIN members m ON m.id = r.member_id WHERE r.tournament_id = ?',
      tournamentId,
    )).toBe(1)
  })

  it('one family submitting twice is entered once', async () => {
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 20 }] })
    const one = await family()

    const results = await Promise.all([registerFamily(one, tournamentId), registerFamily(one, tournamentId)])

    expect(results.map((r) => r.status).sort()).toEqual([201, 409])
    expect(await entered(tournamentId)).toBe(2)
    expect(await paymentRows(tournamentId)).toBe(2)
  })
})
