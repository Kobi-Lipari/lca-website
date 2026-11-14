// test/integration/club-save-one-press.test.ts
//
// One press of the club editor is one save (WS09 step 7): PATCH
// /api/admin/clubs/[id] takes the club's places beside the listing, in the
// same shape, limits and refusals as PUT /api/admin/clubs/[id]/places, and
// writes the listing's columns, the places, the four stamps, the copy into
// today's fields and the activity row in one batch, then sends one notice to
// each of the region's representatives. CLUB_KEEPERS_ON is false in the
// tree; here it is read through a getter on the mocked module, as the comment
// in functions/utils/clubs/pages.ts describes, set for most cases and unset
// for the case that holds the refusal. Every club, region and person here is
// made up ("Example Chess Club", example.org); each case makes its own
// region, so the seats of one case never cover another's club.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { contracts } from '../../domain/contracts'
import { CLUB_PLACE_LIMITS, clubPlacesRequestSchema, updateClubRequestSchema } from '../../domain/contracts/clubs'
import { onRequestPatch as adminClubPatch, KEEPER_FIELDS_CLOSED } from '../../functions/api/admin/clubs/[id]'
import { onRequestPut as placesPut } from '../../functions/api/admin/clubs/[id]/places'
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
afterEach(async () => {
  // A notice still on its way would land in the next case's outbox.
  await flushWaitUntil()
  flags.keepersOn = false
})

const newRegion = () => `Example Region ${crypto.randomUUID().slice(0, 8)}`

/** A regional seat covering the region, held by the member, as the seat screens write one. */
async function regionalSeat(memberId: string, region: string): Promise<void> {
  const id = `seat-${crypto.randomUUID().slice(0, 8)}`
  await env.DB.prepare(
    `INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active)
     VALUES (?, 'Example Region Representative', '', 99, ?, 'regional_rep', 1)`,
  ).bind(id, id).run()
  await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(id, region).run()
  await env.DB.prepare('INSERT INTO board_seat_assignments (seat_id, member_id, ended_at) VALUES (?, ?, NULL)').bind(id, memberId).run()
}

/** A made up club in a region of its own, with its rep, two representatives for the region and an LCA admin, and two places. */
async function exampleClub() {
  const region = newRegion()
  const clubId = await seedClub({ name: 'Example Chess Club', city: 'Example City' })
  await env.DB.prepare(
    'UPDATE clubs SET region = ?, slug = ?, contact_email = ?, description = ?, meeting_schedule = ?, location = ?, latitude = ?, longitude = ? WHERE id = ?',
  ).bind(region, clubId, 'club@example.org', 'A made up club.', 'Tuesdays, 7:00 PM to 9:00 PM', 'Example Library, 1 Example Street', 30.1, -91.2, clubId).run()
  await env.DB.prepare(
    `INSERT INTO club_places (club_id, name, street, note, latitude, longitude, sort) VALUES
       (?, 'Example Library', '1 Example Street', 'Room B', 30.1, -91.2, 0),
       (?, 'Example Hall', NULL, 'Saturdays only', NULL, NULL, 1)`,
  ).bind(clubId, clubId).run()
  const rep = await seedMember({ role: 'club_rep', clubId, fullName: 'Club Rep One', email: `rep.${clubId}@example.org` })
  const holder = await seedMember({ fullName: 'Region Holder One', email: `holder.${clubId}@example.org` })
  const second = await seedMember({ fullName: 'Region Holder Two', email: `second.${clubId}@example.org` })
  await regionalSeat(holder, region)
  await regionalSeat(second, region)
  const admin = await seedAdmin()
  return { clubId, region, rep, holder, second, admin }
}

const patch = (as: string, clubId: string, body: unknown, extra: { env?: Partial<typeof env> } = {}) =>
  invoke(adminClubPatch, { method: 'PATCH', as, aal: 'aal2', params: { id: clubId }, body, ...extra })

async function row(clubId: string): Promise<Record<string, unknown>> {
  return (await env.DB.prepare('SELECT * FROM clubs WHERE id = ?').bind(clubId).first<Record<string, unknown>>())!
}
async function placesOf(clubId: string) {
  return (await env.DB.prepare('SELECT name, street, note, latitude, longitude, sort FROM club_places WHERE club_id = ? ORDER BY sort, id').bind(clubId).all()).results
}
/** The fields of each club_edit row of the activity log for the club, oldest first. */
async function editFields(clubId: string): Promise<string[][]> {
  const { results } = await env.DB.prepare('SELECT detail FROM admin_audit_log WHERE action = \'club_edit\' AND detail LIKE ? ORDER BY rowid')
    .bind(`%"club_id":"${clubId}"%`).all<{ detail: string }>()
  return results.map((r) => JSON.parse(r.detail).fields)
}
/** The addresses the outbox holds, A to Z. */
const sentTo = () => emailOutbox.map((m) => m.to).sort()

