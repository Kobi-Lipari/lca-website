// test/integration/foundation.test.ts
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { invoke, resetHarness, stripeSessions } from './harness'
import { seedAdmin, seedMember, seedTournament } from './factories'

import { onRequestGet as adminMembersGet } from '../../functions/api/admin/members'
import { onRequestGet as tournamentsGet } from '../../functions/api/tournaments'
import { onRequestPost as registrationsPost } from '../../functions/api/registrations'

beforeEach(resetHarness)

describe('foundation: migrations + harness', () => {
  it('applied the schema (core tables exist)', async () => {
    const tables = await env.DB.prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table'`,
    ).all<{ name: string }>()
    const names = tables.results.map((t) => t.name)
    for (const expected of ['members', 'tournaments', 'registrations', 'payments', 'clubs']) {
      expect(names).toContain(expected)
    }
  })

  it('auth: anonymous request to admin endpoint is rejected', async () => {
    const { status } = await invoke(adminMembersGet)
    expect(status).toBe(401)
  })

  it('auth: plain member is forbidden from admin endpoint', async () => {
    const memberId = await seedMember()
    const { status } = await invoke(adminMembersGet, { as: memberId })
    expect(status).toBe(403)
  })

  it('auth: admin passes, and guest members are filtered out', async () => {
    const adminId = await seedAdmin()
    const regularId = await seedMember()
    // NOTE: this insert is also our canary for the members.role CHECK
    // constraint — if 0003 didn't widen it, this line throws and we've
    // confirmed the walk-in launch blocker.
    await seedMember({ role: 'guest', email: 'g1@walkin.lca.invalid' })

    const { status, json } = await invoke(adminMembersGet, { as: adminId })
    expect(status).toBe(200)
    const { members } = await json()
    const ids = members.map((m: { id: string }) => m.id)
    expect(ids).toContain(regularId)
    expect(ids).toContain(adminId)
    expect(members.every((m: { role: string }) => m.role !== 'guest')).toBe(true)
  })

  it('visibility: public list hides is_visible = 0, admin list shows it', async () => {
    const adminId = await seedAdmin()
    const hidden = await seedTournament({ isVisible: false, name: 'Hidden Test Event' })
    const shown = await seedTournament({ name: 'Public Event' })

    const publicRes = await invoke(tournamentsGet)
    const publicIds = (await publicRes.json()).tournaments.map((t: { id: string }) => t.id)
    expect(publicIds).toContain(shown)
    expect(publicIds).not.toContain(hidden)

    const adminRes = await invoke(tournamentsGet, { as: adminId })
    const adminIds = (await adminRes.json()).tournaments.map((t: { id: string }) => t.id)
    expect(adminIds).toContain(hidden)
  })

  it('end-to-end slice: paid registration creates a real-shaped Stripe session', async () => {
    const memberId = await seedMember()
    const tournamentId = await seedTournament({
      sections: [{ name: 'Open', entryFee: 30 }],
    })

    const { status, json } = await invoke(registrationsPost, {
      method: 'POST',
      as: memberId,
      body: { tournamentId, section: 'Open' },
    })

    expect(status).toBe(201)
    const data = await json()
    expect(data.paymentUrl).toMatch(/^https:\/\/checkout\.stripe\.test\//)

    expect(stripeSessions).toHaveLength(1)
    const session = stripeSessions[0]
    expect(session.amountCents).toBe(3000) // server-priced from section fee
    expect(session.metadata.type).toBe('tournament')
    expect(session.metadata.registration_id).toBeTruthy()

    const reg = await env.DB.prepare(
      'SELECT payment_status FROM registrations WHERE id = ?',
    ).bind(session.metadata.registration_id).first<{ payment_status: string }>()
    expect(reg?.payment_status).toBe('pending')
  })
})