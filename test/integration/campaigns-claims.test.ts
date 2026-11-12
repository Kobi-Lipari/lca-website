// test/integration/campaigns-claims.test.ts
//
// Checkpoint M's review: a run under the mail engine's rules that is still
// working after its claim has passed its fifteen minutes, beside
// test/integration/campaigns-once.test.ts, which holds the rest of the
// rules, and test/integration/campaigns.test.ts, which holds today's path
// with the rules off, unchanged. MAIL_LISTS_ON, MAIL_SENDER, WORKERS_PLAN
// and COMPLAINT_STOPS_OTHER_SENDERS are read through getters on the mocked
// functions/utils/mail/switches, set before every case. Nothing here reaches
// an outside service: the harness answers Resend. The pause between two
// sends calls back at once (quickPauses), and a case about time holds the
// clock and never sleeps.
//
// - (i) A run puts back only what is its own: a run that loses the race to
//   mark a row leaves it to the run that marked it, the review's own probe
//   among the cases: a stalled run, a second run that claims its rows and a
//   third run, each address reached once and the counts adding up.
// - (ii) A run ends itself before its claim can run out: past ten minutes on
//   one claim it puts back its unmarked rows and ends, and the next run
//   sends them; just before ten minutes it goes on.
// - (iii) A row counts once: a row the sweep wrote off while its run's send
//   outlived the claim is not then counted sent, and a row recorded sent is
//   not then written off.
// - (iv) The edges: a row another run marked is left to that run when a stop
//   has closed the send, the put-back failing none of it; a send that fails
//   for good after the sweep wrote its row off is counted once; and with the
//   rules off a send slow past ten minutes does not end the run.
// Every address and subject here is made up.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { processCampaign, sweepPendingCampaigns, WRITTEN_OFF_WORDS } from '../../functions/utils/admin/campaigns'
import { NEWSLETTER_LIST_ID } from '../../domain/mail/lists'
import { linkKeyCheck } from '../../functions/utils/mail/links'
import { STOPPED_WORDS, contactFor, stopListCampaign } from '../../functions/utils/mail/lists'
import type { Env } from '../../functions/types'
import { emailBehavior, emailOutbox, resetHarness } from './harness'
import { bindings, countingDb, holdClock } from './mailRuns'
import { campaignOf, nextCampaignSeq, quickPauses, rowsOf, stageCampaign } from './campaignRuns'

const flags = vi.hoisted(() => ({ listsOn: true, sender: 'resend', plan: 'paid', complaintStops: true }))
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
const addressesFor = (prefix: string, count: number) => Array.from({ length: count }, (_, i) => `${prefix}-${String(i).padStart(3, '0')}@claims.test.lca`)
const mailedTo = (prefix: string) => emailOutbox.map((e) => e.to).filter((to) => to.startsWith(`${prefix}-`))
const EXPIRED = "datetime('now', '-20 minutes')"
const MINUTE = 60_000

/** The address a request to Resend or to Amazon SES is for, or null for any other request. */
async function resendTo(input: RequestInfo | URL, init?: RequestInit): Promise<string | null> {
  const host = new URL(input instanceof Request ? input.url : String(input)).hostname
  if (host !== 'api.resend.com' && host !== 'email.us-east-1.amazonaws.com') return null
  const raw = input instanceof Request ? await input.clone().text() : init?.body instanceof Uint8Array ? new TextDecoder().decode(init.body) : String(init?.body ?? '{}')
  const body = JSON.parse(raw) as { to?: string | string[]; Destination?: { ToAddresses?: string[] } }
  const to = body.Destination?.ToAddresses ?? body.to
  return Array.isArray(to) ? (to[0] ?? null) : (to ?? null)
}

/** Lets a case play another run's work during one send, by the address it is for; restored after every case. */
let underneath: typeof fetch
function duringSend(hook: (to: string) => Promise<void>): void {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const to = await resendTo(input, init)
    if (to) await hook(to)
    return underneath(input, init)
  }) as typeof fetch
}

beforeEach(async () => {
  resetHarness()
  flags.listsOn = true
  flags.sender = 'resend'
  flags.plan = 'paid'
  flags.complaintStops = true
  quickPauses()
  underneath = globalThis.fetch
  await env.DB.prepare('DELETE FROM email_campaign_recipients').run()
  await env.DB.prepare('DELETE FROM email_campaigns').run()
})

