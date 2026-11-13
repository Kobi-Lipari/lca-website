// test/integration/club-save.test.ts
//
// The keepers' save of a club's listing and of its places (WS09 step 6),
// through the real handlers: PATCH and GET /api/admin/clubs/[id] and PUT
// /api/admin/clubs/[id]/places. CLUB_KEEPERS_ON is false in the tree; here it
// is read through a getter on the mocked module, as the comment in
// functions/utils/clubs/pages.ts describes, set for most cases and unset for
// the cases that hold today's save. Every club, region and person here is
// made up ("Example Chess Club", example.org); each case makes its own
// region, so the seats of one case never cover another's club.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { contracts } from '../../domain/contracts'
import {
  onRequestGet as adminClubGet,
  onRequestPatch as adminClubPatch,
  KEEPER_FIELDS_CLOSED,
  SAVE_CLASHED,
  SLUG_ELSEWHERE,
  SLUG_KEPT_FOR_ADMINS,
  SLUG_RESERVED,
} from '../../functions/api/admin/clubs/[id]'
import { onRequestPut as placesPut, PLACES_CLOSED } from '../../functions/api/admin/clubs/[id]/places'
import { onRequestDelete as childDelete } from '../../functions/api/me/children/[id]'
import { keeperOf } from '../../functions/utils/clubs/routing'
import { emailBehavior, emailOutbox, expectContract, flushWaitUntil, invoke, resetHarness } from './harness'
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
afterEach(() => {
  flags.keepersOn = false
})

/** Today's 13 columns of a club, in the table's own order. */
const TODAYS_13 = ['id', 'name', 'city', 'location', 'description', 'meeting_schedule', 'contact_email', 'created_at', 'color', 'image_url', 'region', 'latitude', 'longitude']
/** The fifteen columns migration 0066 added, in the order the answers give them. */
const ADDED_15 = [
  'slug', 'about_text', 'how_we_meet_text', 'cost_text', 'welcome_text', 'weekend_play', 'scholastic_friendly', 'contact_name_public',
  'facebook_url', 'website_url', 'other_url', 'told_updated_at', 'told_by', 'last_confirmed_at', 'confirmed_by',
]
const STAMPS = 'told_updated_at, told_by, last_confirmed_at, confirmed_by'

const newRegion = () => `Example Region ${crypto.randomUUID().slice(0, 8)}`

/** A regional seat covering the regions, held by the member, as the seat screens write one; ended gives the holder a term that is over. */
async function regionalSeat(memberId: string, regions: string[], opts: { ended?: boolean } = {}): Promise<string> {
  const id = `seat-${crypto.randomUUID().slice(0, 8)}`
  await env.DB.prepare(
    `INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active)
     VALUES (?, 'Example Region Representative', '', 99, ?, 'regional_rep', 1)`,
  ).bind(id, id).run()
  for (const region of regions) {
    await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(id, region).run()
  }
  await env.DB.prepare('INSERT INTO board_seat_assignments (seat_id, member_id, ended_at) VALUES (?, ?, ?)')
    .bind(id, memberId, opts.ended ? '2026-01-01 00:00:00' : null).run()
  return id
}

/** A made up club in a region of its own, with a slug equal to its id, its own rep and a region's representative. */
async function exampleClub() {
  const region = newRegion()
  const clubId = await seedClub({ name: 'Example Chess Club', city: 'Example City' })
  await env.DB.prepare('UPDATE clubs SET region = ?, slug = ?, contact_email = ?, description = ?, meeting_schedule = ?, location = ? WHERE id = ?')
    .bind(region, clubId, 'club@example.org', 'A made up club.', 'Tuesdays, 7:00 PM to 9:00 PM', 'Example Hall, Example City', clubId).run()
  const rep = await seedMember({ role: 'club_rep', clubId, fullName: 'Club Rep One', email: `rep.${clubId}@example.org` })
  const holder = await seedMember({ fullName: 'Region Holder One', email: `holder.${clubId}@example.org` })
  await regionalSeat(holder, [region])
  const admin = await seedAdmin()
  return { clubId, region, rep, holder, admin }
}

