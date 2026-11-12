// test/integration/helpers/sns.ts
//
// Amazon SNS as the receiver of Amazon's reports meets it (WS16 step 8),
// made in the test's own runtime with Web Crypto: an RSA key of 2048 bits
// made for the test run and kept nowhere, a minimal X.509 certificate of
// version 3 around its public key, written by the small DER writer below
// (a serial, sha256WithRSAEncryption, a one-name issuer and subject, a
// validity and the key, with an outer signature the receiver never
// checks), the certificate in PEM, and SNS's three types of message signed
// under the key with either signature version, 1 (RSASSA-PKCS1-v1_5 with
// SHA-1) or 2 (with SHA-256). The string a message is signed over is
// written here from AWS's own list of fields, apart from
// functions/utils/mail/sns.ts, so a case that posts a message proves the
// receiver's own string and its own check; nothing here skips either.
//
// It also writes the events Amazon SES publishes, a bounce and a spam
// report, in the form of AWS's own examples, with the parts the receiver
// must never store (a diagnostic code, the message's headers, a feedback
// report's user agent) filled in with made-up words, and, for a case that
// asks, a bounce whose own names differ from the addresses the message was
// sent to.
//
// It imports no test runtime, so the unit tests and the Workers pool both
// read it. Every name and address here is plainly made up, and the account
// is twelve zeros, which is no one's.
import type { SnsMessage } from '../../../functions/utils/mail/sns'

const encoder = new TextEncoder()

/** The made-up topic the integration pool binds as SES_SNS_TOPIC_ARN, in the account of twelve zeros. */
export const TEST_TOPIC = 'arn:aws:sns:us-east-1:000000000000:lca-mail-events'
/** The topic's account, which every event below names unless a case says otherwise. */
export const TEST_ACCOUNT = '000000000000'
/** SNS's host in the site's region. */
export const SNS_TEST_HOST = 'sns.us-east-1.amazonaws.com'

// ── A small DER writer ───────────────────────────────────────────

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const part of parts) {
    out.set(part, at)
    at += part.length
  }
  return out
}

/** A DER length: one byte below 128, else 0x80 and the count of the bytes that follow, then those bytes. */
function derLength(n: number): number[] {
  if (n < 0x80) return [n]
  const bytes: number[] = []
  for (let v = n; v > 0; v = Math.floor(v / 256)) bytes.unshift(v % 256)
  return [0x80 | bytes.length, ...bytes]
}

/** One element: its tag, its length and its contents. */
export function der(tag: number, ...contents: Uint8Array[]): Uint8Array {
  const body = concat(contents)
  return concat([new Uint8Array([tag, ...derLength(body.length)]), body])
}

const sequence = (...parts: Uint8Array[]) => der(0x30, ...parts)
const set = (...parts: Uint8Array[]) => der(0x31, ...parts)
const integer = (...bytes: number[]) => der(0x02, new Uint8Array(bytes))
const oid = (...bytes: number[]) => der(0x06, new Uint8Array(bytes))
const nothing = () => der(0x05)
const text = (value: string) => der(0x0c, encoder.encode(value))
const utcTime = (value: string) => der(0x17, encoder.encode(value))
const bits = (bytes: Uint8Array) => der(0x03, new Uint8Array([0]), bytes)

/** sha256WithRSAEncryption, 1.2.840.113549.1.1.11, with its empty parameters. */
const SHA256_WITH_RSA = sequence(oid(0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x0b), nothing())
/** A name of one common name, 2.5.4.3. */
const commonName = (value: string) => sequence(set(sequence(oid(0x55, 0x04, 0x03), text(value))))

/**
 * The tbsCertificate of a certificate of version 3 around a public key, as DER: the [0] version, a serial, the
 * algorithm, a one-name issuer, a validity, the same name as subject, and the key as subjectPublicKeyInfo.
 */
export function tbsOf(spki: Uint8Array, subject = 'Sample SNS test certificate'): Uint8Array {
  return sequence(
    der(0xa0, integer(2)),
    integer(0x01, 0x23, 0x45),
    SHA256_WITH_RSA,
    commonName(subject),
    sequence(utcTime('260101000000Z'), utcTime('360101000000Z')),
    commonName(subject),
    spki,
  )
}

/** The certificate as DER: the tbsCertificate, the algorithm again and the outer signature, which the receiver never checks. */
export function certificateOf(tbs: Uint8Array, signature: Uint8Array): Uint8Array {
  return sequence(tbs, SHA256_WITH_RSA, bits(signature))
}

