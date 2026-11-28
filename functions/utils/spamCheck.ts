// functions/utils/spamCheck.ts
//
// The spam check every public form will make before it acts, WS09's own
// (WS09 step 25). The form's page draws the provider's widget
// (src/areas/clubs/components/SpamCheck.tsx), which hands it a token; the
// form sends the token with its body, and the endpoint asks the provider
// whether it is good:
//
//   checkSpam(env, token, request)
//
// posts the secret and the token to the provider's siteverify address, as its
// documentation gives it, with a limit of five seconds, and answers
// { ok: true } only when the provider says success. Anything else refuses in
// words, { ok: false, status, error }, in production and everywhere else:
// - no secret bound (TURNSTILE_SECRET_KEY): 503, and no request is made;
// - no token, or one no token could be: 403, and no request is made;
// - the provider says no: 403;
// - no answer in five seconds, a network failure, a status that is not 200,
//   or an answer that cannot be read: 503.
// The one exception is the provider's own published test secret, which a
// computer with no real key binds: it is a secret like any other here, the
// request is made, and the provider answers success to its own test token.
// Nothing passes silently.
//
// Collect only what is needed: the visitor's network address is not sent,
// though the provider takes one as an option, and nothing about the visitor,
// the token or the provider's answer is logged. `request` is the visitor's
// own request: the check stops when the visitor has gone, and reads nothing
// else of it.
//
// The secret is read at each call.
import type { Env } from '../types'
import { CANT_SEND_NOW } from './rateLimit'

/** The words of every refusal, the limiter's own: the visitor can do nothing but try again, so each says the same. */
export { CANT_SEND_NOW }
/** The provider's address for checking a token on the server. */
export const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
/** How long the check waits for the provider. */
export const SPAM_CHECK_TIMEOUT_MS = 5_000
/** The longest token the provider issues is 2048 characters; a longer one is refused without asking. */
export const MAX_TOKEN_LENGTH = 2048

export type SpamAnswer = { ok: true } | { ok: false; status: 403 | 503; error: string }

type SpamEnv = Pick<Env, 'TURNSTILE_SECRET_KEY'>

const refuse = (status: 403 | 503): SpamAnswer => ({ ok: false, status, error: CANT_SEND_NOW })

/** Asks the provider whether the token the form sent is good, and answers whether the form may go on. */
export async function checkSpam(env: SpamEnv, token: unknown, request: Request): Promise<SpamAnswer> {
  const secret = env.TURNSTILE_SECRET_KEY
  if (typeof secret !== 'string' || secret.trim() === '') return refuse(503)
  if (typeof token !== 'string' || token.trim() === '' || token.length > MAX_TOKEN_LENGTH) return refuse(403)

  const stop = new AbortController()
  const timer = setTimeout(() => stop.abort(), SPAM_CHECK_TIMEOUT_MS)
  const gone = () => stop.abort()
  request.signal?.addEventListener('abort', gone)
  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      body: new URLSearchParams({ secret, response: token }),
      signal: stop.signal,
    })
    if (response.status !== 200) {
      // The answer is not read: let its body go, so the runtime holds nothing open.
      await response.body?.cancel().catch(() => undefined)
      return refuse(503)
    }
    let answer: unknown
    try {
      answer = await response.json()
    } catch {
      return refuse(503)
    }
    if (typeof answer !== 'object' || answer === null || typeof (answer as { success?: unknown }).success !== 'boolean') return refuse(503)
    return (answer as { success: boolean }).success === true ? { ok: true } : refuse(403)
  } catch {
    return refuse(503)
  } finally {
    clearTimeout(timer)
    request.signal?.removeEventListener('abort', gone)
  }
}
