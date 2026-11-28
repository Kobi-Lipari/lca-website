// test/integration/contracts/club-rep-requests.test.ts
// Ask to be its named rep keeps its two contracts
// (domain/contracts/clubRepRequests.ts, WS09's thirty-first step): POST
// /api/clubs/[id]/rep-requests, what a signed-in member sends from a club's
// page, and POST /api/admin/clubs/[id]/rep-requests/[requestId], a keeper's
// decision. My region's answer and a club's answer there keep theirs with
// the new key filled, and the club page's answer with its new key. The real
// handlers, with CLUB_PAGES_ON and CLUB_KEEPERS_ON set through getters on a
// mock of their module and the mail switches through getters on a mock of
// theirs. The request each site call in src/areas/clubs/api.ts sends passes
// its request contract, a key the contract does not name is dropped before
// the handler reads the body, each answer is strict, and every refusal is
// the plain error body. Every club and person is made up.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { contracts, errorBodySchema, fieldErrorBodySchema } from '../../../domain/contracts'
import { onRequestPost as askPost } from '../../../functions/api/clubs/[id]/rep-requests'
import { onRequestPost as decidePost } from '../../../functions/api/admin/clubs/[id]/rep-requests/[requestId]'
import { onRequestGet as regionGet } from '../../../functions/api/workspace/region'
import { onRequestGet as clubGet } from '../../../functions/api/admin/clubs/[id]'
import { onRequestGet as pageGet } from '../../../functions/api/clubs/[id]/page'
import { seedClub, seedMember } from '../factories'
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
beforeEach(async () => {
  resetHarness()
  await env.DB.prepare('DELETE FROM rate_limits').run()
})
afterEach(() => {
  flags.pagesOn = false
  flags.keepersOn = false
})

const ask = contracts['clubs/[id]/rep-requests'].POST
const decide = contracts['admin/clubs/[id]/rep-requests/[requestId]'].POST
const region = contracts['workspace/region'].GET
const club = contracts['admin/clubs/[id]'].GET
const page = contracts['clubs/[id]/page'].GET
const KEYED = { SIGNING_SECRET: 'example-made-up-signing-key-for-the-contract-31' }

async function onlyAdmin(): Promise<string> {
  await env.DB.prepare(`UPDATE members SET role = 'member' WHERE role = 'lca_admin'`).run()
  return seedMember({ role: 'lca_admin', email: `admin-contract-${crypto.randomUUID().slice(0, 6)}@example.org`, fullName: 'Player Two' })
}

async function exampleClub(): Promise<string> {
  const id = await seedClub({ name: `Example Knights Club ${crypto.randomUUID().slice(0, 4)}` })
  await env.DB.prepare(`UPDATE clubs SET region = 'North Louisiana' WHERE id = ?`).bind(id).run()
  return id
}

const send = (clubId: string, body: unknown, as?: string) =>
  invoke(askPost, { method: 'POST', params: { id: clubId }, body, env: KEYED, as, aal: 'aal1', path: `/api/clubs/${clubId}/rep-requests` })
const press = (clubId: string, requestId: number, body: unknown, as: string) =>
  invoke(decidePost, { method: 'POST', params: { id: clubId, requestId: String(requestId) }, body, env: KEYED, as, path: `/api/admin/clubs/${clubId}/rep-requests/${requestId}` })

describe('POST /api/clubs/[id]/rep-requests keeps its contract', () => {
  it('takes the body the site sends, drops a key it does not name, and answers the strict { sent: true }', async () => {
    flags.pagesOn = true
    await onlyAdmin()
    const clubId = await exampleClub()
    const member = await seedMember({ fullName: 'Player One', email: 'player.one@example.org' })
    const body = { connection: 'runs_it', note: 'I have run the Tuesday nights since spring.' }
    expect(ask.request.safeParse(body).success).toBe(true)
    const result = await send(clubId, body, member)
    expect(result.status).toBe(200)
    expect(await expectContract(result, ask.response)).toEqual({ sent: true })
    const parsed = ask.request.parse({ ...body, memberId: 'm-1', to: 'someone@example.org', clubId: 'c-1' })
    expect(Object.keys(parsed).sort()).toEqual(['connection', 'note'])
    expect(ask.request.safeParse({ connection: 'owns_it' }).success).toBe(false)
    expect(ask.request.safeParse({ connection: 'other', note: 'x'.repeat(1001) }).success).toBe(false)
    expect(ask.request.safeParse({ connection: 'other' }).success).toBe(true)
    expect(ask.response.safeParse({ sent: true, region: 'North Louisiana' }).success).toBe(false)
  })

  it('answers every refusal with the plain error body, and a body it refuses with the field\'s words beside it', async () => {
    const clubId = await exampleClub()
    const member = await seedMember({ fullName: 'Player One' })
    const closed = await send(clubId, { connection: 'runs_it' }, member)
    expect(closed.status).toBe(403)
    expect(errorBodySchema.safeParse(await closed.json()).success).toBe(true)
    flags.pagesOn = true
    const bad = await send(clubId, { connection: '' }, member)
    expect(bad.status).toBe(400)
    expect(fieldErrorBodySchema.safeParse(await bad.json()).success).toBe(true)
  })
})

describe('POST /api/admin/clubs/[id]/rep-requests/[requestId] and the answers that carry the rows keep their contracts', () => {
  it('fills the rows in My region and a club\'s answer, takes each decision the site sends, and answers the strict request and status', async () => {
    flags.pagesOn = true
    flags.keepersOn = true
    const admin = await onlyAdmin()
    const clubId = await exampleClub()
    const pageBefore = await invoke(pageGet, { params: { id: clubId } })
    expect((await expectContract(pageBefore, page.response)).rep_wanted).toBe(true)
    const one = await seedMember({ fullName: 'Player One', email: 'player.one@example.org' })
    const three = await seedMember({ fullName: 'Player Three', email: 'player.three@example.org' })
    expect((await send(clubId, { connection: 'runs_it' }, one)).status).toBe(200)
    expect((await send(clubId, { connection: 'other', note: '' }, three)).status).toBe(200)

    const mine = await expectContract(await invoke(regionGet, { as: admin }), region.response)
    const rows = (mine.repRequests ?? []).filter((r) => r.clubId === clubId)
    expect(rows).toHaveLength(2)
    const theirs = await expectContract(await invoke(clubGet, { params: { id: clubId }, as: admin }), club.response)
    expect(theirs.repRequests?.map((r) => r.id)).toEqual(rows.map((r) => r.id))

    const approve = { decision: 'approve', role: rows[0].memberRole }
    expect(decide.request.safeParse(approve).success).toBe(true)
    expect(Object.keys(decide.request.parse({ ...approve, memberId: 'm-1', clubId: 'c-1' })).sort()).toEqual(['decision', 'role'])
    expect(decide.request.safeParse({ decision: 'promote' }).success).toBe(false)
    const named = await press(clubId, rows[0].id, approve, admin)
    expect(await expectContract(named, decide.response)).toEqual({ id: rows[0].id, status: 'approved', told: true })
    const declined = await press(clubId, rows[1].id, { decision: 'decline' }, admin)
    expect(await expectContract(declined, decide.response)).toEqual({ id: rows[1].id, status: 'declined', told: true })
    const again = await press(clubId, rows[1].id, { decision: 'decline' }, admin)
    expect(again.status).toBe(409)
    expect(errorBodySchema.safeParse(await again.json()).success).toBe(true)
    const pageAfter = await invoke(pageGet, { params: { id: clubId } })
    expect((await expectContract(pageAfter, page.response)).rep_wanted).toBe(false)
  })
})
