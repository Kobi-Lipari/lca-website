// functions/utils/email.ts

import {
  escapeHtml,
  renderEmail,
  emailDetails,
  emailQuote,
  formatEventDate,
  ticketRef,
  p,
} from './emailLayout'

export { escapeHtml, formatEventDate, ticketRef } from './emailLayout'


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

/** Sender of record. Every transport falls back to this when FROM_EMAIL
 *  is unset, which is the normal case for the cron Worker. */
export const DEFAULT_FROM = 'noreply@louisianachess.org'

/** The association's only working mailbox. */
export const DEFAULT_REPLY_TO = 'LouisianaChess@gmail.com'

/**
 * Send via Resend REST API. THROWS on failure (network error or non-2xx),
 * unlike the old MailChannels version which silently console.warn'd.
 * Callers that treat email as best-effort should use trySendEmail instead.
 */
export async function sendEmail(env: EmailEnv, message: EmailMessage): Promise<void> {
  const from = env.FROM_EMAIL ?? DEFAULT_FROM
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

// ── Email templates ──────────────────────────────────────────────
//
// Every template renders through renderEmail() in ./emailLayout, so they all
// share one look and one footer. Each returns `to: ''`; callers fill it in.
// Ticket numbers are shown as "#1042" — never the internal ticket id.


/** Where a signed-in member opens one of their tickets. */
export function memberTicketUrl(siteUrl: string, ticketId: string): string {
  return `${siteUrl}/support?ticket=${encodeURIComponent(ticketId)}`
}

function firstName(name: string | null | undefined): string {
  const first = (name ?? '').trim().split(/\s+/)[0]
  return first || 'there'
}

function hi(name: string | null | undefined): string {
  return p(`Hi ${escapeHtml(firstName(name))},`)
}

// ── Tournaments ──────────────────────────────────────────────────

export interface EmailTournament {
  name: string
  date: string
  endDate?: string | null
  location?: string | null
  venue?: string | null
  /** Absolute URL of the tournament page. */
  url: string
}

function where(t: EmailTournament): string | null {
  const parts = [t.venue, t.location].map((s) => s?.trim()).filter(Boolean)
  return parts.length ? parts.join(', ') : null
}

export interface ConfirmedEntry {
  playerName: string
  section: string
  byeRounds?: number[]
  /** Dollars paid for this entry; 0 for free sections. */
  amount?: number
}

/**
 * "You're registered" — sent once the entry is confirmed (free sections at
 * once, paid ones when Stripe reports the payment). A parent entering
 * several children gets one email listing everyone.
 */
export function registrationConfirmationEmail(data: {
  siteUrl: string
  recipientName: string
  tournament: EmailTournament
  entries: ConfirmedEntry[]
}): EmailMessage {
  const t = data.tournament
  const when = formatEventDate(t.date, t.endDate)
  const place = where(t)
  const total = data.entries.reduce((sum, e) => sum + (e.amount ?? 0), 0)
  const single = data.entries.length === 1 ? data.entries[0] : null
  const byesText = (e: ConfirmedEntry) =>
    e.byeRounds && e.byeRounds.length ? `Round${e.byeRounds.length > 1 ? 's' : ''} ${e.byeRounds.join(', ')}` : null

  const entryBlock = single
    ? emailDetails([
        ['Player', single.playerName],
        ['Section', single.section],
        ['Date', when],
        ['Where', place],
        ['Byes', byesText(single)],
        ['Paid', total > 0 ? `$${total.toFixed(2)}` : null],
      ])
    : emailDetails([
        ['Date', when],
        ['Where', place],
        ...data.entries.map((e): [string, string] => [
          e.playerName,
          [e.section, byesText(e) ? `byes: ${byesText(e)!.toLowerCase()}` : null].filter(Boolean).join(' · '),
        ]),
        ['Paid', total > 0 ? `$${total.toFixed(2)}` : null],
      ])

  const who = single ? '' : `${data.entries.length} players are`
  const intro = single
    ? `${escapeHtml(single.playerName === data.recipientName ? 'You are' : `${single.playerName} is`)} entered in <strong>${escapeHtml(t.name)}</strong>.`
    : `${who} entered in <strong>${escapeHtml(t.name)}</strong>.`

  const names = data.entries.map((e) => `${e.playerName} (${e.section})`).join(', ')
  return {
    to: '',
    subject: `You're registered: ${t.name}`,
    html: renderEmail({
      siteUrl: data.siteUrl,
      heading: "You're registered",
      preheader: `${t.name} · ${when}`,
      body: hi(data.recipientName) + p(intro) + entryBlock +
        p("We'll send a reminder before the event. If your plans change, just reply to this email and let us know."),
      cta: { label: 'View the tournament', url: t.url },
    }),
    text: `Hi ${firstName(data.recipientName)},\n\nYou're registered for ${t.name}.\n\nPlayers: ${names}\nDate: ${when}${place ? `\nWhere: ${place}` : ''}${total > 0 ? `\nPaid: $${total.toFixed(2)}` : ''}\n\nTournament page: ${t.url}\n\nQuestions? Just reply to this email.\n— Louisiana Chess Association`,
  }
}

export function registrationOpenReminderEmail(data: {
  siteUrl: string
  memberName: string | null
  tournament: EmailTournament
}): EmailMessage {
  const t = data.tournament
  const when = formatEventDate(t.date, t.endDate)
  return {
    to: '',
    subject: `Registration is open: ${t.name}`,
    html: renderEmail({
      siteUrl: data.siteUrl,
      heading: 'Registration is open',
      preheader: `${t.name} · ${when}`,
      body: hi(data.memberName) +
        p(`You asked us to let you know: registration just opened for <strong>${escapeHtml(t.name)}</strong>.`) +
        emailDetails([['Date', when], ['Where', where(t)]]),
      cta: { label: 'Register now', url: t.url },
    }),
    text: `Hi ${firstName(data.memberName)},\n\nRegistration just opened for ${t.name} (${when}).\n\nRegister: ${t.url}\n\n— Louisiana Chess Association`,
  }
}

export function weekBeforeReminderEmail(data: {
  siteUrl: string
  memberName: string | null
  tournament: EmailTournament
}): EmailMessage {
  const t = data.tournament
  const when = formatEventDate(t.date, t.endDate)
  return {
    to: '',
    subject: `One week to go: ${t.name}`,
    html: renderEmail({
      siteUrl: data.siteUrl,
      heading: 'One week to go',
      preheader: `There's still time to enter ${t.name}.`,
      body: hi(data.memberName) +
        p(`<strong>${escapeHtml(t.name)}</strong> is a week away, and there's still time to enter.`) +
        emailDetails([['Date', when], ['Where', where(t)]]),
      cta: { label: 'Register now', url: t.url },
    }),
    text: `Hi ${firstName(data.memberName)},\n\n${t.name} is one week away (${when}). There's still time to enter: ${t.url}\n\n— Louisiana Chess Association`,
  }
}

export function attendeeReminderEmail(data: {
  siteUrl: string
  memberName: string
  tournament: EmailTournament
  section?: string | null
  daysUntil: number
}): EmailMessage {
  const t = data.tournament
  const when = formatEventDate(t.date, t.endDate)
  const timeLabel = data.daysUntil === 1 ? 'tomorrow' : `in ${data.daysUntil} days`
  return {
    to: '',
    subject: `${t.name} is ${timeLabel}`,
    html: renderEmail({
      siteUrl: data.siteUrl,
      heading: `See you ${data.daysUntil === 1 ? 'tomorrow' : 'soon'}`,
      preheader: `${t.name} is ${timeLabel}.`,
      body: hi(data.memberName) +
        p(`A reminder that <strong>${escapeHtml(t.name)}</strong> is ${timeLabel}.`) +
        emailDetails([['Player', data.memberName], ['Section', data.section], ['Date', when], ['Where', where(t)]]) +
        p('Check the tournament page for the round schedule and any last-minute updates. Good luck!'),
      cta: { label: 'Tournament details', url: t.url },
    }),
    text: `Hi ${firstName(data.memberName)},\n\nA reminder that ${t.name} is ${timeLabel} (${when}${where(t) ? `, ${where(t)}` : ''}).\n\nDetails: ${t.url}\n\nGood luck!\n— Louisiana Chess Association`,
  }
}

/** A tournament director's message to everyone entered. */
export function tournamentAnnouncementEmail(data: {
  siteUrl: string
  tournamentName: string
  tournamentUrl: string
  subject: string
  message: string
}): EmailMessage {
  return {
    to: '',
    subject: `${data.tournamentName}: ${data.subject}`,
    html: renderEmail({
      siteUrl: data.siteUrl,
      heading: data.subject,
      preheader: `An update about ${data.tournamentName}`,
      body: p(`An update from the director of <strong>${escapeHtml(data.tournamentName)}</strong>:`) +
        emailQuote(data.message),
      cta: { label: 'Tournament page', url: data.tournamentUrl },
      footerNote: "You're getting this because you're entered in this tournament. Questions? Just reply to this email.",
    }),
    text: `An update from the director of ${data.tournamentName}:\n\n${data.message}\n\nTournament page: ${data.tournamentUrl}\n\n— Louisiana Chess Association`,
  }
}

// ── Support tickets ──────────────────────────────────────────────

/** To the person who wrote in: we have it, here's your number. */
export function supportTicketConfirmationEmail(data: {
  siteUrl: string
  name: string
  ticketId: string
  ticketNumber: number | null
  subject: string
  body?: string
  /** e.g. "Scholastic Director" — omitted for general inquiries. */
  seatLabel?: string | null
  /** Signed-in submitters can follow the ticket on the site. */
  hasAccount: boolean
}): EmailMessage {
  const ref = ticketRef(data.ticketNumber)
  const routed = data.seatLabel
    ? `It has gone to our <strong>${escapeHtml(data.seatLabel)}</strong>, who will get back to you.`
    : 'Someone from the association will get back to you.'
  return {
    to: '',
    subject: ref ? `We got your message (${ref})` : 'We got your message',
    html: renderEmail({
      siteUrl: data.siteUrl,
      heading: 'Thanks, we got your message',
      preheader: ref ? `Your request number is ${ref}.` : undefined,
      body: hi(data.name) + p(routed) +
        emailDetails([['Request', ref || null], ['Subject', data.subject]]) +
        (data.body ? emailQuote(data.body) : '') +
        p(data.hasAccount
          ? 'You can follow the conversation and reply on the site.'
          : 'To add anything, just reply to this email.'),
      cta: data.hasAccount ? { label: 'View your request', url: memberTicketUrl(data.siteUrl, data.ticketId) } : undefined,
    }),
    text: `Hi ${firstName(data.name)},\n\nThanks, we got your message${ref ? ` (request ${ref})` : ''}: "${data.subject}".\n${data.seatLabel ? `It has gone to our ${data.seatLabel}.` : 'Someone will get back to you.'}\n\n${data.hasAccount ? `Follow it here: ${memberTicketUrl(data.siteUrl, data.ticketId)}` : 'To add anything, just reply to this email.'}\n\n— Louisiana Chess Association`,
  }
}

/**
 * To the association inbox whenever a ticket opens. replyTo is the
 * submitter, so hitting reply in Gmail answers them directly.
 */
export function staffTicketNotificationEmail(data: {
  siteUrl: string
  ticketId: string
  ticketNumber: number | null
  name: string
  email: string
  subject: string
  body: string
  seatLabel?: string | null
  holderName?: string | null
}): EmailMessage {
  const ref = ticketRef(data.ticketNumber)
  const forLine = data.seatLabel
    ? `${data.seatLabel}${data.holderName ? ` (${data.holderName})` : ' (seat is vacant)'}`
    : 'General inquiry'
  const url = `${data.siteUrl}/admin/support?ticket=${encodeURIComponent(data.ticketId)}`
  return {
    to: '',
    replyTo: data.email,
    subject: `${ref ? `${ref} ` : ''}${data.subject} (from ${data.name})`,
    html: renderEmail({
      siteUrl: data.siteUrl,
      heading: `New message${ref ? ` ${ref}` : ''}`,
      preheader: `${data.name}: ${data.subject}`,
      body: emailDetails([
        ['From', `${data.name} <${data.email}>`],
        ['For', forLine],
        ['Subject', data.subject],
      ]) + emailQuote(data.body),
      cta: { label: 'Reply on the site', url },
      ctaNote: 'Replying on the site keeps the answer with the request, where the next person in the role can find it. If you answer from your inbox instead, paste it into the request with "Log an email".',
      footerNote: `Replying to this email goes straight to ${escapeHtml(data.name)}.`,
    }),
    text: `New message ${ref} for ${forLine}\nFrom: ${data.name} <${data.email}>\nSubject: ${data.subject}\n\n${data.body}\n\nReply on the site: ${url}`,
  }
}

/** To a board seat's current holder, at their personal address. */
export function boardSeatNotificationEmail(data: {
  siteUrl: string
  holderName: string
  seatLabel: string
  ticketId: string
  ticketNumber: number | null
  subject: string
  body: string
  fromName: string
  fromEmail: string
}): EmailMessage {
  const ref = ticketRef(data.ticketNumber)
  const url = `${data.siteUrl}/board/inbox?ticket=${encodeURIComponent(data.ticketId)}`
  return {
    to: '',
    replyTo: data.fromEmail,
    subject: `${ref ? `${ref} ` : ''}${data.subject} (for the ${data.seatLabel})`,
    html: renderEmail({
      siteUrl: data.siteUrl,
      heading: `A message for the ${data.seatLabel}`,
      preheader: `${data.fromName}: ${data.subject}`,
      body: hi(data.holderName) +
        p(`Someone contacted you through the LCA website.`) +
        emailDetails([
          ['Request', ref || null],
          ['From', `${data.fromName} <${data.fromEmail}>`],
          ['Subject', data.subject],
        ]) + emailQuote(data.body),
      cta: { label: 'Reply in your board inbox', url },
      ctaNote: `Answering there keeps the conversation with the ${escapeHtml(data.seatLabel)} role, so whoever holds it after you can see it. If you reply from your own email, paste it into the request afterwards with "Log an email".`,
      footerNote: `Replying to this email goes straight to ${escapeHtml(data.fromName)}.`,
    }),
    text: `Hi ${firstName(data.holderName)},\n\nA message for the ${data.seatLabel}${ref ? ` (${ref})` : ''} from ${data.fromName} <${data.fromEmail}>:\n\n${data.subject}\n\n${data.body}\n\nReply in your board inbox: ${url}`,
  }
}

/** To the person who wrote in, when someone answers them. */
export function supportReplyNotificationEmail(data: {
  siteUrl: string
  name: string
  ticketId: string
  ticketNumber: number | null
  subject: string
  replyBody: string
  /** e.g. "Scholastic Director"; defaults to the association. */
  fromLabel?: string | null
  hasAccount: boolean
}): EmailMessage {
  const ref = ticketRef(data.ticketNumber)
  const from = data.fromLabel ? `Our ${escapeHtml(data.fromLabel)}` : 'The Louisiana Chess Association'
  return {
    to: '',
    subject: `Re: ${data.subject}${ref ? ` (${ref})` : ''}`,
    html: renderEmail({
      siteUrl: data.siteUrl,
      heading: 'You have a reply',
      preheader: data.replyBody.slice(0, 120),
      body: hi(data.name) +
        p(`${from} replied to your message <strong>“${escapeHtml(data.subject)}”</strong>${ref ? ` (${ref})` : ''}:`) +
        emailQuote(data.replyBody),
      cta: data.hasAccount ? { label: 'View the conversation', url: memberTicketUrl(data.siteUrl, data.ticketId) } : undefined,
      footerNote: 'To answer, just reply to this email.',
    }),
    text: `Hi ${firstName(data.name)},\n\n${data.fromLabel ? `Our ${data.fromLabel}` : 'The Louisiana Chess Association'} replied to "${data.subject}"${ref ? ` (${ref})` : ''}:\n\n${data.replyBody}\n\n${data.hasAccount ? `View the conversation: ${memberTicketUrl(data.siteUrl, data.ticketId)}\n\n` : ''}To answer, just reply to this email.`,
  }
}

/** To the association inbox when a member adds to their ticket on the site. */
export function memberFollowUpStaffEmail(data: {
  siteUrl: string
  ticketId: string
  ticketNumber: number | null
  name: string
  email: string
  subject: string
  body: string
}): EmailMessage {
  const ref = ticketRef(data.ticketNumber)
  const url = `${data.siteUrl}/admin/support?ticket=${encodeURIComponent(data.ticketId)}`
  return {
    to: '',
    replyTo: data.email,
    subject: `Re: ${ref ? `${ref} ` : ''}${data.subject} (from ${data.name})`,
    html: renderEmail({
      siteUrl: data.siteUrl,
      heading: `${data.name} replied${ref ? ` on ${ref}` : ''}`,
      preheader: data.body.slice(0, 120),
      body: emailDetails([['From', `${data.name} <${data.email}>`], ['Subject', data.subject]]) + emailQuote(data.body),
      cta: { label: 'Open the request', url },
      footerNote: `Replying to this email goes straight to ${escapeHtml(data.name)}.`,
    }),
    text: `${data.name} replied${ref ? ` on ${ref}` : ''} "${data.subject}":\n\n${data.body}\n\nOpen: ${url}`,
  }
}
