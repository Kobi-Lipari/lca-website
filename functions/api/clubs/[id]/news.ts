import type { Env } from '../../../types'
import { isResponse, requireClubRep } from '../../../utils/auth'
import {
  errorResponse,
  handleOptions,
  jsonResponse,
  parseJsonBody,
} from '../../../utils/response'

interface NewsBody {
  title?: string
  newsDate?: string
  excerpt?: string
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const clubId = context.params.id as string
  const authResult = await requireClubRep(context.request, context.env, clubId)
  if (isResponse(authResult)) return authResult

  const club = await context.env.DB.prepare(
    'SELECT id FROM clubs WHERE id = ?',
  )
    .bind(clubId)
    .first()

  if (!club) {
    return errorResponse('Club not found', 404)
  }

  const body = await parseJsonBody<NewsBody>(context.request)
  if (!body?.title || !body.newsDate || !body.excerpt) {
    return errorResponse('title, newsDate, and excerpt are required', 400)
  }

  const id = `news-${clubId}-${Date.now().toString(36)}`

  await context.env.DB.prepare(
    `INSERT INTO club_news (id, club_id, title, news_date, excerpt)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(id, clubId, body.title, body.newsDate, body.excerpt)
    .run()

  const news = await context.env.DB.prepare(
    'SELECT * FROM club_news WHERE id = ?',
  )
    .bind(id)
    .first()

  return jsonResponse({ news }, 201)
}
