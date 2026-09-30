// test/integration/observer.test.ts
// LCA Observer: sees what an admin sees, can send group email, email
// entrants and answer tickets, and cannot change anything else. No 2FA.
import { beforeEach, describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import { invoke, resetHarness } from './harness'
import { seedClub, seedMember, seedRegistration, seedTournament } from './factories'

import { onRequestGet as membersGet } from '../../functions/api/admin/members'
import { onRequestPatch as rolePatch } from '../../functions/api/admin/members/[id]/role'
import { onRequestDelete as memberDelete } from '../../functions/api/admin/members/[id]'
import { onRequestGet as auditGet } from '../../functions/api/admin/audit'
import { onRequestGet as tournamentsGet } from '../../functions/api/tournaments'
import { onRequestGet as manageGet } from '../../functions/api/admin/tournaments/[id]/manage'
import { onRequestPatch as tournamentPatch } from '../../functions/api/admin/tournaments/[id]'
import { onRequestPost as announcePost } from '../../functions/api/admin/tournaments/[id]/announce'
import { onRequestGet as clubGet, onRequestPatch as clubPatch } from '../../functions/api/admin/clubs/[id]'
import { onRequestPost as postsPost } from '../../functions/api/admin/posts'
import { onRequestPost as campaignsPost } from '../../functions/api/admin/campaigns'
import { onRequestPost as supportPost } from '../../functions/api/support'
import { onRequestGet as ticketsGet } from '../../functions/api/admin/support'
import {
  onRequestPost as ticketReply,
  onRequestDelete as ticketDelete,
} from '../../functions/api/admin/support/[id]'
import { onRequestPost as impersonate } from '../../functions/api/admin/impersonate/[memberId]'

beforeEach(resetHarness)

const observer = () => seedMember({ role: 'lca_observer' })

describe('LCA Observer can see everything, without 2FA', () => {
  it('reads the full member table, the activity log, drafts, and event and club management views', async () => {
    const who = await observer()
    const members = await invoke(membersGet, { as: who, aal: 'aal1' })
    expect(members.status).toBe(200)
    const { members: rows } = await members.json<{ members: Array<Record<string, unknown>> }>()
    expect(rows[0]).toHaveProperty('role')

    expect((await invoke(auditGet, { as: who, aal: 'aal1', path: '/api/admin/audit' })).status).toBe(200)

    const clubId = await seedClub()
    const draft = await seedTournament({ clubId, isVisible: false })
    const list = await invoke(tournamentsGet, { as: who, aal: 'aal1' })
    const { tournaments } = await list.json<{ tournaments: { id: string }[] }>()
    expect(tournaments.map((t) => t.id)).toContain(draft)

    expect((await invoke(manageGet, { as: who, aal: 'aal1', params: { id: draft } })).status).toBe(200)
    expect((await invoke(clubGet, { as: who, aal: 'aal1', params: { id: clubId } })).status).toBe(200)
  })
})

describe('LCA Observer cannot change things', () => {
  it('is refused on roles, deletions, events, clubs, news and logging in as someone', async () => {
    const who = await observer()
    const target = await seedMember()
    const clubId = await seedClub()
    const tournamentId = await seedTournament({ clubId })

    const attempts = [
      await invoke(rolePatch, { method: 'PATCH', as: who, params: { id: target }, body: { role: 'lca_admin' } }),
      await invoke(rolePatch, { method: 'PATCH', as: who, params: { id: who }, body: { role: 'lca_admin' } }),
      await invoke(memberDelete, { method: 'DELETE', as: who, params: { id: target } }),
      await invoke(tournamentPatch, { method: 'PATCH', as: who, params: { id: tournamentId }, body: { name: 'Nope' } }),
      await invoke(clubPatch, { method: 'PATCH', as: who, params: { id: clubId }, body: { description: 'Nope' } }),
      await invoke(postsPost, { method: 'POST', as: who, body: { title: 'Nope', body: 'x' } }),
      await invoke(impersonate, { method: 'POST', as: who, params: { memberId: target } }),
    ]
    for (const res of attempts) expect(res.status).toBe(403)

    const role = await env.DB.prepare('SELECT role FROM members WHERE id = ?').bind(who).first<{ role: string }>()
    expect(role?.role).toBe('lca_observer')
  })
})

describe('LCA Observer can use the communication tools', () => {
  it('sends group email (logged under their name)', async () => {
    const who = await observer()
    await seedMember({ email: 'someone@example.org' })
    const res = await invoke(campaignsPost, {
      method: 'POST', as: who, aal: 'aal1',
      body: { subject: 'Hello', bodyHtml: '<p>Hi</p>', filter: { all: true } },
    })
    expect(res.status).toBe(201)
    const log = await env.DB.prepare(
      `SELECT actor_id FROM admin_audit_log WHERE action = 'group_email_sent'`,
    ).first<{ actor_id: string }>()
    expect(log?.actor_id).toBe(who)
  })

  it('emails a tournament’s entrants', async () => {
    const who = await observer()
    const tournamentId = await seedTournament()
    await seedRegistration({ tournamentId, memberId: await seedMember() })
    const res = await invoke(announcePost, {
      method: 'POST', as: who, params: { id: tournamentId },
      body: { subject: 'Parking', body: 'Use the north lot.' },
    })
    expect(res.status).toBe(200)
  })

  it('reads and answers support tickets, but cannot delete them', async () => {
    const who = await observer()
    const created = await invoke(supportPost, {
      method: 'POST', body: { name: 'A', email: 'a@example.org', subject: 'Question', body: 'Hi' },
    })
    const { ticketId } = await created.json<{ ticketId: string }>()

    expect((await invoke(ticketsGet, { as: who, aal: 'aal1', path: '/api/admin/support' })).status).toBe(200)
    const reply = await invoke(ticketReply, { method: 'POST', as: who, params: { id: ticketId }, body: { body: 'Happy to help.' } })
    expect(reply.status).toBe(201)
    const del = await invoke(ticketDelete, { method: 'DELETE', as: who, params: { id: ticketId } })
    expect(del.status).toBe(403)
  })
})
