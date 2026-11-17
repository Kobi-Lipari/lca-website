// test/integration/contracts/admin-clubs.test.ts
// GET and PATCH /api/admin/clubs/[id] and PUT /api/admin/clubs/[id]/places
// keep their contracts (domain/contracts/clubs.ts), through the real
// handlers, with CLUB_KEEPERS_ON unset as the tree has it and set through a
// getter on the mocked module. The PATCH's contract accepts every body the
// site sends today: src/areas/clubs/api.ts's adminUpdateClub is called from
// two places on the admin club page, src/pages/AdminClubPage.tsx, its
// details form and its map pin, and from nowhere else in src/, scripts/ or
// workers/; each body is held here, with the bodies the older tests send.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CLUB_PLACE_LIMITS,
  CLUB_SLUG_MAX,
  CLUB_TEXT_LIMITS,
  CLUB_TODAY_LIMITS,
  WEB_ADDRESS_WORDS,
  adminClubResponseSchema,
  clubPlacesRequestSchema,
  contracts,
  errorBodySchema,
  fieldErrorBodySchema,
  todaysClubSaveRequestSchema,
  updateClubRequestSchema,
  updateClubRequestSchemaFor,
} from '../../../domain/contracts'
import { locationLine } from '../../../functions/utils/clubs/save'
import { SLUG_MAX_LENGTH } from '../../../domain/clubs/slug'
import {
  onRequestGet as adminClubGet,
  onRequestOptions as adminClubOptions,
  onRequestPatch as adminClubPatch,
} from '../../../functions/api/admin/clubs/[id]'
import { onRequestOptions as placesOptions, onRequestPut as placesPut } from '../../../functions/api/admin/clubs/[id]/places'
import { seedAdmin, seedClub, seedMember, seedTournament } from '../factories'
import { expectContract, invoke, resetHarness } from '../harness'

const flags = vi.hoisted(() => ({ keepersOn: false }))
vi.mock('../../../functions/utils/clubs/pages', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../functions/utils/clubs/pages')>()
  return {
    ...real,
    get CLUB_KEEPERS_ON() {
      return flags.keepersOn
    },
  }
})

beforeEach(resetHarness)
afterEach(() => {
  flags.keepersOn = false
})

const getContract = contracts['admin/clubs/[id]'].GET
const patchContract = contracts['admin/clubs/[id]'].PATCH
const putContract = contracts['admin/clubs/[id]/places'].PUT

/** A made up club with every column filled, its rep, an officer, a member, a hidden draft and a regional seat over its region. */
async function exampleClub() {
  const region = `Example Region ${crypto.randomUUID().slice(0, 8)}`
  const clubId = await seedClub({ name: 'Example Chess Club', city: 'Example City' })
  await env.DB.prepare(
    `UPDATE clubs SET location = 'Example Hall, 1 Example Street', description = 'A made up club.', meeting_schedule = 'Tuesdays, 7:00 PM to 9:00 PM',
       contact_email = 'club@example.org', color = '#1f3a5f', image_url = 'https://example.org/logo.png', region = ?, latitude = 30.45, longitude = -91.15, slug = ?
     WHERE id = ?`,
  ).bind(region, clubId, clubId).run()
  const rep = await seedMember({ role: 'club_rep', clubId, fullName: 'Club Rep One', email: `rep.${clubId}@example.org` })
  const one = await seedMember({ clubId, fullName: 'Player One', email: `one.${clubId}@example.org`, uscfId: '90000021', uscfRating: 1400 })
  await env.DB.prepare('INSERT INTO club_officers (id, club_id, member_id, role) VALUES (?, ?, ?, \'President\')').bind(`off-${clubId}`, clubId, one).run()
  await seedTournament({ clubId, isVisible: false })
  const holder = await seedMember({ fullName: 'Region Holder One' })
  const seat = `seat-${crypto.randomUUID().slice(0, 8)}`
  await env.DB.prepare(
    `INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active) VALUES (?, 'Example Region Representative', '', 99, ?, 'regional_rep', 1)`,
  ).bind(seat, seat).run()
  await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(seat, region).run()
  await env.DB.prepare('INSERT INTO board_seat_assignments (seat_id, member_id) VALUES (?, ?)').bind(seat, holder).run()
  return { clubId, rep, holder, admin: await seedAdmin(), observer: await seedMember({ role: 'lca_observer' }) }
}

