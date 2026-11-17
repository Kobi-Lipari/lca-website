// test/integration/club-delete.test.ts
//
// DELETE /api/admin/clubs/[id] with migration 0066's tables (WS09 step 4):
// - a club with two places, an old slug, a report and a rep request is
//   deleted, its rows in the four tables with it, and every other club's
//   rows stay; its members and events keep their rows with no club, as
//   before, and the answer is today's text;
// - only an LCA admin may delete a club: a club's own rep, the region's
//   representative, a member and a visitor are refused and nothing moves;
// - before 0066 has run, each of the four tables missing, the delete goes
//   on with one log line that names no club, a real missing table as well;
//   any other failure of the batch is not taken for a missing table;
// - a club that owns a mail list still cannot be deleted, as before, which
//   is a follow-up for the mail work.
// Every club, person and address here is made up.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CLUB_ROWS_UNCLEARED_LOG, onRequestDelete as clubDelete } from '../../functions/api/admin/clubs/[id]'
import { clubRowCounts, giveClubRows, laggingDb, MISSING_BEFORE_0066 } from './clubTables'
import { seedAdmin, seedClub, seedMember, seedTournament } from './factories'
import { invoke, resetHarness } from './harness'

beforeEach(resetHarness)
afterEach(() => {
  vi.restoreAllMocks()
})

let seq = 0
const NONE = { club_places: 0, club_slug_history: 0, club_reports: 0, club_rep_requests: 0 }
const ONE_EACH = { club_places: 2, club_slug_history: 1, club_reports: 1, club_rep_requests: 1 }
const clubExists = async (id: string) => (await env.DB.prepare('SELECT id FROM clubs WHERE id = ?').bind(id).first()) !== null
const remove = (as: string | undefined, id: string, db?: D1Database) =>
  invoke(clubDelete, { method: 'DELETE', as, params: { id }, env: db ? { DB: db } : undefined })

/** An active regional seat for the region, held by the member. */
async function regionalSeat(memberId: string, region: string): Promise<void> {
  const id = `seat-${crypto.randomUUID().slice(0, 8)}`
  await env.DB.prepare(
    `INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active)
     VALUES (?, 'Example Region Representative', '', 99, ?, 'regional_rep', 1)`,
  ).bind(id, id).run()
  await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(id, region).run()
  await env.DB.prepare('INSERT INTO board_seat_assignments (seat_id, member_id) VALUES (?, ?)').bind(id, memberId).run()
}

/** A made up club with a row in each of the four tables, a member, an event, an officer and a news item. */
async function fullClub(): Promise<{ clubId: string; member: string; tournament: string }> {
  const n = ++seq
  const clubId = await seedClub({ id: `example-delete-club-${n}`, name: `Example Delete Club ${n}`, city: 'Example City' })
  await env.DB.prepare('UPDATE clubs SET slug = ? WHERE id = ?').bind(clubId, clubId).run()
  const member = await seedMember({ fullName: 'Player One', email: `player.one.${n}@example.org`, clubId })
  const tournament = await seedTournament({ clubId, name: 'Example Fall Open', date: '2026-10-24' })
  await env.DB.prepare(`INSERT INTO club_officers (id, club_id, member_id, role) VALUES (?, ?, ?, 'president')`).bind(`officer-${n}`, clubId, member).run()
  await env.DB.prepare(`INSERT INTO club_news (id, club_id, title, news_date, excerpt) VALUES (?, ?, 'Example news', '2026-10-15', 'A made up news item.')`).bind(`news-${n}`, clubId).run()
  await giveClubRows(clubId, member, `example-old-address-${n}`)
  return { clubId, member, tournament }
}

describe('deleting a club with rows in the four new tables', () => {
  it('deletes a club with places, an old slug, a report and a rep request, and answers as before', async () => {
    const admin = await seedAdmin()
    const { clubId, member, tournament } = await fullClub()
    expect(await clubRowCounts(clubId)).toEqual(ONE_EACH)
    const res = await remove(admin, clubId)
    expect(res.status).toBe(200)
    expect(await res.response.text()).toBe('{"success":true}')
    expect(await clubExists(clubId)).toBe(false)
    expect(await clubRowCounts(clubId)).toEqual(NONE)
    expect(await env.DB.prepare('SELECT club_id FROM members WHERE id = ?').bind(member).first()).toEqual({ club_id: null })
    expect(await env.DB.prepare('SELECT club_id FROM tournaments WHERE id = ?').bind(tournament).first()).toEqual({ club_id: null })
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM club_slug_history WHERE old_slug = ?').bind(`example-old-address-${seq}`).first()).toEqual({ n: 0 })
  })

  it('leaves every other club\'s rows, and the member who asked to be a rep, as they were', async () => {
    const admin = await seedAdmin()
    const leaving = await fullClub()
    const staying = await fullClub()
    const res = await remove(admin, leaving.clubId)
    expect(res.status).toBe(200)
    expect(await clubRowCounts(staying.clubId)).toEqual(ONE_EACH)
    expect(await clubExists(staying.clubId)).toBe(true)
    expect(await env.DB.prepare('SELECT id FROM members WHERE id = ?').bind(leaving.member).first()).toEqual({ id: leaving.member })
  })

  it('deletes a club with none of the new rows as before, and answers 404 for a club that is not there', async () => {
    const admin = await seedAdmin()
    const clubId = await seedClub({ id: 'example-bare-club', name: 'Example Bare Club' })
    const res = await remove(admin, clubId)
    expect(res.status).toBe(200)
    expect(await res.response.text()).toBe('{"success":true}')
    expect(await clubExists(clubId)).toBe(false)
    const missing = await remove(admin, 'no-such-club')
    expect(missing.status).toBe(404)
    expect(await missing.json()).toEqual({ error: 'Club not found' })
  })
})

