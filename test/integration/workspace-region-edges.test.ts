// test/integration/workspace-region-edges.test.ts
//
// More cases for My region's answer, GET /api/workspace/region, and Still
// accurate, POST /api/admin/clubs/[id]/confirm (WS09 step 10): seats and
// regions at their edges, stale and unreadable stamps, a save read as a check,
// refusals for ids of every shape, and races. Same handlers, same database. CLUB_KEEPERS_ON is false in
// the tree; here it is read through a getter on the mocked module, set for
// most cases and unset for the cases that hold what ships. Every club,
// region and person here is made up ("Example Chess Club", example.org);
// each case makes its own regions, so one case's seats never cover
// another's clubs, and the 25 clubs the migrations seed are met only where a
// case says so.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { onRequestGet as regionGet } from '../../functions/api/workspace/region'
import { onRequestPost as confirmPost } from '../../functions/api/admin/clubs/[id]/confirm'
import { onRequestPatch as adminClubPatch } from '../../functions/api/admin/clubs/[id]'
import { needsCheck } from '../../domain/clubs/regionCards'
import type { WorkspaceRegionResponse } from '../../domain/contracts/clubs'
import type { Env } from '../../functions/types'
import { flushWaitUntil, invoke, resetHarness, type Aal } from './harness'
import { seedAdmin, seedClub, seedMember, seedTournament } from './factories'

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

