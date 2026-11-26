// domain/clubs/repRequest.ts
//
// The rules and words of Ask to be its named rep (WS09 step 31), written once
// for the three that hold them: the endpoints' contracts
// (domain/contracts/clubRepRequests.ts) and the server's refusals, the sheet
// a member fills in on a club's page
// (src/areas/clubs/components/RepRequestSheet.tsx), and the keeper's rows in
// My region (src/areas/clubs/components/RepRequestRows.tsx), so every page
// and every answer says a thing in the same words.
//
// Two things are asked and nothing more: how the member is connected to the
// club (one of four, stored as a short fixed key, never the label's words)
// and, only if they want to, a note. The member is the one signed in; no
// name, address, grade or age is asked. The note is capped at 1,000
// characters, since every request is emailed to a volunteer.
//
// Plain code with no zod, so the site's bundle can carry it.
import { hasText } from './contactMessage'

/** The four answers to "How are you connected to the club?", each with its fixed key, its label and its words on a keeper's row. */
export const REP_CONNECTIONS = [
  { key: 'runs_it', label: 'I run it', row: 'Runs it' },
  { key: 'helps_run_it', label: 'I help run it', row: 'Helps run it' },
  { key: 'keeps_page', label: 'I\'d keep the page for the club', row: 'Would keep the page' },
  { key: 'other', label: 'Something else', row: 'Something else' },
] as const

export type RepConnection = (typeof REP_CONNECTIONS)[number]['key']

/** The fixed keys, in the order migration 0066's CHECK lists them, for the contract's closed list. */
export const REP_CONNECTION_KEYS = REP_CONNECTIONS.map((c) => c.key) as unknown as readonly [RepConnection, ...RepConnection[]]

/** A connection's words on a keeper's row and in their email, by its key; the key itself for one the list does not hold. */
export function connectionWords(key: string): string {
  return REP_CONNECTIONS.find((c) => c.key === key)?.row ?? key
}

/** The longest note the endpoint takes. */
export const REP_REQUEST_LIMITS = { note: 1000 } as const

/** The words of each refusal of the form, beside the part it concerns. */
export const REP_REQUEST_FIELD_WORDS = {
  connectionMissing: 'Choose how you are connected to the club.',
  noteLong: `The note can be at most ${REP_REQUEST_LIMITS.note.toLocaleString('en-US')} characters.`,
} as const

export type RepRequestPart = 'connection' | 'note'

/** What is wrong with one part of a request, in words, or null when it may be sent. An empty note is no note. */
export function repRequestFieldError(part: RepRequestPart, value: string): string | null {
  if (part === 'connection') return REP_CONNECTIONS.some((c) => c.key === value) ? null : REP_REQUEST_FIELD_WORDS.connectionMissing
  if (!hasText(value)) return null
  return value.length > REP_REQUEST_LIMITS.note ? REP_REQUEST_FIELD_WORDS.noteLong : null
}

// ── The club's page and the sheet ─────────────────────────────────

/** The invitation's line on a club's page: its lead and its button. */
export const REP_INVITE_LEAD = 'Is this your club?'
export const REP_INVITE_LINK = 'Ask to be its named rep'

/** The sheet's title. */
export function repRequestTitle(clubName: string): string {
  return `Ask to be ${clubName}'s named rep`
}

/** The one sentence the sheet says to a person who is signed out, and its two buttons. */
export const REP_SIGNED_OUT_LINE = 'Log in first, so LCA can link the club\'s page to your account.'
export const REP_LOG_IN = 'Log in to ask'
export const REP_NOT_NOW = 'Not now'

/** The form's question, its note's label and its send button, in frame D's words. */
export const REP_CONNECTION_QUESTION = 'How are you connected to the club?'
export const REP_NOTE_LABEL = 'Anything LCA should know? (optional)'
export const REP_SEND = 'Send request'

/** What the sheet's question mark says, beside the send button: what a named rep does, in practical words. */
export const REP_REQUEST_HELP = 'The named rep keeps the club\'s page up to date: its own words, its news and its events. LCA reads your request and writes to you with the answer.'

/** The sentence once the request is saved. It names no person, region or seat. */
export const REP_REQUEST_SENT = 'Request sent. LCA has it, and you\'ll get an email with the answer. The page doesn\'t change until then.'

/** The words when the request could not be saved. */
export const REP_REQUEST_NOT_SENT = 'We couldn\'t send this. Try again later.'

// ── The server's refusals of a request ────────────────────────────

/** The 403 everyone gets while CLUB_PAGES_ON is unset. */
export const REP_REQUESTS_CLOSED = 'Rep requests cannot be sent from the site yet.'
/** The 403 for a guest account. */
export const REP_REQUEST_GUEST = 'A guest account cannot ask to be a club\'s rep. Log in with a member account to ask.'
/** The 404 for an address part that names no club: the words the club's page gives. */
export const REP_REQUEST_NO_CLUB = 'Club not found'
/** The 409 for a club that already has a named rep. */
export const REP_REQUEST_HAS_REP = 'This club already has a named rep.'
/** The 409 for a member who already has an open request for the club. */
export const REP_REQUEST_ALREADY = 'You have already asked. LCA has your request.'
/** The 429 for one member's hour; the limiter's own words say "from here", which is not so for a count by the member. */
export const REP_REQUEST_MEMBER_BUSY = 'You have sent too many requests this hour. Try again in an hour.'
/** The 429 for one set of keepers' hour, from everyone together. */
export const REP_REQUEST_KEEPERS_BUSY = 'Too many rep requests have been sent this hour. Try again in an hour.'

