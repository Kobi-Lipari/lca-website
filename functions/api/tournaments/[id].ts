// functions/api/tournaments/[id].ts
import type { Env } from '../../types'
import { errorResponse, handleOptions, jsonResponse } from '../../utils/response'
import { requireAuthedMember, isResponse } from '../../utils/auth'
import { computeStandings } from '../../utils/tournament-manage'
import { parseJsonArray } from '../../utils/json'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const tournamentId = context.params.id as string

  const tournament = await context.env.DB.prepare(
    'SELECT * FROM tournaments WHERE id = ?',
  )
    .bind(tournamentId)
    .first<Record<string, unknown>>()

  if (!tournament) return errorResponse('Tournament not found', 404)

  if (!tournament.is_visible) {
    let isPrivileged = false
    try {
      const authed = await requireAuthedMember(context.request, context.env)
      if (!isResponse(authed)) {
        isPrivileged = ['lca_admin', 'club_rep', 'tournament_director'].includes(
          authed.member.role,
        )
      }
    } catch { /* not logged in */ }
    if (!isPrivileged) return errorResponse('Tournament not found', 404)
  }

  const sections = parseJsonArray(tournament.sections as string)

  const roundSchedule = parseJsonArray(tournament.round_schedule as string)

  const customDetails = parseJsonArray(tournament.custom_details as string)

  let myRegistration: Record<string, unknown> | null = null
  try {
    const authed = await requireAuthedMember(context.request, context.env)
    if (!isResponse(authed)) {
      myRegistration = await context.env.DB.prepare(
        'SELECT * FROM registrations WHERE tournament_id = ? AND member_id = ?',
      )
        .bind(tournamentId, authed.member.id)
        .first<Record<string, unknown>>()

      if (myRegistration?.bye_rounds) {
        try {
          myRegistration = {
            ...myRegistration,
            bye_rounds: JSON.parse(myRegistration.bye_rounds as string),
          }
        } catch { /* leave as string */ }
      }
    }
  } catch { /* not logged in */ }

  // Public roster: payment_status is deliberately NOT selected — whether a
  // named individual has paid is between them and the organizer. Withdrawn
  // players are included (with the flag) so displays can grey/exclude them.
  const roster = await context.env.DB.prepare(
    `SELECT r.member_id, r.section, r.withdrawn_at,
            m.full_name, m.uscf_id, m.uscf_rating
     FROM registrations r
     JOIN members m ON m.id = r.member_id
     WHERE r.tournament_id = ?
     ORDER BY m.full_name ASC`,
  )
    .bind(tournamentId)
    .all()

  const pairings = await context.env.DB.prepare(
    `SELECT g.*,
            w.full_name as white_name, w.uscf_rating as white_rating,
            b.full_name as black_name, b.uscf_rating as black_rating
     FROM tournament_games g
     LEFT JOIN members w ON w.id = g.white_member_id
     LEFT JOIN members b ON b.id = g.black_member_id
     WHERE g.tournament_id = ?
     ORDER BY g.round ASC, g.board ASC`,
  )
    .bind(tournamentId)
    .all()

  // Single standings brain — shared with the manage endpoint
  const standings = computeStandings(
    (pairings.results ?? []) as never,
    (roster.results ?? []) as Array<{ member_id: string; full_name: string; section: string }>,
  )

  return jsonResponse({
    tournament: {
      ...tournament,
      sections,
      round_schedule: roundSchedule,
      custom_details: customDetails,
      is_rated: tournament.is_rated ?? 1,
    },
    roster: roster.results ?? [],
    pairings: pairings.results ?? [],
    standings,
    myRegistration,
  })
}
