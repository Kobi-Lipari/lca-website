// test/integration/contracts/club-suggest.test.ts
// Suggest a club and Start a club keep their two contracts
// (domain/contracts/clubRequests.ts, WS09's thirtieth step): POST
// /api/clubs/reports, what a visitor sends from /clubs/suggest, and POST
// /api/admin/club-reports/[reportId], Mark as handled. And My region's answer
// keeps its own with the new key filled. The real handlers, with
// CLUB_PAGES_ON and CLUB_KEEPERS_ON set through getters on a mock of their
// module and the mail switches through getters on a mock of theirs. The
// request each site call in src/areas/clubs/api.ts sends passes its request
// contract, a key the contract does not name is dropped before the handler
// reads the body, each answer is strict, and every refusal is the plain
// error body. Every club and person is made up; the ZIP code is Louisiana's.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { contracts, errorBodySchema, fieldErrorBodySchema } from '../../../domain/contracts'
import { onRequestPost as requestPost } from '../../../functions/api/clubs/reports'
import { onRequestPost as handledPost } from '../../../functions/api/admin/club-reports/[reportId]'
import { onRequestGet as regionGet } from '../../../functions/api/workspace/region'
import { ADDRESS_HEADER } from '../../../functions/utils/rateLimit'
import { seedMember } from '../factories'
import { expectContract, invoke, resetHarness } from '../harness'

const flags = vi.hoisted(() => ({ pagesOn: false, keepersOn: false }))
vi.mock('../../../functions/utils/clubs/pages', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../functions/utils/clubs/pages')>()
  return {
    ...real,
    get CLUB_PAGES_ON() {
      return flags.pagesOn
    },
    get CLUB_KEEPERS_ON() {
      return flags.keepersOn
    },
  }
})
vi.mock('../../../functions/utils/mail/switches', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../functions/utils/mail/switches')>()
  return {
    ...real,
    get MAIL_LISTS_ON() {
      return false
    },
    get MAIL_SENDER() {
      return 'resend' as const
    },
  }
})
beforeEach(resetHarness)
afterEach(() => {
  flags.pagesOn = false
  flags.keepersOn = false
})

const send = contracts['clubs/reports'].POST
const handled = contracts['admin/club-reports/[reportId]'].POST
const region = contracts['workspace/region'].GET
const KEYED = { SIGNING_SECRET: 'example-made-up-signing-key-for-the-contract-30', TURNSTILE_SECRET_KEY: 'example-made-up-spam-check-secret-30' }
let n = 0

/** The body sendClubRequest() sends, made up but for the ZIP code. */
const siteBody = (over: Record<string, unknown> = {}) => ({
  kind: 'new_club',
  clubName: 'Example Knights Club',
  place: '70791',
  message: 'Tuesdays at 7:00 PM at the Example Library.',
  name: 'Player One',
  email: 'player.one@example.org',
  token: 'example-made-up-token',
  ...over,
})

const post = (body: unknown) =>
  invoke(requestPost, { method: 'POST', body, env: KEYED, path: '/api/clubs/reports', headers: { [ADDRESS_HEADER]: `192.0.2.${++n}` } })
const mark = (reportId: number, body: unknown, as: string) =>
  invoke(handledPost, { method: 'POST', params: { reportId: String(reportId) }, body, env: KEYED, as, aal: 'aal1', path: `/api/admin/club-reports/${reportId}` })

async function onlyAdmin(): Promise<string> {
  await env.DB.prepare(`UPDATE members SET role = 'member' WHERE role = 'lca_admin'`).run()
  return seedMember({ role: 'lca_admin', email: `admin-contract-${crypto.randomUUID().slice(0, 6)}@example.org` })
}

