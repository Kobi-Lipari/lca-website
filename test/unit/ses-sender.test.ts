// test/unit/ses-sender.test.ts
//
// Amazon SES's transport, functions/utils/mail/ses.ts, with fetch stubbed so
// nothing leaves the test: the body SES's v2 SendEmail is sent for event
// mail, list mail and a test, its tags and its From line; no request
// without both keys; the one string that is signed and sent, hashed as its
// UTF-8 bytes; every row of the table of Amazon's answers read to its kind,
// sent, later or never, with the code read from the header, with or without
// a namespace, and from the body; Amazon's words kept short, with no
// resource name and no account number in them, and the key and the
// signature in none of them; and the limits Amazon sets for a header and a tag, met by every
// header and tag the site can send. The suite mocks
// functions/utils/mail/switches over the real module and sets the two
// constants its cases read through the seam, so no value the code ships
// with decides a case.
//
// AKIDEXAMPLE and the secret wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY are
// the example key of AWS's own documentation: they open nothing. Every
// address, name and subject here is plainly made up.
import { createHash, createHmac } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_FROM, DEFAULT_REPLY_TO, LIST_SENDERS, SENDER_NAME } from '../../domain/mail/addresses'
import { NEWSLETTER_LIST_ID, TOURNAMENTS_LIST_ID, type MailKind } from '../../domain/mail/lists'
import { listMailParts } from '../../functions/utils/mail/footer'
import { classifyOnce, configFault } from '../../functions/utils/mail/outcome'
import { sendThroughResend } from '../../functions/utils/mail/resend'
import type { MailGate } from '../../functions/utils/mail/gate'
import { deliver, type OutgoingMail, type SendResult } from '../../functions/utils/mail/send'
import {
  AMAZON_WORDS_MAX, SES_CONFIGURATION_SET, SES_KEY_MISSING, SES_REGION, amazonCode, amazonWords, sendThroughSes, sesBody,
} from '../../functions/utils/mail/ses'

const flags = vi.hoisted(() => ({ listsOn: false, sender: 'ses' }))
vi.mock('../../functions/utils/mail/switches', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/mail/switches')>()
  return {
    ...real,
    get MAIL_LISTS_ON() {
      return flags.listsOn
    },
    get MAIL_SENDER() {
      return flags.sender
    },
  }
})

const ROOT = resolve(__dirname, '../..')
const ENDPOINT = 'https://email.us-east-1.amazonaws.com/v2/email/outbound-emails'
/** AWS's documentation key, which opens nothing. */
const KEYS = { SES_ACCESS_KEY_ID: 'AKIDEXAMPLE', SES_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY' }

/** A made-up event email, as sendEmail hands one to the seam. */
const EVENT: OutgoingMail = {
  from: DEFAULT_FROM,
  to: 'player.one@example.org',
  replyTo: DEFAULT_REPLY_TO,
  subject: 'You\'re registered: Sample Winter Open',
  html: '<p>Example words.</p>',
  text: 'Example words.',
  shape: 'single',
}

const ONE_CLICK = [
  { name: 'List-Unsubscribe', value: '<https://www.louisianachess.org/api/mail/unsubscribe/sample-link>' },
  { name: 'List-Unsubscribe-Post', value: 'List-Unsubscribe=One-Click' },
]

/** A made-up newsletter email, as the list path hands one to the seam. */
const LIST: OutgoingMail = {
  kind: 'optional',
  listId: NEWSLETTER_LIST_ID,
  headers: ONE_CLICK,
  from: LIST_SENDERS[NEWSLETTER_LIST_ID]!.from,
  fromName: LIST_SENDERS[NEWSLETTER_LIST_ID]!.name,
  to: 'reader@example.org',
  replyTo: DEFAULT_REPLY_TO,
  subject: 'Sample newsletter one',
  html: '<p>Example news.</p>',
  shape: 'campaign',
}

/** A gate that lets every message through, so a case through the seam reads no database. */
const OPEN: MailGate = { refusal: () => null }

interface Caught { url: string; method: string; headers: Record<string, string>; body: string }

/** Stubs fetch with the answer given, and keeps every request it is handed. */
function answerWith(answer: () => Response | Promise<Response>): Caught[] {
  const caught: Caught[] = []
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    caught.push({
      url: String(input),
      method: init?.method ?? 'GET',
      headers: Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>)),
      body: String(init?.body),
    })
    return answer()
  }))
  return caught
}

