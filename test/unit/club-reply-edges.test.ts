// test/unit/club-reply-edges.test.ts
//
// The edges of the Reply through LCA link as plain code: the first lines at the
// cap and one short of it, nothing in a message to carry, a name that is only
// white space or a first word of several scripts, a link at the widest claim
// the contact form allows, a link whose token is changed one character at a
// time, a key that is too short, and the plain-language rules over the files
// the step adds (no long dash, no abbreviation for US Chess, no word about how
// the text was made). Every name, address and key is made up.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CONTACT_LIMITS } from '../../domain/clubs/contactMessage'
import { REPLY_EXCERPT_LENGTH, REPLY_PURPOSE, REPLY_TTL_SECONDS, firstLines, firstNameOf, openReplyLink, replyLink } from '../../functions/utils/clubs/reply'
import { MAX_TOKEN_LENGTH, openToken } from '../../functions/utils/tokens'

const KEY = 'example-made-up-signing-key-for-the-edges-unit-0027'
const SITE = 'https://www.louisianachess.org'
const CLUB = 'club-example-0027'
const tokenOf = (link: string) => decodeURIComponent(link.slice(`${SITE}/clubs/reply/`.length))

describe('the first lines at the cap', () => {
  it('a message of exactly the cap is carried whole and one over is cut with an ellipsis, neither longer than the cap', () => {
    const exact = 'a'.repeat(REPLY_EXCERPT_LENGTH)
    expect(firstLines(exact)).toBe(exact)
    const over = firstLines('a'.repeat(REPLY_EXCERPT_LENGTH + 1))
    expect(over.length).toBe(REPLY_EXCERPT_LENGTH)
    expect(over.endsWith('…')).toBe(true)
    // Words of 5 characters: the cut lands on a space and never inside a word.
    const words = firstLines('word '.repeat(REPLY_EXCERPT_LENGTH))
    expect(words.length).toBeLessThanOrEqual(REPLY_EXCERPT_LENGTH)
    expect(words).toMatch(/^(word )*word…$/)
  })

  it('white space, line breaks and control characters become single spaces, and nothing at all is the empty line', () => {
    expect(firstLines('')).toBe('')
    expect(firstLines(' \n\t\r\n ')).toBe('')
    expect(firstLines('One\r\n\r\nTwo\u0000Three Four Five')).toBe('One Two Three Four Five')
  })

  it('an emoji or a letter with a mark that falls at the cap is not cut in half', () => {
    for (const unit of ['\u{1F600}', 'é', '\u{1D11E}']) {
      for (let pad = 0; pad < 3; pad++) {
        const cut = firstLines('x'.repeat(REPLY_EXCERPT_LENGTH - 3 + pad) + unit.repeat(20))
        expect(cut.length).toBeLessThanOrEqual(REPLY_EXCERPT_LENGTH)
        expect(cut).not.toMatch(/[\uD800-\uDBFF]…?$/)
        expect(cut).not.toMatch(/(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/)
      }
    }
  })
})

describe('the first name', () => {
  it('is the first word of the name, in any script, and is never empty', () => {
    expect(firstNameOf('Renée Example')).toBe('Renée')
    expect(firstNameOf('Élodie\tExample')).toBe('Élodie')
    expect(firstNameOf('张 伟')).toBe('张')
    expect(firstNameOf('   ')).toBe('them')
    expect(firstNameOf('')).toBe('them')
    expect(firstNameOf('Player\r\nBcc: stranger@example.org')).toBe('Player')
  })
})

describe('the link at its widest', () => {
  it('stays under the token cap with the longest name, address and first lines the contact form allows, in the widest characters', async () => {
    const widest = {
      name: '\u{1F600}'.repeat(Math.floor(CONTACT_LIMITS.name / 2)),
      email: `${'a'.repeat(CONTACT_LIMITS.email - '@example.org'.length)}@example.org`,
      message: '€'.repeat(CONTACT_LIMITS.message),
    }
    const link = await replyLink({ SIGNING_SECRET: KEY }, SITE, widest, CLUB)
    expect(link).not.toBeNull()
    const token = tokenOf(link!)
    expect(token.length).toBeLessThanOrEqual(MAX_TOKEN_LENGTH)
    // The excerpt is capped whatever the message, so the link does not grow with it.
    const short = await replyLink({ SIGNING_SECRET: KEY }, SITE, { ...widest, message: 'Hello.' }, CLUB)
    expect(link!.length).toBeLessThan(short!.length + REPLY_EXCERPT_LENGTH * 9)
    const opened = await openReplyLink({ SIGNING_SECRET: KEY }, token, new Date())
    expect(opened.ok).toBe(true)
  })
})

describe('a changed token', () => {
  it('is refused whichever single character is changed, in the same way each time', async () => {
    const now = new Date('2026-11-18T18:00:00Z')
    const link = await replyLink({ SIGNING_SECRET: KEY }, SITE, { name: 'Player One', email: 'player.one@example.org', message: 'Hello.' }, CLUB, now)
    const token = tokenOf(link!)
    expect(await openReplyLink({ SIGNING_SECRET: KEY }, token, now)).toMatchObject({ ok: true })
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
    const seen = new Set<string>()
    // Every position after the version marker, changed to a character that is different from it.
    for (let i = 5; i < token.length; i++) {
      if (token[i] === '.') continue
      const swap = alphabet[(alphabet.indexOf(token[i]) + 1) % alphabet.length]
      const changed = `${token.slice(0, i)}${swap}${token.slice(i + 1)}`
      const answer = await openReplyLink({ SIGNING_SECRET: KEY }, changed, now)
      seen.add(JSON.stringify(answer))
    }
    expect([...seen]).toEqual([JSON.stringify({ ok: false, reason: 'refused' })])
  })

  it('opens nothing at the very second it ends, and opens at the second before', async () => {
    const sealed = new Date('2026-10-15T05:00:00Z')
    const link = await replyLink({ SIGNING_SECRET: KEY }, SITE, { name: 'Player One', email: 'player.one@example.org', message: 'Hello.' }, CLUB, sealed)
    const token = tokenOf(link!)
    const end = sealed.getTime() + REPLY_TTL_SECONDS * 1000
    expect((await openReplyLink({ SIGNING_SECRET: KEY }, token, new Date(end - 1000))).ok).toBe(true)
    expect(await openReplyLink({ SIGNING_SECRET: KEY }, token, new Date(end))).toEqual({ ok: false, reason: 'refused' })
    // Read as the token helper reads it, the refusal is the expiry: the endpoint folds it into one answer with the others.
    expect(await openToken({ current: KEY }, REPLY_PURPOSE, token, new Date(end))).toEqual({ ok: false, reason: 'expired' })
  })
})

describe('no key', () => {
  it('makes no link and opens none for a key missing, empty, blank or too short, and never throws', async () => {
    const visitor = { name: 'Player One', email: 'player.one@example.org', message: 'Hello.' }
    const good = tokenOf((await replyLink({ SIGNING_SECRET: KEY }, SITE, visitor, CLUB))!)
    for (const key of [undefined, '', '   ', 'too-short']) {
      expect(await replyLink({ SIGNING_SECRET: key }, SITE, visitor, CLUB), String(key)).toBeNull()
      expect(await openReplyLink({ SIGNING_SECRET: key }, good, new Date()), String(key)).toMatchObject({ ok: false })
    }
    expect(await openReplyLink({ SIGNING_SECRET: undefined }, good, new Date())).toEqual({ ok: false, reason: 'key_missing' })
  })
})

// ── The plain-language rules over the files this step adds ──

const ROOT = resolve(__dirname, '../..')
const text = (path: string) => readFileSync(join(ROOT, path), 'utf8')
/** An en dash or an em dash, written by code so that this file holds neither. */
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
/** Words about how a text was made, split up so that this file does not hold them either. */
const AUTOMATION_WORDS = new RegExp(`\\b(${['A' + 'I', 'cla' + 'ude', 'assis' + 'tant', 'chat' + 'bot', 'l' + 'lm', 'g' + 'pt', 'copi' + 'lot'].join('|')})\\b`, 'i')

/** The old initials of US Chess, written in parts so that this file does not hold them. */
const OLD_INITIALS = new RegExp(`\\b${'US' + 'CF'}\\b`)

const SOURCES = [
  'functions/api/clubs/reply/[token].ts',
  'functions/utils/clubs/reply.ts',
  'functions/utils/clubs/emails.ts',
  'functions/utils/clubs/relay.ts',
  'domain/clubs/replyMessage.ts',
  'domain/contracts/clubReply.ts',
  'src/pages/ClubReplyPage.tsx',
]
const TESTS = [
  'test/integration/club-reply.test.ts',
  'test/integration/club-reply-edges.test.ts',
  'test/integration/contracts/club-reply.test.ts',
  'test/unit/club-reply-page.test.tsx',
  'test/unit/club-reply-page-edges.test.tsx',
  'test/unit/club-reply-link.test.ts',
  'test/unit/club-reply-edges.test.ts',
]

describe('plain words in the files of the step', () => {
  it.each([...SOURCES, ...TESTS])('%s has no long dash and no word about how it was made', (path) => {
    const body = text(path)
    expect(body).not.toMatch(DASHES)
    expect(body).not.toMatch(AUTOMATION_WORDS)
  })

  it.each(SOURCES)('%s never writes the abbreviation for US Chess in a word a person reads', (path) => {
    // Code may name the member's own column (uscf_id); what a person reads says US Chess. A string literal or a JSX line with the
    // abbreviation in capitals as a word is what this refuses.
    const lines = text(path).split('\n').filter((line) => OLD_INITIALS.test(line) && !/^\s*(\/\/|\*|\/\*)/.test(line))
    expect(lines).toEqual([])
  })

  it('the page and the emails write times as "7:00 PM" and have no bare ".5" or "1/2" for a half', () => {
    for (const path of ['src/pages/ClubReplyPage.tsx', 'functions/utils/clubs/emails.ts', 'domain/clubs/replyMessage.ts']) {
      const literals = text(path).match(/(['"`])(?:(?!\1)[^\\\n]|\\.)*\1/g) ?? []
      for (const literal of literals) {
        // A class name such as w-1/2 or gap-1.5 is no half of anything a person reads: only a number standing as a word counts.
        expect(literal, path).not.toMatch(/(^|[\s(])(\d{1,2}\.5|1\/2)(?![\w/.-])/)
        expect(literal, path).not.toMatch(/\b\d{1,2}:\d{2}\s?(am|pm)\b/)
      }
    }
  })
})