describe('My region: edges of seats, regions and stamps', () => {
  it('lists a club once and a keeper once per seat when a person holds two seats over the same region, and never names a guest who holds a seat', async () => {
    const region = newRegion()
    const clubId = await club(region)
    const viewer = await seedMember({ fullName: 'Player One' })
    await seat(viewer, [region], { title: 'Example First Seat' })
    await seat(viewer, [region], { title: 'Example Second Seat' })
    const other = await seedMember({ fullName: 'Player Two' })
    await seat(other, [region], { title: 'Example Seat A' })
    await seat(other, [region], { title: 'Example Seat B' })
    // A guest is refused by both endpoints whatever seat they hold, so they are not named as a keeper either.
    const guest = await seedMember({ fullName: 'Player Three', role: 'guest' })
    await seat(guest, [region], { title: 'Example Seat C' })
    const a = await answer(viewer)
    expect(clubIds(a)).toEqual([clubId])
    expect(a.thisMonth).toMatchObject({ checked: 0, notChecked: 1 })
    expect(a.regions).toEqual([{ region, keepers: [{ name: 'Player Two', seat: 'Example Seat A' }, { name: 'Player Two', seat: 'Example Seat B' }] }])
  })

  it('names a keeper under each region their seat covers, regions in order, and an admin with no seat sees the keepers of every region with a club', async () => {
    const [first, second] = [`Example Region A ${crypto.randomUUID().slice(0, 8)}`, `Example Region B ${crypto.randomUUID().slice(0, 8)}`]
    await club(first)
    await club(second)
    const viewer = await seedMember({ fullName: 'Player One' })
    await seat(viewer, [second, first])
    const other = await seedMember({ fullName: 'Player Two', email: 'player.two@example.org' })
    await seat(other, [first, second], { title: 'Example Shared Seat' })
    const a = await answer(viewer)
    expect(a.regions).toEqual([
      { region: first, keepers: [{ name: 'Player Two', seat: 'Example Shared Seat' }] },
      { region: second, keepers: [{ name: 'Player Two', seat: 'Example Shared Seat' }] },
    ])
    const admin = await seedAdmin()
    const seenByAdmin = await answer(admin, 'aal2')
    const named = seenByAdmin.regions.filter((r) => [first, second].includes(r.region))
    expect(named.map((r) => r.region)).toEqual([first, second])
    for (const r of named) expect(r.keepers.map((k) => k.name).sort()).toEqual(['Player One', 'Player Two'])
    expect(JSON.stringify(seenByAdmin)).not.toContain('@')
  })

  it('gives a club with no region to an LCA admin as a card with region null, and to no seat holder', async () => {
    const region = newRegion()
    const inRegion = await club(region)
    const bare = await seedClub({ name: 'Example Unplaced Club', city: 'Example City' })
    const blank = await seedClub({ name: 'Example Blank Club', city: 'Example City' })
    await env.DB.prepare('UPDATE clubs SET region = \'\' WHERE id = ?').bind(blank).run()
    const holder = await seedMember({ fullName: 'Player One' })
    await seat(holder, [region])
    expect(clubIds(await answer(holder))).toEqual([inRegion])
    const seenByAdmin = await answer(await seedAdmin(), 'aal2')
    const byId = Object.fromEntries(seenByAdmin.clubs.map((c) => [c.id, c]))
    expect(byId[bare].region).toBeNull()
    expect(byId[blank].region).toBeNull()
    expect(seenByAdmin.regions.map((r) => r.region)).not.toContain('')
  })

  it('reads stale, recent, future and unreadable stamps: needing a check after 90 days or with no readable stamp, and the month in words', async () => {
    const region = newRegion()
    const recent = await club(region, 'Example Recent Club')
    const old = await club(region, 'Example Old Club')
    const future = await club(region, 'Example Future Club')
    const junk = await club(region, 'Example Junk Club')
    const lateEvening = await club(region, 'Example Evening Club')
    const set = (id: string, stamp: string) => env.DB.prepare('UPDATE clubs SET last_confirmed_at = ? WHERE id = ?').bind(stamp, id).run()
    await env.DB.prepare('UPDATE clubs SET last_confirmed_at = datetime(\'now\', \'-89 days\') WHERE id = ?').bind(recent).run()
    await env.DB.prepare('UPDATE clubs SET last_confirmed_at = datetime(\'now\', \'-91 days\') WHERE id = ?').bind(old).run()
    await env.DB.prepare('UPDATE clubs SET last_confirmed_at = datetime(\'now\', \'+2 days\') WHERE id = ?').bind(future).run()
    await set(junk, 'not a stamp')
    // 9:30 PM Central on Wed, Sep 30, 2026 is stored as Oct 1 in UTC; its words keep September.
    await set(lateEvening, '2026-10-01 02:30:00')
    const holder = await seedMember({ fullName: 'Player One' })
    await seat(holder, [region])
    const a = await answer(holder)
    const byId = Object.fromEntries(a.clubs.map((c) => [c.id, c]))
    expect(byId[recent].needsCheck).toBe(false)
    expect(byId[recent].lastCheckWords).toMatch(/^Checked [A-Z][a-z]{2} \d{4}$/)
    expect(byId[old].needsCheck).toBe(true)
    expect(byId[old].lastCheckWords).toMatch(/^Not checked since [A-Z][a-z]{2} \d{4}$/)
    expect(byId[future].needsCheck).toBe(false)
    expect(byId[junk]).toMatchObject({ needsCheck: true, lastCheckWords: 'Not checked yet' })
    expect(byId[lateEvening].lastCheckWords).toMatch(/^(Checked|Not checked since) Sep 2026$/)
    // The evening club's stamp is a fixed date, so whether it still counts depends on the day the case runs.
    const eveningNeeds = needsCheck('2026-10-01 02:30:00', Date.now())
    expect(byId[lateEvening].needsCheck).toBe(eveningNeeds)
    expect(a.thisMonth).toMatchObject({ checked: 2 + (eveningNeeds ? 0 : 1), notChecked: 2 + (eveningNeeds ? 1 : 0) })
    // The ones that need a check come first, A to Z among them.
    const needing = [old, junk, ...(eveningNeeds ? [lateEvening] : [])].sort((x, y) => byId[x].name.localeCompare(byId[y].name))
    expect(clubIds(a).slice(0, needing.length)).toEqual(needing)
  })

  it('carries none of the words the plain-language rules ban', async () => {
    const region = newRegion()
    await club(region)
    const holder = await seedMember({ fullName: 'Player One' })
    await seat(holder, [region])
    await env.DB.prepare('UPDATE clubs SET last_confirmed_at = datetime(\'now\', \'-5 days\') WHERE region = ?').bind(region).run()
    const text = await (await get(holder)).response.text()
    expect(text).not.toMatch(new RegExp(['US', 'CF'].join('')))
    expect(text).not.toMatch(/\d\.5\b/)
    expect(text).not.toMatch(/[\u2013\u2014]/)
    expect(JSON.parse(text).thisMonth.nextCheck.time).toBe('8:00 AM')
  })

  it('counts a club\'s events by club: an event of another club, hidden or not, is never counted, and a club with none counts 0', async () => {
    const region = newRegion()
    const mine = await club(region, 'Example Chess Club')
    const empty = await club(region, 'Example Empty Club')
    const elsewhere = await club(newRegion(), 'Example Far Club')
    await seedTournament({ clubId: mine, isVisible: true })
    await seedTournament({ clubId: mine, isVisible: true })
    await seedTournament({ clubId: elsewhere, isVisible: true })
    await seedTournament({ clubId: elsewhere, isVisible: false })
    const holder = await seedMember({ fullName: 'Player One' })
    await seat(holder, [region])
    const a = await answer(holder)
    expect(Object.fromEntries(a.clubs.map((c) => [c.id, c.events]))).toEqual({ [mine]: 2, [empty]: 0 })
  })

  it('counts a club\'s rep with a seat over another region only that region\'s visible events, and never their own club\'s hidden draft', async () => {
    const [home, away] = [newRegion(), newRegion()]
    const homeClub = await club(home, 'Example Home Club')
    const awayClub = await club(away, 'Example Away Club')
    await seedTournament({ clubId: awayClub, isVisible: true })
    await seedTournament({ clubId: awayClub, isVisible: false })
    await seedTournament({ clubId: homeClub, isVisible: false })
    const rep = await seedMember({ role: 'club_rep', clubId: homeClub, fullName: 'Club Rep One' })
    await seat(rep, [away])
    const a = await answer(rep)
    expect(clubIds(a)).toEqual([awayClub])
    expect(a.clubs[0].events).toBe(1)
  })

  it('reads a save as a check: a keeper\'s own save through the PATCH makes the club read as checked, and the card moves behind a club still to check', async () => {
    const region = newRegion()
    const toCheck = await club(region, 'Example Alpha Club')
    const saved = await club(region, 'Example Zulu Club')
    const rep = await seedMember({ role: 'club_rep', clubId: saved, fullName: 'Club Rep One' })
    const holder = await seedMember({ fullName: 'Player One' })
    await seat(holder, [region])
    expect(clubIds(await answer(holder))).toEqual([toCheck, saved])
    const stamp = (await env.DB.prepare('SELECT told_updated_at FROM clubs WHERE id = ?').bind(saved).first<{ told_updated_at: string | null }>())!.told_updated_at
    const save = await invoke(adminClubPatch, { method: 'PATCH', as: rep, aal: 'aal1', params: { id: saved }, body: { toldUpdatedAt: stamp, costText: 'Free' } })
    expect(save.status).toBe(200)
    await flushWaitUntil()
    const a = await answer(holder)
    expect(clubIds(a)).toEqual([toCheck, saved])
    const card = a.clubs.find((c) => c.id === saved)!
    expect(card.needsCheck).toBe(false)
    expect(card.lastCheckWords).toMatch(/^Checked [A-Z][a-z]{2} \d{4}$/)
    expect(a.thisMonth).toMatchObject({ checked: 1, notChecked: 1 })
  })
})

