// functions/api/admin/clubs/[id]/officers/[officerId].ts
import type { Env } from '../../../../../types'
import { isResponse, requireClubRep } from '../../../../../utils/auth'
import { errorResponse, handleOptions, jsonResponse } from '../../../../../utils/response'
import { recordAdminAction } from '../../../../../utils/audit'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const clubId = context.params.id as string
  const officerId = context.params.officerId as string
  const authResult = await requireClubRep(context.request, context.env, clubId)
  if (isResponse(authResult)) return authResult

  const officer = await context.env.DB.prepare(
    `SELECT co.member_id, co.role, m.full_name FROM club_officers co
       JOIN members m ON m.id = co.member_id
      WHERE co.id = ? AND co.club_id = ?`,
  ).bind(officerId, clubId).first<{ member_id: string; role: string; full_name: string }>()

  // club_id in the WHERE: a rep can only remove officers of their own club,
  // even if they guess another club's officer id.
  const result = await context.env.DB.prepare(
    'DELETE FROM club_officers WHERE id = ? AND club_id = ?',
  )
    .bind(officerId, clubId)
    .run()

  if (!result.meta.changes) return errorResponse('Officer not found', 404)
  await recordAdminAction(context.env.DB, authResult.member, {
    action: 'officer_remove',
    targetMemberId: officer?.member_id ?? null,
    targetLabel: officer?.full_name ?? null,
    detail: { club_id: clubId, title: officer?.role ?? null },
  })
  return jsonResponse({ success: true })
}
