// test/integration/ses-path-edges.test.ts
//
// The edges of Amazon SES's path, beside test/integration/ses-path.test.ts:
// the test through Amazon SES asked in ways the page never asks (a service
// that is not 'ses', a role written into the body, an officer, an address
// the gate refuses, no link key, every answer that may come after Amazon
// took the message, a request with no answer, a refusal whose words quote
// Amazon's resource names); the harness's catch point
// held to Amazon's form by a request signed apart from the site's signer; a
// run that crosses midnight, and the two changes of the clock in
// America/Chicago, signed and taken; a replay of a finished send; two runs
// of one send at once, two POSTs at once and two daily runs at once, each
// message reaching Amazon once; and the member delete and the stop read at
// their edges.
//
// MAIL_LISTS_ON, MAIL_SENDER and WORKERS_PLAN are read through getters on
// the mocked functions/utils/mail/switches, set before every case to the
// cutover's values and changed where a case says. Nothing here reaches an
// outside service: the harness answers Amazon SES, Resend and the sign-in
// service. AKIDEXAMPLE, the key id the pool binds, is AWS's own documentation
// value and opens nothing; the secret beside it is made up. Every name,
// address, club and subject here is plainly made up.
import { createHash, createHmac } from 'node:crypto'
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NEWSLETTER_LIST_ID } from '../../domain/mail/lists'
import { onRequestGet as newsletterGet, onRequestPost as newsletterPost } from '../../functions/api/admin/mail/newsletter'
import { onRequestPost as testPost } from '../../functions/api/admin/mail/newsletter/test'
import { onRequestDelete as memberDelete } from '../../functions/api/admin/members/[id]'
import { STOPPED_WORDS, processCampaign, sweepPendingCampaigns } from '../../functions/utils/admin/campaigns'
import { linkKeyCheck } from '../../functions/utils/mail/links'
import { createListCampaign, stopListCampaign } from '../../functions/utils/mail/lists'
import { SES_TEST_ADMINS_ONLY } from '../../functions/utils/mail/newsletterAnswers'
import { GATE_UNREAD_WORDS, REFUSAL_WORDS } from '../../functions/utils/mail/send'
import { SES_KEY_MISSING } from '../../functions/utils/mail/ses'
import type { Env } from '../../functions/types'
import { seedAdmin, seedMember } from './factories'
import { emailBehavior, emailOutbox, flushWaitUntil, invoke, resetHarness, sesSignatures } from './harness'
import { bindings, holdClock, noLongerReceives, noWaits, paidEntrants, runDaily } from './mailRuns'
import { campaignOf, quickPauses, rowsOf, stageCampaign } from './campaignRuns'

const flags = vi.hoisted(() => ({ listsOn: true, sender: 'ses', plan: 'paid' }))
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
    get WORKERS_PLAN() {
      return flags.plan
    },
  }
})

const SES = 'email.us-east-1.amazonaws.com'
const RESEND = 'api.resend.com'
const SES_URL = `https://${SES}/v2/email/outbound-emails`
const SAMPLE = { subject: 'Sample newsletter one', bodyHtml: '<p>Example words for a sample newsletter.</p>' }
const key = () => (env as unknown as Env).MAIL_LINK_SECRET as string

let seq = 0
const address = (name: string) => `${name}-${++seq}@ses-edges.test.lca`
const member = (email: string, opts: { role?: string; membershipStatus?: string } = {}) => seedMember({ email, fullName: 'Player One', ...opts })

interface MailCall { via: 'ses' | 'resend'; to: string }
const unwrap: Array<() => void> = []

