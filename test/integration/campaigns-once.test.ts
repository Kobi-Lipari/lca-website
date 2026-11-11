// test/integration/campaigns-once.test.ts
//
// WS16 step 4: Group email's sender under the mail engine's rules, the twin
// of test/integration/campaigns.test.ts, which holds today's path with the
// rules off and passes unchanged. MAIL_LISTS_ON, MAIL_SENDER, WORKERS_PLAN
// and COMPLAINT_STOPS_OTHER_SENDERS are read through getters on the mocked
// functions/utils/mail/switches, set before every case, so no value the
// code ships with decides one. Nothing here reaches an outside service: the
// harness answers Resend and the sign-in service. The pause between two
// sends calls back at once (quickPauses), and a case about a deadline holds
// the clock and never sleeps.
//
// - (a) A row is marked just before its send and never claimed again once
//   marked, by either path: a marked row whose claim has expired is written
//   off with the words, and a claimed row its run never marked is sent by
//   the next run.
// - (b) An answer that does not prove the service refused the message is
//   never tried again: a lost answer, a request with no answer at all, a
//   500; and a 422 is failed at once. Under today's rules a lost answer was
//   tried again, which this ends.
// - (c) An answer that proves it (a 429, a refusal of the key, the limit of
//   outside calls) ends the run with this row and the rest back in the
//   pool, the untried rows' attempts given back.
// - (d) The free plan's sizes: one batch of 10 for the request, 20 from one
//   campaign for a sweep run; counted, Group email's request for an LCA
//   admin at 12 outside calls and 22 queries, and a sweep run at 20 and 27.
// - (e) Workers Paid's: a sweep run sends 300 across campaigns, and the
//   request path checks its deadline before each send, claiming no more
//   than fits, a claimed row it does not reach going back.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { onRequestPost as campaignsPost } from '../../functions/api/admin/campaigns'
import {
  drainCampaign, MAIL_KEY_MISSING_WORDS, NO_CLEAR_ANSWER_WORDS, processCampaign, sweepPendingCampaigns, WRITTEN_OFF_WORDS,
} from '../../functions/utils/admin/campaigns'
import { TOO_MANY_OUTSIDE_CALLS } from '../../functions/utils/mail/send'
import { seedAdmin, seedMember } from './factories'
import { emailBehavior, emailOutbox, fetchCount, flushWaitUntil, invoke, resetHarness } from './harness'
import { bindings, countingDb, holdClock } from './mailRuns'
import { campaignOf, nextCampaignSeq, quickPauses, rowsOf, stageCampaign } from './campaignRuns'

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

/** Addresses of the harness's own kind, which every gate lets through. */
const addressesFor = (prefix: string, count: number) => Array.from({ length: count }, (_, i) => `${prefix}-${String(i).padStart(3, '0')}@once.test.lca`)
const mailedTo = (prefix: string) => emailOutbox.map((e) => e.to).filter((to) => to.startsWith(`${prefix}-`))
const EXPIRED = "datetime('now', '-20 minutes')"
const FRESH = "datetime('now')"

