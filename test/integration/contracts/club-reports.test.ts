// test/integration/contracts/club-reports.test.ts
// Suggest an update keeps its two contracts (domain/contracts/clubReports.ts,
// WS09 step 28): POST /api/clubs/[id]/reports, the visitor's suggestion, and
// POST /api/admin/clubs/[id]/reports/[reportId], a keeper's answer to it. The
// real handlers, with CLUB_PAGES_ON and CLUB_KEEPERS_ON set through getters
// on a mock of their module and the mail switches through getters on a mock
// of theirs. The request each site call in src/areas/clubs/api.ts sends
// passes its request contract, a key the contract does not name is dropped
// before the handler reads the body, each answer is strict, and every
// refusal is the plain error body. The club and the people are made up.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { contracts, errorBodySchema } from '../../../domain/contracts'
import { onRequestPost as suggestPost } from '../../../functions/api/clubs/[id]/reports'
import { onRequestPost as resolvePost } from '../../../functions/api/admin/clubs/[id]/reports/[reportId]'
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

const send = contracts['clubs/[id]/reports'].POST
const resolve = contracts['admin/clubs/[id]/reports/[reportId]'].POST
const KEYED = { SIGNING_SECRET: 'example-made-up-signing-key-for-the-contract-28', TURNSTILE_SECRET_KEY: 'example-made-up-spam-check-secret-28' }
let n = 0

/** The body sendClubSuggestion() sends, made up. */
const siteBody = () => ({ field: 'venue', message: 'The club meets at the Example Library now.', email: 'player.one@example.org', token: 'example-made-up-token' })

async function contractClub(): Promise<{ id: string; rep: string }> {
  const id = `example-contract-reports-${crypto.randomUUID().slice(0, 6)}`
  await env.DB.prepare(`INSERT INTO clubs (id, name, city, slug) VALUES (?, 'Example Contract Club', 'Example City', ?)`).bind(id, id).run()
  const rep = await seedMember({ role: 'club_rep', clubId: id, email: `rep-${id}@example.org` })
  return { id, rep }
}

const post = (part: string, body: unknown) =>
  invoke(suggestPost, { method: 'POST', params: { id: part }, body, env: KEYED, headers: { [ADDRESS_HEADER]: `192.0.2.${++n}` } })
const answer = (clubId: string, reportId: number, body: unknown, as: string) =>
  invoke(resolvePost, { method: 'POST', params: { id: clubId, reportId: String(reportId) }, body, env: KEYED, as, aal: 'aal1', headers: { [ADDRESS_HEADER]: `192.0.2.${++n}` } })

describe('POST /api/clubs/[id]/reports keeps its contract', () => {
  it('takes the body the site sends, with or without an address, drops a key it does not name, and answers the strict { sent: true }', async () => {
    flags.pagesOn = true
    const club = await contractClub()
    const body = siteBody()
    expect(send.request.safeParse(body).success).toBe(true)
    expect(send.request.safeParse({ ...body, email: undefined }).success).toBe(true)
    expect(send.request.safeParse({ ...body, email: '' }).success).toBe(true)
    const parsed = send.request.parse({ ...body, to: 'someone@example.org', subject: 'Example', name: 'Player One', memberId: 'm-1' })
    expect(Object.keys(parsed).sort()).toEqual(['email', 'field', 'message', 'token'])
    const result = await post(club.id, body)
    expect(result.status).toBe(200)
    expect(await expectContract(result, send.response)).toEqual({ sent: true })
    expect(send.response.safeParse({ sent: true, id: 1 }).success).toBe(false)
    expect(send.request.safeParse({ ...body, field: 'Venue or address' }).success).toBe(false)
  })

  it('answers every refusal with the plain error body', async () => {
    const club = await contractClub()
    const closed = await post(club.id, siteBody())
    expect(closed.status).toBe(403)
    expect(errorBodySchema.safeParse(await closed.json()).success).toBe(true)
    flags.pagesOn = true
    const missing = await post('no-such-contract-club', siteBody())
    expect(missing.status).toBe(404)
    expect(errorBodySchema.safeParse(await missing.json()).success).toBe(true)
  })
})

describe('POST /api/admin/clubs/[id]/reports/[reportId] keeps its contract', () => {
  it('takes each of the three actions the site sends, refuses an answer with no words, and answers the strict row and status', async () => {
    flags.pagesOn = true
    flags.keepersOn = true
    const club = await contractClub()
    for (const body of [{ action: 'apply' }, { action: 'dismiss' }, { action: 'answer', message: 'Example answer.' }]) expect(resolve.request.safeParse(body).success, body.action).toBe(true)
    expect(resolve.request.safeParse({ action: 'answer' }).success).toBe(false)
    expect(resolve.request.safeParse({ action: 'delete' }).success).toBe(false)
    expect(Object.keys(resolve.request.parse({ action: 'dismiss', to: 'someone@example.org', status: 'answered' }))).toEqual(['action'])
    for (const [action, status] of [['apply', 'applied'], ['dismiss', 'dismissed'], ['answer', 'answered']] as const) {
      expect((await post(club.id, siteBody())).status).toBe(200)
      const row = await env.DB.prepare('SELECT id FROM club_reports WHERE club_id = ? ORDER BY id DESC LIMIT 1').bind(club.id).first<{ id: number }>()
      const result = await answer(club.id, row!.id, action === 'answer' ? { action, message: 'Example answer.' } : { action }, club.rep)
      expect(result.status, action).toBe(200)
      expect(await expectContract(result, resolve.response)).toEqual({ id: row!.id, status })
      const again = await answer(club.id, row!.id, { action: 'dismiss' }, club.rep)
      expect(again.status).toBe(409)
      expect(errorBodySchema.safeParse(await again.json()).success).toBe(true)
    }
    expect(resolve.response.safeParse({ id: 1, status: 'open' }).success).toBe(false)
    expect(resolve.response.safeParse({ id: 1, status: 'applied', email: 'player.one@example.org' }).success).toBe(false)
  })
})
