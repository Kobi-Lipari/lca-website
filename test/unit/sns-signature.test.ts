// test/unit/sns-signature.test.ts
//
// WS16 step 8: functions/utils/mail/sns.ts, the check of a message Amazon
// SNS posts to the receiver of Amazon's reports, on its own: the string SNS
// signs for each of its three types, the addresses a certificate may be
// fetched from and a subscription confirmed at, the signature under either
// version, the certificates kept, the DER walk to a certificate's public
// key, and the time and size limits. Messages are signed by
// test/integration/helpers/sns.ts under a key made for the test run, the
// string it signs written apart from the module under test; the DER walk is
// also held to a real certificate of version 3 with its extensions, made by
// openssl with a plainly made-up subject, whose public key openssl printed
// (test/unit/fixtures/sns-test-cert.pem and sns-test-cert-pubkey.pem,
// public material only; the private key was never kept). Last, the topic's
// name is held a secret: bound empty in the browser tests, given a value
// only as the integration pool's made-up topic, and read by the receiver
// alone. Nothing here makes a request: every certificate is handed over by
// a stub.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  SIGNED_FIELDS, SNS_CERT_CACHE_MAX, SNS_MAX_AGE_MS, SNS_MAX_BODY_BYTES, amazonTime, certUrlAllowed, derOfPem, keptCertificates, readCapped, readSnsMessage,
  spkiOf, stringToSign, subscribeUrlAllowed, topicAccount, verifySnsMessage, type SnsMessage,
} from '../../functions/utils/mail/sns'
import {
  TEST_TOPIC, certUrl, certificateOf, der, makeSigner, pemOf, signedText, tbsOf, type SnsSigner,
} from '../integration/helpers/sns'

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const REGION = 'us-east-1'
const HOST = 'https://sns.us-east-1.amazonaws.com'

let signer: SnsSigner
beforeAll(async () => {
  signer = await makeSigner()
})

/** A stub of the certificate's fetch that answers one text and keeps every address it was asked for. */
function serve(text: string | (() => never)): { fetchCert: (url: string) => Promise<string>; asked: string[] } {
  const asked: string[] = []
  return {
    asked,
    fetchCert: async (url: string) => {
      asked.push(url)
      return typeof text === 'string' ? text : text()
    },
  }
}

const A_NOTIFICATION = { Type: 'Notification', Message: '{"eventType":"Bounce"}', Subject: 'Amazon SES Email Event Notification', Timestamp: '2026-11-12T03:04:05.678Z' }

