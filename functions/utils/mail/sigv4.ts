// functions/utils/mail/sigv4.ts
//
// AWS Signature Version 4 for one request, with Web Crypto alone and no
// import at all, so the site's functions and the daily-emails worker sign
// their own requests to Amazon SES (./ses) with no package. The steps are
// those of AWS's IAM user guide, "Create a signed AWS API request", read on
// Thursday, November 12, 2026:
// - the canonical request: the method; the path; the query string, empty
//   here, its line still written; the headers signed, each name lowercased,
//   in order of name, each value trimmed with its inner runs of spaces made
//   one, each line ending in a newline; the names signed, joined by
//   semicolons; and the hex SHA-256 of the body's UTF-8 bytes;
// - the string to sign: AWS4-HMAC-SHA256, the time, the scope
//   `${date}/${region}/${service}/aws4_request` and the hex SHA-256 of the
//   canonical request, joined by newlines;
// - the signing key: HMAC-SHA256 of the date under "AWS4" and the secret,
//   then of the region, the service and "aws4_request" in turn;
// - the Authorization header: the key id with the scope, the names signed
//   and the hex signature.
//
// The path is the one the request carries, each segment written with
// uriEncode below, so a percent sign already in it is encoded again, as
// AWS's own SDKs sign the path of every service but Amazon S3; the one path
// the site signs holds only letters, a digit, slashes and a hyphen, and
// reads the same either way. A query string, or a header the signer writes
// itself (host, x-amz-date, authorization), is refused rather than signed,
// since the site sends neither.
//
// The signing key depends on the secret, the day, the region and the
// service, so it is kept in a Map keyed by the key id, the day, the region
// and the service, and never by the secret, which is not kept anywhere, for
// the isolate's life or until the Map holds 32 scopes, when it starts again
// empty: an access key id has one secret, and a secret set anew starts a
// new deployment, whose isolates start with an empty Map.
// test/unit/sigv4.test.ts holds the signer to AWS's published values.

/** What one request to sign is: the parts AWS signs, the key, and the time it is signed at, read by the caller once. */
export interface AwsSigningArgs {
  method: string
  url: string
  /** The headers to sign beside host and x-amz-date, which the signer writes. */
  headers: Record<string, string>
  /** The body, as the one string that is sent. */
  body: string
  region: string
  service: string
  accessKeyId: string
  secretAccessKey: string
  now: Date
}

const ALGORITHM = 'AWS4-HMAC-SHA256'
const TERMINATOR = 'aws4_request'
const encoder = new TextEncoder()

/** The headers the signer writes itself, which a caller may not hand it. */
const WRITTEN_HERE = new Set(['host', 'x-amz-date', 'authorization'])

/** The bytes AWS's UriEncode keeps as they are: A to Z, a to z, 0 to 9, hyphen, period, underscore and tilde. */
const UNRESERVED = /^[A-Za-z0-9._~-]$/

/** How many scopes' signing keys an isolate keeps before it lets them all go and starts again. */
const HELD_SCOPES = 32

const signingKeys = new Map<string, Uint8Array>()

function hex(bytes: ArrayBuffer | Uint8Array): string {
  let out = ''
  for (const byte of new Uint8Array(bytes)) out += byte.toString(16).padStart(2, '0')
  return out
}

async function sha256Hex(text: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', encoder.encode(text)))
}

async function hmac(key: Uint8Array, text: string): Promise<Uint8Array> {
  const imported = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', imported, encoder.encode(text)))
}

/**
 * AWS's UriEncode: every UTF-8 byte but the unreserved characters written as %XX with capital hex letters, so a space is
 * %20 and never a plus sign, and a slash is %2F.
 */
export function uriEncode(text: string): string {
  let out = ''
  for (const byte of encoder.encode(text)) {
    const character = String.fromCharCode(byte)
    out += UNRESERVED.test(character) ? character : `%${byte.toString(16).toUpperCase().padStart(2, '0')}`
  }
  return out
}

