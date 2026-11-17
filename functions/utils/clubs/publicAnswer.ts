// functions/utils/clubs/publicAnswer.ts
//
// What GET /api/clubs/[id], today's club page's answer, leaves out (the
// Phase 0 trim of the public answers, D29). Each officer is answered by role
// and name alone, never with an email, with no switch: no page reads an
// officer's email (brief 0.2). The club's own contact email follows
// CLUB_EMAIL_HIDDEN: once it is set the answer carries no contact_email, and
// today's club page, with clubEmailHidden on, offers "Contact this club
// through LCA", a link to the contact form, in its place. WS09's relay to the
// club's own address or its region's representative replaces that link.
//
// The answer also carries only the columns PUBLIC_CLUB_COLUMNS names, so a
// column added to clubs later is never public by accident: it reaches the
// answer only once it is named here, in the select of
// functions/api/clubs/[id].ts and in the contract.

/**
 * Set: GET /api/clubs/[id] answers the club without its contact_email.
 * Turned on with clubEmailHidden in src/lib/features.ts, in the same change;
 * test/unit/public-answer-switches.test.ts holds the two equal.
 */
export const CLUB_EMAIL_HIDDEN = false

/**
 * The columns of clubs the public club answer carries: today's 13, in the
 * table's own order. clubRowSchema in domain/contracts/clubs.ts names the
 * same 13, and GET /api/clubs/[id] selects exactly these.
 */
export const PUBLIC_CLUB_COLUMNS = [
  'id',
  'name',
  'city',
  'location',
  'description',
  'meeting_schedule',
  'contact_email',
  'created_at',
  'color',
  'image_url',
  'region',
  'latitude',
  'longitude',
] as const

export type PublicClubColumn = (typeof PUBLIC_CLUB_COLUMNS)[number]

/** A club row cut down to the named columns it holds. */
export type PublicClubRow<Club> = Pick<Club, Extract<keyof Club, PublicClubColumn>>

const isPublicColumn = (key: string): key is PublicClubColumn => (PUBLIC_CLUB_COLUMNS as readonly string[]).includes(key)

/**
 * The club's row as the public club page is answered it: only the keys
 * PUBLIC_CLUB_COLUMNS names, in the row's own order, and then, with
 * `hideEmail` (CLUB_EMAIL_HIDDEN set), without contact_email, the key left
 * out rather than set to null. A row that holds only named keys is handed
 * back as it is while the email is shown. The row handed in is not changed.
 */
export function publicClubAnswer<Club extends object>(
  club: Club,
  hideEmail: boolean,
): PublicClubRow<Club> | Omit<PublicClubRow<Club>, 'contact_email'> {
  const keys = Object.keys(club)
  if (!hideEmail && keys.every(isPublicColumn)) return club
  const row = club as Record<string, unknown>
  const kept: Record<string, unknown> = {}
  for (const key of keys) if (isPublicColumn(key)) kept[key] = row[key]
  if (hideEmail) delete kept.contact_email
  return kept as PublicClubRow<Club> | Omit<PublicClubRow<Club>, 'contact_email'>
}
