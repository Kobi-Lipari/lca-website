// test/integration/rate-limit-edges.test.ts
//
// The edges of the shared rate limit (functions/utils/rateLimit.ts, WS09 step
// 25) that test/integration/rate-limit.test.ts leaves: the hour's boundary to
// the millisecond, midnight and both clock changes in America/Chicago (the
// window is an hour of UTC, so a local hour that repeats is two windows and a
// local hour that is skipped leaves none uncounted), a limit of nought and of
// one, rows of the current hour kept as others are cleared, an address with
// white space round it, a member's id that is empty, calls made together from
// many places at once, and an error that is not a missing table, which is
// never swallowed. Every secret, address and member is made up; the addresses
// are from the ranges set aside for documentation.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ADDRESS_HEADER, CANT_SEND_NOW, TOO_MANY, bucketFor, hourStart, limit } from '../../functions/utils/rateLimit'
import { resetHarness } from './harness'

const KEY = 'example-made-up-signing-key-for-the-edges-0001'
const keyed = { SIGNING_SECRET: KEY, DB: env.DB }

let seq = 0
const route = () => `example/edge-${++seq}-${crypto.randomUUID().slice(0, 6)}`
const from = (address: string | null) =>
  new Request('https://lca-website.pages.dev/api/example', { method: 'POST', headers: address === null ? {} : { [ADDRESS_HEADER]: address } })
const at = (iso: string) => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(iso))
}
const rows = async () => (await env.DB.prepare('SELECT bucket, hits, window_start FROM rate_limits').all<{ bucket: string; hits: number; window_start: string }>()).results
/** The count in the bucket a route, place and hour make, or undefined when there is no row. */
const hitsOf = async (name: string, place: string, hour: string) =>
  (await env.DB.prepare('SELECT hits FROM rate_limits WHERE bucket = ?').bind(await bucketFor(KEY, name, place, hour)).first<{ hits: number }>())?.hits

