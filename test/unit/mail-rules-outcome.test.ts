// test/unit/mail-rules-outcome.test.ts
//
// The small files of the mail seam that the byte tests reach only through
// the senders (WS16 step 1): what the two constants mean together
// (functions/utils/mail/rules.ts, read at each call), today's retry rule
// for an answer (functions/utils/mail/outcome.ts), the seam's answer for a
// sender it holds no transport for (functions/utils/mail/send.ts), and the
// one module that holds every address (domain/mail/addresses.ts), which
// holds today's three values and, since WS16 step 4, each LCA list's
// sender in the form K decided from the address map on Wednesday,
// November 11, 2026, the newsletter's alone so far, and nothing more. The
// suite mocks functions/utils/mail/switches over the real
// module and sets both constants in every case, so a value the code ships
// with decides none. WS16 step 2 adds the rule under the engine's rules,
// classifyOnce, with configFault and classify, which picks between the
// two rules at each call.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as addresses from '../../domain/mail/addresses'
import { NEWSLETTER_LIST_ID } from '../../domain/mail/lists'
import { DEFAULT_FROM, DEFAULT_REPLY_TO } from '../../functions/utils/email'
import { classify, classifyOnce, classifyToday, configFault } from '../../functions/utils/mail/outcome'
import { engineRulesOn, senderNow } from '../../functions/utils/mail/rules'
import { SENDER_NAME, deliver } from '../../functions/utils/mail/send'
import type { SendResult } from '../../functions/utils/mail/send'

const flags = vi.hoisted(() => ({ listsOn: false, sender: 'resend' }))
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
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

beforeEach(() => {
  flags.listsOn = false
  flags.sender = 'resend'
})

describe('rules: what the constants mean together, read at each call', () => {
  it('senderNow answers MAIL_SENDER as it is at the call, so a getter on the mocked module decides it', () => {
    flags.sender = 'resend'
    expect(senderNow()).toBe('resend')
    flags.sender = 'ses'
    expect(senderNow()).toBe('ses')
    flags.sender = 'resend'
    expect(senderNow()).toBe('resend')
  })

  it('engineRulesOn is true when MAIL_LISTS_ON is set or Amazon SES sends, and false otherwise, in every pairing', () => {
    const cases: Array<[boolean, string, boolean]> = [
      [false, 'resend', false],
      [true, 'resend', true],
      [false, 'ses', true],
      [true, 'ses', true],
    ]
    for (const [listsOn, sender, expected] of cases) {
      flags.listsOn = listsOn
      flags.sender = sender
      expect(engineRulesOn(), `MAIL_LISTS_ON ${listsOn}, MAIL_SENDER ${sender}`).toBe(expected)
    }
  })

  it('engineRulesOn follows a constant that changes between two calls: nothing is kept from the first', () => {
    expect(engineRulesOn()).toBe(false)
    flags.listsOn = true
    expect(engineRulesOn()).toBe(true)
    flags.listsOn = false
    expect(engineRulesOn()).toBe(false)
  })
})

describe('outcome: classifyToday is the retry rule Group email has always used', () => {
  const refused = (status?: number): SendResult => ({ ok: false, status, error: 'words' })

  it('an accepted message is sent, with or without an id from the service', () => {
    expect(classifyToday({ ok: true })).toBe('sent')
    expect(classifyToday({ ok: true, providerId: 'msg-1' })).toBe('sent')
  })

  it('a request that threw is tried again later, whatever else the answer carries', () => {
    expect(classifyToday({ ok: false, noAnswer: true, error: 'fetch failed' })).toBe('later')
    expect(classifyToday({ ok: false, noAnswer: true, status: 400, error: 'fetch failed' })).toBe('later')
  })

  it('429 and every status from 500 up are tried again later, at both edges', () => {
    for (const status of [429, 500, 501, 503, 504, 599, 600]) expect(classifyToday(refused(status)), String(status)).toBe('later')
  })

  it('every other refusal is never tried again, at both edges of the range that is', () => {
    for (const status of [400, 401, 403, 404, 408, 409, 422, 428, 430, 499]) expect(classifyToday(refused(status)), String(status)).toBe('never')
  })

  it('a refusal with no status is never tried again, as an answer with no status was', () => {
    expect(classifyToday(refused(undefined))).toBe('never')
    expect(classifyToday({ ok: false, code: 'rejected', error: 'words' })).toBe('never')
  })
})

