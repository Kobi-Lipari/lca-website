import type { Env, MemberRow } from '../types'
import { syncSupabaseUserMetadata } from './supabase'

export async function getMemberById(
  db: D1Database,
  id: string,
): Promise<MemberRow | null> {
  return db
    .prepare('SELECT * FROM members WHERE id = ?')
    .bind(id)
    .first<MemberRow>()
}

export async function upsertMemberFromAuth(
  db: D1Database,
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> },
  env?: Env,
): Promise<MemberRow> {
  const existing = await getMemberById(db, user.id)
  const fullName =
    (user.user_metadata?.full_name as string | undefined) ||
    existing?.full_name ||
    user.email?.split('@')[0] ||
    'Member'
  const uscfId =
    (user.user_metadata?.uscf_id as string | undefined) ||
    existing?.uscf_id ||
    null
  const email = user.email ?? existing?.email ?? ''

  if (existing) {
    await db
      .prepare(
        `UPDATE members SET email = ?, full_name = ?, uscf_id = COALESCE(?, uscf_id) WHERE id = ?`,
      )
      .bind(email, fullName, uscfId, user.id)
      .run()
  } else {
    await db
      .prepare(
        `INSERT INTO members (id, email, full_name, uscf_id, membership_status, role)
         VALUES (?, ?, ?, ?, 'pending', 'member')`,
      )
      .bind(user.id, email, fullName, uscfId)
      .run()
  }

  const member = await getMemberById(db, user.id)
  if (!member) {
    throw new Error('Failed to upsert member')
  }

  if (env) {
    const metaRole = user.user_metadata?.role as string | undefined
    if (metaRole !== member.role || user.user_metadata?.club_id !== member.club_id) {
      await syncSupabaseUserMetadata(env, user.id, {
        role: member.role,
        club_id: member.club_id,
      })
    }
  }

  return member
}

export async function updateMemberRole(
  db: D1Database,
  env: Env,
  memberId: string,
  role: string,
): Promise<MemberRow | null> {
  const existing = await getMemberById(db, memberId)
  if (!existing) return null

  await db
    .prepare('UPDATE members SET role = ? WHERE id = ?')
    .bind(role, memberId)
    .run()

  const updated = await getMemberById(db, memberId)
  if (updated) {
    await syncSupabaseUserMetadata(env, memberId, {
      role: updated.role,
      club_id: updated.club_id,
    })
  }
  return updated
}

export async function updateMemberClub(
  db: D1Database,
  env: Env,
  memberId: string,
  clubId: string | null,
): Promise<MemberRow | null> {
  const existing = await getMemberById(db, memberId)
  if (!existing) return null

  await db
    .prepare('UPDATE members SET club_id = ? WHERE id = ?')
    .bind(clubId, memberId)
    .run()

  const updated = await getMemberById(db, memberId)
  if (updated) {
    await syncSupabaseUserMetadata(env, memberId, {
      role: updated.role,
      club_id: updated.club_id,
    })
  }
  return updated
}

/** Long enough for any real name, short enough to keep tables and emails sane. */
export const MAX_NAME_LENGTH = 100

/**
 * Validates a display name. Returns an error message, or null when it is fine.
 *
 * Shared by the admin endpoint and the member-facing one. They used to differ:
 * the admin route checked emptiness and length, and PATCH /api/me — the one
 * members actually use — checked nothing at all, so a blank or 10,000-character
 * name went straight into the table and from there into every email.
 */
export function validateFullName(value: string): string | null {
  if (!value.trim()) return 'A name is required'
  if (value.trim().length > MAX_NAME_LENGTH) {
    return `Name must be ${MAX_NAME_LENGTH} characters or fewer`
  }
  return null
}

export async function updateMemberProfile(
  db: D1Database,
  id: string,
  data: { fullName?: string; uscfId?: string | null },
): Promise<MemberRow | null> {
  const existing = await getMemberById(db, id)
  if (!existing) return null

  await db
    .prepare(
      `UPDATE members SET full_name = ?, uscf_id = ? WHERE id = ?`,
    )
    .bind(
      data.fullName ?? existing.full_name,
      data.uscfId !== undefined ? data.uscfId : existing.uscf_id,
      id,
    )
    .run()

  return getMemberById(db, id)
}
