// test/integration/contracts/club-confirm.test.ts
// GET and POST /api/clubs/confirm/[token] and POST
// /api/admin/clubs/monthly-check keep their contracts
// (domain/contracts/clubs.ts), through the real handlers, with
// CLUB_KEEPERS_ON set through a getter on the mocked module, and every
// refusal keeps the error body's. The signing key is made up and written
// here, and every club and person is made up.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clubLinkConfirmResponseSchema, clubLinkResponseSchema, contracts, errorBodySchema, fieldErrorBodySchema, monthlyCheckResponseSchema,
} from '../../../domain/contracts'
import { onRequestGet as linkGet, onRequestPost as linkPost } from '../../../functions/api/clubs/confirm/[token]'
import { onRequestOptions as checkOptions, onRequestPost as checkPost } from '../../../functions/api/admin/clubs/monthly-check'
import { CONFIRM_PURPOSE, LINK_TTL_SECONDS } from '../../../functions/utils/clubs/monthlyCheck'
import { signToken } from '../../../functions/utils/tokens'
import { seedAdmin, seedClub, seedMember } from '../factories'
import { expectContract, invoke, resetHarness } from '../harness'

const flags = vi.hoisted(() => ({ keepersOn: false }))
vi.mock('../../../functions/utils/clubs/pages', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../functions/utils/clubs/pages')>()
  return {
    ...real,
    get CLUB_KEEPERS_ON() {
      return flags.keepersOn
    },
  }
})

beforeEach(async () => {
  resetHarness()
  await env.DB.prepare('DELETE FROM board_seat_assignments').run()
})
afterEach(() => {
  flags.keepersOn = false
})

const KEY = 'example-made-up-signing-key-for-contracts-0001'
const linkContract = contracts['clubs/confirm/[token]'].GET
const linkConfirmContract = contracts['clubs/confirm/[token]'].POST
const checkContract = contracts['admin/clubs/monthly-check'].POST

/** A made-up club in a region of its own, a holder of the region's seat, and a good link for them. */
async function exampleLink() {
  const region = `Example Region ${crypto.randomUUID().slice(0, 8)}`
  const clubId = await seedClub({ name: 'Example Chess Club', city: 'Example City' })
  await env.DB.prepare('UPDATE clubs SET region = ? WHERE id = ?').bind(region, clubId).run()
  const holder = await seedMember({ fullName: 'Player One', email: `player-${crypto.randomUUID().slice(0, 8)}@example.org` })
  const seat = `seat-${crypto.randomUUID().slice(0, 8)}`
  await env.DB.prepare(
    `INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active) VALUES (?, 'Example Region Representative', '', 99, ?, 'regional_rep', 1)`,
  ).bind(seat, seat).run()
  await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(seat, region).run()
  await env.DB.prepare('INSERT INTO board_seat_assignments (seat_id, member_id) VALUES (?, ?)').bind(seat, holder).run()
  const token = await signToken(KEY, CONFIRM_PURPOSE, { club: clubId, member: holder }, LINK_TTL_SECONDS)
  return { clubId, holder, token }
}

