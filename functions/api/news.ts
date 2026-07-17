// functions/api/news.ts
//
// Public aggregate news feed: every club's news items joined with the club's
// name and color, newest first. Powers the "From the clubs" section on
// NewsPage. Per-club posting and display (AdminClubPage / ClubDetailPage)
// are unchanged — this only reads.

import type { Env } from '../types'
import { jsonResponse } from '../utils/response'

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const { results } = await ctx.env.DB.prepare(
    `SELECT cn.id, cn.club_id, cn.title, cn.news_date, cn.excerpt,
            c.name AS club_name, c.color AS club_color
     FROM club_news cn
     JOIN clubs c ON cn.club_id = c.id
     ORDER BY cn.news_date DESC, cn.created_at DESC
     LIMIT 50`,
  ).all()
  return jsonResponse({ news: results })
}