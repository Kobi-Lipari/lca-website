// test/integration/rate-limit-confirm-edges.test.ts
//
// The edges of the limit of 30 an hour on the monthly check's confirm
// endpoints (WS09 steps 14 and 25) that test/integration/rate-limit-confirm.test.ts
// leaves: forty calls made together from one place, of which exactly thirty
// are served; a forged address header, or a second good link from the same
// place, never giving a place more than its thirty; a call at the limit
// reading nothing of the club and writing nothing, however it asks; a link
// that is expired, made for another purpose or signed with another key
// refused as before and never counted; and a place served again when the
// hour is over. Each case sets CLUB_KEEPERS_ON itself through a getter on
// the mocked module. The keys are made up and written here, every club and
// person is made up, and the addresses are from the ranges set aside for
// documentation.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  LINK_CALLS_AN_HOUR, LINK_EXPIRED, LINK_FORGED, LINK_TOO_OFTEN, onRequestGet as linkGet, onRequestPost as linkPost,
} from '../../functions/api/clubs/confirm/[token]'
import { CONFIRM_PURPOSE, LINK_TTL_SECONDS } from '../../functions/utils/clubs/monthlyCheck'
import { ADDRESS_HEADER, TOO_MANY } from '../../functions/utils/rateLimit'
import { signToken } from '../../functions/utils/tokens'
import { seedClub, seedMember } from './factories'
import { invoke, resetHarness } from './harness'
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

const KEY = 'example-made-up-signing-key-for-the-edges-0002'
const OTHER_KEY = 'example-made-up-signing-key-for-the-edges-0003'
const DAY_MS = 24 * 60 * 60 * 1000

let seq = 0
const next = () => `${++seq}-${crypto.randomUUID().slice(0, 6)}`
/** A made-up address of its own for each case, from 203.0.113.0/24, so no case reads another's count. */
const place = () => `203.0.113.${(++seq % 250) + 1}`

/** A club in a region of its own, held by a seat whose one holder is returned. */
async function linked(over: { purpose?: string; key?: string; issued?: Date } = {}) {
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
  const token = await signToken(over.key ?? KEY, over.purpose ?? CONFIRM_PURPOSE, { club: clubId, member: memberId }, LINK_TTL_SECONDS, over.issued ?? new Date())
  return { clubId, memberId, token }
}

const call = (handler: typeof linkGet, token: string, address: string | null, extra: Record<string, string> = {}, db?: D1Database) =>
  invoke(handler, {
    method: handler === linkPost ? 'POST' : 'GET',
    params: { token },
    body: handler === linkPost ? {} : undefined,
    env: db ? { SIGNING_SECRET: KEY, DB: db } : { SIGNING_SECRET: KEY },
    path: `/api/clubs/confirm/${token}`,
    headers: address === null ? extra : { [ADDRESS_HEADER]: address, ...extra },
  })
const rowCount = async () => (await env.DB.prepare('SELECT COUNT(*) AS n FROM rate_limits').first<{ n: number }>())!.n
const confirmedOf = async (clubId: string) =>
  env.DB.prepare('SELECT last_confirmed_at, confirmed_by FROM clubs WHERE id = ?').bind(clubId).first<{ last_confirmed_at: string | null; confirmed_by: string | null }>()

