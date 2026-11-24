// functions/api/admin/mail/newsletter/test.ts
//
// POST /api/admin/mail/newsletter/test: one test of the LCA newsletter, to
// one address, for the people requireListMailer admits. Its contracts are
// in domain/contracts/mail.ts. The guard answers first; then, while
// MAIL_LISTS_ON is unset, 404 { error: 'Not found' }, with nothing written.
//
// The body is { to, subject, bodyHtml }, through parseBody. The test goes
// to that one address with the subject marked '[TEST] ', as Group email's
// test send marks it, and carries the real footer and the two one-click
// headers for that address, so its links can be tried: the address's
// contact is made when it has none, which puts it on no list. It is sent
// as a test send, kind 'test', so the gate refuses an address that no
// longer receives mail or that no list may send to, but reads no choice:
// someone who turned the newsletter off can still send themselves a test.
// It goes through the service MAIL_SENDER names, and through Resend from
// noreply@louisianachess.org, the one address Resend is set up for
// (functions/utils/mail/resend.ts). It answers 200 { sent: true }, 502
// { error } when it was not sent, and 503 without the link key, before
// anything is written. A 502 for an answer from the mail service carries
// the service's own words as Group email's test answers them, "Resend
// <status>: <body>", a refusal of the key among them; a refusal by the
// seam or the gate, a request with no answer and a message held back keep
// the words of the rules.
//
// Since WS16 step 7 the body may also ask for service: 'ses', which an LCA
// admin's page sends while Resend sends: the test then goes through Amazon
// SES whatever MAIL_SENDER says, from the newsletter's own From address and
// display name, carrying the newsletter's list tag, so the stored key, its
// policy, the sending domain and the configuration set are proved from the
// deployed site before the cutover. It is for an LCA admin alone, read from
// the verified session and never from the body: anyone else who asks for
// it, after the guard and the 404, gets 403 with SES_TEST_ADMINS_ONLY's
// words, with nothing written and nothing sent. Without Amazon SES's keys
// on the deployment the test answers 502 with the words for a missing key,
// makes no request and is never handed to Resend instead. An answer from
// Amazon SES keeps Amazon's own words, which name it.
//
// Since checkpoint M's review, a test asked by anyone the Media manager seat
// admits, an LCA officer who holds it among them, goes only to their own
// account's address: a `to` that is not that address, compared as the gate
// compares addresses (normalizeAddress), and an account with no usable
// address, get 403 with TEST_TO_OWN_ADDRESS's words, after the guard, the
// 404 and the refusal of a test through Amazon SES, with nothing written and
// nothing sent. An LCA admin and the president keep the address they type,
// as today's Group email test gives it to them
// (functions/api/admin/campaigns/test.ts), and an LCA admin's test to
// another person's address carries the footer's words as a member reads
// them, as today's test carries the page's. No activity row is written for
// a test, as today's Group email test writes none.
//
// Since WS16 part two's page step 6, while MAIL_PAGE_ON is set, a body that
// names a letter, { issueId, version }, is the newsletter's own page asking
// for "Send a test to me" (newsletterTestLetterRequestSchema in
// domain/contracts/newsletter.ts); with MAIL_PAGE_ON unset no body is looked
// at before today's, so that one is refused as any body today's schema does
// not take. The guard and the 404 are today's. The test goes to one address,
// the signed-in account's own, for everyone the guard lets in, and no
// address is read from the body; an account with no address mail can reach
// gets TEST_TO_OWN_ADDRESS's words, 403, and no link key, today's 503. The
// letter is read from the database, never from the body: the newsletter's
// open letter, which must be the one named at that version, or the answer
// is the save's 409, in the save's words (letterToTest and refusalWords in
// functions/utils/mail/issues.ts), or 404 for a letter that is not the
// newsletter's; then 400 in words for a letter with no subject or no words.
// What is sent is "[TEST] " and the letter's subject, the letter in the navy
// look (renderNewsletter in domain/mail/newsletterLayout.ts) with the real
// footer and both headers for that person, as the newsletter itself would
// carry them, kind 'test', through the service a test goes through by
// default, and no Amazon SES option; an email over EMAIL_MAX_BYTES as drawn
// is refused, 413, in words that say by about how much. The email is drawn
// here rather than by listMessage in functions/utils/admin/campaigns.ts, so
// the campaign sender and the daily-emails worker that bundles it stay as
// they are. It writes nothing on the letter and no campaign; it makes the
// person's contact as today's test does, and sends once, as today's does.
import type { Env } from '../../../../types'
import { isSendableAddress, normalizeAddress } from '../../../../../domain/mail/address'
import { DEFAULT_REPLY_TO, LIST_SENDERS } from '../../../../../domain/mail/addresses'
import { NEWSLETTER_LIST_ID } from '../../../../../domain/mail/lists'
import { EMAIL_MAX_BYTES, renderNewsletter } from '../../../../../domain/mail/newsletterLayout'
import { newsletterTestRequestSchema, type NewsletterTestResponse } from '../../../../../domain/contracts/mail'
import {
  newsletterTestLetterRequestSchema,
  type NewsletterIssueRefused,
  type NewsletterTestLetterResponse,
} from '../../../../../domain/contracts/newsletter'
import { listMessage, wordsUnderRules } from '../../../../utils/admin/campaigns'
import { holdsPresidentSeat } from '../../../../utils/admin/presidentSeat'
import { isResponse, requireListMailer, type AuthedMember } from '../../../../utils/auth'
import { listMailParts } from '../../../../utils/mail/footer'
import { bodyHasWords, letterToTest, refusalWords, type Letter } from '../../../../utils/mail/issues'
import { contactFor } from '../../../../utils/mail/lists'
import {
  LINK_KEY_MISSING,
  SES_TEST_ADMINS_ONLY,
  TEST_NO_SUBJECT,
  TEST_NO_SUBJECT_OR_WORDS,
  TEST_NO_WORDS,
  TEST_TO_OWN_ADDRESS,
  newsletterNotFound,
  testTooLong,
} from '../../../../utils/mail/newsletterAnswers'
import { deliver, type SendResult } from '../../../../utils/mail/send'
import { MAIL_LISTS_ON, MAIL_PAGE_ON } from '../../../../utils/mail/switches'
import { errorResponse, handleOptions, jsonResponse, parseBody } from '../../../../utils/response'
import { resolveSiteUrl } from '../../../../utils/site'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const authed = await requireListMailer(context.request, context.env)
  if (isResponse(authed)) return authed
  if (!MAIL_LISTS_ON) return newsletterNotFound()
  // The page's own form, only while the page is switched on and only for a body that names a letter.
  if (MAIL_PAGE_ON && (await namesLetter(context.request))) return testOfLetter(context, authed)

  const test = await parseBody(context.request, newsletterTestRequestSchema)
  if (test instanceof Response) return test
  // A test through Amazon SES is an LCA admin's alone, by the role of the session the guard verified.
  const throughSes = test.service === 'ses'
  if (throughSes && authed.member.role !== 'lca_admin') return errorResponse(SES_TEST_ADMINS_ONLY, 403)
  // The media manager's test goes to their own account's address alone; an LCA admin and the President seat's holder,
  // read again only for someone else's address, type theirs.
  if (authed.member.role !== 'lca_admin' && !isOwnAddress(test.to, authed.member.email) && !(await holdsPresidentSeat(context.env.DB, authed.member.id))) {
    return errorResponse(TEST_TO_OWN_ADDRESS, 403)
  }
  if (!context.env.MAIL_LINK_SECRET) return errorResponse(LINK_KEY_MISSING, 503)

  const to = normalizeAddress(test.to)
  const subject = `[TEST] ${test.subject}`
  const contactId = await contactFor(context.env.DB, to)
  const message = await listMessage(context.env, { listId: NEWSLETTER_LIST_ID, contactId, subject, bodyHtml: test.bodyHtml })

  const result = await deliver(context.env, {
    kind: 'test',
    listId: NEWSLETTER_LIST_ID,
    ...(throughSes ? { through: 'ses' as const } : {}),
    headers: message.headers,
    from: message.from,
    fromName: message.fromName,
    to,
    replyTo: message.replyTo,
    subject,
    html: message.html,
    shape: 'campaign',
  })
  if (!result.ok) return errorResponse(`Failed to send test email: ${testWords(result)}`, 502)

  const body: NewsletterTestResponse = { sent: true }
  return jsonResponse(body)
}

