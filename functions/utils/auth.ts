import { createClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'

import type { Env } from '../types'

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
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return user
}

export function isResponse(value: unknown): value is Response {
  return value instanceof Response
}