// test/integration/newsletter-page-send-tester.test.ts
//
// The edges of the real Send on the newsletter's own page, POST
// /api/admin/mail/newsletter/issue/send, through the real handler, guard and
// batch, on the D1 database built from the migrations, with the switches read
// through getters as test/integration/newsletter-page-send.test.ts reads them.
// Nothing here reaches an outside service.
//
// - The count the question shows (the tab's GET, read as the page reads it)
//   against the count the send makes when a member joins or leaves the list
//   between the read and the press: the send counts the list as it is at the
//   press, and the 201 says so.
// - A letter row that is a saved template, or a letter set aside: refused, with
//   nothing written and nothing sent.
// - Two people pressing Send in the same moment: one send, one 409. A second
//   person's Stop ends the send for the sender's page too.
// - A letter another person replaced with a fresh one, or sent, a moment
//   before: SEND_CHANGED's 409, nothing written.
// - A subject of spaces alone: SEND_NO_SUBJECT, nothing written.
// - A letter at the size limit: the longest the measure takes is sent, and
//   one character more is refused as one over.
// - The rest of a send, once the page has moved on to a fresh letter: the
//   sweep, with no request open, draws it in the navy look with the sent
//   letter's words.
// - The tab's own plain send with a letter open on the page: drawn plain,
//   with no look, and the open letter as it was.
// - The server's own 201, 409s and 413 in the shapes the contract gives the
//   page's call.
// Every name, address and word here is made up.
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SEND_CHANGED } from '../../domain/mail/newsletterWords'
import { onRequestGet as newsletterGet, onRequestPost as newsletterPost } from '../../functions/api/admin/mail/newsletter'
import { onRequestPut as issuePut } from '../../functions/api/admin/mail/newsletter/issue'
import { onRequestPost as sendPost } from '../../functions/api/admin/mail/newsletter/issue/send'
import { onRequestPost as startPost } from '../../functions/api/admin/mail/newsletter/issue/start'
import { onRequestPost as stopPost } from '../../functions/api/admin/mail/newsletter/stop'
import { NEWSLETTER_LIST_ID } from '../../domain/mail/lists'
import { EMAIL_MAX_BYTES, renderNewsletter } from '../../domain/mail/newsletterLayout'
import { sweepPendingCampaigns, wrapBrandedEmail } from '../../functions/utils/admin/campaigns'
import { listMailParts } from '../../functions/utils/mail/footer'
import { resolveSiteUrl } from '../../functions/utils/site'
import { campaignOf, rowsOf } from './campaignRuns'
import { bindings } from './mailRuns'
import { ALREADY_SENDING, SEND_NO_SUBJECT, sendTooLong } from '../../functions/utils/mail/newsletterAnswers'
import { errorBodySchema } from '../../domain/contracts/common'
import { newsletterIssueRefusedSchema } from '../../domain/contracts/newsletter'
import { contracts } from '../../domain/contracts/registry'
import { seedAdmin, seedMember } from './factories'
import { emailOutbox, flushWaitUntil, invoke, resetHarness } from './harness'

const flags = vi.hoisted(() => ({ pageOn: true, sendOn: true, listsOn: true, sender: 'ses', plan: 'free', complaintStops: true }))
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
    get COMPLAINT_STOPS_OTHER_SENDERS() {
      return flags.complaintStops
    },
  }
})

type Row = Record<string, unknown>

const MONTH = 'December 2026'
const LETTER = '<h2>Sample heading one</h2><p>Example words for a sample letter.</p>'

let seq = 0
const address = (name: string) => `${name}-${++seq}@page-send-tester.test.lca`

async function saved(as: string): Promise<{ id: string; version: number }> {
  const body = { id: null, version: 0, monthLabel: MONTH, subject: 'Sample subject one', preheader: 'Sample preview line', bodyHtml: LETTER }
  const res = await invoke(issuePut, { method: 'PUT', as, body })
  expect(res.status, JSON.stringify(await res.json())).toBe(200)
  const answer = await res.json<{ id: string; version: number }>()
  return { id: answer.id, version: answer.version }
}

