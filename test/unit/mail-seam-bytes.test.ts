// test/unit/mail-seam-bytes.test.ts
//
// The move of the site's two Resend calls behind the seam, deliver() in
// functions/utils/mail/send.ts, changed nothing that is sent (WS16 step 1).
// fetch is stubbed with a recorder, so no request leaves this file, and
// every request is compared, as its address, method, headers and body,
// with literal strings written from the code as it was before the move:
// sendEmail's request in functions/utils/email.ts (the 'single' shape) and
// Group email's in functions/utils/admin/campaigns.ts (the 'campaign'
// shape: to as a bare string, reply_to first, no text part, and the
// Authorization header first), key order included. The failures keep
// their words: sendEmail's throw, the campaign path's error and whether
// it is tried again, and the message a thrown fetch carries to
// trySendEmail's log line.
//
// The suite is pinned to the rules off, whatever the shipped constants
// say: functions/utils/mail/switches is mocked over the real module with
// MAIL_LISTS_ON false and MAIL_SENDER 'resend', read through getters, so
// the change that switches the newsletter on and the cutover to Amazon SES
// leave it green. A change that moves one byte of event mail or of Group
// email turns it red.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { processCampaign, sendTestEmail, wrapBrandedEmail, type CampaignEnv } from '../../functions/utils/admin/campaigns'
import { sendEmail, trySendEmail, type EmailEnv } from '../../functions/utils/email'
import { SENDER_NAME, deliver } from '../../functions/utils/mail/send'

const flags = vi.hoisted(() => ({ listsOn: false, sender: 'resend' }))
vi.mock('../../functions/utils/mail/switches', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/mail/switches')>()
  return {
    ...real,
    get MAIL_LISTS_ON() {
      return flags.listsOn
    },
    get MAIL_SENDER() {
      return flags.sender
    },
  }
})

/** A request as the recorder keeps it: its headers and body as the bytes the code handed fetch. */
interface Recorded { url: string; method: string; headers: string; body: string }

let recorded: Recorded[]
/** How the stand-in for Resend answers: a status and its body, or 'throw' for a request that never gets an answer. */
let answer: { status: number; body: string } | 'throw'

beforeEach(() => {
  flags.listsOn = false
  flags.sender = 'resend'
  recorded = []
  answer = { status: 200, body: '{"id":"4ef9a417-02e9-4d39-ad75-9611e0fcc33c"}' }
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    recorded.push({ url: String(input), method: String(init?.method), headers: JSON.stringify(init?.headers), body: String(init?.body) })
    if (answer === 'throw') throw new TypeError('fetch failed')
    return new Response(answer.body, { status: answer.status })
  }))
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const KEY = 're_test_seam_key'
const ENV: EmailEnv = { RESEND_API_KEY: KEY }
const URL_ = 'https://api.resend.com/emails'
/** sendEmail's headers, Content-Type first. */
const SINGLE_HEADERS = `{"Content-Type":"application/json","Authorization":"Bearer ${KEY}"}`
/** Group email's headers, Authorization first. */
const CAMPAIGN_HEADERS = `{"Authorization":"Bearer ${KEY}","Content-Type":"application/json"}`

/** A message with what JSON escapes in it: quotes, a half point, an ampersand, a new line. */
const MESSAGE = {
  to: 'pat.member@example.org',
  subject: 'You\'re registered: Fall "Open", 3½ points to win',
  html: '<p class="lead">Hi Pat &amp; family,</p>',
  text: 'Hi Pat,\nSee you on Sat, Oct 24 at 9:00 AM.',
}

