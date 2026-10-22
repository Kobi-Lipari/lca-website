// functions/api/admin/tournaments/[id]/rating-report.ts
import type { Env } from '../../../../types'
import { isResponse, requireTournamentView } from '../../../../utils/auth'
import { errorResponse, handleOptions, jsonResponse } from '../../../../utils/response'
import { getDb } from '../../../../db/client'
import { loadSections } from '../../../../utils/events/sectionsRepo'
import { formatDate } from '../../../../../domain/format'

interface GameRow {
  round: number
  section: string
  white_member_id: string | null
  black_member_id: string | null
  result: string
}

interface PlayerRow {
  member_id: string
  full_name: string
  uscf_id: string | null
  uscf_rating: number | null
  uscf_expiration: string | null
  section: string
}

interface RoundEntry {
  round: number
  /** USCF crosstable codes: W/L/D played, X forfeit win, F forfeit loss,
   *  B full bye, H half bye, U unplayed */
  code: 'W' | 'L' | 'D' | 'X' | 'F' | 'B' | 'H' | 'U'
  opponentPairingNum: number | null
  color: 'W' | 'B' | null
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const tournamentId = context.params.id as string
  const authResult = await requireTournamentView(context.request, context.env, tournamentId)
  if (isResponse(authResult)) return authResult

  const tournament = await context.env.DB.prepare(
    `SELECT id, name, date, end_date, location, venue, rounds, is_rated, time_control, report_settings, created_by
       FROM tournaments WHERE id = ?`,
  ).bind(tournamentId).first<{
    id: string; name: string; date: string; end_date: string | null
    location: string; venue: string | null; rounds: number; is_rated: number
    time_control: string | null; report_settings: string | null; created_by: string | null
  }>()

  if (!tournament) return errorResponse('Tournament not found', 404)
  if (!tournament.is_rated) {
    return errorResponse('This tournament is not US Chess rated, so it has no rating report.', 400)
  }

  const rosterRes = await context.env.DB.prepare(
    `SELECT r.member_id, r.section, m.full_name, m.uscf_id, m.uscf_expiration,
            COALESCE(r.rating_at_entry, m.uscf_rating) AS uscf_rating
     FROM registrations r
     JOIN members m ON m.id = r.member_id
     WHERE r.tournament_id = ? AND r.waitlisted_at IS NULL`,
  ).bind(tournamentId).all<PlayerRow>()

  const gamesRes = await context.env.DB.prepare(
    `SELECT round, section, white_member_id, black_member_id, result
     FROM tournament_games
     WHERE tournament_id = ? AND result != 'pending'
     ORDER BY round ASC`,
  ).bind(tournamentId).all<GameRow>()

  const roster = rosterRes.results ?? []
  const games = gamesRes.results ?? []

  // Only players who appear in at least one game go on the report —
  // no-shows and withdrawn-before-round-1 players are simply absent.
  const participated = new Set<string>()
  for (const g of games) {
    if (g.white_member_id) participated.add(g.white_member_id)
    if (g.black_member_id) participated.add(g.black_member_id)
  }

  // Every section the event has had, archived ones included: the report is
  // history, and entries and games keep their section's name. A section
  // nobody played in is left out below. Players are grouped by name, and a
  // live row may take a name an archived row still holds, so each name is
  // listed once (the live row's place wins, as live rows load first).
  const sectionNames = [...new Set(
    (await loadSections(getDb(context.env.DB), tournamentId, { includeArchived: true })).map((s) => s.name),
  )]

  const validationErrors: string[] = []
  const eventStart = String(tournament.date).slice(0, 10)

  // One US Chess ID on two players is almost always a typo.
  const byId = new Map<string, string[]>()
  for (const p of roster) {
    if (!p.uscf_id || !participated.has(p.member_id)) continue
    byId.set(p.uscf_id, [...(byId.get(p.uscf_id) ?? []), p.full_name])
  }
  for (const [id, names] of byId) {
    if (names.length > 1) validationErrors.push(`US Chess ID ${id} is on more than one player: ${names.join(', ')}.`)
  }

