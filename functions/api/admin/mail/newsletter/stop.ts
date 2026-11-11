// functions/api/admin/mail/newsletter/stop.ts
//
// POST /api/admin/mail/newsletter/stop: stops the LCA newsletter that is
// sending, for the people requireListMailer admits, so a sender who sees a
// wrong link in the first minutes can stop what has not gone. Its contract
// is in domain/contracts/mail.ts. The guard answers first; then 404
// { error: 'Not found' } unless MAIL_LISTS_ON is set or a newsletter is
// sending, so the stop still works after the change that switched the
// newsletter on is reverted; then stopListCampaign
// (functions/utils/mail/lists.ts): the untried rows are failed with
// "Not sent: the send was stopped." and the send is closed, while a row
// already marked sending is left to its run. It answers 200 { stopped: n },
// logged as 'group_email_stopped' with the campaign's id and the count, or
// 409 when no newsletter is sending.
import type { Env } from '../../../../types'
import { NEWSLETTER_LIST_ID } from '../../../../../domain/mail/lists'
import type { NewsletterStopResponse } from '../../../../../domain/contracts/mail'
import { recordAdminAction } from '../../../../utils/admin/audit'
import { isResponse, requireListMailer } from '../../../../utils/auth'
import { sendingListCampaign, stopListCampaign } from '../../../../utils/mail/lists'
import { NOTHING_SENDING, newsletterNotFound } from '../../../../utils/mail/newsletterAnswers'
import { MAIL_LISTS_ON } from '../../../../utils/mail/switches'
import { errorResponse, handleOptions, jsonResponse } from '../../../../utils/response'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const authed = await requireListMailer(context.request, context.env)
  if (isResponse(authed)) return authed

  const db = context.env.DB
  const sending = await sendingListCampaign(db, NEWSLETTER_LIST_ID)
  if (!MAIL_LISTS_ON && !sending) return newsletterNotFound()

  const stopped = sending ? await stopListCampaign(db, NEWSLETTER_LIST_ID) : null
  if (stopped === null || !sending) return errorResponse(NOTHING_SENDING, 409)

  await recordAdminAction(db, authed.member, {
    action: 'group_email_stopped',
    targetLabel: sending.subject,
    detail: { campaign_id: sending.id, stopped },
  })

  const body: NewsletterStopResponse = { stopped }
  return jsonResponse(body)
}
