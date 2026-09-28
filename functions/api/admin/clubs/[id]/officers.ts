// functions/api/admin/clubs/[id]/officers.ts
// The officers shown on a club's public page. A rep manages their own club's
// list; an admin manages any. Officers must belong to the club — their name
// and email are published on the club page, so a rep can list only people
// who are actually on their roster.
import type { Env } from '../../../../types'
import { isResponse, requireClubRep } from '../../../../utils/auth'
import {
  errorResponse,
  handleOptions,
  jsonResponse,
  parseJsonBody,
} from '../../../../utils/response'

interface AddOfficerBody {
  memberId?: string
  title?: string
}

async function listOfficers(db: D1Database, clubId: string) {
  const { results } = await db
    .prepare(
      `SELECT co.id, co.member_id, co.role, m.full_name, m.email
       FROM club_officers co
       JOIN members m ON co.member_id = m.id
       WHERE co.club_id = ?
       ORDER BY co.created_at`,
    )
    .bind(clubId)
    .all()
  return results ?? []
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const clubId = context.params.id as string
  const authResult = await requireClubRep(context.request, context.env, clubId)
  if (isResponse(authResult)) return authResult

  return jsonResponse({ officers: await listOfficers(context.env.DB, clubId) })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const clubId = context.params.id as string
  const authResult = await requireClubRep(context.request, context.env, clubId)
  if (isResponse(authResult)) return authResult

  const body = await parseJsonBody<AddOfficerBody>(context.request)
  const title = body?.title?.trim()
  if (!body?.memberId || !title) {
    return errorResponse('memberId and title are required', 400)
  }
  if (title.length > 60) {
    return errorResponse('Title must be 60 characters or fewer', 400)
  }

  const member = await context.env.DB.prepare(
    'SELECT id FROM members WHERE id = ? AND club_id = ?',
  )
    .bind(body.memberId, clubId)
    .first()
  if (!member) {
    return errorResponse('That member is not on this club\'s roster', 400)
  }

  const id = `officer-${crypto.randomUUID()}`
  await context.env.DB.prepare(
    `INSERT INTO club_officers (id, club_id, member_id, role) VALUES (?, ?, ?, ?)`,
  )
    .bind(id, clubId, body.memberId, title)
    .run()

  return jsonResponse({ officers: await listOfficers(context.env.DB, clubId) }, 201)
}
