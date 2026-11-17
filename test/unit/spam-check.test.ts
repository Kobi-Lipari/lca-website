// test/unit/spam-check.test.ts
//
// The spam check on the server (functions/utils/spamCheck.ts, WS09 step 25),
// with the provider's address answered by a stub of fetch: it passes only on
// the provider's success, and refuses in words on a failure, a timeout, an
// answer that cannot be read, a network failure, a missing token and a
// missing secret; the provider's own published test secret is the one
// exception, a secret like any other that the provider answers. It sends the
// secret and the token and nothing of the visitor, and logs nothing. The
// secrets in quotes below are the provider's published test secrets, public
// values of its documentation; the other values are made up.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CANT_SEND_NOW, MAX_TOKEN_LENGTH, SITEVERIFY_URL, SPAM_CHECK_TIMEOUT_MS, checkSpam } from '../../functions/utils/spamCheck'

/** The provider's published test secrets: one it always passes, one it always fails. */
const TEST_SECRET_PASSES = '1x0000000000000000000000000000000AA'
const TEST_SECRET_FAILS = '2x0000000000000000000000000000000AA'
/** The token the provider's test site keys hand out. */
const DUMMY_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX'
const MADE_UP_SECRET = 'example-made-up-spam-check-secret-0001'

const visitor = () =>
  new Request('https://lca-website.pages.dev/api/example', {
    method: 'POST',
    headers: { 'CF-Connecting-IP': '192.0.2.50', 'X-Forwarded-For': '192.0.2.51', 'User-Agent': 'Example Browser' },
  })

type Sent = { url: string; method: string; fields: Record<string, string>; headers: Record<string, string> }
let sent: Sent[] = []
let answer: (secret: string) => Response | Promise<Response> = () => Response.json({ success: true, 'error-codes': [] })

beforeEach(() => {
  sent = []
  answer = () => Response.json({ success: true, 'error-codes': [] })
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
    const fields = Object.fromEntries(new URLSearchParams(String(init.body ?? '')))
    sent.push({ url, method: init.method ?? 'GET', fields, headers: Object.fromEntries(new Headers(init.headers).entries()) })
    if (init.signal?.aborted) throw new Error('aborted')
    return answer(fields.secret)
  }))
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const refused = (status: 403 | 503) => ({ ok: false, status, error: CANT_SEND_NOW })

