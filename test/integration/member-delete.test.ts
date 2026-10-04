// test/integration/member-delete.test.ts
//
// Deleting a member is all or nothing. The handler used to run a dozen
// separate statements, and the last one (the member row itself) failed on
// any reference the list had missed: a US Chess rating on file, a scoresheet
// scan, an activity log entry about the member, a game. By then the
// registrations and payments were already gone and the member was not.
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { invoke, resetHarness } from './harness'
import { seedAdmin, seedMember, seedRegistration, seedTournament } from './factories'

import { onRequestDelete as memberDelete } from '../../functions/api/admin/members/[id]'
import { onRequestPatch as registrationPatch } from '../../functions/api/registrations/[id]'
import { onRequestGet as manageGet } from '../../functions/api/admin/tournaments/[id]/manage'

beforeEach(resetHarness)

const count = async (sql: string, ...binds: unknown[]) =>
  (await env.DB.prepare(sql).bind(...binds).first<{ n: number }>())?.n ?? 0

const remove = (admin: string, memberId: string) =>
  invoke(memberDelete, { method: 'DELETE', as: admin, params: { id: memberId } })

/** A member with an entry and a payment for it: what a failed delete used to lose. */
async function memberWithEntry() {
  const memberId = await seedMember({ uscfId: '12345678', uscfRating: 1500 })
  const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 25 }] })
  const registrationId = await seedRegistration({ tournamentId, memberId })
  await env.DB.prepare(
    `INSERT INTO payments (id, member_id, amount, type, reference_id, status)
     VALUES (?, ?, 25, 'tournament', ?, 'completed')`,
  ).bind(`pay-${registrationId}`, memberId, registrationId).run()
  return { memberId, tournamentId, registrationId }
}

