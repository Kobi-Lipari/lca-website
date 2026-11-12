// test/unit/mail-plan.test.ts
//
// The mail engine's budgets in functions/utils/mail/plan.ts, read from
// WORKERS_PLAN at each call: the daily run's (WS16 step 2) and the campaign
// sender's sizes (WS16 step 4). On the free plan the daily run claims at
// most 25 reminder rows and its reminders and rating lookups share 45 of
// the invocation's 50 outside calls, and the campaign sender sends one
// batch of 10 for the request and 20 from one campaign for a sweep run; on
// Workers Paid nothing of the daily run is capped, and the campaign sender
// sends batches of 40 for 20 seconds and 300 a sweep run. The arithmetic of
// plan.ts's comment is held here against those sizes: a batch of n rows
// makes at most n + 8 queries and a sweep run one more. The suite mocks
// functions/utils/mail/switches over the real module and sets WORKERS_PLAN
// in every case, so the value the code ships with decides none.
// test/integration/mail-gate.test.ts counts a daily run, and
// test/integration/campaigns-once.test.ts a request and a sweep run,
// against these figures.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SEND_INTERVAL_MS } from '../../functions/utils/admin/campaigns'
import { GATE_QUERY_SIZE } from '../../functions/utils/mail/gate'
import { dailyBudget, sizes } from '../../functions/utils/mail/plan'

const flags = vi.hoisted(() => ({ plan: 'free' }))
vi.mock('../../functions/utils/mail/switches', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/mail/switches')>()
  return {
    ...real,
    get WORKERS_PLAN() {
      return flags.plan
    },
  }
})

beforeEach(() => {
  flags.plan = 'free'
})

/** An invocation's limits on each plan, as Cloudflare gives them: outside calls and database queries. */
const LIMITS = { free: { calls: 50, queries: 50 }, paid: { calls: 10_000, queries: 1_000 } }

/**
 * The most queries a batch of n rows makes, as plan.ts's comment counts them: the read, the write-off, the claim, the
 * gate's queries (one for each 90 addresses), for a list campaign the batch that takes out the rows the gate refused,
 * the first mark, n outcomes, the count and the close.
 */
const batchQueries = (n: number, list = true) => 6 + Math.ceil(n / GATE_QUERY_SIZE) + (list ? 1 : 0) + n

describe('dailyBudget', () => {
  it('on the free plan: at most 25 reminder rows, inside 45 of the 50 outside calls, so the rating lookups keep 20 after a full day', () => {
    const budget = dailyBudget()
    expect(budget).toEqual({ reminders: 25, outsideCalls: 45 })
    expect(budget.outsideCalls! - budget.reminders!).toBe(20)
    expect(budget.outsideCalls!).toBeLessThan(50)
  })

  it('on Workers Paid: no cap on either, so today\'s 500 rating lookups and every reminder due stand', () => {
    flags.plan = 'paid'
    expect(dailyBudget()).toEqual({ reminders: null, outsideCalls: null })
  })

  it('reads the plan at each call, so the change that follows K\'s word needs nothing else', () => {
    expect(dailyBudget().reminders).toBe(25)
    flags.plan = 'paid'
    expect(dailyBudget().reminders).toBeNull()
    flags.plan = 'free'
    expect(dailyBudget().reminders).toBe(25)
  })
})

describe('sizes', () => {
  it('on the free plan: one batch of 10 for the request and no deadline, and 20 from one campaign for a sweep run', () => {
    expect(sizes()).toEqual({ requestBatch: 10, requestDeadlineMs: null, sweepBatch: 20, sweepCampaigns: 1 })
  })

  it('on Workers Paid: batches of 40 for 20 seconds for the request, and up to 300 across up to 20 campaigns for a sweep run', () => {
    flags.plan = 'paid'
    expect(sizes()).toEqual({ requestBatch: 40, requestDeadlineMs: 20_000, sweepBatch: 300, sweepCampaigns: 20 })
  })

  it('reads the plan at each call', () => {
    expect(sizes().requestBatch).toBe(10)
    flags.plan = 'paid'
    expect(sizes().requestBatch).toBe(40)
    flags.plan = 'free'
    expect(sizes().sweepBatch).toBe(20)
  })

  it('on the free plan, a batch of n makes n + 8 queries at most and a sweep run n + 9, each inside 50 outside calls and 50 queries', () => {
    const { requestBatch, sweepBatch } = sizes()
    // 10 and 20 addresses are one gate query each.
    expect(Math.ceil(requestBatch / GATE_QUERY_SIZE)).toBe(1)
    expect(Math.ceil(sweepBatch / GATE_QUERY_SIZE)).toBe(1)
    expect(batchQueries(requestBatch)).toBe(requestBatch + 8)
    expect(1 + batchQueries(sweepBatch)).toBe(sweepBatch + 9)
    // Group email's request for Specific people: requireMailer verifies an LCA admin's session twice, two outside calls
    // and two member reads, then the picked members' read, the insert, one recipient batch for up to 80 and the audit
    // row; its batch has no list.
    const groupEmail = { calls: 2 + requestBatch, queries: 6 + batchQueries(requestBatch, false) }
    expect(groupEmail).toEqual({ calls: 12, queries: 23 })
    expect(groupEmail.queries).toBeLessThanOrEqual(25)
    const sweep = { calls: sweepBatch, queries: 1 + batchQueries(sweepBatch) }
    expect(sweep).toEqual({ calls: 20, queries: 29 })
    expect(sweep.calls).toBeLessThanOrEqual(21)
    expect(sweep.queries).toBeLessThanOrEqual(30)
    for (const run of [groupEmail, sweep]) {
      expect(run.calls).toBeLessThan(LIMITS.free.calls)
      expect(run.queries).toBeLessThan(LIMITS.free.queries)
    }
  })

  it('on Workers Paid, the request sends at most 50 inside its 20 seconds and waitUntil\'s 30, and a sweep run of 300 stays under 500 queries', () => {
    flags.plan = 'paid'
    const { requestBatch, requestDeadlineMs, sweepBatch, sweepCampaigns } = sizes()
    // Sends start at 0, 400 ms, 800 ms and on: the last that starts before the deadline is the 50th.
    const sends = Math.ceil(requestDeadlineMs! / SEND_INTERVAL_MS)
    expect(sends).toBe(50)
    expect(requestDeadlineMs!).toBeLessThan(30_000)
    expect(Math.ceil(requestBatch / GATE_QUERY_SIZE)).toBe(1)
    // 300 addresses in one campaign are four gate queries, of 90, 90, 90 and 30; with every campaign read the fixed
    // queries of 20 batches are added.
    expect(Math.ceil(sweepBatch / GATE_QUERY_SIZE)).toBe(4)
    const worst = 1 + sweepBatch + sweepCampaigns * 8 + Math.ceil(sweepBatch / GATE_QUERY_SIZE)
    expect(worst).toBeLessThan(500)
    expect(worst).toBeLessThan(LIMITS.paid.queries)
    expect(sweepBatch).toBeLessThan(LIMITS.paid.calls)
    // 300 sends 400 ms apart take two minutes, inside the five between two runs of the sweep.
    expect(sweepBatch * SEND_INTERVAL_MS).toBeLessThanOrEqual(5 * 60_000)
  })
})
