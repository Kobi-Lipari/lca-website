// functions/api/registrations/[id]/pay.ts
import type { Env } from '../../../types'
import {
  isResponse,
  requireAuthedMember,
  requireTournamentManager,
} from '../../../utils/auth'
import { createCheckoutSession } from '../../../utils/stripe'
import { errorResponse, handleOptions, jsonResponse } from '../../../utils/response'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const registrationId = context.params.id as string

  const authed = await requireAuthedMember(context.request, context.env)
  if (isResponse(authed)) return authed

  const registration = await context.env.DB.prepare(
    'SELECT * FROM registrations WHERE id = ?',
  ).bind(registrationId).first<{
    id: string
    tournament_id: string
    member_id: string
    section: string
    payment_status: string
  }>()

  if (!registration) return errorResponse('Registration not found', 404)

  const isOwner = registration.member_id === authed.member.id
  if (!isOwner) {
    const managerResult = await requireTournamentManager(
      context.request,
      context.env,
      registration.tournament_id,
    )
    if (isResponse(managerResult)) return errorResponse('Forbidden', 403)
  }

  if (registration.payment_status !== 'pending') {
    return errorResponse('This registration does not have a pending payment', 400)
  }

  // Amount comes from the payment row, not recomputed from the section —
  // this automatically honors any fee reconciliation from a section change.
  const payment = await context.env.DB.prepare(
    `SELECT id, amount, status FROM payments
     WHERE reference_id = ? AND type = 'tournament'`,
  ).bind(registrationId).first<{ id: string; amount: number; status: string }>()

  if (!payment) return errorResponse('No payment record found for this registration', 404)
  if (payment.status === 'completed') {
    return errorResponse('This payment has already been completed', 400)
  }
  if (payment.amount <= 0) {
    return errorResponse('No payment is due for this registration', 400)
  }

  const tournament = await context.env.DB.prepare(
    'SELECT name FROM tournaments WHERE id = ?',
  ).bind(registration.tournament_id).first<{ name: string }>()

  if (!tournament) return errorResponse('Tournament not found', 404)

  const origin = new URL(context.request.url).origin
  try {
    const session = await createCheckoutSession(context.env.STRIPE_SECRET_KEY, {
      productName: `${tournament.name} — ${registration.section} entry`,
      amountUsd: payment.amount,
      successUrl: `${origin}/tournaments/${registration.tournament_id}?payment=success`,
      cancelUrl: `${origin}/tournaments/${registration.tournament_id}?payment=cancelled`,
      clientReferenceId: payment.id,
      metadata: {
        type: 'tournament',
        payment_id: payment.id,
        registration_id: registrationId,
        member_id: registration.member_id,
      },
    })

    // Keep the payment row pointing at the latest payable session — a future
    // hook for expiring superseded sessions via the Stripe API.
    await context.env.DB.prepare(
      'UPDATE payments SET stripe_session_id = ? WHERE id = ?',
    ).bind(session.id, payment.id).run()

    return jsonResponse({ paymentUrl: session.url })
  } catch (err) {
    console.error('Stripe session creation failed:', err)
    return errorResponse('Could not start the payment process. Please try again.', 502)
  }
}
