import type { ClubRow, Env } from '../types'
import { handleOptions, jsonResponse } from '../utils/response'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { results } = await context.env.DB.prepare(
    `SELECT id, name, city, meeting_schedule FROM clubs ORDER BY name ASC`,
  ).all<Pick<ClubRow, 'id' | 'name' | 'city' | 'meeting_schedule'>>()

  return jsonResponse({ clubs: results ?? [] })
}
