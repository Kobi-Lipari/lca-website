// test/integration/club-save-pictures.test.ts
//
// What the pictures of checkpoint T's pages showed of the keepers' save, held
// against the real handlers with CLUB_KEEPERS_ON set. Migration 0067 stamps
// told_updated_at on every club and leaves told_by and last_confirmed_at
// empty, so the GET answers a club no keeper has saved with a stamp and no
// saver, which Your club's page reads as no save; a keeper's save answers
// with its saver and its check, and the saver's later delete clears the
// saver and keeps the check, so that save still reads as one. And, as built
// by K's choice 3 (a), the first save of a seeded club, even one that
// changes only the contact name, puts the listing's words on today's page:
// the record says so, and the box beside today's words says so before the
// press. CLUB_KEEPERS_ON is read through a getter on the mocked module, as
// test/integration/club-save-leftovers.test.ts reads it. Every club, region
// and person here is made up; each case makes its own region.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { onRequestGet as adminClubGet, onRequestPatch as adminClubPatch } from '../../functions/api/admin/clubs/[id]'
import { onRequestDelete as memberDelete } from '../../functions/api/admin/members/[id]'
import { flushWaitUntil, invoke, resetHarness } from './harness'
import { seedAdmin, seedClub, seedMember } from './factories'

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

beforeEach(() => {
  resetHarness()
  flags.keepersOn = true
})
afterEach(async () => {
  await flushWaitUntil()
  flags.keepersOn = false
})

/** The seed's stamp, written as migration 0067's part (f) writes it: told_updated_at alone. */
const SEED_STAMP = '2026-11-14 14:35:00'

/** A made up club as migration 0067 leaves one: today's short lines, the listing's longer words, one place and the stamp with no saver. */
async function seededClub() {
  const region = `Example Region ${crypto.randomUUID().slice(0, 8)}`
  const clubId = await seedClub({ name: 'Example Chess Club', city: 'Example City' })
  await env.DB.prepare(
    `UPDATE clubs SET region = ?, description = ?, meeting_schedule = ?, location = ?, about_text = ?, how_we_meet_text = ?,
       contact_name_public = ?, told_updated_at = ? WHERE id = ?`,
  ).bind(
    region, 'A made up club.', 'Fridays 7:00 PM', 'Example Library',
    'A made up club that meets every Friday.', 'Fridays at 7:00 PM at Example Library, Room 3.', 'Player One', SEED_STAMP, clubId,
  ).run()
  await env.DB.prepare(`INSERT INTO club_places (club_id, name, sort) VALUES (?, 'Example Library', 0)`).bind(clubId).run()
  const rep = await seedMember({ role: 'club_rep', clubId, fullName: 'Club Rep One', email: `rep.${clubId}@example.org` })
  const admin = await seedAdmin()
  return { clubId, rep, admin }
}

const get = (as: string, clubId: string) => invoke(adminClubGet, { as, aal: 'aal2', params: { id: clubId } })
const patch = (as: string, clubId: string, body: unknown) => invoke(adminClubPatch, { method: 'PATCH', as, aal: 'aal2', params: { id: clubId }, body })
const row = (clubId: string) => env.DB.prepare('SELECT * FROM clubs WHERE id = ?').bind(clubId).first<Record<string, unknown>>()

describe('the last save, as the GET and the save answer it, with CLUB_KEEPERS_ON set', () => {
  it('answers a seeded club with the stamp and no saver, a keeper\'s save with its saver and its check, and keeps the check once the saver is deleted', async () => {
    const { clubId, rep, admin } = await seededClub()
    const before = await get(rep, clubId)
    expect(before.status).toBe(200)
    const seeded = (await before.json() as { club: Record<string, unknown> }).club
    expect(seeded).toMatchObject({ told_updated_at: SEED_STAMP, told_by: null, last_confirmed_at: null, confirmed_by: null })

    const saved = await patch(rep, clubId, { contactNamePublic: 'Player Four', toldUpdatedAt: SEED_STAMP })
    expect(saved.status).toBe(200)
    const club = (await saved.json() as { club: Record<string, unknown> }).club
    expect(club.told_by).toBe(rep)
    expect(club.confirmed_by).toBe(rep)
    expect(club.last_confirmed_at).toBe(club.told_updated_at)
    expect(club.told_updated_at).not.toBe(SEED_STAMP)

    // An LCA admin deletes the rep's account: the saver's name goes, the dates stay. The activity log's
    // rows name their actor by a reference with no delete action, so the rep's own rows go first, as
    // they must for any member who has one today.
    await env.DB.prepare('DELETE FROM admin_audit_log WHERE actor_id = ?').bind(rep).run()
    expect((await invoke(memberDelete, { method: 'DELETE', as: admin, aal: 'aal2', params: { id: rep } })).status).toBe(200)
    expect(await row(clubId)).toMatchObject({ told_by: null, confirmed_by: null, told_updated_at: club.told_updated_at, last_confirmed_at: club.last_confirmed_at })
  })
})

describe('what a first save of a seeded club does to today\'s page, as built by K\'s choice 3 (a)', () => {
  it('puts the listing\'s words for how the club meets and its About on today\'s page, even when only the contact name changed', async () => {
    const { clubId, rep } = await seededClub()
    // The editor sends the five basics on every press, the unchanged ones among them.
    const res = await patch(rep, clubId, {
      aboutText: 'A made up club that meets every Friday.', howWeMeetText: 'Fridays at 7:00 PM at Example Library, Room 3.', contactNamePublic: 'Player Four',
      places: [{ name: 'Example Library' }], toldUpdatedAt: SEED_STAMP,
    })
    expect(res.status).toBe(200)
    expect(await row(clubId)).toMatchObject({
      contact_name_public: 'Player Four',
      description: 'A made up club that meets every Friday.',
      meeting_schedule: 'Fridays at 7:00 PM at Example Library, Room 3.',
      location: 'Example Library',
    })
  })
})
