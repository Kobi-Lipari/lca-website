// test/integration/spam-check-no-signal.test.ts
//
// The harness's catch point for the spam check's provider (WS09 step 25), as
// WS09 step 26 mends it: its "no answer" knob waits until the caller gives
// up, and a caller that passes no signal, which could never give up, is
// refused at once rather than left waiting for ever. The check itself always
// passes a signal (functions/utils/spamCheck.ts), so no answer of the site's
// changes. The requests go to the harness, never off the machine.
import { beforeEach, describe, expect, it } from 'vitest'
import { SITEVERIFY_URL } from '../../functions/utils/spamCheck'
import { resetHarness, spamCheckBehavior, spamCheckRequests } from './harness'

beforeEach(resetHarness)

const ask = (init: RequestInit = {}) =>
  fetch(SITEVERIFY_URL, { method: 'POST', body: new URLSearchParams({ secret: 'example-made-up-secret', response: 'example-made-up-token' }), ...init })

describe('the spam check\'s "no answer" knob', () => {
  it('refuses at once a caller that passes no signal, and still waits for one that does until it gives up', async () => {
    spamCheckBehavior.answer = 'none'
    // No signal: refused at once, well inside the case's own time.
    const started = Date.now()
    await expect(ask()).rejects.toThrow('harness: the spam check gave up waiting')
    expect(Date.now() - started).toBeLessThan(1_000)
    // A signal already given up: refused at once too.
    await expect(ask({ signal: AbortSignal.abort() })).rejects.toThrow('harness: the spam check gave up waiting')
    // A signal: no answer until the caller gives up, then the refusal.
    const stop = new AbortController()
    let settled = false
    const waiting = ask({ signal: stop.signal }).finally(() => { settled = true })
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(settled).toBe(false)
    stop.abort()
    await expect(waiting).rejects.toThrow('harness: the spam check gave up waiting')
    expect(spamCheckRequests).toHaveLength(3)
  })
})