beforeEach(async () => {
  resetHarness()
  flags.listsOn = true
  flags.sender = 'resend'
  flags.plan = 'free'
  flags.complaintStops = true
  quickPauses()
  await env.DB.prepare('DELETE FROM email_campaign_recipients').run()
  await env.DB.prepare('DELETE FROM email_campaigns').run()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('(a) a row is marked just before its send and never sent twice', () => {
  it('writes off a row marked sending whose claim has expired, with the words, counted in failed, and never sends it', async () => {
    const [died, next] = addressesFor('died', 2)
    const id = await stageCampaign({ recipients: [{ email: died, claimedAt: EXPIRED, sendingAt: EXPIRED, attempts: 1 }, { email: next }] })
    expect(await processCampaign(bindings, id)).toEqual({ sent: 1, failed: 1, remaining: 0, done: true })
    expect(mailedTo('died')).toEqual([next])
    const [writtenOff] = await rowsOf(id)
    expect(writtenOff).toMatchObject({ email: died, status: 'failed', error: WRITTEN_OFF_WORDS, attempts: 1 })
    expect(await campaignOf(id)).toMatchObject({ status: 'completed', sent_count: 1, failed_count: 1 })
    await sweepPendingCampaigns(bindings)
    expect(mailedTo('died')).toEqual([next])
  })

  it('leaves a row marked sending under a live claim to its run: neither sent nor written off', async () => {
    const [live, other] = addressesFor('live', 2)
    const id = await stageCampaign({ recipients: [{ email: live, claimedAt: FRESH, sendingAt: FRESH, attempts: 1 }, { email: other }] })
    expect(await processCampaign(bindings, id)).toEqual({ sent: 1, failed: 0, remaining: 1, done: false })
    expect(mailedTo('live')).toEqual([other])
    expect((await rowsOf(id))[0]).toMatchObject({ status: 'pending', error: null })
  })

  it('sends a claimed row its run never marked once the claim has expired, and holds it while the claim is live', async () => {
    const [unmarked] = addressesFor('unmarked', 1)
    const held = await stageCampaign({ recipients: [{ email: unmarked, claimedAt: FRESH, attempts: 1 }] })
    expect(await processCampaign(bindings, held)).toEqual({ sent: 0, failed: 0, remaining: 1, done: false })
    await env.DB.prepare(`UPDATE email_campaign_recipients SET claimed_at = ${EXPIRED} WHERE campaign_id = ?`).bind(held).run()
    expect(await processCampaign(bindings, held)).toEqual({ sent: 1, failed: 0, remaining: 0, done: true })
    expect(mailedTo('unmarked')).toEqual([unmarked])
    expect((await rowsOf(held))[0]).toMatchObject({ status: 'sent', attempts: 2 })
  })

  it('claims no marked row on today\'s path either: with the rules off a marked row whose claim expired is not sent again', async () => {
    flags.listsOn = false
    const [marked, plain] = addressesFor('today-marked', 2)
    const id = await stageCampaign({ recipients: [{ email: marked, claimedAt: EXPIRED, sendingAt: EXPIRED, attempts: 1 }, { email: plain }] })
    expect(await processCampaign(bindings, id)).toEqual({ sent: 1, failed: 0, remaining: 1, done: false })
    expect(mailedTo('today-marked')).toEqual([plain])
  })

  it('sends no row that is no longer pending when its turn comes, such as one a stop failed, and puts the rows after it back', async () => {
    const rows = addressesFor('stopped-midway', 4)
    const id = await stageCampaign({ recipients: rows.map((email) => ({ email })) })
    const underneath = globalThis.fetch
    let calls = 0
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      // While the first message is with the service, the rows not yet marked are failed, as a stop fails them.
      if (new URL(input instanceof Request ? input.url : String(input)).hostname === 'api.resend.com' && ++calls === 1) {
        await env.DB.prepare(`UPDATE email_campaign_recipients SET status = 'failed', error = 'Not sent: the send was stopped.' WHERE campaign_id = ? AND sending_at IS NULL`).bind(id).run()
      }
      return underneath(input, init)
    }) as typeof fetch
    try {
      expect(await processCampaign(bindings, id)).toEqual({ sent: 1, failed: 0, remaining: 0, done: true })
    } finally {
      globalThis.fetch = underneath
    }
    expect(mailedTo('stopped-midway')).toEqual([rows[0]])
    expect((await rowsOf(id)).map((r) => r.status)).toEqual(['sent', 'failed', 'failed', 'failed'])
  })
})

