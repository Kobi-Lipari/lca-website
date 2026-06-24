// functions/api/admin/tournaments/[id]/manage.ts
import type { Env } from '../../../../types'
import { isResponse, requireTournamentManager } from '../../../../utils/auth'
import { errorResponse, handleOptions, jsonResponse } from '../../../../utils/response'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const tournamentId = context.params.id as string
  const authResult = await requireTournamentManager(context.request, context.env, tournamentId)
  if (isResponse(authResult)) return authResult

  const tournament = await context.env.DB.prepare(
    'SELECT * FROM tournaments WHERE id = ?',
  ).bind(tournamentId).first<Record<string, unknown>>()

  if (!tournament) return errorResponse('Tournament not found', 404)

  let sections: unknown[] = []
  try { sections = JSON.parse(tournament.sections as string) } catch { sections = [] }

  let roundSchedule: unknown[] = []
  try { roundSchedule = JSON.parse(tournament.round_schedule as string) } catch { roundSchedule = [] }

  let customDetails: unknown[] = []
  try { customDetails = JSON.parse(tournament.custom_details as string) } catch { customDetails = [] }

  const rosterRaw = await context.env.DB.prepare(
    `SELECT r.id as registration_id, r.member_id, r.section, r.payment_status, r.bye_rounds,
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

  const standings = await context.env.DB.prepare(
    `SELECT
       r.member_id, m.full_name, r.section,
       SUM(CASE
         WHEN (g.white_member_id = r.member_id AND g.result = '1-0') THEN 1.0
         WHEN (g.black_member_id = r.member_id AND g.result = '0-1') THEN 1.0
         WHEN g.result = '1/2-1/2' THEN 0.5
         WHEN (g.white_member_id = r.member_id OR g.black_member_id = r.member_id) AND g.result = 'bye' THEN 0.5
         ELSE 0
       END) as score,
       SUM(CASE
         WHEN (g.white_member_id = r.member_id AND g.result = '1-0') THEN 1
         WHEN (g.black_member_id = r.member_id AND g.result = '0-1') THEN 1
         ELSE 0
       END) as wins,
       SUM(CASE WHEN g.result = '1/2-1/2' THEN 1 ELSE 0 END) as draws,
       SUM(CASE
         WHEN (g.white_member_id = r.member_id AND g.result = '0-1') THEN 1
         WHEN (g.black_member_id = r.member_id AND g.result = '1-0') THEN 1
         ELSE 0
       END) as losses
     FROM registrations r
     JOIN members m ON m.id = r.member_id
     LEFT JOIN tournament_games g ON g.tournament_id = r.tournament_id
       AND (g.white_member_id = r.member_id OR g.black_member_id = r.member_id)
     WHERE r.tournament_id = ?
     GROUP BY r.member_id, m.full_name, r.section
     ORDER BY score DESC`,
  ).bind(tournamentId).all()

  const directors = await context.env.DB.prepare(
    `SELECT td.member_id, m.full_name, m.email
     FROM tournament_directors td
     JOIN members m ON m.id = td.member_id
     WHERE td.tournament_id = ?`,
  ).bind(tournamentId).all()

  return jsonResponse({
    tournament: {
      ...tournament,
      sections,
      round_schedule: roundSchedule,
      custom_details: customDetails,
    },
    roster,
    games: games.results ?? [],
    standings: standings.results ?? [],
    directors: directors.results ?? [],
  })
}