/** Amazon's answer for a refusal, its code in the header, in the body, in both or in neither. */
function refusal(status: number, code: string | null, opts: { where?: 'header' | 'body' | 'both'; message?: string } = {}): Response {
  const where = opts.where ?? 'both'
  const headers: Record<string, string> = {}
  if (code && (where === 'header' || where === 'both')) headers['x-amzn-errortype'] = `${code}:http://internal.amazon.com/coral/com.amazon.coral.service/`
  const body: Record<string, string> = { message: opts.message ?? 'Sample words from Amazon.' }
  if (code && (where === 'body' || where === 'both')) body.__type = `com.amazon.coral.service#${code}`
  return Response.json(body, { status, headers })
}

const sha256 = (data: string | Buffer) => createHash('sha256').update(data).digest('hex')

/** The signature node:crypto works out for a request this transport sent, apart from the signer. */
function nodeSignature(request: Caught, secret: string): string {
  const time = request.headers['x-amz-date']
  const date = time.slice(0, 8)
  const canonical = [
    request.method, '/v2/email/outbound-emails', '',
    `content-type:${request.headers['content-type']}\nhost:email.us-east-1.amazonaws.com\nx-amz-date:${time}\n`,
    'content-type;host;x-amz-date', sha256(Buffer.from(request.body, 'utf8')),
  ].join('\n')
  let key: Buffer = createHmac('sha256', `AWS4${secret}`).update(date).digest()
  for (const part of ['us-east-1', 'ses', 'aws4_request']) key = createHmac('sha256', key).update(part).digest()
  return createHmac('sha256', key).update(['AWS4-HMAC-SHA256', time, `${date}/us-east-1/ses/aws4_request`, sha256(canonical)].join('\n')).digest('hex')
}