describe('deleting a member with history on file', () => {
  it('removes a member who has a rating on file, a scan and a log entry about them', async () => {
    const admin = await seedAdmin()
    const { memberId } = await memberWithEntry()

    // What the nightly rating check, the scanner and an admin edit leave behind.
    await env.DB.prepare(
      `INSERT INTO uscf_rating_history (id, member_id, rating_system, rating) VALUES (?, ?, 'R', 1500)`,
    ).bind(`rh-${memberId}`, memberId).run()
    await env.DB.prepare(
      `INSERT INTO scan_usage (member_id, day, count) VALUES (?, '2026-10-01', 2)`,
    ).bind(memberId).run()
    await env.DB.prepare(
      `INSERT INTO admin_audit_log (id, actor_id, actor_email, action, target_member_id, target_label)
       VALUES (?, ?, 'admin@test.lca', 'membership_override', ?, 'Pat Player <pat@test.lca>')`,
    ).bind(`aud-${memberId}`, admin, memberId).run()

    const res = await remove(admin, memberId)
    expect(res.status).toBe(200)

    expect(await count('SELECT COUNT(*) n FROM members WHERE id = ?', memberId)).toBe(0)
    expect(await count('SELECT COUNT(*) n FROM registrations WHERE member_id = ?', memberId)).toBe(0)
    expect(await count('SELECT COUNT(*) n FROM uscf_rating_history WHERE member_id = ?', memberId)).toBe(0)
    expect(await count('SELECT COUNT(*) n FROM scan_usage WHERE member_id = ?', memberId)).toBe(0)

    // The log entry stays, with the name it recorded at the time.
    const entry = await env.DB.prepare(
      'SELECT target_member_id, target_label FROM admin_audit_log WHERE id = ?',
    ).bind(`aud-${memberId}`).first<{ target_member_id: string | null; target_label: string }>()
    expect(entry).toEqual({ target_member_id: null, target_label: 'Pat Player <pat@test.lca>' })
  })

  it('keeps an event the member created', async () => {
    const admin = await seedAdmin()
    const organizer = await seedMember({ role: 'club_rep' })
    const tournamentId = await seedTournament()
    await env.DB.prepare('UPDATE tournaments SET created_by = ? WHERE id = ?').bind(organizer, tournamentId).run()

    expect((await remove(admin, organizer)).status).toBe(200)

    const t = await env.DB.prepare('SELECT created_by FROM tournaments WHERE id = ?')
      .bind(tournamentId).first<{ created_by: string | null }>()
    expect(t).toEqual({ created_by: null })
  })

  it('refuses a member who has played, and leaves the event exactly as it was', async () => {
    const admin = await seedAdmin()
    const { memberId, tournamentId, registrationId } = await memberWithEntry()
    const opponent = await seedMember({ uscfRating: 1400 })
    await seedRegistration({ tournamentId, memberId: opponent })
    await env.DB.prepare(
      `INSERT INTO tournament_games (id, tournament_id, round, board, section, white_member_id, black_member_id, result)
       VALUES (?, ?, 1, 1, 'Open', ?, ?, '0-1')`,
    ).bind(`game-${memberId}`, tournamentId, memberId, opponent).run()

    const res = await remove(admin, memberId)
    expect(res.status).toBe(409)
    expect((await res.json<{ error: string }>()).error).toMatch(/played in a tournament/)

    expect(await count('SELECT COUNT(*) n FROM members WHERE id = ?', memberId)).toBe(1)
    expect(await count('SELECT COUNT(*) n FROM registrations WHERE id = ?', registrationId)).toBe(1)
    expect(await count('SELECT COUNT(*) n FROM payments WHERE member_id = ?', memberId)).toBe(1)

    // The opponent's win is still in the standings. With the registration
    // gone the game dropped out of them, and the win with it.
    const manage = await invoke(manageGet, { as: admin, params: { id: tournamentId } })
    const { standings } = await manage.json<{ standings: Array<{ member_id: string; score: number }> }>()
    expect(standings.find((s) => s.member_id === opponent)?.score).toBe(1)
  })

  it('refuses an account whose own changes are in the activity log', async () => {
    const admin = await seedAdmin()
    const formerAdmin = await seedMember({ role: 'club_rep' })
    await env.DB.prepare(
      `INSERT INTO admin_audit_log (id, actor_id, actor_email, action, target_label)
       VALUES (?, ?, 'rep@test.lca', 'tournament_create', 'Spring Open')`,
    ).bind(`aud-actor-${formerAdmin}`, formerAdmin).run()

    const res = await remove(admin, formerAdmin)
    expect(res.status).toBe(409)
    // This account has a role to take away, and the message says how.
    const { error } = await res.json<{ error: string }>()
    expect(error).toMatch(/activity log/)
    expect(error).toMatch(/change its role to Member/)
    expect(error).toMatch(/Nothing was changed/)
    expect(await count('SELECT COUNT(*) n FROM members WHERE id = ?', formerAdmin)).toBe(1)
    expect(await count('SELECT COUNT(*) n FROM admin_audit_log WHERE actor_id = ?', formerAdmin)).toBe(1)
  })

  it('does not tell the admin to change the role of an ordinary member who withdrew online', async () => {
    // Withdrawing yourself is written to the activity log with the player as
    // the one who acted, so this refusal reaches ordinary members too.
    const admin = await seedAdmin()
    const memberId = await seedMember()
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 0 }] })
    const registrationId = await seedRegistration({ tournamentId, memberId })
    const withdrawn = await invoke(registrationPatch, {
      method: 'PATCH', as: memberId, params: { id: registrationId }, body: { withdrawn: true },
    })
    expect(withdrawn.status).toBe(200)
    expect(await count('SELECT COUNT(*) n FROM admin_audit_log WHERE actor_id = ?', memberId)).toBe(1)

    const res = await remove(admin, memberId)
    expect(res.status).toBe(409)
    const { error } = await res.json<{ error: string }>()
    expect(error).toMatch(/activity log/)
    expect(error).toMatch(/already Member/)
    expect(error).not.toMatch(/change its role/i)
    expect(error).toMatch(/Nothing was changed/)
    expect(await count('SELECT COUNT(*) n FROM members WHERE id = ?', memberId)).toBe(1)
    expect(await count('SELECT COUNT(*) n FROM registrations WHERE id = ?', registrationId)).toBe(1)
  })

  it('changes nothing when a reference it does not know about blocks the delete', async () => {
    // Stands in for a table added after this handler was written.
    await env.DB.prepare(
      'CREATE TABLE IF NOT EXISTS later_feature (member_id TEXT NOT NULL REFERENCES members(id))',
    ).run()
    const admin = await seedAdmin()
    const { memberId, registrationId } = await memberWithEntry()
    await env.DB.prepare('INSERT INTO later_feature (member_id) VALUES (?)').bind(memberId).run()

    const res = await remove(admin, memberId)
    expect(res.status).toBe(409)
    expect((await res.json<{ error: string }>()).error).toMatch(/Nothing was changed/)

    expect(await count('SELECT COUNT(*) n FROM members WHERE id = ?', memberId)).toBe(1)
    expect(await count('SELECT COUNT(*) n FROM registrations WHERE id = ?', registrationId)).toBe(1)
    expect(await count('SELECT COUNT(*) n FROM payments WHERE member_id = ?', memberId)).toBe(1)
  })
})
