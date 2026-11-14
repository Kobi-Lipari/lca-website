// src/areas/clubs/previews.ts
//
// The plain code of the club editor's preview column
// (src/areas/clubs/components/SearchPreview.tsx, SharePreview.tsx,
// CardPreview.tsx and PageChecklist.tsx): a club's initials, whether it has a
// colour and a logo of its own, and the page's checklist. The previews are
// drawings of the club's own data, so nothing here reaches for another site:
// a logo is drawn only from the club's own stored path on this site, never
// from an address someone typed.

/**
 * The database's default colour (migration 0009), brand gold: a club that
 * still has it has not picked a colour of its own, and navy stands in for it,
 * as it does for a club with none.
 */
export const DEFAULT_CLUB_COLOR = '#c8a94a'

/** A colour as the save keeps one: a # and six hex digits. */
const HEX_COLOR = /^#[0-9a-f]{6}$/i

/** The club's own colour, in lower case, or null when it has none or still has the default gold. */
export function ownColour(color: string | null | undefined): string | null {
  if (!color || !HEX_COLOR.test(color)) return null
  const lower = color.toLowerCase()
  return lower === DEFAULT_CLUB_COLOR ? null : lower
}

/**
 * A club's logo as the previews may draw it: the path the logo upload stores
 * on this site (`/api/clubs/:id/logo?v=...`), or null for none or for an
 * address on any other site.
 */
export function ownLogo(imageUrl: string | null | undefined): string | null {
  if (!imageUrl || !imageUrl.startsWith('/') || imageUrl.startsWith('//') || imageUrl.startsWith('/\\')) return null
  return imageUrl
}

/**
 * A club's initials, for the card a shared link shows when the club has no
 * logo: the first letter of each of the first two words of its name, or the
 * first two letters of a name of one word, in capitals (Example Chess Club
 * gives EC, as the board draws a club's two letters).
 */
export function clubInitials(name: string): string {
  const words = name.split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  if (words.length === 0) return '?'
  const letters = words.length === 1 ? [...words[0]].slice(0, 2).join('') : words.slice(0, 2).map((w) => [...w][0]).join('')
  return letters.toUpperCase()
}

/** One line of the page's checklist: what it is and whether the page has it. */
export interface ChecklistItem {
  label: string
  done: boolean
}

/** The page's checklist, in its order: the meeting's words, a pinned place, the email for messages, a logo and a colour. */
export function pageChecklist({
  statement, pinned, email, logo, colour,
}: { statement: string; pinned: boolean; email: string; logo: string | null | undefined; colour: string | null | undefined }): ChecklistItem[] {
  return [
    { label: 'How the club meets, in your words', done: statement.trim() !== '' },
    { label: 'A place pinned on the map', done: pinned },
    { label: 'Email for messages', done: email.trim() !== '' },
    { label: 'Logo', done: ownLogo(logo) !== null },
    { label: 'Club colour', done: ownColour(colour) !== null },
  ]
}
