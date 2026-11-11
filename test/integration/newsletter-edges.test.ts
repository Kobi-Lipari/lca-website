// test/integration/newsletter-edges.test.ts
//
// WS16 step 4: the edges of the newsletter list and the engine's rules that
// test/integration/newsletter.test.ts and campaigns-once.test.ts do not
// reach, through the same real handlers, list path and seam, on the
// database every integration test builds from the migrations. MAIL_LISTS_ON,
// MAIL_SENDER, WORKERS_PLAN and COMPLAINT_STOPS_OTHER_SENDERS are read
// through getters on the mocked functions/utils/mail/switches, set before
// every case. Nothing here reaches an outside service: the harness answers
// Resend and the sign-in service, and a case about a pause between sends
// takes it out of its time (quickPauses).
//
// - The summary's five counts and its history, read from rows this file
//   seeds, as differences from what the migrations seed.
// - The audience's edges, as createListCampaign writes them: padded and
//   upper-case addresses, every role but a walk-in, an address on two
//   accounts, malformed addresses, a spam report and a choice on another
//   list, none of which moves anyone on or off the list.
// - The test send's edges: an address on the do-not-send list is refused, a
//   person who stopped all optional mail can still send themselves a test, a
//   missing link key and a service that fails are answered in words, a 403
//   from the service in its own words and a gate's refusal in the gate's,
//   and a second test makes no second contact.
// - The stop's edges: nothing untried, some sent, and Group email's own
//   campaign left alone, one newsletter at a time kept apart from it.
// - The row decides its path: a list campaign waits for Amazon SES with the
//   rules off, and Group email's campaign in the same sweep goes today's way.
// - Ties, replays and a race: two campaigns with one creation time, a
//   write-off that counts once, and two runs claiming at the same moment.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NEWSLETTER_LIST_ID, TOURNAMENTS_LIST_ID } from '../../domain/mail/lists'
import { onRequestGet as newsletterGet } from '../../functions/api/admin/mail/newsletter'
import { onRequestPost as stopPost } from '../../functions/api/admin/mail/newsletter/stop'
import { onRequestPost as testPost } from '../../functions/api/admin/mail/newsletter/test'
import {
  LINK_KEY_DIFFERS_WORDS, NO_CLEAR_ANSWER_WORDS, NO_LINK_WORDS, NO_LIST_SENDER_WORDS, processCampaign, sweepPendingCampaigns, WRITTEN_OFF_WORDS,
} from '../../functions/utils/admin/campaigns'
import { linkKeyCheck } from '../../functions/utils/mail/links'
import { createListCampaign, newsletterSummary } from '../../functions/utils/mail/lists'
import { LINK_KEY_MISSING, NOTHING_SENDING } from '../../functions/utils/mail/newsletterAnswers'
import { WAIT_FOR_SES_WORDS } from '../../functions/utils/mail/send'
import type { Env } from '../../functions/types'
import { seedAdmin, seedMailContact, seedMember } from './factories'
import { emailBehavior, emailOutbox, invoke, resetHarness } from './harness'
import { bindings, noLongerReceives } from './mailRuns'
import { campaignOf, quickPauses, rowsOf, stageCampaign } from './campaignRuns'

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

const key = () => (env as unknown as Env).MAIL_LINK_SECRET as string
const SAMPLE = { subject: 'Sample newsletter one', bodyHtml: '<p>Example words for a sample newsletter.</p>' }

let seq = 0
/** An address of the harness's own kind, which every list may send to, with a prefix to pick this file's addresses out. */
const address = (name: string) => `${name}-${++seq}@edges.test.lca`
const member = (email: string, opts: { membershipStatus?: string; role?: string } = {}) => seedMember({ email, fullName: 'Player One', ...opts })
const SPACES = String.fromCharCode(9, 160)
const TRAILING = String.fromCharCode(160, 10)

async function makeSend(by: string) {
  return createListCampaign(env.DB, { listId: NEWSLETTER_LIST_ID, ...SAMPLE, createdBy: by, linkCheck: await linkKeyCheck(key()) })
}

