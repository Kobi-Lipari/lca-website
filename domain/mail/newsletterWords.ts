// domain/mail/newsletterWords.ts
//
// The LCA newsletter's words that both the server and Group email's page
// write, held once so the two cannot drift (checkpoint M's review, K's
// decision 52, part B): the reason the send waits while the site does not
// send through Amazon SES, which the send's 409 answers and the page writes
// beside its Send button, drawn off; and the refusal of a second newsletter
// while one is sending, which the page writes beside Send while a
// newsletter it holds back is sending without words of its own.
// functions/utils/mail/newsletterAnswers.ts gives them to the server under
// the same names.

/** The send's refusal while the site sends through Resend, and the reason beside Send on the page, word for word. */
export const WAITS_FOR_SES = 'The newsletter goes out through Amazon SES, which this site does not send through yet. You can write it and send yourself a test.'

/** The send's refusal while a newsletter is sending, and the reason beside Send on the page while one is. */
export const ALREADY_SENDING = 'The newsletter is already sending. Wait for it to finish.'
