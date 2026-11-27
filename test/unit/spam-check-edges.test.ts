// test/unit/spam-check-edges.test.ts
//
// The edges of the spam check on the server (functions/utils/spamCheck.ts,
// WS09 step 25) that test/unit/spam-check.test.ts leaves, with the provider's
// address answered by a stub of fetch: a token at the longest length the
// provider issues, answers that parse but say nothing, a token the provider
// has already seen (each call asks afresh; nothing is remembered), calls
// made together, no timer or listener left behind however the check ends,
// the secret read at each call, and a refusal that holds the words alone.
// The two secrets in quotes are the provider's published test secrets, public
// values of its documentation; the other values are made up.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CANT_SEND_NOW, MAX_TOKEN_LENGTH, SPAM_CHECK_TIMEOUT_MS, checkSpam } from '../../functions/utils/spamCheck'

const TEST_SECRET_PASSES = '1x0000000000000000000000000000000AA'
const TEST_SECRET_FAILS = '2x0000000000000000000000000000000AA'
const TEST_SECRET_SPENT = '3x0000000000000000000000000000000AA'
const SECRET = 'example-made-up-spam-check-secret-0003'
const visitor = () => new Request('https://lca-website.pages.dev/api/example', { method: 'POST', headers: { 'CF-Connecting-IP': '192.0.2.70' } })
const refused = (status: 403 | 503) => ({ ok: false, status, error: CANT_SEND_NOW })

let asked: Array<{ secret: string; response: string }> = []
let reply: (secret: string, token: string) => Response | Promise<Response> = () => Response.json({ success: true })

beforeEach(() => {
  asked = []
  reply = () => Response.json({ success: true })
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit = {}) => {
    const fields = Object.fromEntries(new URLSearchParams(String(init.body ?? ''))) as { secret: string; response: string }
    asked.push(fields)
    return reply(fields.secret, fields.response)
  }))
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('the token', () => {
  it('one of exactly the longest length is asked of the provider whole, and one character more is refused unasked', async () => {
    const longest = 'a'.repeat(MAX_TOKEN_LENGTH)
    expect(await checkSpam({ TURNSTILE_SECRET_KEY: SECRET }, longest, visitor())).toEqual({ ok: true })
    expect(asked).toHaveLength(1)
    expect(asked[0].response).toBe(longest)
    expect(await checkSpam({ TURNSTILE_SECRET_KEY: SECRET }, `${longest}a`, visitor())).toEqual(refused(403))
    expect(asked).toHaveLength(1)
    expect(MAX_TOKEN_LENGTH).toBe(2048)
  })

  it('a token with characters a form body must escape reaches the provider as it was sent', async () => {
    const odd = 'a b&c=d+e%f/g?h#i'
    await checkSpam({ TURNSTILE_SECRET_KEY: SECRET }, odd, visitor())
    expect(asked).toEqual([{ secret: SECRET, response: odd }])
  })

  it('an object, an array or a boolean in the token\'s place is a missing token', async () => {
    for (const token of [{}, [], ['a'], true, false, 0]) expect(await checkSpam({ TURNSTILE_SECRET_KEY: SECRET }, token, visitor())).toEqual(refused(403))
    expect(asked).toEqual([])
  })
})