beforeEach(() => {
  resetHarness()
  flags.keepersOn = true
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

describe('calls made together at the confirm endpoint', () => {
  it('forty at once from one place: exactly thirty are served and ten are the 429 in words', async () => {
    const { token } = await linked()
    const address = place()
    const results = await Promise.all(Array.from({ length: 40 }, () => call(linkGet, token, address)))
    const statuses = results.map((r) => r.status)
    expect(statuses.filter((s) => s === 200)).toHaveLength(LINK_CALLS_AN_HOUR)
    expect(statuses.filter((s) => s === 429)).toHaveLength(10)
    expect(statuses.filter((s) => s !== 200 && s !== 429)).toEqual([])
    for (const r of results.filter((x) => x.status === 429)) expect(await r.json()).toEqual({ error: LINK_TOO_OFTEN })
  })

  it('GET and POST made together share the one thirty', async () => {
    const { token } = await linked()
    const address = place()
    const results = await Promise.all(Array.from({ length: 36 }, (_, i) => call(i % 2 ? linkPost : linkGet, token, address)))
    expect(results.filter((r) => r.status === 200)).toHaveLength(LINK_CALLS_AN_HOUR)
    expect(results.filter((r) => r.status === 429)).toHaveLength(6)
  })
})

describe('what a place cannot do to get more than its thirty', () => {
  it('a forged address header changes nothing: the platform\'s address is the place', async () => {
    const { token } = await linked()
    const address = place()
    for (let i = 0; i < LINK_CALLS_AN_HOUR; i++) expect((await call(linkGet, token, address)).status).toBe(200)
    for (const forged of [{ 'X-Forwarded-For': '203.0.113.250' }, { 'X-Real-IP': '203.0.113.251' }, { 'True-Client-IP': '203.0.113.252' }, { Forwarded: 'for=203.0.113.253' }]) {
      const refused = await call(linkGet, token, address, forged)
      expect(refused.status, JSON.stringify(forged)).toBe(429)
    }
  })

  it('a second good link from the same place shares its count: the limit is the place\'s, not the link\'s', async () => {
    const first = await linked()
    const second = await linked()
    const address = place()
    for (let i = 0; i < LINK_CALLS_AN_HOUR; i++) expect((await call(linkGet, first.token, address)).status).toBe(200)
    expect((await call(linkGet, second.token, address)).status).toBe(429)
    expect((await call(linkGet, second.token, place())).status).toBe(200)
  })

  it('with no address at all, every such caller shares the route\'s one count, and nothing errors', async () => {
    const { token } = await linked()
    const results = await Promise.all(Array.from({ length: 33 }, () => call(linkGet, token, null)))
    expect(results.filter((r) => r.status === 200)).toHaveLength(LINK_CALLS_AN_HOUR)
    expect(results.filter((r) => r.status === 429)).toHaveLength(3)
  })
})

describe('a call at the limit', () => {
  it('reads nothing of the club and writes nothing, whichever way it asks', async () => {
    const { token, clubId } = await linked()
    const address = place()
    for (let i = 0; i < LINK_CALLS_AN_HOUR; i++) expect((await call(linkGet, token, address)).status).toBe(200)
    const before = await confirmedOf(clubId)
    expect(before).toEqual({ last_confirmed_at: null, confirmed_by: null })
    const rowsBefore = await rowCount()
    for (const handler of [linkGet, linkPost]) {
      const counting = countingDb()
      const refused = await call(handler, token, address, {}, counting.db)
      expect(refused.status).toBe(429)
      expect(await refused.json()).toEqual({ error: LINK_TOO_OFTEN })
      // Only the limiter's own batch ran: no club, no member, no seat was read, and no still-accurate mark was written.
      expect(counting.ran.filter((r) => /\bclubs\b|\bmembers\b|board_/.test(r.sql))).toEqual([])
    }
    expect(await confirmedOf(clubId)).toEqual(before)
    expect(await rowCount()).toBe(rowsBefore)
  })

  it('the 429 body holds the words alone: no club, no city, no member', async () => {
    const { token } = await linked()
    const address = place()
    for (let i = 0; i < LINK_CALLS_AN_HOUR; i++) await call(linkGet, token, address)
    const refused = await call(linkPost, token, address)
    expect(refused.status).toBe(429)
    const text = await refused.response.clone().text()
    expect(JSON.parse(text)).toEqual({ error: LINK_TOO_OFTEN })
    for (const piece of ['Example Chess Club', 'Example City', 'Player One', 'example.org', address]) expect(text).not.toContain(piece)
  })

  it('the 429 is in the link\'s own words, never the limiter\'s: nothing in it speaks of messages', async () => {
    const { token } = await linked()
    const address = place()
    for (let i = 0; i < LINK_CALLS_AN_HOUR; i++) await call(linkGet, token, address)
    for (const handler of [linkGet, linkPost]) {
      const refused = await call(handler, token, address)
      expect(refused.status).toBe(429)
      const text = await refused.response.clone().text()
      expect(JSON.parse(text)).toEqual({ error: 'This link has been opened too many times this hour. Try again in an hour.' })
      expect(text).not.toMatch(/messages/i)
      expect(text).not.toContain(TOO_MANY)
    }
  })

  it('a place served again when the hour is over, with its thirty to spend afresh', async () => {
    const { token } = await linked()
    const address = place()
    for (let i = 0; i < LINK_CALLS_AN_HOUR; i++) expect((await call(linkGet, token, address)).status).toBe(200)
    expect((await call(linkGet, token, address)).status).toBe(429)
    vi.setSystemTime(new Date(Date.now() + 61 * 60 * 1000))
    expect((await call(linkGet, token, address)).status).toBe(200)
    expect((await call(linkPost, token, address)).status).toBe(200)
  })
})

describe('a link that is refused before the limit is reached', () => {
  async function expectUncounted(token: string, status: number, words: string) {
    const address = place()
    const before = await rowCount()
    for (let i = 0; i < LINK_CALLS_AN_HOUR + 5; i++) {
      const result = await call(i % 2 ? linkPost : linkGet, token, address)
      expect(result.status, `call ${i}`).toBe(status)
      expect(await result.json()).toEqual({ error: words })
    }
    expect(await rowCount()).toBe(before)
  }

  it('an expired link is the 410 each time, never the 429, and is not counted', async () => {
    const { token } = await linked({ issued: new Date(Date.now() - (LINK_TTL_SECONDS * 1000 + DAY_MS)) })
    await expectUncounted(token, 410, LINK_EXPIRED)
  })

  it('a link made for another purpose is the 400 each time, and is not counted', async () => {
    const { token } = await linked({ purpose: 'example_other_purpose' })
    await expectUncounted(token, 400, LINK_FORGED)
  })

  it('a link signed with another key is the 400 each time, and is not counted', async () => {
    const { token } = await linked({ key: OTHER_KEY })
    await expectUncounted(token, 400, LINK_FORGED)
  })

  it('refused links do not use up the place\'s thirty for its good ones', async () => {
    const address = place()
    for (let i = 0; i < 40; i++) expect((await call(linkGet, 'not-a-token', address)).status).toBe(400)
    const { token } = await linked()
    for (let i = 0; i < LINK_CALLS_AN_HOUR; i++) expect((await call(linkGet, token, address)).status, `call ${i}`).toBe(200)
    expect((await call(linkGet, token, address)).status).toBe(429)
  })
})
