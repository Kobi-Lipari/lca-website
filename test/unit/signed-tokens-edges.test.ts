// test/unit/signed-tokens-edges.test.ts
//
// functions/utils/tokens.ts (WS09 step 13), the edges that test/unit/signed-tokens.test.ts
// leaves: what a token is made from (purpose, claim, life), the exact second
// across a day that has a change of clocks in America/Chicago, a text that
// decodes to the same bytes as the real one, a sealed token spliced from two,
// work that is not started for a token over the bound, the signature checked
// by crypto.subtle.verify, the earlier key alone, and hostile objects given
// in place of text, keys or a time.
//
// Every key here is written in this file and plainly made up; none is read
// from the environment. Every id is made up too.
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  MAX_TOKEN_LENGTH, MAX_TTL_SECONDS, MIN_SECRET_LENGTH, TokenKeyMissing, openToken, readToken, sealToken, signToken, type TokenClaim,
} from '../../functions/utils/tokens'

const KEY = 'example-signing-key-not-a-real-one-0001'
const OTHER_KEY = 'example-signing-key-not-a-real-one-0002'
const NOW = new Date(Date.UTC(2026, 10, 14, 18, 0, 0))
const CLAIM: TokenClaim = { clubId: 'example-chess-club', memberId: 'player-one' }
const PURPOSE = 'club_confirm'
const KEYS = { current: KEY }
const forged = { ok: false, reason: 'forged' }

const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64url')
const unb64 = (part: string) => new Uint8Array(Buffer.from(part, 'base64url'))

afterEach(() => {
  vi.restoreAllMocks()
})

