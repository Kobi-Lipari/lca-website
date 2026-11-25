// test/integration/contracts/club-report-clock.test.ts
// The second action of POST /api/admin/clubs/monthly-check (WS09 step 29),
// run_report_clock, keeps its contract (domain/contracts/clubs.ts) through
// the real handler, beside the monthly check's own, and the open suggestion
// gains its one key, passedOnAt, only once a suggestion was passed on
// (domain/contracts/clubReports.ts). CLUB_KEEPERS_ON and CLUB_PAGES_ON are
// set through getters on the mocked module, and every club, person and word
// is made up.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  contracts, errorBodySchema, fieldErrorBodySchema, monthlyCheckAnswerSchema, monthlyCheckResponseSchema, openSuggestionSchema, regionClubSchema,
  reportClockResponseSchema,
} from '../../../domain/contracts'
import { onRequestPost as checkPost } from '../../../functions/api/admin/clubs/monthly-check'
import { onRequestGet as regionGet } from '../../../functions/api/workspace/region'
import { onRequestGet as adminClubGet } from '../../../functions/api/admin/clubs/[id]'
import { runReportClock, type ReportClockEnv } from '../../../functions/utils/clubs/reportClock'
import { seedAdmin, seedClub, seedMember } from '../factories'
import { expectContract, invoke, resetHarness } from '../harness'

const flags = vi.hoisted(() => ({ keepersOn: false, pagesOn: false }))
vi.mock('../../../functions/utils/clubs/pages', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../functions/utils/clubs/pages')>()
  return {
    ...real,
    get CLUB_KEEPERS_ON() {
      return flags.keepersOn
    },
    get CLUB_PAGES_ON() {
      return flags.pagesOn
    },
  }
})

beforeEach(async () => {
  resetHarness()
  flags.keepersOn = false
  flags.pagesOn = false
  await env.DB.prepare("DELETE FROM club_reports WHERE kind = 'suggestion'").run()
})
afterEach(() => {
  vi.restoreAllMocks()
})

const checkContract = contracts['admin/clubs/monthly-check'].POST
const DAY = 24 * 60 * 60 * 1000
const stamp = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ')

/** A made-up club with one open suggestion sent fifteen days ago. */
async function overdueClub(): Promise<{ clubId: string; rowId: number }> {
  const clubId = await seedClub({ name: 'Example Chess Club', city: 'Example City' })
  const row = await env.DB.prepare(
    `INSERT INTO club_reports (club_id, kind, field, message, created_at) VALUES (?, 'suggestion', 'cost', 'Player One says the club is free now.', ?) RETURNING id`,
  ).bind(clubId, stamp(Date.now() - 15 * DAY)).first<{ id: number }>()
  return { clubId, rowId: Number(row!.id) }
}

