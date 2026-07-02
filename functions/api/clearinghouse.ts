import type { Env } from '../types'
import { handleOptions, jsonResponse } from '../utils/response'
import { requireAuthedMember, isResponse } from '../utils/auth'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url)
  const state = url.searchParams.get('state') ?? null
  const upcoming = url.searchParams.get('upcoming') ?? 'true'

  let isPrivileged = false
  try {
    const authed = await requireAuthedMember(context.request, context.env)
    if (!isResponse(authed)) {
      isPrivileged = ['lca_admin', 'club_rep', 'tournament_director'].includes(authed.member.role)
    }
  } catch { /* not logged in */ }

  // 1. Fetch LCA tournaments
  const lcaVisibility = isPrivileged ? '' : 'WHERE t.is_visible = 1'
  const lcaRows = await context.env.DB.prepare(`
    SELECT
      t.id,
      t.name,
      t.date AS start_date,
      t.date AS end_date,
      COALESCE(c.name, 'Louisiana Chess Association') AS organizer,
      t.location AS city,
      'LA' AS state,
      t.venue,
      t.time_control AS rating_system,
      NULL AS eligibility,
      NULL AS contact,
      NULL AS link,
      1 AS is_lca,
      t.registration_status,
      t.entry_fee,
      t.sections,
      t.rounds,
      t.status,
      t.is_rated,
      t.club_id,
      c.color AS club_color,
      c.name AS club_name
    FROM tournaments t
    LEFT JOIN clubs c ON t.club_id = c.id
    ${lcaVisibility}
  `).all<Record<string, unknown>>()

  // 2. Fetch external clearinghouse tournaments
  const chConditions: string[] = ['is_lca = 0']
  const chBindings: string[] = []

  if (state && state !== 'all') {
    chConditions.push('state = ?')
    chBindings.push(state)
  }
  if (upcoming === 'true') {
    chConditions.push("start_date >= date('now')")
  }

  const chQuery = `
    SELECT
      id, name, start_date, end_date, organizer, city, state,
      venue, rating_system, eligibility, contact, link, is_lca, synced_at,
      NULL AS registration_status,
      NULL AS entry_fee,
      NULL AS sections,
      NULL AS rounds,
      NULL AS status,
      NULL AS is_rated,
      NULL AS club_id,
      NULL AS club_color,
      NULL AS club_name
    FROM clearinghouse
    WHERE ${chConditions.join(' AND ')}
    ORDER BY start_date ASC
  `

  const chStmt = context.env.DB.prepare(chQuery)
  const chRows = chBindings.length > 0
    ? await chStmt.bind(...chBindings).all<Record<string, unknown>>()
    : await chStmt.all<Record<string, unknown>>()

  // 3. Process LCA rows
  const lcaTournaments = (lcaRows.results ?? []).map(t => {
    let sections: unknown[] = []
    try { sections = JSON.parse(t.sections as string) } catch { sections = [] }
    if (state && state !== 'all' && t.state !== state) return null
    if (upcoming === 'true' && t.status === 'completed') return null
    return { ...t, sections, is_lca: 1, source: 'lca' }
  }).filter(Boolean)

  // 4. Process clearinghouse rows
  const chTournaments = (chRows.results ?? []).map(t => ({
    ...t, is_lca: 0, source: 'clearinghouse', sections: [],
  }))

  // 5. Merge and sort
  const merged = [...lcaTournaments, ...chTournaments].sort((a, b) => {
    const dateA = (a!.start_date as string) ?? ''
    const dateB = (b!.start_date as string) ?? ''
    return dateA.localeCompare(dateB)
  })

  return jsonResponse({ tournaments: merged })
}