describe('an answer that parses but does not say success', () => {
  it('null, a string, a number, an empty object and success left out each refuse with the 503, never a pass', async () => {
    for (const body of ['null', '"success"', '1', '{}', '{"error-codes":[]}', '{"success":null}', '{"success":"yes"}', '[true]']) {
      reply = () => new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } })
      const answer = await checkSpam({ TURNSTILE_SECRET_KEY: SECRET }, 'example-token', visitor())
      expect(answer, body).toEqual(refused(503))
    }
  })

  it('a success of false with no error codes, with codes, or with a code the check has never seen is the 403', async () => {
    for (const body of [{ success: false }, { success: false, 'error-codes': [] }, { success: false, 'error-codes': ['example-code-never-seen'] }, { success: false, 'error-codes': ['invalid-input-secret'] }]) {
      reply = () => Response.json(body)
      expect(await checkSpam({ TURNSTILE_SECRET_KEY: SECRET }, 'example-token', visitor()), JSON.stringify(body)).toEqual(refused(403))
    }
  })

  it('a pass is the provider\'s success and nothing more: other fields in the answer neither add to it nor take from it', async () => {
    reply = () => Response.json({ success: true, 'error-codes': [], challenge_ts: '2026-11-17T15:00:00Z', hostname: 'example.org', action: 'example', cdata: 'example' })
    expect(await checkSpam({ TURNSTILE_SECRET_KEY: SECRET }, 'example-token', visitor())).toEqual({ ok: true })
  })

  it('a redirect, a 4xx and a 5xx from the provider are refusals even when their body says success', async () => {
    for (const status of [201, 301, 400, 403, 404, 500, 502, 503]) {
      reply = () => new Response(JSON.stringify({ success: true }), { status })
      expect((await checkSpam({ TURNSTILE_SECRET_KEY: SECRET }, 'example-token', visitor())).ok, String(status)).toBe(false)
    }
  })
})

describe('a token the provider has seen before', () => {
  it('is asked of the provider each time: nothing is remembered, so a spent token is refused on the second try', async () => {
    const spent = new Set<string>()
    reply = (_secret, token) => {
      const duplicate = spent.has(token)
      spent.add(token)
      return Response.json(duplicate ? { success: false, 'error-codes': ['timeout-or-duplicate'] } : { success: true })
    }
    expect(await checkSpam({ TURNSTILE_SECRET_KEY: SECRET }, 'example-token', visitor())).toEqual({ ok: true })
    expect(await checkSpam({ TURNSTILE_SECRET_KEY: SECRET }, 'example-token', visitor())).toEqual(refused(403))
    expect(await checkSpam({ TURNSTILE_SECRET_KEY: SECRET }, 'example-other-token', visitor())).toEqual({ ok: true })
    expect(asked).toHaveLength(3)
  })

  it('made together, each call is its own question and the provider\'s one yes is the only pass', async () => {
    const spent = new Set<string>()
    reply = (_secret, token) => {
      const duplicate = spent.has(token)
      spent.add(token)
      return Response.json({ success: !duplicate })
    }
    const answers = await Promise.all(Array.from({ length: 6 }, () => checkSpam({ TURNSTILE_SECRET_KEY: SECRET }, 'example-token', visitor())))
    expect(answers.filter((a) => a.ok)).toHaveLength(1)
    expect(answers.filter((a) => !a.ok && a.status === 403)).toHaveLength(5)
    expect(asked).toHaveLength(6)
  })

  it('the provider\'s three published test secrets give a pass, a no and a spent token, and none is passed without being asked', async () => {
    reply = (secret) => {
      if (secret === TEST_SECRET_PASSES) return Response.json({ success: true })
      if (secret === TEST_SECRET_FAILS) return Response.json({ success: false, 'error-codes': ['invalid-input-response'] })
      return Response.json({ success: false, 'error-codes': ['timeout-or-duplicate'] })
    }
    expect(await checkSpam({ TURNSTILE_SECRET_KEY: TEST_SECRET_PASSES }, 'XXXX.DUMMY.TOKEN.XXXX', visitor())).toEqual({ ok: true })
    expect(await checkSpam({ TURNSTILE_SECRET_KEY: TEST_SECRET_FAILS }, 'XXXX.DUMMY.TOKEN.XXXX', visitor())).toEqual(refused(403))
    expect(await checkSpam({ TURNSTILE_SECRET_KEY: TEST_SECRET_SPENT }, 'XXXX.DUMMY.TOKEN.XXXX', visitor())).toEqual(refused(403))
    expect(asked.map((a) => a.secret)).toEqual([TEST_SECRET_PASSES, TEST_SECRET_FAILS, TEST_SECRET_SPENT])
  })

  it('a test secret with no token is refused unasked, like any other secret', async () => {
    expect(await checkSpam({ TURNSTILE_SECRET_KEY: TEST_SECRET_PASSES }, undefined, visitor())).toEqual(refused(403))
    expect(asked).toEqual([])
  })
})

