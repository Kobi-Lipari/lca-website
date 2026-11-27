// test/integration/rate-limit.test.ts
//
// The shared rate limit (functions/utils/rateLimit.ts, WS09 step 25) on D1
// built from the migrations: the Nth call in an hour refused with a 429 in
// words, a new hour starting over, two routes counted apart, calls made
// together never both the last one allowed, the address read only from the
// header the platform sets, no row and no log line holding an address, the
// limiter refusing in words and writing nothing with no signing secret, the
// bucket a keyed hash that differs under another secret, and the rows of an
// hour that has ended deleted as calls come in. The secrets are made up and
// written here; the addresses are from the ranges set aside for
// documentation, which belong to no one.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ADDRESS_HEADER, CANT_SEND_NOW, LIMITER_KEY_LABEL, TOO_MANY, bucketFor, hourStart, limit } from '../../functions/utils/rateLimit'
import { resetHarness } from './harness'

const KEY = 'example-made-up-signing-key-for-the-limit-0001'
const OTHER_KEY = 'example-made-up-signing-key-for-the-limit-0002'
const ADDRESS = '192.0.2.10'
const OTHER_ADDRESS = '198.51.100.20'
const AN_HOUR = 60 * 60 * 1000

let seq = 0
/** A route of its own for each case, so no case reads another's count. */
const route = () => `example/route-${++seq}-${crypto.randomUUID().slice(0, 6)}`
const from = (address: string | null, headers: Record<string, string> = {}) =>
  new Request('https://lca-website.pages.dev/api/example', { method: 'POST', headers: address === null ? headers : { [ADDRESS_HEADER]: address, ...headers } })
const keyed = { SIGNING_SECRET: KEY, DB: env.DB }

const rows = async () => (await env.DB.prepare('SELECT bucket, hits, window_start FROM rate_limits ORDER BY bucket').all<{ bucket: string; hits: number; window_start: string }>()).results
const rowCount = async () => (await env.DB.prepare('SELECT COUNT(*) AS n FROM rate_limits').first<{ n: number }>())!.n

/** The bucket worked out here as the brief writes it, with Web Crypto alone: HMAC-SHA-256 under a key that is the HMAC of the secret over "rate-limit". */
async function expectedBucket(secret: string, name: string, place: string, hour: string): Promise<string> {
  const enc = new TextEncoder()
  const sign = async (key: BufferSource, text: string) =>
    crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), enc.encode(text))
  const limiterKey = await sign(enc.encode(secret), 'rate-limit')
  return [...new Uint8Array(await sign(limiterKey, `${name}\n${place}\n${hour}`))].map((b) => b.toString(16).padStart(2, '0')).join('')
}

