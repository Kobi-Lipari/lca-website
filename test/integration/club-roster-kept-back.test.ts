// test/integration/club-roster-kept-back.test.ts
// K's answer 2 (a) to checkpoint S's choices, for a person admitted to a
// club by a regional seat alone (admittedByRegionAlone in
// functions/utils/clubs/memberView.ts): GET /api/admin/clubs/[id] answers
// them the club's visible events and no hidden draft, and says the roster is
// kept back; and the removal of an officer answers them the same 403, in the
// same words, as the adding of one, and removes nothing. An LCA admin, an
// observer and the club's own rep, a seat holder too, get today's answer
// byte for byte and remove an officer as before.
import { describe, it, expect } from 'vitest'
import { env } from 'cloudflare:test'
import { invoke } from './harness'
import { seedAdmin, seedClub, seedMember, seedTournament } from './factories'

import { onRequestGet as adminClubGet } from '../../functions/api/admin/clubs/[id]'
import { onRequestPost as officersPost } from '../../functions/api/admin/clubs/[id]/officers'
import { onRequestDelete as officerDelete } from '../../functions/api/admin/clubs/[id]/officers/[officerId]'
import { ROSTER_KEPT_BACK } from '../../functions/utils/clubs/memberView'

const REGION = 'Bayou Region'

/** A regional seat covering the regions, held by the member, as the seat screens write one. */
async function regionalSeat(memberId: string, regions: string[] = [REGION]): Promise<void> {
  const id = `seat-${crypto.randomUUID().slice(0, 8)}`
  await env.DB.prepare(
    `INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active)
     VALUES (?, 'Example Region Representative', '', 99, ?, 'regional_rep', 1)`,
  ).bind(id, id).run()
  for (const region of regions) {
    await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(id, region).run()
  }
  await env.DB.prepare('INSERT INTO board_seat_assignments (seat_id, member_id) VALUES (?, ?)').bind(id, memberId).run()
}

/** A made up club in the region with its own rep, one officer, two visible events and a hidden draft. */
async function exampleClub(region: string | null = REGION) {
  const clubId = await seedClub({ name: 'Example Chess Club', city: 'Example City' })
  await env.DB.prepare('UPDATE clubs SET region = ? WHERE id = ?').bind(region, clubId).run()
  const rep = await seedMember({ role: 'club_rep', clubId, fullName: 'Club Rep One', email: 'club.rep.one@example.org' })
  const one = await seedMember({ clubId, fullName: 'Player One', email: 'player.one@example.org' })
  const admin = await seedAdmin()
  const added = await invoke(officersPost, {
    method: 'POST', as: admin, params: { id: clubId }, body: { memberId: one, title: 'President' },
  })
  expect(added.status).toBe(201)
  const officerId = (await added.json<{ officers: Array<{ id: string }> }>()).officers[0].id
  const spring = await seedTournament({ clubId, name: 'Example Spring Open', date: '2027-03-06' })
  const fall = await seedTournament({ clubId, name: 'Example Fall Open', date: '2026-10-24' })
  const draft = await seedTournament({ clubId, name: 'Example Draft Open', date: '2027-01-09', isVisible: false })
  return { clubId, rep, admin, officerId, visible: [spring, fall], draft }
}

/** GET /api/admin/clubs/[id] as it answered before K's answers, for anyone it admits but a person admitted by the region alone. */
async function todaysClubAnswer(clubId: string): Promise<string> {
  const club = await env.DB.prepare(
    'SELECT id, name, city, location, description, meeting_schedule, contact_email, created_at, color, image_url, region, latitude, longitude FROM clubs WHERE id = ?',
  ).bind(clubId).first()
  const officers = await env.DB.prepare(
    `SELECT co.id, co.member_id, co.role, m.full_name, m.email
     FROM club_officers co
     JOIN members m ON co.member_id = m.id
     WHERE co.club_id = ? ORDER BY co.created_at`,
  ).bind(clubId).all()
  const roster = await env.DB.prepare(
    `SELECT m.id, m.full_name, m.email, m.uscf_id, m.uscf_rating, m.membership_status
     FROM members m WHERE m.club_id = ? AND m.role != 'guest' ORDER BY m.full_name`,
  ).bind(clubId).all()
  const tournaments = await env.DB.prepare(
    `SELECT id, name, date, end_date, status, is_visible, registration_status
     FROM tournaments WHERE club_id = ? ORDER BY date DESC`,
  ).bind(clubId).all()
  return JSON.stringify({ club, officers: officers.results, roster: roster.results, tournaments: tournaments.results })
}

const officerStays = async (officerId: string) =>
  (await env.DB.prepare('SELECT COUNT(*) AS n FROM club_officers WHERE id = ?').bind(officerId).first<{ n: number }>())?.n === 1
/** The removals of an officer the audit log holds for the club. */
const removals = async (clubId: string) =>
  (await env.DB.prepare(`SELECT COUNT(*) AS n FROM admin_audit_log WHERE action = 'officer_remove' AND detail LIKE ?`)
    .bind(`%${clubId}%`).first<{ n: number }>())?.n ?? 0

