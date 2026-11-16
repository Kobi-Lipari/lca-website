// test/integration/member-delete-approver.test.ts
//
// DELETE /api/admin/members/[id] for a member who approved a representative's
// club event through POST /api/admin/tournaments/[id]/approval (WS09
// checkpoint V's review), with REGION_EVENTS_ON set through a getter on its
// own module:
// - the approve writes a row in the activity log, whose actor_id names the
//   LCA admin with no delete action, so the admin's delete fails exactly as
//   it does on main for any member the activity log names: the handler
//   throws "FOREIGN KEY constraint failed" (a 500 in the runtime) and the
//   member stays; the clear of approved_by is in the same batch as the
//   member's delete, so the event still names its approver;
// - a member the activity log does not name, approver or not, is deleted,
//   approved_by is cleared and approved_at kept;
// - a member with a row in the activity log and no approval meets the same
//   failure, which is main's answer for them;
// - and, main's behaviour today and a known fault, the rows the delete
//   removes one statement at a time before that batch stay removed: such a
//   member keeps their account and loses their entry.
// The mail switches are set here through getters as well, at today's values,
// so the approve's email goes the same way whatever they ship as. Every club,
// person, address and event is made up.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { onRequestDelete as memberDelete } from '../../functions/api/admin/members/[id]'
import { onRequestPost as approval } from '../../functions/api/admin/tournaments/[id]/approval'
import { seedAdmin, seedClub, seedMember, seedRegistration, seedTournament } from './factories'
import { invoke, resetHarness } from './harness'
import { noWaits } from './mailRuns'

const flags = vi.hoisted(() => ({ regionOn: false, listsOn: false, sender: 'resend' as 'resend' | 'ses' }))
vi.mock('../../functions/utils/clubs/pages', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/clubs/pages')>()
  return {
    ...real,
    get REGION_EVENTS_ON() {
      return flags.regionOn
    },
  }
})
vi.mock('../../functions/utils/mail/switches', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/mail/switches')>()
  return {
    ...real,
    get MAIL_LISTS_ON() {
      return flags.listsOn
    },
    get MAIL_SENDER() {
      return flags.sender
    },
  }
})

beforeEach(() => {
  resetHarness()
  flags.regionOn = true
  flags.listsOn = false
  flags.sender = 'resend'
  noWaits()
})
afterEach(() => {
  flags.regionOn = false
  vi.restoreAllMocks()
})

const REGION = 'Example Delta Region'
let seq = 0

const remove = (as: string, id: string) => invoke(memberDelete, { method: 'DELETE', as, params: { id } })
const exists = async (id: string) => (await env.DB.prepare('SELECT id FROM members WHERE id = ?').bind(id).first()) !== null
const approverOf = async (id: string) =>
  env.DB.prepare('SELECT approved_by, approved_at IS NOT NULL AS approved FROM tournaments WHERE id = ?').bind(id).first<{ approved_by: string | null; approved: number }>()

/** A representative's draft for a club in the region, marked for approval. */
async function draft(): Promise<string> {
  const n = ++seq
  const club = await seedClub({ name: `Example Chess Club ${n}` })
  await env.DB.prepare('UPDATE clubs SET region = ? WHERE id = ?').bind(REGION, club).run()
  const representative = await seedMember({ fullName: 'Player One', email: `player.one.${n}@example.org` })
  const seat = `seat-approver-${n}`
  await env.DB.prepare("INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active) VALUES (?, 'Example Region Representative', '', 99, ?, 'regional_rep', 1)").bind(seat, seat).run()
  await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(seat, REGION).run()
  await env.DB.prepare('INSERT INTO board_seat_assignments (id, seat_id, member_id) VALUES (?, ?, ?)').bind(`term-${seat}`, seat, representative).run()
  const id = await seedTournament({ name: `Example Winter Open ${n}`, date: '2026-12-12', clubId: club, createdBy: representative, entryFee: 0, sections: [{ name: 'Open', entryFee: 0 }], isVisible: false })
  await env.DB.prepare('UPDATE tournaments SET needs_lca_approval = 1 WHERE id = ?').bind(id).run()
  return id
}

