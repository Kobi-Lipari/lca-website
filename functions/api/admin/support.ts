import type { Env } from '../../types'
import { isResponse, requireAdmin } from '../../utils/auth'
import { handleOptions, jsonResponse } from '../../utils/response'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const authResult = await requireAdmin(context.request, context.env)
  if (isResponse(authResult)) return authResult

  const status = new URL(context.request.url).searchParams.get('status')

  const tickets = await context.env.DB.prepare(
    `SELECT t.*,
      (SELECT COUNT(*) FROM support_messages m WHERE m.ticket_id = t.id) as message_count,
      (SELECT body FROM support_messages m WHERE m.ticket_id = t.id ORDER BY created_at DESC LIMIT 1) as last_message
     FROM support_tickets t
     ${status ? 'WHERE t.status = ?' : ''}
     ORDER BY t.updated_at DESC
     LIMIT 100`,
  ).bind(...(status ? [status] : [])).all()

  return jsonResponse({ tickets: tickets.results })
}