const patch = (as: string, clubId: string, body: unknown) =>
  invoke(adminClubPatch, { method: 'PATCH', as, aal: 'aal2', params: { id: clubId }, body })
const put = (as: string, clubId: string, places: unknown) =>
  invoke(placesPut, { method: 'PUT', as, params: { id: clubId }, body: { places } })

async function row(clubId: string): Promise<Record<string, unknown>> {
  return (await env.DB.prepare('SELECT * FROM clubs WHERE id = ?').bind(clubId).first<Record<string, unknown>>())!
}
async function stamps(clubId: string) {
  return env.DB.prepare(`SELECT ${STAMPS} FROM clubs WHERE id = ?`).bind(clubId).first<Record<string, string | null>>()
}
async function placesOf(clubId: string) {
  return (await env.DB.prepare('SELECT name, street, note, latitude, longitude, sort FROM club_places WHERE club_id = ? ORDER BY sort, id').bind(clubId).all()).results
}
async function editRows(clubId: string): Promise<number> {
  const found = await env.DB.prepare('SELECT COUNT(*) AS n FROM admin_audit_log WHERE action = \'club_edit\' AND detail LIKE ?').bind(`%"club_id":"${clubId}"%`).first<{ n: number }>()
  return found?.n ?? 0
}
async function historyOf(clubId: string): Promise<string[]> {
  const { results } = await env.DB.prepare('SELECT old_slug FROM club_slug_history WHERE club_id = ? ORDER BY old_slug').bind(clubId).all<{ old_slug: string }>()
  return results.map((r) => r.old_slug)
}
/** The addresses the outbox holds, A to Z. */
const sentTo = () => emailOutbox.map((m) => m.to).sort()

const STORED_TIME = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/

