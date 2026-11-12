// test/integration/ses-path.test.ts
//
// WS16 step 7: every kind of email through Amazon SES's transport, through
// the real handlers, the real campaign sender, the real daily run and the
// real seam, signed by functions/utils/mail/sigv4.ts and caught by the
// harness's Amazon SES catch point, which works each signature out again
// with node:crypto and the secret the pool binds and refuses one that does
// not match, as Amazon would. MAIL_LISTS_ON, MAIL_SENDER, WORKERS_PLAN and
// COMPLAINT_STOPS_OTHER_SENDERS are read through getters on the mocked
// functions/utils/mail/switches, set before every case to the cutover's
// values (MAIL_LISTS_ON set, 'ses' and 'paid') and changed where a case
// says, so no value the code ships with decides one. Nothing here reaches
// an outside service: the harness answers Amazon SES, Resend and the
// sign-in service.
//
// - Each kind of email reaches the outbox through the SES catch point with
//   the same recipient, subject, page and From line as through Resend.
// - Never twice: an answer that may come after Amazon took the message (a
//   500, a 502, a 504, a 408, no answer at all, a code no one named) is
//   never tried again by the campaign sender or the daily run, in that run
//   or the next; a 429 ends the run with the rest back, and the daily run
//   sends it again in the run; a missing key, a fault of the account's
//   setup and a refused signature end the run with the rows back untried;
//   and nothing falls back from one service to the other.
// - The test through Amazon SES, an LCA admin's alone.
// - The sent newsletter, the cases WS16 steps 4 and 6 left to this step:
//   the POST's 201 for each kind of sender, a family once, the headers and
//   the footer, a second POST while one sends, and the switch turned off in
//   the middle of a send.
// - WS16 step 4's three for before the cutover: a deleted member's address,
//   a stopped newsletter's rows, and words that name the service.
// - The key and the signature in no row, no answer and no log line.
//
// AKIDEXAMPLE, the key id the pool binds, is AWS's own documentation value
// and opens nothing; the secret beside it is made up. Every name, address,
// club and subject here is plainly made up.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_FROM, LIST_SENDERS, SENDER_NAME } from '../../domain/mail/addresses'
import { EVENT_MAIL_STILL_COMES, LIST_FOOTER_WORDS, PREFERENCES_LABEL } from '../../domain/mail/footer'
import { NEWSLETTER_LIST_ID } from '../../domain/mail/lists'
import { onRequestPost as newsletterPost } from '../../functions/api/admin/mail/newsletter'
import { onRequestPost as testPost } from '../../functions/api/admin/mail/newsletter/test'
import { NEWSLETTER_ROWS_UNREAD_LOG, onRequestDelete as memberDelete } from '../../functions/api/admin/members/[id]'
import { onRequestPost as supportReplyPost } from '../../functions/api/admin/support/[id]'
import { onRequestPost as registrationPost } from '../../functions/api/registrations'
import { onRequestPost as supportPost } from '../../functions/api/support'
import { MEDIA_MANAGER_SEAT } from '../../functions/utils/admin/mediaManager'
import {
  NO_CLEAR_ANSWER_WORDS, STOPPED_WORDS, WRITTEN_OFF_WORDS, processCampaign, sweepPendingCampaigns,
} from '../../functions/utils/admin/campaigns'
import { escapeHtml } from '../../functions/utils/emailLayout'
import { linkKeyCheck } from '../../functions/utils/mail/links'
import { createListCampaign, stopListCampaign } from '../../functions/utils/mail/lists'
import { ALREADY_SENDING, SES_TEST_ADMINS_ONLY } from '../../functions/utils/mail/newsletterAnswers'
import { WAIT_FOR_SES_WORDS } from '../../functions/utils/mail/send'
import { SES_KEY_MISSING } from '../../functions/utils/mail/ses'
import type { Env } from '../../functions/types'
import { seedAdmin, seedMember, seedSeat, seedTournament } from './factories'
import { emailBehavior, emailOutbox, flushWaitUntil, invoke, resetHarness, sesSignatures, type SentEmail } from './harness'
import { bindings, holdClock, noLongerReceives, noWaits, paidEntrants, runDaily } from './mailRuns'
import { campaignOf, quickPauses, rowsOf, stageCampaign } from './campaignRuns'

const flags = vi.hoisted(() => ({ listsOn: true, sender: 'ses', plan: 'paid', complaintStops: true }))
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

const SES = 'email.us-east-1.amazonaws.com'
const RESEND = 'api.resend.com'
const SITE = 'https://www.louisianachess.org'
/** A newsletter's words, plainly made up. */
const SAMPLE = { subject: 'Sample newsletter one', bodyHtml: '<p>Example words for a sample newsletter.</p>' }
const key = () => (env as unknown as Env).MAIL_LINK_SECRET as string
const secret = () => (env as unknown as Env).SES_SECRET_ACCESS_KEY as string
const NEWSLETTER_FROM = `${LIST_SENDERS[NEWSLETTER_LIST_ID]!.name} <${LIST_SENDERS[NEWSLETTER_LIST_ID]!.from}>`

let seq = 0
/** An address of the harness's own kind, which every list may send to. */
const address = (name: string) => `${name}-${++seq}@ses-path.test.lca`
/** A member with an active membership and a made-up name. */
const member = (email: string, opts: { role?: string; membershipStatus?: string } = {}) => seedMember({ email, fullName: 'Player One', ...opts })

let mediaManagerSeat: string | null = null
/** A member who holds the Media manager seat now, with a member's role: the seat is added once, and each holder gets a term on it. */
async function mediaManager(): Promise<string> {
  const holder = await member(address('holder'))
  if (mediaManagerSeat === null) {
    mediaManagerSeat = await seedSeat({ slug: MEDIA_MANAGER_SEAT, role: 'Media manager' }, [holder])
  } else {
    await env.DB.prepare(`INSERT INTO board_seat_assignments (id, seat_id, member_id, started_at) VALUES (?, ?, ?, datetime('now'))`)
      .bind(`term-${holder}`, mediaManagerSeat, holder).run()
  }
  return holder
}

