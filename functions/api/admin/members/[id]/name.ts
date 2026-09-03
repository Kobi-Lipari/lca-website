// functions/api/admin/members/[id]/name.ts
import type { Env } from '../../../../types'
import { recordAdminAction } from '../../../../utils/audit'
import { isResponse, requireAdmin } from '../../../../utils/auth'
import { getMemberById } from '../../../../utils/members'
import { syncSupabaseUserFullName } from '../../../../utils/supabase'
import {
  errorResponse,
  handleOptions,
  jsonResponse,
  parseJsonBody,
} from '../../../../utils/response'

interface NameBody {
  fullName?: string
}

/** Long enough for any real name, short enough to keep tables and emails sane. */
const MAX_NAME_LENGTH = 100

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

/**
 * Corrects a member's display name.
 *
 * Members can edit their own name from the dashboard, but until now nobody
 * could fix someone else's — so a name that arrived wrong from the member
 * import could only be corrected by the member themselves, if they noticed.
 *
 * Writes to both the members row and the Supabase auth metadata, because
 * upsertMemberFromAuth prefers the metadata value on every login and would
 * otherwise undo the correction the next time that member signed in.
 */
export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const authResult = await requireAdmin(context.request, context.env)
  if (isResponse(authResult)) return authResult

  const memberId = context.params.id as string
  const body = await parseJsonBody<NameBody>(context.request)

  const fullName = body?.fullName?.trim()
  if (!fullName) {
    return errorResponse('A name is required', 400)
  }
  if (fullName.length > MAX_NAME_LENGTH) {
    return errorResponse(`Name must be ${MAX_NAME_LENGTH} characters or fewer`, 400)
  }

  const before = await getMemberById(context.env.DB, memberId)
  if (!before) {
    return errorResponse('Member not found', 404)
  }

  if (before.full_name === fullName) {
    return jsonResponse({ member: before })
  }

  await context.env.DB.prepare('UPDATE members SET full_name = ? WHERE id = ?')
    .bind(fullName, memberId)
    .run()

  await syncSupabaseUserFullName(context.env, memberId, fullName)

  const updated = await getMemberById(context.env.DB, memberId)

  await recordAdminAction(context.env.DB, authResult.member, {
    action: 'name_change',
    targetMemberId: memberId,
    targetLabel: `${fullName} <${before.email}>`,
    detail: { from: before.full_name, to: fullName },
  })

  return jsonResponse({ member: updated })
}
