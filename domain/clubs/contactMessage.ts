// domain/clubs/contactMessage.ts
//
// The rules of a message sent to a club from its page (WS09 step 26), written
// once for the two that hold them: the endpoint's contract
// (domain/contracts/clubContact.ts) and the form a visitor fills in
// (src/areas/clubs/components/ContactRelayForm.tsx), so the form refuses in
// the same words the server would, beside the field it concerns.
//
// Three fields and nothing more: a name to sign with, an address the club
// can answer, and the message. No grade, no age, no club of the visitor's
// own. The caps keep every mail small and give a sender nothing to fill a
// mailbox with: a name of 100 characters is longer than any person's, an
// address of 254 is the longest a mail server takes, and a message of 5,000
// characters is a long letter.
//
// Plain code with no zod and no import, so the site's bundle can carry it.

/** The longest name, address and message the endpoint takes. */
export const CONTACT_LIMITS = { name: 100, email: 254, message: 5000 } as const

export type ContactField = keyof typeof CONTACT_LIMITS

/** Any line break or other control character, which a name or an address never holds. */
const BREAK = /[\p{Cc}\u2028\u2029]/u

/**
 * One plain address: no space or line break, no comma, no angle bracket, no
 * quote and nothing else a mail header reads as a second address or a
 * display name, one @, and a dot in the part after it.
 */
const PLAIN_ADDRESS = /^[^\s@,<>"()[\];:\\\p{Cc}]+@[^\s@,<>"()[\];:\\\p{Cc}]+\.[^\s@,<>"()[\];:\\\p{Cc}]+$/u

/** Text with something in it once its spaces are taken off. */
export const hasText = (value: string): boolean => value.trim() !== ''

/** True when the text holds a line break or another control character. */
export const hasLineBreak = (value: string): boolean => BREAK.test(value)

/** True for one plain address, as the relay may set it as a reply-to. */
export const isPlainAddress = (value: string): boolean => PLAIN_ADDRESS.test(value)

/** The words of each refusal, beside the field it concerns. */
export const CONTACT_FIELD_WORDS = {
  nameMissing: 'Enter your name.',
  nameLong: `Your name can be at most ${CONTACT_LIMITS.name} characters.`,
  nameBreak: 'Write your name on one line.',
  emailMissing: 'Enter your email address.',
  emailLong: `Your email address can be at most ${CONTACT_LIMITS.email} characters.`,
  emailForm: 'Enter one email address, like name@example.org.',
  messageMissing: 'Write your message.',
  messageLong: 'Your message can be at most 5,000 characters.',
} as const

/** What is wrong with one field's value, in words, or null when it may be sent. */
export function contactFieldError(field: ContactField, value: string): string | null {
  const w = CONTACT_FIELD_WORDS
  if (field === 'name') {
    if (!hasText(value)) return w.nameMissing
    if (value.length > CONTACT_LIMITS.name) return w.nameLong
    if (hasLineBreak(value)) return w.nameBreak
    return null
  }
  if (field === 'email') {
    if (!hasText(value)) return w.emailMissing
    if (value.length > CONTACT_LIMITS.email) return w.emailLong
    if (!isPlainAddress(value.trim())) return w.emailForm
    return null
  }
  if (!hasText(value)) return w.messageMissing
  if (value.length > CONTACT_LIMITS.message) return w.messageLong
  return null
}

/** Every place a club's messages can go, for the contract's closed list: never a person, an address or how many. */
export const CONTACT_GOES_TO = ['club', 'region', 'lca'] as const

/** Where a club's messages go, as the page's answer names it. */
export type ContactGoesTo = (typeof CONTACT_GOES_TO)[number]

/**
 * The one line above the form, said before the visitor sends: where the
 * message goes, with no name of a volunteer and no address. The region's
 * representative is named by the region alone.
 */
export function contactGoesLine(goesTo: ContactGoesTo, region: string | null): string {
  if (goesTo === 'club') return 'Your message goes to the club\'s contact by email. Their address stays private.'
  if (goesTo === 'region') {
    const area = region?.trim()
    return area
      ? `No club address on file, so your message goes to the ${area} representative by email.`
      : 'No club address on file, so your message goes to the region\'s representative by email.'
  }
  return 'No club address on file, so your message goes to the Louisiana Chess Association by email.'
}

/**
 * The words of the Contact form's Help, its two lines in the order the form is read (written in WS09 checkpoint X's
 * review, and back in one panel since K's answer to checkpoint X's choice 5): that the club's address is not shown,
 * then who answers and where. Only what helps a person send the message, as K's later word on help asks.
 */
export const CONTACT_LINE_HELP = 'The club\'s address is not shown on its page. Your message is sent by email.'
export function contactEmailHelp(goesTo: ContactGoesTo, region: string | null): string {
  const who = goesTo === 'club'
    ? 'The club\'s contact'
    : goesTo === 'region'
      ? (region?.trim() ? `The ${region.trim()} representative` : 'The region\'s representative')
      : 'Someone at LCA'
  return `${who} answers by email, to the address you give here.`
}

/** The words the visitor is told once the message has gone. */
export const CONTACT_SENT = 'Sent.'

/** The words when no keeper's address took the message. */
export const CONTACT_NOT_SENT = 'We couldn\'t send this. Try again later.'