const emailsOf = async (campaignId: string) => (await rowsOf(campaignId)).map((r) => r.email).sort()
const mailedTo = (prefix: string) => emailOutbox.map((e) => e.to).filter((to) => to.startsWith(`${prefix}-`))
const count = async (sql: string) => (await env.DB.prepare(sql).first<{ n: number }>())!.n

beforeEach(async () => {
  resetHarness()
  flags.listsOn = true
  flags.sender = 'resend'
  flags.plan = 'free'
  flags.complaintStops = true
  quickPauses()
  for (const table of ['email_campaign_recipients', 'email_campaigns', 'mail_list_choices', 'mail_contacts', 'mail_do_not_send']) {
    await env.DB.prepare(`DELETE FROM ${table}`).run()
  }
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('the summary', () => {
  it('counts the audience, those who turned the newsletter off, those who stopped all optional mail and the do-not-send list, which may overlap, and those who will get the next send', async () => {
    const before = await newsletterSummary(env.DB)
    const plain = address('summary-plain')
    const off = address('summary-off')
    const stopped = address('summary-stopped')
    const dead = address('summary-dead')
    const both = address('summary-both')
    const lapsed = address('summary-lapsed')
    for (const email of [plain, off, stopped, dead, both]) await member(email)
    await member(lapsed, { membershipStatus: 'expired' })
    await seedMailContact({ address: off, choices: { [NEWSLETTER_LIST_ID]: { choice: 'out' } } })
    await seedMailContact({ address: stopped, optionalOffAt: '2026-11-01 10:00:00' })
    await seedMailContact({ address: both, optionalOffAt: '2026-11-01 10:00:00', choices: { [NEWSLETTER_LIST_ID]: { choice: 'out' } } })
    await noLongerReceives(dead)
    // Outside the audience, these count for nothing: a lapsed account turned off, and an address with no account on the do-not-send list.
    await seedMailContact({ address: lapsed, choices: { [NEWSLETTER_LIST_ID]: { choice: 'out' } } })
    await noLongerReceives(address('summary-nobody'))

    const now = await newsletterSummary(env.DB)
    expect({
      addresses: now.addresses - before.addresses,
      turnedOff: now.turnedOff - before.turnedOff,
      stoppedAll: now.stoppedAll - before.stoppedAll,
      doNotSend: now.doNotSend - before.doNotSend,
      willGet: now.willGet - before.willGet,
    }).toEqual({ addresses: 5, turnedOff: 2, stoppedAll: 2, doNotSend: 1, willGet: 1 })

    // The endpoint answers the same figures.
    const read = await invoke(newsletterGet, { as: await seedAdmin() })
    const { recent, ...counts } = (await read.json<{ summary: typeof now }>()).summary
    expect(recent).toEqual([])
    // The admin just seeded is a member too, so the endpoint's audience is one larger.
    expect(counts).toEqual({ ...Object.fromEntries(Object.entries(now).filter(([k]) => k !== 'recent')), addresses: now.addresses + 1, willGet: now.willGet + 1 })
  })

  it('gives the last 10 newsletter sends, newest first, with their counters, and leaves Group email\'s campaigns out', async () => {
    const filterJson = JSON.stringify({ list: NEWSLETTER_LIST_ID, linkCheck: await linkKeyCheck(key()) })
    const ids: string[] = []
    for (let i = 0; i < 12; i += 1) {
      ids.push(await stageCampaign({ subject: `Sample newsletter ${i}`, listId: NEWSLETTER_LIST_ID, filterJson, createdAt: `2026-10-${String(10 + i).padStart(2, '0')} 09:00:00`, recipients: [] }))
    }
    await stageCampaign({ subject: 'Sample group message', createdAt: '2026-10-30 09:00:00', recipients: [] })
    await env.DB.prepare(`UPDATE email_campaigns SET status = 'completed', sent_count = 7, failed_count = 2, skipped_count = 1, total_recipients = 9, completed_at = '2026-10-21 10:00:00' WHERE id = ?`).bind(ids[11]).run()

    const { recent } = await newsletterSummary(env.DB)
    expect(recent.map((r) => r.id)).toEqual(ids.slice(2).reverse())
    expect(recent).toHaveLength(10)
    expect(recent[0]).toMatchObject({ subject: 'Sample newsletter 11', status: 'completed', totalRecipients: 9, sentCount: 7, failedCount: 2, skippedCount: 1, completedAt: '2026-10-21 10:00:00' })
    expect(recent[1]).toMatchObject({ status: 'sending', completedAt: null })
    expect(recent.map((r) => r.subject)).not.toContain('Sample group message')
  })
})

describe('who is on the list, at its edges', () => {
  it('holds a padded or upper-case address once, every role but a walk-in, and an address with one active account among lapsed ones, and no malformed address', async () => {
    const admin = await seedAdmin()
    const padded = `edge-padded-${++seq}@edges.test.lca`
    await member(`${SPACES}${padded.toUpperCase()}${TRAILING}`)
    await member(padded)
    const roles = ['lca_admin', 'club_rep', 'lca_officer', 'lca_observer', 'tournament_director'].map((role) => [role, address(`edge-role`)] as const)
    for (const [role, email] of roles) await member(email, { role })
    const shared = address('edge-shared')
    await member(shared, { membershipStatus: 'expired' })
    await member(shared)
    const lapsedTwice = address('edge-lapsed-twice')
    await member(lapsedTwice, { membershipStatus: 'expired' })
    await member(lapsedTwice, { membershipStatus: 'pending' })
    const tagged = address('edge-tag+news')
    await member(tagged)

    const malformed = [
      '   ',
      `edge-space-${++seq} x@edges.test.lca`,
      `edge-no-at-${++seq}.edges.test.lca`,
      `@edges-${++seq}.test.lca`,
      `edge-two-${++seq}@@edges.test.lca`,
      `edge-no-dot-${++seq}@localhost`,
      `edge-trailing-dot-${++seq}@edges.test.lca.`,
      `edge-reserved-${++seq}@club.test`,
      `edge-reserved-${++seq}@club.localhost`,
      `edge-docs-${++seq}@sub.example.com`,
      `edge-site-${++seq}@louisianachess.org`,
      `edge-site-${++seq}@news.louisianachess.org`,
    ]
    for (const email of malformed) await member(email)

    const made = await makeSend(admin)
    const emails = (await emailsOf(made!.campaignId)).filter((e) => e.startsWith('edge-'))
    expect(emails).toEqual([padded, ...roles.map(([, email]) => email), shared, tagged].sort())
    expect(emails.filter((e) => e === padded)).toHaveLength(1)
    expect(emails.filter((e) => e === shared)).toHaveLength(1)
    // The padded address is written to the contact and the row trimmed and lower-cased, once.
    expect(await count(`SELECT COUNT(*) AS n FROM mail_contacts WHERE address = '${padded}'`)).toBe(1)
    expect((await rowsOf(made!.campaignId)).filter((r) => r.email === padded)).toHaveLength(1)
  })

  it('leaves an address on the list when it complained on any list or turned off a different list, and takes it off only for its own choice', async () => {
    const admin = await seedAdmin()
    const complained = address('choice-complained')
    const otherListOff = address('choice-other-off')
    const ownOff = address('choice-own-off')
    for (const email of [complained, otherListOff, ownOff]) await member(email)
    await seedMailContact({ address: complained, complainedAt: '2026-11-01 10:00:00' })
    await seedMailContact({ address: otherListOff, choices: { [TOURNAMENTS_LIST_ID]: { choice: 'out' } } })
    await seedMailContact({ address: ownOff, choices: { [TOURNAMENTS_LIST_ID]: { choice: 'out' }, [NEWSLETTER_LIST_ID]: { choice: 'out' } } })

    const made = await makeSend(admin)
    const emails = (await emailsOf(made!.campaignId)).filter((e) => e.startsWith('choice-'))
    expect(emails).toEqual([complained, otherListOff].sort())

    // At its turn the gate does not turn the report's mark into a skip either: both of LCA's lists are main mailers.
    expect(await processCampaign(bindings, made!.campaignId, 1000)).toMatchObject({ sent: 0, failed: 0, done: false })
    expect(await campaignOf(made!.campaignId)).toMatchObject({ skipped_count: 0 })
    expect((await emailsOf(made!.campaignId)).filter((e) => e.startsWith('choice-'))).toEqual([complained, otherListOff].sort())
  })
})

describe('the test send, at its edges', () => {
  it('refuses an address on the do-not-send list with the gate\'s words, sending nothing, and makes no contact beyond the address\'s own', async () => {
    const admin = await seedAdmin()
    const dead = address('test-dead')
    await noLongerReceives(dead)
    const res = await invoke(testPost, { as: admin, method: 'POST', body: { to: dead, ...SAMPLE } })
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ error: 'Failed to send test email: Not sent: this address no longer receives mail.' })
    expect(emailOutbox).toEqual([])
  })

  it('lets someone who stopped all optional mail, or reported the newsletter as spam, send themselves a test', async () => {
    const admin = await seedAdmin()
    const stopped = address('test-stopped')
    const reported = address('test-reported')
    await seedMailContact({ address: stopped, optionalOffAt: '2026-11-01 10:00:00' })
    await seedMailContact({ address: reported, complainedAt: '2026-11-01 10:00:00', choices: { [NEWSLETTER_LIST_ID]: { choice: 'out', source: 'complaint' } } })
    for (const to of [stopped, reported]) {
      expect((await invoke(testPost, { as: admin, method: 'POST', body: { to, ...SAMPLE } })).status, to).toBe(200)
    }
    expect(emailOutbox.map((e) => e.to).sort()).toEqual([reported, stopped].sort())
    for (const sent of emailOutbox) expect(Object.keys(sent.headers!)).toEqual(['List-Unsubscribe', 'List-Unsubscribe-Post'])
  })

  it('answers 503 in the send\'s words without the link key, before any contact is made or any request is sent', async () => {
    const to = address('test-nokey')
    const res = await invoke(testPost, { as: await seedAdmin(), method: 'POST', body: { to, ...SAMPLE }, env: { MAIL_LINK_SECRET: '' } })
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: LINK_KEY_MISSING })
    expect(await count('SELECT COUNT(*) AS n FROM mail_contacts')).toBe(0)
    expect(emailOutbox).toEqual([])
  })

  it('answers 502 with the service\'s words when it refuses, and with the no-clear-answer words when the answer is lost, never trying a test twice', async () => {
    const admin = await seedAdmin()
    const to = address('test-outage')
    emailBehavior.succeed = false
    emailBehavior.status = 500
    const refused = await invoke(testPost, { as: admin, method: 'POST', body: { to, ...SAMPLE } })
    expect(refused.status).toBe(502)
    expect((await refused.json<{ error: string }>()).error).toMatch(/^Failed to send test email: Resend 500: /)

    resetHarness()
    emailBehavior.loseAnswer = 1
    const lost = await invoke(testPost, { as: admin, method: 'POST', body: { to, ...SAMPLE } })
    expect(lost.status).toBe(502)
    expect(await lost.json()).toEqual({ error: `Failed to send test email: ${NO_CLEAR_ANSWER_WORDS}` })
    expect(emailOutbox.filter((e) => e.to === to)).toHaveLength(1)
  })

  it('answers a 403 from the mail service with its status and its body, as Group email\'s test send does, not as a missing key', async () => {
    const to = address('test-forbidden')
    emailBehavior.succeed = false
    emailBehavior.status = 403
    const res = await invoke(testPost, { as: await seedAdmin(), method: 'POST', body: { to, ...SAMPLE } })
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ error: `Failed to send test email: Resend 403: ${JSON.stringify({ message: 'harness: simulated Resend outage' })}` })
    expect(emailOutbox).toEqual([])
  })

  it('still answers a refusal by the gate in the gate\'s own words while the service would answer 403, and sends nothing', async () => {
    const admin = await seedAdmin()
    const dead = address('test-gate')
    await noLongerReceives(dead)
    emailBehavior.succeed = false
    emailBehavior.status = 403
    const cases = [
      [dead, 'Failed to send test email: Not sent: this address no longer receives mail.'],
      ['player.one@example.org', 'Failed to send test email: Not sent: not a real address.'],
    ] as const
    for (const [to, error] of cases) {
      const res = await invoke(testPost, { as: admin, method: 'POST', body: { to, ...SAMPLE } })
      expect(res.status, to).toBe(502)
      expect(await res.json(), to).toEqual({ error })
    }
    expect(emailOutbox).toEqual([])
  })

  it('makes one contact for an address however many tests go to it, and puts it on no list', async () => {
    const admin = await seedAdmin()
    const to = address('test-twice')
    for (const typed of [to, ` ${to.toUpperCase()} `]) {
      expect((await invoke(testPost, { as: admin, method: 'POST', body: { to: typed, ...SAMPLE } })).status).toBe(200)
    }
    expect(await count(`SELECT COUNT(*) AS n FROM mail_contacts WHERE address = '${to}'`)).toBe(1)
    expect(await count('SELECT COUNT(*) AS n FROM mail_list_choices')).toBe(0)
    const [first, second] = emailOutbox.filter((e) => e.to === to)
    // Each test carries the same contact's links.
    expect(first.headers!['List-Unsubscribe']).toBe(second.headers!['List-Unsubscribe'])
  })
})

