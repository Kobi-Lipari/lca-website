// test/integration/ses-events.test.ts
//
// WS16 step 8: POST /api/mail/ses-events, the receiver of Amazon's reports,
// through the real handler, the real check of SNS's signature and the real
// tables, in the Workers runtime the site runs in. Every message a case
// posts is signed by test/integration/helpers/sns.ts under a key made for
// the test run, around which it writes the certificate the harness's SNS
// catch point serves; nothing skips the check. The receiver is the one
// address on the site anyone on the internet can post to that writes to the
// do-not-send list, so the refusals come first, each held by counting the
// outside calls made and the statements the database was handed:
// - (a) a stranger's request, every way one could try it;
// - (b) safe twice and safe late: every write a second copy leaves as it
//   was, with every row of the four mail tables compared, and nothing for a
//   notification more than three hours old;
// - (c) the right person only: the address as the gate reads it, several
//   addresses, the address a bounced message was sent to and never one only
//   the bounce names, a contact made for an address never mailed, and the
//   list read from the tag the site itself set at the send;
// - (d) both signature versions, in this runtime;
// - the bounces and the reports that change nothing, what a spam report
//   stops and what it never stops, the confirmations, the certificate's
//   faults, a database that cannot be written, and the log lines.
// MAIL_LISTS_ON, MAIL_SENDER, WORKERS_PLAN and COMPLAINT_STOPS_OTHER_SENDERS
// are read through getters on the mocked functions/utils/mail/switches,
// mocked over the real module and set before every case, so no value the
// code ships with decides one. The pool binds a made-up topic in the
// account of twelve zeros, which is no one's. Every name, address, club and
// subject here is plainly made up.
import { env } from 'cloudflare:test'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NEWSLETTER_LIST_ID } from '../../domain/mail/lists'
import { onRequestPost as newsletterPost } from '../../functions/api/admin/mail/newsletter'
import { NOT_ACCEPTED, RECEIVER_LOG, TRY_AGAIN, onRequestOptions, onRequestPost } from '../../functions/api/mail/ses-events'
import { onRequestPost as registrationPost } from '../../functions/api/registrations'
import { openGate } from '../../functions/utils/mail/gate'
import { SNS_CERT_CACHE_MAX, SNS_MAX_AGE_MS, SNS_MAX_BODY_BYTES, keptCertificates, type SnsMessage } from '../../functions/utils/mail/sns'
import type { Env } from '../../functions/types'
import { quickPauses } from './campaignRuns'
import { seedAdmin, seedMailContact, seedMember, seedTournament } from './factories'
import { emailOutbox, fetchCount, flushWaitUntil, invoke, resetHarness, snsBehavior, snsCertificateFetches, snsConfirmations } from './harness'
import {
  SNS_TEST_HOST, TEST_TOPIC, certUrl, makeSigner, reportedTags, sesBounce, sesComplaint, sesOther, snsRequest, type MessageParts, type SnsSigner,
} from './helpers/sns'
import { countingDb } from './mailRuns'

const flags = vi.hoisted(() => ({ listsOn: true, sender: 'resend', plan: 'free', complaintStops: true }))
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
    get COMPLAINT_STOPS_OTHER_SENDERS() {
      return flags.complaintStops
    },
  }
})

const SUBJECT = 'Amazon SES Email Event Notification'
const SNS = `https://${SNS_TEST_HOST}`
/** A time every row is set back to before a second copy, so a write that touched a row would show. */
const EARLIER = '2026-11-01 10:00:00'
/** A newsletter's words, plainly made up. */
const SAMPLE = { subject: 'Sample newsletter one', bodyHtml: '<p>Example words for a sample newsletter.</p>' }
/** A club's own list, which part one has none of: not one of LCA's main mailers. */
const CLUB_LIST = 'club-example'
/** The address on another host a redirect from SNS's host names in the cases that answer one. */
const REDIRECTED = 'https://redirected.example/SimpleNotificationService-sample.pem'
/** A time this many minutes ago, in Amazon's form. */
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()
/** A time in Amazon's form written as datetime('now') writes one, as the receiver stores it. */
const asStored = (iso: string) => iso.slice(0, 19).replace('T', ' ')

let signer: SnsSigner
let seq = 0
/** An address of the harness's own kind, which every list may send to. */
const listAddress = (name: string) => `${name}-${++seq}@ses-events.test.lca`
/** An address at a documentation name, which event mail reaches. */
const eventAddress = (name: string) => `${name}-${++seq}@example.org`

/** A notification of the topic carrying one of Amazon SES's events, signed under the helper's key. */
const notify = (event: unknown, parts: MessageParts = {}, version: '1' | '2' = '2') => signer.sign({ Subject: SUBJECT, Message: JSON.stringify(event), ...parts }, version)

/** The message posted as SNS posts it. */
const post = (message: SnsMessage, opts: { env?: Partial<Env>; headers?: Record<string, string>; as?: string } = {}) =>
  invoke(onRequestPost, { ...snsRequest(message, opts.headers), env: opts.env, as: opts.as })

/** Every row of the four mail tables, in a fixed order. */
async function tables() {
  const all = async (sql: string) => (await env.DB.prepare(sql).all()).results
  return {
    doNotSend: await all('SELECT address, reason, detail, created_at FROM mail_do_not_send ORDER BY address'),
    contacts: await all('SELECT id, address, optional_off_at, complained_at, created_at FROM mail_contacts ORDER BY address'),
    choices: await all('SELECT contact_id, list_id, choice, source, updated_at FROM mail_list_choices ORDER BY contact_id, list_id'),
    lists: await all('SELECT id, kind, name, main_mailer, club_id, created_at FROM mail_lists ORDER BY id'),
  }
}

/** Delivers a message a second time, as SNS's retry would, every row's time set back first, and holds every row of the four tables unchanged by it. */
async function deliverAgain(message: SnsMessage): Promise<void> {
  await env.DB.batch([
    env.DB.prepare('UPDATE mail_do_not_send SET created_at = ?').bind(EARLIER),
    env.DB.prepare('UPDATE mail_contacts SET created_at = ?').bind(EARLIER),
    env.DB.prepare('UPDATE mail_list_choices SET updated_at = ?').bind(EARLIER),
  ])
  const before = await tables()
  const again = await post(message)
  expect(again.status).toBe(200)
  expect(await tables()).toEqual(before)
}

/** The contact the mail tables hold for an address, with its marks, or null. */
const contactOf = (address: string) =>
  env.DB.prepare('SELECT id, address, optional_off_at, complained_at FROM mail_contacts WHERE address = ?').bind(address)
    .first<{ id: string; address: string; optional_off_at: string | null; complained_at: string | null }>()

/** The person's choices, by list. */
const choicesOf = async (address: string) =>
  (await env.DB.prepare(`SELECT ch.list_id, ch.choice, ch.source FROM mail_list_choices ch JOIN mail_contacts c ON c.id = ch.contact_id WHERE c.address = ? ORDER BY ch.list_id`)
    .bind(address).all<{ list_id: string; choice: string; source: string }>()).results

