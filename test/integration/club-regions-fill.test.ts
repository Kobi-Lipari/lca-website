// test/integration/club-regions-fill.test.ts
// Migration 0065 (the regions fill) as the Workers runtime meets it, on a D1
// database built from every migration:
// - the 25 real clubs come out with a region, and the public club list the
//   page's region pills read carries it;
// - a regional seat holder is admitted to the clubs of the seat's regions
//   and to no others, can save a club's listing, and cannot rename a club
//   or change its region;
// - the seat's edges that matter once regions are set: an ended assignment,
//   an inactive seat, another kind of seat, a guest, a club with a blank
//   region;
// - no handler under functions/api/admin/clubs answers that person with a
//   member's email, US Chess ID, rating or membership status, or tells them
//   whether a member id is on the club's roster;
// - replaying the migration on this database changes no row.
import { describe, it, expect } from 'vitest'
import { env } from 'cloudflare:test'
import { invoke } from './harness'
import { migrationModules, splitSql } from './setup'
import { seedAdmin, seedClub, seedMember } from './factories'

import { onRequestGet as clubsGet } from '../../functions/api/clubs'
import {
  onRequestGet as adminClubGet,
  onRequestPatch as adminClubPatch,
} from '../../functions/api/admin/clubs/[id]'
import {
  onRequestGet as officersGet,
  onRequestPost as officersPost,
} from '../../functions/api/admin/clubs/[id]/officers'
import { onRequestDelete as officerDelete } from '../../functions/api/admin/clubs/[id]/officers/[officerId]'
import { onRequestGet as rosterGet } from '../../functions/api/admin/clubs/[id]/roster'
import {
  onRequestGet as newsGet,
  onRequestPost as newsPost,
} from '../../functions/api/admin/clubs/[id]/news'
import { onRequestPost as logoPost } from '../../functions/api/admin/clubs/[id]/logo'
import { REGIONS } from '../../domain/clubs/regions'

const COUNTS: Record<string, number> = {
  'New Orleans Metro': 8,
  'North of Lake Pontchartrain': 3,
  'South Central Louisiana': 5,
  'Bayou Region': 2,
  'Southwest Louisiana': 2,
  'Central Louisiana': 2,
  'North Louisiana': 3,
}

async function seat(
  memberId: string,
  regions: string[],
  opts: { category?: string; isActive?: number; ended?: boolean } = {},
): Promise<string> {
  const id = `seat-${crypto.randomUUID().slice(0, 8)}`
  await env.DB.prepare(
    `INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active)
     VALUES (?, 'Example Region Representative', '', 99, ?, ?, ?)`,
  ).bind(id, id, opts.category ?? 'regional_rep', opts.isActive ?? 1).run()
  for (const region of regions) {
    await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(id, region).run()
  }
  await env.DB.prepare(
    `INSERT INTO board_seat_assignments (seat_id, member_id, ended_at) VALUES (?, ?, ?)`,
  ).bind(id, memberId, opts.ended ? '2026-01-01 00:00:00' : null).run()
  return id
}

/** Two made up members on a club, carrying every field a roster would answer. */
async function populate(clubId: string) {
  const one = await seedMember({
    clubId, fullName: 'Player One', email: 'player.one@example.org', uscfId: '90000011', uscfRating: 1700, membershipStatus: 'active',
  })
  const two = await seedMember({
    clubId, fullName: 'Player Two', email: 'player.two@example.org', uscfId: '90000012', uscfRating: 1300, membershipStatus: 'expired',
  })
  const admin = await seedAdmin()
  const added = await invoke(officersPost, {
    method: 'POST', as: admin, params: { id: clubId }, body: { memberId: one, title: 'President' },
  })
  expect(added.status).toBe(201)
  return { one, two, admin }
}

function holdsNoMemberData(body: string, label: string) {
  for (const piece of ['player.one@example.org', 'player.two@example.org', '90000011', '90000012', '"uscf_rating"', '"membership_status"', '"email"']) {
    expect(body, `${label}: ${piece}`).not.toContain(piece)
  }
}

