// test/unit/mail-footer.test.ts
//
// The footer and the one-click headers of every optional email (WS16 step
// 3): listMailParts in functions/utils/mail/footer.ts, the words of each
// LCA list in domain/mail/footer.ts, and the list footer's place in
// renderEmail (functions/utils/emailLayout.ts). Pinned here: the two
// headers in their order, one HTTPS address and no mailto, and the
// one-click value word for word; the footer's reason line and its two
// links, in each LCA list's own words, on the configured site; no postal
// address anywhere in the footer or its words; the colours of the new lines
// at 4.5 to 1 or more on the footer's ground; and, for each of the ten
// templates in functions/utils/email.ts, the email renderEmail draws
// without a list footer, byte for byte the one 764f32f's renderEmail drew
// from the same layout. That function is kept below as it was on 764f32f,
// copied before the change; a mock over the real module records each
// template's layout as it renders. Nothing here makes a request.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EVENT_MAIL_STILL_COMES, LIST_FOOTER_WORDS, listFooterWords, PREFERENCES_LABEL } from '../../domain/mail/footer'
import { NEWSLETTER_LIST_ID, TOURNAMENTS_LIST_ID } from '../../domain/mail/lists'
import * as email from '../../functions/utils/email'
import { emailListFooter, escapeHtml, renderEmail, type EmailLayout } from '../../functions/utils/emailLayout'
import { listMailParts } from '../../functions/utils/mail/footer'
import { MailLinkKeyMissing, readLink } from '../../functions/utils/mail/links'

const seen = vi.hoisted(() => ({ layouts: [] as unknown[] }))
vi.mock('../../functions/utils/emailLayout', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/emailLayout')>()
  return {
    ...real,
    renderEmail: (layout: Parameters<typeof real.renderEmail>[0]) => {
      seen.layouts.push(layout)
      return real.renderEmail(layout)
    },
  }
})

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

/** A made-up key for the links signed here, used nowhere else. */
const KEY = 'unit-test-made-up-footer-key-5521'
const SITE = 'https://www.louisianachess.org'
const CONTACT = '0123456789abcdef0123456789abcdef'

// ── renderEmail as 764f32f had it, copied before WS16 step 3 changed the file ──
const NAVY = '#1a2744'
const GOLD = '#c8a94a'
const INK = '#3a3f4b'
const MUTED = '#6b7280'
const SANS = 'Arial,Helvetica,sans-serif'
const SERIF = 'Georgia,serif'

