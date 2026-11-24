// test/unit/mail-list-message-look.test.ts
//
// The look a list send is drawn in (WS16 part two, page step 6, the send
// half): listMessage in functions/utils/admin/campaigns.ts draws a send with
// no look as Group email always has, wrapBrandedEmail with the person's
// footer, byte for byte, and a send made from the newsletter's own page in
// the navy look, as renderNewsletter draws it. lookOf reads the look from a
// campaign's filter_json: none for every send made before the page could
// send, the navy look with its month and preview line, and 'unknown' for a
// look this deployment cannot draw, so the run sends nothing rather than the
// wrong email. No request leaves this file. Every word here is made up.
import { describe, expect, it } from 'vitest'
import { NEWSLETTER_LIST_ID } from '../../domain/mail/lists'
import { renderNewsletter } from '../../domain/mail/newsletterLayout'
import { listMessage, lookOf, wrapBrandedEmail, type CampaignEnv } from '../../functions/utils/admin/campaigns'
import { listMailParts } from '../../functions/utils/mail/footer'

const SITE = 'https://www.louisianachess.org'
const ENV = { SITE_URL: SITE, MAIL_LINK_SECRET: 'sample-link-key-for-a-unit-test-only' } as CampaignEnv
const CONTACT = 'a1b2c3d4'.repeat(4)
const SUBJECT = 'Sample subject one'
const BODY = '<h2>Sample heading one</h2><p>Example words for a sample letter.</p>'

describe('listMessage', () => {
  it('draws a send with no look as wrapBrandedEmail with the person\'s footer, byte for byte', async () => {
    const parts = await listMailParts(ENV, { contactId: CONTACT, listId: NEWSLETTER_LIST_ID })
    const message = await listMessage(ENV, { listId: NEWSLETTER_LIST_ID, contactId: CONTACT, subject: SUBJECT, bodyHtml: BODY })
    expect(message.html).toBe(wrapBrandedEmail(ENV, SUBJECT, BODY, parts.footerHtml))
    expect(message.headers).toEqual(parts.headers)
  })

  it('draws a send with the navy look as renderNewsletter does, byte for byte, with the same sender and headers', async () => {
    const parts = await listMailParts(ENV, { contactId: CONTACT, listId: NEWSLETTER_LIST_ID })
    const look = { month: 'December 2026', preheader: 'Sample preview line' }
    const plain = await listMessage(ENV, { listId: NEWSLETTER_LIST_ID, contactId: CONTACT, subject: SUBJECT, bodyHtml: BODY })
    const message = await listMessage(ENV, { listId: NEWSLETTER_LIST_ID, contactId: CONTACT, subject: SUBJECT, bodyHtml: BODY, look })
    expect(message.html).toBe(renderNewsletter({ siteUrl: SITE, month: look.month, subject: SUBJECT, preheader: look.preheader, bodyHtml: BODY, footerHtml: parts.footerHtml }))
    expect({ ...message, html: '' }).toEqual({ ...plain, html: '' })
  })
})

describe('lookOf', () => {
  it('reads no look from a send made without one, the navy look with its month and preview line, and anything else as unknown', () => {
    expect(lookOf(null)).toBeNull()
    expect(lookOf(JSON.stringify({ list: NEWSLETTER_LIST_ID, linkCheck: 'abcd' }))).toBeNull()
    expect(lookOf(JSON.stringify({ list: NEWSLETTER_LIST_ID, look: 'navy', month: 'December 2026', preheader: '' }))).toEqual({ month: 'December 2026', preheader: '' })
    expect(lookOf(JSON.stringify({ look: 'x' }))).toBe('unknown')
    expect(lookOf(JSON.stringify({ look: 'navy', preheader: 'Sample preview line' }))).toBe('unknown')
    expect(lookOf('not json {')).toBeNull()
  })
})