beforeEach(() => {
  flags.listsOn = false
  flags.sender = 'ses'
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('the body SES\'s v2 SendEmail is sent', () => {
  it('for event mail: the From line, one recipient, the reply-to, the subject and both parts, the set and its kind, keys in order', () => {
    expect(JSON.stringify(sesBody(EVENT))).toBe(
      '{"FromEmailAddress":"Louisiana Chess Association <noreply@louisianachess.org>","Destination":{"ToAddresses":["player.one@example.org"]},'
      + '"ReplyToAddresses":["LouisianaChess@gmail.com"],"Content":{"Simple":{"Subject":{"Data":"You\'re registered: Sample Winter Open","Charset":"UTF-8"},'
      + '"Body":{"Html":{"Data":"<p>Example words.</p>","Charset":"UTF-8"},"Text":{"Data":"Example words.","Charset":"UTF-8"}}}},'
      + '"ConfigurationSetName":"lca-mail","EmailTags":[{"Name":"kind","Value":"event"}]}',
    )
    expect(sesBody({ ...EVENT, text: '' }).Content.Simple.Body).toEqual({ Html: { Data: '<p>Example words.</p>', Charset: 'UTF-8' } })
    expect(sesBody({ ...EVENT, text: undefined }).Content.Simple).not.toHaveProperty('Headers')
  })

  it('for list mail: the list\'s own sender, the two one-click headers in order, and the kind and the list as tags', () => {
    const body = sesBody(LIST)
    expect(body.FromEmailAddress).toBe('Louisiana Chess Association <newsletter@news.louisianachess.org>')
    expect(body.Content.Simple.Headers).toEqual([
      { Name: 'List-Unsubscribe', Value: '<https://www.louisianachess.org/api/mail/unsubscribe/sample-link>' },
      { Name: 'List-Unsubscribe-Post', Value: 'List-Unsubscribe=One-Click' },
    ])
    expect(body.EmailTags).toEqual([{ Name: 'kind', Value: 'optional' }, { Name: 'list', Value: NEWSLETTER_LIST_ID }])
    expect(body.ConfigurationSetName).toBe(SES_CONFIGURATION_SET)
    expect(body.Content.Simple.Body).not.toHaveProperty('Text')
  })

  it('for a test of the newsletter: the From line it was given, never DEFAULT_FROM, and the newsletter\'s list tag', () => {
    const test: OutgoingMail = { ...LIST, kind: 'test', through: 'ses', subject: '[TEST] Sample newsletter one' }
    const body = sesBody(test)
    expect(body.FromEmailAddress).toBe('Louisiana Chess Association <newsletter@news.louisianachess.org>')
    expect(body.EmailTags).toEqual([{ Name: 'kind', Value: 'test' }, { Name: 'list', Value: NEWSLETTER_LIST_ID }])
    expect(JSON.stringify(body)).not.toContain('through')
  })

  it('forms the From line as Resend\'s transport does, so event mail and list mail read the same through either service', async () => {
    const resendFrom = async (mail: OutgoingMail) => {
      const caught = answerWith(() => new Response('{"id":"sample"}', { status: 200 }))
      await sendThroughResend({ DB: {} as D1Database, RESEND_API_KEY: 're_sample' }, mail)
      return (JSON.parse(caught[0].body) as { from: string }).from
    }
    for (const mail of [EVENT, { ...EVENT, shape: 'campaign' } as OutgoingMail, LIST]) {
      expect(sesBody(mail).FromEmailAddress).toBe(await resendFrom(mail))
    }
  })

  it('is sent from us-east-1 through the configuration set lca-mail, the region and the set written once each', () => {
    expect(SES_REGION).toBe('us-east-1')
    expect(SES_CONFIGURATION_SET).toBe('lca-mail')
    const text = readFileSync(join(ROOT, 'functions/utils/mail/ses.ts'), 'utf8')
    expect(text.match(/'us-east-1'/g)).toHaveLength(1)
    expect(text.match(/'lca-mail'/g)).toHaveLength(1)
  })
})

describe('the keys', () => {
  it('without both keys makes no request at all and answers keyMissing in plain words, read as later and as a fault of the key', async () => {
    for (const env of [{}, { SES_ACCESS_KEY_ID: 'AKIDEXAMPLE' }, { SES_SECRET_ACCESS_KEY: KEYS.SES_SECRET_ACCESS_KEY }, { SES_ACCESS_KEY_ID: '', SES_SECRET_ACCESS_KEY: '' }]) {
      const caught = answerWith(() => new Response('{}', { status: 200 }))
      const result = await sendThroughSes(env, EVENT)
      expect(caught, JSON.stringify(env)).toEqual([])
      expect(result).toEqual({ ok: false, keyMissing: true, error: SES_KEY_MISSING })
      expect(classifyOnce(result)).toBe('later')
      expect(configFault(result)).toBe(true)
    }
    expect(SES_KEY_MISSING).toBe('No Amazon SES key on this deployment.')
  })

  it('through the seam with MAIL_SENDER \'ses\' and no key: no request, and nothing is handed to Resend instead', async () => {
    const caught = answerWith(() => new Response('{}', { status: 200 }))
    const result = await deliver({ DB: {} as D1Database, RESEND_API_KEY: 're_sample' }, LIST, OPEN)
    expect(result).toEqual({ ok: false, keyMissing: true, error: SES_KEY_MISSING })
    expect(caught).toEqual([])
  })
})

describe('the request', () => {
  it('posts one string, signed as its UTF-8 bytes and sent as it was signed, with exactly the signed headers', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-12T12:00:00.000Z'))
    const caught = answerWith(() => Response.json({ MessageId: 'sample-message-id' }))
    // A half sign in the subject and an accented letter in a name, so the hash is over UTF-8 and not over code units.
    const mail: OutgoingMail = { ...EVENT, subject: 'Sample newsletter ½', html: '<p>Renée Example</p>' }
    const result = await sendThroughSes(KEYS, mail)
    expect(result).toEqual({ ok: true, providerId: 'sample-message-id' })
    expect(caught).toHaveLength(1)
    const [request] = caught
    expect([request.url, request.method]).toEqual([ENDPOINT, 'POST'])
    expect(request.body).toBe(JSON.stringify(sesBody(mail)))
    expect(Object.keys(request.headers).sort()).toEqual(['authorization', 'content-type', 'x-amz-date'])
    expect(request.headers['content-type']).toBe('application/json')
    expect(request.headers['x-amz-date']).toBe('20261112T120000Z')
    const signature = nodeSignature(request, KEYS.SES_SECRET_ACCESS_KEY)
    expect(request.headers.authorization).toBe(
      `AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20261112/us-east-1/ses/aws4_request, SignedHeaders=content-type;host;x-amz-date, Signature=${signature}`,
    )
  })

  it('reads the clock once, at the send', () => {
    const text = readFileSync(join(ROOT, 'functions/utils/mail/ses.ts'), 'utf8')
    expect(text.match(/new Date\(/g)).toHaveLength(1)
    expect(text).not.toMatch(/Date\.now\(/)
  })

  it('takes any 2xx as sent, with Amazon\'s MessageId when the body names one and without it otherwise', async () => {
    answerWith(() => Response.json({ MessageId: 'sample-id' }))
    expect(await sendThroughSes(KEYS, EVENT)).toEqual({ ok: true, providerId: 'sample-id' })
    answerWith(() => new Response('not json', { status: 200 }))
    expect(await sendThroughSes(KEYS, EVENT)).toEqual({ ok: true })
    answerWith(() => new Response(null, { status: 202 }))
    expect(await sendThroughSes(KEYS, EVENT)).toEqual({ ok: true })
  })

  it('lets a fetch that throws reach the seam, which reads it as no answer, never tried again, or under the rules as the runtime\'s limit', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('network connection lost')
    }))
    await expect(sendThroughSes(KEYS, EVENT)).rejects.toThrow('network connection lost')
    const env = { DB: {} as D1Database, RESEND_API_KEY: 're_sample', ...KEYS }
    const lost = await deliver(env, { ...EVENT, kind: 'test' }, OPEN)
    expect(lost).toEqual({ ok: false, noAnswer: true, error: 'network connection lost' })
    expect(classifyOnce(lost)).toBe('never')
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('Too many subrequests by single Worker invocation.')
    }))
    const limited = await deliver(env, { ...EVENT, kind: 'test' }, OPEN)
    expect(limited).toEqual({ ok: false, limitRefused: true, error: 'Too many subrequests by single Worker invocation.' })
    expect(classifyOnce(limited)).toBe('later')
  })
})

