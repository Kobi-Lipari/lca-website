import type { Env } from '../../types'
import { isResponse, requireAdmin } from '../../utils/auth'
import { errorResponse, handleOptions, jsonResponse, parseJsonBody } from '../../utils/response'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const authed = await requireAdmin(context.request, context.env)
  if (isResponse(authed)) return authed

  const row = await context.env.DB.prepare(
    'SELECT enabled, message, link_url, link_label, updated_at FROM site_announcement WHERE id = 1'
  ).first()

  return jsonResponse({ announcement: row })
}

interface AnnouncementBody {
  enabled?: boolean
  message?: string
  linkUrl?: string | null
  linkLabel?: string | null
}

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const authed = await requireAdmin(context.request, context.env)
  if (isResponse(authed)) return authed

  const body = await parseJsonBody<AnnouncementBody>(context.request)
  if (!body) return errorResponse('Invalid JSON body', 400)

  await context.env.DB.prepare(
    `UPDATE site_announcement SET
      enabled = COALESCE(?, enabled),
      message = COALESCE(?, message),
      link_url = CASE WHEN ? IS NOT NULL THEN ? ELSE link_url END,
      link_label = CASE WHEN ? IS NOT NULL THEN ? ELSE link_label END,
      updated_at = datetime('now'),
      updated_by = ?
     WHERE id = 1`,
  ).bind(
    body.enabled !== undefined ? (body.enabled ? 1 : 0) : null,
    body.message ?? null,
    body.linkUrl !== undefined ? 1 : null,
    body.linkUrl ?? null,
    body.linkLabel !== undefined ? 1 : null,
    body.linkLabel ?? null,
    authed.member.id,
  ).run()

  const row = await context.env.DB.prepare(
    'SELECT enabled, message, link_url, link_label, updated_at FROM site_announcement WHERE id = 1'
  ).first()

  return jsonResponse({ announcement: row })
}