/** What the gate says of one address for a kind of mail on a list, read as every send path reads it. */
async function gateSays(address: string, kind: 'event' | 'optional', listId?: string) {
  return (await openGate(env.DB, [address], listId)).refusal(address, kind, listId)
}

/** Every line the code wrote to the console during a case. */
function captureLogs(): string[] {
  const lines: string[] = []
  for (const method of ['log', 'warn', 'error'] as const) {
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
      lines.push(args.map(String).join(' '))
    })
  }
  return lines
}

/** A log line holds no address, no topic's name and no account number. */
function expectPlainLogs(lines: string[]): void {
  for (const line of lines) {
    expect(line, line).not.toMatch(/@|arn:aws|\b\d{12}\b|ses-events\.test\.lca|example\.org/)
  }
}

/** A registration confirmation for a member at this address, to a free event, and whether it reached the outbox. */
async function registrationReaches(address: string): Promise<boolean> {
  const player = await seedMember({ email: address, fullName: 'Player One' })
  const tournamentId = await seedTournament({ name: `Sample Winter Open ${++seq}`, sections: [{ name: 'Open', entryFee: 0 }] })
  const before = emailOutbox.length
  expect((await invoke(registrationPost, { method: 'POST', as: player, body: { tournamentId, section: 'Open' } })).status).toBe(201)
  return emailOutbox.slice(before).some((e) => e.to === address && e.subject.startsWith('You\'re registered:'))
}

/** A newsletter sent through Amazon SES by an LCA admin, run to its end; answers the outbox entries it made. */
async function sendNewsletter() {
  flags.sender = 'ses'
  flags.plan = 'paid'
  const admin = await seedAdmin()
  const before = emailOutbox.length
  const res = await invoke(newsletterPost, { as: admin, method: 'POST', body: SAMPLE })
  expect(res.status).toBe(201)
  await flushWaitUntil()
  return emailOutbox.slice(before)
}

/** The request SNS makes, as a Request of its own. */
function requestOf(message: SnsMessage): Request {
  const { method, headers, rawBody } = snsRequest(message)
  return new Request('https://www.louisianachess.org/api/mail/ses-events', { method, headers, body: rawBody })
}

/** The handler called with a request of its own, so a case can see afterwards whether the request's body was read. */
async function direct(handler: PagesFunction<Env>, request: Request) {
  const context = {
    request, env: env as unknown as Env, params: {}, data: {}, functionPath: '/api/mail/ses-events',
    waitUntil: () => {}, passThroughOnException: () => {}, next: async () => new Response(null, { status: 404 }),
  } as unknown as EventContext<Env, string, Record<string, unknown>>
  const response = await handler(context)
  return { response, bodyUsed: request.bodyUsed }
}

beforeAll(async () => {
  signer = await makeSigner()
})

