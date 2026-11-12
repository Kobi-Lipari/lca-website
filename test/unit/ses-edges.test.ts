// test/unit/ses-edges.test.ts
//
// The edges of Amazon SES's transport and of the kinds an answer is read to,
// beside test/unit/ses-sender.test.ts and test/unit/sigv4.test.ts: the day
// a request is signed on at midnight, at the end of a year, on a leap day
// and at the two changes of the clock in America/Chicago (a signature is in
// UTC, so none of them moves it); the order the kinds are read in when an
// answer carries more than one mark; Amazon's words cut at the edge of the
// length they are kept to, with the secret taken out before the cut; an
// answer with no body; and the plain words the new files and their answers
// are held to.
//
// AKIDEXAMPLE and the secret wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY are
// the example key of AWS's own documentation: they open nothing. Every
// address, name and subject here is plainly made up.
import { createHash, createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_FROM, DEFAULT_REPLY_TO } from '../../domain/mail/addresses'
import { classifyOnce, configFault } from '../../functions/utils/mail/outcome'
import { REFUSAL_WORDS, GATE_UNREAD_WORDS, WAIT_FOR_SES_WORDS, type OutgoingMail, type SendResult } from '../../functions/utils/mail/send'
import { AMAZON_WORDS_MAX, SES_KEY_MISSING, amazonWords, sendThroughSes, sesBody } from '../../functions/utils/mail/ses'

/** The em dash and the en dash, written by code so no line of this file holds one. */
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
/** The names of assistants and tools no source or test may carry, joined from pieces so this line names none itself. */
const NO_ASSISTANT_NAMES = new RegExp(`\\b(${['cla' + 'ude', 'anthro' + 'pic', 'chat' + 'gpt', 'copi' + 'lot', 'open' + 'ai'].join('|')})\\b`, 'i')
const ROOT = resolve(__dirname, '../..')
/** AWS's documentation key, which opens nothing. */
const KEYS = { SES_ACCESS_KEY_ID: 'AKIDEXAMPLE', SES_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY' }

const EVENT: OutgoingMail = {
  from: DEFAULT_FROM,
  to: 'player.one@example.org',
  replyTo: DEFAULT_REPLY_TO,
  subject: 'Sample message one',
  html: '<p>Example words.</p>',
  shape: 'single',
}

interface Caught { headers: Record<string, string>; body: string }

function answerWith(answer: () => Response): Caught[] {
  const caught: Caught[] = []
  vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    caught.push({ headers: Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>)), body: String(init?.body) })
    return answer()
  }))
  return caught
}

const sha256 = (data: Buffer | string) => createHash('sha256').update(data).digest('hex')

/** The signature node:crypto works out for the request that was sent, apart from the signer. */
function nodeSignature(request: Caught): string {
  const time = request.headers['x-amz-date']
  const date = time.slice(0, 8)
  const canonical = [
    'POST', '/v2/email/outbound-emails', '',
    `content-type:${request.headers['content-type']}\nhost:email.us-east-1.amazonaws.com\nx-amz-date:${time}\n`,
    'content-type;host;x-amz-date', sha256(Buffer.from(request.body, 'utf8')),
  ].join('\n')
  let key: Buffer = createHmac('sha256', `AWS4${KEYS.SES_SECRET_ACCESS_KEY}`).update(date).digest()
  for (const part of ['us-east-1', 'ses', 'aws4_request']) key = createHmac('sha256', key).update(part).digest()
  return createHmac('sha256', key).update(['AWS4-HMAC-SHA256', time, `${date}/us-east-1/ses/aws4_request`, sha256(canonical)].join('\n')).digest('hex')
}