// ── A keeper's decision ───────────────────────────────────────────

/** The 403 everyone gets while CLUB_KEEPERS_ON is unset. */
export const REP_DECIDE_CLOSED = 'Rep requests cannot be decided yet.'
/** The 403 for anyone who is neither an LCA admin nor the holder of the club's regional seat. */
export const REP_DECIDE_FOR_KEEPERS = 'Rep requests are decided by the representative of the club\'s region and the LCA admins.'
/** The 403 for a keeper's own request. */
export const REP_DECIDE_OWN = 'This is your own request. Another representative of the region or an LCA admin decides it.'
/** The 404 for an id that names no request of this club. */
export const REP_DECIDE_NOT_THIS_CLUBS = 'This is not one of this club\'s rep requests.'
/** The 409 for a request decided already. */
export const REP_DECIDE_ALREADY = 'This request was already decided, so nothing changed.'
/** The 409 when the member's role is not the one the question named. */
export const REP_ROLE_CHANGED = 'Their role has changed. Read the question again.'
/** Where a representative is sent for a member who holds another role. */
export const ADMINS_DECIDE = 'An LCA admin decides this one.'

/** A role a member may hold besides member, as a sentence names it. A club's rep is named by their club. */
const ROLE_WORDS: Record<string, string> = {
  lca_auditor: 'an LCA auditor',
  lca_officer: 'an LCA officer',
  lca_observer: 'an LCA observer',
  tournament_director: 'a tournament director',
  lca_admin: 'an LCA admin',
  guest: 'a guest account',
}

/** "{name} is a tournament director", "{name} is {Other Club}'s rep". */
function holds(name: string, role: string, otherClub: string | null): string {
  if (role === 'club_rep') return `${name} is ${otherClub ? `${otherClub}'s` : 'another club\'s'} rep`
  return `${name} is ${ROLE_WORDS[role] ?? `${role.replace(/_/g, ' ')}`}`
}

/**
 * Why no one may name this member through this door, or null when someone may: an LCA admin (naming them would take
 * their admin role away, and they can already edit every club's page) and a guest account.
 */
export function neverNamed(name: string, role: string): string | null {
  if (role === 'lca_admin') return `${name} is an LCA admin. Naming them a club's rep would take that role away, and an admin can already edit every club's page.`
  if (role === 'guest') return `${name} has a guest account, which cannot be a club's rep.`
  return null
}

/** Why a representative may not name a member who holds another role: the 409's words. */
export function adminsDecideWords(name: string, role: string, otherClub: string | null): string {
  return `${holds(name, role, otherClub)} now, and a member holds one role. ${ADMINS_DECIDE}`
}

/** A representative's row for such a member, in place of Name as rep. */
export function adminsDecideRow(name: string, role: string, otherClub: string | null): string {
  return `An LCA admin decides this one: ${holds(name, role, otherClub)} now, and a member holds one role.`
}

/**
 * What a club's rep may do besides the club's own page: the member directory, which main already opens to the role
 * (functions/utils/auth.ts DIRECTORY_ROLES), so the question says it before anyone is named.
 */
export const REP_DIRECTORY_WORDS = 'They will also be able to look up members in the member directory: names, email addresses and US Chess IDs.'

/** The question Name as rep asks first: what the member will be able to do, the member directory among it. */
export function nameQuestion(name: string, clubName: string): string {
  return `${name} will be able to edit ${clubName}'s page, create its events and set their fees. ${REP_DIRECTORY_WORDS}`
}

/** For an LCA admin naming a member who holds another role: what naming replaces. */
export function replacesWords(name: string, role: string, otherClub: string | null): string {
  if (role === 'club_rep') {
    const other = otherClub ?? 'another club'
    return `${name} is ${otherClub ? `${otherClub}'s` : 'another club\'s'} rep now. Naming them here takes them off ${other}.`
  }
  return `${holds(name, role, otherClub)} now. Naming them rep replaces that.`
}

/** For a plain member whose club on the site is another club: naming moves them. */
export function movesWords(name: string, otherClub: string, clubName: string): string {
  return `${name} is on ${otherClub}'s roster now. Naming them rep moves them to ${clubName}'s.`
}

/**
 * The same, once the club pages are on and no page shows a roster: the member's account names the other club, and
 * naming changes it. The caller chooses between the two by CLUB_PAGES_ON, read where the row is built.
 */
export function accountClubWords(name: string, otherClub: string, clubName: string): string {
  return `${name}'s account names ${otherClub} as their club. Naming them rep changes that to ${clubName}.`
}

/** The question Decline asks first. */
export function declineQuestion(name: string): string {
  return `Decline ${name}'s request? They are told by email.`
}

/**
 * What the rows' status says once a request is decided. told is whether the email to the member went: when it did
 * not, the decision stands all the same and the words ask the person who decided to tell them.
 */
export function namedWords(name: string, clubName: string, told = true): string {
  return told
    ? `${name} is now ${clubName}'s rep. They are told by email.`
    : `${name} is now ${clubName}'s rep. The email to them did not go, so tell them yourself.`
}
export function declinedWords(name: string, told = true): string {
  return told
    ? `${name}'s request was declined. They are told by email.`
    : `${name}'s request was declined. The email to them did not go, so tell them yourself.`
}

/** A row's heading: "Rep request · {Club} · {name} · {connection} · {weekday, date}". */
export function repRequestRowHeading(row: { clubName: string; memberName: string; connection: string; sentOn: string }): string {
  return ['Rep request', row.clubName, row.memberName, connectionWords(row.connection), row.sentOn].join(' · ')
}
