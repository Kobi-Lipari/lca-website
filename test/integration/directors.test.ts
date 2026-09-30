// test/integration/directors.test.ts
// Covers the directors endpoint: who may assign, listing, and removal.
// Assigning or removing a director never changes anyone's role: the
// assignment is access to that one event.
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
import { onRequestPatch as tournamentPatch } from '../../functions/api/admin/tournaments/[id]'
import { onRequestGet as membersGet } from '../../functions/api/admin/members'

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

  it('assigning an ordinary member gives them that event, not a new role', async () => {
    const club = await seedClub()
    const rep = await seedMember({ role: 'club_rep', clubId: club })
    const helper = await seedMember()
    const tournamentId = await seedTournament({ clubId: club })
    const otherEvent = await seedTournament({ clubId: club })

    const res = await invoke(assignDirector, {
      method: 'POST', as: rep, params: { id: tournamentId }, body: { memberId: helper },
    })
    expect(res.status).toBe(201)

    const row = await env.DB.prepare('SELECT role FROM members WHERE id = ?')
      .bind(helper).first<{ role: string }>()
    expect(row?.role).toBe('member')

    // They can run this event…
    const edit = await invoke(tournamentPatch, {
      method: 'PATCH', as: helper, params: { id: tournamentId }, body: { name: 'Renamed by helper' },
    })
    expect(edit.status).toBe(200)
    // …but not another one, not the member directory, and they can't hand out access.
    const other = await invoke(tournamentPatch, {
      method: 'PATCH', as: helper, params: { id: otherEvent }, body: { name: 'Nope' },
    })
    expect(other.status).toBe(403)
    expect((await invoke(membersGet, { as: helper })).status).toBe(403)
    const assign = await invoke(assignDirector, {
      method: 'POST', as: helper, params: { id: tournamentId }, body: { memberId: await seedMember() },
    })
    expect(assign.status).toBe(403)

    const log = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM admin_audit_log WHERE action = 'director_assign' AND target_member_id = ?`,
    ).bind(helper).first<{ n: number }>()
    expect(log?.n).toBe(1)
  })

  it('removing a director leaves their role alone', async () => {
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
    expect(row?.role).toBe('tournament_director')
  })
})
