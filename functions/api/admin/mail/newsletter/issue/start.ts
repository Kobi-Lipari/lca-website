// functions/api/admin/mail/newsletter/issue/start.ts
//
// POST /api/admin/mail/newsletter/issue/start: a new letter for the LCA
// newsletter on the newsletter's own page (WS16 part two, page step 3), for
// the people requireListMailer admits. Its contracts are in
// domain/contracts/newsletter.ts. While MAIL_PAGE_ON is unset it answers 404
// { error: 'Not found' } first, before it reads the request, the session or
// the database, as GET and PUT .../issue do; then the guard.
//
// The body is { from, monthLabel } through parseBody: from is 'blank' or one
// of LCA's starters by its id (domain/mail/letter.ts), { issueId } for a past
// letter of the newsletter, or { campaignId } for a newsletter sent on it,
// from the plain tab among them. startIssue (functions/utils/mail/issues.ts)
// cleans the words it copies and refuses them in words, 400 or 413, as a save
// would; answers 404 for a letter or a send that is not the newsletter's,
// without saying whether it is another list's; sets the open letter aside,
// its words kept, when it holds any words, or reuses an open letter that
// holds none; and answers 201 with the new open letter, in the shape GET
// .../issue answers, or 409 { error, reason, changedBy, changedAt }, with
// nothing written, when someone wrote to the open letter, or made one, as
// this one was started ('changed'), or the letter it read was sent before it
// could write ('sent', in words of its own). No row is ever deleted, and no
// activity row written.
import type { Env } from '../../../../../types'
import { NEWSLETTER_LIST_ID } from '../../../../../../domain/mail/lists'
import {
  newsletterIssueStartRequestSchema,
  type NewsletterIssueRefused,
  type NewsletterIssueResponse,
  type NewsletterIssueStartRequest,
} from '../../../../../../domain/contracts/newsletter'
import { isResponse, requireListMailer } from '../../../../../utils/auth'
import { pageNotFound, startIssue, startRefusalWords, type StartFrom } from '../../../../../utils/mail/issues'
import { MAIL_PAGE_ON } from '../../../../../utils/mail/switches'
import { errorResponse, handleOptions, jsonResponse, parseBody } from '../../../../../utils/response'

/** The source the contract read, as startIssue takes it: a starter's id, a past letter or a send, and nothing beside it. */
function sourceOf(from: NewsletterIssueStartRequest['from']): StartFrom {
  if (typeof from === 'string') return from
  if (typeof from.issueId === 'string') return { issueId: from.issueId }
  return { campaignId: String(from.campaignId) }
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  if (!MAIL_PAGE_ON) return pageNotFound()
  const authed = await requireListMailer(context.request, context.env)
  if (isResponse(authed)) return authed

  const start = await parseBody(context.request, newsletterIssueStartRequestSchema)
  if (start instanceof Response) return start

  const result = await startIssue(context.env.DB, {
    listId: NEWSLETTER_LIST_ID,
    from: sourceOf(start.from),
    monthLabel: start.monthLabel,
    by: authed.member.id,
  })
  if ('notFound' in result) return pageNotFound()
  if ('letterRefused' in result) return errorResponse(result.letterRefused.error, result.letterRefused.status)
  if ('refused' in result) {
    const refused: NewsletterIssueRefused = { error: startRefusalWords(result.refused.reason), ...result.refused }
    return jsonResponse(refused, 409)
  }
  const open = result.started
  const body: NewsletterIssueResponse = { issue: open.letter, state: 'draft', lastSavedBy: open.lastSavedBy, lastSavedAt: open.lastSavedAt }
  return jsonResponse(body, 201)
}
