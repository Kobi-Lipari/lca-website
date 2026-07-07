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

// Verifies the `Stripe-Signature` header using Web Crypto (no Node crypto needed)
export async function verifyStripeSignature(
  payload: string,
  signatureHeader: string,
  webhookSecret: string
): Promise<boolean> {
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((part) => part.split('=') as [string, string])
  )
  const timestamp = parts['t']
  const signature = parts['v1']
  if (!timestamp || !signature) return false

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

  return expectedHex === signature
}