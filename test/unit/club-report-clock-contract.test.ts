// The second action of POST /api/admin/clubs/monthly-check in its contract (WS09's twenty-ninth step): every request
// the endpoint took before still parses, the new action is told apart by one key, and the answers are numbers alone.
import { describe, expect, it } from 'vitest'
import {
  REPORT_CLOCK_ACTION, monthlyCheckAnswerSchema, monthlyCheckRequestSchema, monthlyCheckResponseSchema, reportClockResponseSchema,
} from '../../domain/contracts/clubs'
import { contracts } from '../../domain/contracts'

describe('the request', () => {
  it('still takes the monthly check\'s own bodies: send alone, true or false, and extra keys as before', () => {
    for (const body of [{ send: true }, { send: false }, { send: true, note: 'Player One pressed it' }]) {
      expect(monthlyCheckRequestSchema.safeParse(body).success, JSON.stringify(body)).toBe(true)
    }
  })

  it('still needs send, as a true or false, for either action', () => {
    for (const body of [{}, { send: 'yes' }, { send: 1 }, { action: REPORT_CLOCK_ACTION }, { action: REPORT_CLOCK_ACTION, send: 'true' }]) {
      expect(monthlyCheckRequestSchema.safeParse(body).success, JSON.stringify(body)).toBe(false)
    }
  })

  it('tells the second action apart by its one action name, and takes no other', () => {
    expect(REPORT_CLOCK_ACTION).toBe('run_report_clock')
    expect(monthlyCheckRequestSchema.parse({ action: REPORT_CLOCK_ACTION, send: false })).toEqual({ action: 'run_report_clock', send: false })
    expect(monthlyCheckRequestSchema.safeParse({ action: 'run_the_clock', send: true }).success).toBe(false)
  })
})

describe('the answers', () => {
  const clock = { due: 2, passedOn: 1, sent: 3, notSent: 0, notReached: 1 }
  const monthly = { month: 'December 2026', people: 2, sent: 2, notSent: 0, notReached: 0 }

  it('the second action\'s is five counts, and nothing else rides in it', () => {
    expect(reportClockResponseSchema.safeParse(clock).success).toBe(true)
    for (const extra of [{ email: 'player.one@example.org' }, { message: 'Free now.' }, { clubs: ['Example Chess Club'] }]) {
      expect(reportClockResponseSchema.safeParse({ ...clock, ...extra }).success, JSON.stringify(extra)).toBe(false)
    }
    for (const bad of [{ ...clock, due: -1 }, { ...clock, sent: 1.5 }, { ...clock, passedOn: '1' }]) {
      expect(reportClockResponseSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false)
    }
  })

  it('the registry\'s answer for the endpoint is either one, and the monthly check\'s own is unchanged', () => {
    expect(monthlyCheckAnswerSchema.safeParse(clock).success).toBe(true)
    expect(monthlyCheckAnswerSchema.safeParse(monthly).success).toBe(true)
    expect(monthlyCheckAnswerSchema.safeParse({ ...monthly, due: 1 }).success).toBe(false)
    expect(monthlyCheckResponseSchema.safeParse(monthly).success).toBe(true)
    expect(monthlyCheckResponseSchema.safeParse(clock).success).toBe(false)
    expect(contracts['admin/clubs/monthly-check'].POST.response).toBe(monthlyCheckAnswerSchema)
  })
})
