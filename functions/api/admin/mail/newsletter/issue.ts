// functions/api/admin/mail/newsletter/issue.ts
//
// GET and PUT /api/admin/mail/newsletter/issue: the LCA newsletter's open
// letter on the newsletter's own page (WS16 part two, page step 3), read and
// saved, for the people requireListMailer admits, the people who may send
// the newsletter today. Its contracts are in domain/contracts/newsletter.ts.
//
// While MAIL_PAGE_ON is unset each method answers 404 { error: 'Not found' }
// first, before it reads the request, the session or the database, so a
// preview whose database has not reached migration 0061 is safe. This is
// the other way round from part one's three newsletter files, which ask the
// guard first so that a signed-out caller learns nothing of whether the
// newsletter is switched on: with the page off a caller learns that it is
// off, which the page's own address tells anyone already, and nothing is
// read. Then the guard, then the request.
//
// - GET answers the open letter, its state in a word, and who wrote to it
//   last and when (functions/utils/mail/issues.ts, openIssue).
// - PUT takes { id, version, monthLabel, subject, preheader, bodyHtml }
//   through parseBody, the three plain fields trimmed and held to their
//   limits and to one line, and then, with nothing written before each
//   refusal: 413 for a letter over 240,000 bytes before cleaning; the letter
//   cleaned with cleanLetterHtml, and 400 when the cleaner answers null; 413
//   for a cleaned letter over LETTER_MAX_BYTES; 400 for one whose first
//   heading is a smaller one; then saveIssue's one statement, held to the
//   version read, answering 200 { id, version, savedAt, bodyHtml }, the
//   stored letter given back only when the cleaner changed what was sent;
//   404 for a letter that is not the newsletter's; and 409 { error, reason,
//   changedBy, changedAt } when the letter was written to, sent or set aside
//   since it was read, or, for the first save, when someone made the letter
//   first. What is stored is the cleaner's own output, never what was sent.
//   A save writes no activity row, by decision: the letter's row says who
//   saved it last and when.
import type { Env } from '../../../../types'
import { NEWSLETTER_LIST_ID } from '../../../../../domain/mail/lists'
import {
  newsletterIssueSaveRequestSchema,
  type NewsletterIssueRefused,
  type NewsletterIssueResponse,
  type NewsletterIssueSavedResponse,
} from '../../../../../domain/contracts/newsletter'
import { isResponse, requireListMailer } from '../../../../utils/auth'
import { cleanedLetter, openIssue, pageNotFound, refusalWords, saveIssue } from '../../../../utils/mail/issues'
import { MAIL_PAGE_ON } from '../../../../utils/mail/switches'
import { errorResponse, handleOptions, jsonResponse, parseBody } from '../../../../utils/response'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  if (!MAIL_PAGE_ON) return pageNotFound()
  const authed = await requireListMailer(context.request, context.env)
  if (isResponse(authed)) return authed

  const open = await openIssue(context.env.DB, NEWSLETTER_LIST_ID)
  const body: NewsletterIssueResponse = open
    ? { issue: open.letter, state: 'draft', lastSavedBy: open.lastSavedBy, lastSavedAt: open.lastSavedAt }
    : { issue: null, state: 'none', lastSavedBy: null, lastSavedAt: null }
  return jsonResponse(body)
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
  if (!MAIL_PAGE_ON) return pageNotFound()
  const authed = await requireListMailer(context.request, context.env)
  if (isResponse(authed)) return authed

  const save = await parseBody(context.request, newsletterIssueSaveRequestSchema)
  if (save instanceof Response) return save

  const letter = await cleanedLetter(save.bodyHtml)
  if ('refused' in letter) return errorResponse(letter.refused.error, letter.refused.status)

  const result = await saveIssue(context.env.DB, {
    listId: NEWSLETTER_LIST_ID,
    id: save.id,
    version: save.version,
    monthLabel: save.monthLabel,
    subject: save.subject,
    preheader: save.preheader,
    bodyHtml: letter.cleaned,
    by: authed.member.id,
  })
  if ('notFound' in result) return pageNotFound()
  if ('refused' in result) {
    const refused: NewsletterIssueRefused = { error: refusalWords(result.refused.reason), ...result.refused }
    return jsonResponse(refused, 409)
  }
  const body: NewsletterIssueSavedResponse = {
    ...result.saved,
    bodyHtml: letter.cleaned === save.bodyHtml ? null : letter.cleaned,
  }
  return jsonResponse(body)
}
