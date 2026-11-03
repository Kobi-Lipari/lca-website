// functions/utils/events/creation.ts
//
// The database half of the creation rules in domain/events/creation.ts: the
// grant a member creates with, read from their role and, once
// CREATION_ROLES_ON is set, from the President seat; the person the rules
// ask about; and the grant an event's creator holds now. The rules
// themselves stay in domain/, where the pages read them as well.
//
// No function here reads CREATION_ROLES_ON itself, and none has a default
// for rolesOn: each caller, a handler or a helper, imports the constant from
// this file and passes it, read inside the handler at each request and never
// copied into a variable of its own module, as the trim's handlers pass
// CLUB_EMAIL_HIDDEN, so a test can turn it on through a getter on the mocked
// module. Nothing here reads a setting of the environment.

import type { CreationGrant, CreationPerson } from '../../../domain/events/creation'
import type { MemberRow } from '../../types'

/**
 * Set: standing directors and the president may create events, a creator is written as the event's first director,
 * a creator may delete an unpublished draft with no entries, only D24's list may set a fee above $0, and the LCA
 * admins are told by email at the first publish of a standing director's event.
 * Turned on with standingDirectors in src/lib/features.ts, in the same change;
 * test/unit/creation-switch.test.ts holds the two equal.
 */
export const CREATION_ROLES_ON = false

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

/** The three columns of a member the grant is read from. */
export type GrantMember = Pick<MemberRow, 'id' | 'role' | 'club_id'>

/**
 * The grant the member creates with, in this order: lca_admin gives admin;
 * then, only with rolesOn, the President seat gives president, and the
 * tournament_director role gives standing_director; then club_rep with a
 * club gives club_rep; anyone else, none. The seat wins over a role because
 * the seat is the grant and members.role is unchanged (D20, D21). A club
 * rep's right on its own club's events is not part of the grant but the
 * person's repClubId (creationPerson), so a club rep who holds the seat
 * loses nothing. With rolesOn false the seat is never read.
 */
export async function creationGrant(db: D1Database, member: GrantMember, rolesOn: boolean): Promise<CreationGrant> {
  if (member.role === 'lca_admin') return 'admin'
  if (rolesOn) {
    if (await holdsPresidentSeat(db, member.id)) return 'president'
    if (member.role === 'tournament_director') return 'standing_director'
  }
  if (member.role === 'club_rep' && member.club_id) return 'club_rep'
  return 'none'
}

/**
 * The person the rules in domain/events/creation.ts ask about: the grant,
 * the member's id, and the club they manage as its club rep, beside the
 * grant whatever it is.
 */
export async function creationPerson(db: D1Database, member: GrantMember, rolesOn: boolean): Promise<CreationPerson> {
  return {
    grant: await creationGrant(db, member, rolesOn),
    memberId: member.id,
    repClubId: member.role === 'club_rep' ? (member.club_id ?? null) : null,
  }
}

/**
 * The grant the event's creator (tournaments.created_by) holds now, or null
 * when the event or its creator is missing. The creator is read here, in one
 * statement, so a helper that needs it never imports
 * functions/utils/admin/members.ts, whose sign-in client would reach a
 * worker's bundle.
 */
export async function creatorGrant(db: D1Database, tournamentId: string, rolesOn: boolean): Promise<CreationGrant | null> {
  const creator = await db
    .prepare('SELECT m.id, m.role, m.club_id FROM tournaments t JOIN members m ON m.id = t.created_by WHERE t.id = ?')
    .bind(tournamentId)
    .first<GrantMember>()
  return creator ? creationGrant(db, creator, rolesOn) : null
}
