export async function createCheckoutSession(
  secretKey: string,
  params: {
    productName: string
    amountUsd: number
    successUrl: string
    cancelUrl: string
    clientReferenceId: string
    metadata: Record<string, string>
  }
): Promise<{ id: string; url: string }> {
  const body = new URLSearchParams()
  body.set('mode', 'payment')
  body.set('success_url', params.successUrl)
  body.set('cancel_url', params.cancelUrl)
  body.set('client_reference_id', params.clientReferenceId)
  body.set('line_items[0][price_data][currency]', 'usd')
  body.set('line_items[0][price_data][product_data][name]', params.productName)
  body.set('line_items[0][price_data][unit_amount]', String(Math.round(params.amountUsd * 100)))
  body.set('line_items[0][quantity]', '1')

  for (const [key, value] of Object.entries(params.metadata)) {
    body.set(`metadata[${key}]`, value)
  }

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Stripe API error: ${errText}`)
  }

  return res.json()
}

/**
 * How old a signed payload may be, matching Stripe's own default tolerance.
 *
 * Without this the signature alone proves the body was signed at some point,
 * not that it was signed recently — so anyone who captures one delivery can
 * replay it forever, and every replay of a membership payment is another year
 * granted for free.
 */
const SIGNATURE_TOLERANCE_SECONDS = 300

/**
 * Compares two hex digests without leaking where they diverge.
 *
 * A plain `===` returns as soon as it finds a differing byte, so the time it
 * takes is a measurement of how much of the prefix was right — enough, over
 * many attempts, to reconstruct a valid signature a byte at a time. This
 * always walks the full length and folds every difference into one accumulator.
 */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// Verifies the `Stripe-Signature` header using Web Crypto (no Node crypto needed)
export interface RetrievedCheckoutSession {
  payment_status: 'paid' | 'unpaid' | 'no_payment_required'
  payment_intent: string | null
}

/**
 * The source of truth for whether a checkout was actually paid.
 *
 * Everything else in this codebase learns that from a webhook, which is fine
 * until the webhook does not arrive — at which point nothing in the product
 * can tell the difference between "not paid" and "we were never told". This
 * asks.
 */
export async function retrieveCheckoutSession(
  secretKey: string,
  sessionId: string,
): Promise<RetrievedCheckoutSession | null> {
  const res = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
    { headers: { Authorization: `Bearer ${secretKey}` } },
  )
  if (!res.ok) return null

  const session = await res.json<{
    payment_status?: string
    payment_intent?: string | { id?: string } | null
  }>()

  const intent = session.payment_intent
  return {
    payment_status: (session.payment_status ?? 'unpaid') as RetrievedCheckoutSession['payment_status'],
    payment_intent: typeof intent === 'string' ? intent : intent?.id ?? null,
  }
}

export async function verifyStripeSignature(
  payload: string,
  signatureHeader: string,
  webhookSecret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): Promise<boolean> {
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((part) => part.split('=') as [string, string])
  )
  const timestamp = parts['t']
  const signature = parts['v1']
  if (!timestamp || !signature) return false

  // Reject stale and implausibly-future timestamps before spending a HMAC on
  // them. Math.abs covers clock skew in both directions.
  const signedAt = Number(timestamp)
  if (!Number.isFinite(signedAt)) return false
  if (Math.abs(nowSeconds - signedAt) > SIGNATURE_TOLERANCE_SECONDS) return false

  const signedPayload = `${timestamp}.${payload}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(webhookSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload))
  const expectedHex = [...new Uint8Array(sigBuffer)].map((b) => b.toString(16).padStart(2, '0')).join('')

  return timingSafeEqualHex(expectedHex, signature)
}