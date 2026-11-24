// test/integration/regions-by-seat-edges.test.ts
// The edges of migration 0072 (the regions by the five seats) that
// regions-by-seat.test.ts leaves, in the Workers runtime:
// - towns are matched exactly as written: another spelling, another case or a
//   trailing space is sent by its old region's last rule, and a town's rule
//   belongs to its own old region only;
// - the migration changes the region and nothing else on a club, and a seat
//   that is retired is given its region like any other;
// - K's correction by hand: an LCA admin moves a club to another region in the
//   club's editor and the seats follow at once, while a club's own rep, a
//   regional seat's holder, a member and a visitor cannot (403 or 401, the
//   club left as it was);
// - the Board seats list answers each region's count of clubs and each
//   regional seat's one region, and the seat regions endpoint answers 401 to a
//   visitor.
import { describe, it, expect } from 'vitest'
import { env } from 'cloudflare:test'
import { invoke } from './harness'
import { migrationModules, splitSql } from './setup'
import { seedAdmin, seedClub, seedMember } from './factories'

import { onRequestGet as boardSeatsGet } from '../../functions/api/admin/board-seats'
import { onRequestPatch as adminClubPatch } from '../../functions/api/admin/clubs/[id]'
import { onRequestPut as seatRegionsPut } from '../../functions/api/admin/seat-regions'
import { onRequestGet as mySeatsGet } from '../../functions/api/board/my-seats'
import { REGIONS } from '../../domain/clubs/regions'

const FILE = Object.keys(migrationModules).find((p) => p.endsWith('/0072_regions_by_seat.sql'))

async function runAgain(): Promise<void> {
  expect(FILE).toBeDefined()
  for (const stmt of splitSql(migrationModules[FILE as string])) await env.DB.prepare(stmt).run()
}

async function clubOf(region: string | null, city: string): Promise<string> {
  const id = await seedClub({ name: 'Example Knights Club', city })
  await env.DB.prepare('UPDATE clubs SET region = ? WHERE id = ?').bind(region, id).run()
  return id
}

async function regionOf(clubId: string): Promise<string | null> {
  const row = await env.DB.prepare('SELECT region FROM clubs WHERE id = ?').bind(clubId).first<{ region: string | null }>()
  return row?.region ?? null
}

async function seatTitled(role: string, regions: string[], opts: { isActive?: number; holder?: string } = {}): Promise<string> {
  const id = `seat-${crypto.randomUUID().slice(0, 8)}`
  await env.DB.prepare(
    `INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active)
     VALUES (?, ?, '', 99, ?, 'regional_rep', ?)`,
  ).bind(id, role, id, opts.isActive ?? 1).run()
  for (const region of regions) {
    await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(id, region).run()
  }
  if (opts.holder) {
    await env.DB.prepare('INSERT INTO board_seat_assignments (seat_id, member_id) VALUES (?, ?)').bind(id, opts.holder).run()
  }
  return id
}

