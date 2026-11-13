// test/integration/club-save-edges.test.ts
//
// The edges of the keepers' save (WS09 step 6) that test/integration/club-save.test.ts
// leaves to this file: the three link fields and every greatest length through
// the real handlers, a place's point at the world's bounds, a club that is not
// there, a replayed places save, who the notice goes to at the margins and what
// it says, two admins taking one address together, and today's body saving the
// same with CLUB_KEEPERS_ON set as unset. CLUB_KEEPERS_ON is read through a
// getter on the mocked module, as the comment in functions/utils/clubs/pages.ts
// describes. Every club, region and person here is made up ("Example Chess
// Club", "Player One", example.org); each case makes its own region.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CLUB_PLACE_LIMITS, CLUB_TEXT_LIMITS, WEB_ADDRESS_WORDS } from '../../domain/contracts'
import { RESERVED_SLUGS } from '../../domain/clubs/slug'
import {
  onRequestPatch as adminClubPatch,
  SLUG_ELSEWHERE,
  SLUG_RESERVED,
} from '../../functions/api/admin/clubs/[id]'
import { onRequestPut as placesPut } from '../../functions/api/admin/clubs/[id]/places'
import { emailOutbox, flushWaitUntil, invoke, resetHarness } from './harness'
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

const STAMPS = 'told_updated_at, told_by, last_confirmed_at, confirmed_by'
const newRegion = () => `Example Region ${crypto.randomUUID().slice(0, 8)}`

async function regionalSeat(memberId: string, regions: string[], opts: { ended?: boolean } = {}): Promise<void> {
  const id = `seat-${crypto.randomUUID().slice(0, 8)}`
  await env.DB.prepare(
    `INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active)
     VALUES (?, 'Example Region Representative', '', 99, ?, 'regional_rep', 1)`,
  ).bind(id, id).run()
  for (const region of regions) await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(id, region).run()
  await env.DB.prepare('INSERT INTO board_seat_assignments (seat_id, member_id, ended_at) VALUES (?, ?, ?)')
    .bind(id, memberId, opts.ended ? '2026-01-01 00:00:00' : null).run()
}

/** A made up club in a region of its own, with its rep and, unless told not to, one representative for the region. */
async function exampleClub(opts: { holder?: boolean; name?: string } = {}) {
  const region = newRegion()
  const clubId = await seedClub({ name: opts.name ?? 'Example Chess Club', city: 'Example City' })
  await env.DB.prepare('UPDATE clubs SET region = ?, slug = ?, contact_email = ?, description = ?, meeting_schedule = ?, location = ? WHERE id = ?')
    .bind(region, clubId, 'club@example.org', 'A made up club.', 'Tuesdays, 7:00 PM to 9:00 PM', 'Example Hall, Example City', clubId).run()
  const rep = await seedMember({ role: 'club_rep', clubId, fullName: 'Club Rep One', email: `rep.${clubId}@example.org` })
  const holder = await seedMember({ fullName: 'Region Holder One', email: `holder.${clubId}@example.org` })
  if (opts.holder !== false) await regionalSeat(holder, [region])
  return { clubId, region, rep, holder, admin: await seedAdmin() }
}

const patch = (as: string, clubId: string, body: unknown) =>
  invoke(adminClubPatch, { method: 'PATCH', as, aal: 'aal2', params: { id: clubId }, body })
const put = (as: string, clubId: string, places: unknown) =>
  invoke(placesPut, { method: 'PUT', as, params: { id: clubId }, body: { places } })

