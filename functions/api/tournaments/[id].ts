import type { Env } from '../../types'
import { errorResponse, handleOptions, jsonResponse } from '../../utils/response'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const id = context.params.id as string

  const tournament = await context.env.DB.prepare(
    `SELECT * FROM tournaments WHERE id = ?`,
  )
    .bind(id)
    .first()

  if (!tournament) {
    return errorResponse('Tournament not found', 404)
  }

  const roster = await context.env.DB.prepare(
    `SELECT r.section, r.payment_status, m.full_name, m.uscf_id
     FROM registrations r
     JOIN members m ON m.id = r.member_id
     WHERE r.tournament_id = ?
     ORDER BY m.full_name ASC`,
  )
    .bind(id)
    .all()

  const row = tournament as Record<string, unknown>
  let sections: unknown[] = []
  try {
    sections = JSON.parse(row.sections as string) as unknown[]
  } catch {
    sections = []
  }

  return jsonResponse({
    tournament: {
      ...row,
      sections,
    },
    roster: roster.results ?? [],
  })
}
