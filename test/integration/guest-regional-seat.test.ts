// test/integration/guest-regional-seat.test.ts
//
// A guest account that holds a regional seat (WS09 switch-on, on main's tree),
// through the real handlers on a D1 database built from every migration. The
// seat lists answer a guest truthfully: GET /api/board/my-seats gives the seat
// and the clubs its region covers, which is all the dashboard's card draws
// from. Every other door a seat opens is shut to a guest: My region's answer,
// Still accurate, the club's admin page, its news and roster lists, and the
// saves of its listing and places answer 403 and write nothing, and never carry
// the club's name or its email. A member with the same seat is let through,
// which keeps each refusal a role's and not the region's. The cases run with
// CLUB_KEEPERS_ON set and with it unset, through a getter on the mocked
// module. Every club, region and person here is made up.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { onRequestGet as regionGet } from '../../functions/api/workspace/region'
import { onRequestPost as confirmPost } from '../../functions/api/admin/clubs/[id]/confirm'
import { onRequestGet as adminClubGet, onRequestPatch as adminClubPatch } from '../../functions/api/admin/clubs/[id]'
import { onRequestGet as newsGet } from '../../functions/api/admin/clubs/[id]/news'
import { onRequestGet as rosterGet } from '../../functions/api/admin/clubs/[id]/roster'
import { onRequestPut as placesPut } from '../../functions/api/admin/clubs/[id]/places'
import { onRequestGet as mySeatsGet } from '../../functions/api/board/my-seats'
import { invoke, resetHarness } from './harness'
import { seedClub, seedMember } from './factories'

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

const newRegion = () => `Example Region ${crypto.randomUUID().slice(0, 8)}`

async function seat(memberId: string, regions: string[]): Promise<string> {
  const id = `seat-${crypto.randomUUID().slice(0, 8)}`
  await env.DB.prepare(
    `INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active)
     VALUES (?, 'Example Region Representative', '', 99, ?, 'regional_rep', 1)`,
  ).bind(id, id).run()
  for (const region of regions) await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(id, region).run()
  await env.DB.prepare('INSERT INTO board_seat_assignments (seat_id, member_id, ended_at) VALUES (?, ?, NULL)').bind(id, memberId).run()
  return id
}

async function club(region: string): Promise<string> {
  const id = await seedClub({ name: 'Example Chess Club', city: 'Example City' })
  await env.DB.prepare(
    `UPDATE clubs SET region = ?, slug = ?, contact_email = ?, how_we_meet_text = 'Tuesdays at 7:00 PM in the library.' WHERE id = ?`,
  ).bind(region, id, `club.${id}@example.org`, id).run()
  return id
}

async function listing(clubId: string): Promise<Record<string, unknown>> {
  return (await env.DB.prepare('SELECT * FROM clubs WHERE id = ?').bind(clubId).first<Record<string, unknown>>())!
}
async function auditRows(): Promise<number> {
  return Number((await env.DB.prepare('SELECT COUNT(*) AS n FROM admin_audit_log').first<{ n: number }>())!.n)
}

/** The seat holders and the club they share a region with: a guest account and a member account. */
async function holders() {
  const region = newRegion()
  const clubId = await club(region)
  const guest = await seedMember({ role: 'guest', fullName: 'Player One' })
  await seat(guest, [region])
  const member = await seedMember({ fullName: 'Player Two' })
  await seat(member, [region])
  return { region, clubId, guest, member }
}

