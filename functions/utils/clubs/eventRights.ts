// functions/utils/clubs/eventRights.ts
//
// What a person may do with a club's events, worked out by the server for
// the pages (WS09 step 19), so that no page works a permission out from a
// role or a seat. Read only while REGION_EVENTS_ON is set, by
// GET /api/admin/clubs/[id], which carries the answer as `eventRights`.
//
// - add: whether the create (POST /api/admin/tournaments) admits the person
//   for this club, by the same rules it asks: canCreate for the person
//   creationPerson reads, a club rep with no club refused as the create
//   refuses one, and 'for_approval' where the person creates as the
//   region's representative (regionAlone), so the event is marked for an
//   LCA admin's approval and its fees stay at $0.
// - manage: whether the person runs the club's events, as
//   canManageTournament admits them: an LCA admin, the club's own rep, and,
//   while REGION_EVENTS_ON is set, a holder of a regional seat that keeps
//   the club. An observer reads them and runs none.
// - decide: whether the person approves the club's waiting events or asks
//   for changes, as the approval endpoint's requireAdmin admits: an LCA
//   admin, the endpoint asking the second factor itself.
// - askPayout: whether "Ask LCA to set up my payout account" can go through,
//   which POST /api/me/payout-request allows only while CREATION_ROLES_ON is
//   set; until then it answers 403 to everyone, so the page draws no ask.
import type { MemberRow } from '../../types'
import { CREATION_ROLES_ON, creationPerson } from '../events/creation'
import { canCreate, regionAlone } from '../../../domain/events/creation'
import type { ClubEventRights } from '../../../domain/contracts/clubs'

export async function clubEventRights(db: D1Database, member: MemberRow, clubId: string): Promise<ClubEventRights> {
  const rolesOn = CREATION_ROLES_ON
  const person = await creationPerson(db, member, rolesOn)
  const repWithoutClub = member.role === 'club_rep' && !member.club_id
  const mayCreate = !repWithoutClub && canCreate(person, clubId, rolesOn)
  const add = !mayCreate ? 'no' : regionAlone(person, clubId) ? 'for_approval' : 'yes'
  const manage = person.grant === 'admin'
    || (member.role === 'club_rep' && member.club_id === clubId)
    || (member.role !== 'guest' && (person.regionClubIds ?? []).includes(clubId))
  return { add, manage, decide: person.grant === 'admin', askPayout: rolesOn }
}
