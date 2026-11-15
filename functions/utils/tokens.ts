// functions/utils/tokens.ts
//
// Tokens that carry a short claim and an expiry in a link: a signed token,
// which anyone who holds the link can read but nobody can change, and a
// sealed token, which nobody without the key can read or change. Both are
// made from one secret, SIGNING_SECRET, with SIGNING_SECRET_PREVIOUS read as
// well while the secret is being changed; nothing is ever signed or sealed
// under the earlier one.
//
// The forms, each part base64url with no padding:
//   signed  v1.s.<payload>.<mac>
//           payload is the JSON {"p": purpose, "c": claim, "e": expiry}, mac
//           the 32 bytes of HMAC-SHA256 over the exact text "v1.s.<payload>".
//   sealed  v1.x.<header>.<iv>.<body>
//           header is the JSON {"p": purpose, "e": expiry}, iv 12 fresh random
//           bytes, body the AES-GCM encryption of the JSON claim with its
//           16-byte tag, the exact text "v1.x.<header>" its additional data.
// The expiry is in whole seconds since 1970 (UTC). A token is good while the
// caller's now, in whole seconds, is below it, and stops being good at that
// second.
//
// The two keys are each derived from the secret with HKDF-SHA256 under a
// label of their own ("lca-token:v1:sign" and "lca-token:v1:seal"), so
// neither ever serves as the other, and neither is the secret itself.
//
// Reading checks, in this order, and stops at the first that fails: the
// token is text no longer than MAX_TOKEN_LENGTH, in its kind's form, and its
// signature or tag holds over the exact bytes received, under the current
// key and then the earlier one ('forged'); only then is anything in it
// parsed and believed: the purpose ('wrong_purpose'), then the expiry
// ('expired'). So a token that is not ours learns nothing more than
// 'forged'. readToken and openToken never throw, whatever they are given.
//
// A signed token is signed, not hidden: anyone who holds the link reads its
// claim, and a link's address lands in logs and browser history. So a
// signed claim carries ids only, never an email address or a name, and
// signToken refuses a claim whose text holds an '@'. What must not be read
// is sealed.
//
// Web Crypto alone (crypto.subtle and crypto.getRandomValues) and no import
// at all, so a Pages Function, the daily-emails worker and the tests run it
// the same, and nothing in it logs or words an error with a secret, a key,
// a token or a claim.

/** A claim: a flat object of short values, ids above all. */
export type TokenClaim = { readonly [field: string]: string | number | boolean | null }

/** Why a token was not read: not ours or changed, made for another purpose, or past its expiry. */
export type TokenRefusal = 'forged' | 'wrong_purpose' | 'expired'

/** What reading a token answers: its claim, or why not; 'key_missing' while this deployment has no usable secret. */
export type TokenRead = { ok: true; claim: TokenClaim } | { ok: false; reason: TokenRefusal | 'key_missing' }

/** The secrets a token is read with: the one tokens are made with now, and, while it is being changed, the one before. */
export interface TokenSecrets {
  current?: string | null
  previous?: string | null
}

/**
 * The secret is not set on this deployment, or is too short to be a key (as on the Preview environment and in the
 * browser tests until K sets it): no token can be made, and the caller sends nothing.
 */
export class TokenKeyMissing extends Error {
  constructor() {
    super('The signing secret is missing or too short on this deployment.')
    this.name = 'TokenKeyMissing'
  }
}

/** The shortest secret taken as a key: 32 characters. K makes the secret from 32 random bytes or more. */
export const MIN_SECRET_LENGTH = 32
/** The longest token read: anything longer is refused as forged before any crypto work. */
export const MAX_TOKEN_LENGTH = 4096
/** The longest life a token is given: 400 days, in seconds. */
export const MAX_TTL_SECONDS = 400 * 24 * 60 * 60

const VERSION = 'v1'
const SIGNED = 's'
const SEALED = 'x'
const SIGN_LABEL = 'lca-token:v1:sign'
const SEAL_LABEL = 'lca-token:v1:seal'
const SALT = 'lca-token'
const MAC_BYTES = 32
const IV_BYTES = 12
const TAG_BYTES = 16
/** A purpose: a short lowercase word, such as 'club_confirm' or 'waitlist:claim'. */
const PURPOSE = /^[a-z][a-z0-9_:-]{0,63}$/
const BASE64URL = /^[A-Za-z0-9_-]+$/
/** The most fields a claim carries, and the longest a field's name or text may be. */
const MAX_FIELDS = 16
const MAX_FIELD_LENGTH = 256

const encoder = new TextEncoder()

/** True for a secret long enough to be a key. */
function usable(secret: unknown): secret is string {
  return typeof secret === 'string' && secret.length >= MIN_SECRET_LENGTH
}

