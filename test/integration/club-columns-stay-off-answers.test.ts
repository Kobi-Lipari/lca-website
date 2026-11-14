// test/integration/club-columns-stay-off-answers.test.ts
//
// With migration 0066's fifteen club columns filled, no answer that is live
// with every switch off carries one (WS09 step 4, acceptance criterion 6):
// - the public club list and a public club answer, a search, and the admin
//   member list that joins clubs, carry no new column and none of its text;
// - the three admin club answers (GET and PATCH of one club, POST of a new
//   one) carry exactly the 13 keys they carried before the migration, for an
//   LCA admin and for a club's own rep;
// - a rename by an admin keeps the club's id and slug, as a slug is made once,
//   and writes no old slug;
// - nothing here reads a slug: a club whose slug is NULL, as every club is
//   until step 5 fills them, is answered, searched, renamed and listed as
//   before.
// Every club, person and address here is made up.
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { onRequestGet as clubListGet } from '../../functions/api/clubs'
import { onRequestGet as clubGet } from '../../functions/api/clubs/[id]'
import { onRequestPost as adminClubCreate } from '../../functions/api/admin/clubs'
import { onRequestGet as adminClubGet, onRequestPatch as adminClubPatch } from '../../functions/api/admin/clubs/[id]'
import { onRequestGet as adminMembersGet } from '../../functions/api/admin/members'
import { answerSearch } from '../../functions/utils/search'
import { seedAdmin, seedClub, seedMember } from './factories'
import { invoke, resetHarness } from './harness'

beforeEach(resetHarness)

const TODAYS_13 = [
  'id', 'name', 'city', 'location', 'description', 'meeting_schedule', 'contact_email',
  'created_at', 'color', 'image_url', 'region', 'latitude', 'longitude',
]
const ADDED_15 = [
  'slug', 'about_text', 'how_we_meet_text', 'cost_text', 'welcome_text', 'weekend_play', 'scholastic_friendly', 'contact_name_public',
  'facebook_url', 'website_url', 'other_url', 'told_updated_at', 'told_by', 'last_confirmed_at', 'confirmed_by',
]
/** The words the new columns hold, so a leak shows as text as well as a key. */
const SENTINELS = [
  'sentinel-slug', 'Sentinel about words', 'Sentinel how we meet words', 'Sentinel cost words', 'Sentinel welcome words',
  'Sentinel Contact Name', 'https://facebook.example.org/sentinel', 'https://sentinel.example.org', 'https://other.example.org/sentinel',
  '2026-11-02 18:00:00', '2026-11-02 18:05:00',
]

/** A made up club with every one of the 15 new columns filled, and the two members its told_by and confirmed_by name. */
async function filledClub(id: string, name: string) {
  const saver = await seedMember({ fullName: 'Player One', email: `saver.${id}@example.org` })
  const checker = await seedMember({ fullName: 'Player Two', email: `checker.${id}@example.org` })
  await seedClub({ id, name, city: 'Example City' })
  await env.DB.prepare(
    `UPDATE clubs SET slug = ?, about_text = ?, how_we_meet_text = ?, cost_text = ?, welcome_text = ?, weekend_play = 1,
       scholastic_friendly = 1, contact_name_public = ?, facebook_url = ?, website_url = ?, other_url = ?,
       told_updated_at = ?, told_by = ?, last_confirmed_at = ?, confirmed_by = ?, region = 'Example Region'
     WHERE id = ?`,
  ).bind(`${SENTINELS[0]}-${id}`, SENTINELS[1], SENTINELS[2], SENTINELS[3], SENTINELS[4], SENTINELS[5], SENTINELS[6], SENTINELS[7], SENTINELS[8],
    SENTINELS[9], saver, SENTINELS[10], checker, id).run()
  return { saver, checker }
}

/** Fails when a key or a word of the new columns is anywhere in the text. */
function expectNoNewColumn(text: string, label: string) {
  for (const column of ADDED_15) expect(text, `${label} carries "${column}"`).not.toContain(`"${column}"`)
  for (const word of SENTINELS) expect(text, `${label} carries ${word}`).not.toContain(word)
}

