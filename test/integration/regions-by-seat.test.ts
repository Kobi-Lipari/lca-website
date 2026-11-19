// test/integration/regions-by-seat.test.ts
// Migration 0072 (the regions by the five seats) as the Workers runtime meets
// it, on a D1 database built from every migration:
// - the 25 real clubs come out in the five regions, by the table of old
//   region and town (a best guess for K to correct);
// - made-up clubs of every old region and every town the table names, a town
//   it does not name, a club with no region and a club already in one of the
//   five, with the file's own statements run again on them;
// - club_reports.region rewritten the same way;
// - seat_regions: each regional seat covers the one region its title begins
//   with, whichever way the title is written, and an officer's seat none;
// - a second run changes no row;
// - after it, the holder of the Baton Rouge / East Central seat manages that
//   region's clubs, and the seat regions endpoint takes the five names only.
import { describe, it, expect } from 'vitest'
import { env } from 'cloudflare:test'
import { invoke } from './harness'
import { migrationModules, splitSql } from './setup'
import { seedAdmin, seedClub, seedMember } from './factories'

import { onRequestGet as clubsGet } from '../../functions/api/clubs'
import { onRequestPut as seatRegionsPut } from '../../functions/api/admin/seat-regions'
import { onRequestGet as mySeatsGet } from '../../functions/api/board/my-seats'
import { REGIONS } from '../../domain/clubs/regions'

const FIVE: readonly string[] = REGIONS
const GONE = ['Central Louisiana', 'North of Lake Pontchartrain', 'Southwest Louisiana', 'South Central Louisiana', 'Bayou Region']

const FILE = Object.keys(migrationModules).find((p) => p.endsWith('/0072_regions_by_seat.sql'))

/** Runs every statement of the file again and gives the number of rows it changed. */
async function runAgain(): Promise<number> {
  expect(FILE).toBeDefined()
  let changed = 0
  for (const stmt of splitSql(migrationModules[FILE as string])) {
    const out = await env.DB.prepare(stmt).run()
    changed += out.meta.changes ?? 0
  }
  return changed
}

async function clubOf(region: string | null, city: string, name = 'Example Knights Club'): Promise<string> {
  const id = await seedClub({ name, city })
  await env.DB.prepare('UPDATE clubs SET region = ? WHERE id = ?').bind(region, id).run()
  return id
}

async function regionOf(clubId: string): Promise<string | null> {
  const row = await env.DB.prepare('SELECT region FROM clubs WHERE id = ?').bind(clubId).first<{ region: string | null }>()
  return row?.region ?? null
}

async function seatTitled(role: string, regions: string[], category = 'regional_rep'): Promise<string> {
  const id = `seat-${crypto.randomUUID().slice(0, 8)}`
  await env.DB.prepare(
    `INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active)
     VALUES (?, ?, '', 99, ?, ?, 1)`,
  ).bind(id, role, id, category).run()
  for (const region of regions) {
    await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(id, region).run()
  }
  return id
}

async function regionsOfSeat(seatId: string): Promise<string[]> {
  const { results } = await env.DB.prepare('SELECT region FROM seat_regions WHERE seat_id = ? ORDER BY region')
    .bind(seatId).all<{ region: string }>()
  return results.map((r) => r.region)
}

async function snapshot(): Promise<string> {
  const clubs = (await env.DB.prepare('SELECT id, region FROM clubs ORDER BY id').all()).results
  const reports = (await env.DB.prepare('SELECT id, region FROM club_reports ORDER BY id').all()).results
  const seats = (await env.DB.prepare('SELECT seat_id, region FROM seat_regions ORDER BY seat_id, region').all()).results
  return JSON.stringify({ clubs, reports, seats })
}

