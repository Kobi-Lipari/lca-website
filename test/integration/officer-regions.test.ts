// test/integration/officer-regions.test.ts
//
// LCA Officer: everything an LCA Observer can do except the mailing tools.
// Governance documents: admins, observers and officers manage them.
// Regional representatives: holding a regional seat lets a member manage
// every club in the regions that seat covers, and nothing else.
import { beforeEach, describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import { invoke, resetHarness } from './harness'
import { seedAdmin, seedClub, seedMember, seedRegistration, seedTournament } from './factories'

import { onRequestGet as membersGet } from '../../functions/api/admin/members'
import { onRequestPatch as rolePatch } from '../../functions/api/admin/members/[id]/role'
import { onRequestGet as manageGet } from '../../functions/api/admin/tournaments/[id]/manage'
import { onRequestPost as announcePost } from '../../functions/api/admin/tournaments/[id]/announce'
import { onRequestGet as clubGet, onRequestPatch as clubPatch } from '../../functions/api/admin/clubs/[id]'
import { onRequestGet as campaignsGet, onRequestPost as campaignsPost } from '../../functions/api/admin/campaigns'
import { onRequestPost as supportPost } from '../../functions/api/support'
import { onRequestPost as ticketReply } from '../../functions/api/admin/support/[id]'
import { onRequestPost as docPost } from '../../functions/api/governance/documents'
import { onRequestPut as docPut, onRequestDelete as docDelete } from '../../functions/api/governance/documents/[id]'
import { onRequestPut as seatRegionsPut } from '../../functions/api/admin/seat-regions'
import { onRequestGet as mySeatsGet } from '../../functions/api/board/my-seats'

beforeEach(resetHarness)

const officer = () => seedMember({ role: 'lca_officer' })

describe('LCA Officer', () => {
  it('is a role an admin can grant', async () => {
    const admin = await seedAdmin()
    const target = await seedMember()
    const res = await invoke(rolePatch, { method: 'PATCH', as: admin, params: { id: target }, body: { role: 'lca_officer' } })
    expect(res.status).toBe(200)
    const row = await env.DB.prepare('SELECT role FROM members WHERE id = ?').bind(target).first<{ role: string }>()
    expect(row?.role).toBe('lca_officer')
  })

  it('sees what an observer sees, without 2FA', async () => {
    const who = await officer()
    const members = await invoke(membersGet, { as: who, aal: 'aal1' })
    expect(members.status).toBe(200)
    const { members: rows } = await members.json<{ members: Array<Record<string, unknown>> }>()
    expect(rows[0]).toHaveProperty('role')

    const clubId = await seedClub()
    const draft = await seedTournament({ clubId, isVisible: false })
    expect((await invoke(manageGet, { as: who, aal: 'aal1', params: { id: draft } })).status).toBe(200)
    expect((await invoke(clubGet, { as: who, aal: 'aal1', params: { id: clubId } })).status).toBe(200)
  })

  it('answers support tickets', async () => {
    const who = await officer()
    const created = await invoke(supportPost, {
      method: 'POST', body: { name: 'A', email: 'a@example.org', subject: 'Question', body: 'Hi' },
    })
    const { ticketId } = await created.json<{ ticketId: string }>()
    const reply = await invoke(ticketReply, { method: 'POST', as: who, params: { id: ticketId }, body: { body: 'Happy to help.' } })
    expect(reply.status).toBe(201)
  })

  it('cannot use the mailing tools', async () => {
    const who = await officer()
    await seedMember({ email: 'someone@example.org' })
    expect((await invoke(campaignsGet, { as: who, aal: 'aal1' })).status).toBe(403)
    const sent = await invoke(campaignsPost, {
      method: 'POST', as: who, aal: 'aal1',
      body: { subject: 'Hello', bodyHtml: '<p>Hi</p>', filter: { all: true } },
    })
    expect(sent.status).toBe(403)

    const tournamentId = await seedTournament()
    await seedRegistration({ tournamentId, memberId: await seedMember() })
    const announce = await invoke(announcePost, {
      method: 'POST', as: who, params: { id: tournamentId },
      body: { subject: 'Parking', body: 'Use the north lot.' },
    })
    expect(announce.status).toBe(403)
  })

  it('cannot change roles or clubs', async () => {
    const who = await officer()
    const clubId = await seedClub()
    expect((await invoke(rolePatch, { method: 'PATCH', as: who, params: { id: who }, body: { role: 'lca_admin' } })).status).toBe(403)
    expect((await invoke(clubPatch, { method: 'PATCH', as: who, params: { id: clubId }, body: { description: 'Nope' } })).status).toBe(403)
  })
})

describe('bylaws and minutes', () => {
  for (const role of ['lca_observer', 'lca_officer']) {
    it(`${role} can add, edit and remove documents, and it is logged`, async () => {
      const who = await seedMember({ role })
      const added = await invoke(docPost, {
        method: 'POST', as: who, aal: 'aal1',
        body: { category: 'minutes', title: 'September board meeting', content: '<p>Notes</p>', year: 2026 },
      })
      expect(added.status).toBe(201)
      const { document } = await added.json<{ document: { id: string } }>()

      const edited = await invoke(docPut, {
        method: 'PUT', as: who, aal: 'aal1', params: { id: document.id },
        body: { category: 'minutes', title: 'September board meeting (approved)', content: '<p>Notes</p>' },
      })
      expect(edited.status).toBe(200)

      const removed = await invoke(docDelete, { method: 'DELETE', as: who, aal: 'aal1', params: { id: document.id } })
      expect(removed.status).toBe(200)

      const { results } = await env.DB.prepare(
        `SELECT action FROM admin_audit_log WHERE actor_id = ? ORDER BY rowid`,
      ).bind(who).all<{ action: string }>()
      expect((results ?? []).map((r) => r.action)).toEqual(['document_add', 'document_edit', 'document_remove'])
    })
  }

  it('is refused to ordinary members and club reps', async () => {
    for (const role of ['member', 'club_rep', 'lca_auditor']) {
      const who = await seedMember({ role })
      const res = await invoke(docPost, {
        method: 'POST', as: who,
        body: { category: 'bylaws', title: 'Nope' },
      })
      expect(res.status).toBe(403)
    }
  })
})

async function regionalSeat(role = 'Test Region Representative', category = 'regional_rep'): Promise<string> {
  const id = `seat-${crypto.randomUUID().slice(0, 8)}`
  await env.DB.prepare(
    `INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active)
     VALUES (?, ?, '', 99, ?, ?, 1)`,
  ).bind(id, role, id, category).run()
  return id
}

async function hold(seatId: string, memberId: string) {
  await env.DB.prepare(
    'INSERT INTO board_seat_assignments (seat_id, member_id) VALUES (?, ?)',
  ).bind(seatId, memberId).run()
}

async function clubIn(region: string | null): Promise<string> {
  const id = await seedClub()
  await env.DB.prepare('UPDATE clubs SET region = ? WHERE id = ?').bind(region, id).run()
  return id
}

describe('regional representatives', () => {
  it('manage every club in the regions their seat covers, and only those', async () => {
    const admin = await seedAdmin()
    const rep = await seedMember()
    const seat = await regionalSeat()
    await hold(seat, rep)

    const set = await invoke(seatRegionsPut, {
      method: 'PUT', as: admin, body: { seatId: seat, regions: ['Bayou Region', 'South Central Louisiana'] },
    })
    expect(set.status).toBe(200)

    const bayou = await clubIn('Bayou Region')
    const southCentral = await clubIn('South Central Louisiana')
    const elsewhere = await clubIn('North Louisiana')
    const noRegion = await clubIn(null)

    for (const clubId of [bayou, southCentral]) {
      expect((await invoke(clubGet, { as: rep, aal: 'aal1', params: { id: clubId } })).status).toBe(200)
      const edit = await invoke(clubPatch, { method: 'PATCH', as: rep, aal: 'aal1', params: { id: clubId }, body: { description: 'Updated by the region' } })
      expect(edit.status).toBe(200)
    }
    for (const clubId of [elsewhere, noRegion]) {
      expect((await invoke(clubGet, { as: rep, params: { id: clubId } })).status).toBe(403)
      expect((await invoke(clubPatch, { method: 'PATCH', as: rep, params: { id: clubId }, body: { description: 'Nope' } })).status).toBe(403)
    }

    // Name and region stay with admins, so a rep can't move a club out of
    // (or into) their region.
    const move = await invoke(clubPatch, { method: 'PATCH', as: rep, params: { id: bayou }, body: { region: 'North Louisiana' } })
    expect(move.status).toBe(403)

    const mine = await invoke(mySeatsGet, { as: rep })
    const body = await mine.json<{ seats: { id: string; regions: string[] }[]; managedClubs: { id: string }[] }>()
    expect(body.seats[0].regions).toEqual(['Bayou Region', 'South Central Louisiana'])
    expect(body.managedClubs.map((c) => c.id).sort()).toEqual([bayou, southCentral].sort())

    // The member's own account is untouched by the seat.
    const row = await env.DB.prepare('SELECT role, club_id FROM members WHERE id = ?').bind(rep).first<{ role: string; club_id: string | null }>()
    expect(row?.role).toBe('member')
    expect(row?.club_id).toBeNull()
  })

  it('lose access the moment their term ends', async () => {
    const rep = await seedMember()
    const seat = await regionalSeat()
    await hold(seat, rep)
    await env.DB.prepare("INSERT INTO seat_regions (seat_id, region) VALUES (?, 'Bayou Region')").bind(seat).run()
    const club = await clubIn('Bayou Region')
    expect((await invoke(clubGet, { as: rep, params: { id: club } })).status).toBe(200)

    await env.DB.prepare("UPDATE board_seat_assignments SET ended_at = datetime('now') WHERE seat_id = ?").bind(seat).run()
    expect((await invoke(clubGet, { as: rep, params: { id: club } })).status).toBe(403)
  })

  it('only covers regions for regional seats, and only admins set them', async () => {
    const admin = await seedAdmin()
    const officerSeat = await regionalSeat('Test Treasurer', 'officer')
    const res = await invoke(seatRegionsPut, { method: 'PUT', as: admin, body: { seatId: officerSeat, regions: ['Bayou Region'] } })
    expect(res.status).toBe(400)

    const seat = await regionalSeat()
    const bad = await invoke(seatRegionsPut, { method: 'PUT', as: admin, body: { seatId: seat, regions: ['Atlantis'] } })
    expect(bad.status).toBe(400)

    for (const role of ['lca_observer', 'lca_officer', 'club_rep']) {
      const who = await seedMember({ role })
      const denied = await invoke(seatRegionsPut, { method: 'PUT', as: who, body: { seatId: seat, regions: ['Bayou Region'] } })
      expect(denied.status).toBe(403)
    }
  })
})
