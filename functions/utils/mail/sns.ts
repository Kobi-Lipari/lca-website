// functions/utils/mail/sns.ts
//
// The check of a message Amazon SNS posts to the receiver of Amazon's
// reports, functions/api/mail/ses-events.ts (WS16 step 8), with Web Crypto
// alone and no import at all, so it adds no package. A message is taken
// only once its signature verifies under the certificate it names, fetched
// over HTTPS from SNS's own host for the site's region.
//
// - stringToSign writes the fields SNS signs, by the message's type, each
//   as its name, a newline, its value and a newline, in the byte order of
//   the names, as AWS's pages and AWS's own example code write them.
// - certUrlAllowed and subscribeUrlAllowed hold an address to https, SNS's
//   host for the region exactly, no port, no user or password and no
//   fragment, and to reading the same once the URL parser has read it: an
//   upper-case host, an encoded dot, a default port, a backslash, dot
//   segments in the path and spaces around the address are each refused,
//   where a parser alone would read them as SNS's own host and path.
// - verifySnsMessage checks the version, the string to sign, the
//   signature's form and the certificate's address, each before anything is
//   fetched; then fetches the certificate, walks its DER to the public key,
//   and verifies the signature: version 1 is RSASSA-PKCS1-v1_5 with SHA-1,
//   version 2 the same with SHA-256 (AWS's example code names them
//   SHA1withRSA and SHA256withRSA, Java's names for these two).
// - The certificate's chain is not walked: a Worker holds no store of
//   certificates to walk it to. The trust rests on HTTPS to SNS's own host
//   for the region, which only Amazon can answer, and on the topic, which
//   the receiver checks before anything here runs.
// - A certificate that was fetched from the allowed host and could be read
//   is kept for the isolate's life, keyed by its address, at most
//   SNS_CERT_CACHE_MAX of them before the cache starts again empty, so no
//   stream of addresses can grow it; one that could not be fetched or read
//   is not kept.

/** The newest notification the receiver acts on: one whose signed Timestamp is no more than three hours old. */
export const SNS_MAX_AGE_MS = 3 * 60 * 60 * 1000

/**
 * The longest body the receiver reads: SNS's default limit for a message, 262,144 bytes (AWS's quotas page for SNS,
 * read on Thursday, November 12, 2026), which K's topic keeps. A report from Amazon SES is a few thousand bytes, its
 * headers cut at 10 KB, so the message around one is far below it.
 */
export const SNS_MAX_BODY_BYTES = 262_144

/** The longest certificate read: SNS's are about 2,000 bytes. A longer answer is read no further, and cannot be walked. */
export const SNS_MAX_CERT_BYTES = 16_384

/** How many certificates an isolate keeps before it lets them all go and starts again. */
export const SNS_CERT_CACHE_MAX = 4

/** A message as SNS posts it: every field the receiver reads is a string. */
export interface SnsMessage {
  Type: string
  MessageId: string
  TopicArn: string
  Message: string
  Timestamp: string
  SignatureVersion: string
  Signature: string
  SigningCertURL: string
  Subject?: string
  SubscribeURL?: string
  Token?: string
  UnsubscribeURL?: string
}

/** What a check of a message comes to. */
export type SnsCheck = 'valid' | 'invalid' | 'cert_unreachable' | 'cert_unusable'

const REQUIRED = ['Type', 'MessageId', 'TopicArn', 'Message', 'Timestamp', 'SignatureVersion', 'Signature', 'SigningCertURL'] as const
const OPTIONAL = ['Subject', 'SubscribeURL', 'Token', 'UnsubscribeURL'] as const

/** The fields SNS signs for each type, in the byte order of their names. */
export const SIGNED_FIELDS: Readonly<Record<string, readonly (keyof SnsMessage)[]>> = {
  Notification: ['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn', 'Type'],
  SubscriptionConfirmation: ['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type'],
  UnsubscribeConfirmation: ['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type'],
}

/**
 * A parsed body as a message, or null when it is not one: an object whose required fields are strings and whose
 * optional ones are strings or absent (a null is read as absent). Only these fields are kept.
 */
export function readSnsMessage(value: unknown): SnsMessage | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  const body = value as Record<string, unknown>
  const message: Record<string, string> = {}
  for (const name of REQUIRED) {
    if (typeof body[name] !== 'string') return null
    message[name] = body[name] as string
  }
  for (const name of OPTIONAL) {
    if (body[name] === undefined || body[name] === null) continue
    if (typeof body[name] !== 'string') return null
    message[name] = body[name] as string
  }
  return message as unknown as SnsMessage
}

/**
 * The string SNS signs: for a Notification, Message, MessageId, Subject only when it is present, Timestamp, TopicArn
 * and Type; for a SubscriptionConfirmation or an UnsubscribeConfirmation, Message, MessageId, SubscribeURL, Timestamp,
 * Token, TopicArn and Type; each written as its name, a newline, its value and a newline, so the string ends with one
 * newline. Null for any other type, or for a confirmation without its SubscribeURL or its Token.
 */
