// functions/api/admin/impersonate/end.ts
import type { Env } from '../../../types'
import { recordAdminAction } from '../../../utils/audit'
import { isResponse, requireAdmin } from '../../../utils/auth'
import { handleOptions, jsonResponse, parseJsonBody } from '../../../utils/response'

interface EndBody {
  /** Who was being impersonated, so start and end can be paired up. */
  targetMemberId?: string
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

/**
 * Closes out an impersonation session in the audit log.
 *
 * Called with the admin's own restored session, so requireAdmin passes
 * normally. Nothing here can be trusted to be reliable — a closed tab or a
 * crash ends the session without ever reaching this endpoint — so a start
 * with no matching end means "we don't know when it ended", not "it never
 * ended". The log view says as much rather than implying otherwise.
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const authResult = await requireAdmin(context.request, context.env)
  if (isResponse(authResult)) return authResult

  const body = await parseJsonBody<EndBody>(context.request)
  const targetMemberId = body?.targetMemberId ?? null

  let targetLabel: string | null = null
  if (targetMemberId) {
    const target = await context.env.DB.prepare(
      'SELECT full_name, email FROM members WHERE id = ?',
    )
      .bind(targetMemberId)
      .first<{ full_name: string; email: string }>()
    if (target) targetLabel = `${target.full_name} <${target.email}>`
  }

  await recordAdminAction(context.env.DB, authResult.member, {
    action: 'impersonation_end',
    targetMemberId,
    targetLabel,
  })

  return jsonResponse({ ok: true })
}
