// functions/api/clubs.ts
import type { Env } from '../types'
import { handleOptions, jsonResponse } from '../utils/response'
import { CLUB_PAGES_ON } from '../utils/clubs/pages'
import { answerDirectory, directoryCache } from '../utils/clubs/directory'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  // While CLUB_PAGES_ON is set, read here at each call, the new directory's list, kept five minutes at the edge
  // (functions/utils/clubs/directory.ts, WS09 step 32). With it unset, as it ships, today's list below, untouched.
  if (CLUB_PAGES_ON) return answerDirectory(context, directoryCache())

  // color / image_url / region were missing from this SELECT, which made
  // every card and marker render default gold and broke the region filter
  // (every club's region compared as undefined).
  const { results } = await context.env.DB.prepare(
    `SELECT id, name, city, meeting_schedule, color, image_url, region, latitude, longitude
     FROM clubs
     ORDER BY name ASC`,
  ).all()

  return jsonResponse({ clubs: results ?? [] })
}