/** Keeps every request to either mail service, over the harness's own fetch. */
function watchMail(): MailCall[] {
  const underneath = globalThis.fetch
  const calls: MailCall[] = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input as RequestInfo, init)
    const host = new URL(request.url).hostname
    if (host === SES || host === RESEND) {
      const body = (await request.clone().json()) as { to?: string | string[]; Destination?: { ToAddresses: string[] } }
      const to = host === SES ? body.Destination!.ToAddresses[0] : Array.isArray(body.to) ? body.to[0] : body.to!
      calls.push({ via: host === SES ? 'ses' : 'resend', to })
    }
    return await underneath(input as RequestInfo, init)
  }) as typeof fetch
  unwrap.push(() => {
    globalThis.fetch = underneath
  })
  return calls
}

async function contacts(): Promise<number> {
  return (await env.DB.prepare('SELECT COUNT(*) AS n FROM mail_contacts').first<{ n: number }>())!.n
}

/** What a send's rows must come to once nothing is pending: every row sent or failed, the counts adding up. */
async function countsAddUp(campaignId: string): Promise<void> {
  const rows = await rowsOf(campaignId)
  const campaign = await campaignOf(campaignId)
  expect(rows.filter((r) => r.status === 'pending')).toEqual([])
  expect(campaign!.total_recipients).toBe(rows.length)
  expect(campaign!.sent_count + campaign!.failed_count).toBe(rows.length)
}

async function quietOldReminders(): Promise<void> {
  await env.DB.prepare('UPDATE tournaments SET reminder_1_enabled = 0, reminder_2_enabled = 0').run()
  await env.DB.prepare('UPDATE tournament_reminders SET sent_registration_open = 1, sent_week_before = 1').run()
}

beforeEach(async () => {
  resetHarness()
  flags.listsOn = true
  flags.sender = 'ses'
  flags.plan = 'paid'
  quickPauses()
  for (const table of ['email_campaign_recipients', 'email_campaigns', 'mail_list_choices', 'mail_contacts', 'mail_do_not_send']) {
    await env.DB.prepare(`DELETE FROM ${table}`).run()
  }
})

