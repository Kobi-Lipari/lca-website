// functions/utils/family.ts
//
// Family accounts. A child is a members row whose guardian_id is the parent's
// id; the parent acts for the child (registers, pays, edits bye requests).
/** How many children one family membership covers, besides the adult. */
export const FAMILY_MEMBERSHIP_CHILDREN = 3

export interface ChildRow {
  id: string
  full_name: string
  uscf_id: string | null
  uscf_rating: number | null
  membership_status: string
  membership_expiry: string | null
  membership_type: string | null
  created_at: string
  grade: string | null
}

export async function listChildren(db: D1Database, guardianId: string): Promise<ChildRow[]> {
  const { results } = await db
    .prepare(
      `SELECT id, full_name, uscf_id, uscf_rating, membership_status, membership_expiry,
              membership_type, created_at, grade
         FROM members
        WHERE guardian_id = ?
        ORDER BY created_at ASC, rowid ASC`,
    )
    .bind(guardianId)
    .all<ChildRow>()
  return results ?? []
}

/** The acting member may act for `memberId`: it is them, or their child. */
export async function canActFor(
  db: D1Database,
  actingMemberId: string,
  memberId: string,
): Promise<boolean> {
  if (actingMemberId === memberId) return true
  const row = await db
    .prepare('SELECT 1 FROM members WHERE id = ? AND guardian_id = ?')
    .bind(memberId, actingMemberId)
    .first()
  return !!row
}

/**
 * Gives the guardian's family membership to their first N children (in the
 * order they were added): same status, same expiry. Children past the limit
 * are left as they are. Safe to call repeatedly — it only ever copies the
 * guardian's current state, and only while that is an active family
 * membership.
 */
export async function syncFamilyCoverage(db: D1Database, guardianId: string): Promise<void> {
  const guardian = await db
    .prepare('SELECT membership_status, membership_expiry, membership_type FROM members WHERE id = ?')
    .bind(guardianId)
    .first<{ membership_status: string; membership_expiry: string | null; membership_type: string | null }>()
  if (!guardian || guardian.membership_type !== 'family' || guardian.membership_status !== 'active') return

  const children = await listChildren(db, guardianId)
  const covered = children.slice(0, FAMILY_MEMBERSHIP_CHILDREN)
  if (covered.length === 0) return

  await db.batch(
    covered.map((c) =>
      db
        .prepare(
          `UPDATE members
              SET membership_status = 'active', membership_expiry = ?, membership_type = 'family'
            WHERE id = ? AND guardian_id = ?`,
        )
        // Never shorten a child's own longer membership.
        .bind(
          laterDate(c.membership_expiry, guardian.membership_expiry),
          c.id,
          guardianId,
        ),
    ),
  )
}

function laterDate(a: string | null, b: string | null): string | null {
  if (!a) return b
  if (!b) return a
  return a > b ? a : b
}