describe('GET and POST /api/clubs/confirm/[token] keep their contracts', () => {
  it('answers a good link within them, and each refusal as an error body, set and unset', async () => {
    const { clubId, token } = await exampleLink()
    flags.keepersOn = true
    const read = await invoke(linkGet, { params: { token }, env: { SIGNING_SECRET: KEY } })
    expect(read.status).toBe(200)
    // Changed at checkpoint V: the answer carries the club's meeting words, null for a listing with none.
    expect(await expectContract(read, linkContract.response)).toEqual({ name: 'Example Chess Club', city: 'Example City', statement: null })
    await env.DB.prepare('UPDATE clubs SET how_we_meet_text = ? WHERE id = ?').bind('Saturdays from 10:00 AM at the Example Library.', clubId).run()
    const withWords = await invoke(linkGet, { params: { token }, env: { SIGNING_SECRET: KEY } })
    expect(await expectContract(withWords, linkContract.response)).toEqual({ name: 'Example Chess Club', city: 'Example City', statement: 'Saturdays from 10:00 AM at the Example Library.' })
    const marked = await invoke(linkPost, { method: 'POST', params: { token }, body: {}, env: { SIGNING_SECRET: KEY } })
    expect(marked.status).toBe(200)
    const body = await expectContract(marked, linkConfirmContract.response)
    expect(Object.keys(body)).toEqual(['name', 'city', 'month'])
    for (const [status, over] of [[400, { token: 'not-a-token' }], [503, { secret: undefined }]] as const) {
      const params = { token: 'token' in over ? over.token : token }
      const env = { SIGNING_SECRET: 'secret' in over ? over.secret : KEY }
      for (const handler of [linkGet, linkPost]) {
        const refused = await invoke(handler, { method: handler === linkPost ? 'POST' : 'GET', params, body: handler === linkPost ? {} : undefined, env })
        expect(refused.status).toBe(status)
        await expectContract(refused, errorBodySchema)
      }
    }
    const notObject = await invoke(linkPost, { method: 'POST', params: { token }, body: [1], env: { SIGNING_SECRET: KEY } })
    expect(notObject.status).toBe(400)
    await expectContract(notObject, fieldErrorBodySchema)
    flags.keepersOn = false
    for (const handler of [linkGet, linkPost]) {
      const closed = await invoke(handler, { method: handler === linkPost ? 'POST' : 'GET', params: { token }, body: handler === linkPost ? {} : undefined, env: { SIGNING_SECRET: KEY } })
      expect(closed.status).toBe(403)
      await expectContract(closed, errorBodySchema)
    }
  })

  it('the contracts are strict: an id, a person or an address beside the answer is refused, and the request takes {}', () => {
    expect(clubLinkResponseSchema.safeParse({ name: 'Example Chess Club', city: 'Example City', statement: null, id: 'example-chess-club' }).success).toBe(false)
    // The meeting words are one key, a string or null, and always there.
    expect(clubLinkResponseSchema.safeParse({ name: 'Example Chess Club', city: 'Example City', statement: null }).success).toBe(true)
    expect(clubLinkResponseSchema.safeParse({ name: 'Example Chess Club', city: 'Example City', statement: 'Saturdays from 10:00 AM.' }).success).toBe(true)
    expect(clubLinkResponseSchema.safeParse({ name: 'Example Chess Club', city: 'Example City' }).success).toBe(false)
    expect(clubLinkResponseSchema.safeParse({ name: 'Example Chess Club', city: 'Example City', statement: 7 }).success).toBe(false)
    expect(clubLinkResponseSchema.safeParse({ name: 'Example Chess Club', city: 'Example City', statement: null, member: 'Player One' }).success).toBe(false)
    expect(clubLinkConfirmResponseSchema.safeParse({ name: 'Example Chess Club', city: 'Example City', month: 'November 2026', member: 'Player One' }).success).toBe(false)
    expect(clubLinkConfirmResponseSchema.safeParse({ name: 'Example Chess Club', city: 'Example City' }).success).toBe(false)
    expect(linkConfirmContract.request.safeParse({}).success).toBe(true)
    expect(linkConfirmContract.request.parse({ note: 'Example' })).toEqual({ note: 'Example' })
    for (const wrong of [null, [], 'yes', 1]) expect(linkConfirmContract.request.safeParse(wrong).success, JSON.stringify(wrong)).toBe(false)
  })
})

describe('POST /api/admin/clubs/monthly-check keeps its contract', () => {
  it('answers an LCA admin\'s question and press within it, and each refusal as an error body', async () => {
    await exampleLink()
    flags.keepersOn = true
    const admin = await seedAdmin()
    const asked = await invoke(checkPost, { method: 'POST', as: admin, body: { send: false }, env: { SIGNING_SECRET: KEY } })
    expect(asked.status).toBe(200)
    expect(await expectContract(asked, checkContract.response)).toMatchObject({ people: 1, sent: 0 })
    const sent = await invoke(checkPost, { method: 'POST', as: admin, body: { send: true }, env: { SIGNING_SECRET: KEY } })
    expect(sent.status).toBe(200)
    expect(Object.keys(await expectContract(sent, checkContract.response))).toEqual(['month', 'people', 'sent', 'notSent', 'notReached'])
    const member = await invoke(checkPost, { method: 'POST', as: await seedMember(), aal: 'aal1', body: { send: true }, env: { SIGNING_SECRET: KEY } })
    expect(member.status).toBe(403)
    await expectContract(member, errorBodySchema)
    const noKey = await invoke(checkPost, { method: 'POST', as: admin, body: { send: true }, env: { SIGNING_SECRET: undefined } })
    expect(noKey.status).toBe(503)
    await expectContract(noKey, errorBodySchema)
    const noSend = await invoke(checkPost, { method: 'POST', as: admin, body: {}, env: { SIGNING_SECRET: KEY } })
    expect(noSend.status).toBe(400)
    await expectContract(noSend, fieldErrorBodySchema)
    flags.keepersOn = false
    const closed = await invoke(checkPost, { method: 'POST', as: admin, body: { send: true }, env: { SIGNING_SECRET: KEY } })
    expect(closed.status).toBe(403)
    await expectContract(closed, errorBodySchema)
    expect((await invoke(checkOptions, { method: 'OPTIONS' })).status).toBe(204)
  })

  it('the contract is strict and names numbers alone: a person or an address beside them is refused', () => {
    const good = { month: 'December 2026', people: 2, sent: 2, notSent: 0, notReached: 0 }
    expect(monthlyCheckResponseSchema.safeParse(good).success).toBe(true)
    for (const wrong of [{ ...good, people: -1 }, { ...good, sent: 1.5 }, { ...good, names: ['Player One'] }, { ...good, emails: ['one@example.org'] }]) {
      expect(monthlyCheckResponseSchema.safeParse(wrong).success, JSON.stringify(wrong)).toBe(false)
    }
    expect(checkContract.request.safeParse({ send: true }).success).toBe(true)
    expect(checkContract.request.safeParse({ send: 'yes' }).success).toBe(false)
    expect(checkContract.request.safeParse({}).success).toBe(false)
  })
})