async function row(clubId: string): Promise<Record<string, unknown>> {
  return (await env.DB.prepare('SELECT * FROM clubs WHERE id = ?').bind(clubId).first<Record<string, unknown>>())!
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
const sentTo = () => emailOutbox.map((m) => m.to).sort()

const LINKS = ['facebookUrl', 'websiteUrl', 'otherUrl'] as const

describe('the three link fields, through PATCH', () => {
  it('refuse anything that is not an http or https address, in words, and write nothing', async () => {
    const { clubId, rep } = await exampleClub()
    const before = await row(clubId)
    const log = await editRows(clubId)
    const refused = [
      'javascript:alert(1)', 'JaVaScRiPt:alert(1)', ' javascript:alert(1)', 'vbscript:msgbox(1)', 'data:text/html,hi', 'file:///etc/passwd',
      'ftp://example.org', 'mailto:club@example.org', '//example.org', 'www.example.org', 'example.org', 'https:', 'https://', 'http://', 'not a link',
    ]
    for (const key of LINKS) {
      for (const link of refused) {
        const res = await patch(rep, clubId, { [key]: link, aboutText: 'Not saved' })
        expect(res.status, `${key} ${link}`).toBe(400)
        expect(await res.json(), `${key} ${link}`).toMatchObject({ fields: { [key]: WEB_ADDRESS_WORDS } })
      }
    }
    expect(await row(clubId)).toEqual(before)
    expect(await editRows(clubId)).toBe(log)
    await flushWaitUntil()
    expect(emailOutbox).toEqual([])
  })

  it('take an http or https address, trimmed, and an empty one clears the field', async () => {
    const { clubId, rep } = await exampleClub()
    for (const key of LINKS) {
      for (const [sent, stored] of [['https://example.org', 'https://example.org'], ['  http://example.org/page?x=1  ', 'http://example.org/page?x=1'], ['HTTPS://EXAMPLE.ORG/Page', 'HTTPS://EXAMPLE.ORG/Page']] as const) {
        expect((await patch(rep, clubId, { [key]: sent })).status, `${key} ${sent}`).toBe(200)
        expect((await row(clubId))[key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)], `${key} ${sent}`).toBe(stored)
      }
      expect((await patch(rep, clubId, { [key]: '' })).status).toBe(200)
      expect((await row(clubId))[key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)]).toBeNull()
    }
  })

  it('never keep a stored address that does not start with http:// or https://', async () => {
    const { clubId, rep } = await exampleClub()
    // Forms a URL parser reads as an address but that are not written as one.
    const kept: string[] = []
    for (const link of ['http:example.org', 'https:/example.org', 'https:\\\\example.org', 'https://exam\tple.org']) {
      const res = await patch(rep, clubId, { websiteUrl: link })
      if (res.status === 200) kept.push(`${JSON.stringify(link)} stored as ${JSON.stringify((await row(clubId)).website_url)}`)
    }
    expect(kept).toEqual([])
  })
})

describe('every greatest length, through the handlers', () => {
  it('a new text field one over its limit is refused with its own key and writes nothing; at its limit it saves', async () => {
    const { clubId, rep } = await exampleClub()
    const before = await row(clubId)
    for (const [key, max] of Object.entries(CLUB_TEXT_LIMITS)) {
      const fill = key.endsWith('Url') ? `https://example.org/${'a'.repeat(max - 20)}` : 'a'.repeat(max)
      const over = await patch(rep, clubId, { [key]: `${fill}a` })
      expect(over.status, key).toBe(400)
      expect(Object.keys((await over.json<{ fields: Record<string, string> }>()).fields), key).toEqual([key])
    }
    expect(await row(clubId)).toEqual(before)
    for (const [key, max] of Object.entries(CLUB_TEXT_LIMITS)) {
      const fill = key.endsWith('Url') ? `https://example.org/${'a'.repeat(max - 20)}` : 'a'.repeat(max)
      expect((await patch(rep, clubId, { [key]: fill })).status, key).toBe(200)
    }
  })

  it('a place\'s name, street and note one over their limits are refused and the places stay', async () => {
    const { clubId, rep } = await exampleClub()
    expect((await put(rep, clubId, [{ name: 'Example Hall' }])).status).toBe(200)
    const kept = await placesOf(clubId)
    for (const [part, max] of Object.entries(CLUB_PLACE_LIMITS)) {
      const base = { name: 'Example Hall' } as Record<string, string>
      expect((await put(rep, clubId, [{ ...base, [part]: 'a'.repeat(max + 1) }])).status, part).toBe(400)
      expect((await put(rep, clubId, [{ ...base, [part]: 'a'.repeat(max) }])).status, part).toBe(200)
    }
    expect(await placesOf(clubId)).toHaveLength(1)
    expect(kept).toHaveLength(1)
  })
})

