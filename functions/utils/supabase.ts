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
    throw new Error(`Failed to sync Supabase metadata: ${error.message}`)
  }
}
