import type { Env } from '../../../types'
import { isResponse, requireAuthedMember } from '../../../../utils/auth'
import { canManageTournament } from '../../../../utils/permissions'
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

export const onRequestPost: PagesFunction<Env> = async (context) => {
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

  const directors = await context.env.DB.prepare(
    `SELECT td.tournament_id, td.member_id, td.assigned_at, m.full_name, m.email
     FROM tournament_directors td
     JOIN members m ON m.id = td.member_id
     WHERE td.tournament_id = ?`,
  )
    .bind(tournamentId)
    .all()

  return jsonResponse({ directors: directors.results ?? [] }, 201)
}