describe('the stop, at its edges', () => {
  it('answers 0 when every row has gone, closes the send as completed and logs it', async () => {
    const admin = await seedAdmin()
    await member(address('stop-sent'))
    const made = await makeSend(admin)
    await env.DB.prepare(`UPDATE email_campaign_recipients SET status = 'sent' WHERE campaign_id = ?`).bind(made!.campaignId).run()
    await env.DB.prepare(`UPDATE email_campaigns SET sent_count = total_recipients WHERE id = ?`).bind(made!.campaignId).run()

    const res = await invoke(stopPost, { as: admin, method: 'POST' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ stopped: 0 })
    expect(await campaignOf(made!.campaignId)).toMatchObject({ status: 'completed', failed_count: 0, sent_count: made!.totalRecipients })
    expect((await invoke(stopPost, { as: admin, method: 'POST' })).status).toBe(409)
  })

  it('closes a send that had begun as completed, not failed, keeping what went and failing the rest with the words', async () => {
    const admin = await seedAdmin()
    await member(address('stop-some'))
    await member(address('stop-some'))
    const made = await makeSend(admin)
    expect(made!.totalRecipients).toBeGreaterThan(2)
    const [first] = await rowsOf(made!.campaignId)
    await env.DB.prepare(`UPDATE email_campaign_recipients SET status = 'sent' WHERE id = ?`).bind(first.id).run()
    await env.DB.prepare(`UPDATE email_campaigns SET sent_count = 1 WHERE id = ?`).bind(made!.campaignId).run()

    const res = await invoke(stopPost, { as: admin, method: 'POST' })
    expect(await res.json()).toEqual({ stopped: made!.totalRecipients - 1 })
    expect(await campaignOf(made!.campaignId)).toMatchObject({ status: 'completed', sent_count: 1, failed_count: made!.totalRecipients - 1 })
    const rows = await rowsOf(made!.campaignId)
    expect(rows.filter((r) => r.status === 'sent')).toHaveLength(1)
    expect(rows.filter((r) => r.status === 'failed')).toHaveLength(made!.totalRecipients - 1)
  })

  it('leaves Group email\'s campaign alone, answering that no newsletter is sending, and a send in progress there does not keep a newsletter from being made', async () => {
    const admin = await seedAdmin()
    await member(address('stop-apart'))
    const groupId = await stageCampaign({ recipients: [{ email: address('apart-group') }, { email: address('apart-group') }] })
    const res = await invoke(stopPost, { as: admin, method: 'POST' })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: NOTHING_SENDING })
    expect(await campaignOf(groupId)).toMatchObject({ status: 'sending', failed_count: 0 })
    expect((await rowsOf(groupId)).map((r) => r.status)).toEqual(['pending', 'pending'])

    const made = await makeSend(admin)
    expect(made).not.toBeNull()
    expect((await invoke(stopPost, { as: admin, method: 'POST' })).status).toBe(200)
    expect(await campaignOf(groupId)).toMatchObject({ status: 'sending' })
    expect(await campaignOf(made!.campaignId)).toMatchObject({ status: 'failed', list_id: NEWSLETTER_LIST_ID })
  })
})

