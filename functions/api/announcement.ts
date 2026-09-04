import type { Env } from '../types'
import { jsonResponse, handleOptions } from '../utils/response'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export interface AnnouncementRow {
  id: string
  message: string
  link_url: string | null
  link_label: string | null
  tone: string
  size: string
}

/**
 * Every banner that should be on screen right now.
 *
 * Returns a list because two things can need saying at once — the case that
 * retired the old singleton. The date window is applied here rather than in
 * the browser so a banner cannot outlive its event just because someone left
 * a tab open.
 *
 * A banner with neither message nor link label would render as an empty bar,
 * so those are filtered out. The legacy row stores a single space as its
 * message and carries all its text in the link label, which is why the check
 * is "either", not "message".
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { results } = await context.env.DB.prepare(
    `SELECT id, message, link_url, link_label, tone, size
       FROM site_announcements
      WHERE enabled = 1
        AND (starts_at IS NULL OR starts_at <= datetime('now'))
        AND (ends_at   IS NULL OR ends_at   >= datetime('now'))
      ORDER BY sort_order ASC, updated_at DESC`,
  ).all<AnnouncementRow>()

  const announcements = (results ?? [])
    .filter((r) => r.message.trim() || r.link_label?.trim())
    .map((r) => ({
      id: r.id,
      message: r.message,
      linkUrl: r.link_url,
      linkLabel: r.link_label,
      tone: r.tone,
      size: r.size,
    }))

  return jsonResponse({ announcements })
}
