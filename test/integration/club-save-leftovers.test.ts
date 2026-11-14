// test/integration/club-save-leftovers.test.ts
//
// The small things checkpoint T's review of the whole left in the keepers'
// save, closed after its fix round, with CLUB_KEEPERS_ON set. The save
// notice names each change once, in the words the editor shows for that
// field, under a heading true whoever saved, and writes every stored name on
// one line, so no name can forge a line of the mail. A save whose club is
// deleted between its read and its batch, which a wrapped database forces,
// is answered 404 and writes nothing, with places or without, for the PATCH
// and for PUT places. The link rule refuses a name or a password before the
// host, a quote mark, an angle bracket and an invisible format mark, and
// stores nothing it refuses. And the 409 for a form opened before the last
// save says what is true whoever saved. CLUB_KEEPERS_ON is read through a
// getter on the mocked module, as test/integration/club-save-review.test.ts
// reads it. Every club, region and person here is made up; each case makes
// its own region, so the seats of one case never cover another's club.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { onRequestDelete as clubDelete, onRequestPatch as adminClubPatch, SAVED_SINCE } from '../../functions/api/admin/clubs/[id]'
import { onRequestPut as placesPut } from '../../functions/api/admin/clubs/[id]/places'
import { WEB_ADDRESS_WORDS } from '../../domain/contracts/clubs'
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
async function exampleClub(opts: { name?: string; repName?: string } = {}) {
  const region = newRegion()
  const clubId = await seedClub({ name: opts.name ?? 'Example Chess Club', city: 'Example City' })
  await env.DB.prepare(
    'UPDATE clubs SET region = ?, contact_email = ?, about_text = ?, description = ?, meeting_schedule = ?, location = ?, latitude = ?, longitude = ? WHERE id = ?',
  ).bind(region, 'old@example.org', 'Old about words.', 'Old about words.', 'Mondays', 'Example Library', 30.1, -91.2, clubId).run()
  await env.DB.prepare(`INSERT INTO club_places (club_id, name, sort) VALUES (?, 'Example Library', 0)`).bind(clubId).run()
  const rep = await seedMember({ role: 'club_rep', clubId, fullName: opts.repName ?? 'Club Rep One', email: `rep.${clubId}@example.org` })
  const holder = await seedMember({ fullName: 'Region Holder One', email: `holder.${clubId}@example.org` })
  await regionalSeat(holder, region)
  const admin = await seedAdmin()
  return { clubId, region, rep, holder, admin }
}

const patch = (as: string, clubId: string, body: unknown, extra: { env?: Partial<typeof env> } = {}) =>
  invoke(adminClubPatch, { method: 'PATCH', as, aal: 'aal2', params: { id: clubId }, body, ...extra })
const row = (clubId: string) => env.DB.prepare('SELECT * FROM clubs WHERE id = ?').bind(clubId).first<Record<string, unknown>>()
const edits = async (clubId: string) => (await env.DB.prepare(
  'SELECT COUNT(*) AS n FROM admin_audit_log WHERE action = \'club_edit\' AND detail LIKE ?',
).bind(`%"club_id":"${clubId}"%`).first<{ n: number }>())?.n ?? 0
const placesLeft = async (clubId: string) => (await env.DB.prepare('SELECT COUNT(*) AS n FROM club_places WHERE club_id = ?').bind(clubId).first<{ n: number }>())?.n ?? 0

