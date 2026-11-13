// functions/api/admin/mail/newsletter/issues.ts
//
// GET /api/admin/mail/newsletter/issues: the LCA newsletter's last letters
// and sends, at most 20, newest first, without their words, for the chooser
// on the newsletter's own page (WS16 part two, page step 3), for the people
// requireListMailer admits. Its contract is in domain/contracts/newsletter.ts.
// While MAIL_PAGE_ON is unset it answers 404 { error: 'Not found' } first,
// before it reads the request, the session or the database, as the page's
// other methods do; then the guard.
//
// Each is named as a list needs it (lastIssues in
// functions/utils/mail/issues.ts): the month, the subject, its state in a
// word, when, who by, by name as the open letter names a person, and for a
// send how many it went to, the count the newsletter tab already gives. No
// reader's address and no other count.
import type { Env } from '../../../../types'
import { NEWSLETTER_LIST_ID } from '../../../../../domain/mail/lists'
import type { NewsletterIssuesResponse } from '../../../../../domain/contracts/newsletter'
import { isResponse, requireListMailer } from '../../../../utils/auth'
import { lastIssues, pageNotFound } from '../../../../utils/mail/issues'
import { MAIL_PAGE_ON } from '../../../../utils/mail/switches'
import { handleOptions, jsonResponse } from '../../../../utils/response'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  if (!MAIL_PAGE_ON) return pageNotFound()
  const authed = await requireListMailer(context.request, context.env)
  if (isResponse(authed)) return authed

  const body: NewsletterIssuesResponse = { issues: await lastIssues(context.env.DB, NEWSLETTER_LIST_ID) }
  return jsonResponse(body)
}
