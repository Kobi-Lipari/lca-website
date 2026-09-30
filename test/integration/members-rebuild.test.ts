// test/integration/members-rebuild.test.ts
// Migration 0046 rebuilds members one last time. Unlike 0019/0033/0040 it
// must keep everything that cascades from members: board seats, event
// directors, reminders, and the account link on support tickets. This
// re-runs it on a database with those rows in it.
import { beforeEach, describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import { resetHarness } from './harness'
import { migrationModules, splitSql } from './setup'
import { seedAdmin, seedMember, seedTournament, seedTournamentDirector } from './factories'

beforeEach(resetHarness)

async function rerun0046() {
  const path = Object.keys(migrationModules).find((p) => p.includes('0046_members_safe_rebuild'))
  expect(path).toBeTruthy()
  for (const stmt of splitSql(migrationModules[path as string])) await env.DB.prepare(stmt).run()
}

const count = async (sql: string, ...binds: unknown[]) =>
  (await env.DB.prepare(sql).bind(...binds).first<{ n: number }>())?.n ?? 0

describe('rebuilding members', () => {
  it('keeps board seats, directors, reminders and ticket links', async () => {
    const admin = await seedAdmin()
    const officer = await seedMember({ fullName: 'Pat President' })
    let seat = await env.DB.prepare('SELECT id FROM board_members LIMIT 1').first<{ id: string }>()
    if (!seat) {
      await env.DB.prepare(`INSERT INTO board_members (id, role, name, sort_order) VALUES ('seat-test', 'President', '', 1)`).run()
      seat = { id: 'seat-test' }
    }
    await env.DB.prepare(`INSERT INTO board_seat_assignments (seat_id, member_id, appointed_by) VALUES (?, ?, ?)`)
      .bind(seat.id, officer, admin).run()
    const tournamentId = await seedTournament()
    await seedTournamentDirector(tournamentId, officer)
    await env.DB.prepare(`INSERT INTO tournament_reminders (id, member_id, tournament_id, email) VALUES ('rem-1', ?, ?, 'x@test.lca')`)
      .bind(officer, tournamentId).run()
    await env.DB.prepare(`INSERT INTO support_tickets (id, member_id, name, email, subject) VALUES ('tk-1', ?, 'Pat', 'x@test.lca', 'Hi')`)
      .bind(officer).run()

    await rerun0046()

    expect(await count('SELECT COUNT(*) AS n FROM board_seat_assignments WHERE member_id = ?', officer)).toBe(1)
    expect(await count('SELECT COUNT(*) AS n FROM tournament_directors WHERE member_id = ?', officer)).toBe(1)
    expect(await count('SELECT COUNT(*) AS n FROM tournament_reminders WHERE member_id = ?', officer)).toBe(1)
    expect(await count(`SELECT COUNT(*) AS n FROM support_tickets WHERE id = 'tk-1' AND member_id = ?`, officer)).toBe(1)
    expect(await count('SELECT COUNT(*) AS n FROM members WHERE id IN (?, ?)', admin, officer)).toBe(2)
  })

  it('still refuses a role or membership status that does not exist', async () => {
    const id = await seedMember()
    await expect(env.DB.prepare(`UPDATE members SET role = 'emperor' WHERE id = ?`).bind(id).run()).rejects.toThrow()
    await expect(env.DB.prepare(`UPDATE members SET membership_status = 'lifetime' WHERE id = ?`).bind(id).run()).rejects.toThrow()
    await env.DB.prepare(`UPDATE members SET role = 'lca_observer' WHERE id = ?`).bind(id).run()
    await expect(env.DB.prepare(
      `INSERT INTO members (id, email, full_name, role) VALUES ('bad', 'b@test.lca', 'B', 'wizard')`,
    ).run()).rejects.toThrow()
  })
})

describe('repairing what 0040 lost', () => {
  async function rerun0047() {
    const path = Object.keys(migrationModules).find((p) => p.includes('0047_repair_cascade_losses'))
    for (const stmt of splitSql(migrationModules[path as string])) await env.DB.prepare(stmt).run()
  }
  const log = (actor: string, action: string, target: string, tournamentId: string, at: string) =>
    env.DB.prepare(`INSERT INTO admin_audit_log (id, actor_id, actor_email, action, target_member_id, detail, created_at)
                    VALUES (?, ?, 'a@test.lca', ?, ?, ?, ?)`)
      .bind(`log-${action}-${target}-${at}`, actor, action, target, JSON.stringify({ tournament_id: tournamentId }), at).run()

  it('replays director assignments from the activity log, minus later removals', async () => {
    const admin = await seedAdmin()
    const kept = await seedMember()
    const removed = await seedMember()
    const tournamentId = await seedTournament()
    await log(admin, 'director_assign', kept, tournamentId, '2026-09-29 10:00:00')
    await log(admin, 'director_assign', removed, tournamentId, '2026-09-29 10:00:00')
    await log(admin, 'director_remove', removed, tournamentId, '2026-09-29 11:00:00')
    await rerun0047()
    const { results } = await env.DB.prepare('SELECT member_id FROM tournament_directors WHERE tournament_id = ?').bind(tournamentId).all<{ member_id: string }>()
    expect((results ?? []).map((r) => r.member_id)).toEqual([kept])
  })

  it('relinks tickets to the account with the same email', async () => {
    const member = await seedMember({ email: 'Pat@Example.org' })
    await env.DB.prepare(`INSERT INTO support_tickets (id, member_id, name, email, subject) VALUES ('tk-2', NULL, 'Pat', 'pat@example.org', 'Hi')`).run()
    await env.DB.prepare(`INSERT INTO support_tickets (id, member_id, name, email, subject) VALUES ('tk-3', NULL, 'Guest', 'nobody@example.org', 'Hi')`).run()
    await rerun0047()
    expect(await count(`SELECT COUNT(*) AS n FROM support_tickets WHERE id = 'tk-2' AND member_id = ?`, member)).toBe(1)
    expect(await count(`SELECT COUNT(*) AS n FROM support_tickets WHERE id = 'tk-3' AND member_id IS NULL`)).toBe(1)
  })
})