describe('(b) an answer that does not prove a refusal is never tried again', () => {
  it('fails a send whose answer was lost after the service took it, with the words, and never sends it a second time; today\'s path would', async () => {
    const [lost, after] = addressesFor('lost', 2)
    const id = await stageCampaign({ recipients: [{ email: lost }, { email: after }] })
    emailBehavior.loseAnswer = 1
    expect(await processCampaign(bindings, id)).toEqual({ sent: 1, failed: 1, remaining: 0, done: true })
    expect((await rowsOf(id))[0]).toMatchObject({ email: lost, status: 'failed', error: NO_CLEAR_ANSWER_WORDS, attempts: 1 })
    await sweepPendingCampaigns(bindings)
    expect(mailedTo('lost')).toEqual([lost, after])

    // The same lost answer with the rules off: today's path tries it again, and the message arrives twice.
    flags.listsOn = false
    const [again] = addressesFor('again', 1)
    const today = await stageCampaign({ recipients: [{ email: again }] })
    emailBehavior.loseAnswer = 1
    await processCampaign(bindings, today)
    await processCampaign(bindings, today)
    expect(mailedTo('again')).toEqual([again, again])
  })

  it('fails a request that had no answer at all, before the service had it, and never tries it again', async () => {
    const [silent] = addressesFor('silent', 1)
    const id = await stageCampaign({ recipients: [{ email: silent }] })
    const underneath = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (new URL(input instanceof Request ? input.url : String(input)).hostname === 'api.resend.com') throw new TypeError('fetch failed')
      return underneath(input, init)
    }) as typeof fetch
    try {
      expect(await processCampaign(bindings, id)).toEqual({ sent: 0, failed: 1, remaining: 0, done: true })
    } finally {
      globalThis.fetch = underneath
    }
    expect((await rowsOf(id))[0]).toMatchObject({ status: 'failed', error: NO_CLEAR_ANSWER_WORDS, attempts: 1 })
    expect(await campaignOf(id)).toMatchObject({ status: 'failed', failed_count: 1 })
    await sweepPendingCampaigns(bindings)
    expect(mailedTo('silent')).toEqual([])
  })

  it('fails a 500 with the service\'s words and never tries it again, the twin of today\'s retry of a 500', async () => {
    const [flaky] = addressesFor('flaky', 1)
    const id = await stageCampaign({ recipients: [{ email: flaky }] })
    emailBehavior.succeed = false
    emailBehavior.status = 500
    expect(await processCampaign(bindings, id)).toEqual({ sent: 0, failed: 1, remaining: 0, done: true })
    expect((await rowsOf(id))[0]).toMatchObject({ status: 'failed', attempts: 1 })
    expect((await rowsOf(id))[0].error).toMatch(/^Resend 500: /)
    emailBehavior.succeed = true
    expect((await sweepPendingCampaigns(bindings)).sent).toBe(0)
  })

  it('fails a 422 at once, with the service\'s words', async () => {
    const [rejected, fine] = addressesFor('rejected', 2)
    const id = await stageCampaign({ recipients: [{ email: rejected }, { email: fine }] })
    emailBehavior.succeed = false
    emailBehavior.status = 422
    emailBehavior.failFor = [rejected]
    expect(await processCampaign(bindings, id)).toEqual({ sent: 1, failed: 1, remaining: 0, done: true })
    const [row] = await rowsOf(id)
    expect(row).toMatchObject({ status: 'failed', attempts: 1 })
    expect(row.error).toMatch(/^Resend 422: /)
  })
})