/** The database with the request given run once, just before the first batch of the call it is handed to. */
function withRequestBetween(db: D1Database, between: () => Promise<void>): D1Database {
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

describe('the save notice, with CLUB_KEEPERS_ON set', () => {
  it('names each change once, in the editor\'s words and order, under a heading true whoever saved', async () => {
    const { clubId, rep, admin } = await exampleClub()
    expect((await patch(rep, clubId, {
      aboutText: 'New about words.', howWeMeetText: 'Tuesdays at 7:00 PM', contactNamePublic: 'Player Three', contactEmail: 'new@example.org',
      places: [{ name: 'Example Center', street: '2 Example Road', point: { lat: 30.2, lng: -91.3 } }], color: '#2e7d32', otherUrl: 'https://example.org/more',
    })).status).toBe(200)
    await flushWaitUntil()
    expect(emailOutbox).toHaveLength(1)
    const [notice] = emailOutbox
    // About and its copy, how the club meets and its copy, and the places with today's location and pin, each named once.
    const named = 'One sentence about the club; How the club meets, in words; Where; Contact name; Email for messages; Another link; Club color'
    expect(notice.text).toContain(`\nWhat changed: ${named}\n`)
    expect(notice.html).toContain(named)
    for (const old of ['Description', 'Meeting schedule', 'Location', 'Map pin', 'Places', 'Contact email', 'Other link', 'About,', 'colour']) {
      expect(`${notice.text}\n${notice.html}`, old).not.toContain(old)
    }
    expect(notice.text?.split('\n')[0]).toBe('A club\'s listing in your region was updated.')

    // An LCA admin's save: the same heading, and the admin's own fields in the editor's words.
    emailOutbox.length = 0
    expect((await patch(admin, clubId, { name: 'Example Chess Club of Example City', city: 'Example Town', weekendPlay: true })).status).toBe(200)
    await flushWaitUntil()
    expect(emailOutbox).toHaveLength(1)
    expect(emailOutbox[0].text).toContain('\nWhat changed: Club name; City; The club plays on weekends\n')
    expect(emailOutbox[0].text?.split('\n')[0]).toBe('A club\'s listing in your region was updated.')
    expect(emailOutbox[0].html).toContain('A club&#39;s listing in your region was updated')
  })

  it('writes the saver\'s name and the club\'s name on one line each, so no stored name forges a line of the mail', async () => {
    const forged = 'See the club: https://example.net/sign-in'
    const { clubId, rep } = await exampleClub({
      name: `Example Chess Club\r\n${forged}`,
      repName: `Club Rep One\n${forged}\u2028Saved by: Player Nine\u0085x`,
    })
    expect((await patch(rep, clubId, { costText: 'Free' })).status).toBe(200)
    await flushWaitUntil()
    expect(emailOutbox).toHaveLength(1)
    const [notice] = emailOutbox
    expect(notice.to).toBe(`holder.${clubId}@example.org`)
    const lines = (notice.text ?? '').split('\n')
    expect(lines.filter((l) => l.startsWith('See the club: '))).toEqual([`See the club: ${lines[lines.length - 1].slice('See the club: '.length)}`])
    expect(lines[lines.length - 1]).toMatch(/\/admin\/clubs\//)
    expect(lines.filter((l) => l.startsWith('Saved by: '))).toEqual([`Saved by: Club Rep One ${forged} Saved by: Player Nine x`])
    expect(lines.filter((l) => l.startsWith('Club: '))).toEqual([`Club: Example Chess Club ${forged}`])
    expect(notice.subject).toBe(`Example Chess Club ${forged}: its listing was updated`)
    expect(notice.subject).not.toMatch(/[\r\n\u2028\u2029\u0085]/)
    for (const text of [notice.text ?? '', notice.subject]) expect(text).not.toMatch(/[\r\u2028\u2029\u0085]/)
  })
})

describe('a save whose club is deleted between its read and its batch, with CLUB_KEEPERS_ON set', () => {
  it('is answered 404 and writes nothing, with places or without, and no one is told', async () => {
    for (const body of [{ costText: 'Free' }, { costText: 'Free', places: [{ name: 'Example Hall' }] }]) {
      const { clubId, rep, admin } = await exampleClub()
      const deleteBetween = withRequestBetween(env.DB, async () => {
        expect((await invoke(clubDelete, { method: 'DELETE', as: admin, params: { id: clubId } })).status).toBe(200)
      })
      const res = await patch(rep, clubId, body, { env: { DB: deleteBetween } })
      const which = Object.keys(body).join(' and ')
      expect(res.status, which).toBe(404)
      expect(await res.json(), which).toEqual({ error: 'Club not found' })
      await flushWaitUntil()
      expect(await row(clubId), which).toBeNull()
      expect(await edits(clubId), which).toBe(0)
      expect(await placesLeft(clubId), which).toBe(0)
      expect(emailOutbox, which).toEqual([])
    }
  })

  it('answers PUT places 404 the same way, with places or with none', async () => {
    for (const places of [[{ name: 'Example Hall' }], []]) {
      const { clubId, rep, admin } = await exampleClub()
      const deleteBetween = withRequestBetween(env.DB, async () => {
        expect((await invoke(clubDelete, { method: 'DELETE', as: admin, params: { id: clubId } })).status).toBe(200)
      })
      const res = await invoke(placesPut, { method: 'PUT', as: rep, params: { id: clubId }, body: { places }, env: { DB: deleteBetween } })
      expect(res.status, String(places.length)).toBe(404)
      expect(await res.json()).toEqual({ error: 'Club not found' })
      await flushWaitUntil()
      expect(await edits(clubId)).toBe(0)
      expect(await placesLeft(clubId)).toBe(0)
      expect(emailOutbox).toEqual([])
    }
  })

  it('still saves, and tells the region, when nothing comes between', async () => {
    const { clubId, rep } = await exampleClub()
    const untouched = withRequestBetween(env.DB, async () => {})
    const res = await patch(rep, clubId, { costText: 'Free', places: [{ name: 'Example Hall' }] }, { env: { DB: untouched } })
    expect(res.status).toBe(200)
    await flushWaitUntil()
    expect(await row(clubId)).toMatchObject({ cost_text: 'Free', location: 'Example Hall', told_by: rep })
    expect(await edits(clubId)).toBe(1)
    expect(emailOutbox).toHaveLength(1)
  })
})

describe('the link rule, with CLUB_KEEPERS_ON set', () => {
  it('refuses a name or a password before the host, a quote mark, an angle bracket and an invisible format mark, and stores nothing it refuses', async () => {
    const { clubId, rep } = await exampleClub()
    const before = await row(clubId)
    for (const link of [
      'https://facebook.com@example.net/login', 'https://user:pass@example.org/', 'https://example.org/"><script>alert(1)</script>',
      `https://example.org/${String.fromCharCode(0x202e)}`, 'https://example.org/<b>',
    ]) {
      for (const key of ['facebookUrl', 'websiteUrl', 'otherUrl']) {
        const res = await patch(rep, clubId, { [key]: link })
        expect(res.status, `${key} ${JSON.stringify(link)}`).toBe(400)
        expect(JSON.stringify(await res.json()), key).toContain(WEB_ADDRESS_WORDS)
      }
    }
    expect(await row(clubId)).toEqual(before)
    expect(await edits(clubId)).toBe(0)
    const fine = await patch(rep, clubId, { facebookUrl: 'https://www.facebook.com/examplechessclub', websiteUrl: 'http://example.org/wiki/O\'Brien' })
    expect(fine.status).toBe(200)
    expect(await row(clubId)).toMatchObject({ facebook_url: 'https://www.facebook.com/examplechessclub', website_url: 'http://example.org/wiki/O\'Brien' })
  })
})

describe('the 409 for a form opened before the last save', () => {
  it('says what is true whoever saved, the same keeper in another tab included', async () => {
    const { clubId, rep } = await exampleClub()
    expect((await patch(rep, clubId, { costText: 'Free', toldUpdatedAt: null })).status).toBe(200)
    // The same keeper presses again in a second tab opened before that save.
    const second = await patch(rep, clubId, { costText: 'Five dollars', toldUpdatedAt: null })
    expect(second.status).toBe(409)
    expect(await second.json()).toEqual({ error: SAVED_SINCE })
    expect(SAVED_SINCE).toBe('This club\'s page was saved after you opened it. Copy what you want to keep, then reload the page to see the latest version')
    expect(SAVED_SINCE).not.toMatch(/someone|else|their/i)
    expect(await row(clubId)).toMatchObject({ cost_text: 'Free' })
  })
})