afterEach(() => {
  while (unwrap.length > 0) unwrap.pop()!()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('the test through Amazon SES, asked in ways the page never asks', () => {
  it.each([['resend'], ['SES'], [' ses'], [1], [true], [null], [''], [['ses']], [{ name: 'ses' }]])('a service of %j is a 400 for an LCA admin, writing nothing and sending nothing', async (service) => {
    flags.sender = 'resend'
    const admin = await seedAdmin()
    const calls = watchMail()
    const before = await contacts()
    const res = await invoke(testPost, { as: admin, method: 'POST', body: { to: address('tester'), ...SAMPLE, service } })
    expect(res.status).toBe(400)
    expect(await contacts()).toBe(before)
    expect(calls).toEqual([])
  })

  it('reads the role from the session and never from the body: the president writing a role of an LCA admin into the request is refused', async () => {
    flags.sender = 'resend'
    const president = await member(address('president'), { role: 'lca_observer' })
    const calls = watchMail()
    const before = await contacts()
    for (const extra of [{ role: 'lca_admin' }, { member: { role: 'lca_admin' } }, { as: 'lca_admin' }, { admin: true }]) {
      const res = await invoke(testPost, { as: president, aal: 'aal2', method: 'POST', body: { to: address('tester'), ...SAMPLE, service: 'ses', ...extra } })
      expect(res.status, JSON.stringify(extra)).not.toBe(200)
      expect(res.status, JSON.stringify(extra)).toBeGreaterThanOrEqual(400)
    }
    expect(await contacts()).toBe(before)
    expect(calls.filter((c) => c.via === 'ses')).toEqual([])
  })

  it('refuses an officer and a plain member the guard\'s answer, never the data, and nothing is sent', async () => {
    flags.sender = 'resend'
    const calls = watchMail()
    const before = await contacts()
    for (const role of ['lca_officer', 'member', 'tournament_director']) {
      const who = await member(address(role), { role })
      const res = await invoke(testPost, { as: who, aal: 'aal2', method: 'POST', body: { to: address('tester'), ...SAMPLE, service: 'ses' } })
      expect([401, 403], role).toContain(res.status)
      expect(JSON.stringify(await res.json()), role).not.toMatch(/sent|Amazon/i)
    }
    expect(await contacts()).toBe(before)
    expect(calls).toEqual([])
  })

  it('answers 401 with no session even with the box ticked, MAIL_LISTS_ON set, and sends nothing', async () => {
    flags.sender = 'resend'
    const calls = watchMail()
    const res = await invoke(testPost, { method: 'POST', body: { to: address('tester'), ...SAMPLE, service: 'ses' } })
    expect(res.status).toBe(401)
    expect(calls).toEqual([])
  })

  it('stops an address the gate refuses before any request, in the gate\'s words, as a test through Resend is stopped', async () => {
    flags.sender = 'resend'
    const admin = await seedAdmin()
    const gone = address('gone')
    await noLongerReceives(gone)
    const calls = watchMail()
    const res = await invoke(testPost, { as: admin, method: 'POST', body: { to: gone, ...SAMPLE, service: 'ses' } })
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ error: `Failed to send test email: ${REFUSAL_WORDS.do_not_send}` })
    expect(calls).toEqual([])
    expect(emailOutbox).toEqual([])
  })

  it('answers 503 for an LCA admin with no link key, before any write and any request, and 403 for the president first, with the same missing key', async () => {
    flags.sender = 'resend'
    const admin = await seedAdmin()
    const president = await member(address('president'), { role: 'lca_observer' })
    const calls = watchMail()
    const before = await contacts()
    const noKey = { MAIL_LINK_SECRET: '' }
    expect((await invoke(testPost, { as: admin, method: 'POST', body: { to: address('tester'), ...SAMPLE, service: 'ses' }, env: noKey })).status).toBe(503)
    const refused = await invoke(testPost, { as: president, aal: 'aal2', method: 'POST', body: { to: address('tester'), ...SAMPLE, service: 'ses' }, env: noKey })
    expect(refused.status).toBe(403)
    expect(await refused.json()).toEqual({ error: SES_TEST_ADMINS_ONLY })
    expect(await contacts()).toBe(before)
    expect(calls).toEqual([])
  })

  it('with only one of the two keys, makes no request and says the key is missing, whichever is the one', async () => {
    flags.sender = 'resend'
    const admin = await seedAdmin()
    const calls = watchMail()
    for (const missing of [{ SES_ACCESS_KEY_ID: '' }, { SES_SECRET_ACCESS_KEY: '' }]) {
      const res = await invoke(testPost, { as: admin, method: 'POST', body: { to: address('tester'), ...SAMPLE, service: 'ses' }, env: missing })
      expect(res.status).toBe(502)
      expect(await res.json()).toEqual({ error: `Failed to send test email: ${SES_KEY_MISSING}` })
    }
    expect(calls).toEqual([])
  })

  it.each([
    ['a 500', { status: 500 }, /^Failed to send test email: Amazon SES 500 InternalFailure: /],
    ['a 502', { status: 502 }, /^Failed to send test email: Amazon SES 502: /],
    ['a 504', { status: 504 }, /^Failed to send test email: Amazon SES 504: /],
    ['a 408', { status: 408 }, /^Failed to send test email: Amazon SES 408 RequestTimeoutException: /],
    ['a 429', { status: 429 }, /^Failed to send test email: Amazon SES 429 TooManyRequestsException: /],
    ['a 503', { status: 503 }, /^Failed to send test email: Amazon SES 503 ServiceUnavailable: /],
    ['a 403', { status: 403 }, /^Failed to send test email: Amazon SES 403 AccessDeniedException: /],
    ['a 404', { status: 404 }, /^Failed to send test email: Amazon SES 404 NotFoundException: /],
  ])('%s makes one request to Amazon and none to Resend, and answers 502 in Amazon\'s words: a test is never tried again', async (_, answer, words) => {
    flags.sender = 'resend'
    const admin = await seedAdmin()
    emailBehavior.succeed = false
    emailBehavior.status = answer.status
    const calls = watchMail()
    const res = await invoke(testPost, { as: admin, method: 'POST', body: { to: address('tester'), ...SAMPLE, service: 'ses' } })
    expect(res.status).toBe(502)
    expect((await res.json<{ error: string }>()).error).toMatch(words)
    expect(calls.map((c) => c.via)).toEqual(['ses'])
    expect(emailOutbox).toEqual([])
  })

  it('a request with no answer is one request, in the seam\'s words, and is never handed to Resend instead', async () => {
    flags.sender = 'resend'
    const admin = await seedAdmin()
    emailBehavior.noAnswer = 1
    const calls = watchMail()
    const res = await invoke(testPost, { as: admin, method: 'POST', body: { to: address('tester'), ...SAMPLE, service: 'ses' } })
    expect(res.status).toBe(502)
    expect(calls.map((c) => c.via)).toEqual(['ses'])
    expect(emailOutbox).toEqual([])
  })

  it('keeps no resource name, account number or user name of Amazon\'s refusal in the test\'s answer, a newsletter row or the waiting line the president is shown', async () => {
    // Amazon's words for a key whose policy lacks the action, the account number and the user plainly made up.
    const denied = 'User: arn:aws:iam::123456789012:user/sample-sender is not authorized to perform: ses:SendEmail on resource: '
      + 'arn:aws:ses:us-east-1:123456789012:identity/news.example.org because no identity-based policy allows the ses:SendEmail action'
    const words = 'Amazon SES 403 AccessDeniedException: User: an Amazon resource is not authorized to perform: ses:SendEmail on resource: '
      + 'an Amazon resource because no identity-based policy allows the ses:SendEmail action'
    const underneath = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input)
      if (new URL(url).hostname !== SES) return await underneath(input as RequestInfo, init)
      return Response.json(
        { __type: 'com.amazonaws.email.v2#AccessDeniedException', message: denied },
        { status: 403, headers: { 'x-amzn-errortype': 'com.amazonaws.email.v2#AccessDeniedException:http://internal.amazon.com/coral/com.amazon.coral.service/' } },
      )
    }) as typeof fetch
    unwrap.push(() => {
      globalThis.fetch = underneath
    })
    const calls = watchMail()
    flags.sender = 'resend'
    const admin = await seedAdmin()
    const res = await invoke(testPost, { as: admin, method: 'POST', body: { to: address('tester'), ...SAMPLE, service: 'ses' } })
    expect(res.status).toBe(502)
    const answer = await res.json<{ error: string }>()
    expect(answer).toEqual({ error: `Failed to send test email: ${words}` })

    flags.sender = 'ses'
    for (let i = 0; i < 2; i += 1) await member(address('reader'))
    const made = await createListCampaign(env.DB, { listId: NEWSLETTER_LIST_ID, ...SAMPLE, createdBy: admin, linkCheck: await linkKeyCheck(key()) })
    const id = made!.campaignId
    const rows = await rowsOf(id)
    expect(rows.length).toBeGreaterThanOrEqual(2)
    expect(await processCampaign(bindings, id)).toEqual({ sent: 0, failed: 0, remaining: rows.length, done: false })
    const after = await rowsOf(id)
    expect(after.filter((r) => r.status !== 'pending' || r.attempts !== 0)).toEqual([])
    expect(after[0].error).toBe(words)
    expect(calls.map((c) => c.via)).toEqual(['ses', 'ses'])
    const president = await member(address('president'), { role: 'lca_observer' })
    const shown = await invoke(newsletterGet, { as: president, aal: 'aal2' })
    expect(shown.status).toBe(200)
    const summary = await shown.json<{ summary: { waits: string | null } }>()
    expect(summary.summary.waits).toBe(words)

    const everything = JSON.stringify({ answer, rows: await rowsOf(id), campaign: await campaignOf(id), summary })
    for (const piece of ['arn:', '123456789012', 'user/', 'sample-sender', 'news.example.org']) expect(everything, piece).not.toContain(piece)
    expect(everything).not.toMatch(/\b\d{12}\b/)
  })

  it('with MAIL_SENDER already \'ses\', a test without the box goes through Amazon SES too, from the same newsletter line, and never reaches Resend', async () => {
    flags.sender = 'ses'
    const admin = await seedAdmin()
    const calls = watchMail()
    const res = await invoke(testPost, { as: admin, method: 'POST', body: { to: address('tester'), ...SAMPLE } })
    expect(res.status).toBe(200)
    expect(calls.map((c) => c.via)).toEqual(['ses'])
  })
})