describe('who may delete a club', () => {
  it('refuses the club\'s own rep, the region\'s representative, a member and a visitor, and moves no row', async () => {
    const { clubId } = await fullClub()
    await env.DB.prepare(`UPDATE clubs SET region = 'Bayou Region' WHERE id = ?`).bind(clubId).run()
    const rep = await seedMember({ role: 'club_rep', clubId, fullName: 'Club Rep One', email: 'club.rep.one@example.org' })
    const representative = await seedMember({ fullName: 'Player Two', email: 'player.two@example.org' })
    await regionalSeat(representative, 'Bayou Region')
    const plain = await seedMember({ fullName: 'Player Three', email: 'player.three@example.org' })
    for (const [who, as, status] of [['the club\'s rep', rep, 403], ['the region\'s representative', representative, 403], ['a member', plain, 403], ['a visitor', undefined, 401]] as const) {
      const res = await remove(as, clubId)
      expect(res.status, who).toBe(status)
    }
    expect(await clubExists(clubId)).toBe(true)
    expect(await clubRowCounts(clubId)).toEqual(ONE_EACH)
  })
})

describe('before migration 0066 has run', () => {
  it('goes on with one log line, naming no club, whichever of the four tables is missing', async () => {
    const admin = await seedAdmin()
    for (const missing of MISSING_BEFORE_0066.filter((m) => m.kind === 'table')) {
      const clubId = await seedClub({ name: 'Example Lagging Club' })
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const res = await remove(admin, clubId, laggingDb(missing))
      expect(res.status, missing.name).toBe(200)
      expect(await res.response.text(), missing.name).toBe('{"success":true}')
      expect(warn.mock.calls, missing.name).toEqual([[CLUB_ROWS_UNCLEARED_LOG]])
      expect(JSON.stringify(warn.mock.calls)).not.toContain(clubId)
      expect(await clubExists(clubId), missing.name).toBe(false)
      warn.mockRestore()
    }
  })

  it('takes the error a really missing table gives for the same, and writes no log line when the tables are there', async () => {
    const admin = await seedAdmin()
    const clubId = await seedClub({ name: 'Example Lagging Club' })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await env.DB.prepare('ALTER TABLE club_places RENAME TO club_places_set_aside').run()
    try {
      const res = await remove(admin, clubId)
      expect(res.status).toBe(200)
    } finally {
      await env.DB.prepare('ALTER TABLE club_places_set_aside RENAME TO club_places').run()
    }
    expect(warn.mock.calls).toEqual([[CLUB_ROWS_UNCLEARED_LOG]])
    expect(await clubExists(clubId)).toBe(false)
    warn.mockClear()
    const { clubId: full } = await fullClub()
    expect((await remove(admin, full)).status).toBe(200)
    expect(warn).not.toHaveBeenCalled()
  })

  it('does not take another failure of the batch for a missing table: the delete stops and the club stays', async () => {
    const admin = await seedAdmin()
    const { clubId } = await fullClub()
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
    await expect(remove(admin, clubId, failing)).rejects.toThrow(/database is locked/)
    expect(warn).not.toHaveBeenCalled()
    expect(await clubExists(clubId)).toBe(true)
    expect(await clubRowCounts(clubId)).toEqual(ONE_EACH)
  })
})

describe('a club that owns a mail list', () => {
  it('still cannot be deleted, as before 0066, so the mail work owns that follow-up, and keeps its rows in the four tables', async () => {
    const admin = await seedAdmin()
    const { clubId } = await fullClub()
    await env.DB.prepare(`INSERT INTO mail_lists (id, kind, name, club_id) VALUES (?, 'club', 'Example Delete Club list', ?)`).bind(`list-${clubId}`, clubId).run()
    try {
      await expect(remove(admin, clubId)).rejects.toThrow(/FOREIGN KEY constraint failed/)
      expect(await clubExists(clubId)).toBe(true)
      // The four tables go in one batch with the club, so the failed delete leaves them all.
      expect(await clubRowCounts(clubId)).toEqual(ONE_EACH)
    } finally {
      await env.DB.prepare('DELETE FROM mail_lists WHERE id = ?').bind(`list-${clubId}`).run()
    }
  })
})
