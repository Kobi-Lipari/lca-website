import type { Env } from '../types'
import { isResponse, requireAuthedMember } from '../utils/auth'
import {
  errorResponse,
  handleOptions,
  jsonResponse,
  parseJsonBody,
} from '../utils/response'

interface RegistrationBody {
  tournamentId?: string
  section?: string
}

function parseSectionNames(sectionsJson: string): string[] {
  try {
    const parsed = JSON.parse(sectionsJson) as Array<{ name: string } | string>
    return parsed.map((s) => (typeof s === 'string' ? s : s.name))
  } catch {
    return []
  }
}

function getSectionEntryFee(
  sectionsJson: string,
  sectionName: string,
  defaultFee: number,
): number {
  try {
    const parsed = JSON.parse(sectionsJson) as Array<{
      name: string
      entryFee?: number
    }>
    const match = parsed.find((s) => s.name === sectionName)
    return match?.entryFee ?? defaultFee
  } catch {
    return defaultFee
  }
}

function paymentUrl(env: Env, type: 'tournament' | 'membership'): string {
  if (type === 'tournament') {
    return (
      env.STRIPE_TOURNAMENT_PAYMENT_URL ??
      'https://buy.stripe.com/test_lca_tournament_placeholder'
    )
  }
  return (
    env.STRIPE_MEMBERSHIP_URL ??
    'https://buy.stripe.com/test_lca_membership_placeholder'
  )
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
      sections: string
      entry_fee: number
      max_players: number | null
      name: string
    }>()

  if (!tournament) {
    return errorResponse('Tournament not found', 404)
  }

  if (tournament.status !== 'upcoming') {
    return errorResponse('Registration is closed for this tournament', 400)
  }

  const validSections = parseSectionNames(tournament.sections)
  if (!validSections.includes(body.section)) {
    return errorResponse('Invalid section', 400)
  }

  const existing = await context.env.DB.prepare(
    'SELECT id FROM registrations WHERE tournament_id = ? AND member_id = ?',
  )
    .bind(body.tournamentId, authed.member.id)
    .first()

  if (existing) {
    return errorResponse('You are already registered for this tournament', 409)
  }

  if (tournament.max_players != null) {
    const countRow = await context.env.DB.prepare(
      'SELECT COUNT(*) as count FROM registrations WHERE tournament_id = ?',
    )
      .bind(body.tournamentId)
      .first<{ count: number }>()

    if ((countRow?.count ?? 0) >= tournament.max_players) {
      return errorResponse('This tournament is full', 400)
    }
  }

  const registrationId = `reg-${body.tournamentId}-${Date.now().toString(36)}`
  const paymentId = `pay-${registrationId}`
  const amount = getSectionEntryFee(
    tournament.sections,
    body.section,
    tournament.entry_fee,
  )

  await context.env.DB.batch([
    context.env.DB.prepare(
      `INSERT INTO registrations (id, tournament_id, member_id, section, payment_status)
       VALUES (?, ?, ?, ?, 'pending')`,
    ).bind(registrationId, body.tournamentId, authed.member.id, body.section),
    context.env.DB.prepare(
      `INSERT INTO payments (id, member_id, amount, type, reference_id, status)
       VALUES (?, ?, ?, 'tournament', ?, 'pending')`,
    ).bind(paymentId, authed.member.id, amount, registrationId),
  ])

  const registration = await context.env.DB.prepare(
    'SELECT * FROM registrations WHERE id = ?',
  )
    .bind(registrationId)
    .first()

  return jsonResponse(
    {
      registration,
      payment: {
        id: paymentId,
        amount,
        status: 'pending',
      },
      paymentUrl: paymentUrl(context.env, 'tournament'),
      message: `Registered for ${tournament.name} (${body.section}). Complete payment to confirm your spot.`,
    },
    201,
  )
}