describe('the Amazon SES catch point holds a request to Amazon\'s form, worked out apart from the site\'s signer', () => {
  const secretKey = () => (env as unknown as Env).SES_SECRET_ACCESS_KEY as string
  const BODY = JSON.stringify({
    FromEmailAddress: 'Sample Sender <sender@example.org>',
    Destination: { ToAddresses: ['reader@example.org'] },
    Content: { Simple: { Subject: { Data: 'Sample subject' }, Body: { Html: { Data: '<p>Example.</p>' } } } },
    EmailTags: [{ Name: 'kind', Value: 'event' }],
  })

  /** A request signed with node:crypto at a time this many milliseconds from now, with the scope and the secret it is given. */
  async function post(opts: { skew?: number; scope?: string; secret?: string; accessKeyId?: string; extraHeader?: boolean; signed?: string } = {}): Promise<Response> {
    const at = new Date(Date.now() + (opts.skew ?? 0))
    const time = at.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    const date = time.slice(0, 8)
    const scope = opts.scope ?? `${date}/us-east-1/ses/aws4_request`
    const sha = (v: string | Buffer) => createHash('sha256').update(v).digest('hex')
    const canonical = ['POST', '/v2/email/outbound-emails', '', `content-type:application/json\nhost:${SES}\nx-amz-date:${time}\n`, 'content-type;host;x-amz-date', sha(Buffer.from(BODY, 'utf8'))].join('\n')
    let signingKey: Buffer = createHmac('sha256', `AWS4${opts.secret ?? secretKey()}`).update(date).digest()
    for (const part of scope.split('/').slice(1)) signingKey = createHmac('sha256', signingKey).update(part).digest()
    const signature = createHmac('sha256', signingKey).update(['AWS4-HMAC-SHA256', time, scope, sha(canonical)].join('\n')).digest('hex')
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-amz-date': time,
      authorization: `AWS4-HMAC-SHA256 Credential=${opts.accessKeyId ?? 'AKIDEXAMPLE'}/${scope}, SignedHeaders=${opts.signed ?? 'content-type;host;x-amz-date'}, Signature=${signature}`,
    }
    if (opts.extraHeader) headers['x-sample-extra'] = 'one'
    return fetch(SES_URL, { method: 'POST', headers, body: BODY })
  }

  it('takes a request signed apart from the site\'s signer, within the five minutes, and keeps the signature it took', async () => {
    const before = sesSignatures.length
    for (const skew of [0, -4 * 60 * 1000, 4 * 60 * 1000]) {
      const res = await post({ skew })
      expect(res.status, String(skew)).toBe(200)
      expect(await res.json()).toMatchObject({ MessageId: expect.stringMatching(/^ses-/) })
    }
    expect(sesSignatures.length).toBe(before + 3)
    expect(emailOutbox.map((e) => e.via)).toEqual(['ses', 'ses', 'ses'])
  })

  it('refuses a request signed more than five minutes ago or ahead, as Amazon does, and takes nothing', async () => {
    for (const skew of [-6 * 60 * 1000, 6 * 60 * 1000]) {
      const res = await post({ skew })
      expect(res.status, String(skew)).toBe(403)
      expect(res.headers.get('x-amzn-errortype')).toMatch(/^SignatureDoesNotMatch/)
    }
    expect(emailOutbox).toEqual([])
  })

  it('refuses a wrong secret, a wrong region and a wrong service as a signature that does not match or is not formed, and takes nothing', async () => {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    expect((await post({ secret: 'a-made-up-other-secret' })).status).toBe(403)
    for (const scope of [`${date}/us-west-2/ses/aws4_request`, `${date}/us-east-1/s3/aws4_request`]) {
      expect((await post({ scope })).status, scope).toBe(400)
    }
    expect((await post({ accessKeyId: 'AKIDSAMPLEOTHER' })).status).toBe(400)
    expect((await post({ extraHeader: true })).status).toBe(400)
    expect((await post({ signed: 'content-type;host;x-amz-date;x-sample-extra' })).status).toBe(400)
    expect(emailOutbox).toEqual([])
  })

  it('refuses a request signed for yesterday\'s date with today\'s stamp, never a key from another day', async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10).replace(/-/g, '')
    const res = await post({ scope: `${yesterday}/us-east-1/ses/aws4_request` })
    expect(res.status).toBe(400)
    expect(emailOutbox).toEqual([])
  })
})

