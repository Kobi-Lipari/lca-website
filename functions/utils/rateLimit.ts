// functions/utils/rateLimit.ts
//
// The shared rate limit for the site's public endpoints, under the names the
// brief gives it (its live-mode section's rate_limits table, migration 0071),
// built early by WS09 step 25 for the workstreams that use it later.
//
//   limit(env, request, route, { perHour, key? })
//
// counts one call for this route, this place and this hour, and answers
// { ok: true } while the count is within perHour, or { ok: false, status,
// error } to refuse with: a 429 once the hour's count is past perHour, or a
// 503 when the limiter cannot count safely. The caller returns the refusal in
// its own answer.
//
// What is kept, and what is not:
// - The place is the visitor's network address as the platform itself gives
//   it, the CF-Connecting-IP header, which Cloudflare sets on every request
//   and a caller cannot put in its place. No header a caller writes
//   (X-Forwarded-For, X-Real-IP and the like) is read, so a forged one never
//   moves a call to another count. A signed-in member is counted by their id
//   instead, handed in as `key`. With no address at all, the route's one
//   shared count is used, which refuses no one in particular. An IPv6
//   address is counted by its first 64 bits, the network one connection is
//   usually given whole, so moving between its addresses buys no fresh count.
// - The bucket is HMAC-SHA-256 of the route, the place and the hour, under a
//   key made for the limiter alone: the HMAC of SIGNING_SECRET over the text
//   "rate-limit", so the secret that signs links is never itself the key
//   here. A plain hash would not do: every IPv4 address can be tried in
//   minutes, so an unkeyed bucket would hold an address anyone could get
//   back. The address is never stored, never logged and never part of an
//   answer.
// - With SIGNING_SECRET missing, or shorter than the 32 characters a token
//   needs (functions/utils/tokens.ts), the limiter refuses in words and
//   writes no row; it never falls back to an unkeyed hash.
// - The count is one statement that adds and reads back (an INSERT that adds
//   one to the row already there, RETURNING the count), so two calls at once
//   can never both be the last one allowed. Rows of an hour that has ended
//   are deleted in the same batch, so the table never grows past the hour's
//   rows.
// - A database before migration 0071 has no table: the call is let through
//   with one log line that names no address, so a migration run that lags the
//   site's build breaks no endpoint. Any other error is not caught.
//
// Every value is read at each call.
import type { Env } from '../types'
import { isMissingTableOrColumn } from './clubs/migrationLag'

/** The 429's words, once the hour's count is used up. */
export const TOO_MANY = 'Too many messages from here. Try again in an hour.'
/** The 503's words when the limiter has no key to count with. */
export const CANT_SEND_NOW = 'We can\'t send this right now.'
/** The one log line for a database before migration 0071. It names no address, no member and no route's caller. */
export const RATE_LIMITS_MISSING_LOG = 'rate limit: the rate_limits table of migration 0071 could not be read; the call goes on uncounted'

/** The shortest signing secret the limiter counts with: the length functions/utils/tokens.ts asks of the same secret. */
export const MIN_SECRET_LENGTH = 32
/** The text the limiter's own key is made from, so the signing secret is never itself the key. */
export const LIMITER_KEY_LABEL = 'rate-limit'
/** The header the platform sets to the visitor's network address. A caller cannot set it. */
export const ADDRESS_HEADER = 'CF-Connecting-IP'

export interface LimitOptions {
  /** How many calls one place may make to this route in an hour. */
  perHour: number
  /** A signed-in member's id, counted in place of the network address. */
  key?: string
}

export type LimitAnswer = { ok: true } | { ok: false; status: 429 | 503; error: string }

type LimitEnv = Pick<Env, 'DB' | 'SIGNING_SECRET'>

const encoder = new TextEncoder()

async function hmac(key: BufferSource, text: string): Promise<ArrayBuffer> {
  const imported = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return crypto.subtle.sign('HMAC', imported, encoder.encode(text))
}

const hex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('')

/** The start of the hour a moment falls in, in UTC, as SQLite's datetime('now') writes a time: "2026-11-17 15:00:00". */
export function hourStart(now: Date): string {
  return `${now.toISOString().slice(0, 13).replace('T', ' ')}:00:00`
}

