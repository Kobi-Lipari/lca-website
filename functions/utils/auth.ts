// functions/utils/auth.ts
import { createClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'

import type { Env, MemberRow } from '../types'
import { holdsMediaManagerSeat } from './admin/mediaManager'
import { getMemberById, upsertMemberFromAuth } from './admin/members'
import { MAIL_LISTS_ON } from './mail/switches'
import { errorResponse, jsonResponse } from './response'
import { isMemberRole, type MemberRole } from './admin/permissions'

/**
 * Authenticator Assurance Level carried by the access token.
 *
 * 'aal1' is password-only; 'aal2' means a second factor was also verified
 * for this session. Read from the token's own claims — Supabase does not
 * surface it on the user object — and only ever after getUser() has
 * validated the token, so the claims are trustworthy at that point.
 */
export function readTokenAal(token: string): string | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    const claims = JSON.parse(json) as { aal?: string }
    return claims.aal ?? null
  } catch {
    return null
  }
}

function bearerToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  return authHeader.slice(7)
}

export async function verifySupabaseUser(
  request: Request,
  env: Env,
): Promise<User | null> {
  const token = bearerToken(request)
  if (!token) {
    return null
  }

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

/**
 * lca_admin, with a second factor verified for this session.
 *
 * The MFA check lives here rather than only in the UI on purpose: a
 * password-only session can call these endpoints directly with curl, so
 * enforcing it in the client would be decoration. An admin who has not
 * enrolled yet gets 403 with mfaRequired, which the frontend turns into a
 * prompt to enrol — enrolment itself works at aal1, so this cannot lock
 * anyone out of the step that fixes it.
 */
export async function requireAdmin(
  request: Request,
  env: Env,
): Promise<AuthedMember | Response> {
  const authed = await requireRole(request, env, 'lca_admin')
  if (isResponse(authed)) return authed

  return secondFactorMissing(request) ?? authed
}

/**
 * The 403 an LCA admin gets when the session carries no second factor, or
 * null when it does. Read only after the session has been verified.
 */
function secondFactorMissing(request: Request): Response | null {
  if (!hasSecondFactor(request)) {
    return jsonResponse(
      {
        error:
          'Two-factor authentication is required for admin access. Set it up in your account security settings.',
        mfaRequired: true,
      },
      403,
    )
  }
  return null
}

/**
 * Whether the session carries a second factor: the token's aal claim is
 * exactly 'aal2', as requireAdmin reads it. A missing claim, any other value
 * and a token that is not one all read as no. Read only after the session
 * has been verified, so the claim is the sign-in service's own.
 */
export function hasSecondFactor(request: Request): boolean {
  const token = bearerToken(request)
  return token !== null && readTokenAal(token) === 'aal2'
}

// ── LCA Observer and LCA Officer ─────────────────────────────────
//
// lca_observer (meant for the president) sees everything an admin sees and
// can do a short list of things: send group email, email a tournament's
// entrants, answer support tickets, and manage the governance documents
// (bylaws, rules, minutes, treasurer's reports). Everything else stays with
// admins. Read endpoints use the *View guards below; every other write keeps
// requireAdmin / requireClubRep / requireTournamentManager, which an
// observer never passes.
//
// lca_officer (meant for the treasurer, secretary and other officers) is
// the same minus the mailing tools: no group email, no emailing entrants.
// Everywhere below, "observer" means either role; requireMailer is the one
// place they differ.
//
// No second factor is required of either: they cannot change roles,
// delete accounts or send anything beyond the tools listed above.

/** Roles with the admin panel in view-only mode. */
export const OBSERVER_ROLES: MemberRole[] = ['lca_observer', 'lca_officer']

export function isObserver(member: { role: string }): boolean {
  return OBSERVER_ROLES.includes(member.role as MemberRole)
}

/** Group email and emailing entrants: admins and lca_observer, not officers. */
export function canUseMailing(member: { role: string }): boolean {
  return member.role === 'lca_admin' || member.role === 'lca_observer'
}

/** Admin read access plus the mailing tools. Officers are turned away. */
export async function requireMailer(
  request: Request,
  env: Env,
): Promise<AuthedMember | Response> {
  const authed = await requireAdminView(request, env)
  if (isResponse(authed)) return authed
  if (!canUseMailing(authed.member)) {
    return errorResponse('Group email is limited to admins and the LCA Observer', 403)
  }
  return authed
}

/**
 * The people who may send the LCA newsletter (WS16's endpoints under
 * /api/admin/mail), with the session verified once, where requireMailer
 * verifies an admin's twice: today's mailers, an LCA admin with a second
 * factor and the president (lca_observer), and, while MAIL_LISTS_ON is set,
 * the media manager (WS16 step 6, sendsAsMediaManager below) signed in with
 * a second factor.
 *
 * With MAIL_LISTS_ON unset every answer is requireMailer's own and no seat
 * is read: 401 signed out, 'Forbidden' for a role that is neither, the
 * mailing tools' words for an officer, and the second factor's 403 for an
 * admin without one. With it set, an admin and the president are answered
 * as before; the media manager without a second factor gets the 403 with
 * mfaRequired that requireAdmin gives, in words of its own; and anyone else,
 * an officer among them, gets LIST_MAILERS_ONLY. requireMailer, the guard of
 * today's five campaign endpoints, is unchanged, so the media manager
 * reaches only WS16's own endpoints and never today's typed-in addresses or
 * hand-picked members.
 */
export async function requireListMailer(
  request: Request,
  env: Env,
): Promise<AuthedMember | Response> {
  const authed = await requireAuthedMember(request, env)
  if (isResponse(authed)) return authed
  if (authed.member.role === 'lca_observer') return authed
  if (authed.member.role === 'lca_admin') return secondFactorMissing(request) ?? authed
  if (!MAIL_LISTS_ON) {
    if (authed.member.role === 'lca_officer') {
      return errorResponse('Group email is limited to admins and the LCA Observer', 403)
    }
    return errorResponse('Forbidden', 403)
  }
  if (await sendsAsMediaManager(env.DB, authed.member)) {
    if (hasSecondFactor(request)) return authed
    return jsonResponse({ error: MEDIA_MANAGER_SECOND_FACTOR, mfaRequired: true }, 403)
  }
  return errorResponse(LIST_MAILERS_ONLY, 403)
}

/** The 403 for anyone requireListMailer refuses while MAIL_LISTS_ON is set, but the second factor's. */
export const LIST_MAILERS_ONLY = 'Group email is limited to LCA admins, the president and the media manager.'

/** The 403 the media manager gets, with mfaRequired, when the session carries no second factor. */
export const MEDIA_MANAGER_SECOND_FACTOR = 'Two-factor sign-in is required to send group email. Set it up in your account security settings.'

/**
 * Whether the member sends as the media manager: they hold the Media manager
 * seat now (holdsMediaManagerSeat, read at each request), and their role is
 * one Admin does not let in, so a member, a club rep, a director or an
 * auditor, each keeping their own role's rights. An LCA admin and the
 * president send as themselves, and an officer, whom Admin lets in to read
 * only, is refused whatever seat they hold, before the seat is read, as
 * officers are refused today. The second factor is not read here: the guard
 * asks for it, and GET /api/me/media-manager answers it apart.
 */
export async function sendsAsMediaManager(db: D1Database, member: { id: string; role: string }): Promise<boolean> {
  if (member.role === 'lca_admin' || isObserver(member)) return false
  return holdsMediaManagerSeat(db, member.id)
}

/**
 * Adding, editing and removing governance documents (bylaws, rules,
 * amendments, minutes, treasurer's reports): admins with 2FA, observers and
 * officers.
 */
export async function requireGovernanceEditor(
  request: Request,
  env: Env,
): Promise<AuthedMember | Response> {
  const authed = await requireAuthedMember(request, env)
  if (authed instanceof Response) return authed
  if (isObserver(authed.member)) return authed
  return requireAdmin(request, env)
}

/** Admin read access: admins (with 2FA) or observers. */
export async function requireAdminView(
  request: Request,
  env: Env,
): Promise<AuthedMember | Response> {
  const authed = await requireAuthedMember(request, env)
  if (authed instanceof Response) return authed
  if (isObserver(authed.member)) return authed
  return requireAdmin(request, env)
}

/** Read access to one club's management view. */
export async function requireClubView(
  request: Request,
  env: Env,
  clubId: string,
): Promise<AuthedMember | Response> {
  const authed = await requireAuthedMember(request, env)
  if (authed instanceof Response) return authed
  if (isObserver(authed.member)) return authed
  return requireClubRep(request, env, clubId)
}

/** Read access to one tournament's management view. */
export async function requireTournamentView(
  request: Request,
  env: Env,
  tournamentId: string,
): Promise<AuthedMember | Response> {
  const authed = await requireAuthedMember(request, env)
  if (authed instanceof Response) return authed
  if (isObserver(authed.member)) return authed
  return requireTournamentManager(request, env, tournamentId)
}

/** Roles that may read the member directory, besides lca_admin. */
const DIRECTORY_ROLES: MemberRole[] = ['lca_auditor', 'lca_officer', 'lca_observer', 'club_rep', 'tournament_director']

/**
 * Read access to the member directory.
 *
 * lca_auditor exists for exactly this and nothing else: checking whether the
 * person at the registration desk is a current member. club_rep and
 * tournament_director are included because they sit above auditor —
 * raising someone's role must never take away something the lower role
 * could do.
 *
 * lca_admin keeps the full requireAdmin treatment, MFA included.
 *
 * MFA is deliberately NOT required of the other roles. It guards the admin
 * endpoints because those change roles, delete accounts and send mail to
 * every member; this one returns a read-only slice, and requiring every
 * volunteer to enrol in TOTP before they can look someone up would cost more
 * than it buys. Every write to a member still goes through requireAdmin.
 */
export async function requireMemberDirectory(
  request: Request,
  env: Env,
): Promise<AuthedMember | Response> {
  const authed = await requireAuthedMember(request, env)
  if (authed instanceof Response) return authed

  // Admins go the long way round so the MFA requirement still applies to them.
  if (authed.member.role === 'lca_admin') return requireAdmin(request, env)
  if (DIRECTORY_ROLES.includes(authed.member.role as MemberRole)) return authed

  return errorResponse('Forbidden', 403)
}

export async function requireClubRep(
  request: Request,
  env: Env,
  clubId: string,
): Promise<AuthedMember | Response> {
  const authed = await requireAuthedMember(request, env)
  if (authed instanceof Response) return authed

  // Admins, the club's own rep, and the regional representative whose seat
  // covers the club's region.
  const { canManageClub } = await import('./admin/permissions')
  if (await canManageClub(env.DB, authed.member, clubId)) return authed

  return errorResponse('Forbidden', 403)
}

export async function requireTournamentManager(
  request: Request,
  env: Env,
  tournamentId: string,
): Promise<AuthedMember | Response> {
  const authed = await requireAuthedMember(request, env)
  if (authed instanceof Response) return authed

  const { canManageTournament } = await import('./admin/permissions')
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
  /** Reads every seat like an admin, but may not delete. */
  isObserver: boolean
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

  // Admins and observers read every seat. Observers may reply and log notes
  // but not delete; the delete handler checks isObserver.
  if (authed.member.role === 'lca_admin' || isObserver(authed.member)) {
    const { results } = await env.DB.prepare(
      `SELECT id FROM board_members WHERE is_active = 1`,
    ).all<{ id: string }>()
    return { ...authed, isAdmin: true, isObserver: isObserver(authed.member), seatIds: (results ?? []).map((r) => r.id) }
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

  return { ...authed, isAdmin: false, isObserver: false, seatIds }
}

export function isResponse(value: unknown): value is Response {
  return value instanceof Response
}

export function parseRole(value: string): MemberRole | null {
  return isMemberRole(value) ? value : null
}