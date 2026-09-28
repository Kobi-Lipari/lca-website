// test/integration/scan.test.ts — /api/scan, the scoresheet photo endpoint.
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  anthropicBehavior,
  anthropicRequests,
  invoke,
  resetHarness,
} from './harness'
import { seedMember } from './factories'

import {
  DAILY_GAME_LIMIT,
  MAX_PAGES_PER_GAME,
  MAX_SCAN_BYTES,
  onRequestGet as scanGet,
  onRequestPost as scanPost,
} from '../../functions/api/scan'
import { scanDay } from '../../functions/utils/scan/day'
import { SCAN_MODEL } from '../../functions/utils/scan/extract'
import type { RawScan } from '../../functions/utils/scan/rawScan'

// Stand-in image bytes. The endpoint never decodes the image, it only
// forwards it, so any bytes do; ASCII keeps the base64 check simple.
const PHOTO = 'not-really-a-jpeg-but-close-enough'

let gameCounter = 0
/** A fresh game id, as the page makes one per game. */
function newGame(): string {
  return `test-game-${++gameCounter}`
}

function scan(
  as: string | undefined,
  options: { body?: string; type?: string; game?: string | null } = {},
) {
  const headers: Record<string, string> = { 'Content-Type': options.type ?? 'image/jpeg' }
  const game = options.game === undefined ? newGame() : options.game
  if (game !== null) headers['X-Scan-Game'] = game
  return invoke(scanPost, {
    method: 'POST',
    path: '/api/scan',
    as,
    rawBody: options.body ?? PHOTO,
    headers,
  })
}

/** Games the member has started today, as the limit counts them. */
async function gamesToday(memberId: string): Promise<number> {
  const row = await env.DB.prepare('SELECT COUNT(*) AS games FROM scan_games WHERE member_id = ? AND day = ?')
    .bind(memberId, scanDay())
    .first<{ games: number }>()
  return row?.games ?? 0
}

/** Pretend the member already scanned `count` games today. */
async function useUpGames(memberId: string, count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    await env.DB.prepare('INSERT INTO scan_games (member_id, game_id, day, pages) VALUES (?, ?, ?, 1)')
      .bind(memberId, `earlier-${i}`, scanDay())
      .run()
  }
}

beforeEach(resetHarness)

describe('POST /api/scan: access and input', () => {
  it('refuses anonymous callers without calling the model', async () => {
    const res = await scan(undefined)
    expect(res.status).toBe(401)
    expect(anthropicRequests).toHaveLength(0)
  })

  it('refuses a request that is not an image', async () => {
    const res = await scan(await seedMember(), { type: 'application/pdf' })
    expect(res.status).toBe(415)
    expect(anthropicRequests).toHaveLength(0)
  })

  it('refuses an empty upload', async () => {
    const res = await scan(await seedMember(), { body: '' })
    expect(res.status).toBe(400)
  })

  it('refuses a photo over the size limit before spending a scan on it', async () => {
    const member = await seedMember()
    const res = await scan(member, { body: 'x'.repeat(MAX_SCAN_BYTES + 1) })
    expect(res.status).toBe(413)
    expect(anthropicRequests).toHaveLength(0)
    expect(await gamesToday(member)).toBe(0)
  })

  it('accepts a content type with parameters', async () => {
    const res = await scan(await seedMember(), { type: 'image/jpeg; charset=binary' })
    expect(res.status).toBe(200)
  })
})

describe('POST /api/scan: the model call', () => {
  it('sends the photo untouched with the verbatim prompt, and returns the scan', async () => {
    const member = await seedMember()
    const res = await scan(member, { type: 'image/png' })
    expect(res.status).toBe(200)

    const [sent] = anthropicRequests
    expect(sent.apiKey).toBe('sk-ant-test-harness')
    expect(sent.model).toBe(SCAN_MODEL)
    expect(sent.mediaType).toBe('image/png')
    expect(sent.imageBase64).toBe(btoa(PHOTO))
    // The rule the whole design leans on. If this ever disappears from the
    // prompt, the model starts correcting moves and the decoder's numbers
    // stop meaning anything.
    expect(sent.prompt).toMatch(/verbatim/i)
    expect(sent.prompt).toMatch(/do not correct/i)

    const body = await res.json<{ scan: RawScan; gamesLeftToday: number }>()
    expect(body.scan.header.legibility).toBe('clear')
    expect(body.scan.rows).toHaveLength(2)
    expect(body.scan.rows[1]).toEqual({
      n: 2,
      white: { raw: 'Nf3', alts: ['Nf5'], confidence: 'medium' },
      black: null,
    })
    expect(body.gamesLeftToday).toBe(DAILY_GAME_LIMIT - 1)
  })

  it('recovers a reply wrapped in code fences and chatter', async () => {
    anthropicBehavior.reply = [
      "Here's the transcription:",
      '```json',
      JSON.stringify({ header: { legibility: 'partial' }, rows: [{ n: 1, white: { raw: 'd4', confidence: 'high' }, black: null }] }),
      '```',
    ].join('\n')
    const res = await scan(await seedMember())
    expect(res.status).toBe(200)
    const body = await res.json<{ scan: RawScan }>()
    expect(body.scan.rows[0].white?.raw).toBe('d4')
  })

  it('passes an unreadable photo through as a normal result', async () => {
    // Not an error: the page shows "we couldn't read this" with the model's
    // reason, which is more useful than a generic failure.
    anthropicBehavior.reply = JSON.stringify({
      header: { legibility: 'unreadable' },
      rows: [],
      sheetNotes: ['This is a photo of a cat.'],
    })
    const res = await scan(await seedMember())
    expect(res.status).toBe(200)
    const body = await res.json<{ scan: RawScan }>()
    expect(body.scan.header.legibility).toBe('unreadable')
    expect(body.scan.sheetNotes).toEqual(['This is a photo of a cat.'])
  })

  it('returns 502 for a reply that is not a scan, and gives the scan back', async () => {
    const member = await seedMember()
    anthropicBehavior.reply = 'I am unable to help with that.'
    const res = await scan(member)
    expect(res.status).toBe(502)
    expect(await gamesToday(member)).toBe(0)
  })

  it('returns 502 when the model service fails, and gives the scan back', async () => {
    const member = await seedMember()
    anthropicBehavior.status = 500
    const res = await scan(member)
    expect(res.status).toBe(502)
    expect(await gamesToday(member)).toBe(0)
  })

  it('returns 502 on a network failure, and gives the scan back', async () => {
    const member = await seedMember()
    anthropicBehavior.throws = true
    const res = await scan(member)
    expect(res.status).toBe(502)
    expect(await gamesToday(member)).toBe(0)
  })

  it('returns 503 when the model service is busy', async () => {
    anthropicBehavior.status = 529
    const res = await scan(await seedMember())
    expect(res.status).toBe(503)
  })
})

