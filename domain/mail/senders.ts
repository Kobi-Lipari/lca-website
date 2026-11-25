// domain/mail/senders.ts
//
// Who may send email to members (the owner's decision 79, "2 b."): an LCA
// admin, the holder of the President seat and, for the newsletter alone, the
// holder of the Media manager seat. Read by the server's two mail guards
// (requireMailer and requireListMailer in functions/utils/auth.ts) and by the
// pages (src/areas/admin/roles.ts), so both answer the same.
//
// Each reader names the constant inside its function, at each call, so a
// test can turn it through a getter on the mocked module. This file imports
// nothing.

/**
 * Set: the President seat's holder needs a second factor to send, as an LCA
 * admin and the media manager do. The one line to change if the owner says
 * otherwise.
 */
export const PRESIDENT_NEEDS_SECOND_FACTOR = true

/** The 403 for anyone the mail guards refuse but the second factor's: an LCA Observer or Officer without either seat among them. */
export const LIST_MAILERS_ONLY = 'Group email is limited to LCA admins, the president and the media manager.'