describe('the string SNS signs', () => {
  it('writes a Notification\'s six fields in the byte order of their names, each as its name, a newline, its value and a newline', () => {
    const m = { ...A_NOTIFICATION, MessageId: 'sample-id', TopicArn: TEST_TOPIC, SignatureVersion: '2', Signature: 'x', SigningCertURL: 'y' } as SnsMessage
    expect(stringToSign(m)).toBe(
      `Message\n{"eventType":"Bounce"}\nMessageId\nsample-id\nSubject\nAmazon SES Email Event Notification\nTimestamp\n2026-11-12T03:04:05.678Z\nTopicArn\n${TEST_TOPIC}\nType\nNotification\n`,
    )
    expect(stringToSign(m)!.endsWith('Notification\n')).toBe(true)
    expect(stringToSign(m)!.endsWith('\n\n')).toBe(false)
  })

  it('leaves Subject out when a Notification has none', () => {
    const m = { Type: 'Notification', Message: 'm', MessageId: 'i', Timestamp: 't', TopicArn: 'a', SignatureVersion: '2', Signature: 'x', SigningCertURL: 'y' } as SnsMessage
    expect(stringToSign(m)).toBe('Message\nm\nMessageId\ni\nTimestamp\nt\nTopicArn\na\nType\nNotification\n')
  })

  it('writes the seven fields of a SubscriptionConfirmation and of an UnsubscribeConfirmation, and none without its SubscribeURL or its Token', () => {
    for (const Type of ['SubscriptionConfirmation', 'UnsubscribeConfirmation']) {
      const m = { Type, Message: 'm', MessageId: 'i', SubscribeURL: 'u', Timestamp: 't', Token: 'k', TopicArn: 'a', SignatureVersion: '2', Signature: 'x', SigningCertURL: 'y' } as SnsMessage
      expect(stringToSign(m), Type).toBe(`Message\nm\nMessageId\ni\nSubscribeURL\nu\nTimestamp\nt\nToken\nk\nTopicArn\na\nType\n${Type}\n`)
      expect(stringToSign({ ...m, SubscribeURL: undefined }), Type).toBeNull()
      expect(stringToSign({ ...m, Token: undefined }), Type).toBeNull()
    }
  })

  it('answers null for any other type, a name an object holds by its prototype included', () => {
    for (const Type of ['Notice', 'notification', '', 'constructor', 'toString', 'hasOwnProperty']) {
      expect(stringToSign({ ...A_NOTIFICATION, Type, MessageId: 'i', TopicArn: 'a', SignatureVersion: '2', Signature: 'x', SigningCertURL: 'y' } as SnsMessage), Type).toBeNull()
    }
  })

  it('holds each type\'s names in byte order, the lists AWS\'s pages give, and the same string the helper writes apart from it', () => {
    for (const [type, fields] of Object.entries(SIGNED_FIELDS)) {
      expect([...fields].sort((a, b) => (Buffer.from(a) < Buffer.from(b) ? -1 : 1)), type).toEqual([...fields])
    }
    expect(SIGNED_FIELDS.Notification).toEqual(['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn', 'Type'])
    expect(SIGNED_FIELDS.SubscriptionConfirmation).toEqual(['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type'])
    expect(SIGNED_FIELDS.UnsubscribeConfirmation).toEqual(SIGNED_FIELDS.SubscriptionConfirmation)
    const m = { ...A_NOTIFICATION, MessageId: 'i', TopicArn: TEST_TOPIC, SignatureVersion: '2', Signature: 'x', SigningCertURL: 'y' } as SnsMessage
    expect(stringToSign(m)).toBe(signedText(m as unknown as Record<string, string>))
  })

  it('reads a body as a message only when every field it reads is a string, an optional one absent or null, and keeps those fields alone', () => {
    const body = { ...A_NOTIFICATION, MessageId: 'i', TopicArn: 'a', SignatureVersion: '2', Signature: 'x', SigningCertURL: 'y', MessageAttributes: { a: 1 } }
    expect(readSnsMessage(body)).toEqual({ ...A_NOTIFICATION, MessageId: 'i', TopicArn: 'a', SignatureVersion: '2', Signature: 'x', SigningCertURL: 'y' })
    expect(readSnsMessage({ ...body, Subject: null })).not.toHaveProperty('Subject')
    for (const bad of [null, [], 'text', 1, { ...body, TopicArn: 1 }, { ...body, Signature: undefined }, { ...body, Subject: 2 }, { ...body, Token: {} }]) {
      expect(readSnsMessage(bad), JSON.stringify(bad)).toBeNull()
    }
  })
})

