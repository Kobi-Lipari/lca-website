// test/unit/mail-links.test.ts
//
// The signed links of optional email (WS16 step 3),
// functions/utils/mail/links.ts, on their own: a token is the contact's id,
// the scope and 22 characters of an HMAC-SHA256 under MAIL_LINK_SECRET, 70
// characters for the newsletter, with no date in it. Pinned here: a round
// trip for each purpose; the signature, checked against Node's own HMAC;
// any one character changed, the other purpose, another key, another list,
// another contact and every other shape a stranger could send, each read
// as nothing; the previous key read but never signed with; no key, no
// link; a token that verifies whatever the clock says; the key's check of
// 16 characters; and the file importing nothing, so no helper of Stripe's
// and no package reaches a bundle that signs links. Each key here is
// plainly made up and used nowhere else. Nothing here makes a request.
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NEWSLETTER_LIST_ID, TOURNAMENTS_LIST_ID } from '../../domain/mail/lists'
import { linkKeyCheck, MailLinkKeyMissing, readLink, signLink } from '../../functions/utils/mail/links'

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

const KEY = 'unit-test-made-up-link-key-7731'
const OTHER_KEY = 'unit-test-made-up-link-key-other-2208'
const CONTACT = '00112233445566778899aabbccddeeff'
const OTHER_CONTACT = 'ffeeddccbbaa99887766554433221100'

/** The signature as the file's header describes it, computed with Node's own crypto rather than Web Crypto. */
const expectedMac = (key: string, purpose: string, contactId: string, scope: string) =>
  createHmac('sha256', key).update(`lca-mail-link:1:${purpose}:${contactId}:${scope}`).digest('base64url').slice(0, 22)

afterEach(() => {
  vi.useRealTimers()
})

describe('a round trip', () => {
  it('signs an unsubscribe link as the contact, the list and 22 characters of signature, and reads it back', async () => {
    const token = await signLink(KEY, CONTACT, 'unsubscribe', NEWSLETTER_LIST_ID)
    expect(token).toBe(`${CONTACT}.${NEWSLETTER_LIST_ID}.${expectedMac(KEY, 'unsubscribe', CONTACT, NEWSLETTER_LIST_ID)}`)
    expect(await readLink({ current: KEY }, token, 'unsubscribe')).toEqual({ contactId: CONTACT, listId: NEWSLETTER_LIST_ID })
  })

  it('signs a preferences link with the scope \'p\', and reads it back with no list', async () => {
    const token = await signLink(KEY, CONTACT, 'preferences')
    expect(token).toBe(`${CONTACT}.p.${expectedMac(KEY, 'preferences', CONTACT, 'p')}`)
    expect(await readLink({ current: KEY }, token, 'preferences')).toEqual({ contactId: CONTACT })
  })

  it('makes a newsletter link of 70 characters at most, 132 bits of it signature, and LCA tournament email\'s one longer for its longer id', async () => {
    const newsletter = await signLink(KEY, CONTACT, 'unsubscribe', NEWSLETTER_LIST_ID)
    expect(newsletter.length).toBeLessThanOrEqual(70)
    expect(newsletter).toHaveLength(70)
    expect(newsletter.split('.')[2]).toMatch(/^[A-Za-z0-9_-]{22}$/)
    expect(22 * 6).toBe(132)
    expect(await signLink(KEY, CONTACT, 'unsubscribe', TOURNAMENTS_LIST_ID)).toHaveLength(71)
    expect((await signLink(KEY, CONTACT, 'preferences')).length).toBeLessThan(70)
  })

  it('carries no date: the same link is signed at any time, and a link verifies whatever the clock says, so none ever expires', async () => {
    const now = await signLink(KEY, CONTACT, 'unsubscribe', NEWSLETTER_LIST_ID)
    vi.useFakeTimers({ toFake: ['Date'] })
    for (const when of ['2026-11-11T12:00:00Z', '2030-01-01T00:00:00Z', '2099-12-31T23:59:59Z', '2000-01-01T00:00:00Z']) {
      vi.setSystemTime(new Date(when))
      expect(await signLink(KEY, CONTACT, 'unsubscribe', NEWSLETTER_LIST_ID), when).toBe(now)
      expect(await readLink({ current: KEY }, now, 'unsubscribe'), when).toEqual({ contactId: CONTACT, listId: NEWSLETTER_LIST_ID })
    }
    // Its three parts are the contact, the list and the signature: there is no room for a date.
    expect(now.split('.')).toEqual([CONTACT, NEWSLETTER_LIST_ID, expectedMac(KEY, 'unsubscribe', CONTACT, NEWSLETTER_LIST_ID)])
  })
})

