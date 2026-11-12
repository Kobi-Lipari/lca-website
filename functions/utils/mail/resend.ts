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
//
// Two things only a test send meets, since list mail never reaches Resend
// (./send holds it back): a message that carries headers sends them as
// Resend's headers object, last in the body, so a message without them,
// every event email among them, is the same bytes as before; and a test
// send goes from DEFAULT_FROM, the one address Resend is set up for, since
// Resend sets up each sending subdomain on its own.

import { DEFAULT_FROM, SENDER_NAME } from '../../../domain/mail/addresses'
import type { MailEnv, OutgoingMail, SendResult } from './send'

/** The message's own headers as Resend takes them, an object keyed by name; nothing for a message that carries none. */
function headersOf(mail: OutgoingMail): { headers?: Record<string, string> } {
  if (!mail.headers || mail.headers.length === 0) return {}
  return { headers: Object.fromEntries(mail.headers.map(({ name, value }) => [name, value])) }
}

export async function sendThroughResend(env: MailEnv, mail: OutgoingMail): Promise<SendResult> {
  const from = `${mail.fromName ?? SENDER_NAME} <${mail.kind === 'test' ? DEFAULT_FROM : mail.from}>`
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
            ...headersOf(mail),
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
            ...headersOf(mail),
          }),
        },
  )
  if (response.ok) return { ok: true }
  return { ok: false, status: response.status, error: await response.text() }
}