describe('the addresses a certificate is fetched from and a subscription confirmed at', () => {
  const PEM = `${HOST}/SimpleNotificationService-0123456789abcdef.pem`

  it('take https on SNS\'s own host for the region, a certificate\'s path ending in .pem, and no other host, region or scheme', () => {
    expect(certUrlAllowed(PEM, REGION)).toBe(true)
    for (const url of [
      PEM.replace('https:', 'http:'), PEM.replace('us-east-1', 'us-west-2'), PEM.replace('sns.', 'email.'), PEM.replace('amazonaws.com', 'amazonaws.com.evil.example'),
      'https://evil.example/SimpleNotificationService-0123456789abcdef.pem', PEM.replace('https:', 'ftp:'), PEM.replace('amazonaws.com/', 'amazonaws.com./'), 'not an address',
    ]) expect(certUrlAllowed(url, REGION), url).toBe(false)
    expect(certUrlAllowed(PEM, 'us-west-2')).toBe(false)
  })

  it('refuse a port, the default one included, a user, a password, and an address whose user part, query or fragment points the host elsewhere', () => {
    for (const url of [
      `${HOST}:443/a.pem`, `${HOST}:8443/a.pem`, `${HOST}:/a.pem`, 'https://user@sns.us-east-1.amazonaws.com/a.pem', 'https://user:pw@sns.us-east-1.amazonaws.com/a.pem',
      'https://sns.us-east-1.amazonaws.com@evil.example/a.pem', 'https://evil.example?@sns.us-east-1.amazonaws.com/a.pem',
      'https://evil.example#@sns.us-east-1.amazonaws.com/a.pem', 'https://evil.example\\@sns.us-east-1.amazonaws.com/a.pem',
    ]) {
      expect(certUrlAllowed(url, REGION), url).toBe(false)
      expect(subscribeUrlAllowed(url, REGION), url).toBe(false)
    }
    // What the URL parser makes of them: the default port dropped, the user part kept apart from the host, and the host
    // read before a query or a fragment as evil.example.
    expect(new URL(`${HOST}:443/a.pem`).port).toBe('')
    expect(new URL('https://sns.us-east-1.amazonaws.com@evil.example/a.pem').hostname).toBe('evil.example')
    expect(new URL('https://evil.example?@sns.us-east-1.amazonaws.com/a.pem').hostname).toBe('evil.example')
  })

  it('refuse what the URL parser would rewrite to SNS\'s host or path: an upper-case host, an encoded dot, a backslash, dot segments and spaces around it', () => {
    for (const url of [
      'https://SNS.US-EAST-1.AMAZONAWS.COM/a.pem', 'https://sns%2eus-east-1.amazonaws.com/a.pem', 'https://sns.us-east-1.amazonaws.com\\a.pem',
      `${HOST}/../a.pem`, `${HOST}/%2e%2e/a.pem`, ` ${PEM}`, `${PEM}\n`,
    ]) {
      // The parser alone reads each as SNS's own host; read as written, none is.
      expect(new URL(url).hostname, url).toBe('sns.us-east-1.amazonaws.com')
      expect(certUrlAllowed(url, REGION), url).toBe(false)
      expect(subscribeUrlAllowed(url, REGION), url).toBe(false)
    }
  })

  it('refuse a certificate\'s address with a query, even an empty one, a fragment, even an empty one, or a path that does not end in .pem', () => {
    for (const url of [`${PEM}?x=1`, `${PEM}?`, `${PEM}#f`, `${PEM}#`, `${HOST}/a.PEM`, `${HOST}/a.pem.txt`, `${HOST}/`, HOST]) {
      expect(certUrlAllowed(url, REGION), url).toBe(false)
    }
  })

  it('take a SubscribeURL on the same host with its query, and none on another host or over http', () => {
    const subscribe = `${HOST}/?Action=ConfirmSubscription&TopicArn=${TEST_TOPIC}&Token=sample-token`
    expect(subscribeUrlAllowed(subscribe, REGION)).toBe(true)
    expect(certUrlAllowed(subscribe, REGION)).toBe(false)
    for (const url of [subscribe.replace('https:', 'http:'), subscribe.replace('sns.us-east-1', 'sns.us-west-2'), subscribe.replace(HOST, 'https://evil.example'), `${subscribe}#`]) {
      expect(subscribeUrlAllowed(url, REGION), url).toBe(false)
    }
  })
})