describe('a run that crosses midnight or one of the two clock changes in America/Chicago, signed and taken', () => {
  const CROSSINGS: ReadonlyArray<readonly [string, string]> = [
    ['2026-11-12T23:59:59.800Z', 'midnight, from Thursday, November 12, 2026 into Friday, November 13, 2026'],
    ['2026-12-31T23:59:59.800Z', 'the end of the year, into Friday, January 1, 2027'],
    ['2028-02-28T23:59:59.800Z', 'the end of Monday, February 28, 2028, into the leap day'],
    ['2026-03-08T07:59:59.800Z', 'the spring change in America/Chicago, Sunday, March 8, 2026'],
    ['2026-11-01T06:59:59.800Z', 'the fall change in America/Chicago, Sunday, November 1, 2026'],
  ]

  it.each(CROSSINGS)('%s, %s: the second send is signed for the new day and Amazon takes both', async (instant) => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(instant))
    const [one, two] = [address('midnight'), address('midnight')]
    const id = await stageCampaign({ recipients: [{ email: one }, { email: two }] })
    const before = sesSignatures.length
    const calls = watchMail()
    expect(await processCampaign(bindings, id)).toEqual({ sent: 2, failed: 0, remaining: 0, done: true })
    expect(sesSignatures.length).toBe(before + 2)
    expect(calls).toEqual([{ via: 'ses', to: one }, { via: 'ses', to: two }])
    // The pause between the two sends moved the held clock across the line: the UTC hour the change falls on, and for the
    // first three the day as well. A change of the clock in America/Chicago moves no UTC stamp but the pause itself.
    expect(new Date().getTime()).toBeGreaterThanOrEqual(new Date(instant).getTime() + 200)
    if (instant.startsWith('2026-11-12') || instant.startsWith('2026-12-31') || instant.startsWith('2028-02-28')) {
      expect(new Date().toISOString().slice(0, 10)).not.toBe(instant.slice(0, 10))
    } else {
      expect(new Date().toISOString().slice(0, 13)).not.toBe(instant.slice(0, 13))
    }
    await countsAddUp(id)
  })
})