describe('the keepers\' save, with CLUB_KEEPERS_ON set', () => {
  it('each new field saves', async () => {
    const { clubId, admin } = await exampleClub()
    const res = await patch(admin, clubId, {
      aboutText: '  A made up club that plays on Tuesdays.  ', howWeMeetText: 'Tuesdays, 7:00 PM to 9:00 PM, Example Hall',
      costText: 'Free for students', welcomeText: 'Everyone is welcome', weekendPlay: true, scholasticFriendly: true,
      contactNamePublic: 'Player One', facebookUrl: 'https://example.org/facebook', websiteUrl: 'https://example.org', otherUrl: 'http://example.org/other',
    })
    expect(res.status).toBe(200)
    const { club } = await expectContract(res, contracts['admin/clubs/[id]'].PATCH.response)
    expect(Object.keys(club)).toEqual([...TODAYS_13, ...ADDED_15])
    expect(await row(clubId)).toMatchObject({
      about_text: 'A made up club that plays on Tuesdays.', how_we_meet_text: 'Tuesdays, 7:00 PM to 9:00 PM, Example Hall', cost_text: 'Free for students',
      welcome_text: 'Everyone is welcome', weekend_play: 1, scholastic_friendly: 1, contact_name_public: 'Player One',
      facebook_url: 'https://example.org/facebook', website_url: 'https://example.org', other_url: 'http://example.org/other',
    })
    expect(club).toMatchObject({ about_text: 'A made up club that plays on Tuesdays.', weekend_play: 1, website_url: 'https://example.org' })

    // An empty text clears a field, and false turns a yes back off.
    const cleared = await patch(admin, clubId, { costText: '', welcomeText: null, otherUrl: '  ', weekendPlay: false })
    expect(cleared.status).toBe(200)
    expect(await row(clubId)).toMatchObject({ cost_text: null, welcome_text: null, other_url: null, weekend_play: 0, scholastic_friendly: 1, about_text: 'A made up club that plays on Tuesdays.' })
  })

  it('the mirror writes today\'s fields and never blanks one', async () => {
    const { clubId, rep } = await exampleClub()
    expect((await patch(rep, clubId, { aboutText: 'About the Example Chess Club.', howWeMeetText: 'Mondays, 6:30 PM to 9:00 PM' })).status).toBe(200)
    expect(await row(clubId)).toMatchObject({
      about_text: 'About the Example Chess Club.', description: 'About the Example Chess Club.',
      how_we_meet_text: 'Mondays, 6:30 PM to 9:00 PM', meeting_schedule: 'Mondays, 6:30 PM to 9:00 PM',
    })

    // An empty new text clears itself and leaves today's line as it was.
    expect((await patch(rep, clubId, { aboutText: '', howWeMeetText: '   ' })).status).toBe(200)
    expect(await row(clubId)).toMatchObject({
      about_text: null, description: 'About the Example Chess Club.', how_we_meet_text: null, meeting_schedule: 'Mondays, 6:30 PM to 9:00 PM',
    })

    // A body that sends today's field and the new one: the new text, when not empty, is what both hold.
    expect((await patch(rep, clubId, { description: 'Old words', aboutText: 'New words' })).status).toBe(200)
    expect(await row(clubId)).toMatchObject({ about_text: 'New words', description: 'New words' })
    expect((await patch(rep, clubId, { meetingSchedule: 'Thursdays, 7:00 PM', howWeMeetText: '' })).status).toBe(200)
    expect(await row(clubId)).toMatchObject({ how_we_meet_text: null, meeting_schedule: 'Thursdays, 7:00 PM' })
  })

  it('told and check stamps name the saver', async () => {
    const { clubId, rep, holder } = await exampleClub()
    const before = await editRows(clubId)
    expect((await patch(rep, clubId, { costText: 'Free' })).status).toBe(200)
    const byRep = await stamps(clubId)
    expect(byRep).toMatchObject({ told_by: rep, confirmed_by: rep })
    expect(byRep?.told_updated_at).toMatch(STORED_TIME)
    expect(byRep?.last_confirmed_at).toMatch(STORED_TIME)
    expect(await editRows(clubId)).toBe(before + 1)

    // A save that changes nothing is still a check: the stamps name the new saver, and no activity row is written.
    const same = await invoke(adminClubPatch, { method: 'PATCH', as: holder, aal: 'aal1', params: { id: clubId }, body: { costText: 'Free' } })
    expect(same.status).toBe(200)
    expect(await stamps(clubId)).toMatchObject({ told_by: holder, confirmed_by: holder })
    expect(await editRows(clubId)).toBe(before + 1)

    const detail = await env.DB.prepare('SELECT actor_id, target_label, detail FROM admin_audit_log WHERE action = \'club_edit\' AND detail LIKE ? ORDER BY rowid DESC LIMIT 1')
      .bind(`%"club_id":"${clubId}"%`).first<{ actor_id: string; target_label: string; detail: string }>()
    expect(detail).toMatchObject({ actor_id: rep, target_label: 'Example Chess Club' })
    expect(JSON.parse(detail!.detail)).toEqual({ club_id: clubId, fields: ['cost_text'] })
  })

  it('the notice goes once, to the region\'s representatives, and not to the saver', async () => {
    const { clubId, region, rep, holder, admin } = await exampleClub()
    // A second representative who holds two seats covering the region, one whose term is over and one of another region.
    const second = await seedMember({ fullName: 'Region Holder Two', email: `second.${clubId}@example.org` })
    await regionalSeat(second, [region])
    await regionalSeat(second, [region, newRegion()])
    const ended = await seedMember({ email: `ended.${clubId}@example.org` })
    await regionalSeat(ended, [region], { ended: true })
    const elsewhere = await seedMember({ email: `elsewhere.${clubId}@example.org` })
    await regionalSeat(elsewhere, [newRegion()])

    expect((await patch(rep, clubId, { aboutText: 'Words for the notice.' })).status).toBe(200)
    await flushWaitUntil()
    expect(sentTo()).toEqual([`holder.${clubId}@example.org`, `second.${clubId}@example.org`].sort())
    expect(emailOutbox[0].subject).toBe('Example Chess Club: its listing was updated')

    // A representative's own save tells no one; an admin's tells the two again.
    emailOutbox.length = 0
    expect((await invoke(adminClubPatch, { method: 'PATCH', as: holder, aal: 'aal1', params: { id: clubId }, body: { costText: 'Free' } })).status).toBe(200)
    await flushWaitUntil()
    expect(emailOutbox).toEqual([])
    expect((await patch(admin, clubId, { costText: 'Five dollars' })).status).toBe(200)
    await flushWaitUntil()
    expect(sentTo()).toEqual([`holder.${clubId}@example.org`, `second.${clubId}@example.org`].sort())

    // A save that changes nothing tells no one either.
    emailOutbox.length = 0
    expect((await patch(admin, clubId, { costText: 'Five dollars' })).status).toBe(200)
    await flushWaitUntil()
    expect(emailOutbox).toEqual([])
  })

  it('the notice names the fields alone, never a value and never the private address', async () => {
    const { clubId, rep } = await exampleClub()
    expect((await patch(rep, clubId, { contactEmail: 'private.contact@example.org', aboutText: 'Words not yet read by the region.', weekendPlay: true })).status).toBe(200)
    await flushWaitUntil()
    expect(emailOutbox).toHaveLength(1)
    const [notice] = emailOutbox
    expect(notice.to).toBe(`holder.${clubId}@example.org`)
    for (const text of [notice.html, notice.text ?? '']) {
      expect(text).toContain('Description, Contact email, About, Plays on weekends')
      for (const value of ['private.contact@example.org', 'club@example.org', 'Words not yet read by the region.', `rep.${clubId}@example.org`]) expect(text, value).not.toContain(value)
    }
    expect(notice.text).toContain(`/admin/clubs/${clubId}`)
  })

  it('a failure to send never fails the save', async () => {
    const { clubId, rep } = await exampleClub()
    emailBehavior.succeed = false
    const res = await patch(rep, clubId, { costText: 'Free while the mail is down' })
    expect(res.status).toBe(200)
    await flushWaitUntil()
    expect(await row(clubId)).toMatchObject({ cost_text: 'Free while the mail is down', told_by: rep })
  })

  it('two places at most', async () => {
    const { clubId, rep } = await exampleClub()
    const three = await put(rep, clubId, [{ name: 'Example Hall' }, { name: 'Example Library' }, { name: 'Example Park' }])
    expect(three.status).toBe(400)
    expect(await three.json()).toMatchObject({ fields: { places: 'A club lists at most 2 places' } })
    expect(await placesOf(clubId)).toEqual([])

    const two = await put(rep, clubId, [
      { name: 'Example Hall', street: '1 Example Street', note: 'Upstairs', point: { lat: 30.4515, lng: -91.1871 } },
      { name: 'Example Library' },
    ])
    expect(two.status).toBe(200)
    const body = await expectContract(two, contracts['admin/clubs/[id]/places'].PUT.response)
    expect(body.places.map((p) => p.name)).toEqual(['Example Hall', 'Example Library'])
    expect(await placesOf(clubId)).toEqual([
      { name: 'Example Hall', street: '1 Example Street', note: 'Upstairs', latitude: 30.4515, longitude: -91.1871, sort: 0 },
      { name: 'Example Library', street: null, note: null, latitude: null, longitude: null, sort: 1 },
    ])

    // A point out of the world's bounds, a point of one number and a place with no name are refused, and nothing moves.
    for (const places of [
      [{ name: 'Example Hall', point: { lat: 91, lng: 0 } }], [{ name: 'Example Hall', point: { lat: 30 } }], [{ name: '  ' }], [{ name: 'Example Hall', point: { lat: '30', lng: '-91' } }],
    ]) {
      expect((await put(rep, clubId, places)).status, JSON.stringify(places)).toBe(400)
    }
    expect(await placesOf(clubId)).toHaveLength(2)
  })

  it('a places save gives today\'s location and pin from place 1, and never blanks them', async () => {
    const { clubId, holder } = await exampleClub()
    const asHolder = (places: unknown) => invoke(placesPut, { method: 'PUT', as: holder, aal: 'aal1', params: { id: clubId }, body: { places } })

    expect((await asHolder([{ name: 'Example Hall', street: '1 Example Street', point: { lat: 30.123456789, lng: -91.987654321 } }])).status).toBe(200)
    expect(await row(clubId)).toMatchObject({ location: 'Example Hall, 1 Example Street', latitude: 30.123457, longitude: -91.987654, told_by: holder })

    // Place 1 with no street and no point: the location takes its name, and the pin stays.
    expect((await asHolder([{ name: 'Example Library' }])).status).toBe(200)
    expect(await row(clubId)).toMatchObject({ location: 'Example Library', latitude: 30.123457, longitude: -91.987654 })

    // No place at all: the places go, and today's location and pin stay as they were.
    expect((await asHolder([])).status).toBe(200)
    expect(await placesOf(clubId)).toEqual([])
    expect(await row(clubId)).toMatchObject({ location: 'Example Library', latitude: 30.123457, longitude: -91.987654 })

    const fields = await env.DB.prepare('SELECT detail FROM admin_audit_log WHERE action = \'club_edit\' AND detail LIKE ? ORDER BY rowid').bind(`%"club_id":"${clubId}"%`).all<{ detail: string }>()
    expect(fields.results.map((r) => JSON.parse(r.detail).fields)).toEqual([['places', 'location', 'latitude', 'longitude'], ['places', 'location'], ['places']])
  })

  it('a slug change keeps the old address', async () => {
    const { clubId, admin } = await exampleClub()
    const first = `example-chess-club-${clubId}`
    const res = await patch(admin, clubId, { slug: first })
    expect(res.status).toBe(200)
    expect((await res.json<{ club: { slug: string } }>()).club.slug).toBe(first)
    expect(await row(clubId)).toMatchObject({ slug: first })
    expect(await historyOf(clubId)).toEqual([clubId])

    const second = `example-club-${clubId}`
    expect((await patch(admin, clubId, { slug: second })).status).toBe(200)
    expect(await historyOf(clubId)).toEqual([clubId, first].sort())

    // The club may take back an address of its own: the old one it takes back leaves the history, and the one it leaves joins it.
    expect((await patch(admin, clubId, { slug: first })).status).toBe(200)
    expect(await row(clubId)).toMatchObject({ slug: first })
    expect(await historyOf(clubId)).toEqual([clubId, second].sort())
    expect((await patch(admin, clubId, { slug: clubId })).status).toBe(200)
    expect(await historyOf(clubId)).toEqual([first, second].sort())

    // Sending the address it has changes nothing.
    expect((await patch(admin, clubId, { slug: clubId })).status).toBe(200)
    expect(await historyOf(clubId)).toEqual([first, second].sort())
  })

  it('a slug that is another club\'s id or old slug is refused', async () => {
    const { clubId, admin, rep } = await exampleClub()
    const other = await exampleClub()
    const left = `left-behind-${other.clubId}`
    expect((await patch(admin, other.clubId, { slug: left })).status).toBe(200)
    expect((await patch(admin, other.clubId, { slug: `kept-${other.clubId}` })).status).toBe(200)
    expect(await historyOf(other.clubId)).toContain(left)

    const before = { club: await row(clubId), history: await historyOf(clubId), log: await editRows(clubId) }
    // "monroe" is Monroe Chess Club's id and its old address, and "monroe-chess-club" its slug, for good.
    for (const [slug, status, words] of [
      ['monroe', 409, SLUG_ELSEWHERE], ['monroe-chess-club', 409, SLUG_ELSEWHERE], [other.clubId, 409, SLUG_ELSEWHERE],
      [`kept-${other.clubId}`, 409, SLUG_ELSEWHERE], [left, 409, SLUG_ELSEWHERE], ['contact', 400, SLUG_RESERVED], ['suggest', 400, SLUG_RESERVED],
    ] as const) {
      const res = await patch(admin, clubId, { slug, aboutText: 'Not saved' })
      expect(res.status, slug).toBe(status)
      expect(await res.json(), slug).toEqual({ error: words })
    }
    // Not in a slug's form, or longer than 48 characters: the contract refuses it.
    for (const slug of ['Not A Slug', 'trailing-', 'two--hyphens', 'a'.repeat(49)]) {
      expect((await patch(admin, clubId, { slug })).status, slug).toBe(400)
    }
    // A club's rep may not change the address at all, and may send the one it has.
    const byRep = await patch(rep, clubId, { slug: `rep-${clubId}` })
    expect(byRep.status).toBe(403)
    expect(await byRep.json()).toEqual({ error: SLUG_KEPT_FOR_ADMINS })
    expect((await patch(rep, clubId, { slug: clubId })).status).toBe(200)

    const after = await row(clubId)
    expect({ ...after, told_updated_at: null, told_by: null, last_confirmed_at: null, confirmed_by: null })
      .toEqual({ ...before.club, told_updated_at: null, told_by: null, last_confirmed_at: null, confirmed_by: null })
    expect(await historyOf(clubId)).toEqual(before.history)
    expect(await editRows(clubId)).toBe(before.log)
  })

  it('a save that fails part way leaves nothing half written', async () => {
    const { clubId, admin, rep } = await exampleClub()
    const other = await exampleClub()
    // The club's own address is planted as another club's old address, so the batch's write of it into the history fails on its key, after the club's row.
    await env.DB.prepare('INSERT INTO club_slug_history (old_slug, club_id) VALUES (?, ?)').bind(clubId, other.clubId).run()
    const before = { club: await row(clubId), history: await historyOf(clubId), log: await editRows(clubId) }

    const res = await patch(admin, clubId, { slug: `moved-${clubId}`, aboutText: 'Never written', weekendPlay: true })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: SAVE_CLASHED })
    await flushWaitUntil()
    expect(await row(clubId)).toEqual(before.club)
    expect(await historyOf(clubId)).toEqual(before.history)
    expect(await editRows(clubId)).toBe(before.log)
    expect(emailOutbox).toEqual([])

    // A places save whose last statement fails keeps the places, the location and the stamps as they were.
    expect((await put(rep, clubId, [{ name: 'Example Hall', point: { lat: 30, lng: -91 } }])).status).toBe(200)
    const kept = { club: await row(clubId), places: await placesOf(clubId), log: await editRows(clubId) }
    const db = env.DB
    const failing = {
      prepare: (query: string) => db.prepare(query),
      batch: (statements: D1PreparedStatement[]) => db.batch([...statements, db.prepare('INSERT INTO club_places (club_id, name) VALUES (NULL, NULL)')]),
    } as unknown as D1Database
    await expect(invoke(placesPut, { method: 'PUT', as: rep, params: { id: clubId }, body: { places: [{ name: 'Example Library' }, { name: 'Example Park' }] }, env: { DB: failing } }))
      .rejects.toThrow()
    expect(await row(clubId)).toEqual(kept.club)
    expect(await placesOf(clubId)).toEqual(kept.places)
    expect(await editRows(clubId)).toBe(kept.log)
  })

  it('the GET answers the new columns and the places for each keeper, and the roster rule stays', async () => {
    const { clubId, rep, holder, admin } = await exampleClub()
    await seedMember({ clubId, fullName: 'Player One', email: `player.one.${clubId}@example.org`, uscfId: '90000011', uscfRating: 1500 })
    expect((await put(admin, clubId, [{ name: 'Example Hall', point: { lat: 30, lng: -91 } }])).status).toBe(200)
    for (const [who, aal] of [[admin, 'aal2'], [rep, 'aal2'], [holder, 'aal1']] as const) {
      const res = await invoke(adminClubGet, { as: who, aal, params: { id: clubId } })
      expect(res.status, who).toBe(200)
      const body = await expectContract(res, contracts['admin/clubs/[id]'].GET.response)
      expect(Object.keys(body), who).toEqual(['club', 'officers', 'roster', 'tournaments', 'places'])
      expect(Object.keys(body.club), who).toEqual([...TODAYS_13, ...ADDED_15])
      expect(body.places, who).toEqual([{ id: expect.any(Number), name: 'Example Hall', street: null, note: null, latitude: 30, longitude: -91 }])
      expect(body.club.told_by, who).toBe(admin)
    }
    const byHolder = await invoke(adminClubGet, { as: holder, aal: 'aal1', params: { id: clubId } })
    const text = await byHolder.response.text()
    expect(JSON.parse(text).roster).toEqual([])
    for (const piece of [`player.one.${clubId}@example.org`, '90000011', '"uscf_rating"', '"membership_status"', `rep.${clubId}@example.org`, `holder.${clubId}@example.org`]) {
      expect(text, piece).not.toContain(piece)
    }
  })

  it('who keeps a club: its rep, else the region\'s representatives once each, else the LCA admins', async () => {
    const { clubId, region, rep, holder } = await exampleClub()
    expect(await keeperOf(env.DB, clubId)).toEqual({ kind: 'club_rep', people: [{ id: rep, full_name: 'Club Rep One', email: `rep.${clubId}@example.org` }] })

    await env.DB.prepare('UPDATE members SET role = \'member\' WHERE id = ?').bind(rep).run()
    await regionalSeat(holder, [region])
    expect(await keeperOf(env.DB, clubId)).toEqual({ kind: 'region', people: [{ id: holder, full_name: 'Region Holder One', email: `holder.${clubId}@example.org` }] })

    // A region whose seats are all over, and a club with no region, go to the LCA admins.
    await env.DB.prepare('UPDATE board_seat_assignments SET ended_at = \'2026-11-01 00:00:00\' WHERE member_id = ?').bind(holder).run()
    const admins = await keeperOf(env.DB, clubId)
    expect(admins.kind).toBe('admins')
    const { results } = await env.DB.prepare('SELECT id FROM members WHERE role = \'lca_admin\'').all<{ id: string }>()
    expect(admins.people.map((p) => p.id).sort()).toEqual(results.map((r) => r.id).sort())
    const bare = await seedClub({ name: 'Another Example Club', city: 'Example Town' })
    expect((await keeperOf(env.DB, bare)).kind).toBe('admins')
  })

  it('a child profile named in a club\'s stamps can still be deleted, and the stamps lose the name', async () => {
    const { clubId } = await exampleClub()
    const guardian = await seedMember({ fullName: 'Parent One', email: `parent.${clubId}@example.org` })
    const child = await seedMember({ fullName: 'Player Junior', email: `junior.${clubId}@example.org` })
    await env.DB.prepare('UPDATE members SET guardian_id = ? WHERE id = ?').bind(guardian, child).run()
    await env.DB.prepare('UPDATE clubs SET told_by = ?, confirmed_by = ?, told_updated_at = \'2026-11-01 12:00:00\' WHERE id = ?').bind(child, child, clubId).run()

    const res = await invoke(childDelete, { method: 'DELETE', as: guardian, params: { id: child } })
    expect(res.status).toBe(200)
    expect(await env.DB.prepare('SELECT id FROM members WHERE id = ?').bind(child).first()).toBeNull()
    expect(await stamps(clubId)).toEqual({ told_updated_at: '2026-11-01 12:00:00', told_by: null, last_confirmed_at: null, confirmed_by: null })
  })
})

