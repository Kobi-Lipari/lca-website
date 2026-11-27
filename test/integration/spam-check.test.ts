// test/integration/spam-check.test.ts
//
// The spam check (functions/utils/spamCheck.ts, WS09 step 25) in the Workers
// runtime, against the harness's catch point for the provider's siteverify
// address and its knob: pass, fail and no answer. It passes only on the
// provider's success, refuses in words otherwise, and sends the secret and
// the token alone, nothing of the visitor. The secret is made up and written
// here, and the address is from a range set aside for documentation.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CANT_SEND_NOW, SPAM_CHECK_TIMEOUT_MS, checkSpam } from '../../functions/utils/spamCheck'
import { resetHarness, spamCheckBehavior, spamCheckRequests } from './harness'

const SECRET = 'example-made-up-spam-check-secret-0002'
const visitor = () => new Request('https://lca-website.pages.dev/api/example', { method: 'POST', headers: { 'CF-Connecting-IP': '203.0.113.60' } })

beforeEach(() => {
  resetHarness()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('checkSpam against the harness\'s siteverify catch point', () => {
  it('pass: the provider\'s success passes, and only the secret and the token went out', async () => {
    spamCheckBehavior.answer = 'pass'
    expect(await checkSpam({ TURNSTILE_SECRET_KEY: SECRET }, 'example-token', visitor())).toEqual({ ok: true })
    expect(spamCheckRequests).toEqual([{ secret: SECRET, response: 'example-token' }])
    expect(JSON.stringify(spamCheckRequests)).not.toContain('203.0.113')
  })

  it('fail: the provider\'s no refuses in words', async () => {
    spamCheckBehavior.answer = 'fail'
    expect(await checkSpam({ TURNSTILE_SECRET_KEY: SECRET }, 'example-token', visitor())).toEqual({ ok: false, status: 403, error: CANT_SEND_NOW })
    expect(spamCheckRequests).toHaveLength(1)
  })

  it('no answer: the check gives up at five seconds and refuses in words', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    spamCheckBehavior.answer = 'none'
    const check = checkSpam({ TURNSTILE_SECRET_KEY: SECRET }, 'example-token', visitor())
    await vi.advanceTimersByTimeAsync(SPAM_CHECK_TIMEOUT_MS)
    expect(await check).toEqual({ ok: false, status: 503, error: CANT_SEND_NOW })
    expect(spamCheckRequests).toHaveLength(1)
  })

  it('no secret: refuses in words and the provider is never asked', async () => {
    expect(await checkSpam({}, 'example-token', visitor())).toEqual({ ok: false, status: 503, error: CANT_SEND_NOW })
    expect(spamCheckRequests).toEqual([])
  })
})