/**
 * The table of Amazon's answers: its status, its code, and what it means. Later only when the answer proves the message
 * was not taken; a key fault and a fault of the account's setup give the attempt back as well.
 */
const TABLE: ReadonlyArray<readonly [status: number, code: string | null, kind: 'later' | 'never', fault: boolean]> = [
  [429, 'TooManyRequestsException', 'later', false],
  [400, 'ThrottlingException', 'later', false],
  [400, 'Throttling', 'later', false],
  [503, 'ServiceUnavailable', 'later', false],
  [400, 'SendingPausedException', 'later', false],
  [400, 'AccountSuspendedException', 'later', false],
  [403, 'AccessDeniedException', 'later', true],
  [403, 'UnrecognizedClientException', 'later', true],
  [403, 'InvalidClientTokenId', 'later', true],
  [403, 'SignatureDoesNotMatch', 'later', true],
  [403, 'IncompleteSignature', 'later', true],
  [403, 'ExpiredTokenException', 'later', true],
  [403, 'MissingAuthenticationToken', 'later', true],
  [401, 'NotAuthorized', 'later', true],
  [403, 'OptInRequired', 'later', true],
  [404, 'NotFoundException', 'later', true],
  [400, 'MailFromDomainNotVerifiedException', 'later', true],
  [400, 'MessageRejected', 'never', false],
  [400, 'BadRequestException', 'never', false],
  [400, 'ValidationError', 'never', false],
  [400, 'ValidationException', 'never', false],
  [400, 'LimitExceededException', 'never', false],
  [413, 'RequestEntityTooLargeException', 'never', false],
  [409, null, 'never', false],
  [422, null, 'never', false],
  [500, 'InternalFailure', 'never', false],
  [502, null, 'never', false],
  [504, null, 'never', false],
  [408, 'RequestTimeoutException', 'never', false],
  [400, 'SampleUnknownException', 'never', false],
  [500, 'SampleUnknownException', 'never', false],
]

