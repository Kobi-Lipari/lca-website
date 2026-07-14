import type { Env } from '../../types'
import { isResponse, requireAdmin } from '../../utils/auth'
import { handleOptions, jsonResponse } from '../../utils/response'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const authResult = await requireAdmin(context.request, context.env)
  if (isResponse(authResult)) return authResult

  // role != 'guest' keeps walk-in synthetic members out of member management
  const { results } = await context.env.DB.prepare(
    `SELECT m.*, c.name as club_name
     FROM members m
     LEFT JOIN clubs c ON c.id = m.club_id
     WHERE m.role != 'guest'
     ORDER BY m.full_name ASC`,
  ).all()

  return jsonResponse({ members: results ?? [] })
}