describe('the row decides its path', () => {
  it('a list campaign waits for Amazon SES with the rules off, and Group email\'s campaign in the same sweep goes today\'s way, plain', async () => {
    flags.listsOn = false
    const filterJson = JSON.stringify({ list: NEWSLETTER_LIST_ID, linkCheck: await linkKeyCheck(key()) })
    const [listed, plain] = [address('decides-list'), address('decides-plain')]
    const contactId = await seedMailContact({ address: listed })
    const listCampaign = await stageCampaign({ createdAt: '2026-11-01 09:00:00', listId: NEWSLETTER_LIST_ID, filterJson, recipients: [{ email: listed, contactId }] })
    const groupCampaign = await stageCampaign({ createdAt: '2026-11-01 10:00:00', recipients: [{ email: plain }] })

    expect(await sweepPendingCampaigns(bindings)).toEqual({ campaignsTouched: 1, sent: 1, failed: 0 })
    expect(emailOutbox.map((e) => e.to)).toEqual([plain])
    expect(emailOutbox[0].headers).toBeUndefined()
    expect(emailOutbox[0].html).not.toContain('/email/unsubscribe/')
    expect(await rowsOf(listCampaign)).toMatchObject([{ status: 'pending', claimed_at: null, sending_at: null, attempts: 0, error: WAIT_FOR_SES_WORDS }])
    expect(await campaignOf(listCampaign)).toMatchObject({ status: 'sending', sent_count: 0, failed_count: 0 })
    expect(await campaignOf(groupCampaign)).toMatchObject({ status: 'completed', sent_count: 1 })
  })
})