beforeEach(async () => {
  resetHarness()
  flags.listsOn = true
  flags.sender = 'resend'
  flags.plan = 'free'
  flags.complaintStops = true
  snsBehavior.certificate = signer.pem
  // The timer controller is made before setTimeout is replaced, since making it calls setTimeout once.
  vi.useRealTimers()
  quickPauses()
  for (const table of ['email_campaign_recipients', 'email_campaigns', 'mail_list_choices', 'mail_contacts', 'mail_do_not_send']) {
    await env.DB.prepare(`DELETE FROM ${table}`).run()
  }
  await env.DB.prepare('DELETE FROM mail_lists WHERE id NOT IN (?, ?)').bind(NEWSLETTER_LIST_ID, 'lca-tournaments').run()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('(a) a stranger\'s request', () => {
  it('with the switches as shipped, answers 404 to both methods before the body is read, fetching and writing nothing, a well-signed bounce of the topic included', async () => {
    flags.listsOn = false
    flags.sender = 'resend'
    flags.plan = 'free'
    const bounce = await notify(sesBounce([eventAddress('dead')]))
    const counted = countingDb()
    const res = await post(bounce, { env: { DB: counted.db } })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Not found' })
    expect(res.response.headers.get('Cache-Control')).toBe('no-store')
    const options = await invoke(onRequestOptions, { method: 'OPTIONS' })
    expect(options.status).toBe(404)
    expect(await options.json()).toEqual({ error: 'Not found' })
    const { response, bodyUsed } = await direct(onRequestPost, requestOf(bounce))
    expect(response.status).toBe(404)
    expect(bodyUsed).toBe(false)
    expect(fetchCount).toBe(0)
    expect(counted.ran).toEqual([])
    expect((await tables()).doNotSend).toEqual([])
  })

  it('with the rules on and no topic bound, answers 404 the same way; with a topic, the rules are on by either constant', async () => {
    const bounce = await notify(sesBounce([eventAddress('dead')]))
    const bound = await direct(onRequestPost, requestOf(bounce))
    expect([bound.response.status, bound.bodyUsed]).toEqual([200, true])
    for (const unbound of [{ SES_SNS_TOPIC_ARN: '' }, { SES_SNS_TOPIC_ARN: undefined }]) {
      const res = await post(bounce, { env: unbound })
      expect(res.status).toBe(404)
      expect(await res.json()).toEqual({ error: 'Not found' })
      expect((await invoke(onRequestOptions, { method: 'OPTIONS', env: unbound })).status).toBe(404)
    }
    expect((await invoke(onRequestOptions, { method: 'OPTIONS' })).status).toBe(204)
    // MAIL_LISTS_ON unset and Amazon SES sending: the rules are on, so the receiver is.
    flags.listsOn = false
    flags.sender = 'ses'
    flags.plan = 'paid'
    expect((await post(await notify(sesBounce([eventAddress('dead')])))).status).toBe(200)
    expect(snsCertificateFetches.length).toBe(2)
  })

  it('refuses a body that is not JSON, or not a message whose fields are strings, before anything is fetched or written', async () => {
    const good = await notify(sesBounce([eventAddress('dead')]))
    const bodies = ['not json', '', '[]', '"text"', 'null', '{}', JSON.stringify({ ...good, TopicArn: 7 }), JSON.stringify({ ...good, Signature: null }), `${JSON.stringify(good)}x`]
    const counted = countingDb()
    for (const rawBody of bodies) {
      const res = await invoke(onRequestPost, { method: 'POST', rawBody, headers: { 'x-amz-sns-message-type': 'Notification' }, env: { DB: counted.db } })
      expect(res.status, rawBody.slice(0, 20)).toBe(400)
      expect(await res.json()).toEqual({ error: NOT_ACCEPTED })
    }
    expect(fetchCount).toBe(0)
    expect(counted.ran).toEqual([])
  })

  it(`refuses a body longer than ${SNS_MAX_BODY_BYTES.toLocaleString('en-US')} bytes, SNS's own limit for a message, by its declared length and by its real length, without parsing it`, async () => {
    const parse = vi.spyOn(JSON, 'parse')
    /** The parses of a body this long or longer: the runtime parses its own small messages too, which are not counted. */
    const parsesOf = (length: number) => parse.mock.calls.filter(([text]) => typeof text === 'string' && text.length >= length)
    const counted = countingDb()
    const good = await notify(sesBounce([eventAddress('dead')]))
    const declared = await post(good, { env: { DB: counted.db }, headers: { 'Content-Length': String(SNS_MAX_BODY_BYTES + 1) } })
    expect(declared.status).toBe(400)
    const long = await invoke(onRequestPost, { method: 'POST', rawBody: 'x'.repeat(SNS_MAX_BODY_BYTES + 1), headers: { 'x-amz-sns-message-type': 'Notification' }, env: { DB: counted.db } })
    expect(long.status).toBe(400)
    expect(parsesOf(SNS_MAX_BODY_BYTES + 1)).toEqual([])
    // At the limit a body is read, and this one, not JSON, is then refused as one.
    const atLimit = await invoke(onRequestPost, { method: 'POST', rawBody: 'x'.repeat(SNS_MAX_BODY_BYTES), headers: { 'x-amz-sns-message-type': 'Notification' }, env: { DB: counted.db } })
    expect(atLimit.status).toBe(400)
    expect(parsesOf(SNS_MAX_BODY_BYTES)).toHaveLength(1)
    parse.mockRestore()
    expect(fetchCount).toBe(0)
    expect(counted.ran).toEqual([])
  })

  it('refuses another topic with nothing fetched at all, though the message is well signed and its header names the site\'s topic', async () => {
    const counted = countingDb()
    for (const TopicArn of ['arn:aws:sns:us-east-1:000000000000:another-topic', `${TEST_TOPIC} `, TEST_TOPIC.toUpperCase(), 'arn:aws:sns:us-west-2:000000000000:lca-mail-events']) {
      const message = await notify(sesBounce([eventAddress('dead')]), { TopicArn })
      const res = await post(message, { env: { DB: counted.db }, headers: { 'x-amz-sns-topic-arn': TEST_TOPIC } })
      expect(res.status, TopicArn).toBe(400)
    }
    expect(fetchCount).toBe(0)
    expect(counted.ran).toEqual([])
  })

  it('refuses a header that names another type, or none, before anything is fetched', async () => {
    const counted = countingDb()
    const message = await notify(sesBounce([eventAddress('dead')]))
    // A header's spaces at its ends are not part of its value, so 'Notification ' reads as 'Notification' and is not tried.
    for (const type of ['SubscriptionConfirmation', 'notification', 'NOTIFICATION', '', 'UnsubscribeConfirmation']) {
      expect((await post(message, { env: { DB: counted.db }, headers: { 'x-amz-sns-message-type': type } })).status, type).toBe(400)
    }
    const none = { 'Content-Type': 'text/plain; charset=UTF-8', 'x-amz-sns-topic-arn': TEST_TOPIC }
    expect((await invoke(onRequestPost, { method: 'POST', rawBody: JSON.stringify(message), headers: none, env: { DB: counted.db } })).status).toBe(400)
    expect(fetchCount).toBe(0)
    expect(counted.ran).toEqual([])
  })

  it('refuses a certificate address on any host but SNS\'s for the region, over http, with a port, a user, a query or a fragment, an encoded dot or an upper-case host, with nothing fetched', async () => {
    const counted = countingDb()
    const addresses = [
      'https://evil.example/SimpleNotificationService-sample.pem', 'https://sns.us-west-2.amazonaws.com/SimpleNotificationService-sample.pem',
      'http://sns.us-east-1.amazonaws.com/SimpleNotificationService-sample.pem', `${SNS}:443/SimpleNotificationService-sample.pem`, `${SNS}:8443/a.pem`,
      'https://user@sns.us-east-1.amazonaws.com/a.pem', 'https://user:pw@sns.us-east-1.amazonaws.com/a.pem', 'https://sns.us-east-1.amazonaws.com@evil.example/a.pem',
      'https://evil.example?@sns.us-east-1.amazonaws.com/a.pem', 'https://evil.example#@sns.us-east-1.amazonaws.com/a.pem',
      'https://sns%2eus-east-1.amazonaws.com/a.pem', 'https://SNS.US-EAST-1.AMAZONAWS.COM/a.pem', 'https://sns.us-east-1.amazonaws.com./a.pem',
      `${SNS}/a.pem?x=1`, `${SNS}/a.pem#f`, `${SNS}/a.PEM`, `${SNS}/../a.pem`, 'https://sns.us-east-1.amazonaws.com\\a.pem', 'https://sns.us-east-1.amazonaws.com.evil.example/a.pem',
    ]
    for (const SigningCertURL of addresses) {
      const res = await post(await notify(sesBounce([eventAddress('dead')]), { SigningCertURL }), { env: { DB: counted.db } })
      expect(res.status, SigningCertURL).toBe(400)
    }
    expect(fetchCount).toBe(0)
    expect(snsCertificateFetches).toEqual([])
    expect(counted.ran).toEqual([])
  })

  it('refuses a signature that is not base64 or of the wrong length, and a version other than 1 and 2, with nothing fetched', async () => {
    const counted = countingDb()
    const message = await notify(sesBounce([eventAddress('dead')]))
    for (const Signature of ['', 'not base64 at all!', message.Signature.slice(4), btoa('x'.repeat(255)), btoa('x'.repeat(300)), `${message.Signature.slice(0, 100)}\n${message.Signature.slice(100)}`]) {
      expect((await post({ ...message, Signature }, { env: { DB: counted.db } })).status, Signature.slice(0, 20)).toBe(400)
    }
    for (const SignatureVersion of ['3', '0', '', '2.0', ' 1']) {
      expect((await post({ ...message, SignatureVersion }, { env: { DB: counted.db } })).status, SignatureVersion).toBe(400)
    }
    expect(fetchCount).toBe(0)
    expect(counted.ran).toEqual([])
  })

  it('refuses a Timestamp that cannot be read as a time as a bad request, with nothing fetched or written', async () => {
    const counted = countingDb()
    for (const Timestamp of ['yesterday', '2026-11-12 03:04:05', '2026-02-30T00:00:00.000Z', '', '1778547845678']) {
      const res = await post(await notify(sesBounce([eventAddress('dead')]), { Timestamp }), { env: { DB: counted.db } })
      expect(res.status, Timestamp).toBe(400)
      expect(await res.json()).toEqual({ error: NOT_ACCEPTED })
    }
    expect(fetchCount).toBe(0)
    expect(counted.ran).toEqual([])
  })

  it('refuses a confirmation whose SubscribeURL is on another host or over http, with no GET and no certificate fetched', async () => {
    for (const SubscribeURL of [
      `https://evil.example/?Action=ConfirmSubscription&TopicArn=${TEST_TOPIC}&Token=t`, `http://${SNS_TEST_HOST}/?Action=ConfirmSubscription&Token=t`,
      `https://sns.us-west-2.amazonaws.com/?Action=ConfirmSubscription&Token=t`, `https://${SNS_TEST_HOST}@evil.example/?Action=ConfirmSubscription`,
    ]) {
      const res = await post(await signer.sign({ Type: 'SubscriptionConfirmation', SubscribeURL }))
      expect(res.status, SubscribeURL).toBe(400)
    }
    expect(snsConfirmations).toEqual([])
    expect(fetchCount).toBe(0)
  })

  it('refuses a forged signature once it has fetched the certificate from Amazon\'s own host, writing nothing', async () => {
    const counted = countingDb()
    const forged = await signer.forge({ Subject: SUBJECT, Message: JSON.stringify(sesBounce([eventAddress('dead')])) })
    const res = await post(forged, { env: { DB: counted.db } })
    expect(res.status).toBe(400)
    expect(snsCertificateFetches).toEqual([forged.SigningCertURL])
    expect(fetchCount).toBe(1)
    expect(counted.ran).toEqual([])
    // A message changed after it was signed fails the same way.
    const signed = await notify(sesBounce([eventAddress('alive')]))
    const changed = { ...signed, Message: JSON.stringify(sesBounce([eventAddress('victim')])) }
    expect((await post(changed, { env: { DB: counted.db } })).status).toBe(400)
    expect(counted.ran).toEqual([])
  })

  it('answers every refusal in the same few words, with no-store, whatever check refused it', async () => {
    const message = await notify(sesBounce([eventAddress('dead')]))
    const refusals = [
      await invoke(onRequestPost, { method: 'POST', rawBody: 'not json', headers: { 'x-amz-sns-message-type': 'Notification' } }),
      await post({ ...message, TopicArn: 'arn:aws:sns:us-east-1:000000000000:another-topic' }),
      await post(message, { headers: { 'x-amz-sns-message-type': 'SubscriptionConfirmation' } }),
      await post({ ...message, SignatureVersion: '3' }),
      await post({ ...message, SigningCertURL: 'https://evil.example/a.pem' }),
      await post({ ...message, Timestamp: 'yesterday' }),
      await post(await signer.forge({ Message: '{}' })),
    ]
    for (const res of refusals) {
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: NOT_ACCEPTED })
      expect(res.response.headers.get('Cache-Control')).toBe('no-store')
    }
  })

  it('opens nothing to a session: an LCA admin\'s and a member\'s sign-in change no answer, and the receiver asks the sign-in service nothing', async () => {
    const admin = await seedAdmin()
    const member = await seedMember({ fullName: 'Player One' })
    const forged = await signer.forge({ Message: JSON.stringify(sesBounce([eventAddress('dead')])) })
    expect((await post(forged, { as: admin })).status).toBe(400)
    const address = eventAddress('dead')
    const good = await notify(sesBounce([address]))
    expect((await post(good, { as: member })).status).toBe(200)
    // Only the two certificates were fetched: no call to the sign-in service.
    expect(fetchCount).toBe(2)
    expect(snsCertificateFetches).toHaveLength(2)
    expect((await tables()).doNotSend.map((r) => r.address)).toEqual([address])
  })

  it('lets a caller who knows the topic\'s name make one fetch of a certificate from Amazon\'s own host a request at most, write nothing, and grow the kept certificates no further than their cap', async () => {
    const counted = countingDb()
    const tries = SNS_CERT_CACHE_MAX * 3
    for (let i = 0; i < tries; i++) {
      // A stranger can name any path on SNS's host and cannot sign, so each try costs one fetch and is refused.
      const res = await post(await signer.forge({ Message: JSON.stringify(sesBounce([eventAddress('victim')])) }), { env: { DB: counted.db } })
      expect(res.status).toBe(400)
      expect(keptCertificates().length).toBeLessThanOrEqual(SNS_CERT_CACHE_MAX)
    }
    expect(snsCertificateFetches).toHaveLength(tries)
    expect(fetchCount).toBe(tries)
    expect(counted.ran).toEqual([])
    // Under a certificate already kept a try costs no fetch at all.
    const url = certUrl()
    expect((await post(await notify(sesBounce([eventAddress('dead')]), { SigningCertURL: url }))).status).toBe(200)
    const fetched = snsCertificateFetches.length
    expect((await post(await signer.forge({ Message: '{}', SigningCertURL: url }))).status).toBe(400)
    expect(snsCertificateFetches).toHaveLength(fetched)
  })
})

