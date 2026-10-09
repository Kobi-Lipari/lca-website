// test/integration/parse-body-edges.test.ts
// parseBody (functions/utils/response.ts): the bodies a browser can really
// send, and what the 400 says about each. Built on the shapes the site posts
// (src/lib/api.ts), so a schema that describes what a handler takes today
// rejects none of them.
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { errorBodySchema, fieldErrorBodySchema } from '../../domain/contracts'
import { isResponse } from '../../functions/utils/auth'
import { errorResponse, parseBody, parseJsonBody } from '../../functions/utils/response'
import { expectContract } from './harness'

const post = (body: string | undefined, headers: Record<string, string> = { 'Content-Type': 'application/json' }) =>
  new Request('https://lca-website.pages.dev/api/test', { method: 'POST', headers, body })

const loose = z.looseObject({
  name: z.string().min(1),
  sections: z.array(z.looseObject({ name: z.string(), entryFee: z.number().min(0) })).optional(),
  notes: z.string().nullable().optional(),
  rounds: z.number().int().optional(),
})

async function fieldsOf(result: unknown): Promise<Record<string, string>> {
  expect(isResponse(result)).toBe(true)
  const response = result as Response
  expect(response.status).toBe(400)
  const body = await expectContract({ status: response.status, json: () => response.clone().json() }, fieldErrorBodySchema)
  return body.fields
}

describe('parseBody: bodies that pass', () => {
  it('passes a body with only the required field', async () => {
    expect(await parseBody(post(JSON.stringify({ name: 'Fall Open' })), loose)).toEqual({ name: 'Fall Open' })
  })

  it('keeps null where the schema allows null, and leaves an absent optional absent', async () => {
    const parsed = await parseBody(post(JSON.stringify({ name: 'x', notes: null })), loose)
    expect(parsed).toEqual({ name: 'x', notes: null })
    expect('rounds' in (parsed as object)).toBe(false)
  })

  it('keeps unknown keys at every depth', async () => {
    const body = { name: 'x', extra: { deep: [1, 2] }, sections: [{ name: 'Open', entryFee: 25, prizeFund: '$200', rulesSet: true }] }
    expect(await parseBody(post(JSON.stringify(body)), loose)).toEqual(body)
  })

  it('passes a fee of zero and a fee in dollars and cents', async () => {
    const body = { name: 'x', sections: [{ name: 'Free', entryFee: 0 }, { name: 'Open', entryFee: 12.5 }] }
    expect(await parseBody(post(JSON.stringify(body)), loose)).toEqual(body)
  })

  it('passes a body sent with no Content-Type header', async () => {
    expect(await parseBody(post(JSON.stringify({ name: 'x' }), {}), loose)).toEqual({ name: 'x' })
  })

  it('passes non-ASCII text through unchanged', async () => {
    const body = { name: 'Café Open – Thibodaux ½ point byes' }
    expect(await parseBody(post(JSON.stringify(body)), loose)).toEqual(body)
  })

  it('reads each request once, so two requests in flight do not mix', async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) => parseBody(post(JSON.stringify({ name: `Event ${i}` })), loose)),
    )
    expect(results.map((r) => (r as { name: string }).name)).toEqual(Array.from({ length: 20 }, (_, i) => `Event ${i}`))
  })
})

describe('parseBody: bodies that fail', () => {
  it('an empty body is not JSON', async () => {
    const fields = await fieldsOf(await parseBody(post(undefined), loose))
    expect(Object.keys(fields)).toEqual(['body'])
  })

  it('a truncated body is not JSON, and the error is the one handlers already give', async () => {
    const response = (await parseBody(post('{"name": "x"'), loose)) as Response
    expect((await response.clone().json()).error).toBe('Invalid JSON body')
  })

  it('null, a number, text and an array name the whole body', async () => {
    for (const raw of ['null', '42', '"hello"', '[]', 'true']) {
      expect(Object.keys(await fieldsOf(await parseBody(post(raw), loose))), raw).toEqual(['body'])
    }
  })

  it('names each failing field once, by its path through arrays and objects', async () => {
    const fields = await fieldsOf(await parseBody(
      post(JSON.stringify({ name: 7, sections: [{ name: 'Open', entryFee: 5 }, { name: 'U1200', entryFee: -1 }, { entryFee: 'x' }], rounds: 3.5 })),
      loose,
    ))
    expect(Object.keys(fields).sort()).toEqual(['name', 'rounds', 'sections.1.entryFee', 'sections.2.entryFee', 'sections.2.name'])
  })

  it('a missing required field is named', async () => {
    expect(Object.keys(await fieldsOf(await parseBody(post('{}'), loose)))).toEqual(['name'])
  })

  it('keeps the first message when one field fails twice', async () => {
    const schema = z.object({ code: z.string().min(5).regex(/^\d+$/) })
    const fields = await fieldsOf(await parseBody(post(JSON.stringify({ code: 'ab' })), schema))
    expect(Object.keys(fields)).toEqual(['code'])
    expect(fields.code.length).toBeGreaterThan(0)
  })

  it('every failure carries the { error } shape that errorBodySchema already describes, plus fields', async () => {
    const response = (await parseBody(post('{}'), loose)) as Response
    const body = await response.clone().json<unknown>()
    expect(errorBodySchema.safeParse(body).success).toBe(false) // strict: fields is extra
    expect(fieldErrorBodySchema.safeParse(body).success).toBe(true)
    expect(typeof (body as { error: unknown }).error).toBe('string')
    // Same shape and headers as errorResponse, the rest of the API's errors.
    const plain = errorResponse('Nope', 400)
    expect(plain.status).toBe(response.status)
    expect(plain.headers.get('Content-Type')).toBe(response.headers.get('Content-Type'))
  })

  it('a failed parse does not leave the request half read for a second try', async () => {
    const request = post('{}')
    await parseBody(request, loose)
    // The body is used up; a second read fails cleanly as invalid JSON, it does not throw.
    const second = await parseBody(request, loose)
    expect(isResponse(second)).toBe(true)
    expect((second as Response).status).toBe(400)
  })
})

describe('parseBody next to parseJsonBody', () => {
  it('both give up on invalid JSON, parseJsonBody with null and parseBody with a 400', async () => {
    expect(await parseJsonBody(post('nope'))).toBeNull()
    expect(((await parseBody(post('nope'), loose)) as Response).status).toBe(400)
  })

  it('both return the same object for a valid body', async () => {
    const body = { name: 'x', sections: [{ name: 'Open', entryFee: 25 }] }
    expect(await parseBody(post(JSON.stringify(body)), loose)).toEqual(await parseJsonBody(post(JSON.stringify(body))))
  })
})