describe('what a token is made from', () => {
  it('refuses a life that is not a whole number of seconds from one to 400 days, and takes both ends', async () => {
    for (const ttl of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, MAX_TTL_SECONDS + 1, '60' as unknown as number, null as unknown as number]) {
      const label = String(ttl)
      await expect(signToken(KEY, PURPOSE, CLAIM, ttl, NOW), label).rejects.toThrow(Error)
      await expect(sealToken(KEY, PURPOSE, CLAIM, ttl, NOW), label).rejects.toThrow(Error)
      await expect(signToken(KEY, PURPOSE, CLAIM, ttl, NOW), label).rejects.not.toBeInstanceOf(TokenKeyMissing)
    }
    for (const ttl of [1, MAX_TTL_SECONDS]) {
      expect(await readToken(KEYS, PURPOSE, await signToken(KEY, PURPOSE, CLAIM, ttl, NOW), NOW)).toEqual({ ok: true, claim: CLAIM })
      expect(await openToken(KEYS, PURPOSE, await sealToken(KEY, PURPOSE, CLAIM, ttl, NOW), NOW)).toEqual({ ok: true, claim: CLAIM })
    }
  })

  it('refuses a purpose that is not a short lowercase word, and takes the forms the later steps use', async () => {
    for (const purpose of ['', 'Club', 'club confirm', 'club.confirm', '1club', '_club', 'x'.repeat(65), 'club\n', 'club/confirm', 7 as unknown as string, null as unknown as string]) {
      await expect(signToken(KEY, purpose, CLAIM, 60, NOW), String(purpose)).rejects.toThrow(Error)
      await expect(sealToken(KEY, purpose, CLAIM, 60, NOW), String(purpose)).rejects.toThrow(Error)
    }
    for (const purpose of ['a', 'club_confirm', 'waitlist:claim', 'rep-invite', 'x'.repeat(64)]) {
      expect(await readToken(KEYS, purpose, await signToken(KEY, purpose, CLAIM, 60, NOW), NOW), purpose).toEqual({ ok: true, claim: CLAIM })
    }
  })

  it('refuses a claim that is not a small flat object of short values, and takes sixteen fields', async () => {
    const sixteen = Object.fromEntries(Array.from({ length: 16 }, (_, i) => [`field${i}`, i]))
    const refused: unknown[] = [
      null, undefined, 'player-one', 7, ['player-one'], { nested: { id: 'player-one' } }, { list: ['a'] }, { gone: undefined }, { n: Number.NaN },
      { n: Number.POSITIVE_INFINITY }, { when: new Date(0) }, { fn: () => 1 }, { ...sixteen, extra: 1 }, { note: 'x'.repeat(257) }, { ['x'.repeat(257)]: 1 },
    ]
    for (const claim of refused) {
      await expect(signToken(KEY, PURPOSE, claim as TokenClaim, 60, NOW), JSON.stringify(claim)).rejects.toThrow(Error)
      await expect(sealToken(KEY, PURPOSE, claim as TokenClaim, 60, NOW), JSON.stringify(claim)).rejects.toThrow(Error)
    }
    const kept: TokenClaim = { ...sixteen, text: 'x'.repeat(256), yes: true, no: false, nothing: null, negative: -3, fraction: 0.25 }
    // Seventeen names are one too many, so keep to sixteen here.
    const sixteenKept: TokenClaim = Object.fromEntries(Object.entries(kept).slice(-16))
    expect(await readToken(KEYS, PURPOSE, await signToken(KEY, PURPOSE, sixteen, 60, NOW), NOW)).toEqual({ ok: true, claim: sixteen })
    expect(await readToken(KEYS, PURPOSE, await signToken(KEY, PURPOSE, sixteenKept, 60, NOW), NOW)).toEqual({ ok: true, claim: sixteenKept })
    expect(await openToken(KEYS, PURPOSE, await sealToken(KEY, PURPOSE, sixteenKept, 60, NOW), NOW)).toEqual({ ok: true, claim: sixteenKept })
  })

  it('carries text that is not ASCII through both kinds, and an empty claim', async () => {
    const claim: TokenClaim = { clubId: 'clúb-é-☕', note: '\u{1F3F0} rook', empty: '' }
    expect(await readToken(KEYS, PURPOSE, await signToken(KEY, PURPOSE, claim, 60, NOW), NOW)).toEqual({ ok: true, claim })
    expect(await openToken(KEYS, PURPOSE, await sealToken(KEY, PURPOSE, claim, 60, NOW), NOW)).toEqual({ ok: true, claim })
    expect(await readToken(KEYS, PURPOSE, await signToken(KEY, PURPOSE, {}, 60, NOW), NOW)).toEqual({ ok: true, claim: {} })
    expect(await openToken(KEYS, PURPOSE, await sealToken(KEY, PURPOSE, {}, 60, NOW), NOW)).toEqual({ ok: true, claim: {} })
  })

  it('lets a sealed claim hold an address, which a signed claim may not, and hides it in the token', async () => {
    const claim: TokenClaim = { clubId: 'example-chess-club', email: 'player.one@example.org' }
    await expect(signToken(KEY, PURPOSE, claim, 60, NOW)).rejects.toThrow(Error)
    const sealed = await sealToken(KEY, PURPOSE, claim, 60, NOW)
    expect(await openToken(KEYS, PURPOSE, sealed, NOW)).toEqual({ ok: true, claim })
    // Nothing of the claim is in the token's text, as it is or as base64url.
    for (const secret of ['player.one', 'example.org', 'example-chess-club', 'email']) {
      expect(sealed).not.toContain(secret)
      expect(sealed).not.toContain(Buffer.from(secret).toString('base64url'))
      for (const part of sealed.split('.').slice(2)) expect(Buffer.from(part, 'base64url').toString('latin1')).not.toContain(secret)
    }
  })

  it('makes the same signed token from the same inputs, and a different one for a different claim, purpose or time', async () => {
    const one = await signToken(KEY, PURPOSE, CLAIM, 60, NOW)
    expect(await signToken(KEY, PURPOSE, CLAIM, 60, NOW)).toBe(one)
    expect(await signToken(KEY, PURPOSE, { ...CLAIM, memberId: 'player-two' }, 60, NOW)).not.toBe(one)
    expect(await signToken(KEY, 'waitlist_claim', CLAIM, 60, NOW)).not.toBe(one)
    expect(await signToken(KEY, PURPOSE, CLAIM, 61, NOW)).not.toBe(one)
    expect(await signToken(OTHER_KEY, PURPOSE, CLAIM, 60, NOW)).not.toBe(one)
  })

  it('makes a hundred seals at once, each with an iv of its own, each opening', async () => {
    const seals = await Promise.all(Array.from({ length: 100 }, () => sealToken(KEY, PURPOSE, CLAIM, 60, NOW)))
    expect(new Set(seals.map((s) => s.split('.')[3])).size).toBe(100)
    expect(new Set(seals).size).toBe(100)
    const read = await Promise.all(seals.map((s) => openToken(KEYS, PURPOSE, s, NOW)))
    expect(read.every((r) => r.ok)).toBe(true)
  })
})

