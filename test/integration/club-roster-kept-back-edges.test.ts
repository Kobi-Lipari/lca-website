// test/integration/club-roster-kept-back-edges.test.ts
// The edges of K's answer 2 (a) to checkpoint S's choices, beyond
// club-roster-kept-back.test.ts: for a person admitted to a club by a regional
// seat alone, GET /api/admin/clubs/[id] keeps hidden drafts out whatever the
// event's dates and status, follows a change of visibility at once, and holds
// its refusals for everyone else without the club's data; and the removal of
// an officer is refused them every time, while a rep and an LCA admin removing
// the same officer get one success and then today's 404, in any order.
import { describe, it, expect } from 'vitest'
import { env } from 'cloudflare:test'
import { invoke } from './harness'
import { seedAdmin, seedClub, seedMember, seedTournament } from './factories'

import { onRequestGet as adminClubGet } from '../../functions/api/admin/clubs/[id]'
import { onRequestPost as officersPost } from '../../functions/api/admin/clubs/[id]/officers'
import { onRequestDelete as officerDelete } from '../../functions/api/admin/clubs/[id]/officers/[officerId]'
import { ROSTER_KEPT_BACK } from '../../functions/utils/clubs/memberView'

const REGION = 'Bayou Region'

async function regionalSeat(memberId: string, regions: string[] = [REGION]): Promise<string> {
  const id = `seat-${crypto.randomUUID().slice(0, 8)}`
  await env.DB.prepare(
    `INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active)
     VALUES (?, 'Example Region Representative', '', 99, ?, 'regional_rep', 1)`,
  ).bind(id, id).run()
  for (const region of regions) {
    await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(id, region).run()
  }
  await env.DB.prepare('INSERT INTO board_seat_assignments (seat_id, member_id) VALUES (?, ?)').bind(id, memberId).run()
  return id
}

async function clubInRegion() {
  const clubId = await seedClub({ name: 'Example Chess Club', city: 'Example City' })
  await env.DB.prepare('UPDATE clubs SET region = ? WHERE id = ?').bind(REGION, clubId).run()
  return clubId
}

async function addOfficer(clubId: string, title = 'President') {
  const clubMember = await seedMember({ clubId, fullName: 'Player One', email: 'player.one@example.org' })
  const admin = await seedAdmin()
  const res = await invoke(officersPost, { method: 'POST', as: admin, params: { id: clubId }, body: { memberId: clubMember, title } })
  expect(res.status).toBe(201)
  return (await res.json<{ officers: Array<{ id: string }> }>()).officers[0].id
}

type Event = { id: string; name: string; date: string; end_date: string | null; status: string; is_visible: number }
const eventsFor = async (clubId: string, who: string) => {
  const res = await invoke(adminClubGet, { as: who, aal: 'aal1', params: { id: clubId } })
  expect(res.status).toBe(200)
  return (await res.json<{ tournaments: Event[] }>()).tournaments
}

