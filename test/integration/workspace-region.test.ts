// test/integration/workspace-region.test.ts
//
// My region's answer, GET /api/workspace/region, and Still accurate, POST
// /api/admin/clubs/[id]/confirm (WS09 step 10), through the real handlers
// on a D1 database built from every migration. CLUB_KEEPERS_ON is false in
// the tree; here it is read through a getter on the mocked module, set for
// most cases and unset for the cases that hold what ships. Every club,
// region and person here is made up ("Example Chess Club", example.org);
// each case makes its own regions, so one case's seats never cover
// another's clubs, and the 25 clubs the migrations seed are met only where a
// case says so.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { onRequestGet as regionGet, REGION_CLOSED, REGION_FOR_SEATS } from '../../functions/api/workspace/region'
import { onRequestPost as confirmPost, CONFIRM_CLOSED } from '../../functions/api/admin/clubs/[id]/confirm'
import { onRequestPatch as adminClubPatch, SAVED_SINCE } from '../../functions/api/admin/clubs/[id]'
import { checkWords } from '../../domain/clubs/regionCards'
import { nextCheckWords } from '../../domain/clubs/monthlyCheck'
import type { WorkspaceRegionResponse } from '../../domain/contracts/clubs'
import type { Env } from '../../functions/types'
import { emailOutbox, fetchCount, flushWaitUntil, invoke, resetHarness, type Aal } from './harness'
import { countingDb } from './mailRuns'
import { workspaceRegionResponseSchema } from '../../domain/contracts/clubs'
import { seedAdmin, seedClub, seedMember, seedTournament } from './factories'

const flags = vi.hoisted(() => ({ keepersOn: true, regionOn: false }))
vi.mock('../../functions/utils/clubs/pages', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/clubs/pages')>()
  return {
    ...real,
    get CLUB_KEEPERS_ON() {
      return flags.keepersOn
    },
    // WS09 step 19's cases set it; every other case runs with it unset, as it ships.
    get REGION_EVENTS_ON() {
      return flags.regionOn
    },
  }
})

beforeEach(() => {
  resetHarness()
  flags.keepersOn = true
  flags.regionOn = false
})
afterEach(() => {
  flags.keepersOn = false
  flags.regionOn = false
})

const newRegion = () => `Example Region ${crypto.randomUUID().slice(0, 8)}`

/** A seat over the regions, held by the member, as the seat screens write one. */
async function seat(memberId: string, regions: string[], opts: { ended?: boolean; inactive?: boolean; category?: string; title?: string } = {}): Promise<string> {
  const id = `seat-${crypto.randomUUID().slice(0, 8)}`
  await env.DB.prepare(
    `INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active)
     VALUES (?, ?, '', 99, ?, ?, ?)`,
  ).bind(id, opts.title ?? 'Example Region Representative', id, opts.category ?? 'regional_rep', opts.inactive ? 0 : 1).run()
  for (const region of regions) await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(id, region).run()
  await env.DB.prepare('INSERT INTO board_seat_assignments (seat_id, member_id, ended_at) VALUES (?, ?, ?)')
    .bind(id, memberId, opts.ended ? '2026-01-01 00:00:00' : null).run()
  return id
}

/** A made up club in the region, with a contact email, a statement, a colour and a logo address. */
async function club(region: string, name = 'Example Chess Club'): Promise<string> {
  const id = await seedClub({ name, city: 'Example City' })
  await env.DB.prepare(
    `UPDATE clubs SET region = ?, slug = ?, contact_email = ?, how_we_meet_text = 'Tuesdays at 7:00 PM in the library.', color = '#1f3a5f', image_url = 'https://example.org/logo.png' WHERE id = ?`,
  ).bind(region, id, `club.${id}@example.org`, id).run()
  return id
}

const get = (as?: string, aal: Aal = 'aal1', extra: { env?: Partial<Env> } = {}) => invoke(regionGet, { as, aal, ...extra })
const confirm = (as: string | undefined, clubId: string, body: unknown = {}, extra: { env?: Partial<Env>; rawBody?: string } = {}) =>
  invoke(confirmPost, { method: 'POST', as, aal: 'aal1', params: { id: clubId }, body, ...extra })

