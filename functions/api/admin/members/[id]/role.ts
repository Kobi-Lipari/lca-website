import type { Env } from '../../../../types'
import { recordAdminAction } from '../../../../utils/audit'
import { isResponse, requireAdmin } from '../../../../utils/auth'
import { getMemberById, updateMemberRole } from '../../../../utils/members'
import { isMemberRole } from '../../../../utils/permissions'
import {
  errorResponse,
  handleOptions,
  jsonResponse,
  parseJsonBody,
} from '../../../../utils/response'

interface RoleBody {
  role?: string
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const authResult = await requireAdmin(context.request, context.env)
  if (isResponse(authResult)) return authResult

  const memberId = context.params.id as string
  const body = await parseJsonBody<RoleBody>(context.request)
  if (!body?.role || !isMemberRole(body.role)) {
    return errorResponse('Invalid role', 400)
  }

  // Read the previous role first: after the update it is gone, and "what it
  // changed from" is the part that matters when reviewing this later.
  const before = await getMemberById(context.env.DB, memberId)
  if (!before) {
    return errorResponse('Member not found', 404)
  }

  const updated = await updateMemberRole(
    context.env.DB,
    context.env,
    memberId,
    body.role,
  )
  if (!updated) {
    return errorResponse('Member not found', 404)
  }

  if (before.role !== updated.role) {
    await recordAdminAction(context.env.DB, authResult.member, {
      action: 'role_change',
      targetMemberId: updated.id,
      targetLabel: `${updated.full_name} <${updated.email}>`,
      detail: { from: before.role, to: updated.role },
    })
  }

  return jsonResponse({ member: updated })
}
