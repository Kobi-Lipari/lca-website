// functions/api/admin/tournaments/[id]/directors.ts
import type { Env } from '../../../../types'
import { isResponse, requireAuthedMember } from '../../../../utils/auth'
import {
  canManageTournament,
  getDirectedTournamentIds,
} from '../../../../utils/permissions'
import { syncSupabaseUserMetadata } from '../../../../utils/supabase'
import {
  errorResponse,
  handleOptions,
  jsonResponse,
  parseJsonBody,
} from '../../../../utils/response'

interface DirectorBody {
  memberId?: string
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

async function listDirectors(env: Env, tournamentId: string) {
  const directors = await env.DB.prepare(
    `SELECT td.tournament_id, td.member_id, td.assigned_at, m.full_name, m.email
     FROM tournament_directors td
     JOIN members m ON m.id = td.member_id
     WHERE td.tournament_id = ?`,
  )
    .bind(tournamentId)
    .all()
  return directors.results ?? []
}

// Shared gate for assigning/removing: must be able to manage the tournament,
// must not be a TD themselves (TDs run the event, they don't grant access),
// and club reps only touch their own club's tournaments.
async function requireCanAssign(
  context: EventContext<Env, string, unknown>,
): Promise<
  | Response
  | { tournamentId: string }
> {
  const tournamentId = context.params.id as string
  const authed = await requireAuthedMember(context.request, context.env)
  if (isResponse(authed)) return authed

  const canAssign = await canManageTournament(
    context.env.DB,
    authed.member,
    tournamentId,
  )
  if (!canAssign) {
    return errorResponse('Forbidden', 403)
  }

  if (authed.member.role === 'tournament_director') {
    return errorResponse('Only admins and club reps can assign directors', 403)
  }

  const tournament = await context.env.DB.prepare(
    'SELECT id, club_id FROM tournaments WHERE id = ?',
  )
    .bind(tournamentId)
    .first<{ id: string; club_id: string | null }>()

  if (!tournament) {
    return errorResponse('Tournament not found', 404)
  }

  if (
    authed.member.role === 'club_rep' &&
    authed.member.club_id !== tournament.club_id
  ) {
    return errorResponse('Forbidden', 403)
  }

  return { tournamentId }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const tournamentId = context.params.id as string
  const authed = await requireAuthedMember(context.request, context.env)
  if (isResponse(authed)) return authed

  const allowed = await canManageTournament(
    context.env.DB,
    authed.member,
    tournamentId,
  )
  if (!allowed) {
    return errorResponse('Forbidden', 403)
  }

  return jsonResponse({ directors: await listDirectors(context.env, tournamentId) })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const gate = await requireCanAssign(context)
  if (gate instanceof Response) return gate
  const { tournamentId } = gate

  const body = await parseJsonBody<DirectorBody>(context.request)
  if (!body?.memberId) {
    return errorResponse('memberId is required', 400)
  }

  const targetMember = await context.env.DB.prepare(
    'SELECT * FROM members WHERE id = ?',
  )
    .bind(body.memberId)
    .first<{ id: string; role: string; club_id: string | null }>()

  if (!targetMember) {
    return errorResponse('Member not found', 404)
  }

  await context.env.DB.prepare(
    `INSERT OR IGNORE INTO tournament_directors (tournament_id, member_id)
     VALUES (?, ?)`,
  )
    .bind(tournamentId, body.memberId)
    .run()

  if (targetMember.role === 'member') {
    await context.env.DB.prepare(
      `UPDATE members SET role = 'tournament_director' WHERE id = ?`,
    )
      .bind(body.memberId)
      .run()
    await syncSupabaseUserMetadata(context.env, body.memberId, {
      role: 'tournament_director',
      club_id: targetMember.club_id,
    })
  }

  return jsonResponse({ directors: await listDirectors(context.env, tournamentId) }, 201)
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const gate = await requireCanAssign(context)
  if (gate instanceof Response) return gate
  const { tournamentId } = gate

  const body = await parseJsonBody<DirectorBody>(context.request)
  if (!body?.memberId) {
    return errorResponse('memberId is required', 400)
  }

  await context.env.DB.prepare(
    `DELETE FROM tournament_directors WHERE tournament_id = ? AND member_id = ?`,
  )
    .bind(tournamentId, body.memberId)
    .run()

  // Mirror of the POST auto-promote: if this was their last directed
  // tournament and their role is tournament_director, demote back to member.
  // Metadata sync is best-effort — the DB is authoritative either way.
  const target = await context.env.DB.prepare(
    'SELECT id, role, club_id FROM members WHERE id = ?',
  )
    .bind(body.memberId)
    .first<{ id: string; role: string; club_id: string | null }>()

  if (target && target.role === 'tournament_director') {
    const remaining = await getDirectedTournamentIds(context.env.DB, body.memberId)
    if (remaining.length === 0) {
      await context.env.DB.prepare(
        `UPDATE members SET role = 'member' WHERE id = ?`,
      )
        .bind(body.memberId)
        .run()
      try {
        await syncSupabaseUserMetadata(context.env, body.memberId, {
          role: 'member',
          club_id: target.club_id,
        })
      } catch {
        // best-effort; D1 role is the source of truth
      }
    }
  }

  return jsonResponse({ directors: await listDirectors(context.env, tournamentId) })
}