describe('the check of a signature', () => {
  it('verifies a message of each of the three types under version 2 and under version 1', async () => {
    const { fetchCert } = serve(signer.pem)
    for (const version of ['1', '2'] as const) {
      for (const Type of ['Notification', 'SubscriptionConfirmation', 'UnsubscribeConfirmation']) {
        expect(await verifySnsMessage(await signer.sign({ Type }, version), REGION, fetchCert), `${Type} ${version}`).toBe('valid')
      }
      expect(await verifySnsMessage(await signer.sign({ Subject: 'Sample subject' }, version), REGION, fetchCert)).toBe('valid')
    }
  })

  it('refuses a version other than 1 and 2 before anything is fetched', async () => {
    const message = await signer.sign({})
    const { fetchCert, asked } = serve(signer.pem)
    for (const SignatureVersion of ['3', '0', '', ' 2', '2 ', '02', '1.0', 'two']) {
      expect(await verifySnsMessage({ ...message, SignatureVersion }, REGION, fetchCert), SignatureVersion).toBe('invalid')
    }
    expect(asked).toEqual([])
  })

  it('refuses a message with any signed field changed after it was signed, a Subject added or one taken away', async () => {
    const message = await signer.sign({ Subject: 'Sample subject', Message: '{"eventType":"Bounce"}' })
    const { fetchCert } = serve(signer.pem)
    expect(await verifySnsMessage(message, REGION, fetchCert)).toBe('valid')
    for (const name of ['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn'] as const) {
      expect(await verifySnsMessage({ ...message, [name]: `${message[name]}x` }, REGION, fetchCert), name).toBe('invalid')
    }
    expect(await verifySnsMessage({ ...message, Type: 'UnsubscribeConfirmation', SubscribeURL: `${HOST}/`, Token: 't' }, REGION, fetchCert)).toBe('invalid')
    expect(await verifySnsMessage({ ...message, Subject: undefined }, REGION, fetchCert)).toBe('invalid')
    const plain = await signer.sign({})
    expect(await verifySnsMessage({ ...plain, Subject: 'Sample subject' }, REGION, fetchCert)).toBe('invalid')
  })

  it('refuses a signature that is not base64 or not the length of an RSA signature, and a certificate address on another host, before anything is fetched', async () => {
    const message = await signer.sign({})
    const { fetchCert, asked } = serve(signer.pem)
    const bytesOf = (n: number) => btoa(String.fromCharCode(...new Uint8Array(n).fill(7)))
    for (const Signature of ['', 'not base64!', `${message.Signature.slice(0, 40)} ${message.Signature.slice(40)}`, `${message.Signature}=`, message.Signature.slice(1), bytesOf(255), bytesOf(257), bytesOf(128)]) {
      expect(await verifySnsMessage({ ...message, Signature }, REGION, fetchCert), Signature.slice(0, 30)).toBe('invalid')
    }
    for (const SigningCertURL of ['https://evil.example/a.pem', 'http://sns.us-east-1.amazonaws.com/a.pem', 'https://SNS.US-EAST-1.AMAZONAWS.COM/a.pem']) {
      expect(await verifySnsMessage({ ...message, SigningCertURL }, REGION, fetchCert), SigningCertURL).toBe('invalid')
    }
    expect(asked).toEqual([])
  })

  it('refuses a signature made under another key of the same size, once it has fetched the certificate, and one of a type SNS does not sign', async () => {
    const { fetchCert, asked } = serve(signer.pem)
    const forged = await signer.forge({})
    expect(await verifySnsMessage(forged, REGION, fetchCert)).toBe('invalid')
    expect(asked).toEqual([forged.SigningCertURL])
    expect(await verifySnsMessage({ ...(await signer.sign({})), Type: 'Notice' }, REGION, fetchCert)).toBe('invalid')
    expect(asked).toHaveLength(1)
  })

  it('answers cert_unreachable when the certificate cannot be fetched, and keeps nothing', async () => {
    const message = await signer.sign({})
    const { fetchCert, asked } = serve(() => {
      throw new Error('sample: no answer')
    })
    expect(await verifySnsMessage(message, REGION, fetchCert)).toBe('cert_unreachable')
    expect(await verifySnsMessage(message, REGION, fetchCert)).toBe('cert_unreachable')
    expect(asked).toHaveLength(2)
    expect(keptCertificates()).not.toContain(message.SigningCertURL)
  })

  it('answers cert_unusable for a certificate fetched from the allowed host that cannot be read, and keeps none of them', async () => {
    const ec = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
    const ecSpki = new Uint8Array(await crypto.subtle.exportKey('spki', ec.publicKey))
    const ownDer = derOfPem(signer.pem)!
    const unreadable: Array<readonly [string, string]> = [
      ['empty', ''],
      ['not a certificate at all', 'sample words, not a certificate'],
      ['a PEM of junk', pemOf(new Uint8Array([1, 2, 3, 4, 5, 6]))],
      ['a certificate cut short', pemOf(ownDer.slice(0, ownDer.length - 10))],
      ['a public key\'s PEM in place of a certificate', read('test/unit/fixtures/sns-test-cert-pubkey.pem')],
      ['a certificate whose key is not RSA', pemOf(certificateOf(tbsOf(ecSpki), new Uint8Array([0])))],
      ['an HTML page', '<html><body>Sample error page</body></html>'],
    ]
    for (const [name, text] of unreadable) {
      const message = await signer.sign({})
      const { fetchCert, asked } = serve(text)
      expect(await verifySnsMessage(message, REGION, fetchCert), name).toBe('cert_unusable')
      expect(await verifySnsMessage(message, REGION, fetchCert), name).toBe('cert_unusable')
      expect(asked, name).toHaveLength(2)
      expect(keptCertificates(), name).not.toContain(message.SigningCertURL)
    }
  })

  it('keeps a certificate it fetched and read, so a second message under it fetches nothing', async () => {
    const url = certUrl()
    const { fetchCert, asked } = serve(signer.pem)
    expect(await verifySnsMessage(await signer.sign({ SigningCertURL: url }), REGION, fetchCert)).toBe('valid')
    expect(await verifySnsMessage(await signer.sign({ SigningCertURL: url }, '1'), REGION, fetchCert)).toBe('valid')
    expect(await verifySnsMessage(await signer.forge({ SigningCertURL: url }), REGION, fetchCert)).toBe('invalid')
    expect(asked).toEqual([url])
    expect(keptCertificates()).toContain(url)
  })

  it(`keeps at most ${SNS_CERT_CACHE_MAX} certificates, starting again empty when full, so no stream of addresses can grow what it keeps`, async () => {
    const { fetchCert } = serve(signer.pem)
    const urls = Array.from({ length: SNS_CERT_CACHE_MAX * 3 }, () => certUrl())
    for (const url of urls) {
      expect(await verifySnsMessage(await signer.sign({ SigningCertURL: url }), REGION, fetchCert)).toBe('valid')
      expect(keptCertificates().length).toBeLessThanOrEqual(SNS_CERT_CACHE_MAX)
      expect(keptCertificates()).toContain(url)
    }
    expect(SNS_CERT_CACHE_MAX).toBe(4)
  })
})

