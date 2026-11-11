// domain/mail/addresses.ts
//
// Every From address, display name and reply-to address the site sends
// with, in one place. Today's three values were moved here word for word:
// the sender of record and the reply-to address from
// functions/utils/email.ts, with their comments, and the display name that
// email.ts and functions/utils/admin/campaigns.ts wrote into the From line
// of every message. Nothing is imported here, so the site, the server and
// the daily-emails worker can all read this file.
//
// The FROM_EMAIL and REPLY_TO_EMAIL bindings still override the event
// sender and the reply-to, as before. WS16 step 4 adds each LCA list's From
// address and display name here. Every form other than today's is decided
// by K once, together, from the address map (D36 and Q44 of the WS16
// brief section), and the step that adds a form writes it here, so every
// sender is set in this one file. test/unit/mail-seam-bytes.test.ts holds
// the bytes of today's requests as literal strings, so a change here that
// moved event mail's bytes turns it red.

/** Sender of record. Every transport falls back to this when FROM_EMAIL
 *  is unset, which is the normal case for the cron Worker. */
export const DEFAULT_FROM = 'noreply@louisianachess.org'

/** The association's only working mailbox. */
export const DEFAULT_REPLY_TO = 'LouisianaChess@gmail.com'

/** The display name in front of the From address, on every message the site sends today. */
export const SENDER_NAME = 'Louisiana Chess Association'
