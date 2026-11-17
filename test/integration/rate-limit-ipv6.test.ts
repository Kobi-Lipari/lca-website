// test/integration/rate-limit-ipv6.test.ts
//
// How the shared rate limit (functions/utils/rateLimit.ts, WS09 step 25)
// counts an IPv6 visitor: by the first 64 bits of the address, the network
// one home or phone connection is usually given whole, so moving between the
// addresses of that network buys no fresh count; another network is another
// place; one network written in any of its forms is one place; an IPv4
// address carried in IPv6 is counted as that IPv4 address; text that is no
// address is still counted; and no row holds the address or its network. The
// secret is made up and written here; the addresses are from the ranges set
// aside for documentation, which belong to no one.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ADDRESS_HEADER, TOO_MANY, limit, placeOfAddress } from '../../functions/utils/rateLimit'
import { resetHarness } from './harness'

const KEY = 'example-made-up-signing-key-for-the-limit-0006'
const keyed = { SIGNING_SECRET: KEY, DB: env.DB }

let seq = 0
const route = () => `example/ipv6-${++seq}-${crypto.randomUUID().slice(0, 6)}`
const from = (address: string) =>
  new Request('https://lca-website.pages.dev/api/example', { method: 'POST', headers: { [ADDRESS_HEADER]: address } })

beforeEach(() => {
  resetHarness()
  // The middle of the run's own hour, held still, so every call of a case lands in one hour.
  const middle = new Date()
  middle.setUTCMinutes(30, 0, 0)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(middle)
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('an IPv6 visitor', () => {
  it('is counted by their network\'s first 64 bits: moving between its addresses buys no fresh count', async () => {
    const name = route()
    expect(await limit(keyed, from('2001:db8:1:2::1'), name, { perHour: 2 })).toEqual({ ok: true })
    expect(await limit(keyed, from('2001:db8:1:2:ffff:ffff:ffff:ffff'), name, { perHour: 2 })).toEqual({ ok: true })
    expect(await limit(keyed, from('2001:db8:1:2:abcd::9'), name, { perHour: 2 })).toEqual({ ok: false, status: 429, error: TOO_MANY })
  })

  it('in another network is another place', async () => {
    const name = route()
    expect(await limit(keyed, from('2001:db8:1:2::1'), name, { perHour: 1 })).toEqual({ ok: true })
    expect(await limit(keyed, from('2001:db8:1:2::2'), name, { perHour: 1 })).toMatchObject({ status: 429 })
    expect(await limit(keyed, from('2001:db8:1:3::1'), name, { perHour: 1 })).toEqual({ ok: true })
    expect(await limit(keyed, from('2001:db8:2:2::1'), name, { perHour: 1 })).toEqual({ ok: true })
  })

  it('in one network written in any of its forms is one place', () => {
    const network = placeOfAddress('2001:db8:1:2::1')
    expect(network).toBe('network:2001:db8:1:2::/64')
    for (const written of ['2001:DB8:1:2::1', '2001:0db8:0001:0002:0000:0000:0000:0001', '2001:db8:1:2:0:0:0:1', ' 2001:db8:1:2::abcd ', '2001:db8:1:2::1%eth0']) {
      expect(placeOfAddress(written), written).toBe(network)
    }
    expect(placeOfAddress('2001:db8::')).toBe('network:2001:db8:0:0::/64')
    expect(placeOfAddress('::')).toBe('network:0:0:0:0::/64')
  })

  it('carrying an IPv4 address is counted as that IPv4 address', async () => {
    expect(placeOfAddress('::ffff:192.0.2.50')).toBe(placeOfAddress('192.0.2.50'))
    expect(placeOfAddress('::ffff:c000:232')).toBe(placeOfAddress('192.0.2.50'))
    expect(placeOfAddress('192.0.2.50')).toBe('address:192.0.2.50')
    const name = route()
    expect(await limit(keyed, from('192.0.2.50'), name, { perHour: 1 })).toEqual({ ok: true })
    expect(await limit(keyed, from('::ffff:192.0.2.50'), name, { perHour: 1 })).toMatchObject({ status: 429 })
  })

  it('text that is no address is counted as it stands, never let through uncounted', async () => {
    for (const text of ['2001:db8::1::2', 'not:an:address', '1:2:3:4:5:6:7:8:9', '2001:db8::192.0.2.999', ':2001:db8::1', '1:2:3:4:5:6:7']) {
      expect(placeOfAddress(text), text).toBe(`address:${text}`)
      const name = route()
      expect(await limit(keyed, from(text), name, { perHour: 1 }), text).toEqual({ ok: true })
      expect(await limit(keyed, from(text), name, { perHour: 1 }), text).toMatchObject({ status: 429 })
    }
  })

  it('leaves no row holding the address or its network', async () => {
    const name = route()
    for (const address of ['2001:db8:1:2::1', '2001:db8:1:2::2', '::ffff:192.0.2.51']) await limit(keyed, from(address), name, { perHour: 5 })
    const stored = JSON.stringify((await env.DB.prepare('SELECT bucket, hits, window_start FROM rate_limits').all()).results)
    // Each piece holds a character no hex bucket can, so a bucket never matches one by chance.
    for (const piece of ['2001:db8', ':1:2', '192.0.2', 'network:', 'address:', '/64']) expect(stored, piece).not.toContain(piece)
  })
})