describe('ties, replays and a race', () => {
  it('on the free plan, takes the campaign written first when two share a creation time, one a run, and finishes it before the next', async () => {
    const createdAt = '2026-11-01 10:00:00'
    const recipients = (prefix: string) => Array.from({ length: 25 }, (_, i) => ({ email: `${prefix}-${String(i).padStart(2, '0')}@edges.test.lca` }))
    const first = await stageCampaign({ createdAt, recipients: recipients('tie-a') })
    const second = await stageCampaign({ createdAt, recipients: recipients('tie-b') })

    expect(await sweepPendingCampaigns(bindings)).toEqual({ campaignsTouched: 1, sent: 20, failed: 0 })
    expect([mailedTo('tie-a').length, mailedTo('tie-b').length]).toEqual([20, 0])
    expect(await sweepPendingCampaigns(bindings)).toEqual({ campaignsTouched: 1, sent: 5, failed: 0 })
    expect(await sweepPendingCampaigns(bindings)).toEqual({ campaignsTouched: 1, sent: 20, failed: 0 })
    expect([mailedTo('tie-a').length, mailedTo('tie-b').length]).toEqual([25, 20])
    expect(await campaignOf(first)).toMatchObject({ status: 'completed' })
    expect(await campaignOf(second)).toMatchObject({ status: 'sending' })
  })

  it('counts a write-off once however many runs follow, and a run that has nothing to write off counts none', async () => {
    const expired = "datetime('now', '-20 minutes')"
    const id = await stageCampaign({
      recipients: [
        { email: address('off-a'), claimedAt: expired, sendingAt: expired, attempts: 1 },
        { email: address('off-b'), claimedAt: expired, sendingAt: expired, attempts: 1 },
        { email: address('off-c') },
      ],
    })
    expect(await processCampaign(bindings, id)).toEqual({ sent: 1, failed: 2, remaining: 0, done: true })
    expect(await processCampaign(bindings, id)).toEqual({ sent: 0, failed: 0, remaining: 0, done: true })
    expect(await sweepPendingCampaigns(bindings)).toEqual({ campaignsTouched: 0, sent: 0, failed: 0 })
    expect(await campaignOf(id)).toMatchObject({ status: 'completed', sent_count: 1, failed_count: 2 })
    expect((await rowsOf(id)).filter((r) => r.error === WRITTEN_OFF_WORDS)).toHaveLength(2)
    expect(emailOutbox).toHaveLength(1)
  })

  it('two runs that claim at the same moment send each address once between them', async () => {
    const people = Array.from({ length: 30 }, (_, i) => `race-${String(i).padStart(2, '0')}@edges.test.lca`)
    const id = await stageCampaign({ recipients: people.map((email) => ({ email })) })
    const runs = await Promise.all([processCampaign(bindings, id, 20), processCampaign(bindings, id, 20)])
    expect(runs.reduce((sum, run) => sum + run.sent, 0)).toBe(30)
    expect(mailedTo('race').sort()).toEqual(people)
    expect(new Set(mailedTo('race')).size).toBe(30)
    expect(await campaignOf(id)).toMatchObject({ status: 'completed', sent_count: 30, failed_count: 0 })
    expect((await rowsOf(id)).every((r) => r.status === 'sent' && r.attempts === 1)).toBe(true)
  })

  it('a list campaign\'s two runs at the same moment, while it waits for Amazon SES, hold every row back untried and send nothing', async () => {
    const people = Array.from({ length: 6 }, (_, i) => `listrace-${i}@edges.test.lca`)
    const contacts = await Promise.all(people.map((email) => seedMailContact({ address: email })))
    const id = await stageCampaign({
      listId: NEWSLETTER_LIST_ID,
      filterJson: JSON.stringify({ list: NEWSLETTER_LIST_ID, linkCheck: await linkKeyCheck(key()) }),
      recipients: people.map((email, i) => ({ email, contactId: contacts[i] })),
    })
    await Promise.all([processCampaign(bindings, id), processCampaign(bindings, id)])
    expect(emailOutbox).toEqual([])
    const rows = await rowsOf(id)
    expect(rows.every((r) => r.status === 'pending' && r.sending_at === null && r.claimed_at === null && r.attempts === 0)).toBe(true)
    expect(await campaignOf(id)).toMatchObject({ status: 'sending', sent_count: 0, failed_count: 0 })
  })
})

