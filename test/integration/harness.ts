// test/integration/harness.ts
import { env } from 'cloudflare:test'
import type { Env } from '../../functions/types'

// ── Assertion surfaces ───────────────────────────────────────────

export interface SentEmail {
  to: string
  subject: string
  html: string
  text?: string
  from: string
}

export interface CreatedStripeSession {
  id: string
  url: string
  /** Flattened metadata[...] fields exactly as sent to Stripe */
  metadata: Record<string, string>
  amountCents: number
  productName: string
  clientReferenceId: string | null
}

/** Every email "sent" via Resend during the current test file. */
export const emailOutbox: SentEmail[] = []

/** Every Stripe Checkout Session "created" during the current test file. */
export const stripeSessions: CreatedStripeSession[] = []

/** Set false to simulate a Resend outage (sendEmail throws / trySendEmail false). */
export const emailBehavior = { succeed: true }

/** Set false to simulate Stripe being down (createCheckoutSession throws). */
export const stripeBehavior = { succeed: true }

export function resetHarness(): void {
  emailOutbox.length = 0
  stripeSessions.length = 0
  emailBehavior.succeed = true
  stripeBehavior.succeed = true
}

// ── Fetch interceptor ────────────────────────────────────────────
// One interceptor, three services. Everything else about the code under
// test runs for real: supabase-js builds a real /auth/v1/user request,
// createCheckoutSession builds a real Stripe form body, sendEmail builds
// a real Resend JSON body. We answer at the network edge only.

let installed = false
let sessionCounter = 0

export function installFetchInterceptor(): void {
  if (installed) return
  installed = true
  const realFetch = globalThis.fetch.bind(globalThis)

  globalThis.fetch = (async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const request = new Request(input as RequestInfo, init)
    const url = new URL(request.url)

    // Supabase auth: token convention is "Bearer <member_id>".
    // Tokens prefixed "invalid" are rejected, for negative tests.
    if (url.origin === 'https://test-supabase.local') {
      if (url.pathname === '/auth/v1/user') {
        const auth = request.headers.get('Authorization') ?? ''
        const token = auth.replace(/^Bearer\s+/i, '')
        if (!token || token.startsWith('invalid')) {
          return Response.json(
            { message: 'invalid token' },
            { status: 401 },
          )
        }
        return Response.json({
          id: token,
          aud: 'authenticated',
          role: 'authenticated',
          email: `${token}@test.lca`,
          user_metadata: { full_name: `Test User ${token}` },
          app_metadata: {},
          created_at: '2026-01-01T00:00:00Z',
        })
      }
      return Response.json({ message: 'not implemented in harness' }, { status: 500 })
    }

    // Stripe: capture Checkout Session creation.
    if (url.hostname === 'api.stripe.com') {
      if (!stripeBehavior.succeed) {
        return Response.json(
          { error: { message: 'harness: simulated Stripe outage' } },
          { status: 500 },
        )
      }
      if (url.pathname === '/v1/checkout/sessions' && request.method === 'POST') {
        const form = new URLSearchParams(await request.text())
        const metadata: Record<string, string> = {}
        for (const [key, value] of form.entries()) {
          const m = key.match(/^metadata\[(.+)\]$/)
          if (m) metadata[m[1]] = value
        }
        const id = `cs_test_${++sessionCounter}`
        const session: CreatedStripeSession = {
          id,
          url: `https://checkout.stripe.test/${id}`,
          metadata,
          amountCents: Number(
            form.get('line_items[0][price_data][unit_amount]') ?? 0,
          ),
          productName:
            form.get('line_items[0][price_data][product_data][name]') ?? '',
          clientReferenceId: form.get('client_reference_id'),
        }
        stripeSessions.push(session)
        return Response.json({ id: session.id, url: session.url })
      }
      return Response.json({ error: { message: 'not implemented' } }, { status: 400 })
    }

    // Resend: capture the outbox.
    if (url.hostname === 'api.resend.com') {
      if (!emailBehavior.succeed) {
        return Response.json(
          { message: 'harness: simulated Resend outage' },
          { status: 500 },
        )
      }
      const body = (await request.json()) as {
        from: string
        to: string[]
        subject: string
        html: string
        text?: string
      }
      emailOutbox.push({
        to: body.to[0],
        subject: body.subject,
        html: body.html,
        text: body.text,
        from: body.from,
      })
      return Response.json({ id: `email_${emailOutbox.length}` })
    }

    // Anything else (USCF lookups etc.): fail loudly so no test
    // silently depends on the live internet.
    return Promise.reject(
      new Error(`Unmocked external fetch in test: ${request.method} ${request.url}`),
    )
  }) as typeof fetch
}

// ── Handler invocation ───────────────────────────────────────────

type Handler = (context: EventContext<Env, string, unknown>) => Response | Promise<Response>

export interface InvokeOptions {
  method?: string
  /** URL params for [id]-style segments, e.g. { id: 't1' } */
  params?: Record<string, string>
  /** JSON body (objects) or raw string body */
  body?: unknown
  /** member id to act as (becomes "Bearer <id>"); omit for anonymous */
  as?: string
  path?: string
  headers?: Record<string, string>
  /** raw body string overrides `body` — used for webhook signature tests */
  rawBody?: string
}

export async function invoke(
  handler: Handler,
  options: InvokeOptions = {},
): Promise<{ status: number; json: () => Promise<any>; response: Response }> {
  const {
    method = 'GET',
    params = {},
    body,
    as,
    path = '/api/test',
    headers = {},
    rawBody,
  } = options

  const requestHeaders = new Headers(headers)
  if (as) requestHeaders.set('Authorization', `Bearer ${as}`)

  let requestBody: string | undefined
  if (rawBody !== undefined) {
    requestBody = rawBody
  } else if (body !== undefined) {
    requestBody = JSON.stringify(body)
    if (!requestHeaders.has('Content-Type')) {
      requestHeaders.set('Content-Type', 'application/json')
    }
  }

  const request = new Request(`https://lca-website.pages.dev${path}`, {
    method,
    headers: requestHeaders,
    body: requestBody,
  })

  const context = {
    request,
    env: env as unknown as Env,
    params,
    data: {},
    functionPath: path,
    waitUntil: () => {},
    passThroughOnException: () => {},
    next: async () => new Response(null, { status: 404 }),
  } as unknown as EventContext<Env, string, unknown>

  const response = await handler(context)
  return {
    status: response.status,
    json: () => response.clone().json(),
    response,
  }
}

// ── Stripe webhook signing (REAL HMAC — exercises verifyStripeSignature) ──

export async function signStripePayload(payload: string): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000)
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode('whsec_test_harness_secret'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${timestamp}.${payload}`),
  )
  const hex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return `t=${timestamp},v1=${hex}`
}