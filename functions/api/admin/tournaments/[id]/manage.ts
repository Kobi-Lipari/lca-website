// functions/api/admin/tournaments/[id]/manage.ts
import type { Env, MemberRow, TournamentRow } from '../../../../types'
import { isObserver, isResponse, requireTournamentView } from '../../../../utils/auth'
import { errorResponse, handleOptions, jsonResponse } from '../../../../utils/response'
import { computeStandings, tournamentPrizes } from '../../../../utils/events/tournament-manage'
import { parseJsonArray } from '../../../../utils/json'
import { getDb } from '../../../../db/client'
import { loadSections, toTournamentResponse } from '../../../../utils/events/sectionsRepo'
import { loadSchedules } from '../../../../utils/events/schedulesRepo'
import { REGION_EVENTS_ON } from '../../../../utils/clubs/pages'
import { CREATION_ROLES_ON, directorEmailsHidden, draftedInRegion } from '../../../../utils/events/creation'
import { approvalState } from '../../../../../domain/events/approval'
import type { TournamentManageResponse } from '../../../../../domain/contracts/events'

/**
 * Who may move the event through the LCA admins' wait (WS09 step 19), as
 * POST /api/admin/tournaments/[id]/approval decides it: Submit for LCA
 * review, the person who drafted it while a seat of theirs keeps its club
 * (draftedInRegion), or an LCA admin; Approve and publish and Ask for
 * changes, an LCA admin, the endpoint asking the second factor itself.
 * Read only while REGION_EVENTS_ON is set; an event not marked, or one
 * approved, asks no seat.
 */
async function approvalRights(db: D1Database, member: MemberRow, event: TournamentRow): Promise<NonNullable<TournamentManageResponse['approval']>> {
  const isAdmin = member.role === 'lca_admin'
  const state = approvalState(event)
  if (state === 'not_marked' || state === 'approved') return { maySubmit: false, mayDecide: false }
  const maySubmit = isAdmin || await draftedInRegion(db, member, { clubId: event.club_id, createdBy: event.created_by })
  return { maySubmit, mayDecide: isAdmin }
}

/**
 * The event as directorEmailsHidden asks about it: its club, its directors'
 * ids and its mark for approval. The mark comes from the row the handler
 * loads (SELECT *), which carries needs_lca_approval once migration 0070 has
 * run, so no statement is added; it is asked only while REGION_EVENTS_ON is
 * set, past an observer, an LCA admin and the club's own rep.
 */
const directorsOf = (event: TournamentRow, rows: Record<string, unknown>[]) => ({
  clubId: event.club_id,
  directorIds: rows.map((row) => String(row.member_id)),
  mark: async () => event.needs_lca_approval,
})

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const tournamentId = context.params.id as string
  const authResult = await requireTournamentView(context.request, context.env, tournamentId)
  if (isResponse(authResult)) return authResult

  const tournament = await context.env.DB.prepare(
    'SELECT * FROM tournaments WHERE id = ?',
  ).bind(tournamentId).first<TournamentRow>()

  if (!tournament) return errorResponse('Tournament not found', 404)

  // The live sections, which the setup edits and sends back: an archived
  // one is not listed, so a save never brings it back by accident. The
  // round times come from the live schedules.
  const db = getDb(context.env.DB)
  const answer = toTournamentResponse(tournament, await loadSections(db, tournamentId), await loadSchedules(db, tournamentId))

  const customDetails = parseJsonArray(tournament.custom_details)

  const rosterRaw = await context.env.DB.prepare(
    `SELECT r.id as registration_id, r.member_id, r.section, r.payment_status,
            r.bye_rounds, r.withdrawn_at, r.checked_in_at, r.rating_at_entry, r.waitlisted_at, r.grade,
            m.uscf_expiration,
            m.full_name, m.uscf_id, m.uscf_rating
     FROM registrations r
     JOIN members m ON m.id = r.member_id
     WHERE r.tournament_id = ?
     ORDER BY m.full_name ASC`,
  ).bind(tournamentId).all<Record<string, unknown>>()

  const roster = (rosterRaw.results ?? []).map((r) => ({
    ...r,
    bye_rounds: r.bye_rounds
      ? (() => { try { return JSON.parse(r.bye_rounds as string) } catch { return [] } })()
      : [],
  }))

  const games = await context.env.DB.prepare(
    `SELECT g.*, w.full_name as white_name, b.full_name as black_name
     FROM tournament_games g
     LEFT JOIN members w ON w.id = g.white_member_id
     LEFT JOIN members b ON b.id = g.black_member_id
     WHERE g.tournament_id = ?
     ORDER BY g.round ASC, g.board ASC`,
  ).bind(tournamentId).all()

  // Single standings brain — shared with the public endpoint.
  // Withdrawn players are included: their played results stand.
  const standings = computeStandings(
    (games.results ?? []) as never,
    roster.filter((r) => !(r as Record<string, unknown>).waitlisted_at) as unknown as Parameters<typeof computeStandings>[1],
    Number(tournament.rounds) || undefined,
  )

  const directors = await context.env.DB.prepare(
    `SELECT td.member_id, m.full_name, m.email
     FROM tournament_directors td
     JOIN members m ON m.id = td.member_id
     WHERE td.tournament_id = ?`,
  ).bind(tournamentId).all<Record<string, unknown>>()
  const directorRows = directors.results ?? []

  return jsonResponse({
    tournament: {
      ...answer,
      custom_details: customDetails,
    },
    roster,
    games: games.results ?? [],
    standings,
    prizes: await tournamentPrizes(context.env.DB, tournamentId, answer.sections, standings),
    // Only while REGION_EVENTS_ON is set: without their emails as directorEmailsHidden decides, on a marked event for
    // anyone but an observer, an LCA admin and the club's own rep, and elsewhere for a viewer whose one standing is the region.
    directors: REGION_EVENTS_ON && await directorEmailsHidden(context.env.DB, authResult.member, directorsOf(tournament, directorRows), isObserver(authResult.member), CREATION_ROLES_ON)
      ? directorRows.map((row) => ({ ...row, email: null }))
      : directorRows,
    // Only while REGION_EVENTS_ON is set: who may move the event through the wait, for the manage page.
    ...(REGION_EVENTS_ON ? { approval: await approvalRights(context.env.DB, authResult.member, tournament) } : {}),
  })
}
