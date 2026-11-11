// test/unit/mail-plan.test.ts
//
// The mail engine's budgets in functions/utils/mail/plan.ts (WS16 step 2:
// the daily run's), read from WORKERS_PLAN at each call. On the free plan
// the daily run claims at most 25 reminder rows and its reminders and
// rating lookups share 45 of the invocation's 50 outside calls; on Workers
// Paid nothing is capped. The suite mocks functions/utils/mail/switches
// over the real module and sets WORKERS_PLAN in every case, so the value
// the code ships with decides none. test/integration/mail-gate.test.ts
// counts a daily run against these figures.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { dailyBudget } from '../../functions/utils/mail/plan'

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
