// test/unit/json-response.test.ts
//
// jsonResponse in functions/utils/response.ts, which every endpoint answers
// through, takes an optional third argument since WS02 step 9: headers of
// the caller's own, merged over its own, so GET /api/search can say how its
// answer is kept. Every call before it passes one or two arguments and gets
// exactly the four headers it got before: Content-Type and the three of
// CORS. errorResponse, which the 400s and 404s go through, adds no header.
import { describe, expect, it } from 'vitest'
import { errorResponse, handleOptions, jsonResponse } from '../../functions/utils/response'

/** A response's headers as name and value, in name order. */
const headersOf = (response: Response) => [...response.headers.entries()].sort(([a], [b]) => a.localeCompare(b))

/** The four headers every JSON answer carries, as before. */
const TODAY = [
  ['access-control-allow-headers', 'Content-Type, Authorization'],
  ['access-control-allow-methods', 'GET, POST, PATCH, OPTIONS'],
  ['access-control-allow-origin', '*'],
  ['content-type', 'application/json'],
]

describe('jsonResponse', () => {
  it('with one or two arguments gives exactly today\'s four headers, the body as JSON and the status asked for', async () => {
    const one = jsonResponse({ ok: true })
    expect(one.status).toBe(200)
    expect(headersOf(one)).toEqual(TODAY)
    expect(await one.json()).toEqual({ ok: true })
    const two = jsonResponse({ created: 1 }, 201)
    expect(two.status).toBe(201)
    expect(headersOf(two)).toEqual(TODAY)
  })

  it('adds a header the caller names, as GET /api/search does for its Cache-Control', () => {
    const kept = jsonResponse({ q: 'morphy', groups: [] }, 200, { 'Cache-Control': 'public, max-age=60' })
    expect(headersOf(kept)).toEqual([...TODAY.slice(0, 3), ['cache-control', 'public, max-age=60'], TODAY[3]])
    expect(kept.headers.get('Vary')).toBeNull()
  })

  it('lets the caller\'s header win over its own of the same name', () => {
    expect(jsonResponse({}, 200, { 'Content-Type': 'application/json; charset=utf-8' }).headers.get('content-type')).toBe('application/json; charset=utf-8')
    expect(jsonResponse({}, 200, { 'Access-Control-Allow-Origin': 'https://www.louisianachess.org' }).headers.get('Access-Control-Allow-Origin')).toBe('https://www.louisianachess.org')
  })

  it('with an empty third argument is the same as with none', () => {
    expect(headersOf(jsonResponse({}, 200, {}))).toEqual(TODAY)
  })
})

describe('the helpers beside it, unchanged', () => {
  it('errorResponse gives { error } with today\'s four headers and no Cache-Control', async () => {
    const refused = errorResponse('Search for 2 to 64 letters or numbers.', 400)
    expect(refused.status).toBe(400)
    expect(await refused.json()).toEqual({ error: 'Search for 2 to 64 letters or numbers.' })
    expect(headersOf(refused)).toEqual(TODAY)
    expect(refused.headers.get('Cache-Control')).toBeNull()
  })

  it('handleOptions answers 204 with the three CORS headers and no body', async () => {
    const options = handleOptions()
    expect(options.status).toBe(204)
    expect(headersOf(options)).toEqual(TODAY.slice(0, 3))
    expect(await options.text()).toBe('')
  })
})
