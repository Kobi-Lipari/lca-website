// test/integration/club-seed-live.test.ts
//
// Migration 0067's seed (WS09 step 5) as the Workers runtime's D1 holds it,
// built from every migration, and the answers that are live with every
// switch off over the seeded rows:
// - the seed's figures hold on D1: 25 distinct slugs, six old addresses,
//   18 statements and seven About texts, 25 first places and one second, the
//   told date on every club and no keeper's name;
// - no seeded text has a doubled apostrophe, the old initials or a dash;
// - the public club list, a public club answer and the admin club answers
//   carry no new column for a seeded club, and the one change a visitor
//   meets is the mended apostrophe in the two clubs' text;
// - an admin deletes a seeded club with two places and an old address, its
//   rows in those tables go with it and no other club's do;
// - a club's rep, a member and a visitor do not delete it, and nothing moves.
// No endpoint is new in this step, so the role cases are those of the delete.
// Every person here is made up.
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { onRequestGet as clubListGet } from '../../functions/api/clubs'
import { onRequestGet as clubGet } from '../../functions/api/clubs/[id]'
import { onRequestDelete as clubDelete, onRequestGet as adminClubGet } from '../../functions/api/admin/clubs/[id]'
import { seedAdmin, seedMember } from './factories'
import { invoke, resetHarness } from './harness'

beforeEach(resetHarness)

/** A long or a short dash, written by code so that this file holds neither. */
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
/** US Chess's old initials, put together so that this file does not hold them. */
const OLD_INITIALS = new RegExp(`\\b${'US' + 'CF'}\\b`)

const TODAYS_13 = [
  'id', 'name', 'city', 'location', 'description', 'meeting_schedule', 'contact_email',
  'created_at', 'color', 'image_url', 'region', 'latitude', 'longitude',
]
const ADDED_15 = [
  'slug', 'about_text', 'how_we_meet_text', 'cost_text', 'welcome_text', 'weekend_play', 'scholastic_friendly', 'contact_name_public',
  'facebook_url', 'website_url', 'other_url', 'told_updated_at', 'told_by', 'last_confirmed_at', 'confirmed_by',
]

const count = async (sql: string, ...args: Array<string | number>) =>
  (await env.DB.prepare(sql).bind(...args).first<{ n: number }>())?.n

describe('the seed on D1', () => {
  it('holds the seed\'s figures', async () => {
    expect(await count('SELECT COUNT(*) AS n FROM clubs')).toBe(25)
    expect(await count('SELECT COUNT(DISTINCT slug) AS n FROM clubs WHERE slug IS NOT NULL')).toBe(25)
    expect(await count('SELECT COUNT(*) AS n FROM club_slug_history')).toBe(6)
    expect(await count('SELECT COUNT(*) AS n FROM clubs WHERE how_we_meet_text IS NOT NULL')).toBe(18)
    expect(await count('SELECT COUNT(*) AS n FROM clubs WHERE about_text IS NOT NULL')).toBe(7)
    expect(await count('SELECT COUNT(*) AS n FROM clubs WHERE how_we_meet_text IS NOT NULL AND about_text IS NOT NULL')).toBe(0)
    expect(await count('SELECT COUNT(*) AS n FROM club_places WHERE sort = 0')).toBe(25)
    expect(await count('SELECT COUNT(*) AS n FROM club_places WHERE sort <> 0')).toBe(1)
    expect(await count('SELECT COUNT(*) AS n FROM club_places WHERE latitude IS NULL OR longitude IS NULL')).toBe(0)
    expect(await count('SELECT COUNT(*) AS n FROM clubs WHERE told_updated_at IS NOT NULL')).toBe(25)
    expect(await count('SELECT COUNT(*) AS n FROM clubs WHERE told_by IS NOT NULL')).toBe(0)
    expect(await count('SELECT COUNT(*) AS n FROM club_slug_history WHERE old_slug IN (SELECT slug FROM clubs)')).toBe(0)
  })

  it('writes the told date as a date and time, so every page reads a month', async () => {
    const { results } = await env.DB.prepare('SELECT told_updated_at AS t FROM clubs').all<{ t: string }>()
    expect(results).toHaveLength(25)
    for (const { t } of results) expect(t).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  })

  it('has no doubled apostrophe, no old initials in a seeded field and no dash of either length', async () => {
    const { results } = await env.DB.prepare(
      `SELECT slug AS t FROM clubs UNION ALL SELECT how_we_meet_text FROM clubs WHERE how_we_meet_text IS NOT NULL
       UNION ALL SELECT about_text FROM clubs WHERE about_text IS NOT NULL
       UNION ALL SELECT name FROM club_places UNION ALL SELECT old_slug FROM club_slug_history`,
    ).all<{ t: string }>()
    expect(results).toHaveLength(25 + 18 + 7 + 26 + 6)
    for (const { t } of results) {
      expect(t).not.toContain('\'\'')
      expect(t).not.toMatch(OLD_INITIALS)
      expect(t).not.toMatch(DASHES)
    }
    expect(await count(`SELECT COUNT(*) AS n FROM clubs WHERE description LIKE '%''''%' OR location LIKE '%''''%'`)).toBe(0)
  })
})

