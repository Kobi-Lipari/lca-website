import type { Env } from '../../../types'
import { isResponse, requireTournamentManager } from '../../../../utils/auth'
import {
  computeStandings,
  parseTournamentSections,
} from '../../../../utils/tournament-manage'
import { handleOptions, jsonResponse } from '../../../../utils/response'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const tournamentId = context.params.id as string
  const authResult = await requireTournamentManager(
    context.request,
    context.env,
    tournamentId,
  )
  if (isResponse(authResult)) return authResult

  const tournament = await context.env.DB.prepare(
    'SELECT * FROM tournaments WHERE id = ?',
  )
    .bind(tournamentId)
    .first<Record<string, unknown>>()

  if (!tournament) {
    return jsonResponse({ error: 'Tournament not found' }, 404)
  }

  const roster = await context.env.DB.prepare(
    `SELECT r.member_id, r.section, m.full_name, m.uscf_id, r.payment_status
     FROM registrations r
     JOIN members m ON m.id = r.member_id
     WHERE r.tournament_id = ?
     ORDER BY m.full_name ASC`,
  )
    .bind(tournamentId)
    .all()

  const games = await context.env.DB.prepare(
    `SELECT g.*,
      wm.full_name as white_name,
      bm.full_name as black_name
     FROM tournament_games g
     LEFT JOIN members wm ON wm.id = g.white_member_id
     LEFT JOIN members bm ON bm.id = g.black_member_id
     WHERE g.tournament_id = ?
     ORDER BY g.round ASC, g.section ASC, g.board ASC`,
  )
    .bind(tournamentId)
    .all()

  const rosterRows = (roster.results ?? []) as Array<{
    member_id: string
    full_name: string
    section: string
  }>

  const standings = computeStandings(
    (games.results ?? []) as Parameters<typeof computeStandings>[0],
    rosterRows,
  )

  const directors = await context.env.DB.prepare(
    `SELECT td.member_id, m.full_name, m.email
     FROM tournament_directors td
     JOIN members m ON m.id = td.member_id
     WHERE td.tournament_id = ?`,
  )
    .bind(tournamentId)
    .all()

  return jsonResponse({
    tournament: {
      ...tournament,
      sections: parseTournamentSections(tournament.sections as string),
    },
    roster: roster.results ?? [],
    games: games.results ?? [],
    standings,
    directors: directors.results ?? [],
  })
}