async function answer(as: string, aal: Aal = 'aal1'): Promise<WorkspaceRegionResponse> {
  const res = await get(as, aal)
  expect(res.status, as).toBe(200)
  return res.json<WorkspaceRegionResponse>()
}
const clubIds = (a: WorkspaceRegionResponse) => a.clubs.map((c) => c.id)

async function allClubs(): Promise<Record<string, unknown>[]> {
  return (await env.DB.prepare('SELECT * FROM clubs ORDER BY id').all<Record<string, unknown>>()).results
}
async function auditRows(): Promise<number> {
  return Number((await env.DB.prepare('SELECT COUNT(*) AS n FROM admin_audit_log').first<{ n: number }>())!.n)
}

/** A database that fails the case at the first statement it is asked for, and counts each try. */
function noQueries(): { db: D1Database; tries: () => number } {
  let tries = 0
  const refuse = () => {
    tries++
    throw new Error('no query may be made while CLUB_KEEPERS_ON is unset')
  }
  return { db: { prepare: refuse, batch: refuse, exec: refuse, dump: refuse } as unknown as D1Database, tries: () => tries }
}

describe('with CLUB_KEEPERS_ON unset, as this step ships', () => {
  it('all 403 with the constant unset: both endpoints answer every kind of person 403 in words, an LCA admin included, before any query or sign in', async () => {
    flags.keepersOn = false
    const region = newRegion()
    const clubId = await club(region)
    const holder = await seedMember({ fullName: 'Player One' })
    await seat(holder, [region])
    const people: Array<[string | undefined, Aal]> = [
      [await seedAdmin(), 'aal2'], [await seedMember({ role: 'club_rep', clubId }), 'aal1'], [holder, 'aal1'],
      [await seedMember({ role: 'lca_observer' }), 'aal1'], [await seedMember(), 'aal1'], [await seedMember({ role: 'guest' }), 'aal1'], [undefined, 'aal1'],
    ]
    const before = await allClubs()
    for (const [who, aal] of people) {
      const { db, tries } = noQueries()
      const fetchesBefore = fetchCount
      const read = await invoke(regionGet, { as: who, aal, env: { DB: db } })
      expect(read.status, String(who)).toBe(403)
      expect(await read.json(), String(who)).toEqual({ error: REGION_CLOSED })
      const tap = await invoke(confirmPost, { method: 'POST', as: who, aal, params: { id: clubId }, body: {}, env: { DB: db } })
      expect(tap.status, String(who)).toBe(403)
      expect(await tap.json(), String(who)).toEqual({ error: CONFIRM_CLOSED })
      expect(tries(), String(who)).toBe(0)
      expect(fetchCount, String(who)).toBe(fetchesBefore)
    }
    expect(await allClubs()).toEqual(before)
  })
})

