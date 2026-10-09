// functions/api/admin/tournaments/[id]/manage.ts
import type { Env, TournamentRow } from '../../../../types'
import { isResponse, requireTournamentView } from '../../../../utils/auth'
import { errorResponse, handleOptions, jsonResponse } from '../../../../utils/response'
import { computeStandings, tournamentPrizes } from '../../../../utils/tournament-manage'
import { parseJsonArray } from '../../../../utils/json'
import { getDb } from '../../../../db/client'
import { loadSections, toTournamentResponse } from '../../../../utils/events/sectionsRepo'
import { loadSchedules } from '../../../../utils/events/schedulesRepo'

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
  ).bind(tournamentId).all()

  return jsonResponse({
    tournament: {
      ...answer,
      custom_details: customDetails,
    },
    roster,
    games: games.results ?? [],
    standings,
    prizes: await tournamentPrizes(context.env.DB, tournamentId, answer.sections, standings),
    directors: directors.results ?? [],
  })
}