/** Every body the site and the older tests send through PATCH today. */
const TODAYS_BODIES: unknown[] = [
  // The admin club page's details form, filled and with its blanks sent as null, as src/pages/AdminClubPage.tsx sends it.
  {
    name: 'Example Chess Club', city: 'Example City', location: 'Example Hall', description: 'A made up club.', meetingSchedule: 'Tuesdays, 7:00 PM',
    contactEmail: 'club@example.org', color: '#1f3a5f', region: null,
  },
  { name: 'Example Chess Club', city: 'Example City', location: null, description: null, meetingSchedule: null, contactEmail: null, color: null, region: null },
  // The map pin, set and removed.
  { mapLocation: { lat: 30.451234, lng: -91.187654 } },
  { mapLocation: null },
  // The older tests' bodies.
  { color: '#ABCdef' }, { color: 'not-a-color' }, { color: null }, { region: '' }, { region: null }, { mapLocation: { lat: 200, lng: 0 } },
  { contactEmail: 'not-an-email' }, { description: 'We meet weekly' }, { name: 'Original Name', description: 'We meet weekly', contactEmail: 'club@example.com' },
  { imageUrl: 'https://elsewhere.example/logo.png' }, {},
]

describe('GET /api/admin/clubs/[id] keeps its contract', () => {
  it('answers an LCA admin, an observer, the club\'s rep and a region\'s representative within it, with CLUB_KEEPERS_ON unset and set', async () => {
    const { clubId, rep, holder, admin, observer } = await exampleClub()
    for (const on of [false, true]) {
      flags.keepersOn = on
      for (const [who, aal] of [[admin, 'aal2'], [observer, 'aal1'], [rep, 'aal2'], [holder, 'aal1']] as const) {
        const result = await invoke(adminClubGet, { as: who, aal, params: { id: clubId } })
        expect(result.status, `${who} ${on}`).toBe(200)
        const body = await expectContract(result, getContract.response)
        expect('places' in body, `${who} ${on}`).toBe(on)
        expect('slug' in body.club, `${who} ${on}`).toBe(on)
        expect(body.roster.length > 0, `${who} ${on}`).toBe(who !== holder)
        expect(body.officers.every((o) => 'email' in o), `${who} ${on}`).toBe(who !== holder)
        // The roster kept back is said to the region's representative alone, as true, and to no one else at all.
        expect('rosterKeptBack' in body, `${who} ${on}`).toBe(who === holder)
        if (who === holder) expect(body.rosterKeptBack, `${who} ${on}`).toBe(true)
        // The club's one event is a hidden draft, which the region's representative is not answered.
        expect(body.tournaments.length, `${who} ${on}`).toBe(who === holder ? 0 : 1)
      }
    }
  })

  it('the contract is strict: a key it does not name, a missing column and a wrong type are refused', async () => {
    const { clubId, admin, rep, holder } = await exampleClub()
    // rosterKeptBack is taken only as true, from the region's representative, and is in no other answer's text.
    const held = await (await invoke(adminClubGet, { as: holder, aal: 'aal1', params: { id: clubId } })).json<Record<string, unknown>>()
    expect(Object.keys(held)).toEqual(['club', 'officers', 'roster', 'rosterKeptBack', 'tournaments'])
    expect(adminClubResponseSchema.safeParse(held).success).toBe(true)
    for (const wrong of [false, 1, 'true', null]) {
      expect(adminClubResponseSchema.safeParse({ ...held, rosterKeptBack: wrong }).success, String(wrong)).toBe(false)
    }
    for (const [who, aal] of [[admin, 'aal2'], [rep, 'aal2']] as const) {
      const text = await (await invoke(adminClubGet, { as: who, aal, params: { id: clubId } })).response.text()
      expect(text, who).not.toContain('rosterKeptBack')
    }
    const body = await (await invoke(adminClubGet, { as: admin, params: { id: clubId } })).json<Record<string, unknown>>()
    expect(adminClubResponseSchema.safeParse(body).success).toBe(true)
    expect(adminClubResponseSchema.safeParse({ ...body, extra: 1 }).success).toBe(false)
    const club = body.club as Record<string, unknown>
    expect(adminClubResponseSchema.safeParse({ ...body, club: { ...club, throwaway_note: 'x' } }).success).toBe(false)
    const { name: _name, ...noName } = club
    expect(_name).toBe('Example Chess Club')
    expect(adminClubResponseSchema.safeParse({ ...body, club: noName }).success).toBe(false)
    expect(adminClubResponseSchema.safeParse({ ...body, club: { ...club, weekend_play: 2 } }).success).toBe(false)
    expect(adminClubResponseSchema.safeParse({ ...body, places: [{ id: 1, name: 'Example Hall', street: null, note: null, latitude: null, longitude: null, sort: 0 }] }).success).toBe(false)
  })
})

