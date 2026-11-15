// test/unit/signed-tokens.test.ts
//
// functions/utils/tokens.ts (WS09 step 13): the signed and the sealed
// tokens that later links carry. Held here, read as someone who wants in
// would read them: a token reads back only with the right key, purpose and
// time; a forged token is refused before anything in it is believed, then
// a token made for another purpose, then an expired one, at the exact
// second; every changed, cut short, swapped or spliced token is refused; a
// sealed claim cannot be read without the key and no part of it can be
// changed; a signed token is not opened and a sealed one is not read; the
// earlier key reads and never signs; no secret, a short one included, is a
// plain refusal; and reading never throws, whatever it is given.
//
// Every key here is written in this file and plainly made up; none is read
// from the environment. Every id is made up too.
import { describe, expect, it } from 'vitest'
import {
  MAX_TOKEN_LENGTH, MIN_SECRET_LENGTH, TokenKeyMissing, openToken, readToken, sealToken, signToken, type TokenClaim,
} from '../../functions/utils/tokens'

const KEY = 'example-signing-key-not-a-real-one-0001'
const OTHER_KEY = 'example-signing-key-not-a-real-one-0002'
const SHORT_KEY = 'example-short-key'
const NOW = new Date(Date.UTC(2026, 10, 14, 18, 0, 0))
const LATER = (seconds: number) => new Date(NOW.getTime() + seconds * 1000)
const CLAIM: TokenClaim = { clubId: 'example-chess-club', memberId: 'player-one' }
const PURPOSE = 'club_confirm'
const KEYS = { current: KEY }

const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64url')
const unb64 = (part: string) => new Uint8Array(Buffer.from(part, 'base64url'))
const json = (part: string) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<string, unknown>
const forged = { ok: false, reason: 'forged' }
/** A base64url character other than the one given. */
const other = (c: string) => (c === 'A' ? 'B' : 'A')

/** The HMAC key the file derives, made here from its labels, so a test can sign a payload of its own. */
async function derived(secret: string, label: string, use: 'sign' | 'seal'): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const base = await crypto.subtle.importKey('raw', enc.encode(secret), 'HKDF', false, ['deriveKey'])
  const params = { name: 'HKDF', hash: 'SHA-256', salt: enc.encode('lca-token'), info: enc.encode(label) }
  return use === 'sign'
    ? crypto.subtle.deriveKey(params, base, { name: 'HMAC', hash: 'SHA-256', length: 256 }, false, ['sign'])
    : crypto.subtle.deriveKey(params, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt'])
}
/** A signed token over any payload text, made with the file's own sign key. */
async function signedOver(payloadText: string, secret = KEY, label = 'lca-token:v1:sign'): Promise<string> {
  const signed = `v1.s.${b64(new TextEncoder().encode(payloadText))}`
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', await derived(secret, label, 'sign'), new TextEncoder().encode(signed)))
  return `${signed}.${b64(mac)}`
}
/** A sealed token over any header and claim text, made with the file's own seal key. */
async function sealedOver(headerText: string, claimText: string, secret = KEY, label = 'lca-token:v1:seal'): Promise<string> {
  const bound = `v1.x.${b64(new TextEncoder().encode(headerText))}`
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const body = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(bound), tagLength: 128 }, await derived(secret, label, 'seal'), new TextEncoder().encode(claimText),
  ))
  return `${bound}.${b64(iv)}.${b64(body)}`
}

