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
import type { Env } from '../../../../types'
import { normalizeAddress } from '../../../../../domain/mail/address'
import { NEWSLETTER_LIST_ID } from '../../../../../domain/mail/lists'
import { newsletterTestRequestSchema, type NewsletterTestResponse } from '../../../../../domain/contracts/mail'
import { listMessage, wordsUnderRules } from '../../../../utils/admin/campaigns'
import { isResponse, requireListMailer } from '../../../../utils/auth'
import { contactFor } from '../../../../utils/mail/lists'
import { LINK_KEY_MISSING, newsletterNotFound } from '../../../../utils/mail/newsletterAnswers'
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
  if (!context.env.MAIL_LINK_SECRET) return errorResponse(LINK_KEY_MISSING, 503)

  const to = normalizeAddress(test.to)
  const subject = `[TEST] ${test.subject}`
  const contactId = await contactFor(context.env.DB, to)
  const message = await listMessage(context.env, { listId: NEWSLETTER_LIST_ID, contactId, subject, bodyHtml: test.bodyHtml })

  const result = await deliver(context.env, {
    kind: 'test',
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

/**
 * Why a test was not sent. An answer from the mail service keeps its status and its words, in the form Group email's
 * test send gives them (sendTestEmail in functions/utils/admin/campaigns.ts), so a 401 or a 403 says what the service
 * said rather than that the key is missing; every other failure keeps the words of the rules.
 */
function testWords(result: Exclude<SendResult, { ok: true }>): string {
  const answered = result.status !== undefined && !result.refused && !result.gateUnread && !result.waitForSes && !result.limitRefused && !result.noAnswer
  return answered ? `Resend ${result.status}: ${result.error}` : wordsUnderRules(result)
}
