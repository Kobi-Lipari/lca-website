// functions/api/admin/mail/newsletter/templates.ts
//
// /api/admin/mail/newsletter/templates: the newsletter's saved templates on
// the newsletter's own page, shared by everyone requireListMailer admits. Its
// contracts are in domain/contracts/newsletter.ts. While MAIL_PAGE_ON is unset
// every method answers 404 { error: 'Not found' } first, before it reads the
// request, the session or the database, as the page's other endpoints do;
// then the guard, then the body through parseBody.
//
// - GET lists the shown templates, newest first, without their words.
// - POST saves a copy of words as a template under a name: { name, bodyHtml }
//   for the letter on the page, or { name, from: { issueId } | { campaignId } }
//   for a past newsletter. The words are cleaned as a save cleans them and
//   refused in words, 400 or 413; a name another shown template has, or a save
//   past TEMPLATES_MAX, is 409 in words; a past newsletter that is not the
//   newsletter's is 404. 201 { template }. The open letter is not touched.
// - PUT renames { id, version, name }: 200 { template }, 409 in words for a
//   taken name, 409 { error, changedBy, changedAt } when someone wrote to it
//   after that version was read, 404 for one not shown.
// - DELETE removes { id, version }: it is taken out of the list for everyone,
//   its row and words kept, and letters started from it stay as they are.
//   200 { removed: true }, or the same 409 and 404.
// No row is ever deleted, and no activity row written.
import type { Env } from '../../../../types'
import { NEWSLETTER_LIST_ID } from '../../../../../domain/mail/lists'
import {
  newsletterTemplateRemoveRequestSchema,
  newsletterTemplateRenameRequestSchema,
  newsletterTemplateSaveRequestSchema,
  type NewsletterTemplateChanged,
  type NewsletterTemplateRemovedResponse,
  type NewsletterTemplateSavedResponse,
  type NewsletterTemplatesResponse,
} from '../../../../../domain/contracts/newsletter'
import { isResponse, requireListMailer } from '../../../../utils/auth'
import {
  TEMPLATE_CHANGED,
  listTemplates,
  pageNotFound,
  removeTemplate,
  renameTemplate,
  saveTemplate,
  type TemplateChanged,
  type TemplateFrom,
} from '../../../../utils/mail/issues'
import { MAIL_PAGE_ON } from '../../../../utils/mail/switches'
import { errorResponse, handleOptions, jsonResponse, parseBody } from '../../../../utils/response'

/** The 409 of a rename or a remove that lost to another write, with who and when. */
function changedResponse(changed: TemplateChanged): Response {
  const body: NewsletterTemplateChanged = { error: TEMPLATE_CHANGED, ...changed }
  return jsonResponse(body, 409)
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  if (!MAIL_PAGE_ON) return pageNotFound()
  const authed = await requireListMailer(context.request, context.env)
  if (isResponse(authed)) return authed

  const body: NewsletterTemplatesResponse = { templates: await listTemplates(context.env.DB, NEWSLETTER_LIST_ID) }
  return jsonResponse(body)
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  if (!MAIL_PAGE_ON) return pageNotFound()
  const authed = await requireListMailer(context.request, context.env)
  if (isResponse(authed)) return authed

  const request = await parseBody(context.request, newsletterTemplateSaveRequestSchema)
  if (request instanceof Response) return request

  let from: TemplateFrom
  if (request.from === undefined) from = { bodyHtml: request.bodyHtml ?? '' }
  else if ('issueId' in request.from && typeof request.from.issueId === 'string') from = { issueId: request.from.issueId }
  else from = { campaignId: String((request.from as { campaignId: string }).campaignId) }

  const result = await saveTemplate(context.env.DB, { listId: NEWSLETTER_LIST_ID, name: request.name, from, by: authed.member.id })
  if ('notFound' in result) return pageNotFound()
  if ('refused' in result) return errorResponse(result.refused.error, result.refused.status)
  const body: NewsletterTemplateSavedResponse = { template: result.saved }
  return jsonResponse(body, 201)
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
  if (!MAIL_PAGE_ON) return pageNotFound()
  const authed = await requireListMailer(context.request, context.env)
  if (isResponse(authed)) return authed

  const request = await parseBody(context.request, newsletterTemplateRenameRequestSchema)
  if (request instanceof Response) return request

  const result = await renameTemplate(context.env.DB, {
    listId: NEWSLETTER_LIST_ID, id: request.id, version: request.version, name: request.name, by: authed.member.id,
  })
  if ('notFound' in result) return pageNotFound()
  if ('refused' in result) return errorResponse(result.refused.error, result.refused.status)
  if ('changed' in result) return changedResponse(result.changed)
  const body: NewsletterTemplateSavedResponse = { template: result.saved }
  return jsonResponse(body)
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  if (!MAIL_PAGE_ON) return pageNotFound()
  const authed = await requireListMailer(context.request, context.env)
  if (isResponse(authed)) return authed

  const request = await parseBody(context.request, newsletterTemplateRemoveRequestSchema)
  if (request instanceof Response) return request

  const result = await removeTemplate(context.env.DB, { listId: NEWSLETTER_LIST_ID, id: request.id, version: request.version, by: authed.member.id })
  if ('notFound' in result) return pageNotFound()
  if ('changed' in result) return changedResponse(result.changed)
  const body: NewsletterTemplateRemovedResponse = { removed: true }
  return jsonResponse(body)
}