describe('the answers live with every switch off, with the 15 new columns filled', () => {
  it('the public club list and a public club answer carry no new column, for a visitor and an admin', async () => {
    const admin = await seedAdmin()
    await filledClub('example-filled-club', 'Example Filled Club')
    for (const as of [undefined, admin]) {
      const list = await invoke(clubListGet, { as })
      expect(list.status).toBe(200)
      expectNoNewColumn(await list.response.text(), 'GET /api/clubs')
      const one = await invoke(clubGet, { as, params: { id: 'example-filled-club' } })
      expect(one.status).toBe(200)
      const text = await one.response.text()
      expectNoNewColumn(text, 'GET /api/clubs/[id]')
      expect(Object.keys((JSON.parse(text) as { club: object }).club)).toEqual(TODAYS_13)
    }
  })

  it('a search that finds the club, and the admin member list that joins clubs, carry no new column', async () => {
    const admin = await seedAdmin()
    const { saver } = await filledClub('example-searched-club', 'Example Searched Club')
    const found = await invoke((context) => answerSearch(context, null), { path: '/api/search?q=Example%20Searched', as: admin })
    expect(found.status).toBe(200)
    const searchText = await found.response.text()
    expect(searchText).toContain('Example Searched Club')
    expectNoNewColumn(searchText, 'GET /api/search')
    await env.DB.prepare('UPDATE members SET club_id = ? WHERE id = ?').bind('example-searched-club', saver).run()
    const members = await invoke(adminMembersGet, { as: admin })
    expect(members.status).toBe(200)
    const memberText = await members.response.text()
    expect(memberText).toContain('Example Searched Club')
    expectNoNewColumn(memberText, 'GET /api/admin/members')
  })

  it('the admin club answers, GET and PATCH, carry exactly today\'s 13 keys for an admin and for the club\'s own rep', async () => {
    const admin = await seedAdmin()
    await filledClub('example-admin-club', 'Example Admin Club')
    const rep = await seedMember({ role: 'club_rep', clubId: 'example-admin-club', fullName: 'Club Rep One', email: 'club.rep.one@example.org' })
    for (const as of [admin, rep]) {
      const get = await invoke(adminClubGet, { as, params: { id: 'example-admin-club' } })
      expect(get.status).toBe(200)
      const getText = await get.response.text()
      expectNoNewColumn(getText, 'GET /api/admin/clubs/[id]')
      expect(Object.keys((JSON.parse(getText) as { club: object }).club)).toEqual(TODAYS_13)
      const patch = await invoke(adminClubPatch, {
        method: 'PATCH', as, params: { id: 'example-admin-club' },
        body: { name: 'Example Admin Club', description: `Example words from ${as === admin ? 'an admin' : 'a rep'}.` },
      })
      expect(patch.status).toBe(200)
      const patchText = await patch.response.text()
      expectNoNewColumn(patchText, 'PATCH /api/admin/clubs/[id]')
      expect(Object.keys((JSON.parse(patchText) as { club: object }).club)).toEqual(TODAYS_13)
    }
  })

  it('a club made by an admin answers exactly today\'s 13 keys, and its new columns stay at their defaults', async () => {
    const admin = await seedAdmin()
    const res = await invoke(adminClubCreate, { method: 'POST', as: admin, body: { name: 'Example Brand New Club', city: 'Example City' } })
    expect(res.status).toBe(201)
    const text = await res.response.text()
    expectNoNewColumn(text, 'POST /api/admin/clubs')
    expect(Object.keys((JSON.parse(text) as { club: object }).club)).toEqual(TODAYS_13)
    const row = await env.DB.prepare(`SELECT ${ADDED_15.join(', ')} FROM clubs WHERE id = 'example-brand-new-club'`).first<Record<string, unknown>>()
    expect(row).toEqual({
      slug: 'example-brand-new-club', about_text: null, how_we_meet_text: null, cost_text: null, welcome_text: null, weekend_play: 0,
      scholastic_friendly: 0, contact_name_public: null, facebook_url: null, website_url: null, other_url: null, told_updated_at: null,
      told_by: null, last_confirmed_at: null, confirmed_by: null,
    })
  })
})

describe('a slug is made once and kept on rename', () => {
  it('an admin\'s rename keeps the club\'s id and slug and writes no old slug', async () => {
    const admin = await seedAdmin()
    await seedClub({ id: 'example-renamed-club', name: 'Example Renamed Club' })
    await env.DB.prepare(`UPDATE clubs SET slug = 'example-renamed-club' WHERE id = 'example-renamed-club'`).run()
    const res = await invoke(adminClubPatch, {
      method: 'PATCH', as: admin, params: { id: 'example-renamed-club' }, body: { name: 'Example Knights of the Board' },
    })
    expect(res.status).toBe(200)
    expect(await env.DB.prepare(`SELECT id, name, slug FROM clubs WHERE name = 'Example Knights of the Board'`).first())
      .toEqual({ id: 'example-renamed-club', name: 'Example Knights of the Board', slug: 'example-renamed-club' })
    expect(await env.DB.prepare(`SELECT COUNT(*) AS n FROM club_slug_history WHERE club_id = 'example-renamed-club'`).first()).toEqual({ n: 0 })
  })

  it('a rename to a name another club\'s slug would come from changes no slug, and a later new club of the old name still gets a suffix', async () => {
    const admin = await seedAdmin()
    await seedClub({ id: 'example-first-club', name: 'Example First Club' })
    await env.DB.prepare(`UPDATE clubs SET slug = 'example-first-club' WHERE id = 'example-first-club'`).run()
    await invoke(adminClubPatch, { method: 'PATCH', as: admin, params: { id: 'example-first-club' }, body: { name: 'Example Second Club' } })
    expect(await env.DB.prepare(`SELECT slug FROM clubs WHERE id = 'example-first-club'`).first()).toEqual({ slug: 'example-first-club' })
    const created = await invoke(adminClubCreate, { method: 'POST', as: admin, body: { name: 'Example First Club', city: 'Example City' } })
    expect(created.status).toBe(201)
    expect((await created.json<{ club: { id: string } }>()).club.id).toBe('example-first-club-2')
  })

  it('a club with no slug yet, as every club is until step 5 fills them, is read, renamed and answered as before', async () => {
    const admin = await seedAdmin()
    await seedClub({ id: 'example-no-slug-club', name: 'Example No Slug Club' })
    expect(await env.DB.prepare(`SELECT slug FROM clubs WHERE id = 'example-no-slug-club'`).first()).toEqual({ slug: null })
    expect((await invoke(clubGet, { params: { id: 'example-no-slug-club' } })).status).toBe(200)
    expect((await invoke(adminClubGet, { as: admin, params: { id: 'example-no-slug-club' } })).status).toBe(200)
    const renamed = await invoke(adminClubPatch, { method: 'PATCH', as: admin, params: { id: 'example-no-slug-club' }, body: { name: 'Example Other Name' } })
    expect(renamed.status).toBe(200)
    expect(await env.DB.prepare(`SELECT slug FROM clubs WHERE id = 'example-no-slug-club'`).first()).toEqual({ slug: null })
  })
})