describe('every answer in the table, to its kind', () => {
  it.each(TABLE)('%i %s is %s', async (status, code, kind, fault) => {
    answerWith(() => refusal(status, code))
    const result = await sendThroughSes(KEYS, EVENT)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.status).toBe(status)
    expect(result.code).toBe(code ?? undefined)
    expect(result.fromSes).toBe(true)
    expect(result.error).toBe(`Amazon SES ${status}${code ? ` ${code}` : ''}: Sample words from Amazon.`)
    expect(classifyOnce(result)).toBe(kind)
    expect(configFault(result)).toBe(fault)
  })

  it('reads ThrottlingException as later with each of the words Amazon gives it, the sending rate and the daily quota', async () => {
    for (const message of ['Maximum sending rate exceeded.', 'Daily message quota exceeded.']) {
      answerWith(() => refusal(400, 'ThrottlingException', { message }))
      const result = await sendThroughSes(KEYS, EVENT)
      expect(classifyOnce(result), message).toBe('later')
      expect(result.ok ? '' : result.error).toBe(`Amazon SES 400 ThrottlingException: ${message}`)
    }
  })

  it('reads a key fault\'s code as a key fault whatever status it comes with, and a 401 or a 403 by its status alone', async () => {
    for (const code of ['AccessDeniedException', 'IncompleteSignature', 'NotAuthorized']) {
      answerWith(() => refusal(400, code))
      const result = await sendThroughSes(KEYS, EVENT)
      expect([classifyOnce(result), configFault(result)], code).toEqual(['later', true])
    }
    for (const status of [401, 403]) {
      answerWith(() => refusal(status, null))
      const result = await sendThroughSes(KEYS, EVENT)
      expect([classifyOnce(result), configFault(result)], String(status)).toEqual(['later', true])
    }
  })
})

