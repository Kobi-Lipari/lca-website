// src/areas/clubs/editor.ts
//
// The plain code of the one club editor (src/areas/clubs/components/ClubEditor.tsx):
// each field's greatest length and the email's written form as the save
// reads them, the checks the form makes before it sends anything, the
// place's line as today's page shows it, and the one thing the editor keeps
// in the browser, that its Help has opened by itself once.
//
// The site may import only types from domain/contracts, whose schemas bring
// zod with them, so the save's numbers are written again here;
// test/unit/club-editor.test.tsx holds each one equal to
// CLUB_TEXT_LIMITS, CLUB_TODAY_LIMITS and CLUB_PLACE_LIMITS in
// domain/contracts/clubs.ts, and the email's form equal to the one
// functions/api/admin/clubs/[id].ts checks. domain/clubs/slug.ts is pure
// code with no import, written for the site and the server alike.
import { SLUG_MAX_LENGTH, isReservedSlug } from '@domain/clubs/slug'

/** The greatest length of each field the editor draws, in characters, as the keepers' save holds them. */
export const EDITOR_LIMITS = {
  aboutText: 2000,
  howWeMeetText: 500,
  contactNamePublic: 100,
  contactEmail: 254,
  name: 120,
  placeName: 120,
  placeStreet: 200,
  placeNote: 300,
  slug: SLUG_MAX_LENGTH,
} as const

export type EditorField = keyof typeof EDITOR_LIMITS

/** The email's written form, as the save checks it: something, an @, something, a dot, something. */
export const EMAIL_FORM = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** A page address as the save takes one: lower case letters and digits in runs joined by single hyphens. */
export const SLUG_FORM = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** What the form holds, every field as typed. */
export interface EditorValues {
  aboutText: string
  howWeMeetText: string
  placeName: string
  placeStreet: string
  placeNote: string
  contactNamePublic: string
  contactEmail: string
  name: string
  region: string
  slug: string
}

/** A number as the page writes it, with a comma in the thousands. */
const counted = (n: number) => n.toLocaleString('en-US')

/** The words for a field over its length, said before anything is sent. */
export function tooLongWords(max: number, length: number): string {
  return `Too long: at most ${counted(max)} characters, and this has ${counted(length)}.`
}

/**
 * Every field the save would refuse, with the words the form shows under
 * it, in the form's own order; an empty list when the form may be sent.
 * `admin` adds the three fields an LCA admin alone sends, and `hadSlug`
 * says the club already has a page address, which then cannot be cleared.
 * `hasPoint` says the first place has a pin, so that it needs a name, as a
 * street or a note does.
 */
export function editorProblems(
  values: EditorValues,
  { admin, hadSlug, hasPoint }: { admin: boolean; hadSlug: boolean; hasPoint: boolean },
): Array<[EditorField, string]> {
  const problems: Array<[EditorField, string]> = []
  const length = (field: EditorField) => {
    const text = values[field as keyof EditorValues]
    if (text.length > EDITOR_LIMITS[field]) problems.push([field, tooLongWords(EDITOR_LIMITS[field], text.length)])
  }
  length('aboutText')
  length('howWeMeetText')
  const placeTouched = values.placeName.trim() !== '' || values.placeStreet.trim() !== '' || values.placeNote.trim() !== '' || hasPoint
  if (placeTouched && values.placeName.trim() === '') problems.push(['placeName', 'A place needs a name.'])
  else length('placeName')
  length('placeStreet')
  length('placeNote')
  length('contactNamePublic')
  const email = values.contactEmail.trim()
  if (email.length > EDITOR_LIMITS.contactEmail) problems.push(['contactEmail', tooLongWords(EDITOR_LIMITS.contactEmail, email.length)])
  else if (email !== '' && !EMAIL_FORM.test(email)) problems.push(['contactEmail', 'Enter the whole email address, such as name@example.org.'])
  if (admin) {
    if (values.name.trim() === '') problems.push(['name', 'The club needs a name.'])
    else length('name')
    const slug = values.slug.trim()
    if (slug === '') {
      if (hadSlug) problems.push(['slug', 'The page needs an address.'])
    } else if (slug.length > EDITOR_LIMITS.slug) {
      problems.push(['slug', tooLongWords(EDITOR_LIMITS.slug, slug.length)])
    } else if (!SLUG_FORM.test(slug)) {
      problems.push(['slug', 'Use lower case letters and digits, joined by single hyphens.'])
    } else if (isReservedSlug(slug)) {
      problems.push(['slug', 'That address is kept for the club pages\' own use.'])
    }
  }
  return problems
}

/** A place as today's page shows it in the club's location: its name, and its street after a comma when it has one. */
export function placeLine(place: { name: string; street: string | null }): string {
  const street = place.street?.trim() ?? ''
  return street ? `${place.name.trim()}, ${street}` : place.name.trim()
}

/** The one key the editor keeps in the browser: that its Help has opened by itself once. */
export const HELP_SHOWN_KEY = 'lca-club-editor-help'

/**
 * Whether Help has opened by itself in this browser before. A browser whose
 * storage cannot be read at all reads as yes, so Help never opens by itself
 * there and opens from its button alone, rather than on every visit. A
 * browser that can read its storage but keeps nothing written to it reads as
 * no each time, so there Help opens by itself on every visit.
 */
export function helpShownBefore(): boolean {
  try {
    return window.localStorage.getItem(HELP_SHOWN_KEY) !== null
  } catch {
    return true
  }
}

export function rememberHelpShown(): void {
  try {
    window.localStorage.setItem(HELP_SHOWN_KEY, 'shown')
  } catch {
    // Nothing is kept: where storage can still be read, Help opens by itself on the next visit too.
  }
}
