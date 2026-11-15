// test/integration/club-roster-kept-back-keepers.test.ts
// K's answer 2 (a) to checkpoint S's choices still holds with CLUB_KEEPERS_ON
// set (functions/utils/clubs/pages.ts), for a person admitted to a club by a
// regional seat alone (admittedByRegionAlone in
// functions/utils/clubs/memberView.ts): GET /api/admin/clubs/[id] answers
// them no hidden draft and says the roster is kept back, beside the listing's
// new columns and its places; the removal and the adding of an officer
// answer them 403 and change nothing; and the keepers' save, PATCH and PUT
// places, answers them the club and its places alone and writes no officer,
// member or event, whatever the body carries.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { contracts } from '../../domain/contracts'
import { expectContract, flushWaitUntil, invoke, resetHarness } from './harness'
import { seedAdmin, seedClub, seedMember, seedTournament } from './factories'

import { onRequestGet as adminClubGet, onRequestPatch as adminClubPatch } from '../../functions/api/admin/clubs/[id]'
import { onRequestPut as placesPut } from '../../functions/api/admin/clubs/[id]/places'
import { onRequestPost as officersPost } from '../../functions/api/admin/clubs/[id]/officers'
import { onRequestDelete as officerDelete } from '../../functions/api/admin/clubs/[id]/officers/[officerId]'
import { ROSTER_KEPT_BACK } from '../../functions/utils/clubs/memberView'

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

beforeEach(resetHarness)
afterEach(async () => {
  await flushWaitUntil()
  flags.keepersOn = true
})

const REGION = 'Bayou Region'

/** A regional seat covering the region, held by the member, as the seat screens write one. */
async function regionalSeat(memberId: string): Promise<void> {
  const id = `seat-${crypto.randomUUID().slice(0, 8)}`
  await env.DB.prepare(
    `INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active)
     VALUES (?, 'Example Region Representative', '', 99, ?, 'regional_rep', 1)`,
  ).bind(id, id).run()
  await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(id, REGION).run()
  await env.DB.prepare('INSERT INTO board_seat_assignments (seat_id, member_id) VALUES (?, ?)').bind(id, memberId).run()
}

/** A made up club in the region with its rep, one officer, a member, a visible event, a hidden draft and a seat holder. */
async function exampleClub() {
  const clubId = await seedClub({ name: 'Example Chess Club', city: 'Example City' })
  await env.DB.prepare('UPDATE clubs SET region = ? WHERE id = ?').bind(REGION, clubId).run()
  const rep = await seedMember({ role: 'club_rep', clubId, fullName: 'Club Rep One', email: `rep.${clubId}@example.org` })
  const one = await seedMember({ clubId, fullName: 'Player One', email: `one.${clubId}@example.org`, uscfId: '90000031', uscfRating: 1300 })
  const admin = await seedAdmin()
  const added = await invoke(officersPost, { method: 'POST', as: admin, params: { id: clubId }, body: { memberId: one, title: 'President' } })
  expect(added.status).toBe(201)
  const officerId = (await added.json<{ officers: Array<{ id: string }> }>()).officers[0].id
  const visible = await seedTournament({ clubId, name: 'Example Fall Open', date: '2026-10-24' })
  const draft = await seedTournament({ clubId, name: 'Example Draft Open', date: '2027-01-09', isVisible: false })
  const holder = await seedMember({ fullName: 'Region Holder One', email: `holder.${clubId}@example.org` })
  await regionalSeat(holder)
  return { clubId, rep, one, admin, officerId, visible, draft, holder }
}

/** The club's officers, its members and its events, read to see that a save wrote none of them. */
async function rosterAndEvents(clubId: string) {
  return {
    officers: (await env.DB.prepare('SELECT id, member_id, role FROM club_officers WHERE club_id = ? ORDER BY id').bind(clubId).all()).results,
    members: (await env.DB.prepare('SELECT id, club_id, role FROM members WHERE club_id = ? ORDER BY id').bind(clubId).all()).results,
    events: (await env.DB.prepare('SELECT id, is_visible, status FROM tournaments WHERE club_id = ? ORDER BY id').bind(clubId).all()).results,
  }
}

