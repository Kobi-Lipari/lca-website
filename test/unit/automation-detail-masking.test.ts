// test/unit/automation-detail-masking.test.ts
//
// plainDetail in functions/utils/admin/automations.ts (WS09 step 13): the
// detail of a run is one plain line for the admin, never a secret, a token or
// an email address, whether it comes from the job's own report or from a
// thrown error's words. The forms an address or a token is written in are
// held one by one; the text that is not either is kept as it was written.
// Every person, address and token here is made up.
import { describe, expect, it } from 'vitest'
import { MAX_DETAIL_LENGTH, plainDetail } from '../../functions/utils/admin/automations'

describe('plainDetail', () => {
  it('keeps a plain line as it was written', () => {
    for (const line of ['Twelve reminders sent.', 'Two of 14 clubs were not reached.', 'The roster for Saturday, November 14, 2026 was empty.', 'Started at 7:00 PM.', '']) {
      expect(plainDetail(line)).toBe(line)
    }
    expect(plainDetail(null)).toBe('')
    expect(plainDetail(undefined)).toBe('')
  })

  it('puts a plain mark for an address written in the forms a thrown error holds it', () => {
    for (const text of [
      'Could not send to player.one@example.org today',
      'Refused: Player One <player.one@example.org>',
      '"Player One" <player.one@example.org>, player.two@example.org; player.three@example.org',
      'mailto:player.one@example.org?subject=Welcome',
      'PLAYER.ONE@EXAMPLE.ORG bounced',
      'player+club@mail.example.org bounced',
      '(player.one@example.org)',
    ]) {
      const line = plainDetail(text)
      expect(line, text).not.toMatch(/@/)
      expect(line, text).not.toMatch(/player[.+]|example\.org/i)
      expect(line, text).toContain('[address]')
    }
  })

  it('hides a token, a key or a secret, after its name, as a long run, in a link\'s query, and after Bearer', () => {
    const run = 'v1.s.eyJwIjoiY2x1Yl9jb25maXJtIiwiYyI6e30sImUiOjF9.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
    for (const text of [
      `Link failed: ${run}`, `token=${run}`, `Token: abc`, 'secret = not-a-real-one', 'password: not-a-real-one', 'api_key="not a real one"', 'Authorization: Bearer abc',
      'Bearer abc', 'https://example.org/confirm?t=abc', 'https://example.org/confirm#abc', `https://example.org/confirm/${run}`, 'Cookie: sid=abc',
    ]) {
      const line = plainDetail(text)
      expect(line, text).not.toContain('eyJ')
      expect(line, text).not.toContain('AAAAAAAA')
      expect(line, text).not.toMatch(/not-a-real-one|not a real one|=abc|: abc|Bearer abc|\?t=abc|#abc/)
    }
  })

  it('is one line of at most the stated length, whatever the text holds', () => {
    for (const text of ['one\ntwo', 'one\r\ntwo', 'one\ttwo', 'one\u2028two', 'one\u0000two', `${'word '.repeat(200)}`, 'x'.repeat(10_000), `\u{1F3F0}${'é'.repeat(500)}`]) {
      const line = plainDetail(text)
      expect(line.length, text.slice(0, 10)).toBeLessThanOrEqual(MAX_DETAIL_LENGTH)
      expect([...line].some((c) => c.charCodeAt(0) < 0x20 || c === '\u2028')).toBe(false)
      expect(line).toBe(line.trim())
    }
    expect(plainDetail('x '.repeat(500)).endsWith('...')).toBe(true)
    // The cut never leaves half of a character written as a pair: the first text is cut between two characters, the
    // second through the middle of one.
    for (const text of [`${'\u{1F3F0}'.repeat(98)}a${'\u{1F3F0}'.repeat(60)}`, '\u{1F3F0}'.repeat(150)]) {
      const cut = plainDetail(text)
      expect(cut.endsWith('...')).toBe(true)
      expect(cut.length).toBeLessThanOrEqual(MAX_DETAIL_LENGTH)
      expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(cut)).toBe(false)
    }
  })

  it('gives text for what is not text, and does not throw', () => {
    for (const value of [7, true, {}, [], ['player.one@example.org'], new Error('player.one@example.org'), Symbol.iterator.description, 10n]) {
      expect(typeof plainDetail(value)).toBe('string')
      expect(plainDetail(value)).not.toMatch(/@/)
    }
  })

  it('reads a value with no text to give as no text, and does not throw', () => {
    const throwing = { toString: () => { throw new Error('player.one@example.org') } }
    for (const value of [Object.create(null), throwing]) {
      expect(plainDetail(value)).toBe('')
    }
  })

  // An address written with its at sign percent-encoded, as it rides in a URL's query or a form body that a failed request puts
  // in its message, is an address as much as the plain one.
  it('puts a plain mark for an address whose at sign is written as %40', () => {
    const line = plainDetail('Request failed for player.one%40example.org after two tries')
    expect(line).not.toMatch(/player\.one/i)
    expect(line).not.toMatch(/%40/)
  })
})