function escapeHtmlBefore(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function emailButtonBefore(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;">
  <tr><td style="background:${GOLD};border-radius:8px;">
    <a href="${escapeHtmlBefore(url)}" style="display:inline-block;padding:12px 22px;font-family:${SANS};font-size:15px;font-weight:bold;color:${NAVY};text-decoration:none;border-radius:8px;">${escapeHtmlBefore(label)}</a>
  </td></tr>
</table>`
}

function siteLabelBefore(url: string): string {
  return url.replace(/^https?:\/\//, '')
}

function renderEmailBefore(layout: Omit<EmailLayout, 'listFooter'>): string {
  const siteUrl = layout.siteUrl.replace(/\/+$/, '')
  const heading = escapeHtmlBefore(layout.heading)
  const preheader = layout.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtmlBefore(layout.preheader)}</div>`
    : ''
  const cta = layout.cta
    ? `${emailButtonBefore(layout.cta.label, layout.cta.url)}${
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
              <a href="${siteUrl}"><img src="${siteUrl}/email-logo.jpg" alt="Louisiana Chess Association" width="140" style="display:block;margin:0 auto;border:0;border-radius:8px;"></a>
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
                <a href="${siteUrl}" style="color:${NAVY};text-decoration:none;">${siteLabelBefore(siteUrl)}</a>
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
// ── end of 764f32f's renderEmail ──

/** The ten templates of functions/utils/email.ts, each from made-up inputs. */
const tournament = { name: 'Sample Winter Open', date: '2026-12-05', location: 'Sample City', venue: 'Example Chess Club', url: `${SITE}/tournaments/sample-1` }
const TEMPLATES: Record<string, () => { html: string }> = {
  registrationConfirmationEmail: () => email.registrationConfirmationEmail({ siteUrl: SITE, recipientName: 'Player One', tournament, entries: [{ playerName: 'Player One', section: 'Open', amount: 25 }] }),
  registrationOpenReminderEmail: () => email.registrationOpenReminderEmail({ siteUrl: SITE, memberName: 'Player One', tournament }),
  weekBeforeReminderEmail: () => email.weekBeforeReminderEmail({ siteUrl: SITE, memberName: null, tournament: { ...tournament, endDate: '2026-12-06' } }),
  attendeeReminderEmail: () => email.attendeeReminderEmail({ siteUrl: SITE, memberName: 'Player One', tournament, section: 'Open', daysUntil: 3 }),
  tournamentAnnouncementEmail: () => email.tournamentAnnouncementEmail({ siteUrl: SITE, tournamentName: tournament.name, tournamentUrl: tournament.url, subject: 'Round times', message: 'Round one starts at 9:00 AM.' }),
  supportTicketConfirmationEmail: () => email.supportTicketConfirmationEmail({ siteUrl: SITE, name: 'Player One', ticketId: 'ticket-1', subject: 'A question', body: 'Hello there.', hasAccount: true }),
  staffTicketNotificationEmail: () => email.staffTicketNotificationEmail({ siteUrl: SITE, ticketId: 'ticket-1', ticketNumber: 1001, name: 'Player One', email: 'player.one@example.org', subject: 'A question', body: 'Hello there.' }),
  boardSeatNotificationEmail: () => email.boardSeatNotificationEmail({ siteUrl: SITE, holderName: 'Player Two', seatLabel: 'Sample seat', ticketId: 'ticket-1', ticketNumber: 1001, subject: 'A question', body: 'Hello there.', fromName: 'Player One', fromEmail: 'player.one@example.org' }),
  supportReplyNotificationEmail: () => email.supportReplyNotificationEmail({ siteUrl: SITE, name: 'Player One', ticketId: 'ticket-1', subject: 'A question', replyBody: 'Thanks for writing.', hasAccount: false }),
  memberFollowUpStaffEmail: () => email.memberFollowUpStaffEmail({ siteUrl: SITE, ticketId: 'ticket-1', ticketNumber: 1001, name: 'Player One', email: 'player.one@example.org', subject: 'A question', body: 'One more thing.' }),
}

beforeEach(() => {
  seen.layouts.length = 0
})

describe('the one-click headers', () => {
  it('come in order: List-Unsubscribe with one HTTPS address, the API\'s own and no mailto, then List-Unsubscribe-Post with the one-click value', async () => {
    const { headers } = await listMailParts({ SITE_URL: SITE, MAIL_LINK_SECRET: KEY }, { contactId: CONTACT, listId: NEWSLETTER_LIST_ID })
    expect(headers.map((h) => h.name)).toEqual(['List-Unsubscribe', 'List-Unsubscribe-Post'])
    expect(headers[1].value).toBe('List-Unsubscribe=One-Click')
    const value = headers[0].value
    expect(value).toMatch(/^<https:\/\/[^\s<>,]+>$/)
    expect(value.match(/</g)).toHaveLength(1)
    expect(value).not.toMatch(/mailto/i)
    const token = /^<https:\/\/www\.louisianachess\.org\/api\/mail\/unsubscribe\/([^>]+)>$/.exec(value)?.[1] ?? ''
    expect(await readLink({ current: KEY }, token, 'unsubscribe')).toEqual({ contactId: CONTACT, listId: NEWSLETTER_LIST_ID })
  })

  it('take the configured site, without its trailing slash, and the default site when none is configured', async () => {
    const trailing = await listMailParts({ SITE_URL: 'https://www.louisianachess.org/', MAIL_LINK_SECRET: KEY }, { contactId: CONTACT, listId: NEWSLETTER_LIST_ID })
    const none = await listMailParts({ MAIL_LINK_SECRET: KEY }, { contactId: CONTACT, listId: NEWSLETTER_LIST_ID })
    for (const parts of [trailing, none]) expect(parts.headers[0].value.startsWith(`<${SITE}/api/mail/unsubscribe/`)).toBe(true)
  })

  it('are signed for nothing without the key, and a list with no words of its own gets no footer', async () => {
    for (const secret of [undefined, '']) {
      await expect(listMailParts({ SITE_URL: SITE, MAIL_LINK_SECRET: secret }, { contactId: CONTACT, listId: NEWSLETTER_LIST_ID })).rejects.toBeInstanceOf(MailLinkKeyMissing)
    }
    await expect(listMailParts({ SITE_URL: SITE, MAIL_LINK_SECRET: KEY }, { contactId: CONTACT, listId: 'club-example' })).rejects.toThrow('No footer words are written for this list.')
  })
})

describe('the footer', () => {
  it('holds the newsletter\'s reason, the link that leaves it to the unsubscribe page and the preferences link, each signed for the contact', async () => {
    const { footerHtml, headers } = await listMailParts({ SITE_URL: SITE, MAIL_LINK_SECRET: KEY }, { contactId: CONTACT, listId: NEWSLETTER_LIST_ID })
    const words = LIST_FOOTER_WORDS[NEWSLETTER_LIST_ID]
    expect(footerHtml).toContain(escapeHtml(words.reason))
    const links = [...footerHtml.matchAll(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map((m) => [m[1], m[2]])
    expect(links.map(([, label]) => label)).toEqual([words.unsubscribeLabel, PREFERENCES_LABEL])
    const [unsubscribe, preferences] = links.map(([href]) => href)
    const unsubscribeToken = unsubscribe.slice(`${SITE}/email/unsubscribe/`.length)
    expect(unsubscribe).toBe(`${SITE}/email/unsubscribe/${unsubscribeToken}`)
    expect(headers[0].value).toBe(`<${SITE}/api/mail/unsubscribe/${unsubscribeToken}>`)
    expect(await readLink({ current: KEY }, unsubscribeToken, 'unsubscribe')).toEqual({ contactId: CONTACT, listId: NEWSLETTER_LIST_ID })
    expect(preferences.startsWith(`${SITE}/email/preferences/`)).toBe(true)
    expect(await readLink({ current: KEY }, preferences.slice(`${SITE}/email/preferences/`.length), 'preferences')).toEqual({ contactId: CONTACT })
    // The two links on one line, joined by a middle dot, as the association's line is.
    expect(footerHtml).toMatch(/<\/a> &nbsp;·&nbsp; <a /)
  })

  it('gives LCA tournament email its own words', async () => {
    const { footerHtml } = await listMailParts({ SITE_URL: SITE, MAIL_LINK_SECRET: KEY }, { contactId: CONTACT, listId: TOURNAMENTS_LIST_ID })
    expect(footerHtml).toContain(escapeHtml("You're getting LCA tournament email because this address is on an LCA member's account."))
    expect(footerHtml).toContain('>Unsubscribe from LCA tournament email</a>')
    expect(footerHtml).toContain(`/email/unsubscribe/${CONTACT}.${TOURNAMENTS_LIST_ID}.`)
  })

  it('holds the words of each list word for word, in one place', () => {
    expect(LIST_FOOTER_WORDS).toEqual({
      [NEWSLETTER_LIST_ID]: {
        reason: "You're getting the LCA newsletter because this address is on an LCA member's account.",
        unsubscribeLabel: 'Unsubscribe from the LCA newsletter',
      },
      [TOURNAMENTS_LIST_ID]: {
        reason: "You're getting LCA tournament email because this address is on an LCA member's account.",
        unsubscribeLabel: 'Unsubscribe from LCA tournament email',
      },
    })
    expect(PREFERENCES_LABEL).toBe('Email preferences')
    expect(EVENT_MAIL_STILL_COMES).toBe("You'll still get email about your membership, registrations, payments and support requests.")
    expect(listFooterWords(NEWSLETTER_LIST_ID)).toBe(LIST_FOOTER_WORDS[NEWSLETTER_LIST_ID])
    for (const id of ['club-example', 'toString', 'constructor', '']) expect(listFooterWords(id), id).toBeUndefined()
  })

  it('holds no postal address: no street, box, suite, city line or ZIP code in the words or in a footer, and no setting or slot for one', async () => {
    const code = read('domain/mail/footer.ts').split('\n').filter((line) => !/^\s*(?:\/\/|\/\*\*|\*)/.test(line)).join('\n')
    const { footerHtml } = await listMailParts({ SITE_URL: SITE, MAIL_LINK_SECRET: KEY }, { contactId: CONTACT, listId: NEWSLETTER_LIST_ID })
    const POSTAL = /\b(?:P\.?\s?O\.?\s+Box|box|street|st\.|avenue|ave\.|road|suite|postal|address line|zip)\b|\b\d{5}(?:-\d{4})?\b|\bLA\s+\d{5}\b/i
    for (const [what, text] of [['domain/mail/footer.ts', code], ['the footer', footerHtml.replace(/href="[^"]+"/g, '')], ['the footer source', read('functions/utils/mail/footer.ts').split('\n').filter((line) => !/^\s*(?:\/\/|\/\*\*|\*)/.test(line)).join('\n')]] as const) {
      expect(text, what).not.toMatch(POSTAL)
    }
    expect(Object.keys(await import('../../domain/mail/footer')).sort()).toEqual(['EVENT_MAIL_STILL_COMES', 'LIST_FOOTER_WORDS', 'PREFERENCES_LABEL', 'listFooterWords'])
  })

  it('draws its lines in the footer\'s ink and its links underlined in navy, each at 4.5 to 1 or more on the footer\'s ground', () => {
    const html = emailListFooter('Sample reason.', [{ label: 'Sample link', url: `${SITE}/email/preferences/sample` }])
    const luminance = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const contrast = (a: string, b: string) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
      return (hi + 0.05) / (lo + 0.05)
    }
    const ground = /background-color:(#[0-9a-f]{6});border-top/.exec(renderEmail({ siteUrl: SITE, heading: 'Sample', body: '' }))?.[1] ?? ''
    expect(ground).toBe('#f4f4f0')
    const colours = [...html.matchAll(/color:(#[0-9a-f]{6})/g)].map((m) => m[1])
    expect(colours.sort()).toEqual(['#1a2744', '#3a3f4b', '#3a3f4b'])
    for (const colour of colours) expect(contrast(colour, ground), colour).toBeGreaterThanOrEqual(4.5)
    expect(html).toContain('style="color:#1a2744;text-decoration:underline;"')
    expect(html).toMatch(/font-size:13px;color:#3a3f4b;">Sample reason\.<\/p>/)
    expect(html).toMatch(/font-size:12px;color:#3a3f4b;"><a /)
  })
})

describe('renderEmail and the list footer', () => {
  it('draws the list footer inside the footer cell, under the footer note and above the association\'s line, only when given', async () => {
    const { footerHtml } = await listMailParts({ SITE_URL: SITE, MAIL_LINK_SECRET: KEY }, { contactId: CONTACT, listId: NEWSLETTER_LIST_ID })
    const layout = { siteUrl: SITE, heading: 'Sample newsletter', body: '<p>Sample news.</p>' }
    const withFooter = renderEmail({ ...layout, listFooter: footerHtml })
    const without = renderEmail(layout)
    const note = withFooter.indexOf('Questions? Just reply to this email')
    const footer = withFooter.indexOf(footerHtml)
    const association = withFooter.indexOf('Louisiana Chess Association &nbsp;·&nbsp;')
    expect(note).toBeGreaterThan(-1)
    expect(note).toBeLessThan(footer)
    expect(footer).toBeLessThan(association)
    expect(withFooter.replace(`${footerHtml}\n              `, '')).toBe(without)
    expect(renderEmail({ ...layout, listFooter: '' })).toBe(without)
    expect(without).not.toContain('Unsubscribe')
  })

  it('draws every layout without a list footer byte for byte as 764f32f\'s renderEmail did, with and without each optional part', () => {
    const parts: Array<Partial<EmailLayout>> = [
      {}, { preheader: 'Sample preview line' }, { cta: { label: 'Sample button', url: `${SITE}/sample` } },
      { cta: { label: 'Sample button', url: `${SITE}/sample?a=1&b=2` }, ctaNote: 'Sample note.' }, { footerNote: 'Sample footer note.' },
      { siteUrl: `${SITE}/`, heading: 'Sample <heading> & "quotes"' },
    ]
    for (const extra of parts) {
      const layout = { siteUrl: SITE, heading: 'Sample heading', body: '<p>Sample body.</p>', ...extra }
      expect(renderEmail(layout), JSON.stringify(extra)).toBe(renderEmailBefore(layout))
    }
  })

  it.each(Object.keys(TEMPLATES))('draws %s byte for byte as 764f32f\'s renderEmail did, from the same layout, with no list footer', (name) => {
    const { html } = TEMPLATES[name]()
    expect(seen.layouts).toHaveLength(1)
    const layout = seen.layouts[0] as EmailLayout
    expect(layout).not.toHaveProperty('listFooter')
    expect(html).toBe(renderEmailBefore(layout))
  })

  it('covers each of the ten templates functions/utils/email.ts exports, and nothing else', () => {
    const templates = Object.keys(email).filter((name) => /Email$/.test(name) && !/^(?:send|trySend)Email$/.test(name)).sort()
    expect(templates).toEqual(Object.keys(TEMPLATES).sort())
    expect(templates).toHaveLength(10)
  })
})