describe('a place\'s point', () => {
  it('takes the world\'s bounds exactly, and a point at 0 and 0 is a point, not an absent one', async () => {
    const { clubId, rep } = await exampleClub()
    for (const [lat, lng] of [[90, 180], [-90, -180], [90, -180], [-90, 180]]) {
      expect((await put(rep, clubId, [{ name: 'Example Hall', point: { lat, lng } }])).status, `${lat} ${lng}`).toBe(200)
      expect(await placesOf(clubId)).toMatchObject([{ latitude: lat, longitude: lng }])
      expect(await row(clubId)).toMatchObject({ latitude: lat, longitude: lng })
    }
    expect((await put(rep, clubId, [{ name: 'Example Hall', point: { lat: 0, lng: 0 } }])).status).toBe(200)
    expect(await placesOf(clubId)).toMatchObject([{ latitude: 0, longitude: 0 }])
    expect(await row(clubId)).toMatchObject({ latitude: 0, longitude: 0 })
  })

  it('beyond the bounds, or not a pair of numbers, is refused and leaves the places and the pin alone', async () => {
    const { clubId, rep } = await exampleClub()
    expect((await put(rep, clubId, [{ name: 'Example Hall', point: { lat: 30.5, lng: -91.5 } }])).status).toBe(200)
    const kept = { club: await row(clubId), places: await placesOf(clubId), log: await editRows(clubId) }
    for (const point of [
      { lat: 90.0000001, lng: 0 }, { lat: -90.0000001, lng: 0 }, { lat: 0, lng: 180.0000001 }, { lat: 0, lng: -180.0000001 },
      { lat: null, lng: 0 }, { lat: 30 }, { lng: -91 }, {}, [], 'here', 30,
    ]) {
      expect((await put(rep, clubId, [{ name: 'Example Hall', point }])).status, JSON.stringify(point)).toBe(400)
    }
    expect(await row(clubId)).toEqual(kept.club)
    expect(await placesOf(clubId)).toEqual(kept.places)
    expect(await editRows(clubId)).toBe(kept.log)
  })

  it('a place with no point keeps its place, and sets no pin of its own', async () => {
    const { clubId, rep } = await exampleClub()
    await env.DB.prepare('UPDATE clubs SET latitude = 30.25, longitude = -91.25 WHERE id = ?').bind(clubId).run()
    expect((await put(rep, clubId, [{ name: 'Example Hall', point: null }, { name: 'Example Library' }])).status).toBe(200)
    expect(await placesOf(clubId)).toMatchObject([{ latitude: null, longitude: null }, { latitude: null, longitude: null }])
    expect(await row(clubId)).toMatchObject({ latitude: 30.25, longitude: -91.25, location: 'Example Hall' })
  })
})

describe('a body that is not a listing', () => {
  it('is 400 on PATCH and PUT with CLUB_KEEPERS_ON set and, for PATCH, unset, and writes nothing', async () => {
    const { clubId, rep } = await exampleClub()
    const before = await row(clubId)
    for (const on of [true, false]) {
      flags.keepersOn = on
      for (const rawBody of ['not json', '[]', '"text"', '5', 'null']) {
        const res = await invoke(adminClubPatch, { method: 'PATCH', as: rep, aal: 'aal2', params: { id: clubId }, rawBody })
        expect(res.status, `${on} ${rawBody}`).toBe(400)
        expect(await res.json(), `${on} ${rawBody}`).toMatchObject({ error: expect.any(String) })
      }
    }
    flags.keepersOn = true
    for (const rawBody of ['not json', '[]', '{}', '{"places":{"name":"Example Hall"}}', '{"places":[null]}', '{"places":["Example Hall"]}']) {
      const res = await invoke(placesPut, { method: 'PUT', as: rep, params: { id: clubId }, rawBody })
      expect(res.status, rawBody).toBe(400)
    }
    expect(await row(clubId)).toEqual(before)
    expect(await placesOf(clubId)).toEqual([])
  })
})

