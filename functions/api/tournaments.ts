// functions/api/tournaments.ts
import type { Env } from '../types'
import { handleOptions, jsonResponse } from '../utils/response'
import { requireAuthedMember, isResponse } from '../utils/auth'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  let isPrivileged = false
  try {
    const authed = await requireAuthedMember(context.request, context.env)
    if (!isResponse(authed)) {
      isPrivileged = ['lca_admin', 'club_rep', 'tournament_director'].includes(
        authed.member.role,
      )
    }
  } catch {
    // Not logged in — public view only
  }

  const query = isPrivileged
    ? `SELECT t.*, c.color AS club_color, c.name AS club_name
       FROM tournaments t
       LEFT JOIN clubs c ON t.club_id = c.id
       ORDER BY t.date ASC`
    : `SELECT t.*, c.color AS club_color, c.name AS club_name
       FROM tournaments t
       LEFT JOIN clubs c ON t.club_id = c.id
       WHERE t.is_visible = 1
       ORDER BY t.date ASC`

  const { results } = await context.env.DB.prepare(query).all<Record<string, unknown>>()

  const tournaments = (results ?? []).map((t) => {
    let sections: unknown[] = []
    try {
      sections = JSON.parse(t.sections as string)
    } catch {
      sections = []
    }
    return { ...t, sections }
  })

  return jsonResponse({ tournaments })
}