describe('(b) safe twice, and safe late', () => {
  it('writes for a permanent bounce one row, the address, \'bounce\', its kind and the time, and nothing else; the same notification again changes no row; and the address gets no more mail', async () => {
    const address = eventAddress('dead')
    const message = await notify(sesBounce([address]))
    const res = await post(message)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true })
    const after = await tables()
    expect(after.doNotSend).toHaveLength(1)
    const [row] = after.doNotSend as Array<{ address: string; reason: string; detail: string; created_at: string }>
    expect([row.address, row.reason, row.detail]).toEqual([address, 'bounce', 'General'])
    expect(Math.abs(Date.parse(`${row.created_at.replace(' ', 'T')}Z`) - Date.now())).toBeLessThan(60_000)
    // Nothing else of the notification: no contact, no choice, and no diagnostic code anywhere.
    expect([after.contacts, after.choices]).toEqual([[], []])
    expect(JSON.stringify(after)).not.toMatch(/diagnostic|5\.1\.1|sample words|sender@example\.org|Sample newsletter one/)
    await deliverAgain(message)
    expect(((await tables()).doNotSend[0] as { created_at: string }).created_at).toBe(EARLIER)
    expect(await registrationReaches(address)).toBe(false)
    expect(await registrationReaches(eventAddress('alive'))).toBe(true)
  })

  it('answers 200 and changes nothing for a notification more than three hours old by its signed Timestamp, so a stored copy cannot put a cleared address back', async () => {
    const address = eventAddress('cleared')
    const at = (ms: number) => new Date(Date.now() - ms).toISOString()
    expect((await post(await notify(sesBounce([address]), { Timestamp: at(SNS_MAX_AGE_MS - 60_000) })))).toMatchObject({ status: 200 })
    expect((await tables()).doNotSend).toHaveLength(1)
    // An LCA admin clears the address, as WS16 step 9's list does, and a copy more than three hours old comes again.
    await env.DB.prepare('DELETE FROM mail_do_not_send WHERE address = ?').bind(address).run()
    const counted = countingDb()
    const old = await post(await notify(sesBounce([address]), { Timestamp: at(SNS_MAX_AGE_MS + 60_000) }), { env: { DB: counted.db } })
    expect(old.status).toBe(200)
    expect(await old.json()).toEqual({ received: true })
    expect(counted.ran).toEqual([])
    expect((await tables()).doNotSend).toEqual([])
  })

  it('keeps a spam report\'s mark at its latest report, so a report delivered late never moves it back and a second copy changes nothing', async () => {
    const address = listAddress('reader')
    const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString()
    const newerAt = iso(20 * 60_000)
    const newer = await notify(sesComplaint([address], { timestamp: newerAt }))
    expect((await post(newer)).status).toBe(200)
    const mark = (await contactOf(address))!.complained_at
    // The report's own time, in the form datetime('now') writes, as the gate compares it.
    expect(mark).toBe(newerAt.slice(0, 19).replace('T', ' '))
    const older = await notify(sesComplaint([address], { timestamp: iso(90 * 60_000) }))
    expect((await post(older)).status).toBe(200)
    expect((await contactOf(address))!.complained_at).toBe(mark)
    await deliverAgain(newer)
    await deliverAgain(older)
    expect((await contactOf(address))!.complained_at).toBe(mark)
  })
})