beforeEach(() => {
  resetHarness()
  // The middle of the run's own hour, held still, so every call of a case lands in one hour however long the run takes.
  const middle = new Date()
  middle.setUTCMinutes(30, 0, 0)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(middle)
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('limit(env, request, route, { perHour })', () => {
  it('the Nth call in an hour is refused', async () => {
    const name = route()
    for (let i = 1; i <= 3; i++) expect(await limit(keyed, from(ADDRESS), name, { perHour: 3 }), `call ${i}`).toEqual({ ok: true })
    for (let i = 4; i <= 5; i++) expect(await limit(keyed, from(ADDRESS), name, { perHour: 3 }), `call ${i}`).toEqual({ ok: false, status: 429, error: TOO_MANY })
    expect(TOO_MANY).toBe('Too many messages from here. Try again in an hour.')
    // Another place is counted apart, so it is not refused.
    expect(await limit(keyed, from(OTHER_ADDRESS), name, { perHour: 3 })).toEqual({ ok: true })
  })

  it('a new hour starts over', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-17T15:59:00Z'))
    const name = route()
    expect(await limit(keyed, from(ADDRESS), name, { perHour: 1 })).toEqual({ ok: true })
    expect(await limit(keyed, from(ADDRESS), name, { perHour: 1 })).toMatchObject({ ok: false, status: 429 })
    vi.setSystemTime(new Date('2026-11-17T16:00:00Z'))
    expect(await limit(keyed, from(ADDRESS), name, { perHour: 1 })).toEqual({ ok: true })
    expect(await limit(keyed, from(ADDRESS), name, { perHour: 1 })).toMatchObject({ ok: false, status: 429 })
  })

  it('two routes do not share a count', async () => {
    const [first, second] = [route(), route()]
    expect(await limit(keyed, from(ADDRESS), first, { perHour: 1 })).toEqual({ ok: true })
    expect(await limit(keyed, from(ADDRESS), first, { perHour: 1 })).toMatchObject({ status: 429 })
    expect(await limit(keyed, from(ADDRESS), second, { perHour: 1 })).toEqual({ ok: true })
  })

  it('calls made together are never both the last one allowed', async () => {
    const name = route()
    const answers = await Promise.all(Array.from({ length: 12 }, () => limit(keyed, from(ADDRESS), name, { perHour: 5 })))
    expect(answers.filter((a) => a.ok)).toHaveLength(5)
    expect(answers.filter((a) => !a.ok && a.status === 429)).toHaveLength(7)
    const bucket = await bucketFor(KEY, name, `address:${ADDRESS}`, hourStart(new Date()))
    expect((await rows()).find((r) => r.bucket === bucket)?.hits).toBe(12)
  })

  it('a forged address header never changes the bucket', async () => {
    const name = route()
    expect(await limit(keyed, from(ADDRESS), name, { perHour: 2 })).toEqual({ ok: true })
    // Headers a caller writes are not read: each of these is still the platform's address, counted once more.
    expect(await limit(keyed, from(ADDRESS, { 'X-Forwarded-For': OTHER_ADDRESS, 'X-Real-IP': OTHER_ADDRESS, 'True-Client-IP': OTHER_ADDRESS }), name, { perHour: 2 })).toEqual({ ok: true })
    expect(await limit(keyed, from(ADDRESS, { 'X-Forwarded-For': '203.0.113.30' }), name, { perHour: 2 })).toMatchObject({ status: 429 })
    // With no platform address, a forged header lands in the route's one shared count, never in a place of its own.
    const shared = route()
    expect(await limit(keyed, from(null, { 'X-Forwarded-For': OTHER_ADDRESS }), shared, { perHour: 1 })).toEqual({ ok: true })
    expect(await limit(keyed, from(null, { 'X-Forwarded-For': '203.0.113.31' }), shared, { perHour: 1 })).toMatchObject({ status: 429 })
    expect(await limit(keyed, from(null), shared, { perHour: 1 })).toMatchObject({ status: 429 })
  })

  it('with no address at all, the route\'s one shared count is used, and never an error', async () => {
    const name = route()
    expect(await limit(keyed, from(null), name, { perHour: 2 })).toEqual({ ok: true })
    expect(await limit(keyed, from(''), name, { perHour: 2 })).toEqual({ ok: true })
    expect(await limit(keyed, from(null), name, { perHour: 2 })).toEqual({ ok: false, status: 429, error: TOO_MANY })
    const bucket = await bucketFor(KEY, name, 'shared', hourStart(new Date()))
    expect((await rows()).find((r) => r.bucket === bucket)?.hits).toBe(3)
  })

  it('a signed-in member is counted by their id, apart from the address', async () => {
    const name = route()
    expect(await limit(keyed, from(ADDRESS), name, { perHour: 1, key: 'player-one' })).toEqual({ ok: true })
    expect(await limit(keyed, from(OTHER_ADDRESS), name, { perHour: 1, key: 'player-one' })).toMatchObject({ status: 429 })
    expect(await limit(keyed, from(ADDRESS), name, { perHour: 1 })).toEqual({ ok: true })
  })

  it('no row holds an address', async () => {
    const warn = vi.spyOn(console, 'warn')
    const log = vi.spyOn(console, 'log')
    const error = vi.spyOn(console, 'error')
    const name = route()
    for (const address of [ADDRESS, OTHER_ADDRESS, '2001:db8::1']) {
      await limit(keyed, from(address), name, { perHour: 1 })
      await limit(keyed, from(address), name, { perHour: 1 })
    }
    await limit(keyed, from(ADDRESS), name, { perHour: 1, key: 'player-one' })
    const all = await rows()
    expect(all.length).toBeGreaterThanOrEqual(4)
    for (const row of all) {
      expect(row.bucket, 'a bucket is a hash in hex').toMatch(/^[0-9a-f]{64}$/)
      expect(row.window_start).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:00:00$/)
      expect(Object.keys(row).sort()).toEqual(['bucket', 'hits', 'window_start'])
    }
    const stored = JSON.stringify(all)
    for (const piece of [ADDRESS, OTHER_ADDRESS, '2001:db8::1', '192.0.2', '198.51.100', '2001:db8', 'player-one', name]) expect(stored, piece).not.toContain(piece)
    // Nothing was logged at all, so no log line can hold one.
    expect([...warn.mock.calls, ...log.mock.calls, ...error.mock.calls]).toEqual([])
  })

  it('with no signing secret the limiter refuses in words and writes no row', async () => {
    const before = await rowCount()
    for (const secret of [undefined, '', 'short-made-up-secret']) {
      const answer = await limit({ DB: env.DB, SIGNING_SECRET: secret }, from(ADDRESS), route(), { perHour: 30 })
      expect(answer, String(secret)).toEqual({ ok: false, status: 503, error: CANT_SEND_NOW })
    }
    expect(CANT_SEND_NOW).toBe('We can\'t send this right now.')
    expect(await rowCount()).toBe(before)
  })

  it('the bucket differs under a different secret', async () => {
    const name = route()
    const hour = hourStart(new Date())
    const place = `address:${ADDRESS}`
    expect(LIMITER_KEY_LABEL).toBe('rate-limit')
    // The bucket is the keyed hash the brief writes, under a key made for the limiter alone.
    expect(await bucketFor(KEY, name, place, hour)).toBe(await expectedBucket(KEY, name, place, hour))
    expect(await bucketFor(KEY, name, place, hour)).not.toBe(await bucketFor(OTHER_KEY, name, place, hour))
    await limit(keyed, from(ADDRESS), name, { perHour: 1 })
    await limit({ DB: env.DB, SIGNING_SECRET: OTHER_KEY }, from(ADDRESS), name, { perHour: 1 })
    const buckets = (await rows()).map((r) => r.bucket)
    expect(buckets).toContain(await bucketFor(KEY, name, place, hour))
    expect(buckets).toContain(await bucketFor(OTHER_KEY, name, place, hour))
    // Under the other secret the same place starts its own count, so it is not refused.
    expect(await limit({ DB: env.DB, SIGNING_SECRET: OTHER_KEY }, from(ADDRESS), name, { perHour: 2 })).toEqual({ ok: true })
  })

  it('windows that have ended are deleted as it goes, so the table never grows past the hour\'s rows', async () => {
    // A day past every other case's hour, so each row this file wrote before has ended by the second call.
    const start = new Date(Date.now() + 24 * AN_HOUR)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(start)
    for (let i = 0; i < 5; i++) await limit(keyed, from(`192.0.2.${100 + i}`), route(), { perHour: 30 })
    expect(await rowCount()).toBeGreaterThanOrEqual(5)
    const later = new Date(start.getTime() + 2 * AN_HOUR)
    vi.setSystemTime(later)
    await limit(keyed, from(ADDRESS), route(), { perHour: 30 })
    expect(await rows()).toEqual([expect.objectContaining({ hits: 1, window_start: hourStart(later) })])
  })
})
