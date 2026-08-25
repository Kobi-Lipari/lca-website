// functions/utils/email.ts

export interface EmailMessage {
  to: string
  subject: string
  html: string
  text?: string
  /**
   * Where replies go. Defaults to DEFAULT_REPLY_TO below.
   *
   * This matters more than it looks: mail is SENT from an @louisianachess.org
   * address (Resend authenticates that domain via SPF/DKIM), but no mailbox at
   * that domain exists any more. Without reply_to, every reply to every email
   * this site sends lands in a black hole.
   */
  replyTo?: string
}

/**
 * The minimal environment the email transport needs. Both the Pages
 * Functions Env and the daily-emails Worker Env satisfy it structurally,
 * so this module can be shared by both without importing either Env type.
 */
export interface EmailEnv {
  RESEND_API_KEY: string
  FROM_EMAIL?: string
  REPLY_TO_EMAIL?: string
}

/** The association's only working mailbox. */
export const DEFAULT_REPLY_TO = 'LouisianaChess@gmail.com'

/**
 * Send via Resend REST API. THROWS on failure (network error or non-2xx),
 * unlike the old MailChannels version which silently console.warn'd.
 * Callers that treat email as best-effort should use trySendEmail instead.
 */
export async function sendEmail(env: EmailEnv, message: EmailMessage): Promise<void> {
  const from = env.FROM_EMAIL ?? 'noreply@louisianachess.org'
  const replyTo = message.replyTo ?? env.REPLY_TO_EMAIL ?? DEFAULT_REPLY_TO

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: `Louisiana Chess Association <${from}>`,
      to: [message.to],
      reply_to: [replyTo],
      subject: message.subject,
      html: message.html,
      ...(message.text ? { text: message.text } : {}),
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Email send failed (${response.status}): ${error}`)
  }
}

/**
 * Best-effort variant: returns true/false instead of throwing.
 * Use for emails that must not fail the surrounding operation
 * (registration confirmations, contact acknowledgments, cron sends).
 */
export async function trySendEmail(env: EmailEnv, message: EmailMessage): Promise<boolean> {
  try {
    await sendEmail(env, message)
    return true
  } catch (err) {
    console.warn(err instanceof Error ? err.message : String(err))
    return false
  }
}

/** Escape user-provided text before interpolating into email HTML. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ── Email templates ──────────────────────────────────────────────

export function registrationConfirmationEmail(data: {
  memberName: string
  tournamentName: string
  tournamentDate: string
  tournamentLocation: string
  section: string
}): EmailMessage {
  return {
    to: '',
    subject: `Registration confirmed — ${data.tournamentName}`,
    html: `
      <h2>You're registered!</h2>
      <p>Hi ${escapeHtml(data.memberName)},</p>
      <p>Your registration for <strong>${escapeHtml(data.tournamentName)}</strong> is confirmed.</p>
      <ul>
        <li><strong>Date:</strong> ${escapeHtml(data.tournamentDate)}</li>
        <li><strong>Location:</strong> ${escapeHtml(data.tournamentLocation)}</li>
        <li><strong>Section:</strong> ${escapeHtml(data.section)}</li>
      </ul>
      <p>We look forward to seeing you there!</p>
      <p>— Louisiana Chess Association</p>
    `,
    text: `You're registered for ${data.tournamentName} on ${data.tournamentDate} at ${data.tournamentLocation}, section: ${data.section}.`,
  }
}

export function registrationOpenReminderEmail(data: {
  memberName: string
  tournamentName: string
  tournamentDate: string
  tournamentLocation: string
  registrationUrl: string
}): EmailMessage {
  return {
    to: '',
    subject: `Registration is now open — ${data.tournamentName}`,
    html: `
      <h2>Registration is open!</h2>
      <p>Hi ${escapeHtml(data.memberName)},</p>
      <p>Registration is now open for <strong>${escapeHtml(data.tournamentName)}</strong>.</p>
      <ul>
        <li><strong>Date:</strong> ${escapeHtml(data.tournamentDate)}</li>
        <li><strong>Location:</strong> ${escapeHtml(data.tournamentLocation)}</li>
      </ul>
      <p><a href="${data.registrationUrl}">Register now</a></p>
      <p>— Louisiana Chess Association</p>
    `,
    text: `Registration is now open for ${data.tournamentName} on ${data.tournamentDate}. Register at: ${data.registrationUrl}`,
  }
}

