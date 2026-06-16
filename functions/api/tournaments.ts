import type { Env, TournamentRow } from '../types'
import { handleOptions, jsonResponse } from '../utils/response'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { results } = await context.env.DB.prepare(
    `SELECT id, name, date, location, entry_fee, sections, status FROM tournaments ORDER BY date DESC`,
  ).all<
    Pick<
      TournamentRow,
      'id' | 'name' | 'date' | 'location' | 'entry_fee' | 'sections' | 'status'
    >
  >()

  const tournaments = (results ?? []).map((row) => ({
    ...row,
    sections: parseSections(row.sections),
  }))

  return jsonResponse({ tournaments })
}

function parseSections(sectionsJson: string): string[] {
  try {
    const parsed = JSON.parse(sectionsJson) as Array<{ name: string } | string>
    return parsed.map((s) => (typeof s === 'string' ? s : s.name))
  } catch {
    return []
  }
}