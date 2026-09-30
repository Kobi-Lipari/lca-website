// functions/api/admin/tournaments/[id]/directors.ts
import type { Env, MemberRow } from '../../../../types'
import { isResponse, requireAuthedMember } from '../../../../utils/auth'
import { canManageTournament } from '../../../../utils/permissions'
import { recordAdminAction } from '../../../../utils/audit'
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

// Shared gate for assigning/removing: admins, or the rep of the club that
// organizes the event. Assigning someone gives them this event only; it
// never changes their role.
async function requireCanAssign(
  context: EventContext<Env, string, unknown>,
): Promise<
  | Response
  | { tournamentId: string; tournamentName: string; actor: MemberRow }
> {
  const tournamentId = context.params.id as string
  const authed = await requireAuthedMember(context.request, context.env)
  if (isResponse(authed)) return authed

  const tournament = await context.env.DB.prepare(
    'SELECT id, name, club_id FROM tournaments WHERE id = ?',
  )
    .bind(tournamentId)
    .first<{ id: string; name: string; club_id: string | null }>()

  if (!tournament) {
    return errorResponse('Tournament not found', 404)
  }

  // Only admins and the organizing club's rep hand out director access.
  // Directors run the event; they don't give others access to it.
  const isAdmin = authed.member.role === 'lca_admin'
  const isOwnRep = authed.member.role === 'club_rep' &&
    !!tournament.club_id && authed.member.club_id === tournament.club_id
  if (!isAdmin && !isOwnRep) {
    return errorResponse('Only admins and the organizing club\'s rep can assign directors', 403)
  }

  return { tournamentId, tournamentName: tournament.name, actor: authed.member }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const tournamentId = context.params.id as string
  const authed = await requireAuthedMember(context.request, context.env)
  if (isResponse(authed)) return authed

  const allowed = authed.member.role === 'lca_observer' || await canManageTournament(
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
    'SELECT id, full_name, role FROM members WHERE id = ?',
  )
    .bind(body.memberId)
    .first<{ id: string; full_name: string; role: string }>()

  if (!targetMember || targetMember.role === 'guest') {
    return errorResponse('Member not found', 404)
  }

  await context.env.DB.prepare(
    `INSERT OR IGNORE INTO tournament_directors (tournament_id, member_id)
     VALUES (?, ?)`,
  )
    .bind(tournamentId, body.memberId)
    .run()

  await recordAdminAction(context.env.DB, gate.actor, {
    action: 'director_assign',
    targetMemberId: targetMember.id,
    targetLabel: targetMember.full_name,
    detail: { tournament_id: tournamentId, tournament: gate.tournamentName },
  })

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

  const removed = await context.env.DB.prepare('SELECT full_name FROM members WHERE id = ?')
    .bind(body.memberId).first<{ full_name: string }>()

  await context.env.DB.prepare(
    `DELETE FROM tournament_directors WHERE tournament_id = ? AND member_id = ?`,
  )
    .bind(tournamentId, body.memberId)
    .run()

  await recordAdminAction(context.env.DB, gate.actor, {
    action: 'director_remove',
    targetMemberId: body.memberId,
    targetLabel: removed?.full_name ?? null,
    detail: { tournament_id: tournamentId, tournament: gate.tournamentName },
  })

  return jsonResponse({ directors: await listDirectors(context.env, tournamentId) })
}
