import type { Env } from '../types'
import { handleOptions, jsonResponse } from '../utils/response'
import { parseJsonArray } from '../utils/json'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url)
  const state = url.searchParams.get('state') ?? null
  const upcoming = url.searchParams.get('upcoming') ?? 'true'

  // 1. Fetch LCA tournaments
  //
  // Public feed only: hidden drafts never appear here, even for admins and
  // club reps. This feed backs the homepage, Tournaments and Scholastic
  // pages, where a draft would look like a real published event — people
  // who manage drafts see them in the admin panel or workspace instead.
  const lcaRows = await context.env.DB.prepare(`
    SELECT
      t.id,
      t.name,
      t.date AS start_date,
      COALESCE(t.end_date, t.date) AS end_date,
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
      t.time_control,
      t.max_players,
      (SELECT COUNT(*) FROM registrations r
        WHERE r.tournament_id = t.id AND r.withdrawn_at IS NULL) AS registered_count,
      t.club_id,
      c.color AS club_color,
      c.name AS club_name
    FROM tournaments t
    LEFT JOIN clubs c ON t.club_id = c.id
    WHERE t.is_visible = 1
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
    const sections = parseJsonArray(t.sections as string)
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
    const dateA = ((a as Record<string, unknown>)?.start_date as string) ?? ''
    const dateB = ((b as Record<string, unknown>)?.start_date as string) ?? ''
    return dateA.localeCompare(dateB)
  })

  return jsonResponse({ tournaments: merged })
}