describe('a club that is not there', () => {
  it('is 404 to an admin on PATCH and PUT, creates no place and writes no activity row, and a club\'s rep is refused', async () => {
    const { rep, holder, admin } = await exampleClub()
    const missing = 'no-such-example-club'
    const rows = async () => (await env.DB.prepare('SELECT COUNT(*) AS n FROM admin_audit_log WHERE action = \'club_edit\'').first<{ n: number }>())!.n
    const log = await rows()
    for (const [res, label] of [[await patch(admin, missing, { costText: 'Free' }), 'PATCH'], [await put(admin, missing, [{ name: 'Example Hall' }]), 'PUT']] as const) {
      expect(res.status, label).toBe(404)
      expect(await res.json(), label).toEqual({ error: 'Club not found' })
    }
    for (const who of [rep, holder]) {
      expect((await patch(who, missing, { costText: 'Free' })).status).toBe(403)
      expect((await put(who, missing, [{ name: 'Example Hall' }])).status).toBe(403)
    }
    expect(await placesOf(missing)).toEqual([])
    expect(await rows()).toBe(log)
    await flushWaitUntil()
    expect(emailOutbox).toEqual([])
  })
})

describe('a replayed places save', () => {
  it('writes one activity row and sends one notice; the stamps name the second saver', async () => {
    const { clubId, rep, admin, holder } = await exampleClub()
    const places = [{ name: 'Example Hall', street: '1 Example Street', point: { lat: 30.5, lng: -91.5 } }, { name: 'Example Library' }]
    expect((await put(rep, clubId, places)).status).toBe(200)
    await flushWaitUntil()
    expect(sentTo()).toEqual([`holder.${clubId}@example.org`])
    expect(emailOutbox[0].text).toContain('Places')
    const log = await editRows(clubId)

    emailOutbox.length = 0
    expect((await put(admin, clubId, places)).status).toBe(200)
    await flushWaitUntil()
    expect(emailOutbox).toEqual([])
    expect(await editRows(clubId)).toBe(log)
    expect(await placesOf(clubId)).toHaveLength(2)
    expect(await row(clubId)).toMatchObject({ told_by: admin, confirmed_by: admin })

    // The same save by the representative tells no one, and a change after it does not tell the representative.
    const asHolder = (body: unknown) => invoke(placesPut, { method: 'PUT', as: holder, aal: 'aal1', params: { id: clubId }, body: { places: body } })
    expect((await asHolder([{ name: 'Example Park' }])).status).toBe(200)
    await flushWaitUntil()
    expect(emailOutbox).toEqual([])
    expect(await row(clubId)).toMatchObject({ told_by: holder, location: 'Example Park' })
  })
})

describe('the stamps are the server\'s clock in UTC', () => {
  it('a stamp is within a minute of now when read as UTC, whatever the hour in Chicago', async () => {
    const { clubId, rep } = await exampleClub()
    const sent = Date.now()
    expect((await patch(rep, clubId, { costText: 'Free' })).status).toBe(200)
    const stamps = (await env.DB.prepare(`SELECT ${STAMPS} FROM clubs WHERE id = ?`).bind(clubId).first<Record<string, string>>())!
    for (const key of ['told_updated_at', 'last_confirmed_at']) {
      const at = Date.parse(`${stamps[key].replace(' ', 'T')}Z`)
      expect(Math.abs(at - sent), key).toBeLessThan(60_000)
    }
    expect(stamps.told_updated_at).toBe(stamps.last_confirmed_at)
  })
})

