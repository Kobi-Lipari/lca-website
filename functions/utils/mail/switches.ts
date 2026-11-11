// functions/utils/mail/switches.ts
//
// The server half of the mail switches: constants, their type and their
// comments, and nothing else. MAIL_LISTS_ON is the server half of
// mailLists in src/lib/features.ts, which the functions and the workers
// cannot read; MAIL_SENDER names the one service that sends every email.
//
// Each caller imports a constant from this file and reads it inside the
// function, at each call, never copied into a variable of its own module,
// so a test can turn it on through a getter on the mocked module, as
// test/integration/public-answer-trim.test.ts does for the trim's
// constants. Nothing here reads a setting of the environment.

/** The services that can send the site's mail. */
export type MailSender = 'resend'

/**
 * Set: the LCA newsletter list in Group email for the LCA admins, the president and the media manager, the unsubscribe
 * link, the email preferences page, the footer and the one-click headers on every optional email, and the mail engine's
 * rules (the do-not-send list on every send path, no second try of a message that may have gone, the batch sizes of
 * WORKERS_PLAN). Turned on with mailLists in src/lib/features.ts, in the same change;
 * test/unit/mail-switches.test.ts holds the two equal.
 */
export const MAIL_LISTS_ON = false

/**
 * Which service sends every email: 'resend' today. It changes only in a pull request of its own (the cutover, whose
 * fallback is the same line back), never by a setting, so one deploy and one service send each message.
 */
export const MAIL_SENDER: MailSender = 'resend'
