// test/integration/uschess-membership.test.ts
// Adding a US Chess ID looks it up right away, so the dashboard can show
// the US Chess membership expiry (and a renew button) without waiting for
// the nightly check.
import { beforeEach, describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import { invoke, resetHarness, uscfBehavior } from './harness'
import { seedMember } from './factories'
import { onRequestPatch as mePatch } from '../../functions/api/me'
import { onRequestPost as childrenPost } from '../../functions/api/me/children'

beforeEach(resetHarness)

const rated = (expirationDate: string) => ({
  ratings: [{ ratingSystem: 'R', rating: 1432, gamesPlayed: 20, isProvisional: false }],
  expirationDate,
}) as unknown as { ratings: unknown[] }

describe('US Chess membership expiry', () => {
  it('is filled in as soon as a member adds their ID', async () => {
    const me = await seedMember()
    uscfBehavior.members['12345678'] = rated('2027-03-31')
    const res = await invoke(mePatch, { method: 'PATCH', as: me, body: { uscfId: '12345678' } })
    expect(res.status).toBe(200)
    const { member } = await res.json<{ member: { uscf_expiration: string; uscf_rating: number } }>()
    expect(member.uscf_expiration).toBe('2027-03-31')
    expect(member.uscf_rating).toBe(1432)
  })

  it('does not fail the save when US Chess is down', async () => {
    const me = await seedMember()
    uscfBehavior.reachable = false
    const res = await invoke(mePatch, { method: 'PATCH', as: me, body: { uscfId: '23456789' } })
    expect(res.status).toBe(200)
    const row = await env.DB.prepare('SELECT uscf_id, uscf_expiration FROM members WHERE id = ?').bind(me).first()
    expect(row).toMatchObject({ uscf_id: '23456789', uscf_expiration: null })
  })

  it('is filled in for a child added with an ID', async () => {
    const parent = await seedMember()
    uscfBehavior.members['45678912'] = rated('2026-12-31')
    const res = await invoke(childrenPost, { method: 'POST', as: parent, body: { fullName: 'Kid Player', uscfId: '45678912' } })
    expect(res.status).toBe(201)
    const { children } = await res.json<{ children: Array<{ uscf_expiration: string | null }> }>()
    expect(children[0].uscf_expiration).toBe('2026-12-31')
  })
})