const sendOf = (as: string, letter: { id: string; version: number }) => invoke(sendPost, { method: 'POST', as, body: { issueId: letter.id, version: letter.version } })

async function willGet(as: string): Promise<number> {
  const res = await invoke(newsletterGet, { method: 'GET', as })
  expect(res.status).toBe(200)
  return (await res.json<{ summary: { willGet: number } }>()).summary.willGet
}

async function tables() {
  const all = async (sql: string) => JSON.stringify((await env.DB.prepare(sql).all<Row>()).results)
  return {
    letters: await all('SELECT * FROM newsletter_issues ORDER BY rowid'),
    campaigns: await all('SELECT * FROM email_campaigns ORDER BY rowid'),
    recipients: await all('SELECT * FROM email_campaign_recipients ORDER BY rowid'),
    contacts: await all('SELECT * FROM mail_contacts ORDER BY rowid'),
    audit: await all('SELECT * FROM admin_audit_log ORDER BY rowid'),
    sent: emailOutbox.length,
  }
}

beforeEach(async () => {
  resetHarness()
  Object.assign(flags, { pageOn: true, sendOn: true, listsOn: true, sender: 'ses', plan: 'free', complaintStops: true })
  for (const table of ['newsletter_issues', 'email_campaign_recipients', 'email_campaigns', 'mail_list_choices', 'mail_contacts', 'mail_do_not_send']) {
    await env.DB.prepare(`DELETE FROM ${table}`).run()
  }
})

describe('the count read for the question, and the count the send makes', () => {
  it('counts a member who joins the list between the read and the press, and the 201 says the new number', async () => {
    const admin = await seedAdmin()
    await seedMember({ fullName: 'Player Eight', email: address('reader') })
    const letter = await saved(admin)
    const asked = await willGet(admin)
    await seedMember({ fullName: 'Player Nine', email: address('joiner') })
    const res = await sendOf(admin, letter)
    expect(res.status, JSON.stringify(await res.json())).toBe(201)
    const { campaignId, totalRecipients } = await res.json<{ campaignId: string; totalRecipients: number }>()
    expect(totalRecipients).toBe(asked + 1)
    const campaign = (await env.DB.prepare('SELECT total_recipients FROM email_campaigns WHERE id = ?').bind(campaignId).first<Row>())!
    expect(campaign.total_recipients).toBe(totalRecipients)
  })

  it('leaves out a member who leaves the list between the read and the press, and the 201 says the new number', async () => {
    const admin = await seedAdmin()
    await seedMember({ fullName: 'Player Eight', email: address('reader') })
    const leaver = await seedMember({ fullName: 'Player Ten', email: address('leaver') })
    const letter = await saved(admin)
    const asked = await willGet(admin)
    await env.DB.prepare(`UPDATE members SET membership_status = 'expired' WHERE id = ?`).bind(leaver).run()
    const res = await sendOf(admin, letter)
    expect(res.status, JSON.stringify(await res.json())).toBe(201)
    const { totalRecipients } = await res.json<{ totalRecipients: number }>()
    expect(totalRecipients).toBe(asked - 1)
    expect(await willGet(admin)).toBe(totalRecipients)
  })
})

describe('a row that is not an open letter', () => {
  it.each([
    ['a saved template', `UPDATE newsletter_issues SET pinned_name = 'Sample template', set_aside_at = datetime('now') WHERE id = ?`],
    ['a letter set aside', `UPDATE newsletter_issues SET set_aside_at = datetime('now') WHERE id = ?`],
  ])('refuses %s with the 409 of a letter set aside, writing and sending nothing', async (_name, sql) => {
    const admin = await seedAdmin()
    await seedMember({ fullName: 'Player Eleven', email: address('reader') })
    const letter = await saved(admin)
    await env.DB.prepare(sql).bind(letter.id).run()
    const before = await tables()
    const res = await sendOf(admin, letter)
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ reason: 'set_aside' })
    expect(await tables()).toEqual(before)
  })
})