describe('checkSpam(env, token, request)', () => {
  it('passes only on the provider\'s success, posting the secret and the token to its siteverify address', async () => {
    expect(await checkSpam({ TURNSTILE_SECRET_KEY: MADE_UP_SECRET }, 'example-token', visitor())).toEqual({ ok: true })
    expect(sent).toEqual([{ url: SITEVERIFY_URL, method: 'POST', fields: { secret: MADE_UP_SECRET, response: 'example-token' }, headers: {} }])
    expect(SITEVERIFY_URL).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify')
    // Anything but a true success is no pass.
    for (const body of [{ success: 'true' }, { success: 1 }, {}, []]) {
      answer = () => Response.json(body)
      expect((await checkSpam({ TURNSTILE_SECRET_KEY: MADE_UP_SECRET }, 'example-token', visitor())).ok, JSON.stringify(body)).toBe(false)
    }
  })

  it('a failure the provider gives refuses in words', async () => {
    answer = () => Response.json({ success: false, 'error-codes': ['invalid-input-response'] })
    expect(await checkSpam({ TURNSTILE_SECRET_KEY: MADE_UP_SECRET }, 'example-token', visitor())).toEqual(refused(403))
    answer = () => Response.json({ success: false, 'error-codes': ['timeout-or-duplicate'] })
    expect(await checkSpam({ TURNSTILE_SECRET_KEY: MADE_UP_SECRET }, 'example-token', visitor())).toEqual(refused(403))
    expect(CANT_SEND_NOW).toBe('We can\'t send this right now.')
  })

  it('a timeout refuses in words, at five seconds and not before', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit = {}) => new Promise<Response>((_, reject) => {
      init.signal?.addEventListener('abort', () => reject(new Error('aborted')))
    })))
    let settled: unknown = 'waiting'
    const check = checkSpam({ TURNSTILE_SECRET_KEY: MADE_UP_SECRET }, 'example-token', visitor()).then((a) => { settled = a })
    await vi.advanceTimersByTimeAsync(SPAM_CHECK_TIMEOUT_MS - 1)
    expect(settled).toBe('waiting')
    await vi.advanceTimersByTimeAsync(1)
    await check
    expect(settled).toEqual(refused(503))
    expect(SPAM_CHECK_TIMEOUT_MS).toBe(5000)
  })

  it('an answer that cannot be read, a status that is not 200 and a network failure each refuse in words', async () => {
    for (const make of [
      () => new Response('<html>not json</html>', { status: 200 }),
      () => new Response('', { status: 200 }),
      () => Response.json({ success: true }, { status: 500 }),
      () => Response.json({ success: true }, { status: 429 }),
      () => { throw new Error('network down') },
    ]) {
      answer = make
      expect(await checkSpam({ TURNSTILE_SECRET_KEY: MADE_UP_SECRET }, 'example-token', visitor())).toEqual(refused(503))
    }
  })

  it('a missing token refuses in words and asks nothing', async () => {
    for (const token of [undefined, null, '', '   ', 42, 'x'.repeat(MAX_TOKEN_LENGTH + 1)]) {
      expect(await checkSpam({ TURNSTILE_SECRET_KEY: MADE_UP_SECRET }, token, visitor()), String(token).slice(0, 12)).toEqual(refused(403))
    }
    expect(sent).toEqual([])
  })

  it('no secret refuses in words and asks nothing, wherever it runs', async () => {
    for (const secret of [undefined, '', '   ']) {
      expect(await checkSpam({ TURNSTILE_SECRET_KEY: secret }, 'example-token', visitor()), String(secret)).toEqual(refused(503))
      expect(await checkSpam({ TURNSTILE_SECRET_KEY: secret }, DUMMY_TOKEN, visitor())).toEqual(refused(503))
    }
    expect(sent).toEqual([])
  })

  it('the provider\'s published test secret is the one exception: a secret like any other, answered by the provider', async () => {
    answer = (secret) => Response.json({ success: secret === TEST_SECRET_PASSES })
    expect(await checkSpam({ TURNSTILE_SECRET_KEY: TEST_SECRET_PASSES }, DUMMY_TOKEN, visitor())).toEqual({ ok: true })
    expect(await checkSpam({ TURNSTILE_SECRET_KEY: TEST_SECRET_FAILS }, DUMMY_TOKEN, visitor())).toEqual(refused(403))
    // Each was asked of the provider; neither passed without a request.
    expect(sent.map((s) => s.fields.secret)).toEqual([TEST_SECRET_PASSES, TEST_SECRET_FAILS])
  })

  it('sends nothing of the visitor: no address, no header of theirs, and only the two fields', async () => {
    await checkSpam({ TURNSTILE_SECRET_KEY: MADE_UP_SECRET }, 'example-token', visitor())
    expect(Object.keys(sent[0].fields).sort()).toEqual(['response', 'secret'])
    expect(JSON.stringify(sent)).not.toMatch(/192\.0\.2|remoteip|Example Browser/)
  })

  it('refuses when the visitor has gone before the answer comes', async () => {
    const controller = new AbortController()
    const request = new Request('https://lca-website.pages.dev/api/example', { method: 'POST', signal: controller.signal })
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit = {}) => new Promise<Response>((_, reject) => {
      init.signal?.addEventListener('abort', () => reject(new Error('aborted')))
    })))
    const check = checkSpam({ TURNSTILE_SECRET_KEY: MADE_UP_SECRET }, 'example-token', request)
    controller.abort()
    expect(await check).toEqual(refused(503))
  })

  it('logs nothing, whatever the answer', async () => {
    const lines = [vi.spyOn(console, 'log'), vi.spyOn(console, 'warn'), vi.spyOn(console, 'error'), vi.spyOn(console, 'info')]
    for (const make of [() => Response.json({ success: true }), () => Response.json({ success: false }), () => new Response('nope'), () => { throw new Error('down') }]) {
      answer = make
      await checkSpam({ TURNSTILE_SECRET_KEY: MADE_UP_SECRET }, 'example-token', visitor())
    }
    await checkSpam({}, 'example-token', visitor())
    for (const spy of lines) expect(spy).not.toHaveBeenCalled()
  })
})
