import type { Env } from '../../../types'
import { isResponse, requireAdmin } from '../../../utils/auth'
import { errorResponse, handleOptions, jsonResponse, parseJsonBody } from '../../../utils/response'
import { validateAnnouncement, type AnnouncementBody } from '../announcement'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

interface AnnouncementRow {
  enabled: number
  message: string
  link_url: string | null
  link_label: string | null
  tone: string
  size: string
  sort_order: number
  starts_at: string | null
  ends_at: string | null
}

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const authed = await requireAdmin(context.request, context.env)
  if (isResponse(authed)) return authed

  const id = context.params.id as string
  const body = await parseJsonBody<AnnouncementBody>(context.request)
  if (!body) return errorResponse('Invalid JSON body', 400)

  const existing = await context.env.DB.prepare(
    'SELECT * FROM site_announcements WHERE id = ?',
  ).bind(id).first<AnnouncementRow>()
  if (!existing) return errorResponse('Announcement not found', 404)

  const problem = validateAnnouncement(body)
  if (problem) return errorResponse(problem, 400)

  // Merge against the row we already have. Absent means unchanged; for the
  // nullable fields null is a real value, so those need an explicit
  // undefined check rather than the usual ?? fallback.
  const next = {
    enabled: body.enabled === undefined ? existing.enabled : body.enabled ? 1 : 0,
    message: body.message ?? existing.message,
    link_url: body.linkUrl !== undefined ? body.linkUrl || null : existing.link_url,
    link_label: body.linkLabel !== undefined ? body.linkLabel || null : existing.link_label,
    tone: body.tone ?? existing.tone,
    size: body.size ?? existing.size,
    sort_order: body.sortOrder ?? existing.sort_order,
    starts_at: body.startsAt !== undefined ? body.startsAt || null : existing.starts_at,
    ends_at: body.endsAt !== undefined ? body.endsAt || null : existing.ends_at,
  }

  // Checked on the merged result, not on what this request happened to send:
  // clearing the message alone would otherwise leave a coloured bar with
  // nothing in it.
  if (!next.message.trim() && !next.link_label?.trim()) {
    return errorResponse('A banner needs a message or a link label', 400)
  }
  if (next.starts_at && next.ends_at && next.starts_at > next.ends_at) {
    return errorResponse('The start must come before the end', 400)
  }

  await context.env.DB.prepare(
    `UPDATE site_announcements SET
       enabled = ?, message = ?, link_url = ?, link_label = ?,
       tone = ?, size = ?, sort_order = ?, starts_at = ?, ends_at = ?,
       updated_at = datetime('now'), updated_by = ?
     WHERE id = ?`,
  ).bind(
    next.enabled, next.message, next.link_url, next.link_label,
    next.tone, next.size, next.sort_order, next.starts_at, next.ends_at,
    authed.member.id, id,
  ).run()

  const announcement = await context.env.DB.prepare(
    'SELECT * FROM site_announcements WHERE id = ?',
  ).bind(id).first()

  return jsonResponse({ announcement })
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const authed = await requireAdmin(context.request, context.env)
  if (isResponse(authed)) return authed

  const id = context.params.id as string
  const result = await context.env.DB.prepare(
    'DELETE FROM site_announcements WHERE id = ?',
  ).bind(id).run()

  if (result.meta.changes === 0) return errorResponse('Announcement not found', 404)
  return jsonResponse({ success: true })
}
