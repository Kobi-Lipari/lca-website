import type { Env } from '../types'
import {
  errorResponse,
  handleOptions,
  jsonResponse,
  parseJsonBody,
} from '../utils/response'
import {
  sendEmail,
  contactConfirmationEmail,
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

  // Send notification to LCA contact email
  await sendEmail(context.env, {
    ...{
      to: context.env.CONTACT_EMAIL,
      subject: `New contact message: ${body.subject}`,
      html: `
        <h2>New contact message</h2>
        <p><strong>From:</strong> ${body.name} (${body.email})</p>
        <p><strong>Subject:</strong> ${body.subject}</p>
        <p><strong>Message:</strong></p>
        <p>${body.body.replace(/\n/g, '<br>')}</p>
      `,
    },
  })

  // Send confirmation to sender
  const confirmation = contactConfirmationEmail({
    name: body.name,
    subject: body.subject,
  })
  await sendEmail(context.env, { ...confirmation, to: body.email })

  return jsonResponse({ success: true, id }, 201)
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  // Admin only — list all contact messages
  const messages = await context.env.DB.prepare(
    `SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT 100`,
  ).all()

  return jsonResponse({ messages: messages.results })
}