/** Sends one message with the clock held at an instant, and says what the request carried. */
async function sendAt(instant: string, mail: OutgoingMail = EVENT): Promise<Caught> {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(instant))
  const caught = answerWith(() => Response.json({ MessageId: 'sample-id' }))
  expect(await sendThroughSes(KEYS, mail)).toEqual({ ok: true, providerId: 'sample-id' })
  expect(caught).toHaveLength(1)
  return caught[0]
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('the day and the time a request is signed on', () => {
  // [the instant, what x-amz-date must say, a note]
  const INSTANTS: ReadonlyArray<readonly [string, string, string]> = [
    ['2026-11-12T23:59:59.999Z', '20261112T235959Z', 'the last millisecond of Thursday, November 12, 2026'],
    ['2026-11-13T00:00:00.000Z', '20261113T000000Z', 'midnight, the first instant of Friday, November 13, 2026'],
    ['2026-12-31T23:59:59.000Z', '20261231T235959Z', 'the last second of Thursday, December 31, 2026'],
    ['2027-01-01T00:00:00.000Z', '20270101T000000Z', 'the first second of Friday, January 1, 2027'],
    ['2028-02-29T12:00:00.000Z', '20280229T120000Z', 'a leap day, Tuesday, February 29, 2028'],
    ['2026-03-08T07:59:59.000Z', '20260308T075959Z', 'the last second before the clocks in America/Chicago spring forward, Sunday, March 8, 2026'],
    ['2026-03-08T08:00:00.000Z', '20260308T080000Z', 'the first second of daylight time in America/Chicago, 3:00 AM CDT'],
    ['2026-11-01T06:30:00.000Z', '20261101T063000Z', '1:30 AM CDT on Sunday, November 1, 2026, the first of the repeated hour'],
    ['2026-11-01T07:30:00.000Z', '20261101T073000Z', '1:30 AM CST on Sunday, November 1, 2026, the second of the repeated hour'],
  ]

  it.each(INSTANTS)('%s is signed as %s: %s', async (instant, stamp) => {
    const request = await sendAt(instant)
    expect(request.headers['x-amz-date']).toBe(stamp)
    const [date, signature] = [stamp.slice(0, 8), nodeSignature(request)]
    expect(request.headers.authorization).toBe(
      `AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/${date}/us-east-1/ses/aws4_request, SignedHeaders=content-type;host;x-amz-date, Signature=${signature}`,
    )
  })

  it('signs the two sides of midnight with two different keys, each under its own day, so no signature carries yesterday\'s key into today', async () => {
    const before = await sendAt('2026-11-12T23:59:59.999Z')
    vi.useRealTimers()
    const after = await sendAt('2026-11-13T00:00:00.000Z')
    expect(before.headers.authorization).toContain('/20261112/')
    expect(after.headers.authorization).toContain('/20261113/')
    expect(before.headers.authorization).not.toBe(after.headers.authorization)
    // The same body one second apart signs differently by the time alone, and neither is the other's.
    expect(nodeSignature(before)).not.toBe(nodeSignature(after))
  })

  it('writes the repeated hour of the clock change as two different instants an hour apart, never the same stamp twice', async () => {
    const first = await sendAt('2026-11-01T06:30:00.000Z')
    vi.useRealTimers()
    const second = await sendAt('2026-11-01T07:30:00.000Z')
    expect(first.headers['x-amz-date']).not.toBe(second.headers['x-amz-date'])
    expect(first.headers['x-amz-date'].slice(0, 8)).toBe(second.headers['x-amz-date'].slice(0, 8))
  })

  it('is in UTC whatever zone the runtime names: the stamp is the same for a runtime set to America/Chicago', async () => {
    const was = process.env.TZ
    process.env.TZ = 'America/Chicago'
    try {
      const request = await sendAt('2026-11-13T02:00:00.000Z')
      // 8:00 PM CST on Thursday, November 12, 2026 in Chicago is already Friday, November 13, 2026 in UTC.
      expect(request.headers['x-amz-date']).toBe('20261113T020000Z')
      expect(request.headers.authorization).toContain('/20261113/us-east-1/ses/aws4_request')
    } finally {
      if (was === undefined) delete process.env.TZ
      else process.env.TZ = was
    }
  })
})

