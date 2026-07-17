// functions/utils/email.ts

export interface EmailMessage {
  to: string
  subject: string
  html: string
  text?: string
}

/**
 * The minimal environment the email transport needs. Both the Pages
 * Functions Env and the daily-emails Worker Env satisfy it structurally,
 * so this module can be shared by both without importing either Env type.
 */
export interface EmailEnv {
  RESEND_API_KEY: string
  FROM_EMAIL?: string
}

/**
 * Send via Resend REST API. THROWS on failure (network error or non-2xx),
 * unlike the old MailChannels version which silently console.warn'd.
 * Callers that treat email as best-effort should use trySendEmail instead.
 */
export async function sendEmail(env: EmailEnv, message: EmailMessage): Promise<void> {
  const from = env.FROM_EMAIL ?? 'noreply@louisianachess.org'

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: `Louisiana Chess Association <${from}>`,
      to: [message.to],
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
      <p>Hi ${data.memberName},</p>
      <p>Your registration for <strong>${data.tournamentName}</strong> is confirmed.</p>
      <ul>
        <li><strong>Date:</strong> ${data.tournamentDate}</li>
        <li><strong>Location:</strong> ${data.tournamentLocation}</li>
        <li><strong>Section:</strong> ${data.section}</li>
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
      <p>Hi ${data.memberName},</p>
      <p>Registration is now open for <strong>${data.tournamentName}</strong>.</p>
      <ul>
        <li><strong>Date:</strong> ${data.tournamentDate}</li>
        <li><strong>Location:</strong> ${data.tournamentLocation}</li>
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
      <p>Hi ${data.memberName},</p>
      <p><strong>${data.tournamentName}</strong> is one week away and you haven't registered yet.</p>
      <ul>
        <li><strong>Date:</strong> ${data.tournamentDate}</li>
        <li><strong>Location:</strong> ${data.tournamentLocation}</li>
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
      <p>Hi ${data.memberName},</p>
      <p>This is a reminder that <strong>${data.tournamentName}</strong> is ${timeLabel}.</p>
      <ul>
        <li><strong>Date:</strong> ${data.tournamentDate}</li>
        <li><strong>Location:</strong> ${data.tournamentLocation}</li>
      </ul>
      <p>Good luck!</p>
      <p>— Louisiana Chess Association</p>
    `,
    text: `Reminder: ${data.tournamentName} is ${timeLabel} at ${data.tournamentLocation}.`,
  }
}

export function contactConfirmationEmail(data: {
  name: string
  subject: string
}): EmailMessage {
  return {
    to: '',
    subject: `We received your message — ${data.subject}`,
    html: `
      <h2>Message received</h2>
      <p>Hi ${data.name},</p>
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
}): EmailMessage {
  return {
    to: '',
    subject: `Support ticket created — ${data.subject}`,
    html: `
      <h2>Support ticket created</h2>
      <p>Hi ${data.name},</p>
      <p>Your support ticket has been created. Ticket ID: <strong>${data.ticketId}</strong></p>
      <p>Subject: ${data.subject}</p>
      <p>We will respond as soon as possible.</p>
      <p>— Louisiana Chess Association</p>
    `,
    text: `Hi ${data.name}, your support ticket (${data.ticketId}) has been created. Subject: ${data.subject}`,
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