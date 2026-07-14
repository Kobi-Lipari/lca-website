// functions/api/admin/tournaments/[id]/manage.ts
import type { Env } from '../../../../types'
import { isResponse, requireTournamentManager } from '../../../../utils/auth'
import { errorResponse, handleOptions, jsonResponse } from '../../../../utils/response'
import { computeStandings } from '../../../../utils/tournament-manage'

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
    `SELECT r.id as registration_id, r.member_id, r.section, r.payment_status,
            r.bye_rounds, r.withdrawn_at, r.checked_in_at,
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
    roster as unknown as Array<{ member_id: string; full_name: string; section: string }>,
  )

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
    standings,
    directors: directors.results ?? [],
  })
}