/** DER as PEM, its base64 in lines of 64. */
export function pemOf(bytes: Uint8Array, label = 'CERTIFICATE'): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  const lines = btoa(binary).match(/.{1,64}/g) ?? []
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----\n`
}

function base64Of(bytes: ArrayBuffer): string {
  let binary = ''
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte)
  return btoa(binary)
}

// ── Signed messages ──────────────────────────────────────────────

/** The fields SNS signs for each type, in the byte order of their names, from AWS's own pages, written apart from the receiver's. */
const SIGNED: Record<string, string[]> = {
  Notification: ['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn', 'Type'],
  SubscriptionConfirmation: ['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type'],
  UnsubscribeConfirmation: ['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type'],
}

/** The string SNS signs for a message, each field as its name, a newline, its value and a newline, Subject only when present. */
export function signedText(message: Record<string, string | undefined>): string {
  return (SIGNED[message.Type ?? ''] ?? []).filter((name) => message[name] !== undefined).map((name) => `${name}\n${message[name]}\n`).join('')
}

let seq = 0
/** A certificate address on SNS's host for the site's region, a new one each call, so no case meets a certificate an earlier one left kept. */
export const certUrl = () => `https://${SNS_TEST_HOST}/SimpleNotificationService-sample${++seq}.pem`

/** What a case gives for a message; the rest is filled in. */
export interface MessageParts {
  Type?: string
  Message?: string
  MessageId?: string
  Timestamp?: string
  TopicArn?: string
  Subject?: string
  SubscribeURL?: string
  Token?: string
  SigningCertURL?: string
  UnsubscribeURL?: string
}

export interface SnsSigner {
  /** The certificate around the key, as SNS serves one. */
  pem: string
  /** A message of the parts given, signed under the key with the version given, 2 unless a case says otherwise. */
  sign(parts: MessageParts, version?: '1' | '2'): Promise<SnsMessage>
  /** The same, signed under another key of the same size, so it does not verify under the certificate. */
  forge(parts: MessageParts, version?: '1' | '2'): Promise<SnsMessage>
}

const RSA = { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }

async function signingKeys(): Promise<{ spki: Uint8Array; keys: Record<'1' | '2', CryptoKey> }> {
  const pair = (await crypto.subtle.generateKey(RSA, true, ['sign', 'verify'])) as CryptoKeyPair
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', pair.privateKey)
  const as = (hash: string) => crypto.subtle.importKey('pkcs8', pkcs8, { name: RSA.name, hash }, false, ['sign'])
  return { spki: new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey)), keys: { '1': await as('SHA-1'), '2': await as('SHA-256') } }
}

/** A key, its certificate, and a way to sign messages under it. One is enough for a test file. */
export async function makeSigner(): Promise<SnsSigner> {
  const own = await signingKeys()
  const other = await signingKeys()
  const tbs = tbsOf(own.spki)
  const pem = pemOf(certificateOf(tbs, new Uint8Array(await crypto.subtle.sign(RSA.name, own.keys['2'], tbs))))
  const signWith = async (keys: Record<'1' | '2', CryptoKey>, parts: MessageParts, version: '1' | '2'): Promise<SnsMessage> => {
    const type = parts.Type ?? 'Notification'
    const confirmation = type !== 'Notification'
    const topic = parts.TopicArn ?? TEST_TOPIC
    const token = parts.Token ?? (confirmation ? 'sample-token-0123456789abcdef' : undefined)
    const message: Record<string, string | undefined> = {
      Type: type,
      MessageId: parts.MessageId ?? `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`,
      TopicArn: topic,
      Subject: parts.Subject,
      Message: parts.Message ?? (confirmation ? 'You have chosen to subscribe to the topic. To confirm the subscription, visit the SubscribeURL included in this message.' : '{}'),
      Timestamp: parts.Timestamp ?? new Date().toISOString(),
      SubscribeURL: parts.SubscribeURL ?? (confirmation ? `https://${SNS_TEST_HOST}/?Action=ConfirmSubscription&TopicArn=${topic}&Token=${token}` : undefined),
      Token: token,
    }
    const signature = await crypto.subtle.sign(RSA.name, keys[version], encoder.encode(signedText(message)))
    const signed: Record<string, string> = {}
    for (const [name, value] of Object.entries(message)) if (value !== undefined) signed[name] = value
    signed.SignatureVersion = version
    signed.Signature = base64Of(signature)
    signed.SigningCertURL = parts.SigningCertURL ?? certUrl()
    if (type === 'Notification') {
      signed.UnsubscribeURL = parts.UnsubscribeURL ?? `https://${SNS_TEST_HOST}/?Action=Unsubscribe&SubscriptionArn=${message.TopicArn}:sample-subscription`
    }
    return signed as unknown as SnsMessage
  }
  return {
    pem,
    sign: (parts, version = '2') => signWith(own.keys, parts, version),
    forge: (parts, version = '2') => signWith(other.keys, parts, version),
  }
}

