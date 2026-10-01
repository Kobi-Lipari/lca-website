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
            s.photo_url,
            COALESCE(GROUP_CONCAT(m.full_name, ' & '), s.name) AS holder_name,
            COUNT(a.id) AS holder_count
       FROM board_members s
       LEFT JOIN board_seat_assignments a
              ON a.seat_id = s.id AND a.ended_at IS NULL
       LEFT JOIN members m ON m.id = a.member_id
      WHERE s.is_active = 1
      GROUP BY s.id
      ORDER BY s.sort_order ASC, s.role ASC`,
  ).all<Record<string, unknown>>()

  // Each current holder, for photos (a shared seat can have several).
  const held = await context.env.DB.prepare(
    `SELECT a.seat_id, m.id AS member_id, m.full_name AS name, m.photo_url
       FROM board_seat_assignments a
       JOIN members m ON m.id = a.member_id
      WHERE a.ended_at IS NULL
      ORDER BY a.started_at`,
  ).all<{ seat_id: string; member_id: string; name: string; photo_url: string | null }>()
  const bySeat = new Map<string, Array<{ member_id: string; name: string; photo_url: string | null }>>()
  for (const h of held.results ?? []) {
    bySeat.set(h.seat_id, [...(bySeat.get(h.seat_id) ?? []), { member_id: h.member_id, name: h.name, photo_url: h.photo_url }])
  }

  return jsonResponse({ seats: (results ?? []).map((s) => ({ ...s, holders: bySeat.get(s.id as string) ?? [] })) })
}