describe('the second a token stops being good, across a change of clocks in America/Chicago', () => {
  // A life is that many real seconds, never a calendar day in Chicago.
  it('lasts exactly 86,400 seconds from the evening before the clocks go back (Sunday, November 1, 2026)', async () => {
    // 12:30 AM CDT on Sunday, November 1, 2026 is 05:30:00 UTC; the clocks go back at 2:00 AM CDT, so the next 24 hours of the clock
    // are 25 hours long, and a token of 86,400 seconds stops 23:30 CST the same day, an hour before a clock day is out.
    const made = new Date(Date.UTC(2026, 10, 1, 5, 30, 0))
    const token = await signToken(KEY, PURPOSE, CLAIM, 86_400, made)
    expect(await readToken(KEYS, PURPOSE, token, new Date(Date.UTC(2026, 10, 2, 5, 29, 59)))).toEqual({ ok: true, claim: CLAIM })
    expect(await readToken(KEYS, PURPOSE, token, new Date(Date.UTC(2026, 10, 2, 5, 30, 0)))).toEqual({ ok: false, reason: 'expired' })
  })

  it('lasts exactly 86,400 seconds from the evening before the clocks go forward (Sunday, March 8, 2026)', async () => {
    // 11:00 PM CST on Saturday, March 7, 2026 is 05:00:00 UTC on the 8th; the clocks go forward at 2:00 AM CST (08:00 UTC),
    // so the next clock day is 23 hours long, and 86,400 seconds stop at 12:00 AM CDT on Monday, March 9 (05:00 UTC).
    const made = new Date(Date.UTC(2026, 2, 8, 5, 0, 0))
    const token = await sealToken(KEY, PURPOSE, CLAIM, 86_400, made)
    expect(await openToken(KEYS, PURPOSE, token, new Date(Date.UTC(2026, 2, 9, 4, 59, 59)))).toEqual({ ok: true, claim: CLAIM })
    expect(await openToken(KEYS, PURPOSE, token, new Date(Date.UTC(2026, 2, 9, 5, 0, 0)))).toEqual({ ok: false, reason: 'expired' })
  })

  it('is not moved by the repeated hour, and midnight in Chicago is a second like any other', async () => {
    // 1:30 AM CDT and 1:30 AM CST on Sunday, November 1, 2026 are an hour apart: 06:30 and 07:30 UTC.
    const token = await signToken(KEY, PURPOSE, CLAIM, 3_600, new Date(Date.UTC(2026, 10, 1, 6, 30, 0)))
    expect(await readToken(KEYS, PURPOSE, token, new Date(Date.UTC(2026, 10, 1, 7, 29, 59)))).toEqual({ ok: true, claim: CLAIM })
    expect(await readToken(KEYS, PURPOSE, token, new Date(Date.UTC(2026, 10, 1, 7, 30, 0)))).toEqual({ ok: false, reason: 'expired' })
    // Midnight, Monday, November 16, 2026 in Chicago (CST) is 06:00:00 UTC.
    const night = await signToken(KEY, PURPOSE, CLAIM, 1, new Date(Date.UTC(2026, 10, 16, 5, 59, 59, 500)))
    expect(await readToken(KEYS, PURPOSE, night, new Date(Date.UTC(2026, 10, 16, 5, 59, 59, 999)))).toEqual({ ok: true, claim: CLAIM })
    expect(await readToken(KEYS, PURPOSE, night, new Date(Date.UTC(2026, 10, 16, 6, 0, 0, 0)))).toEqual({ ok: false, reason: 'expired' })
  })

  it('counts whole seconds: a token made part way through a second stops at the whole second its life reaches', async () => {
    const token = await signToken(KEY, PURPOSE, CLAIM, 60, new Date(NOW.getTime() + 900))
    expect(await readToken(KEYS, PURPOSE, token, new Date(NOW.getTime() + 59_999))).toEqual({ ok: true, claim: CLAIM })
    expect(await readToken(KEYS, PURPOSE, token, new Date(NOW.getTime() + 60_000))).toEqual({ ok: false, reason: 'expired' })
    // And a time before it was made reads (the caller's clock decides), never a throw.
    expect(await readToken(KEYS, PURPOSE, token, new Date(0))).toEqual({ ok: true, claim: CLAIM })
  })

  it('refuses a time that is not a time, and a time far past every expiry', async () => {
    const token = await signToken(KEY, PURPOSE, CLAIM, MAX_TTL_SECONDS, NOW)
    for (const now of [new Date(Number.NaN), new Date(8.64e15), undefined, null, 0, '2026-11-14', {}, { getTime: () => 0 }] as unknown[]) {
      expect(await readToken(KEYS, PURPOSE, token, now as Date), String(now)).toEqual({ ok: false, reason: 'expired' })
    }
  })
})