describe('(c) an answer that proves the service refused for now ends the run and puts the untried rows back', () => {
  it('a 429 on the first row: every claimed row goes back, unclaimed and unmarked, the untried rows\' attempts given back, and a later run sends them', async () => {
    const rows = addressesFor('throttled', 5)
    const id = await stageCampaign({ recipients: rows.map((email) => ({ email })) })
    emailBehavior.succeed = false
    emailBehavior.status = 429
    expect(await processCampaign(bindings, id)).toEqual({ sent: 0, failed: 0, remaining: 5, done: false })
    const back = await rowsOf(id)
    expect(back.map((r) => [r.status, r.claimed_at, r.sending_at, r.attempts])).toEqual([
      ['pending', null, null, 1], ['pending', null, null, 0], ['pending', null, null, 0], ['pending', null, null, 0], ['pending', null, null, 0],
    ])
    expect(back[0].error).toMatch(/^Resend 429: /)
    expect(mailedTo('throttled')).toEqual([])
    emailBehavior.succeed = true
    expect((await sweepPendingCampaigns(bindings)).sent).toBe(5)
    expect(mailedTo('throttled')).toEqual(rows)
  })

  it('a 429 on a later row keeps what went, and puts that row and the rest back', async () => {
    const rows = addressesFor('throttled-later', 5)
    const id = await stageCampaign({ recipients: rows.map((email) => ({ email })) })
    emailBehavior.succeed = false
    emailBehavior.status = 429
    emailBehavior.failFor = [rows[2]]
    expect(await processCampaign(bindings, id)).toEqual({ sent: 2, failed: 0, remaining: 3, done: false })
    expect((await rowsOf(id)).map((r) => [r.status, r.attempts])).toEqual([['sent', 1], ['sent', 1], ['pending', 1], ['pending', 0], ['pending', 0]])
  })

  it('a refusal of the key is a key fault: the batch goes back untried, its first row saying the key is missing, and the sweep ends there', async () => {
    flags.plan = 'paid'
    const first = await stageCampaign({ createdAt: '2026-11-01 10:00:00', recipients: addressesFor('key-first', 3).map((email) => ({ email })) })
    const second = await stageCampaign({ createdAt: '2026-11-01 11:00:00', recipients: addressesFor('key-second', 3).map((email) => ({ email })) })
    emailBehavior.succeed = false
    emailBehavior.status = 401
    expect(await sweepPendingCampaigns(bindings)).toEqual({ campaignsTouched: 0, sent: 0, failed: 0 })
    const back = await rowsOf(first)
    expect(back.map((r) => [r.status, r.claimed_at, r.attempts])).toEqual([['pending', null, 0], ['pending', null, 0], ['pending', null, 0]])
    expect(back[0].error).toBe(MAIL_KEY_MISSING_WORDS)
    // The second campaign was never reached: every send would have met the same refusal.
    expect((await rowsOf(second)).map((r) => r.attempts)).toEqual([0, 0, 0])
  })

  it('a call the runtime refuses for the limit of outside calls ends the run, the refused row going back untried with the rest', async () => {
    const rows = addressesFor('limit', 4)
    const id = await stageCampaign({ recipients: rows.map((email) => ({ email })) })
    emailBehavior.limitAfter = 2
    expect(await processCampaign(bindings, id)).toEqual({ sent: 2, failed: 0, remaining: 2, done: false })
    const back = await rowsOf(id)
    expect(back.map((r) => [r.status, r.attempts])).toEqual([['sent', 1], ['sent', 1], ['pending', 0], ['pending', 0]])
    expect(back[2].error).toBe(TOO_MANY_OUTSIDE_CALLS)
  })
})

describe('(d) on the free plan\'s sizes', () => {
  it('the request path sends one batch of 10 and leaves the rest to the sweep, which sends 20 from one campaign a run, the oldest', async () => {
    const admin = await seedAdmin()
    const members: string[] = []
    for (const email of addressesFor('picked', 30)) members.push(await seedMember({ email }))
    const res = await invoke(campaignsPost, {
      method: 'POST', as: admin,
      body: { subject: 'Sample message one', bodyHtml: '<p>Example words.</p>', filter: {}, onlySelected: true, includeMemberIds: members },
    })
    expect(res.status).toBe(201)
    const { campaignId } = await res.json<{ campaignId: string }>()
    await flushWaitUntil()
    expect(mailedTo('picked')).toHaveLength(10)

    const younger = await stageCampaign({ createdAt: '2099-01-01 00:00:00', recipients: addressesFor('younger', 3).map((email) => ({ email })) })
    expect(await sweepPendingCampaigns(bindings)).toEqual({ campaignsTouched: 1, sent: 20, failed: 0 })
    expect(mailedTo('picked')).toHaveLength(30)
    expect(new Set(mailedTo('picked')).size).toBe(30)
    expect(await campaignOf(campaignId)).toMatchObject({ status: 'completed', sent_count: 30 })
    expect(mailedTo('younger')).toEqual([])
    expect(await sweepPendingCampaigns(bindings)).toEqual({ campaignsTouched: 1, sent: 3, failed: 0 })
    expect(await campaignOf(younger)).toMatchObject({ status: 'completed' })
  })

  it('counted: Group email\'s request for an LCA admin makes at most 12 outside calls and 25 queries, its own and its batch\'s', async () => {
    const admin = await seedAdmin()
    const members: string[] = []
    for (const email of addressesFor('counted', 30)) members.push(await seedMember({ email }))
    resetHarness()
    const { db, ran } = countingDb()
    const res = await invoke(campaignsPost, {
      method: 'POST', as: admin, env: { DB: db },
      body: { subject: 'Sample message one', bodyHtml: '<p>Example words.</p>', filter: {}, onlySelected: true, includeMemberIds: members },
    })
    expect(res.status).toBe(201)
    await flushWaitUntil()
    expect(mailedTo('counted')).toHaveLength(10)
    // Two outside calls to the sign-in service (requireMailer verifies an LCA admin's session twice) and the ten sends.
    expect(fetchCount).toBe(12)
    // Six of the request's own (two member reads, the picked members, the insert, one recipient batch, the audit row)
    // and the batch's 16: the read, the write-off, the claim, the gate, the first mark, ten outcomes and the count.
    expect(ran).toHaveLength(22)
    expect(ran.length).toBeLessThanOrEqual(25)
  })

  it('counted: a sweep run makes at most 21 outside calls and 30 queries', async () => {
    const id = await stageCampaign({ recipients: addressesFor('swept', 25).map((email) => ({ email })) })
    const { db, ran } = countingDb()
    expect(await sweepPendingCampaigns({ ...bindings, DB: db })).toEqual({ campaignsTouched: 1, sent: 20, failed: 0 })
    expect(fetchCount).toBe(20)
    // The campaigns read, then the batch's 26: the read, the write-off, the claim, the gate, the first mark, twenty
    // outcomes and the count.
    expect(ran).toHaveLength(27)
    expect(fetchCount).toBeLessThanOrEqual(21)
    expect(ran.length).toBeLessThanOrEqual(30)
    expect(await campaignOf(id)).toMatchObject({ sent_count: 20 })
  })
})