export function weekBeforeReminderEmail(data: {
  memberName: string
  tournamentName: string
  tournamentDate: string
  tournamentLocation: string
  registrationUrl: string
}): EmailMessage {
  return {
    to: '',
    subject: `One week until ${data.tournamentName} — register now`,
    html: `
      <h2>One week to go!</h2>
      <p>Hi ${escapeHtml(data.memberName)},</p>
      <p><strong>${escapeHtml(data.tournamentName)}</strong> is one week away and you haven't registered yet.</p>
      <ul>
        <li><strong>Date:</strong> ${escapeHtml(data.tournamentDate)}</li>
        <li><strong>Location:</strong> ${escapeHtml(data.tournamentLocation)}</li>
      </ul>
      <p><a href="${data.registrationUrl}">Register now</a></p>
      <p>— Louisiana Chess Association</p>
    `,
    text: `${data.tournamentName} is one week away. Register at: ${data.registrationUrl}`,
  }
}

export function attendeeReminderEmail(data: {
  memberName: string
  tournamentName: string
  tournamentDate: string
  tournamentLocation: string
  daysUntil: number
}): EmailMessage {
  const timeLabel = data.daysUntil === 1 ? 'tomorrow' : `in ${data.daysUntil} days`
  return {
    to: '',
    subject: `${data.tournamentName} is ${timeLabel}`,
    html: `
      <h2>Your tournament is ${timeLabel}!</h2>
      <p>Hi ${escapeHtml(data.memberName)},</p>
      <p>This is a reminder that <strong>${escapeHtml(data.tournamentName)}</strong> is ${timeLabel}.</p>
      <ul>
        <li><strong>Date:</strong> ${escapeHtml(data.tournamentDate)}</li>
        <li><strong>Location:</strong> ${escapeHtml(data.tournamentLocation)}</li>
      </ul>
      <p>Good luck!</p>
      <p>— Louisiana Chess Association</p>
    `,
    text: `Reminder: ${data.tournamentName} is ${timeLabel} at ${data.tournamentLocation}.`,
  }
}

/**
 * @deprecated Contact submissions now open a support ticket, so
 * supportTicketConfirmationEmail is sent instead. Kept so any other caller
 * keeps compiling; safe to delete once you've grepped for it.
 */
export function contactConfirmationEmail(data: {
  name: string
  subject: string
}): EmailMessage {
  return {
    to: '',
    subject: `We received your message — ${data.subject}`,
    html: `
      <h2>Message received</h2>
      <p>Hi ${escapeHtml(data.name)},</p>
      <p>We received your message and will get back to you as soon as possible.</p>
      <p>— Louisiana Chess Association</p>
    `,
    text: `Hi ${data.name}, we received your message and will get back to you soon.`,
  }
}

export function supportTicketConfirmationEmail(data: {
  name: string
  ticketId: string
  subject: string
  /** e.g. "Scholastic Director" — omitted for general inquiries. */
  seatLabel?: string | null
  siteUrl?: string
}): EmailMessage {
  const routedLine = data.seatLabel
    ? `<p>Your message was routed to the <strong>${escapeHtml(data.seatLabel)}</strong>.</p>`
    : ''
  const linkLine = data.siteUrl
    ? `<p><a href="${data.siteUrl}/support/${encodeURIComponent(data.ticketId)}">View your ticket</a></p>`
    : ''

  return {
    to: '',
    subject: `We received your message — ${data.subject}`,
    html: `
      <h2>Message received</h2>
      <p>Hi ${escapeHtml(data.name)},</p>
      <p>Your message has been logged as ticket <strong>${escapeHtml(data.ticketId)}</strong>.</p>
      ${routedLine}
      <p>Subject: ${escapeHtml(data.subject)}</p>
      ${linkLine}
      <p>Replying to this email reaches us too.</p>
      <p>— Louisiana Chess Association</p>
    `,
    text: `Hi ${data.name}, your message has been logged as ticket ${data.ticketId}. Subject: ${data.subject}`,
  }
}

/**
 * Sent to the association inbox (CONTACT_EMAIL) whenever a ticket opens.
 * replyTo is set to the submitter, so hitting reply in Gmail answers the
 * person directly instead of bouncing off a dead @louisianachess.org address.
 */
/** Button styling inlined — email clients strip <style> blocks. */
const CTA_BUTTON =
  'display:inline-block;padding:10px 18px;background:#c8a94a;color:#1a2744;' +
  'font-weight:600;text-decoration:none;border-radius:6px;font-family:sans-serif'
 
const CTA_NOTE =
  'margin-top:12px;font-size:12px;color:#666;font-family:sans-serif;line-height:1.5'
 
/**
 * Sent to the association inbox (CONTACT_EMAIL) whenever a ticket opens.
 * replyTo is set to the submitter, so hitting reply in Gmail answers the
 * person directly instead of bouncing off a dead @louisianachess.org address.
 */
