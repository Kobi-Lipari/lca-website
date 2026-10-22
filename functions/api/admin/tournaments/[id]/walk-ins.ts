// functions/api/admin/tournaments/[id]/walk-ins.ts
//
// The director enters a player who turns up at the door. The player gets a
// guest record (no sign-in, an address that can never receive mail), the
// entry and a cash or check payment row, in one batch.
//
// The section comes from the tournament_sections table: only a live section
// takes a walk-in, matched by its exact name as the director typed or chose
// it, and the entry carries that section's id. The 0053 trigger that fills
// section_id from the name stays installed as a safety net and leaves an id
// set here alone. The fee is the section's regular fee (else the event fee):
// no early, late or member pricing at the door.
import type { Env } from '../../../../types'
import { isResponse, requireTournamentManager } from '../../../../utils/auth'
import { errorResponse, handleOptions, jsonResponse, parseBody } from '../../../../utils/response'
import { getDb } from '../../../../db/client'
import { members, payments, registrations } from '../../../../db/schema'
import { loadSections } from '../../../../utils/events/sectionsRepo'
import { walkInRequestSchema } from '../../../../../domain/contracts/registration'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const tournamentId = context.params.id as string
  const authResult = await requireTournamentManager(context.request, context.env, tournamentId)
  if (isResponse(authResult)) return authResult

  const body = await parseBody(context.request, walkInRequestSchema)
  if (isResponse(body)) return body
  const fullName = body.fullName
  const uscfId = body.uscfId?.trim() || null
  const uscfRating = body.uscfRating ?? null
  const db = getDb(context.env.DB)

  const tournament = await context.env.DB.prepare(
    'SELECT id, name, entry_fee, max_players, is_rated FROM tournaments WHERE id = ?',
  ).bind(tournamentId).first<{
    id: string
    name: string
    entry_fee: number
    max_players: number | null
    is_rated: number
  }>()

  if (!tournament) return errorResponse('Tournament not found', 404)

  // Same rule as online registration: rated games need a US Chess ID for the report
  if (tournament.is_rated && !uscfId) {
    return errorResponse('A US Chess ID is required for walk-ins to rated tournaments.', 400)
  }

  // Live sections only, matched by exact name (case and all), as before.
  const section = (await loadSections(db, tournament.id)).find((s) => s.name === body.section)
  if (!section) return errorResponse('Invalid section', 400)

  if (tournament.max_players != null) {
    const countRow = await context.env.DB.prepare(
      'SELECT COUNT(*) as count FROM registrations WHERE tournament_id = ? AND withdrawn_at IS NULL',
    ).bind(tournamentId).first<{ count: number }>()
    if ((countRow?.count ?? 0) >= tournament.max_players) {
      return errorResponse('This tournament is full', 400)
    }
  }

  // Duplicate guard: an active registration with this US Chess ID already here?
  // (Withdrawn matches are allowed through: the TD should reinstate instead,
  // and the 409 message on the reinstate path will point them right.)
  if (uscfId) {
    const dup = await context.env.DB.prepare(
      `SELECT r.id FROM registrations r
       JOIN members m ON m.id = r.member_id
       WHERE r.tournament_id = ? AND m.uscf_id = ? AND r.withdrawn_at IS NULL
       LIMIT 1`,
    ).bind(tournamentId, uscfId).first()
    if (dup) return errorResponse('A player with this US Chess ID is already registered.', 409)
  }

  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  const guestId = `guest-${suffix}`
  const registrationId = `reg-${tournamentId}-${suffix}`
  const paymentId = `pay-${registrationId}`
  const amount = section.feeRegular ?? tournament.entry_fee
  const markPaid = body.markPaid !== false // default: paid at the door

  await db.batch([
    // .invalid is a reserved TLD: this address can never receive mail,
    // so no reminder/announce system can ever accidentally email a guest.
    db.insert(members).values({
      id: guestId,
      email: `${guestId}@walkin.lca.invalid`,
      fullName,
      uscfId,
      uscfRating,
      membershipStatus: 'pending',
      role: 'guest',
    }),
    db.insert(registrations).values({
      id: registrationId,
      tournamentId: tournament.id,
      memberId: guestId,
      section: section.name,
      sectionId: section.id,
      paymentStatus: markPaid ? 'paid' : 'pending',
      byeRounds: null,
      ratingAtEntry: uscfRating,
    }),
    // Cash/check payment recorded for reconciliation; no stripe_session_id
    // is itself the marker that Stripe was never involved.
    db.insert(payments).values({
      id: paymentId,
      memberId: guestId,
      amount,
      type: 'tournament',
      referenceId: registrationId,
      status: markPaid ? 'completed' : 'pending',
    }),
  ])

  const registration = await context.env.DB.prepare(
    'SELECT * FROM registrations WHERE id = ?',
  ).bind(registrationId).first()

  return jsonResponse({ registration, guestId }, 201)
}
