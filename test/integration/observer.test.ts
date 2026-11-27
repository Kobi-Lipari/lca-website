// test/integration/observer.test.ts
// LCA Observer: sees what an admin sees, can email entrants and answer
// tickets, and cannot change anything else. No 2FA. Group email is for the
// observer who holds the President seat alone, with or without a second
// factor as the rule ships; PRESIDENT_NEEDS_SECOND_FACTOR is read through a
// getter on the mocked domain/mail/senders, so one case holds the refusal
// while it is set.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { env } from 'cloudflare:test'
import { invoke, resetHarness } from './harness'
import { seedClub, seedMember, seedPresident, seedRegistration, seedTournament } from './factories'
import { LIST_MAILERS_ONLY, MEDIA_MANAGER_SECOND_FACTOR } from '../../functions/utils/auth'

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

/** The president's second-factor constant: null reads the real one (it ships unset); the case that holds the old refusal sets it. */
const turned = vi.hoisted(() => ({ president: null as boolean | null }))
vi.mock('../../domain/mail/senders', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../domain/mail/senders')>()
  return {
    ...real,
    get PRESIDENT_NEEDS_SECOND_FACTOR() {
      return turned.president ?? real.PRESIDENT_NEEDS_SECOND_FACTOR
    },
  }
})

beforeEach(() => {
  resetHarness()
  turned.president = null
})

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
  it('is refused group email without the President seat, and nothing is logged', async () => {
    const who = await observer()
    await seedMember({ email: 'someone@example.org' })
    const res = await invoke(campaignsPost, {
      method: 'POST', as: who, aal: 'aal1',
      body: { subject: 'Hello', bodyHtml: '<p>Hi</p>', filter: { all: true } },
    })
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: LIST_MAILERS_ONLY })
    const log = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM admin_audit_log WHERE action = 'group_email_sent' AND actor_id = ?`,
    ).bind(who).first<{ n: number }>()
    expect(log?.n).toBe(0)
  })

  it('sends group email while holding the President seat with a second factor (logged under their name)', async () => {
    const who = await observer()
    await seedPresident(who)
    await seedMember({ email: 'someone@example.org' })
    const res = await invoke(campaignsPost, {
      method: 'POST', as: who, aal: 'aal2',
      body: { subject: 'Hello', bodyHtml: '<p>Hi</p>', filter: { all: true } },
    })
    expect(res.status).toBe(201)
    const log = await env.DB.prepare(
      `SELECT actor_id FROM admin_audit_log WHERE action = 'group_email_sent'`,
    ).first<{ actor_id: string }>()
    expect(log?.actor_id).toBe(who)
  })

  it('sends group email while holding the President seat without a second factor, as the rule ships (logged under their name)', async () => {
    const who = await observer()
    await seedPresident(who)
    await seedMember({ email: 'someone@example.org' })
    const res = await invoke(campaignsPost, {
      method: 'POST', as: who, aal: 'aal1',
      body: { subject: 'Hello', bodyHtml: '<p>Hi</p>', filter: { all: true } },
    })
    expect(res.status).toBe(201)
    // The log is not cleared between cases, so the row is read by this case's own sender.
    const log = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM admin_audit_log WHERE action = 'group_email_sent' AND actor_id = ?`,
    ).bind(who).first<{ n: number }>()
    expect(log?.n).toBe(1)
  })

  it('with PRESIDENT_NEEDS_SECOND_FACTOR set, holding the President seat without a second factor is asked for one, and nothing is logged', async () => {
    turned.president = true
    const who = await observer()
    await seedPresident(who)
    await seedMember({ email: 'someone@example.org' })
    const res = await invoke(campaignsPost, {
      method: 'POST', as: who, aal: 'aal1',
      body: { subject: 'Hello', bodyHtml: '<p>Hi</p>', filter: { all: true } },
    })
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: MEDIA_MANAGER_SECOND_FACTOR, mfaRequired: true })
    const log = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM admin_audit_log WHERE action = 'group_email_sent' AND actor_id = ?`,
    ).bind(who).first<{ n: number }>()
    expect(log?.n).toBe(0)
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
