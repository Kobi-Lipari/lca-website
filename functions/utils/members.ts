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