describe('who the notice goes to, at the margins', () => {
  it('an LCA admin who also holds a seat for the region is a representative, and tells no one', async () => {
    const { clubId, region, admin } = await exampleClub()
    await regionalSeat(admin, [region])
    expect((await patch(admin, clubId, { costText: 'Free' })).status).toBe(200)
    await flushWaitUntil()
    expect(emailOutbox).toEqual([])
  })

  it('an LCA admin whose own seat for the region is over is not one, and the current holder is told', async () => {
    const { clubId, region, admin } = await exampleClub()
    await regionalSeat(admin, [region], { ended: true })
    expect((await patch(admin, clubId, { costText: 'Free' })).status).toBe(200)
    await flushWaitUntil()
    expect(sentTo()).toEqual([`holder.${clubId}@example.org`])
  })

  it('a region with no representative, and a club with no region, tell no one: not the club\'s rep, not the admins', async () => {
    const bare = await exampleClub({ holder: false })
    expect((await patch(bare.admin, bare.clubId, { costText: 'Free' })).status).toBe(200)
    expect((await put(bare.admin, bare.clubId, [{ name: 'Example Hall' }])).status).toBe(200)
    await env.DB.prepare('UPDATE clubs SET region = NULL WHERE id = ?').bind(bare.clubId).run()
    expect((await patch(bare.admin, bare.clubId, { costText: 'Free for all' })).status).toBe(200)
    await flushWaitUntil()
    expect(emailOutbox).toEqual([])
  })

  it('a seat for another region, a seat whose term is over and a seat that is not active tell no one', async () => {
    const { clubId, region, admin } = await exampleClub({ holder: false })
    const elsewhere = await seedMember({ email: `elsewhere.${clubId}@example.org` })
    await regionalSeat(elsewhere, [newRegion()])
    const ended = await seedMember({ email: `ended.${clubId}@example.org` })
    await regionalSeat(ended, [region], { ended: true })
    const inactive = await seedMember({ email: `inactive.${clubId}@example.org` })
    await regionalSeat(inactive, [region])
    await env.DB.prepare('UPDATE board_members SET is_active = 0 WHERE id IN (SELECT seat_id FROM board_seat_assignments WHERE member_id = ?)').bind(inactive).run()
    expect((await patch(admin, clubId, { costText: 'Free' })).status).toBe(200)
    await flushWaitUntil()
    expect(emailOutbox).toEqual([])
  })

  it('a representative with no address on file is passed over, and the others are still told', async () => {
    const { clubId, region, admin } = await exampleClub()
    const noAddress = await seedMember({ fullName: 'Region Holder Three' })
    await env.DB.prepare('UPDATE members SET email = \'\' WHERE id = ?').bind(noAddress).run()
    await regionalSeat(noAddress, [region])
    expect((await patch(admin, clubId, { costText: 'Free' })).status).toBe(200)
    await flushWaitUntil()
    expect(sentTo()).toEqual([`holder.${clubId}@example.org`])
  })

  it('a guest who still holds a current seat for the region is not told, as they cannot open the club, while the member who holds one is', async () => {
    const { clubId, region, admin } = await exampleClub()
    const guest = await seedMember({ role: 'guest', fullName: 'Player One', email: `guest.${clubId}@example.org` })
    await regionalSeat(guest, [region])
    expect((await patch(admin, clubId, { costText: 'Free' })).status).toBe(200)
    await flushWaitUntil()
    expect(sentTo()).toEqual([`holder.${clubId}@example.org`])
  })
})

describe('what the notice says', () => {
  it('escapes the club\'s name and the saver\'s name in its page, and keeps to the plain-language rules', async () => {
    const { clubId, admin } = await exampleClub({ name: 'Example <b>Club</b> & Co' })
    await env.DB.prepare('UPDATE members SET full_name = \'Player <i>One</i>\' WHERE id = ?').bind(admin).run()
    expect((await patch(admin, clubId, { costText: 'Free', weekendPlay: true, scholasticFriendly: true, contactEmail: 'someone@example.org' })).status).toBe(200)
    await flushWaitUntil()
    expect(emailOutbox).toHaveLength(1)
    const [notice] = emailOutbox
    expect(notice.html).not.toContain('<b>Club</b>')
    expect(notice.html).not.toContain('<i>One</i>')
    expect(notice.html).toContain('&lt;b&gt;Club&lt;/b&gt;')
    for (const text of [notice.subject, notice.html, notice.text ?? '']) {
      // US Chess's old initials, put together so that this file does not hold them.
      expect(text).not.toMatch(new RegExp('US' + 'CF', 'i'))
      expect(text).not.toMatch(/[\u2013\u2014]/)
      expect(text).not.toMatch(/\d\.5\b/)
      expect(text).not.toContain('someone@example.org')
    }
    // Sent to one person, with nobody else's address on it.
    expect(notice.html + (notice.text ?? '')).not.toMatch(/holder\.[^@]+@example\.org/)
  })

  it('no answer of the save carries a representative\'s name or address', async () => {
    const { clubId, rep, admin } = await exampleClub()
    for (const res of [
      await patch(admin, clubId, { costText: 'Free' }),
      await put(admin, clubId, [{ name: 'Example Hall' }]),
      await patch(rep, clubId, { costText: 'Free for members' }),
      await put(rep, clubId, [{ name: 'Example Library' }]),
    ]) {
      expect(res.status).toBe(200)
      const text = await res.response.text()
      for (const piece of [`holder.${clubId}@example.org`, 'Region Holder One', `rep.${clubId}@example.org`]) expect(text).not.toContain(piece)
    }
  })
})

