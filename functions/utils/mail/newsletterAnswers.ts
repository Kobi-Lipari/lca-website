// functions/utils/mail/newsletterAnswers.ts
//
// What the LCA newsletter's three admin endpoints share,
// functions/api/admin/mail/newsletter.ts, newsletter/test.ts and
// newsletter/stop.ts: the answer behind the guard while the newsletter is
// switched off, and the refusals' words, each written once.

import { errorResponse } from '../response'

/** The send's refusals and the test send's, word for word. */
export const WAITS_FOR_SES = 'The newsletter goes out through Amazon SES, which this site does not send through yet. You can write it and send yourself a test.'
export const LINK_KEY_MISSING = 'Not sent: the mail link key is missing on this deployment.'
export const NOBODY_ON_THE_LIST = 'Nobody is on the newsletter list right now.'
export const ALREADY_SENDING = 'The newsletter is already sending. Wait for it to finish.'
export const NOTHING_SENDING = 'No newsletter is sending.'

/**
 * Every newsletter method's answer while MAIL_LISTS_ON is unset, given only after the guard, so a signed-out caller and
 * anyone who may not send get the guard's answer and learn nothing of whether the newsletter is switched on.
 */
export function newsletterNotFound(): Response {
  return errorResponse('Not found', 404)
}