describe('(e) on Workers Paid\'s sizes', () => {
  it('a sweep run sends up to 300 across campaigns, oldest first', { timeout: 60_000 }, async () => {
    flags.plan = 'paid'
    const campaigns: string[] = []
    for (const [index, hour] of ['10', '11', '12'].entries()) {
      campaigns.push(await stageCampaign({ id: `campaign-paid-${nextCampaignSeq()}`, createdAt: `2026-11-01 ${hour}:00:00`, recipients: addressesFor(`paid${index}`, 120).map((email) => ({ email })) }))
    }
    expect(await sweepPendingCampaigns(bindings)).toEqual({ campaignsTouched: 3, sent: 300, failed: 0 })
    expect(mailedTo('paid0')).toHaveLength(120)
    expect(mailedTo('paid1')).toHaveLength(120)
    expect(mailedTo('paid2')).toHaveLength(60)
    expect(new Set(emailOutbox.map((e) => e.to)).size).toBe(300)
    expect((await campaignOf(campaigns[2]))!.sent_count).toBe(60)
  })

  it('the request path checks its deadline before each send, claims no more than fits in the time left, and puts back a claimed row it does not reach', async () => {
    flags.plan = 'paid'
    holdClock()
    const rows = addressesFor('deadline', 100)
    const id = await stageCampaign({ recipients: rows.map((email) => ({ email })) })
    const underneath = globalThis.fetch
    let sends = 0
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      // The 41st message takes three seconds to answer, so the second batch meets its deadline sooner than it planned.
      if (new URL(input instanceof Request ? input.url : String(input)).hostname === 'api.resend.com' && ++sends === 41) vi.setSystemTime(Date.now() + 3_000)
      return underneath(input, init)
    }) as typeof fetch
    try {
      await drainCampaign(bindings, id)
    } finally {
      globalThis.fetch = underneath
    }
    // 40 in the first batch, sent 400 ms apart from the start; the second claims the 10 that fit in the 4 seconds left
    // and sends 3 before the deadline; the 7 it does not reach go back, unclaimed, unmarked, their attempts given back.
    expect(mailedTo('deadline')).toEqual(rows.slice(0, 43))
    const after = await rowsOf(id)
    expect(after.slice(0, 43).every((r) => r.status === 'sent')).toBe(true)
    expect(after.slice(43, 50).map((r) => [r.status, r.claimed_at, r.sending_at, r.attempts])).toEqual(Array(7).fill(['pending', null, null, 0]))
    expect(after.slice(50).every((r) => r.status === 'pending' && r.attempts === 0 && r.claimed_at === null)).toBe(true)
  })
})
