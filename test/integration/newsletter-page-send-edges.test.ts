// test/integration/newsletter-page-send-edges.test.ts
//
// WS16 part two, page step 6, the send half's drawing of the letter: a send
// made from the newsletter's own page (POST .../issue/send), drained by the
// real campaign sender (drainCampaign in waitUntil, then
// sweepPendingCampaigns with no request open), through Amazon SES's
// transport and the harness's catch point for it. MAIL_PAGE_ON,
// MAIL_PAGE_SEND_ON, MAIL_LISTS_ON, MAIL_SENDER and WORKERS_PLAN are read
// through getters on the mocked functions/utils/mail/switches, set before
// every case. Nothing here reaches an outside service.
//
// - Each drained email is renderNewsletter's page, byte for byte, with that
//   person's footer from listMailParts; it carries List-Unsubscribe then
//   List-Unsubscribe-Post, comes from the newsletter's From line, has no
//   "[TEST]" and no postal address, and both its links open.
// - The page's "Send a test to me" draws the same page for the same person.
// - The sweep sends the rest in the same look; a stop fails the untried rows
//   with STOPPED_WORDS; back on Resend the rest waits with WAIT_FOR_SES_WORDS,
//   and the tab says so; a letter changed by hand after the send changes no
//   email; a look this deployment cannot draw stops the send untried; a
//   member deleted mid-send drops out.
// - The tab's plain send is today's page, wrapBrandedEmail with the footer,
//   and its batch names no letter.
// Every name, address and word here is made up.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LIST_SENDERS } from '../../domain/mail/addresses'
import { NEWSLETTER_LIST_ID } from '../../domain/mail/lists'
import { renderNewsletter } from '../../domain/mail/newsletterLayout'
import { onRequestGet as newsletterGet, onRequestPost as newsletterPost } from '../../functions/api/admin/mail/newsletter'
import { onRequestPut as issuePut } from '../../functions/api/admin/mail/newsletter/issue'
import { onRequestPost as sendPost } from '../../functions/api/admin/mail/newsletter/issue/send'
import { onRequestPost as testPost } from '../../functions/api/admin/mail/newsletter/test'
import { onRequestDelete as memberDelete } from '../../functions/api/admin/members/[id]'
import { onRequestGet as preferencesGet } from '../../functions/api/mail/preferences/[token]'
import { onRequestGet as unsubscribeGet } from '../../functions/api/mail/unsubscribe/[token]'
import {
  LOOK_UNKNOWN_WORDS, STOPPED_WORDS, processCampaign, sweepPendingCampaigns, wrapBrandedEmail,
} from '../../functions/utils/admin/campaigns'
import { listMailParts } from '../../functions/utils/mail/footer'
import { linkKeyCheck } from '../../functions/utils/mail/links'
import { createListCampaign, stopListCampaign } from '../../functions/utils/mail/lists'
import { WAIT_FOR_SES_WORDS } from '../../functions/utils/mail/send'
import { resolveSiteUrl } from '../../functions/utils/site'
import type { Env } from '../../functions/types'
import { seedMember } from './factories'
import { emailOutbox, flushWaitUntil, invoke, resetHarness, type SentEmail } from './harness'
import { bindings, countingDb } from './mailRuns'
import { campaignOf, rowsOf, stageCampaign } from './campaignRuns'

const flags = vi.hoisted(() => ({ pageOn: true, sendOn: true, listsOn: true, sender: 'ses', plan: 'free' }))
vi.mock('../../functions/utils/mail/switches', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/mail/switches')>()
  return {
    ...real,
    get MAIL_PAGE_ON() {
      return flags.pageOn
    },
    get MAIL_PAGE_SEND_ON() {
      return flags.sendOn
    },
    get MAIL_LISTS_ON() {
      return flags.listsOn
    },
    get MAIL_SENDER() {
      return flags.sender
    },
    get WORKERS_PLAN() {
      return flags.plan
    },
  }
})

