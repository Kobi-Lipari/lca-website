// test/integration/registration-section-ids.test.ts
// Every entry the player endpoints and the director's walk-ins write or
// move carries the id of its section row, set by the handler itself. The two 0053 triggers that fill
// registrations.section_id from the name are dropped for this file only
// (each test file has its own database), so a section_id seen here can only
// have come from the handler; the triggers stay installed everywhere else.
import { env } from 'cloudflare:test'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { onRequestPost as registerPost } from '../../functions/api/registrations'
import { onRequestPost as batchPost } from '../../functions/api/registrations/batch'
import { onRequestPatch as registrationPatch } from '../../functions/api/registrations/[id]'
import { onRequestPost as walkInPost } from '../../functions/api/admin/tournaments/[id]/walk-ins'
import { onRequestPost as waitlistPost } from '../../functions/api/admin/tournaments/[id]/waitlist'
import { seedAdmin, seedMember, seedRegistration, seedTournament } from './factories'
import { invoke, resetHarness, stripeSessions } from './harness'

const ENTRY_TRIGGERS = ['registrations_fill_section_insert', 'registrations_fill_section_update']

beforeAll(async () => {
  for (const name of ENTRY_TRIGGERS) await env.DB.prepare(`DROP TRIGGER IF EXISTS ${name}`).run()
})
beforeEach(resetHarness)

interface EntryRow { id: string; section: string; section_id: string | null; payment_status: string }

const entryOf = (tournamentId: string, memberId: string) =>
  env.DB.prepare('SELECT id, section, section_id, payment_status FROM registrations WHERE tournament_id = ? AND member_id = ?')
    .bind(tournamentId, memberId).first<EntryRow>()

const liveIds = async (tournamentId: string) => Object.fromEntries(
  (await env.DB.prepare('SELECT name, id FROM tournament_sections WHERE tournament_id = ? AND archived_at IS NULL')
    .bind(tournamentId).all<{ name: string; id: string }>()).results.map((r) => [r.name, r.id]),
)

/** An entry as the factory writes it, linked by hand because the trigger that would link it is gone. */
async function linkedEntry(tournamentId: string, memberId: string, section: string, paymentStatus: 'pending' | 'paid' = 'paid') {
  const reg = await seedRegistration({ tournamentId, memberId, section, paymentStatus })
  await env.DB.prepare(`UPDATE registrations SET section_id = (
      SELECT id FROM tournament_sections WHERE tournament_id = ? AND name = ? AND archived_at IS NULL) WHERE id = ?`)
    .bind(tournamentId, section, reg).run()
  return reg
}