describe('a token read as someone with the link and time would read it', () => {
  it('refuses a mac or a header that decodes to the same bytes under other letters', async () => {
    // 32 bytes are 43 characters, and the last carries two bits that are not part of any byte: another letter there is the same bytes.
    const token = await signToken(KEY, PURPOSE, CLAIM, 3_600, NOW)
    const last = token.at(-1) as string
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
    const index = alphabet.indexOf(last)
    const siblings = [0, 1, 2, 3].map((bits) => alphabet[(index & ~3) | bits]).filter((c) => c !== last)
    expect(siblings).toHaveLength(3)
    for (const c of siblings) {
      const edited = `${token.slice(0, -1)}${c}`
      expect(unb64(edited.split('.')[3])).toEqual(unb64(token.split('.')[3]))
      expect(await readToken(KEYS, PURPOSE, edited, NOW), c).toEqual(forged)
    }
    // The same for a sealed token's last part (its tag), and for its iv, which is 16 characters of 12 bytes.
    const sealed = await sealToken(KEY, PURPOSE, CLAIM, 3_600, NOW)
    const parts = sealed.split('.')
    const lastTag = parts[4].at(-1) as string
    for (const bits of [0, 1, 2, 3]) {
      const c = alphabet[(alphabet.indexOf(lastTag) & ~3) | bits]
      if (c === lastTag) continue
      expect(await openToken(KEYS, PURPOSE, [...parts.slice(0, 4), `${parts[4].slice(0, -1)}${c}`].join('.'), NOW), c).toEqual(forged)
    }
  })

  it('refuses padding, standard base64 letters, a space or a line break in any part', async () => {
    const token = await signToken(KEY, PURPOSE, CLAIM, 3_600, NOW)
    const [v, s, payload, mac] = token.split('.')
    for (const edited of [
      `${v}.${s}.${payload}=.${mac}`, `${v}.${s}.${payload}.${mac}=`, `${v}.${s}.${payload}.${mac}==`, `${v}.${s}.${payload.replace(/[-_]/g, '+')}+.${mac}`,
      `${v}.${s}.${payload} .${mac}`, `${v}.${s}.${payload}.${mac}\n`, `${v}.${s}.${payload}.\n${mac}`, `${v}.${s}.${payload}.${mac.slice(0, 20)} ${mac.slice(20)}`,
      `${v}.${s}.${payload}.${mac}.extra`, `${v}.${s}..${mac}`, `${v}.${s}.${payload}.`,
    ]) {
      expect(await readToken(KEYS, PURPOSE, edited, NOW), edited.slice(-20)).toEqual(forged)
    }
  })

  it('refuses a signed payload with a __proto__ field and pollutes nothing', async () => {
    const enc = new TextEncoder()
    const base = await crypto.subtle.importKey('raw', enc.encode(KEY), 'HKDF', false, ['deriveKey'])
    const key = await crypto.subtle.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt: enc.encode('lca-token'), info: enc.encode('lca-token:v1:sign') }, base, { name: 'HMAC', hash: 'SHA-256', length: 256 }, false, ['sign'],
    )
    const e = NOW.getTime() / 1000 + 3600
    const payload = `{"p":"${PURPOSE}","c":{"__proto__":{"admin":true},"clubId":"example-chess-club"},"e":${e}}`
    const signed = `v1.s.${b64(enc.encode(payload))}`
    const mac = b64(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(signed))))
    expect(await readToken(KEYS, PURPOSE, `${signed}.${mac}`, NOW)).toEqual(forged)
    expect(({} as Record<string, unknown>).admin).toBeUndefined()
  })

  it('refuses a sealed token cut short at every length', async () => {
    const sealed = await sealToken(KEY, PURPOSE, CLAIM, 3_600, NOW)
    for (let length = 0; length < sealed.length; length++) {
      expect(await openToken(KEYS, PURPOSE, sealed.slice(0, length), NOW), String(length)).toEqual(forged)
    }
    expect(await openToken(KEYS, PURPOSE, sealed, NOW)).toEqual({ ok: true, claim: CLAIM })
  })

  it('refuses a sealed token whose header was edited to push its expiry out, and one spliced from two seals', async () => {
    const e = NOW.getTime() / 1000
    const near = (await sealToken(KEY, PURPOSE, CLAIM, 60, NOW)).split('.')
    const far = (await sealToken(KEY, PURPOSE, CLAIM, MAX_TTL_SECONDS, NOW)).split('.')
    const pushed = b64(new TextEncoder().encode(JSON.stringify({ p: PURPOSE, e: e + MAX_TTL_SECONDS })))
    const other = b64(new TextEncoder().encode(JSON.stringify({ p: 'waitlist_claim', e: e + 60 })))
    const later = { current: KEY }
    const at = new Date(NOW.getTime() + 3_600_000)
    expect(await openToken(later, PURPOSE, near.join('.'), at)).toEqual({ ok: false, reason: 'expired' })
    // The header from the far seal, or an edited one, on the near seal's iv and body: the tag no longer holds.
    expect(await openToken(later, PURPOSE, [near[0], near[1], far[2], near[3], near[4]].join('.'), at)).toEqual(forged)
    expect(await openToken(later, PURPOSE, [near[0], near[1], pushed, near[3], near[4]].join('.'), at)).toEqual(forged)
    expect(await openToken(later, 'waitlist_claim', [near[0], near[1], other, near[3], near[4]].join('.'), at)).toEqual(forged)
    // An iv or a body taken from the other seal.
    expect(await openToken(later, PURPOSE, [near[0], near[1], near[2], far[3], near[4]].join('.'), at)).toEqual(forged)
    expect(await openToken(later, PURPOSE, [near[0], near[1], near[2], near[3], far[4]].join('.'), at)).toEqual(forged)
    // A signed token's parts in a sealed token's places and the reverse.
    const signed = (await signToken(KEY, PURPOSE, CLAIM, 3_600, NOW)).split('.')
    expect(await openToken(later, PURPOSE, [near[0], near[1], near[2], near[3], signed[3]].join('.'), NOW)).toEqual(forged)
    expect(await readToken(later, PURPOSE, [signed[0], signed[1], signed[2], near[4]].join('.'), NOW)).toEqual(forged)
  })

  it('refuses a signed token read under a key that differs by one character, by a space, or by a case', async () => {
    const token = await signToken(KEY, PURPOSE, CLAIM, 3_600, NOW)
    const sealed = await sealToken(KEY, PURPOSE, CLAIM, 3_600, NOW)
    for (const secret of [OTHER_KEY, `${KEY} `, ` ${KEY}`, KEY.toUpperCase(), KEY.slice(0, -1), `${KEY}0`, 'x'.repeat(MIN_SECRET_LENGTH)]) {
      expect(await readToken({ current: secret }, PURPOSE, token, NOW), secret).toEqual(forged)
      expect(await openToken({ current: secret }, PURPOSE, sealed, NOW), secret).toEqual(forged)
    }
  })

  it('takes a secret of exactly 32 characters, and refuses one of 31', async () => {
    const at32 = 'k'.repeat(MIN_SECRET_LENGTH)
    const at31 = 'k'.repeat(MIN_SECRET_LENGTH - 1)
    const token = await signToken(at32, PURPOSE, CLAIM, 60, NOW)
    expect(await readToken({ current: at32 }, PURPOSE, token, NOW)).toEqual({ ok: true, claim: CLAIM })
    await expect(signToken(at31, PURPOSE, CLAIM, 60, NOW)).rejects.toBeInstanceOf(TokenKeyMissing)
    await expect(sealToken(at31, PURPOSE, CLAIM, 60, NOW)).rejects.toBeInstanceOf(TokenKeyMissing)
    expect(await readToken({ current: at31 }, PURPOSE, token, NOW)).toEqual({ ok: false, reason: 'key_missing' })
    expect(await openToken({ current: at31 }, PURPOSE, token, NOW)).toEqual({ ok: false, reason: 'key_missing' })
    // A missing key is told before the token is looked at, so it cannot be told from a bad token by anyone without the key's absence.
    expect(await readToken({ current: at31 }, PURPOSE, 'not a token', NOW)).toEqual({ ok: false, reason: 'key_missing' })
  })

  it('refuses a secret that is not text, in every place a secret is given, with the same plain answers', async () => {
    for (const secret of [undefined, null, '', 0, 1e31, {}, [KEY], true] as unknown[]) {
      await expect(signToken(secret as string, PURPOSE, CLAIM, 60, NOW)).rejects.toBeInstanceOf(TokenKeyMissing)
      await expect(sealToken(secret as string, PURPOSE, CLAIM, 60, NOW)).rejects.toBeInstanceOf(TokenKeyMissing)
      expect(await readToken({ current: secret as string }, PURPOSE, 'v1.s.a.b', NOW)).toEqual({ ok: false, reason: 'key_missing' })
      expect(await openToken({ current: secret as string }, PURPOSE, 'v1.x.a.b.c', NOW)).toEqual({ ok: false, reason: 'key_missing' })
    }
  })
})