describe('Amazon\'s code and words', () => {
  it('reads the code from the x-amzn-errortype header, before its first colon, ahead of the body\'s', async () => {
    expect(amazonCode('MessageRejected:http://internal.amazon.com/coral/com.amazon.coral.service/', { __type: 'x#BadRequestException' })).toBe('MessageRejected')
    expect(amazonCode('TooManyRequestsException', null)).toBe('TooManyRequestsException')
    answerWith(() => refusal(429, 'TooManyRequestsException', { where: 'header' }))
    expect(await sendThroughSes(KEYS, EVENT)).toMatchObject({ status: 429, code: 'TooManyRequestsException' })
  })

  it('reads it from the body\'s __type or code, after the last \'#\', when no header names one', async () => {
    expect(amazonCode(null, { __type: 'com.amazonaws.email.v2#NotFoundException' })).toBe('NotFoundException')
    expect(amazonCode(null, { code: 'MessageRejected' })).toBe('MessageRejected')
    expect(amazonCode(null, { code: 'one#two#SendingPausedException' })).toBe('SendingPausedException')
    expect(amazonCode('', null)).toBeUndefined()
    expect(amazonCode('not a code at all', null)).toBeUndefined()
    answerWith(() => refusal(404, 'NotFoundException', { where: 'body' }))
    expect(await sendThroughSes(KEYS, EVENT)).toMatchObject({ status: 404, code: 'NotFoundException' })
  })

  it('reads a header whose code comes with a namespace before \'#\' as AWS\'s own clients do, so a throttle with a body of words alone is later', async () => {
    const namespaced = 'com.amazonaws.ses#ThrottlingException:http://internal.amazon.com/coral/com.amazon.coral.service/'
    expect(amazonCode(namespaced, null)).toBe('ThrottlingException')
    expect(amazonCode('com.amazonaws.ses#ThrottlingException', null)).toBe('ThrottlingException')
    expect(amazonCode('one#two#SendingPausedException:http://internal.amazon.com/', { __type: 'x#BadRequestException' })).toBe('SendingPausedException')
    answerWith(() => Response.json({ message: 'Maximum sending rate exceeded.' }, { status: 400, headers: { 'x-amzn-errortype': namespaced } }))
    const result = await sendThroughSes(KEYS, EVENT)
    expect(result).toEqual({
      ok: false, status: 400, code: 'ThrottlingException', fromSes: true, error: 'Amazon SES 400 ThrottlingException: Maximum sending rate exceeded.',
    })
    expect(classifyOnce(result)).toBe('later')
    expect(configFault(result)).toBe(false)
  })

  it('reads a header with a comma by what comes before its first comma, and then before its first colon', async () => {
    expect(amazonCode('TooManyRequestsException,com.amazonaws.ses#TooManyRequestsException', null)).toBe('TooManyRequestsException')
    expect(amazonCode('com.amazonaws.ses#AccountSuspendedException,SampleOther:http://internal.amazon.com/', null)).toBe('AccountSuspendedException')
    expect(amazonCode('MessageRejected:http://internal.amazon.com/coral,SampleOther', null)).toBe('MessageRejected')
    expect(amazonCode(',', { __type: 'com.amazonaws.email.v2#NotFoundException' })).toBe('NotFoundException')
    answerWith(() => Response.json({ message: 'Sample words from Amazon.' }, {
      status: 400, headers: { 'x-amzn-errortype': 'com.amazonaws.ses#AccountSuspendedException,AccountSuspendedException' },
    }))
    const result = await sendThroughSes(KEYS, EVENT)
    expect(result).toMatchObject({ status: 400, code: 'AccountSuspendedException', error: 'Amazon SES 400 AccountSuspendedException: Sample words from Amazon.' })
    expect(classifyOnce(result)).toBe('later')
  })

  it('takes every resource name, account number and user name out of an AccessDeniedException\'s words as Amazon writes them, keeping the status and the code', async () => {
    // Amazon's words for a key whose policy lacks the action, the account number and the user plainly made up.
    const message = 'User: arn:aws:iam::123456789012:user/sample-sender is not authorized to perform: ses:SendEmail on resource: '
      + 'arn:aws:ses:us-east-1:123456789012:identity/news.example.org because no identity-based policy allows the ses:SendEmail action'
    answerWith(() => refusal(403, 'AccessDeniedException', { message }))
    const result = await sendThroughSes(KEYS, LIST)
    expect(result).toEqual({
      ok: false, status: 403, code: 'AccessDeniedException', fromSes: true,
      error: 'Amazon SES 403 AccessDeniedException: User: an Amazon resource is not authorized to perform: ses:SendEmail on resource: an Amazon resource '
        + 'because no identity-based policy allows the ses:SendEmail action',
    })
    expect([classifyOnce(result), configFault(result)]).toEqual(['later', true])
    const all = JSON.stringify(result)
    for (const piece of ['arn:', '123456789012', 'user/', 'sample-sender', 'news.example.org']) expect(all, piece).not.toContain(piece)
    expect(all).not.toMatch(/\b\d{12}\b/)
  })

  it('takes a resource name out to the next space, comma, quote or the end, and twelve digits standing alone, before the cut', () => {
    expect(amazonWords('', { message: 'On arn:aws:ses:us-east-1:000000000000:configuration-set/lca-mail, refused.' }, [])).toBe('On an Amazon resource, refused.')
    expect(amazonWords('', { message: 'Not "arn:aws:iam::000000000000:user/sample-sender" nor \'arn:aws-us-gov:iam::000000000000:root\'' }, []))
      .toBe('Not "an Amazon resource" nor \'an Amazon resource\'')
    expect(amazonWords('', { message: 'Last: arn:aws:ses:us-east-1:000000000000:identity/example.org' }, [])).toBe('Last: an Amazon resource')
    expect(amazonWords('', { message: 'Account 000000000000 is paused; 123456789012.' }, [])).toBe('Account an account number is paused; an account number.')
    expect(amazonWords('', { message: 'Eleven 12345678901, thirteen 1234567890123, and 20261112T120000Z.' }, []))
      .toBe('Eleven 12345678901, thirteen 1234567890123, and 20261112T120000Z.')
    expect(amazonWords('<html><body>Denied for arn:aws:iam::000000000000:user/sample-sender</body></html>', null, [])).toBe('<html><body>Denied for an Amazon resource')
    // A resource name that would be cut in half at the end of the 200 characters is taken out first, whole.
    const late = amazonWords('', { message: `${'x'.repeat(AMAZON_WORDS_MAX - 10)} arn:aws:iam::123456789012:user/sample-sender more words` }, [])
    expect(late).toBe(`${'x'.repeat(AMAZON_WORDS_MAX - 10)} an Amazon...`)
    expect(late).not.toMatch(/arn:|\d{4}/)
  })

  it('reads the words from message or Message, a page that is not JSON as its text, each on one line and cut to the length named', () => {
    expect(amazonWords('', { message: 'Email address is not verified.' }, [])).toBe('Email address is not verified.')
    expect(amazonWords('', { Message: 'Account is paused.' }, [])).toBe('Account is paused.')
    expect(amazonWords('<html><body>Bad gateway</body></html>', null, [])).toBe('<html><body>Bad gateway</body></html>')
    expect(amazonWords('{"other":1}', { other: 1 }, [])).toBe('')
    expect(amazonWords('', { message: 'one\n\n  two\tthree' }, [])).toBe('one two three')
    const long = amazonWords('', { message: `The request signature we calculated does not match. ${'POST /v2/email/outbound-emails '.repeat(40)}` }, [])
    expect(long.length).toBe(AMAZON_WORDS_MAX + 3)
    expect(long.endsWith('...')).toBe(true)
    expect(AMAZON_WORDS_MAX).toBe(200)
  })
})