describe('PATCH /api/admin/clubs/[id] keeps its contract', () => {
  it('accepts every body the site and the older tests send today, in both of its request schemas', () => {
    for (const body of TODAYS_BODIES) {
      expect(patchContract.request.safeParse(body).success, JSON.stringify(body)).toBe(true)
      expect(todaysClubSaveRequestSchema.safeParse(body).success, JSON.stringify(body)).toBe(true)
      expect(patchContract.request.parse(body), JSON.stringify(body)).toEqual(body)
    }
  })

  it('answers today\'s bodies within its contract, with CLUB_KEEPERS_ON unset and set', async () => {
    const { clubId, admin } = await exampleClub()
    for (const on of [false, true]) {
      flags.keepersOn = on
      for (const body of TODAYS_BODIES) {
        const result = await invoke(adminClubPatch, { method: 'PATCH', as: admin, params: { id: clubId }, body })
        const label = `${JSON.stringify(body)} ${on}`
        if (result.status === 200) {
          const { club } = await expectContract(result, patchContract.response)
          expect('slug' in club, label).toBe(on)
        } else {
          expect(result.status, label).toBe(400)
          await expectContract(result, errorBodySchema)
        }
      }
    }
  })

  it('states a greatest length for every new text field, and takes a link only as an http or https address', () => {
    for (const [key, max] of Object.entries(CLUB_TEXT_LIMITS)) {
      const fill = key.endsWith('Url') ? `https://example.org/${'a'.repeat(max - 20)}` : 'a'.repeat(max)
      expect(fill.length, key).toBe(max)
      expect(updateClubRequestSchema.safeParse({ [key]: fill }).success, key).toBe(true)
      expect(updateClubRequestSchema.safeParse({ [key]: `${fill}a` }).success, key).toBe(false)
      expect(updateClubRequestSchema.safeParse({ [key]: null }).success, key).toBe(true)
      expect(updateClubRequestSchema.safeParse({ [key]: '' }).success, key).toBe(true)
    }
    for (const key of ['facebookUrl', 'websiteUrl', 'otherUrl']) {
      for (const link of ['https://example.org', 'http://example.org/page', ' https://example.org ']) {
        expect(updateClubRequestSchema.safeParse({ [key]: link }).success, `${key} ${link}`).toBe(true)
      }
      for (const link of [
        'example.org', 'ftp://example.org', 'javascript:alert(1)', 'mailto:club@example.org', 'https://', 'data:text/html,hi',
        'http:example.org', 'https:/example.org', 'https:\\\\example.org', 'https://exam\tple.org', 'https:///example.org', 'https://example.org/a\u0001b',
      ]) {
        const parsed = updateClubRequestSchema.safeParse({ [key]: link })
        expect(parsed.success, `${key} ${link}`).toBe(false)
        expect(parsed.error?.issues[0]?.message, `${key} ${link}`).toBe(WEB_ADDRESS_WORDS)
      }
    }
    expect(CLUB_SLUG_MAX).toBe(SLUG_MAX_LENGTH)
    expect(updateClubRequestSchema.safeParse({ slug: 'a'.repeat(48) }).success).toBe(true)
    expect(updateClubRequestSchema.safeParse({ slug: 'a'.repeat(49) }).success).toBe(false)
    for (const flag of ['weekendPlay', 'scholasticFriendly']) {
      expect(updateClubRequestSchema.safeParse({ [flag]: true }).success, flag).toBe(true)
      expect(updateClubRequestSchema.safeParse({ [flag]: 1 }).success, flag).toBe(false)
    }
  })

  it('states a greatest length for each of today\'s text fields on the keepers\' save alone, each at least what the mirror writes there', async () => {
    expect(CLUB_TODAY_LIMITS.description).toBeGreaterThanOrEqual(CLUB_TEXT_LIMITS.aboutText)
    expect(CLUB_TODAY_LIMITS.meetingSchedule).toBeGreaterThanOrEqual(CLUB_TEXT_LIMITS.howWeMeetText)
    expect(CLUB_TODAY_LIMITS.location).toBeGreaterThanOrEqual(CLUB_PLACE_LIMITS.name + ', '.length + CLUB_PLACE_LIMITS.street)
    expect(locationLine({ name: 'a'.repeat(CLUB_PLACE_LIMITS.name), street: 'b'.repeat(CLUB_PLACE_LIMITS.street) }).length).toBeLessThanOrEqual(CLUB_TODAY_LIMITS.location)
    expect(CLUB_TODAY_LIMITS.color).toBeGreaterThanOrEqual('not-a-color'.length)
    for (const [key, max] of Object.entries(CLUB_TODAY_LIMITS)) {
      expect(updateClubRequestSchema.safeParse({ [key]: 'a'.repeat(max) }).success, key).toBe(true)
      const over = updateClubRequestSchema.safeParse({ [key]: 'a'.repeat(max + 1) })
      expect(over.success, key).toBe(false)
      expect(over.error?.issues[0]?.path, key).toEqual([key])
      // Today's body alone, as the PATCH reads it with the constant unset, keeps no length.
      expect(todaysClubSaveRequestSchema.safeParse({ [key]: 'a'.repeat(max + 1) }).success, key).toBe(true)
    }
    const { clubId, admin } = await exampleClub()
    const body = { description: 'a'.repeat(CLUB_TODAY_LIMITS.description + 1) }
    const today = await invoke(adminClubPatch, { method: 'PATCH', as: admin, params: { id: clubId }, body })
    expect(today.status).toBe(200)
    flags.keepersOn = true
    const refused = await invoke(adminClubPatch, { method: 'PATCH', as: admin, params: { id: clubId }, body: { description: 'Not saved' + body.description } })
    expect(refused.status).toBe(400)
    expect(Object.keys((await expectContract(refused, fieldErrorBodySchema)).fields)).toEqual(['description'])
    const kept = await env.DB.prepare('SELECT description FROM clubs WHERE id = ?').bind(clubId).first<{ description: string }>()
    expect(kept?.description).toBe(body.description)
  })

  it('takes back unchanged a value of today\'s stored over its limit while CLUB_KEEPERS_ON was unset, and holds a new value to the limit', async () => {
    const { clubId, admin, rep } = await exampleClub()
    const long = {
      name: 'N'.repeat(CLUB_TODAY_LIMITS.name + 5), city: 'C'.repeat(CLUB_TODAY_LIMITS.city + 5), location: 'L'.repeat(CLUB_TODAY_LIMITS.location + 5),
      description: 'D'.repeat(CLUB_TODAY_LIMITS.description + 5), meetingSchedule: 'M'.repeat(CLUB_TODAY_LIMITS.meetingSchedule + 5),
    }
    const stored = await invoke(adminClubPatch, { method: 'PATCH', as: admin, params: { id: clubId }, body: long })
    expect(stored.status).toBe(200)
    const schema = updateClubRequestSchemaFor(long)
    expect(schema.safeParse(long).success).toBe(true)
    expect(schema.safeParse({ ...long, description: `${long.description}x` }).error?.issues.map((issue) => issue.path)).toEqual([['description']])
    expect(updateClubRequestSchemaFor({ description: 'short' })).toBe(updateClubRequestSchema)

    flags.keepersOn = true
    // The admin club page's details form, as it sends the whole record on every save, with only the color changed.
    const form = { ...long, contactEmail: 'club@example.org', color: '#2f4a6f', region: (await env.DB.prepare('SELECT region FROM clubs WHERE id = ?').bind(clubId).first<{ region: string }>())?.region ?? null }
    for (const [who, aal] of [[admin, 'aal2'], [rep, 'aal2']] as const) {
      const again = await invoke(adminClubPatch, { method: 'PATCH', as: who, aal, params: { id: clubId }, body: form })
      expect(again.status, who).toBe(200)
      await expectContract(again, patchContract.response)
    }
    const grown = await invoke(adminClubPatch, { method: 'PATCH', as: admin, params: { id: clubId }, body: { ...form, location: `${long.location}x` } })
    expect(grown.status).toBe(400)
    expect(Object.keys((await expectContract(grown, fieldErrorBodySchema)).fields)).toEqual(['location'])
  })

  it('answers 200 to today\'s details form after a places save has written the longest location the mirror can', async () => {
    flags.keepersOn = true
    const { clubId, rep } = await exampleClub()
    const first = { name: 'H'.repeat(CLUB_PLACE_LIMITS.name), street: 'S'.repeat(CLUB_PLACE_LIMITS.street) }
    const placed = await invoke(placesPut, { method: 'PUT', as: rep, params: { id: clubId }, body: { places: [first] } })
    expect(placed.status).toBe(200)
    const club = await env.DB.prepare('SELECT * FROM clubs WHERE id = ?').bind(clubId).first<Record<string, string | null>>()
    expect(club?.location).toBe(locationLine(first))
    expect(club?.location?.length).toBe(CLUB_PLACE_LIMITS.name + 2 + CLUB_PLACE_LIMITS.street)
    const form = {
      name: club?.name, city: club?.city, location: club?.location, description: club?.description, meetingSchedule: club?.meeting_schedule,
      contactEmail: club?.contact_email, color: club?.color, region: club?.region,
    }
    const saved = await invoke(adminClubPatch, { method: 'PATCH', as: rep, params: { id: clubId }, body: form })
    expect(saved.status).toBe(200)
    await expectContract(saved, patchContract.response)
  })

  it('answers a new field over its limit with the field\'s own message, once CLUB_KEEPERS_ON is set, and 403 before that', async () => {
    const { clubId, admin } = await exampleClub()
    const body = { aboutText: 'a'.repeat(CLUB_TEXT_LIMITS.aboutText + 1) }
    const closed = await invoke(adminClubPatch, { method: 'PATCH', as: admin, params: { id: clubId }, body })
    expect(closed.status).toBe(403)
    await expectContract(closed, errorBodySchema)
    flags.keepersOn = true
    const refused = await invoke(adminClubPatch, { method: 'PATCH', as: admin, params: { id: clubId }, body })
    expect(refused.status).toBe(400)
    expect(Object.keys((await expectContract(refused, fieldErrorBodySchema)).fields)).toEqual(['aboutText'])
  })
})