describe('sendEmail through the seam: the single shape, byte for byte', () => {
  it('(a) with a text part: one request, its headers and its body as before, text last', async () => {
    await sendEmail(ENV, MESSAGE)
    expect(recorded).toEqual([{
      url: URL_,
      method: 'POST',
      headers: SINGLE_HEADERS,
      body: '{"from":"Louisiana Chess Association <noreply@louisianachess.org>","to":["pat.member@example.org"],"reply_to":["LouisianaChess@gmail.com"],"subject":"You\'re registered: Fall \\"Open\\", 3½ points to win","html":"<p class=\\"lead\\">Hi Pat &amp; family,</p>","text":"Hi Pat,\\nSee you on Sat, Oct 24 at 9:00 AM."}',
    }])
  })

  it('(b) without a text part, or with an empty one: no text key at all', async () => {
    await sendEmail(ENV, { to: MESSAGE.to, subject: 'Registration is open: Fall Open', html: '<p>Hi</p>' })
    await sendEmail(ENV, { to: MESSAGE.to, subject: 'Registration is open: Fall Open', html: '<p>Hi</p>', text: '' })
    const body = '{"from":"Louisiana Chess Association <noreply@louisianachess.org>","to":["pat.member@example.org"],"reply_to":["LouisianaChess@gmail.com"],"subject":"Registration is open: Fall Open","html":"<p>Hi</p>"}'
    expect(recorded).toEqual([
      { url: URL_, method: 'POST', headers: SINGLE_HEADERS, body },
      { url: URL_, method: 'POST', headers: SINGLE_HEADERS, body },
    ])
  })

  it('(c) with the message\'s own replyTo: replies go to it, in an array of one', async () => {
    await sendEmail(ENV, { to: 'staff-inbox@example.org', subject: 'Help (from Pat) [Ticket: 1042]', html: '<p>Help</p>', replyTo: 'pat.member@example.org' })
    expect(recorded).toEqual([{
      url: URL_,
      method: 'POST',
      headers: SINGLE_HEADERS,
      body: '{"from":"Louisiana Chess Association <noreply@louisianachess.org>","to":["staff-inbox@example.org"],"reply_to":["pat.member@example.org"],"subject":"Help (from Pat) [Ticket: 1042]","html":"<p>Help</p>"}',
    }])
  })

  it('(d) with FROM_EMAIL and REPLY_TO_EMAIL set: the bindings give the From and the reply-to, and a message\'s own replyTo still wins', async () => {
    const env: EmailEnv = { RESEND_API_KEY: KEY, FROM_EMAIL: 'from-binding@example.org', REPLY_TO_EMAIL: 'board@example.org' }
    await sendEmail(env, { to: MESSAGE.to, subject: 'One week to go: Fall Open', html: '<p>Soon</p>', text: 'Soon' })
    await sendEmail(env, { to: MESSAGE.to, subject: 'Re: Help', html: '<p>Re</p>', replyTo: 'pat.member@example.org' })
    expect(recorded).toEqual([
      {
        url: URL_,
        method: 'POST',
        headers: SINGLE_HEADERS,
        body: '{"from":"Louisiana Chess Association <from-binding@example.org>","to":["pat.member@example.org"],"reply_to":["board@example.org"],"subject":"One week to go: Fall Open","html":"<p>Soon</p>","text":"Soon"}',
      },
      {
        url: URL_,
        method: 'POST',
        headers: SINGLE_HEADERS,
        body: '{"from":"Louisiana Chess Association <from-binding@example.org>","to":["pat.member@example.org"],"reply_to":["pat.member@example.org"],"subject":"Re: Help","html":"<p>Re</p>"}',
      },
    ])
  })
})

// ── Group email ──────────────────────────────────────────────────────

/** What a campaign path ran against the database: each statement and what it was bound with. */
interface Ran { sql: string; args: unknown[] }

/** A stand-in for D1 holding one campaign and one pending recipient, which keeps every statement run against it. */
function campaignDb(attempts = 1) {
  const ran: Ran[] = []
  const statement = (sql: string, args: unknown[] = []) => ({
    sql,
    args,
    bind: (...bound: unknown[]) => statement(sql, bound),
    first: async () => {
      ran.push({ sql, args })
      if (sql.startsWith('SELECT subject, body_html')) return { subject: 'Fall news', body_html: '<p>Hi</p>' }
      if (sql.startsWith('SELECT COUNT(*)')) return { count: 0 }
      return null
    },
    all: async () => {
      ran.push({ sql, args })
      return { results: sql.includes('RETURNING id, email, attempts') ? [{ id: 'rcp-1', email: 'pat.member@example.org', attempts }] : [] }
    },
    run: async () => {
      ran.push({ sql, args })
      return { meta: { changes: 1 } }
    },
  })
  const db = {
    prepare: (sql: string) => statement(sql),
    batch: async (statements: Array<{ sql: string; args: unknown[] }>) => {
      for (const s of statements) ran.push({ sql: s.sql, args: s.args })
      return []
    },
  }
  return { db: db as unknown as D1Database, ran }
}

const SITE = { SITE_URL: 'https://www.louisianachess.org' }
const campaignEnv = (db: D1Database, extra: Partial<CampaignEnv> = {}): CampaignEnv => ({ DB: db, RESEND_API_KEY: KEY, ...SITE, ...extra })
/** The branded page Group email wraps a message in, which the move does not touch: the body is held around it, byte for byte. */
const branded = (subject: string, bodyHtml: string) => JSON.stringify(wrapBrandedEmail(SITE, subject, bodyHtml))

const RETRY = 'UPDATE email_campaign_recipients SET claimed_at = NULL, error = ? WHERE id = ?'
const FAILED = 'UPDATE email_campaign_recipients SET status = \'failed\', error = ? WHERE id = ?'
const SENT = 'UPDATE email_campaign_recipients SET status = \'sent\', sent_at = datetime(\'now\'), error = NULL WHERE id = ?'