describe('(c) the right person only', () => {
  it('writes the address Amazon names as the gate reads it, capitals, a plus tag and spaces around it, and the gate then refuses that person\'s next email and no one else\'s', async () => {
    const n = ++seq
    const named = `  Player.One+News${n}@Example.ORG  `
    const stored = `player.one+news${n}@example.org`
    expect((await post(await notify(sesBounce([named])))).status).toBe(200)
    expect((await tables()).doNotSend.map((r) => r.address)).toEqual([stored])
    for (const same of [stored, `PLAYER.ONE+NEWS${n}@EXAMPLE.ORG`, ` player.one+news${n}@example.org`]) expect(await gateSays(same, 'event'), same).toBe('do_not_send')
    for (const other of [`player.one${n}@example.org`, `player.one+other${n}@example.org`, `player.two+news${n}@example.org`]) expect(await gateSays(other, 'event'), other).toBeNull()
    expect(await registrationReaches(`Player.One+News${n}@example.org`)).toBe(false)
    expect(await registrationReaches(`player.one${n}@example.org`)).toBe(true)
  })

  it('writes each address a bounce or a report names, once, and leaves out an address mail cannot reach', async () => {
    const [a, b] = [eventAddress('first'), eventAddress('second')]
    const bounce = await notify(sesBounce([a, b.toUpperCase(), a, 'not an address', 'guest-1@walkin.lca.invalid', '']))
    expect((await post(bounce)).status).toBe(200)
    expect((await tables()).doNotSend.map((r) => r.address)).toEqual([a, b].sort())
    await deliverAgain(bounce)
    const [c, d] = [listAddress('third'), listAddress('fourth')]
    const report = await notify(sesComplaint([c, d], { tags: reportedTags({ kind: 'optional', list: NEWSLETTER_LIST_ID }) }))
    expect((await post(report)).status).toBe(200)
    for (const address of [c, d]) expect(await choicesOf(address), address).toEqual([{ list_id: NEWSLETTER_LIST_ID, choice: 'out', source: 'complaint' }])
    await deliverAgain(report)
  })

  it('stops the address the site sent the message to, whatever the bounce names: neither a forwarded mailbox the receiving server names nor a member\'s address a stranger\'s server names is written', async () => {
    // The site mails one address; the server that answers names its own Final-Recipient: the mailbox it forwarded to, or any address it likes.
    const [sentTo, forwarded, member] = [eventAddress('alumni'), eventAddress('forwarded'), eventAddress('member')]
    const bounce = await notify(sesBounce([forwarded, member.toUpperCase()], { destination: [`  ${sentTo.toUpperCase()} `] }))
    const lines = captureLogs()
    expect((await post(bounce)).status).toBe(200)
    expect((await tables()).doNotSend).toEqual([expect.objectContaining({ address: sentTo, reason: 'bounce', detail: 'General' })])
    expect(lines).toEqual(['mail receiver: 1 bounced address(es) and 0 spam report address(es) written'])
    await deliverAgain(bounce)
    expect(await gateSays(sentTo, 'event')).toBe('do_not_send')
    for (const other of [forwarded, member]) expect(await gateSays(other, 'event'), other).toBeNull()
    expect(await registrationReaches(sentTo)).toBe(false)
    expect(await registrationReaches(member)).toBe(true)
  })

  it('for a message of several recipients, which the site never sends, writes each address the bounce names that the send\'s record names too, and for one whose record names no one, nothing', async () => {
    const [one, two, named] = [eventAddress('one'), eventAddress('two'), eventAddress('named')]
    const several = await notify(sesBounce([two.toUpperCase(), named], { destination: [one, two] }))
    expect((await post(several)).status).toBe(200)
    expect((await tables()).doNotSend.map((r) => r.address)).toEqual([two])
    await deliverAgain(several)
    const counted = countingDb()
    for (const destination of [[], undefined, null, eventAddress('text'), [7], ['guest-1@walkin.lca.invalid']]) {
      const event = sesBounce([eventAddress('dead')])
      ;(event.mail as { destination?: unknown }).destination = destination
      expect((await post(await notify(event), { env: { DB: counted.db } })).status, JSON.stringify(destination)).toBe(200)
    }
    expect(counted.ran).toEqual([])
    expect((await tables()).doNotSend.map((r) => r.address)).toEqual([two])
  })

  it('makes a contact for an address the site never mailed, holding its address, the list\'s choice and the mark, and nothing more', async () => {
    const address = listAddress('stranger')
    const report = await notify(sesComplaint([address], { tags: reportedTags({ kind: 'optional', list: NEWSLETTER_LIST_ID }) }))
    expect((await post(report)).status).toBe(200)
    const after = await tables()
    expect(after.contacts).toHaveLength(1)
    const contact = after.contacts[0] as Record<string, unknown>
    expect(Object.keys(contact).sort()).toEqual(['address', 'complained_at', 'created_at', 'id', 'optional_off_at'])
    expect(contact.address).toBe(address)
    expect(contact.id).toMatch(/^[0-9a-f]{32}$/)
    expect(contact.optional_off_at).toBeNull()
    expect(contact.complained_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    expect(after.choices).toEqual([expect.objectContaining({ contact_id: contact.id, list_id: NEWSLETTER_LIST_ID, choice: 'out', source: 'complaint' })])
    expect(after.doNotSend).toEqual([])
    expect(JSON.stringify(after)).not.toMatch(/Sample Mail Reader|abuse|sender@example\.org|Sample newsletter one/)
  })

  it('reads the list a report was pressed on from the tag the site itself set at the send, and a tag naming no list changes no list', async () => {
    const reader = listAddress('reader')
    await seedMember({ email: reader, fullName: 'Player One' })
    const sent = (await sendNewsletter()).find((e) => e.to === reader)!
    expect(sent.tags).toEqual({ kind: 'optional', list: NEWSLETTER_LIST_ID })
    expect((await post(await notify(sesComplaint([reader], { tags: reportedTags(sent.tags) }))))).toMatchObject({ status: 200 })
    expect(await choicesOf(reader)).toEqual([{ list_id: NEWSLETTER_LIST_ID, choice: 'out', source: 'complaint' }])
    const other = listAddress('other')
    const before = (await tables()).lists
    expect((await post(await notify(sesComplaint([other], { tags: reportedTags({ kind: 'optional', list: 'sample-no-such-list' }) }))))).toMatchObject({ status: 200 })
    expect(await choicesOf(other)).toEqual([])
    expect((await contactOf(other))!.complained_at).not.toBeNull()
    expect((await tables()).lists).toEqual(before)
  })
})

describe('(d) both signature versions, in the Workers runtime', () => {
  it('takes a bounce signed under version 1, RSASSA-PKCS1-v1_5 with SHA-1, and one under version 2, with SHA-256', async () => {
    const [one, two] = [eventAddress('one'), eventAddress('two')]
    expect((await post(await notify(sesBounce([one]), {}, '1'))).status).toBe(200)
    expect((await post(await notify(sesBounce([two]), {}, '2'))).status).toBe(200)
    expect((await tables()).doNotSend.map((r) => r.address)).toEqual([one, two].sort())
    // A version 1 message under another key is refused as any forgery is.
    expect((await post(await signer.forge({ Message: JSON.stringify(sesBounce([eventAddress('three')])) }, '1'))).status).toBe(400)
  })
})

describe('the events that change nothing', () => {
  it('writes nothing for a transient or an undetermined bounce, Amazon\'s validation guess, or any other kind of event', async () => {
    const address = eventAddress('alive')
    const events = [
      sesBounce([address], { type: 'Transient', subType: 'MailboxFull' }), sesBounce([address], { type: 'Undetermined', subType: 'Undetermined' }),
      sesBounce([address], { subType: 'EmailValidationSuppressed' }),
      ...['Delivery', 'Send', 'Reject', 'Open', 'Click', 'Rendering Failure', 'DeliveryDelay', 'Subscription'].map((kind) => sesOther([address], kind)),
    ]
    const counted = countingDb()
    for (const event of events) {
      const res = await post(await notify(event), { env: { DB: counted.db } })
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ received: true })
    }
    expect(counted.ran).toEqual([])
    expect(await tables()).toMatchObject({ doNotSend: [], contacts: [], choices: [] })
  })

  it('writes nothing for a report that says the message is not spam, in any letter case', async () => {
    const address = listAddress('rescued')
    const counted = countingDb()
    for (const feedbackType of ['not-spam', 'NOT-SPAM']) {
      const report = sesComplaint([address], { feedbackType, tags: reportedTags({ kind: 'optional', list: NEWSLETTER_LIST_ID }) })
      expect((await post(await notify(report), { env: { DB: counted.db } })).status).toBe(200)
    }
    expect(counted.ran).toEqual([])
    expect(await contactOf(address)).toBeNull()
  })

  it('writes nothing for a report Amazon made itself, of an address already on its own suppression list, and reads one whose subtype is null or missing as the person\'s own', async () => {
    const tags = reportedTags({ kind: 'optional', list: NEWSLETTER_LIST_ID })
    const suppressed = listAddress('suppressed')
    const counted = countingDb()
    for (const subType of ['OnAccountSuppressionList', 'OnTenantSuppressionList']) {
      expect((await post(await notify(sesComplaint([suppressed], { subType, tags })), { env: { DB: counted.db } })).status, subType).toBe(200)
    }
    expect(counted.ran).toEqual([])
    expect(await contactOf(suppressed)).toBeNull()
    // Amazon writes null for the ordinary report; a report with no subtype at all is read the same way.
    const [plain, bare] = [listAddress('plain'), listAddress('bare')]
    const missing = sesComplaint([bare], { tags })
    delete (missing.complaint as { complaintSubType?: unknown }).complaintSubType
    for (const report of [sesComplaint([plain], { subType: null, tags }), missing]) expect((await post(await notify(report))).status).toBe(200)
    for (const address of [plain, bare]) {
      expect(await choicesOf(address), address).toEqual([{ list_id: NEWSLETTER_LIST_ID, choice: 'out', source: 'complaint' }])
      expect((await contactOf(address))!.complained_at, address).not.toBeNull()
    }
  })

  it('leaves an event of another account\'s mail unread, and an event with no kind or no mail, or a message that is not an event', async () => {
    const address = eventAddress('dead')
    const counted = countingDb()
    const lines = captureLogs()
    for (const message of [
      JSON.stringify(sesBounce([address], { account: '111111111111' })), JSON.stringify({ ...sesBounce([address]), eventType: undefined }),
      JSON.stringify({ ...sesBounce([address]), mail: undefined }), 'Sample words published to the topic by hand', '[]', 'null',
    ]) {
      const res = await post(await signer.sign({ Subject: SUBJECT, Message: message }), { env: { DB: counted.db } })
      expect(res.status, message.slice(0, 30)).toBe(200)
    }
    expect(counted.ran).toEqual([])
    expect((await tables()).doNotSend).toEqual([])
    expect(lines.filter((l) => l.includes('left unread'))).toHaveLength(6)
  })

  it('reads a bounce and a report an identity sends, whose kind is notificationType, as it reads the configuration set\'s', async () => {
    const dead = eventAddress('dead')
    const reader = listAddress('reader')
    expect((await post(await notify(sesBounce([dead], { kind: 'notificationType' })))).status).toBe(200)
    expect((await post(await notify(sesComplaint([reader], { kind: 'notificationType', tags: {} }))))).toMatchObject({ status: 200 })
    expect((await tables()).doNotSend.map((r) => r.address)).toEqual([dead])
    expect((await contactOf(reader))!.complained_at).not.toBeNull()
    expect(await choicesOf(reader)).toEqual([])
  })
})

