// functions/utils/mail/resend.ts
//
// Resend's transport. It writes the two requests the site sent Resend
// before the seam, byte for byte, key order included: the 'single' shape
// sendEmail in ../email wrote, and the 'campaign' shape Group email's
// sender in ../admin/campaigns wrote, with to as a bare string, reply_to
// first and no text part. A 2xx answer is taken as sent without reading
// its body, as before. This file is the only one under functions/ that
// names a mail service's address. It takes only types from ./send, so the
// seam and its transport never import each other when the code runs.

import { SENDER_NAME } from '../../../domain/mail/addresses'
import type { MailEnv, OutgoingMail, SendResult } from './send'

export async function sendThroughResend(env: MailEnv, mail: OutgoingMail): Promise<SendResult> {
  const from = `${mail.fromName ?? SENDER_NAME} <${mail.from}>`
  const response = await fetch(
    'https://api.resend.com/emails',
    mail.shape === 'single'
      ? {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from,
            to: [mail.to],
            reply_to: [mail.replyTo],
            subject: mail.subject,
            html: mail.html,
            ...(mail.text ? { text: mail.text } : {}),
          }),
        }
      : {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from,
            reply_to: [mail.replyTo],
            to: mail.to,
            subject: mail.subject,
            html: mail.html,
          }),
        },
  )
  if (response.ok) return { ok: true }
  return { ok: false, status: response.status, error: await response.text() }
}
