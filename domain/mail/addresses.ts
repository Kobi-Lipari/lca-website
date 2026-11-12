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
// sender and the reply-to, as before. Each LCA list's From address and
// display name is here too, in LIST_SENDERS, as K decided the forms once,
// together, from the address map on Wednesday, November 11, 2026 (D36 and
// Q44 of the WS16 brief section); the step that first sends on a list
// writes its entry, so every sender is set in this one file.
// test/unit/mail-seam-bytes.test.ts holds the bytes of today's requests as
// literal strings, so a change here that moved event mail's bytes turns it
// red.

/** Sender of record. Every transport falls back to this when FROM_EMAIL
 *  is unset, which is the normal case for the cron Worker. */
export const DEFAULT_FROM = 'noreply@louisianachess.org'

/** The association's only working mailbox. */
export const DEFAULT_REPLY_TO = 'LouisianaChess@gmail.com'

/** The display name in front of the From address, on every message the site sends today. */
export const SENDER_NAME = 'Louisiana Chess Association'

/** The sender of one LCA list: the bare From address, and the display name in front of it. */
export interface ListSender {
  from: string
  name: string
}

/**
 * Each LCA list's sender, keyed by the list's id as domain/mail/lists.ts names it (written out here, since this file
 * imports nothing). The newsletter's is the form K decided on Wednesday, November 11, 2026 (decision 37 of the WS16
 * plan): Louisiana Chess Association <newsletter@news.louisianachess.org>. Replies to list mail go where Group email's
 * replies go, REPLY_TO_EMAIL or DEFAULT_REPLY_TO above, while where replies go is still K's to decide (the address
 * map's choice 6). LCA tournament email's sender, decided by K the same day, is written here by WS16 step 11, the
 * step that first sends on that list.
 */
export const LIST_SENDERS: Readonly<Record<string, ListSender | undefined>> = {
  'lca-newsletter': { from: 'newsletter@news.louisianachess.org', name: 'Louisiana Chess Association' },
}
