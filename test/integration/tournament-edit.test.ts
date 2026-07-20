// test/integration/tournament-edit.test.ts
//
// Covers the tournament edit/delete surface behind the redesigned manage page:
//  1. PATCH partial-update pinning — a body with only {name} must not touch
//     date/sections/visibility (the expiry-wipe bug class).
//  2. PATCH {isVisible:false} leaves name; PATCH {sections} replaces sections.
//  3. requireTournamentManager: assigned TD can PATCH; plain member 403;
//     TD of a DIFFERENT tournament 403.
//  4. DELETE: admin succeeds and cascades (registrations/games/directors gone);
//     TD gets 403 and nothing is deleted.
//
// Conventions per harness: invoke(handler, {method, params, body, as, ...});
// factories return id strings; auth token convention is `Bearer <member_id>`
// (the `as` option). If a factory signature here differs from factories.ts,
// adjust the seed call only — the assertions are signature-independent.

import { describe, it, expect } from 'vitest'
import { env } from 'cloudflare:test'

import { invoke } from './harness'
import {
  seedAdmin,
  seedMember,
  seedDirector,
  seedTournament,
  seedTournamentDirector,
  seedRegistration,
} from './factories'

import {
  onRequestPatch,
  onRequestDelete,
} from '../../functions/api/admin/tournaments/[id]'

async function getTournamentRow(id: string) {
  return env.DB.prepare('SELECT * FROM tournaments WHERE id = ?')
    .bind(id)
    .first<Record<string, unknown>>()
}

