// functions/api/board/seats.ts
//
// Public seat list for the contact form's recipient picker and the board page.
// Deliberately does NOT select any email address: the whole point of routing
// through seats is that a visitor never sees one.

import type { Env } from '../../types'
import { handleOptions, jsonResponse } from '../../utils/response'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  // GROUP_CONCAT rather than one row per holder: a shared seat (two USCF
  // Delegates, say) is still ONE card and ONE entry in the contact dropdown.
  // holder_count is what tells the UI whether to say "Message Adriana" or
  // "Message the delegates".
  const { results } = await context.env.DB.prepare(
    `SELECT s.id,
            s.slug,
            s.role,
            s.category,
            s.sort_order,
            s.is_shared,
            COALESCE(GROUP_CONCAT(m.full_name, ' & '), s.name) AS holder_name,
            COUNT(a.id) AS holder_count
       FROM board_members s
       LEFT JOIN board_seat_assignments a
              ON a.seat_id = s.id AND a.ended_at IS NULL
       LEFT JOIN members m ON m.id = a.member_id
      WHERE s.is_active = 1
      GROUP BY s.id
      ORDER BY s.sort_order ASC, s.role ASC`,
  ).all()

  return jsonResponse({ seats: results ?? [] })
}