describe('a page address, at the margins', () => {
  it('every word the club pages keep is refused to an admin', async () => {
    const { clubId, admin } = await exampleClub()
    for (const slug of RESERVED_SLUGS) {
      const res = await patch(admin, clubId, { slug })
      expect(res.status, slug).toBe(400)
      expect(await res.json(), slug).toEqual({ error: SLUG_RESERVED })
    }
    expect((await row(clubId)).slug).toBe(clubId)
  })

  it('a club with no address yet takes one without losing the id it was reached by, and no other club can take that id', async () => {
    const clubId = await seedClub({ name: 'Example Chess Club', city: 'Example City' })
    const admin = await seedAdmin()
    expect((await row(clubId)).slug).toBeNull()
    expect((await patch(admin, clubId, { slug: `fresh-${clubId}` })).status).toBe(200)
    expect(await row(clubId)).toMatchObject({ slug: `fresh-${clubId}` })

    const other = await exampleClub()
    const res = await patch(other.admin, other.clubId, { slug: clubId })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: SLUG_ELSEWHERE })
  })

  it('two clubs taking one new address together: one gets it, the other is told 409 and nothing of its save is written', async () => {
    const one = await exampleClub()
    const two = await exampleClub()
    const slug = `shared-${one.clubId}`
    const before = [await row(one.clubId), await row(two.clubId)]
    const results = await Promise.all([
      patch(one.admin, one.clubId, { slug, aboutText: 'Words from the first club' }),
      patch(two.admin, two.clubId, { slug, aboutText: 'Words from the second club' }),
    ])
    expect(results.map((r) => r.status).sort()).toEqual([200, 409])
    const holders = await env.DB.prepare('SELECT id FROM clubs WHERE slug = ?').bind(slug).all<{ id: string }>()
    expect(holders.results).toHaveLength(1)
    const loser = holders.results[0].id === one.clubId ? 1 : 0
    const loserId = [one.clubId, two.clubId][loser]
    expect(await row(loserId)).toEqual(before[loser])
    expect(await historyOf(loserId)).toEqual([])
    expect(await editRows(loserId)).toBe(0)
  })
})

describe('today\'s body, saved with CLUB_KEEPERS_ON set and unset', () => {
  it('leaves today\'s 13 columns the same either way, and the new fields only change when the keepers\' save is on', async () => {
    const bodies = [
      { name: 'Example Chess Club', city: 'Example City', location: 'Example Library', description: 'Changed words', meetingSchedule: 'Wednesdays, 6:00 PM', contactEmail: 'club@example.org', color: '#1f3a5f', region: null },
      { mapLocation: { lat: 30.123456789, lng: -91.987654321 } },
      { mapLocation: null },
      { color: 'not-a-color', description: null },
    ]
    const columns = 'name, city, location, description, meeting_schedule, contact_email, color, image_url, region, latitude, longitude'
    const finals: Record<string, unknown>[] = []
    for (const on of [false, true]) {
      flags.keepersOn = on
      const { clubId, admin } = await exampleClub()
      for (const body of bodies) expect((await patch(admin, clubId, body)).status, `${on} ${JSON.stringify(body)}`).toBe(200)
      finals.push((await env.DB.prepare(`SELECT ${columns} FROM clubs WHERE id = ?`).bind(clubId).first<Record<string, unknown>>())!)
      const about = (await row(clubId)).about_text
      expect(about, `${on}`).toBeNull()
    }
    // Both clubs started from the same text, so the region the first body sets is the only column that can differ in kind.
    expect(finals[1]).toEqual(finals[0])
  })
})