describe('the regions fill on a database built from the migrations', () => {
  it('the public club list carries every club\'s region, 8, 3, 5, 2, 2, 2 and 3', async () => {
    const res = await invoke(clubsGet, {})
    expect(res.status).toBe(200)
    const { clubs } = await res.json<{ clubs: Array<{ id: string; region: string | null }> }>()
    expect(clubs).toHaveLength(25)
    const counts: Record<string, number> = {}
    for (const club of clubs) {
      expect(REGIONS as readonly string[], club.id).toContain(club.region)
      counts[club.region as string] = (counts[club.region as string] ?? 0) + 1
    }
    expect(counts).toEqual(COUNTS)
  })

  it('a club made after the fill has no region until someone sets one', async () => {
    const clubId = await seedClub({ name: 'Example Chess Club' })
    const { clubs } = await (await invoke(clubsGet, {})).json<{ clubs: Array<{ id: string; region: string | null }> }>()
    expect(clubs.find((c) => c.id === clubId)?.region).toBeNull()
  })

  it('replaying the migration on this database changes no row', async () => {
    const [path] = Object.keys(migrationModules).filter((p) => p.endsWith('/0065_club_regions.sql'))
    expect(path).toBeDefined()
    const before = JSON.stringify((await env.DB.prepare('SELECT id, region FROM clubs ORDER BY id').all()).results)
    let changed = 0
    for (const stmt of splitSql(migrationModules[path])) {
      const out = await env.DB.prepare(stmt).run()
      changed += out.meta.changes ?? 0
    }
    expect(changed).toBe(0)
    expect(JSON.stringify((await env.DB.prepare('SELECT id, region FROM clubs ORDER BY id').all()).results)).toBe(before)
  })
})

