// test/unit/sigv4.test.ts
//
// AWS Signature Version 4 as functions/utils/mail/sigv4.ts writes it, held
// to AWS's own published values: the key derivation example of AWS's
// signing guide, and the get-vanilla and post-vanilla requests of AWS's
// Signature Version 4 test suite. Each value was worked out again apart
// from the signer while WS16 was planned, and is worked out here once more
// with node:crypto, so the signer is never its own witness.
//
// AKIDEXAMPLE, the secret wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY and the
// host example.amazonaws.com are AWS's own documentation values, each of
// which opens nothing, so a reader or a scanner that meets them here can
// pass on.
// Nothing here makes a request.
import { createHash, createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  amzDate, canonicalPath, canonicalRequest, deriveSigningKey, heldSigningScopes, signAwsRequest, uriEncode, type AwsSigningArgs,
} from '../../functions/utils/mail/sigv4'

const ROOT = resolve(__dirname, '../..')

/** AWS's documentation key: its example key id and secret, which open nothing. */
const KEY_ID = 'AKIDEXAMPLE'
const SECRET = 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY'

/** The test suite's requests: 20150830T123600Z, us-east-1, the service 'service', host example.amazonaws.com, no body. */
const VANILLA: Omit<AwsSigningArgs, 'method'> = {
  url: 'https://example.amazonaws.com/',
  headers: {},
  body: '',
  region: 'us-east-1',
  service: 'service',
  accessKeyId: KEY_ID,
  secretAccessKey: SECRET,
  now: new Date('2015-08-30T12:36:00Z'),
}

const sha256 = (text: string | Buffer) => createHash('sha256').update(text).digest('hex')

/** The signing key worked out with node:crypto alone, apart from the signer: four HMAC-SHA256 steps from "AWS4" and the secret. */
function nodeSigningKey(secret: string, date: string, region: string, service: string): Buffer {
  let key: Buffer = createHmac('sha256', `AWS4${secret}`).update(date).digest()
  for (const part of [region, service, 'aws4_request']) key = createHmac('sha256', key).update(part).digest()
  return key
}

/** Signature Version 4 worked out with node:crypto alone, apart from the signer, for a request already made canonical. */
function nodeSignature(canonical: string, time: string, scope: string, secret: string): string {
  const [date, region, service] = scope.split('/')
  const key = nodeSigningKey(secret, date, region, service)
  return createHmac('sha256', key).update(['AWS4-HMAC-SHA256', time, scope, sha256(canonical)].join('\n')).digest('hex')
}

/** A vanilla request of the test suite made canonical by hand from the suite's own text, not by the signer. */
const vanillaCanonical = (method: 'GET' | 'POST') =>
  [method, '/', '', 'host:example.amazonaws.com\nx-amz-date:20150830T123600Z\n', 'host;x-amz-date', sha256('')].join('\n')
const VANILLA_SCOPE = '20150830/us-east-1/service/aws4_request'

const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex')

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AWS\'s published values', () => {
  it('derives the signing key of the guide\'s example: 20120215, us-east-1, iam', async () => {
    expect(hex(await deriveSigningKey(SECRET, '20120215', 'us-east-1', 'iam'))).toBe('f4780e2d9f65fa895f9c67b32ce1baf0b0d8a43505a000a1a9e090d414db404d')
    expect(nodeSigningKey(SECRET, '20120215', 'us-east-1', 'iam').toString('hex')).toBe('f4780e2d9f65fa895f9c67b32ce1baf0b0d8a43505a000a1a9e090d414db404d')
  })

  it('signs the test suite\'s get-vanilla request to its published Authorization header', async () => {
    const headers = await signAwsRequest({ ...VANILLA, method: 'GET' })
    expect(headers.authorization).toBe(
      'AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, SignedHeaders=host;x-amz-date, Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31',
    )
    expect(headers['x-amz-date']).toBe('20150830T123600Z')
    expect(nodeSignature(vanillaCanonical('GET'), '20150830T123600Z', VANILLA_SCOPE, SECRET)).toBe('5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31')
  })

  it('signs the test suite\'s post-vanilla request to its published signature', async () => {
    const headers = await signAwsRequest({ ...VANILLA, method: 'POST' })
    expect(headers.authorization).toMatch(/, Signature=5da7c1a2acd57cee7505fc6676e4e544621c30862966e37dddb68e92efbe5d6b$/)
    expect(nodeSignature(vanillaCanonical('POST'), '20150830T123600Z', VANILLA_SCOPE, SECRET)).toBe('5da7c1a2acd57cee7505fc6676e4e544621c30862966e37dddb68e92efbe5d6b')
  })

  it('writes get-vanilla\'s canonical request as the test suite gives it, line by line', async () => {
    const { text, signed } = await canonicalRequest({ ...VANILLA, method: 'GET' })
    expect(text.split('\n')).toEqual(['GET', '/', '', 'host:example.amazonaws.com', 'x-amz-date:20150830T123600Z', '', 'host;x-amz-date', sha256('')])
    expect(signed).toBe('host;x-amz-date')
  })
})