describe('today\'s save, with CLUB_KEEPERS_ON unset', () => {
  beforeEach(() => {
    flags.keepersOn = false
  })

  it('with the constant unset a new field is refused and an old save is today\'s', async () => {
    const { clubId, rep, admin } = await exampleClub()
    const before = await row(clubId)
    for (const body of [
      { aboutText: 'Not yet' }, { weekendPlay: 'not a yes or no' }, { facebookUrl: 'ftp://example.org' }, { slug: `moved-${clubId}` },
      { description: 'Today\'s field', costText: 'and a new one' }, { otherUrl: null },
    ]) {
      for (const who of [rep, admin]) {
        const res = await patch(who, clubId, body)
        expect(res.status, JSON.stringify(body)).toBe(403)
        expect(await res.json()).toEqual({ error: KEEPER_FIELDS_CLOSED })
      }
    }
    expect(await row(clubId)).toEqual(before)
    expect(KEEPER_FIELDS_CLOSED).toBe('The new club page fields cannot be saved yet.')

    // The admin club page's form body: answered with today's 13 columns as stored, and one activity row.
    const log = await editRows(clubId)
    const res = await patch(rep, clubId, {
      name: 'Example Chess Club', city: 'Example City', location: 'Example Library, Example City', description: 'A made up club.',
      meetingSchedule: 'Wednesdays, 6:00 PM', contactEmail: 'club@example.org', color: '#1f3a5f', region: before.region,
    })
    expect(res.status).toBe(200)
    const stored = await env.DB.prepare(`SELECT ${TODAYS_13.join(', ')} FROM clubs WHERE id = ?`).bind(clubId).first()
    expect(await res.response.text()).toBe(JSON.stringify({ club: stored }))
    expect(stored).toMatchObject({ location: 'Example Library, Example City', meeting_schedule: 'Wednesdays, 6:00 PM', color: '#1f3a5f' })
    expect(await editRows(clubId)).toBe(log + 1)
    // Nothing else moved: no stamp, no new field.
    const moved = ['location', 'meeting_schedule', 'color']
    const others = (club: Record<string, unknown>) => Object.fromEntries(Object.entries(club).filter(([column]) => !moved.includes(column)))
    expect(others(await row(clubId))).toEqual(others(before))
  })

  it('with the constant unset a club rep\'s save in a club whose region has a representative sends nothing (the harness\'s outbox is empty) and leaves told_updated_at, told_by, last_confirmed_at and confirmed_by as they were', async () => {
    const { clubId, rep, holder, admin } = await exampleClub()
    await env.DB.prepare('UPDATE clubs SET told_updated_at = \'2026-11-01 12:00:00\', told_by = ?, last_confirmed_at = NULL, confirmed_by = NULL WHERE id = ?').bind(admin, clubId).run()
    const before = await stamps(clubId)

    for (const [who, aal, body] of [
      [rep, 'aal2', { description: 'Changed by the rep' }],
      [rep, 'aal2', { mapLocation: { lat: 30.5, lng: -91.5 } }],
      [holder, 'aal1', { meetingSchedule: 'Changed by the region' }],
      [admin, 'aal2', { name: 'Example Chess Club Renamed', region: null }],
    ] as const) {
      const res = await invoke(adminClubPatch, { method: 'PATCH', as: who, aal, params: { id: clubId }, body })
      expect(res.status, JSON.stringify(body)).toBe(200)
      expect(Object.keys((await res.json<{ club: Record<string, unknown> }>()).club)).toEqual(TODAYS_13)
    }
    await flushWaitUntil()
    expect(emailOutbox).toEqual([])
    expect(await stamps(clubId)).toEqual(before)
    expect(await row(clubId)).toMatchObject({ description: 'Changed by the rep', latitude: 30.5, longitude: -91.5, meeting_schedule: 'Changed by the region', region: null })
  })

  it('with the constant unset PUT places answers 403 in words to every keeper and writes nothing', async () => {
    const { clubId, rep, holder, admin } = await exampleClub()
    const before = { club: await row(clubId), places: await placesOf(clubId) }
    for (const [who, aal] of [[admin, 'aal2'], [rep, 'aal2'], [holder, 'aal1']] as const) {
      const res = await invoke(placesPut, { method: 'PUT', as: who, aal, params: { id: clubId }, body: { places: [{ name: 'Example Hall' }] } })
      expect(res.status, who).toBe(403)
      expect(await res.json(), who).toEqual({ error: PLACES_CLOSED })
    }
    expect(PLACES_CLOSED).toBe('A club\'s places cannot be saved yet.')
    expect(await row(clubId)).toEqual(before.club)
    expect(await placesOf(clubId)).toEqual(before.places)
    await flushWaitUntil()
    expect(emailOutbox).toEqual([])
  })

  it('with the constant unset the GET answers today\'s four keys and 13 columns, with no places', async () => {
    const { clubId, rep, admin } = await exampleClub()
    for (const who of [rep, admin]) {
      const res = await invoke(adminClubGet, { as: who, params: { id: clubId } })
      const body = await expectContract(res, contracts['admin/clubs/[id]'].GET.response)
      expect(Object.keys(body)).toEqual(['club', 'officers', 'roster', 'tournaments'])
      expect(Object.keys(body.club)).toEqual(TODAYS_13)
    }
  })
})