describe('the key and the signature are in no answer the sender gives', () => {
  it('in no SendResult of any row of the table, of no key, of a send that worked, or of an answer that quotes them back', async () => {
    const results: SendResult[] = []
    const signatures: string[] = []
    const keep = (caught: Caught[]) => {
      for (const request of caught) signatures.push(/Signature=([0-9a-f]{64})$/.exec(request.headers.authorization)![1])
    }
    for (const [status, code] of TABLE) {
      const caught = answerWith(() => refusal(status, code))
      results.push(await sendThroughSes(KEYS, EVENT))
      keep(caught)
    }
    let echoed: Caught[] = []
    // An answer that quotes the request's whole Authorization header and the secret back, as Amazon never does.
    echoed = answerWith(() => refusal(403, 'SignatureDoesNotMatch', { message: `Expected ${echoed[0]?.headers.authorization} with ${KEYS.SES_SECRET_ACCESS_KEY}.` }))
    results.push(await sendThroughSes(KEYS, LIST))
    keep(echoed)
    const worked = answerWith(() => Response.json({ MessageId: 'sample-id' }))
    results.push(await sendThroughSes(KEYS, EVENT))
    keep(worked)
    results.push(await sendThroughSes({}, EVENT))

    expect(signatures).toHaveLength(TABLE.length + 2)
    const all = JSON.stringify(results)
    expect(all).not.toContain(KEYS.SES_SECRET_ACCESS_KEY)
    expect(all).not.toContain('Credential=')
    for (const signature of signatures) expect(all).not.toContain(signature)
    expect(results.at(-3)).toMatchObject({ ok: false, status: 403, code: 'SignatureDoesNotMatch' })
  })
})

describe('what Amazon takes in a header and a tag', () => {
  /** Amazon's limits for a header (API_MessageHeader, read on Thursday, November 12, 2026). */
  const NAME = /^[!-9;-~]{1,126}$/
  const VALUE = /^[ -~]{1,995}$/

  it('takes the newsletter\'s two one-click headers as the list path builds them for the longest contact id the site makes', async () => {
    const env = { SITE_URL: 'https://www.louisianachess.org', MAIL_LINK_SECRET: 'sample-made-up-link-key' }
    // A contact's id is always 32 hex characters (mail_contacts.id).
    for (const listId of [NEWSLETTER_LIST_ID, TOURNAMENTS_LIST_ID]) {
      const { headers } = await listMailParts(env, { contactId: 'f'.repeat(32), listId })
      expect(headers.length, listId).toBeLessThanOrEqual(15)
      for (const { name, value } of headers) {
        expect(name, `${listId} ${name}`).toMatch(NAME)
        expect(value, `${listId} ${name}`).toMatch(VALUE)
        expect(name.length + value.length, `${listId} ${name}`).toBeLessThanOrEqual(996)
      }
    }
  })

  it('takes every tag the site can write: each kind of mail and each list\'s id, letters, digits, underscores and hyphens, 256 at most', () => {
    const TAG = /^[A-Za-z0-9_-]{1,256}$/
    const kinds: MailKind[] = ['event', 'optional', 'test']
    for (const kind of kinds) {
      const mail = (kind === 'optional' ? LIST : kind === 'test' ? { ...LIST, kind: 'test' } : EVENT) as OutgoingMail
      for (const tag of sesBody(mail).EmailTags) {
        expect(tag.Name, kind).toMatch(TAG)
        expect(tag.Value, kind).toMatch(TAG)
      }
    }
    for (const listId of [NEWSLETTER_LIST_ID, TOURNAMENTS_LIST_ID]) expect(listId).toMatch(TAG)
  })

  it('needs no quoting for any display name the site can send, so the From line is the same bytes through either service', () => {
    // An address header quotes a display name holding a comma, a quote mark, a period, another of RFC 5322's specials
    // or a letter outside ASCII; the site's names are letters and spaces.
    const ATOMS = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~ -]+$/
    const names = [SENDER_NAME, ...Object.values(LIST_SENDERS).map((sender) => sender!.name)]
    expect(names).toEqual(['Louisiana Chess Association', 'Louisiana Chess Association'])
    for (const name of names) expect(name).toMatch(ATOMS)
  })
})

