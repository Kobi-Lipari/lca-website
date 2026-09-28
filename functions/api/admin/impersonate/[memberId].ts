// functions/api/admin/impersonate/[memberId].ts
import { createClient } from '@supabase/supabase-js'
import type { Env } from '../../../types'
import { recordAdminAction } from '../../../utils/audit'
import { isResponse, requireAdmin } from '../../../utils/auth'
import { errorResponse, handleOptions, jsonResponse } from '../../../utils/response'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const authResult = await requireAdmin(context.request, context.env)
  if (isResponse(authResult)) return authResult

  const targetMemberId = context.params.memberId as string

  const target = await context.env.DB.prepare(
    'SELECT id, email, full_name, role, guardian_id FROM members WHERE id = ?',
  )
    .bind(targetMemberId)
    .first<{ id: string; email: string; full_name: string; role: string; guardian_id: string | null }>()

  if (!target) return errorResponse('Member not found', 404)
  if (target.role === 'lca_admin') {
    return errorResponse('Cannot impersonate another admin', 403)
  }
  // The session below is looked up by email. A child's profile carries its
  // parent's email and has no login of its own, so "logging in as" a child
  // would really sign in as the parent — who may be an admin. Log in as the
  // parent instead; they see the child on their dashboard.
  if (target.guardian_id || target.role === 'guest') {
    return errorResponse('This profile has no login of its own. Log in as the parent account instead.', 400)
  }
  // Belt and braces: never mint a session for an address an admin holds,
  // whichever row it was reached through.
  const adminWithEmail = await context.env.DB.prepare(
    `SELECT 1 FROM members WHERE email = ? AND role = 'lca_admin' LIMIT 1`,
  ).bind(target.email).first()
  if (adminWithEmail) {
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

  // Recorded in admin_audit_log rather than the old impersonation_log: that
  // table was never read by anything and its ended_at was never written, so
  // it could not answer "who acted as whom, and when did it stop".
  await recordAdminAction(context.env.DB, authResult.member, {
    action: 'impersonation_start',
    targetMemberId: target.id,
    targetLabel: `${target.full_name} <${target.email}>`,
    detail: { target_role: target.role },
  })

  return jsonResponse({
    session: {
      access_token: otpData.session.access_token,
      refresh_token: otpData.session.refresh_token,
    },
    member: { id: target.id, fullName: target.full_name, email: target.email },
  })
}