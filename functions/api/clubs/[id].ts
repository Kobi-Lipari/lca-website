import type { Env } from '../../../types'
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
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

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
      meeting_schedule = ?, contact_email = ?
     WHERE id = ?`,
  )
    .bind(
      body.name ?? existing.name,
      body.city ?? existing.city,
      body.location !== undefined ? body.location : existing.location,
      body.description !== undefined ? body.description : existing.description,
      body.meetingSchedule !== undefined
        ? body.meetingSchedule
        : existing.meeting_schedule,
      body.contactEmail !== undefined
        ? body.contactEmail
        : existing.contact_email,
      clubId,
    )
    .run()

  const club = await context.env.DB.prepare('SELECT * FROM clubs WHERE id = ?')
    .bind(clubId)
    .first()

  return jsonResponse({ club })
}