describe('a guest account that holds a regional seat', () => {
  for (const keepersOn of [true, false]) {
    it(`with CLUB_KEEPERS_ON ${keepersOn ? 'set' : 'unset'}, is answered the seat and its clubs by the seat list, which is what the dashboard's card draws from`, async () => {
      flags.keepersOn = keepersOn
      const { region, clubId, guest, member } = await holders()
      for (const who of [guest, member]) {
        const res = await invoke(mySeatsGet, { as: who, aal: 'aal1' })
        expect(res.status, who).toBe(200)
        const body = await res.json<{ seats: Array<{ category: string; regions: string[] }>; managedClubs: Array<{ id: string; name: string; region: string | null }> }>()
        expect(body.seats.map((s) => [s.category, s.regions]), who).toEqual([['regional_rep', [region]]])
        expect(body.managedClubs, who).toEqual([{ id: clubId, name: 'Example Chess Club', region }])
      }
    })

    it(`with CLUB_KEEPERS_ON ${keepersOn ? 'set' : 'unset'}, is refused My region's answer with 403 and never given a club`, async () => {
      flags.keepersOn = keepersOn
      const { clubId, guest, member } = await holders()
      const refused = await invoke(regionGet, { as: guest, aal: 'aal1' })
      expect(refused.status).toBe(403)
      const text = await refused.response.text()
      expect(text).not.toContain(clubId)
      expect(text).not.toContain('Example Chess Club')
      expect(text).not.toContain('example.org')
      // The same answer for a member when the switch is off, and a 200 for a member when it is on: the region does not open it, the role does.
      const memberAnswer = await invoke(regionGet, { as: member, aal: 'aal1' })
      expect(memberAnswer.status).toBe(keepersOn ? 200 : 403)
    })
  }

  it('is refused 403 by every club door a seat opens, writes nothing and leaves no audit row, where a member with the same seat is let in', async () => {
    const { clubId, guest, member } = await holders()
    const before = { club: await listing(clubId), audit: await auditRows() }
    const doors: Array<[string, () => ReturnType<typeof invoke>]> = [
      ['GET the club\'s admin page', () => invoke(adminClubGet, { as: guest, aal: 'aal1', params: { id: clubId } })],
      ['GET its news', () => invoke(newsGet, { as: guest, aal: 'aal1', params: { id: clubId } })],
      ['GET its roster', () => invoke(rosterGet, { as: guest, aal: 'aal1', params: { id: clubId } })],
      ['PATCH its listing', () => invoke(adminClubPatch, { method: 'PATCH', as: guest, aal: 'aal1', params: { id: clubId }, body: { aboutText: 'Not theirs to save' } })],
      ['PUT its places', () => invoke(placesPut, { method: 'PUT', as: guest, aal: 'aal1', params: { id: clubId }, body: { places: [{ name: 'Example Hall' }] } })],
      ['POST Still accurate', () => invoke(confirmPost, { method: 'POST', as: guest, aal: 'aal1', params: { id: clubId }, body: {} })],
    ]
    for (const [door, ask] of doors) {
      const res = await ask()
      expect(res.status, door).toBe(403)
      const text = await res.response.text()
      expect(text, door).not.toContain(clubId)
      expect(text, door).not.toContain('Example Chess Club')
      expect(text, door).not.toContain('example.org')
    }
    expect(await listing(clubId)).toEqual(before.club)
    expect(await auditRows()).toBe(before.audit)
    // The control: the member holding the same seat reads the club's admin page.
    const admitted = await invoke(adminClubGet, { as: member, aal: 'aal1', params: { id: clubId } })
    expect(admitted.status).toBe(200)
  })

  it('is refused the same way for a club that does not exist, so a refusal says nothing of which clubs there are', async () => {
    const { clubId, guest } = await holders()
    const real = await invoke(adminClubGet, { as: guest, aal: 'aal1', params: { id: clubId } })
    const missing = await invoke(adminClubGet, { as: guest, aal: 'aal1', params: { id: 'example-no-such-club' } })
    expect([real.status, missing.status]).toEqual([403, 403])
    expect(await missing.response.text()).toBe(await real.response.text())
  })

  it('is refused a club in a region the seat does not cover', async () => {
    const { guest } = await holders()
    const otherClub = await club(newRegion())
    const res = await invoke(adminClubGet, { as: guest, aal: 'aal1', params: { id: otherClub } })
    expect(res.status).toBe(403)
  })
})
