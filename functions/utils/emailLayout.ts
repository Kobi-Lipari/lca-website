// functions/utils/emailLayout.ts
//
// The one look every email from the site shares: navy header with the logo,
// gold rule, a heading, the message, an optional button, and a footer that
// tells people how to reach a human.
//
// Everything is inline-styled tables, because mail clients strip or ignore
// most CSS. Kept free of Pages types so the scheduled-jobs Worker can use it.

export interface EmailLayout {
  /** Absolute site origin, no trailing slash. Used for the logo and footer. */
  siteUrl: string
  /** Big heading at the top of the message. Plain text. */
  heading: string
  /** Inbox preview line (hidden in the message itself). Plain text. */
  preheader?: string
  /** Main content, already-safe HTML. */
  body: string
  /** One main action, rendered as a gold button. */
  cta?: { label: string; url: string }
  /** Small print under the button. Already-safe HTML. */
  ctaNote?: string
  /** Replaces the default footer line. Already-safe HTML. */
  footerNote?: string
}

const NAVY = '#1a2744'
const GOLD = '#c8a94a'
const INK = '#3a3f4b'
const MUTED = '#6b7280'
const SANS = 'Arial,Helvetica,sans-serif'
const SERIF = 'Georgia,serif'

/** Escape user-provided text before putting it in email HTML. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** "#1042", or '' for a ticket from before numbers existed. */
export function ticketRef(number: number | null | undefined): string {
  return number ? `#${number}` : ''
}

/**
 * "Saturday, October 17, 2026", or "October 17–18, 2026" for a two-day
 * event. Falls back to the raw value if it isn't a date.
 */
export function formatEventDate(date: string, endDate?: string | null): string {
  const start = parseDay(date)
  if (!start) return date
  const end = endDate ? parseDay(endDate) : null
  const opts = { timeZone: 'UTC' } as const
  if (!end || end.getTime() === start.getTime()) {
    return start.toLocaleDateString('en-US', { ...opts, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  }
  const month = (d: Date) => d.toLocaleDateString('en-US', { ...opts, month: 'long' })
  const [y1, y2] = [start.getUTCFullYear(), end.getUTCFullYear()]
  if (y1 !== y2) return `${month(start)} ${start.getUTCDate()}, ${y1}–${month(end)} ${end.getUTCDate()}, ${y2}`
  if (start.getUTCMonth() === end.getUTCMonth()) return `${month(start)} ${start.getUTCDate()}–${end.getUTCDate()}, ${y1}`
  return `${month(start)} ${start.getUTCDate()}–${month(end)} ${end.getUTCDate()}, ${y1}`
}

function parseDay(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!m) return null
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return Number.isNaN(d.getTime()) ? null : d
}

/** A gold call-to-action button. */
export function emailButton(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;">
  <tr><td style="background:${GOLD};border-radius:8px;">
    <a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 22px;font-family:${SANS};font-size:15px;font-weight:bold;color:${NAVY};text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a>
  </td></tr>
</table>`
}

/**
 * A tidy label/value box ("Date", "Location", ...). Rows with no value are
 * left out, so callers can pass optional fields straight through. Values are
 * plain text and escaped here.
 */
export function emailDetails(rows: Array<[string, string | null | undefined]>): string {
  const filled = rows.filter((r): r is [string, string] => !!r[1] && r[1].trim() !== '')
  if (filled.length === 0) return ''
  const trs = filled
    .map(([label, value], i) => `<tr>
      <td style="padding:${i === 0 ? '0' : '8px'} 16px 0 0;font-family:${SANS};font-size:13px;color:${MUTED};vertical-align:top;white-space:nowrap;">${escapeHtml(label)}</td>
      <td style="padding:${i === 0 ? '0' : '8px'} 0 0;font-family:${SANS};font-size:15px;color:${NAVY};font-weight:bold;vertical-align:top;">${escapeHtml(value)}</td>
    </tr>`)
    .join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;background:#f7f6f2;border-radius:10px;">
  <tr><td style="padding:16px 18px;">
    <table role="presentation" cellpadding="0" cellspacing="0">${trs}</table>
  </td></tr>
</table>`
}

/** Someone's message, quoted. Plain text in, line breaks kept. */
export function emailQuote(text: string): string {
  return `<div style="margin:4px 0 20px;padding:12px 16px;border-left:3px solid ${GOLD};background:#faf9f5;font-family:${SANS};font-size:15px;line-height:1.6;color:${INK};white-space:pre-line;">${escapeHtml(text)}</div>`
}

/** A paragraph in the house style. Already-safe HTML in. */
export function p(html: string): string {
  return `<p style="margin:0 0 16px;">${html}</p>`
}

function siteLabel(url: string): string {
  return url.replace(/^https?:\/\//, '')
}

export function renderEmail(layout: EmailLayout): string {
  const siteUrl = layout.siteUrl.replace(/\/+$/, '')
  const heading = escapeHtml(layout.heading)
  const preheader = layout.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(layout.preheader)}</div>`
    : ''
  const cta = layout.cta
    ? `${emailButton(layout.cta.label, layout.cta.url)}${
        layout.ctaNote ? `<p style="margin:10px 0 0;font-size:12px;line-height:1.5;color:${MUTED};">${layout.ctaNote}</p>` : ''
      }`
    : ''
  const footerNote = layout.footerNote ?? 'Questions? Just reply to this email and it will reach us.'

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${heading}</title>
  <style>
    .lca-body p { margin: 0 0 16px; }
    .lca-body ul, .lca-body ol { margin: 0 0 16px; padding-left: 20px; }
    .lca-body a { color: ${NAVY}; text-decoration: underline; }
    @media (max-width: 600px) { .lca-pad { padding-left: 24px !important; padding-right: 24px !important; } }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f0;">
  ${preheader}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f0;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e0ddd5;">
          <tr>
            <td style="background-color:${NAVY};padding:28px 40px;text-align:center;">
              <a href="${siteUrl}"><img src="${siteUrl}/lca-logo.jpg" alt="Louisiana Chess Association" width="140" style="display:block;margin:0 auto;border:0;border-radius:8px;"></a>
            </td>
          </tr>
          <tr>
            <td style="background-color:${GOLD};height:4px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td class="lca-pad" style="padding:36px 40px 32px;">
              <h1 style="margin:0 0 18px;font-size:23px;line-height:1.3;color:${NAVY};font-family:${SERIF};">${heading}</h1>
              <div class="lca-body" style="font-size:16px;color:${INK};line-height:1.6;font-family:${SANS};">
                ${layout.body}
                ${cta}
              </div>
            </td>
          </tr>
          <tr>
            <td class="lca-pad" style="background-color:#f4f4f0;border-top:1px solid #e0ddd5;padding:20px 40px;text-align:center;font-family:${SANS};">
              <p style="margin:0 0 6px;font-size:13px;color:${INK};">${footerNote}</p>
              <p style="margin:0;font-size:12px;color:#999;">
                Louisiana Chess Association &nbsp;·&nbsp;
                <a href="${siteUrl}" style="color:${NAVY};text-decoration:none;">${siteLabel(siteUrl)}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