describe('GET /api/workspace/region: who sees what', () => {
  it('a seat holder gets in whatever their role', async () => {
    const region = newRegion()
    const own = await club(region, 'Example Chess Club')
    const elsewhere = await club(newRegion(), 'Example Far Club')
    for (const role of ['member', 'club_rep', 'tournament_director', 'lca_auditor', 'lca_observer', 'lca_officer']) {
      const holder = await seedMember({ role, clubId: role === 'club_rep' ? elsewhere : null, fullName: 'Player One' })
      await seat(holder, [region])
      const a = await answer(holder)
      expect(clubIds(a), role).toEqual([own])
      expect(a.regions.map((r) => r.region), role).toEqual([region])
    }
  })

  it('only the seat\'s regions, with an open region an admin added to the seat', async () => {
    const [north, south, open, other] = [newRegion(), newRegion(), newRegion(), newRegion()]
    const inNorth = await club(north, 'Example North Club')
    const inSouth = await club(south, 'Example South Club')
    const inOpen = await club(open, 'Example Added Club')
    const inOther = await club(other, 'Example Other Club')
    // A seat with two regions.
    const twoRegions = await seedMember({ fullName: 'Player One' })
    const seatId = await seat(twoRegions, [north, south])
    expect(clubIds(await answer(twoRegions)).sort()).toEqual([inNorth, inSouth].sort())
    // An LCA admin adds an open seat's region to the seat, and its club joins.
    await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(seatId, open).run()
    const widened = await answer(twoRegions)
    expect(clubIds(widened).sort()).toEqual([inNorth, inOpen, inSouth].sort())
    expect(widened.regions.map((r) => r.region)).toEqual([north, open, south].sort())
    expect(clubIds(widened)).not.toContain(inOther)
    // Two seats, each with one region.
    const twoSeats = await seedMember({ fullName: 'Player Two' })
    await seat(twoSeats, [north])
    await seat(twoSeats, [other])
    expect(clubIds(await answer(twoSeats)).sort()).toEqual([inNorth, inOther].sort())
    // A seat whose region holds no club still lets its holder in, with no cards.
    const empty = await seedMember({ fullName: 'Player Three' })
    await seat(empty, [newRegion()])
    const none = await answer(empty)
    expect(none.clubs).toEqual([])
    expect(none.thisMonth).toMatchObject({ checked: 0, notChecked: 0 })
  })

  it('an admin sees every club, the 25 the migrations seed among them', async () => {
    const region = newRegion()
    const made = [await club(region, 'Example Chess Club'), await club(newRegion(), 'Example Second Club')]
    const admin = await seedAdmin()
    const a = await answer(admin, 'aal2')
    // The test database is shared by this file's cases, so the count is read from it: the 25 seeded clubs and every club made here.
    const total = Number((await env.DB.prepare('SELECT COUNT(*) AS n FROM clubs').first<{ n: number }>())!.n)
    expect(total).toBeGreaterThanOrEqual(27)
    expect(a.clubs).toHaveLength(total)
    for (const id of [...made, 'shreveport', 'baton-rouge', 'houma-chess-club']) expect(clubIds(a)).toContain(id)
    expect(a.regions.map((r) => r.region)).toEqual(expect.arrayContaining([region, 'North Louisiana', 'New Orleans Metro']))
    expect(a.thisMonth.checked + a.thisMonth.notChecked).toBe(total)
  })

  it('a member with no seat gets 403, and so does every other kind of person no active regional seat admits', async () => {
    const region = newRegion()
    const clubId = await club(region)
    const ended = await seedMember()
    await seat(ended, [region], { ended: true })
    const inactive = await seedMember()
    await seat(inactive, [region], { inactive: true })
    const officerSeat = await seedMember()
    await seat(officerSeat, [region], { category: 'officer', title: 'Example Officer' })
    const guestWithSeat = await seedMember({ role: 'guest' })
    await seat(guestWithSeat, [region])
    const child = await seedMember({ fullName: 'Player Two' })
    await env.DB.prepare('UPDATE members SET guardian_id = ? WHERE id = ?').bind(await seedMember({ fullName: 'Player One' }), child).run()
    const refused: Array<[string, string]> = [
      ['a plain member', await seedMember()],
      ['a club\'s rep with no seat', await seedMember({ role: 'club_rep', clubId })],
      ['an observer with no seat', await seedMember({ role: 'lca_observer' })],
      ['an LCA officer with no seat', await seedMember({ role: 'lca_officer' })],
      ['a child account', child],
      ['a guest, even with a seat', guestWithSeat],
      ['a holder whose term has ended', ended],
      ['a holder whose seat is inactive', inactive],
      ['a holder of an officer\'s seat', officerSeat],
    ]
    for (const [who, id] of refused) {
      const res = await get(id)
      expect(res.status, who).toBe(403)
      expect(await res.json(), who).toEqual({ error: REGION_FOR_SEATS })
    }
  })

  it('role safety: signed out, both endpoints answer 401 with CLUB_KEEPERS_ON set, and 403 with it unset', async () => {
    const clubId = await club(newRegion())
    expect((await get(undefined)).status).toBe(401)
    expect((await confirm(undefined, clubId)).status).toBe(401)
    flags.keepersOn = false
    expect((await get(undefined)).status).toBe(403)
    expect((await confirm(undefined, clubId)).status).toBe(403)
    expect((await env.DB.prepare('SELECT last_confirmed_at FROM clubs WHERE id = ?').bind(clubId).first())!.last_confirmed_at).toBeNull()
  })

  it('carries no roster, no email of any kind and no count or trace of a hidden draft for a person admitted by the region alone', async () => {
    const region = newRegion()
    const clubId = await club(region, 'Example Chess Club')
    const second = await club(region, 'Example Second Club')
    const rep = await seedMember({ role: 'club_rep', clubId, fullName: 'Club Rep One', email: 'rep.one@example.org' })
    const officer = await seedMember({ clubId, fullName: 'Player Nine', email: 'player.nine@example.org' })
    await env.DB.prepare('INSERT INTO club_officers (id, club_id, member_id, role) VALUES (?, ?, ?, \'President\')').bind(`off-${clubId}`, clubId, officer).run()
    for (const id of [clubId, second]) {
      await seedTournament({ clubId: id, isVisible: true, name: 'Example Visible Event' })
      await seedTournament({ clubId: id, isVisible: false, name: 'Example Hidden Draft' })
    }
    const holder = await seedMember({ fullName: 'Region Holder One', email: 'holder.one@example.org' })
    await seat(holder, [region])
    await seat(rep, [region], { title: 'Example Second Seat' })
    const observer = await seedMember({ role: 'lca_observer', fullName: 'Observer One', email: 'observer.one@example.org' })
    await seat(observer, [region], { title: 'Example Third Seat' })
    const admin = await seedAdmin()
    const eventsOf = (a: WorkspaceRegionResponse) => Object.fromEntries(a.clubs.filter((c) => [clubId, second].includes(c.id)).map((c) => [c.id, c.events]))
    // The region alone: visible events only, on both clubs.
    const alone = await get(holder)
    const text = await alone.response.clone().text()
    expect(eventsOf(await alone.json<WorkspaceRegionResponse>())).toEqual({ [clubId]: 1, [second]: 1 })
    // The club's own rep, who holds the seat too, sees the drafts of their own club alone.
    expect(eventsOf(await answer(rep))).toEqual({ [clubId]: 2, [second]: 1 })
    // An observer who holds the seat, and an LCA admin, see every event, as the admin club page shows them.
    expect(eventsOf(await answer(observer))).toEqual({ [clubId]: 2, [second]: 2 })
    expect(eventsOf(await answer(admin, 'aal2'))).toEqual({ [clubId]: 2, [second]: 2 })
    for (const [who, body] of [['holder', text], ['rep', await (await get(rep)).response.text()], ['admin', await (await get(admin, 'aal2')).response.text()]]) {
      expect(body, who).not.toContain('@')
      for (const word of ['Hidden Draft', 'Visible Event', 'roster', 'officer', 'email', 'President', 'Player Nine']) expect(body, `${who}: ${word}`).not.toContain(word)
    }
  })

  it('names who else keeps each region: the name and seat title of each other holder of an active seat, never an address', async () => {
    const region = newRegion()
    await club(region)
    const viewer = await seedMember({ fullName: 'Player One', email: 'player.one@example.org' })
    await seat(viewer, [region], { title: 'Example Region Representative' })
    const other = await seedMember({ fullName: 'Player Two', email: 'player.two@example.org' })
    await seat(other, [region], { title: 'Example Region Second Representative' })
    const gone = await seedMember({ fullName: 'Player Three' })
    await seat(gone, [region], { ended: true })
    const asleep = await seedMember({ fullName: 'Player Four' })
    await seat(asleep, [region], { inactive: true })
    const a = await answer(viewer)
    expect(a.regions).toEqual([{ region, keepers: [{ name: 'Player Two', seat: 'Example Region Second Representative' }] }])
    const seen = await answer(other)
    expect(seen.regions).toEqual([{ region, keepers: [{ name: 'Player One', seat: 'Example Region Representative' }] }])
  })

  it('reads a club nobody has saved or confirmed as never checked, on the 25 clubs the migrations seed, and sorts it as needing a check', async () => {
    // The clubs made by this file's cases have ids from seedClub, which start "club-".
    const seeded = (await env.DB.prepare('SELECT id, told_updated_at, told_by, last_confirmed_at, confirmed_by FROM clubs WHERE id NOT LIKE \'club-%\' ORDER BY id').all<Record<string, string | null>>()).results
    expect(seeded).toHaveLength(25)
    for (const row of seeded) {
      expect(row.told_updated_at, row.id!).not.toBeNull()
      expect([row.told_by, row.last_confirmed_at, row.confirmed_by], row.id!).toEqual([null, null, null])
    }
    const holder = await seedMember({ fullName: 'Player One' })
    await seat(holder, ['North Louisiana'])
    const a = await answer(holder)
    expect(clubIds(a).sort()).toEqual(['monroe', 'ruston', 'shreveport'])
    for (const card of a.clubs) {
      expect(card.lastConfirmedAt, card.id).toBeNull()
      expect(card.lastCheckWords, card.id).toBe('Not checked yet')
      expect(card.needsCheck, card.id).toBe(true)
    }
    expect(a.thisMonth).toMatchObject({ checked: 0, notChecked: 3 })
    // Once one is confirmed it moves behind the two that still need a check.
    expect((await confirm(holder, 'monroe')).status).toBe(200)
    const after = await answer(holder)
    expect(clubIds(after)).toEqual(['ruston', 'shreveport', 'monroe'])
    expect(after.thisMonth).toMatchObject({ checked: 1, notChecked: 2 })
  })

  it('gives the cards in their order, the card\'s words and This month, with names that differ only in case kept in a stable order', async () => {
    const region = newRegion()
    const fresh = await club(region, 'Alpha Chess Club')
    const stale = await club(region, 'Zulu Chess Club')
    const never = await club(region, 'Mike Chess Club')
    const lower = await club(region, 'example chess club')
    const upper = await club(region, 'Example Chess Club')
    await env.DB.prepare('UPDATE clubs SET last_confirmed_at = datetime(\'now\', \'-10 days\') WHERE id IN (?, ?, ?)').bind(fresh, lower, upper).run()
    await env.DB.prepare('UPDATE clubs SET last_confirmed_at = datetime(\'now\', \'-120 days\') WHERE id = ?').bind(stale).run()
    const holder = await seedMember({ fullName: 'Player One' })
    await seat(holder, [region])
    const a = await answer(holder)
    expect(clubIds(a)).toEqual([never, stale, fresh, upper, lower])
    const byId = Object.fromEntries(a.clubs.map((c) => [c.id, c]))
    const now = Date.now()
    expect(byId[never]).toMatchObject({ needsCheck: true, lastCheckWords: 'Not checked yet', lastConfirmedAt: null })
    expect(byId[stale].needsCheck).toBe(true)
    expect(byId[stale].lastCheckWords).toBe(checkWords(byId[stale].lastConfirmedAt, now))
    expect(byId[stale].lastCheckWords).toMatch(/^Not checked since [A-Z][a-z]{2} \d{4}$/)
    expect(byId[fresh].lastCheckWords).toMatch(/^Checked [A-Z][a-z]{2} \d{4}$/)
    expect(byId[fresh]).toMatchObject({
      name: 'Alpha Chess Club', city: 'Example City', region, color: '#1f3a5f', logoUrl: 'https://example.org/logo.png',
      statement: 'Tuesdays at 7:00 PM in the library.', events: 0, openItems: [],
    })
    expect(a.thisMonth).toEqual({ nextCheck: nextCheckWords(now), checked: 3, notChecked: 2 })
    expect(a.thisMonth.nextCheck.date).toMatch(/^Mon, [A-Z][a-z]{2} [1-7], \d{4}$/)
    expect(a.thisMonth.nextCheck.time).toBe('8:00 AM')
  })
})