beforeEach(() => {
  resetHarness()
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('the hour a call is counted in', () => {
  it('writes the start of the hour in UTC, as datetime(\'now\') writes a time', () => {
    expect(hourStart(new Date('2026-11-17T15:59:59.999Z'))).toBe('2026-11-17 15:00:00')
    expect(hourStart(new Date('2026-11-17T16:00:00.000Z'))).toBe('2026-11-17 16:00:00')
    expect(hourStart(new Date('2026-12-31T23:59:59.999Z'))).toBe('2026-12-31 23:00:00')
    expect(hourStart(new Date('2027-01-01T00:00:00.000Z'))).toBe('2027-01-01 00:00:00')
  })

  it('the last millisecond of an hour is in that hour, and the next millisecond starts over', async () => {
    const name = route()
    at('2026-11-17T15:59:59.999Z')
    expect(await limit(keyed, from('192.0.2.11'), name, { perHour: 1 })).toEqual({ ok: true })
    expect(await limit(keyed, from('192.0.2.11'), name, { perHour: 1 })).toMatchObject({ ok: false, status: 429 })
    vi.setSystemTime(new Date('2026-11-17T16:00:00.000Z'))
    expect(await limit(keyed, from('192.0.2.11'), name, { perHour: 1 })).toEqual({ ok: true })
  })

  it('midnight in Chicago is just another hour: 11:59 PM and 12:00 AM on Tuesday, November 17, 2026 are two windows', async () => {
    // Chicago is on standard time (UTC-6) that day, so its midnight is 06:00 UTC.
    const name = route()
    at('2026-11-17T05:59:30Z')
    expect(await limit(keyed, from('192.0.2.12'), name, { perHour: 1 })).toEqual({ ok: true })
    expect(await limit(keyed, from('192.0.2.12'), name, { perHour: 1 })).toMatchObject({ status: 429 })
    vi.setSystemTime(new Date('2026-11-17T06:00:30Z'))
    expect(await limit(keyed, from('192.0.2.12'), name, { perHour: 1 })).toEqual({ ok: true })
    // The new window's call cleared the old one, so the table holds Tuesday's first hour and not Monday's last.
    const windows = (await rows()).map((r) => r.window_start)
    expect(windows).not.toContain('2026-11-17 05:00:00')
    expect(windows).toContain('2026-11-17 06:00:00')
  })

  it('when Chicago turns its clocks back (Sunday, November 1, 2026) the repeated 1:30 AM is two windows, each starting over', async () => {
    const name = route()
    // 1:30 AM CDT is 06:30 UTC and 1:30 AM CST an hour later, 07:30 UTC.
    at('2026-11-01T06:30:00Z')
    expect(await limit(keyed, from('192.0.2.13'), name, { perHour: 1 })).toEqual({ ok: true })
    expect(await limit(keyed, from('192.0.2.13'), name, { perHour: 1 })).toMatchObject({ status: 429 })
    vi.setSystemTime(new Date('2026-11-01T07:30:00Z'))
    expect(await limit(keyed, from('192.0.2.13'), name, { perHour: 1 })).toEqual({ ok: true })
    expect(await limit(keyed, from('192.0.2.13'), name, { perHour: 1 })).toMatchObject({ status: 429 })
    // The first hour's row is cleared by the second hour's first call, and the second hour's row is the one kept.
    expect(await hitsOf(name, 'address:192.0.2.13', '2026-11-01 06:00:00')).toBeUndefined()
    expect(await hitsOf(name, 'address:192.0.2.13', '2026-11-01 07:00:00')).toBe(2)
  })

  it('when Chicago turns its clocks forward (Sunday, March 8, 2026) no hour is skipped and none counted twice', async () => {
    const name = route()
    // 1:59 AM CST is 07:59 UTC; the next minute is 3:00 AM CDT, 08:00 UTC.
    at('2026-03-08T07:59:00Z')
    expect(await limit(keyed, from('192.0.2.14'), name, { perHour: 2 })).toEqual({ ok: true })
    expect(await limit(keyed, from('192.0.2.14'), name, { perHour: 2 })).toEqual({ ok: true })
    expect(await limit(keyed, from('192.0.2.14'), name, { perHour: 2 })).toMatchObject({ status: 429 })
    vi.setSystemTime(new Date('2026-03-08T08:00:00Z'))
    expect(await limit(keyed, from('192.0.2.14'), name, { perHour: 2 })).toEqual({ ok: true })
    expect(await limit(keyed, from('192.0.2.14'), name, { perHour: 2 })).toEqual({ ok: true })
    expect(await limit(keyed, from('192.0.2.14'), name, { perHour: 2 })).toMatchObject({ status: 429 })
    // An hour of local time later (4:00 AM CDT, 09:00 UTC) is the next window.
    vi.setSystemTime(new Date('2026-03-08T09:00:00Z'))
    expect(await limit(keyed, from('192.0.2.14'), name, { perHour: 2 })).toEqual({ ok: true })
  })

  it('a year end and a leap day are hours like any other', async () => {
    const name = route()
    at('2028-02-29T23:30:00Z')
    expect(await limit(keyed, from('192.0.2.15'), name, { perHour: 1 })).toEqual({ ok: true })
    expect(await limit(keyed, from('192.0.2.15'), name, { perHour: 1 })).toMatchObject({ status: 429 })
    vi.setSystemTime(new Date('2028-03-01T00:00:00Z'))
    expect(await limit(keyed, from('192.0.2.15'), name, { perHour: 1 })).toEqual({ ok: true })
  })
})

describe('the count at its edges', () => {
  it('a limit of one allows the first call, and a limit of nought allows none', async () => {
    const one = route()
    expect(await limit(keyed, from('192.0.2.16'), one, { perHour: 1 })).toEqual({ ok: true })
    expect(await limit(keyed, from('192.0.2.16'), one, { perHour: 1 })).toEqual({ ok: false, status: 429, error: TOO_MANY })
    const none = route()
    expect(await limit(keyed, from('192.0.2.16'), none, { perHour: 0 })).toEqual({ ok: false, status: 429, error: TOO_MANY })
  })

  it('the limit is the caller\'s per call, so one route can be asked of with two limits and the count is shared', async () => {
    const name = route()
    expect(await limit(keyed, from('192.0.2.17'), name, { perHour: 3 })).toEqual({ ok: true })
    expect(await limit(keyed, from('192.0.2.17'), name, { perHour: 3 })).toEqual({ ok: true })
    // Two calls so far: a limit of two now refuses the third, a limit of three would have allowed it.
    expect(await limit(keyed, from('192.0.2.17'), name, { perHour: 2 })).toMatchObject({ status: 429 })
  })

  it('an address with white space round it is the same place as without', async () => {
    const name = route()
    expect(await limit(keyed, from('192.0.2.18'), name, { perHour: 1 })).toEqual({ ok: true })
    expect(await limit(keyed, from('  192.0.2.18 '), name, { perHour: 1 })).toMatchObject({ status: 429 })
  })

  it('an empty member id is no member: the call is counted by the address', async () => {
    const name = route()
    expect(await limit(keyed, from('192.0.2.19'), name, { perHour: 1, key: '' })).toEqual({ ok: true })
    expect(await limit(keyed, from('192.0.2.19'), name, { perHour: 1 })).toMatchObject({ status: 429 })
    expect(await limit(keyed, from('192.0.2.20'), name, { perHour: 1, key: '' })).toEqual({ ok: true })
  })

  it('two members are counted apart, and a member is counted apart from the same text used as an address', async () => {
    const name = route()
    expect(await limit(keyed, from('192.0.2.21'), name, { perHour: 1, key: 'player-one' })).toEqual({ ok: true })
    expect(await limit(keyed, from('192.0.2.21'), name, { perHour: 1, key: 'player-two' })).toEqual({ ok: true })
    expect(await limit(keyed, from('192.0.2.21'), name, { perHour: 1, key: 'player-one' })).toMatchObject({ status: 429 })
    // A visitor whose address header reads like a member's id is a visitor, not that member.
    expect(await limit(keyed, from('player-one'), name, { perHour: 1 })).toEqual({ ok: true })
  })

  it('the refusal holds the words and nothing else: no address, no member, no route, no secret', async () => {
    const name = route()
    await limit(keyed, from('192.0.2.22'), name, { perHour: 1, key: 'player-one' })
    const refused = await limit(keyed, from('192.0.2.22'), name, { perHour: 1, key: 'player-one' })
    const noKey = await limit({ DB: env.DB, SIGNING_SECRET: undefined }, from('192.0.2.22'), name, { perHour: 1 })
    for (const answer of [refused, noKey]) {
      expect(Object.keys(answer).sort()).toEqual(['error', 'ok', 'status'])
      const text = JSON.stringify(answer)
      for (const piece of ['192.0.2', 'player-one', name, KEY]) expect(text).not.toContain(piece)
    }
    expect(noKey).toEqual({ ok: false, status: 503, error: CANT_SEND_NOW })
  })

  it('the secret is read at each call: a call made with none after one made with it is refused and writes no row', async () => {
    const name = route()
    const live = { DB: env.DB, SIGNING_SECRET: KEY as string | undefined }
    expect(await limit(live, from('192.0.2.23'), name, { perHour: 5 })).toEqual({ ok: true })
    const before = (await rows()).length
    live.SIGNING_SECRET = undefined
    expect(await limit(live, from('192.0.2.23'), name, { perHour: 5 })).toEqual({ ok: false, status: 503, error: CANT_SEND_NOW })
    expect((await rows()).length).toBe(before)
    live.SIGNING_SECRET = KEY
    expect(await limit(live, from('192.0.2.23'), name, { perHour: 5 })).toEqual({ ok: true })
  })
})

describe('what is cleared as calls come in', () => {
  it('only the hours that have ended: the current hour\'s rows, other places\' counts included, stay as they were', async () => {
    at('2026-11-17T15:10:00Z')
    const name = route()
    for (let i = 0; i < 3; i++) await limit(keyed, from('192.0.2.30'), name, { perHour: 30 })
    await limit(keyed, from('192.0.2.31'), name, { perHour: 30 })
    vi.setSystemTime(new Date('2026-11-17T15:50:00Z'))
    await limit(keyed, from('192.0.2.32'), name, { perHour: 30 })
    expect(await hitsOf(name, 'address:192.0.2.30', '2026-11-17 15:00:00')).toBe(3)
    expect(await hitsOf(name, 'address:192.0.2.31', '2026-11-17 15:00:00')).toBe(1)
    expect(await hitsOf(name, 'address:192.0.2.32', '2026-11-17 15:00:00')).toBe(1)
  })

  it('a row dated ahead of the clock (the clock was set back) is kept, never counted as an ended hour', async () => {
    const ahead = '2031-01-01 00:00:00'
    await env.DB.prepare('INSERT INTO rate_limits (bucket, hits, window_start) VALUES (?, 7, ?)').bind('f'.repeat(64), ahead).run()
    await limit(keyed, from('192.0.2.33'), route(), { perHour: 30 })
    expect((await rows()).find((r) => r.bucket === 'f'.repeat(64))).toEqual({ bucket: 'f'.repeat(64), hits: 7, window_start: ahead })
    await env.DB.prepare('DELETE FROM rate_limits WHERE bucket = ?').bind('f'.repeat(64)).run()
  })
})

describe('calls made together', () => {
  it('from many places at once each place gets exactly its own allowance and no more', async () => {
    const name = route()
    const places = Array.from({ length: 8 }, (_, i) => `198.51.100.${100 + i}`)
    const answers = await Promise.all(places.flatMap((p) => Array.from({ length: 5 }, async () => ({ p, answer: await limit(keyed, from(p), name, { perHour: 2 }) }))))
    for (const p of places) {
      const mine = answers.filter((a) => a.p === p).map((a) => a.answer)
      expect(mine.filter((a) => a.ok), p).toHaveLength(2)
      expect(mine.filter((a) => !a.ok && a.status === 429), p).toHaveLength(3)
    }
  })

  it('made together with no address, they share the one count and are not both the last one allowed', async () => {
    const name = route()
    const answers = await Promise.all(Array.from({ length: 9 }, () => limit(keyed, from(null), name, { perHour: 4 })))
    expect(answers.filter((a) => a.ok)).toHaveLength(4)
  })

  it('made together across a call that clears an ended hour, the current hour\'s count is not lost', async () => {
    at('2026-11-17T15:30:00Z')
    const name = route()
    await limit(keyed, from('192.0.2.40'), name, { perHour: 30 })
    vi.setSystemTime(new Date('2026-11-17T16:05:00Z'))
    const answers = await Promise.all(Array.from({ length: 10 }, () => limit(keyed, from('192.0.2.41'), name, { perHour: 6 })))
    expect(answers.filter((a) => a.ok)).toHaveLength(6)
    expect(await hitsOf(name, 'address:192.0.2.41', '2026-11-17 16:00:00')).toBe(10)
  })
})

describe('an error that is not a missing table', () => {
  const failing = (message: string, cause?: unknown) =>
    ({
      SIGNING_SECRET: KEY,
      DB: { prepare: () => ({ bind: () => ({}) }), batch: async () => { throw new Error(message, cause === undefined ? undefined : { cause }) } },
    }) as unknown as Parameters<typeof limit>[0]

  it('is rethrown, with no log line, so a real fault is not hidden as a lagging migration', async () => {
    const warn = vi.spyOn(console, 'warn')
    await expect(limit(failing('D1_ERROR: disk I/O error: SQLITE_IOERR'), from('192.0.2.50'), route(), { perHour: 5 })).rejects.toThrow(/disk I\/O/)
    await expect(limit(failing('D1_ERROR: database is locked'), from('192.0.2.50'), route(), { perHour: 5 })).rejects.toThrow(/locked/)
    expect(warn).not.toHaveBeenCalled()
  })

  it('a missing table named in the error\'s cause is let through with the one log line, and its words hold no address', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const answer = await limit(failing('D1_ERROR: Failed query', new Error('no such table: rate_limits: SQLITE_ERROR')), from('192.0.2.51'), route(), { perHour: 5 })
    expect(answer).toEqual({ ok: true })
    expect(warn).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(warn.mock.calls)).not.toContain('192.0.2')
  })
})