describe('what the bytes of a body are, as Amazon reads them', () => {
  it('signs the hash of the UTF-8 bytes of a subject with a half sign and a name with an accented letter, not of its code units', async () => {
    const mail: OutgoingMail = { ...EVENT, subject: 'Sample round 1½', html: '<p>Renée Example, café</p>', fromName: 'Renée Example' }
    const request = await sendAt('2026-11-12T12:00:00.000Z', mail)
    // Two bytes for the half sign and for each accented letter: the body's byte length is longer than its string.
    expect(Buffer.byteLength(request.body, 'utf8')).toBeGreaterThan(request.body.length)
    expect(request.headers.authorization.endsWith(`Signature=${nodeSignature(request)}`)).toBe(true)
    const sent = JSON.parse(request.body) as { Content: { Simple: { Subject: { Data: string } } }; FromEmailAddress: string }
    expect(sent.Content.Simple.Subject.Data).toBe('Sample round 1½')
    expect(sent.Content.Simple.Subject.Data).not.toContain('.5')
    expect(sent.FromEmailAddress).toBe(`Renée Example <${DEFAULT_FROM}>`)
  })

  it('leaves the plain-text part out when it is empty, and the header list out when it is empty, and tags an event with its kind alone', () => {
    const body = sesBody({ ...EVENT, text: '' })
    expect(body.Content.Simple.Body).toEqual({ Html: { Data: '<p>Example words.</p>', Charset: 'UTF-8' } })
    expect(Object.keys(body.Content.Simple)).toEqual(['Subject', 'Body'])
    expect(body.EmailTags).toEqual([{ Name: 'kind', Value: 'event' }])
  })

  it('tags a test of a list with its kind and its list, and a test of none with its kind alone', () => {
    expect(sesBody({ ...EVENT, kind: 'test', listId: 'newsletter' }).EmailTags).toEqual([{ Name: 'kind', Value: 'test' }, { Name: 'list', Value: 'newsletter' }])
    expect(sesBody({ ...EVENT, kind: 'test' }).EmailTags).toEqual([{ Name: 'kind', Value: 'test' }])
  })
})

describe('the kind when an answer carries more than one mark', () => {
  const fail = (extra: Partial<Exclude<SendResult, { ok: true }>>): SendResult => ({ ok: false, error: 'Sample words.', ...extra })

  // [what the answer carries, the kind, whether it is a fault of the key or the setup]
  const ROWS: ReadonlyArray<readonly [string, SendResult, 'sent' | 'later' | 'never', boolean]> = [
    ['a refusal by the seam beside a 429 stays never: the seam\'s word is final', fail({ refused: 'do_not_send', status: 429 }), 'never', false],
    ['a refusal by the seam beside a key fault\'s status stays never', fail({ refused: 'opted_out', status: 403 }), 'never', true],
    ['list mail refused for its headers is never, with nothing sent', fail({ refused: 'not_list_mail' }), 'never', false],
    ['a gate that could not be read is later', fail({ gateUnread: true }), 'later', false],
    ['list mail waiting for Amazon SES is later', fail({ waitForSes: true }), 'later', false],
    ['a request the runtime would not make is later', fail({ limitRefused: true }), 'later', false],
    ['a request with no answer, alone, is never', fail({ noAnswer: true }), 'never', false],
    ['a missing key is later and a fault of the key', fail({ keyMissing: true }), 'later', true],
    ['a 429 with a code that names a rejection is later: the status proves the message was not taken', fail({ status: 429, code: 'MessageRejected' }), 'later', false],
    ['a 503 with an unknown code is later', fail({ status: 503, code: 'SampleUnknownException' }), 'later', false],
    ['a 502 with a throttle\'s code is later: the code proves it', fail({ status: 502, code: 'TooManyRequestsException' }), 'later', false],
    ['a 403 with a rejection\'s code is a key fault by its status alone', fail({ status: 403, code: 'MessageRejected' }), 'later', true],
    ['a 401 with no code is a key fault', fail({ status: 401 }), 'later', true],
    ['a 400 with the setup fault\'s code is a fault of the account\'s setup', fail({ status: 400, code: 'NotFoundException' }), 'later', true],
    ['a 200 is sent whatever else it carries', { ok: true, providerId: 'sample-id' }, 'sent', false],
    ['a 500 with no code is never', fail({ status: 500 }), 'never', false],
    ['a 504 with no code is never', fail({ status: 504 }), 'never', false],
    ['a 408 with its code is never', fail({ status: 408, code: 'RequestTimeoutException' }), 'never', false],
    ['a 400 with no code is never', fail({ status: 400 }), 'never', false],
    ['a 413 with no code is never', fail({ status: 413 }), 'never', false],
    ['an answer with no status, no code and no mark is never', fail({}), 'never', false],
    ['a 500 that names no known code is never', fail({ status: 500, code: 'InternalFailure' }), 'never', false],
  ]

  it.each(ROWS)('%s', (_, result, kind, fault) => {
    expect(classifyOnce(result)).toBe(kind)
    expect(configFault(result)).toBe(fault)
  })

  it('reads the seam\'s own words for a refusal and a hold as plain words with no dash and no 24-hour time', () => {
    const words = [...Object.values(REFUSAL_WORDS), GATE_UNREAD_WORDS, WAIT_FOR_SES_WORDS, SES_KEY_MISSING]
    for (const line of words) {
      expect(line).not.toMatch(DASHES)
      expect(line).not.toMatch(/\bUSCF\b/)
      expect(line).not.toMatch(/\b\d{1,2}:\d{2}\b/)
    }
  })
})

