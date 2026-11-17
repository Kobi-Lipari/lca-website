// test/integration/club-save-review.test.ts
//
// What checkpoint T's review of the whole mended in the keepers' save, with
// CLUB_KEEPERS_ON set. A form opened before another keeper's save is told
// it is stale: PATCH /api/admin/clubs/[id] reads the club's last save as
// the form read it (toldUpdatedAt) and answers 409 in words, with nothing
// written and no notice, when the club has been saved since; a form opened
// on the club as it stands saves as before, and with the constant unset the
// stamp is not read. And a keeper's save writes only the columns its body
// carries, never from the row read before it, and never the name, the
// region or the logo's address for anyone but an LCA admin: an LCA admin's
// change that lands between a keeper's read and its batch stays, for the
// PATCH and for PUT /api/admin/clubs/[id]/places, whose interleaving a
// wrapped database forces. CLUB_KEEPERS_ON is read through a getter on the
// mocked module, as test/integration/club-save-one-press.test.ts reads it.
// Every club, region and person here is made up; each case makes its own
// region, so the seats of one case never cover another's club.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { onRequestGet as adminClubGet, onRequestPatch as adminClubPatch, SAVED_SINCE } from '../../functions/api/admin/clubs/[id]'
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
afterEach(async () => {
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

/** A made up club in a region of its own, with one place, its rep, a representative for the region and an LCA admin. */
async function exampleClub() {
  const region = newRegion()
  const clubId = await seedClub({ name: 'Example Chess Club', city: 'Example City' })
  await env.DB.prepare(
    'UPDATE clubs SET region = ?, contact_email = ?, about_text = ?, description = ?, location = ?, latitude = ?, longitude = ? WHERE id = ?',
  ).bind(region, 'old@example.org', 'Old about words.', 'Old about words.', 'Example Library', 30.1, -91.2, clubId).run()
  await env.DB.prepare(`INSERT INTO club_places (club_id, name, sort) VALUES (?, 'Example Library', 0)`).bind(clubId).run()
  const rep = await seedMember({ role: 'club_rep', clubId, fullName: 'Club Rep One', email: `rep.${clubId}@example.org` })
  const holder = await seedMember({ fullName: 'Region Holder One', email: `holder.${clubId}@example.org` })
  await regionalSeat(holder, region)
  const admin = await seedAdmin()
  return { clubId, region, rep, holder, admin }
}

const patch = (as: string, clubId: string, body: unknown, extra: { env?: Partial<typeof env> } = {}) =>
  invoke(adminClubPatch, { method: 'PATCH', as, aal: 'aal2', params: { id: clubId }, body, ...extra })
const row = (clubId: string) => env.DB.prepare(
  'SELECT name, region, image_url, about_text, description, contact_email, cost_text, location, latitude, longitude, told_updated_at, told_by FROM clubs WHERE id = ?',
).bind(clubId).first<Record<string, unknown>>()
const placeNames = async (clubId: string) => (await env.DB.prepare('SELECT name FROM club_places WHERE club_id = ? ORDER BY sort').bind(clubId).all<{ name: string }>()).results.map((p) => p.name)
const edits = async (clubId: string) => (await env.DB.prepare(
  `SELECT actor_id, detail FROM admin_audit_log WHERE action = 'club_edit' AND detail LIKE ? ORDER BY rowid`,
).bind(`%"club_id":"${clubId}"%`).all<{ actor_id: string; detail: string }>()).results.map((r) => [r.actor_id, (JSON.parse(r.detail) as { fields: string[] }).fields] as const)

/** The database with the request given run once, just before the first batch of the call it is handed to. */
function withSaveBetween(db: D1Database, between: () => Promise<void>): D1Database {
  let done = false
  return new Proxy(db, {
    get(target, prop) {
      if (prop === 'batch') {
        return async (statements: D1PreparedStatement[]) => {
          if (!done) {
            done = true
            await between()
          }
          return target.batch(statements)
        }
      }
      const value = Reflect.get(target, prop)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}

describe('a form opened before another keeper\'s save, with CLUB_KEEPERS_ON set', () => {
  it('is refused 409 in words, writes nothing and sends no notice, and the form opened afresh saves', async () => {
    const { clubId, rep, admin } = await exampleClub()
    const opened = await invoke(adminClubGet, { as: admin, params: { id: clubId } })
    const read = (await opened.json<{ club: { told_updated_at: string | null } }>()).club.told_updated_at
    expect(read).toBeNull()
    const repSave = await patch(rep, clubId, {
      aboutText: 'New about words.', howWeMeetText: 'Tuesdays at 7:00 PM', contactNamePublic: 'Player Three', contactEmail: 'new@example.org',
      places: [{ name: 'Example Hall', street: null, note: null, point: null }], toldUpdatedAt: read,
    })
    expect(repSave.status).toBe(200)
    await flushWaitUntil()
    const afterRep = await row(clubId)
    const editsBefore = await edits(clubId)
    emailOutbox.length = 0

    // The admin, still on the form from before, changes the cost alone and sends the whole form, as the editor does.
    const stale = await patch(admin, clubId, {
      aboutText: 'Old about words.', howWeMeetText: '', contactNamePublic: '', contactEmail: 'old@example.org',
      places: [{ name: 'Example Library', street: null, note: null, point: null }], name: 'Example Chess Club', region: afterRep!.region, costText: 'Free',
      toldUpdatedAt: read,
    })
    expect(stale.status).toBe(409)
    expect(await stale.json()).toEqual({ error: SAVED_SINCE })
    await flushWaitUntil()
    expect(await row(clubId)).toEqual(afterRep)
    expect(await placeNames(clubId)).toEqual(['Example Hall'])
    expect(await edits(clubId)).toEqual(editsBefore)
    expect(emailOutbox).toHaveLength(0)

    const fresh = (await (await invoke(adminClubGet, { as: admin, params: { id: clubId } })).json<{ club: { told_updated_at: string } }>()).club.told_updated_at
    expect(fresh).toBe(afterRep!.told_updated_at)
    const again = await patch(admin, clubId, { costText: 'Free', toldUpdatedAt: fresh })
    expect(again.status).toBe(200)
    expect(await row(clubId)).toMatchObject({ about_text: 'New about words.', contact_email: 'new@example.org', cost_text: 'Free' })
  })

  it('reads the stamp only when it is sent and only with CLUB_KEEPERS_ON set, and the sign-in comes before it', async () => {
    const { clubId, rep, admin } = await exampleClub()
    await env.DB.prepare(`UPDATE clubs SET told_updated_at = '2026-11-14 18:00:00' WHERE id = ?`).bind(clubId).run()
    // A stamp read before a save made since, and one of a club no keeper had saved, are both refused.
    for (const stamp of ['2026-11-14 17:59:59', null]) expect((await patch(rep, clubId, { costText: 'Free', toldUpdatedAt: stamp })).status, String(stamp)).toBe(409)
    expect((await row(clubId))!.cost_text).toBeNull()
    // The same stamp, and a body without one, save.
    expect((await patch(rep, clubId, { costText: 'Free', toldUpdatedAt: '2026-11-14 18:00:00' })).status).toBe(200)
    expect((await patch(rep, clubId, { costText: 'Free at the door' })).status).toBe(200)
    expect((await row(clubId))!.cost_text).toBe('Free at the door')
    // Role safety: signed out and a member who keeps no club are refused before the stamp is read.
    const member = await seedMember({ fullName: 'Player Four', email: `member.${clubId}@example.org` })
    expect((await invoke(adminClubPatch, { method: 'PATCH', params: { id: clubId }, body: { toldUpdatedAt: null } })).status).toBe(401)
    expect((await patch(member, clubId, { toldUpdatedAt: null })).status).toBe(403)
    // With the constant unset, today's save takes today's body as before and does not read the stamp.
    flags.keepersOn = false
    const today = await patch(admin, clubId, { description: 'Today\'s words.', toldUpdatedAt: '2000-01-01 00:00:00' })
    expect(today.status).toBe(200)
    expect((await row(clubId))!.description).toBe('Today\'s words.')
  })
})

describe('a keeper\'s save writes only the columns its body carries, with CLUB_KEEPERS_ON set', () => {
  it('keeps an LCA admin\'s move, rename and new logo address that land between a region representative\'s read and its batch', async () => {
    const { clubId, holder, admin } = await exampleClub()
    const elsewhere = newRegion()
    const racing = withSaveBetween(env.DB, async () => {
      const moved = await patch(admin, clubId, { region: elsewhere, name: 'Example Chess Club Renamed', imageUrl: `/api/clubs/${clubId}/logo?v=2` })
      expect(moved.status).toBe(200)
    })
    const res = await patch(holder, clubId, { costText: 'Free' }, { env: { DB: racing } })
    expect(res.status).toBe(200)
    expect(await row(clubId)).toMatchObject({ name: 'Example Chess Club Renamed', region: elsewhere, image_url: `/api/clubs/${clubId}/logo?v=2`, cost_text: 'Free' })
    // The move ends the representative's way in, as it was meant to.
    expect((await invoke(adminClubGet, { as: holder, params: { id: clubId } })).status).toBe(403)
    expect(await edits(clubId)).toEqual([[admin, ['name', 'image_url', 'region']], [holder, ['cost_text']]])
  })

  it('writes a club\'s rep\'s statement with none of the columns kept for LCA admins, and an LCA admin\'s with those it carries', async () => {
    const { clubId, rep, admin, region } = await exampleClub()
    const sql: string[] = []
    const watched = new Proxy(env.DB, {
      get(target, prop) {
        if (prop === 'prepare') return (query: string) => { sql.push(query); return target.prepare(query) }
        const value = Reflect.get(target, prop)
        return typeof value === 'function' ? value.bind(target) : value
      },
    })
    const update = () => sql.find((q) => q.startsWith('UPDATE clubs SET ')) ?? ''
    expect((await patch(rep, clubId, { name: 'Example Chess Club', region, costText: 'Free' }, { env: { DB: watched } })).status).toBe(200)
    expect(update()).toBe('UPDATE clubs SET cost_text = ?, told_updated_at = datetime(\'now\'), told_by = ?, last_confirmed_at = datetime(\'now\'), confirmed_by = ? WHERE id = ?')
    sql.length = 0
    expect((await patch(admin, clubId, { name: 'Example Chess Club', costText: 'Free' }, { env: { DB: watched } })).status).toBe(200)
    expect(update()).toMatch(/^UPDATE clubs SET name = \?, cost_text = \?, told_updated_at = /)
    sql.length = 0
    // A body that carries nothing of the listing still stamps the save.
    expect((await patch(rep, clubId, {}, { env: { DB: watched } })).status).toBe(200)
    expect(update()).toMatch(/^UPDATE clubs SET told_updated_at = datetime\('now'\), told_by = \?/)
  })

  it('keeps today\'s location and pin an LCA admin sets between the places save\'s read and its batch, when place 1 supplies neither', async () => {
    const { clubId, rep, admin } = await exampleClub()
    const racing = withSaveBetween(env.DB, async () => {
      const set = await patch(admin, clubId, { location: 'Example New Hall', mapLocation: { lat: 30.4, lng: -91.4 } })
      expect(set.status).toBe(200)
    })
    const res = await invoke(placesPut, { method: 'PUT', as: rep, aal: 'aal2', params: { id: clubId }, body: { places: [] }, env: { DB: racing } })
    expect(res.status).toBe(200)
    expect(await row(clubId)).toMatchObject({ location: 'Example New Hall', latitude: 30.4, longitude: -91.4 })
    expect(await placeNames(clubId)).toEqual([])
    // A place 1 with a point still sets today's location and pin from it.
    expect((await invoke(placesPut, { method: 'PUT', as: rep, aal: 'aal2', params: { id: clubId }, body: { places: [{ name: 'Example Hall', point: { lat: 30.5, lng: -91.5 } }] } })).status).toBe(200)
    expect(await row(clubId)).toMatchObject({ location: 'Example Hall', latitude: 30.5, longitude: -91.5 })
  })
})