describe('the earlier key', () => {
  it('is not enough alone: with no current key a token made under it is not read', async () => {
    const token = await signToken(OTHER_KEY, PURPOSE, CLAIM, 3_600, NOW)
    const sealed = await sealToken(OTHER_KEY, PURPOSE, CLAIM, 3_600, NOW)
    for (const secrets of [{ previous: OTHER_KEY }, { current: '', previous: OTHER_KEY }, { current: null, previous: OTHER_KEY }, { current: 'short', previous: OTHER_KEY }]) {
      expect(await readToken(secrets, PURPOSE, token, NOW)).toEqual({ ok: false, reason: 'key_missing' })
      expect(await openToken(secrets, PURPOSE, sealed, NOW)).toEqual({ ok: false, reason: 'key_missing' })
    }
  })

  it('reads and opens what the earlier key made, for as long as it is given, and stops when it is not', async () => {
    const old = await signToken(OTHER_KEY, PURPOSE, CLAIM, 3_600, NOW)
    const oldSealed = await sealToken(OTHER_KEY, PURPOSE, CLAIM, 3_600, NOW)
    const both = { current: KEY, previous: OTHER_KEY }
    expect(await readToken(both, PURPOSE, old, NOW)).toEqual({ ok: true, claim: CLAIM })
    expect(await openToken(both, PURPOSE, oldSealed, NOW)).toEqual({ ok: true, claim: CLAIM })
    expect(await readToken({ current: KEY }, PURPOSE, old, NOW)).toEqual(forged)
    expect(await openToken({ current: KEY }, PURPOSE, oldSealed, NOW)).toEqual(forged)
    // An earlier key does not change the order of refusals: the old token, read for another purpose or late, is told as such.
    expect(await readToken(both, 'waitlist_claim', old, NOW)).toEqual({ ok: false, reason: 'wrong_purpose' })
    expect(await readToken(both, PURPOSE, old, new Date(NOW.getTime() + 3_600_000))).toEqual({ ok: false, reason: 'expired' })
  })

  it('is ignored when it is the same as the current one or too short to be a key', async () => {
    const token = await signToken(KEY, PURPOSE, CLAIM, 3_600, NOW)
    for (const previous of [KEY, '', 'short', undefined, null, 7 as unknown as string]) {
      expect(await readToken({ current: KEY, previous }, PURPOSE, token, NOW)).toEqual({ ok: true, claim: CLAIM })
    }
    const shortOld = await signToken(OTHER_KEY, PURPOSE, CLAIM, 3_600, NOW)
    expect(await readToken({ current: KEY, previous: OTHER_KEY.slice(0, 31) }, PURPOSE, shortOld, NOW)).toEqual(forged)
  })

  it('never makes a token: the one made with the current key is not read under the earlier key alone', async () => {
    const made = await signToken(KEY, PURPOSE, CLAIM, 3_600, NOW)
    const sealed = await sealToken(KEY, PURPOSE, CLAIM, 3_600, NOW)
    // Read with the current key swapped for the other and KEY kept only as the earlier one, so a token made under KEY reads only by the earlier path.
    expect(await readToken({ current: OTHER_KEY, previous: KEY }, PURPOSE, made, NOW)).toEqual({ ok: true, claim: CLAIM })
    expect(await openToken({ current: OTHER_KEY, previous: KEY }, PURPOSE, sealed, NOW)).toEqual({ ok: true, claim: CLAIM })
    // signToken and sealToken take one secret: there is no way to hand them the pair, and a pair given is no secret.
    await expect(signToken({ current: KEY, previous: OTHER_KEY } as unknown as string, PURPOSE, CLAIM, 60, NOW)).rejects.toBeInstanceOf(TokenKeyMissing)
  })
})