describe('POST /api/admin/clubs/[id]/confirm: Still accurate', () => {
  it('Still accurate stamps that club only: who and when, every other club byte for byte, no activity row and no email', async () => {
    const region = newRegion()
    const clubId = await club(region)
    const neighbour = await club(region, 'Example Second Club')
    const rep = await seedMember({ role: 'club_rep', clubId, fullName: 'Club Rep One' })
    await env.DB.prepare('UPDATE clubs SET told_updated_at = \'2026-01-01 00:00:00\', told_by = ? WHERE id = ?').bind(rep, clubId).run()
    const before = await allClubs()
    const audits = await auditRows()
    const res = await confirm(rep, clubId)
    expect(res.status).toBe(200)
    const body = await res.json<{ id: string; lastConfirmedAt: string; lastCheckWords: string }>()
    const after = await allClubs()
    const mine = after.find((r) => r.id === clubId)!
    expect(body).toEqual({ id: clubId, lastConfirmedAt: mine.last_confirmed_at, lastCheckWords: checkWords(String(mine.last_confirmed_at), Date.now()) })
    expect(mine.confirmed_by).toBe(rep)
    expect(Math.abs(Date.parse(`${String(mine.last_confirmed_at).replace(' ', 'T')}Z`) - Date.now())).toBeLessThan(60_000)
    // The listing's words and its save stamp stay as they were.
    const was = before.find((r) => r.id === clubId)!
    expect({ ...mine, last_confirmed_at: null, confirmed_by: null }).toEqual(was)
    expect(mine.told_updated_at).toBe('2026-01-01 00:00:00')
    expect(mine.told_by).toBe(rep)
    expect(JSON.stringify(after.filter((r) => r.id !== clubId))).toBe(JSON.stringify(before.filter((r) => r.id !== clubId)))
    expect(after.find((r) => r.id === neighbour)!.last_confirmed_at).toBeNull()
    expect(await auditRows()).toBe(audits)
    await flushWaitUntil()
    expect(emailOutbox).toEqual([])
  })

  it('lets the club\'s own rep, the region\'s representative and an LCA admin confirm, and an observer who holds the region\'s seat as its holder', async () => {
    const region = newRegion()
    const clubId = await club(region)
    const rep = await seedMember({ role: 'club_rep', clubId })
    const holder = await seedMember()
    await seat(holder, [region])
    const observerWithSeat = await seedMember({ role: 'lca_observer' })
    await seat(observerWithSeat, [region], { title: 'Example Second Seat' })
    for (const [who, id, aal] of [['rep', rep, 'aal1'], ['holder', holder, 'aal1'], ['admin', await seedAdmin(), 'aal2'], ['observer with the seat', observerWithSeat, 'aal1']] as const) {
      const res = await invoke(confirmPost, { method: 'POST', as: id, aal, params: { id: clubId }, body: {} })
      expect(res.status, who).toBe(200)
      expect((await env.DB.prepare('SELECT confirmed_by FROM clubs WHERE id = ?').bind(clubId).first())!.confirmed_by, who).toBe(id)
    }
  })

  it('refuses everyone else, and refuses a club that does not exist in the same words a real club is refused to a stranger', async () => {
    const region = newRegion()
    const clubId = await club(region)
    const otherClub = await club(newRegion(), 'Example Other Club')
    const otherHolder = await seedMember()
    await seat(otherHolder, [newRegion()])
    const ended = await seedMember()
    await seat(ended, [region], { ended: true })
    const inactive = await seedMember()
    await seat(inactive, [region], { inactive: true })
    const guest = await seedMember({ role: 'guest' })
    await seat(guest, [region])
    const refused: Array<[string, string]> = [
      ['an observer', await seedMember({ role: 'lca_observer' })],
      ['an LCA officer', await seedMember({ role: 'lca_officer' })],
      ['another club\'s rep', await seedMember({ role: 'club_rep', clubId: otherClub })],
      ['a holder for another region', otherHolder],
      ['a holder whose term has ended', ended],
      ['a holder whose seat is inactive', inactive],
      ['a guest with a seat', guest],
      ['a member', await seedMember()],
      ['a tournament director', await seedMember({ role: 'tournament_director' })],
    ]
    const before = await allClubs()
    for (const [who, id] of refused) {
      const real = await confirm(id, clubId)
      const missing = await confirm(id, 'example-no-such-club')
      expect([real.status, missing.status], who).toEqual([403, 403])
      expect(await real.json(), who).toEqual({ error: 'Forbidden' })
      expect(await missing.response.text(), who).toBe(await real.response.text())
    }
    expect(await allClubs()).toEqual(before)
    // An LCA admin, who sees every club in any case, is told it is not there.
    const admin = await confirm(await seedAdmin(), 'example-no-such-club')
    expect(admin.status).toBe(404)
    expect(await admin.json()).toEqual({ error: 'Club not found' })
  })

  it('is safe to repeat: a second confirm by the same person stamps the club again and changes nothing else', async () => {
    const region = newRegion()
    const clubId = await club(region)
    const holder = await seedMember()
    await seat(holder, [region])
    expect((await confirm(holder, clubId)).status).toBe(200)
    const once = await allClubs()
    const second = await confirm(holder, clubId)
    expect(second.status).toBe(200)
    const twice = await allClubs()
    const strip = (rows: Record<string, unknown>[]) => rows.map((r) => (r.id === clubId ? { ...r, last_confirmed_at: null } : r))
    expect(strip(twice)).toEqual(strip(once))
    const row = twice.find((r) => r.id === clubId)!
    expect(row.confirmed_by).toBe(holder)
    expect(String(row.last_confirmed_at) >= String(once.find((r) => r.id === clubId)!.last_confirmed_at)).toBe(true)
  })

  it('reads its body through parseBody: no body or a body that is not JSON is 400, and an unexpected field is ignored', async () => {
    const region = newRegion()
    const clubId = await club(region)
    const rep = await seedMember({ role: 'club_rep', clubId })
    for (const rawBody of ['', 'not json']) {
      const res = await confirm(rep, clubId, undefined, { rawBody })
      expect(res.status, JSON.stringify(rawBody)).toBe(400)
      expect(await res.json(), JSON.stringify(rawBody)).toEqual({ error: 'Invalid JSON body', fields: { body: 'The body is not valid JSON.' } })
    }
    expect((await env.DB.prepare('SELECT last_confirmed_at FROM clubs WHERE id = ?').bind(clubId).first())!.last_confirmed_at).toBeNull()
    const sent = await confirm(rep, clubId, { lastConfirmedAt: '2020-01-01 00:00:00', confirmedBy: 'example-someone-else', name: 'Example Renamed Club' })
    expect(sent.status).toBe(200)
    const row = (await env.DB.prepare('SELECT name, last_confirmed_at, confirmed_by FROM clubs WHERE id = ?').bind(clubId).first<Record<string, string>>())!
    expect(row.name).toBe('Example Chess Club')
    expect(row.confirmed_by).toBe(rep)
    expect(row.last_confirmed_at).not.toBe('2020-01-01 00:00:00')
  })

  it('leaves a form another keeper has open able to save: a confirm never makes the PATCH refuse it as stale', async () => {
    // The Bunkie club, as migration 0067 stamped it, with no saver and no check.
    const opened = (await env.DB.prepare('SELECT told_updated_at FROM clubs WHERE id = \'bunkie-chess-club\'').first<{ told_updated_at: string }>())!.told_updated_at
    expect(opened).not.toBeNull()
    const holder = await seedMember({ fullName: 'Player One' })
    await seat(holder, ['Central Louisiana'])
    const admin = await seedAdmin()
    expect((await confirm(holder, 'bunkie-chess-club')).status).toBe(200)
    expect((await env.DB.prepare('SELECT told_updated_at FROM clubs WHERE id = \'bunkie-chess-club\'').first<{ told_updated_at: string }>())!.told_updated_at).toBe(opened)
    const save = await invoke(adminClubPatch, { method: 'PATCH', as: admin, aal: 'aal2', params: { id: 'bunkie-chess-club' }, body: { toldUpdatedAt: opened, costText: 'Free' } })
    expect(save.status).toBe(200)
    // The check itself is live: a form that read another stamp is still refused.
    const stale = await invoke(adminClubPatch, { method: 'PATCH', as: admin, aal: 'aal2', params: { id: 'bunkie-chess-club' }, body: { toldUpdatedAt: '2020-01-01 00:00:00', costText: 'Free' } })
    expect(stale.status).toBe(409)
    expect(await stale.json()).toEqual({ error: SAVED_SINCE })
  })
})

