// test/integration/member-delete-club-refs.test.ts
//
// DELETE /api/admin/members/[id] with migration 0066's references to a
// member (WS09 step 4):
// - a member who saved a club's words and confirmed a club, resolved a
//   report, decided a rep request and asked to be a club's rep is deleted:
//   the clubs and the report and the decided request keep their dates and
//   outcomes with no name, the member's own request goes, and the answer is
//   today's text;
// - every other member's references stay as they were;
// - only an LCA admin may delete a member: a club's rep, a member and a
//   visitor are refused and nothing moves;
// - before 0066 has run, each new table or column missing, the delete goes
//   on with one log line that names no member, a real missing table as
//   well; any other failure of the batch is not taken for a missing table.
// Every club, person and address here is made up.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CLUB_REFERENCES_UNCLEARED_LOG, onRequestDelete as memberDelete } from '../../functions/api/admin/members/[id]'
import { laggingDb, MISSING_BEFORE_0066 } from './clubTables'
import { seedAdmin, seedClub, seedMember, seedTournament } from './factories'
import { invoke, resetHarness } from './harness'

beforeEach(resetHarness)
afterEach(() => {
  vi.restoreAllMocks()
})

let seq = 0
const ANSWER = '{"success":true,"authDeleted":false}'
const exists = async (id: string) => (await env.DB.prepare('SELECT id FROM members WHERE id = ?').bind(id).first()) !== null
const remove = (as: string | undefined, id: string, db?: D1Database) =>
  invoke(memberDelete, { method: 'DELETE', as, params: { id }, env: db ? { DB: db } : undefined })

interface Keeper {
  member: string
  saved: string
  confirmed: string
  report: number
  decided: number
  asked: number
}

/** A made up member named in every new place: a club's last save, another's last check, a resolved report, a decided request and a request of their own. */
async function keeper(name: string): Promise<Keeper> {
  const n = ++seq
  const member = await seedMember({ fullName: name, email: `keeper.${n}@example.org` })
  const asker = await seedMember({ fullName: 'Player Two', email: `asker.${n}@example.org` })
  const saved = await seedClub({ id: `example-saved-club-${n}`, name: `Example Saved Club ${n}` })
  const confirmed = await seedClub({ id: `example-confirmed-club-${n}`, name: `Example Confirmed Club ${n}` })
  await env.DB.prepare(`UPDATE clubs SET told_by = ?, told_updated_at = '2026-11-02 18:00:00' WHERE id = ?`).bind(member, saved).run()
  await env.DB.prepare(`UPDATE clubs SET confirmed_by = ?, last_confirmed_at = '2026-11-02 18:05:00' WHERE id = ?`).bind(member, confirmed).run()
  const report = await env.DB.prepare(
    `INSERT INTO club_reports (club_id, kind, field, message, status, resolved_by, resolved_at)
     VALUES (?, 'suggestion', 'when', 'They meet on Tuesdays now.', 'applied', ?, '2026-11-03 17:00:00') RETURNING id`,
  ).bind(saved, member).first<{ id: number }>()
  const decided = await env.DB.prepare(
    `INSERT INTO club_rep_requests (club_id, member_id, connection, status, decided_by, decided_at)
     VALUES (?, ?, 'helps_run_it', 'approved', ?, '2026-11-04 17:00:00') RETURNING id`,
  ).bind(confirmed, asker, member).first<{ id: number }>()
  const asked = await env.DB.prepare(
    `INSERT INTO club_rep_requests (club_id, member_id, connection, note) VALUES (?, ?, 'runs_it', 'A made up note.') RETURNING id`,
  ).bind(saved, member).first<{ id: number }>()
  return { member, saved, confirmed, report: report!.id, decided: decided!.id, asked: asked!.id }
}

/** What the new places hold for one keeper's rows. */
async function heldFor(k: Keeper) {
  return {
    saved: await env.DB.prepare('SELECT told_by, told_updated_at FROM clubs WHERE id = ?').bind(k.saved).first(),
    confirmed: await env.DB.prepare('SELECT confirmed_by, last_confirmed_at FROM clubs WHERE id = ?').bind(k.confirmed).first(),
    report: await env.DB.prepare('SELECT status, resolved_by, resolved_at FROM club_reports WHERE id = ?').bind(k.report).first(),
    decided: await env.DB.prepare('SELECT status, decided_by, decided_at FROM club_rep_requests WHERE id = ?').bind(k.decided).first(),
    asked: await env.DB.prepare('SELECT member_id, status FROM club_rep_requests WHERE id = ?').bind(k.asked).first(),
  }
}

