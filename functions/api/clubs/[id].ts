import type { Env } from '../../types'
import { errorResponse, handleOptions, jsonResponse } from '../../utils/response'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const id = context.params.id as string

  const club = await context.env.DB.prepare(`SELECT * FROM clubs WHERE id = ?`)
    .bind(id)
    .first()

  if (!club) {
    return errorResponse('Club not found', 404)
  }

  const officers = await context.env.DB.prepare(
    `SELECT co.role, m.full_name, m.email
     FROM club_officers co
     JOIN members m ON m.id = co.member_id
     WHERE co.club_id = ?
     ORDER BY co.role ASC`,
  )
    .bind(id)
    .all()

  const tournaments = await context.env.DB.prepare(
    `SELECT id, name, date, status FROM tournaments WHERE club_id = ? ORDER BY date DESC`,
  )
    .bind(id)
    .all()

  const news = await context.env.DB.prepare(
    `SELECT id, title, news_date, excerpt FROM club_news WHERE club_id = ? ORDER BY news_date DESC`,
  )
    .bind(id)
    .all()

  return jsonResponse({
    club,
    officers: officers.results ?? [],
    tournaments: tournaments.results ?? [],
    news: news.results ?? [],
  })
}
