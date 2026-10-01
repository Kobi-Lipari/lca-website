// functions/api/me/children.ts
//
// A parent's children (family accounts). GET lists them — with each one's
// registration for a tournament when ?tournamentId= is given, so the
// tournament page can show who is already entered. POST adds a child.
import type { Env } from '../../types'
import { isResponse, requireAuthedMember } from '../../utils/auth'
import { listChildren, syncFamilyCoverage } from '../../utils/family'
import { validateFullName } from '../../utils/members'
import { isValidUscfId, refreshUscfSoon } from '../../utils/uscf'
import { errorResponse, handleOptions, jsonResponse, parseJsonBody } from '../../utils/response'

interface AddChildBody {
  fullName?: string
  uscfId?: string | null
}

/** A household, not an organisation — a generous cap that stops abuse. */
const MAX_CHILDREN = 8

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const authed = await requireAuthedMember(context.request, context.env)
  if (isResponse(authed)) return authed

  const children = await listChildren(context.env.DB, authed.member.id)
  const tournamentId = new URL(context.request.url).searchParams.get('tournamentId')

  if (!tournamentId || children.length === 0) {
    return jsonResponse({ children })
  }

  const { results } = await context.env.DB.prepare(
    `SELECT r.id, r.member_id, r.section, r.payment_status, r.withdrawn_at, r.waitlisted_at
       FROM registrations r
       JOIN members m ON m.id = r.member_id
      WHERE r.tournament_id = ? AND m.guardian_id = ?`,
  )
    .bind(tournamentId, authed.member.id)
    .all<{ id: string; member_id: string; section: string; payment_status: string; withdrawn_at: string | null; waitlisted_at: string | null }>()

  const byChild = new Map((results ?? []).map((r) => [r.member_id, r]))
  return jsonResponse({
    children: children.map((c) => ({ ...c, registration: byChild.get(c.id) ?? null })),
  })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const authed = await requireAuthedMember(context.request, context.env)
  if (isResponse(authed)) return authed
  const parent = authed.member

  // Children cannot have children, and walk-in guests have no account.
  if (parent.guardian_id || parent.role === 'guest') {
    return errorResponse('This account cannot add family members', 403)
  }

  const body = await parseJsonBody<AddChildBody>(context.request)
  const fullName = body?.fullName?.trim() ?? ''
  const nameProblem = validateFullName(fullName)
  if (nameProblem) return errorResponse(nameProblem, 400)

  const uscfId = body?.uscfId?.trim() || null
  if (uscfId && !isValidUscfId(uscfId)) return errorResponse('A USCF ID is 8 digits', 400)

  const existing = await listChildren(context.env.DB, parent.id)
  if (existing.length >= MAX_CHILDREN) {
    return errorResponse(`A family can have at most ${MAX_CHILDREN} children on one account`, 400)
  }
  if (existing.some((c) => c.full_name.toLowerCase() === fullName.toLowerCase())) {
    return errorResponse(`${fullName} is already on your account`, 409)
  }
  if (uscfId) {
    const taken = await context.env.DB.prepare('SELECT 1 FROM members WHERE uscf_id = ? AND role != \'guest\'')
      .bind(uscfId).first()
    if (taken) {
      return errorResponse('That USCF ID already belongs to an LCA account. Contact us if it should be moved to yours.', 409)
    }
  }

  const id = `child-${crypto.randomUUID()}`
  // The child's email is the parent's: confirmations and reminders for the
  // child's entries go to the person who manages them.
  await context.env.DB.prepare(
    `INSERT INTO members (id, email, full_name, uscf_id, membership_status, role, club_id, guardian_id)
     VALUES (?, ?, ?, ?, 'pending', 'member', ?, ?)`,
  )
    .bind(id, parent.email, fullName, uscfId, parent.club_id ?? null, parent.id)
    .run()

  // An active family membership covers the new child straight away.
  await syncFamilyCoverage(context.env.DB, parent.id)
  await refreshUscfSoon(context.env.DB, id, uscfId)

  const children = await listChildren(context.env.DB, parent.id)
  return jsonResponse({ children }, 201)
}
