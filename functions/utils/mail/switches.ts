// functions/utils/mail/switches.ts
//
// The server half of the mail switches: constants, their type and their
// comments, and nothing else. MAIL_LISTS_ON is the server half of
// mailLists in src/lib/features.ts, which the functions and the workers
// cannot read; MAIL_SENDER names the one service that sends every email.
//
// Two settings follow no switch: WORKERS_PLAN, the hosting plan the mail
// engine's budgets are sized for, and COMPLAINT_STOPS_OTHER_SENDERS, what a
// spam report stops besides the list it was pressed on.
//
// Each caller imports a constant from this file and reads it inside the
// function, at each call, never copied into a variable of its own module,
// so a test can turn it on through a getter on the mocked module, as
// test/integration/public-answer-trim.test.ts does for the trim's
// constants. Nothing here reads a setting of the environment.

/** The services that can send the site's mail. */
export type MailSender = 'resend'

/** The Cloudflare Workers plans the account can be on. */
export type WorkersPlan = 'free' | 'paid'

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

/**
 * The plan the account is on, which sizes the mail engine's budgets in ./plan: 'free' until K confirms that the account
 * is on Workers Paid, then 'paid' in the change that follows K's word. The cutover to Amazon SES waits for 'paid'
 * (WS16 step 7). test/unit/mail-switches.test.ts holds it written once, with either value.
 */
export const WORKERS_PLAN: WorkersPlan = 'free'

/**
 * Decision 18 of the WS16 plan (D35): a spam report always stops the list it was pressed on, and while this holds it
 * also stops the person's mail from every list that is not one of LCA's main mailers, until they turn that list back
 * on. A setting, as K asked; test/unit/mail-switches.test.ts holds it written once, with either value.
 */
export const COMPLAINT_STOPS_OTHER_SENDERS = true
