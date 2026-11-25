// functions/utils/admin/presidentSeat.ts
//
// Whether a member holds the President seat now, the one read of it shared by
// the creation rules (functions/utils/events/creation.ts, which hands it on)
// and the mail guards (requireMailer and requireListMailer in ../auth.ts).
// The seat is the grant, read at each request and never remembered, so it
// ends the moment the term ends or the seat is marked inactive.
//
// This file imports nothing, so whatever imports it takes in no other code;
// in particular functions/utils/events/creation.ts and ../auth.ts stay out of
// each other.

/**
 * Whether the member holds the President seat now: a current assignment
 * (ended_at empty) to the active seat whose slug is 'president', the seat
 * migration 0011 seeded as "President" and 0025 gave that slug. The seat is
 * the grant (D20, D21), so members.role is not read here.
 */
export async function holdsPresidentSeat(db: D1Database, memberId: string): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT 1
         FROM board_seat_assignments a
         JOIN board_members s ON s.id = a.seat_id
        WHERE a.member_id = ?
          AND a.ended_at IS NULL
          AND s.is_active = 1
          AND s.slug = 'president'
        LIMIT 1`,
    )
    .bind(memberId)
    .first()
  return !!row
}
