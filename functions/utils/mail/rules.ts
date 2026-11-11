// functions/utils/mail/rules.ts
//
// What the mail switches mean together. Each rule reads its constants
// through ./switches at each call, so a test that mocks that module decides
// every answer here, and no rule keeps a value of its own.

import { MAIL_LISTS_ON, MAIL_SENDER, type MailSender } from './switches'

/** The service that sends a message now: MAIL_SENDER, read at the call. */
export function senderNow(): MailSender {
  return MAIL_SENDER
}

/**
 * Whether the mail engine's rules hold for every send: once MAIL_LISTS_ON is set, or once Amazon SES sends. MailSender
 * is 'resend' alone until WS16 step 7 widens it, so the comparison is written on a string and only the type changes then.
 */
export function engineRulesOn(): boolean {
  return MAIL_LISTS_ON || (MAIL_SENDER as string) === 'ses'
}
