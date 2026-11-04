// test/unit/review-mark-contract.test.ts
//
// The review mark, tournaments.review_notified_at (WS08 step 2), in the
// contracts every tournament answer keeps, with no handler in between:
// - the key sits in the managers' row after requires_lca_membership and
//   before club_name, so every strict tournament answer names it: the list
//   row, the admin answer, the event page's and the manage page's;
// - each takes the mark only as stored time, the "YYYY-MM-DD HH:MM:SS" text
//   SQLite's datetime('now') writes, or null, and refuses any other form of
//   a time; the admin and manage answers must carry it, while the two public
//   answers may leave it out;
// - a tournaments row read whole from a database built by every migration,
//   0059 included, answers to the strict admin contract through
//   toTournamentResponse, the mark passed on as stored or null, and the
//   public row keeps it for the event's managers and leaves it out, without
//   a trace, for anyone else.
import { describe, expect, it } from 'vitest'
import {
  adminTournamentSchema,
  tournamentDetailSchema,
  tournamentListItemSchema,
  tournamentManageResponseSchema,
} from '../../domain/contracts/events'
import { publicTournamentAnswer } from '../../functions/utils/events/publicAnswer'
import { toTournamentResponse } from '../../functions/utils/events/sectionsRepo'
import type { TournamentRow } from '../../functions/types'
import { openMigratedDb } from './helpers/sqlite'

type KeySchema = { safeParse: (value: unknown) => { success: boolean } }
const keyOf = (shape: Record<string, unknown>) => shape.review_notified_at as KeySchema

/** Every strict tournament answer, and whether it must carry the key. */
const ANSWERS: Array<[string, 'required' | 'optional', Record<string, unknown>]> = [
  ['the list row, GET /api/tournaments', 'optional', tournamentListItemSchema.shape],
  ['the event page, GET /api/tournaments/[id]', 'optional', tournamentDetailSchema.shape],
  ['the admin answer of the create, the edit and the registration settings', 'required', adminTournamentSchema.shape],
  ['the manage page, GET /api/admin/tournaments/[id]/manage', 'required', tournamentManageResponseSchema.shape.tournament.shape],
]

/** Times as stored: the form datetime('now') writes, on a Tuesday evening in Louisiana and in the hour the clocks went back. */
const STORED = ['2026-11-04 01:30:00', '2026-11-01 06:30:00', '2026-11-01 07:30:00']
/** Every other way a time could be written, and things that are not times. */
const NOT_STORED: unknown[] = [
  '2026-11-04T01:30:00Z', '2026-11-04T01:30:00.000Z', '2026-11-04T01:30:00', '2026-11-03 19:30:00-06:00',
  '2026-11-04', '2026-11-04 01:30', '01:30:00', 'Tue, Nov 3, 2026', '7:30 PM', '', ' 2026-11-04 01:30:00',
  1793746588826, true, {}, [],
]

describe('review_notified_at in the tournament contracts', () => {
  it('sits after requires_lca_membership and before club_name in the row every tournament answer is built from', () => {
    const keys = Object.keys(tournamentListItemSchema.shape)
    const at = keys.indexOf('review_notified_at')
    expect(keys.slice(at - 1, at + 2)).toEqual(['requires_lca_membership', 'review_notified_at', 'club_name'])
    expect(keys.filter((k) => k === 'review_notified_at')).toHaveLength(1)
    // The admin answer leaves out the club's two columns from the join, so the mark is its last key.
    expect(Object.keys(adminTournamentSchema.shape).slice(-2)).toEqual(['requires_lca_membership', 'review_notified_at'])
  })

  it.each(ANSWERS)('%s takes the mark only as stored time or null', (_label, _presence, shape) => {
    const key = keyOf(shape)
    expect(key, 'the key is named').toBeDefined()
    expect(key.safeParse(null).success).toBe(true)
    for (const value of STORED) expect(key.safeParse(value).success, value).toBe(true)
    for (const value of NOT_STORED) expect(key.safeParse(value).success, JSON.stringify(value)).toBe(false)
  })

  it.each(ANSWERS)('%s: the key is %s', (_label, presence, shape) => {
    expect(keyOf(shape).safeParse(undefined).success).toBe(presence === 'optional')
  })
})

describe('a whole row of the migrated tournaments table, as the handlers answer it', () => {
  const db = openMigratedDb()
  db.exec(`INSERT INTO clubs (id, name, city) VALUES ('club-a', 'Acadiana Knights', 'Lafayette')`)
  db.exec(`INSERT INTO members (id, email, full_name, role) VALUES ('m-td', 'dana.director@example.org', 'Dana Director', 'tournament_director')`)
  const add = db.prepare(`INSERT INTO tournaments (id, name, location, date, entry_fee, club_id, created_by) VALUES (?, ?, 'Lafayette, LA', '2026-12-05', 25, ?, 'm-td')`)
  add.run('marked', 'Lafayette Winter Quads', null)
  add.run('unmarked', 'Acadiana Blitz Night', 'club-a')
  // Published an hour after it was made, so the mark and created_at differ.
  db.exec(`UPDATE tournaments SET review_notified_at = datetime('now', '+1 hour') WHERE id = 'marked'`)
  const rows = Object.fromEntries((db.prepare('SELECT * FROM tournaments').all() as unknown as TournamentRow[]).map((r) => [r.id, r]))
  const answer = (id: string) => toTournamentResponse(rows[id], [], [])

  it('answers to the strict admin contract through toTournamentResponse, the mark passed on as stored or null', () => {
    const mark = rows.marked.review_notified_at
    expect(mark).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    for (const id of ['marked', 'unmarked']) {
      const parsed = adminTournamentSchema.safeParse(answer(id))
      expect(parsed.success, id).toBe(true)
      expect(parsed.data, id).toEqual(answer(id))
    }
    expect(answer('marked').review_notified_at).toBe(mark)
    expect(answer('unmarked').review_notified_at).toBeNull()
  })

  it('keeps the mark in the public row for the event\'s managers, and leaves it out, without a trace, for anyone else', () => {
    const mark = rows.marked.review_notified_at!
    const row = { ...answer('marked'), club_name: null, club_color: null }
    const managers = publicTournamentAnswer(row, true)
    const visitors = publicTournamentAnswer(row, false)
    expect(tournamentListItemSchema.safeParse(managers).success).toBe(true)
    expect(tournamentListItemSchema.safeParse(visitors).success).toBe(true)
    expect(managers.review_notified_at).toBe(mark)
    expect(Object.hasOwn(visitors, 'review_notified_at')).toBe(false)
    expect(JSON.stringify(visitors)).not.toContain(mark)
    expect(JSON.stringify(visitors)).not.toContain('review_notified_at')
    // The row handed in is left as it was.
    expect(row.review_notified_at).toBe(mark)
  })
})
