// functions/api/admin/tournaments/[id]/directors.ts
import type { Env, MemberRow } from '../../../../types'
import { isObserver, isResponse, requireAuthedMember } from '../../../../utils/auth'
import { canManageTournament } from '../../../../utils/admin/permissions'
import { recordAdminAction } from '../../../../utils/admin/audit'
import { CREATION_ROLES_ON, creationPerson, directorEmailsHidden } from '../../../../utils/events/creation'
import { REGION_EVENTS_ON } from '../../../../utils/clubs/pages'
import { canAssignDirectors, regionAlone, type CreationPerson } from '../../../../../domain/events/creation'
import { tournamentDirectorRequestSchema } from '../../../../../domain/contracts/events'
import {
  errorResponse,
  handleOptions,
  jsonResponse,
  parseBody,
} from '../../../../utils/response'

/** The 403 of a regional representative who names themselves a director of an event they run as the representative. */
export const NO_SELF_DIRECTOR = 'You run this event as its regional representative, so you cannot name yourself a director.'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

/** The directors with each email left out, the key kept as null. */
const withoutEmails = (rows: Record<string, unknown>[]) => rows.map((row) => ({ ...row, email: null }))

async function listDirectors(env: Env, tournamentId: string) {
  const directors = await env.DB.prepare(
    `SELECT td.tournament_id, td.member_id, td.assigned_at, m.full_name, m.email
     FROM tournament_directors td
     JOIN members m ON m.id = td.member_id
     WHERE td.tournament_id = ?`,
  )
    .bind(tournamentId)
    .all<Record<string, unknown>>()
  return directors.results ?? []
}

/** The event's club, and its mark for approval as a read made only when directorEmailsHidden asks for it. */
type EmailsEvent = { clubId: string | null; mark: () => Promise<number | null | undefined> }

/**
 * The event's mark for approval, read alone: the POST's and the DELETE's
 * answers, whose gate has the club already. Asked only while
 * REGION_EVENTS_ON is set and only by directorEmailsHidden, past an
 * observer, an LCA admin and the club's own rep.
 */
const markOf = (env: Env, tournamentId: string) => async () => (await env.DB.prepare('SELECT needs_lca_approval FROM tournaments WHERE id = ?')
  .bind(tournamentId).first<{ needs_lca_approval: number | null }>())?.needs_lca_approval

/**
 * The directors as the caller is answered them: without their emails only
 * while REGION_EVENTS_ON is set, as directorEmailsHidden decides, the key
 * kept as null. An observer and an LCA admin are answered from the list
 * alone, before eventOf is asked; anyone else costs eventOf's answer, which
 * on GET is one read of the event's club and its mark, one of the event's
 * own directors and the club's own rep included, and on POST and DELETE no
 * read, the mark then read alone when it is asked.
 */
async function answerDirectors(
  env: Env,
  tournamentId: string,
  member: MemberRow,
  eventOf: () => Promise<EmailsEvent>,
  person?: CreationPerson,
): Promise<Record<string, unknown>[]> {
  const rows = await listDirectors(env, tournamentId)
  if (!REGION_EVENTS_ON || rows.length === 0 || isObserver(member) || member.role === 'lca_admin') return rows
  const event = { ...(await eventOf()), directorIds: rows.map((row) => String(row.member_id)) }
  return (await directorEmailsHidden(env.DB, member, event, false, CREATION_ROLES_ON, person)) ? withoutEmails(rows) : rows
}

// Shared gate for assigning/removing (D21): an LCA admin on any event, the
// rep of the club that organizes it, and, once CREATION_ROLES_ON is set, the
// president on an event the president created, and, while REGION_EVENTS_ON
// is set, a regional representative on a club event in their region that
// they drafted (WS09 step 17), never on a club rep's own event there, which
// the representative otherwise runs. canAssignDirectors decides,
// the one place the rule is written. Assigning someone gives them this event
// only; it never changes their role.
async function requireCanAssign(
  context: EventContext<Env, string, unknown>,
): Promise<
  | Response
  | { tournamentId: string; tournamentName: string; actor: MemberRow; person: CreationPerson; clubId: string | null }
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

  return { tournamentId, tournamentName: tournament.name, actor: authed.member, person, clubId: tournament.club_id }
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

  // Only while REGION_EVENTS_ON is set, and only for a caller who is not an
  // observer or an LCA admin, are the event's club and its mark read, in one
  // statement, to decide whether the emails are left out. The club's own rep
  // costs that read, since their club is checked against it, and so does one
  // of the event's own directors, since on a marked event a director reads no
  // email.
  const eventOf = async (): Promise<EmailsEvent> => {
    const row = await context.env.DB.prepare('SELECT club_id, needs_lca_approval FROM tournaments WHERE id = ?')
      .bind(tournamentId).first<{ club_id: string | null; needs_lca_approval: number | null }>()
    return { clubId: row?.club_id ?? null, mark: async () => row?.needs_lca_approval }
  }
  return jsonResponse({ directors: await answerDirectors(context.env, tournamentId, authed.member, eventOf) })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const gate = await requireCanAssign(context)
  if (gate instanceof Response) return gate
  const { tournamentId } = gate

  const body = await parseBody(context.request, tournamentDirectorRequestSchema)
  if (isResponse(body)) return body
  if (!body.memberId) {
    return errorResponse('memberId is required', 400)
  }

  // A representative who runs the event through their seat alone may not
  // name themselves: a director row would keep them in after the seat ends.
  // regionAlone reads the person the gate built, so no query is added, and
  // with REGION_EVENTS_ON unset it is false.
  if (body.memberId === gate.actor.id && regionAlone(gate.person, gate.clubId)) {
    return errorResponse(NO_SELF_DIRECTOR, 403)
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

  return jsonResponse({ directors: await answerDirectors(context.env, tournamentId, gate.actor, async () => ({ clubId: gate.clubId, mark: markOf(context.env, tournamentId) }), gate.person) }, 201)
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const gate = await requireCanAssign(context)
  if (gate instanceof Response) return gate
  const { tournamentId } = gate

  const body = await parseBody(context.request, tournamentDirectorRequestSchema)
  if (isResponse(body)) return body
  if (!body.memberId) {
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

  return jsonResponse({ directors: await answerDirectors(context.env, tournamentId, gate.actor, async () => ({ clubId: gate.clubId, mark: markOf(context.env, tournamentId) }), gate.person) })
}