const MONTH = 'December 2026'
const SUBJECT = 'Sample subject one'
const PREHEADER = 'Sample preview line'
const LETTER = '<h2>Sample heading one</h2><p>Example words for a sample letter.</p>'
const NEWSLETTER_FROM = `${LIST_SENDERS[NEWSLETTER_LIST_ID]!.name} <${LIST_SENDERS[NEWSLETTER_LIST_ID]!.from}>`
const key = () => (env as unknown as Env).MAIL_LINK_SECRET as string

let seq = 0
const address = (name: string) => `${name}-${++seq}@page-send-edges.test.lca`
/** An LCA admin on the list, with a made-up name, and the address mail reaches them at. */
async function admin(): Promise<{ id: string; email: string }> {
  const email = address('writer')
  return { id: await seedMember({ email, fullName: 'Player One', role: 'lca_admin' }), email }
}
const readers = async (count: number) => {
  const emails: string[] = []
  for (let i = 0; i < count; i += 1) {
    const email = address('reader')
    await seedMember({ email, fullName: 'Player Two' })
    emails.push(email)
  }
  return emails
}

/** A letter saved and sent from the page, as the page does both; the send's campaign id. */
async function pageSend(as: string): Promise<string> {
  const put = await invoke(issuePut, { method: 'PUT', as, body: { id: null, version: 0, monthLabel: MONTH, subject: SUBJECT, preheader: PREHEADER, bodyHtml: LETTER } })
  expect(put.status).toBe(200)
  const letter = await put.json<{ id: string; version: number }>()
  const res = await invoke(sendPost, { method: 'POST', as, body: { issueId: letter.id, version: letter.version } })
  expect(res.status, JSON.stringify(await res.json())).toBe(201)
  return (await res.json<{ campaignId: string }>()).campaignId
}

/** The page the newsletter's look draws for one row's person: the stored letter with their own footer. */
async function drawnFor(campaignId: string, email: string): Promise<string> {
  const row = (await rowsOf(campaignId)).find((r) => r.email === email)!
  const parts = await listMailParts(bindings, { contactId: row.contact_id!, listId: NEWSLETTER_LIST_ID })
  return renderNewsletter({ siteUrl: resolveSiteUrl(bindings), month: MONTH, subject: SUBJECT, preheader: PREHEADER, bodyHtml: LETTER, footerHtml: parts.footerHtml })
}

async function expectInLook(campaignId: string, sent: SentEmail[]): Promise<void> {
  expect(sent.length).toBeGreaterThan(0)
  for (const message of sent) {
    expect(message.via).toBe('ses')
    expect(message.subject).toBe(SUBJECT)
    expect(message.html, message.to).toBe(await drawnFor(campaignId, message.to))
  }
}

const unwrap: Array<() => void> = []

beforeEach(async () => {
  resetHarness()
  flags.pageOn = true
  flags.sendOn = true
  flags.listsOn = true
  flags.sender = 'ses'
  flags.plan = 'free'
  // The sender's own 400 ms pauses are kept: each case sends a few emails, and the pauses replaced by microtasks ran
  // into themselves here.
  for (const table of ['newsletter_issues', 'email_campaign_recipients', 'email_campaigns', 'mail_list_choices', 'mail_contacts', 'mail_do_not_send']) {
    await env.DB.prepare(`DELETE FROM ${table}`).run()
  }
  // Members an earlier case left behind stay off this case's list.
  await env.DB.prepare(`UPDATE members SET membership_status = 'expired'`).run()
})

afterEach(() => {
  while (unwrap.length > 0) unwrap.pop()!()
  vi.restoreAllMocks()
})

