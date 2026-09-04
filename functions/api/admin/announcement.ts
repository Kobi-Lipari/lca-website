import type { Env } from '../../types'
import { isResponse, requireAdmin } from '../../utils/auth'
import { errorResponse, handleOptions, jsonResponse, parseJsonBody } from '../../utils/response'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

const TONES = ['gold', 'navy', 'urgent', 'info'] as const
const SIZES = ['default', 'compact'] as const

export interface AnnouncementBody {
  enabled?: boolean
  message?: string
  linkUrl?: string | null
  linkLabel?: string | null
  tone?: string
  size?: string
  sortOrder?: number
  startsAt?: string | null
  endsAt?: string | null
}

/**
 * Shared validation for create and update.
 *
 * tone and size are also constrained by CHECK in the schema, so a bad value
 * would be rejected either way — but as a 500 from D1 rather than something
 * an admin can read. Returns a message, or null when the body is fine.
 */
export function validateAnnouncement(body: AnnouncementBody): string | null {
  if (body.tone !== undefined && !TONES.includes(body.tone as typeof TONES[number])) {
    return `tone must be one of: ${TONES.join(', ')}`
  }
  if (body.size !== undefined && !SIZES.includes(body.size as typeof SIZES[number])) {
    return `size must be one of: ${SIZES.join(', ')}`
  }
  // A banner with neither renders as an empty coloured bar.
  if (body.message !== undefined && body.linkLabel !== undefined) {
    if (!body.message.trim() && !body.linkLabel?.trim()) {
      return 'A banner needs a message or a link label'
    }
  }
  if (body.startsAt && body.endsAt && body.startsAt > body.endsAt) {
    return 'The start must come before the end'
  }
  return null
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const authed = await requireAdmin(context.request, context.env)
  if (isResponse(authed)) return authed

  // Every banner, including disabled and expired ones — this is the
  // management view, not the public one.
  const { results } = await context.env.DB.prepare(
    `SELECT id, enabled, message, link_url, link_label, tone, size,
            sort_order, starts_at, ends_at, updated_at
       FROM site_announcements
      ORDER BY sort_order ASC, updated_at DESC`,
  ).all()

  return jsonResponse({ announcements: results ?? [] })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const authed = await requireAdmin(context.request, context.env)
  if (isResponse(authed)) return authed

  const body = await parseJsonBody<AnnouncementBody>(context.request)
  if (!body) return errorResponse('Invalid JSON body', 400)

  if (!body.message?.trim() && !body.linkLabel?.trim()) {
    return errorResponse('A banner needs a message or a link label', 400)
  }
  const problem = validateAnnouncement(body)
  if (problem) return errorResponse(problem, 400)

  const id = `ann-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

  await context.env.DB.prepare(
    `INSERT INTO site_announcements
       (id, enabled, message, link_url, link_label, tone, size, sort_order,
        starts_at, ends_at, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    id,
    body.enabled === false ? 0 : 1,
    body.message ?? '',
    body.linkUrl || null,
    body.linkLabel || null,
    body.tone ?? 'gold',
    body.size ?? 'default',
    body.sortOrder ?? 0,
    body.startsAt || null,
    body.endsAt || null,
    authed.member.id,
  ).run()

  const announcement = await context.env.DB.prepare(
    'SELECT * FROM site_announcements WHERE id = ?',
  ).bind(id).first()

  return jsonResponse({ announcement }, 201)
}
