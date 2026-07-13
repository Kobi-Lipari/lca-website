// functions/api/registrations/[id].ts
import type { Env } from '../../types'
import {
  isResponse,
  requireAuthedMember,
  requireTournamentManager,
} from '../../utils/auth'
import {
  errorResponse,
  handleOptions,
  jsonResponse,
  parseJsonBody,
} from '../../utils/response'

interface UpdateRegistrationBody {
  byeRounds?: unknown
  section?: string
  paymentStatus?: string
  withdrawn?: boolean
  checkedIn?: boolean
}

const PAYMENT_STATUSES = ['paid', 'pending', 'refunded'] as const

function parseSectionList(sectionsJson: string): Array<{ name: string; entryFee?: number }> {
  try {
    const parsed = JSON.parse(sectionsJson) as Array<{ name: string; entryFee?: number } | string>
    return parsed.map((s) => (typeof s === 'string' ? { name: s } : s))
  } catch {
    return []
  }
}

function sectionFee(sectionsJson: string, name: string, fallback: number): number {
  const match = parseSectionList(sectionsJson).find((s) => s.name === name)
  return match?.entryFee ?? fallback
}

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
  const isOwner = registration.member_id === authed.member.id
  const managerResult = await requireTournamentManager(
    context.request,
    context.env,
    registration.tournament_id,
  )
  const isManager = !isResponse(managerResult)

  if (!isOwner && !isManager) {
    return errorResponse('Forbidden', 403)
  }

  const body = await parseJsonBody<UpdateRegistrationBody>(context.request)
  if (!body) return errorResponse('Invalid JSON body', 400)

  if (
    body.byeRounds === undefined &&
    body.section === undefined &&
    body.paymentStatus === undefined &&
    body.withdrawn === undefined &&
    body.checkedIn === undefined
  ) {
    return errorResponse('No editable fields provided', 400)
  }

  const tournament = await context.env.DB.prepare(
    'SELECT rounds, sections, entry_fee FROM tournaments WHERE id = ?',
  ).bind(registration.tournament_id).first<{
    rounds: number
    sections: string
    entry_fee: number
  }>()

  if (!tournament) return errorResponse('Tournament not found', 404)

  const setClauses: string[] = []
  const binds: unknown[] = []
  let feeNote: string | undefined

  // ── Withdrawal / reinstatement (manager only) ─────────────────────────────
  if (body.withdrawn !== undefined) {
    if (!isManager) {
      return errorResponse('Only a tournament manager can withdraw or reinstate a player', 403)
    }
    if (body.withdrawn && registration.withdrawn_at) {
      return errorResponse('This player is already withdrawn', 400)
    }
    if (!body.withdrawn && !registration.withdrawn_at) {
      return errorResponse('This player is not withdrawn', 400)
    }
    setClauses.push('withdrawn_at = ?')
    binds.push(body.withdrawn ? new Date().toISOString() : null)
  }

  // ── Check-in (manager only) ───────────────────────────────────────────────
  if (body.checkedIn !== undefined) {
    if (!isManager) {
      return errorResponse('Only a tournament manager can check players in', 403)
    }
    if (body.checkedIn && registration.withdrawn_at) {
      return errorResponse('Reinstate this player before checking them in', 400)
    }
    setClauses.push('checked_in_at = ?')
    binds.push(body.checkedIn ? new Date().toISOString() : null)
  }

  // ── Payment status (manager only) ─────────────────────────────────────────
  if (body.paymentStatus !== undefined) {
    if (!isManager) {
      return errorResponse('Only a tournament manager can change payment status', 403)
    }
    if (!PAYMENT_STATUSES.includes(body.paymentStatus as (typeof PAYMENT_STATUSES)[number])) {
      return errorResponse('Invalid payment status', 400)
    }
    setClauses.push('payment_status = ?')
    binds.push(body.paymentStatus)
  }

  // ── Section change ─────────────────────────────────────────────────────────
  const sectionChanging =
    body.section !== undefined && body.section !== registration.section

  if (body.section !== undefined && sectionChanging) {
    if (registration.withdrawn_at) {
      return errorResponse('Reinstate this player before changing their section', 400)
    }

    const validNames = parseSectionList(tournament.sections).map((s) => s.name)
    if (!validNames.includes(body.section)) {
      return errorResponse('Invalid section', 400)
    }

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

    setClauses.push('section = ?')
    binds.push(body.section)

    // Reconcile the payment: the payment row was created at the old section's fee.
    const oldFee = sectionFee(tournament.sections, registration.section, tournament.entry_fee)
    const newFee = sectionFee(tournament.sections, body.section, tournament.entry_fee)

    if (oldFee !== newFee) {
      const payment = await context.env.DB.prepare(
        `SELECT id, status FROM payments WHERE reference_id = ? AND type = 'tournament'`,
      ).bind(registrationId).first<{ id: string; status: string }>()

      if (payment?.status === 'pending') {
        await context.env.DB.prepare(
          'UPDATE payments SET amount = ? WHERE id = ?',
        ).bind(newFee, payment.id).run()
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

    setClauses.push('bye_rounds = ?')
    binds.push(newByes.length > 0 ? JSON.stringify(newByes) : null)
  }

  if (setClauses.length > 0) {
    await context.env.DB.prepare(
      `UPDATE registrations SET ${setClauses.join(', ')} WHERE id = ?`,
    ).bind(...binds, registrationId).run()
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