describe('the work a token is put to before it is believed', () => {
  it('starts no crypto work for a token over the bound, a wrong form, or a part that is not base64url', async () => {
    const importKey = vi.spyOn(crypto.subtle, 'importKey')
    const verify = vi.spyOn(crypto.subtle, 'verify')
    const decrypt = vi.spyOn(crypto.subtle, 'decrypt')
    const deriveKey = vi.spyOn(crypto.subtle, 'deriveKey')
    const token = await signToken(KEY, PURPOSE, CLAIM, 60, NOW)
    importKey.mockClear()
    deriveKey.mockClear()
    const turned = [
      'x'.repeat(MAX_TOKEN_LENGTH + 1), `v1.s.${'A'.repeat(MAX_TOKEN_LENGTH)}.${'A'.repeat(43)}`, '', 'v1.s', 'v2.s.a.b', 'v1.x.a.b', 'v1.s.a.b.c', 'v1.s.!!.AAAA', 123,
      `v1.s.${token.split('.')[2]}.${'A'.repeat(42)}`, `v1.s.${token.split('.')[2]}.${'A'.repeat(44)}`,
    ]
    for (const input of turned) {
      expect(await readToken(KEYS, PURPOSE, input as string, NOW)).toEqual(forged)
      expect(await openToken(KEYS, PURPOSE, input as string, NOW)).toEqual(forged)
    }
    expect(importKey).not.toHaveBeenCalled()
    expect(deriveKey).not.toHaveBeenCalled()
    expect(verify).not.toHaveBeenCalled()
    expect(decrypt).not.toHaveBeenCalled()
  })

  it('takes a token of exactly the bound into the signature check, and checks the signature with crypto.subtle.verify, once for each key', async () => {
    const verify = vi.spyOn(crypto.subtle, 'verify')
    const token = await signToken(KEY, PURPOSE, CLAIM, 60, NOW)
    const [v, s, payload, mac] = token.split('.')
    // A payload part padded so the whole text is exactly MAX_TOKEN_LENGTH: not ours, so forged, but it reached the signature.
    const fill = MAX_TOKEN_LENGTH - `${v}.${s}..${mac}`.length
    const atBound = `${v}.${s}.${'A'.repeat(fill)}.${mac}`
    expect(atBound).toHaveLength(MAX_TOKEN_LENGTH)
    expect(await readToken(KEYS, PURPOSE, atBound, NOW)).toEqual(forged)
    expect(verify).toHaveBeenCalledTimes(1)
    verify.mockClear()
    expect(await readToken({ current: KEY, previous: OTHER_KEY }, PURPOSE, `${v}.${s}.${payload}.${'A'.repeat(43)}`, NOW)).toEqual(forged)
    expect(verify).toHaveBeenCalledTimes(2)
    verify.mockClear()
    // A token that is ours is checked once, under the current key, and the earlier key is not tried.
    expect(await readToken({ current: KEY, previous: OTHER_KEY }, PURPOSE, token, NOW)).toEqual({ ok: true, claim: CLAIM })
    expect(verify).toHaveBeenCalledTimes(1)
  })

  it('judges nothing in a payload whose signature does not hold: a forged token with another purpose and a past expiry is forged', async () => {
    const token = await signToken(KEY, PURPOSE, CLAIM, 1, NOW)
    const [v, s, payload, mac] = token.split('.')
    const edited = b64(new TextEncoder().encode(JSON.stringify({ p: 'waitlist_claim', c: CLAIM, e: 1 })))
    expect(payload).not.toBe(edited)
    expect(await readToken(KEYS, PURPOSE, `${v}.${s}.${edited}.${mac}`, new Date(NOW.getTime() + 86_400_000))).toEqual(forged)
  })
})

