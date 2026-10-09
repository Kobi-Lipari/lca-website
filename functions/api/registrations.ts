// functions/api/registrations.ts
//
// One player enters an event (createRegistration). The sections come from
// the tournament_sections table (live rows only, so a removed section takes
// no new entries), and every entry written here carries its section_id. The
// 0053 trigger that fills section_id from the name stays installed as a
// safety net and leaves an id set here alone.
import { sql } from 'drizzle-orm'
import type { Env } from '../types'
import { isResponse, requireAuthedMember } from '../utils/auth'
import { createCheckoutSession } from '../utils/stripe'
import { errorResponse, handleOptions, jsonResponse, parseBody } from '../utils/response'
import { sendRegistrationConfirmations } from '../utils/registrationEmails'
import { resolveSiteUrl } from '../utils/site'
import { hasPassed } from '../utils/time'
import { eligibilityProblem, formatGradeRange, parseGradeRange } from '../utils/sectionRules'
import { priceEntry } from '../utils/pricing'
import { getDb } from '../db/client'
import { payments, registrations } from '../db/schema'
import { loadSections, sectionWithRules } from '../utils/events/sectionsRepo'
import { createRegistrationRequestSchema } from '../../domain/contracts/registration'
import { formatDate } from '../../domain/format'

/** The player's rating as it is now, read inside the insert, as before. */
const ratingOf = (memberId: string) => sql`(SELECT uscf_rating FROM members WHERE id = ${memberId})`

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const authed = await requireAuthedMember(context.request, context.env)
  if (isResponse(authed)) return authed

  // The grade range is the one the player confirmed they're in, "min-max"
  // with K = 0 (e.g. "0-8" for "8th grade or below"). We never ask the
  // actual grade.
  const body = await parseBody(context.request, createRegistrationRequestSchema)
  if (isResponse(body)) return body
  const db = getDb(context.env.DB)

  const tournament = await context.env.DB.prepare(
    'SELECT * FROM tournaments WHERE id = ?',
  )
    .bind(body.tournamentId)
    .first<{
      id: string
      status: string
      registration_status: string
      registration_closes_at: string | null
      entry_fee: number
      max_players: number | null
      name: string
      date: string
      early_deadline: string | null
      early_discount: number | null
      late_after: string | null
      late_fee: number | null
      member_discount: number | null
      rounds: number
      is_rated: number
    }>()

  if (!tournament) return errorResponse('Tournament not found', 404)

  if (tournament.registration_status !== 'open') {
    return errorResponse('Registration is not open for this tournament', 400)
  }

  // Belt-and-suspenders deadline enforcement: even if no cron has flipped
  // registration_status yet, a past auto-close timestamp closes registration.
  if (hasPassed(tournament.registration_closes_at)) {
    return errorResponse('Registration is closed for this tournament', 400)
  }

  // A rated tournament needs the player's US Chess ID
  if (tournament.is_rated && !authed.member.uscf_id) {
    return errorResponse('A US Chess ID is required to enter a rated tournament.', 400)
  }

  const section = (await loadSections(db, tournament.id)).find((s) => s.name === body.section)
  if (!section) {
    return errorResponse('Invalid section', 400)
  }

  // Section eligibility (rating, grade). Directors can still place anyone by hand.
  const gradeRange = parseGradeRange(body.gradeRange ?? null)
  const problem = eligibilityProblem(sectionWithRules(section), { rating: authed.member.uscf_rating ?? null, gradeRange })
  if (problem) return errorResponse(problem, 400)
  const gradeText = gradeRange ? formatGradeRange(gradeRange) : null

  const existing = await context.env.DB.prepare(
    'SELECT id, withdrawn_at, waitlisted_at FROM registrations WHERE tournament_id = ? AND member_id = ?',
  )
    .bind(body.tournamentId, authed.member.id)
    .first<{ id: string; withdrawn_at: string | null; waitlisted_at: string | null }>()

  if (existing) {
    if (existing.waitlisted_at && !existing.withdrawn_at) {
      return errorResponse("You're already on the waitlist for this tournament", 409)
    }
    return errorResponse(
      existing.withdrawn_at
        ? 'You were withdrawn from this tournament. Ask the tournament director to reinstate you.'
        : 'You are already registered for this tournament',
      409,
    )
  }

  if (tournament.max_players != null) {
    const countRow = await context.env.DB.prepare(
      'SELECT COUNT(*) as count FROM registrations WHERE tournament_id = ? AND withdrawn_at IS NULL AND waitlisted_at IS NULL',
    )
      .bind(body.tournamentId)
      .first<{ count: number }>()

    if ((countRow?.count ?? 0) >= tournament.max_players) {
      if (!body.waitlist) {
        return jsonResponse({ error: 'This tournament is full. You can join the waitlist.', full: true }, 400)
      }
      // Waitlist: no charge until the director offers a spot.
      const waitId = `reg-${body.tournamentId}-${Date.now().toString(36)}`
      await db.insert(registrations).values({
        id: waitId,
        tournamentId: tournament.id,
        memberId: authed.member.id,
        section: section.name,
        sectionId: section.id,
        paymentStatus: 'pending',
        byeRounds: body.byeRounds?.length ? JSON.stringify(body.byeRounds) : null,
        ratingAtEntry: authed.member.uscf_rating ?? null,
        grade: gradeText,
        waitlistedAt: sql`datetime('now')`,
      })
      return jsonResponse({
        registration: { id: waitId, waitlisted: true },
        paymentUrl: null,
        message: `You're on the waitlist for ${tournament.name}. If a spot opens, the director will email you.`,
      }, 201)
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
  const amount = priceEntry(section, tournament, Date.now(), {
    isLcaMember: authed.member.membership_status === 'active',
  }).amount
  // Heads-up, not a block: the director may sell memberships at the door.
  const warnings: string[] = []
  if (tournament.is_rated && authed.member.uscf_expiration && authed.member.uscf_expiration.slice(0, 10) < String(tournament.date).slice(0, 10)) {
    warnings.push(`Your US Chess membership expires ${formatDate(authed.member.uscf_expiration.slice(0, 10), { year: true })}, before this event. Renew it at uschess.org so your games can be rated.`)
  }

  // The entry row, the same on the free and the paid path but for its payment status.
  const entry = (paymentStatus: 'paid' | 'pending') => db.insert(registrations).values({
    id: registrationId,
    tournamentId: tournament.id,
    memberId: authed.member.id,
    section: section.name,
    sectionId: section.id,
    paymentStatus,
    byeRounds: byeRounds.length > 0 ? JSON.stringify(byeRounds) : null,
    ratingAtEntry: ratingOf(authed.member.id),
    grade: gradeText,
  })

  // ── Free section: no Stripe involved, registered & paid immediately ──────
  if (amount <= 0) {
    await db.batch([
      entry('paid'),
      db.insert(payments).values({
        id: paymentId,
        memberId: authed.member.id,
        amount: 0,
        type: 'tournament',
        referenceId: registrationId,
        status: 'completed',
      }),
    ])

    const registration = await context.env.DB.prepare(
      'SELECT * FROM registrations WHERE id = ?',
    ).bind(registrationId).first()

    await sendRegistrationConfirmations(
      context.env, resolveSiteUrl(context.env, context.request), [registrationId],
    )

    return jsonResponse(
      {
        registration,
        payment: { id: paymentId, amount: 0, status: 'completed' },
        paymentUrl: null,
        warnings,
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

  await db.batch([
    entry('pending'),
    db.insert(payments).values({
      id: paymentId,
      memberId: authed.member.id,
      amount,
      type: 'tournament',
      referenceId: registrationId,
      status: 'pending',
      stripeSessionId: session.id,
    }),
  ])

  const registration = await context.env.DB.prepare(
    'SELECT * FROM registrations WHERE id = ?',
  ).bind(registrationId).first()

  return jsonResponse(
    {
      registration,
      payment: { id: paymentId, amount, status: 'pending' },
      paymentUrl: session.url,
      warnings,
      message: `Registered for ${tournament.name} (${body.section}). Complete payment to confirm your spot.`,
    },
    201,
  )
}