afterEach(() => {
  globalThis.fetch = underneath
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('(i) a run puts back only what is its own', () => {
  it('the review\'s probe: a stalled run, a second run that claims its rows and a third run reach each address once, and the counts add up', async () => {
    const [a, x, y] = addressesFor('probe', 3)
    const id = await stageCampaign({ recipients: [{ email: a }, { email: x }, { email: y }] })

    let second: Promise<unknown> | null = null
    let secondMarked!: () => void
    const marked = new Promise<void>((resolve) => { secondMarked = resolve })
    let letSecondFinish!: () => void
    const finish = new Promise<void>((resolve) => { letSecondFinish = resolve })
    let heldOnce = false
    duringSend(async (to) => {
      if (to === a && !second) {
        // The first run stalls on its first send until its claim on the rows it has not marked has run out, and a second
        // run claims its next row.
        await env.DB.prepare(`UPDATE email_campaign_recipients SET claimed_at = ${EXPIRED} WHERE campaign_id = ? AND sending_at IS NULL`).bind(id).run()
        second = processCampaign(bindings, id, 1)
        await marked
      } else if (to === x && !heldOnce) {
        // The second run has marked its row and is sending it when the first run comes back.
        heldOnce = true
        secondMarked()
        await finish
      }
    })

    // The first run loses the race to mark the row the second run holds, and leaves that row and its mark alone.
    expect(await processCampaign(bindings, id)).toEqual({ sent: 1, failed: 0, remaining: 2, done: false })
    const afterFirst = await rowsOf(id)
    expect(afterFirst[1]).toMatchObject({ email: x, status: 'pending' })
    expect(afterFirst[1].sending_at).not.toBeNull()
    expect(afterFirst[1].claimed_at).not.toBeNull()
    expect(afterFirst[2]).toMatchObject({ email: y, status: 'pending', sending_at: null, claimed_at: null })

    // A third run, while the second is still sending, sends what is free and never the row the second run marked.
    expect(await processCampaign(bindings, id)).toEqual({ sent: 1, failed: 0, remaining: 1, done: false })
    letSecondFinish()
    await second
    expect(emailOutbox.map((e) => e.to).sort()).toEqual([a, x, y])
    expect((await rowsOf(id)).map((r) => r.status)).toEqual(['sent', 'sent', 'sent'])
    expect(await campaignOf(id)).toMatchObject({ status: 'completed', total_recipients: 3, sent_count: 3, failed_count: 0 })
  })

  it('a run whose first mark is lost to another run puts its claim back and leaves the other run\'s mark, so no later run sends that row', async () => {
    const [taken, rest] = addressesFor('first-mark', 2)
    const id = await stageCampaign({ recipients: [{ email: taken }, { email: rest }] })
    const { db } = countingDb({
      afterAll: async (sql) => {
        // Between this run's claim and its first mark, another run marks the first row under a claim of its own.
        if (sql.includes('RETURNING')) {
          await env.DB.prepare(`UPDATE email_campaign_recipients SET sending_at = datetime('now'), claimed_at = datetime('now') WHERE id = ?`).bind(`${id}-0000`).run()
        }
      },
    })
    expect(await processCampaign({ ...bindings, DB: db }, id)).toEqual({ sent: 0, failed: 0, remaining: 2, done: false })
    const [first, second] = await rowsOf(id)
    expect(first.sending_at).not.toBeNull()
    expect(first.claimed_at).not.toBeNull()
    expect(second).toMatchObject({ status: 'pending', sending_at: null, claimed_at: null, attempts: 0 })
    expect(await processCampaign(bindings, id)).toEqual({ sent: 1, failed: 0, remaining: 1, done: false })
    expect(mailedTo('first-mark')).toEqual([rest])
  })
})

describe('(ii) a run ends itself before its claim can run out', () => {
  it('past ten minutes on one claim it puts back its rows unmarked, ends the sweep\'s run, and the next run sends them', async () => {
    holdClock()
    const rows = addressesFor('held', 3)
    const id = await stageCampaign({ id: `campaign-held-${nextCampaignSeq()}`, createdAt: '2026-11-01 10:00:00', recipients: rows.map((email) => ({ email })) })
    const later = await stageCampaign({ id: `campaign-held-${nextCampaignSeq()}`, createdAt: '2026-11-01 11:00:00', recipients: addressesFor('after', 1).map((email) => ({ email })) })
    let slowed = false
    duringSend(async (to) => {
      // The first send takes ten minutes to answer.
      if (to === rows[0] && !slowed) {
        slowed = true
        vi.setSystemTime(Date.now() + 10 * MINUTE)
      }
    })
    expect(await sweepPendingCampaigns(bindings)).toEqual({ campaignsTouched: 1, sent: 1, failed: 0 })
    expect(mailedTo('held')).toEqual([rows[0]])
    expect(mailedTo('after')).toEqual([])
    expect((await rowsOf(id)).slice(1).map((r) => [r.status, r.claimed_at, r.sending_at, r.attempts])).toEqual(Array(2).fill(['pending', null, null, 0]))
    expect((await rowsOf(later))[0]).toMatchObject({ status: 'pending', claimed_at: null, attempts: 0 })

    expect(await sweepPendingCampaigns(bindings)).toEqual({ campaignsTouched: 2, sent: 3, failed: 0 })
    expect(mailedTo('held')).toEqual(rows)
    expect(await campaignOf(id)).toMatchObject({ status: 'completed', sent_count: 3, failed_count: 0 })
  })

  it('just under ten minutes it goes on and sends every row it claimed', async () => {
    holdClock()
    const rows = addressesFor('nearly', 3)
    const id = await stageCampaign({ recipients: rows.map((email) => ({ email })) })
    let slowed = false
    duringSend(async (to) => {
      if (to === rows[0] && !slowed) {
        slowed = true
        vi.setSystemTime(Date.now() + 10 * MINUTE - 2_000)
      }
    })
    expect(await processCampaign(bindings, id)).toEqual({ sent: 3, failed: 0, remaining: 0, done: true })
    expect(mailedTo('nearly')).toEqual(rows)
  })
})

describe('(iii) a row counts once', () => {
  it('a row the sweep writes off while its send outlives the claim stays written off, and is not then counted sent', async () => {
    const [slow, next] = addressesFor('outlived', 2)
    const id = await stageCampaign({ recipients: [{ email: slow }, { email: next }] })
    let writtenOff = false
    duringSend(async (to) => {
      if (to === slow && !writtenOff) {
        // The send hangs past the claim's fifteen minutes, and another run's write-off fails the marked row meanwhile.
        writtenOff = true
        await env.DB.prepare(`UPDATE email_campaign_recipients SET claimed_at = ${EXPIRED} WHERE campaign_id = ?`).bind(id).run()
        expect(await processCampaign(bindings, id, 0)).toEqual({ sent: 0, failed: 1, remaining: 1, done: false })
      }
    })
    expect(await processCampaign(bindings, id)).toEqual({ sent: 1, failed: 0, remaining: 0, done: true })
    expect(mailedTo('outlived')).toEqual([slow, next])
    const [first, second] = await rowsOf(id)
    expect(first).toMatchObject({ status: 'failed', error: WRITTEN_OFF_WORDS })
    expect(second).toMatchObject({ status: 'sent' })
    expect(await campaignOf(id)).toMatchObject({ status: 'completed', total_recipients: 2, sent_count: 1, failed_count: 1 })
  })

  it('a row recorded sent is not then written off, whatever its mark and claim say afterwards', async () => {
    const rows = addressesFor('recorded', 2)
    const id = await stageCampaign({ recipients: rows.map((email) => ({ email })) })
    expect(await processCampaign(bindings, id)).toEqual({ sent: 2, failed: 0, remaining: 0, done: true })
    await env.DB.prepare(`UPDATE email_campaign_recipients SET claimed_at = ${EXPIRED}, sending_at = ${EXPIRED} WHERE campaign_id = ?`).bind(id).run()
    await env.DB.prepare(`UPDATE email_campaigns SET status = 'sending' WHERE id = ?`).bind(id).run()
    expect(await processCampaign(bindings, id)).toEqual({ sent: 0, failed: 0, remaining: 0, done: true })
    expect((await rowsOf(id)).map((r) => r.status)).toEqual(['sent', 'sent'])
    expect(await campaignOf(id)).toMatchObject({ sent_count: 2, failed_count: 0 })
    expect(mailedTo('recorded')).toEqual(rows)
  })
})

describe('(iv) the edges of the rules\' claims', () => {
  it('a row another run marked is left to that run when a stop has closed the send: the stop fails the unmarked rows, the put-back fails none of the marked one, and the counts add up', async () => {
    flags.sender = 'ses'
    const rows = addressesFor('stopmarked', 4)
    const filterJson = JSON.stringify({ list: NEWSLETTER_LIST_ID, linkCheck: await linkKeyCheck((env as unknown as Env).MAIL_LINK_SECRET as string) })
    const recipients = await Promise.all(rows.map(async (email) => ({ email, contactId: await contactFor(env.DB, email) })))
    const id = await stageCampaign({ listId: NEWSLETTER_LIST_ID, filterJson, recipients })
    let stopped = false
    duringSend(async (to) => {
      if (to === rows[0] && !stopped) {
        stopped = true
        // While the first run's first message is with the service, a second run marks the next row and a stop closes the send.
        await env.DB.prepare(`UPDATE email_campaign_recipients SET sending_at = datetime('now'), claimed_at = datetime('now') WHERE id = ?`).bind(`${id}-0001`).run()
        expect(await stopListCampaign(env.DB, NEWSLETTER_LIST_ID)).toBe(2)
      }
    })
    const ran = await processCampaign(bindings, id)
    expect(ran).toEqual({ sent: 1, failed: 0, remaining: 1, done: false })
    expect(mailedTo('stopmarked')).toEqual([rows[0]])
    const settled = await rowsOf(id)
    expect(settled[0]).toMatchObject({ status: 'sent' })
    expect(settled[1]).toMatchObject({ status: 'pending' })
    expect(settled[1].sending_at).not.toBeNull()
    expect(settled.slice(2).map((r) => [r.status, r.error])).toEqual([['failed', STOPPED_WORDS], ['failed', STOPPED_WORDS]])
    // Two rows failed by the stop and counted once each; the marked row is still its run's, in neither count.
    expect(await campaignOf(id)).toMatchObject({ total_recipients: 4, sent_count: 1, failed_count: 2 })
  })

  it('a send that fails for good after the sweep wrote its row off is counted failed once, not twice, and the run does not count it', async () => {
    const [slow, next] = addressesFor('failedlate', 2)
    const id = await stageCampaign({ recipients: [{ email: slow }, { email: next }] })
    let writtenOff = false
    duringSend(async (to) => {
      if (to === slow && !writtenOff) {
        writtenOff = true
        await env.DB.prepare(`UPDATE email_campaign_recipients SET claimed_at = ${EXPIRED} WHERE campaign_id = ?`).bind(id).run()
        expect(await processCampaign(bindings, id, 0)).toEqual({ sent: 0, failed: 1, remaining: 1, done: false })
      }
    })
    emailBehavior.succeed = false
    emailBehavior.status = 422
    emailBehavior.failFor = [slow]
    expect(await processCampaign(bindings, id)).toEqual({ sent: 1, failed: 0, remaining: 0, done: true })
    const [first, second] = await rowsOf(id)
    expect(first).toMatchObject({ status: 'failed', error: WRITTEN_OFF_WORDS })
    expect(second).toMatchObject({ status: 'sent' })
    expect(await campaignOf(id)).toMatchObject({ status: 'completed', total_recipients: 2, sent_count: 1, failed_count: 1 })
  })

  it('with the rules off a send slow past ten minutes does not end the run: today\'s sender sends every row it claimed, as WS16 step 8\'s did', async () => {
    flags.listsOn = false
    holdClock()
    const rows = addressesFor('rulesoff', 3)
    const id = await stageCampaign({ recipients: rows.map((email) => ({ email })) })
    let slowed = false
    duringSend(async (to) => {
      if (to === rows[0] && !slowed) {
        slowed = true
        vi.setSystemTime(Date.now() + 11 * MINUTE)
      }
    })
    expect(await processCampaign(bindings, id)).toEqual({ sent: 3, failed: 0, remaining: 0, done: true })
    expect(mailedTo('rulesoff')).toEqual(rows)
    expect(await campaignOf(id)).toMatchObject({ status: 'completed', sent_count: 3, failed_count: 0 })
  })
})