describe('what a spam report stops, and what it never stops', () => {
  it('stops the newsletter it was pressed on, with the mark; the next newsletter leaves the person out, event mail still comes, and the same report again changes nothing', async () => {
    const reader = listAddress('reader')
    const stays = listAddress('stays')
    for (const email of [reader, stays]) await seedMember({ email, fullName: 'Player One' })
    const sent = (await sendNewsletter()).find((e) => e.to === reader)!
    const report = await notify(sesComplaint([reader], { tags: reportedTags(sent.tags) }))
    expect((await post(report)).status).toBe(200)
    expect(await choicesOf(reader)).toEqual([{ list_id: NEWSLETTER_LIST_ID, choice: 'out', source: 'complaint' }])
    const contact = (await contactOf(reader))!
    expect(contact.complained_at).not.toBeNull()
    expect(contact.optional_off_at).toBeNull()
    await deliverAgain(report)
    const next = await sendNewsletter()
    expect(next.map((e) => e.to)).not.toContain(reader)
    expect(next.map((e) => e.to)).toContain(stays)
    expect(await gateSays(reader, 'optional', NEWSLETTER_LIST_ID)).toBe('opted_out')
    expect(await gateSays(reader, 'event')).toBeNull()
    expect(await registrationReaches(reader)).toBe(true)
  })

  it('with COMPLAINT_STOPS_OTHER_SENDERS off, writes the list\'s choice alone', async () => {
    flags.complaintStops = false
    const reader = listAddress('reader')
    const report = await notify(sesComplaint([reader], { tags: reportedTags({ kind: 'optional', list: NEWSLETTER_LIST_ID }) }))
    expect((await post(report)).status).toBe(200)
    expect(await choicesOf(reader)).toEqual([{ list_id: NEWSLETTER_LIST_ID, choice: 'out', source: 'complaint' }])
    expect((await contactOf(reader))!.complained_at).toBeNull()
    await deliverAgain(report)
  })

  it('on event mail, with no list tag, writes the mark alone: the newsletter, a main mailer, still goes to the person, and event mail still comes; with the setting off, nothing at all', async () => {
    const reader = listAddress('reader')
    await seedMember({ email: reader, fullName: 'Player One' })
    const report = await notify(sesComplaint([reader], { tags: reportedTags({ kind: 'event' }) }))
    expect((await post(report)).status).toBe(200)
    expect((await contactOf(reader))!.complained_at).not.toBeNull()
    expect(await choicesOf(reader)).toEqual([])
    await deliverAgain(report)
    expect((await sendNewsletter()).map((e) => e.to)).toContain(reader)
    expect(await registrationReaches(reader)).toBe(true)
    flags.complaintStops = false
    const quiet = listAddress('quiet')
    const counted = countingDb()
    expect((await post(await notify(sesComplaint([quiet], { tags: reportedTags({ kind: 'event' }) })), { env: { DB: counted.db } })).status).toBe(200)
    expect(counted.ran).toEqual([])
    expect(await contactOf(quiet)).toBeNull()
  })

  it('stops a list that is not a main mailer by the mark until the person\'s own newer \'in\' on it; a report after that stops it again, and an older one delivered late does not', async () => {
    await env.DB.prepare(`INSERT INTO mail_lists (id, kind, name, main_mailer, club_id) VALUES (?, 'club', 'Example Chess Club news', 0, NULL)`).bind(CLUB_LIST).run()
    const person = listAddress('member')
    const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()
    const stored = (iso: string) => iso.slice(0, 19).replace('T', ' ')
    expect((await post(await notify(sesComplaint([person], { timestamp: ago(120), tags: reportedTags({ kind: 'event' }) }))))).toMatchObject({ status: 200 })
    expect(await gateSays(person, 'optional', CLUB_LIST)).toBe('opted_out')
    expect(await gateSays(person, 'optional', NEWSLETTER_LIST_ID)).toBeNull()
    // The person turns the club's list back on an hour ago, as the preferences page writes it.
    const contact = (await contactOf(person))!
    await env.DB.prepare(`INSERT INTO mail_list_choices (contact_id, list_id, choice, source, updated_at) VALUES (?, ?, 'in', 'preferences', ?)`).bind(contact.id, CLUB_LIST, stored(ago(60))).run()
    expect(await gateSays(person, 'optional', CLUB_LIST)).toBeNull()
    // A report older than the person's choice, delivered late, leaves the list on.
    expect((await post(await notify(sesComplaint([person], { timestamp: ago(90), tags: reportedTags({ kind: 'event' }) }))))).toMatchObject({ status: 200 })
    expect(await gateSays(person, 'optional', CLUB_LIST)).toBeNull()
    // A new report, after the choice, stops it again.
    const newerAt = ago(30)
    expect((await post(await notify(sesComplaint([person], { timestamp: newerAt, tags: reportedTags({ kind: 'event' }) }))))).toMatchObject({ status: 200 })
    expect(await gateSays(person, 'optional', CLUB_LIST)).toBe('opted_out')
    expect((await contactOf(person))!.complained_at).toBe(stored(newerAt))
  })

  it('leaves the person\'s own newer \'in\' on the list a report was pressed on, for a report made before it and delivered after it, the mark still written', async () => {
    const reader = listAddress('reader')
    await seedMailContact({ address: reader, choices: { [NEWSLETTER_LIST_ID]: { choice: 'in', source: 'preferences', at: asStored(minutesAgo(10)) } } })
    const reportedAt = minutesAgo(40)
    expect((await post(await notify(sesComplaint([reader], { timestamp: reportedAt, tags: reportedTags({ kind: 'optional', list: NEWSLETTER_LIST_ID }) }))))).toMatchObject({ status: 200 })
    expect(await choicesOf(reader)).toEqual([{ list_id: NEWSLETTER_LIST_ID, choice: 'in', source: 'preferences' }])
    expect(await gateSays(reader, 'optional', NEWSLETTER_LIST_ID)).toBeNull()
    expect((await contactOf(reader))!.complained_at).toBe(asStored(reportedAt))
  })

  it('leaves the \'in\' when a second copy of one report comes after the person turned the list back on', async () => {
    await env.DB.prepare(`INSERT INTO mail_lists (id, kind, name, main_mailer, club_id) VALUES (?, 'club', 'Example Chess Club news', 0, NULL)`).bind(CLUB_LIST).run()
    const person = listAddress('member')
    const report = await notify(sesComplaint([person], { timestamp: minutesAgo(30), tags: reportedTags({ kind: 'optional', list: CLUB_LIST }) }))
    expect((await post(report)).status).toBe(200)
    expect(await choicesOf(person)).toEqual([{ list_id: CLUB_LIST, choice: 'out', source: 'complaint' }])
    expect(await gateSays(person, 'optional', CLUB_LIST)).toBe('opted_out')
    // The person turns the club's list back on, as the preferences page writes it for a person with a report's mark.
    const contact = (await contactOf(person))!
    await env.DB.prepare(`UPDATE mail_list_choices SET choice = 'in', source = 'preferences', updated_at = datetime('now') WHERE contact_id = ? AND list_id = ?`).bind(contact.id, CLUB_LIST).run()
    expect(await gateSays(person, 'optional', CLUB_LIST)).toBeNull()
    // SNS delivers the same report again; no row's time is set back first, since that would make the 'in' older.
    const before = await tables()
    expect((await post(report)).status).toBe(200)
    expect(await tables()).toEqual(before)
    expect(await choicesOf(person)).toEqual([{ list_id: CLUB_LIST, choice: 'in', source: 'preferences' }])
    expect(await gateSays(person, 'optional', CLUB_LIST)).toBeNull()
  })

  it('turns the person\'s \'in\' out for a report newer than it, or for an \'in\' whose time cannot be read, the choice taking the report\'s own time', async () => {
    const [reader, unread] = [listAddress('reader'), listAddress('unread')]
    await seedMailContact({ address: reader, choices: { [NEWSLETTER_LIST_ID]: { choice: 'in', source: 'preferences', at: asStored(minutesAgo(60)) } } })
    await seedMailContact({ address: unread, choices: { [NEWSLETTER_LIST_ID]: { choice: 'in', source: 'preferences', at: 'sample words, not a time' } } })
    const reportedAt = minutesAgo(20)
    const report = await notify(sesComplaint([reader, unread], { timestamp: reportedAt, tags: reportedTags({ kind: 'optional', list: NEWSLETTER_LIST_ID }) }))
    expect((await post(report)).status).toBe(200)
    for (const address of [reader, unread]) {
      expect(await choicesOf(address), address).toEqual([{ list_id: NEWSLETTER_LIST_ID, choice: 'out', source: 'complaint' }])
      expect(await gateSays(address, 'optional', NEWSLETTER_LIST_ID), address).toBe('opted_out')
    }
    expect((await tables()).choices.map((row) => (row as { updated_at: string }).updated_at)).toEqual([asStored(reportedAt), asStored(reportedAt)])
    // A choice the report wrote anew takes the same time.
    const fresh = listAddress('fresh')
    expect((await post(await notify(sesComplaint([fresh], { timestamp: reportedAt, tags: reportedTags({ kind: 'optional', list: NEWSLETTER_LIST_ID }) }))))).toMatchObject({ status: 200 })
    const id = (await contactOf(fresh))!.id
    expect(await env.DB.prepare('SELECT updated_at FROM mail_list_choices WHERE contact_id = ?').bind(id).first('updated_at')).toBe(asStored(reportedAt))
  })

  it('never sets the person\'s own stop-all, and leaves a choice already out as the person made it', async () => {
    const reader = listAddress('reader')
    await seedMailContact({ address: reader, choices: { [NEWSLETTER_LIST_ID]: { choice: 'out', source: 'link', at: EARLIER } } })
    const report = await notify(sesComplaint([reader], { tags: reportedTags({ kind: 'optional', list: NEWSLETTER_LIST_ID }) }))
    expect((await post(report)).status).toBe(200)
    expect(await choicesOf(reader)).toEqual([{ list_id: NEWSLETTER_LIST_ID, choice: 'out', source: 'link' }])
    expect((await contactOf(reader))!.optional_off_at).toBeNull()
    const stopped = listAddress('stopped')
    await seedMailContact({ address: stopped, optionalOffAt: EARLIER })
    expect((await post(await notify(sesComplaint([stopped]))))).toMatchObject({ status: 200 })
    expect((await contactOf(stopped))!.optional_off_at).toBe(EARLIER)
  })
})

