// functions/api/registrations/batch.ts
//
// Register several players for one tournament in a single checkout — a
// parent entering themselves and their children. The single-player flow in
// ../registrations.ts is unchanged; this sits beside it.
//
// Each player still gets their own registration and payment row, exactly as
// if they had registered alone, so everything downstream (the roster, the
// director's payment toggles, "pay now" on one pending entry, withdrawals)
// works per player. Only the Stripe checkout is shared: every paid entry's
// payment row carries the same session id, and the webhook settles them all.
//
// The sections are read once, from the tournament_sections table (live rows
// only, so a removed section takes no new entries), and every entry written
// here carries its section_id.
import { sql } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import type { Env } from '../../types'
import { isResponse, requireAuthedMember } from '../../utils/auth'
import { canActFor } from '../../utils/family'
import { createCheckoutSession } from '../../utils/stripe'
import { errorResponse, handleOptions, jsonResponse, parseBody } from '../../utils/response'
import { sendRegistrationConfirmations } from '../../utils/registrationEmails'
import { resolveSiteUrl } from '../../utils/site'
import { hasPassed } from '../../utils/time'
import { eligibilityProblem, formatGradeRange, parseGradeRange } from '../../utils/sectionRules'
import { priceEntry } from '../../utils/pricing'
import { getDb } from '../../db/client'
import { payments, registrations } from '../../db/schema'
import { loadSections, runBatch, sectionWithRules } from '../../utils/events/sectionsRepo'
import { batchRegistrationRequestSchema } from '../../../domain/contracts/registration'

