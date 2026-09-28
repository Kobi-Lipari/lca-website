// test/integration/scan.test.ts — POST /api/scan, the scoresheet photo endpoint.
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
  DAILY_SCAN_LIMIT,
  MAX_SCAN_BYTES,
  onRequestPost as scanPost,
} from '../../functions/api/scan'
import { SCAN_MODEL } from '../../functions/utils/scan/extract'
import type { RawScan } from '../../functions/utils/scan/rawScan'

// Stand-in image bytes. The endpoint never decodes the image, it only
// forwards it, so any bytes do; ASCII keeps the base64 check simple.
const PHOTO = 'not-really-a-jpeg-but-close-enough'

function scan(as: string | undefined, options: { body?: string; type?: string } = {}) {
  return invoke(scanPost, {
    method: 'POST',
    path: '/api/scan',
    as,
    rawBody: options.body ?? PHOTO,
    headers: { 'Content-Type': options.type ?? 'image/jpeg' },
  })
}

async function usageToday(memberId: string): Promise<number> {
  const day = new Date().toISOString().slice(0, 10)
  const row = await env.DB.prepare('SELECT count FROM scan_usage WHERE member_id = ? AND day = ?')
    .bind(memberId, day)
    .first<{ count: number }>()
  return row?.count ?? 0
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
    expect(await usageToday(member)).toBe(0)
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

    const body = await res.json<{ scan: RawScan; scansLeftToday: number }>()
    expect(body.scan.header.legibility).toBe('clear')
    expect(body.scan.rows).toHaveLength(2)
    expect(body.scan.rows[1]).toEqual({
      n: 2,
      white: { raw: 'Nf3', alts: ['Nf5'], confidence: 'medium' },
      black: null,
    })
    expect(body.scansLeftToday).toBe(DAILY_SCAN_LIMIT - 1)
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
    expect(await usageToday(member)).toBe(0)
  })

  it('returns 502 when the model service fails, and gives the scan back', async () => {
    const member = await seedMember()
    anthropicBehavior.status = 500
    const res = await scan(member)
    expect(res.status).toBe(502)
    expect(await usageToday(member)).toBe(0)
  })

  it('returns 502 on a network failure, and gives the scan back', async () => {
    const member = await seedMember()
    anthropicBehavior.throws = true
    const res = await scan(member)
    expect(res.status).toBe(502)
    expect(await usageToday(member)).toBe(0)
  })

  it('returns 503 when the model service is busy', async () => {
    anthropicBehavior.status = 529
    const res = await scan(await seedMember())
    expect(res.status).toBe(503)
  })
})

describe('POST /api/scan: daily limit', () => {
  it('counts each successful scan', async () => {
    const member = await seedMember()
    await scan(member)
    await scan(member)
    expect(await usageToday(member)).toBe(2)
  })

  it('refuses the scan past the limit without calling the model', async () => {
    const member = await seedMember()
    const day = new Date().toISOString().slice(0, 10)
    await env.DB.prepare('INSERT INTO scan_usage (member_id, day, count) VALUES (?, ?, ?)')
      .bind(member, day, DAILY_SCAN_LIMIT)
      .run()

    const res = await scan(member)
    expect(res.status).toBe(429)
    expect((await res.json<{ scansLeftToday: number }>()).scansLeftToday).toBe(0)
    expect(anthropicRequests).toHaveLength(0)
    // The refused attempt is not counted.
    expect(await usageToday(member)).toBe(DAILY_SCAN_LIMIT)
  })

  it('allows the last scan of the day', async () => {
    const member = await seedMember()
    const day = new Date().toISOString().slice(0, 10)
    await env.DB.prepare('INSERT INTO scan_usage (member_id, day, count) VALUES (?, ?, ?)')
      .bind(member, day, DAILY_SCAN_LIMIT - 1)
      .run()

    const res = await scan(member)
    expect(res.status).toBe(200)
    expect((await res.json<{ scansLeftToday: number }>()).scansLeftToday).toBe(0)
  })

  it("keeps each member's allowance separate", async () => {
    const heavy = await seedMember()
    const day = new Date().toISOString().slice(0, 10)
    await env.DB.prepare('INSERT INTO scan_usage (member_id, day, count) VALUES (?, ?, ?)')
      .bind(heavy, day, DAILY_SCAN_LIMIT)
      .run()

    const res = await scan(await seedMember())
    expect(res.status).toBe(200)
  })
})
