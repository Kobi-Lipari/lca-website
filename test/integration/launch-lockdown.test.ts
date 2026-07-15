// test/integration/launch-lockdown.test.ts
// Pins two deliberate pre-launch behaviors:
//   1. Tournament creation is lca_admin-only (club_rep path temporarily disabled).
//      When the lockdown is lifted, the first test fails on purpose — update it then.
//   2. PATCHing membershipExpiry without a status derives the status from the date.
import { describe, it, expect } from 'vitest'
import { invoke } from './harness'
import { seedAdmin, seedClub, seedMember } from './factories'

import { onRequestPost as createTournament } from '../../functions/api/admin/tournaments'
import { onRequestPatch as patchMembership } from '../../functions/api/admin/members/[id]/membership'

const tournamentBody = (clubId?: string) => ({
  name: 'Lockdown Probe Open',
  location: 'Kenner, LA',
  date: '2026-10-10',
  entryFee: 20,
  ...(clubId ? { clubId } : {}),
})

describe('launch lockdown: tournament creation', () => {
  it('club_rep cannot create tournaments during launch lockdown', async () => {
    const clubId = await seedClub()
    const repId = await seedMember({ role: 'club_rep', clubId })
    const res = await invoke(createTournament, {
      method: 'POST',
      as: repId,
      body: tournamentBody(clubId),
    })
    expect(res.status).toBe(403)
  })

  it('plain member cannot create tournaments', async () => {
    const memberId = await seedMember()
    const res = await invoke(createTournament, {
      method: 'POST',
      as: memberId,
      body: tournamentBody(),
    })
    expect(res.status).toBe(403)
  })

  it('lca_admin can still create tournaments', async () => {
    const adminId = await seedAdmin()
    const res = await invoke(createTournament, {
      method: 'POST',
      as: adminId,
      body: tournamentBody(),
    })
    expect(res.status).toBe(201)
  })
})

describe('membership PATCH derives status from expiry', () => {
  it('setting a past expiry with no status flips status to expired', async () => {
    const adminId = await seedAdmin()
    const memberId = await seedMember({ membershipStatus: 'active' })
    const res = await invoke(patchMembership, {
      method: 'PATCH',
      as: adminId,
      params: { id: memberId },
      body: { membershipExpiry: '2024-01-01' },
    })
    expect(res.status).toBe(200)
    const { member: updated } = (await res.json()) as { member: { membership_status: string } }
    expect(updated.membership_status).toBe('expired')
  })

  it('setting a future expiry with no status flips status to active', async () => {
    const adminId = await seedAdmin()
    const memberId = await seedMember({ membershipStatus: 'expired' })
    const res = await invoke(patchMembership, {
      method: 'PATCH',
      as: adminId,
      params: { id: memberId },
      body: { membershipExpiry: '2030-01-01' },
    })
    expect(res.status).toBe(200)
    const { member: updated } = (await res.json()) as { member: { membership_status: string } }
    expect(updated.membership_status).toBe('active')
  })

  it('an explicit status wins over the derived one', async () => {
    const adminId = await seedAdmin()
    const memberId = await seedMember({ membershipStatus: 'active' })
    const res = await invoke(patchMembership, {
      method: 'PATCH',
      as: adminId,
      params: { id: memberId },
      body: { membershipExpiry: '2030-01-01', membershipStatus: 'pending' },
    })
    expect(res.status).toBe(200)
    const { member: updated } = (await res.json()) as { member: { membership_status: string } }
    expect(updated.membership_status).toBe('pending')
  })
})