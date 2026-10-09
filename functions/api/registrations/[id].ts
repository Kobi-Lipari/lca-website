// functions/api/registrations/[id].ts
//
// Changes one entry: byes, section, withdrawal, check-in and payment status
// (updateRegistration). Sections come from the tournament_sections table; a
// section change moves the entry by name and section_id together, so the
// 0053 trigger that re-resolves section_id from the name stays out of it.
// The entry update and any repriced payment are written in one batch.
import { eq } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import type { Env } from '../../types'
import {
  isResponse,
  requireAuthedMember,
  requireTournamentManager,
} from '../../utils/auth'
import { canActFor } from '../../utils/family'
import {
  errorResponse,
  handleOptions,
  jsonResponse,
  parseBody,
} from '../../utils/response'
import { recordAdminAction, type AuditEntry } from '../../utils/audit'
import { escapeHtml, trySendEmail } from '../../utils/email'
import { getDb } from '../../db/client'
import { payments, registrations, tournaments } from '../../db/schema'
import { loadSections, runBatch } from '../../utils/events/sectionsRepo'
import { updateRegistrationRequestSchema } from '../../../domain/contracts/registration'

function parseStoredByes(raw: string | null): number[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** Returns a sorted, deduped array of integers, or null if input is malformed. */
function normalizeByes(input: unknown): number[] | null {
  if (!Array.isArray(input)) return null
  if (input.some((n) => typeof n !== 'number' || !Number.isInteger(n))) return null
  return [...new Set(input as number[])].sort((a, b) => a - b)
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPatch: PagesFunction<Env> = async (context) => {
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
    section_id: string | null
    payment_status: string
    bye_rounds: string | null
    withdrawn_at: string | null
    checked_in_at: string | null
  }>()

  if (!registration) return errorResponse('Registration not found', 404)

  // Owner may edit their own registration; otherwise require tournament-scoped
  // manager rights (admin / director of THIS tournament), not a global role check.
  // The manager check runs even for owners so an owner-who-is-also-TD can set
  // payment status on their own row.
  // A parent acts for their children's entries as if they were their own.
  const isOwner = await canActFor(context.env.DB, authed.member.id, registration.member_id)
  const managerResult = await requireTournamentManager(
    context.request,
    context.env,
    registration.tournament_id,
  )
  const isManager = !isResponse(managerResult)

  if (!isOwner && !isManager) {
    return errorResponse('Forbidden', 403)
  }

  const body = await parseBody(context.request, updateRegistrationRequestSchema)
  if (isResponse(body)) return body

  if (
    body.byeRounds === undefined &&
    body.section === undefined &&
    body.paymentStatus === undefined &&
    body.withdrawn === undefined &&
    body.checkedIn === undefined
  ) {
    return errorResponse('No editable fields provided', 400)
  }

  const db = getDb(context.env.DB)
  const [tournament] = await db.select({
    name: tournaments.name,
    rounds: tournaments.rounds,
    entryFee: tournaments.entryFee,
  }).from(tournaments).where(eq(tournaments.id, registration.tournament_id))

  if (!tournament) return errorResponse('Tournament not found', 404)

  const changes: Partial<typeof registrations.$inferInsert> = {}
  // A repriced payment, written in the same batch as the entry.
  const paymentQueries: BatchItem<'sqlite'>[] = []
  let feeNote: string | undefined
  let selfWithdrawal = false
  // Written to the activity log only after the update succeeds.
  const auditEntries: AuditEntry[] = []
  const actor = isResponse(managerResult) ? authed.member : managerResult.member
  const isAdmin = actor.role === 'lca_admin'
  const player = await context.env.DB.prepare('SELECT full_name FROM members WHERE id = ?')
    .bind(registration.member_id).first<{ full_name: string }>()
  const playerLabel = `${player?.full_name ?? 'Player'} (${tournament.name})`

  // ── Withdrawal / reinstatement (manager only) ─────────────────────────────
  if (body.withdrawn !== undefined) {
    if (!isManager) {
      // Players may withdraw themselves (never reinstate) until round 1 of
      // their section is paired; after that the director handles it.
      if (!body.withdrawn) {
        return errorResponse('Ask the tournament director to reinstate you', 403)
      }
      const paired = await context.env.DB.prepare(
        `SELECT 1 FROM tournament_games WHERE tournament_id = ? AND section = ? LIMIT 1`,
      ).bind(registration.tournament_id, registration.section).first()
      if (paired) {
        return errorResponse('Pairings are already out. Please tell the tournament director you are withdrawing.', 403)
      }
      selfWithdrawal = true
    }
    if (body.withdrawn && registration.withdrawn_at) {
      return errorResponse('This player is already withdrawn', 400)
    }
    if (!body.withdrawn && !registration.withdrawn_at) {
      return errorResponse('This player is not withdrawn', 400)
    }
    changes.withdrawnAt = body.withdrawn ? new Date().toISOString() : null
    auditEntries.push({
      action: body.withdrawn ? 'registration_withdraw' : 'registration_reinstate',
      targetMemberId: registration.member_id,
      targetLabel: playerLabel,
      detail: { registration_id: registrationId, tournament_id: registration.tournament_id },
    })
  }

  // ── Check-in (manager only) ───────────────────────────────────────────────
  if (body.checkedIn !== undefined) {
    if (!isManager) {
      return errorResponse('Only a tournament manager can check players in', 403)
    }
    if (body.checkedIn && registration.withdrawn_at) {
      return errorResponse('Reinstate this player before checking them in', 400)
    }
    changes.checkedInAt = body.checkedIn ? new Date().toISOString() : null
  }

  // ── Payment status (manager only) ─────────────────────────────────────────
  if (body.paymentStatus !== undefined) {
    if (!isManager) {
      return errorResponse('Only a tournament manager can change payment status', 403)
    }
    // Directors and club reps record cash at the door. Refunds, and anything
    // touching a card payment, stay with admins: marking a card payment
    // "refunded" here moves no money in Stripe, and marking it "pending"
    // would hide that it was paid.
    if (!isAdmin) {
      if (body.paymentStatus === 'refunded' || registration.payment_status === 'refunded') {
        return errorResponse('Only an LCA admin can record refunds', 403)
      }
      const card = await context.env.DB.prepare(
        `SELECT 1 FROM payments
          WHERE reference_id = ? AND type = 'tournament'
            AND (stripe_payment_intent IS NOT NULL OR (stripe_session_id IS NOT NULL AND status = 'completed'))
          LIMIT 1`,
      ).bind(registrationId).first()
      if (card) {
        return errorResponse('This entry was paid by card. Ask an LCA admin to change it.', 403)
      }
    }
    if (body.paymentStatus !== registration.payment_status) {
      changes.paymentStatus = body.paymentStatus
      auditEntries.push({
        action: 'payment_change',
        targetMemberId: registration.member_id,
        targetLabel: playerLabel,
        detail: {
          registration_id: registrationId,
          tournament_id: registration.tournament_id,
          from: registration.payment_status,
          to: body.paymentStatus,
        },
      })
    }
  }

  // ── Section change ─────────────────────────────────────────────────────────
  const sectionChanging =
    body.section !== undefined && body.section !== registration.section

  if (body.section !== undefined && sectionChanging) {
    if (registration.withdrawn_at) {
      return errorResponse('Reinstate this player before changing their section', 400)
    }

    // Only a live section takes entries; the entry's current one may since
    // have been archived, so it is looked up among all of them.
    const sections = await loadSections(db, registration.tournament_id, { includeArchived: true })
    const target = sections.find((s) => s.archivedAt === null && s.name === body.section)
    if (!target) {
      return errorResponse('Invalid section', 400)
    }
    const current = sections.find((s) => s.id === registration.section_id)
      ?? sections.find((s) => s.name === registration.section)

    // Can't move a player who has already been paired — it would corrupt
    // standings and prior-game history in the old section.
    const existingGame = await context.env.DB.prepare(
      `SELECT id FROM tournament_games
       WHERE tournament_id = ? AND (white_member_id = ? OR black_member_id = ?)
       LIMIT 1`,
    )
      .bind(registration.tournament_id, registration.member_id, registration.member_id)
      .first()

    if (existingGame) {
      return errorResponse(
        'This player has already been paired and cannot change sections',
        400,
      )
    }

    changes.section = target.name
    changes.sectionId = target.id

    // Reconcile the payment: the payment row was created at the old section's fee.
    const oldFee = current?.feeRegular ?? tournament.entryFee
    const newFee = target.feeRegular ?? tournament.entryFee

    if (oldFee !== newFee) {
      const payment = await context.env.DB.prepare(
        `SELECT id, status FROM payments WHERE reference_id = ? AND type = 'tournament'`,
      ).bind(registrationId).first<{ id: string; status: string }>()

      if (payment?.status === 'pending') {
        paymentQueries.push(db.update(payments).set({ amount: newFee }).where(eq(payments.id, payment.id)))
      } else if (payment) {
        feeNote = `Entry fee changed from $${oldFee} to $${newFee} but payment is already ${payment.status}. Reconcile manually in the Stripe dashboard.`
      }
    }
  }

  // ── Bye rounds ─────────────────────────────────────────────────────────────
  if (body.byeRounds !== undefined) {
    const newByes = normalizeByes(body.byeRounds)
    if (newByes === null) {
      return errorResponse('byeRounds must be an array of whole numbers', 400)
    }

    const maxByes = tournament.rounds - 1
    if (newByes.length > maxByes) {
      return errorResponse(
        `You can request at most ${maxByes} bye${maxByes !== 1 ? 's' : ''} (one less than total rounds)`,
        400,
      )
    }

    const invalidRound = newByes.find((r) => r < 1 || r > tournament.rounds)
    if (invalidRound !== undefined) {
      return errorResponse(`Round ${invalidRound} is not valid for this tournament`, 400)
    }

    // Lock byes for rounds already paired in this player's (effective) section.
    // Changing history after pairings are posted corrupts the record. Applies
    // to managers too — a TD adjusts a paired round through the results table.
    const effectiveSection = sectionChanging ? (body.section as string) : registration.section
    const pairedRow = await context.env.DB.prepare(
      `SELECT MAX(round) as max_round FROM tournament_games
       WHERE tournament_id = ? AND section = ?`,
    )
      .bind(registration.tournament_id, effectiveSection)
      .first<{ max_round: number | null }>()

    const lockedThrough = pairedRow?.max_round ?? 0
    if (lockedThrough > 0) {
      const oldByes = parseStoredByes(registration.bye_rounds)
      for (let r = 1; r <= lockedThrough; r++) {
        if (oldByes.includes(r) !== newByes.includes(r)) {
          return errorResponse(
            `Round ${r} has already been paired — its bye status can't be changed. The TD can adjust results directly if needed.`,
            400,
          )
        }
      }
    }

    changes.byeRounds = newByes.length > 0 ? JSON.stringify(newByes) : null
  }

  if (Object.keys(changes).length > 0) {
    await runBatch(db, [
      ...paymentQueries,
      db.update(registrations).set(changes).where(eq(registrations.id, registrationId)),
    ])
    for (const entry of auditEntries) await recordAdminAction(context.env.DB, actor, entry)
  }

  // A player who paid by card and withdrew needs a refund decision from
  // the organizers; tell them rather than leaving it to be noticed.
  if (selfWithdrawal && registration.payment_status === 'paid') {
    const card = await context.env.DB.prepare(
      `SELECT amount FROM payments WHERE reference_id = ? AND type = 'tournament' AND stripe_payment_intent IS NOT NULL LIMIT 1`,
    ).bind(registrationId).first<{ amount: number }>()
    if (card && context.env.CONTACT_EMAIL) {
      await trySendEmail(context.env, {
        to: context.env.CONTACT_EMAIL,
        subject: `Withdrawal: ${playerLabel}, paid $${card.amount}`,
        html: `<p>${escapeHtml(playerLabel)} withdrew online and had paid $${card.amount} by card.</p><p>Decide on a refund in the Stripe dashboard. An admin can mark it refunded on the event's Registration tab.</p>`,
        text: `${playerLabel} withdrew online and had paid $${card.amount} by card. Decide on a refund in Stripe; an admin can mark it refunded on the event's Registration tab.`,
      })
    }
  }

  const updated = await context.env.DB.prepare(
    'SELECT * FROM registrations WHERE id = ?',
  ).bind(registrationId).first<Record<string, unknown>>()

  // Return bye_rounds parsed, matching the GET handler's shape.
  const responseRegistration = updated
    ? { ...updated, bye_rounds: parseStoredByes(updated.bye_rounds as string | null) }
    : null

  return jsonResponse({ registration: responseRegistration, feeNote: feeNote ?? null })
}