describe('the walk of a certificate\'s DER to its public key', () => {
  it('walks the certificate openssl made, version 3 with its extensions, to exactly the public key openssl printed', () => {
    const cert = read('test/unit/fixtures/sns-test-cert.pem')
    const publicKey = read('test/unit/fixtures/sns-test-cert-pubkey.pem')
    expect(cert).not.toMatch(/PRIVATE/)
    expect(publicKey).not.toMatch(/PRIVATE/)
    const printed = Buffer.from(publicKey.replace(/-----(?:BEGIN|END) PUBLIC KEY-----|\s/g, ''), 'base64')
    const spki = spkiOf(derOfPem(cert)!)
    expect(spki).not.toBeNull()
    expect(Buffer.from(spki!).equals(printed)).toBe(true)
  })

  it('walks the helper\'s certificate to the key it was made around, which verifies a signature made under it', async () => {
    const spki = spkiOf(derOfPem(signer.pem)!)!
    const key = await crypto.subtle.importKey('spki', spki, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
    expect((key.algorithm as RsaHashedKeyAlgorithm).modulusLength).toBe(2048)
    const message = await signer.sign({})
    const signature = Uint8Array.from(atob(message.Signature), (c) => c.charCodeAt(0))
    expect(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, new TextEncoder().encode(stringToSign(message)!))).toBe(true)
  })

  it('reads a certificate with no version field, and refuses DER that is not a certificate\'s', () => {
    const spki = spkiOf(derOfPem(signer.pem)!)!
    const v1 = derOfPem(signer.pem)!
    // The same certificate's tbsCertificate written without its [0] version, as a version 1 certificate is.
    const bare = der(0x30, der(0x30, der(0x02, new Uint8Array([1])), der(0x30), der(0x30), der(0x30), der(0x30), spki), der(0x30), der(0x03, new Uint8Array([0])))
    expect(Buffer.from(spkiOf(bare)!).equals(Buffer.from(spki))).toBe(true)
    for (const [name, bytes] of [
      ['nothing', new Uint8Array(0)],
      ['one byte', new Uint8Array([0x30])],
      ['cut short', v1.slice(0, 200)],
      ['an indefinite length', new Uint8Array([0x30, 0x80, 0x00, 0x00])],
      ['a length past the end', new Uint8Array([0x30, 0x84, 0xff, 0xff, 0xff, 0xff, 0x00])],
      ['bytes after the certificate', new Uint8Array([...v1, 0x00])],
      ['a set where the certificate is', new Uint8Array([0x31, ...v1.slice(1)])],
      ['a serial number that is not an integer', der(0x30, der(0x30, der(0x04, new Uint8Array([1])), der(0x30), der(0x30), der(0x30), der(0x30), spki))],
      ['no public key after the subject', der(0x30, der(0x30, der(0x02, new Uint8Array([1])), der(0x30), der(0x30), der(0x30), der(0x30)))],
    ] as const) expect(spkiOf(bytes), name).toBeNull()
  })
})