/** The canonical path: the path as the request carries it, each segment between its slashes written with uriEncode. */
export function canonicalPath(url: URL): string {
  return url.pathname.split('/').map(uriEncode).join('/')
}

/** A header's value as it is signed and sent: trimmed, its inner runs of spaces made one. */
const canonicalValue = (value: string) => value.trim().replace(/\s+/g, ' ')

/** The time as AWS writes it in x-amz-date, such as 20261110T120000Z, in UTC and to the second. */
export function amzDate(now: Date): string {
  return now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

/** The signing key for one day, region and service: four HMAC-SHA256 steps from "AWS4" and the secret. Not kept. */
export async function deriveSigningKey(secretAccessKey: string, date: string, region: string, service: string): Promise<Uint8Array> {
  const dateKey = await hmac(encoder.encode(`AWS4${secretAccessKey}`), date)
  const regionKey = await hmac(dateKey, region)
  const serviceKey = await hmac(regionKey, service)
  return hmac(serviceKey, TERMINATOR)
}

/** The signing key for a scope, derived once and kept by the key id, the day, the region and the service. */
async function signingKeyFor(args: AwsSigningArgs, date: string): Promise<Uint8Array> {
  const scope = `${args.accessKeyId}/${date}/${args.region}/${args.service}`
  const kept = signingKeys.get(scope)
  if (kept) return kept
  const key = await deriveSigningKey(args.secretAccessKey, date, args.region, args.service)
  if (signingKeys.size >= HELD_SCOPES) signingKeys.clear()
  signingKeys.set(scope, key)
  return key
}

/** The scopes this isolate holds a signing key for, each the key id, the day, the region and the service; never a secret. */
export function heldSigningScopes(): string[] {
  return [...signingKeys.keys()]
}

/**
 * The canonical request and the names it signs, for the request as it will be sent: the headers given, lowercased, and
 * host and x-amz-date, each with its value as it is signed and sent.
 */
export async function canonicalRequest(args: AwsSigningArgs): Promise<{ text: string; signed: string; headers: Record<string, string> }> {
  const url = new URL(args.url)
  if (url.search !== '') throw new Error('This signer signs requests with no query string.')
  const headers: Record<string, string> = {}
  for (const [name, value] of Object.entries(args.headers)) {
    const lower = name.toLowerCase()
    if (WRITTEN_HERE.has(lower)) throw new Error(`The signer writes the ${lower} header itself.`)
    headers[lower] = canonicalValue(value)
  }
  headers['x-amz-date'] = amzDate(args.now)
  const signedHeaders: Record<string, string> = { ...headers, host: url.host }
  const names = Object.keys(signedHeaders).sort()
  const text = [
    args.method.toUpperCase(),
    canonicalPath(url),
    '',
    names.map((name) => `${name}:${signedHeaders[name]}\n`).join(''),
    names.join(';'),
    await sha256Hex(args.body),
  ].join('\n')
  return { text, signed: names.join(';'), headers }
}

/**
 * Signs one request and answers the headers to send with it: the ones given, their names lowercased and their values as
 * signed, x-amz-date and authorization. The host header is signed from the address and written by fetch.
 */
export async function signAwsRequest(args: AwsSigningArgs): Promise<Record<string, string>> {
  const { text, signed, headers } = await canonicalRequest(args)
  const time = headers['x-amz-date']
  const date = time.slice(0, 8)
  const scope = `${date}/${args.region}/${args.service}/${TERMINATOR}`
  const toSign = [ALGORITHM, time, scope, await sha256Hex(text)].join('\n')
  const signature = hex(await hmac(await signingKeyFor(args, date), toSign))
  return {
    ...headers,
    authorization: `${ALGORITHM} Credential=${args.accessKeyId}/${scope}, SignedHeaders=${signed}, Signature=${signature}`,
  }
}
