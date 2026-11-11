// functions/api/admin/campaigns/[id].ts
import type { Env } from '../../../types'
import { isResponse, requireMailer } from '../../../utils/auth'
import { errorResponse, handleOptions, jsonResponse } from '../../../utils/response'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const authResult = await requireMailer(context.request, context.env)
  if (isResponse(authResult)) return authResult

  const campaignId = context.params.id as string

  // The columns named one by one, in table order, so the answer keeps its shape when a migration adds a column
  // (0060's list_id and skipped_count are not shown here yet).
  const campaign = await context.env.DB.prepare(
    `SELECT id, subject, body_html, filter_json, total_recipients, sent_count, failed_count, status, created_by,
            created_at, completed_at
       FROM email_campaigns WHERE id = ?`,
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