describe('the member delete of an LCA admin who approved through the endpoint', () => {
  it('fails as main fails for any member the activity log names, the member stays, and the event still names its approver', async () => {
    const deleter = await seedAdmin()
    const approver = await seedMember({ role: 'lca_admin', fullName: 'Player Two', email: 'player.two@example.org' })
    const event = await draft()
    expect((await invoke(approval, { method: 'POST', as: approver, params: { id: event }, body: { action: 'approve' } })).status).toBe(200)
    const logged = await env.DB.prepare("SELECT COUNT(*) AS n FROM admin_audit_log WHERE actor_id = ? AND action = 'tournament_approved'").bind(approver).first<{ n: number }>()
    expect(logged?.n).toBe(1)
    expect(await approverOf(event)).toEqual({ approved_by: approver, approved: 1 })

    await expect(remove(deleter, approver)).rejects.toThrow(/FOREIGN KEY constraint failed/)
    expect(await exists(approver)).toBe(true)
    expect(await approverOf(event)).toEqual({ approved_by: approver, approved: 1 })
  })

  it('deletes an approver the activity log does not name: approved_by is cleared and approved_at kept', async () => {
    const deleter = await seedAdmin()
    const approver = await seedMember({ role: 'lca_admin', fullName: 'Player Three', email: 'player.three@example.org' })
    const event = await draft()
    await env.DB.prepare("UPDATE tournaments SET approved_at = '2026-11-16 09:30:00', approved_by = ?, is_visible = 1 WHERE id = ?").bind(approver, event).run()
    const res = await remove(deleter, approver)
    expect(res.status).toBe(200)
    expect(await exists(approver)).toBe(false)
    expect(await env.DB.prepare('SELECT approved_by, approved_at FROM tournaments WHERE id = ?').bind(event).first()).toEqual({ approved_by: null, approved_at: '2026-11-16 09:30:00' })
  })
})

describe('main\'s answer for a member the activity log names', () => {
  it('throws "FOREIGN KEY constraint failed" from the batch, a 500 in the runtime, and keeps the member', async () => {
    const deleter = await seedAdmin()
    const actor = await seedMember({ role: 'club_rep', fullName: 'Player Four', email: 'player.four@example.org' })
    await env.DB.prepare(
      "INSERT INTO admin_audit_log (id, actor_id, actor_email, action, target_label) VALUES ('aud-example-1', ?, 'player.four@example.org', 'club_edit', 'Example Chess Club')",
    ).bind(actor).run()
    await expect(remove(deleter, actor)).rejects.toThrow(/FOREIGN KEY constraint failed/)
    expect(await exists(actor)).toBe(true)
  })

  // main's behaviour today and a known fault, not this checkpoint's: the rows the delete removes one statement at a
  // time go before the batch that fails, so the member stays and their entry is gone. The workstream that puts the
  // whole delete in one batch, or checks the references first, changes this case to find the entry kept.
  it('removes the member\'s entry before the batch fails, so the member stays and the entry is gone (a known fault of main\'s delete)', async () => {
    const deleter = await seedAdmin()
    const actor = await seedMember({ fullName: 'Player Five', email: 'player.five@example.org' })
    const event = await seedTournament({ name: 'Example Spring Swiss', date: '2027-03-13' })
    const entry = await seedRegistration({ tournamentId: event, memberId: actor })
    await env.DB.prepare(
      "INSERT INTO admin_audit_log (id, actor_id, actor_email, action, target_label) VALUES ('aud-example-2', ?, 'player.five@example.org', 'club_edit', 'Example Chess Club')",
    ).bind(actor).run()
    await expect(remove(deleter, actor)).rejects.toThrow(/FOREIGN KEY constraint failed/)
    expect(await exists(actor)).toBe(true)
    expect(await env.DB.prepare('SELECT id FROM registrations WHERE id = ?').bind(entry).first()).toBeNull()
  })
})
