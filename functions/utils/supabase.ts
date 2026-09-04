import { createClient } from '@supabase/supabase-js'
import type { Env } from '../types'

export function getSupabaseAdmin(env: Env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/**
 * Writes a member's display name back to their Supabase auth metadata.
 *
 * This is not optional bookkeeping. upsertMemberFromAuth runs on every login
 * and takes the name from auth metadata in preference to the members row, so
 * a correction written only to D1 silently reverts the next time that member
 * signs in. Both have to move together.
 *
 * Reads the existing metadata and merges, so unrelated keys (role, club_id,
 * uscf_id) are never dropped by this write.
 */
/**
 * Removes the auth user behind a member.
 *
 * Deleting a member used to clear the D1 rows and stop there, leaving the
 * Supabase user intact — so the person could still sign in, and
 * upsertMemberFromAuth would recreate their member row as pending on the next
 * request. "Delete member" reset the member rather than removing them, and
 * every deletion left an orphaned auth user behind.
 *
 * Returns false rather than throwing when the auth side fails: the D1 rows are
 * already gone by then, and a 500 would tell the admin nothing happened when
 * most of it did.
 */
export async function deleteSupabaseUser(
  env: Env,
  userId: string,
): Promise<boolean> {
  const supabase = getSupabaseAdmin(env)
  try {
    const { error } = await supabase.auth.admin.deleteUser(userId)
    if (error) {
      // A member seeded straight into D1 has no auth user; not a failure.
      if (/not found/i.test(error.message)) return true
      console.warn(`Could not delete Supabase user ${userId}: ${error.message}`)
      return false
    }
    return true
  } catch (err) {
    // The client throws rather than returning an error for a malformed id —
    // a member id predating Supabase, say. The D1 rows are already gone by
    // this point, so a throw here must not turn a mostly-successful delete
    // into a 500 that tells the admin nothing happened at all.
    console.warn(
      `Could not delete Supabase user ${userId}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    )
    return false
  }
}

export async function syncSupabaseUserFullName(
  env: Env,
  userId: string,
  fullName: string,
): Promise<void> {
  const supabase = getSupabaseAdmin(env)

  const { data: existing, error: readError } =
    await supabase.auth.admin.getUserById(userId)
  if (readError) {
    console.warn(`Could not read Supabase user ${userId}: ${readError.message}`)
    return
  }

  const { error } = await supabase.auth.admin.updateUserById(userId, {
    user_metadata: { ...(existing.user?.user_metadata ?? {}), full_name: fullName },
  })
  if (error) {
    console.warn(`Could not sync name for ${userId}: ${error.message}`)
  }
}

export async function syncSupabaseUserMetadata(
  env: Env,
  userId: string,
  metadata: { role: string; club_id?: string | null },
): Promise<void> {
  const supabase = getSupabaseAdmin(env)
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    user_metadata: {
      role: metadata.role,
      club_id: metadata.club_id ?? null,
    },
  })
  if (error) {
    // Log warning but don't fail — seed/test members may not exist in Supabase
    console.warn(`Could not sync Supabase metadata for ${userId}: ${error.message}`)
  }
}