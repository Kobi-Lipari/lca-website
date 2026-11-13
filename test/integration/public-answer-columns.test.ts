// test/integration/public-answer-columns.test.ts
//
// GET /api/clubs/[id] answers the club's columns by name (WS09 step 1):
// - a column added to clubs never reaches the public answer, through the
//   handler or through publicClubAnswer handed a whole row;
// - the answer is today's, byte for byte: a made up club with every column
//   filled, an officer, a listed event and a news item answers the text the
//   handler sent before its select named the columns, and every club the
//   migrations seed answers its row exactly as SELECT * reads it;
// - who asks changes nothing: signed out, a member and an LCA admin get
//   the same 13 keys.
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { clubRowSchema } from '../../domain/contracts'
import { onRequestGet as clubGet } from '../../functions/api/clubs/[id]'
import { PUBLIC_CLUB_COLUMNS, publicClubAnswer } from '../../functions/utils/clubs/publicAnswer'
import { seedAdmin, seedClub, seedMember, seedTournament } from './factories'
import { invoke, resetHarness } from './harness'

beforeEach(resetHarness)

/** Today's 13 columns of clubs, in the table's own order. */
const COLUMNS = [
  'id', 'name', 'city', 'location', 'description', 'meeting_schedule', 'contact_email',
  'created_at', 'color', 'image_url', 'region', 'latitude', 'longitude',
]

/** A column that is not in the list, added for one case and dropped again after it. */
const THROWAWAY = 'throwaway_note'

async function withThrowawayColumn(run: () => Promise<void>): Promise<void> {
  await env.DB.prepare(`ALTER TABLE clubs ADD COLUMN ${THROWAWAY} TEXT`).run()
  try {
    await run()
  } finally {
    await env.DB.prepare(`ALTER TABLE clubs DROP COLUMN ${THROWAWAY}`).run()
  }
}

/** A made up club with every column filled, one officer, one listed event, one hidden draft and one news item. */
async function writeExampleClub(): Promise<string> {
  const id = await seedClub({ id: 'example-chess-club', name: 'Example Chess Club', city: 'Example City' })
  await env.DB.prepare(
    `UPDATE clubs SET
       location = 'Example Hall, 1 Example Street', description = 'A made up club that meets for casual and rated games.',
       meeting_schedule = 'Tuesdays, 7:00 PM to 9:00 PM', contact_email = 'club@example.org', created_at = '2026-10-01 12:00:00',
       color = '#1f3a5f', image_url = 'https://example.org/logo.png', region = 'Example Region', latitude = 30.45, longitude = -91.15
     WHERE id = ?`,
  ).bind(id).run()
  const member = await seedMember({ id: 'player-one', fullName: 'Player One', email: 'player.one@example.org' })
  await env.DB.prepare(`INSERT INTO club_officers (id, club_id, member_id, role) VALUES ('officer-one', ?, ?, 'president')`).bind(id, member).run()
  await seedTournament({ id: 'example-fall-open', name: 'Example Fall Open', date: '2026-10-24', clubId: id, rounds: 4, entryFee: 20, sections: [] })
  await seedTournament({ id: 'example-hidden-draft', name: 'Example Hidden Draft', date: '2026-11-21', clubId: id, isVisible: false, sections: [] })
  await env.DB.prepare(
    `INSERT INTO club_news (id, club_id, title, news_date, excerpt) VALUES ('news-one', ?, 'Example news', '2026-10-15', 'A made up news item.')`,
  ).bind(id).run()
  return id
}

/** The database is kept across the cases of a file, so the made up club is written once, by the first case that asks for it. */
let exampleClub: Promise<string> | undefined
const seedExampleClub = () => (exampleClub ??= writeExampleClub())

/** The handler's answer for that club, as sent, before its select named the columns. */
const STORED =
  '{"club":{"id":"example-chess-club","name":"Example Chess Club","city":"Example City","location":"Example Hall, 1 Example Street",'
  + '"description":"A made up club that meets for casual and rated games.","meeting_schedule":"Tuesdays, 7:00 PM to 9:00 PM",'
  + '"contact_email":"club@example.org","created_at":"2026-10-01 12:00:00","color":"#1f3a5f","image_url":"https://example.org/logo.png",'
  + '"region":"Example Region","latitude":30.45,"longitude":-91.15},'
  + '"officers":[{"id":"officer-one","role":"president","full_name":"Player One"}],'
  + '"tournaments":[{"id":"example-fall-open","name":"Example Fall Open","date":"2026-10-24","end_date":null,"status":"upcoming","entry_fee":20,"sections":[],"rounds":4}],'
  + '"news":[{"id":"news-one","title":"Example news","excerpt":"A made up news item.","news_date":"2026-10-15"}]}'