/** One request to a mail service, as the case saw it go out: the service and the one recipient. */
interface MailCall { via: 'ses' | 'resend'; to: string }

const unwrap: Array<() => void> = []

/**
 * Keeps every request to either mail service, over the harness's own fetch, and lets a case answer one itself in
 * Amazon's or Resend's form before the harness sees it.
 */
function watchMail(answer?: (call: MailCall, index: number) => Response | undefined): MailCall[] {
  const underneath = globalThis.fetch
  const calls: MailCall[] = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input as RequestInfo, init)
    const host = new URL(request.url).hostname
    if (host === SES || host === RESEND) {
      const body = (await request.clone().json()) as { to?: string | string[]; Destination?: { ToAddresses: string[] } }
      const to = host === SES ? body.Destination!.ToAddresses[0] : Array.isArray(body.to) ? body.to[0] : body.to!
      const call: MailCall = { via: host === SES ? 'ses' : 'resend', to }
      calls.push(call)
      const instead = answer?.(call, calls.length)
      if (instead) return instead
    }
    // Awaited here, so a request that throws is thrown from this function rather than handed back as a rejection,
    // which the Workers runtime would report as unhandled before the caller's catch takes it.
    return await underneath(input as RequestInfo, init)
  }) as typeof fetch
  unwrap.push(() => {
    globalThis.fetch = underneath
  })
  return calls
}

/** A refusal in Amazon's form, its code in the x-amzn-errortype header and in the body. */
const amazon = (status: number, code: string) =>
  Response.json({ __type: `com.amazon.coral.service#${code}`, message: 'Sample words from Amazon.' }, { status, headers: { 'x-amzn-errortype': code } })

/** Every reminder an earlier case left due, quieted, so a case's daily run reads its own rows alone. */
async function quietOldReminders(): Promise<void> {
  await env.DB.prepare('UPDATE tournaments SET reminder_1_enabled = 0, reminder_2_enabled = 0').run()
  await env.DB.prepare('UPDATE tournament_reminders SET sent_registration_open = 1, sent_week_before = 1').run()
}

/** A send made as the POST makes one, under the harness's key. */
async function makeSend(by: string) {
  const made = await createListCampaign(env.DB, { listId: NEWSLETTER_LIST_ID, ...SAMPLE, createdBy: by, linkCheck: await linkKeyCheck(key()) })
  expect(made).not.toBeNull()
  return made!
}

/** What a newsletter's counts must come to once nothing is pending: every row sent or failed, the total its rows. */
async function countsAddUp(campaignId: string): Promise<void> {
  const rows = await rowsOf(campaignId)
  const campaign = await campaignOf(campaignId)
  expect(rows.filter((r) => r.status === 'pending')).toEqual([])
  expect(campaign!.total_recipients).toBe(rows.length)
  expect(campaign!.sent_count + campaign!.failed_count).toBe(rows.length)
  expect(campaign!.status).not.toBe('sending')
}

/** The two copies of one message, through Resend and then through Amazon SES, held to be the same message. */
function expectSameMessage(throughResend: SentEmail | undefined, throughSes: SentEmail | undefined): void {
  expect(throughResend?.via).toBe('resend')
  expect(throughSes?.via).toBe('ses')
  const parts = (e: SentEmail) => ({ to: e.to, subject: e.subject, html: e.html, text: e.text, from: e.from, headers: e.headers })
  expect(parts(throughSes!)).toEqual(parts(throughResend!))
}

