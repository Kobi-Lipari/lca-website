import type { Env } from '../../../../types'
import { isResponse, requireAdmin } from '../../../../utils/auth'
import { updateMemberRole } from '../../../../utils/members'
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

  const updated = await updateMemberRole(
    context.env.DB,
    context.env,
    memberId,
    body.role,
  )
  if (!updated) {
    return errorResponse('Member not found', 404)
  }

  return jsonResponse({ member: updated })
}