/** One of the two keys, derived from the secret under its own label. */
async function keyFor(secret: string, use: 'sign' | 'seal'): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', encoder.encode(secret), 'HKDF', false, ['deriveKey'])
  const params = { name: 'HKDF', hash: 'SHA-256', salt: encoder.encode(SALT), info: encoder.encode(use === 'sign' ? SIGN_LABEL : SEAL_LABEL) }
  return use === 'sign'
    ? crypto.subtle.deriveKey(params, base, { name: 'HMAC', hash: 'SHA-256', length: 256 }, false, ['sign', 'verify'])
    : crypto.subtle.deriveKey(params, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

function encode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** The bytes of a base64url part, or null for one that is not in its one plain form. */
function decode(part: string): Uint8Array | null {
  if (!BASE64URL.test(part) || part.length % 4 === 1) return null
  let binary: string
  try {
    binary = atob(part.replace(/-/g, '+').replace(/_/g, '/'))
  } catch {
    return null
  }
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  // One text for one value: a part whose unused bits are set is not one this file wrote.
  return encode(bytes) === part ? bytes : null
}

/** The JSON a part holds, or null for a part that is not UTF-8 JSON. */
function jsonOf(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes))
  } catch {
    return null
  }
}

function isClaim(value: unknown): value is TokenClaim {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const fields = Object.entries(value as Record<string, unknown>)
  if (fields.length > MAX_FIELDS) return false
  return fields.every(([name, v]) => name.length <= MAX_FIELD_LENGTH && (
    v === null || typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v)) || (typeof v === 'string' && v.length <= MAX_FIELD_LENGTH)
  ))
}

const isExpiry = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0

/** The expiry a token made now is given, checking what it is made with; the words of each Error name no value. */
function expiryFor(purpose: string, claim: TokenClaim, ttlSeconds: number, now: Date): number {
  if (typeof purpose !== 'string' || !PURPOSE.test(purpose)) throw new Error('A token\'s purpose is a short lowercase word.')
  if (!isClaim(claim)) throw new Error('A token\'s claim is a small flat object of short values.')
  if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > MAX_TTL_SECONDS) throw new Error('A token lives a whole number of seconds, at most 400 days.')
  const seconds = Math.floor(now.getTime() / 1000)
  if (!Number.isSafeInteger(seconds) || seconds < 0) throw new Error('A token is made at a real time.')
  return seconds + ttlSeconds
}

/** The caller's now in whole seconds, or null for a time that is not one. */
function secondsOf(now: unknown): number | null {
  if (!(now instanceof Date)) return null
  const seconds = Math.floor(now.getTime() / 1000)
  return Number.isSafeInteger(seconds) ? seconds : null
}

/** The secrets to try, current first; none while the current one is not usable. An earlier secret too short to be a key is not tried. */
function secretsOf(secrets: unknown): string[] | null {
  const given = (typeof secrets === 'object' && secrets !== null ? secrets : {}) as TokenSecrets
  if (!usable(given.current)) return null
  return usable(given.previous) && given.previous !== given.current ? [given.current, given.previous] : [given.current]
}

/**
 * A finished token, or an Error when it is longer than MAX_TOKEN_LENGTH: a token the readers would refuse is never made,
 * so a claim too big for a link fails where it is made, not silently where it is read. The words name no value.
 */
function withinBound(token: string): string {
  if (token.length > MAX_TOKEN_LENGTH) throw new Error('A token\'s claim is too long for a link.')
  return token
}

/** The purpose, then the expiry, of a token whose signature or tag held. */
function judge(purpose: unknown, expiry: unknown, claim: unknown, wanted: string, now: unknown): TokenRead {
  if (typeof purpose !== 'string' || !isExpiry(expiry) || !isClaim(claim)) return { ok: false, reason: 'forged' }
  if (purpose !== wanted) return { ok: false, reason: 'wrong_purpose' }
  const seconds = secondsOf(now)
  if (seconds === null || seconds >= expiry) return { ok: false, reason: 'expired' }
  return { ok: true, claim }
}

/**
 * Signs a claim for one purpose, good for ttlSeconds from now: `v1.s.<payload>.<mac>`. Throws TokenKeyMissing when the
 * secret is missing or shorter than MIN_SECRET_LENGTH, and an Error for a purpose, a claim or a life no token could
 * carry, a claim whose text holds an '@' among them, since anyone who holds the link reads it.
 */
export async function signToken(secret: string | null | undefined, purpose: string, claim: TokenClaim, ttlSeconds: number, now: Date = new Date()): Promise<string> {
  if (!usable(secret)) throw new TokenKeyMissing()
  const expiry = expiryFor(purpose, claim, ttlSeconds, now)
  if (Object.values(claim).some((v) => typeof v === 'string' && v.includes('@'))) throw new Error('A signed claim carries ids only, never an email address.')
  const signed = `${VERSION}.${SIGNED}.${encode(encoder.encode(JSON.stringify({ p: purpose, c: claim, e: expiry })))}`
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', await keyFor(secret, 'sign'), encoder.encode(signed)))
  return withinBound(`${signed}.${encode(mac)}`)
}