describe('what does not verify', () => {
  it('turns away a token with any one character changed, in any part', async () => {
    const token = await signLink(KEY, CONTACT, 'unsubscribe', NEWSLETTER_LIST_ID)
    for (let i = 0; i < token.length; i++) {
      if (token[i] === '.') continue
      const swap = token[i] === 'a' ? 'b' : 'a'
      const changed = `${token.slice(0, i)}${swap}${token.slice(i + 1)}`
      expect(await readLink({ current: KEY }, changed, 'unsubscribe'), `character ${i}`).toBeNull()
    }
  })

  it('turns away the other purpose: an unsubscribe token as a preferences token, and the other way round', async () => {
    const unsubscribe = await signLink(KEY, CONTACT, 'unsubscribe', NEWSLETTER_LIST_ID)
    const preferences = await signLink(KEY, CONTACT, 'preferences')
    expect(await readLink({ current: KEY }, unsubscribe, 'preferences')).toBeNull()
    expect(await readLink({ current: KEY }, preferences, 'unsubscribe')).toBeNull()
    // The same scope and signature under the other purpose does not verify either.
    const [, , mac] = preferences.split('.')
    expect(await readLink({ current: KEY }, `${CONTACT}.p.${mac}`, 'unsubscribe')).toBeNull()
  })

  it('turns away another key, and a signature moved to another contact or another list', async () => {
    const token = await signLink(OTHER_KEY, CONTACT, 'unsubscribe', NEWSLETTER_LIST_ID)
    expect(await readLink({ current: KEY }, token, 'unsubscribe')).toBeNull()
    const [, , mac] = (await signLink(KEY, CONTACT, 'unsubscribe', NEWSLETTER_LIST_ID)).split('.')
    expect(await readLink({ current: KEY }, `${OTHER_CONTACT}.${NEWSLETTER_LIST_ID}.${mac}`, 'unsubscribe')).toBeNull()
    expect(await readLink({ current: KEY }, `${CONTACT}.${TOURNAMENTS_LIST_ID}.${mac}`, 'unsubscribe')).toBeNull()
  })

  it('turns away every other shape a stranger could send: cut short, lengthened, another case, a trailing dot or slash, percent-encoded, very long, empty', async () => {
    const token = await signLink(KEY, CONTACT, 'unsubscribe', NEWSLETTER_LIST_ID)
    const strangers = [
      token.slice(0, -1), `${token}A`, `${token}.`, `${token}/`, token.toUpperCase(), token.replace(/\./g, '%2E'), encodeURIComponent(`${token}/`),
      `${token}${'x'.repeat(5000)}`, `${'0'.repeat(5000)}.${NEWSLETTER_LIST_ID}.${token.split('.')[2]}`, '', '.', '..', `${CONTACT}..${token.split('.')[2]}`,
      ` ${token}`, `${token} `, `${token}\n`,
    ]
    for (const stranger of strangers) expect(await readLink({ current: KEY }, stranger, 'unsubscribe'), stranger.slice(0, 80)).toBeNull()
    expect(await readLink({ current: KEY }, undefined as unknown as string, 'unsubscribe')).toBeNull()
  })
})