describe('the public club answer names its columns', () => {
  it('lists today\'s 13 columns, in the order the contract and the table give them', () => {
    expect([...PUBLIC_CLUB_COLUMNS]).toEqual(COLUMNS)
    expect(Object.keys(clubRowSchema.shape)).toEqual(COLUMNS)
  })

  it('a column added to clubs never reaches the public answer', async () => {
    const id = await seedExampleClub()
    await withThrowawayColumn(async () => {
      await env.DB.prepare(`UPDATE clubs SET ${THROWAWAY} = 'not for the public' WHERE id = ?`).bind(id).run()
      const result = await invoke(clubGet, { params: { id } })
      expect(result.status).toBe(200)
      const text = await result.response.text()
      expect(Object.keys((JSON.parse(text) as { club: object }).club)).toEqual(COLUMNS)
      expect(text).not.toContain(THROWAWAY)
      expect(text).not.toContain('not for the public')
    })
  })

  it('keeps only the named keys even of a whole row, and still trims the email when told to', async () => {
    const id = await seedExampleClub()
    await withThrowawayColumn(async () => {
      const row = await env.DB.prepare('SELECT * FROM clubs WHERE id = ?').bind(id).first<Record<string, unknown>>()
      expect(Object.keys(row!)).toEqual([...COLUMNS, THROWAWAY])
      expect(Object.keys(publicClubAnswer(row!, false))).toEqual(COLUMNS)
      expect(Object.keys(publicClubAnswer(row!, true))).toEqual(COLUMNS.filter((c) => c !== 'contact_email'))
      expect(Object.keys(row!)).toEqual([...COLUMNS, THROWAWAY])
    })
  })

  it('gives signed out visitors, a member and an LCA admin the same 13 keys', async () => {
    const id = await seedExampleClub()
    const member = await seedMember()
    const admin = await seedAdmin()
    const bodies: string[] = []
    for (const as of [undefined, member, admin]) {
      const result = await invoke(clubGet, { params: { id }, as })
      expect(result.status, as ?? 'signed out').toBe(200)
      bodies.push(await result.response.text())
    }
    expect(Object.keys((JSON.parse(bodies[0]) as { club: object }).club)).toEqual(COLUMNS)
    expect(new Set(bodies).size).toBe(1)
  })
})

describe('the public club answer names its columns: edges', () => {
  it('keeps a key whose value is null, and leaves out a column whose name only looks like a listed one', async () => {
    const id = await seedClub({ id: 'bare-example-club', name: 'Bare Example Club', city: 'Example Town' })
    await env.DB.prepare('ALTER TABLE clubs ADD COLUMN contact_email_backup TEXT').run()
    await env.DB.prepare('ALTER TABLE clubs ADD COLUMN region_code TEXT').run()
    try {
      await env.DB.prepare(`UPDATE clubs SET contact_email_backup = 'old@example.org', region_code = 'EX' WHERE id = ?`).bind(id).run()
      const result = await invoke(clubGet, { params: { id } })
      expect(result.status).toBe(200)
      const text = await result.response.text()
      const { club } = JSON.parse(text) as { club: Record<string, unknown> }
      expect(Object.keys(club)).toEqual(COLUMNS)
      expect(club).toMatchObject({ location: null, meeting_schedule: null, image_url: null, region: null, latitude: null, longitude: null })
      expect(text).not.toContain('old@example.org')
      expect(text).not.toContain('region_code')
    } finally {
      await env.DB.prepare('ALTER TABLE clubs DROP COLUMN contact_email_backup').run()
      await env.DB.prepare('ALTER TABLE clubs DROP COLUMN region_code').run()
    }
  })

  it('answers a row with no named key as an empty object, and a row of named keys only as the same object', () => {
    expect(publicClubAnswer({ throwaway_note: 'x' }, false)).toEqual({})
    expect(publicClubAnswer({}, true)).toEqual({})
    const given = { id: 'c1', name: 'Example Chess Club' }
    expect(publicClubAnswer(given, false)).toBe(given)
    expect(publicClubAnswer({ ...given, extra: 1 }, false)).toEqual(given)
    expect(publicClubAnswer({ ...given, extra: 1 }, false)).not.toHaveProperty('extra')
  })

  it('keeps the named keys in the row\'s own order, not the list\'s', () => {
    const row = { name: 'Example Chess Club', id: 'c1', extra: 1, city: 'Example City' }
    expect(Object.keys(publicClubAnswer(row, false))).toEqual(['name', 'id', 'city'])
  })

  it('the row contract is strict: a 14th key is refused, the nullable columns take null and the others do not', () => {
    const bare = Object.fromEntries(COLUMNS.map((c) => [c, null])) as Record<string, unknown>
    Object.assign(bare, { id: 'c1', name: 'Example Chess Club', city: 'Example City', created_at: '2026-10-01 12:00:00' })
    expect(clubRowSchema.safeParse(bare).success).toBe(true)
    expect(clubRowSchema.safeParse({ ...bare, throwaway_note: 'x' }).success).toBe(false)
    expect(clubRowSchema.safeParse({ ...bare, name: null }).success).toBe(false)
    expect(clubRowSchema.safeParse({ ...bare, city: null }).success).toBe(false)
  })
})

describe('the public club answer is today\'s, byte for byte', () => {
  it('the answer is today\'s, byte for byte', async () => {
    const id = await seedExampleClub()
    const result = await invoke(clubGet, { params: { id } })
    expect(result.status).toBe(200)
    expect(await result.response.text()).toBe(STORED)
  })

  it('answers every club the migrations seed with its row exactly as SELECT * reads it', async () => {
    const { results } = await env.DB.prepare('SELECT * FROM clubs ORDER BY id').all<Record<string, unknown>>()
    expect(results.length).toBeGreaterThan(20)
    for (const row of results) {
      const result = await invoke(clubGet, { params: { id: String(row.id) } })
      expect(result.status, String(row.id)).toBe(200)
      const body = JSON.parse(await result.response.text()) as { club: unknown }
      expect(JSON.stringify(body.club), String(row.id)).toBe(JSON.stringify(row))
    }
  })

  it('still answers 404 for a club that does not exist', async () => {
    const result = await invoke(clubGet, { params: { id: 'no-such-club' } })
    expect(result.status).toBe(404)
    expect(await result.json()).toEqual({ error: 'Club not found' })
  })
})