describe('what a region\'s representative is answered of a club\'s events', () => {
  it('a club with only hidden drafts, and a club with no events, answer an empty list', async () => {
    const holder = await seedMember()
    await regionalSeat(holder)
    const draftsOnly = await clubInRegion()
    await seedTournament({ clubId: draftsOnly, name: 'Example Draft Open', isVisible: false })
    await seedTournament({ clubId: draftsOnly, name: 'Example Second Draft', isVisible: false, date: '2027-02-06' })
    const none = await clubInRegion()

    expect(await eventsFor(draftsOnly, holder)).toEqual([])
    expect(await eventsFor(none, holder)).toEqual([])
  })

  it('keeps a visible event whatever its end date or status, and drops a hidden one whatever its status', async () => {
    const clubId = await clubInRegion()
    const holder = await seedMember()
    await regionalSeat(holder)
    const oneDay = await seedTournament({ clubId, name: 'Example One Day', date: '2027-03-06', status: 'upcoming' })
    const twoDay = await seedTournament({ clubId, name: 'Example Two Day', date: '2027-04-10', status: 'active' })
    const finished = await seedTournament({ clubId, name: 'Example Finished', date: '2026-09-12', status: 'completed' })
    const hiddenUpcoming = await seedTournament({ clubId, name: 'Hidden Upcoming', date: '2027-05-01', status: 'upcoming', isVisible: false })
    const hiddenCompleted = await seedTournament({ clubId, name: 'Hidden Completed', date: '2026-08-01', status: 'completed', isVisible: false })
    await env.DB.prepare('UPDATE tournaments SET end_date = ? WHERE id = ?').bind('2027-04-11', twoDay).run()

    const events = await eventsFor(clubId, holder)
    // Newest date first, and the dates and statuses as stored: end_date null stays null.
    expect(events.map((t) => t.id)).toEqual([twoDay, oneDay, finished])
    expect(events.map((t) => t.end_date)).toEqual(['2027-04-11', null, null])
    expect(events.map((t) => t.status)).toEqual(['active', 'upcoming', 'completed'])
    expect(events.every((t) => t.is_visible === 1)).toBe(true)
    expect(JSON.stringify(events)).not.toContain(hiddenUpcoming)
    expect(JSON.stringify(events)).not.toContain(hiddenCompleted)
  })

  it('events on the same day all come, and only the visible ones, as an LCA admin\'s answer orders them', async () => {
    const clubId = await clubInRegion()
    const holder = await seedMember()
    await regionalSeat(holder)
    const admin = await seedAdmin()
    const a = await seedTournament({ clubId, name: 'Example Saturday A', date: '2027-03-06' })
    const b = await seedTournament({ clubId, name: 'Example Saturday B', date: '2027-03-06' })
    const hiddenSameDay = await seedTournament({ clubId, name: 'Hidden Saturday', date: '2027-03-06', isVisible: false })

    const forHolder = (await eventsFor(clubId, holder)).map((t) => t.id)
    const forAdmin = await (await invoke(adminClubGet, { as: admin, params: { id: clubId } })).json<{ tournaments: Event[] }>()
    expect([...forHolder].sort()).toEqual([a, b].sort())
    // The holder's list is the admin's list less the draft, in the same order.
    expect(forAdmin.tournaments.map((t) => t.id).filter((id) => id !== hiddenSameDay)).toEqual(forHolder)
  })

  it('follows a change of visibility on the next read, in both directions', async () => {
    const clubId = await clubInRegion()
    const holder = await seedMember()
    await regionalSeat(holder)
    const shown = await seedTournament({ clubId, name: 'Example Shown', date: '2027-03-06' })
    const draft = await seedTournament({ clubId, name: 'Example Draft', date: '2027-01-09', isVisible: false })

    expect((await eventsFor(clubId, holder)).map((t) => t.id)).toEqual([shown])
    await env.DB.prepare('UPDATE tournaments SET is_visible = 1 WHERE id = ?').bind(draft).run()
    expect((await eventsFor(clubId, holder)).map((t) => t.id)).toEqual([shown, draft])
    await env.DB.prepare('UPDATE tournaments SET is_visible = 0 WHERE id = ?').bind(shown).run()
    expect((await eventsFor(clubId, holder)).map((t) => t.id)).toEqual([draft])
    // Asking again gives the same answer: a read changes nothing.
    expect((await eventsFor(clubId, holder)).map((t) => t.id)).toEqual([draft])
  })

  it('another club\'s events are never in the answer, hidden or visible', async () => {
    const clubId = await clubInRegion()
    const other = await clubInRegion()
    const holder = await seedMember()
    await regionalSeat(holder)
    const mine = await seedTournament({ clubId, name: 'Example Home Open' })
    await seedTournament({ clubId: other, name: 'Example Away Open' })
    await seedTournament({ clubId: other, name: 'Example Away Draft', isVisible: false })
    expect((await eventsFor(clubId, holder)).map((t) => t.id)).toEqual([mine])
  })

  it('a seat holder who is also an observer is answered every event, the draft among them', async () => {
    const clubId = await clubInRegion()
    const observer = await seedMember({ role: 'lca_observer' })
    await regionalSeat(observer)
    const shown = await seedTournament({ clubId, name: 'Example Shown', date: '2027-03-06' })
    const draft = await seedTournament({ clubId, name: 'Example Draft', date: '2027-01-09', isVisible: false })
    const res = await invoke(adminClubGet, { as: observer, aal: 'aal1', params: { id: clubId } })
    const body = await res.json<{ tournaments: Event[]; rosterKeptBack?: unknown }>()
    expect(body.tournaments.map((t) => t.id)).toEqual([shown, draft])
    expect(body.rosterKeptBack).toBeUndefined()
  })
})

