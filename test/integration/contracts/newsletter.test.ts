// test/integration/contracts/newsletter.test.ts
//
// The LCA newsletter's four admin methods (WS16 step 4), each to its
// contracts in domain/contracts/mail.ts, on the database every integration
// test runs on:
// - GET /api/admin/mail/newsletter, the list, its From line, the service
//   that sends now and the summary with its recent sends, and since WS16
//   step 5 why the newsletter that is sending waits;
// - POST /api/admin/mail/newsletter, the send, its body read through its
//   request contract, and its 201;
// - POST /api/admin/mail/newsletter/test, the test send;
// - POST /api/admin/mail/newsletter/stop, the stop.
// Every refusal answers the shared error bodies. MAIL_LISTS_ON and
// MAIL_SENDER are read through getters on the mocked switches module, set
// before every case, with the module's other constants set beside it. The
// send's 201 needs a sender other than Resend, so that one case reads the
// sender as Amazon SES's, which has no transport until WS16 step 7: the
// answer is the endpoint's own, and the send behind it reaches no service.
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { contracts, errorBodySchema, fieldErrorBodySchema } from '../../../domain/contracts'
import { NEWSLETTER_LIST_ID } from '../../../domain/mail/lists'
import { onRequestGet as newsletterGet, onRequestPost as newsletterPost } from '../../../functions/api/admin/mail/newsletter'
import { onRequestPost as stopPost } from '../../../functions/api/admin/mail/newsletter/stop'
import { onRequestPost as testPost } from '../../../functions/api/admin/mail/newsletter/test'
import { linkKeyCheck } from '../../../functions/utils/mail/links'
import { createListCampaign } from '../../../functions/utils/mail/lists'
import type { Env } from '../../../functions/types'
import { seedAdmin, seedMember } from '../factories'
import { expectContract, flushWaitUntil, invoke, resetHarness } from '../harness'