/** Every file under a folder, skipping what a build or an install makes. */
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(ROOT, dir))) {
    if (['node_modules', '.git', 'dist', '.wrangler', 'test-results', 'playwright-report'].includes(name)) continue
    const path = `${dir}/${name}`
    if (statSync(join(ROOT, path)).isDirectory()) walk(path, out)
    else out.push(path)
  }
  return out
}

describe('Amazon SES\'s two keys live only as Cloudflare secrets K sets (D33)', () => {
  const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
  const NAMES = /SES_ACCESS_KEY_ID|SES_SECRET_ACCESS_KEY/

  it('are given no value by a setting file a deploy reads, the worker\'s naming them only in its comment\'s two secret put lines', () => {
    for (const file of ['wrangler.toml', '.dev.vars', '.dev.vars.example', '.dev.vars.a11y', '.env', '.env.example', '.env.local'].filter((f) => existsSync(join(ROOT, f)))) {
      expect(read(file), file).not.toMatch(NAMES)
    }
    const naming = read('workers/daily-emails/wrangler.toml').split('\n').filter((line) => NAMES.test(line))
    expect(naming).toEqual([
      '#   npx wrangler secret put SES_ACCESS_KEY_ID --config workers/daily-emails/wrangler.toml',
      '#   npx wrangler secret put SES_SECRET_ACCESS_KEY --config workers/daily-emails/wrangler.toml',
    ])
  })

  it('are given a value only by the integration config, AWS\'s documentation key id and a made-up secret, and the browser tests bind both empty', () => {
    const config = read('vitest.integration.config.ts')
    expect(/SES_ACCESS_KEY_ID:\s*'([^']+)'/.exec(config)?.[1]).toBe('AKIDEXAMPLE')
    const madeUp = /SES_SECRET_ACCESS_KEY:\s*'([^']+)'/.exec(config)?.[1]
    expect(madeUp).toMatch(/made-up/)
    const holders = [...walk('functions'), ...walk('domain'), ...walk('src'), ...walk('test'), ...walk('workers'), ...walk('migrations')]
      .filter((f) => /\.(?:ts|tsx|json|toml|sql|md|js)$/.test(f))
      .filter((f) => read(f).includes(madeUp as string))
    expect(holders).toEqual([])
    const setup = read('test/a11y/global-setup.ts')
    const empty = /A11Y_EMPTY_SECRETS\s*=\s*\[([\s\S]*?)\]/.exec(setup)?.[1] ?? ''
    expect(empty).toContain("'SES_ACCESS_KEY_ID'")
    expect(empty).toContain("'SES_SECRET_ACCESS_KEY'")
  })

  it('are read by Amazon SES\'s transport alone, and named elsewhere only on the types of the bindings', () => {
    const readers = walk('functions').concat(walk('workers')).filter((f) => /\benv\??\.SES_(?:ACCESS_KEY_ID|SECRET_ACCESS_KEY)\b/.test(read(f)))
    expect(readers).toEqual(['functions/utils/mail/ses.ts'])
    const naming = walk('functions').concat(walk('workers'), walk('domain'), walk('src')).filter((f) => /\.(?:ts|tsx)$/.test(f) && NAMES.test(read(f))).sort()
    expect(naming).toEqual([
      'functions/types.ts', 'functions/utils/admin/campaigns.ts', 'functions/utils/email.ts', 'functions/utils/mail/send.ts', 'functions/utils/mail/ses.ts',
      'workers/daily-emails/src/index.ts',
    ])
  })

  it('carry AWS\'s documentation key id only in tests and their config, each saying it opens nothing', () => {
    const files = [...walk('functions'), ...walk('domain'), ...walk('src'), ...walk('test'), ...walk('workers'), 'vitest.integration.config.ts']
      .filter((f) => /\.(?:ts|tsx)$/.test(f) && read(f).includes('AKIDEXAMPLE'))
      .sort()
    expect(files).toEqual([
      'test/integration/harness.ts', 'test/integration/ses-path-edges.test.ts', 'test/integration/ses-path.test.ts', 'test/unit/ses-edges.test.ts',
      'test/unit/ses-sender.test.ts', 'test/unit/sigv4.test.ts', 'vitest.integration.config.ts',
    ])
    for (const file of files) expect(read(file), file).toMatch(/opens nothing/)
  })
})