describe('the keys', () => {
  it('reads a link signed under the previous key while the previous key is given, and signs nothing with it', async () => {
    const old = await signLink(OTHER_KEY, CONTACT, 'unsubscribe', NEWSLETTER_LIST_ID)
    expect(await readLink({ current: KEY, previous: OTHER_KEY }, old, 'unsubscribe')).toEqual({ contactId: CONTACT, listId: NEWSLETTER_LIST_ID })
    expect(await readLink({ current: KEY }, old, 'unsubscribe')).toBeNull()
    // A previous key alone opens nothing, and an empty one counts as none.
    expect(await readLink({ previous: OTHER_KEY }, old, 'unsubscribe')).toBeNull()
    expect(await readLink({ current: '', previous: OTHER_KEY }, old, 'unsubscribe')).toBeNull()
    expect(await readLink({ current: KEY, previous: '' }, old, 'unsubscribe')).toBeNull()
    // A fresh link is the current key's: signLink takes one key, and while the key is changed it is the new one.
    const fresh = await signLink(KEY, CONTACT, 'unsubscribe', NEWSLETTER_LIST_ID)
    expect(fresh).not.toBe(old)
    expect(await readLink({ current: OTHER_KEY }, fresh, 'unsubscribe')).toBeNull()
    expect(signLink.length).toBe(4)
  })

  it('signs nothing and reads nothing without the current key: signLink throws MailLinkKeyMissing and readLink answers null', async () => {
    const token = await signLink(KEY, CONTACT, 'preferences')
    for (const missing of [undefined, '']) {
      await expect(signLink(missing, CONTACT, 'unsubscribe', NEWSLETTER_LIST_ID)).rejects.toBeInstanceOf(MailLinkKeyMissing)
      await expect(signLink(missing, CONTACT, 'preferences')).rejects.toBeInstanceOf(MailLinkKeyMissing)
      expect(await readLink({ current: missing }, token, 'preferences')).toBeNull()
      await expect(linkKeyCheck(missing)).rejects.toBeInstanceOf(MailLinkKeyMissing)
    }
    const error = await signLink(undefined, CONTACT, 'preferences').catch((err: unknown) => err as Error)
    expect(error.name).toBe('MailLinkKeyMissing')
    expect(error.message).toBe('The mail link key is missing on this deployment.')
  })

  it('gives the key\'s check as 16 hex characters, the same for one key and others for another', async () => {
    const check = await linkKeyCheck(KEY)
    expect(check).toMatch(/^[0-9a-f]{16}$/)
    expect(check).toBe(createHmac('sha256', KEY).update('lca-mail-link-check').digest('hex').slice(0, 16))
    expect(await linkKeyCheck(KEY)).toBe(check)
    expect(await linkKeyCheck(OTHER_KEY)).not.toBe(check)
  })
})

describe('what a token can carry', () => {
  it('signs only a contact\'s 32-character id and a list\'s id, which hold no dot and no colon, and a preferences link with no list', async () => {
    for (const contactId of ['', 'short', CONTACT.toUpperCase(), `${CONTACT}0`, `${CONTACT.slice(0, 31)}.`, `${CONTACT.slice(0, 31)}:`]) {
      await expect(signLink(KEY, contactId, 'preferences'), contactId).rejects.toThrow("A link names its contact by the contact's 32-character id.")
    }
    for (const listId of [undefined, '', 'p', 'Lca-newsletter', 'lca.newsletter', 'lca:newsletter', 'lca--newsletter', '-lca', 'x'.repeat(65)]) {
      await expect(signLink(KEY, CONTACT, 'unsubscribe', listId), String(listId)).rejects.toThrow("An unsubscribe link names its list by the list's id.")
    }
    await expect(signLink(KEY, CONTACT, 'preferences', NEWSLETTER_LIST_ID)).rejects.toThrow('A preferences link names no list.')
    // None of the words names the contact or the key.
    const words = await signLink(KEY, `${CONTACT}0`, 'preferences').catch((err: Error) => err.message)
    expect(words).not.toContain(CONTACT)
  })
})

describe('the file', () => {
  const text = read('functions/utils/mail/links.ts')

  it('imports nothing, so no helper of Stripe\'s and no package reaches a bundle that signs links, and reads no clock', () => {
    expect(text).not.toMatch(/^\s*import\b/m)
    expect(text).not.toMatch(/\brequire\(|import\(/)
    expect(text).not.toMatch(/timingSafeEqualHex|from '\.\.\/stripe'/)
    expect(text).not.toMatch(/Date\.now|new Date\(/)
  })

  it('holds no em or en dash, no old initials for US Chess and no tool\'s name', () => {
    expect(text).not.toMatch(new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`))
    expect(text).not.toMatch(new RegExp(`\\b${'US' + 'CF'}\\b`))
    expect(text).not.toMatch(new RegExp(`\\b(${['cla' + 'ude', 'anthr' + 'opic', 'chat' + 'gpt', 'open' + 'ai', 'copi' + 'lot'].join('|')})\\b`, 'i'))
  })
})