describe('a region\'s representative gets no hidden draft from the admin club answer', () => {
  it('answers every visible event, newest first, and no hidden one, and says the roster is kept back', async () => {
    const { clubId, visible, draft } = await exampleClub()
    const holder = await seedMember({ fullName: 'Region Holder One', email: 'region.holder.one@example.org' })
    await regionalSeat(holder)

    const res = await invoke(adminClubGet, { as: holder, aal: 'aal1', params: { id: clubId } })
    expect(res.status).toBe(200)
    const body = await res.json<{ roster: unknown[]; rosterKeptBack: unknown; tournaments: Array<{ id: string; is_visible: number }> }>()
    expect(body.tournaments.map((t) => t.id)).toEqual(visible)
    expect(body.tournaments.map((t) => t.is_visible)).toEqual([1, 1])
    expect(await res.response.clone().text()).not.toContain(draft)
    expect(body.roster).toEqual([])
    expect(body.rosterKeptBack).toBe(true)
  })

  it('an LCA admin, an observer and the club\'s own rep who holds the seat too get every event, the draft among them, and today\'s answer', async () => {
    const { clubId, rep, admin, visible, draft } = await exampleClub()
    await regionalSeat(rep)
    const observer = await seedMember({ role: 'lca_observer' })
    for (const [who, aal] of [[admin, undefined], [rep, undefined], [observer, 'aal1']] as const) {
      const res = await invoke(adminClubGet, { as: who, aal, params: { id: clubId } })
      expect(res.status, who).toBe(200)
      const text = await res.response.clone().text()
      expect(text, who).toBe(await todaysClubAnswer(clubId))
      expect(text, who).not.toContain('rosterKeptBack')
      const { tournaments } = await res.json<{ tournaments: Array<{ id: string }> }>()
      expect(tournaments.map((t) => t.id), who).toEqual([visible[0], draft, visible[1]])
    }
  })
})

describe('a region\'s representative cannot remove an officer', () => {
  it('answers 403 in the words the adding answers, before it reads the officer, and the officer stays', async () => {
    const { clubId, officerId } = await exampleClub()
    const holder = await seedMember()
    await regionalSeat(holder)

    // An officer of the club and an id that is no officer get the same answer.
    for (const id of [officerId, `${officerId}-x`]) {
      const res = await invoke(officerDelete, { method: 'DELETE', as: holder, aal: 'aal1', params: { id: clubId, officerId: id } })
      expect(res.status, id).toBe(403)
      expect(await res.response.clone().text(), id).toBe(JSON.stringify({ error: ROSTER_KEPT_BACK }))
    }
    const adding = await invoke(officersPost, {
      method: 'POST', as: holder, aal: 'aal1', params: { id: clubId }, body: { memberId: holder, title: 'Secretary' },
    })
    expect(adding.status).toBe(403)
    expect(await adding.response.clone().text()).toBe(JSON.stringify({ error: ROSTER_KEPT_BACK }))
    expect(await officerStays(officerId)).toBe(true)
    expect(await removals(clubId)).toBe(0)
  })

  it('the club\'s own rep and an LCA admin remove an officer as before', async () => {
    for (const by of ['rep', 'admin'] as const) {
      const made = await exampleClub()
      await regionalSeat(made.rep)
      const res = await invoke(officerDelete, { method: 'DELETE', as: made[by], params: { id: made.clubId, officerId: made.officerId } })
      expect(res.status, by).toBe(200)
      expect(await res.json(), by).toEqual({ success: true })
      expect(await officerStays(made.officerId), by).toBe(false)
      expect(await removals(made.clubId), by).toBe(1)
    }
  })

  it('another club\'s rep who holds the region\'s seat is refused here, and removes on their own club', async () => {
    const here = await exampleClub()
    const own = await exampleClub(null)
    await regionalSeat(own.rep)

    const refused = await invoke(officerDelete, { method: 'DELETE', as: own.rep, params: { id: here.clubId, officerId: here.officerId } })
    expect(refused.status).toBe(403)
    expect(await refused.json()).toEqual({ error: ROSTER_KEPT_BACK })
    expect(await officerStays(here.officerId)).toBe(true)

    const home = await invoke(officerDelete, { method: 'DELETE', as: own.rep, params: { id: own.clubId, officerId: own.officerId } })
    expect(home.status).toBe(200)
    expect(await officerStays(own.officerId)).toBe(false)
  })

  it('role safety: signed out, a member with no seat, an observer and another region\'s representative get today\'s refusals', async () => {
    const { clubId, officerId } = await exampleClub()
    const member = await seedMember()
    const observer = await seedMember({ role: 'lca_observer' })
    const elsewhere = await seedMember()
    await regionalSeat(elsewhere, ['North Louisiana'])

    expect((await invoke(officerDelete, { method: 'DELETE', params: { id: clubId, officerId } })).status).toBe(401)
    for (const who of [member, observer, elsewhere]) {
      const res = await invoke(officerDelete, { method: 'DELETE', as: who, aal: 'aal1', params: { id: clubId, officerId } })
      expect(res.status, who).toBe(403)
      expect(await res.json(), who).toEqual({ error: 'Forbidden' })
    }
    expect(await officerStays(officerId)).toBe(true)
  })
})
