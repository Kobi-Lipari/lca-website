// functions/api/admin/mail/newsletter.ts
//
// GET and POST /api/admin/mail/newsletter: the LCA newsletter list in Group
// email (WS16), for the people requireListMailer admits, which verifies the
// session once: an LCA admin with a second factor and the president, and,
// while MAIL_LISTS_ON is set, the media manager with a second factor (WS16
// step 6). Its contracts are in domain/contracts/mail.ts. The guard answers
// first, so a signed-out caller and anyone who may not send get the
// guard's answer and learn nothing of whether the newsletter is switched
// on; then, while MAIL_LISTS_ON is unset, 404 { error: 'Not found' }, with
// nothing read or written.
//
// - GET answers the list, the newsletter's From line from
//   domain/mail/addresses.ts, the service that sends now, and the summary:
//   the audience's counts and the last 10 sends (functions/utils/mail/lists.ts).
// - POST takes { subject, bodyHtml } through parseBody and makes one send
//   on the list, refusing, with nothing written before each refusal: 409
//   while Resend sends, since the newsletter goes out only through Amazon
//   SES (Q41); 503 without the link key, since no link could be signed;
//   400 when nobody is on the list; and 409 while a newsletter is sending,
//   when createListCampaign makes none. A send is logged as Group email's
//   are, 'group_email_sent', with the campaign's id, its count and the
//   list's id, and drained in waitUntil as Group email's are, by the plan's
//   sizes; it answers 201 in the shape Group email's POST answers.
import type { Env } from '../../../types'
import { LIST_SENDERS } from '../../../../domain/mail/addresses'
import { NEWSLETTER_LIST_ID } from '../../../../domain/mail/lists'
import { newsletterRequestSchema, type NewsletterResponse, type NewsletterSummaryResponse } from '../../../../domain/contracts/mail'
import { recordAdminAction } from '../../../utils/admin/audit'
import { drainCampaign } from '../../../utils/admin/campaigns'
import { isResponse, requireListMailer } from '../../../utils/auth'
import { linkKeyCheck } from '../../../utils/mail/links'
import { createListCampaign, newsletterCounts, newsletterSummary } from '../../../utils/mail/lists'
import { ALREADY_SENDING, LINK_KEY_MISSING, NOBODY_ON_THE_LIST, WAITS_FOR_SES, newsletterNotFound } from '../../../utils/mail/newsletterAnswers'
import { senderNow } from '../../../utils/mail/rules'
import { MAIL_LISTS_ON } from '../../../utils/mail/switches'
import { errorResponse, handleOptions, jsonResponse, parseBody } from '../../../utils/response'

/** The newsletter's From line, its display name and its address, as LIST_SENDERS holds them. */
function fromLine(): string {
  const sender = LIST_SENDERS[NEWSLETTER_LIST_ID]
  return sender ? `${sender.name} <${sender.from}>` : ''
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const authed = await requireListMailer(context.request, context.env)
  if (isResponse(authed)) return authed
  if (!MAIL_LISTS_ON) return newsletterNotFound()

  const db = context.env.DB
  const list = await db.prepare('SELECT id, name FROM mail_lists WHERE id = ?').bind(NEWSLETTER_LIST_ID).first<{ id: string; name: string }>()
  if (!list) return newsletterNotFound()

  const body: NewsletterSummaryResponse = {
    list: { id: list.id, name: list.name },
    from: fromLine(),
    sendsThrough: senderNow(),
    summary: await newsletterSummary(db),
  }
  return jsonResponse(body)
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const authed = await requireListMailer(context.request, context.env)
  if (isResponse(authed)) return authed
  if (!MAIL_LISTS_ON) return newsletterNotFound()

  const newsletter = await parseBody(context.request, newsletterRequestSchema)
  if (newsletter instanceof Response) return newsletter

  if (senderNow() === 'resend') return errorResponse(WAITS_FOR_SES, 409)
  const secret = context.env.MAIL_LINK_SECRET
  if (!secret) return errorResponse(LINK_KEY_MISSING, 503)

  const db = context.env.DB
  if ((await newsletterCounts(db)).willGet === 0) return errorResponse(NOBODY_ON_THE_LIST, 400)

  const made = await createListCampaign(db, {
    listId: NEWSLETTER_LIST_ID,
    subject: newsletter.subject,
    bodyHtml: newsletter.bodyHtml,
    createdBy: authed.member.id,
    linkCheck: await linkKeyCheck(secret),
  })
  if (!made) return errorResponse(ALREADY_SENDING, 409)

  await recordAdminAction(db, authed.member, {
    action: 'group_email_sent',
    targetLabel: newsletter.subject,
    detail: { campaign_id: made.campaignId, recipients: made.totalRecipients, list: NEWSLETTER_LIST_ID },
  })

  context.waitUntil(drainCampaign(context.env, made.campaignId))

  const body: NewsletterResponse = { campaignId: made.campaignId, totalRecipients: made.totalRecipients, status: 'sending' }
  return jsonResponse(body, 201)
}
