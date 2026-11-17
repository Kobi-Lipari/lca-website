// functions/utils/clubs/authorLine.ts
//
// The two lines a club page writes about who keeps it and whose words it
// shows, built here on the server and answered as words alone, so no
// keeper's id, email or full name ever reaches a page.
//
// The author line, as the brief words it (REDESIGN_SPEC.md, the club page's
// "The author line"):
//   - the club's rep:      "Kept by the club's rep, {first name and last initial}"
//   - no rep:              "This club hasn't named a rep yet · Kept by {name}, the {region} representative"
//   - the seat is open:    "Kept by LCA admins until the {region} seat is filled"
// Who keeps the club is read by keeperOf in functions/utils/clubs/routing.ts,
// the rule the club mail reads: its rep, else the representatives whose
// seats cover its region, else the LCA admins. Where several people keep it,
// the first in that rule's order (by full name, then id) is named. A club
// with no region at all, which no seat can cover, reads "Kept by LCA admins".
//
// A name is the first name and last initial alone (firstNameLastInitial in
// domain/households/publicName.ts, the one helper the site has). A person
// the site knows to be under 18 is never named: the line then reads "Kept by
// the club's rep", or "Kept by the {region} representative" after the first
// part. The site keeps two signs of that, the ones the entrants list reads
// (D15, functions/api/tournaments/[id].ts): a members row with a guardian_id
// (migration 0036), and any entry of theirs that confirmed a scholastic
// range, registrations.grade set (migrations 0042 and 0043). An entry's mark
// is read whenever it was made, since the site keeps no birth date and so
// cannot tell when a player turned 18. A minor with neither sign cannot be
// told.
//
// The told line, under the meeting statement (the brief's "When and where"):
//   - "As told by the club, updated {month}" when the club's own rep saved it
//   - "As told to LCA, {month}" while told_by is empty, or anyone else saved it
// The month is told_updated_at in words with its year, read in Central time
// (monthInWords). A representative's save reads "As told to LCA": the brief
// names only the club's rep and an LCA admin, and a representative is an LCA
// volunteer rather than the club. The saver's role is read as it is now.

import { keeperOf } from './routing'
import { firstNameLastInitial } from '../../../domain/households/publicName'
import { monthInWords } from '../../../domain/clubs/monthlyCheck'

/** Who keeps a club, as the author line words it. */
export type AuthorKind = 'club_rep' | 'region' | 'admins'

/**
 * The name a public line may print for a person: first name and last
 * initial, or null for a child, a name with nothing in it, and a name that
 * is an email address or its first part. A member who signs in with no name
 * is given the part of their email before the @ as their name
 * (upsertMemberFromAuth in functions/utils/admin/members.ts), and that is
 * never printed.
 */
export function nameForLine(fullName: string | null | undefined, isChild: boolean, email?: string | null): string | null {
  if (isChild) return null
  const name = firstNameLastInitial(fullName ?? '')
  if (name === '' || name.includes('@')) return null
  const local = (email ?? '').split('@')[0].trim().toLowerCase()
  if (local !== '' && name.toLowerCase() === local) return null
  return name
}

/** The author line's words, from who keeps the club, the name to print (null for none) and the club's region. */
export function authorWords(kind: AuthorKind, name: string | null, region: string | null): string {
  const place = region?.trim() || null
  if (kind === 'club_rep') return name ? `Kept by the club's rep, ${name}` : 'Kept by the club\'s rep'
  if (kind === 'region' && place) {
    const keeper = name ? `${name}, the ${place} representative` : `the ${place} representative`
    return `This club hasn't named a rep yet · Kept by ${keeper}`
  }
  return place ? `Kept by LCA admins until the ${place} seat is filled` : 'Kept by LCA admins'
}

/** The told line's words: the club's own, or LCA's, with the month of the last save when there is one. */
export function toldWords(byClub: boolean, stamp: string | null | undefined): string {
  const month = monthInWords(stamp)
  if (byClub) return month ? `As told by the club, updated ${month}` : 'As told by the club'
  return month ? `As told to LCA, ${month}` : 'As told to LCA'
}

/** The club's author line, read from who keeps it now. */
export async function clubAuthorLine(db: D1Database, club: { id: string; region: string | null }): Promise<string> {
  const keepers = await keeperOf(db, club.id)
  const first = keepers.kind === 'admins' ? undefined : keepers.people[0]
  if (!first) return authorWords('admins', null, club.region)
  const row = await db
    .prepare(
      `SELECT (m.guardian_id IS NOT NULL
               OR EXISTS (SELECT 1 FROM registrations r WHERE r.member_id = m.id AND r.grade IS NOT NULL)) AS child
         FROM members m WHERE m.id = ?`,
    )
    .bind(first.id)
    .first<{ child: number }>()
  const isChild = row?.child === 1
  return authorWords(keepers.kind, nameForLine(first.full_name, isChild, first.email), club.region)
}

/** The club's told line: whether its own rep saved its words last, and the month of that save. */
export async function clubToldLine(
  db: D1Database,
  club: { id: string; told_by: string | null; told_updated_at: string | null },
): Promise<string> {
  if (!club.told_by) return toldWords(false, club.told_updated_at)
  const saver = await db
    .prepare('SELECT role, club_id FROM members WHERE id = ?')
    .bind(club.told_by)
    .first<{ role: string; club_id: string | null }>()
  const byClub = saver?.role === 'club_rep' && saver.club_id === club.id
  return toldWords(byClub, club.told_updated_at)
}