/** The eight 16-bit groups of an IPv6 address, or null when the text is not one. */
function ipv6Groups(address: string): number[] | null {
  // A zone (fe80::1%eth0) names the visitor's own network card; the platform never sends one, and it is dropped.
  let text = address.split('%')[0]
  // An IPv4 address written at the end (::ffff:192.0.2.10) stands for the last two groups.
  const dotted = text.match(/^(.*:)(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (dotted) {
    const parts = dotted.slice(2, 6).map(Number)
    if (parts.some((p) => p > 255)) return null
    text = `${dotted[1]}${((parts[0] << 8) | parts[1]).toString(16)}:${((parts[2] << 8) | parts[3]).toString(16)}`
  }
  const halves = text.split('::')
  if (halves.length > 2) return null
  const groupsOf = (part: string) => (part === '' ? [] : part.split(':'))
  const front = groupsOf(halves[0])
  const back = halves.length === 2 ? groupsOf(halves[1]) : []
  const missing = 8 - front.length - back.length
  // "::" stands for one group of zeros or more; without it there must be eight groups.
  if (halves.length === 2 ? missing < 1 : missing !== 0) return null
  const groups = [...front, ...Array<string>(halves.length === 2 ? missing : 0).fill('0'), ...back]
  if (!groups.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return null
  return groups.map((g) => parseInt(g, 16))
}

/**
 * The place a network address is counted as. An IPv6 address is counted by its first 64 bits: one home or phone
 * connection is usually given that whole network, so a visitor who moves between its addresses is still one place
 * and cannot buy a fresh count with each. An IPv4 address, and an IPv6 address that carries one (::ffff:192.0.2.10),
 * is counted whole and as the same place. Text that is neither is counted as it stands, so it is never let through
 * uncounted. Exported for the tests; the place is only ever hashed, never stored.
 */
export function placeOfAddress(address: string): string {
  const text = address.trim().toLowerCase()
  if (!text.includes(':')) return `address:${text}`
  const groups = ipv6Groups(text)
  if (groups === null) return `address:${text}`
  if (groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff) {
    return `address:${groups[6] >> 8}.${groups[6] & 255}.${groups[7] >> 8}.${groups[7] & 255}`
  }
  return `network:${groups.slice(0, 4).map((g) => g.toString(16)).join(':')}::/64`
}

/** Who a call is counted as: the member, the platform's network address, or the route's one shared count. */
function placeOf(request: Request, key: string | undefined): string {
  if (typeof key === 'string' && key !== '') return `member:${key}`
  const address = request.headers.get(ADDRESS_HEADER)?.trim() ?? ''
  return address === '' ? 'shared' : placeOfAddress(address)
}

/**
 * The bucket a call is counted in: a keyed hash of the route, the place and the hour, in hex. Exported for the tests,
 * which hand it a made-up secret and address; nothing else needs it.
 */
export async function bucketFor(secret: string, route: string, place: string, hour: string): Promise<string> {
  const limiterKey = await hmac(encoder.encode(secret), LIMITER_KEY_LABEL)
  return hex(await hmac(limiterKey, `${route}\n${place}\n${hour}`))
}

/** Counts one call for this route, place and hour, and answers whether it is allowed. */
export async function limit(env: LimitEnv, request: Request, route: string, options: LimitOptions): Promise<LimitAnswer> {
  const secret = env.SIGNING_SECRET
  if (typeof secret !== 'string' || secret.length < MIN_SECRET_LENGTH) return { ok: false, status: 503, error: CANT_SEND_NOW }
  const hour = hourStart(new Date())
  const bucket = await bucketFor(secret, route, placeOf(request, options.key), hour)
  let hits: number
  try {
    const [, counted] = await env.DB.batch([
      env.DB.prepare('DELETE FROM rate_limits WHERE window_start < ?').bind(hour),
      env.DB.prepare(
        'INSERT INTO rate_limits (bucket, hits, window_start) VALUES (?, 1, ?) ON CONFLICT (bucket) DO UPDATE SET hits = hits + 1 RETURNING hits',
      ).bind(bucket, hour),
    ])
    hits = Number((counted.results[0] as { hits?: unknown } | undefined)?.hits)
  } catch (err) {
    if (!isMissingTableOrColumn(err)) throw err
    console.warn(RATE_LIMITS_MISSING_LOG)
    return { ok: true }
  }
  if (!Number.isFinite(hits) || hits > options.perHour) return { ok: false, status: 429, error: TOO_MANY }
  return { ok: true }
}