describe('the towns are matched exactly as written', () => {
  it('sends another spelling, another case or a trailing space by the old region\'s last rule', async () => {
    const cases: Array<[string, string, string]> = [
      ['South Central Louisiana', 'baton rouge', 'Lafayette / South Central'],
      ['South Central Louisiana', 'BATON ROUGE', 'Lafayette / South Central'],
      ['South Central Louisiana', 'Baton Rouge ', 'Lafayette / South Central'],
      ['South Central Louisiana', 'Gonzalez', 'Lafayette / South Central'],
      ['South Central Louisiana', 'Baton Rouge, LA', 'Lafayette / South Central'],
      ['Bayou Region', 'houma', 'Lafayette / South Central'],
      ['Bayou Region', 'Houma ', 'Lafayette / South Central'],
      ['Bayou Region', 'Thibodaux', 'Lafayette / South Central'],
    ]
    const ids: string[] = []
    for (const [from, city] of cases) ids.push(await clubOf(from, city))
    await runAgain()
    for (let i = 0; i < cases.length; i++) expect(await regionOf(ids[i]), `${cases[i][0]} in "${cases[i][1]}"`).toBe(cases[i][2])
  })

  it('keeps a town\'s rule to its own old region: Baton Rouge and Houma in any other old region follow that region\'s rule', async () => {
    const cases: Array<[string, string, string]> = [
      ['Bayou Region', 'Baton Rouge', 'Lafayette / South Central'],
      ['South Central Louisiana', 'Houma', 'Lafayette / South Central'],
      ['Central Louisiana', 'Baton Rouge', 'Lafayette / South Central'],
      ['Central Louisiana', 'Houma', 'Lafayette / South Central'],
      ['Southwest Louisiana', 'Houma', 'Lake Charles / Southwestern'],
      ['Southwest Louisiana', 'Baton Rouge', 'Lake Charles / Southwestern'],
      ['North of Lake Pontchartrain', 'Baton Rouge', 'New Orleans Metro'],
      ['North Louisiana', 'Houma', 'North Louisiana'],
    ]
    const ids: string[] = []
    for (const [from, city] of cases) ids.push(await clubOf(from, city))
    await runAgain()
    for (let i = 0; i < cases.length; i++) expect(await regionOf(ids[i]), `${cases[i][0]} in ${cases[i][1]}`).toBe(cases[i][2])
  })
})

describe('what else the migration leaves', () => {
  it('changes a club\'s region and no other column of it', async () => {
    const id = await clubOf('Bayou Region', 'Houma')
    await env.DB.prepare('UPDATE clubs SET description = ?, meeting_schedule = ? WHERE id = ?')
      .bind('We meet on Tuesdays.', 'Tuesdays 7:00 PM', id).run()
    const columns = async () => {
      const row = await env.DB.prepare('SELECT * FROM clubs WHERE id = ?').bind(id).first<Record<string, unknown>>()
      const { region, ...rest } = row as Record<string, unknown>
      return { region, rest }
    }
    const before = await columns()
    expect(before.region).toBe('Bayou Region')
    await runAgain()
    const after = await columns()
    expect(after.region).toBe('New Orleans Metro')
    expect(after.rest).toEqual(before.rest)
  })

  it('gives a retired regional seat its region like any other, and keeps every club\'s count by region', async () => {
    const retired = await seatTitled('Lake Charles / Southwestern Representative', ['Southwest Louisiana'], { isActive: 0 })
    await runAgain()
    const { results } = await env.DB.prepare('SELECT region FROM seat_regions WHERE seat_id = ?').bind(retired).all<{ region: string }>()
    expect(results.map((r) => r.region)).toEqual(['Lake Charles / Southwestern'])
  })
})