beforeEach(async () => {
  resetHarness()
  flags.listsOn = true
  flags.sender = 'ses'
  flags.plan = 'paid'
  flags.complaintStops = true
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

describe('each kind of email through Amazon SES, the same message it is through Resend', () => {
  it('a registration confirmation', async () => {
    const tournamentId = await seedTournament({ name: 'Sample Winter Open', sections: [{ name: 'Open', entryFee: 0 }] })
    const to = address('player')
    const player = await member(to)
    const register = async () => {
      expect((await invoke(registrationPost, { method: 'POST', as: player, body: { tournamentId, section: 'Open' } })).status).toBe(201)
      await env.DB.prepare('DELETE FROM registrations WHERE tournament_id = ? AND member_id = ?').bind(tournamentId, player).run()
    }
    flags.listsOn = false
    flags.sender = 'resend'
    await register()
    flags.sender = 'ses'
    await register()
    const [throughResend, throughSes] = emailOutbox.filter((e) => e.to === to)
    expect(throughResend.subject).toBe('You\'re registered: Sample Winter Open')
    expectSameMessage(throughResend, throughSes)
    expect(throughSes.from).toBe(`${SENDER_NAME} <${DEFAULT_FROM}>`)
    expect(throughSes.tags).toEqual({ kind: 'event' })
    expect(throughSes.headers).toBeUndefined()
  })

  it('a support reply', async () => {
    const to = address('writer')
    const opened = await invoke(supportPost, { method: 'POST', body: { name: 'Player One', email: to, subject: 'Sample question', body: 'Example words.' } })
    const { ticketId } = await opened.json<{ ticketId: string }>()
    const admin = await seedAdmin()
    const reply = async () => {
      expect((await invoke(supportReplyPost, { method: 'POST', as: admin, params: { id: ticketId }, body: { body: 'Example reply words.' } })).status).toBe(201)
    }
    flags.listsOn = false
    flags.sender = 'resend'
    await reply()
    flags.sender = 'ses'
    await reply()
    const [throughResend, throughSes] = emailOutbox.filter((e) => e.to === to && e.subject === 'Re: Sample question')
    expectSameMessage(throughResend, throughSes)
    expect(throughSes.tags).toEqual({ kind: 'event' })
  })

  it('a Group email batch', async () => {
    const to = address('group')
    flags.listsOn = false
    flags.sender = 'resend'
    await processCampaign(bindings, await stageCampaign({ recipients: [{ email: to }] }))
    flags.sender = 'ses'
    await processCampaign(bindings, await stageCampaign({ recipients: [{ email: to }] }))
    const [throughResend, throughSes] = emailOutbox.filter((e) => e.to === to)
    expectSameMessage(throughResend, throughSes)
    expect(throughSes.subject).toBe('Sample message one')
  })

  it('a reminder from the daily run', async () => {
    holdClock()
    await quietOldReminders()
    const { addresses: [to] } = await paidEntrants(1)
    flags.listsOn = false
    flags.sender = 'resend'
    await runDaily()
    await env.DB.prepare('DELETE FROM tournament_attendee_reminders WHERE member_id IN (SELECT id FROM members WHERE email = ?)').bind(to).run()
    flags.sender = 'ses'
    await runDaily()
    const [throughResend, throughSes] = emailOutbox.filter((e) => e.to === to)
    expectSameMessage(throughResend, throughSes)
    expect(throughSes.tags).toEqual({ kind: 'event' })
  })

  it('a newsletter batch, with its two headers, its list\'s sender and its tags, the one path list mail takes', async () => {
    const admin = await seedAdmin()
    const reader = address('reader')
    await member(reader)
    const calls = watchMail()
    const res = await invoke(newsletterPost, { as: admin, method: 'POST', body: SAMPLE })
    expect(res.status).toBe(201)
    await flushWaitUntil()
    const [sent] = emailOutbox.filter((e) => e.to === reader)
    expect(sent.via).toBe('ses')
    expect(sent.from).toBe(NEWSLETTER_FROM)
    expect(sent.tags).toEqual({ kind: 'optional', list: NEWSLETTER_LIST_ID })
    expect(Object.keys(sent.headers!)).toEqual(['List-Unsubscribe', 'List-Unsubscribe-Post'])
    expect(calls.filter((c) => c.via === 'resend')).toEqual([])
  })
})

/** The answers that may come after Amazon took the message, each never tried again: how a case makes each. */
const NEVER: ReadonlyArray<readonly [string, { status?: number; code?: string; noAnswer?: true }, string]> = [
  ['a 500', { status: 500 }, 'Amazon SES 500 InternalFailure: harness: simulated Amazon SES outage'],
  ['a 502', { status: 502 }, 'Amazon SES 502: <html><body><h1>502</h1><p>harness: simulated Amazon SES outage</p></body></html>'],
  ['a 504', { status: 504 }, 'Amazon SES 504: <html><body><h1>504</h1><p>harness: simulated Amazon SES outage</p></body></html>'],
  ['a 408', { status: 408 }, 'Amazon SES 408 RequestTimeoutException: harness: simulated Amazon SES outage'],
  ['a code no one named', { status: 400, code: 'SampleUnknownException' }, 'Amazon SES 400 SampleUnknownException: harness: simulated Amazon SES outage'],
  ['no answer at all', { noAnswer: true }, NO_CLEAR_ANSWER_WORDS],
]

/** Sets the harness's Amazon SES catch point to answer one address as the row of NEVER says. */
function answerNever(to: string, answer: { status?: number; code?: string; noAnswer?: true }): void {
  if (answer.noAnswer) {
    emailBehavior.noAnswer = 1
    return
  }
  emailBehavior.succeed = false
  emailBehavior.failFor = [to]
  emailBehavior.status = answer.status!
  emailBehavior.code = answer.code ?? null
}

describe('never twice: an answer that may come after Amazon took the message is never tried again', () => {
  it.each(NEVER)('%s: the campaign sender fails the row with its words and sends it no second time, in that run or the next', async (_, answer, words) => {
    const failing = address('never')
    const fine = address('fine')
    const id = await stageCampaign({ recipients: [{ email: failing }, { email: fine }] })
    answerNever(failing, answer)
    const calls = watchMail()
    await processCampaign(bindings, id)
    await sweepPendingCampaigns(bindings)
    await sweepPendingCampaigns(bindings)
    expect(calls.filter((c) => c.to === failing)).toEqual([{ via: 'ses', to: failing }])
    expect(calls.filter((c) => c.via === 'resend')).toEqual([])
    const [failed, sent] = await rowsOf(id)
    expect(failed).toMatchObject({ status: 'failed', error: words })
    expect(sent.status).toBe('sent')
    expect(await campaignOf(id)).toMatchObject({ status: 'completed', sent_count: 1, failed_count: 1 })
  })

  it.each(NEVER)('%s: the daily run keeps the reminder\'s mark and sends it no second time, in that run or the next', async (_, answer) => {
    holdClock()
    noWaits()
    await quietOldReminders()
    const { addresses: [to] } = await paidEntrants(1)
    answerNever(to, answer)
    const calls = watchMail()
    await runDaily()
    await runDaily()
    expect(calls.filter((c) => c.to === to)).toEqual([{ via: 'ses', to }])
    expect(emailOutbox.filter((e) => e.to === to)).toEqual([])
    const marks = await env.DB.prepare('SELECT COUNT(*) AS n FROM tournament_attendee_reminders WHERE member_id IN (SELECT id FROM members WHERE email = ?)').bind(to).first<{ n: number }>()
    expect(marks!.n).toBe(1)
  })

  it('a 429 ends the campaign\'s run with this row and the rest back, the rest\'s attempts given back, and a later run sends each once', async () => {
    const [first, second, third] = [address('throttled'), address('waiting'), address('waiting')]
    const id = await stageCampaign({ recipients: [{ email: first }, { email: second }, { email: third }] })
    emailBehavior.succeed = false
    emailBehavior.status = 429
    const calls = watchMail()
    expect(await processCampaign(bindings, id)).toEqual({ sent: 0, failed: 0, remaining: 3, done: false })
    expect(calls).toEqual([{ via: 'ses', to: first }])
    const rows = await rowsOf(id)
    expect(rows.map((r) => [r.status, r.attempts, r.claimed_at, r.sending_at])).toEqual([['pending', 1, null, null], ['pending', 0, null, null], ['pending', 0, null, null]])
    expect(rows[0].error).toBe('Amazon SES 429 TooManyRequestsException: harness: simulated Amazon SES outage')
    emailBehavior.succeed = true
    await sweepPendingCampaigns(bindings)
    expect(emailOutbox.map((e) => e.to).sort()).toEqual([first, second, third].sort())
    expect(calls.filter((c) => c.to === first)).toHaveLength(2)
  })

  it('the daily run sends a reminder answered 429 again in the same run, which arrives once, and a 500 never', async () => {
    holdClock()
    noWaits()
    await quietOldReminders()
    const { addresses: [throttled, broken] } = await paidEntrants(2)
    let answered = false
    emailBehavior.succeed = false
    emailBehavior.failFor = [broken]
    emailBehavior.status = 500
    const calls = watchMail((call) => {
      if (call.via !== 'ses' || call.to !== throttled || answered) return undefined
      answered = true
      return amazon(429, 'TooManyRequestsException')
    })
    await runDaily()
    expect(calls.filter((c) => c.to === throttled)).toHaveLength(2)
    expect(emailOutbox.filter((e) => e.to === throttled)).toHaveLength(1)
    expect(calls.filter((c) => c.to === broken)).toHaveLength(1)
    expect(emailOutbox.filter((e) => e.to === broken)).toEqual([])
    await runDaily()
    expect(calls.filter((c) => c.to === throttled)).toHaveLength(2)
    expect(calls.filter((c) => c.to === broken)).toHaveLength(1)
  })

  it('with no Amazon SES key, makes no request, leaves the batch untried and says the key is missing, and sends a registration\'s email nowhere', async () => {
    const people = [address('nokey'), address('nokey')]
    const id = await stageCampaign({ recipients: people.map((email) => ({ email })) })
    const calls = watchMail()
    const noKey = { ...bindings, SES_ACCESS_KEY_ID: '', SES_SECRET_ACCESS_KEY: '' }
    expect(await processCampaign(noKey as never, id)).toEqual({ sent: 0, failed: 0, remaining: 2, done: false })
    const rows = await rowsOf(id)
    expect(rows.map((r) => [r.status, r.attempts, r.claimed_at, r.sending_at])).toEqual([['pending', 0, null, null], ['pending', 0, null, null]])
    expect(rows[0].error).toBe(SES_KEY_MISSING)
    const tournamentId = await seedTournament({ name: 'Sample Spring Swiss', sections: [{ name: 'Open', entryFee: 0 }] })
    const player = await member(address('player'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const res = await invoke(registrationPost, { method: 'POST', as: player, body: { tournamentId, section: 'Open' }, env: { SES_ACCESS_KEY_ID: '' } })
    expect(res.status).toBe(201)
    expect(calls).toEqual([])
    expect(emailOutbox).toEqual([])
    expect(warn.mock.calls.map(([words]) => words)).toContain(SES_KEY_MISSING)
  })

  it('a fault of the account\'s setup, a configuration set Amazon does not find, ends the run with every row back untried', async () => {
    const people = [address('setup'), address('setup'), address('setup')]
    const id = await stageCampaign({ recipients: people.map((email) => ({ email })) })
    emailBehavior.succeed = false
    emailBehavior.status = 404
    const calls = watchMail()
    expect(await processCampaign(bindings, id)).toEqual({ sent: 0, failed: 0, remaining: 3, done: false })
    expect(calls).toHaveLength(1)
    const rows = await rowsOf(id)
    expect(rows.map((r) => [r.status, r.attempts])).toEqual([['pending', 0], ['pending', 0], ['pending', 0]])
    expect(rows[0].error).toBe('Amazon SES 404 NotFoundException: harness: simulated Amazon SES outage')
  })

  it('a request signed for one body and sent with another, or for a key id Amazon does not know, is refused as Amazon would, a key fault, and nothing is taken', async () => {
    const people = [address('tampered'), address('tampered')]
    const id = await stageCampaign({ recipients: people.map((email) => ({ email })) })
    const underneath = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input)
      const body = typeof init?.body === 'string' && url.includes(SES) ? init.body.replace('Sample message one', 'Sample message two') : init?.body
      return await underneath(input as RequestInfo, { ...init, body })
    }) as typeof fetch
    unwrap.push(() => {
      globalThis.fetch = underneath
    })
    expect(await processCampaign(bindings, id)).toEqual({ sent: 0, failed: 0, remaining: 2, done: false })
    let rows = await rowsOf(id)
    expect(rows[0].error).toMatch(/^Amazon SES 403 SignatureDoesNotMatch: /)
    expect(rows.map((r) => r.attempts)).toEqual([0, 0])
    unwrap.pop()!()
    // The signing key is kept by the key id, the day, the region and the service, never by the secret, so a wrong key
    // is tried here as another key id, which the catch point does not know.
    expect(await processCampaign({ ...bindings, SES_ACCESS_KEY_ID: 'AKIDSAMPLEOTHER' } as never, id)).toEqual({ sent: 0, failed: 0, remaining: 2, done: false })
    rows = await rowsOf(id)
    expect(rows[0].error).toMatch(/^Amazon SES 400 IncompleteSignature: /)
    expect(rows.map((r) => r.attempts)).toEqual([0, 0])
    expect(emailOutbox).toEqual([])
    expect(await processCampaign(bindings, id)).toEqual({ sent: 2, failed: 0, remaining: 0, done: true })
  })

  it('falls back to neither service from the other: a failing Amazon SES reaches no Resend, and a failing Resend no Amazon SES', async () => {
    const tournamentId = await seedTournament({ name: 'Sample Autumn Quads', sections: [{ name: 'Open', entryFee: 0 }] })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    for (const sender of ['ses', 'resend'] as const) {
      for (const listsOn of [true, false]) {
        flags.sender = sender
        flags.listsOn = listsOn
        emailBehavior.succeed = false
        const calls = watchMail()
        const player = await member(address('player'))
        expect((await invoke(registrationPost, { method: 'POST', as: player, body: { tournamentId, section: 'Open' } })).status).toBe(201)
        expect(calls.map((c) => c.via), `${sender}, ${String(listsOn)}`).toEqual([sender])
        unwrap.pop()!()
      }
    }
    expect(emailOutbox).toEqual([])
    expect(warn).toHaveBeenCalled()
  })
})

describe('the test through Amazon SES, an LCA admin\'s alone', () => {
  it('goes through Amazon SES while Resend sends, from the newsletter\'s own From line with its list tag, and without the box through Resend from DEFAULT_FROM', async () => {
    flags.sender = 'resend'
    const admin = await seedAdmin()
    const ticked = address('tester')
    const calls = watchMail()
    const res = await invoke(testPost, { as: admin, method: 'POST', body: { to: ticked, ...SAMPLE, service: 'ses' } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ sent: true })
    const [throughSes] = emailOutbox.filter((e) => e.to === ticked)
    expect(throughSes).toMatchObject({ via: 'ses', from: NEWSLETTER_FROM, subject: `[TEST] ${SAMPLE.subject}`, tags: { kind: 'test', list: NEWSLETTER_LIST_ID } })
    expect(Object.keys(throughSes.headers!)).toEqual(['List-Unsubscribe', 'List-Unsubscribe-Post'])

    const plain = address('tester')
    expect((await invoke(testPost, { as: admin, method: 'POST', body: { to: plain, ...SAMPLE } })).status).toBe(200)
    const [throughResend] = emailOutbox.filter((e) => e.to === plain)
    expect(throughResend).toMatchObject({ via: 'resend', from: `${SENDER_NAME} <${DEFAULT_FROM}>` })
    expect(calls).toEqual([{ via: 'ses', to: ticked }, { via: 'resend', to: plain }])
  })

  it('refuses it to the president and to the media manager, each passing the guard, with the words, writing nothing and sending nothing', async () => {
    flags.sender = 'resend'
    const president = await member(address('president'), { role: 'lca_observer' })
    const holder = await mediaManager()
    const calls = watchMail()
    const contacts = async () => (await env.DB.prepare('SELECT COUNT(*) AS n FROM mail_contacts').first<{ n: number }>())!.n
    for (const [who, aal] of [[president, 'aal1'], [president, 'aal2'], [holder, 'aal2']] as const) {
      const [before, sent] = [await contacts(), calls.length]
      const res = await invoke(testPost, { as: who, aal, method: 'POST', body: { to: address('tester'), ...SAMPLE, service: 'ses' } })
      expect(res.status, who).toBe(403)
      expect(await res.json(), who).toEqual({ error: SES_TEST_ADMINS_ONLY })
      expect([await contacts(), calls.length], who).toEqual([before, sent])
      // Without the box, each may send a test, through Resend as before; the media manager's goes to their own address.
      const own = (await env.DB.prepare('SELECT email FROM members WHERE id = ?').bind(who).first<{ email: string }>())!.email
      const to = who === holder ? own : address('tester')
      expect((await invoke(testPost, { as: who, aal, method: 'POST', body: { to, ...SAMPLE } })).status, who).toBe(200)
      expect(calls.at(-1)?.via, who).toBe('resend')
    }
    expect(calls.filter((c) => c.via === 'ses')).toEqual([])
    expect(SES_TEST_ADMINS_ONLY).toBe('Only an LCA admin can send a test through Amazon SES.')
  })

  it('comes after the guard and the 404: with MAIL_LISTS_ON unset everyone the guard admits gets 404, and anyone else the guard\'s answer', async () => {
    flags.listsOn = false
    flags.sender = 'resend'
    const president = await member(address('president'), { role: 'lca_observer' })
    const plain = await member(address('plain'))
    const admin = await seedAdmin()
    const body = { to: address('tester'), ...SAMPLE, service: 'ses' }
    for (const who of [president, admin]) expect((await invoke(testPost, { as: who, method: 'POST', body })).status, who).toBe(404)
    expect((await invoke(testPost, { as: plain, method: 'POST', body })).status).toBe(403)
    expect(await (await invoke(testPost, { as: plain, method: 'POST', body })).json()).toEqual({ error: 'Forbidden' })
    expect((await invoke(testPost, { method: 'POST', body })).status).toBe(401)
  })

  it('without Amazon SES\'s keys answers the words for a missing key, makes no request and is never handed to Resend instead', async () => {
    flags.sender = 'resend'
    const admin = await seedAdmin()
    const calls = watchMail()
    const res = await invoke(testPost, { as: admin, method: 'POST', body: { to: address('tester'), ...SAMPLE, service: 'ses' }, env: { SES_SECRET_ACCESS_KEY: '' } })
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ error: `Failed to send test email: ${SES_KEY_MISSING}` })
    expect(calls).toEqual([])
    expect(emailOutbox).toEqual([])
  })

  it('answers Amazon\'s refusal in Amazon\'s own words, and Resend\'s in Resend\'s, byte for byte as before', async () => {
    flags.sender = 'resend'
    const admin = await seedAdmin()
    emailBehavior.succeed = false
    emailBehavior.status = 400
    const ses = await invoke(testPost, { as: admin, method: 'POST', body: { to: address('tester'), ...SAMPLE, service: 'ses' } })
    expect(ses.status).toBe(502)
    expect(await ses.json()).toEqual({ error: 'Failed to send test email: Amazon SES 400 MessageRejected: harness: simulated Amazon SES outage' })
    emailBehavior.status = 403
    const resend = await invoke(testPost, { as: admin, method: 'POST', body: { to: address('tester'), ...SAMPLE } })
    expect(await resend.json()).toEqual({ error: 'Failed to send test email: Resend 403: {"message":"harness: simulated Resend outage"}' })
  })
})