export function stringToSign(m: SnsMessage): string | null {
  const fields = Object.hasOwn(SIGNED_FIELDS, m.Type) ? SIGNED_FIELDS[m.Type] : null
  if (!fields) return null
  let text = ''
  for (const name of fields) {
    const value = m[name]
    if (value === undefined) {
      if (name === 'Subject') continue
      return null
    }
    text += `${name}\n${value}\n`
  }
  return text
}

/**
 * The AWS account a topic's name holds, arn:aws:sns:<region>:<account>:<name>: its twelve digits, or '' when the name
 * holds none. Only an event of that account's own mail is read.
 */
export function topicAccount(topicArn: string): string {
  const account = topicArn.split(':')[4] ?? ''
  return /^\d{12}$/.test(account) ? account : ''
}

/** SNS's own host for a region, written once. */
function snsHost(region: string): string {
  return `sns.${region}.amazonaws.com`
}

/**
 * The address as the URL parser reads it, when it is an address on SNS's own host for the region: https, that host
 * exactly, no port, no user or password, no fragment, and the same once parsed, so the parser rewrote nothing.
 */
function snsUrl(raw: string, region: string): URL | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.href !== raw || raw.includes('#')) return null
  if (url.protocol !== 'https:' || url.port !== '' || url.username !== '' || url.password !== '') return null
  return url.hostname === snsHost(region) ? url : null
}

/** True for an address a certificate may be fetched from: SNS's own host for the region, by snsUrl's rules, with no query, its path ending in .pem. */
export function certUrlAllowed(raw: string, region: string): boolean {
  const url = snsUrl(raw, region)
  return url !== null && !raw.includes('?') && url.pathname.endsWith('.pem')
}

/** True for an address a subscription may be confirmed at: SNS's own host for the region, by snsUrl's rules; its query is the confirmation's. */
export function subscribeUrlAllowed(raw: string, region: string): boolean {
  return snsUrl(raw, region) !== null
}

/** A time as Amazon writes one, 2026-11-12T03:04:05.678Z, read as milliseconds; null when it is not one, or not a real day and time. */
export function amazonTime(text: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?Z$/.exec(text)
  if (!m) return null
  const [year, month, day, hour, minute, second] = m.slice(1, 7).map(Number)
  const at = Date.UTC(year, month - 1, day, hour, minute, second, Number((m[7] ?? '').slice(0, 3).padEnd(3, '0')))
  // Date.UTC carries a day, an hour or a second past its range into the next; a time that does not come back as
  // written was not a time.
  const back = new Date(at)
  const same = back.getUTCFullYear() === year && back.getUTCMonth() === month - 1 && back.getUTCDate() === day
    && back.getUTCHours() === hour && back.getUTCMinutes() === minute && back.getUTCSeconds() === second
  return same ? at : null
}

/** A stream read no further than `limit` bytes: its bytes, or null when it holds more. */
export async function readCapped(stream: ReadableStream | null, limit: number): Promise<Uint8Array | null> {
  if (!stream) return new Uint8Array(0)
  const reader = stream.getReader()
  const parts: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    const part = value instanceof Uint8Array ? value : new Uint8Array(value as ArrayBuffer)
    size += part.byteLength
    if (size > limit) {
      await reader.cancel().catch(() => undefined)
      return null
    }
    parts.push(part)
  }
  const bytes = new Uint8Array(size)
  let at = 0
  for (const part of parts) {
    bytes.set(part, at)
    at += part.byteLength
  }
  return bytes
}

/** Base64 as SNS writes a signature and a certificate's body: no other character, and padding only at the end. */
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/

