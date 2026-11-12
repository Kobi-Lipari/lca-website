// functions/utils/admin/mediaManager.ts
//
// The media manager (WS16 step 6; D39, from K's decisions 14, 17 and 28):
// the person who may write and send the LCA newsletter beside the LCA admins
// and the president, and nothing else of Admin. The grant is a board seat,
// Media manager, as the President seat is the president's grant
// (functions/utils/events/creation.ts) and a seat's holder reads that seat's
// inbox (requireSeatAccess in ../auth.ts): a current assignment, ended_at
// empty, to the active seat whose link name is MEDIA_MANAGER_SEAT. It is
// read at each request and never remembered, so the grant ends the moment
// the term ends or the seat is marked inactive, with nothing else to turn
// off. K adds the seat on switch-on day the way seats are added today, with
// its holder on the seat screen, so no migration writes it.
//
// This file imports nothing, so whatever imports it takes in no other code;
// in particular functions/utils/events/creation.ts stays out of every file
// that imports this one.

/**
 * The seat's link name, the one functions/api/governance/board.ts gives a
 * seat titled "Media manager" (slugifyRole). A second seat of that title
 * would be given 'media-manager-2', which grants nothing. If K's seat comes
 * out under another link name, this is the one constant to change.
 */
export const MEDIA_MANAGER_SEAT = 'media-manager'

/**
 * Whether the member holds the Media manager seat now: one read of one
 * indexed row (idx_seat_assignments_member, on the member and ended_at),
 * matching the link name exactly, letter case and spaces included.
 */
export async function holdsMediaManagerSeat(db: D1Database, memberId: string): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT 1 AS held
         FROM board_seat_assignments a
         JOIN board_members s ON s.id = a.seat_id
        WHERE a.member_id = ?
          AND a.ended_at IS NULL
          AND s.slug = ?
          AND s.is_active = 1
        LIMIT 1`,
    )
    .bind(memberId, MEDIA_MANAGER_SEAT)
    .first<{ held: number }>()
  return row !== null
}