describe('the sent newsletter, the cases WS16 steps 4 and 6 left to this step', () => {
  it('answers the POST 201 for an LCA admin with a second factor, the president and the media manager with one, and each send reaches the outbox', async () => {
    const admin = await seedAdmin()
    const president = await member(address('president'), { role: 'lca_observer' })
    const holder = await mediaManager()
    const reader = address('reader')
    await member(reader)
    for (const [who, aal] of [[admin, 'aal2'], [president, 'aal1'], [holder, 'aal2']] as const) {
      const res = await invoke(newsletterPost, { as: who, aal, method: 'POST', body: SAMPLE })
      expect(res.status, who).toBe(201)
      const made = await res.json<{ campaignId: string; totalRecipients: number; status: string }>()
      expect(made.status).toBe('sending')
      await flushWaitUntil()
      await countsAddUp(made.campaignId)
    }
    expect(emailOutbox.filter((e) => e.to === reader).map((e) => [e.via, e.subject])).toEqual([['ses', SAMPLE.subject], ['ses', SAMPLE.subject], ['ses', SAMPLE.subject]])
  })

  it('sends a parent and two children on one address one email', async () => {
    const admin = await seedAdmin()
    const family = address('family')
    const parent = await member(family)
    for (const child of [await member(family.toUpperCase()), await member(`  ${family}  `)]) {
      await env.DB.prepare('UPDATE members SET guardian_id = ? WHERE id = ?').bind(parent, child).run()
    }
    expect((await invoke(newsletterPost, { as: admin, method: 'POST', body: SAMPLE })).status).toBe(201)
    await flushWaitUntil()
    expect(emailOutbox.filter((e) => e.to === family)).toHaveLength(1)
  })

  it('gives every newsletter message List-Unsubscribe with one https address, then List-Unsubscribe-Post, and the footer with the reason and both links and no postal address', async () => {
    const admin = await seedAdmin()
    for (let i = 0; i < 3; i += 1) await member(address('reader'))
    expect((await invoke(newsletterPost, { as: admin, method: 'POST', body: SAMPLE })).status).toBe(201)
    await flushWaitUntil()
    const sent = emailOutbox.filter((e) => e.tags?.kind === 'optional')
    expect(sent.length).toBeGreaterThanOrEqual(3)
    const words = LIST_FOOTER_WORDS[NEWSLETTER_LIST_ID]
    for (const message of sent) {
      expect(Object.keys(message.headers!)).toEqual(['List-Unsubscribe', 'List-Unsubscribe-Post'])
      const token = /^<https:\/\/www\.louisianachess\.org\/api\/mail\/unsubscribe\/([^<>\s,]+)>$/.exec(message.headers!['List-Unsubscribe'])?.[1]
      expect(token, message.to).toBeDefined()
      expect(message.headers!['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
      for (const piece of [escapeHtml(words.reason), escapeHtml(words.unsubscribeLabel), PREFERENCES_LABEL, `${SITE}/email/unsubscribe/${token}`, `${SITE}/email/preferences/`]) {
        expect(message.html, piece).toContain(piece)
      }
      expect(message.html).not.toMatch(/\bP\.?\s?O\.?\s+Box\b|\bSuite\b|\b\d{5}(?:-\d{4})?\b/i)
      expect(message.html).not.toContain(escapeHtml(EVENT_MAIL_STILL_COMES))
    }
  })

  it('answers a second POST while one is sending 409, writing nothing', async () => {
    const admin = await seedAdmin()
    await member(address('reader'))
    // Every send answered 429, so the first newsletter stays sending however far its drain has gone.
    emailBehavior.succeed = false
    emailBehavior.status = 429
    expect((await invoke(newsletterPost, { as: admin, method: 'POST', body: SAMPLE })).status).toBe(201)
    const campaigns = async () => (await env.DB.prepare('SELECT COUNT(*) AS n FROM email_campaigns').first<{ n: number }>())!.n
    const before = await campaigns()
    const second = await invoke(newsletterPost, { as: admin, method: 'POST', body: SAMPLE })
    expect(second.status).toBe(409)
    expect(await second.json()).toEqual({ error: ALREADY_SENDING })
    expect(await campaigns()).toBe(before)
    await flushWaitUntil()
  })

  it('with MAIL_LISTS_ON turned off in the middle of a send, never sends the rest the old way, and the sweep sends it with its footers, headers and gate', async () => {
    flags.plan = 'free'
    const admin = await seedAdmin()
    const readers = Array.from({ length: 14 }, () => address('reader'))
    for (const reader of readers) await member(reader)
    const res = await invoke(newsletterPost, { as: admin, method: 'POST', body: SAMPLE })
    expect(res.status).toBe(201)
    const { campaignId } = await res.json<{ campaignId: string }>()
    await flushWaitUntil()
    // The request's one batch of 10 went; the rest waits for the sweep.
    const firstBatch = emailOutbox.length
    expect(firstBatch).toBe(10)

    // Both switched back: the row decides, so the rest takes the rules path, waits for Amazon SES and reaches no Resend.
    flags.listsOn = false
    flags.sender = 'resend'
    const calls = watchMail()
    await sweepPendingCampaigns(bindings)
    expect(calls).toEqual([])
    expect((await rowsOf(campaignId)).map((r) => r.error)).toContain(WAIT_FOR_SES_WORDS)

    // Amazon SES back, MAIL_LISTS_ON still unset: the sweep sends the rest, with footers, headers and the gate.
    flags.sender = 'ses'
    const dead = (await rowsOf(campaignId)).find((r) => r.status === 'pending')!.email
    await noLongerReceives(dead)
    for (let run = 0; run < 5 && (await campaignOf(campaignId))!.status === 'sending'; run += 1) await sweepPendingCampaigns(bindings)
    const rest = emailOutbox.slice(firstBatch)
    expect(rest.length).toBeGreaterThan(0)
    for (const message of rest) {
      expect(message.via).toBe('ses')
      expect(Object.keys(message.headers!)).toEqual(['List-Unsubscribe', 'List-Unsubscribe-Post'])
      expect(message.html).toContain(escapeHtml(LIST_FOOTER_WORDS[NEWSLETTER_LIST_ID].reason))
    }
    expect(emailOutbox.map((e) => e.to)).not.toContain(dead)
    expect(new Set(emailOutbox.map((e) => e.to)).size).toBe(emailOutbox.length)
    expect(calls.filter((c) => c.via === 'resend')).toEqual([])
    expect(await campaignOf(campaignId)).toMatchObject({ status: 'completed', skipped_count: 1 })
    await countsAddUp(campaignId)
  })
})

describe('a member deleted while a newsletter is sending', () => {
  it('takes an address out of the untried rows once no account in the audience holds it: one of two accounts on it, then the other', async () => {
    const admin = await seedAdmin()
    const shared = address('family')
    const first = await member(shared)
    const second = await member(shared)
    const marked = address('marked')
    const markedId = await member(marked)
    await member(address('staying'))
    const made = await makeSend(admin)
    await env.DB.prepare(`UPDATE email_campaign_recipients SET claimed_at = datetime('now'), sending_at = datetime('now') WHERE campaign_id = ? AND email = ?`)
      .bind(made.campaignId, marked).run()
    const rowsFor = async (email: string) => (await rowsOf(made.campaignId)).filter((r) => r.email === email)
    const remove = async (id: string) => expect((await invoke(memberDelete, { method: 'DELETE', as: admin, params: { id } })).status).toBe(200)

    await remove(first)
    expect(await rowsFor(shared)).toHaveLength(1)
    expect(await campaignOf(made.campaignId)).toMatchObject({ total_recipients: made.totalRecipients, skipped_count: 0 })

    await remove(second)
    expect(await rowsFor(shared)).toEqual([])
    expect(await campaignOf(made.campaignId)).toMatchObject({ total_recipients: made.totalRecipients - 1, skipped_count: 1 })

    // A row a run has marked is left to that run.
    await remove(markedId)
    expect(await rowsFor(marked)).toHaveLength(1)
    expect((await campaignOf(made.campaignId))!.total_recipients).toBe((await rowsOf(made.campaignId)).length)
  })

  it('with no newsletter sending changes no row of any campaign, logs no line of its own, and answers as before', async () => {
    const admin = await seedAdmin()
    const leaving = await member(address('leaving'))
    const groupEmail = await stageCampaign({ recipients: [{ email: address('group') }] })
    const before = await rowsOf(groupEmail)
    const warn = vi.spyOn(console, 'warn')
    const res = await invoke(memberDelete, { method: 'DELETE', as: admin, params: { id: leaving } })
    expect(res.status).toBe(200)
    expect(Object.keys(await res.json())).toEqual(['success', 'authDeleted'])
    expect(await rowsOf(groupEmail)).toEqual(before)
    expect(warn.mock.calls.map(([words]) => words)).not.toContain(NEWSLETTER_ROWS_UNREAD_LOG)
  })

  it('on a database whose newsletter cannot be read, still deletes the member and answers as before, with one log line that names no one', async () => {
    const admin = await seedAdmin()
    const leavingAddress = address('leaving')
    const leaving = await member(leavingAddress)
    const db = env.DB
    const unreadable = {
      prepare: (sql: string) => db.prepare(sql),
      batch: async () => {
        throw new Error('D1_ERROR: no such column: list_id: SQLITE_ERROR')
      },
      exec: (sql: string) => db.exec(sql),
      dump: () => db.dump(),
    } as unknown as D1Database
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const res = await invoke(memberDelete, { method: 'DELETE', as: admin, params: { id: leaving }, env: { DB: unreadable } })
    expect(res.status).toBe(200)
    expect(await env.DB.prepare('SELECT id FROM members WHERE id = ?').bind(leaving).first()).toBeNull()
    const lines = warn.mock.calls.filter(([words]) => words === NEWSLETTER_ROWS_UNREAD_LOG)
    expect(lines).toHaveLength(1)
    expect(JSON.stringify(lines)).not.toContain(leavingAddress)
  })
})

describe('a stopped newsletter keeps no pending row', () => {
  it('fails a row put back after the stop, answered later, with the stop\'s words and counts it, so the counts add up', async () => {
    const admin = await seedAdmin()
    for (let i = 0; i < 3; i += 1) await member(address('reader'))
    const made = await makeSend(admin)
    // The stop lands while the first row is in flight; Amazon answers that one 429.
    const underneath = globalThis.fetch
    let first = true
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input)
      if (url.includes(SES) && first) {
        first = false
        await stopListCampaign(env.DB, NEWSLETTER_LIST_ID)
        return amazon(429, 'TooManyRequestsException')
      }
      return await underneath(input as RequestInfo, init)
    }) as typeof fetch
    unwrap.push(() => {
      globalThis.fetch = underneath
    })
    await processCampaign(bindings, made.campaignId)
    const rows = await rowsOf(made.campaignId)
    expect(rows.every((r) => r.status === 'failed' && r.error === STOPPED_WORDS)).toBe(true)
    expect(await campaignOf(made.campaignId)).toMatchObject({ failed_count: rows.length, sent_count: 0 })
    await countsAddUp(made.campaignId)
    expect(emailOutbox).toEqual([])
  })

  it('writes off, in the sweep, a stopped newsletter\'s row whose run died after its mark once its claim has expired, and leaves one under a live claim', async () => {
    const admin = await seedAdmin()
    for (let i = 0; i < 3; i += 1) await member(address('reader'))
    const made = await makeSend(admin)
    const [died, live] = await rowsOf(made.campaignId)
    const mark = (id: string, when: string) =>
      env.DB.prepare(`UPDATE email_campaign_recipients SET claimed_at = ${when}, sending_at = ${when}, attempts = 1 WHERE id = ?`).bind(id).run()
    await mark(died.id, "datetime('now', '-20 minutes')")
    await mark(live.id, "datetime('now')")
    expect(await stopListCampaign(env.DB, NEWSLETTER_LIST_ID)).toBe(made.totalRecipients - 2)
    const swept = await sweepPendingCampaigns(bindings)
    expect(swept).toMatchObject({ campaignsTouched: 1, sent: 0, failed: 1 })
    let rows = await rowsOf(made.campaignId)
    expect(rows.find((r) => r.id === died.id)).toMatchObject({ status: 'failed', error: WRITTEN_OFF_WORDS })
    expect(rows.find((r) => r.id === live.id)).toMatchObject({ status: 'pending' })
    // Once that claim expires too, the next sweep writes it off, and the stopped send has no pending row.
    await mark(live.id, "datetime('now', '-20 minutes')")
    await sweepPendingCampaigns(bindings)
    rows = await rowsOf(made.campaignId)
    expect(rows.find((r) => r.id === live.id)).toMatchObject({ status: 'failed', error: WRITTEN_OFF_WORDS })
    await countsAddUp(made.campaignId)
    expect(emailOutbox).toEqual([])
  })

  it('leaves today\'s campaigns, with no list, as before: a row put back and a row written off the same, with and without a stopped newsletter beside them', async () => {
    const admin = await seedAdmin()
    await member(address('reader'))
    /** Group email's put back and write-off under the rules, as WS16 step 4 holds them, read back without ids or addresses. */
    const groupEmailRun = async () => {
      const [died, throttled, waiting] = [address('died'), address('throttled'), address('waiting')]
      const id = await stageCampaign({
        recipients: [{ email: died, claimedAt: "datetime('now', '-20 minutes')", sendingAt: "datetime('now', '-20 minutes')", attempts: 1 }, { email: throttled }, { email: waiting }],
      })
      emailBehavior.succeed = false
      emailBehavior.status = 429
      emailBehavior.failFor = [throttled]
      await sweepPendingCampaigns(bindings)
      emailBehavior.succeed = true
      emailBehavior.failFor = null
      const rows = (await rowsOf(id)).map((r) => ({ status: r.status, error: r.error, attempts: r.attempts, claimed: r.claimed_at !== null, marked: r.sending_at !== null }))
      const { status, total_recipients, sent_count, failed_count, skipped_count } = (await campaignOf(id))!
      await env.DB.prepare(`UPDATE email_campaigns SET status = 'completed' WHERE id = ?`).bind(id).run()
      return { rows, campaign: { status, total_recipients, sent_count, failed_count, skipped_count } }
    }
    // As WS16 step 4 left them: the row whose run died written off with its claim and mark kept, the throttled row back
    // with its attempt, the untried row back with its attempt given back.
    const expected = {
      rows: [
        { status: 'failed', error: WRITTEN_OFF_WORDS, attempts: 1, claimed: true, marked: true },
        { status: 'pending', error: 'Amazon SES 429 TooManyRequestsException: harness: simulated Amazon SES outage', attempts: 1, claimed: false, marked: false },
        { status: 'pending', error: null, attempts: 0, claimed: false, marked: false },
      ],
      campaign: { status: 'sending', total_recipients: 3, sent_count: 0, failed_count: 1, skipped_count: 0 },
    }
    const without = await groupEmailRun()
    expect(without).toEqual(expected)

    const made = await makeSend(admin)
    const [inFlight] = await rowsOf(made.campaignId)
    await env.DB.prepare(`UPDATE email_campaign_recipients SET claimed_at = datetime('now', '-20 minutes'), sending_at = datetime('now', '-20 minutes') WHERE id = ?`).bind(inFlight.id).run()
    await stopListCampaign(env.DB, NEWSLETTER_LIST_ID)
    const beside = await groupEmailRun()
    expect(beside).toEqual(without)
    expect((await rowsOf(made.campaignId)).find((r) => r.id === inFlight.id)).toMatchObject({ status: 'failed', error: WRITTEN_OFF_WORDS })

    // With the rules off, today's path is today's: a 500 through Resend tried again later, in Resend's words.
    flags.listsOn = false
    flags.sender = 'resend'
    const today = await stageCampaign({ recipients: [{ email: address('today') }] })
    emailBehavior.succeed = false
    emailBehavior.status = 500
    await processCampaign(bindings, today)
    expect((await rowsOf(today))[0]).toMatchObject({ status: 'pending', attempts: 1, claimed_at: null, error: 'Resend 500: {"message":"harness: simulated Resend outage"}' })
  })
})