describe('Amazon\'s words at the edge of the length they are kept to', () => {
  const SECRET = KEYS.SES_SECRET_ACCESS_KEY

  it('keeps exactly the length named whole, with no ellipsis, and one more than it with one', () => {
    expect(amazonWords('', { message: 'a'.repeat(AMAZON_WORDS_MAX) }, [])).toBe('a'.repeat(AMAZON_WORDS_MAX))
    expect(amazonWords('', { message: 'a'.repeat(AMAZON_WORDS_MAX + 1) }, [])).toBe(`${'a'.repeat(AMAZON_WORDS_MAX)}...`)
  })

  it('takes the secret out before it cuts, so a cut through the middle of it leaves no piece of it', () => {
    for (const lead of [AMAZON_WORDS_MAX - 5, AMAZON_WORDS_MAX - 20, AMAZON_WORDS_MAX - 1, 0]) {
      const words = amazonWords('', { message: `${'x'.repeat(lead)}${SECRET}${'y'.repeat(60)}` }, [SECRET])
      expect(words).not.toContain(SECRET)
      // Not even the start of it, which a cut would have left behind had the secret been taken out afterwards.
      expect(words).not.toContain(SECRET.slice(0, 8))
      expect(words.length).toBeLessThanOrEqual(AMAZON_WORDS_MAX + 3)
    }
  })

  it('takes out a word that appears twice, and ignores an empty word to hide, which would split every character apart', () => {
    expect(amazonWords('', { message: `a ${SECRET} b ${SECRET} c` }, [SECRET, ''])).toBe('a b c')
  })

  it('answers a refusal with no body at all as its status alone, and a 2xx with an unreadable body as sent', async () => {
    answerWith(() => new Response(null, { status: 500 }))
    expect(await sendThroughSes(KEYS, EVENT)).toEqual({ ok: false, status: 500, fromSes: true, error: 'Amazon SES 500' })
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, headers: new Headers(), text: async () => { throw new Error('body lost') } }) as unknown as Response))
    expect(await sendThroughSes(KEYS, EVENT)).toEqual({ ok: true })
  })

  it('reads no code from a name that is not one: too long, or with spaces or a colon inside it after the first', async () => {
    answerWith(() => Response.json({ __type: `x#${'A'.repeat(65)}`, message: 'Sample words.' }, { status: 400 }))
    const long = await sendThroughSes(KEYS, EVENT)
    expect(long).toEqual({ ok: false, status: 400, fromSes: true, error: 'Amazon SES 400: Sample words.' })
    expect(classifyOnce(long)).toBe('never')
    answerWith(() => Response.json({ __type: 'x#Not A Code', message: 'Sample words.' }, { status: 429 }))
    expect(classifyOnce(await sendThroughSes(KEYS, EVENT))).toBe('later')
  })

  it('never puts the authorization header, the signature or the secret into the words, for any answer that quotes one back', async () => {
    let caught: Caught[] = []
    caught = answerWith(() => Response.json({ message: `Expected ${caught[0]?.headers.authorization} and ${SECRET}` }, { status: 403, headers: { 'x-amzn-errortype': 'SignatureDoesNotMatch' } }))
    const result = await sendThroughSes(KEYS, EVENT)
    const signature = /Signature=([0-9a-f]{64})$/.exec(caught[0].headers.authorization)![1]
    const text = JSON.stringify(result)
    for (const secret of [SECRET, signature, caught[0].headers.authorization, 'Credential=']) expect(text).not.toContain(secret)
  })
})

describe('the new files hold the plain words', () => {
  const FILES = ['functions/utils/mail/ses.ts', 'functions/utils/mail/sigv4.ts']

  it.each(FILES)('%s has no em dash, no en dash, no old initials for US Chess and no mention of an assistant or a tool', (file) => {
    const text = readFileSync(join(ROOT, file), 'utf8')
    expect(text).not.toMatch(DASHES)
    expect(text).not.toMatch(/\bUSCF\b/)
    expect(text).not.toMatch(NO_ASSISTANT_NAMES)
  })
})
