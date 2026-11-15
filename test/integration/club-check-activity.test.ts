// The activity log's row for a press of "Send this month's check now"
// (WS09 checkpoint U's review): a press that sends, made by an LCA admin
// through POST /api/admin/clubs/monthly-check, writes one row,
// club_monthly_check_sent, with that admin as its actor, the month in words
// as its label and a detail of numbers alone. Asking how many people the
// check goes to writes none, nor does a press that finds nobody left to send
// to, nor any refusal. A row that cannot
// be written never fails the answer of a press that has sent. CLUB_KEEPERS_ON
// is set through a getter on the mocked module, as in
// club-check-emails.test.ts. Every name and address here is made up.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { onRequestPost as checkPost } from '../../functions/api/admin/clubs/monthly-check'
import { CHECK_JOB } from '../../functions/utils/clubs/monthlyCheck'
import { seedAdmin, seedClub, seedMember } from './factories'
import { emailOutbox, invoke, resetHarness } from './harness'
import { countingDb } from './mailRuns'

const flags = vi.hoisted(() => ({ keepersOn: true }))
vi.mock('../../functions/utils/clubs/pages', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/clubs/pages')>()
  return {
    ...real,
    get CLUB_KEEPERS_ON() {
      return flags.keepersOn
    },
  }
})

/** A made-up key, long enough to sign with, used nowhere else. */
const KEY = 'example-made-up-signing-key-for-the-log-0001'
const ACTION = 'club_monthly_check_sent'

let seq = 0
const next = () => `${++seq}-${crypto.randomUUID().slice(0, 6)}`

/** Two holders of a regional seat over a made-up region with one club in it. */
async function twoHolders(): Promise<string[]> {
  const region = `Example Region ${next()}`
  const clubId = await seedClub({ name: 'Example Chess Club', city: 'Example City' })
  await env.DB.prepare('UPDATE clubs SET region = ? WHERE id = ?').bind(region, clubId).run()
  const seat = `seat-${next()}`
  await env.DB.prepare(
    `INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active) VALUES (?, 'Example Region Representative', '', 99, ?, 'regional_rep', 1)`,
  ).bind(seat, seat).run()
  await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(seat, region).run()
  const emails: string[] = []
  for (const name of ['Player One', 'Player Two']) {
    const email = `player-${next()}@example.org`
    const id = await seedMember({ fullName: name, email })
    await env.DB.prepare('INSERT INTO board_seat_assignments (seat_id, member_id, ended_at) VALUES (?, ?, NULL)').bind(seat, id).run()
    emails.push(email)
  }
  return emails
}

const logRows = async () => (await env.DB.prepare('SELECT actor_id, actor_email, action, target_member_id, target_label, detail FROM admin_audit_log WHERE action = ? ORDER BY rowid')
  .bind(ACTION).all<{ actor_id: string; actor_email: string; action: string; target_member_id: string | null; target_label: string | null; detail: string | null }>()).results

