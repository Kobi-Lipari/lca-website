// test/unit/stripe-signature.test.ts
//
// The replay window is the point of these. A signature proves the body was
// signed by someone holding the secret; it says nothing about when. Without a
// timestamp check, one captured membership webhook can be replayed forever,
// granting a free year each time.
import { describe, expect, it } from 'vitest'
import { verifyStripeSignature } from '../../functions/utils/stripe'

const SECRET = 'whsec_test_secret'
const PAYLOAD = JSON.stringify({ type: 'checkout.session.completed', id: 'evt_1' })
const NOW = 1_800_000_000 // fixed clock, so tolerance is exact rather than racy

async function sign(payload: string, timestamp: number, secret = SECRET): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const buf = await crypto.subtle.sign('HMAC', key, enc.encode(`${timestamp}.${payload}`))
  const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `t=${timestamp},v1=${hex}`
}

describe('verifyStripeSignature', () => {
  it('accepts a correctly signed, current payload', async () => {
    const header = await sign(PAYLOAD, NOW)
    expect(await verifyStripeSignature(PAYLOAD, header, SECRET, NOW)).toBe(true)
  })

  it('rejects a replay of a payload signed more than five minutes ago', async () => {
    // Perfectly valid HMAC — this is exactly the attack the window closes.
    const header = await sign(PAYLOAD, NOW - 301)
    expect(await verifyStripeSignature(PAYLOAD, header, SECRET, NOW)).toBe(false)
  })

  it('still accepts a delivery just inside the window', async () => {
    // Stripe retries, and a slow queue must not look like an attack.
    const header = await sign(PAYLOAD, NOW - 299)
    expect(await verifyStripeSignature(PAYLOAD, header, SECRET, NOW)).toBe(true)
  })

  it('tolerates modest clock skew in the other direction', async () => {
    const header = await sign(PAYLOAD, NOW + 120)
    expect(await verifyStripeSignature(PAYLOAD, header, SECRET, NOW)).toBe(true)
  })

  it('rejects a timestamp implausibly far in the future', async () => {
    const header = await sign(PAYLOAD, NOW + 3600)
    expect(await verifyStripeSignature(PAYLOAD, header, SECRET, NOW)).toBe(false)
  })

  it('rejects a body altered after signing', async () => {
    const header = await sign(PAYLOAD, NOW)
    const tampered = PAYLOAD.replace('evt_1', 'evt_2')
    expect(await verifyStripeSignature(tampered, header, SECRET, NOW)).toBe(false)
  })

  it('rejects a signature made with the wrong secret', async () => {
    const header = await sign(PAYLOAD, NOW, 'whsec_not_ours')
    expect(await verifyStripeSignature(PAYLOAD, header, SECRET, NOW)).toBe(false)
  })

  it('rejects malformed headers rather than throwing', async () => {
    for (const header of ['', 'garbage', 't=', 'v1=abc', 't=abc,v1=def', 't=,v1=']) {
      expect(await verifyStripeSignature(PAYLOAD, header, SECRET, NOW)).toBe(false)
    }
  })

  it('rejects a signature of the wrong length without comparing content', async () => {
    expect(await verifyStripeSignature(PAYLOAD, `t=${NOW},v1=ab`, SECRET, NOW)).toBe(false)
  })

  it('defaults its clock to now, so callers need not pass one', async () => {
    const header = await sign(PAYLOAD, Math.floor(Date.now() / 1000))
    expect(await verifyStripeSignature(PAYLOAD, header, SECRET)).toBe(true)
  })
})
