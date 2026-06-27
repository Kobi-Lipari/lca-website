// functions/api/admin/clubs/[id].ts
import type { Env } from '../../../types'
import { isResponse, requireClubRep, requireAdmin } from '../../../utils/auth'
import {
  errorResponse,
  handleOptions,
  jsonResponse,
  parseJsonBody,
} from '../../../utils/response'

interface UpdateClubBody {
  name?: string
  city?: string
  location?: string | null
  description?: string | null
  meetingSchedule?: string | null
  contactEmail?: string | null
  color?: string | null
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const clubId = context.params.id as string
  const authResult = await requireClubRep(context.request, context.env, clubId)
  if (isResponse(authResult)) return authResult

  const club = await context.env.DB.prepare('SELECT * FROM clubs WHERE id = ?')
    .bind(clubId)
    .first()

  if (!club) return errorResponse('Club not found', 404)

  const officers = await context.env.DB.prepare(
    `SELECT co.id, co.role, m.full_name, m.email
     FROM club_officers co
     JOIN members m ON co.member_id = m.id
     WHERE co.club_id = ? ORDER BY co.role`,
  ).bind(clubId).all()

  const roster = await context.env.DB.prepare(
    `SELECT m.id, m.full_name, m.email, m.uscf_id, m.membership_status
     FROM members m WHERE m.club_id = ? ORDER BY m.full_name`,
  ).bind(clubId).all()

  return jsonResponse({ club, officers: officers.results, roster: roster.results })
}

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const clubId = context.params.id as string
  const authResult = await requireClubRep(context.request, context.env, clubId)
  if (isResponse(authResult)) return authResult

  const existing = await context.env.DB.prepare('SELECT * FROM clubs WHERE id = ?')
    .bind(clubId)
    .first<Record<string, unknown>>()

  if (!existing) return errorResponse('Club not found', 404)

  const body = await parseJsonBody<UpdateClubBody>(context.request)
  if (!body) return errorResponse('Invalid JSON body', 400)

  // Validate hex color if provided
  const color = body.color !== undefined
    ? (body.color && /^#[0-9A-Fa-f]{6}$/.test(body.color) ? body.color : existing.color)
    : existing.color

  await context.env.DB.prepare(
    `UPDATE clubs SET
      name = ?, city = ?, location = ?, description = ?,
      meeting_schedule = ?, contact_email = ?, color = ?
     WHERE id = ?`,
  ).bind(
    body.name ?? existing.name,
    body.city ?? existing.city,
    body.location !== undefined ? body.location : existing.location,
    body.description !== undefined ? body.description : existing.description,
    body.meetingSchedule !== undefined ? body.meetingSchedule : existing.meeting_schedule,
    body.contactEmail !== undefined ? body.contactEmail : existing.contact_email,
    color,
    clubId,
  ).run()

  const club = await context.env.DB.prepare('SELECT * FROM clubs WHERE id = ?')
    .bind(clubId).first()

  return jsonResponse({ club })
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const clubId = context.params.id as string
  const authResult = await requireAdmin(context.request, context.env)
  if (isResponse(authResult)) return authResult

  const existing = await context.env.DB.prepare('SELECT * FROM clubs WHERE id = ?')
    .bind(clubId).first()

  if (!existing) return errorResponse('Club not found', 404)

  await context.env.DB.prepare('UPDATE members SET club_id = NULL WHERE club_id = ?').bind(clubId).run()
  await context.env.DB.prepare('DELETE FROM club_officers WHERE club_id = ?').bind(clubId).run()
  await context.env.DB.prepare('DELETE FROM club_news WHERE club_id = ?').bind(clubId).run()
  await context.env.DB.prepare('DELETE FROM clubs WHERE id = ?').bind(clubId).run()

  return jsonResponse({ success: true })
}