describe('outcome: classifyOnce tries a message again only when the answer proves it was not taken', () => {
  const answer = (over: Partial<Extract<SendResult, { ok: false }>>): SendResult => ({ ok: false, error: 'words', ...over })

  it('an accepted message is sent, with or without an id from the service', () => {
    expect(classifyOnce({ ok: true })).toBe('sent')
    expect(classifyOnce({ ok: true, providerId: 'msg-1' })).toBe('sent')
  })

  it('the gate\'s three refusals are never tried again, whatever else the answer carries', () => {
    for (const refusal of ['not_sendable', 'do_not_send', 'opted_out'] as const) {
      expect(classifyOnce(answer({ refused: refusal })), refusal).toBe('never')
      expect(classifyOnce(answer({ refused: refusal, status: 503 })), refusal).toBe('never')
    }
  })

  it('list mail held back by a gate that could not be read, and a call the runtime refused, are tried again later', () => {
    expect(classifyOnce(answer({ gateUnread: true }))).toBe('later')
    expect(classifyOnce(answer({ limitRefused: true }))).toBe('later')
  })

  it('the seam\'s two answers for list mail of WS16 step 3: refused without its headers, never; held back while Resend sends, later', () => {
    expect(classifyOnce(answer({ refused: 'not_list_mail' }))).toBe('never')
    expect(classifyOnce(answer({ refused: 'not_list_mail', status: 503 }))).toBe('never')
    expect(classifyOnce(answer({ waitForSes: true }))).toBe('later')
    expect(classifyOnce(answer({ waitForSes: true, status: 400 }))).toBe('later')
  })

  it('429 and 503 are tried again later; every other status, each other 5xx among them, never', () => {
    for (const status of [429, 503]) expect(classifyOnce(answer({ status })), String(status)).toBe('later')
    for (const status of [400, 404, 408, 409, 422, 428, 430, 500, 501, 502, 504, 599]) expect(classifyOnce(answer({ status })), String(status)).toBe('never')
  })

  it('Amazon\'s codes for a throttle, a pause or a suspended account are tried again later, and any other code never', () => {
    for (const code of ['TooManyRequestsException', 'ThrottlingException', 'Throttling', 'SendingPausedException', 'AccountSuspendedException']) {
      expect(classifyOnce(answer({ code, status: 400 })), code).toBe('later')
    }
    for (const code of ['MessageRejected', 'MailFromDomainNotVerifiedException', 'throttling', 'BadRequestException']) {
      expect(classifyOnce(answer({ code, status: 400 })), code).toBe('never')
    }
  })

  it('a key or permission fault is tried again later, and configFault names it and nothing else', () => {
    for (const status of [401, 403]) {
      expect(configFault(answer({ status })), String(status)).toBe(true)
      expect(classifyOnce(answer({ status })), String(status)).toBe('later')
    }
    for (const result of [answer({ status: 400 }), answer({ status: 429 }), answer({ status: 500 }), answer({}), { ok: true } as const]) {
      expect(configFault(result), JSON.stringify(result)).toBe(false)
    }
  })

  it('a request with no answer is never tried again, since it may have reached the service, and neither is a refusal with no status', () => {
    expect(classifyOnce(answer({ noAnswer: true }))).toBe('never')
    expect(classifyOnce(answer({}))).toBe('never')
    expect(classifyOnce({ ok: false, error: 'No transport for no-such-service' })).toBe('never')
  })
})

describe('outcome: classify picks the rule that holds, at each call', () => {
  it('reads today\'s rule while the engine\'s rules are off, and classifyOnce once either constant turns them on', () => {
    const noAnswer: SendResult = { ok: false, noAnswer: true, error: 'fetch failed' }
    const fiveHundred: SendResult = { ok: false, status: 500, error: 'oops' }
    expect([classify(noAnswer), classify(fiveHundred)]).toEqual(['later', 'later'])
    flags.listsOn = true
    expect([classify(noAnswer), classify(fiveHundred)]).toEqual(['never', 'never'])
    flags.listsOn = false
    flags.sender = 'ses'
    expect([classify(noAnswer), classify(fiveHundred)]).toEqual(['never', 'never'])
    flags.sender = 'resend'
    expect([classify(noAnswer), classify(fiveHundred)]).toEqual(['later', 'later'])
  })
})