describe('role safety on the admin club answer: the wrong person never gets the club or its events', () => {
  it('signed out gets 401; a member with no seat, a seat of another region and a seat whose term ended get 403', async () => {
    const clubId = await clubInRegion()
    await seedTournament({ clubId, name: 'Example Home Open' })
    await seedTournament({ clubId, name: 'Example Home Draft', isVisible: false })
    const plain = await seedMember()
    const elsewhere = await seedMember()
    await regionalSeat(elsewhere, ['North Louisiana'])
    const former = await seedMember()
    const seatId = await regionalSeat(former)
    await env.DB.prepare(`UPDATE board_seat_assignments SET ended_at = datetime('now', '-1 day') WHERE seat_id = ?`).bind(seatId).run()

    const signedOut = await invoke(adminClubGet, { params: { id: clubId } })
    expect(signedOut.status).toBe(401)
    expect(await signedOut.response.clone().text()).not.toContain('Example Home')
    for (const who of [plain, elsewhere, former]) {
      const res = await invoke(adminClubGet, { as: who, aal: 'aal1', params: { id: clubId } })
      expect(res.status, who).toBe(403)
      const text = await res.response.clone().text()
      expect(text, who).not.toContain('Example Home')
      expect(text, who).not.toContain('tournaments')
    }
  })
})

describe('the removal of an officer, replayed and raced', () => {
  it('a region\'s representative is refused every time they ask, and the officer stays', async () => {
    const clubId = await clubInRegion()
    const officerId = await addOfficer(clubId)
    const holder = await seedMember()
    await regionalSeat(holder)
    for (let i = 0; i < 3; i++) {
      const res = await invoke(officerDelete, { method: 'DELETE', as: holder, aal: 'aal1', params: { id: clubId, officerId } })
      expect(res.status).toBe(403)
      expect(await res.json()).toEqual({ error: ROSTER_KEPT_BACK })
    }
    const left = await env.DB.prepare('SELECT COUNT(*) AS n FROM club_officers WHERE id = ?').bind(officerId).first<{ n: number }>()
    expect(left?.n).toBe(1)
  })

  it('an LCA admin removing the same officer twice gets 200 and then today\'s 404', async () => {
    const clubId = await clubInRegion()
    const officerId = await addOfficer(clubId)
    const admin = await seedAdmin()
    const first = await invoke(officerDelete, { method: 'DELETE', as: admin, params: { id: clubId, officerId } })
    expect(first.status).toBe(200)
    const second = await invoke(officerDelete, { method: 'DELETE', as: admin, params: { id: clubId, officerId } })
    expect(second.status).toBe(404)
  })

  it('a region\'s representative and the club\'s own rep asking at once: the rep removes it, the representative is refused', async () => {
    const clubId = await clubInRegion()
    const officerId = await addOfficer(clubId)
    const rep = await seedMember({ role: 'club_rep', clubId })
    const holder = await seedMember()
    await regionalSeat(holder)
    const [byRep, byHolder] = await Promise.all([
      invoke(officerDelete, { method: 'DELETE', as: rep, params: { id: clubId, officerId } }),
      invoke(officerDelete, { method: 'DELETE', as: holder, aal: 'aal1', params: { id: clubId, officerId } }),
    ])
    expect(byRep.status).toBe(200)
    expect(byHolder.status).toBe(403)
    expect(await byHolder.json()).toEqual({ error: ROSTER_KEPT_BACK })
    const left = await env.DB.prepare('SELECT COUNT(*) AS n FROM club_officers WHERE id = ?').bind(officerId).first<{ n: number }>()
    expect(left?.n).toBe(0)
  })

  it('two LCA admins asking at once: the officer is removed, and each answer is 200 or today\'s 404', async () => {
    const clubId = await clubInRegion()
    const officerId = await addOfficer(clubId)
    const [one, two] = [await seedAdmin(), await seedAdmin()]
    const answers = await Promise.all([
      invoke(officerDelete, { method: 'DELETE', as: one, params: { id: clubId, officerId } }),
      invoke(officerDelete, { method: 'DELETE', as: two, params: { id: clubId, officerId } }),
    ])
    const statuses = answers.map((r) => r.status).sort()
    // Both may find the officer before either removes it; neither may remove another or fail the server.
    expect(statuses.every((s) => s === 200 || s === 404)).toBe(true)
    expect(statuses).toContain(200)
    const left = await env.DB.prepare('SELECT COUNT(*) AS n FROM club_officers WHERE id = ?').bind(officerId).first<{ n: number }>()
    expect(left?.n).toBe(0)
  })
})
