// functions/api/admin/campaigns.ts
import type { Env } from '../../types'
import { isResponse, requireAdmin } from '../../utils/auth'
import { resolveRecipients, processCampaign, type CampaignFilter, type ResolvedRecipient } from '../../utils/campaigns'
import {
  errorResponse,
  handleOptions,
  jsonResponse,
  parseJsonBody,
} from '../../utils/response'

interface CreateCampaignBody {
  subject?: string
  bodyHtml?: string
  filter?: CampaignFilter
  /** Member IDs to drop from the filter-resolved list (the X's from the review step). */
  excludeMemberIds?: string[]
  /** Member IDs to add on top of the filter-resolved list (picked individually, may not match the filter at all). */
  includeMemberIds?: string[]
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const authResult = await requireAdmin(context.request, context.env)
  if (isResponse(authResult)) return authResult

  const { results } = await context.env.DB.prepare(
    `SELECT id, subject, total_recipients, sent_count, failed_count, status, created_at, completed_at
     FROM email_campaigns
     ORDER BY created_at DESC
     LIMIT 50`,
  ).all()

  return jsonResponse({ campaigns: results ?? [] })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const authResult = await requireAdmin(context.request, context.env)
  if (isResponse(authResult)) return authResult

  const body = await parseJsonBody<CreateCampaignBody>(context.request)
  if (!body?.subject?.trim() || !body.bodyHtml?.trim()) {
    return errorResponse('subject and bodyHtml are required', 400)
  }

  const filter = body.filter ?? {}
  let recipients = await resolveRecipients(context.env.DB, filter)

  // Drop anyone the admin X'd off in the review step.
  if (body.excludeMemberIds?.length) {
    const excludeSet = new Set(body.excludeMemberIds)
    recipients = recipients.filter((r) => !excludeSet.has(r.id))
  }

  // Add anyone hand-picked via the individual-member search, even if they
  // don't match the filter at all.
  if (body.includeMemberIds?.length) {
    const existingIds = new Set(recipients.map((r) => r.id))
    const toAdd = body.includeMemberIds.filter((id) => !existingIds.has(id))
    if (toAdd.length > 0) {
      const placeholders = toAdd.map(() => '?').join(', ')
      const { results } = await context.env.DB.prepare(
        `SELECT id, email, full_name FROM members WHERE id IN (${placeholders})`,
      ).bind(...toAdd).all<ResolvedRecipient>()
      recipients = [...recipients, ...(results ?? [])]
    }
  }

  if (recipients.length === 0) {
    return errorResponse('No members match that filter — nothing would be sent', 400)
  }

  const campaignId = `campaign-${Date.now().toString(36)}`

  // filter_json keeps a record of the original filter plus how many people
  // were manually excluded/added, so campaign history is an honest record
  // of what was actually sent, not just what the dropdowns said.
  const auditFilter = {
    ...filter,
    excludedCount: body.excludeMemberIds?.length ?? 0,
    manuallyAddedCount: body.includeMemberIds?.length ?? 0,
  }

  await context.env.DB.prepare(
    `INSERT INTO email_campaigns (id, subject, body_html, filter_json, total_recipients, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(campaignId, body.subject.trim(), body.bodyHtml, JSON.stringify(auditFilter), recipients.length, authResult.member.id)
    .run()

  // Batch-insert recipient rows. D1 batch() caps around ~100 statements per
  // call in practice — chunk to be safe at ~600+ scale.
  const CHUNK = 80
  for (let i = 0; i < recipients.length; i += CHUNK) {
    const chunk = recipients.slice(i, i + CHUNK)
    await context.env.DB.batch(
      chunk.map((r) =>
        context.env.DB.prepare(
          `INSERT INTO email_campaign_recipients (id, campaign_id, member_id, email) VALUES (?, ?, ?, ?)`,
        ).bind(`rcpt-${campaignId}-${r.id}`, campaignId, r.id, r.email),
      ),
    )
  }

  // Respond immediately; the actual sending happens in the background so
  // this request doesn't block on hundreds of sequential Resend calls.
  context.waitUntil(processCampaign(context.env, campaignId))

  return jsonResponse(
    { campaignId, totalRecipients: recipients.length, status: 'sending' },
    201,
  )
}