describe('POST /api/admin/clubs/monthly-check: the second action', () => {
  it('answers the ask and the press within its contract, and each refusal as an error body', async () => {
    flags.keepersOn = true
    const admin = await seedAdmin()
    await overdueClub()
    const asked = await invoke(checkPost, { method: 'POST', as: admin, body: { action: 'run_report_clock', send: false } })
    expect(asked.status).toBe(200)
    expect(await expectContract(asked, checkContract.response)).toMatchObject({ due: 1, passedOn: 0 })
    const sent = await invoke(checkPost, { method: 'POST', as: admin, body: { action: 'run_report_clock', send: true } })
    expect(sent.status).toBe(200)
    expect(Object.keys(await expectContract(sent, reportClockResponseSchema))).toEqual(['due', 'passedOn', 'sent', 'notSent', 'notReached'])
    const member = await invoke(checkPost, { method: 'POST', as: await seedMember(), aal: 'aal1', body: { action: 'run_report_clock', send: true } })
    expect(member.status).toBe(403)
    await expectContract(member, errorBodySchema)
    const wrong = await invoke(checkPost, { method: 'POST', as: admin, body: { action: 'run_the_clock', send: true } })
    expect(wrong.status).toBe(400)
    await expectContract(wrong, fieldErrorBodySchema)
    flags.keepersOn = false
    const closed = await invoke(checkPost, { method: 'POST', as: admin, body: { action: 'run_report_clock', send: true } })
    expect(closed.status).toBe(403)
    await expectContract(closed, errorBodySchema)
  })

  it('the request keeps the monthly check\'s shape and takes one more action; the answer is numbers alone', () => {
    for (const good of [{ send: true }, { send: false }, { action: 'run_report_clock', send: true }, { action: 'run_report_clock', send: false }]) {
      expect(checkContract.request.safeParse(good).success, JSON.stringify(good)).toBe(true)
    }
    for (const wrong of [{}, { action: 'run_report_clock' }, { action: 'run_report_clock', send: 'yes' }, { action: 'monthly', send: true }, { action: null, send: true }]) {
      expect(checkContract.request.safeParse(wrong).success, JSON.stringify(wrong)).toBe(false)
    }
    const good = { due: 2, passedOn: 1, sent: 3, notSent: 0, notReached: 1 }
    expect(reportClockResponseSchema.safeParse(good).success).toBe(true)
    for (const wrong of [{ ...good, due: -1 }, { ...good, sent: 1.5 }, { ...good, emails: ['one@example.org'] }, { ...good, clubs: ['Example Chess Club'] }]) {
      expect(reportClockResponseSchema.safeParse(wrong).success, JSON.stringify(wrong)).toBe(false)
    }
    // The registry's answer takes either the monthly check's or this one, and never a blend of the two.
    expect(monthlyCheckAnswerSchema.safeParse(good).success).toBe(true)
    expect(monthlyCheckAnswerSchema.safeParse({ month: 'December 2026', people: 2, sent: 2, notSent: 0, notReached: 0 }).success).toBe(true)
    expect(monthlyCheckAnswerSchema.safeParse({ ...good, month: 'December 2026' }).success).toBe(false)
    expect(monthlyCheckResponseSchema.safeParse(good).success).toBe(false)
  })
})

describe('the open suggestion\'s one new key', () => {
  it('is a stored stamp or absent, never anything else', () => {
    const item = { kind: 'suggestion', id: 4, field: 'venue', message: 'Player One says the club moved.', hasAddress: false, ageDays: 15 }
    expect(openSuggestionSchema.safeParse(item).success).toBe(true)
    expect(openSuggestionSchema.safeParse({ ...item, passedOnAt: '2026-11-23 18:00:00' }).success).toBe(true)
    for (const passedOnAt of [null, 'Monday', '2026-11-23T18:00:00Z', 7]) {
      expect(openSuggestionSchema.safeParse({ ...item, passedOnAt }).success, String(passedOnAt)).toBe(false)
    }
    expect(openSuggestionSchema.safeParse({ ...item, passedTo: ['one@example.org'] }).success).toBe(false)
  })

  it('My region and the admin club answer carry it once passed on, within their contracts', async () => {
    flags.keepersOn = true
    const admin = await seedAdmin()
    const { clubId } = await overdueClub()
    await runReportClock({ ...(env as unknown as ReportClockEnv), DB: env.DB }, new Date(), { pauseMs: 0 })
    const region = await invoke(regionGet, { as: admin })
    const answer = await expectContract(region, contracts['workspace/region'].GET.response)
    const card = (answer as { clubs: Array<{ id: string }> }).clubs.find((c) => c.id === clubId)
    expect(regionClubSchema.parse(card).openItems[0].passedOnAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    const adminClub = await invoke(adminClubGet, { as: admin, params: { id: clubId } })
    const club = await expectContract(adminClub, contracts['admin/clubs/[id]'].GET.response) as { openSuggestions?: Array<{ passedOnAt?: string }> }
    expect(club.openSuggestions?.[0].passedOnAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  })
})
