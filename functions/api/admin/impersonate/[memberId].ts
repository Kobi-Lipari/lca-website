// functions/api/admin/impersonate/[memberId].ts
import { createClient } from '@supabase/supabase-js'
import type { Env } from '../../../types'
import { isResponse, requireAdmin } from '../../../utils/auth'
import { errorResponse, handleOptions, jsonResponse } from '../../../utils/response'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const authResult = await requireAdmin(context.request, context.env)
  if (isResponse(authResult)) return authResult

  const targetMemberId = context.params.memberId as string

  const target = await context.env.DB.prepare(
    'SELECT id, email, full_name, role FROM members WHERE id = ?',
  )
    .bind(targetMemberId)
    .first<{ id: string; email: string; full_name: string; role: string }>()

  if (!target) return errorResponse('Member not found', 404)
  if (target.role === 'lca_admin') {
    return errorResponse('Cannot impersonate another admin', 403)
  }

  const supabaseAdmin = createClient(
    context.env.SUPABASE_URL,
    context.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: target.email,
  })
  if (linkError || !linkData?.properties?.hashed_token) {
    return errorResponse('Failed to generate impersonation session', 500)
  }

  const { data: otpData, error: otpError } = await supabaseAdmin.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'magiclink',
  })
  if (otpError || !otpData.session) {
    return errorResponse('Failed to redeem impersonation session', 500)
  }

  await context.env.DB.prepare(
    `INSERT INTO impersonation_log (id, admin_id, target_member_id, started_at)
     VALUES (?, ?, ?, ?)`,
  )
    .bind(
      `imp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      authResult.member.id,
      target.id,
      new Date().toISOString(),
    )
    .run()

  return jsonResponse({
    session: {
      access_token: otpData.session.access_token,
      refresh_token: otpData.session.refresh_token,
    },
    member: { id: target.id, fullName: target.full_name, email: target.email },
  })
}