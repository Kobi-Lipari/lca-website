// functions/api/contact.ts
import type { Env } from '../types'
import { isResponse, requireAdmin } from '../utils/auth'
import {
  errorResponse,
  handleOptions,
  jsonResponse,
  parseJsonBody,
} from '../utils/response'
import {
  trySendEmail,
  contactConfirmationEmail,
  escapeHtml,
} from '../utils/email'

interface ContactBody {
  name: string
  email: string
  subject: string
  body: string
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const body = await parseJsonBody<ContactBody>(context.request)

  if (!body?.name || !body?.email || !body?.subject || !body?.body) {
    return errorResponse('All fields are required', 400)
  }

  const id = `contact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  await context.env.DB.prepare(
    `INSERT INTO contact_messages (id, name, email, subject, body)
     VALUES (?, ?, ?, ?, ?)`,
  ).bind(id, body.name, body.email, body.subject, body.body).run()

  // Best-effort emails: the message is already saved above, so a mail
  // outage must not turn a successful submission into a 500.
  await trySendEmail(context.env, {
    to: context.env.CONTACT_EMAIL,
    subject: `New contact message: ${body.subject}`,
    html: `
      <h2>New contact message</h2>
      <p><strong>From:</strong> ${escapeHtml(body.name)} (${escapeHtml(body.email)})</p>
      <p><strong>Subject:</strong> ${escapeHtml(body.subject)}</p>
      <p><strong>Message:</strong></p>
      <p>${escapeHtml(body.body).replace(/\n/g, '<br>')}</p>
    `,
  })

  const confirmation = contactConfirmationEmail({
    name: body.name,
    subject: body.subject,
  })
  await trySendEmail(context.env, { ...confirmation, to: body.email })

  return jsonResponse({ success: true, id }, 201)
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const authResult = await requireAdmin(context.request, context.env)
  if (isResponse(authResult)) return authResult

  const messages = await context.env.DB.prepare(
    `SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT 100`,
  ).all()

  return jsonResponse({ messages: messages.results })
}