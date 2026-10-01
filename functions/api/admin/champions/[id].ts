// functions/api/admin/champions/[id].ts — edit or remove one champion row.
import type { Env } from '../../../types'
import { isResponse, requireAdmin } from '../../../utils/auth'
import { errorResponse, handleOptions, jsonResponse, parseJsonBody } from '../../../utils/response'
import { cleanChampion, type ChampionInput } from '../../../utils/champions'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const auth = await requireAdmin(context.request, context.env)
  if (isResponse(auth)) return auth
  const id = context.params.id as string
  const existing = await context.env.DB.prepare('SELECT * FROM state_champions WHERE id = ?').bind(id)
    .first<{ year: number; title: string; champion: string; notes: string | null; tournament_id: string | null }>()
  if (!existing) return errorResponse('Not found', 404)
  const body = (await parseJsonBody<ChampionInput>(context.request)) ?? {}
  const c = cleanChampion({
    year: body.year ?? existing.year,
    title: body.title ?? existing.title,
    champion: body.champion ?? existing.champion,
    notes: body.notes !== undefined ? body.notes : existing.notes,
    tournamentId: body.tournamentId !== undefined ? body.tournamentId : existing.tournament_id,
  })
  if (!c.ok) return errorResponse(c.error, 400)
  await context.env.DB.prepare(
    'UPDATE state_champions SET year = ?, title = ?, champion = ?, notes = ?, tournament_id = ? WHERE id = ?',
  ).bind(c.row.year, c.row.title, c.row.champion, c.row.notes, c.row.tournamentId, id).run()
  return jsonResponse({ success: true })
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const auth = await requireAdmin(context.request, context.env)
  if (isResponse(auth)) return auth
  await context.env.DB.prepare('DELETE FROM state_champions WHERE id = ?').bind(context.params.id as string).run()
  return jsonResponse({ success: true })
}