describe('the subscription', () => {
  it('confirms a confirmation of the site\'s own topic with one GET of its SubscribeURL, and writes nothing', async () => {
    const counted = countingDb()
    const lines = captureLogs()
    const confirmation = await signer.sign({ Type: 'SubscriptionConfirmation' })
    const res = await post(confirmation, { env: { DB: counted.db } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true })
    expect(snsConfirmations).toEqual([confirmation.SubscribeURL])
    expect(counted.ran).toEqual([])
    expect(lines).toContain(RECEIVER_LOG.confirmed)
    expectPlainLogs(lines)
  })

  it('answers 500 when the confirming GET does not go through, so SNS tries again', async () => {
    const lines = captureLogs()
    const res = await post(await signer.sign({ Type: 'SubscriptionConfirmation', SubscribeURL: `${SNS}/?Action=SampleNotAConfirmation&Token=t` }))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: TRY_AGAIN })
    expect(lines).toContain(RECEIVER_LOG.unconfirmed)
    expect(snsConfirmations).toEqual([])
  })

  it('answers 500 when the confirming GET answers a redirect, never following it to the other host, and writes nothing', async () => {
    snsBehavior.redirects.confirmation = REDIRECTED
    const counted = countingDb()
    const lines = captureLogs()
    const confirmation = await signer.sign({ Type: 'SubscriptionConfirmation' })
    const res = await post(confirmation, { env: { DB: counted.db } })
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: TRY_AGAIN })
    // The certificate's fetch and the one confirming GET, and no fetch of the address the redirect names.
    expect(snsCertificateFetches).toEqual([confirmation.SigningCertURL])
    expect(snsConfirmations).toEqual([confirmation.SubscribeURL])
    expect(fetchCount).toBe(2)
    expect(counted.ran).toEqual([])
    expect(lines).toEqual([RECEIVER_LOG.unconfirmed])
  })

  it('answers an unsubscribe confirmation with 200 and one warning line that names no address, fetching nothing more and writing nothing', async () => {
    const counted = countingDb()
    const lines = captureLogs()
    const res = await post(await signer.sign({ Type: 'UnsubscribeConfirmation' }), { env: { DB: counted.db } })
    expect(res.status).toBe(200)
    expect(lines.filter((l) => l === RECEIVER_LOG.unsubscribed)).toHaveLength(1)
    expect(snsConfirmations).toEqual([])
    expect(snsCertificateFetches).toHaveLength(1)
    expect(counted.ran).toEqual([])
    expectPlainLogs(lines)
  })
})

