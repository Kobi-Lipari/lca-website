// functions/api/admin/mail/newsletter/issue/send.ts
//
// POST /api/admin/mail/newsletter/issue/send: the real Send on the
// newsletter's own page (WS16 part two, page step 6), for the people
// requireListMailer admits. Its contracts are in
// domain/contracts/newsletter.ts. While MAIL_PAGE_ON or MAIL_PAGE_SEND_ON is
// unset it answers 404 { error: 'Not found' } first, before it reads the
// request, the session or the database; then the guard.
//
// The body is { issueId, version } through parseBody: the stored letter by
// its id and the version the page read, and nothing typed. Then, in this
// order, with nothing written and nothing sent before any refusal: 409 in
// WAITS_FOR_SES's words while the site sends through Resend; 503 with no link
// key; 404 for a letter that is not the newsletter's, or 409
// { error, reason, changedBy, changedAt } in SEND_CHANGED's words for one
// sent, set aside or written to since it was read (letterToTest); 400 in
// words for a letter with no subject or no words a person wrote (sendGap);
// 413 for an email over EMAIL_MAX_BYTES as drawn for a stand-in contact,
// whose id has the length of every real one, so no contact is written; 400
// when nobody is on the list. createLetterCampaign
// (functions/utils/mail/lists.ts) marks the letter and copies it into the
// campaign in one transaction, so a letter goes out once; a send that loses
// to a write is answered 409 as above, and one that meets another send on
// the list ALREADY_SENDING's 409. A send is logged as the tab's is, with its
// three fields, and drained in waitUntil; the answer is the tab's 201.
import type { Env } from '../../../../../types'
import { NEWSLETTER_LIST_ID } from '../../../../../../domain/mail/lists'
import { EMAIL_MAX_BYTES, renderNewsletter } from '../../../../../../domain/mail/newsletterLayout'
import type { NewsletterResponse } from '../../../../../../domain/contracts/mail'
import { newsletterSendRequestSchema, type NewsletterIssueRefused } from '../../../../../../domain/contracts/newsletter'
import { recordAdminAction } from '../../../../../utils/admin/audit'
import { drainCampaign } from '../../../../../utils/admin/campaigns'
import { isResponse, requireListMailer } from '../../../../../utils/auth'
import { listMailParts } from '../../../../../utils/mail/footer'
import { letterToTest, pageNotFound, sendGap, type Refusal } from '../../../../../utils/mail/issues'
import { linkKeyCheck } from '../../../../../utils/mail/links'
import { createLetterCampaign, newsletterCounts } from '../../../../../utils/mail/lists'
import {
  ALREADY_SENDING,
  LINK_KEY_MISSING,
  NOBODY_ON_THE_LIST,
  SEND_CHANGED,
  SEND_NO_SUBJECT,
  SEND_NO_SUBJECT_OR_WORDS,
  SEND_NO_WORDS,
  WAITS_FOR_SES,
  sendTooLong,
} from '../../../../../utils/mail/newsletterAnswers'
import { senderNow } from '../../../../../utils/mail/rules'
import { MAIL_PAGE_ON, MAIL_PAGE_SEND_ON } from '../../../../../utils/mail/switches'
import { errorResponse, handleOptions, jsonResponse, parseBody } from '../../../../../utils/response'
import { resolveSiteUrl } from '../../../../../utils/site'

/** A stand-in contact id, as long as every real one (32 hex characters), so the email is measured as anyone's would be. */
const MEASURE_CONTACT = '0'.repeat(32)

const changed = (refused: Refusal) => {
  const body: NewsletterIssueRefused = { error: SEND_CHANGED, ...refused }
  return jsonResponse(body, 409)
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  if (!MAIL_PAGE_ON || !MAIL_PAGE_SEND_ON) return pageNotFound()
  const authed = await requireListMailer(context.request, context.env)
  if (isResponse(authed)) return authed

  const named = await parseBody(context.request, newsletterSendRequestSchema)
  if (named instanceof Response) return named

  if (senderNow() === 'resend') return errorResponse(WAITS_FOR_SES, 409)
  const secret = context.env.MAIL_LINK_SECRET
  if (!secret) return errorResponse(LINK_KEY_MISSING, 503)

  const db = context.env.DB
  const read = await letterToTest(db, NEWSLETTER_LIST_ID, named.issueId, named.version)
  if ('notFound' in read) return pageNotFound()
  if ('refused' in read) return changed(read.refused)
  const letter = read.letter

  const gap = sendGap(letter)
  if (gap === 'both') return errorResponse(SEND_NO_SUBJECT_OR_WORDS, 400)
  if (gap === 'subject') return errorResponse(SEND_NO_SUBJECT, 400)
  if (gap === 'words') return errorResponse(SEND_NO_WORDS, 400)

  const parts = await listMailParts(context.env, { contactId: MEASURE_CONTACT, listId: NEWSLETTER_LIST_ID })
  const html = renderNewsletter({
    siteUrl: resolveSiteUrl(context.env),
    month: letter.monthLabel,
    subject: letter.subject,
    preheader: letter.preheader,
    bodyHtml: letter.bodyHtml,
    footerHtml: parts.footerHtml,
  })
  const size = new TextEncoder().encode(html).byteLength
  if (size > EMAIL_MAX_BYTES) return errorResponse(sendTooLong(size - EMAIL_MAX_BYTES), 413)

  if ((await newsletterCounts(db)).willGet === 0) return errorResponse(NOBODY_ON_THE_LIST, 400)

  const result = await createLetterCampaign(db, {
    listId: NEWSLETTER_LIST_ID,
    issueId: letter.id,
    version: named.version,
    createdBy: authed.member.id,
    linkCheck: await linkKeyCheck(secret),
  })
  if ('refused' in result) return changed(result.refused)
  if (!('made' in result)) return errorResponse(ALREADY_SENDING, 409)
  const made = result.made

  await recordAdminAction(db, authed.member, {
    action: 'group_email_sent',
    targetLabel: letter.subject,
    detail: { campaign_id: made.campaignId, recipients: made.totalRecipients, list: NEWSLETTER_LIST_ID },
  })

  context.waitUntil(drainCampaign(context.env, made.campaignId))

  const body: NewsletterResponse = { campaignId: made.campaignId, totalRecipients: made.totalRecipients, status: 'sending' }
  return jsonResponse(body, 201)
}