describe('a request shaped as Amazon SES\'s SendEmail', () => {
  const body = '{"FromEmailAddress":"Sample Sender <sender@example.org>","Destination":{"ToAddresses":["player.one@example.org"]}}'
  const args: AwsSigningArgs = {
    method: 'POST',
    url: 'https://email.us-east-1.amazonaws.com/v2/email/outbound-emails',
    headers: { 'Content-Type': '  application/json  ' },
    body,
    region: 'us-east-1',
    service: 'ses',
    accessKeyId: KEY_ID,
    secretAccessKey: SECRET,
    now: new Date('2026-11-10T12:00:00Z'),
  }

  it('writes its canonical request line by line: the method, the path, the empty query, three headers, their names and the body\'s hash', async () => {
    const { text } = await canonicalRequest(args)
    expect(text.split('\n')).toEqual([
      'POST',
      '/v2/email/outbound-emails',
      '',
      'content-type:application/json',
      'host:email.us-east-1.amazonaws.com',
      'x-amz-date:20261110T120000Z',
      '',
      'content-type;host;x-amz-date',
      sha256(body),
    ])
  })

  it('answers exactly the headers to send, the ones given as signed, x-amz-date and authorization, and the signature node:crypto works out', async () => {
    const headers = await signAwsRequest(args)
    expect(Object.keys(headers).sort()).toEqual(['authorization', 'content-type', 'x-amz-date'])
    expect(headers['content-type']).toBe('application/json')
    expect(headers['x-amz-date']).toBe('20261110T120000Z')
    const { text } = await canonicalRequest(args)
    const expected = nodeSignature(text, '20261110T120000Z', '20261110/us-east-1/ses/aws4_request', SECRET)
    expect(headers.authorization).toBe(
      `AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20261110/us-east-1/ses/aws4_request, SignedHeaders=content-type;host;x-amz-date, Signature=${expected}`,
    )
  })

  it('hashes the body as its UTF-8 bytes, so a half sign and an accented letter sign as Amazon reads them', async () => {
    const words = '{"Subject":"Sample newsletter ½","Name":"Renée Example"}'
    const { text } = await canonicalRequest({ ...args, body: words })
    expect(text.split('\n').at(-1)).toBe(sha256(Buffer.from(words, 'utf8')))
    expect(text.split('\n').at(-1)).not.toBe(sha256(Buffer.from(words, 'latin1')))
  })

  it('writes the time as AWS writes it, in UTC to the second, with no milliseconds', () => {
    expect(amzDate(new Date('2026-11-10T12:00:00.987Z'))).toBe('20261110T120000Z')
    expect(amzDate(new Date('2026-01-02T03:04:05Z'))).toBe('20260102T030405Z')
  })
})