describe('PUT /api/admin/clubs/[id]/places keeps its contract', () => {
  it('answers the saved places within its contract once CLUB_KEEPERS_ON is set, and 403 in words before that', async () => {
    const { clubId, rep } = await exampleClub()
    const places = [{ name: 'Example Hall', street: '1 Example Street', note: 'Upstairs', point: { lat: 30.45, lng: -91.15 } }, { name: 'Example Library', point: null }]
    const closed = await invoke(placesPut, { method: 'PUT', as: rep, params: { id: clubId }, body: { places } })
    expect(closed.status).toBe(403)
    await expectContract(closed, errorBodySchema)

    flags.keepersOn = true
    const result = await invoke(placesPut, { method: 'PUT', as: rep, params: { id: clubId }, body: { places } })
    expect(result.status).toBe(200)
    const body = await expectContract(result, putContract.response)
    expect(body.places.every((place) => Number.isInteger(place.id))).toBe(true)
    expect(body.places.map((place) => ({ ...place, id: 0 }))).toEqual([
      { id: 0, name: 'Example Hall', street: '1 Example Street', note: 'Upstairs', latitude: 30.45, longitude: -91.15 },
      { id: 0, name: 'Example Library', street: null, note: null, latitude: null, longitude: null },
    ])
    const none = await invoke(placesPut, { method: 'PUT', as: rep, params: { id: clubId }, body: { places: [] } })
    expect(await expectContract(none, putContract.response)).toEqual({ places: [] })
    const bad = await invoke(placesPut, { method: 'PUT', as: rep, params: { id: clubId }, body: { places: 'Example Hall' } })
    expect(bad.status).toBe(400)
    await expectContract(bad, fieldErrorBodySchema)
  })

  it('states the limits of a place and of its point', () => {
    const ok = (places: unknown) => clubPlacesRequestSchema.safeParse({ places }).success
    expect(ok([{ name: 'a'.repeat(CLUB_PLACE_LIMITS.name) }])).toBe(true)
    expect(ok([{ name: 'a'.repeat(CLUB_PLACE_LIMITS.name + 1) }])).toBe(false)
    expect(ok([{ name: 'Example Hall', street: 'a'.repeat(CLUB_PLACE_LIMITS.street + 1) }])).toBe(false)
    expect(ok([{ name: 'Example Hall', note: 'a'.repeat(CLUB_PLACE_LIMITS.note + 1) }])).toBe(false)
    for (const point of [{ lat: 90, lng: 180 }, { lat: -90, lng: -180 }, null, undefined]) expect(ok([{ name: 'Example Hall', point }]), JSON.stringify(point)).toBe(true)
    for (const point of [{ lat: 90.1, lng: 0 }, { lat: 0, lng: -180.1 }, { lat: 30 }, { lat: '30', lng: '-91' }, [30, -91]]) {
      expect(ok([{ name: 'Example Hall', point }]), JSON.stringify(point)).toBe(false)
    }
    expect(ok([{ name: 'One' }, { name: 'Two' }])).toBe(true)
    expect(ok([{ name: 'One' }, { name: 'Two' }, { name: 'Three' }])).toBe(false)
  })

  it('answers OPTIONS with 204 and no body on both files, and the contracts name their methods', async () => {
    for (const handler of [adminClubOptions, placesOptions]) {
      const result = await invoke(handler, { method: 'OPTIONS' })
      expect(result.status).toBe(204)
      expect(await result.response.text()).toBe('')
    }
    expect(Object.keys(contracts['admin/clubs/[id]'])).toEqual(['GET', 'PATCH'])
    expect(Object.keys(contracts['admin/clubs/[id]/places'])).toEqual(['PUT'])
  })
})
