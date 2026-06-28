import type { Env } from '../../types'
import { isResponse, requireClubRep } from '../../utils/auth'
import {
  errorResponse,
  handleOptions,
  jsonResponse,
  parseJsonBody,
} from '../../utils/response'

interface UpdateClubBody {
  name?: string
  city?: string
  location?: string | null
  description?: string | null
  meetingSchedule?: string | null
  contactEmail?: string | null
  color?: string | null        // add
  imageUrl?: string | null     // add
  region?: string | null       // add
}

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

  const tournaments = await context.env.DB.prepare(
    `SELECT id, name, date, end_date, status, entry_fee, sections, rounds
     FROM tournaments
     WHERE club_id = ?
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

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const clubId = context.params.id as string
  const authResult = await requireClubRep(context.request, context.env, clubId)
  if (isResponse(authResult)) return authResult

  const existing = await context.env.DB.prepare(
    'SELECT * FROM clubs WHERE id = ?',
  )
    .bind(clubId)
    .first<Record<string, unknown>>()

  if (!existing) {
    return errorResponse('Club not found', 404)
  }

  const body = await parseJsonBody<UpdateClubBody>(context.request)
  if (!body) {
    return errorResponse('Invalid JSON body', 400)
  }

  await context.env.DB.prepare(
    `UPDATE clubs SET
      name = ?, city = ?, location = ?, description = ?,
      meeting_schedule = ?, contact_email = ?,
      color = ?, image_url = ?, region = ?
     WHERE id = ?`,
  )
    .bind(
      body.name ?? existing.name,
      body.city ?? existing.city,
      body.location !== undefined ? body.location : existing.location,
      body.description !== undefined ? body.description : existing.description,
      body.meetingSchedule !== undefined ? body.meetingSchedule : existing.meeting_schedule,
      body.contactEmail !== undefined ? body.contactEmail : existing.contact_email,
      body.color !== undefined ? body.color : existing.color,
      body.imageUrl !== undefined ? body.imageUrl : existing.image_url,
      body.region !== undefined ? body.region : existing.region,
      clubId,
    )
    .run()

  const club = await context.env.DB.prepare('SELECT * FROM clubs WHERE id = ?')
    .bind(clubId)
    .first()

  return jsonResponse({ club })
}