describe('the path and AWS\'s UriEncode', () => {
  it('writes a space as %20, a slash inside a segment as %2F, keeps a tilde, and writes every other byte in capital hex', () => {
    expect(uriEncode('a space')).toBe('a%20space')
    expect(uriEncode('one/segment')).toBe('one%2Fsegment')
    expect(uriEncode('~tilde')).toBe('~tilde')
    expect(uriEncode('AZaz09-._~')).toBe('AZaz09-._~')
    expect(uriEncode('+=&?#%')).toBe('%2B%3D%26%3F%23%25')
    expect(uriEncode('Renée')).toBe('Ren%C3%A9e')
  })

  it('keeps the slashes between segments and encodes each segment of the path the request carries', () => {
    expect(canonicalPath(new URL('https://example.amazonaws.com/v2/email/outbound-emails'))).toBe('/v2/email/outbound-emails')
    expect(canonicalPath(new URL('https://example.amazonaws.com/'))).toBe('/')
    expect(canonicalPath(new URL('https://example.amazonaws.com/~a/b'))).toBe('/~a/b')
    // The path as the request carries it already writes a space as %20; its percent sign is encoded again.
    expect(canonicalPath(new URL('https://example.amazonaws.com/a b/c%2Fd'))).toBe('/a%2520b/c%252Fd')
  })

  it('refuses a query string and a header the signer writes itself, with words that hold no key', async () => {
    const base: AwsSigningArgs = { ...VANILLA, method: 'GET' }
    for (const [what, attempt] of [
      ['a query string', signAwsRequest({ ...base, url: 'https://example.amazonaws.com/?Action=Send' })],
      ['a host header', signAwsRequest({ ...base, headers: { Host: 'example.amazonaws.com' } })],
      ['an x-amz-date header', signAwsRequest({ ...base, headers: { 'X-Amz-Date': '20150830T123600Z' } })],
      ['an authorization header', signAwsRequest({ ...base, headers: { Authorization: 'none' } })],
    ] as const) {
      const thrown = await attempt.then(() => null, (err: Error) => err.message)
      expect(thrown, what).not.toBeNull()
      expect(thrown, what).not.toContain(SECRET)
    }
  })
})

describe('the signing key kept for the isolate\'s life', () => {
  it('is derived once for a key id, a day, a region and a service, and kept by those four alone, never by the secret', async () => {
    const sign = vi.spyOn(crypto.subtle, 'sign')
    const args: AwsSigningArgs = { ...VANILLA, method: 'GET', now: new Date('2015-09-01T08:00:00Z') }
    const first = await signAwsRequest(args)
    // Four steps of the key and the signature.
    expect(sign).toHaveBeenCalledTimes(5)
    const second = await signAwsRequest({ ...args, now: new Date('2015-09-01T08:00:01Z') })
    // The same scope: the kept key and one step, the signature.
    expect(sign).toHaveBeenCalledTimes(6)
    expect(second.authorization).not.toBe(first.authorization)
    const scopes = heldSigningScopes()
    expect(scopes).toContain('AKIDEXAMPLE/20150901/us-east-1/service')
    for (const scope of scopes) expect(scope).not.toContain(SECRET)
    expect(JSON.stringify(scopes)).not.toMatch(/EXAMPLEKEY/)
  })

  it('derives the key again for another day, so a signature never uses yesterday\'s key', async () => {
    const day = await signAwsRequest({ ...VANILLA, method: 'GET', now: new Date('2015-09-02T08:00:00Z') })
    expect(day.authorization).toContain('Credential=AKIDEXAMPLE/20150902/us-east-1/service/aws4_request')
    const { text } = await canonicalRequest({ ...VANILLA, method: 'GET', now: new Date('2015-09-02T08:00:00Z') })
    expect(day.authorization).toMatch(new RegExp(`Signature=${nodeSignature(text, '20150902T080000Z', '20150902/us-east-1/service/aws4_request', SECRET)}$`))
  })
})

describe('the signer\'s file', () => {
  const text = readFileSync(join(ROOT, 'functions/utils/mail/sigv4.ts'), 'utf8')

  it('imports nothing and reads no setting, so it is Web Crypto alone and the worker bundles it with no package', () => {
    expect(text).not.toMatch(/^\s*import\b/m)
    expect(text).not.toMatch(/\brequire\(|process\.|import\.meta|\benv\b/)
    expect(text).toMatch(/crypto\.subtle\.digest/)
    expect(text).toMatch(/crypto\.subtle\.sign/)
  })

  it('names no mail service\'s address, so only the two transports do', () => {
    expect(text).not.toMatch(/amazonaws\.com|api\.resend\.com/)
  })
})