describe('Group email through the seam: the campaign shape, byte for byte', () => {
  it('(e) the test send: to as a bare string, reply_to an array and first after from, no text, and Authorization first', async () => {
    const { db } = campaignDb()
    expect(await sendTestEmail(campaignEnv(db), 'pat.member@example.org', '[TEST] Fall news', '<p>Hi &amp; welcome</p>')).toEqual({ ok: true })
    expect(recorded).toEqual([{
      url: URL_,
      method: 'POST',
      headers: CAMPAIGN_HEADERS,
      body: '{"from":"Louisiana Chess Association <noreply@louisianachess.org>","reply_to":["LouisianaChess@gmail.com"],"to":"pat.member@example.org","subject":"[TEST] Fall news","html":' + branded('[TEST] Fall news', '<p>Hi &amp; welcome</p>') + '}',
    }])
  })

  it('(e) the test send with FROM_EMAIL and REPLY_TO_EMAIL set: the bindings give the From and the reply-to', async () => {
    const { db } = campaignDb()
    await sendTestEmail(campaignEnv(db, { FROM_EMAIL: 'from-binding@example.org', REPLY_TO_EMAIL: 'board@example.org' }), 'pat.member@example.org', 'Fall news', '<p>Hi</p>')
    expect(recorded).toEqual([{
      url: URL_,
      method: 'POST',
      headers: CAMPAIGN_HEADERS,
      body: '{"from":"Louisiana Chess Association <from-binding@example.org>","reply_to":["board@example.org"],"to":"pat.member@example.org","subject":"Fall news","html":' + branded('Fall news', '<p>Hi</p>') + '}',
    }])
  })

  it('(e) a campaign\'s own send, as the request path and the sweep make it: the same request, and the recipient marked sent', async () => {
    const { db, ran } = campaignDb()
    expect(await processCampaign(campaignEnv(db), 'cmp-1')).toEqual({ sent: 1, failed: 0, remaining: 0, done: true })
    expect(recorded).toEqual([{
      url: URL_,
      method: 'POST',
      headers: CAMPAIGN_HEADERS,
      body: '{"from":"Louisiana Chess Association <noreply@louisianachess.org>","reply_to":["LouisianaChess@gmail.com"],"to":"pat.member@example.org","subject":"Fall news","html":' + branded('Fall news', '<p>Hi</p>') + '}',
    }])
    expect(ran).toContainEqual({ sql: SENT, args: ['rcp-1'] })
  })

  it('(e) the campaign shape as the seam writes it, every byte a literal', async () => {
    expect(await deliver(ENV, { from: 'noreply@louisianachess.org', to: 'pat.member@example.org', replyTo: 'LouisianaChess@gmail.com', subject: 'Fall "news"', html: '<p>Hi</p>', text: 'dropped', shape: 'campaign' })).toEqual({ ok: true })
    expect(recorded).toEqual([{
      url: URL_,
      method: 'POST',
      headers: CAMPAIGN_HEADERS,
      body: '{"from":"Louisiana Chess Association <noreply@louisianachess.org>","reply_to":["LouisianaChess@gmail.com"],"to":"pat.member@example.org","subject":"Fall \\"news\\"","html":"<p>Hi</p>"}',
    }])
  })
})

