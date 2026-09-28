// test/integration/tournament-create.test.ts
// (Formerly launch-lockdown.test.ts — the lockdown that kept tournament
// creation to lca_admin was lifted when clubs were given access.)
//   1. Who may create tournaments, and for which club.
//   2. PATCHing membershipExpiry without a status derives the status from the date.
import { describe, it, expect } from 'vitest'
import { env } from 'cloudflare:test'
import { invoke } from './harness'
import { seedAdmin, seedClub, seedMember } from './factories'

import { onRequestPost as createTournament } from '../../functions/api/admin/tournaments'
import { onRequestPatch as patchMembership } from '../../functions/api/admin/members/[id]/membership'

const tournamentBody = (clubId?: string) => ({
  name: 'Club Probe Open',
  location: 'Kenner, LA',
  date: '2026-10-10',
  entryFee: 20,
  ...(clubId ? { clubId } : {}),
})

async function clubOf(tournamentId: string) {
  const row = await env.DB.prepare('SELECT club_id, is_visible FROM tournaments WHERE id = ?')
    .bind(tournamentId).first<{ club_id: string | null; is_visible: number }>()
  return row
}

describe('tournament creation', () => {
  it('club_rep creates a hidden draft owned by their own club', async () => {
    const clubId = await seedClub()
    const repId = await seedMember({ role: 'club_rep', clubId })
    const res = await invoke(createTournament, { method: 'POST', as: repId, body: tournamentBody() })
    expect(res.status).toBe(201)
    const { tournament } = await res.json<{ tournament: { id: string } }>()
    const row = await clubOf(tournament.id)
    expect(row?.club_id).toBe(clubId)
    expect(row?.is_visible).toBe(0)
  })

  it('club_rep cannot create for another club', async () => {
    const own = await seedClub()
    const other = await seedClub()
    const repId = await seedMember({ role: 'club_rep', clubId: own })
    const res = await invoke(createTournament, { method: 'POST', as: repId, body: tournamentBody(other) })
    expect(res.status).toBe(403)
  })

  it('club_rep with no club is refused rather than creating an orphan', async () => {
    const repId = await seedMember({ role: 'club_rep' })
    const res = await invoke(createTournament, { method: 'POST', as: repId, body: tournamentBody() })
    expect(res.status).toBe(403)
  })

  it('tournament directors and plain members cannot create tournaments', async () => {
    for (const role of ['member', 'tournament_director', 'lca_auditor']) {
      const id = await seedMember({ role })
      const res = await invoke(createTournament, { method: 'POST', as: id, body: tournamentBody() })
      expect(res.status).toBe(403)
    }
  })

  it('lca_admin can create for any club, and saves time control and close time', async () => {
    const adminId = await seedAdmin()
    const clubId = await seedClub()
    const res = await invoke(createTournament, {
      method: 'POST',
      as: adminId,
      body: {
        ...tournamentBody(clubId),
        timeControl: 'G/60+5',
        registrationClosesAt: '2026-10-09T18:00',
        customDetails: [{ title: 'Parking', body: 'Free in the back lot' }],
      },
    })
    expect(res.status).toBe(201)
    const { tournament } = await res.json<{
      tournament: { id: string; club_id: string; time_control: string; registration_closes_at: string; custom_details: string }
    }>()
    expect(tournament.club_id).toBe(clubId)
    expect(tournament.time_control).toBe('G/60+5')
    expect(tournament.registration_closes_at).toBe('2026-10-09T18:00')
    expect(JSON.parse(tournament.custom_details)).toHaveLength(1)
  })

  it('a club_rep cannot choose a custom tournament id', async () => {
    const clubId = await seedClub()
    const repId = await seedMember({ role: 'club_rep', clubId })
    const res = await invoke(createTournament, {
      method: 'POST', as: repId, body: { ...tournamentBody(), id: 'hand-picked-id' },
    })
    expect(res.status).toBe(201)
    const { tournament } = await res.json<{ tournament: { id: string } }>()
    expect(tournament.id).not.toBe('hand-picked-id')
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