describe('two people at once', () => {
  it('makes one send when two people press Send in the same moment in two pages, and the other hears a clear 409', async () => {
    const first = await seedAdmin()
    const second = await seedAdmin()
    await seedMember({ fullName: 'Player Thirteen', email: address('reader') })
    const letter = await saved(first)
    const [one, two] = await Promise.all([sendOf(first, letter), sendOf(second, letter)])
    const statuses = [one.status, two.status].sort()
    expect(statuses).toEqual([201, 409])
    const loser = (one.status === 409 ? one : two)
    const words = await loser.json<{ error: string }>()
    expect(typeof words.error).toBe('string')
    expect(words.error.length).toBeGreaterThan(0)
    const campaigns = (await env.DB.prepare('SELECT COUNT(*) AS n FROM email_campaigns').first<{ n: number }>())!.n
    expect(campaigns).toBe(1)
    const marked = (await env.DB.prepare('SELECT COUNT(*) AS n FROM newsletter_issues WHERE campaign_id IS NOT NULL').first<{ n: number }>())!.n
    expect(marked).toBe(1)
  })

  it('lets a second person stop the send, and the sender\'s page then reads no send as sending', async () => {
    const sender = await seedAdmin()
    const other = await seedAdmin()
    for (let i = 0; i < 3; i++) await seedMember({ fullName: 'Player Fourteen', email: address('reader') })
    const letter = await saved(sender)
    const res = await sendOf(sender, letter)
    expect(res.status).toBe(201)
    const { campaignId } = await res.json<{ campaignId: string }>()
    const stop = await invoke(stopPost, { method: 'POST', as: other })
    expect(stop.status, JSON.stringify(await stop.json())).toBe(200)
    await flushWaitUntil()
    const seen = await invoke(newsletterGet, { method: 'GET', as: sender })
    const { summary } = await seen.json<{ summary: { recent: Array<{ id: string; status: string }> } }>()
    expect(summary.recent.filter((row) => row.status === 'sending')).toEqual([])
    const campaign = (await env.DB.prepare('SELECT status FROM email_campaigns WHERE id = ?').bind(campaignId).first<Row>())!
    expect(campaign.status).not.toBe('sending')
    const again = await invoke(stopPost, { method: 'POST', as: sender })
    expect(again.status).toBe(409)
  })
})

describe('a letter another person moved on a moment before', () => {
  it('refuses a send of a letter another person replaced with a fresh one, writing and sending nothing', async () => {
    const writer = await seedAdmin()
    const other = await seedAdmin()
    await seedMember({ fullName: 'Player Fifteen', email: address('reader') })
    const letter = await saved(writer)
    const started = await invoke(startPost, { method: 'POST', as: other, body: { from: 'monthly', monthLabel: MONTH } })
    expect(started.status, JSON.stringify(await started.json())).toBe(201)
    const before = await tables()
    const res = await sendOf(writer, letter)
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ error: SEND_CHANGED, reason: 'set_aside' })
    expect(await tables()).toEqual(before)
  })

  it('refuses a send of a letter another person sent a moment before as sent, naming the sender', async () => {
    const writer = await seedAdmin()
    const other = await seedAdmin()
    await seedMember({ fullName: 'Player Sixteen', email: address('reader') })
    const letter = await saved(writer)
    expect((await sendOf(other, letter)).status).toBe(201)
    await flushWaitUntil()
    const before = await tables()
    const res = await sendOf(writer, letter)
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ reason: 'sent' })
    expect(await tables()).toEqual(before)
  }, 30_000)
})

