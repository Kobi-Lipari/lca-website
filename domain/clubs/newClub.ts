// domain/clubs/newClub.ts
//
// The rules and words of Suggest a club and Start a club (WS09 step 30),
// one form with a switch, written once for the three that hold them: the
// endpoint's contract (domain/contracts/clubRequests.ts), the form a visitor
// fills in (src/areas/clubs/components/SuggestClubForm.tsx) and the keeper's
// rows in My region, so the form refuses in the same words the server would,
// beside the field it concerns, and every page names a kind in the same
// words.
//
// Five things and nothing more: the club's name, a city or ZIP code as the
// person types it, where and when in their own words, their name and their
// address, which a keeper needs to check with them. No grade, no age, no
// club of their own. The caps keep every email small: a club's name of 100
// characters is longer than any club the site lists, and a city or ZIP code
// of 100 is longer than any town's name with its state and ZIP code; the
// words of where and when are capped at 2,000 characters, as a suggestion's
// are; a name at 100 and an address at 254, as the contact relay's.
//
// Plain code with no zod, so the site's bundle can carry it.
import { hasLineBreak, hasText, isPlainAddress } from './contactMessage'

/** The form's two kinds, as club_reports stores them. */
export const CLUB_REQUEST_KINDS = ['new_club', 'start_club'] as const

export type ClubRequestKind = (typeof CLUB_REQUEST_KINDS)[number]

/** The longest value of each field the endpoint takes. */
export const CLUB_REQUEST_LIMITS = { clubName: 100, place: 100, message: 2000, name: 100, email: 254 } as const

export type ClubRequestField = keyof typeof CLUB_REQUEST_LIMITS

/** Each kind's title: the switch's two sides, the page's heading and the document's title. */
export const CLUB_REQUEST_TITLES: Record<ClubRequestKind, string> = {
  new_club: 'Suggest a club',
  start_club: 'Start a club',
}

/** Each kind as a keeper's row names it. */
export const CLUB_REQUEST_ROW_WORDS: Record<ClubRequestKind, string> = {
  new_club: 'New club suggested',
  start_club: 'Wants to start a club',
}

/** The fields' labels, in the frame's words where it has them; where and when differs by kind. */
export const CLUB_REQUEST_LABELS = {
  clubName: 'Club name',
  place: 'City or ZIP',
  message: {
    new_club: 'Where and when it meets, in your words',
    start_club: 'Where and when you\'d meet, in your words',
  },
  name: 'Your name',
  email: 'Your email (stays private)',
} as const

/** The send button's words. */
export const CLUB_REQUEST_SEND = 'Send to LCA'

/** The one sentence once it is sent, true wherever it went: it names no region, no seat and no person. */
export const CLUB_REQUEST_SENT: Record<ClubRequestKind, string> = {
  new_club: 'Sent. LCA checks with you, then it goes on the map.',
  start_club: 'Sent. LCA checks with you about getting it started.',
}

/** The words when it could not be saved. */
export const CLUB_REQUEST_NOT_SENT = 'We couldn\'t send this. Try again later.'

/** The words of each refusal, beside the field it concerns. */
export const CLUB_REQUEST_FIELD_WORDS = {
  kindMissing: 'Choose Suggest a club or Start a club.',
  clubNameMissing: 'Enter the club\'s name.',
  clubNameLong: `The club's name can be at most ${CLUB_REQUEST_LIMITS.clubName} characters.`,
  clubNameBreak: 'Write the club\'s name on one line.',
  placeMissing: 'Enter a city or a ZIP code.',
  placeLong: `The city or ZIP can be at most ${CLUB_REQUEST_LIMITS.place} characters.`,
  placeBreak: 'Write the city or ZIP on one line.',
  messageMissing: 'Write where and when, in your words.',
  messageLong: `Where and when can be at most ${CLUB_REQUEST_LIMITS.message.toLocaleString('en-US')} characters.`,
  nameMissing: 'Enter your name.',
  nameLong: `Your name can be at most ${CLUB_REQUEST_LIMITS.name} characters.`,
  nameBreak: 'Write your name on one line.',
  emailMissing: 'Enter your email address.',
  emailLong: `Your email address can be at most ${CLUB_REQUEST_LIMITS.email} characters.`,
  emailForm: 'Enter one email address, like name@example.org.',
} as const

/** What is wrong with one field's value, in words, or null when it may be sent. */
export function clubRequestFieldError(field: ClubRequestField, value: string): string | null {
  const w = CLUB_REQUEST_FIELD_WORDS
  const max = CLUB_REQUEST_LIMITS[field]
  if (field === 'message') {
    if (!hasText(value)) return w.messageMissing
    return value.length > max ? w.messageLong : null
  }
  if (field === 'email') {
    if (!hasText(value)) return w.emailMissing
    if (value.length > max) return w.emailLong
    return hasLineBreak(value) || !isPlainAddress(value.trim()) ? w.emailForm : null
  }
  const [missing, long, brk] = field === 'clubName'
    ? [w.clubNameMissing, w.clubNameLong, w.clubNameBreak]
    : field === 'place' ? [w.placeMissing, w.placeLong, w.placeBreak] : [w.nameMissing, w.nameLong, w.nameBreak]
  if (!hasText(value)) return missing
  if (value.length > max) return long
  return hasLineBreak(value) ? brk : null
}

/** A person's first name, for a keeper's "Email {first name}": the first word of what they typed, or "them" for none. */
export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] || 'them'
}
