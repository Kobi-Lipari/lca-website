// functions/utils/mail/newsletterAnswers.ts
//
// What the LCA newsletter's three admin endpoints share,
// functions/api/admin/mail/newsletter.ts, newsletter/test.ts and
// newsletter/stop.ts: the answer behind the guard while the newsletter is
// switched off, and the refusals' words, each written once.

import { errorResponse } from '../response'

/**
 * The send's refusals and the test send's, word for word. WAITS_FOR_SES and ALREADY_SENDING are held in
 * domain/mail/newsletterWords.ts, which Group email's page reads too, so the page's words and the server's are one copy
 * (checkpoint M's review).
 */
export { ALREADY_SENDING, WAITS_FOR_SES } from '../../../domain/mail/newsletterWords'
export const LINK_KEY_MISSING = 'Not sent: the mail link key is missing on this deployment.'
export const NOBODY_ON_THE_LIST = 'Nobody is on the newsletter list right now.'
export const NOTHING_SENDING = 'No newsletter is sending.'
/** The test send's refusal of a test through Amazon SES asked by anyone but an LCA admin (WS16 step 7). */
export const SES_TEST_ADMINS_ONLY = 'Only an LCA admin can send a test through Amazon SES.'
/** The test send's refusal of an address other than the sender's own, for anyone the Media manager seat admits (checkpoint M's review). */
export const TEST_TO_OWN_ADDRESS = "A test goes to your own account's email address."

/**
 * Every newsletter method's answer while MAIL_LISTS_ON is unset, given only after the guard, so a signed-out caller and
 * anyone who may not send get the guard's answer and learn nothing of whether the newsletter is switched on.
 */
export function newsletterNotFound(): Response {
  return errorResponse('Not found', 404)
}