describe('the answers with every switch off, over the seeded clubs', () => {
  it('the public list and a public club answer carry no new column, and the two mended clubs read one apostrophe', async () => {
    const admin = await seedAdmin()
    for (const as of [undefined, admin]) {
      const list = await invoke(clubListGet, { as })
      expect(list.status).toBe(200)
      const listText = await list.response.text()
      expect(listText).not.toContain('\'\'')
      const { clubs } = JSON.parse(listText) as { clubs: Array<Record<string, unknown>> }
      expect(clubs).toHaveLength(25)
      for (const column of ADDED_15) expect(listText, column).not.toContain(`"${column}"`)
      // None of the seeded statements or About texts is read by an answer under a key of its own.
      for (const key of ['how_we_meet_text', 'about_text', 'told_updated_at', 'places']) expect(listText).not.toContain(`"${key}"`)

      for (const [id, description, location] of [
        ['slidell', 'Meets Fridays at 7 PM at St. Luke\'s, 910 Cross Gates Blvd., Slidell, LA 70461, Classroom 3.', 'St. Luke\'s, 910 Cross Gates Blvd., Slidell, LA 70461'],
        ['mandeville-chess-club', 'Meets Mondays at 5:00 PM at George\'s Mexican Restaurant.', 'George\'s Mexican Restaurant, Mandeville, LA'],
      ] as const) {
        const one = await invoke(clubGet, { as, params: { id } })
        expect(one.status, id).toBe(200)
        const text = await one.response.text()
        const { club } = JSON.parse(text) as { club: Record<string, unknown> }
        expect(Object.keys(club), id).toEqual(TODAYS_13)
        expect({ description: club.description, location: club.location }, id).toEqual({ description, location })
        for (const column of ADDED_15) expect(text, `${id} carries ${column}`).not.toContain(`"${column}"`)
      }
    }
  })

  it('a club the seed did not change reads as it did, and carries no new column', async () => {
    const one = await invoke(clubGet, { params: { id: 'houma-chess-club' } })
    expect(one.status).toBe(200)
    const { club } = await one.json<{ club: Record<string, unknown> }>()
    expect(Object.keys(club)).toEqual(TODAYS_13)
    expect(club.description).toBe('Meets Mondays 6:00-8:30 PM at Terrebonne Parish North Library.')
    expect(club.meeting_schedule).toBe('Mondays 6:00-8:30 PM')
  })

  it('the admin club answer for a seeded club carries exactly today\'s 13 keys', async () => {
    const admin = await seedAdmin()
    const res = await invoke(adminClubGet, { as: admin, params: { id: 'shreveport' } })
    expect(res.status).toBe(200)
    const text = await res.response.text()
    expect(Object.keys((JSON.parse(text) as { club: object }).club)).toEqual(TODAYS_13)
    for (const column of ADDED_15) expect(text, column).not.toContain(`"${column}"`)
  })
})

describe('deleting a seeded club', () => {
  const placesOf = (id: string) => count('SELECT COUNT(*) AS n FROM club_places WHERE club_id = ?', id)
  const historyOf = (id: string) => count('SELECT COUNT(*) AS n FROM club_slug_history WHERE club_id = ?', id)

  it('an admin deletes Shreveport-Bossier with its two places and its old address, and no other club loses a row', async () => {
    const admin = await seedAdmin()
    expect(await placesOf('shreveport')).toBe(2)
    expect(await historyOf('shreveport')).toBe(1)
    const res = await invoke(clubDelete, { method: 'DELETE', as: admin, params: { id: 'shreveport' } })
    expect(res.status).toBe(200)
    expect(await count(`SELECT COUNT(*) AS n FROM clubs WHERE id = 'shreveport'`)).toBe(0)
    expect(await placesOf('shreveport')).toBe(0)
    expect(await historyOf('shreveport')).toBe(0)
    expect(await count('SELECT COUNT(*) AS n FROM clubs')).toBe(24)
    expect(await count('SELECT COUNT(*) AS n FROM club_places')).toBe(24)
    expect(await count('SELECT COUNT(*) AS n FROM club_slug_history')).toBe(5)
  })

  it('a club\'s own rep, a member and a visitor are refused, and the club, its places and its old address stay', async () => {
    const rep = await seedMember({ role: 'club_rep', clubId: 'slidell', fullName: 'Club Rep One', email: 'club.rep.one@example.org' })
    const member = await seedMember({ fullName: 'Player One', email: 'player.one@example.org' })
    for (const as of [rep, member, undefined]) {
      const res = await invoke(clubDelete, { method: 'DELETE', as, params: { id: 'slidell' } })
      expect([401, 403]).toContain(res.status)
      expect(await res.response.text()).not.toContain('Slidell Chess Club')
    }
    expect(await count(`SELECT COUNT(*) AS n FROM clubs WHERE id = 'slidell'`)).toBe(1)
    expect(await placesOf('slidell')).toBe(1)
    expect(await historyOf('slidell')).toBe(1)
  })
})