describe('the key and the signature', () => {
  it('are in no row, no answer and no log line a failing send writes, and the signatures the catch point took are none of them', async () => {
    const admin = await seedAdmin()
    await member(address('reader'))
    const logged: unknown[] = []
    for (const method of ['warn', 'log', 'error'] as const) {
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
        logged.push(args)
      })
    }
    emailBehavior.succeed = false
    const answers: unknown[] = []
    for (const [status, code] of [[403, 'AccessDeniedException'], [400, 'MessageRejected'], [500, 'InternalFailure'], [403, 'SignatureDoesNotMatch']] as const) {
      emailBehavior.status = status
      emailBehavior.code = code
      const id = await stageCampaign({ recipients: [{ email: address('failing') }] })
      await processCampaign(bindings, id)
      await sweepPendingCampaigns(bindings)
      // Closed, so the next answer's sweep leaves this campaign's words as they are.
      await env.DB.prepare(`UPDATE email_campaigns SET status = 'completed' WHERE id = ?`).bind(id).run()
      const test = await invoke(testPost, { as: admin, method: 'POST', body: { to: address('tester'), ...SAMPLE, service: 'ses' } })
      answers.push(await test.json())
      const tournamentId = await seedTournament({ name: 'Sample Winter Open', sections: [{ name: 'Open', entryFee: 0 }] })
      const player = await member(address('player'))
      const registered = await invoke(registrationPost, { method: 'POST', as: player, body: { tournamentId, section: 'Open' } })
      answers.push(await registered.json())
    }
    const made = await makeSend(admin)
    await processCampaign(bindings, made.campaignId)

    const errors = (await env.DB.prepare('SELECT error FROM email_campaign_recipients WHERE error IS NOT NULL').all<{ error: string }>()).results.map((r) => r.error)
    expect(errors.some((e) => e.startsWith('Amazon SES 403 AccessDeniedException'))).toBe(true)
    expect(logged.length).toBeGreaterThan(0)
    expect(sesSignatures.length).toBeGreaterThan(5)
    const everything = JSON.stringify({ errors, logged, answers })
    expect(everything).not.toContain(secret())
    expect(everything).not.toContain('Credential=')
    expect(everything).not.toContain('AWS4-HMAC-SHA256')
    for (const signature of sesSignatures) expect(everything).not.toContain(signature)
  })
})