describe('the seven cases of the step', () => {
  it('a valid token reads back', async () => {
    const token = await signToken(KEY, PURPOSE, CLAIM, 3600, NOW)
    expect(token.startsWith('v1.s.')).toBe(true)
    expect(token.split('.')).toHaveLength(4)
    expect(await readToken(KEYS, PURPOSE, token, NOW)).toEqual({ ok: true, claim: CLAIM })
    const sealed = await sealToken(KEY, PURPOSE, CLAIM, 3600, NOW)
    expect(sealed.startsWith('v1.x.')).toBe(true)
    expect(await openToken(KEYS, PURPOSE, sealed, NOW)).toEqual({ ok: true, claim: CLAIM })
  })

  it('expired at the second', async () => {
    const token = await signToken(KEY, PURPOSE, CLAIM, 60, NOW)
    // The expiry is the second the token was made, in whole seconds, and the life given.
    expect(json(token.split('.')[2]).e).toBe(NOW.getTime() / 1000 + 60)
    expect(await readToken(KEYS, PURPOSE, token, new Date(NOW.getTime() + 59_999))).toEqual({ ok: true, claim: CLAIM })
    expect(await readToken(KEYS, PURPOSE, token, LATER(60))).toEqual({ ok: false, reason: 'expired' })
    expect(await readToken(KEYS, PURPOSE, token, LATER(61))).toEqual({ ok: false, reason: 'expired' })
    const sealed = await sealToken(KEY, PURPOSE, CLAIM, 60, NOW)
    expect(await openToken(KEYS, PURPOSE, sealed, new Date(NOW.getTime() + 59_999))).toEqual({ ok: true, claim: CLAIM })
    expect(await openToken(KEYS, PURPOSE, sealed, LATER(60))).toEqual({ ok: false, reason: 'expired' })
    // A time made part way through a second is read in whole seconds: made at .999, it stops at the same second.
    const late = await signToken(KEY, PURPOSE, CLAIM, 60, new Date(NOW.getTime() + 999))
    expect(await readToken(KEYS, PURPOSE, late, new Date(NOW.getTime() + 59_999))).toEqual({ ok: true, claim: CLAIM })
    expect(await readToken(KEYS, PURPOSE, late, LATER(60))).toEqual({ ok: false, reason: 'expired' })
  })

  it('a changed byte is forged', async () => {
    const token = await signToken(KEY, PURPOSE, CLAIM, 3600, NOW)
    const start = 'v1.s.'.length
    for (let i = start; i < token.length; i++) {
      if (token[i] === '.') continue
      const changed = `${token.slice(0, i)}${other(token[i])}${token.slice(i + 1)}`
      expect(await readToken(KEYS, PURPOSE, changed, NOW), `character ${i}`).toEqual(forged)
    }
  })

  it('another purpose is refused', async () => {
    const token = await signToken(KEY, PURPOSE, CLAIM, 3600, NOW)
    expect(await readToken(KEYS, 'waitlist_claim', token, NOW)).toEqual({ ok: false, reason: 'wrong_purpose' })
    const sealed = await sealToken(KEY, PURPOSE, CLAIM, 3600, NOW)
    expect(await openToken(KEYS, 'waitlist_claim', sealed, NOW)).toEqual({ ok: false, reason: 'wrong_purpose' })
  })

  it('the earlier key still reads', async () => {
    const old = await signToken(KEY, PURPOSE, CLAIM, 3600, NOW)
    const rotated = { current: OTHER_KEY, previous: KEY }
    expect(await readToken(rotated, PURPOSE, old, NOW)).toEqual({ ok: true, claim: CLAIM })
    const oldSeal = await sealToken(KEY, PURPOSE, CLAIM, 3600, NOW)
    expect(await openToken(rotated, PURPOSE, oldSeal, NOW)).toEqual({ ok: true, claim: CLAIM })
    // Without the earlier key the old token is forged.
    expect(await readToken({ current: OTHER_KEY }, PURPOSE, old, NOW)).toEqual(forged)
  })

  it('a sealed claim cannot be read without the key', async () => {
    const secretClaim: TokenClaim = { email: 'player.one@example.org', memberId: 'player-one' }
    const sealed = await sealToken(KEY, PURPOSE, secretClaim, 3600, NOW)
    for (const piece of ['player.one', 'example.org', 'player-one', b64(new TextEncoder().encode(JSON.stringify(secretClaim))).slice(0, 12)]) {
      expect(sealed, piece).not.toContain(piece)
    }
    // The header holds only the purpose and the expiry.
    expect(json(sealed.split('.')[2])).toEqual({ p: PURPOSE, e: NOW.getTime() / 1000 + 3600 })
    expect(await openToken({ current: OTHER_KEY }, PURPOSE, sealed, NOW)).toEqual(forged)
    expect(await openToken(KEYS, PURPOSE, sealed, NOW)).toEqual({ ok: true, claim: secretClaim })
  })

  it('no key is a plain refusal', async () => {
    for (const secret of [undefined, null, '', SHORT_KEY, 'x'.repeat(MIN_SECRET_LENGTH - 1)]) {
      await expect(signToken(secret, PURPOSE, CLAIM, 60, NOW), String(secret)).rejects.toBeInstanceOf(TokenKeyMissing)
      await expect(sealToken(secret, PURPOSE, CLAIM, 60, NOW), String(secret)).rejects.toBeInstanceOf(TokenKeyMissing)
    }
    const token = await signToken(KEY, PURPOSE, CLAIM, 60, NOW)
    const sealed = await sealToken(KEY, PURPOSE, CLAIM, 60, NOW)
    for (const keys of [{}, { current: undefined }, { current: '' }, { current: SHORT_KEY }, { current: SHORT_KEY, previous: KEY }]) {
      expect(await readToken(keys, PURPOSE, token, NOW), JSON.stringify(keys)).toEqual({ ok: false, reason: 'key_missing' })
      expect(await openToken(keys, PURPOSE, sealed, NOW), JSON.stringify(keys)).toEqual({ ok: false, reason: 'key_missing' })
    }
    // The refusal's words name no secret.
    const refusal = await signToken(SHORT_KEY, PURPOSE, CLAIM, 60, NOW).catch((err: unknown) => err as Error)
    expect(refusal.name).toBe('TokenKeyMissing')
    expect(`${refusal.message} ${refusal.stack ?? ''}`).not.toContain(SHORT_KEY)
    expect(MIN_SECRET_LENGTH).toBe(32)
  })
})