describe('with the entry triggers removed', () => {
  it('the triggers are really gone for this file', async () => {
    const tournamentId = await seedTournament()
    const player = await seedMember()
    await seedRegistration({ tournamentId, memberId: player })
    expect((await entryOf(tournamentId, player))?.section_id).toBeNull()
    const left = await env.DB.prepare(`SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'trigger' AND name IN (?, ?)`)
      .bind(...ENTRY_TRIGGERS).first<{ n: number }>()
    expect(left?.n).toBe(0)
  })

  it('POST sets section_id on the free path, the paid path and the waitlist', async () => {
    const tournamentId = await seedTournament({ maxPlayers: 2 })
    const ids = await liveIds(tournamentId)

    const free = await seedMember()
    expect((await invoke(registerPost, { method: 'POST', as: free, body: { tournamentId, section: 'U1200' } })).status).toBe(201)
    expect(await entryOf(tournamentId, free)).toMatchObject({ section: 'U1200', section_id: ids.U1200, payment_status: 'paid' })

    const paid = await seedMember()
    expect((await invoke(registerPost, { method: 'POST', as: paid, body: { tournamentId, section: 'Open' } })).status).toBe(201)
    expect(stripeSessions).toHaveLength(1)
    expect(await entryOf(tournamentId, paid)).toMatchObject({ section: 'Open', section_id: ids.Open, payment_status: 'pending' })

    const late = await seedMember()
    expect((await invoke(registerPost, { method: 'POST', as: late, body: { tournamentId, section: 'Open', waitlist: true } })).status).toBe(201)
    expect(await entryOf(tournamentId, late)).toMatchObject({ section: 'Open', section_id: ids.Open })
  })

  it('POST picks the live row when an archived row has the same name', async () => {
    const tournamentId = await seedTournament()
    const ids = await liveIds(tournamentId)
    await env.DB.prepare(`INSERT INTO tournament_sections (id, tournament_id, position, name, archived_at)
      VALUES ('old-open-row', ?, 9, 'Open', datetime('now'))`).bind(tournamentId).run()
    const player = await seedMember()
    expect((await invoke(registerPost, { method: 'POST', as: player, body: { tournamentId, section: 'Open' } })).status).toBe(201)
    expect((await entryOf(tournamentId, player))?.section_id).toBe(ids.Open)
  })

  it('a family entry sets each player’s section_id, free and paid alike', async () => {
    const tournamentId = await seedTournament()
    const ids = await liveIds(tournamentId)
    const parent = await seedMember()
    const child = await seedMember({ uscfRating: 800 })
    await env.DB.prepare('UPDATE members SET guardian_id = ? WHERE id = ?').bind(parent, child).run()
    const res = await invoke(batchPost, {
      method: 'POST', as: parent, body: { tournamentId, entries: [{ section: 'Open' }, { memberId: child, section: 'U1200' }] },
    })
    expect(res.status).toBe(201)
    expect(await entryOf(tournamentId, parent)).toMatchObject({ section_id: ids.Open, payment_status: 'pending' })
    expect(await entryOf(tournamentId, child)).toMatchObject({ section_id: ids.U1200, payment_status: 'paid' })
  })

  it('PATCH moves the name and section_id together and reprices a pending payment in the same write', async () => {
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 25 }, { name: 'Reserve', entryFee: 15 }] })
    const ids = await liveIds(tournamentId)
    const admin = await seedAdmin()
    const player = await seedMember()
    const reg = await linkedEntry(tournamentId, player, 'Open', 'pending')
    await env.DB.prepare(`INSERT INTO payments (id, member_id, amount, type, reference_id, status) VALUES (?, ?, 25, 'tournament', ?, 'pending')`)
      .bind(`pay-${reg}`, player, reg).run()

    const res = await invoke(registrationPatch, { method: 'PATCH', as: admin, params: { id: reg }, body: { section: 'Reserve' } })
    expect(res.status).toBe(200)
    expect(await entryOf(tournamentId, player)).toMatchObject({ section: 'Reserve', section_id: ids.Reserve })
    expect(await env.DB.prepare('SELECT amount FROM payments WHERE id = ?').bind(`pay-${reg}`).first()).toEqual({ amount: 15 })
  })

  it('a refused PATCH leaves the entry and its payment as they were', async () => {
    const tournamentId = await seedTournament({ rounds: 3, sections: [{ name: 'Open', entryFee: 25 }, { name: 'Reserve', entryFee: 15 }] })
    const ids = await liveIds(tournamentId)
    const admin = await seedAdmin()
    const player = await seedMember()
    const reg = await linkedEntry(tournamentId, player, 'Open', 'pending')
    await env.DB.prepare(`INSERT INTO payments (id, member_id, amount, type, reference_id, status) VALUES (?, ?, 25, 'tournament', ?, 'pending')`)
      .bind(`pay-${reg}`, player, reg).run()

    // The section is fine but the byes are not (at most 2 in 3 rounds), so nothing is written.
    const res = await invoke(registrationPatch, { method: 'PATCH', as: admin, params: { id: reg }, body: { section: 'Reserve', byeRounds: [1, 2, 3] } })
    expect(res.status).toBe(400)
    expect(await entryOf(tournamentId, player)).toMatchObject({ section: 'Open', section_id: ids.Open })
    expect(await env.DB.prepare('SELECT amount FROM payments WHERE id = ?').bind(`pay-${reg}`).first()).toEqual({ amount: 25 })
  })

  it('archived sections take no new entries and no moves', async () => {
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 0 }, { name: 'Closed', entryFee: 0 }] })
    await env.DB.prepare(`UPDATE tournament_sections SET archived_at = datetime('now') WHERE tournament_id = ? AND name = 'Closed'`)
      .bind(tournamentId).run()
    const player = await seedMember()
    const single = await invoke(registerPost, { method: 'POST', as: player, body: { tournamentId, section: 'Closed' } })
    expect(single.status).toBe(400)
    expect(await single.json()).toEqual({ error: 'Invalid section' })
    const family = await invoke(batchPost, { method: 'POST', as: player, body: { tournamentId, entries: [{ section: 'Closed' }] } })
    expect(family.status).toBe(400)
    expect(Object.keys(await family.json())).toEqual(['error'])
    expect(await entryOf(tournamentId, player)).toBeNull()

    const reg = await linkedEntry(tournamentId, player, 'Open')
    const move = await invoke(registrationPatch, { method: 'PATCH', as: await seedAdmin(), params: { id: reg }, body: { section: 'Closed' } })
    expect(move.status).toBe(400)
    expect(await move.json()).toEqual({ error: 'Invalid section' })
    expect((await entryOf(tournamentId, player))?.section).toBe('Open')
  })
})