describe('(f) failures keep their words, and each send is one request', () => {
  it('a 422: sendEmail throws today\'s words with Resend\'s body, and the campaign path gives up on that recipient with "Resend 422: <body>"', async () => {
    answer = { status: 422, body: '{"statusCode":422,"message":"Invalid `to` field."}' }
    await expect(sendEmail(ENV, MESSAGE)).rejects.toThrow(new Error('Email send failed (422): {"statusCode":422,"message":"Invalid `to` field."}'))
    expect(await sendTestEmail(campaignEnv(campaignDb().db), 'pat.member@example.org', 'Fall news', '<p>Hi</p>')).toEqual({ ok: false, error: 'Resend 422: {"statusCode":422,"message":"Invalid `to` field."}' })
    const { db, ran } = campaignDb()
    expect(await processCampaign(campaignEnv(db), 'cmp-1')).toEqual({ sent: 0, failed: 1, remaining: 0, done: true })
    expect(ran).toContainEqual({ sql: FAILED, args: ['Resend 422: {"statusCode":422,"message":"Invalid `to` field."}', 'rcp-1'] })
    expect(ran.map((r) => r.sql)).not.toContain(RETRY)
    expect(recorded).toHaveLength(3)
  })

  it('a 503 and a 429: the campaign path puts the recipient back to be tried again later, with the status in its error', async () => {
    for (const status of [503, 429]) {
      answer = { status, body: 'upstream unavailable' }
      const { db, ran } = campaignDb()
      expect(await processCampaign(campaignEnv(db), 'cmp-1'), String(status)).toEqual({ sent: 0, failed: 0, remaining: 0, done: true })
      expect(ran, String(status)).toContainEqual({ sql: RETRY, args: [`Resend ${status}: upstream unavailable`, 'rcp-1'] })
      expect(ran.map((r) => r.sql), String(status)).not.toContain(FAILED)
    }
    answer = { status: 503, body: 'upstream unavailable' }
    await expect(sendEmail(ENV, MESSAGE)).rejects.toThrow(new Error('Email send failed (503): upstream unavailable'))
    expect(recorded).toHaveLength(3)
  })

  it('a 503 on a recipient\'s third try: given up on, as before', async () => {
    answer = { status: 503, body: 'upstream unavailable' }
    const { db, ran } = campaignDb(3)
    expect(await processCampaign(campaignEnv(db), 'cmp-1')).toEqual({ sent: 0, failed: 1, remaining: 0, done: true })
    expect(ran).toContainEqual({ sql: FAILED, args: ['Resend 503: upstream unavailable', 'rcp-1'] })
  })

  it('a thrown fetch: tried again later on the campaign path with the thrown message, and its message reaches sendEmail\'s throw and trySendEmail\'s log line unchanged', async () => {
    answer = 'throw'
    const { db, ran } = campaignDb()
    expect(await processCampaign(campaignEnv(db), 'cmp-1')).toEqual({ sent: 0, failed: 0, remaining: 0, done: true })
    expect(ran).toContainEqual({ sql: RETRY, args: ['fetch failed', 'rcp-1'] })
    await expect(sendEmail(ENV, MESSAGE)).rejects.toThrow(new Error('fetch failed'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await trySendEmail(ENV, MESSAGE)).toBe(false)
    expect(warn.mock.calls).toEqual([['fetch failed']])
    expect(recorded).toHaveLength(3)
  })

  it('a send that fails is never handed to a second service or tried twice inside the send', async () => {
    for (const next of [{ status: 500, body: 'oops' }, 'throw' as const]) {
      answer = next
      recorded = []
      expect((await deliver(ENV, { from: 'noreply@louisianachess.org', to: MESSAGE.to, replyTo: 'LouisianaChess@gmail.com', subject: 'x', html: '<p>x</p>', shape: 'single' })).ok).toBe(false)
      expect(recorded.map((r) => r.url)).toEqual([URL_])
    }
  })

  it('the seam answers what came of the send: a refusal with its status and words, a thrown request as no answer, and never throws itself', async () => {
    const mail = { from: 'noreply@louisianachess.org', to: MESSAGE.to, replyTo: 'LouisianaChess@gmail.com', subject: 'x', html: '<p>x</p>', shape: 'single' } as const
    answer = { status: 422, body: 'bad address' }
    expect(await deliver(ENV, mail)).toEqual({ ok: false, status: 422, error: 'bad address' })
    answer = 'throw'
    expect(await deliver(ENV, mail)).toEqual({ ok: false, noAnswer: true, error: 'fetch failed' })
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw 'not an Error'
    }))
    expect(await deliver(ENV, mail)).toEqual({ ok: false, noAnswer: true, error: 'Unknown send error' })
  })
})

describe('(g) the display name', () => {
  it('is SENDER_NAME, today\'s words, when a message names none, in both shapes', async () => {
    expect(SENDER_NAME).toBe('Louisiana Chess Association')
    for (const shape of ['single', 'campaign'] as const) {
      await deliver(ENV, { from: 'noreply@louisianachess.org', to: MESSAGE.to, replyTo: 'LouisianaChess@gmail.com', subject: 'x', html: '<p>x</p>', shape })
    }
    expect(recorded.map((r) => JSON.parse(r.body).from)).toEqual(['Louisiana Chess Association <noreply@louisianachess.org>', 'Louisiana Chess Association <noreply@louisianachess.org>'])
  })

  it('is the message\'s own when it names one, in both shapes, and nothing else in the request moves', async () => {
    for (const shape of ['single', 'campaign'] as const) {
      await deliver(ENV, { from: 'noreply@louisianachess.org', fromName: 'Example Chess Club', to: MESSAGE.to, replyTo: 'sample.club@example.org', subject: 'Sample club note', html: '<p>Example words for a sample club note.</p>', shape })
    }
    expect(recorded).toEqual([
      {
        url: URL_,
        method: 'POST',
        headers: SINGLE_HEADERS,
        body: '{"from":"Example Chess Club <noreply@louisianachess.org>","to":["pat.member@example.org"],"reply_to":["sample.club@example.org"],"subject":"Sample club note","html":"<p>Example words for a sample club note.</p>"}',
      },
      {
        url: URL_,
        method: 'POST',
        headers: CAMPAIGN_HEADERS,
        body: '{"from":"Example Chess Club <noreply@louisianachess.org>","reply_to":["sample.club@example.org"],"to":"pat.member@example.org","subject":"Sample club note","html":"<p>Example words for a sample club note.</p>"}',
      },
    ])
  })
})