describe('a list campaign a deployment cannot send as it stands', () => {
  const rowFor = async (prefix: string) => {
    const email = address(prefix)
    return { email, contactId: await seedMailContact({ address: email }) }
  }

  it('waits, claiming nothing, for a list whose sender or footer words this deployment does not hold, and sends nothing', async () => {
    const filterJson = JSON.stringify({ list: TOURNAMENTS_LIST_ID, linkCheck: await linkKeyCheck(key()) })
    for (const listId of [TOURNAMENTS_LIST_ID, 'club-sample-list']) {
      const id = await stageCampaign({ listId, filterJson, recipients: [await rowFor('nosender'), await rowFor('nosender')] })
      expect(await processCampaign(bindings, id)).toEqual({ sent: 0, failed: 0, remaining: 2, done: false })
      const rows = await rowsOf(id)
      expect(rows.map((r) => [r.status, r.claimed_at, r.sending_at, r.attempts])).toEqual([['pending', null, null, 0], ['pending', null, null, 0]])
      expect(rows[0].error).toBe(NO_LIST_SENDER_WORDS)
      expect(await campaignOf(id)).toMatchObject({ status: 'sending' })
    }
    expect(emailOutbox).toEqual([])
  })

  it('waits, claiming nothing, when its filter holds no link key check or cannot be read, saying the key is not the one it was made with', async () => {
    for (const filterJson of ['{}', 'not json', JSON.stringify({ list: NEWSLETTER_LIST_ID, linkCheck: 42 })]) {
      const id = await stageCampaign({ listId: NEWSLETTER_LIST_ID, filterJson, recipients: [await rowFor('nocheck')] })
      expect(await processCampaign(bindings, id)).toEqual({ sent: 0, failed: 0, remaining: 1, done: false })
      const [row] = await rowsOf(id)
      expect(row).toMatchObject({ status: 'pending', claimed_at: null, sending_at: null, attempts: 0, error: LINK_KEY_DIFFERS_WORDS })
    }
    expect(emailOutbox).toEqual([])
  })

  it('fails a row that names no contact, since no link can be made for it, with the words, and sends nothing', async () => {
    const filterJson = JSON.stringify({ list: NEWSLETTER_LIST_ID, linkCheck: await linkKeyCheck(key()) })
    const id = await stageCampaign({ listId: NEWSLETTER_LIST_ID, filterJson, recipients: [{ email: address('nocontact') }] })
    expect(await processCampaign(bindings, id)).toEqual({ sent: 0, failed: 1, remaining: 0, done: true })
    expect((await rowsOf(id))[0]).toMatchObject({ status: 'failed', error: NO_LINK_WORDS })
    expect(await campaignOf(id)).toMatchObject({ status: 'failed', failed_count: 1 })
    expect(emailOutbox).toEqual([])
  })
})

