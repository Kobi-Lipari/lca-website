// functions/api/registrations.ts
import type { Env } from '../types'
import { isResponse, requireAuthedMember } from '../utils/auth'
import { createCheckoutSession } from '../utils/stripe'
import { errorResponse, handleOptions, jsonResponse, parseJsonBody } from '../utils/response'
import { sendRegistrationConfirmations } from '../utils/registrationEmails'
import { resolveSiteUrl } from '../utils/site'
import { hasPassed } from '../utils/time'
import { eligibilityProblem, formatGradeRange, parseGradeRange, type SectionWithRules } from '../utils/sectionRules'
import { entryPrice } from '../utils/pricing'
import { checkByeRequest } from '../utils/byes'

interface RegistrationBody {
  tournamentId?: string
  section?: string
  byeRounds?: number[]
  /**
   * The grade range the player confirmed they're in, "min-max" with K = 0
   * (e.g. "0-8" for "8th grade or below"). We never ask the actual grade.
   */
  gradeRange?: string
  /** Join the waitlist when the event is full. */
  waitlist?: boolean
}

function parseSections(sectionsJson: string): SectionWithRules[] {
  try {
    const parsed = JSON.parse(sectionsJson) as Array<SectionWithRules | string>
    return parsed.map((s) => (typeof s === 'string' ? { name: s } : s))
  } catch {
    return []
  }
}

function parseSectionNames(sectionsJson: string): string[] {
  try {
    const parsed = JSON.parse(sectionsJson) as Array<{ name: string } | string>
    return parsed.map((s) => (typeof s === 'string' ? s : s.name))
  } catch {
    return []
  }
}

/**
 * The registration and its payment row, written only if the member is not
 * already entered and a seat is still free.
 *
 * The handler checks both before it gets here, but several statements (and,
 * for a paid section, a Stripe call) earlier, so two requests can both pass:
 * two people going for the last seat, or one person submitting twice. Here
 * the same conditions are part of the insert itself, where nothing can come
 * in between. The first result's meta.changes is 0 when nothing was written.
 */
function guardedEntryStatements(db: D1Database, e: {
  registrationId: string
  tournamentId: string
  memberId: string
  section: string
  paymentStatus: 'paid' | 'pending'
  byeRounds: number[]
  grade: string | null
  paymentId: string
  amount: number
  sessionId: string | null
}): D1PreparedStatement[] {
  return [
    db.prepare(
      `INSERT INTO registrations (id, tournament_id, member_id, section, payment_status, bye_rounds, rating_at_entry, grade)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, (SELECT uscf_rating FROM members WHERE id = ?3), ?7
        WHERE NOT EXISTS (SELECT 1 FROM registrations WHERE tournament_id = ?2 AND member_id = ?3)
          AND (SELECT max_players IS NULL OR max_players > (
                 SELECT COUNT(*) FROM registrations
                  WHERE tournament_id = ?2 AND withdrawn_at IS NULL AND waitlisted_at IS NULL)
                 FROM tournaments WHERE id = ?2)`,
    ).bind(
      e.registrationId,
      e.tournamentId,
      e.memberId,
      e.section,
      e.paymentStatus,
      e.byeRounds.length > 0 ? JSON.stringify(e.byeRounds) : null,
      e.grade,
    ),
    db.prepare(
      `INSERT INTO payments (id, member_id, amount, type, reference_id, status, stripe_session_id)
       SELECT ?1, ?2, ?3, 'tournament', ?4, ?5, ?6
        WHERE EXISTS (SELECT 1 FROM registrations WHERE id = ?4)`,
    ).bind(
      e.paymentId,
      e.memberId,
      e.amount,
      e.registrationId,
      e.paymentStatus === 'paid' ? 'completed' : 'pending',
      e.sessionId,
    ),
  ]
}

/** What to tell the request that lost: someone else took the seat, or this
 *  member's own other request got in first. */
