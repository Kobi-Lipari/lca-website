// functions/utils/clubs/memberView.ts
//
// What the admin club endpoints show of a club's members to the people
// they admit. requireClubView and requireClubRep let in an LCA admin, an
// observer (lca_observer or lca_officer, for reading), the club's own rep,
// and anyone who holds a regional seat that covers the club's region
// (canManageClub in functions/utils/admin/permissions.ts). The first three
// see the club's roster and its officers' emails as before.
//
// A person admitted by the region alone keeps the club's listing, its news
// and its logo, but not its members: no roster (no member's email, US Chess
// ID, rating or membership status) and no officer's email. That rule is K's
// answer to choice 1 of the WS09 plan, which keeps the roster and the
// officers' emails with LCA admins and the club's own rep once the clubs'
// regions are filled; the roster and officers tools leave the admin club
// page for everyone later in WS09. permissions.ts is not changed: the
// seat still admits the person, and these endpoints answer them less.

import { isObserver } from '../auth'

/**
 * The 403 the roster endpoint, and the officers endpoint's POST, answer a
 * person admitted by the region alone.
 */
export const ROSTER_KEPT_BACK = 'A club\'s roster is kept for LCA admins and the club\'s own rep.'

/**
 * True when the member reached a club's endpoint only through a regional
 * seat: not an LCA admin, not an observer and not this club's own rep. Read
 * it only after requireClubView or requireClubRep has admitted the member.
 */
export function admittedByRegionAlone(member: { role: string; club_id: string | null }, clubId: string): boolean {
  if (member.role === 'lca_admin') return false
  if (isObserver(member)) return false
  if (member.role === 'club_rep' && member.club_id === clubId) return false
  return true
}

/** The officer rows without their email, every other key kept in its order. */
export function officersWithoutEmail<T extends Record<string, unknown>>(rows: T[]): Array<Omit<T, 'email'>> {
  return rows.map((row) => {
    const rest: Record<string, unknown> = { ...row }
    delete rest.email
    return rest as Omit<T, 'email'>
  })
}
