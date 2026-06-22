import type { Env } from '../types'

export interface EmailMessage {
  to: string
  subject: string
  html: string
  text?: string
}

export async function sendEmail(env: Env, message: EmailMessage): Promise<void> {
  const from = env.FROM_EMAIL ?? 'noreply@louisianachess.org'

  const response = await fetch('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: message.to }] }],
      from: { email: from, name: 'Louisiana Chess Association' },
      subject: message.subject,
      content: [
        {
          type: 'text/html',
          value: message.html,
        },
        ...(message.text
          ? [{ type: 'text/plain', value: message.text }]
          : []),
      ],
    }),
  })

  if (!response.ok && response.status !== 202) {
    const error = await response.text()
    console.warn(`Email send failed (${response.status}): ${error}`)
  }
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
      <p>Hi ${data.name},</p>
      <p>There is a new reply on your support ticket: <strong>${data.subject}</strong></p>
      <blockquote>${data.replyBody}</blockquote>
      <p><a href="${data.siteUrl}/support/${data.ticketId}">View full conversation</a></p>
      <p>— Louisiana Chess Association</p>
    `,
    text: `New reply on your support ticket "${data.subject}": ${data.replyBody}`,
  }
}