describe('reading never throws', () => {
  it('answers for keys, a token and a time that throw when they are looked at', async () => {
    const token = await signToken(KEY, PURPOSE, CLAIM, 3_600, NOW)
    const sealed = await sealToken(KEY, PURPOSE, CLAIM, 3_600, NOW)
    const boom = () => {
      throw new Error('looked at')
    }
    const hostileKeys = { get current(): string { return boom() }, previous: OTHER_KEY } as never
    const hostileToken = { toString: boom, valueOf: boom } as never
    const hostileNow = Object.create(Date.prototype) as Date
    const proxy = new Proxy({}, { get: boom, has: boom, ownKeys: boom }) as never
    for (const run of [
      () => readToken(hostileKeys, PURPOSE, token, NOW), () => openToken(hostileKeys, PURPOSE, sealed, NOW),
      () => readToken(KEYS, PURPOSE, hostileToken, NOW), () => openToken(KEYS, PURPOSE, hostileToken, NOW),
      () => readToken(KEYS, PURPOSE, token, hostileNow), () => openToken(KEYS, PURPOSE, sealed, hostileNow),
      () => readToken(proxy, PURPOSE, token, NOW), () => openToken(proxy, PURPOSE, sealed, NOW),
      () => readToken(KEYS, proxy, token, NOW), () => openToken(KEYS, hostileToken, sealed, NOW),
    ]) {
      const answer = await run()
      expect(answer.ok).toBe(false)
    }
  })

  it('answers forged or key_missing, and nothing in the answer holds the token, the claim or a key', async () => {
    const token = await signToken(KEY, PURPOSE, CLAIM, 3_600, NOW)
    const answers = [
      await readToken(KEYS, PURPOSE, `${token}x`, NOW), await readToken({ current: OTHER_KEY }, PURPOSE, token, NOW), await readToken({}, PURPOSE, token, NOW),
      await readToken(KEYS, 'waitlist_claim', token, NOW), await readToken(KEYS, PURPOSE, token, new Date(NOW.getTime() + 7_200_000)),
    ]
    for (const answer of answers) {
      expect(answer.ok).toBe(false)
      const text = JSON.stringify(answer)
      for (const value of [KEY, OTHER_KEY, token, 'example-chess-club', 'player-one']) expect(text).not.toContain(value)
      expect(Object.keys(answer).sort()).toEqual(['ok', 'reason'])
    }
  })
})
