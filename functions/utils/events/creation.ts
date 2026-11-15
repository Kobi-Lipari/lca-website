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
// module. REGION_EVENTS_ON, the regional representatives' switch, is read
// here, inside regionClubIdsOf and draftedInRegion at each call,
// through its module, whatever rolesOn is. Nothing here reads a setting of
// the environment.

import type { CreationGrant, CreationPerson } from '../../../domain/events/creation'
import type { MemberRow } from '../../types'
import { getRegionalClubIds } from '../admin/permissions'
import { REGION_EVENTS_ON } from '../clubs/pages'

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
 * The clubs the member's active regional seats keep, read by
 * getRegionalClubIds (functions/utils/admin/permissions.ts), the one seat
 * rule, which reads a seat's added regions with its own; empty for a guest,
 * as canManageClub refuses one. Read only while REGION_EVENTS_ON is set,
 * whatever CREATION_ROLES_ON is; until then no query is made and the list
 * is empty.
 */
export async function regionClubIdsOf(db: D1Database, member: GrantMember): Promise<string[]> {
  if (!REGION_EVENTS_ON || member.role === 'guest') return []
  return getRegionalClubIds(db, member.id)
}

/** The grant, with the member's regional clubs asked for only when no stronger grant answers first. */
async function grantOf(db: D1Database, member: GrantMember, rolesOn: boolean, regions: () => Promise<readonly string[]>): Promise<CreationGrant> {
  if (member.role === 'lca_admin') return 'admin'
  if (rolesOn) {
    if (await holdsPresidentSeat(db, member.id)) return 'president'
    if (member.role === 'tournament_director') return 'standing_director'
  }
  if (member.role === 'club_rep' && member.club_id) return 'club_rep'
  if ((await regions()).length > 0) return 'regional_rep'
  return 'none'
}

/**
 * The grant the member creates with, in this order: lca_admin gives admin;
 * then, only with rolesOn, the President seat gives president, and the
 * tournament_director role gives standing_director; then club_rep with a
 * club gives club_rep; then, only while REGION_EVENTS_ON is set, an active
 * regional seat that keeps a club gives regional_rep; anyone else, none.
 * The seat wins over a role because the seat is the grant and members.role
 * is unchanged (D20, D21). A club rep's right on its own club's events is
 * not part of the grant but the person's repClubId (creationPerson), so a
 * club rep who holds the seat loses nothing. With rolesOn false the
 * President seat is never read, and with REGION_EVENTS_ON unset no regional
 * seat is.
 */
export async function creationGrant(db: D1Database, member: GrantMember, rolesOn: boolean): Promise<CreationGrant> {
  return grantOf(db, member, rolesOn, () => regionClubIdsOf(db, member))
}

/**
 * The person the rules in domain/events/creation.ts ask about: the grant,
 * the member's id, and the club they manage as its club rep, beside the
 * grant whatever it is; and, only while REGION_EVENTS_ON is set, the clubs
 * their regional seats keep, read once, beside the grant whatever it is.
 * With REGION_EVENTS_ON unset regionClubIds is left out, read by the rules
 * as no club, and the person is exactly as before.
 */
export async function creationPerson(db: D1Database, member: GrantMember, rolesOn: boolean): Promise<CreationPerson> {
  const repClubId = member.role === 'club_rep' ? (member.club_id ?? null) : null
  if (!REGION_EVENTS_ON) return { grant: await creationGrant(db, member, rolesOn), memberId: member.id, repClubId }
  const regionClubIds = await regionClubIdsOf(db, member)
  return { grant: await grantOf(db, member, rolesOn, async () => regionClubIds), memberId: member.id, repClubId, regionClubIds }
}

/**
 * Whether the member drafted the club event (tournaments.created_by is
 * theirs) and their regional seats keep its club: the representative's
 * standing on their own draft, whatever its state, which lets them change its
 * membership switch as canAssignDirectors lets them name its directors. False
 * with no query while REGION_EVENTS_ON is unset, for an LCA-run event and for
 * an event the member did not create.
 */
export async function draftedInRegion(db: D1Database, member: GrantMember, event: { clubId: string | null; createdBy: string | null }): Promise<boolean> {
  if (!REGION_EVENTS_ON || event.clubId === null || event.createdBy !== member.id) return false
  return (await regionClubIdsOf(db, member)).includes(event.clubId)
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