describe('with CLUB_KEEPERS_ON set, the roster stays back from a region\'s representative', () => {
  it('the GET answers them no hidden draft and rosterKeptBack beside the new columns and the places, and everyone else the draft and no key', async () => {
    const { clubId, rep, admin, visible, draft, holder } = await exampleClub()
    expect((await invoke(placesPut, { method: 'PUT', as: admin, params: { id: clubId }, body: { places: [{ name: 'Example Hall' }] } })).status).toBe(200)

    const res = await invoke(adminClubGet, { as: holder, aal: 'aal1', params: { id: clubId } })
    expect(res.status).toBe(200)
    const text = await res.response.clone().text()
    const body = await expectContract(res, contracts['admin/clubs/[id]'].GET.response)
    expect(Object.keys(body)).toEqual(['club', 'officers', 'roster', 'rosterKeptBack', 'tournaments', 'places'])
    expect(body.rosterKeptBack).toBe(true)
    expect(body.roster).toEqual([])
    expect(body.tournaments.map((t) => t.id)).toEqual([visible])
    expect(body.places.map((p) => p.name)).toEqual(['Example Hall'])
    expect('slug' in body.club).toBe(true)
    for (const piece of [draft, 'Example Draft Open', `one.${clubId}@example.org`, `rep.${clubId}@example.org`, '90000031', '"email"']) expect(text, piece).not.toContain(piece)

    for (const [who, aal] of [[admin, 'aal2'], [rep, 'aal2']] as const) {
      const theirs = await invoke(adminClubGet, { as: who, aal, params: { id: clubId } })
      expect(theirs.status, who).toBe(200)
      expect(await theirs.response.clone().text(), who).not.toContain('rosterKeptBack')
      const { tournaments } = await expectContract(theirs, contracts['admin/clubs/[id]'].GET.response)
      expect(tournaments.map((t) => t.id), who).toEqual([draft, visible])
    }
  })

  it('the removal and the adding of an officer answer them 403 in words, and the officer stays', async () => {
    const { clubId, one, officerId, holder } = await exampleClub()
    const before = await rosterAndEvents(clubId)
    const removal = await invoke(officerDelete, { method: 'DELETE', as: holder, aal: 'aal1', params: { id: clubId, officerId } })
    expect(removal.status).toBe(403)
    expect(await removal.json()).toEqual({ error: ROSTER_KEPT_BACK })
    const adding = await invoke(officersPost, { method: 'POST', as: holder, aal: 'aal1', params: { id: clubId }, body: { memberId: one, title: 'Secretary' } })
    expect(adding.status).toBe(403)
    expect(await adding.json()).toEqual({ error: ROSTER_KEPT_BACK })
    expect(await rosterAndEvents(clubId)).toEqual(before)
  })

  it('the keepers\' save answers them the club and its places alone, and writes no officer, member or event whatever the body carries', async () => {
    const { clubId, one, draft, holder } = await exampleClub()
    const before = await rosterAndEvents(clubId)

    const saved = await invoke(adminClubPatch, {
      method: 'PATCH', as: holder, aal: 'aal1', params: { id: clubId },
      body: {
        aboutText: 'A made up club that meets on Tuesdays.', places: [{ name: 'Example Library' }],
        officers: [{ memberId: holder, title: 'President' }], roster: [{ id: holder }], tournaments: [{ id: draft, is_visible: 1 }], memberId: one, clubId: 'another-club',
      },
    })
    expect(saved.status).toBe(200)
    const text = await saved.response.clone().text()
    const body = await expectContract(saved, contracts['admin/clubs/[id]'].PATCH.response)
    expect(Object.keys(body)).toEqual(['club', 'places'])
    expect(body.club.about_text).toBe('A made up club that meets on Tuesdays.')
    for (const piece of [draft, `one.${clubId}@example.org`, '"email"', 'rosterKeptBack', '"officers"', '"roster"', '"tournaments"']) expect(text, piece).not.toContain(piece)

    const placed = await invoke(placesPut, { method: 'PUT', as: holder, aal: 'aal1', params: { id: clubId }, body: { places: [{ name: 'Example Hall' }] } })
    expect(placed.status).toBe(200)
    expect(Object.keys(await placed.json<Record<string, unknown>>())).toEqual(['places'])

    // What only an LCA admin changes stays refused, and nothing is written.
    for (const [change, words] of [
      [{ name: 'Another Name' }, 'Only LCA admins can rename a club'],
      [{ region: 'North Louisiana' }, 'Only LCA admins can change a club\'s region'],
      [{ imageUrl: 'https://example.org/logo.png' }, 'Upload a new image instead of setting its URL'],
      [{ slug: `moved-${clubId}` }, 'Only LCA admins can change a club\'s page address'],
    ] as const) {
      const refused = await invoke(adminClubPatch, { method: 'PATCH', as: holder, aal: 'aal1', params: { id: clubId }, body: change })
      expect(refused.status, words).toBe(403)
      expect(await refused.json(), words).toEqual({ error: words })
    }
    expect(await env.DB.prepare('SELECT name, region, image_url, slug FROM clubs WHERE id = ?').bind(clubId).first())
      .toEqual({ name: 'Example Chess Club', region: REGION, image_url: null, slug: null })
    expect(await rosterAndEvents(clubId)).toEqual(before)
  })
})