describe('a finished send replayed, and one send run twice at once', () => {
  it('a replay of a finished campaign, by the processor and by the sweep, sends nothing and changes no count', async () => {
    const people = [address('replay'), address('replay'), address('replay')]
    const id = await stageCampaign({ recipients: people.map((email) => ({ email })) })
    const calls = watchMail()
    expect(await processCampaign(bindings, id)).toEqual({ sent: 3, failed: 0, remaining: 0, done: true })
    const rows = await rowsOf(id)
    const counters = await campaignOf(id)
    await processCampaign(bindings, id)
    await sweepPendingCampaigns(bindings)
    await sweepPendingCampaigns(bindings)
    expect(calls).toHaveLength(3)
    expect(emailOutbox).toHaveLength(3)
    expect(await rowsOf(id)).toEqual(rows)
    expect(await campaignOf(id)).toEqual(counters)
  })

  it('a replay after a row failed sends the failed row no second time and counts it once', async () => {
    const [failing, fine] = [address('failing'), address('fine')]
    const id = await stageCampaign({ recipients: [{ email: failing }, { email: fine }] })
    emailBehavior.succeed = false
    emailBehavior.failFor = [failing]
    emailBehavior.status = 400
    const calls = watchMail()
    await processCampaign(bindings, id)
    for (let run = 0; run < 3; run += 1) await processCampaign(bindings, id)
    await sweepPendingCampaigns(bindings)
    expect(calls.filter((c) => c.to === failing)).toHaveLength(1)
    expect(calls.filter((c) => c.to === fine)).toHaveLength(1)
    expect(await campaignOf(id)).toMatchObject({ sent_count: 1, failed_count: 1, status: 'completed' })
  })

  it('two runs of one campaign at once reach each address once, and the counts add up', async () => {
    const people = Array.from({ length: 6 }, () => address('race'))
    const id = await stageCampaign({ recipients: people.map((email) => ({ email })) })
    const calls = watchMail()
    await Promise.all([processCampaign(bindings, id), processCampaign(bindings, id)])
    await sweepPendingCampaigns(bindings)
    for (const person of people) expect(calls.filter((c) => c.to === person), person).toHaveLength(1)
    expect(emailOutbox.map((e) => e.to).sort()).toEqual([...people].sort())
    await countsAddUp(id)
  })

  it('two POSTs of the newsletter at once make one send: one 201 and one 409, each reader reached once', async () => {
    const admin = await seedAdmin()
    const readers = Array.from({ length: 4 }, () => address('reader'))
    for (const reader of readers) await member(reader)
    const calls = watchMail()
    const answers = await Promise.all([
      invoke(newsletterPost, { as: admin, method: 'POST', body: SAMPLE }),
      invoke(newsletterPost, { as: admin, method: 'POST', body: SAMPLE }),
    ])
    expect(answers.map((r) => r.status).sort()).toEqual([201, 409])
    await flushWaitUntil()
    const campaigns = (await env.DB.prepare('SELECT COUNT(*) AS n FROM email_campaigns').first<{ n: number }>())!.n
    expect(campaigns).toBe(1)
    for (const reader of readers) expect(calls.filter((c) => c.to === reader), reader).toHaveLength(1)
  })

  it('two daily runs at once send each reminder once', async () => {
    holdClock()
    noWaits()
    await quietOldReminders()
    const { addresses } = await paidEntrants(3)
    const calls = watchMail()
    await Promise.all([runDaily(), runDaily()])
    for (const to of addresses) expect(calls.filter((c) => c.to === to), to).toHaveLength(1)
    expect(calls.filter((c) => c.via === 'resend')).toEqual([])
  })
})