describe('POST /api/clubs/reports keeps its contract', () => {
  it('takes the body the site sends for each kind, drops a key it does not name, and answers the strict { sent: true }', async () => {
    flags.pagesOn = true
    await onlyAdmin()
    for (const kind of ['new_club', 'start_club']) {
      const body = siteBody({ kind })
      expect(send.request.safeParse(body).success, kind).toBe(true)
      const result = await post(body)
      expect(result.status, kind).toBe(200)
      expect(await expectContract(result, send.response)).toEqual({ sent: true })
    }
    const parsed = send.request.parse({ ...siteBody(), to: 'someone@example.org', subject: 'Example', region: 'North Louisiana', memberId: 'm-1' })
    expect(Object.keys(parsed).sort()).toEqual(['clubName', 'email', 'kind', 'message', 'name', 'place', 'token'])
    expect(send.response.safeParse({ sent: true, region: 'North Louisiana' }).success).toBe(false)
    expect(send.request.safeParse(siteBody({ kind: 'suggestion' })).success).toBe(false)
    expect(send.request.safeParse(siteBody({ email: '' })).success).toBe(false)
  })

  it('answers every refusal with the plain error body, and a body it refuses with the field\'s words beside it', async () => {
    const closed = await post(siteBody())
    expect(closed.status).toBe(403)
    expect(errorBodySchema.safeParse(await closed.json()).success).toBe(true)
    flags.pagesOn = true
    const bad = await post(siteBody({ clubName: '' }))
    expect(bad.status).toBe(400)
    expect(fieldErrorBodySchema.safeParse(await bad.json()).success).toBe(true)
  })
})

describe('POST /api/admin/club-reports/[reportId] keeps its contract', () => {
  it('takes the one action the site sends, answers the strict row and status, and refuses a second press with the plain error body', async () => {
    flags.pagesOn = true
    flags.keepersOn = true
    const admin = await onlyAdmin()
    expect(handled.request.safeParse({ action: 'handled' }).success).toBe(true)
    expect(handled.request.safeParse({ action: 'dismiss' }).success).toBe(false)
    expect(Object.keys(handled.request.parse({ action: 'handled', status: 'open', email: 'someone@example.org' }))).toEqual(['action'])
    expect((await post(siteBody({ place: 'Example Nowhere' }))).status).toBe(200)
    const row = await env.DB.prepare(`SELECT id FROM club_reports WHERE club_id IS NULL ORDER BY id DESC LIMIT 1`).first<{ id: number }>()
    const result = await mark(row!.id, { action: 'handled' }, admin)
    expect(result.status).toBe(200)
    expect(await expectContract(result, handled.response)).toEqual({ id: row!.id, status: 'answered' })
    const again = await mark(row!.id, { action: 'handled' }, admin)
    expect(again.status).toBe(409)
    expect(errorBodySchema.safeParse(await again.json()).success).toBe(true)
    expect(handled.response.safeParse({ id: 1, status: 'answered', email: 'player.one@example.org' }).success).toBe(false)
  })
})

describe('GET /api/workspace/region keeps its contract with the new key', () => {
  it('answers the open rows under clubRequests for an LCA admin, each strict, and leaves the key out once there is none', async () => {
    flags.pagesOn = true
    flags.keepersOn = true
    await env.DB.prepare(`UPDATE club_reports SET status = 'answered' WHERE club_id IS NULL`).run()
    const admin = await onlyAdmin()
    expect((await post(siteBody({ kind: 'start_club', place: 'Example Nowhere' }))).status).toBe(200)
    const full = await invoke(regionGet, { as: admin, path: '/api/workspace/region' })
    expect(full.status).toBe(200)
    const answer = await expectContract(full, region.response)
    expect(answer.clubRequests).toHaveLength(1)
    expect(answer.clubRequests![0]).toMatchObject({ kind: 'start_club', clubName: 'Example Knights Club', place: 'Example Nowhere', name: 'Player One', email: 'player.one@example.org', region: null, ageDays: 0 })
    await env.DB.prepare(`UPDATE club_reports SET status = 'answered' WHERE club_id IS NULL`).run()
    const none = await invoke(regionGet, { as: admin, path: '/api/workspace/region' })
    expect('clubRequests' in await expectContract(none, region.response)).toBe(false)
  })
})
