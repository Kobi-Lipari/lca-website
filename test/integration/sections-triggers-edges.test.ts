// test/integration/sections-triggers-edges.test.ts
//
// More of the 0053 triggers in the Workers runtime, through the handlers as
// they are today (none knows the new tables exist):
//
// - who may change the rows: the admin POST, PATCH and DELETE turn away the
//   wrong role (401 or 403) and leave every row as it was
// - a replayed PATCH, a reorder, an empty list and a rename back keep ids
//   and archived rows
// - tier prices and the tournament fee never become a stored tier price
// - rows written by legacy shapes: string sections, an entry into a name
//   the event has not got
// - two events with the same section names stay apart
// - several entries made at once all link
import { beforeEach, describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import { invoke, resetHarness } from './harness'
import { seedAdmin, seedDirector, seedMember, seedRegistration, seedTournament, seedTournamentDirector } from './factories'

import { onRequestPost as registrationsPost } from '../../functions/api/registrations'
import { onRequestPost as batchPost } from '../../functions/api/registrations/batch'
import { onRequestPost as walkInPost } from '../../functions/api/admin/tournaments/[id]/walk-ins'
import { onRequestPost as createTournament } from '../../functions/api/admin/tournaments'
import { onRequestDelete as deleteTournament, onRequestPatch as patchTournament } from '../../functions/api/admin/tournaments/[id]'

beforeEach(resetHarness)

interface SectionRow {
  id: string; position: number; name: string; fee_regular: number | null; fee_early: number | null
  fee_late: number | null; cap: number | null; archived_at: string | null; tournament_id: string
}
const sectionsOf = async (t: string) =>
  (await env.DB.prepare('SELECT * FROM tournament_sections WHERE tournament_id = ? ORDER BY archived_at IS NOT NULL, position, name').bind(t).all<SectionRow>()).results
const live = async (t: string) => (await sectionsOf(t)).filter((s) => s.archived_at === null)
const archived = async (t: string) => (await sectionsOf(t)).filter((s) => s.archived_at !== null)
const schedulesOf = async (t: string) =>
  (await env.DB.prepare('SELECT * FROM tournament_schedules WHERE tournament_id = ? ORDER BY id').bind(t).all()).results
const roundsOf = async (t: string) =>
  (await env.DB.prepare(
    `SELECT r.round, r.date, r.time FROM tournament_schedule_rounds r JOIN tournament_schedules p ON p.id = r.schedule_id
      WHERE p.tournament_id = ? AND p.is_primary = 1 AND p.archived_at IS NULL ORDER BY r.round`,
  ).bind(t).all<{ round: number; date: string | null; time: string | null }>()).results
const entryOf = (t: string, m: string) =>
  env.DB.prepare('SELECT id, section, section_id, schedule_id FROM registrations WHERE tournament_id = ? AND member_id = ?')
    .bind(t, m).first<{ id: string; section: string; section_id: string | null; schedule_id: string | null }>()
const rowCounts = async () => {
  const n = async (t: string) => (await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${t}`).first<{ n: number }>())?.n
  return [await n('tournament_sections'), await n('tournament_schedules'), await n('tournament_schedule_rounds'), await n('tournaments')]
}
const patch = (as: string | undefined, id: string, body: unknown) =>
  invoke(patchTournament, { method: 'PATCH', as, params: { id }, body })

describe('role safety: the wrong caller changes no rows', () => {
  it('PATCH: anonymous 401; a member, an unassigned director and an observer 403; none touches a row', async () => {
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 10 }] })
    const before = [await sectionsOf(tournamentId), await schedulesOf(tournamentId), await roundsOf(tournamentId)]
    const body = { sections: [{ name: 'Hijacked', entryFee: 0 }], roundSchedule: [{ round: 1, date: '2026-10-24', time: '09:00' }] }

    const anon = await patch(undefined, tournamentId, body)
    expect(anon.status).toBe(401)
    expect(JSON.stringify(await anon.json())).not.toContain('Hijacked')

    for (const who of [await seedMember(), await seedDirector(), await seedMember({ role: 'lca_observer' }), await seedMember({ role: 'lca_officer' })]) {
      const res = await patch(who, tournamentId, body)
      expect(res.status, who).toBe(403)
    }
    expect([await sectionsOf(tournamentId), await schedulesOf(tournamentId), await roundsOf(tournamentId)]).toEqual(before)
  })

  it('PATCH: the director assigned to the event may edit it, and the rows follow', async () => {
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 10 }] })
    const td = await seedDirector()
    await seedTournamentDirector(tournamentId, td)
    const res = await patch(td, tournamentId, { sections: [{ name: 'Open', entryFee: 12 }, { name: 'Reserve', entryFee: 6 }] })
    expect(res.status).toBe(200)
    expect((await live(tournamentId)).map((s) => [s.name, s.fee_regular])).toEqual([['Open', 12], ['Reserve', 6]])
  })

  it('POST: anonymous 401, and nothing is created', async () => {
    const before = await rowCounts()
    const res = await invoke(createTournament, {
      method: 'POST', body: { name: 'Anon Open', location: 'Kenner, LA', date: '2026-10-31', entryFee: 15 },
    })
    expect(res.status).toBe(401)
    expect(await rowCounts()).toEqual(before)
  })

  it('DELETE: anonymous 401, a member 403, an admin without a second factor refused; the rows stay until an admin deletes', async () => {
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 0 }] })
    const rows = await sectionsOf(tournamentId)
    expect((await invoke(deleteTournament, { method: 'DELETE', params: { id: tournamentId } })).status).toBe(401)
    expect((await invoke(deleteTournament, { method: 'DELETE', as: await seedMember(), params: { id: tournamentId } })).status).toBe(403)
    const weak = await invoke(deleteTournament, { method: 'DELETE', as: await seedAdmin(), aal: 'aal1', params: { id: tournamentId } })
    expect([401, 403]).toContain(weak.status)
    expect(await sectionsOf(tournamentId)).toEqual(rows)
    expect((await invoke(deleteTournament, { method: 'DELETE', as: await seedAdmin(), params: { id: tournamentId } })).status).toBe(200)
    expect(await sectionsOf(tournamentId)).toEqual([])
    expect(await schedulesOf(tournamentId)).toEqual([])
  })

  it('PATCH for a tournament that does not exist is 404 and creates no rows', async () => {
    const before = await rowCounts()
    const res = await patch(await seedAdmin(), 'no-such-event', { sections: [{ name: 'Open', entryFee: 0 }] })
    expect(res.status).toBe(404)
    expect(await rowCounts()).toEqual(before)
  })
})

describe('replays, reorders, removals and returns through the admin PATCH', () => {
  it('the same PATCH twice leaves every row, id and archive time as after the first', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 10 }, { name: 'Old', entryFee: 5 }] })
    const body = {
      sections: [{ name: 'Open', entryFee: 10 }, { name: 'New', entryFee: 7 }],
      roundSchedule: [{ round: 1, date: '2026-10-24', time: '09:00' }, { round: 2, date: '2026-10-24', time: '14:00' }],
    }
    expect((await patch(admin, tournamentId, body)).status).toBe(200)
    const first = [await sectionsOf(tournamentId), await schedulesOf(tournamentId), await roundsOf(tournamentId)]
    expect((await patch(admin, tournamentId, body)).status).toBe(200)
    expect((await patch(admin, tournamentId, body)).status).toBe(200)
    expect([await sectionsOf(tournamentId), await schedulesOf(tournamentId), await roundsOf(tournamentId)]).toEqual(first)
  })

  it('reordering moves positions and keeps ids; an empty list archives all and keeps entries linked; putting a name back revives its row', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 10 }, { name: 'Reserve', entryFee: 5 }] })
    const ids = Object.fromEntries((await live(tournamentId)).map((s) => [s.name, s.id]))
    const player = await seedMember()
    await seedRegistration({ tournamentId, memberId: player, section: 'Reserve' })

    await patch(admin, tournamentId, { sections: [{ name: 'Reserve', entryFee: 5 }, { name: 'Open', entryFee: 10 }] })
    expect((await live(tournamentId)).map((s) => [s.name, s.position, s.id])).toEqual([['Reserve', 0, ids.Reserve], ['Open', 1, ids.Open]])

    await patch(admin, tournamentId, { sections: [] })
    expect(await live(tournamentId)).toEqual([])
    expect((await archived(tournamentId)).map((s) => s.name).sort()).toEqual(['Open', 'Reserve'])
    expect((await entryOf(tournamentId, player))?.section_id).toBe(ids.Reserve)

    await patch(admin, tournamentId, { sections: [{ name: 'Reserve', entryFee: 8 }] })
    expect((await live(tournamentId)).map((s) => [s.name, s.id, s.fee_regular])).toEqual([['Reserve', ids.Reserve, 8]])
    expect((await archived(tournamentId)).map((s) => [s.name, s.id])).toEqual([['Open', ids.Open]])
    expect((await entryOf(tournamentId, player))?.section_id).toBe(ids.Reserve)
  })

  it('a section removed while it has entries is archived, never deleted, and a fresh entry cannot be made into it', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 0 }, { name: 'Gone', entryFee: 0 }] })
    const player = await seedMember()
    await seedRegistration({ tournamentId, memberId: player, section: 'Gone' })
    const goneId = (await live(tournamentId)).find((s) => s.name === 'Gone')?.id
    await patch(admin, tournamentId, { sections: [{ name: 'Open', entryFee: 0 }] })
    expect((await archived(tournamentId)).map((s) => s.id)).toEqual([goneId])
    expect((await entryOf(tournamentId, player))?.section_id).toBe(goneId)
    const other = await seedMember({ uscfRating: 900 })
    const res = await invoke(registrationsPost, { method: 'POST', as: other, body: { tournamentId, section: 'Gone' } })
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(await entryOf(tournamentId, other)).toBeNull()
  })

  it('a PATCH whose sections is not an array leaves the rows alone', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 10 }] })
    const before = await sectionsOf(tournamentId)
    await patch(admin, tournamentId, { sections: 'Open' })
    await patch(admin, tournamentId, { sections: { name: 'Open' } })
    expect(await sectionsOf(tournamentId)).toEqual(before)
  })

  it('round_schedule: an empty array clears the primary rounds; sending none leaves them', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 10 }] })
    await patch(admin, tournamentId, { roundSchedule: [{ round: 1, date: '2026-10-24', time: '19:00' }] })
    expect(await roundsOf(tournamentId)).toEqual([{ round: 1, date: '2026-10-24', time: '19:00' }])
    await patch(admin, tournamentId, { name: 'Renamed' })
    expect(await roundsOf(tournamentId)).toHaveLength(1)
    await patch(admin, tournamentId, { roundSchedule: [] })
    expect(await roundsOf(tournamentId)).toEqual([])
  })

  it('round_schedule sent as null ends with the same rounds the readers see (none)', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 10 }] })
    await patch(admin, tournamentId, { roundSchedule: [{ round: 1, date: '2026-10-24', time: '19:00' }] })
    const res = await patch(admin, tournamentId, { roundSchedule: null })
    expect(res.status).toBe(200)
    const stored = await env.DB.prepare('SELECT round_schedule FROM tournaments WHERE id = ?').bind(tournamentId).first<{ round_schedule: string | null }>()
    // The handler stores JSON.stringify(null), the text 'null': valid JSON, not an array.
    expect(stored?.round_schedule).toBe('null')
    // Readers parse this with parseJsonArray: anything that is not an array is no rounds.
    const parsed: unknown = stored?.round_schedule == null ? [] : JSON.parse(stored.round_schedule)
    expect(Array.isArray(parsed) ? parsed : []).toEqual([])
    expect(await roundsOf(tournamentId)).toEqual([])
  })

  it('rounds on the 7:00 PM edge: a time a director writes as 19:00 is stored as written, not reformatted', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 10 }] })
    const rounds = [{ round: 1, date: '2026-11-01', time: '00:00' }, { round: 2, date: '2026-03-08', time: '02:30' }, { round: 3, date: '2026-11-01', time: '23:59' }]
    await patch(admin, tournamentId, { roundSchedule: rounds })
    expect(await roundsOf(tournamentId)).toEqual(rounds)
  })
})

describe('no tier price is stored as a copy of a tournament column', () => {
  it('changing the entry fee, early and late tiers or the member discount leaves fee_early and fee_late null and fee_regular as the JSON says', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ entryFee: 25, sections: [{ name: 'Open', entryFee: 25 }, 'Reserve' as unknown as { name: string; entryFee: number }] })
    const res = await patch(admin, tournamentId, {
      entryFee: 40, earlyDeadline: '2026-10-01T23:59', earlyDiscount: 5, lateAfter: '2026-10-20T12:00', lateFee: 10, memberDiscount: 3,
    })
    expect(res.status).toBe(200)
    expect((await live(tournamentId)).map((s) => [s.name, s.fee_regular, s.fee_early, s.fee_late])).toEqual([
      ['Open', 25, null, null],
      ['Reserve', null, null, null],
    ])
    await patch(admin, tournamentId, { sections: [{ name: 'Open', entryFee: 30 }, { name: 'Reserve', entryFee: 0 }] })
    expect((await live(tournamentId)).map((s) => [s.name, s.fee_regular, s.fee_early, s.fee_late])).toEqual([
      ['Open', 30, null, null],
      ['Reserve', 0, null, null],
    ])
  })
})

describe('legacy shapes through the handlers', () => {
  it('walk-ins and batch accept a tournament whose sections are plain strings, and the entries link', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ entryFee: 20 })
    await env.DB.prepare('UPDATE tournaments SET sections = ? WHERE id = ?').bind('["Open","Reserve"]', tournamentId).run()
    expect((await live(tournamentId)).map((s) => [s.name, s.fee_regular])).toEqual([['Open', null], ['Reserve', null]])

    const walk = await invoke(walkInPost, { method: 'POST', as: admin, params: { id: tournamentId }, body: { fullName: 'Door Player', section: 'Reserve' } })
    expect(walk.status).toBe(201)
    const { guestId } = await walk.json<{ guestId: string }>()
    const row = await entryOf(tournamentId, guestId)
    expect(row?.section_id).toBe((await live(tournamentId)).find((s) => s.name === 'Reserve')?.id)
    expect(row?.schedule_id).not.toBeNull()

    const parent = await seedMember()
    const res = await invoke(batchPost, { method: 'POST', as: parent, body: { tournamentId, entries: [{ section: 'Open' }] } })
    expect(res.status).toBe(201)
    expect((await entryOf(tournamentId, parent))?.section_id).toBe((await live(tournamentId)).find((s) => s.name === 'Open')?.id)
  })

  it('an entry written for a name the event does not have gets an archived row, so section_id is never null', async () => {
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 0 }] })
    const player = await seedMember()
    await seedRegistration({ tournamentId, memberId: player, section: 'Old Section' })
    const row = await entryOf(tournamentId, player)
    expect(row?.section_id).not.toBeNull()
    expect((await archived(tournamentId)).map((s) => [s.name, s.id])).toEqual([['Old Section', row?.section_id]])
    expect((await live(tournamentId)).map((s) => s.name)).toEqual(['Open'])
  })

  it('two events with the same section names keep separate rows, and each entry links to its own event', async () => {
    const a = await seedTournament({ sections: [{ name: 'Open', entryFee: 0 }] })
    const b = await seedTournament({ sections: [{ name: 'Open', entryFee: 0 }] })
    const player = await seedMember()
    await seedRegistration({ tournamentId: a, memberId: player, section: 'Open' })
    await seedRegistration({ tournamentId: b, memberId: player, section: 'Open' })
    const ea = await entryOf(a, player)
    const eb = await entryOf(b, player)
    expect(ea?.section_id).not.toBe(eb?.section_id)
    expect(ea?.schedule_id).not.toBe(eb?.schedule_id)
    expect((await live(a))[0].id).toBe(ea?.section_id)
    expect((await live(b))[0].id).toBe(eb?.section_id)
  })

  it('a handler that sets section_id itself is not overridden when the name changes in the same write', async () => {
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 0 }, { name: 'Reserve', entryFee: 0 }] })
    const player = await seedMember()
    const regId = await seedRegistration({ tournamentId, memberId: player, section: 'Open' })
    const reserve = (await live(tournamentId)).find((s) => s.name === 'Reserve')?.id as string
    await env.DB.prepare(`UPDATE registrations SET section = 'Reserve', section_id = ? WHERE id = ?`).bind(reserve, regId).run()
    expect((await entryOf(tournamentId, player))?.section_id).toBe(reserve)
    // A move whose own write names a different section_id keeps that id, even when
    // the id and the name disagree. (Writing the id it already had cannot be told
    // from not writing it, so that case follows the name.)
    const open = (await live(tournamentId)).find((s) => s.name === 'Open')?.id as string
    await env.DB.prepare(`UPDATE registrations SET section = 'Open', section_id = ? WHERE id = ?`).bind(open, regId).run()
    expect((await entryOf(tournamentId, player))?.section_id).toBe(open)
    await env.DB.prepare(`UPDATE registrations SET section = 'Reserve', section_id = ? WHERE id = ?`).bind(open, regId).run()
    expect((await entryOf(tournamentId, player))?.section_id).toBe(reserve)
  })
})

describe('concurrent writes', () => {
  // registrations.ts names an entry reg-<tournament>-<millisecond>, so two
  // handler calls in one millisecond collide on the primary key before any
  // trigger runs. These cases write the rows the way the factory does, which
  // runs the same triggers at the same time.
  it('twelve entries inserted at once into two sections all link to the right row, with no extra section row', async () => {
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 0 }, { name: 'U1200', entryFee: 0 }] })
    const players = await Promise.all(Array.from({ length: 12 }, () => seedMember({ uscfRating: 1000 })))
    await Promise.all(players.map((p, i) => seedRegistration({ tournamentId, memberId: p, section: i % 2 ? 'Open' : 'U1200' })))
    expect(await live(tournamentId)).toHaveLength(2)
    const entries = (await env.DB.prepare(
      `SELECT r.section, r.section_id, r.schedule_id, s.name, s.tournament_id FROM registrations r
         LEFT JOIN tournament_sections s ON s.id = r.section_id WHERE r.tournament_id = ?`).bind(tournamentId).all<{
      section: string; section_id: string | null; schedule_id: string | null; name: string | null; tournament_id: string | null }>()).results
    expect(entries).toHaveLength(12)
    for (const e of entries) expect(e).toMatchObject({ name: e.section, tournament_id: tournamentId })
    expect(new Set(entries.map((e) => e.schedule_id)).size).toBe(1)
    expect(await archived(tournamentId)).toEqual([])
    expect(await schedulesOf(tournamentId)).toHaveLength(1)
  })

  it('an admin PATCH racing with entries leaves every entry linked to a section of its own name', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 0 }, { name: 'Reserve', entryFee: 0 }] })
    const players = await Promise.all(Array.from({ length: 6 }, () => seedMember({ uscfRating: 1000 })))
    await Promise.all([
      patch(admin, tournamentId, { sections: [{ name: 'Open', entryFee: 0 }, { name: 'Scholastic', entryFee: 0 }] }),
      ...players.map((p) => seedRegistration({ tournamentId, memberId: p, section: 'Open' })),
    ])
    const bad = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM registrations r LEFT JOIN tournament_sections s ON s.id = r.section_id
        WHERE r.tournament_id = ? AND (s.id IS NULL OR s.name <> r.section OR s.tournament_id <> r.tournament_id OR r.schedule_id IS NULL)`).bind(tournamentId).first<{ n: number }>()
    expect(bad?.n).toBe(0)
    expect((await live(tournamentId)).map((s) => s.name)).toEqual(['Open', 'Scholastic'])
    expect(await schedulesOf(tournamentId)).toHaveLength(1)
  })

  it('twelve handler entries one after another, each in its own millisecond, all link', async () => {
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 0 }, { name: 'U1200', entryFee: 0 }] })
    for (let i = 0; i < 12; i++) {
      const p = await seedMember({ uscfRating: 1000 })
      await new Promise((r) => setTimeout(r, 2))
      expect((await invoke(registrationsPost, { method: 'POST', as: p, body: { tournamentId, section: i % 2 ? 'Open' : 'U1200' } })).status).toBe(201)
    }
    const bad = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM registrations r LEFT JOIN tournament_sections s ON s.id = r.section_id
        WHERE r.tournament_id = ? AND (s.id IS NULL OR s.name <> r.section OR r.schedule_id IS NULL)`).bind(tournamentId).first<{ n: number }>()
    expect(bad?.n).toBe(0)
  })
})
