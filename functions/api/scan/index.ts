// functions/api/scan/index.ts
//
// POST /api/scan: one scoresheet photo in, a verbatim transcription out.
//
// Members only, and capped per member per day, because each call is paid for
// on LCA's API key. The photo is processed in memory and never stored. The
// response is a RawScan; turning it into legal moves happens in the browser
// (SCANNER_SPEC §2.2), so this endpoint applies no chess knowledge at all.

import type { Env } from '../../types'
import { isResponse, requireAuthedMember } from '../../utils/auth'
import { errorResponse, handleOptions, jsonResponse } from '../../utils/response'
import { extractRawScan, type ImageMediaType } from '../../utils/scan/extract'

export const DAILY_SCAN_LIMIT = 20

// The client downscales to a 1568px long edge at JPEG 0.8, which lands well
// under 1MB. This leaves room for a PNG while keeping the base64 the model
// service receives under its 5MB per-image limit.
export const MAX_SCAN_BYTES = 3.5 * 1024 * 1024

const ACCEPTED_TYPES: ImageMediaType[] = ['image/jpeg', 'image/png', 'image/webp']

function utcDay(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Claims one scan for today and returns the count including it. A single
 * upsert, so two scans fired at once cannot both read the same count and
 * both slip under the limit.
 */
async function claimScan(db: D1Database, memberId: string, day: string): Promise<number> {
  const row = await db
    .prepare(
      `INSERT INTO scan_usage (member_id, day, count) VALUES (?, ?, 1)
       ON CONFLICT(member_id, day) DO UPDATE SET count = count + 1
       RETURNING count`,
    )
    .bind(memberId, day)
    .first<{ count: number }>()
  return row?.count ?? 1
}

/** Hands a claimed scan back: when the limit refused it, or when the failure
 *  was on our side or the model's and the member got nothing for it. */
async function releaseScan(db: D1Database, memberId: string, day: string): Promise<void> {
  await db
    .prepare('UPDATE scan_usage SET count = MAX(count - 1, 0) WHERE member_id = ? AND day = ?')
    .bind(memberId, day)
    .run()
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  const authed = await requireAuthedMember(request, env)
  if (isResponse(authed)) return authed

  if (!env.ANTHROPIC_API_KEY) {
    return errorResponse('Scoresheet scanning is not available right now.', 503)
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
  const day = utcDay()

  const used = await claimScan(env.DB, memberId, day)
  if (used > DAILY_SCAN_LIMIT) {
    // Keep the stored count at the limit, so it still means "scans run".
    await releaseScan(env.DB, memberId, day)
    return jsonResponse(
      {
        error: `You've used all ${DAILY_SCAN_LIMIT} scans for today. The limit resets at midnight UTC.`,
        scansLeftToday: 0,
      },
      429,
    )
  }

  const result = await extractRawScan(env.ANTHROPIC_API_KEY, image, mediaType)

  if (result.kind !== 'ok') {
    await releaseScan(env.DB, memberId, day)

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

  return jsonResponse({
    scan: result.scan,
    scansLeftToday: DAILY_SCAN_LIMIT - used,
  })
}
