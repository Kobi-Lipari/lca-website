// functions/api/admin/campaigns/preview.ts
import type { Env } from '../../../types'
import { isResponse, requireAdmin } from '../../../utils/auth'
import { resolveRecipients, type CampaignFilter } from '../../../utils/campaigns'
import { handleOptions, jsonResponse, parseJsonBody } from '../../../utils/response'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const authResult = await requireAdmin(context.request, context.env)
  if (isResponse(authResult)) return authResult

  const body = await parseJsonBody<{ filter?: CampaignFilter }>(context.request)
  const recipients = await resolveRecipients(context.env.DB, body?.filter ?? {})

  // Returns the actual resolved people, not just a count — the admin UI
  // uses this to show a reviewable, X-able list before anything sends.
  return jsonResponse({ count: recipients.length, recipients })
}