describe('a letter at the size limit', () => {
  // With nobody on the list the handler answers 413 for a letter too long and
  // NOBODY_ON_THE_LIST's 400 for any other, writing nothing either way, so the
  // longest letter it takes is found by its own measure before anyone joins.
  it('sends the longest letter the measure takes, and refuses one more character with the words of one over', async () => {
    const admin = await seedAdmin()
    const letter = await saved(admin)
    await env.DB.prepare(`UPDATE members SET membership_status = 'expired'`).run()
    const bodyOf = (n: number) => `<p>${'a'.repeat(n)}</p>`
    const tooLong = async (n: number) => {
      await env.DB.prepare('UPDATE newsletter_issues SET body_html = ? WHERE id = ?').bind(bodyOf(n), letter.id).run()
      const res = await sendOf(admin, letter)
      expect([400, 413]).toContain(res.status)
      return res.status === 413
    }
    let low = 0
    let high = EMAIL_MAX_BYTES
    expect(await tooLong(low)).toBe(false)
    expect(await tooLong(high)).toBe(true)
    while (high - low > 1) {
      const mid = Math.floor((low + high) / 2)
      if (await tooLong(mid)) high = mid
      else low = mid
    }
    await env.DB.prepare('UPDATE newsletter_issues SET body_html = ? WHERE id = ?').bind(bodyOf(high), letter.id).run()
    const over = await sendOf(admin, letter)
    expect(over.status).toBe(413)
    expect(await over.json()).toEqual({ error: sendTooLong(1) })

    await seedMember({ fullName: 'Player Seventeen', email: address('reader') })
    await env.DB.prepare('UPDATE newsletter_issues SET body_html = ? WHERE id = ?').bind(bodyOf(low), letter.id).run()
    const before = await tables()
    expect(JSON.parse(before.campaigns)).toEqual([])
    const res = await sendOf(admin, letter)
    expect(res.status, JSON.stringify(await res.json())).toBe(201)
    const campaign = (await env.DB.prepare('SELECT body_html FROM email_campaigns').first<Row>())!
    expect(campaign.body_html).toBe(bodyOf(low))
  })
})

describe('the rest of a send after the page has moved on', () => {
  it('is sent by the sweep in the navy look with the sent letter\'s own words, not the words of the letter written next', async () => {
    await env.DB.prepare(`UPDATE members SET membership_status = 'expired'`).run()
    const writer = await seedAdmin()
    for (let i = 0; i < 13; i++) await seedMember({ fullName: 'Player Eighteen', email: address('reader') })
    const letter = await saved(writer)
    const res = await sendOf(writer, letter)
    expect(res.status, JSON.stringify(await res.json())).toBe(201)
    const { campaignId, totalRecipients } = await res.json<{ campaignId: string; totalRecipients: number }>()
    await flushWaitUntil()
    const firstBatch = emailOutbox.length
    expect(firstBatch).toBeLessThan(totalRecipients)
    // The page moves on to a fresh letter, and new words are saved in it.
    const next = await invoke(issuePut, { method: 'PUT', as: writer, body: { id: null, version: 0, monthLabel: 'January 2027', subject: 'Sample subject two', preheader: '', bodyHtml: '<p>Example words written next.</p>' } })
    expect(next.status, JSON.stringify(await next.json())).toBe(200)
    for (let run = 0; run < 5 && (await campaignOf(campaignId))!.status === 'sending'; run += 1) await sweepPendingCampaigns(bindings)
    expect((await campaignOf(campaignId))!.status).not.toBe('sending')
    const swept = emailOutbox.slice(firstBatch)
    expect(firstBatch + swept.length).toBe(totalRecipients)
    const rows = await rowsOf(campaignId)
    for (const message of swept) {
      const row = rows.find((r) => r.email === message.to)!
      const parts = await listMailParts(bindings, { contactId: row.contact_id!, listId: NEWSLETTER_LIST_ID })
      const drawn = renderNewsletter({ siteUrl: resolveSiteUrl(bindings), month: MONTH, subject: 'Sample subject one', preheader: 'Sample preview line', bodyHtml: LETTER, footerHtml: parts.footerHtml })
      expect(message.subject).toBe('Sample subject one')
      expect(message.html, message.to).toBe(drawn)
      expect(message.html).not.toContain('Example words written next.')
    }
  }, 30_000)
})

