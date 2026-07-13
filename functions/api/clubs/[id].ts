// functions/api/clubs/[id].ts
// Public, read-only. The club PATCH lives at /api/admin/clubs/[id] —
// the duplicate PATCH that used to live here has been removed so there is
// exactly one write path per operation.
import type { Env } from '../../types'
import { errorResponse, handleOptions, jsonResponse } from '../../utils/response'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const clubId = context.params.id as string

  const club = await context.env.DB.prepare('SELECT * FROM clubs WHERE id = ?')
    .bind(clubId)
    .first()

  if (!club) {
    return errorResponse('Club not found', 404)
  }

  const officers = await context.env.DB.prepare(
    `SELECT co.id, co.role, m.full_name, m.email
     FROM club_officers co
     JOIN members m ON co.member_id = m.id
     WHERE co.club_id = ?
     ORDER BY co.role`,
  )
    .bind(clubId)
    .all()

  // Hidden (draft) tournaments must not leak onto public club pages — they
  // previously showed here with links that 404'd on the detail endpoint.
  const tournaments = await context.env.DB.prepare(
    `SELECT id, name, date, end_date, status, entry_fee, sections, rounds
     FROM tournaments
     WHERE club_id = ? AND is_visible = 1
     ORDER BY date DESC`,
  )
    .bind(clubId)
    .all()

  const news = await context.env.DB.prepare(
    `SELECT id, title, excerpt, news_date
     FROM club_news
     WHERE club_id = ?
     ORDER BY news_date DESC
     LIMIT 10`,
  )
    .bind(clubId)
    .all()

  return jsonResponse({
    club,
    officers: officers.results,
    tournaments: tournaments.results,
    news: news.results,
  })
}
