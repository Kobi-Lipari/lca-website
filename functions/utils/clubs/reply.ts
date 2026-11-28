// functions/utils/clubs/reply.ts
//
// The Reply through LCA link (WS09 step 27): what a representative's or an
// LCA admin's copy of a relayed message carries in place of the visitor's
// address, and what the reply endpoint (functions/api/clubs/reply/[token].ts)
// opens.
//
// The link is /clubs/reply/{token} on the site's own host, built as the
// monthly check builds its Still accurate link (resolveSiteUrl and
// encodeURIComponent). The token is sealed with sealToken
// (functions/utils/tokens.ts) under the purpose club_reply for 30 days, and
// holds the visitor's name and address, the club's id and the first lines of
// the message. It is sealed, not only signed, since a signed token can be
// read by anyone who holds the link, and a link's address lands in mail
// logs and browser history: without the key nobody reads anything in it.
// Nothing is stored for it anywhere.
//
// The first lines are kept short, REPLY_EXCERPT_LENGTH characters at most,
// so the link stays short enough for a mail program not to break it: they
// are there only so the person answering knows which message it is, and the
// whole message is in the email beside the link.
//
// With no signing secret, or one too short to be a key, no link is made:
// replyLink answers null, and the copy says in words that it cannot be
// answered from the site. Nothing here logs a token, a claim or anything in
// one.
import { openToken, sealToken } from '../tokens'

/** The purpose a reply link is sealed for: no token of another purpose opens it, and it opens no other. */
export const REPLY_PURPOSE = 'club_reply'
/** How long a reply link works: 30 days, as the monthly check's link does. */
export const REPLY_TTL_SECONDS = 30 * 24 * 60 * 60
/** The most characters of the visitor's message the link carries. */
export const REPLY_EXCERPT_LENGTH = 160

/** What a reply link holds once opened. */
export interface ReplyClaim {
  name: string
  email: string
  clubId: string
  excerpt: string
}

/** Text as one line: every run of white space or control characters made one space. */
function asOneLine(text: string): string {
  return text.replace(/[\s\p{Cc}\p{Zl}\p{Zp}]+/gu, ' ').trim()
}

/**
 * The first lines of a message, as one line of at most REPLY_EXCERPT_LENGTH
 * characters: the whole message when it is that short, else cut at the last
 * space before the cap, or at the cap where there is none, with an ellipsis.
 */
export function firstLines(message: string): string {
  const line = asOneLine(message)
  if (line.length <= REPLY_EXCERPT_LENGTH) return line
  // Counted as the token counts a field, in UTF-16 code units; a character of two (an emoji) is never cut in half.
  let room = line.slice(0, REPLY_EXCERPT_LENGTH - 1)
  if (/[\uD800-\uDBFF]$/.test(room)) room = room.slice(0, -1)
  const space = room.lastIndexOf(' ')
  const cut = space >= REPLY_EXCERPT_LENGTH / 2 ? room.slice(0, space) : room
  return `${cut.trimEnd()}…`
}

/** A visitor's first name: the first word of the name they gave. */
export function firstNameOf(name: string): string {
  return asOneLine(name).split(' ')[0] || 'them'
}

type ReplyKeys = { SIGNING_SECRET?: string; SIGNING_SECRET_PREVIOUS?: string }

/**
 * The Reply through LCA link for one message, or null when it cannot be
 * made: no usable signing secret on this deployment, or, which the caps of
 * the contact form keep from ever happening, a claim too long for a token.
 * Never throws, so a copy is sent with or without it.
 */
export async function replyLink(env: ReplyKeys, siteUrl: string, visitor: { name: string; email: string; message: string }, clubId: string, now: Date = new Date()): Promise<string | null> {
  try {
    const token = await sealToken(env.SIGNING_SECRET, REPLY_PURPOSE, {
      n: asOneLine(visitor.name),
      e: visitor.email.trim(),
      c: clubId,
      m: firstLines(visitor.message),
    }, REPLY_TTL_SECONDS, now)
    return `${siteUrl}/clubs/reply/${encodeURIComponent(token)}`
  } catch {
    return null
  }
}

/** What opening a reply link answers: its claim, or refused (forged, changed, of another purpose or expired alike), or no key. */
export type ReplyOpened = { ok: true; claim: ReplyClaim } | { ok: false; reason: 'refused' | 'key_missing' }

/**
 * Opens a reply link's token at the caller's now. A token that is not ours,
 * was changed, was made for another purpose or is past its 30 days is
 * answered 'refused' alike, so nothing tells a forger which; a claim whose
 * fields are not all there is refused the same. Never throws.
 */
export async function openReplyLink(env: ReplyKeys, token: string, now: Date): Promise<ReplyOpened> {
  const read = await openToken({ current: env.SIGNING_SECRET, previous: env.SIGNING_SECRET_PREVIOUS }, REPLY_PURPOSE, token, now)
  if (!read.ok) return { ok: false, reason: read.reason === 'key_missing' ? 'key_missing' : 'refused' }
  const { n, e, c, m } = read.claim
  if (typeof n !== 'string' || typeof e !== 'string' || typeof c !== 'string' || typeof m !== 'string' || e === '' || c === '') {
    return { ok: false, reason: 'refused' }
  }
  return { ok: true, claim: { name: n, email: e, clubId: c, excerpt: m } }
}