describe('the certificate\'s faults and the database\'s, each 500 so SNS tries again', () => {
  it('answers 500 for a certificate that cannot be fetched, writing nothing, and takes the same notification once it can', async () => {
    snsBehavior.certReachable = false
    const lines = captureLogs()
    const address = eventAddress('dead')
    const message = await notify(sesBounce([address]))
    const res = await post(message)
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: TRY_AGAIN })
    expect((await tables()).doNotSend).toEqual([])
    expect(lines).toContain(RECEIVER_LOG.certUnreachable)
    snsBehavior.certReachable = true
    expect((await post(message)).status).toBe(200)
    expect((await tables()).doNotSend.map((r) => r.address)).toEqual([address])
    expectPlainLogs(lines)
  })

  it('answers 500 for a certificate behind a redirect, never following it to the other host, keeping nothing and writing nothing', async () => {
    snsBehavior.redirects.certificate = REDIRECTED
    const lines = captureLogs()
    const counted = countingDb()
    const message = await notify(sesBounce([eventAddress('dead')]))
    const res = await post(message, { env: { DB: counted.db } })
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: TRY_AGAIN })
    expect(snsCertificateFetches).toEqual([message.SigningCertURL])
    expect(fetchCount).toBe(1)
    expect(keptCertificates()).not.toContain(message.SigningCertURL)
    expect(counted.ran).toEqual([])
    expect(lines).toEqual([RECEIVER_LOG.certUnreachable])
  })

  it('answers 500 for a certificate fetched from SNS\'s host that cannot be read, writing nothing', async () => {
    const lines = captureLogs()
    for (const certificate of ['sample words, not a certificate', '-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----\n']) {
      snsBehavior.certificate = certificate
      const res = await post(await notify(sesBounce([eventAddress('dead')])))
      expect(res.status).toBe(500)
      expect(await res.json()).toEqual({ error: TRY_AGAIN })
    }
    expect((await tables()).doNotSend).toEqual([])
    expect(lines.filter((l) => l === RECEIVER_LOG.certUnusable)).toHaveLength(2)
  })

  it('answers 500 when the database cannot be written, with one line that names no address', async () => {
    const lines = captureLogs()
    const failing = { prepare: (sql: string) => env.DB.prepare(sql), batch: async () => { throw new Error('D1_ERROR: sample: the database is not answering') } } as unknown as D1Database
    const res = await post(await notify(sesComplaint([listAddress('reader')], { tags: reportedTags({ kind: 'optional', list: NEWSLETTER_LIST_ID }) })), { env: { DB: failing } })
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: TRY_AGAIN })
    expect(lines).toEqual([RECEIVER_LOG.unwritten])
  })
})

describe('the log lines', () => {
  it('hold counts and fixed sentences, never an address, a topic\'s name or an account number', async () => {
    const lines = captureLogs()
    expect((await post(await notify(sesBounce([eventAddress('dead'), eventAddress('gone')]))))).toMatchObject({ status: 200 })
    expect((await post(await notify(sesComplaint([listAddress('reader')], { tags: reportedTags({ kind: 'optional', list: NEWSLETTER_LIST_ID }) }))))).toMatchObject({ status: 200 })
    expect(lines).toEqual([
      'mail receiver: 2 bounced address(es) and 0 spam report address(es) written',
      'mail receiver: 0 bounced address(es) and 1 spam report address(es) written',
    ])
    expectPlainLogs(lines)
  })
})
