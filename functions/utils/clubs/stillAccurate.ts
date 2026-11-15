// functions/utils/clubs/stillAccurate.ts
//
// Still accurate, the one write both of its ways in make: the button on a
// club's card in My region (functions/api/admin/clubs/[id]/confirm.ts) and
// the link in the monthly check's email
// (functions/api/clubs/confirm/[token].ts). It sets the club's last check,
// last_confirmed_at, to now and confirmed_by to the person, for that club
// alone, and changes none of the listing's words, so told_updated_at and
// told_by stay as they are. It writes no activity row and sends no email.
// Written once here so the two can never part.
//
// Plain SQL over the database it is handed, with no import of any kind.

/**
 * Marks one club as checked now by one person. Answers the new stamp, stored in UTC by datetime('now'), or null when
 * no club has that id.
 */
export async function markStillAccurate(db: D1Database, clubId: string, memberId: string): Promise<{ last_confirmed_at: string } | null> {
  const row = await db.prepare(
    `UPDATE clubs SET last_confirmed_at = datetime('now'), confirmed_by = ?
      WHERE id = ?
      RETURNING last_confirmed_at`,
  )
    .bind(memberId, clubId)
    .first<{ last_confirmed_at: string }>()
  return row ?? null
}