describe('the member delete and the stop, at their edges', () => {
  async function makeSend(by: string) {
    const made = await createListCampaign(env.DB, { listId: NEWSLETTER_LIST_ID, ...SAMPLE, createdBy: by, linkCheck: await linkKeyCheck(key()) })
    expect(made).not.toBeNull()
    return made!
  }

  it('takes the address out when the other account on it no longer has an active membership, and leaves it while one does', async () => {
    const admin = await seedAdmin()
    const shared = address('family')
    const leaving = await member(shared)
    await member(shared, { membershipStatus: 'expired' })
    const stays = address('stays')
    await member(stays)
    const made = await makeSend(admin)
    expect((await rowsOf(made.campaignId)).map((r) => r.email)).toContain(shared)
    expect((await invoke(memberDelete, { method: 'DELETE', as: admin, params: { id: leaving } })).status).toBe(200)
    const rows = await rowsOf(made.campaignId)
    expect(rows.map((r) => r.email)).not.toContain(shared)
    expect(rows.map((r) => r.email)).toContain(stays)
    expect(await campaignOf(made.campaignId)).toMatchObject({ total_recipients: rows.length, skipped_count: 1 })
  })

  it('leaves a row already sent or failed alone, and counts nothing for it', async () => {
    const admin = await seedAdmin()
    const [sentTo, failedTo] = [address('done'), address('done')]
    const [sentId, failedId] = [await member(sentTo), await member(failedTo)]
    const made = await makeSend(admin)
    await env.DB.prepare(`UPDATE email_campaign_recipients SET status = 'sent' WHERE campaign_id = ? AND email = ?`).bind(made.campaignId, sentTo).run()
    await env.DB.prepare(`UPDATE email_campaign_recipients SET status = 'failed', error = 'Sample words.' WHERE campaign_id = ? AND email = ?`).bind(made.campaignId, failedTo).run()
    const before = (await rowsOf(made.campaignId)).length
    for (const id of [sentId, failedId]) expect((await invoke(memberDelete, { method: 'DELETE', as: admin, params: { id } })).status).toBe(200)
    expect((await rowsOf(made.campaignId)).length).toBe(before)
    expect(await campaignOf(made.campaignId)).toMatchObject({ skipped_count: 0, total_recipients: before })
  })

  it('answers a second delete of the same member 404 and changes no row of the send', async () => {
    const admin = await seedAdmin()
    const gone = await member(address('gone'))
    await member(address('stays'))
    const made = await makeSend(admin)
    expect((await invoke(memberDelete, { method: 'DELETE', as: admin, params: { id: gone } })).status).toBe(200)
    const rows = await rowsOf(made.campaignId)
    const counters = await campaignOf(made.campaignId)
    expect((await invoke(memberDelete, { method: 'DELETE', as: admin, params: { id: gone } })).status).toBe(404)
    expect(await rowsOf(made.campaignId)).toEqual(rows)
    expect(await campaignOf(made.campaignId)).toEqual(counters)
  })

  it('a stopped newsletter swept again and again stays as it was: the counts never grow past its rows', async () => {
    const admin = await seedAdmin()
    for (let i = 0; i < 3; i += 1) await member(address('reader'))
    const made = await makeSend(admin)
    const [died] = await rowsOf(made.campaignId)
    await env.DB.prepare(`UPDATE email_campaign_recipients SET claimed_at = datetime('now', '-20 minutes'), sending_at = datetime('now', '-20 minutes'), attempts = 1 WHERE id = ?`).bind(died.id).run()
    await stopListCampaign(env.DB, NEWSLETTER_LIST_ID)
    const calls = watchMail()
    await sweepPendingCampaigns(bindings)
    const once = await campaignOf(made.campaignId)
    for (let run = 0; run < 3; run += 1) await sweepPendingCampaigns(bindings)
    expect(await campaignOf(made.campaignId)).toEqual(once)
    expect(calls).toEqual([])
    await countsAddUp(made.campaignId)
  })

  it('a stop with no newsletter sending changes nothing and sends nothing', async () => {
    const calls = watchMail()
    expect(await stopListCampaign(env.DB, NEWSLETTER_LIST_ID)).toBeNull()
    await sweepPendingCampaigns(bindings)
    expect(calls).toEqual([])
    expect(STOPPED_WORDS).toBe('Not sent: the send was stopped.')
  })

  it('the gate\'s words for an unread table and the stop\'s are plain words with no dash', () => {
    const dashes = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
    for (const words of [STOPPED_WORDS, GATE_UNREAD_WORDS, SES_TEST_ADMINS_ONLY]) expect(words).not.toMatch(dashes)
  })
})