describe('a regional seat holder on the real clubs', () => {
  it('is admitted to the seat\'s regions only, and sees no roster and no officer\'s email', async () => {
    await populate('shreveport')
    const holder = await seedMember({ fullName: 'Region Holder One', email: 'region.holder.one@example.org' })
    await seat(holder, ['North Louisiana'])

    const res = await invoke(adminClubGet, { as: holder, aal: 'aal1', params: { id: 'shreveport' } })
    expect(res.status).toBe(200)
    const body = await res.json<{ club: { region: string }; officers: unknown[]; roster: unknown[] }>()
    expect(body.club.region).toBe('North Louisiana')
    expect(body.officers).toHaveLength(1)
    expect(body.roster).toEqual([])
    holdsNoMemberData(JSON.stringify(body), 'shreveport')

    for (const id of ['monroe', 'ruston']) {
      expect((await invoke(adminClubGet, { as: holder, aal: 'aal1', params: { id } })).status, id).toBe(200)
    }
    for (const id of ['metairie', 'baton-rouge', 'houma-chess-club', 'casa-de-ajedrez', 'bunkie-chess-club', 'slidell']) {
      const other = await invoke(adminClubGet, { as: holder, aal: 'aal1', params: { id } })
      expect(other.status, id).toBe(403)
      expect(await other.json(), id).toEqual({ error: 'Forbidden' })
    }
  })

  it('a seat with two regions admits both, and every real club is reached by the seat of its own region', async () => {
    const holder = await seedMember()
    await seat(holder, ['Bayou Region', 'Southwest Louisiana'])
    for (const id of ['houma-chess-club', 'morgan-city-chess-club', 'casa-de-ajedrez', 'beauregard-parish-youth-chess']) {
      expect((await invoke(adminClubGet, { as: holder, aal: 'aal1', params: { id } })).status, id).toBe(200)
    }
    expect((await invoke(adminClubGet, { as: holder, aal: 'aal1', params: { id: 'shreveport' } })).status).toBe(403)

    const { results } = await env.DB.prepare('SELECT id, region FROM clubs').all<{ id: string; region: string }>()
    for (const region of REGIONS) {
      const who = await seedMember()
      await seat(who, [region])
      for (const club of results) {
        const res = await invoke(rosterGet, { as: who, aal: 'aal1', params: { id: club.id } })
        // 403 either way, but only the seat's own region is let past the club guard: its words differ.
        const words = (await res.json<{ error: string }>()).error
        expect(words === 'Forbidden', `${region} on ${club.id}`).toBe(club.region !== region)
      }
    }
  })

  it('can save a club\'s listing, and a whole-record save with the unchanged name and region goes through', async () => {
    const holder = await seedMember()
    await seat(holder, ['North Louisiana'])
    const club = await (await invoke(adminClubGet, { as: holder, aal: 'aal1', params: { id: 'ruston' } }))
      .json<{ club: { name: string; city: string; region: string; image_url: string | null } }>()
    const res = await invoke(adminClubPatch, {
      method: 'PATCH', as: holder, aal: 'aal1', params: { id: 'ruston' },
      body: { name: club.club.name, region: club.club.region, description: 'We meet on Tuesdays' },
    })
    expect(res.status).toBe(200)
    const row = await env.DB.prepare('SELECT description, region, name FROM clubs WHERE id = ?')
      .bind('ruston').first<{ description: string; region: string; name: string }>()
    expect(row).toEqual({ description: 'We meet on Tuesdays', region: 'North Louisiana', name: club.club.name })
  })

  it('cannot rename a club, move it to another region or blank its region', async () => {
    const holder = await seedMember()
    await seat(holder, ['North Louisiana'])
    const before = await env.DB.prepare('SELECT name, region FROM clubs WHERE id = ?').bind('monroe').first()
    for (const body of [{ name: 'Example Renamed Club' }, { region: 'Bayou Region' }, { region: '' }, { region: null }]) {
      const res = await invoke(adminClubPatch, { method: 'PATCH', as: holder, aal: 'aal1', params: { id: 'monroe' }, body })
      expect(res.status, JSON.stringify(body)).toBe(403)
    }
    expect(await env.DB.prepare('SELECT name, region FROM clubs WHERE id = ?').bind('monroe').first()).toEqual(before)
  })

  it('cannot save a club of another region', async () => {
    const holder = await seedMember()
    await seat(holder, ['North Louisiana'])
    const res = await invoke(adminClubPatch, {
      method: 'PATCH', as: holder, aal: 'aal1', params: { id: 'metairie' }, body: { description: 'Not theirs' },
    })
    expect(res.status).toBe(403)
    const row = await env.DB.prepare('SELECT description FROM clubs WHERE id = ?').bind('metairie').first<{ description: string | null }>()
    expect(row?.description).not.toBe('Not theirs')
  })
})

describe('the seat\'s edges once regions are set', () => {
  async function refusedEverywhere(who: string, clubId: string, label: string) {
    for (const handler of [adminClubGet, rosterGet, officersGet, newsGet]) {
      const res = await invoke(handler, { as: who, aal: 'aal1', params: { id: clubId } })
      expect(res.status, label).toBe(403)
      expect(await res.json(), label).toEqual({ error: 'Forbidden' })
    }
  }

  it('an ended assignment admits no one', async () => {
    const holder = await seedMember()
    await seat(holder, ['North Louisiana'], { ended: true })
    await refusedEverywhere(holder, 'shreveport', 'ended')
  })

  it('an inactive seat admits no one', async () => {
    const holder = await seedMember()
    await seat(holder, ['North Louisiana'], { isActive: 0 })
    await refusedEverywhere(holder, 'shreveport', 'inactive')
  })

  it('a seat of another kind that lists the region admits no one', async () => {
    const holder = await seedMember()
    await seat(holder, ['North Louisiana'], { category: 'officer' })
    await refusedEverywhere(holder, 'shreveport', 'officer seat')
  })

  it('a guest who holds the seat is not admitted', async () => {
    const holder = await seedMember({ role: 'guest' })
    await seat(holder, ['North Louisiana'])
    await refusedEverywhere(holder, 'shreveport', 'guest')
  })

  it('a club with a blank region is not reached by any seat', async () => {
    const clubId = await seedClub({ name: 'Example Chess Club' })
    await env.DB.prepare('UPDATE clubs SET region = ? WHERE id = ?').bind('', clubId).run()
    const holder = await seedMember()
    await seat(holder, [...REGIONS])
    await refusedEverywhere(holder, clubId, 'blank')
  })
})