/** The body of one press that changes a basic and the place, as the editor sends it. */
const PRESS = {
  aboutText: 'Words for the notice, never in it.',
  howWeMeetText: 'Tuesdays, 7:00 PM to 9:00 PM',
  contactNamePublic: 'Player One',
  contactEmail: 'private.contact@example.org',
  places: [
    { name: 'Example Center', street: '2 Example Road', note: 'Upstairs', point: { lat: 30.45, lng: -91.18 } },
    { name: 'Example Hall', street: null, note: 'Saturdays only', point: null },
  ],
}

describe('one press is one save, with CLUB_KEEPERS_ON set', () => {
  it('writes the listing, the places, the stamps, today\'s fields and one activity row in one save, and answers the club and its places as saved', async () => {
    const { clubId, rep } = await exampleClub()
    const before = await editFields(clubId)
    const res = await patch(rep, clubId, PRESS)
    expect(res.status).toBe(200)
    const body = await expectContract(res, contracts['admin/clubs/[id]'].PATCH.response)
    expect(Object.keys(body)).toEqual(['club', 'places'])
    expect(body.places).toEqual([
      { id: expect.any(Number), name: 'Example Center', street: '2 Example Road', note: 'Upstairs', latitude: 30.45, longitude: -91.18 },
      { id: expect.any(Number), name: 'Example Hall', street: null, note: 'Saturdays only', latitude: null, longitude: null },
    ])
    expect(await placesOf(clubId)).toEqual([
      { name: 'Example Center', street: '2 Example Road', note: 'Upstairs', latitude: 30.45, longitude: -91.18, sort: 0 },
      { name: 'Example Hall', street: null, note: 'Saturdays only', latitude: null, longitude: null, sort: 1 },
    ])
    // Today's fields take About and place 1, and the stamps name the saver.
    const stored = await row(clubId)
    expect(stored).toMatchObject({
      about_text: 'Words for the notice, never in it.', description: 'Words for the notice, never in it.', contact_email: 'private.contact@example.org',
      location: 'Example Center, 2 Example Road', latitude: 30.45, longitude: -91.18, told_by: rep, confirmed_by: rep,
    })
    expect(body.club).toMatchObject({ location: 'Example Center, 2 Example Road', latitude: 30.45, about_text: 'Words for the notice, never in it.' })
    // One activity row for the press, naming the listing's fields and the places.
    expect(await editFields(clubId)).toEqual([
      ...before,
      ['location', 'description', 'contact_email', 'latitude', 'longitude', 'about_text', 'how_we_meet_text', 'contact_name_public', 'places'],
    ])
  })

  it('leaves the listing, the places, the stamps, today\'s fields and the activity log as they were when a statement of the save fails', async () => {
    const { clubId, rep, admin } = await exampleClub()
    expect((await patch(admin, clubId, { costText: 'Free' })).status).toBe(200)
    await flushWaitUntil()
    emailOutbox.length = 0
    const kept = { club: await row(clubId), places: await placesOf(clubId), log: await editFields(clubId) }
    expect(kept.club.told_by).toBe(admin)

    const db = env.DB
    const failing = {
      prepare: (query: string) => db.prepare(query),
      batch: (statements: D1PreparedStatement[]) => db.batch([...statements, db.prepare('INSERT INTO club_places (club_id, name) VALUES (NULL, NULL)')]),
    } as unknown as D1Database
    await expect(patch(rep, clubId, PRESS, { env: { DB: failing } })).rejects.toThrow()
    await flushWaitUntil()
    expect(await row(clubId)).toEqual(kept.club)
    expect(await placesOf(clubId)).toEqual(kept.places)
    expect(await editFields(clubId)).toEqual(kept.log)
    expect(emailOutbox).toEqual([])
    // The same press on a store that does not fail writes all of it, the places with the listing.
    expect((await patch(rep, clubId, PRESS)).status).toBe(200)
    expect((await placesOf(clubId)).map((p) => p.name)).toEqual(['Example Center', 'Example Hall'])
    expect(await row(clubId)).toMatchObject({ location: 'Example Center, 2 Example Road', about_text: 'Words for the notice, never in it.', told_by: rep })
  })

  it('sends one notice to each of the region\'s representatives for one press, naming the listing\'s fields and the places, never a value and never to the saver', async () => {
    const { clubId, rep, holder } = await exampleClub()
    expect((await patch(rep, clubId, PRESS)).status).toBe(200)
    await flushWaitUntil()
    expect(sentTo()).toEqual([`holder.${clubId}@example.org`, `second.${clubId}@example.org`].sort())
    for (const notice of emailOutbox) {
      for (const text of [notice.html, notice.text ?? '']) {
        expect(text).toContain('Location, Description, Contact email, Map pin, About, How we meet, Contact name, Places')
        for (const value of ['private.contact@example.org', 'club@example.org', 'Words for the notice, never in it.', 'Example Center', '2 Example Road', 'Upstairs', `rep.${clubId}@example.org`]) {
          expect(text, value).not.toContain(value)
        }
      }
    }

    // A press by a representative tells no one, the saver included; a press that changes only the place tells each of the others once.
    emailOutbox.length = 0
    const byHolder = await invoke(adminClubPatch, {
      method: 'PATCH', as: holder, aal: 'aal1', params: { id: clubId },
      body: { ...PRESS, places: [{ name: 'Example Annex' }] },
    })
    expect(byHolder.status).toBe(200)
    await flushWaitUntil()
    expect(emailOutbox).toEqual([])
    expect((await patch(rep, clubId, { ...PRESS, places: [{ name: 'Example Annex', note: 'Side door' }] })).status).toBe(200)
    await flushWaitUntil()
    expect(sentTo()).toEqual([`holder.${clubId}@example.org`, `second.${clubId}@example.org`].sort())
    expect(emailOutbox.every((m) => (m.text ?? '').includes('What changed: Places'))).toBe(true)
  })

  it('never fails the save when the notice cannot be sent', async () => {
    const { clubId, rep } = await exampleClub()
    emailBehavior.succeed = false
    const res = await patch(rep, clubId, PRESS)
    expect(res.status).toBe(200)
    await flushWaitUntil()
    expect(await row(clubId)).toMatchObject({ about_text: 'Words for the notice, never in it.', location: 'Example Center, 2 Example Road', told_by: rep })
    expect((await placesOf(clubId)).map((p) => p.name)).toEqual(['Example Center', 'Example Hall'])
  })

  it('moves a second place up when place 1 goes, and today\'s pin goes with the place it belonged to when the body says so', async () => {
    const { clubId, rep } = await exampleClub()
    const res = await patch(rep, clubId, { aboutText: 'A made up club.', places: [{ name: 'Example Hall', street: null, note: 'Saturdays only', point: null }], mapLocation: null })
    expect(res.status).toBe(200)
    const body = await res.json<{ club: Record<string, unknown>; places: Array<Record<string, unknown>> }>()
    expect(body.places).toEqual([{ id: expect.any(Number), name: 'Example Hall', street: null, note: 'Saturdays only', latitude: null, longitude: null }])
    expect(body.club).toMatchObject({ location: 'Example Hall', latitude: null, longitude: null })
    expect(await row(clubId)).toMatchObject({ location: 'Example Hall', latitude: null, longitude: null })
    // With no word on the pin, place 1's copy never blanks it, as the places' own save does.
    expect((await patch(rep, clubId, { places: [{ name: 'Example Library' }] })).status).toBe(200)
    expect(await row(clubId)).toMatchObject({ location: 'Example Library', latitude: null, longitude: null })
  })

  it('takes the places in the PATCH by the PUT\'s own shape, limits and refusals, and writes nothing it refuses', async () => {
    const { clubId, rep } = await exampleClub()
    const before = { club: await row(clubId), places: await placesOf(clubId), log: await editFields(clubId) }
    const lists: unknown[] = [
      [{ name: 'Example Hall' }, { name: 'Example Library' }, { name: 'Example Park' }],
      [{ name: '  ' }],
      [{ name: 'x'.repeat(CLUB_PLACE_LIMITS.name + 1) }],
      [{ name: 'Example Hall', street: 'x'.repeat(CLUB_PLACE_LIMITS.street + 1) }],
      [{ name: 'Example Hall', note: 'x'.repeat(CLUB_PLACE_LIMITS.note + 1) }],
      [{ name: 'Example Hall', point: { lat: 91, lng: 0 } }],
      [{ name: 'Example Hall', point: { lat: 30 } }],
      [{ name: 'Example Hall', point: { lat: '30', lng: '-91' } }],
      'Example Hall',
    ]
    for (const places of lists) {
      const res = await patch(rep, clubId, { aboutText: 'Never written', places })
      expect(res.status, JSON.stringify(places).slice(0, 80)).toBe(400)
      // The contract's two bodies refuse the same list.
      expect(updateClubRequestSchema.safeParse({ places }).success).toBe(false)
      expect(clubPlacesRequestSchema.safeParse({ places }).success).toBe(false)
    }
    const three = await patch(rep, clubId, { places: lists[0] })
    expect(await three.json()).toMatchObject({ fields: { places: 'A club lists at most 2 places' } })
    expect(await row(clubId)).toEqual(before.club)
    expect(await placesOf(clubId)).toEqual(before.places)
    expect(await editFields(clubId)).toEqual(before.log)

    // Each list at its limits is taken by both bodies, and by the PATCH.
    const longest = [
      { name: 'x'.repeat(CLUB_PLACE_LIMITS.name), street: 'y'.repeat(CLUB_PLACE_LIMITS.street), note: 'z'.repeat(CLUB_PLACE_LIMITS.note), point: { lat: 90, lng: -180 } },
      { name: 'Example Hall' },
    ]
    for (const places of [[], longest]) {
      expect(updateClubRequestSchema.safeParse({ places }).success).toBe(true)
      expect(clubPlacesRequestSchema.safeParse({ places }).success).toBe(true)
    }
    expect((await patch(rep, clubId, { places: longest })).status).toBe(200)
    expect((await placesOf(clubId)).map((p) => p.name)).toEqual(['x'.repeat(CLUB_PLACE_LIMITS.name), 'Example Hall'])
  })

  it('answers a PATCH without places as before, with no places, and leaves the places alone', async () => {
    const { clubId, rep } = await exampleClub()
    const places = await placesOf(clubId)
    const res = await patch(rep, clubId, { aboutText: 'Only the listing.' })
    expect(res.status).toBe(200)
    expect(Object.keys(await res.json<Record<string, unknown>>())).toEqual(['club'])
    expect(await placesOf(clubId)).toEqual(places)
    // The PUT is still there for now, as it was.
    const put = await invoke(placesPut, { method: 'PUT', as: rep, params: { id: clubId }, body: { places: [{ name: 'Example Hall' }] } })
    expect(put.status).toBe(200)
  })

  it('refuses places from every person who may not save the club, and writes nothing', async () => {
    const { clubId } = await exampleClub()
    const other = await exampleClub()
    const before = { club: await row(clubId), places: await placesOf(clubId) }
    const member = await seedMember({ clubId, fullName: 'Player One', email: `player.${clubId}@example.org` })
    for (const who of [other.rep, other.holder, member]) {
      const res = await invoke(adminClubPatch, { method: 'PATCH', as: who, aal: 'aal2', params: { id: clubId }, body: { places: [{ name: 'Example Annex' }] } })
      expect(res.status, who).toBe(403)
    }
    expect(await row(clubId)).toEqual(before.club)
    expect(await placesOf(clubId)).toEqual(before.places)
    await flushWaitUntil()
    expect(emailOutbox).toEqual([])
  })
})

describe('the PATCH with CLUB_KEEPERS_ON unset', () => {
  beforeEach(() => {
    flags.keepersOn = false
  })

  it('refuses a body that carries places 403 in words, for every keeper, and writes nothing', async () => {
    const { clubId, rep, holder, admin } = await exampleClub()
    const before = { club: await row(clubId), places: await placesOf(clubId), log: await editFields(clubId) }
    for (const [who, aal] of [[admin, 'aal2'], [rep, 'aal2'], [holder, 'aal1']] as const) {
      for (const body of [{ places: [{ name: 'Example Annex' }] }, { places: [] }, { description: 'Today\'s field', places: [{ name: 'Example Annex' }] }]) {
        const res = await invoke(adminClubPatch, { method: 'PATCH', as: who, aal, params: { id: clubId }, body })
        expect(res.status, JSON.stringify(body)).toBe(403)
        expect(await res.json()).toEqual({ error: KEEPER_FIELDS_CLOSED })
      }
    }
    expect(await row(clubId)).toEqual(before.club)
    expect(await placesOf(clubId)).toEqual(before.places)
    expect(await editFields(clubId)).toEqual(before.log)
    await flushWaitUntil()
    expect(emailOutbox).toEqual([])
  })
})
