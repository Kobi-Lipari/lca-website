// functions/api/admin/tournaments/[id]/directors.ts
import type { Env, MemberRow } from '../../../../types'
import { isObserver, isResponse, requireAuthedMember } from '../../../../utils/auth'
import { canManageTournament } from '../../../../utils/admin/permissions'
import { recordAdminAction } from '../../../../utils/admin/audit'
import { CREATION_ROLES_ON, creationPerson } from '../../../../utils/events/creation'
import { canAssignDirectors } from '../../../../../domain/events/creation'
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

// Shared gate for assigning/removing (D21): an LCA admin on any event, the
// rep of the club that organizes it, and, once CREATION_ROLES_ON is set, the
// president on an event the president created. canAssignDirectors decides,
// the one place the rule is written. Assigning someone gives them this event
// only; it never changes their role.
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
    'SELECT id, name, club_id, created_by FROM tournaments WHERE id = ?',
  )
    .bind(tournamentId)
    .first<{ id: string; name: string; club_id: string | null; created_by: string | null }>()

  if (!tournament) {
    return errorResponse('Tournament not found', 404)
  }

  // Directors run the event; they don't give others access to it. A club
  // rep's right on its own club's events comes through repClubId, whatever
  // else the rep holds. CREATION_ROLES_ON is read here, at each request; while
  // it is unset the seat is never read and the answer is today's.
  const rolesOn = CREATION_ROLES_ON
  const person = await creationPerson(context.env.DB, authed.member, rolesOn)
  if (!canAssignDirectors(person, { clubId: tournament.club_id, createdBy: tournament.created_by }, rolesOn)) {
    return errorResponse('Only admins and the organizing club\'s rep can assign directors', 403)
  }

  return { tournamentId, tournamentName: tournament.name, actor: authed.member }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const tournamentId = context.params.id as string
  const authed = await requireAuthedMember(context.request, context.env)
  if (isResponse(authed)) return authed

  const allowed = isObserver(authed.member) || await canManageTournament(
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