describe('migration 0072 on a database built from every migration', () => {
  it('puts the 25 real clubs in the five regions: 12, 3, 5, 2 and 3', async () => {
    const res = await invoke(clubsGet, {})
    expect(res.status).toBe(200)
    const { clubs } = await res.json<{ clubs: Array<{ id: string; region: string | null }> }>()
    expect(clubs).toHaveLength(25)
    const counts: Record<string, number> = {}
    for (const club of clubs) {
      expect(FIVE, club.id).toContain(club.region)
      counts[club.region as string] = (counts[club.region as string] ?? 0) + 1
    }
    expect(counts).toEqual({
      'New Orleans Metro': 12,
      'Baton Rouge / East Central': 3,
      'Lafayette / South Central': 5,
      'Lake Charles / Southwestern': 2,
      'North Louisiana': 3,
    })
    const where = new Map(clubs.map((c) => [c.id, c.region]))
    for (const id of ['baton-rouge', 'bluebonnet-chess-club', 'gonzales-chess-club']) {
      expect(where.get(id), id).toBe('Baton Rouge / East Central')
    }
    for (const id of ['lafayette-chess-club', 'heart-of-worship-church-chess', 'morgan-city-chess-club', 'bunkie-chess-club', 'pineville-homeschool-chess-club']) {
      expect(where.get(id), id).toBe('Lafayette / South Central')
    }
    for (const id of ['casa-de-ajedrez', 'beauregard-parish-youth-chess']) {
      expect(where.get(id), id).toBe('Lake Charles / Southwestern')
    }
    for (const id of ['houma-chess-club', 'mandeville-chess-club', 'slidell', 'picayune-chess-club', 'metairie']) {
      expect(where.get(id), id).toBe('New Orleans Metro')
    }
    for (const id of ['monroe', 'ruston', 'shreveport']) {
      expect(where.get(id), id).toBe('North Louisiana')
    }
  })

  it('moves a club of every old region and town by the table, and its last rule takes a town it does not name', async () => {
    const cases: Array<[string | null, string, string | null]> = [
      ['South Central Louisiana', 'Baton Rouge', 'Baton Rouge / East Central'],
      ['South Central Louisiana', 'Gonzales', 'Baton Rouge / East Central'],
      ['South Central Louisiana', 'Lafayette', 'Lafayette / South Central'],
      ['South Central Louisiana', 'Opelousas', 'Lafayette / South Central'],
      ['South Central Louisiana', 'Example Town', 'Lafayette / South Central'],
      ['Bayou Region', 'Houma', 'New Orleans Metro'],
      ['Bayou Region', 'Morgan City', 'Lafayette / South Central'],
      ['Bayou Region', 'Example Town', 'Lafayette / South Central'],
      ['North of Lake Pontchartrain', 'Mandeville', 'New Orleans Metro'],
      ['North of Lake Pontchartrain', 'Slidell', 'New Orleans Metro'],
      ['North of Lake Pontchartrain', 'Picayune', 'New Orleans Metro'],
      ['North of Lake Pontchartrain', 'Example Town', 'New Orleans Metro'],
      ['Central Louisiana', 'Pineville', 'Lafayette / South Central'],
      ['Central Louisiana', 'Bunkie', 'Lafayette / South Central'],
      ['Central Louisiana', 'Example Town', 'Lafayette / South Central'],
      ['Southwest Louisiana', 'Sulphur', 'Lake Charles / Southwestern'],
      ['Southwest Louisiana', 'DeRidder', 'Lake Charles / Southwestern'],
      ['Southwest Louisiana', 'Example Town', 'Lake Charles / Southwestern'],
      ['New Orleans Metro', 'Metairie', 'New Orleans Metro'],
      ['New Orleans Metro', 'Houma', 'New Orleans Metro'],
      ['North Louisiana', 'Shreveport', 'North Louisiana'],
      ['North Louisiana', 'Baton Rouge', 'North Louisiana'],
      ['Baton Rouge / East Central', 'Example Town', 'Baton Rouge / East Central'],
      ['Lafayette / South Central', 'Houma', 'Lafayette / South Central'],
      ['Lake Charles / Southwestern', 'Baton Rouge', 'Lake Charles / Southwestern'],
      [null, 'Baton Rouge', null],
      [null, 'Houma', null],
    ]
    const ids: string[] = []
    for (const [from, city] of cases) ids.push(await clubOf(from, city))
    const blank = await clubOf('', 'Gonzales')

    expect(await runAgain()).toBeGreaterThan(0)

    for (let i = 0; i < cases.length; i++) {
      const [from, city, to] = cases[i]
      expect(await regionOf(ids[i]), `${from ?? 'no region'} in ${city}`).toBe(to)
    }
    expect(await regionOf(blank)).toBe('')

    const { results } = await env.DB.prepare('SELECT id, region FROM clubs').all<{ id: string; region: string | null }>()
    for (const club of results) {
      if (club.region === null || club.region === '') continue
      expect(FIVE, club.id).toContain(club.region)
    }
  })

  it('rewrites club_reports.region: a report on a club takes its region, one with no club its old region\'s last rule', async () => {
    const houma = await clubOf('Bayou Region', 'Houma')
    const unplaced = await clubOf(null, 'Baton Rouge')
    const insert = (clubId: string | null, kind: string, region: string | null) =>
      env.DB.prepare(
        `INSERT INTO club_reports (club_id, kind, message, region) VALUES (?, ?, 'An example report.', ?)`,
      ).bind(clubId, kind, region).run()
    await insert(houma, 'suggestion', 'Bayou Region')
    await insert(unplaced, 'suggestion', 'South Central Louisiana')
    await insert('baton-rouge', 'suggestion', null)
    const loose: Array<[string | null, string | null]> = [
      ['South Central Louisiana', 'Lafayette / South Central'],
      ['Bayou Region', 'Lafayette / South Central'],
      ['Southwest Louisiana', 'Lake Charles / Southwestern'],
      ['North of Lake Pontchartrain', 'New Orleans Metro'],
      ['Central Louisiana', 'Lafayette / South Central'],
      ['New Orleans Metro', 'New Orleans Metro'],
      ['North Louisiana', 'North Louisiana'],
      ['Baton Rouge / East Central', 'Baton Rouge / East Central'],
      [null, null],
    ]
    for (const [from] of loose) await insert(null, 'new_club', from)

    await runAgain()

    const { results } = await env.DB.prepare('SELECT club_id, kind, region FROM club_reports ORDER BY id')
      .all<{ club_id: string | null; kind: string; region: string | null }>()
    expect(results.slice(0, 3)).toEqual([
      { club_id: houma, kind: 'suggestion', region: 'New Orleans Metro' },
      { club_id: unplaced, kind: 'suggestion', region: null },
      { club_id: 'baton-rouge', kind: 'suggestion', region: 'Baton Rouge / East Central' },
    ])
    expect(results.slice(3).map((r) => r.region)).toEqual(loose.map(([, to]) => to))
    for (const row of results) {
      if (row.region !== null) expect(FIVE).toContain(row.region)
    }
  })

  it('gives each regional seat the one region of its own title, written with or without Representative, and an officer\'s seat none', async () => {
    const short: string[] = []
    const long: string[] = []
    for (const region of REGIONS) {
      short.push(await seatTitled(region, []))
      long.push(await seatTitled(`${region} Representative`, ['Bayou Region']))
    }
    const several = await seatTitled('Lafayette / South Central Representative', ['South Central Louisiana', 'Bayou Region', 'New Orleans Metro'])
    const unmatched = await seatTitled('Example Region Representative', ['Central Louisiana'])
    const officer = await seatTitled('New Orleans Metro', ['New Orleans Metro'], 'officer')

    await runAgain()

    for (let i = 0; i < REGIONS.length; i++) {
      expect(await regionsOfSeat(short[i]), REGIONS[i]).toEqual([REGIONS[i]])
      expect(await regionsOfSeat(long[i]), `${REGIONS[i]} Representative`).toEqual([REGIONS[i]])
    }
    expect(await regionsOfSeat(several)).toEqual(['Lafayette / South Central'])
    expect(await regionsOfSeat(unmatched)).toEqual([])
    expect(await regionsOfSeat(officer)).toEqual([])

    const { results } = await env.DB.prepare('SELECT region FROM seat_regions').all<{ region: string }>()
    for (const row of results) expect(FIVE).toContain(row.region)
  })

  it('changes no row when it runs a second time', async () => {
    await clubOf('Central Louisiana', 'Pineville')
    await seatTitled('North Louisiana Representative', ['Southwest Louisiana'])
    await runAgain()
    const before = await snapshot()
    expect(await runAgain()).toBe(0)
    expect(await snapshot()).toBe(before)
  })

  it('lets the holder of the Baton Rouge / East Central seat manage that region\'s clubs, and no others', async () => {
    const holder = await seedMember({ fullName: 'Player One', email: 'player.one@example.org' })
    const seatId = await seatTitled('Baton Rouge / East Central Representative', [])
    await env.DB.prepare('INSERT INTO board_seat_assignments (seat_id, member_id) VALUES (?, ?)').bind(seatId, holder).run()
    await runAgain()

    const res = await invoke(mySeatsGet, { as: holder })
    expect(res.status).toBe(200)
    const body = await res.json<{ seats: Array<{ id: string; regions: string[] }>; managedClubs: Array<{ id: string }> }>()
    expect(body.seats.find((s) => s.id === seatId)?.regions).toEqual(['Baton Rouge / East Central'])
    const managed = body.managedClubs.map((c) => c.id)
    expect(managed).toEqual(expect.arrayContaining(['baton-rouge', 'bluebonnet-chess-club', 'gonzales-chess-club']))
    for (const id of ['lafayette-chess-club', 'heart-of-worship-church-chess', 'metairie', 'monroe']) {
      expect(managed, id).not.toContain(id)
    }
    const inRegion = (await env.DB.prepare("SELECT id FROM clubs WHERE region = 'Baton Rouge / East Central'").all<{ id: string }>())
      .results.map((r) => r.id)
    expect([...managed].sort()).toEqual([...inRegion].sort())
  })

  it('the seat regions endpoint takes each of the five names, refuses the names that are gone, and refuses anyone but an admin', async () => {
    const admin = await seedAdmin()
    const seatId = await seatTitled('Lake Charles / Southwestern', [])
    for (const region of REGIONS) {
      const res = await invoke(seatRegionsPut, { method: 'PUT', as: admin, body: { seatId, regions: [region] } })
      expect(res.status, region).toBe(200)
      expect(await regionsOfSeat(seatId)).toEqual([region])
    }
    for (const region of GONE) {
      const res = await invoke(seatRegionsPut, { method: 'PUT', as: admin, body: { seatId, regions: [region] } })
      expect(res.status, region).toBe(400)
    }
    expect(await regionsOfSeat(seatId)).toEqual(['North Louisiana'])

    for (const role of ['member', 'club_rep', 'lca_officer', 'guest'] as const) {
      const who = await seedMember({ role })
      const res = await invoke(seatRegionsPut, { method: 'PUT', as: who, body: { seatId, regions: ['New Orleans Metro'] } })
      expect(res.status, role).toBe(403)
    }
    expect(await regionsOfSeat(seatId)).toEqual(['North Louisiana'])
  })
})