describe("the tab's own plain send, with a letter open on the page", () => {
  it('is drawn plain as before, carries no look, and leaves the open letter as it was', async () => {
    await env.DB.prepare(`UPDATE members SET membership_status = 'expired'`).run()
    const writer = await seedAdmin()
    for (let i = 0; i < 2; i++) await seedMember({ fullName: 'Player Nineteen', email: address('reader') })
    await saved(writer)
    const letters = (await tables()).letters
    const body = { subject: 'Sample subject three', bodyHtml: '<p>Example words from the tab.</p>' }
    const res = await invoke(newsletterPost, { method: 'POST', as: writer, body })
    expect(res.status, JSON.stringify(await res.json())).toBe(201)
    const { campaignId } = await res.json<{ campaignId: string }>()
    await flushWaitUntil()
    expect(emailOutbox.length).toBeGreaterThan(0)
    const rows = await rowsOf(campaignId)
    for (const message of emailOutbox) {
      const row = rows.find((r) => r.email === message.to)!
      const parts = await listMailParts(bindings, { contactId: row.contact_id!, listId: NEWSLETTER_LIST_ID })
      expect(message.html, message.to).toBe(wrapBrandedEmail(bindings, body.subject, body.bodyHtml, parts.footerHtml))
    }
    const campaign = (await env.DB.prepare('SELECT filter_json FROM email_campaigns WHERE id = ?').bind(campaignId).first<Row>())!
    expect(JSON.parse(String(campaign.filter_json))).not.toHaveProperty('look')
    expect((await tables()).letters).toBe(letters)
  })
})

describe("the server's answers against the contract the page's call reads", () => {
  it('answers a 201, a 409 for another send on its way, a 409 for a letter sent and a 413 in the contract\'s shapes', async () => {
    const contract = contracts['admin/mail/newsletter/issue/send'].POST
    const admin = await seedAdmin()
    await seedMember({ fullName: 'Player Twenty', email: address('reader') })
    const letter = await saved(admin)
    const made = await sendOf(admin, letter)
    expect(made.status).toBe(201)
    expect(contract.response.safeParse(await made.json()).success).toBe(true)
    const again = await sendOf(admin, letter)
    expect(again.status).toBe(409)
    expect(newsletterIssueRefusedSchema.parse(await again.json())).toMatchObject({ reason: 'sent' })
    const other = await saved(admin)
    const busy = await sendOf(admin, other)
    expect(busy.status).toBe(409)
    expect(errorBodySchema.parse(await busy.json())).toEqual({ error: ALREADY_SENDING })
    await flushWaitUntil()
    await env.DB.prepare(`UPDATE email_campaigns SET status = 'completed'`).run()
    await env.DB.prepare('UPDATE newsletter_issues SET body_html = ? WHERE id = ?').bind(`<p>${'a'.repeat(EMAIL_MAX_BYTES)}</p>`, other.id).run()
    const long = await sendOf(admin, other)
    expect(long.status).toBe(413)
    expect(errorBodySchema.safeParse(await long.json()).success).toBe(true)
  })
})

describe('a subject of spaces alone', () => {
  it('is no subject: SEND_NO_SUBJECT, with every table as before', async () => {
    const admin = await seedAdmin()
    await seedMember({ fullName: 'Player Twelve', email: address('reader') })
    const letter = await saved(admin)
    await env.DB.prepare('UPDATE newsletter_issues SET subject = ? WHERE id = ?').bind('     ', letter.id).run()
    const before = await tables()
    const res = await sendOf(admin, letter)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: SEND_NO_SUBJECT })
    expect(await tables()).toEqual(before)
  })
})
