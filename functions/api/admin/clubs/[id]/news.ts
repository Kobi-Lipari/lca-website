import type { Env } from '../../../../types'
import { isResponse, requireClubRep } from '../../../../utils/auth'
import {
  errorResponse,
  handleOptions,
  jsonResponse,
  parseJsonBody,
} from '../../../../utils/response'

interface CreateNewsBody {
  title: string
  body?: string
  news_date?: string
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const clubId = context.params.id as string
  const authResult = await requireClubRep(context.request, context.env, clubId)
  if (isResponse(authResult)) return authResult

  const body = await parseJsonBody<CreateNewsBody>(context.request)
  if (!body?.title) return errorResponse('Title is required', 400)

  const id = `news-${clubId}-${Date.now()}`
  await context.env.DB.prepare(
    `INSERT INTO club_news (id, club_id, title, body, news_date)
     VALUES (?, ?, ?, ?, ?)`,
  ).bind(
    id,
    clubId,
    body.title,
    body.body ?? null,
    body.news_date ?? new Date().toISOString().split('T')[0],
  ).run()

  const news = await context.env.DB.prepare(
    'SELECT * FROM club_news WHERE id = ?',
  ).bind(id).first()

  return jsonResponse({ news }, 201)
}