/** An event of the club in a state of the LCA admins' wait, its times as datetime('now') writes them, or blank. */
async function waitingEvent(clubId: string, state: 'draft' | 'review' | 'approved' | 'blank', opts: { visible?: boolean } = {}): Promise<string> {
  const id = await seedTournament({ clubId, isVisible: opts.visible ?? state === 'approved', name: `Example Club Quads ${crypto.randomUUID().slice(0, 6)}` })
  const [requested, approved] = state === 'draft' ? [null, null]
    : state === 'review' ? ['2026-11-14 18:00:00', null]
      : state === 'approved' ? ['2026-11-14 18:00:00', '2026-11-16 15:00:00']
        : ['2026-11-14 18:00:00', '  ']
  await env.DB.prepare('UPDATE tournaments SET needs_lca_approval = 1, approval_requested_at = ?, approved_at = ? WHERE id = ?').bind(requested, approved, id).run()
  return id
}

describe('GET /api/workspace/region with REGION_EVENTS_ON set (WS09 step 19): the events in LCA review', () => {
  it('counts each club\'s events in LCA review on its card, and their sum in This month: one, two and none', async () => {
    flags.regionOn = true
    const region = newRegion()
    const one = await club(region, 'Example Alpha Club')
    const two = await club(region, 'Example Bravo Club')
    const none = await club(region, 'Example Charlie Club')
    const holder = await seedMember({ fullName: 'Player One' })
    await seat(holder, [region])
    await waitingEvent(one, 'review')
    await waitingEvent(two, 'review')
    await waitingEvent(two, 'review')
    await waitingEvent(two, 'draft')
    await waitingEvent(two, 'approved')
    await waitingEvent(none, 'draft')
    await seedTournament({ clubId: none })
    const read = await answer(holder)
    expect(workspaceRegionResponseSchema.safeParse(read).success).toBe(true)
    const byId = new Map(read.clubs.map((c) => [c.id, c]))
    expect(byId.get(one)?.inReview).toBe(1)
    expect(byId.get(two)?.inReview).toBe(2)
    expect(byId.get(none)?.inReview).toBe(0)
    expect(read.thisMonth.inReview).toBe(3)
    // The open items stay empty, so Confirm all and the cards' order are as before.
    for (const card of read.clubs) expect(card.openItems).toEqual([])
  })

  it('counts an event as in review only while it is marked, sent and not approved, a blank time read as not set', async () => {
    flags.regionOn = true
    const region = newRegion()
    const clubId = await club(region)
    const holder = await seedMember({ fullName: 'Player One' })
    await seat(holder, [region])
    await waitingEvent(clubId, 'blank')
    const unmarked = await seedTournament({ clubId })
    await env.DB.prepare('UPDATE tournaments SET approval_requested_at = \'2026-11-14 18:00:00\' WHERE id = ?').bind(unmarked).run()
    const blankSent = await waitingEvent(clubId, 'draft')
    await env.DB.prepare('UPDATE tournaments SET approval_requested_at = \' \' WHERE id = ?').bind(blankSent).run()
    const read = await answer(holder)
    expect(read.clubs[0].inReview).toBe(1)
    expect(read.thisMonth.inReview).toBe(1)
  })

  it('counts every event of the clubs a representative keeps, hidden drafts among them, since they run them, and gives an LCA admin every club\'s', async () => {
    flags.regionOn = true
    const region = newRegion()
    const clubId = await club(region)
    const holder = await seedMember({ fullName: 'Player One' })
    await seat(holder, [region])
    await seedTournament({ clubId })
    await waitingEvent(clubId, 'draft')
    await waitingEvent(clubId, 'review')
    const read = await answer(holder)
    expect(read.clubs[0].events).toBe(3)
    expect(read.clubs[0].inReview).toBe(1)
    const admin = await answer(await seedAdmin(), 'aal2')
    expect(admin.clubs.find((c) => c.id === clubId)?.inReview).toBe(1)
    expect(admin.thisMonth.inReview).toBeGreaterThanOrEqual(1)
  })

  it('with the constant unset the answer is the base\'s, byte for byte, with no query more, and with it set exactly one query more', async () => {
    const region = newRegion()
    const clubId = await club(region)
    const holder = await seedMember({ fullName: 'Player One' })
    await seat(holder, [region])
    await seedTournament({ clubId })
    await waitingEvent(clubId, 'draft')
    await waitingEvent(clubId, 'review')
    const off = countingDb()
    const before = await invoke(regionGet, { as: holder, aal: 'aal1', env: { DB: off.db } })
    expect(before.status).toBe(200)
    const body = await before.json<WorkspaceRegionResponse>()
    // The base's card and This month, key for key: no count of events in review, and the hidden drafts not counted.
    expect(Object.keys(body.clubs[0])).toEqual(['id', 'name', 'city', 'region', 'color', 'logoUrl', 'statement', 'lastConfirmedAt', 'lastCheckWords', 'needsCheck', 'events', 'openItems'])
    expect(Object.keys(body.thisMonth)).toEqual(['nextCheck', 'checked', 'notChecked'])
    expect(body.clubs[0].events).toBe(1)
    expect(off.ran.some((r) => r.sql.includes('needs_lca_approval'))).toBe(false)
    flags.regionOn = true
    const on = countingDb()
    expect((await invoke(regionGet, { as: holder, aal: 'aal1', env: { DB: on.db } })).status).toBe(200)
    expect(on.ran).toHaveLength(off.ran.length + 1)
    expect(on.ran.filter((r) => r.sql.includes('needs_lca_approval'))).toHaveLength(1)
    expect(on.ran.filter((r) => !r.sql.includes('needs_lca_approval')).map((r) => r.sql)).toEqual(off.ran.map((r) => r.sql))
  })
})
