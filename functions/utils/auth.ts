// functions/utils/auth.ts
import { createClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'

import type { Env, MemberRow } from '../types'
import { getMemberById, upsertMemberFromAuth } from './members'
import { errorResponse } from './response'
import { isMemberRole, type MemberRole } from './permissions'

export async function verifySupabaseUser(
  request: Request,
  env: Env,
): Promise<User | null> {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.slice(7)
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token)

  if (error || !user) {
    return null
  }

  return user
}

export async function requireUser(
  request: Request,
  env: Env,
): Promise<User | Response> {
  const user = await verifySupabaseUser(request, env)
  if (!user) {
    return errorResponse('Unauthorized', 401)
  }
  return user
}

export interface AuthedMember {
  user: User
  member: MemberRow
}

export async function requireAuthedMember(
  request: Request,
  env: Env,
): Promise<AuthedMember | Response> {
  const userResult = await requireUser(request, env)
  if (userResult instanceof Response) return userResult

  let member = await getMemberById(env.DB, userResult.id)
  if (!member) {
    member = await upsertMemberFromAuth(env.DB, userResult, env)
  }

  return { user: userResult, member }
}

/**
 * Resolves an optional session without failing the request. Endpoints that
 * accept both guests and members (contact form, ticket creation) use this so a
 * logged-in submitter gets their member_id attached to the ticket.
 */
export async function optionalAuthedMember(
  request: Request,
  env: Env,
): Promise<AuthedMember | null> {
  const user = await verifySupabaseUser(request, env)
  if (!user) return null

  let member = await getMemberById(env.DB, user.id)
  if (!member) {
    member = await upsertMemberFromAuth(env.DB, user, env)
  }

  return { user, member }
}

export async function requireRole(
  request: Request,
  env: Env,
  roles: MemberRole | MemberRole[],
): Promise<AuthedMember | Response> {
  const authed = await requireAuthedMember(request, env)
  if (authed instanceof Response) return authed

  const allowed = Array.isArray(roles) ? roles : [roles]
  if (!allowed.includes(authed.member.role as MemberRole)) {
    return errorResponse('Forbidden', 403)
  }

  return authed
}

export async function requireAdmin(
  request: Request,
  env: Env,
): Promise<AuthedMember | Response> {
  return requireRole(request, env, 'lca_admin')
}

export async function requireClubRep(
  request: Request,
  env: Env,
  clubId: string,
): Promise<AuthedMember | Response> {
  const authed = await requireAuthedMember(request, env)
  if (authed instanceof Response) return authed

  if (authed.member.role === 'lca_admin') return authed
  if (
    authed.member.role === 'club_rep' &&
    authed.member.club_id === clubId
  ) {
    return authed
  }

  return errorResponse('Forbidden', 403)
}

export async function requireTournamentManager(
  request: Request,
  env: Env,
  tournamentId: string,
): Promise<AuthedMember | Response> {
  const authed = await requireAuthedMember(request, env)
  if (authed instanceof Response) return authed

  const { canManageTournament } = await import('./permissions')
  const allowed = await canManageTournament(
    env.DB,
    authed.member,
    tournamentId,
  )
  if (!allowed) {
    return errorResponse('Forbidden', 403)
  }

  return authed
}

// ── Board seats ──────────────────────────────────────────────────
//
// Board access is a GRANT on top of an account, never an account type. It
// lives in board_seat_assignments, so members.role — and everything attached
// to the member's identity — is untouched when a term starts or ends.

/** Seat ids the member currently holds. Empty for almost everyone. */
export async function getActiveSeatIds(
  db: D1Database,
  memberId: string,
): Promise<string[]> {
  const { results } = await db
    .prepare(
      `SELECT seat_id FROM board_seat_assignments
        WHERE member_id = ?1 AND ended_at IS NULL`,
    )
    .bind(memberId)
    .all<{ seat_id: string }>()

  return (results ?? []).map((r) => r.seat_id)
}

export interface SeatAccess extends AuthedMember {
  isAdmin: boolean
  /** Seat ids this caller may read. Admins get every active seat. */
  seatIds: string[]
}

/**
 * Passes if the caller is an lca_admin (who can see every seat's tickets, so
 * they can chase board members who haven't answered), or currently holds the
 * seat. Access ends the moment the term does — `ended_at IS NULL` is the whole
 * revocation mechanism, so there is nothing separate to remember to turn off.
 *
 * Called with a seatRef it gates one seat. Called without, it returns the
 * caller's readable seats for an inbox listing.
 */
export async function requireSeatAccess(
  request: Request,
  env: Env,
  seatRef?: string,
): Promise<SeatAccess | Response> {
  const authed = await requireAuthedMember(request, env)
  if (authed instanceof Response) return authed

  if (authed.member.role === 'lca_admin') {
    const { results } = await env.DB.prepare(
      `SELECT id FROM board_members WHERE is_active = 1`,
    ).all<{ id: string }>()
    return { ...authed, isAdmin: true, seatIds: (results ?? []).map((r) => r.id) }
  }

  const seatIds = await getActiveSeatIds(env.DB, authed.member.id)
  if (seatIds.length === 0) return errorResponse('Forbidden', 403)

  if (seatRef) {
    const seat = await env.DB.prepare(
      `SELECT id FROM board_members
        WHERE is_active = 1 AND (slug = ?1 OR id = ?1)`,
    )
      .bind(seatRef)
      .first<{ id: string }>()

    if (!seat || !seatIds.includes(seat.id)) {
      return errorResponse('Forbidden', 403)
    }
  }

  return { ...authed, isAdmin: false, seatIds }
}

export function isResponse(value: unknown): value is Response {
  return value instanceof Response
}

export function parseRole(value: string): MemberRole | null {
  return isMemberRole(value) ? value : null
}