describe('POST /api/scan: the daily limit counts games, not photos', () => {
  it('refuses a page without a game id', async () => {
    const res = await scan(await seedMember(), { game: null })
    expect(res.status).toBe(400)
    expect(anthropicRequests).toHaveLength(0)
  })

  it('counts every page of one game as a single game', async () => {
    const member = await seedMember()
    const game = newGame()
    for (let page = 0; page < MAX_PAGES_PER_GAME; page++) {
      const res = await scan(member, { game })
      expect(res.status).toBe(200)
    }
    expect(await gamesToday(member)).toBe(1)
  })

  it('refuses a page beyond the per-game cap, without calling the model', async () => {
    const member = await seedMember()
    const game = newGame()
    for (let page = 0; page < MAX_PAGES_PER_GAME; page++) await scan(member, { game })
    anthropicRequests.length = 0

    const res = await scan(member, { game })
    expect(res.status).toBe(429)
    expect((await res.json<{ error: string }>()).error).toMatch(/at most/)
    expect(anthropicRequests).toHaveLength(0)
  })

  it('refuses a new game once the day\'s games are used, without calling the model', async () => {
    const member = await seedMember()
    await useUpGames(member, DAILY_GAME_LIMIT)

    const res = await scan(member)
    expect(res.status).toBe(429)
    expect((await res.json<{ gamesLeftToday: number }>()).gamesLeftToday).toBe(0)
    expect(anthropicRequests).toHaveLength(0)
    expect(await gamesToday(member)).toBe(DAILY_GAME_LIMIT)
  })

  it('lets the last game of the day finish all its pages', async () => {
    const member = await seedMember()
    await useUpGames(member, DAILY_GAME_LIMIT - 1)
    const game = newGame()

    const first = await scan(member, { game })
    expect(first.status).toBe(200)
    expect((await first.json<{ gamesLeftToday: number }>()).gamesLeftToday).toBe(0)
    // The allowance is spent, but this game is already under way.
    const second = await scan(member, { game })
    expect(second.status).toBe(200)
  })

  it('does not count a game whose only page failed', async () => {
    const member = await seedMember()
    anthropicBehavior.status = 500
    await scan(member)
    expect(await gamesToday(member)).toBe(0)
  })

  it('keeps a game counted when a later page fails', async () => {
    const member = await seedMember()
    const game = newGame()
    await scan(member, { game })
    anthropicBehavior.status = 500
    await scan(member, { game })
    expect(await gamesToday(member)).toBe(1)
    const row = await env.DB.prepare('SELECT pages FROM scan_games WHERE member_id = ? AND game_id = ?')
      .bind(member, game)
      .first<{ pages: number }>()
    expect(row?.pages).toBe(1)
  })

  it("keeps each member's allowance separate", async () => {
    const heavy = await seedMember()
    await useUpGames(heavy, DAILY_GAME_LIMIT)
    const res = await scan(await seedMember())
    expect(res.status).toBe(200)
  })
})

describe('GET /api/scan: the allowance', () => {
  it('refuses anonymous callers', async () => {
    const res = await invoke(scanGet, { path: '/api/scan' })
    expect(res.status).toBe(401)
  })

  it('reports a full allowance for a member who has not scanned today', async () => {
    const res = await invoke(scanGet, { path: '/api/scan', as: await seedMember() })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      gamesLeftToday: DAILY_GAME_LIMIT,
      dailyGameLimit: DAILY_GAME_LIMIT,
      maxPagesPerGame: MAX_PAGES_PER_GAME,
    })
  })

  it('counts down by games, not pages', async () => {
    const member = await seedMember()
    const game = newGame()
    await scan(member, { game })
    await scan(member, { game })
    await scan(member)
    const res = await invoke(scanGet, { path: '/api/scan', as: member })
    expect((await res.json<{ gamesLeftToday: number }>()).gamesLeftToday).toBe(DAILY_GAME_LIMIT - 2)
  })
})