beforeEach(async () => {
  resetHarness()
  flags.keepersOn = true
  await env.DB.batch([
    env.DB.prepare('DELETE FROM board_seat_assignments'),
    env.DB.prepare('DELETE FROM club_check_marks'),
    env.DB.prepare('DELETE FROM automation_runs'),
    env.DB.prepare('DELETE FROM admin_audit_log WHERE action = ?').bind(ACTION),
  ])
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('a press that sends writes one row to the activity log', () => {
  it('one press as an LCA admin: exactly one row, that admin as its actor, the month in words, and numbers alone in its detail', async () => {
    const emails = await twoHolders()
    const admin = await seedAdmin()
    const result = await invoke(checkPost, { method: 'POST', as: admin, body: { send: true }, env: { SIGNING_SECRET: KEY } })
    expect(result.status).toBe(200)
    const answer = await result.json<{ month: string; sent: number; notSent: number; notReached: number }>()
    expect(answer).toMatchObject({ people: 2, sent: 2, notSent: 0, notReached: 0 })
    expect(emailOutbox).toHaveLength(2)

    const rows = await logRows()
    expect(rows).toHaveLength(1)
    const [row] = rows
    expect(row.actor_id).toBe(admin)
    expect(row.action).toBe(ACTION)
    expect(row.target_member_id).toBeNull()
    expect(row.target_label).toBe(answer.month)
    expect(row.target_label).toMatch(/^[A-Z][a-z]+ \d{4}$/)
    expect(JSON.parse(row.detail!)).toEqual({ sent: 2, notSent: 0, notReached: 0 })
    // No address, no name of a recipient and no link's token.
    expect(row.detail).not.toContain('@')
    for (const email of emails) expect(`${row.target_label} ${row.detail}`).not.toContain(email)
    expect(`${row.target_label} ${row.detail}`).not.toMatch(/Player|v1\.|token|clubs\/confirm/)
  })

  it('a second press writes a second row, one for each press', async () => {
    await twoHolders()
    const admin = await seedAdmin()
    for (let i = 0; i < 2; i++) {
      expect((await invoke(checkPost, { method: 'POST', as: admin, body: { send: true }, env: { SIGNING_SECRET: KEY } })).status).toBe(200)
    }
    expect((await logRows()).map((r) => r.actor_id)).toEqual([admin, admin])
  })

  it('a row that cannot be written leaves the answer of a press that sent as it was', async () => {
    await twoHolders()
    const admin = await seedAdmin()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { db } = countingDb({ refuse: 'admin_audit_log' })
    const result = await invoke(checkPost, { method: 'POST', as: admin, body: { send: true }, env: { DB: db, SIGNING_SECRET: KEY } })
    expect(result.status).toBe(200)
    expect(await result.json()).toMatchObject({ people: 2, sent: 2, notSent: 0, notReached: 0 })
    expect(emailOutbox).toHaveLength(2)
    expect(await logRows()).toEqual([])
    expect(warn).toHaveBeenCalledWith(`admin audit write failed (${ACTION}):`, expect.any(String))
  })
})

describe('asking, and every refusal, write no row', () => {
  it('an LCA admin who asks how many people writes none', async () => {
    await twoHolders()
    const admin = await seedAdmin()
    const asked = await invoke(checkPost, { method: 'POST', as: admin, body: { send: false }, env: { SIGNING_SECRET: KEY } })
    expect(asked.status).toBe(200)
    expect(await asked.json()).toMatchObject({ people: 2, sent: 0 })
    expect(await logRows()).toEqual([])
    expect(emailOutbox).toHaveLength(0)
  })

  it('a press with nobody left to send to (no seat holder at all) answers 200 with zeros and writes no row', async () => {
    const admin = await seedAdmin()
    const result = await invoke(checkPost, { method: 'POST', as: admin, body: { send: true }, env: { SIGNING_SECRET: KEY } })
    expect(result.status).toBe(200)
    expect(await result.json()).toMatchObject({ people: 0, sent: 0, notSent: 0, notReached: 0 })
    expect(await logRows()).toEqual([])
    expect(emailOutbox).toHaveLength(0)
    const runs = await env.DB.prepare('SELECT COUNT(*) AS n FROM automation_runs WHERE job = ?').bind(CHECK_JOB).first<{ n: number }>()
    expect(runs?.n).toBe(0)
  })

  it('no sign-in, a wrong role, an admin with no second factor, no signing key, and the constant unset: each refused, and none writes a row', async () => {
    await twoHolders()
    const admin = await seedAdmin()
    const member = await seedMember()
    const officer = await seedMember({ role: 'lca_officer' })
    const refusals: Array<[Parameters<typeof invoke>[1], number]> = [
      [{ method: 'POST', body: { send: true }, env: { SIGNING_SECRET: KEY } }, 401],
      [{ method: 'POST', as: member, body: { send: true }, env: { SIGNING_SECRET: KEY } }, 403],
      [{ method: 'POST', as: officer, body: { send: true }, env: { SIGNING_SECRET: KEY } }, 403],
      [{ method: 'POST', as: admin, aal: 'aal1', body: { send: true }, env: { SIGNING_SECRET: KEY } }, 403],
      [{ method: 'POST', as: admin, body: { send: 'yes' }, env: { SIGNING_SECRET: KEY } }, 400],
      [{ method: 'POST', as: admin, body: { send: true }, env: { SIGNING_SECRET: undefined } }, 503],
    ]
    for (const [request, status] of refusals) expect((await invoke(checkPost, request)).status, JSON.stringify(request.body)).toBe(status)
    flags.keepersOn = false
    expect((await invoke(checkPost, { method: 'POST', as: admin, body: { send: true }, env: { SIGNING_SECRET: KEY } })).status).toBe(403)
    expect(await logRows()).toEqual([])
    expect(emailOutbox).toHaveLength(0)
  })
})
