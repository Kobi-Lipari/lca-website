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

/**
 * Set: GET /api/clubs/[id] answers the club without its contact_email.
 * Turned on with clubEmailHidden in src/lib/features.ts, in the same change;
 * test/unit/public-answer-switches.test.ts holds the two equal.
 */
export const CLUB_EMAIL_HIDDEN = false

/**
 * The club's row as the public club page is answered it: as stored, or,
 * with `hideEmail` (CLUB_EMAIL_HIDDEN set), without contact_email, the key
 * left out rather than set to null. The row handed in is not changed.
 */
export function publicClubAnswer<Club extends object>(club: Club, hideEmail: boolean): Club | Omit<Club, 'contact_email'> {
  if (!hideEmail) return club
  const trimmed = { ...club } as Record<string, unknown>
  delete trimmed.contact_email
  return trimmed as Omit<Club, 'contact_email'>
}
