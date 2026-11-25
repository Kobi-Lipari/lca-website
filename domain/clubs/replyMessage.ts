// domain/clubs/replyMessage.ts
//
// The rules of an answer sent through Reply through LCA (WS09 step 27),
// written once for the two that hold them: the endpoint's contract
// (domain/contracts/clubReply.ts) and the page a representative or an LCA
// admin answers on (src/pages/ClubReplyPage.tsx), so the page refuses in the
// same words the server would, beside the one field.
//
// One field and nothing more: the words of the answer. The cap is the
// contact form's own, 5,000 characters, a long letter, so an answer can be
// as long as the message it answers and no longer.
//
// Plain code with no zod and no import, so the site's bundle can carry it.

/** The longest answer the endpoint takes. */
export const REPLY_MESSAGE_LIMIT = 5000

/** The words of each refusal, beside the field. */
export const REPLY_FIELD_WORDS = {
  missing: 'Write your reply.',
  long: 'Your reply can be at most 5,000 characters.',
} as const

/** What is wrong with the answer's words, or null when they may be sent. */
export function replyFieldError(value: string): string | null {
  if (value.trim() === '') return REPLY_FIELD_WORDS.missing
  if (value.length > REPLY_MESSAGE_LIMIT) return REPLY_FIELD_WORDS.long
  return null
}

/** The words once the answer has gone: the visitor's first name, and that their address was never shown. */
export function replySentWords(firstName: string): string {
  return `Sent to ${firstName}. Their address was never shown to you.`
}

/**
 * The words of the reply page's two question marks (K's decision 16, applied to the page in WS09 checkpoint X's
 * review), each a term and its words: beside the heading, how the visitor answers and how long the link works; beside
 * the reply's label, who sees what and how the reply is signed. Only what helps a person answer, as K's later word on
 * the marks asks.
 */
export function replyHeadingHelp(firstName: string): ReadonlyArray<readonly [string, string]> {
  return [
    ['Their answer', `If ${firstName} answers your email, it comes to LCA's own mailbox. They can also write to the club again from its page.`],
    ['The link', 'A link from the email works for 30 days. If it will not open, check that the whole link was copied from the email.'],
  ]
}
export function replyLabelHelp(firstName: string): ReadonlyArray<readonly [string, string]> {
  return [
    ['Who sees what', `Your reply goes to ${firstName} by email from LCA's own address. Their address is never shown to you, and yours is never shown to them.`],
    ['How it is signed', 'The reply is signed with your role, such as the region\'s representative, and not with your name. To sign your own name, write it in your reply.'],
  ]
}
