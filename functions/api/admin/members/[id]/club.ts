import type { Env } from '../../../../types'
import { recordAdminAction } from '../../../../utils/audit'
import { isResponse, requireAdmin } from '../../../../utils/auth'
import { getMemberById, updateMemberClub } from '../../../../utils/members'
import {
  errorResponse,
  handleOptions,
  jsonResponse,
  parseJsonBody,
} from '../../../../utils/response'

interface ClubBody {
  clubId?: string | null
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const authResult = await requireAdmin(context.request, context.env)
  if (isResponse(authResult)) return authResult

  const memberId = context.params.id as string
  const body = await parseJsonBody<ClubBody>(context.request)
  if (body === null || body.clubId === undefined) {
    return errorResponse('clubId is required (use null to unassign)', 400)
  }

  if (body.clubId) {
    const club = await context.env.DB.prepare(
      'SELECT id FROM clubs WHERE id = ?',
    )
      .bind(body.clubId)
      .first()
    if (!club) {
      return errorResponse('Club not found', 404)
    }
  }

  // Club assignment grants club_rep their scope, so record what it moved from.
  const before = await getMemberById(context.env.DB, memberId)

  const updated = await updateMemberClub(
    context.env.DB,
    context.env,
    memberId,
    body.clubId,
  )
  if (!updated) {
    return errorResponse('Member not found', 404)
  }

  if (before?.club_id !== updated.club_id) {
    await recordAdminAction(context.env.DB, authResult.member, {
      action: 'club_change',
      targetMemberId: updated.id,
      targetLabel: `${updated.full_name} <${updated.email}>`,
      detail: { from: before?.club_id ?? null, to: updated.club_id },
    })
  }

  return jsonResponse({ member: updated })
}
