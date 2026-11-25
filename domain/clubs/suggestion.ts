// domain/clubs/suggestion.ts
//
// The rules and words of Suggest an update (WS09 step 28), written once for
// the three that hold them: the endpoint's contract
// (domain/contracts/clubReports.ts), the sheet a visitor fills in
// (src/areas/clubs/components/SuggestUpdateSheet.tsx) and the keeper's rows
// in My region and on the club's pages, so the sheet refuses in the same
// words the server would, beside the field it concerns, and every page names
// a choice in the same words.
//
// Three things and nothing more: which part of the listing changed (one of
// six, stored as a short fixed key, never the label's words), what changed in
// the visitor's own words, and, only if they choose to give one, an address
// to answer them at. No name, no grade, no age. The words are capped at
// 2,000 characters, a long note, since a suggestion says what is wrong with a
// listing and every one is emailed to a volunteer; an address at 254, the
// longest a mail server takes.
//
// Plain code with no zod, so the site's bundle can carry it.
import { hasLineBreak, hasText, isPlainAddress } from './contactMessage'

/** The six choices of "What changed?", each with its fixed key and its label, in the order the sheet shows them. */
export const SUGGESTION_CHOICES = [
  { key: 'meets', label: 'Meeting day or time' },
  { key: 'venue', label: 'Venue or address' },
  { key: 'cost', label: 'Cost or who it\'s for' },
  { key: 'contact', label: 'Contact' },
  { key: 'closed', label: 'The club has closed or moved' },
  { key: 'other', label: 'Something else' },
] as const

/** The fixed keys of the six choices, for the contract's closed list. */
export const SUGGESTION_FIELDS = SUGGESTION_CHOICES.map((c) => c.key) as unknown as readonly [SuggestionField, ...SuggestionField[]]

export type SuggestionField = (typeof SUGGESTION_CHOICES)[number]['key']

/** A choice's label, by its key; the key itself for one the list does not hold. */
export function suggestionLabel(field: string): string {
  return SUGGESTION_CHOICES.find((c) => c.key === field)?.label ?? field
}

/** The longest words and address the endpoint takes. */
export const SUGGESTION_LIMITS = { message: 2000, email: 254 } as const

/** The words of each refusal, beside the part it concerns. */
export const SUGGESTION_FIELD_WORDS = {
  fieldMissing: 'Choose what changed.',
  messageMissing: 'Write what changed.',
  messageLong: `What changed can be at most ${SUGGESTION_LIMITS.message.toLocaleString('en-US')} characters.`,
  emailLong: `Your email address can be at most ${SUGGESTION_LIMITS.email} characters.`,
  emailForm: 'Enter one email address, like name@example.org, or leave it empty.',
} as const

export type SuggestionPart = 'field' | 'message' | 'email'

/** Words with something in them once their spaces are taken off. */
export const hasSuggestionText = hasText

/** What is wrong with one part of a suggestion, in words, or null when it may be sent. An empty address is no address. */
export function suggestionFieldError(part: SuggestionPart, value: string): string | null {
  const w = SUGGESTION_FIELD_WORDS
  if (part === 'field') return SUGGESTION_CHOICES.some((c) => c.key === value) ? null : w.fieldMissing
  if (part === 'message') {
    if (!hasText(value)) return w.messageMissing
    if (value.length > SUGGESTION_LIMITS.message) return w.messageLong
    return null
  }
  if (!hasText(value)) return null
  if (value.length > SUGGESTION_LIMITS.email) return w.emailLong
  if (hasLineBreak(value) || !isPlainAddress(value.trim())) return w.emailForm
  return null
}

/** Every place a suggestion can go, for the contract's closed list: never a person, an address or how many. */
export const SUGGESTION_GOES_TO = ['club_rep', 'region', 'lca'] as const

/** Where a club's suggestions go, as the page's answer names it. */
export type SuggestionGoesTo = (typeof SUGGESTION_GOES_TO)[number]

/** The sheet's send button, worded by where the suggestion goes, naming nobody. */
export function suggestSendLabel(goesTo: SuggestionGoesTo, region: string | null): string {
  if (goesTo === 'club_rep') return 'Send to the club\'s representative'
  if (goesTo === 'region') {
    const area = region?.trim()
    return area ? `Send to the ${area} representative` : 'Send to the region\'s representative'
  }
  return 'Send to LCA'
}

/** The words of the two links that open the sheet. */
export const SUGGEST_LINK = 'Suggest an update'

/** The sheet's title. */
export function suggestTitle(clubName: string): string {
  return `Suggest an update to ${clubName}`
}

/** The words once the suggestion has gone. */
export const SUGGESTION_SENT = 'Sent. Whoever keeps this club\'s listing checks it before anything changes.'

/** The words when the suggestion could not be saved. */
export const SUGGESTION_NOT_SENT = 'We couldn\'t send this. Try again later.'

/** What a card and a row say of a suggestion's age, in whole days. */
export function ageWords(days: number): string {
  if (days <= 0) return 'today'
  return days === 1 ? '1 day' : `${days} days`
}

/** A card's line for its open suggestions: how many, and the oldest's age ("1 suggestion · 9 days"). */
export function openSuggestionsWords(count: number, oldestDays: number): string {
  return `${count} ${count === 1 ? 'suggestion' : 'suggestions'} · ${ageWords(oldestDays)}`
}

/** The card's button while a suggestion is open, and the start of every refusal of Still accurate while one waits. */
export const ANSWER_FIRST = 'Answer it, then confirm'

/** The refusal of Still accurate, on the card's button and by the endpoint, while a suggestion for the club is open. */
export const CONFIRM_WAITS = `A visitor's suggestion for this club is waiting. ${ANSWER_FIRST}.`

/** The refusal of the monthly check's link while a suggestion for the club is open, for a page with no sign-in. */
export const LINK_WAITS = 'A visitor\'s suggestion for this club is waiting, so it cannot be marked still accurate yet. Log in to My region to answer it, then confirm.'

/** What a keeper's three actions are told as once done, by the row's new status. */
export const RESOLVED_WORDS = {
  applied: 'Marked as applied. Make the change in the listing.',
  answered: 'Your reply was sent from LCA\'s own address. The visitor never saw yours.',
  dismissed: 'Marked as not an issue.',
} as const