const flags = vi.hoisted(() => ({ listsOn: true, sender: 'resend', plan: 'free', complaintStops: true }))
vi.mock('../../../functions/utils/mail/switches', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../functions/utils/mail/switches')>()
  return {
    ...real,
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

const summary = contracts['admin/mail/newsletter'].GET
const send = contracts['admin/mail/newsletter'].POST
const test = contracts['admin/mail/newsletter/test'].POST
const stop = contracts['admin/mail/newsletter/stop'].POST

const SAMPLE = { subject: 'Sample newsletter one', bodyHtml: '<p>Example words for a sample newsletter.</p>' }
const key = () => (env as unknown as Env).MAIL_LINK_SECRET as string

beforeEach(async () => {
  resetHarness()
  flags.listsOn = true
  flags.sender = 'resend'
  flags.plan = 'free'
  flags.complaintStops = true
  for (const table of ['email_campaign_recipients', 'email_campaigns', 'mail_list_choices', 'mail_contacts', 'mail_do_not_send']) {
    await env.DB.prepare(`DELETE FROM ${table}`).run()
  }
})

describe('GET /api/admin/mail/newsletter', () => {
  it('answers to its contract, with a recent send among the summary\'s', async () => {
    const admin = await seedAdmin()
    await seedMember({ email: 'contract.reader@newsletter.test.lca', fullName: 'Player One' })
    const made = await createListCampaign(env.DB, { listId: NEWSLETTER_LIST_ID, ...SAMPLE, createdBy: admin, linkCheck: await linkKeyCheck(key()) })
    const res = await invoke(newsletterGet, { as: admin })
    expect(res.status).toBe(200)
    const body = await expectContract(res, summary.response)
    expect(body.list).toEqual({ id: NEWSLETTER_LIST_ID, name: 'LCA newsletter' })
    expect(body.from).toBe('Louisiana Chess Association <newsletter@news.louisianachess.org>')
    expect(body.sendsThrough).toBe('resend')
    expect(body.summary.recent[0]).toMatchObject({ id: made!.campaignId, subject: SAMPLE.subject, status: 'sending', skippedCount: 0, completedAt: null })
    expect(body.summary.waits).toBeNull()
  })

  it('answers to its contract with the words a sending newsletter waits for, as a string (WS16 step 5)', async () => {
    const admin = await seedAdmin()
    await seedMember({ email: 'contract.reader@newsletter.test.lca', fullName: 'Player One' })
    const made = await createListCampaign(env.DB, { listId: NEWSLETTER_LIST_ID, ...SAMPLE, createdBy: admin, linkCheck: await linkKeyCheck(key()) })
    const words = 'Not sent yet: list mail goes out through Amazon SES only.'
    await env.DB.prepare('UPDATE email_campaign_recipients SET error = ? WHERE campaign_id = ?').bind(words, made!.campaignId).run()
    const res = await invoke(newsletterGet, { as: admin })
    const body = await expectContract(res, summary.response)
    expect(body.summary.waits).toBe(words)
    expect(summary.response.safeParse({ ...body, summary: { ...body.summary, waits: 3 } }).success).toBe(false)
  })

  it('answers 404 with the error body while MAIL_LISTS_ON is unset', async () => {
    flags.listsOn = false
    const res = await invoke(newsletterGet, { as: await seedAdmin() })
    expect(res.status).toBe(404)
    expect(await expectContract(res, errorBodySchema)).toEqual({ error: 'Not found' })
  })
})

describe('POST /api/admin/mail/newsletter', () => {
  it('takes a body its request contract accepts, a key beside the two passing through, and answers its 201 to its contract', async () => {
    flags.sender = 'ses'
    const admin = await seedAdmin()
    await seedMember({ email: 'contract.reader@newsletter.test.lca', fullName: 'Player One' })
    const body = { ...SAMPLE, from: 'the page' }
    expect(send.request.safeParse(body).success).toBe(true)
    const res = await invoke(newsletterPost, { as: admin, method: 'POST', body })
    expect(res.status).toBe(201)
    const made = await expectContract(res, send.response)
    expect(made.status).toBe('sending')
    expect(made.totalRecipients).toBeGreaterThan(0)
    await flushWaitUntil()
  })

  it('answers the wait for Amazon SES with the error body, and a body that is not valid with the field errors', async () => {
    const admin = await seedAdmin()
    const waits = await invoke(newsletterPost, { as: admin, method: 'POST', body: SAMPLE })
    expect(waits.status).toBe(409)
    await expectContract(waits, errorBodySchema)
    const invalid = { subject: SAMPLE.subject, bodyHtml: '' }
    expect(send.request.safeParse(invalid).success).toBe(false)
    const res = await invoke(newsletterPost, { as: admin, method: 'POST', body: invalid })
    expect(res.status).toBe(400)
    expect(Object.keys((await expectContract(res, fieldErrorBodySchema)).fields)).toEqual(['bodyHtml'])
  })
})

describe('POST /api/admin/mail/newsletter/test', () => {
  it('takes a body its request contract accepts and answers to its contract', async () => {
    const body = { to: 'contract.tester@newsletter.test.lca', ...SAMPLE, from: 'the page' }
    expect(test.request.safeParse(body).success).toBe(true)
    const res = await invoke(testPost, { as: await seedAdmin(), method: 'POST', body })
    expect(res.status).toBe(200)
    expect(await expectContract(res, test.response)).toEqual({ sent: true })
  })

  it('answers an address that is not one with the field errors, and a test the gate refuses with the error body', async () => {
    const admin = await seedAdmin()
    const invalid = { to: 'not an address', ...SAMPLE }
    expect(test.request.safeParse(invalid).success).toBe(false)
    const res = await invoke(testPost, { as: admin, method: 'POST', body: invalid })
    expect(res.status).toBe(400)
    expect(Object.keys((await expectContract(res, fieldErrorBodySchema)).fields)).toEqual(['to'])
    const refused = await invoke(testPost, { as: admin, method: 'POST', body: { to: 'sample.reader@example.org', ...SAMPLE } })
    expect(refused.status).toBe(502)
    expect(await expectContract(refused, errorBodySchema)).toEqual({ error: 'Failed to send test email: Not sent: not a real address.' })
  })
})

describe('POST /api/admin/mail/newsletter/stop', () => {
  it('answers to its contract', async () => {
    const admin = await seedAdmin()
    await seedMember({ email: 'contract.reader@newsletter.test.lca', fullName: 'Player One' })
    const made = await createListCampaign(env.DB, { listId: NEWSLETTER_LIST_ID, ...SAMPLE, createdBy: admin, linkCheck: await linkKeyCheck(key()) })
    const res = await invoke(stopPost, { as: admin, method: 'POST' })
    expect(res.status).toBe(200)
    expect(await expectContract(res, stop.response)).toEqual({ stopped: made!.totalRecipients })
  })

  it('answers no newsletter sending with the error body', async () => {
    const res = await invoke(stopPost, { as: await seedAdmin(), method: 'POST' })
    expect(res.status).toBe(409)
    expect(await expectContract(res, errorBodySchema)).toEqual({ error: 'No newsletter is sending.' })
  })
})
