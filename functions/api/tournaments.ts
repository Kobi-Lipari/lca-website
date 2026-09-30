// functions/api/tournaments.ts
import type { Env } from '../types'
import { handleOptions, jsonResponse } from '../utils/response'
import { requireAuthedMember, isResponse } from '../utils/auth'
import { parseJsonArray } from '../utils/json'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  // Hidden drafts are visible only to the people who can manage them: admins
  // see every draft, a club rep sees their own club's, and anyone assigned as
  // a director sees the events they direct. Everyone else gets the public list.
  let viewer: { role: string; id: string; clubId: string | null } | null = null
  try {
    const authed = await requireAuthedMember(context.request, context.env)
    if (!isResponse(authed)) {
      viewer = {
        role: authed.member.role,
        id: authed.member.id,
        clubId: authed.member.club_id ?? null,
      }
    }
  } catch {
    // Not logged in — public view only
  }

  const base = `SELECT t.*, c.color AS club_color, c.name AS club_name
       FROM tournaments t
       LEFT JOIN clubs c ON t.club_id = c.id`

  let statement: D1PreparedStatement
  if (viewer?.role === 'lca_admin') {
    statement = context.env.DB.prepare(`${base} ORDER BY t.date ASC`)
  } else if (viewer) {
    // Drafts: a rep's own club's, plus any event this person directs.
    statement = context.env.DB.prepare(
      `${base}
       WHERE t.is_visible = 1
          OR (?1 IS NOT NULL AND t.club_id = ?1 AND ?2 = 'club_rep')
          OR t.id IN (SELECT tournament_id FROM tournament_directors WHERE member_id = ?3)
       ORDER BY t.date ASC`,
    ).bind(viewer.clubId, viewer.role, viewer.id)
  } else {
    statement = context.env.DB.prepare(`${base} WHERE t.is_visible = 1 ORDER BY t.date ASC`)
  }

  const { results } = await statement.all<Record<string, unknown>>()

  const tournaments = (results ?? []).map((t) => {
    const sections = parseJsonArray(t.sections as string)
    return { ...t, sections }
  })

  return jsonResponse({ tournaments })
}