describe('the director\'s entries, with the entry triggers removed', () => {
  it('a walk-in sets section_id itself, on the live row when an archived row has the same name', async () => {
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 20 }, { name: 'Reserve', entryFee: 15 }] })
    const ids = await liveIds(tournamentId)
    await env.DB.prepare(`INSERT INTO tournament_sections (id, tournament_id, position, name, archived_at)
      VALUES ('old-reserve-row', ?, 9, 'Reserve', datetime('now'))`).bind(tournamentId).run()
    const res = await invoke(walkInPost, {
      method: 'POST', as: await seedAdmin(), params: { id: tournamentId }, body: { fullName: 'Door Player', section: 'Reserve' },
    })
    expect(res.status).toBe(201)
    const { guestId } = await res.json<{ guestId: string }>()
    expect(await entryOf(tournamentId, guestId)).toMatchObject({ section: 'Reserve', section_id: ids.Reserve, payment_status: 'paid' })
  })

  it('the waitlist prices from the row the entry points at, else the row of its name', async () => {
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 25 }, { name: 'Reserve', entryFee: 15 }] })
    const admin = await seedAdmin()
    const offer = async (section: string, link: boolean) => {
      const player = await seedMember({ membershipStatus: 'pending' })
      const reg = link ? await linkedEntry(tournamentId, player, section, 'pending') : await seedRegistration({ tournamentId, memberId: player, section, paymentStatus: 'pending' })
      await env.DB.prepare(`UPDATE registrations SET waitlisted_at = datetime('now') WHERE id = ?`).bind(reg).run()
      const res = await invoke(waitlistPost, { method: 'POST', as: admin, params: { id: tournamentId }, body: { registrationId: reg } })
      expect(res.status).toBe(200)
      return (await res.json<{ amount: number }>()).amount
    }
    expect(await offer('Open', true)).toBe(25)
    // No section_id (the trigger that would fill it is gone): found by name.
    expect(await offer('Reserve', false)).toBe(15)
    // The row's own fee is what counts, not the legacy JSON's.
    await env.DB.prepare(`UPDATE tournament_sections SET fee_regular = 18 WHERE tournament_id = ? AND name = 'Reserve'`).bind(tournamentId).run()
    expect(await offer('Reserve', true)).toBe(18)
    // A section archived since the player joined the waitlist keeps its own fee.
    await env.DB.prepare(`UPDATE tournament_sections SET archived_at = datetime('now') WHERE tournament_id = ? AND name = 'Reserve'`).bind(tournamentId).run()
    expect(await offer('Reserve', false)).toBe(18)
  })
})
