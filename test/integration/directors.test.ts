// test/integration/directors.test.ts
// Covers the directors endpoint: who may assign, listing, and removal
// (including the demote-when-last-tournament mirror of the auto-promote).
//
// Note: tests deliberately assign members who already hold the
// tournament_director role, so the POST promote path (which calls
// syncSupabaseUserMetadata against a Supabase admin endpoint the harness
// does not implement) is not exercised here. The DELETE demote path IS
// exercised — its metadata sync is wrapped best-effort in the handler.
import { describe, it, expect } from 'vitest'
import { env } from 'cloudflare:test'
import { invoke } from './harness'
import {
  seedAdmin,
  seedClub,
  seedDirector,
  seedMember,
  seedTournament,
  seedTournamentDirector,
} from './factories'

import {
  onRequestGet as getDirectors,
  onRequestPost as assignDirector,
  onRequestDelete as removeDirector,
} from '../../functions/api/admin/tournaments/[id]/directors'

describe('tournament directors', () => {
  it('admin can assign a director; list reflects it', async () => {
    const adminId = await seedAdmin()
    const tdId = await seedDirector()
    const tournamentId = await seedTournament()

    const res = await invoke(assignDirector, {
      method: 'POST',
      as: adminId,
      params: { id: tournamentId },
      body: { memberId: tdId },
    })
    expect(res.status).toBe(201)
    const { directors } = (await res.json()) as { directors: Array<{ member_id: string }> }
    expect(directors.map((d) => d.member_id)).toContain(tdId)

    const list = await invoke(getDirectors, {
      method: 'GET',
      as: adminId,
      params: { id: tournamentId },
    })
    expect(list.status).toBe(200)
    const listed = (await list.json()) as { directors: Array<{ member_id: string }> }
    expect(listed.directors.map((d) => d.member_id)).toContain(tdId)
  })

  it('club_rep of a different club cannot assign', async () => {
    const clubA = await seedClub()
    const clubB = await seedClub()
    const repB = await seedMember({ role: 'club_rep', clubId: clubB })
    const tdId = await seedDirector()
    const tournamentId = await seedTournament({ clubId: clubA })

    const res = await invoke(assignDirector, {
      method: 'POST',
      as: repB,
      params: { id: tournamentId },
      body: { memberId: tdId },
    })
    expect(res.status).toBe(403)
  })

  it('club_rep of the tournament club CAN assign', async () => {
    const club = await seedClub()
    const rep = await seedMember({ role: 'club_rep', clubId: club })
    const tdId = await seedDirector()
    const tournamentId = await seedTournament({ clubId: club })

    const res = await invoke(assignDirector, {
      method: 'POST',
      as: rep,
      params: { id: tournamentId },
      body: { memberId: tdId },
    })
    expect(res.status).toBe(201)
  })

  it('a tournament director cannot assign other directors', async () => {
    const tdId = await seedDirector()
    const otherTdId = await seedDirector()
    const tournamentId = await seedTournament()
    await seedTournamentDirector(tournamentId, tdId)

    const res = await invoke(assignDirector, {
      method: 'POST',
      as: tdId,
      params: { id: tournamentId },
      body: { memberId: otherTdId },
    })
    expect(res.status).toBe(403)
  })

  it('plain member cannot list directors', async () => {
    const memberId = await seedMember()
    const tournamentId = await seedTournament()

    const res = await invoke(getDirectors, {
      method: 'GET',
      as: memberId,
      params: { id: tournamentId },
    })
    expect(res.status).toBe(403)
  })

  it('removing a director demotes them when it was their last tournament', async () => {
    const adminId = await seedAdmin()
    const tdId = await seedDirector()
    const tournamentId = await seedTournament()
    await seedTournamentDirector(tournamentId, tdId)

    const res = await invoke(removeDirector, {
      method: 'DELETE',
      as: adminId,
      params: { id: tournamentId },
      body: { memberId: tdId },
    })
    expect(res.status).toBe(200)
    const { directors } = (await res.json()) as { directors: Array<{ member_id: string }> }
    expect(directors.map((d) => d.member_id)).not.toContain(tdId)

    const row = await env.DB.prepare('SELECT role FROM members WHERE id = ?')
      .bind(tdId)
      .first<{ role: string }>()
    expect(row?.role).toBe('member')
  })

  it('removing a director does NOT demote them while they direct another tournament', async () => {
    const adminId = await seedAdmin()
    const tdId = await seedDirector()
    const t1 = await seedTournament()
    const t2 = await seedTournament()
    await seedTournamentDirector(t1, tdId)
    await seedTournamentDirector(t2, tdId)

    const res = await invoke(removeDirector, {
      method: 'DELETE',
      as: adminId,
      params: { id: t1 },
      body: { memberId: tdId },
    })
    expect(res.status).toBe(200)

    const row = await env.DB.prepare('SELECT role FROM members WHERE id = ?')
      .bind(tdId)
      .first<{ role: string }>()
    expect(row?.role).toBe('tournament_director')
  })
})
