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
//
// Since WS16 part two's page step 6, the newsletter's own page reads them
// too: the reason Send waits, said when its Send, drawn and not yet
// available, is pressed; and the refusals of a test of the stored letter,
// which the server answers and the page says for a letter it holds no row
// for yet.

/** The send's refusal while the site sends through Resend, and the reason beside Send on the page, word for word. */
export const WAITS_FOR_SES = 'The newsletter goes out through Amazon SES, which this site does not send through yet. You can write it and send yourself a test.'

/** The send's refusal while a newsletter is sending, and the reason beside Send on the page while one is. */
export const ALREADY_SENDING = 'The newsletter is already sending. Wait for it to finish.'

/** A test of the stored letter refused, with nothing sent: the letter has no subject, no words, or neither. */
export const TEST_NO_SUBJECT = 'This letter has no subject yet, so no test was sent. Add a subject first.'
export const TEST_NO_WORDS = 'This letter has no words yet, so no test was sent. Write the letter first.'
export const TEST_NO_SUBJECT_OR_WORDS = 'This letter has no subject and no words yet, so no test was sent. Add a subject and write the letter first.'

/**
 * A test of the stored letter refused, with nothing sent, for an email longer as drawn than the most Gmail shows whole
 * (EMAIL_MAX_BYTES, the navy layout's own limit), with about how much longer: the bytes over, rounded up to the next
 * hundred and written with commas, as characters, which is what they are for a letter's own words.
 */
export function testTooLong(overBytes: number): string {
  const about = Math.max(1, Math.ceil(overBytes / 100)) * 100
  const figure = String(about).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `This email is too long: it is about ${figure} characters over what Gmail shows whole. Make the letter shorter, then send a test again.`
}
