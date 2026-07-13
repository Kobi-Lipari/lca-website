// functions/api/admin/clubs/[id]/news.ts
// Rewritten: the old version expected { title, body, news_date } while the
// frontend sends { title, newsDate, excerpt } and the schema (per the public
// club GET's SELECT) is excerpt-based — so date and excerpt were silently
// dropped, or the INSERT failed outright on a missing `body` column.
import type { Env } from '../../../../types'
import { isResponse, requireClubRep } from '../../../../utils/auth'
import {
  errorResponse,
  handleOptions,
  jsonResponse,
  parseJsonBody,
} from '../../../../utils/response'

interface CreateNewsBody {
  title?: string
  newsDate?: string
  excerpt?: string
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const clubId = context.params.id as string
  const authResult = await requireClubRep(context.request, context.env, clubId)
  if (isResponse(authResult)) return authResult

  const club = await context.env.DB.prepare('SELECT id FROM clubs WHERE id = ?')
    .bind(clubId)
    .first()

  if (!club) return errorResponse('Club not found', 404)

  const body = await parseJsonBody<CreateNewsBody>(context.request)
  const title = body?.title?.trim()
  const excerpt = body?.excerpt?.trim()
  if (!title || !excerpt) {
    return errorResponse('title and excerpt are required', 400)
  }

  const newsDate = body?.newsDate || new Date().toISOString().split('T')[0]
  const id = `news-${clubId}-${Date.now().toString(36)}`

  await context.env.DB.prepare(
    `INSERT INTO club_news (id, club_id, title, news_date, excerpt)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(id, clubId, title, newsDate, excerpt)
    .run()

  const news = await context.env.DB.prepare(
    'SELECT * FROM club_news WHERE id = ?',
  ).bind(id).first()

  return jsonResponse({ news }, 201)
}
