// functions/api/admin/campaigns/[id].ts
import type { Env } from '../../../types'
import { isResponse, requireAdmin } from '../../../utils/auth'
import { errorResponse, handleOptions, jsonResponse } from '../../../utils/response'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const authResult = await requireAdmin(context.request, context.env)
  if (isResponse(authResult)) return authResult

  const campaignId = context.params.id as string

  const campaign = await context.env.DB.prepare(
    `SELECT * FROM email_campaigns WHERE id = ?`,
  )
    .bind(campaignId)
    .first()

  if (!campaign) return errorResponse('Campaign not found', 404)

  const failedRecipients = await context.env.DB.prepare(
    `SELECT email, error FROM email_campaign_recipients WHERE campaign_id = ? AND status = 'failed' LIMIT 20`,
  )
    .bind(campaignId)
    .all()

  return jsonResponse({ campaign, failedRecipients: failedRecipients.results ?? [] })
}