// functions/api/tournaments.ts
import type { Env } from '../types'
import { handleOptions, jsonResponse } from '../utils/response'
import { requireAuthedMember, isResponse } from '../utils/auth'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  // Check if requester is admin/TD — they see all tournaments
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

  const { results } = await context.env.DB.prepare(
    isPrivileged
      ? `SELECT * FROM tournaments ORDER BY date ASC`
      : `SELECT * FROM tournaments WHERE is_visible = 1 ORDER BY date ASC`,
  ).all<Record<string, unknown>>()

  const tournaments = (results ?? []).map((t) => {
    let sections: unknown[] = []
    try { sections = JSON.parse(t.sections as string) } catch { sections = [] }
    return { ...t, sections }
  })

  return jsonResponse({ tournaments })
}