describe('Still accurate: refusals that hold whatever the club\'s state', () => {
  it('refuses a stranger the same words for ids of every shape, and writes nothing', async () => {
    const stranger = await seedMember()
    const before = await allClubs()
    const bodies = new Set<string>()
    for (const id of ['example-no-such-club', '', ' ', '%', 'x\'; DELETE FROM clubs; --', 'CLUB-UPPER', '../members', 'a'.repeat(300)]) {
      const res = await confirm(stranger, id)
      expect(res.status, JSON.stringify(id)).toBe(403)
      bodies.add(await res.response.text())
    }
    expect([...bodies]).toEqual([JSON.stringify({ error: 'Forbidden' })])
    expect(await allClubs()).toEqual(before)
  })

  it('does not let a body field choose the club, the person or the time, and answers a stranger 403 before it reads the body', async () => {
    const region = newRegion()
    const mine = await club(region)
    const theirs = await club(newRegion(), 'Example Other Club')
    const rep = await seedMember({ role: 'club_rep', clubId: mine })
    const before = await allClubs()
    const res = await confirm(rep, mine, { id: theirs, clubId: theirs, confirmed_by: 'example-someone', last_confirmed_at: '2020-01-01 00:00:00' })
    expect(res.status).toBe(200)
    const after = await allClubs()
    expect(after.find((r) => r.id === theirs)).toEqual(before.find((r) => r.id === theirs))
    expect(after.find((r) => r.id === mine)!.confirmed_by).toBe(rep)
    const stranger = await seedMember()
    const refused = await confirm(stranger, mine, undefined, { rawBody: 'not json' })
    expect(refused.status).toBe(403)
  })

  it('is safe to race: two confirms at once, by the same person and by two keepers, both answer 200 and leave one stamp, one club changed and no activity row', async () => {
    const region = newRegion()
    const clubId = await club(region)
    const neighbour = await club(region, 'Example Second Club')
    const rep = await seedMember({ role: 'club_rep', clubId })
    const holder = await seedMember()
    await seat(holder, [region])
    const before = await allClubs()
    const audits = await auditRows()
    const results = await Promise.all([confirm(rep, clubId), confirm(rep, clubId), confirm(holder, clubId), confirm(holder, clubId)])
    expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200])
    const row = (await env.DB.prepare('SELECT last_confirmed_at, confirmed_by FROM clubs WHERE id = ?').bind(clubId).first<{ last_confirmed_at: string; confirmed_by: string }>())!
    expect([rep, holder]).toContain(row.confirmed_by)
    expect(row.last_confirmed_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    const after = await allClubs()
    expect(after.filter((r) => r.id !== clubId)).toEqual(before.filter((r) => r.id !== clubId))
    expect(after.find((r) => r.id === neighbour)!.last_confirmed_at).toBeNull()
    expect(await auditRows()).toBe(audits)
  })

  it('is safe to race with a keeper\'s save: both succeed, and the club ends with the save\'s words and a check', async () => {
    const region = newRegion()
    const clubId = await club(region)
    const rep = await seedMember({ role: 'club_rep', clubId })
    const holder = await seedMember()
    await seat(holder, [region])
    const stamp = (await env.DB.prepare('SELECT told_updated_at FROM clubs WHERE id = ?').bind(clubId).first<{ told_updated_at: string | null }>())!.told_updated_at
    const [save, tap] = await Promise.all([
      invoke(adminClubPatch, { method: 'PATCH', as: rep, aal: 'aal1', params: { id: clubId }, body: { toldUpdatedAt: stamp, costText: 'Free' } }),
      confirm(holder, clubId),
    ])
    expect([save.status, tap.status]).toEqual([200, 200])
    const row = (await env.DB.prepare('SELECT cost_text, last_confirmed_at, confirmed_by FROM clubs WHERE id = ?').bind(clubId).first<Record<string, string>>())!
    expect(row.cost_text).toBe('Free')
    expect(row.last_confirmed_at).not.toBeNull()
    expect([rep, holder]).toContain(row.confirmed_by)
  })

  it('answers OPTIONS on both endpoints with 204 and no body, with the constant set or unset', async () => {
    const { onRequestOptions: regionOptions } = await import('../../functions/api/workspace/region')
    const { onRequestOptions: confirmOptions } = await import('../../functions/api/admin/clubs/[id]/confirm')
    for (const on of [true, false]) {
      flags.keepersOn = on
      for (const handler of [regionOptions, confirmOptions]) {
        const res = await invoke(handler, { method: 'OPTIONS', params: { id: 'example-no-such-club' } })
        expect(res.status).toBe(204)
      }
    }
  })
})