/** The request SNS makes: the message as text/plain JSON, its type in x-amz-sns-message-type, and the other two headers SNS sends. */
export function snsRequest(message: SnsMessage, headers: Record<string, string> = {}): { method: string; rawBody: string; headers: Record<string, string> } {
  return {
    method: 'POST',
    rawBody: JSON.stringify(message),
    headers: {
      'Content-Type': 'text/plain; charset=UTF-8',
      'x-amz-sns-message-type': message.Type,
      'x-amz-sns-message-id': message.MessageId,
      'x-amz-sns-topic-arn': message.TopicArn,
      ...headers,
    },
  }
}

// ── Amazon SES's events ──────────────────────────────────────────

/** The tags of a message as Amazon SES reports them: each the site set, and Amazon's own, each name's values a list. */
export function reportedTags(siteTags: Record<string, string> = { kind: 'event' }): Record<string, string[]> {
  const tags: Record<string, string[]> = { 'ses:configuration-set': ['lca-mail'], 'ses:from-domain': ['example.org'], 'ses:caller-identity': ['sample-user'] }
  for (const [name, value] of Object.entries(siteTags)) tags[name] = [value]
  return tags
}

/**
 * The mail object of an event: the message as Amazon SES sent it, with made-up headers the receiver must never keep. Its
 * destination, Amazon's record of whom the message was sent to, is the addresses the event names unless a case gives
 * its own, as a bounce whose receiving server names another address does.
 */
function mailOf(addresses: string[], opts: { account?: string; tags?: Record<string, string[]>; destination?: string[] }) {
  const sentTo = opts.destination ?? addresses
  return {
    timestamp: new Date(Date.now() - 60_000).toISOString(),
    source: 'Sample Sender <sender@example.org>',
    sourceArn: `arn:aws:ses:us-east-1:${opts.account ?? TEST_ACCOUNT}:identity/example.org`,
    sendingAccountId: opts.account ?? TEST_ACCOUNT,
    messageId: 'sample-message-id-0001',
    destination: sentTo,
    headersTruncated: false,
    headers: [
      { name: 'From', value: 'Sample Sender <sender@example.org>' },
      { name: 'To', value: sentTo.join(', ') },
      { name: 'Subject', value: 'Sample newsletter one' },
    ],
    commonHeaders: { from: ['Sample Sender <sender@example.org>'], to: sentTo, subject: 'Sample newsletter one' },
    tags: opts.tags ?? reportedTags(),
  }
}

/**
 * A bounce event, Permanent and General unless a case says otherwise, with a made-up diagnostic code for each address
 * it names, each as the receiving server's report names it; the message was sent to the same addresses unless a case
 * gives its destination apart.
 */
export function sesBounce(
  addresses: string[],
  opts: { type?: string; subType?: string; account?: string; tags?: Record<string, string[]>; kind?: 'eventType' | 'notificationType'; destination?: string[] } = {},
) {
  return {
    [opts.kind ?? 'eventType']: 'Bounce',
    bounce: {
      bounceType: opts.type ?? 'Permanent',
      bounceSubType: opts.subType ?? 'General',
      bouncedRecipients: addresses.map((emailAddress) => ({ emailAddress, action: 'failed', status: '5.1.1', diagnosticCode: 'smtp; 550 5.1.1 sample words: no such mailbox' })),
      timestamp: new Date(Date.now() - 30_000).toISOString(),
      feedbackId: 'sample-feedback-id-0001',
      reportingMTA: 'dsn; mta.example.org',
    },
    mail: mailOf(addresses, opts),
  }
}

/**
 * A spam report event, its feedback type abuse and its complaintSubType null, as Amazon writes an ordinary report,
 * unless a case says otherwise, with a made-up user agent the receiver must never keep.
 */
export function sesComplaint(
  addresses: string[],
  opts: { feedbackType?: string | null; subType?: string | null; timestamp?: string; account?: string; tags?: Record<string, string[]>; kind?: 'eventType' | 'notificationType' } = {},
) {
  return {
    [opts.kind ?? 'eventType']: 'Complaint',
    complaint: {
      complainedRecipients: addresses.map((emailAddress) => ({ emailAddress })),
      complaintSubType: opts.subType ?? null,
      timestamp: opts.timestamp ?? new Date(Date.now() - 30_000).toISOString(),
      feedbackId: 'sample-feedback-id-0002',
      userAgent: 'Sample Mail Reader 1.0',
      ...(opts.feedbackType === null ? {} : { complaintFeedbackType: opts.feedbackType ?? 'abuse' }),
      arrivalDate: new Date(Date.now() - 45_000).toISOString(),
    },
    mail: mailOf(addresses, opts),
  }
}

/** Another kind of event, a Delivery unless a case says otherwise, which the receiver reads as changing nothing. */
export function sesOther(addresses: string[], eventType = 'Delivery') {
  return { eventType, delivery: { timestamp: new Date().toISOString(), recipients: addresses, smtpResponse: '250 2.6.0 sample words' }, mail: mailOf(addresses, {}) }
}