/**
 * Reads a signed token for one purpose at the caller's now: its claim, or 'forged', 'wrong_purpose' or 'expired', in
 * that order (see the head of this file), or 'key_missing' while the current secret is missing or too short. Never
 * throws, and reads no clock and no database.
 */
export async function readToken(secrets: TokenSecrets, purpose: string, token: string, now: Date): Promise<TokenRead> {
  try {
    const keys = secretsOf(secrets)
    if (keys === null) return { ok: false, reason: 'key_missing' }
    if (typeof token !== 'string' || token.length > MAX_TOKEN_LENGTH) return { ok: false, reason: 'forged' }
    const parts = token.split('.')
    if (parts.length !== 4 || parts[0] !== VERSION || parts[1] !== SIGNED) return { ok: false, reason: 'forged' }
    const mac = decode(parts[3])
    if (!BASE64URL.test(parts[2]) || mac === null || mac.length !== MAC_BYTES) return { ok: false, reason: 'forged' }
    const signed = encoder.encode(`${parts[0]}.${parts[1]}.${parts[2]}`)
    let holds = false
    for (const secret of keys) {
      // crypto.subtle.verify compares the signature in constant time.
      if (await crypto.subtle.verify('HMAC', await keyFor(secret, 'sign'), mac, signed)) {
        holds = true
        break
      }
    }
    if (!holds) return { ok: false, reason: 'forged' }
    const payload = decode(parts[2])
    const body = (payload === null ? null : jsonOf(payload)) as { p?: unknown; c?: unknown; e?: unknown } | null
    if (typeof body !== 'object' || body === null) return { ok: false, reason: 'forged' }
    return judge(body.p, body.e, body.c, purpose, now)
  } catch {
    return { ok: false, reason: 'forged' }
  }
}

/**
 * Seals a claim for one purpose, good for ttlSeconds from now: `v1.x.<header>.<iv>.<body>`, with a fresh random iv each
 * time, so two seals of one claim differ. The claim may hold what a signed one may not, since nobody without the key
 * reads it. Throws TokenKeyMissing when the secret is missing or shorter than MIN_SECRET_LENGTH, and an Error for a
 * purpose, a claim or a life no token could carry.
 */
export async function sealToken(secret: string | null | undefined, purpose: string, claim: TokenClaim, ttlSeconds: number, now: Date = new Date()): Promise<string> {
  if (!usable(secret)) throw new TokenKeyMissing()
  const expiry = expiryFor(purpose, claim, ttlSeconds, now)
  const bound = `${VERSION}.${SEALED}.${encode(encoder.encode(JSON.stringify({ p: purpose, e: expiry })))}`
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const body = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: encoder.encode(bound), tagLength: TAG_BYTES * 8 },
    await keyFor(secret, 'seal'),
    encoder.encode(JSON.stringify(claim)),
  ))
  return withinBound(`${bound}.${encode(iv)}.${encode(body)}`)
}

/**
 * Opens a sealed token for one purpose at the caller's now, as readToken reads a signed one: its claim, or 'forged',
 * 'wrong_purpose' or 'expired', in that order, or 'key_missing'. Never throws, and reads no clock and no database.
 */
export async function openToken(secrets: TokenSecrets, purpose: string, token: string, now: Date): Promise<TokenRead> {
  try {
    const keys = secretsOf(secrets)
    if (keys === null) return { ok: false, reason: 'key_missing' }
    if (typeof token !== 'string' || token.length > MAX_TOKEN_LENGTH) return { ok: false, reason: 'forged' }
    const parts = token.split('.')
    if (parts.length !== 5 || parts[0] !== VERSION || parts[1] !== SEALED) return { ok: false, reason: 'forged' }
    const iv = decode(parts[3])
    const body = decode(parts[4])
    if (!BASE64URL.test(parts[2]) || iv === null || body === null || iv.length !== IV_BYTES || body.length < TAG_BYTES) return { ok: false, reason: 'forged' }
    const bound = encoder.encode(`${parts[0]}.${parts[1]}.${parts[2]}`)
    let plain: Uint8Array | null = null
    for (const secret of keys) {
      try {
        plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: bound, tagLength: TAG_BYTES * 8 }, await keyFor(secret, 'seal'), body))
        break
      } catch {
        // The tag did not hold under this key; the next is tried.
      }
    }
    if (plain === null) return { ok: false, reason: 'forged' }
    const header = decode(parts[2])
    const head = (header === null ? null : jsonOf(header)) as { p?: unknown; e?: unknown } | null
    if (typeof head !== 'object' || head === null) return { ok: false, reason: 'forged' }
    return judge(head.p, head.e, jsonOf(plain), purpose, now)
  } catch {
    return { ok: false, reason: 'forged' }
  }
}