describe('a large batch at send time', () => {
  it('takes the rows the gate refuses out of a batch of 300, read in more than one gate query, counted as skipped and out of the total, and holds the rest back untried', async () => {
    flags.plan = 'paid'
    const admin = await seedAdmin()
    const many = Array.from({ length: 300 }, (_, i) => `gate-${String(i).padStart(3, '0')}-${++seq}@edges.test.lca`)
    const inserts = many.map((email, i) =>
      env.DB.prepare(`INSERT INTO members (id, email, full_name, membership_status, role) VALUES (?, ?, 'Player One', 'active', 'member')`).bind(`gate-${seq}-${i}`, email),
    )
    for (let at = 0; at < inserts.length; at += 50) await env.DB.batch(inserts.slice(at, at + 50))
    const made = await makeSend(admin)
    const total = made!.totalRecipients
    expect(total).toBeGreaterThanOrEqual(300)

    // After the send began: 100 addresses land on the do-not-send list, 30 more turn the newsletter off.
    for (const email of many.slice(0, 100)) await noLongerReceives(email)
    const turning = (await env.DB.prepare(`SELECT id FROM mail_contacts WHERE address IN (${many.slice(100, 130).map(() => '?').join(',')})`).bind(...many.slice(100, 130)).all<{ id: string }>()).results
    expect(turning).toHaveLength(30)
    for (const { id } of turning) await env.DB.prepare(`INSERT INTO mail_list_choices (contact_id, list_id, choice, source) VALUES (?, ?, 'out', 'link')`).bind(id, NEWSLETTER_LIST_ID).run()

    expect(await processCampaign(bindings, made!.campaignId, total)).toEqual({ sent: 0, failed: 0, remaining: total - 130, done: false })
    expect(await campaignOf(made!.campaignId)).toMatchObject({ skipped_count: 130, total_recipients: total - 130, failed_count: 0, sent_count: 0, status: 'sending' })
    const rows = await rowsOf(made!.campaignId)
    expect(rows).toHaveLength(total - 130)
    const left = new Set(rows.map((r) => r.email))
    expect(many.slice(0, 130).filter((email) => left.has(email))).toEqual([])
    expect(many.slice(130).every((email) => left.has(email))).toBe(true)
    expect(rows.every((r) => r.status === 'pending' && r.claimed_at === null && r.sending_at === null && r.attempts === 0)).toBe(true)
    expect(emailOutbox).toEqual([])
  })
})

describe('what the summary says sends', () => {
  it('names the service that sends now, so the page can say when the newsletter waits for Amazon SES', async () => {
    const admin = await seedAdmin()
    for (const sender of ['resend', 'ses']) {
      flags.sender = sender
      const read = await invoke(newsletterGet, { as: admin })
      expect((await read.json<{ sendsThrough: string }>()).sendsThrough).toBe(sender)
    }
  })
})
