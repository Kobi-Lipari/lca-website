import type { Env } from '../types'
import { handleOptions, jsonResponse } from '../utils/response'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url)
  const state = url.searchParams.get('state') ?? null
  const upcoming = url.searchParams.get('upcoming') ?? 'true'

  let query = `SELECT * FROM clearinghouse`
  const conditions: string[] = []
  const bindings: string[] = []

  if (state && state !== 'all') {
    conditions.push('state = ?')
    bindings.push(state)
  }

  if (upcoming === 'true') {
    conditions.push("start_date >= date('now')")
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ')
  }

  query += ' ORDER BY start_date ASC'

  const stmt = context.env.DB.prepare(query)
  const { results } = bindings.length > 0
    ? await stmt.bind(...bindings).all()
    : await stmt.all()

  return jsonResponse({ tournaments: results ?? [] })
}