// domain/events/creation.ts
// The creation rules: who may create an event, who may set an entry fee above
// $0, who may name or remove an event's directors and who may delete an
// unpublished draft, as brief 1.4's table "Who may do what on an event" and
// D20 to D24 set them. Each rule reads the person's grant and, beside it, the
// club a club rep manages by role, so a club rep keeps today's rights whatever
// else the person holds. The database half, which works the grant out from
// the member's role and the President seat, is
// functions/utils/events/creation.ts. Every rule takes rolesOn, the value of
// CREATION_ROLES_ON its caller read, so nothing here reads a switch, and the
// server and the pages get the same answers.

import type { TierFees } from './sections'

/**
 * What a person creates with. The president is the member with a current
 * assignment to the President seat, whatever their role (the seat is the
 * grant); a standing director holds today's tournament_director role; a club
 * rep holds club_rep with a club. The president and the standing director
 * count only once CREATION_ROLES_ON is set, and read as none until then.
 */
export type CreationGrant = 'admin' | 'president' | 'standing_director' | 'club_rep' | 'none'

/** The person a rule asks about. */
export interface CreationPerson {
  grant: CreationGrant
  memberId: string
  /**
   * The club a club_rep manages by role (members.role club_rep with a
   * club_id), null for everyone else. The rights it carries hold whatever
   * the grant, so a club rep who holds the President seat keeps every right
   * Q2 leaves club reps.
   */
  repClubId: string | null
}

/** The event a rule asks about: its club, null for an LCA-run event, and its creator. */
export interface CreationEvent {
  clubId: string | null
  createdBy: string | null
}

/** The refusal of a raised fee for anyone not on D24's list: G1's title and its last sentence. */
export const FEES_NEED_PAYOUT_ACCOUNT = 'Entry fees need a payout account first. Until then, your event can run at $0.'

/** The refusal of a create that names a club, for a standing director or the president. */
export const LCA_RUN_ONLY = "Standing directors and the president create LCA-run events, not a club's."

/** D24's list: the grants that may set an entry fee above $0 once CREATION_ROLES_ON is set. */
const MAY_CHARGE: ReadonlySet<CreationGrant> = new Set<CreationGrant>(['admin', 'president', 'standing_director', 'club_rep'])

/** Whether the club is the one the person manages as its club rep; an LCA-run event (no club) never is. */
function repsClub(person: CreationPerson, clubId: string | null): boolean {
  return clubId !== null && clubId === person.repClubId
}

/**
 * Whether the person may create an event for the club, or an LCA-run event
 * when clubId is null. In both states an LCA admin creates for any club or
 * none, and a club rep for their own club only. With rolesOn, the president
 * and a standing director create LCA-run events only (Q37 for the standing
 * director, and for the president the table's membership row: their events
 * are LCA-run). Anyone else may not, nor, with rolesOn false, the president
 * and the standing director.
 */
export function canCreate(person: CreationPerson, clubId: string | null, rolesOn: boolean): boolean {
  if (person.grant === 'admin') return true
  if (repsClub(person, clubId)) return true
  if (rolesOn && (person.grant === 'president' || person.grant === 'standing_director')) return clubId === null
  return false
}

/**
 * Whether the person may set an entry fee above $0 on the event (D24). With
 * rolesOn false everyone may, as today, where anyone requireTournamentManager
 * admits may set a fee. With rolesOn, D24's list may (LCA admins, the
 * president, standing directors and club reps) and no one else. The event
 * changes no answer yet: it has its place for the member-created event, whose
 * fees stay $0 whoever saves (Phase 4), and for WS09's representatives.
 */
export function canChargeFees(person: CreationPerson, event: CreationEvent, rolesOn: boolean): boolean {
  if (!rolesOn) return true
  return MAY_CHARGE.has(person.grant)
}

/**
 * Whether the person may name or remove the event's directors (D21): an LCA
 * admin on any event; a club rep on their own club's events, whatever the
 * grant (today's rule); and, with rolesOn, the president on an event the
 * president created. A standing director never does, nor does anyone else.
 */
export function canAssignDirectors(person: CreationPerson, event: CreationEvent, rolesOn: boolean): boolean {
  if (person.grant === 'admin') return true
  if (repsClub(person, event.clubId)) return true
  return rolesOn && person.grant === 'president' && event.createdBy === person.memberId
}

/**
 * Whether the person may delete the event. An LCA admin may delete any event,
 * as today. With rolesOn, so may its creator, while they still hold the grant
 * that let them create it (canCreate for the event's club) and the event is
 * an unpublished draft (isVisible 0) with no entries; with rolesOn false, no
 * one but an LCA admin.
 */
export function canDeleteDraft(
  person: CreationPerson,
  event: CreationEvent & { isVisible: number; entries: number },
  rolesOn: boolean,
): boolean {
  if (person.grant === 'admin') return true
  if (!rolesOn) return false
  return (
    event.createdBy === person.memberId &&
    canCreate(person, event.clubId, true) &&
    event.isVisible === 0 &&
    event.entries === 0
  )
}

/**
 * Whether the event's rating report may carry LCA's affiliate ID (D23): yes,
 * for every event now. Every event gets the rating report stage, and no
 * member-created event exists until Phase 4, which adds the one case that
 * answers no. The console part reads it.
 */
export function lcaAffiliateAllowed(event: CreationEvent): boolean {
  // The event has its place for Phase 4's case; nothing in it changes the answer yet.
  void event
  return true
}

/** What an entrant pays at each tier, early, regular and late: a tier with no price of its own charges the regular price. */
function paidByTier(fees: TierFees): readonly [number, number, number] {
  return [fees.early ?? fees.regular, fees.regular, fees.late ?? fees.regular]
}

/** A price no one paid: what a key with no match in the earlier list reads as. */
const UNPRICED = [0, 0, 0] as const

/**
 * Whether a save raises a fee (D24): a rise in what an entrant pays at any
 * tier. Each entry of after is compared, tier by tier, with before's entry of
 * the same key, a missing early or late price (null) reading as that entry's
 * regular price in both lists, since an event with no early price charges
 * regular before its deadline and one with no late price charges regular
 * after it; a key with no match in before reads as $0 at every tier. True
 * when any price in after is above before's, so an equal list, an echoed
 * answer, a lowered price, a discount that appears and an entry left out of
 * after are never raises. Both lists are built with tierFees
 * (domain/events/sections.ts).
 */
export function feesRaised(
  before: ReadonlyArray<{ key: string; fees: TierFees }>,
  after: ReadonlyArray<{ key: string; fees: TierFees }>,
): boolean {
  const was = new Map(before.map((entry) => [entry.key, paidByTier(entry.fees)] as const))
  return after.some(({ key, fees }) => {
    const old = was.get(key) ?? UNPRICED
    return paidByTier(fees).some((price, tier) => price > old[tier])
  })
}