describe('nothing is left behind', () => {
  it('no timer is left running after a pass, a refusal or a network failure', async () => {
    vi.useFakeTimers()
    for (const make of [() => Response.json({ success: true }), () => Response.json({ success: false }), () => { throw new Error('network down') }]) {
      reply = make
      await checkSpam({ TURNSTILE_SECRET_KEY: SECRET }, 'example-token', visitor())
      expect(vi.getTimerCount()).toBe(0)
    }
  })

  it('the listener on the visitor\'s request is taken off again, however the check ends', async () => {
    for (const make of [() => Response.json({ success: true }), () => Response.json({ success: false }), () => { throw new Error('network down') }]) {
      reply = make
      const added: unknown[] = []
      const removed: unknown[] = []
      const request = { signal: { addEventListener: (_: string, fn: unknown) => { added.push(fn) }, removeEventListener: (_: string, fn: unknown) => { removed.push(fn) } } } as unknown as Request
      await checkSpam({ TURNSTILE_SECRET_KEY: SECRET }, 'example-token', request)
      expect(added).toHaveLength(1)
      expect(removed).toEqual(added)
    }
  })

  it('a request with no signal at all is checked as any other', async () => {
    expect(await checkSpam({ TURNSTILE_SECRET_KEY: SECRET }, 'example-token', {} as Request)).toEqual({ ok: true })
  })

  it('after the five seconds a late answer changes nothing: the refusal stands', async () => {
    vi.useFakeTimers()
    let late!: (r: Response) => void
    vi.stubGlobal('fetch', vi.fn((_u: string, init: RequestInit = {}) => new Promise<Response>((resolve, reject) => {
      late = resolve
      init.signal?.addEventListener('abort', () => reject(new Error('aborted')))
    })))
    const check = checkSpam({ TURNSTILE_SECRET_KEY: SECRET }, 'example-token', visitor())
    await vi.advanceTimersByTimeAsync(SPAM_CHECK_TIMEOUT_MS)
    late(Response.json({ success: true }))
    expect(await check).toEqual(refused(503))
  })
})

describe('the secret and the words', () => {
  it('the secret is read at each call: one removed after a pass is a refusal on the next, with nothing asked', async () => {
    const live: { TURNSTILE_SECRET_KEY?: string } = { TURNSTILE_SECRET_KEY: SECRET }
    expect(await checkSpam(live, 'example-token', visitor())).toEqual({ ok: true })
    live.TURNSTILE_SECRET_KEY = undefined
    expect(await checkSpam(live, 'example-token', visitor())).toEqual(refused(503))
    live.TURNSTILE_SECRET_KEY = TEST_SECRET_PASSES
    expect(await checkSpam(live, 'example-token', visitor())).toEqual({ ok: true })
    expect(asked.map((a) => a.secret)).toEqual([SECRET, TEST_SECRET_PASSES])
  })

  it('every refusal holds the one sentence and nothing else: not the secret, the token, the address or the provider\'s codes', async () => {
    const outcomes = [
      await checkSpam({}, 'example-token', visitor()),
      await checkSpam({ TURNSTILE_SECRET_KEY: SECRET }, undefined, visitor()),
    ]
    reply = () => Response.json({ success: false, 'error-codes': ['invalid-input-secret'] })
    outcomes.push(await checkSpam({ TURNSTILE_SECRET_KEY: SECRET }, 'example-token', visitor()))
    reply = () => { throw new Error(`down ${SECRET} example-token`) }
    outcomes.push(await checkSpam({ TURNSTILE_SECRET_KEY: SECRET }, 'example-token', visitor()))
    for (const outcome of outcomes) {
      expect(Object.keys(outcome).sort()).toEqual(['error', 'ok', 'status'])
      expect(outcome).toMatchObject({ ok: false, error: CANT_SEND_NOW })
      const text = JSON.stringify(outcome)
      for (const piece of [SECRET, 'example-token', '192.0.2', 'invalid-input', 'cloudflare', 'turnstile']) expect(text, piece).not.toContain(piece)
    }
    expect(CANT_SEND_NOW).not.toMatch(new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`))
  })
})