describe('the time, the size and the topic\'s account', () => {
  it('reads a time as Amazon writes one, with or without its fraction, and no other form, nor a day or an hour that is not real', () => {
    expect(amazonTime('2026-11-12T03:04:05.678Z')).toBe(Date.UTC(2026, 10, 12, 3, 4, 5, 678))
    expect(amazonTime('2026-11-12T03:04:05Z')).toBe(Date.UTC(2026, 10, 12, 3, 4, 5))
    expect(amazonTime('2026-11-12T03:04:05.123456Z')).toBe(Date.UTC(2026, 10, 12, 3, 4, 5, 123))
    expect(amazonTime('2028-02-29T23:59:59.999Z')).toBe(Date.UTC(2028, 1, 29, 23, 59, 59, 999))
    for (const text of [
      '', 'yesterday', '2026-11-12', '2026-11-12 03:04:05', '2026-11-12T03:04:05', '2026-11-12T03:04:05+00:00', '2026-11-12T03:04:05.678z',
      ' 2026-11-12T03:04:05Z', '2026-02-30T00:00:00Z', '2026-11-12T24:00:00Z', '2026-11-12T03:60:00Z', '2026-13-01T00:00:00Z', '0099-01-01T00:00:00Z',
      '1778547845678', '2026-11-12T03:04:05.Z',
    ]) expect(amazonTime(text), text).toBeNull()
  })

  it('holds a notification three hours at most and a body to SNS\'s own limit for a message, 262,144 bytes', () => {
    expect(SNS_MAX_AGE_MS).toBe(3 * 60 * 60 * 1000)
    expect(SNS_MAX_BODY_BYTES).toBe(262_144)
  })

  it('reads a stream to its end within the limit, and no further than the limit past it', async () => {
    const stream = (...chunks: string[]) => new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk))
        controller.close()
      },
    })
    expect(new TextDecoder().decode((await readCapped(stream('ab', 'cd'), 4))!)).toBe('abcd')
    expect(await readCapped(stream('ab', 'cde'), 4)).toBeNull()
    expect(await readCapped(null, 4)).toEqual(new Uint8Array(0))
    let pulled = 0
    const endless = new ReadableStream({
      pull(controller) {
        pulled++
        controller.enqueue(new Uint8Array(1024))
      },
    })
    expect(await readCapped(endless, 4096)).toBeNull()
    expect(pulled).toBeLessThanOrEqual(8)
  })

  it('reads the account from a topic\'s name, twelve digits, and none from a name that holds none', () => {
    expect(topicAccount(TEST_TOPIC)).toBe('000000000000')
    for (const name of ['', 'lca-mail-events', 'arn:aws:sns:us-east-1:12345:lca-mail-events', 'arn:aws:sns:us-east-1::lca-mail-events', 'arn:aws:sns:us-east-1:1234567890123:x']) {
      expect(topicAccount(name), name).toBe('')
    }
  })
})

