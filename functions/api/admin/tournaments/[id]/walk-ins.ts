// functions/api/admin/tournaments/[id]/walk-ins.ts
import type { Env } from '../../../../types'
import { isResponse, requireTournamentManager } from '../../../../utils/auth'
import {
  errorResponse,
  handleOptions,
  jsonResponse,
  parseJsonBody,
} from '../../../../utils/response'

interface WalkInBody {
  fullName?: string
  uscfId?: string | null
  uscfRating?: number | null
  section?: string
  markPaid?: boolean
}

function parseSectionList(sectionsJson: string): Array<{ name: string; entryFee?: number }> {
  try {
    const parsed = JSON.parse(sectionsJson) as Array<{ name: string; entryFee?: number } | string>
    return parsed.map((s) => (typeof s === 'string' ? { name: s } : s))
  } catch {
    return []
  }
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const tournamentId = context.params.id as string
  const authResult = await requireTournamentManager(context.request, context.env, tournamentId)
  if (isResponse(authResult)) return authResult

  const body = await parseJsonBody<WalkInBody>(context.request)
  const fullName = body?.fullName?.trim()
  const uscfId = body?.uscfId?.trim() || null
  const section = body?.section

  if (!fullName || !section) {
    return errorResponse('fullName and section are required', 400)
  }
  if (
    body?.uscfRating != null &&
    (typeof body.uscfRating !== 'number' || !Number.isFinite(body.uscfRating))
  ) {
    return errorResponse('uscfRating must be a number', 400)
  }

  const tournament = await context.env.DB.prepare(
    'SELECT id, name, sections, entry_fee, max_players, is_rated FROM tournaments WHERE id = ?',
  ).bind(tournamentId).first<{
    id: string
    name: string
    sections: string
    entry_fee: number
    max_players: number | null
    is_rated: number
  }>()

  if (!tournament) return errorResponse('Tournament not found', 404)

  // Same rule as online registration — rated games need a USCF ID for the report
  if (tournament.is_rated && !uscfId) {
    return errorResponse('A USCF ID is required for walk-ins to rated tournaments', 400)
  }

  const sectionList = parseSectionList(tournament.sections)
  const sectionMatch = sectionList.find((s) => s.name === section)
  if (!sectionMatch) return errorResponse('Invalid section', 400)

  if (tournament.max_players != null) {
    const countRow = await context.env.DB.prepare(
      'SELECT COUNT(*) as count FROM registrations WHERE tournament_id = ? AND withdrawn_at IS NULL',
    ).bind(tournamentId).first<{ count: number }>()
    if ((countRow?.count ?? 0) >= tournament.max_players) {
      return errorResponse('This tournament is full', 400)
    }
  }

  // Duplicate guard: an active registration with this USCF ID already here?
  // (Withdrawn matches are allowed through — the TD should reinstate instead,
  // and the 409 message on the reinstate path will point them right.)
  if (uscfId) {
    const dup = await context.env.DB.prepare(
      `SELECT r.id FROM registrations r
       JOIN members m ON m.id = r.member_id
       WHERE r.tournament_id = ? AND m.uscf_id = ? AND r.withdrawn_at IS NULL
       LIMIT 1`,
    ).bind(tournamentId, uscfId).first()
    if (dup) return errorResponse('A player with this USCF ID is already registered', 409)
  }

  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  const guestId = `guest-${suffix}`
  const registrationId = `reg-${tournamentId}-${suffix}`
  const paymentId = `pay-${registrationId}`
  const amount = sectionMatch.entryFee ?? tournament.entry_fee
  const markPaid = body?.markPaid !== false // default: paid at the door
  const regStatus = markPaid ? 'paid' : 'pending'
  const payStatus = markPaid ? 'completed' : 'pending'

  await context.env.DB.batch([
    // .invalid is a reserved TLD — this address can never receive mail,
    // so no reminder/announce system can ever accidentally email a guest.
    context.env.DB.prepare(
      `INSERT INTO members (id, email, full_name, uscf_id, uscf_rating, membership_status, role)
       VALUES (?, ?, ?, ?, ?, 'pending', 'guest')`,
    ).bind(guestId, `${guestId}@walkin.lca.invalid`, fullName, uscfId, body?.uscfRating ?? null),
    context.env.DB.prepare(
      `INSERT INTO registrations (id, tournament_id, member_id, section, payment_status, bye_rounds)
       VALUES (?, ?, ?, ?, ?, NULL)`,
    ).bind(registrationId, tournamentId, guestId, section, regStatus),
    // Cash/check payment recorded for reconciliation; no stripe_session_id
    // is itself the marker that Stripe was never involved.
    context.env.DB.prepare(
      `INSERT INTO payments (id, member_id, amount, type, reference_id, status)
       VALUES (?, ?, ?, 'tournament', ?, ?)`,
    ).bind(paymentId, guestId, amount, registrationId, payStatus),
  ])

  const registration = await context.env.DB.prepare(
    'SELECT * FROM registrations WHERE id = ?',
  ).bind(registrationId).first()

  return jsonResponse({ registration, guestId }, 201)
}