describe('the seam: a sender it holds no transport for', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('makes no request and answers a refusal without the no-answer mark, which is never tried again', async () => {
    flags.listsOn = false
    flags.sender = 'no-such-service'
    const requests = vi.fn(async () => new Response('{"id":"sent"}', { status: 200 }))
    vi.stubGlobal('fetch', requests)
    const result = await deliver(
      { RESEND_API_KEY: 're_test_no_transport' },
      { from: DEFAULT_FROM, to: 'pat.member@example.org', replyTo: DEFAULT_REPLY_TO, subject: 'Fall news', html: '<p>Hi</p>', shape: 'single' },
    )
    expect(requests).not.toHaveBeenCalled()
    expect(result).toStrictEqual({ ok: false, error: 'No transport for no-such-service' })
    expect(Object.keys(result)).not.toContain('noAnswer')
    expect(classifyToday(result)).toBe('never')
  })
})

describe('addresses: today\'s three values and each list\'s sender in one place, and nothing more', () => {
  it('holds exactly the sender of record, the reply-to address, the display name and the newsletter\'s sender, word for word', () => {
    expect(Object.keys(addresses).sort()).toEqual(['DEFAULT_FROM', 'DEFAULT_REPLY_TO', 'LIST_SENDERS', 'SENDER_NAME'])
    expect(addresses.DEFAULT_FROM).toBe('noreply@louisianachess.org')
    expect(addresses.DEFAULT_REPLY_TO).toBe('LouisianaChess@gmail.com')
    expect(addresses.SENDER_NAME).toBe('Louisiana Chess Association')
    // The newsletter's sender as K decided it on Wednesday, November 11, 2026, keyed by the list's own id.
    expect(addresses.LIST_SENDERS).toEqual({ [NEWSLETTER_LIST_ID]: { from: 'newsletter@news.louisianachess.org', name: 'Louisiana Chess Association' } })
  })

  it('is read through email.ts and the seam as the same values, so every old import still finds them', () => {
    expect(DEFAULT_FROM).toBe(addresses.DEFAULT_FROM)
    expect(DEFAULT_REPLY_TO).toBe(addresses.DEFAULT_REPLY_TO)
    expect(SENDER_NAME).toBe(addresses.SENDER_NAME)
  })

  it('writes exactly the two addresses it has always held and the newsletter\'s, no other address and no postal address', () => {
    const code = read('domain/mail/addresses.ts')
      .split('\n')
      .filter((line) => !/^\s*(?:\/\/|\/\*\*|\*)/.test(line))
      .join('\n')
    expect(code.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g)).toEqual(['noreply@louisianachess.org', 'LouisianaChess@gmail.com', 'newsletter@news.louisianachess.org'])
    expect(code).not.toMatch(/postal|street|P\.?O\.? box|zip/i)
    expect(code.match(/^export const /gm)).toHaveLength(4)
    expect(read('domain/mail/addresses.ts')).not.toMatch(/^\s*import\b/m)
  })
})

describe('the seam\'s new files follow the plain-language rules', () => {
  const FILES = [
    'domain/mail/addresses.ts',
    'functions/utils/mail/switches.ts',
    'functions/utils/mail/rules.ts',
    'functions/utils/mail/send.ts',
    'functions/utils/mail/resend.ts',
    'functions/utils/mail/outcome.ts',
  ]
  const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
  const OLD_INITIALS = new RegExp(`\\b${'US' + 'CF'}\\b`)
  const TOOLS = new RegExp(`\\b(${['cla' + 'ude', 'anthr' + 'opic', 'chat' + 'gpt', 'open' + 'ai', 'copi' + 'lot', 'gem' + 'ini', 'A' + 'I-generated', 'generated ' + 'with', 'co-' + 'authored'].join('|')})\\b|\\b${'A' + 'I'}\\b`, 'i')

  it('holds no em or en dash, no old initials for US Chess and no mention of a tool', () => {
    for (const file of FILES) {
      const text = read(file)
      expect(text, `${file}: a dash`).not.toMatch(DASHES)
      expect(text, `${file}: old initials`).not.toMatch(OLD_INITIALS)
      expect(text, `${file}: a tool`).not.toMatch(TOOLS)
    }
  })

  it('the seam, its rules and its outcome read no setting of the environment and import no package', () => {
    for (const file of ['functions/utils/mail/switches.ts', 'functions/utils/mail/rules.ts', 'functions/utils/mail/outcome.ts', 'domain/mail/addresses.ts']) {
      const text = read(file)
      expect(text, file).not.toMatch(/process\.|import\.meta/)
      expect(text, file).not.toMatch(/from '(?!\.)/)
    }
  })
})
