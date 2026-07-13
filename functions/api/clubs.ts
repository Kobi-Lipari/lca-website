// functions/api/clubs.ts
import type { Env } from '../types'
import { handleOptions, jsonResponse } from '../utils/response'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  // color / image_url / region were missing from this SELECT, which made
  // every card and marker render default gold and broke the region filter
  // (every club's region compared as undefined).
  const { results } = await context.env.DB.prepare(
    `SELECT id, name, city, meeting_schedule, color, image_url, region
     FROM clubs
     ORDER BY name ASC`,
  ).all()

  return jsonResponse({ clubs: results ?? [] })
}