describe('read as someone who wants in would read it', () => {
  it('refuses a token cut short anywhere', async () => {
    const token = await signToken(KEY, PURPOSE, CLAIM, 3600, NOW)
    for (let cut = 0; cut < token.length; cut += 7) expect(await readToken(KEYS, PURPOSE, token.slice(0, cut), NOW), `${cut}`).toEqual(forged)
    expect(await readToken(KEYS, PURPOSE, token.slice(0, -1), NOW)).toEqual(forged)
    expect(await readToken(KEYS, PURPOSE, token.slice(0, token.lastIndexOf('.')), NOW)).toEqual(forged)
    const sealed = await sealToken(KEY, PURPOSE, CLAIM, 3600, NOW)
    expect(await openToken(KEYS, PURPOSE, sealed.slice(0, -1), NOW)).toEqual(forged)
    expect(await openToken(KEYS, PURPOSE, sealed.slice(0, -22), NOW)).toEqual(forged)
  })

  it('refuses two tokens with their signatures swapped', async () => {
    const one = (await signToken(KEY, PURPOSE, { memberId: 'player-one' }, 3600, NOW)).split('.')
    const two = (await signToken(KEY, PURPOSE, { memberId: 'player-two' }, 3600, NOW)).split('.')
    expect(await readToken(KEYS, PURPOSE, [...one.slice(0, 3), two[3]].join('.'), NOW)).toEqual(forged)
    expect(await readToken(KEYS, PURPOSE, [...two.slice(0, 3), one[3]].join('.'), NOW)).toEqual(forged)
    const sOne = (await sealToken(KEY, PURPOSE, { memberId: 'player-one' }, 3600, NOW)).split('.')
    const sTwo = (await sealToken(KEY, PURPOSE, { memberId: 'player-two' }, 7200, NOW)).split('.')
    // One seal's body under the other's iv, and one's header (a longer life) with the other's iv and body.
    expect(await openToken(KEYS, PURPOSE, [...sOne.slice(0, 3), sTwo[4]].join('.'), NOW)).toEqual(forged)
    expect(await openToken(KEYS, PURPOSE, [...sOne.slice(0, 2), sTwo[2], ...sOne.slice(3)].join('.'), NOW)).toEqual(forged)
  })

  it('refuses a payload edited to push its expiry out, and one edited to another purpose or claim', async () => {
    const parts = (await signToken(KEY, PURPOSE, CLAIM, 60, NOW)).split('.')
    const payload = json(parts[2])
    for (const edit of [{ e: (payload.e as number) + 3600 }, { p: 'waitlist_claim' }, { c: { ...CLAIM, memberId: 'player-two' } }]) {
      const edited = b64(new TextEncoder().encode(JSON.stringify({ ...payload, ...edit })))
      const token = [parts[0], parts[1], edited, parts[3]].join('.')
      expect(await readToken(KEYS, PURPOSE, token, LATER(120)), JSON.stringify(edit)).toEqual(forged)
      expect(await readToken(KEYS, PURPOSE, token, NOW), JSON.stringify(edit)).toEqual(forged)
    }
    // A sealed header edited to push its expiry out.
    const sealed = (await sealToken(KEY, PURPOSE, CLAIM, 60, NOW)).split('.')
    const header = json(sealed[2])
    const longer = b64(new TextEncoder().encode(JSON.stringify({ ...header, e: (header.e as number) + 3600 })))
    expect(await openToken(KEYS, PURPOSE, [sealed[0], sealed[1], longer, sealed[3], sealed[4]].join('.'), LATER(120))).toEqual(forged)
  })

  it('refuses a token signed for one purpose when read as another, and a seal under one purpose opened under another', async () => {
    for (const purpose of ['club_confirm', 'waitlist_claim', 'digest_unsubscribe']) {
      const token = await signToken(KEY, purpose, CLAIM, 3600, NOW)
      const sealed = await sealToken(KEY, purpose, CLAIM, 3600, NOW)
      for (const reading of ['club_confirm', 'waitlist_claim', 'digest_unsubscribe', 'club_confirm ', '']) {
        const want = reading === purpose ? { ok: true, claim: CLAIM } : { ok: false, reason: 'wrong_purpose' }
        expect(await readToken(KEYS, reading, token, NOW), `${purpose} as ${reading}`).toEqual(want)
        expect(await openToken(KEYS, reading, sealed, NOW), `${purpose} as ${reading}`).toEqual(want)
      }
    }
  })

  it('refuses a sealed token with one byte changed in its iv, in its body and in its tag', async () => {
    const parts = (await sealToken(KEY, PURPOSE, CLAIM, 3600, NOW)).split('.')
    const flip = (part: string, at: number) => {
      const bytes = unb64(part)
      bytes[at] ^= 0x01
      return b64(bytes)
    }
    const body = unb64(parts[4])
    const changed = {
      iv: [0, 5, 11].map((at) => [...parts.slice(0, 3), flip(parts[3], at), parts[4]].join('.')),
      body: [0, Math.floor((body.length - 16) / 2), body.length - 17].map((at) => [...parts.slice(0, 4), flip(parts[4], at)].join('.')),
      tag: [body.length - 16, body.length - 8, body.length - 1].map((at) => [...parts.slice(0, 4), flip(parts[4], at)].join('.')),
    }
    for (const [where, tokens] of Object.entries(changed)) {
      for (const token of tokens) expect(await openToken(KEYS, PURPOSE, token, NOW), where).toEqual(forged)
    }
    // And every character of the sealed token, one at a time.
    const whole = parts.join('.')
    for (let i = 'v1.x.'.length; i < whole.length; i += 3) {
      if (whole[i] === '.') continue
      expect(await openToken(KEYS, PURPOSE, `${whole.slice(0, i)}${other(whole[i])}${whole.slice(i + 1)}`, NOW), `character ${i}`).toEqual(forged)
    }
  })

  it('gives two seals of one claim different texts and ivs, each opening', async () => {
    const one = await sealToken(KEY, PURPOSE, CLAIM, 3600, NOW)
    const two = await sealToken(KEY, PURPOSE, CLAIM, 3600, NOW)
    expect(one).not.toBe(two)
    expect(one.split('.')[3]).not.toBe(two.split('.')[3])
    expect(unb64(one.split('.')[3])).toHaveLength(12)
    expect(await openToken(KEYS, PURPOSE, one, NOW)).toEqual({ ok: true, claim: CLAIM })
    expect(await openToken(KEYS, PURPOSE, two, NOW)).toEqual({ ok: true, claim: CLAIM })
  })

  it('refuses a huge, an empty and a non-text input, and never throws, whatever it is given', async () => {
    const token = await signToken(KEY, PURPOSE, CLAIM, 3600, NOW)
    const inputs: unknown[] = [
      '', ' ', '.', '...', 'v1', 'v1.s', 'v1.s..', 'v1.x....', 'x'.repeat(MAX_TOKEN_LENGTH + 1), `${token}${'A'.repeat(MAX_TOKEN_LENGTH)}`, 'a'.repeat(5_000_000),
      'v1.s.!!!!.####', 'v1.s.e30.AAAA', `v1.s.${'A'.repeat(43)}.${'A'.repeat(43)}`, 'v1.s.%E2%80.abc', `v1.s.${b64(new Uint8Array([0xff, 0xfe]))}.${token.split('.')[3]}`,
      `v2.s.${token.split('.').slice(2).join('.')}`, `V1.${token.slice(3)}`, ` ${token}`, `${token} `, `${token}.`, token.replace('.', '..'),
      123, 0, null, undefined, {}, [], [token], { token }, true, Symbol('example'), () => token, new Uint8Array(4), 10n,
    ]
    for (const input of inputs) {
      const label = typeof input === 'string' ? input.slice(0, 40) : typeof input
      expect(await readToken(KEYS, PURPOSE, input as string, NOW), label).toEqual(forged)
      expect(await openToken(KEYS, PURPOSE, input as string, NOW), label).toEqual(forged)
    }
    // Given secrets that are not an object, or a now that is not a time, reading still answers.
    expect(await readToken(null as never, PURPOSE, token, NOW)).toEqual({ ok: false, reason: 'key_missing' })
    expect(await readToken('not keys' as never, PURPOSE, token, NOW)).toEqual({ ok: false, reason: 'key_missing' })
    expect(await readToken(KEYS, PURPOSE, token, new Date(Number.NaN))).toEqual({ ok: false, reason: 'expired' })
    expect(await readToken(KEYS, PURPOSE, token, 'today' as never)).toEqual({ ok: false, reason: 'expired' })
    expect(await readToken(KEYS, 42 as never, token, NOW)).toEqual({ ok: false, reason: 'wrong_purpose' })
  })

  it('refuses, after the signature holds, a payload that is not JSON or has a field missing or mistyped', async () => {
    const e = NOW.getTime() / 1000 + 3600
    const payloads = [
      'not json', '', 'null', '[]', '"text"', '{}', JSON.stringify({ p: PURPOSE, c: CLAIM }), JSON.stringify({ p: PURPOSE, e }), JSON.stringify({ c: CLAIM, e }),
      JSON.stringify({ p: 7, c: CLAIM, e }), JSON.stringify({ p: PURPOSE, c: 'player-one', e }), JSON.stringify({ p: PURPOSE, c: [CLAIM], e }),
      JSON.stringify({ p: PURPOSE, c: { nested: { id: 'player-one' } }, e }), JSON.stringify({ p: PURPOSE, c: CLAIM, e: String(e) }),
      JSON.stringify({ p: PURPOSE, c: CLAIM, e: e + 0.5 }), JSON.stringify({ p: PURPOSE, c: CLAIM, e: -1 }),
    ]
    for (const text of payloads) expect(await readToken(KEYS, PURPOSE, await signedOver(text), NOW), text).toEqual(forged)
    // The same payload in its right shape reads, so the cases above fail on their shape alone.
    expect(await readToken(KEYS, PURPOSE, await signedOver(JSON.stringify({ p: PURPOSE, c: CLAIM, e })), NOW)).toEqual({ ok: true, claim: CLAIM })
    for (const [header, claim] of [['not json', JSON.stringify(CLAIM)], [JSON.stringify({ p: PURPOSE }), JSON.stringify(CLAIM)], [JSON.stringify({ p: PURPOSE, e }), 'not json'], [JSON.stringify({ p: PURPOSE, e }), '"player-one"']]) {
      expect(await openToken(KEYS, PURPOSE, await sealedOver(header, claim), NOW), `${header} ${claim}`).toEqual(forged)
    }
    expect(await openToken(KEYS, PURPOSE, await sealedOver(JSON.stringify({ p: PURPOSE, e }), JSON.stringify(CLAIM)), NOW)).toEqual({ ok: true, claim: CLAIM })
  })

  it('checks the signature before the purpose and the purpose before the expiry', async () => {
    const token = await signToken(KEY, PURPOSE, CLAIM, 60, NOW)
    const changed = `${token.slice(0, -2)}${other(token.at(-2) as string)}${token.at(-1)}`
    // Forged, of another purpose and expired all at once: forged.
    expect(await readToken(KEYS, 'waitlist_claim', changed, LATER(3600))).toEqual(forged)
    // Ours, of another purpose and expired: wrong_purpose.
    expect(await readToken(KEYS, 'waitlist_claim', token, LATER(3600))).toEqual({ ok: false, reason: 'wrong_purpose' })
    const sealed = await sealToken(KEY, PURPOSE, CLAIM, 60, NOW)
    expect(await openToken({ current: OTHER_KEY }, 'waitlist_claim', sealed, LATER(3600))).toEqual(forged)
    expect(await openToken(KEYS, 'waitlist_claim', sealed, LATER(3600))).toEqual({ ok: false, reason: 'wrong_purpose' })
  })

  it('does not open a signed token, and does not read a sealed one', async () => {
    const token = await signToken(KEY, PURPOSE, CLAIM, 3600, NOW)
    const sealed = await sealToken(KEY, PURPOSE, CLAIM, 3600, NOW)
    expect(await openToken(KEYS, PURPOSE, token, NOW)).toEqual(forged)
    expect(await readToken(KEYS, PURPOSE, sealed, NOW)).toEqual(forged)
    // Nor one with its kind's mark changed to the other's.
    expect(await openToken(KEYS, PURPOSE, token.replace('v1.s.', 'v1.x.'), NOW)).toEqual(forged)
    expect(await readToken(KEYS, PURPOSE, sealed.replace('v1.x.', 'v1.s.'), NOW)).toEqual(forged)
  })

  it('derives the sign key and the seal key each under its own label, neither the secret itself', async () => {
    const payload = JSON.stringify({ p: PURPOSE, c: CLAIM, e: NOW.getTime() / 1000 + 3600 })
    expect(await readToken(KEYS, PURPOSE, await signedOver(payload), NOW)).toEqual({ ok: true, claim: CLAIM })
    expect(await readToken(KEYS, PURPOSE, await signedOver(payload, KEY, 'lca-token:v1:seal'), NOW)).toEqual(forged)
    // An HMAC under the secret itself, with no label.
    const signed = `v1.s.${b64(new TextEncoder().encode(payload))}`
    const raw = await crypto.subtle.importKey('raw', new TextEncoder().encode(KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const rawMac = b64(new Uint8Array(await crypto.subtle.sign('HMAC', raw, new TextEncoder().encode(signed))))
    expect(await readToken(KEYS, PURPOSE, `${signed}.${rawMac}`, NOW)).toEqual(forged)
    const header = JSON.stringify({ p: PURPOSE, e: NOW.getTime() / 1000 + 3600 })
    expect(await openToken(KEYS, PURPOSE, await sealedOver(header, JSON.stringify(CLAIM)), NOW)).toEqual({ ok: true, claim: CLAIM })
    expect(await openToken(KEYS, PURPOSE, await sealedOver(header, JSON.stringify(CLAIM), KEY, 'lca-token:v1:sign'), NOW)).toEqual(forged)
  })

  it('reads with the earlier key and never signs or seals with it', async () => {
    const rotated = { current: OTHER_KEY, previous: KEY }
    // signToken and sealToken take one secret, the current one: what they make reads under the current key alone.
    const made = await signToken(rotated.current, PURPOSE, CLAIM, 3600, NOW)
    expect(await readToken({ current: OTHER_KEY }, PURPOSE, made, NOW)).toEqual({ ok: true, claim: CLAIM })
    expect(await readToken({ current: KEY }, PURPOSE, made, NOW)).toEqual(forged)
    const sealed = await sealToken(rotated.current, PURPOSE, CLAIM, 3600, NOW)
    expect(await openToken({ current: KEY }, PURPOSE, sealed, NOW)).toEqual(forged)
    // An earlier key too short to be a key is not tried.
    const short = await signedOver(JSON.stringify({ p: PURPOSE, c: CLAIM, e: NOW.getTime() / 1000 + 3600 }), SHORT_KEY)
    expect(await readToken({ current: KEY, previous: SHORT_KEY }, PURPOSE, short, NOW)).toEqual(forged)
  })

  it('refuses to sign an address into a claim anyone can read, and words each refusal without a value', async () => {
    const withAddress: TokenClaim = { memberId: 'player-one', email: 'player.one@example.org' }
    const refusal = await signToken(KEY, PURPOSE, withAddress, 3600, NOW).catch((err: unknown) => err as Error)
    expect(refusal).toBeInstanceOf(Error)
    expect(refusal.message).not.toMatch(/player|example|@/)
    for (const [purpose, claim, ttl] of [
      ['Club Confirm', CLAIM, 60], ['', CLAIM, 60], [PURPOSE, 'player-one', 60], [PURPOSE, { nested: { id: 'x' } }, 60], [PURPOSE, CLAIM, 0], [PURPOSE, CLAIM, 1.5], [PURPOSE, CLAIM, 401 * 86_400],
    ] as const) {
      const err = await signToken(KEY, purpose, claim as never, ttl, NOW).catch((e: unknown) => e as Error)
      expect(err, `${purpose} ${ttl}`).toBeInstanceOf(Error)
      expect(err.message, `${purpose} ${ttl}`).not.toContain(KEY)
      expect(err.message, `${purpose} ${ttl}`).not.toContain('player-one')
    }
    // The sealed kind may carry an address, since nobody without the key reads it.
    expect(await openToken(KEYS, PURPOSE, await sealToken(KEY, PURPOSE, withAddress, 3600, NOW), NOW)).toEqual({ ok: true, claim: withAddress })
  })

  it('puts the version mark at the front of each kind and stays within the length bound for a usual claim', async () => {
    const token = await signToken(KEY, PURPOSE, CLAIM, 3600, NOW)
    const sealed = await sealToken(KEY, PURPOSE, CLAIM, 3600, NOW)
    expect(token).toMatch(/^v1\.s\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/)
    expect(sealed).toMatch(/^v1\.x\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+$/)
    expect(token.length).toBeLessThan(300)
    expect(MAX_TOKEN_LENGTH).toBe(4096)
  })

  it('refuses to make a token longer than the readers take, of either kind, with words that name no value', async () => {
    // Sixteen fields of 200 characters each: a claim the shape allows, but whose token is longer than MAX_TOKEN_LENGTH.
    const big: TokenClaim = Object.fromEntries(Array.from({ length: 16 }, (_, i) => [`field${String(i).padStart(2, '0')}${'n'.repeat(190)}`, `player-one-${'v'.repeat(189)}`]))
    for (const make of [signToken, sealToken]) {
      const err = await make(KEY, PURPOSE, big, 3600, NOW).catch((e: unknown) => e as Error)
      expect(err).toBeInstanceOf(Error)
      expect(err).not.toBeInstanceOf(TokenKeyMissing)
      expect(err.message).toBe('A token\'s claim is too long for a link.')
      expect(err.message).not.toContain(KEY)
      expect(err.message).not.toContain('player-one')
    }
    // A claim just inside the bound is made, and reads back.
    const fits: TokenClaim = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`field${i}`, `player-${'v'.repeat(200)}`]))
    const token = await signToken(KEY, PURPOSE, fits, 3600, NOW)
    expect(token.length).toBeLessThanOrEqual(MAX_TOKEN_LENGTH)
    expect(await readToken(KEYS, PURPOSE, token, NOW)).toEqual({ ok: true, claim: fits })
  })
})
