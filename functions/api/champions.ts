// functions/api/champions.ts
//
// GET: the state champions honor roll, and any upcoming events marked as
// state championships. Public.
import type { Env } from '../types'
import { handleOptions, jsonResponse } from '../utils/response'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const champions = await context.env.DB.prepare(
    `SELECT c.id, c.year, c.title, c.champion, c.notes, c.tournament_id, t.name AS tournament_name
       FROM state_champions c
       LEFT JOIN tournaments t ON t.id = c.tournament_id AND t.is_visible = 1
      ORDER BY c.year DESC, c.title ASC, c.champion ASC`,
  ).all()
  const upcoming = await context.env.DB.prepare(
    `SELECT id, name, date, end_date, location, status
       FROM tournaments
      WHERE is_state_championship = 1 AND is_visible = 1 AND status != 'completed'
      ORDER BY date ASC`,
  ).all()
  return jsonResponse({ champions: champions.results ?? [], upcoming: upcoming.results ?? [] })
}
