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

/** Whether the mail engine's rules hold for every send: once MAIL_LISTS_ON is set, or once Amazon SES sends. */
export function engineRulesOn(): boolean {
  return MAIL_LISTS_ON || MAIL_SENDER === 'ses'
}

/**
 * Whether the links in optional email open: once MAIL_LISTS_ON is set, or once a list email is on record, whatever the
 * constant says then, so a revert of the switch can never break a link in mail already sent; the FTC's CAN-SPAM guide
 * asks that an unsubscribe link keep working for at least 30 days after the email. One query, and none while the
 * constant is set.
 */
export async function listLinksLive(db: D1Database): Promise<boolean> {
  if (MAIL_LISTS_ON) return true
  return (await db.prepare('SELECT 1 FROM email_campaigns WHERE list_id IS NOT NULL LIMIT 1').first()) !== null
}
