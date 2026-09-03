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