describe('a send from the page, drawn in its look', () => {
  it('draws every email as renderNewsletter does with that person\'s footer, with the two headers, the From line, no test mark, no postal address and links that open', async () => {
    const writer = await admin()
    await readers(3)
    const campaignId = await pageSend(writer.id)
    await flushWaitUntil()
    const sent = emailOutbox.filter((e) => e.tags?.kind === 'optional')
    expect(sent).toHaveLength(4)
    await expectInLook(campaignId, sent)
    for (const message of sent) {
      expect(Object.keys(message.headers!)).toEqual(['List-Unsubscribe', 'List-Unsubscribe-Post'])
      expect(message.from).toBe(NEWSLETTER_FROM)
      expect(message.subject).not.toContain('[TEST]')
      expect(message.html).not.toMatch(/\bP\.?\s?O\.?\s+Box\b|\bSuite\b|\b\d{5}(?:-\d{4})?\b/i)
      const unsubscribe = /\/email\/unsubscribe\/([^"<>\s]+)"/.exec(message.html)?.[1]
      const preferences = /\/email\/preferences\/([^"<>\s]+)"/.exec(message.html)?.[1]
      expect(unsubscribe, message.to).toBeDefined()
      expect(preferences, message.to).toBeDefined()
      expect((await invoke(unsubscribeGet, { params: { token: unsubscribe! }, headers: { Accept: 'application/json' } })).status).toBe(200)
      expect((await invoke(preferencesGet, { params: { token: preferences! }, headers: { Accept: 'application/json' } })).status).toBe(200)
    }
  })

  it('draws the same page for "Send a test to me" as the send draws for the same person, byte for byte', async () => {
    const writer = await admin()
    const campaignId = await pageSend(writer.id)
    await flushWaitUntil()
    const drained = emailOutbox.find((e) => e.to === writer.email && e.tags?.kind === 'optional')!
    expect(drained.html).toBe(await drawnFor(campaignId, writer.email))
    // A letter of its own, so the test reads an open one; its words are the sent letter's.
    const put = await invoke(issuePut, { method: 'PUT', as: writer.id, body: { id: null, version: 0, monthLabel: MONTH, subject: SUBJECT, preheader: PREHEADER, bodyHtml: LETTER } })
    const letter = await put.json<{ id: string; version: number }>()
    const before = emailOutbox.length
    const test = await invoke(testPost, { method: 'POST', as: writer.id, body: { issueId: letter.id, version: letter.version } })
    expect(test.status, JSON.stringify(await test.json())).toBe(200)
    const tried = emailOutbox.slice(before)
    expect(tried).toHaveLength(1)
    expect(tried[0]!.subject).toBe(`[TEST] ${SUBJECT}`)
    expect(tried[0]!.html).toBe(drained.html)
  })
})

// Several cases here send more than one batch through the engine's real pause between batches.
describe('the rest of a send from the page', { timeout: 60_000 }, () => {
  it('waits on Resend with WAIT_FOR_SES_WORDS, which the tab shows, then the sweep sends the rest in the same look with no request open', async () => {
    const writer = await admin()
    await readers(13)
    const campaignId = await pageSend(writer.id)
    await flushWaitUntil()
    const firstBatch = emailOutbox.length
    expect(firstBatch).toBe(10)
    flags.sender = 'resend'
    await sweepPendingCampaigns(bindings)
    expect(emailOutbox.length).toBe(firstBatch)
    expect((await rowsOf(campaignId)).filter((r) => r.status === 'pending').map((r) => r.error)).toContain(WAIT_FOR_SES_WORDS)
    const tab = await invoke(newsletterGet, { as: writer.id })
    expect(tab.status).toBe(200)
    expect((await tab.json<{ summary: { waits: string | null } }>()).summary.waits).toBe(WAIT_FOR_SES_WORDS)
    flags.sender = 'ses'
    for (let run = 0; run < 5 && (await campaignOf(campaignId))!.status === 'sending'; run += 1) await sweepPendingCampaigns(bindings)
    expect(emailOutbox).toHaveLength(14)
    await expectInLook(campaignId, emailOutbox.slice(firstBatch))
    expect(new Set(emailOutbox.map((e) => e.to)).size).toBe(14)
  })

  it('fails the untried rows with STOPPED_WORDS once the send is stopped', async () => {
    const writer = await admin()
    await readers(13)
    const campaignId = await pageSend(writer.id)
    await flushWaitUntil()
    expect(emailOutbox).toHaveLength(10)
    await stopListCampaign(env.DB, NEWSLETTER_LIST_ID)
    await sweepPendingCampaigns(bindings)
    expect(emailOutbox).toHaveLength(10)
    const untried = (await rowsOf(campaignId)).filter((r) => r.status !== 'sent')
    expect(untried).toHaveLength(4)
    expect(untried.every((r) => r.status === 'failed' && r.error === STOPPED_WORDS)).toBe(true)
  })

  it('changes no email when the letter row is changed by hand after the send', async () => {
    const writer = await admin()
    await readers(13)
    const campaignId = await pageSend(writer.id)
    await flushWaitUntil()
    await env.DB.prepare(`UPDATE newsletter_issues SET subject = 'Sample subject two', body_html = '<p>Example words changed.</p>', preheader = 'Changed line', month_label = 'January 2027'`).run()
    for (let run = 0; run < 5 && (await campaignOf(campaignId))!.status === 'sending'; run += 1) await sweepPendingCampaigns(bindings)
    expect(emailOutbox).toHaveLength(14)
    await expectInLook(campaignId, emailOutbox)
  })

  it('drops a member deleted mid-send, as the tab\'s send does', async () => {
    const writer = await admin()
    await readers(13)
    const campaignId = await pageSend(writer.id)
    await flushWaitUntil()
    const leaving = (await rowsOf(campaignId)).find((r) => r.status === 'pending')!.email
    const leavingId = (await env.DB.prepare('SELECT id FROM members WHERE email = ?').bind(leaving).first<{ id: string }>())!.id
    expect((await invoke(memberDelete, { method: 'DELETE', as: writer.id, params: { id: leavingId } })).status).toBe(200)
    for (let run = 0; run < 5 && (await campaignOf(campaignId))!.status === 'sending'; run += 1) await sweepPendingCampaigns(bindings)
    expect(emailOutbox.map((e) => e.to)).not.toContain(leaving)
    expect(emailOutbox).toHaveLength(13)
    expect(await campaignOf(campaignId)).toMatchObject({ status: 'completed', skipped_count: 1 })
  })

  it('stops a send in a look this deployment cannot draw with LOOK_UNKNOWN_WORDS on the next row, sending and claiming nothing', async () => {
    const filterJson = JSON.stringify({ list: NEWSLETTER_LIST_ID, linkCheck: await linkKeyCheck(key()), look: 'x' })
    const campaignId = await stageCampaign({ listId: NEWSLETTER_LIST_ID, filterJson, recipients: [{ email: address('reader') }, { email: address('reader') }] })
    await processCampaign(bindings, campaignId)
    const rows = await rowsOf(campaignId)
    expect(rows[0]!.error).toBe(LOOK_UNKNOWN_WORDS)
    expect(rows.every((r) => r.status === 'pending' && r.claimed_at === null && r.sending_at === null && r.attempts === 0)).toBe(true)
    expect(emailOutbox).toEqual([])
  })
})

describe('the tab\'s plain send, as before', () => {
  it('is wrapBrandedEmail with the footer, and its batch is four statements naming no letter', async () => {
    const writer = await admin()
    await readers(2)
    const body = { subject: SUBJECT, bodyHtml: LETTER }
    const res = await invoke(newsletterPost, { method: 'POST', as: writer.id, body })
    expect(res.status).toBe(201)
    const { campaignId } = await res.json<{ campaignId: string }>()
    await flushWaitUntil()
    expect(emailOutbox).toHaveLength(3)
    for (const message of emailOutbox) {
      const row = (await rowsOf(campaignId)).find((r) => r.email === message.to)!
      const parts = await listMailParts(bindings, { contactId: row.contact_id!, listId: NEWSLETTER_LIST_ID })
      expect(message.html).toBe(wrapBrandedEmail(bindings, SUBJECT, LETTER, parts.footerHtml))
    }
    await env.DB.prepare(`UPDATE email_campaigns SET status = 'completed'`).run()
    const counting = countingDb()
    const prepared: string[] = []
    const realPrepare = counting.db.prepare.bind(counting.db)
    counting.db.prepare = ((sql: string) => {
      prepared.push(sql)
      return realPrepare(sql)
    }) as typeof counting.db.prepare
    expect(await createListCampaign(counting.db, { listId: NEWSLETTER_LIST_ID, ...body, createdBy: writer.id, linkCheck: await linkKeyCheck(key()) })).not.toBeNull()
    expect(counting.ran.filter((r) => r.sql === 'batch')).toEqual([{ sql: 'batch', binds: 4 }])
    expect(prepared.filter((sql) => sql.includes('newsletter_issues'))).toEqual([])
  })
})
