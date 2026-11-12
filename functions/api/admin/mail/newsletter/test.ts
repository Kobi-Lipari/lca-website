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
import type { Env } from '../../../../types'
import { isSendableAddress, normalizeAddress } from '../../../../../domain/mail/address'
import { NEWSLETTER_LIST_ID } from '../../../../../domain/mail/lists'
import { newsletterTestRequestSchema, type NewsletterTestResponse } from '../../../../../domain/contracts/mail'
import { listMessage, wordsUnderRules } from '../../../../utils/admin/campaigns'
import { isResponse, requireListMailer } from '../../../../utils/auth'
import { contactFor } from '../../../../utils/mail/lists'
import { LINK_KEY_MISSING, SES_TEST_ADMINS_ONLY, TEST_TO_OWN_ADDRESS, newsletterNotFound } from '../../../../utils/mail/newsletterAnswers'
import { deliver, type SendResult } from '../../../../utils/mail/send'
import { MAIL_LISTS_ON } from '../../../../utils/mail/switches'
import { errorResponse, handleOptions, jsonResponse, parseBody } from '../../../../utils/response'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const authed = await requireListMailer(context.request, context.env)
  if (isResponse(authed)) return authed
  if (!MAIL_LISTS_ON) return newsletterNotFound()

  const test = await parseBody(context.request, newsletterTestRequestSchema)
  if (test instanceof Response) return test
  // A test through Amazon SES is an LCA admin's alone, by the role of the session the guard verified.
  const throughSes = test.service === 'ses'
  if (throughSes && authed.member.role !== 'lca_admin') return errorResponse(SES_TEST_ADMINS_ONLY, 403)
  // The media manager's test goes to their own account's address alone; an LCA admin and the president type theirs.
  if (authed.member.role !== 'lca_admin' && authed.member.role !== 'lca_observer' && !isOwnAddress(test.to, authed.member.email)) {
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
  const answered = result.status !== undefined && !result.refused && !result.gateUnread && !result.waitForSes && !result.limitRefused && !result.noAnswer
  return answered ? `Resend ${result.status}: ${result.error}` : wordsUnderRules(result)
}