function bytesOfBase64(text: string): Uint8Array | null {
  if (text === '' || !BASE64.test(text)) return null
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** The lengths an RSA signature can have, in bytes, for a key of 2048, 3072 or 4096 bits. */
const SIGNATURE_LENGTHS = new Set([256, 384, 512])

/** The signature's bytes, or null when it is not base64 or not the length of an RSA signature. */
function signatureOf(text: string): Uint8Array | null {
  const bytes = bytesOfBase64(text)
  return bytes && SIGNATURE_LENGTHS.has(bytes.length) ? bytes : null
}

/** One element of DER: its tag, where it starts, where its contents start, and where it ends. */
interface Element {
  tag: number
  at: number
  start: number
  end: number
}

/** The element at `at`, or null when its length is not DER's (an indefinite length, or more than four bytes of it) or runs past `end`. */
function elementAt(der: Uint8Array, at: number, end: number): Element | null {
  if (at + 2 > end) return null
  let length = der[at + 1]
  let start = at + 2
  if (length & 0x80) {
    const count = length & 0x7f
    if (count === 0 || count > 4 || start + count > end) return null
    length = 0
    for (let i = 0; i < count; i++) length = length * 256 + der[start + i]
    start += count
  }
  return start + length > end ? null : { tag: der[at], at, start, end: start + length }
}

const SEQUENCE = 0x30
const INTEGER = 0x02
/** The [0] that holds a certificate's version, present from version 2 on. */
const VERSION = 0xa0

/**
 * The subjectPublicKeyInfo of an X.509 certificate, as its own DER, or null when the DER is not a certificate's
 * (RFC 5280 section 4.1): the Certificate, then its tbsCertificate, then past the optional [0] version, the serial
 * number, the signature algorithm, the issuer, the validity and the subject.
 */
export function spkiOf(der: Uint8Array): Uint8Array | null {
  const certificate = elementAt(der, 0, der.length)
  if (!certificate || certificate.tag !== SEQUENCE || certificate.end !== der.length) return null
  const tbs = elementAt(der, certificate.start, certificate.end)
  if (!tbs || tbs.tag !== SEQUENCE) return null
  let field = elementAt(der, tbs.start, tbs.end)
  if (field?.tag === VERSION) field = elementAt(der, field.end, tbs.end)
  // The serial number, then four sequences: the signature algorithm, the issuer, the validity and the subject.
  for (const tag of [INTEGER, SEQUENCE, SEQUENCE, SEQUENCE, SEQUENCE]) {
    if (!field || field.tag !== tag) return null
    field = elementAt(der, field.end, tbs.end)
  }
  return field && field.tag === SEQUENCE ? der.slice(field.at, field.end) : null
}

/** A PEM certificate's DER, or null when the text holds no certificate. */
export function derOfPem(pem: string): Uint8Array | null {
  const body = /-----BEGIN CERTIFICATE-----([A-Za-z0-9+/=\s]*)-----END CERTIFICATE-----/.exec(pem)?.[1]
  return body === undefined ? null : bytesOfBase64(body.replace(/\s+/g, ''))
}

const RSA = 'RSASSA-PKCS1-v1_5'

/** The public key of a certificate's text, as DER, when the text can be walked to an RSA key Web Crypto imports; else null. */
async function readCertificate(pem: string): Promise<Uint8Array | null> {
  const der = derOfPem(pem)
  const spki = der ? spkiOf(der) : null
  if (!spki) return null
  try {
    await crypto.subtle.importKey('spki', spki, { name: RSA, hash: 'SHA-256' }, false, ['verify'])
    return spki
  } catch {
    return null
  }
}

/** The certificates kept, as the public key each holds, keyed by the address each was fetched from. */
const certificates = new Map<string, Uint8Array>()

/** The addresses this isolate keeps a certificate for, each one fetched from SNS's own host and read. */
export function keptCertificates(): string[] {
  return [...certificates.keys()]
}

/**
 * Checks a message's signature: 'valid'; 'invalid' for a version other than 1 or 2, a type SNS does not sign, a
 * signature that is not base64 or not the length of an RSA signature, a certificate address certUrlAllowed refuses,
 * or a signature that does not verify; 'cert_unreachable' when the certificate could not be fetched; and
 * 'cert_unusable' when one fetched from the allowed host cannot be walked to an RSA key or imported. Nothing is fetched
 * before the four checks that need no fetch have passed, and a certificate kept from an earlier check is not fetched
 * again. fetchCert answers the certificate's text, or throws when there is none.
 */
export async function verifySnsMessage(m: SnsMessage, region: string, fetchCert: (url: string) => Promise<string>): Promise<SnsCheck> {
  const hash = m.SignatureVersion === '1' ? 'SHA-1' : m.SignatureVersion === '2' ? 'SHA-256' : null
  if (hash === null) return 'invalid'
  const text = stringToSign(m)
  if (text === null) return 'invalid'
  const signature = signatureOf(m.Signature)
  if (!signature) return 'invalid'
  if (!certUrlAllowed(m.SigningCertURL, region)) return 'invalid'

  let spki = certificates.get(m.SigningCertURL)
  if (!spki) {
    let pem: string
    try {
      pem = await fetchCert(m.SigningCertURL)
    } catch {
      return 'cert_unreachable'
    }
    const read = await readCertificate(pem)
    if (!read) return 'cert_unusable'
    if (certificates.size >= SNS_CERT_CACHE_MAX) certificates.clear()
    certificates.set(m.SigningCertURL, read)
    spki = read
  }

  let key: CryptoKey
  try {
    key = await crypto.subtle.importKey('spki', spki, { name: RSA, hash }, false, ['verify'])
  } catch {
    return 'cert_unusable'
  }
  const bits = 'modulusLength' in key.algorithm ? Number(key.algorithm.modulusLength) : 0
  if (bits !== signature.length * 8) return 'invalid'
  try {
    return (await crypto.subtle.verify(RSA, key, signature, new TextEncoder().encode(text))) ? 'valid' : 'invalid'
  } catch {
    return 'invalid'
  }
}
