// test/integration/rate-limit-confirm.test.ts
//
// The monthly check's confirm endpoints (WS09 step 14) with the limit of WS09
// step 25: 30 calls an hour from one place, GET and POST together. Each case
// sets CLUB_KEEPERS_ON itself, off and then on, through a getter on the
// mocked module. With it off the endpoints answer as on the base and read no
// table; with it on and the limit not reached they answer as on the base, to
// the byte; at the limit the answer is the 429 in words with the link's own
// headers; a forged link and a missing signing secret are answered as on the
// base, before anything is counted. The keys are made up and written here,
// every club and person is made up, and the addresses are from the ranges
// set aside for documentation.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { errorBodySchema } from '../../domain/contracts'
import {
  LINK_CALLS_AN_HOUR, LINK_CLOSED, LINK_FORGED, LINK_NO_KEY, LINK_TOO_OFTEN, onRequestGet as linkGet, onRequestPost as linkPost,
} from '../../functions/api/clubs/confirm/[token]'
import { CONFIRM_PURPOSE, LINK_TTL_SECONDS } from '../../functions/utils/clubs/monthlyCheck'
import { ADDRESS_HEADER } from '../../functions/utils/rateLimit'
import { signToken } from '../../functions/utils/tokens'
import { seedAdmin, seedClub, seedMember } from './factories'
import { expectContract, invoke, resetHarness } from './harness'
import { countingDb } from './mailRuns'

const flags = vi.hoisted(() => ({ keepersOn: false }))
vi.mock('../../functions/utils/clubs/pages', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/clubs/pages')>()
  return {
    ...real,
    get CLUB_KEEPERS_ON() {
      return flags.keepersOn
    },
  }
})

const KEY = 'example-made-up-signing-key-for-the-limit-0003'
const KEYED = { SIGNING_SECRET: KEY }

let seq = 0
const next = () => `${++seq}-${crypto.randomUUID().slice(0, 6)}`
/** A made-up address of its own for each case, from 192.0.2.0/24, so no case reads another's count. */
const place = () => `192.0.2.${++seq % 250}`

/** A club in a region of its own, held by a seat whose one holder is returned, with a good link for them. */
async function linked() {
  const region = `Example Region ${next()}`
  const clubId = await seedClub({ name: 'Example Chess Club', city: 'Example City' })
  await env.DB.prepare('UPDATE clubs SET region = ? WHERE id = ?').bind(region, clubId).run()
  const memberId = await seedMember({ fullName: 'Player One', email: `player-${next()}@example.org` })
  const seat = `seat-${next()}`
  await env.DB.prepare(
    `INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active) VALUES (?, 'Example Region Representative', '', 99, ?, 'regional_rep', 1)`,
  ).bind(seat, seat).run()
  await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(seat, region).run()
  await env.DB.prepare('INSERT INTO board_seat_assignments (seat_id, member_id) VALUES (?, ?)').bind(seat, memberId).run()
  const token = await signToken(KEY, CONFIRM_PURPOSE, { club: clubId, member: memberId }, LINK_TTL_SECONDS, new Date())
  return { clubId, memberId, token }
}

const call = (handler: typeof linkGet, token: string, opts: { address?: string | null; over?: Record<string, unknown>; as?: string } = {}) =>
  invoke(handler, {
    method: handler === linkPost ? 'POST' : 'GET',
    params: { token },
    body: handler === linkPost ? {} : undefined,
    env: opts.over ?? KEYED,
    path: `/api/clubs/confirm/${token}`,
    headers: opts.address ? { [ADDRESS_HEADER]: opts.address } : {},
    as: opts.as,
  })
const rowCount = async () => (await env.DB.prepare('SELECT COUNT(*) AS n FROM rate_limits').first<{ n: number }>())!.n
const expectLinkHeaders = (response: Response) => {
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  expect(response.headers.get('Referrer-Policy')).toBe('no-referrer')
  expect(response.headers.get('X-Robots-Tag')).toBe('noindex')
}

