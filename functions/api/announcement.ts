import type { Env } from '../types'
import { jsonResponse, handleOptions } from '../utils/response'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const row = await context.env.DB.prepare(
    'SELECT enabled, message, link_url, link_label FROM site_announcement WHERE id = 1'
  ).first<{ enabled: number; message: string; link_url: string | null; link_label: string | null }>()

  // Return null (not just enabled:false) whenever there's nothing worth
  // showing, so the frontend has one simple check instead of three.
  if (!row || !row.enabled || !row.message) {
    return jsonResponse({ announcement: null })
  }

  return jsonResponse({
    announcement: {
      message: row.message,
      linkUrl: row.link_url,
      linkLabel: row.link_label,
    },
  })
}