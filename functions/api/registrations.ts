// functions/api/registrations.ts
import type { Env } from '../types'
import { isResponse, requireAuthedMember } from '../utils/auth'
import { createCheckoutSession } from '../utils/stripe'
import { errorResponse, handleOptions, jsonResponse, parseJsonBody } from '../utils/response'

interface RegistrationBody {
  tournamentId?: string
  section?: string
  byeRounds?: number[]
}

function parseSectionNames(sectionsJson: string): string[] {
  try {
    const parsed = JSON.parse(sectionsJson) as Array<{ name: string } | string>
    return parsed.map((s) => (typeof s === 'string' ? s : s.name))
  } catch {
    return []
  }
}

function getSectionEntryFee(sectionsJson: string, sectionName: string, defaultFee: number): number {
  try {
    const parsed = JSON.parse(sectionsJson) as Array<{ name: string; entryFee?: number }>
    const match = parsed.find((s) => s.name === sectionName)
    return match?.entryFee ?? defaultFee
  } catch {
    return defaultFee
  }
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const authed = await requireAuthedMember(context.request, context.env)
  if (isResponse(authed)) return authed

  const body = await parseJsonBody<RegistrationBody>(context.request)
  if (!body?.tournamentId || !body.section) {
    return errorResponse('tournamentId and section are required', 400)
  }

  const tournament = await context.env.DB.prepare(
    'SELECT * FROM tournaments WHERE id = ?',
  )
    .bind(body.tournamentId)
    .first<{
      id: string
      status: string
      registration_status: string
      registration_closes_at: string | null
      sections: string
      entry_fee: number
      max_players: number | null
      name: string
      rounds: number
      is_rated: number
    }>()

  if (!tournament) return errorResponse('Tournament not found', 404)

  if (tournament.registration_status !== 'open') {
    return errorResponse('Registration is not open for this tournament', 400)
  }

  // Belt-and-suspenders deadline enforcement: even if no cron has flipped
  // registration_status yet, a past auto-close timestamp closes registration.
  if (
    tournament.registration_closes_at &&
    new Date(tournament.registration_closes_at).getTime() <= Date.now()
  ) {
    return errorResponse('Registration is closed for this tournament', 400)
  }

  // Rated tournament requires USCF ID
  if (tournament.is_rated && !authed.member.uscf_id) {
    return errorResponse('A USCF ID is required to register for rated tournaments', 400)
  }

  const validSections = parseSectionNames(tournament.sections)
  if (!validSections.includes(body.section)) {
    return errorResponse('Invalid section', 400)
  }

  const existing = await context.env.DB.prepare(
    'SELECT id, withdrawn_at FROM registrations WHERE tournament_id = ? AND member_id = ?',
  )
    .bind(body.tournamentId, authed.member.id)
    .first<{ id: string; withdrawn_at: string | null }>()

  if (existing) {
    return errorResponse(
      existing.withdrawn_at
        ? 'You were withdrawn from this tournament. Ask the tournament director to reinstate you.'
        : 'You are already registered for this tournament',
      409,
    )
  }

  if (tournament.max_players != null) {
    const countRow = await context.env.DB.prepare(
      'SELECT COUNT(*) as count FROM registrations WHERE tournament_id = ? AND withdrawn_at IS NULL',
    )
      .bind(body.tournamentId)
      .first<{ count: number }>()

    if ((countRow?.count ?? 0) >= tournament.max_players) {
      return errorResponse('This tournament is full', 400)
    }
  }

  // Validate bye rounds — max is rounds - 1
  const byeRounds = body.byeRounds ?? []
  const maxByes = tournament.rounds - 1
  if (byeRounds.length > maxByes) {
    return errorResponse(
      `You can request at most ${maxByes} bye${maxByes !== 1 ? 's' : ''} (one less than total rounds)`,
      400,
    )
  }
  const invalidRound = byeRounds.find((r) => r < 1 || r > tournament.rounds)
  if (invalidRound !== undefined) {
    return errorResponse(`Round ${invalidRound} is not valid for this tournament`, 400)
  }

  const registrationId = `reg-${body.tournamentId}-${Date.now().toString(36)}`
  const paymentId = `pay-${registrationId}`
  const amount = getSectionEntryFee(tournament.sections, body.section, tournament.entry_fee)

  // ── Free section: no Stripe involved, registered & paid immediately ──────
  if (amount <= 0) {
    await context.env.DB.batch([
      context.env.DB.prepare(
        `INSERT INTO registrations (id, tournament_id, member_id, section, payment_status, bye_rounds)
         VALUES (?, ?, ?, ?, 'paid', ?)`,
      ).bind(
        registrationId,
        body.tournamentId,
        authed.member.id,
        body.section,
        byeRounds.length > 0 ? JSON.stringify(byeRounds) : null,
      ),
      context.env.DB.prepare(
        `INSERT INTO payments (id, member_id, amount, type, reference_id, status)
         VALUES (?, ?, 0, 'tournament', ?, 'completed')`,
      ).bind(paymentId, authed.member.id, registrationId),
    ])

    const registration = await context.env.DB.prepare(
      'SELECT * FROM registrations WHERE id = ?',
    ).bind(registrationId).first()

    return jsonResponse(
      {
        registration,
        payment: { id: paymentId, amount: 0, status: 'completed' },
        paymentUrl: null,
        message: `Registered for ${tournament.name} (${body.section}). No entry fee for this section — you're all set.`,
      },
      201,
    )
  }

  // ── Paid section: create the Checkout Session BEFORE inserting rows ──────
  // (Reverse order would leave an orphaned registration blocking
  // re-registration whenever Stripe errors.)
  const origin = new URL(context.request.url).origin
  let session: { id: string; url: string }
  try {
    session = await createCheckoutSession(context.env.STRIPE_SECRET_KEY, {
      productName: `${tournament.name} — ${body.section} entry`,
      amountUsd: amount,
      successUrl: `${origin}/tournaments/${body.tournamentId}?payment=success`,
      cancelUrl: `${origin}/tournaments/${body.tournamentId}?payment=cancelled`,
      clientReferenceId: paymentId,
      metadata: {
        type: 'tournament',
        payment_id: paymentId,
        registration_id: registrationId,
        member_id: authed.member.id,
      },
    })
  } catch (err) {
    console.error('Stripe session creation failed:', err)
    return errorResponse(
      'Could not start the payment process. Please try again in a moment.',
      502,
    )
  }

  await context.env.DB.batch([
    context.env.DB.prepare(
      `INSERT INTO registrations (id, tournament_id, member_id, section, payment_status, bye_rounds)
       VALUES (?, ?, ?, ?, 'pending', ?)`,
    ).bind(
      registrationId,
      body.tournamentId,
      authed.member.id,
      body.section,
      byeRounds.length > 0 ? JSON.stringify(byeRounds) : null,
    ),
    context.env.DB.prepare(
      `INSERT INTO payments (id, member_id, amount, type, reference_id, status, stripe_session_id)
       VALUES (?, ?, ?, 'tournament', ?, 'pending', ?)`,
    ).bind(paymentId, authed.member.id, amount, registrationId, session.id),
  ])

  const registration = await context.env.DB.prepare(
    'SELECT * FROM registrations WHERE id = ?',
  ).bind(registrationId).first()

  return jsonResponse(
    {
      registration,
      payment: { id: paymentId, amount, status: 'pending' },
      paymentUrl: session.url,
      message: `Registered for ${tournament.name} (${body.section}). Complete payment to confirm your spot.`,
    },
    201,
  )
}