const MAX_ENTRIES = 9

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const authed = await requireAuthedMember(context.request, context.env)
  if (isResponse(authed)) return authed
  const payer = authed.member
  const db = context.env.DB

  // Each entry is one player: memberId omitted means the signed-in member,
  // and gradeRange is the range they confirmed, "min-max" (K = 0).
  const body = await parseBody(context.request, batchRegistrationRequestSchema)
  if (isResponse(body)) return body
  const entries = body.entries
  if (entries.length === 0) {
    return errorResponse('Choose at least one player.', 400)
  }
  if (entries.length > MAX_ENTRIES) {
    return errorResponse(`At most ${MAX_ENTRIES} players can be registered at once`, 400)
  }

  const tournament = await db.prepare('SELECT * FROM tournaments WHERE id = ?')
    .bind(body.tournamentId)
    .first<{
      id: string
      name: string
      registration_status: string
      registration_closes_at: string | null
      entry_fee: number
      max_players: number | null
      rounds: number
      is_rated: number
      early_deadline: string | null
      early_discount: number | null
      late_after: string | null
      late_fee: number | null
      member_discount: number | null
    }>()
  if (!tournament) return errorResponse('Tournament not found', 404)

  if (tournament.registration_status !== 'open') {
    return errorResponse('Registration is not open for this tournament', 400)
  }
  if (hasPassed(tournament.registration_closes_at)) {
    return errorResponse('Registration is closed for this tournament', 400)
  }

  const orm = getDb(db)
  const sections = await loadSections(orm, tournament.id)
  const now = Date.now()
  const maxByes = tournament.rounds - 1

  // ── Validate every entry before writing anything ──────────────────────────
  const seen = new Set<string>()
  const resolved: Array<{
    memberId: string
    name: string
    section: string
    sectionId: string
    byeRounds: number[]
    amount: number
    grade: string | null
  }> = []

  for (const entry of entries) {
    const memberId = entry.memberId || payer.id
    if (seen.has(memberId)) return errorResponse('Each player can only be entered once', 400)
    seen.add(memberId)

    if (!(await canActFor(db, payer.id, memberId))) {
      return errorResponse('You can only register yourself and your own children', 403)
    }

    const player = await db.prepare(
      'SELECT id, full_name, uscf_id, uscf_rating, membership_status FROM members WHERE id = ?',
    )
      .bind(memberId)
      .first<{ id: string; full_name: string; uscf_id: string | null; uscf_rating: number | null; membership_status: string }>()
    if (!player) return errorResponse('Player not found', 404)

    if (tournament.is_rated && !player.uscf_id) {
      return errorResponse(`${player.full_name} needs a US Chess ID to enter a rated tournament. Add it on your profile.`, 400)
    }

    const section = sections.find((s) => s.name === entry.section)
    if (!section) return errorResponse(`Choose a valid section for ${player.full_name}`, 400)
    const gradeRange = parseGradeRange(entry.gradeRange ?? null)
    const problem = eligibilityProblem(sectionWithRules(section), { rating: player.uscf_rating, gradeRange })
    if (problem) return errorResponse(`${player.full_name}: ${problem}`, 400)

    const byeRounds = entry.byeRounds ?? []
    if (byeRounds.length > maxByes) {
      return errorResponse(`${player.full_name}: at most ${maxByes} bye${maxByes !== 1 ? 's' : ''}`, 400)
    }
    if (byeRounds.some((r) => !Number.isInteger(r) || r < 1 || r > tournament.rounds)) {
      return errorResponse(`${player.full_name}: a requested bye round is not part of this tournament`, 400)
    }

    const existing = await db.prepare(
      'SELECT withdrawn_at FROM registrations WHERE tournament_id = ? AND member_id = ?',
    ).bind(tournament.id, memberId).first<{ withdrawn_at: string | null }>()
    if (existing) {
      return errorResponse(
        existing.withdrawn_at
          ? `${player.full_name} was withdrawn from this tournament. Ask the tournament director to reinstate them.`
          : `${player.full_name} is already registered for this tournament`,
        409,
      )
    }

    resolved.push({
      memberId,
      name: player.full_name,
      section: section.name,
      sectionId: section.id,
      byeRounds,
      amount: priceEntry(section, tournament, now, { isLcaMember: player.membership_status === 'active' }).amount,
      grade: gradeRange ? formatGradeRange(gradeRange) : null,
    })
  }

  if (tournament.max_players != null) {
    const countRow = await db.prepare(
      'SELECT COUNT(*) as count FROM registrations WHERE tournament_id = ? AND withdrawn_at IS NULL AND waitlisted_at IS NULL',
    ).bind(tournament.id).first<{ count: number }>()
    const left = tournament.max_players - (countRow?.count ?? 0)
    if (left < resolved.length) {
      return errorResponse(
        left <= 0
          ? 'This tournament is full'
          : `Only ${left} spot${left === 1 ? '' : 's'} left — fewer than the ${resolved.length} players you selected`,
        400,
      )
    }
  }

  // ── Checkout for the paid entries (before any rows exist) ────────────────
  const stamp = Date.now().toString(36)
  const rows = resolved.map((r, i) => {
    const registrationId = `reg-${tournament.id}-${stamp}-${i}${crypto.randomUUID().slice(0, 4)}`
    return { ...r, registrationId, paymentId: `pay-${registrationId}` }
  })
  const paid = rows.filter((r) => r.amount > 0)
  const total = paid.reduce((sum, r) => sum + r.amount, 0)

  let session: { id: string; url: string } | null = null
  if (paid.length > 0) {
    const origin = new URL(context.request.url).origin
    try {
      session = await createCheckoutSession(context.env.STRIPE_SECRET_KEY, {
        productName: `${tournament.name} entries`,
        amountUsd: total,
        lineItems: paid.map((r) => ({ name: `${tournament.name} — ${r.name} (${r.section})`, amountUsd: r.amount })),
        successUrl: `${origin}/tournaments/${tournament.id}?payment=success`,
        cancelUrl: `${origin}/tournaments/${tournament.id}?payment=cancelled`,
        clientReferenceId: `batch-${tournament.id}-${stamp}`,
        customerEmail: payer.email,
        metadata: {
          type: 'tournament_batch',
          tournament_id: tournament.id,
          member_id: payer.id,
        },
      })
    } catch (err) {
      console.error('Stripe session creation failed:', err)
      return errorResponse('Could not start the payment process. Please try again in a moment.', 502)
    }
  }

  // ── Write every registration + payment together ──────────────────────────
  const statements: BatchItem<'sqlite'>[] = []
  for (const r of rows) {
    const free = r.amount <= 0
    statements.push(
      orm.insert(registrations).values({
        id: r.registrationId,
        tournamentId: tournament.id,
        memberId: r.memberId,
        section: r.section,
        sectionId: r.sectionId,
        paymentStatus: free ? 'paid' : 'pending',
        byeRounds: r.byeRounds.length > 0 ? JSON.stringify(r.byeRounds) : null,
        ratingAtEntry: sql`(SELECT uscf_rating FROM members WHERE id = ${r.memberId})`,
        grade: r.grade,
      }),
      orm.insert(payments).values({
        id: r.paymentId,
        memberId: r.memberId,
        amount: free ? 0 : r.amount,
        type: 'tournament',
        referenceId: r.registrationId,
        status: free ? 'completed' : 'pending',
        stripeSessionId: free ? null : session?.id ?? null,
      }),
    )
  }
  await runBatch(orm, statements)

  // Free entries are confirmed now; paid ones when Stripe reports payment.
  const confirmedNow = rows.filter((r) => r.amount <= 0).map((r) => r.registrationId)
  await sendRegistrationConfirmations(
    context.env, resolveSiteUrl(context.env, context.request), confirmedNow,
  )

  const names = rows.map((r) => r.name).join(', ')
  return jsonResponse(
    {
      registrations: rows.map((r) => ({
        id: r.registrationId,
        memberId: r.memberId,
        section: r.section,
        amount: r.amount,
        paymentStatus: r.amount > 0 ? 'pending' : 'paid',
      })),
      total,
      paymentUrl: session?.url ?? null,
      message: session
        ? `Registered ${names} for ${tournament.name}. Complete payment ($${total}) to confirm the spots.`
        : `Registered ${names} for ${tournament.name}. No entry fee — you're all set.`,
    },
    201,
  )
}