  const sections = sectionNames.map((sectionName) => {
    // Pairing numbers: rating desc, then name — conventional wall-chart order
    const players = roster
      .filter((p) => p.section === sectionName && participated.has(p.member_id))
      .sort((a, b) =>
        (b.uscf_rating ?? 0) - (a.uscf_rating ?? 0) ||
        a.full_name.localeCompare(b.full_name),
      )

    const pairingNum = new Map<string, number>()
    players.forEach((p, i) => pairingNum.set(p.member_id, i + 1))

    for (const p of players) {
      if (!p.uscf_id) {
        validationErrors.push(
          `${p.full_name} (${sectionName}) has no US Chess ID. The report cannot be submitted until one is added.`,
        )
      }
      const expires = p.uscf_expiration?.slice(0, 10)
      if (p.uscf_id && expires && expires < eventStart) {
        validationErrors.push(
          `${p.full_name} (${sectionName}): US Chess membership expired ${formatDate(expires, { year: true })}. It must be renewed before US Chess will rate the event.`,
        )
      }
    }

    const sectionGames = games.filter((g) => g.section === sectionName)

    const playerRows = players.map((p) => {
      const rounds: RoundEntry[] = []
      let score = 0

      for (let round = 1; round <= tournament.rounds; round++) {
        const game = sectionGames.find(
          (g) =>
            g.round === round &&
            (g.white_member_id === p.member_id || g.black_member_id === p.member_id),
        )

        if (!game) {
          rounds.push({ round, code: 'U', opponentPairingNum: null, color: null })
          continue
        }

        const isWhite = game.white_member_id === p.member_id
        const oppId = isWhite ? game.black_member_id : game.white_member_id
        const opp = oppId ? pairingNum.get(oppId) ?? null : null
        const r = game.result

        let code: RoundEntry['code']
        if (r === 'bye') { code = 'B'; score += 1 }
        else if (r === 'bye-half') { code = 'H'; score += 0.5 }
        else if (r === '1-0') { code = isWhite ? 'W' : 'L'; if (isWhite) score += 1 }
        else if (r === '0-1') { code = isWhite ? 'L' : 'W'; if (!isWhite) score += 1 }
        else if (r === '1/2-1/2') { code = 'D'; score += 0.5 }
        else if (r === '1-0 F') { code = isWhite ? 'X' : 'F'; if (isWhite) score += 1 }
        else if (r === '0-1 F') { code = isWhite ? 'F' : 'X'; if (!isWhite) score += 1 }
        else if (r === '0-0 F') { code = 'F' }
        else { code = 'U' }

        rounds.push({
          round,
          code,
          opponentPairingNum: opp,
          // Unplayed results (byes, forfeits) have no color for rating purposes
          color: ['W', 'L', 'D'].includes(code) ? (isWhite ? 'W' : 'B') : null,
        })
      }

      return {
        pairingNum: pairingNum.get(p.member_id)!,
        name: p.full_name,
        uscfId: p.uscf_id,
        preRating: p.uscf_rating,
        score,
        rounds,
      }
    })

    return { name: sectionName, players: playerRows }
  }).filter((s) => s.players.length > 0)

  // Unfinished-event guard: any pending game means the report is premature
  const pendingRow = await context.env.DB.prepare(
    `SELECT id FROM tournament_games WHERE tournament_id = ? AND result = 'pending' LIMIT 1`,
  ).bind(tournamentId).first()
  if (pendingRow) {
    validationErrors.push('Some games still have pending results — enter all results before submitting')
  }

  // Suggestions for the upload details: the first director with a US Chess
  // ID as chief TD, and city/state/ZIP read from the location or venue.
  const tds = await context.env.DB.prepare(
    `SELECT m.full_name, m.uscf_id FROM tournament_directors td
       JOIN members m ON m.id = td.member_id
      WHERE td.tournament_id = ? AND m.uscf_id IS NOT NULL
      ORDER BY td.assigned_at`,
  ).bind(tournamentId).all<{ full_name: string; uscf_id: string }>()
  const place = `${tournament.venue ?? ''} ${tournament.location ?? ''}`
  const zip = /\b(\d{5})(?:-\d{4})?\b/.exec(place)?.[1] ?? ''
  const stateMatch = /,\s*([A-Z]{2})\b/.exec(tournament.location ?? '') ?? /\b([A-Z]{2})\s+\d{5}\b/.exec(place)
  const city = (tournament.location ?? '').split(',')[0]?.trim() ?? ''
  let settings: unknown
  try { settings = tournament.report_settings ? JSON.parse(tournament.report_settings) : null } catch { settings = null }

  return jsonResponse({
    tournament: {
      name: tournament.name,
      startDate: tournament.date,
      endDate: tournament.end_date ?? tournament.date,
      location: tournament.location,
      rounds: tournament.rounds,
      timeControl: tournament.time_control,
    },
    upload: {
      settings,
      suggested: {
        chiefTdId: tds.results?.[0]?.uscf_id ?? '',
        chiefTdName: tds.results?.[0]?.full_name ?? '',
        assistantTdId: tds.results?.[1]?.uscf_id ?? '',
        city,
        state: stateMatch?.[1] ?? 'LA',
        zip,
      },
    },
    sections,
    validationErrors,
  })
}