describe('the topic\'s name, a secret K sets on the production Pages project alone', () => {
  /** Every file under a folder, but for installed packages, build output and state no deploy reads. */
  function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(join(ROOT, dir))) {
      if (['node_modules', '.git', 'dist', '.wrangler', 'test-results', 'playwright-report'].includes(name)) continue
      const path = `${dir}/${name}`
      if (statSync(join(ROOT, path)).isDirectory()) walk(path, out)
      else out.push(path)
    }
    return out
  }

  it('is bound empty in the browser tests, given a value by no setting file a deploy reads, and given one in the tests only as the made-up topic of the account of twelve zeros', () => {
    const empty = /A11Y_EMPTY_SECRETS\s*=\s*\[([\s\S]*?)\]/.exec(read('test/a11y/global-setup.ts'))?.[1] ?? ''
    expect(empty).toContain("'SES_SNS_TOPIC_ARN'")
    expect(/SES_SNS_TOPIC_ARN:\s*'([^']+)'/.exec(read('vitest.integration.config.ts'))?.[1]).toBe(TEST_TOPIC)
    for (const file of ['wrangler.toml', 'workers/daily-emails/wrangler.toml', '.dev.vars', '.dev.vars.example', '.dev.vars.a11y', '.env', '.env.example', '.env.local'].filter((f) => existsSync(join(ROOT, f)))) {
      expect(read(file), file).not.toMatch(/SES_SNS_TOPIC_ARN/)
    }
    // No file of code, settings, tests or record holds a topic's name with any account but the twelve zeros.
    const files = [...walk('functions'), ...walk('domain'), ...walk('src'), ...walk('workers'), ...walk('test'), ...walk('scripts'), 'vitest.integration.config.ts', 'REDESIGN_STATUS.md']
      .filter((f) => /\.(?:ts|tsx|js|mjs|json|toml|md|sql)$/.test(f))
    const named = files.filter((f) => /arn:aws:sns:[a-z0-9-]+:\d{12}:/.test(read(f)))
    for (const file of named) expect(read(file).match(/arn:aws:sns:[a-z0-9-]+:(\d{12}):/g)!.every((arn) => arn.includes(':000000000000:')), file).toBe(true)
  })

  it('is read by the receiver alone, and named elsewhere only on the type of the bindings and in the receiver\'s own words', () => {
    const code = [...walk('functions'), ...walk('workers'), ...walk('domain'), ...walk('src')].filter((f) => /\.(?:ts|tsx)$/.test(f))
    expect(code.filter((f) => /\benv\??\.SES_SNS_TOPIC_ARN\b/.test(read(f)))).toEqual(['functions/api/mail/ses-events.ts'])
    expect(code.filter((f) => /SES_SNS_TOPIC_ARN/.test(read(f))).sort()).toEqual(['functions/api/mail/ses-events.ts', 'functions/types.ts'])
    expect(read('functions/types.ts')).toMatch(/SES_SNS_TOPIC_ARN\?: string/)
  })
})
