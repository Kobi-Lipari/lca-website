// functions/api/tournaments/[id].ts
import type { Env, MemberRow, TournamentRow } from '../../types'
import { errorResponse, handleOptions, jsonResponse } from '../../utils/response'
import { isObserver, requireAuthedMember, isResponse } from '../../utils/auth'
import { canManageTournament } from '../../utils/admin/permissions'
import { computeStandings, tournamentPrizes } from '../../utils/events/tournament-manage'
import { parseJsonArray } from '../../utils/json'
import { getDb } from '../../db/client'
import { loadSections, toTournamentResponse } from '../../utils/events/sectionsRepo'
import { loadSchedules } from '../../utils/events/schedulesRepo'
import { ROSTER_SHORT_NAMES, publicRoster, publicTournamentAnswer, type RosterRead } from '../../utils/events/publicAnswer'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const tournamentId = context.params.id as string

  const tournament = await context.env.DB.prepare(
    'SELECT * FROM tournaments WHERE id = ?',
  )
    .bind(tournamentId)
    .first<TournamentRow>()

  if (!tournament) return errorResponse('Tournament not found', 404)

  // Who is asking, read once. The people who manage the event (an admin, an
  // observer, the organizing club's rep or an assigned director) may open it
  // while it is a hidden draft, and are the only ones answered the keys
  // MANAGER_ONLY_TOURNAMENT_KEYS names and, once ROSTER_SHORT_NAMES is set,
  // every entrant's full name in the roster.
  let member: MemberRow | null = null
  let manages = false
  try {
    const authed = await requireAuthedMember(context.request, context.env)
    if (!isResponse(authed)) {
      member = authed.member
      manages = isObserver(member) || await canManageTournament(context.env.DB, member, tournamentId)
    }
  } catch { /* not logged in */ }

  if (!tournament.is_visible && !manages) return errorResponse('Tournament not found', 404)

  // The live sections: an archived one takes no entries, so the page
  // offering entry never lists it. Prizes are read from the same rows. The
  // round times come from the live schedules.
  const db = getDb(context.env.DB)
  const answer = publicTournamentAnswer(
    toTournamentResponse(tournament, await loadSections(db, tournamentId), await loadSchedules(db, tournamentId)),
    manages,
  )

  const customDetails = parseJsonArray(tournament.custom_details)

  let myRegistration: Record<string, unknown> | null = null
  try {
    if (member) {
      myRegistration = await context.env.DB.prepare(
        'SELECT * FROM registrations WHERE tournament_id = ? AND member_id = ?',
      )
        .bind(tournamentId, member.id)
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
  } catch { /* the page shows no entry of the viewer's own */ }

  // Public roster: payment_status is deliberately NOT selected, since whether a
  // named individual has paid is between them and the organizer. Withdrawn
  // players are included (with the flag) so displays can grey/exclude them.
  // guardian_link and entry_marked say whether the entrant is under 18 (D15):
  // a guardian link, or an entry that confirmed a scholastic range.
  // publicRoster reads them and leaves them out of the answer.
  const roster = await context.env.DB.prepare(
    `SELECT r.member_id, r.section, r.withdrawn_at, r.rating_at_entry,
            m.full_name, m.uscf_id, m.uscf_rating,
            m.guardian_id IS NOT NULL AS guardian_link, r.grade IS NOT NULL AS entry_marked
     FROM registrations r
     JOIN members m ON m.id = r.member_id
     WHERE r.tournament_id = ? AND r.waitlisted_at IS NULL
     ORDER BY m.full_name ASC`,
  )
    .bind(tournamentId)
    .all<RosterRead>()

  const waitlist = await context.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM registrations
      WHERE tournament_id = ? AND waitlisted_at IS NOT NULL AND withdrawn_at IS NULL`,
  ).bind(tournamentId).first<{ n: number }>()

  const pairings = await context.env.DB.prepare(
    `SELECT g.*,
            w.full_name as white_name,
            COALESCE((SELECT rating_at_entry FROM registrations x
                       WHERE x.tournament_id = g.tournament_id AND x.member_id = g.white_member_id), w.uscf_rating) as white_rating,
            b.full_name as black_name,
            COALESCE((SELECT rating_at_entry FROM registrations x
                       WHERE x.tournament_id = g.tournament_id AND x.member_id = g.black_member_id), b.uscf_rating) as black_rating
     FROM tournament_games g
     LEFT JOIN members w ON w.id = g.white_member_id
     LEFT JOIN members b ON b.id = g.black_member_id
     WHERE g.tournament_id = ?
     ORDER BY g.round ASC, g.board ASC`,
  )
    .bind(tournamentId)
    .all()

  // Single standings brain, shared with the manage endpoint
  // It reads the full roster, before publicRoster writes the answer's, so the
  // standings and the prizes keep full names (D3).
  const standings = computeStandings(
    (pairings.results ?? []) as never,
    (roster.results ?? []) as Parameters<typeof computeStandings>[1],
    Number(tournament.rounds) || undefined,
  )
  // Prize winners are published once the event is finished.
  const prizes = tournament.status === 'completed'
    ? await tournamentPrizes(context.env.DB, tournamentId, answer.sections, standings)
    : []

  return jsonResponse({
    tournament: {
      ...answer,
      custom_details: customDetails,
      is_rated: tournament.is_rated ?? 1,
      waitlist_count: waitlist?.n ?? 0,
    },
    roster: publicRoster(roster.results ?? [], ROSTER_SHORT_NAMES && !manages),
    pairings: pairings.results ?? [],
    standings,
    prizes,
    myRegistration,
  })
}
