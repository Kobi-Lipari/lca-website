// functions/api/scan/index.ts
//
// POST /api/scan: one scoresheet page in, a verbatim transcription out.
// GET  /api/scan: how many games the member can still scan today.
//
// Members only, and capped per member per day, because each read is paid
// for on LCA's API key. The limit counts games, not photos: every page of
// one game carries the same X-Scan-Game id, and a game may have up to
// MAX_PAGES_PER_GAME pages. The photo is processed in memory and never
// stored. The response is a RawScan; turning it into legal moves happens in
// the browser (SCANNER_SPEC §2.2), so this endpoint applies no chess
// knowledge at all.

import type { Env } from '../../types'
import { isResponse, requireAuthedMember } from '../../utils/auth'
import { errorResponse, handleOptions, jsonResponse } from '../../utils/response'
import { scanDay } from '../../utils/scan/day'
import { extractRawScan, type ImageMediaType } from '../../utils/scan/extract'

/** Games per member per day. */
export const DAILY_GAME_LIMIT = 5

/** Front, back, and one continuation sheet. */
export const MAX_PAGES_PER_GAME = 3

// The client downscales to a 1568px long edge at JPEG 0.8, which lands well
// under 1MB. This leaves room for a PNG while keeping the base64 the model
// service receives under its 5MB per-image limit.
export const MAX_SCAN_BYTES = 3.5 * 1024 * 1024

const ACCEPTED_TYPES: ImageMediaType[] = ['image/jpeg', 'image/png', 'image/webp']

/** A browser crypto.randomUUID(), or anything else id-shaped and short. */
const GAME_ID = /^[A-Za-z0-9-]{8,64}$/

async function gamesStarted(db: D1Database, memberId: string, day: string): Promise<number> {
  const row = await db
    .prepare('SELECT COUNT(*) AS games FROM scan_games WHERE member_id = ? AND day = ?')
    .bind(memberId, day)
    .first<{ games: number }>()
  return row?.games ?? 0
}

type Claim =
  | { ok: true }
  | { ok: false; reason: 'daily-limit' | 'page-limit' }

/**
 * Claims one page for this game. A game the member has already started
 * takes another page (up to the cap); a new game needs a free slot in
 * today's allowance.
 *
 * One statement, so pages sent at the same moment can't both see a free
 * slot and both take it. The EXISTS clause is what lets page 2 of a game
 * through when that game was the one that filled the allowance: without it
 * the SELECT would produce no row, the ON CONFLICT would never fire, and the
 * page would be refused as a new game.
 */
async function claimPage(db: D1Database, memberId: string, gameId: string, day: string): Promise<Claim> {
  const row = await db
    .prepare(
      `INSERT INTO scan_games (member_id, game_id, day, pages)
       SELECT ?1, ?2, ?3, 1
       WHERE (SELECT COUNT(*) FROM scan_games WHERE member_id = ?1 AND day = ?3) < ?4
          OR EXISTS (SELECT 1 FROM scan_games WHERE member_id = ?1 AND game_id = ?2)
       ON CONFLICT(member_id, game_id) DO UPDATE SET pages = pages + 1 WHERE pages < ?5
       RETURNING pages`,
    )
    .bind(memberId, gameId, day, DAILY_GAME_LIMIT, MAX_PAGES_PER_GAME)
    .first<{ pages: number }>()
  if (row) return { ok: true }

  const existing = await db
    .prepare('SELECT 1 FROM scan_games WHERE member_id = ? AND game_id = ?')
    .bind(memberId, gameId)
    .first()
  return { ok: false, reason: existing ? 'page-limit' : 'daily-limit' }
}

/**
 * Hands a page back when the read failed and the member got nothing for it.
 * A game left with no successful page is removed, so it doesn't use up one
 * of the day's games.
 */
async function releasePage(db: D1Database, memberId: string, gameId: string): Promise<void> {
  await db.batch([
    db.prepare('UPDATE scan_games SET pages = pages - 1 WHERE member_id = ? AND game_id = ?').bind(memberId, gameId),
    db.prepare('DELETE FROM scan_games WHERE member_id = ? AND game_id = ? AND pages <= 0').bind(memberId, gameId),
  ])
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

/**
 * The member's allowance, so the page can show it before a scan and not
 * start one that would be refused.
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const authed = await requireAuthedMember(context.request, context.env)
  if (isResponse(authed)) return authed

  const started = await gamesStarted(context.env.DB, authed.member.id, scanDay())
  return jsonResponse({
    gamesLeftToday: Math.max(DAILY_GAME_LIMIT - started, 0),
    dailyGameLimit: DAILY_GAME_LIMIT,
    maxPagesPerGame: MAX_PAGES_PER_GAME,
  })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  const authed = await requireAuthedMember(request, env)
  if (isResponse(authed)) return authed

  if (!env.ANTHROPIC_API_KEY) {
    return errorResponse('Scoresheet scanning is not available right now.', 503)
  }

  const gameId = request.headers.get('x-scan-game') ?? ''
  if (!GAME_ID.test(gameId)) {
    return errorResponse('Missing scan game id. Please reload the page and try again.', 400)
  }

  const contentType = (request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
  const mediaType = ACCEPTED_TYPES.find((type) => type === contentType)
  if (!mediaType) {
    return errorResponse('Expected a JPEG, PNG or WebP photo of the scoresheet.', 415)
  }

  const image = await request.arrayBuffer()
  if (image.byteLength === 0) return errorResponse('Empty upload', 400)
  if (image.byteLength > MAX_SCAN_BYTES) return errorResponse('Photo too large', 413)

  const memberId = authed.member.id
  const day = scanDay()

  const claim = await claimPage(env.DB, memberId, gameId, day)
  if (!claim.ok) {
    return claim.reason === 'daily-limit'
      ? jsonResponse(
          {
            error: `You've scanned ${DAILY_GAME_LIMIT} games today, the daily limit. It resets at midnight Central time.`,
            gamesLeftToday: 0,
          },
          429,
        )
      : errorResponse(`A game can have at most ${MAX_PAGES_PER_GAME} pages.`, 429)
  }

  const result = await extractRawScan(env.ANTHROPIC_API_KEY, image, mediaType)

  if (result.kind !== 'ok') {
    await releasePage(env.DB, memberId, gameId)

    if (result.kind === 'malformed') {
      console.error('scan: unusable model reply:', result.reason, '| starts:', JSON.stringify(result.sample))
      return errorResponse("The scan didn't come back readable. Please try again.", 502)
    }

    console.error('scan: model service returned', result.status, '|', result.detail)
    // 429 and 529 are the model service being busy, not broken; worth a retry.
    if (result.status === 429 || result.status === 529) {
      return errorResponse('The scanner is busy. Please try again in a minute.', 503)
    }
    return errorResponse('The scanner is unavailable right now. Please try again later.', 502)
  }

  const started = await gamesStarted(env.DB, memberId, day)
  return jsonResponse({
    scan: result.scan,
    gamesLeftToday: Math.max(DAILY_GAME_LIMIT - started, 0),
  })
}