describe('K\'s correction by hand, after the migration', () => {
  it('an LCA admin moves a club to another region and the two seats follow at once', async () => {
    await runAgain()
    const batonRouge = await seedMember({ fullName: 'Player One', email: 'player.one@example.org' })
    const lafayette = await seedMember({ fullName: 'Player Two', email: 'player.two@example.org' })
    await seatTitled('Baton Rouge / East Central Representative', [], { holder: batonRouge })
    await seatTitled('Lafayette / South Central Representative', [], { holder: lafayette })
    await runAgain()
    const managed = async (who: string) => {
      const res = await invoke(mySeatsGet, { as: who })
      expect(res.status).toBe(200)
      return (await res.json<{ managedClubs: Array<{ id: string }> }>()).managedClubs.map((c) => c.id)
    }
    expect(await managed(batonRouge)).toContain('gonzales-chess-club')
    expect(await managed(lafayette)).not.toContain('gonzales-chess-club')

    const admin = await seedAdmin()
    const res = await invoke(adminClubPatch, {
      method: 'PATCH', as: admin, aal: 'aal1', params: { id: 'gonzales-chess-club' }, body: { region: 'Lafayette / South Central' },
    })
    expect(res.status).toBe(200)
    expect(await regionOf('gonzales-chess-club')).toBe('Lafayette / South Central')
    expect(await managed(batonRouge)).not.toContain('gonzales-chess-club')
    expect(await managed(lafayette)).toContain('gonzales-chess-club')

    // A second run of the migration leaves K's correction as it is.
    await runAgain()
    expect(await regionOf('gonzales-chess-club')).toBe('Lafayette / South Central')
  })

  it('refuses a change of region from the club\'s own rep, a regional seat\'s holder and a member, and a visitor', async () => {
    const holder = await seedMember({ fullName: 'Player One', email: 'player.one@example.org' })
    await seatTitled('Baton Rouge / East Central Representative', [], { holder })
    await runAgain()
    const rep = await seedMember({ role: 'club_rep', clubId: 'baton-rouge' })
    const member = await seedMember({ role: 'member' })
    const body = { region: 'North Louisiana' }

    for (const [label, who] of [['club rep', rep], ['seat holder', holder], ['member', member]] as const) {
      const res = await invoke(adminClubPatch, { method: 'PATCH', as: who, aal: 'aal1', params: { id: 'baton-rouge' }, body })
      expect(res.status, label).toBe(403)
      expect(await regionOf('baton-rouge'), label).toBe('Baton Rouge / East Central')
    }
    const visitor = await invoke(adminClubPatch, { method: 'PATCH', params: { id: 'baton-rouge' }, body })
    expect(visitor.status).toBe(401)
    expect(await regionOf('baton-rouge')).toBe('Baton Rouge / East Central')
  })
})

describe('the Board seats list and the seat regions endpoint after the migration', () => {
  it('answers each region\'s count of clubs, and each regional seat with its one region', async () => {
    const seats = [
      await seatTitled('New Orleans Metro Representative', []),
      await seatTitled('Baton Rouge / East Central', []),
      await seatTitled('Lafayette / South Central Representative', []),
      await seatTitled('Lake Charles / Southwestern', []),
      await seatTitled('North Louisiana Representative', []),
    ]
    await runAgain()
    const admin = await seedAdmin()
    const res = await invoke(boardSeatsGet, { as: admin })
    expect(res.status).toBe(200)
    const body = await res.json<{
      seats: Array<{ id: string; regions: string[] }>
      regionClubs: Array<{ region: string; clubs: number }>
    }>()
    for (let i = 0; i < seats.length; i++) {
      expect(body.seats.find((s) => s.id === seats[i])?.regions, REGIONS[i]).toEqual([REGIONS[i]])
    }
    // The cases above leave their clubs, and one real club moved by hand, in this file's database,
    // so the counts are read from the clubs themselves.
    const counts = Object.fromEntries(body.regionClubs.map((r) => [r.region, r.clubs]))
    for (const region of Object.keys(counts)) expect(['', ...REGIONS], region).toContain(region)
    const { results } = await env.DB.prepare(`SELECT COALESCE(region, '') AS region, COUNT(*) AS n FROM clubs GROUP BY 1`)
      .all<{ region: string; n: number }>()
    expect(counts).toEqual(Object.fromEntries(results.map((r) => [r.region, r.n])))
    for (const region of REGIONS) expect(counts[region], region).toBeGreaterThan(0)
  })

  it('answers a visitor with 401 and a member with 403, and leaves the seat\'s regions as they were', async () => {
    const seatId = await seatTitled('North Louisiana', ['North Louisiana'])
    const visitor = await invoke(seatRegionsPut, { method: 'PUT', body: { seatId, regions: ['New Orleans Metro'] } })
    expect(visitor.status).toBe(401)
    const member = await seedMember({ role: 'member' })
    const res = await invoke(seatRegionsPut, { method: 'PUT', as: member, body: { seatId, regions: ['New Orleans Metro'] } })
    expect(res.status).toBe(403)
    const { results } = await env.DB.prepare('SELECT region FROM seat_regions WHERE seat_id = ?').bind(seatId).all<{ region: string }>()
    expect(results.map((r) => r.region)).toEqual(['North Louisiana'])
  })
})