export function staffTicketNotificationEmail(data: {
  ticketId: string
  name: string
  email: string
  subject: string
  body: string
  seatLabel?: string | null
  holderName?: string | null
  siteUrl?: string
}): EmailMessage {
  const routing = data.seatLabel
    ? `<p><strong>For:</strong> ${escapeHtml(data.seatLabel)}${
        data.holderName ? ` (${escapeHtml(data.holderName)})` : ' — seat is vacant'
      }</p>`
    : `<p><strong>For:</strong> General inquiry</p>`
 
  const cta = data.siteUrl
    ? `<p style="margin-top:20px">
         <a href="${data.siteUrl}/admin/support" style="${CTA_BUTTON}">Reply on the site</a>
       </p>
       <p style="${CTA_NOTE}">
         Replying on the site keeps the answer on this ticket, where the next
         person to hold this role can find it. If you reply from your own inbox
         instead, please paste what you sent into the ticket afterwards using
         "Log an email".
       </p>`
    : ''
 
  return {
    to: '',
    replyTo: data.email,
    subject: `[${data.seatLabel ?? 'LCA'}] ${data.subject}`,
    html: `
      <h2>New message</h2>
      ${routing}
      <p><strong>From:</strong> ${escapeHtml(data.name)} (${escapeHtml(data.email)})</p>
      <p><strong>Ticket:</strong> ${escapeHtml(data.ticketId)}</p>
      <blockquote style="white-space:pre-line">${escapeHtml(data.body)}</blockquote>
      ${cta}
    `,
    text: `New message for ${data.seatLabel ?? 'LCA'} from ${data.name} (${data.email}). Ticket ${data.ticketId}.\n\n${data.body}\n\nReply on the site so it stays on the record: ${data.siteUrl ?? ''}/admin/support`,
  }
}
 
/**
 * Sent to the seat's current holder at their own personal address. Their
 * address is never exposed publicly — the site holds it, the visitor never
 * sees it.
 */
export function boardSeatNotificationEmail(data: {
  holderName: string
  seatLabel: string
  ticketId: string
  subject: string
  body: string
  fromName: string
  fromEmail: string
  siteUrl?: string
}): EmailMessage {
  const cta = data.siteUrl
    ? `<p style="margin-top:20px">
         <a href="${data.siteUrl}/board/inbox" style="${CTA_BUTTON}">Reply in your board inbox</a>
       </p>
       <p style="${CTA_NOTE}">
         Answering here keeps the conversation attached to the
         ${escapeHtml(data.seatLabel)} seat, so whoever holds it after you can
         see what was said. Replying straight from your own email works too —
         just paste it into the ticket afterwards with "Log an email" so the
         record isn't left half-finished.
       </p>`
    : ''
 
  return {
    to: '',
    replyTo: data.fromEmail,
    subject: `New message as ${data.seatLabel} — ${data.subject}`,
    html: `
      <h2>New message for the ${escapeHtml(data.seatLabel)}</h2>
      <p>Hi ${escapeHtml(data.holderName)},</p>
      <p>Someone contacted you through the LCA site.</p>
      <p><strong>From:</strong> ${escapeHtml(data.fromName)} (${escapeHtml(data.fromEmail)})</p>
      <blockquote style="white-space:pre-line">${escapeHtml(data.body)}</blockquote>
      ${cta}
      <p>— Louisiana Chess Association</p>
    `,
    text: `New message for the ${data.seatLabel} from ${data.fromName} (${data.fromEmail}):\n\n${data.body}\n\nReply in your board inbox so it stays on the record: ${data.siteUrl ?? ''}/board/inbox`,
  }
}

export function supportReplyNotificationEmail(data: {
  name: string
  ticketId: string
  subject: string
  replyBody: string
  siteUrl: string
}): EmailMessage {
  return {
    to: '',
    subject: `New reply on your support ticket — ${data.subject}`,
    html: `
      <h2>New reply on your support ticket</h2>
      <p>Hi ${escapeHtml(data.name)},</p>
      <p>There is a new reply on your support ticket: <strong>${escapeHtml(data.subject)}</strong></p>
      <blockquote style="white-space:pre-line">${escapeHtml(data.replyBody)}</blockquote>
      <p><a href="${data.siteUrl}/support/${encodeURIComponent(data.ticketId)}">View full conversation</a></p>
      <p>— Louisiana Chess Association</p>
    `,
    text: `New reply on your support ticket "${data.subject}": ${data.replyBody}`,
  }
}