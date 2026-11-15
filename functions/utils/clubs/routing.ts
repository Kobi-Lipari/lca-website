// functions/utils/clubs/routing.ts
//
// Who keeps a club, for the server's own mail: the club's rep, the
// representatives for its region and the LCA admins. Plain SQL over the
// database it is handed, with no import of any kind, so the daily-emails
// worker can import it once a later step sends the club mail from there.
//
// Every answer here carries people's names and addresses. They are for
// server code that sends one email to each person, and never for an
// endpoint's answer: no handler returns a Keeper.
//
// A region can have several seats (seat_regions is keyed by seat and
// region), a seat can be vacant, and one member can hold two seats that
// cover one region; each person is answered once, however many seats they
// hold.

/** One person who keeps a club, as the server's mail reads them. */
export interface Keeper {
  id: string
  full_name: string
  email: string
}

/** Who keeps the club first: its rep, else its region's representatives, else the LCA admins. */
export interface ClubKeepers {
  kind: 'club_rep' | 'region' | 'admins'
  people: Keeper[]
}

/** Each person once, by member id and by address, in the order read. */
function once(rows: Keeper[]): Keeper[] {
  const ids = new Set<string>()
  const addresses = new Set<string>()
  const kept: Keeper[] = []
  for (const row of rows) {
    const address = row.email.trim().toLowerCase()
    if (ids.has(row.id) || addresses.has(address)) continue
    ids.add(row.id)
    addresses.add(address)
    kept.push({ ...row, email: row.email.trim() })
  }
  return kept
}

/** The club's rep or reps: members with the club_rep role and that club. */
export async function clubRepsOf(db: D1Database, clubId: string): Promise<Keeper[]> {
  const { results } = await db
    .prepare(
      `SELECT id, full_name, email FROM members
        WHERE role = 'club_rep' AND club_id = ? AND email LIKE '%@%'
        ORDER BY full_name, id`,
    )
    .bind(clubId)
    .all<Keeper>()
  return once(results ?? [])
}

/**
 * The holders of every active regional seat whose regions cover the club's
 * region, as canManageClub in functions/utils/admin/permissions.ts admits
 * them through the seat: a current assignment (ended_at NULL) of an active
 * seat of the regional_rep category, the rule isRegionalRepFor reads, held
 * by anyone but a guest, since canManageClub refuses a guest before it looks
 * at the seat. A club with no region, a region no seat covers and a vacant
 * seat all answer none.
 */
export async function regionRepresentativesOf(db: D1Database, clubId: string): Promise<Keeper[]> {
  const { results } = await db
    .prepare(
      `SELECT DISTINCT m.id, m.full_name, m.email
         FROM board_seat_assignments a
         JOIN board_members s ON s.id = a.seat_id
         JOIN seat_regions r  ON r.seat_id = s.id
         JOIN clubs c         ON c.region = r.region
         JOIN members m       ON m.id = a.member_id
        WHERE c.id = ?
          AND a.ended_at IS NULL
          AND s.is_active = 1
          AND s.category = 'regional_rep'
          AND m.role <> 'guest'
          AND m.email LIKE '%@%'
        ORDER BY m.full_name, m.id`,
    )
    .bind(clubId)
    .all<Keeper>()
  return once(results ?? [])
}

/** The LCA admins, each once. */
export async function lcaAdmins(db: D1Database): Promise<Keeper[]> {
  const { results } = await db
    .prepare(
      `SELECT id, full_name, email FROM members
        WHERE role = 'lca_admin' AND email LIKE '%@%'
        ORDER BY full_name, id`,
    )
    .all<Keeper>()
  return once(results ?? [])
}

/**
 * Who keeps the club: its rep when it has one; else the representatives for
 * its region; else, while the region's seat is open or the club has no
 * region, the LCA admins.
 */
export async function keeperOf(db: D1Database, clubId: string): Promise<ClubKeepers> {
  const reps = await clubRepsOf(db, clubId)
  if (reps.length > 0) return { kind: 'club_rep', people: reps }
  const region = await regionRepresentativesOf(db, clubId)
  if (region.length > 0) return { kind: 'region', people: region }
  return { kind: 'admins', people: await lcaAdmins(db) }
}