async function lostTheSeat(db: D1Database, tournamentId: string, memberId: string): Promise<Response> {
  const mine = await db.prepare(
    'SELECT 1 FROM registrations WHERE tournament_id = ? AND member_id = ?',
  ).bind(tournamentId, memberId).first()
  return mine
    ? errorResponse('You are already registered for this tournament', 409)
    : jsonResponse({ error: 'This tournament is full. You can join the waitlist.', full: true }, 400)
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

  // Rated tournament requires USCF ID
  if (tournament.is_rated && !authed.member.uscf_id) {
    return errorResponse('A USCF ID is required to register for rated tournaments', 400)
  }

  const validSections = parseSectionNames(tournament.sections)
  if (!validSections.includes(body.section)) {
    return errorResponse('Invalid section', 400)
  }

  // Section eligibility (rating, grade). Directors can still place anyone by hand.
  const section = parseSections(tournament.sections).find((s) => s.name === body.section) as SectionWithRules
  const gradeRange = parseGradeRange(body.gradeRange ?? null)
  const problem = eligibilityProblem(section, { rating: authed.member.uscf_rating ?? null, gradeRange })
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

  // Validate bye rounds — max is rounds - 1. Before the capacity check,
  // because a waitlist entry stores them too and becomes a real entry, byes
  // and all, when the director offers the spot.
  const byes = checkByeRequest(body.byeRounds, tournament.rounds)
  if (!byes.ok) {
    if (byes.problem === 'malformed') {
      return errorResponse('byeRounds must be an array of whole numbers', 400)
    }
    if (byes.problem === 'too-many') {
      return errorResponse(
        `You can request at most ${byes.maxByes} bye${byes.maxByes !== 1 ? 's' : ''} (one less than total rounds)`,
        400,
      )
    }
    return errorResponse(`Round ${byes.round} is not valid for this tournament`, 400)
  }
  const byeRounds = byes.byeRounds

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
      const waitId = `reg-${body.tournamentId}-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 4)}`
      // Guarded like the entry itself, so submitting twice joins once.
      const joined = await context.env.DB.prepare(
        `INSERT INTO registrations (id, tournament_id, member_id, section, payment_status, bye_rounds, rating_at_entry, grade, waitlisted_at)
         SELECT ?1, ?2, ?3, ?4, 'pending', ?5, ?6, ?7, datetime('now')
          WHERE NOT EXISTS (SELECT 1 FROM registrations WHERE tournament_id = ?2 AND member_id = ?3)`,
      ).bind(waitId, body.tournamentId, authed.member.id, body.section,
        byeRounds.length > 0 ? JSON.stringify(byeRounds) : null,
        authed.member.uscf_rating ?? null, gradeText).run()
      if (joined.meta.changes === 0) {
        return errorResponse("You're already on the waitlist for this tournament", 409)
      }
      return jsonResponse({
        registration: { id: waitId, waitlisted: true },
        paymentUrl: null,
        message: `You're on the waitlist for ${tournament.name}. If a spot opens, the director will email you.`,
      }, 201)
    }
  }

  // The random part keeps two entries made in the same millisecond apart.
  const registrationId = `reg-${body.tournamentId}-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 4)}`
  const paymentId = `pay-${registrationId}`
  const entry = {
    registrationId,
    tournamentId: body.tournamentId,
    memberId: authed.member.id,
    section: body.section,
    byeRounds,
    grade: gradeText,
    paymentId,
  }
  const amount = entryPrice(tournament, body.section, {
    isLcaMember: authed.member.membership_status === 'active',
  }).amount
  // Heads-up, not a block: the director may sell memberships at the door.
  const warnings: string[] = []
  if (tournament.is_rated && authed.member.uscf_expiration && authed.member.uscf_expiration.slice(0, 10) < String(tournament.date).slice(0, 10)) {
    warnings.push(`Your US Chess membership expires ${authed.member.uscf_expiration.slice(0, 10)}, before this event. Renew it at uschess.org so your games can be rated.`)
  }

  // ── Free section: no Stripe involved, registered & paid immediately ──────
  if (amount <= 0) {
    const [inserted] = await context.env.DB.batch(guardedEntryStatements(context.env.DB, {
      ...entry, paymentStatus: 'paid', amount: 0, sessionId: null,
    }))
    if (inserted.meta.changes === 0) return lostTheSeat(context.env.DB, entry.tournamentId, entry.memberId)

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

  // The checkout session made above is simply never handed out when this
  // writes nothing, so nobody can pay for an entry that does not exist.
  const [inserted] = await context.env.DB.batch(guardedEntryStatements(context.env.DB, {
    ...entry, paymentStatus: 'pending', amount, sessionId: session.id,
  }))
  if (inserted.meta.changes === 0) return lostTheSeat(context.env.DB, entry.tournamentId, entry.memberId)

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