/** Whether the address typed is the account's own, compared as the gate compares addresses, and one mail can reach. */
function isOwnAddress(typed: string, own: string | null | undefined): boolean {
  const mine = normalizeAddress(own ?? '')
  return mine !== '' && isSendableAddress(mine) && normalizeAddress(typed) === mine
}

/**
 * Why a test was not sent. An answer from Resend keeps its status and its words, in the form Group email's test send
 * gives them (sendTestEmail in functions/utils/admin/campaigns.ts), so a 401 or a 403 says what the service said rather
 * than that the key is missing; an answer from Amazon SES keeps Amazon's own words, which name it, its status and its
 * code; every other failure, a missing Amazon SES key among them, keeps the words of the rules.
 */
function testWords(result: Exclude<SendResult, { ok: true }>): string {
  if (result.fromSes) return result.error
  return serviceAnswered(result) ? `Resend ${result.status}: ${result.error}` : wordsUnderRules(result)
}

/** Whether the failure is the mail service's own answer (Resend's status or Amazon SES's words), not a refusal by the rules. */
function serviceAnswered(result: Exclude<SendResult, { ok: true }>): boolean {
  if (result.fromSes) return true
  return result.status !== undefined && !result.refused && !result.gateUnread && !result.waitForSes && !result.limitRefused && !result.noAnswer
}