async function countRows(table: string, tournamentId: string): Promise<number> {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM ${table} WHERE tournament_id = ?`,
  ).bind(tournamentId).first<{ n: number }>()
  return row?.n ?? 0
}

/** Insert a game row directly — no seedGame factory exists. If tournament_games
 *  has additional NOT NULL columns without defaults, extend the column list. */
async function insertGame(tournamentId: string, whiteMemberId: string) {
  await env.DB.prepare(
    `INSERT INTO tournament_games
       (id, tournament_id, round, board, section, white_member_id, black_member_id, result)
     VALUES (?, ?, 1, 1, 'Open', ?, NULL, 'bye')`,
  ).bind(crypto.randomUUID(), tournamentId, whiteMemberId).run()
}

describe('tournament PATCH — partial-update pinning', () => {
  it('PATCH {name} only leaves date, sections, and visibility unchanged', async () => {
    const adminId = await seedAdmin()
    const tournamentId = await seedTournament()

    const before = await getTournamentRow(tournamentId)
    expect(before).toBeTruthy()

    const res = await invoke(onRequestPatch, {
      method: 'PATCH',
      params: { id: tournamentId },
      body: { name: 'Renamed Open' },
      as: adminId,
    })
    expect(res.status).toBe(200)

    const after = await getTournamentRow(tournamentId)
    expect(after!.name).toBe('Renamed Open')
    expect(after!.date).toBe(before!.date)
    expect(after!.sections).toBe(before!.sections)
    expect(after!.is_visible).toBe(before!.is_visible)
    expect(after!.is_rated).toBe(before!.is_rated)
    expect(after!.registration_closes_at).toBe(before!.registration_closes_at)
  })

  it('PATCH {isVisible:false} only flips visibility and leaves name unchanged', async () => {
    const adminId = await seedAdmin()
    const tournamentId = await seedTournament()

    const before = await getTournamentRow(tournamentId)

    const res = await invoke(onRequestPatch, {
      method: 'PATCH',
      params: { id: tournamentId },
      body: { isVisible: false },
      as: adminId,
    })
    expect(res.status).toBe(200)

    const after = await getTournamentRow(tournamentId)
    expect(after!.is_visible).toBe(0)
    expect(after!.name).toBe(before!.name)
    expect(after!.date).toBe(before!.date)
  })

  it('PATCH {sections} replaces sections and leaves everything else unchanged', async () => {
    const adminId = await seedAdmin()
    const tournamentId = await seedTournament()

    const before = await getTournamentRow(tournamentId)
    const newSections = [
      { name: 'Open', entryFee: 40, prizeFund: '$700' },
      { name: 'U1400', entryFee: 30 },
    ]

    const res = await invoke(onRequestPatch, {
      method: 'PATCH',
      params: { id: tournamentId },
      body: { sections: newSections },
      as: adminId,
    })
    expect(res.status).toBe(200)

    const after = await getTournamentRow(tournamentId)
    expect(JSON.parse(after!.sections as string)).toEqual(newSections)
    expect(after!.name).toBe(before!.name)
    expect(after!.date).toBe(before!.date)
    expect(after!.is_visible).toBe(before!.is_visible)
  })
})

describe('tournament PATCH — auth (requireTournamentManager)', () => {
  it('an assigned TD can PATCH their tournament', async () => {
    const directorId = await seedDirector()
    const tournamentId = await seedTournament()
    await seedTournamentDirector(tournamentId, directorId)

    const res = await invoke(onRequestPatch, {
      method: 'PATCH',
      params: { id: tournamentId },
      body: { name: 'TD Renamed' },
      as: directorId,
    })
    expect(res.status).toBe(200)

    const after = await getTournamentRow(tournamentId)
    expect(after!.name).toBe('TD Renamed')
  })

  it('a plain member gets 403', async () => {
    const memberId = await seedMember()
    const tournamentId = await seedTournament()

    const before = await getTournamentRow(tournamentId)

    const res = await invoke(onRequestPatch, {
      method: 'PATCH',
      params: { id: tournamentId },
      body: { name: 'Should Not Land' },
      as: memberId,
    })
    expect(res.status).toBe(403)

    const after = await getTournamentRow(tournamentId)
    expect(after!.name).toBe(before!.name)
  })

  it('a TD assigned to a DIFFERENT tournament gets 403', async () => {
    const otherDirectorId = await seedDirector()
    const targetTournamentId = await seedTournament()
    const otherTournamentId = await seedTournament()
    await seedTournamentDirector(otherTournamentId, otherDirectorId)

    const before = await getTournamentRow(targetTournamentId)

    const res = await invoke(onRequestPatch, {
      method: 'PATCH',
      params: { id: targetTournamentId },
      body: { name: 'Cross-Tournament Grab' },
      as: otherDirectorId,
    })
    expect(res.status).toBe(403)

    const after = await getTournamentRow(targetTournamentId)
    expect(after!.name).toBe(before!.name)
  })
})

describe('tournament DELETE — admin-only, cascading', () => {
  it('DELETE by a TD is 403 and deletes nothing', async () => {
    const directorId = await seedDirector()
    const tournamentId = await seedTournament()
    await seedTournamentDirector(tournamentId, directorId)

    const res = await invoke(onRequestDelete, {
      method: 'DELETE',
      params: { id: tournamentId },
      as: directorId,
    })
    expect(res.status).toBe(403)

    expect(await getTournamentRow(tournamentId)).toBeTruthy()
    expect(await countRows('tournament_directors', tournamentId)).toBe(1)
  })

  it('DELETE by admin succeeds and cascades registrations, games, and directors', async () => {
    const adminId = await seedAdmin()
    const memberId = await seedMember()
    const directorId = await seedDirector()
    const tournamentId = await seedTournament()
    await seedTournamentDirector(tournamentId, directorId)
    await seedRegistration({ tournamentId, memberId })
    await insertGame(tournamentId, memberId)

    // Sanity: the child rows exist before the delete
    expect(await countRows('registrations', tournamentId)).toBeGreaterThan(0)
    expect(await countRows('tournament_games', tournamentId)).toBe(1)
    expect(await countRows('tournament_directors', tournamentId)).toBe(1)

    const res = await invoke(onRequestDelete, {
      method: 'DELETE',
      params: { id: tournamentId },
      as: adminId,
    })
    expect(res.status).toBe(200)

    expect(await getTournamentRow(tournamentId)).toBeNull()
    expect(await countRows('registrations', tournamentId)).toBe(0)
    expect(await countRows('tournament_games', tournamentId)).toBe(0)
    expect(await countRows('tournament_directors', tournamentId)).toBe(0)
  })
})