describe('deleting a member named in the club tables', () => {
  it('deletes a member who saved and confirmed a club, resolved a report, decided a request and asked to be a rep, and answers as before', async () => {
    const admin = await seedAdmin()
    const k = await keeper('Player One')
    const res = await remove(admin, k.member)
    expect(res.status).toBe(200)
    expect(await res.response.text()).toBe(ANSWER)
    expect(await exists(k.member)).toBe(false)
    expect(await heldFor(k)).toEqual({
      saved: { told_by: null, told_updated_at: '2026-11-02 18:00:00' },
      confirmed: { confirmed_by: null, last_confirmed_at: '2026-11-02 18:05:00' },
      report: { status: 'applied', resolved_by: null, resolved_at: '2026-11-03 17:00:00' },
      decided: { status: 'approved', decided_by: null, decided_at: '2026-11-04 17:00:00' },
      asked: null,
    })
  })

  it('leaves every other member\'s references as they were', async () => {
    const admin = await seedAdmin()
    const leaving = await keeper('Player One')
    const staying = await keeper('Player Three')
    const before = await heldFor(staying)
    expect((await remove(admin, leaving.member)).status).toBe(200)
    expect(await heldFor(staying)).toEqual(before)
    expect(before.saved).toEqual({ told_by: staying.member, told_updated_at: '2026-11-02 18:00:00' })
    expect(before.asked).toEqual({ member_id: staying.member, status: 'open' })
  })

  it('keeps every club reference of a member whose own delete still fails, as one batch', async () => {
    // tournaments.created_by names a member with no delete action and the
    // delete has never cleared it, so a member who made an event still cannot
    // be deleted; the batch keeps the club tables as they were.
    const admin = await seedAdmin()
    const k = await keeper('Player Ten')
    await seedTournament({ name: 'Example Fall Open', date: '2026-10-24', createdBy: k.member })
    const before = await heldFor(k)
    expect(before.asked).toEqual({ member_id: k.member, status: 'open' })
    await expect(remove(admin, k.member)).rejects.toThrow(/FOREIGN KEY constraint failed/)
    expect(await exists(k.member)).toBe(true)
    expect(await heldFor(k)).toEqual(before)
  })

  it('deletes a member the club tables do not name as before', async () => {
    const admin = await seedAdmin()
    const plain = await seedMember({ fullName: 'Player Four', email: 'player.four@example.org' })
    const res = await remove(admin, plain)
    expect(res.status).toBe(200)
    expect(await res.response.text()).toBe(ANSWER)
    expect(await exists(plain)).toBe(false)
  })
})

describe('who may delete a member', () => {
  it('refuses a club\'s rep, a member and a visitor, and moves no row', async () => {
    const k = await keeper('Player One')
    const clubId = await seedClub({ name: 'Example Rep Club' })
    const rep = await seedMember({ role: 'club_rep', clubId, fullName: 'Club Rep One', email: 'club.rep.one@example.org' })
    const plain = await seedMember({ fullName: 'Player Five', email: 'player.five@example.org' })
    const before = await heldFor(k)
    for (const [who, as, status] of [['a club\'s rep', rep, 403], ['a member', plain, 403], ['a visitor', undefined, 401]] as const) {
      const res = await remove(as, k.member)
      expect(res.status, who).toBe(status)
    }
    expect(await exists(k.member)).toBe(true)
    expect(await heldFor(k)).toEqual(before)
  })
})

describe('before migration 0066 has run', () => {
  it('goes on with one log line, naming no member, whichever new table or column is missing', async () => {
    const admin = await seedAdmin()
    // The four of 0066's tables and columns the member delete writes to.
    const written = MISSING_BEFORE_0066.filter((m) => ['club_reports', 'club_rep_requests', 'told_by', 'confirmed_by'].includes(m.name))
    expect(written).toHaveLength(4)
    for (const missing of written) {
      const email = `lagging.${++seq}@example.org`
      const member = await seedMember({ fullName: 'Player Six', email })
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const res = await remove(admin, member, laggingDb(missing))
      expect(res.status, missing.name).toBe(200)
      expect(await res.response.text(), missing.name).toBe(ANSWER)
      // The sign-in service's own line about the account, today's, is left out: only the club tables' line is this step's.
      const lines = warn.mock.calls.filter(([line]) => typeof line === 'string' && line.startsWith('member delete: '))
      expect(lines, missing.name).toEqual([[CLUB_REFERENCES_UNCLEARED_LOG]])
      expect(JSON.stringify(lines), missing.name).not.toContain(email)
      expect(JSON.stringify(lines), missing.name).not.toContain(member)
      expect(await exists(member), missing.name).toBe(false)
      warn.mockRestore()
    }
  })

  it('takes the error a really missing table gives for the same, and writes no log line when the tables are there', async () => {
    const admin = await seedAdmin()
    const member = await seedMember({ fullName: 'Player Seven', email: 'player.seven@example.org' })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await env.DB.prepare('ALTER TABLE club_rep_requests RENAME TO club_rep_requests_set_aside').run()
    try {
      expect((await remove(admin, member)).status).toBe(200)
    } finally {
      await env.DB.prepare('ALTER TABLE club_rep_requests_set_aside RENAME TO club_rep_requests').run()
    }
    expect(warn.mock.calls.filter(([line]) => line === CLUB_REFERENCES_UNCLEARED_LOG)).toHaveLength(1)
    expect(await exists(member)).toBe(false)
    warn.mockClear()
    const k = await keeper('Player Eight')
    expect((await remove(admin, k.member)).status).toBe(200)
    expect(warn.mock.calls.map(([line]) => line)).not.toContain(CLUB_REFERENCES_UNCLEARED_LOG)
  })

  it('does not take another failure of the batch for a missing table: the delete stops and the member stays', async () => {
    const admin = await seedAdmin()
    const k = await keeper('Player Nine')
    const db = env.DB
    const failing = {
      prepare: (sql: string) => db.prepare(sql),
      batch: async () => {
        throw new Error('D1_ERROR: database is locked: SQLITE_BUSY')
      },
      exec: (sql: string) => db.exec(sql),
      dump: () => db.dump(),
    } as unknown as D1Database
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await expect(remove(admin, k.member, failing)).rejects.toThrow(/database is locked/)
    expect(warn).not.toHaveBeenCalled()
    expect(await exists(k.member)).toBe(true)
    expect((await heldFor(k)).saved).toEqual({ told_by: k.member, told_updated_at: '2026-11-02 18:00:00' })
  })
})