/** The page's answer when the mail service itself did not take the test: plain words, the service's own detail kept out. */
export const TEST_SERVICE_REFUSED =
  "The test could not be sent: the mail service did not take it. Try again in a few minutes, or ask the site's admin if it keeps happening."

/**
 * Whether a body names a letter, the newsletter's own page's form: a JSON object with an issueId of its own, whatever
 * else it holds. Read from a copy of the request, so the body is still there for parseBody; anything else, a body that
 * is not JSON among it, is today's form, answered as today.
 */
async function namesLetter(request: Request): Promise<boolean> {
  const raw: unknown = await request.clone().json().catch(() => null)
  return typeof raw === 'object' && raw !== null && !Array.isArray(raw) && Object.hasOwn(raw, 'issueId')
}

/** Why a stored letter cannot be tested yet, in words, or null when it can: it has no subject, no words, or neither. */
function letterGap(letter: Letter): string | null {
  const subject = letter.subject.trim() !== ''
  const words = bodyHasWords(letter.bodyHtml)
  if (!subject && !words) return TEST_NO_SUBJECT_OR_WORDS
  if (!subject) return TEST_NO_SUBJECT
  return words ? null : TEST_NO_WORDS
}

/**
 * A test of the stored letter, the page's "Send a test to me": to the signed-in account's own address alone, the letter
 * as the database holds it at the version named, in the navy look with the person's real footer and headers, sent once.
 * Each refusal comes before anything is sent; none writes on the letter.
 */
async function testOfLetter(context: Parameters<PagesFunction<Env>>[0], authed: AuthedMember): Promise<Response> {
  const named = await parseBody(context.request, newsletterTestLetterRequestSchema)
  if (named instanceof Response) return named
  // The account's own address, for everyone the guard lets in; no address is read from the body.
  const to = normalizeAddress(authed.member.email ?? '')
  if (!isSendableAddress(to)) return errorResponse(TEST_TO_OWN_ADDRESS, 403)
  if (!context.env.MAIL_LINK_SECRET) return errorResponse(LINK_KEY_MISSING, 503)

  const read = await letterToTest(context.env.DB, NEWSLETTER_LIST_ID, named.issueId, named.version)
  if ('notFound' in read) return newsletterNotFound()
  if ('refused' in read) {
    const refused: NewsletterIssueRefused = { error: refusalWords(read.refused.reason), ...read.refused }
    return jsonResponse(refused, 409)
  }
  const letter = read.letter
  const gap = letterGap(letter)
  if (gap) return errorResponse(gap, 400)

  const sender = LIST_SENDERS[NEWSLETTER_LIST_ID]
  if (!sender) throw new Error('No sender is written for this list.')
  const contactId = await contactFor(context.env.DB, to)
  const parts = await listMailParts(context.env, { contactId, listId: NEWSLETTER_LIST_ID })
  const html = renderNewsletter({
    siteUrl: resolveSiteUrl(context.env),
    month: letter.monthLabel,
    subject: letter.subject,
    preheader: letter.preheader,
    bodyHtml: letter.bodyHtml,
    footerHtml: parts.footerHtml,
  })
  const size = new TextEncoder().encode(html).byteLength
  if (size > EMAIL_MAX_BYTES) return errorResponse(testTooLong(size - EMAIL_MAX_BYTES), 413)

  const subject = `[TEST] ${letter.subject}`
  const result = await deliver(context.env, {
    kind: 'test',
    listId: NEWSLETTER_LIST_ID,
    headers: parts.headers,
    from: sender.from,
    fromName: sender.name,
    to,
    replyTo: context.env.REPLY_TO_EMAIL ?? DEFAULT_REPLY_TO,
    subject,
    html,
    shape: 'campaign',
  })
  if (!result.ok) return errorResponse(serviceAnswered(result) ? TEST_SERVICE_REFUSED : `Failed to send test email: ${testWords(result)}`, 502)

  const body: NewsletterTestLetterResponse = { sent: true, to }
  return jsonResponse(body)
}