describe('no club endpoint gives a regional seat holder a member\'s data', () => {
  it('every handler under functions/api/admin/clubs answers without it', async () => {
    const clubId = 'houma-chess-club'
    const { one, two, admin } = await populate(clubId)
    const holder = await seedMember({ email: 'region.holder.two@example.org' })
    await seat(holder, ['Bayou Region'])
    const call = { as: holder, aal: 'aal1' as const }
    const answers: Array<[string, { status: number; response: Response }]> = []

    answers.push(['club GET', await invoke(adminClubGet, { ...call, params: { id: clubId } })])
    answers.push(['club PATCH', await invoke(adminClubPatch, { ...call, method: 'PATCH', params: { id: clubId }, body: { description: 'We meet on Tuesdays' } })])
    answers.push(['roster GET', await invoke(rosterGet, { ...call, params: { id: clubId } })])
    answers.push(['officers GET', await invoke(officersGet, { ...call, params: { id: clubId } })])
    answers.push(['officers POST', await invoke(officersPost, { ...call, method: 'POST', params: { id: clubId }, body: { memberId: two, title: 'Secretary' } })])
    answers.push(['officers POST, not on the roster', await invoke(officersPost, { ...call, method: 'POST', params: { id: clubId }, body: { memberId: one + '-x', title: 'Treasurer' } })])
    answers.push(['news GET', await invoke(newsGet, { ...call, params: { id: clubId } })])
    answers.push(['news POST', await invoke(newsPost, { ...call, method: 'POST', params: { id: clubId }, body: { title: 'Example news', excerpt: 'An example.' } })])
    answers.push(['logo POST', await invoke(logoPost, {
      ...call, method: 'POST', params: { id: clubId }, headers: { 'content-type': 'image/jpeg' }, rawBody: 'example image bytes',
    })])

    const officers = await (await invoke(officersGet, { ...call, params: { id: clubId } })).json<{ officers: Array<{ id: string }> }>()
    answers.push(['officer DELETE', await invoke(officerDelete, { ...call, method: 'DELETE', params: { id: clubId, officerId: officers.officers[0].id } })])

    const statuses: Record<string, number> = {}
    for (const [label, res] of answers) {
      statuses[label] = res.status
      holdsNoMemberData(await res.response.clone().text(), label)
    }
    expect(statuses['club GET']).toBe(200)
    expect(statuses['club PATCH']).toBe(200)
    expect(statuses['roster GET']).toBe(403)
    expect(statuses['officers GET']).toBe(200)
    // Whether an id is on the roster is not told: on the roster or not, the answer is the same 403.
    expect(statuses['officers POST']).toBe(403)
    expect(statuses['officers POST, not on the roster']).toBe(403)
    const bodies = new Map<string, string>()
    for (const [label, res] of answers) bodies.set(label, await res.response.clone().text())
    expect(bodies.get('officers POST')).toBe(bodies.get('officers POST, not on the roster'))
    expect(statuses['news GET']).toBe(200)
    expect(statuses['news POST']).toBe(201)
    expect(statuses['logo POST']).toBe(200)
    expect(statuses['officer DELETE']).toBe(403)

    // The same calls from an admin do reach the data, so the checks above can fail.
    const full = await invoke(adminClubGet, { as: admin, params: { id: clubId } })
    expect(await full.response.text()).toContain('player.two@example.org')
  })
})