beforeEach(() => {
  resetHarness()
  flags.keepersOn = false
  // The middle of the run's own hour, held still, so every call of a case lands in one hour however long the run takes.
  const middle = new Date()
  middle.setUTCMinutes(30, 0, 0)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(middle)
})
afterEach(() => {
  flags.keepersOn = false
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('the confirm endpoints with the limit', () => {
  it('with CLUB_KEEPERS_ON off both methods answer as on the base and read no table, the limit\'s least of all', async () => {
    const { token } = await linked()
    const before = await rowCount()
    for (const handler of [linkGet, linkPost]) {
      const counting = countingDb()
      const result = await call(handler, token, { address: place(), over: { ...KEYED, DB: counting.db } })
      expect(result.status).toBe(403)
      expect(await result.json()).toEqual({ error: LINK_CLOSED })
      expect(counting.ran).toEqual([])
    }
    expect(await rowCount()).toBe(before)
  })

  it('with it on and under the limit both methods answer as on the base, to the byte, and each counts one call', async () => {
    flags.keepersOn = true
    const { token } = await linked()
    const address = place()
    const before = await rowCount()
    const got = await call(linkGet, token, { address })
    expect(got.status).toBe(200)
    expect(await got.response.clone().text()).toBe('{"name":"Example Chess Club","city":"Example City","statement":null}')
    expectLinkHeaders(got.response)
    const pressed = await call(linkPost, token, { address })
    expect(pressed.status).toBe(200)
    expect(await pressed.json()).toMatchObject({ name: 'Example Chess Club', city: 'Example City' })
    // GET and POST share one count: one row for this place and hour, holding two calls.
    expect(await rowCount()).toBe(before + 1)
    expect((await env.DB.prepare('SELECT MAX(hits) AS n FROM rate_limits').first<{ n: number }>())!.n).toBeGreaterThanOrEqual(2)
  })

  it('the thirty-first call in an hour from one place is the 429 in words, with the link\'s headers, and another place is still served', async () => {
    flags.keepersOn = true
    const { token } = await linked()
    const address = place()
    expect(LINK_CALLS_AN_HOUR).toBe(30)
    for (let i = 1; i <= 30; i++) {
      const result = await call(i % 2 === 0 ? linkPost : linkGet, token, { address })
      expect(result.status, `call ${i}`).toBe(200)
    }
    for (const handler of [linkGet, linkPost]) {
      const result = await call(handler, token, { address })
      expect(result.status).toBe(429)
      expect(await expectContract(result, errorBodySchema)).toEqual({ error: LINK_TOO_OFTEN })
      expectLinkHeaders(result.response)
    }
    expect((await call(linkGet, token, { address: place() })).status).toBe(200)
  })

  it('a forged link is refused as on the base, before anything is counted or read', async () => {
    flags.keepersOn = true
    const before = await rowCount()
    for (const handler of [linkGet, linkPost]) {
      const counting = countingDb()
      const result = await call(handler, 'not-a-token', { address: place(), over: { ...KEYED, DB: counting.db } })
      expect(result.status).toBe(400)
      expect(await result.json()).toEqual({ error: LINK_FORGED })
      expect(counting.ran).toEqual([])
    }
    expect(await rowCount()).toBe(before)
  })

  it('with no signing secret the answer is today\'s 503, and nothing is counted', async () => {
    flags.keepersOn = true
    const { token } = await linked()
    const before = await rowCount()
    for (const handler of [linkGet, linkPost]) {
      const result = await call(handler, token, { address: place(), over: { SIGNING_SECRET: undefined } })
      expect(result.status).toBe(503)
      expect(await result.json()).toEqual({ error: LINK_NO_KEY })
    }
    expect(await rowCount()).toBe(before)
  })

  it('reads no sign-in: an LCA admin signed in is counted by place like anyone, and refused at the limit too', async () => {
    flags.keepersOn = true
    const { token } = await linked()
    const admin = await seedAdmin({ email: `admin-${next()}@example.org` })
    const address = place()
    for (let i = 1; i <= 30; i++) expect((await call(linkGet, token, { address, as: i % 2 ? admin : undefined })).status, `call ${i}`).toBe(200)
    const refused = await call(linkGet, token, { address, as: admin })
    expect(refused.status).toBe(429)
    expect(await refused.json()).toEqual({ error: LINK_TOO_OFTEN })
  })
})
