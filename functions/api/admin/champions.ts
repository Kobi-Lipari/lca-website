// functions/api/admin/champions.ts
//
// POST: add one champion { year, title, champion, notes?, tournamentId? },
// or many at once { rows: [...] } (for entering past years in bulk).
// Admins only; observers read the public list like everyone else.
import type { Env } from '../../types'
import { isResponse, requireAdmin } from '../../utils/auth'
import { errorResponse, handleOptions, jsonResponse, parseJsonBody } from '../../utils/response'
import { cleanChampion, type ChampionInput } from '../../utils/champions'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = await requireAdmin(context.request, context.env)
  if (isResponse(auth)) return auth
  const body = await parseJsonBody<ChampionInput & { rows?: ChampionInput[] }>(context.request)
  if (!body) return errorResponse('Invalid request', 400)

  const inputs = Array.isArray(body.rows) ? body.rows : [body]
  if (inputs.length === 0) return errorResponse('Nothing to add', 400)
  if (inputs.length > 500) return errorResponse('Add at most 500 at a time', 400)
  const rows = []
  for (const [i, r] of inputs.entries()) {
    const c = cleanChampion(r)
    if (!c.ok) return errorResponse(inputs.length > 1 ? `Line ${i + 1}: ${c.error}` : c.error, 400)
    rows.push(c.row)
  }
  await context.env.DB.batch(rows.map((r) => context.env.DB.prepare(
    `INSERT INTO state_champions (year, title, champion, notes, tournament_id) VALUES (?, ?, ?, ?, ?)`,
  ).bind(r.year, r.title, r.champion, r.notes, r.tournamentId)))
  return jsonResponse({ added: rows.length }, 201)
}
