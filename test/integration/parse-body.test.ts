// test/integration/parse-body.test.ts
// parseBody (functions/utils/response.ts) reads a JSON body against its
// contract. A body that is not JSON, or does not match, gets the usual
// { error } with status 400 plus a message per field; a matching body comes
// back parsed, unknown keys and all, so a request schema written as loose
// rejects nothing the site already sends.
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { fieldErrorBodySchema } from '../../domain/contracts'
import { parseBody } from '../../functions/utils/response'
import { isResponse } from '../../functions/utils/auth'
import { expectContract } from './harness'

/** A request shaped like the setup form's create call: three fields required, the rest optional. */
const createSchema = z.looseObject({
  name: z.string().min(1),
  location: z.string().min(1),
  date: z.iso.date(),
  entryFee: z.number().min(0),
  venue: z.string().nullable().optional(),
  sections: z.array(z.looseObject({ name: z.string(), entryFee: z.number() })).optional(),
})

const post = (body: string) =>
  new Request('https://lca-website.pages.dev/api/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })

async function failure(result: unknown) {
  expect(isResponse(result)).toBe(true)
  const response = result as Response
  return { status: response.status, body: await expectContract({ status: response.status, json: () => response.clone().json() }, fieldErrorBodySchema) }
}

describe('parseBody', () => {
  it('returns the parsed body, keeping keys the schema does not name', async () => {
    const body = { name: 'Fall Open', location: 'Kenner, LA', date: '2026-10-24', entryFee: 25, timeControl: 'G/90+30' }
    const result = await parseBody(post(JSON.stringify(body)), createSchema)
    expect(isResponse(result)).toBe(false)
    expect(result).toEqual(body)
  })

  it('gives 400 with { error } and fields when fields are missing or the wrong type', async () => {
    const result = await parseBody(
      post(JSON.stringify({ name: '', date: '24/10/2026', entryFee: '25', sections: [{ name: 'Open', entryFee: 'free' }] })),
      createSchema,
    )
    const { status, body } = await failure(result)
    expect(status).toBe(400)
    expect(body.error).toBe('Some fields are missing or not valid.')
    expect(Object.keys(body.fields).sort()).toEqual(['date', 'entryFee', 'location', 'name', 'sections.0.entryFee'])
    for (const message of Object.values(body.fields)) expect(message).not.toBe('')
  })

  it('gives 400 with { error } and fields for a body that is not JSON', async () => {
    const { status, body } = await failure(await parseBody(post('{"name": "Fall Open",'), createSchema))
    expect(status).toBe(400)
    expect(body).toEqual({ error: 'Invalid JSON body', fields: { body: 'The body is not valid JSON.' } })
  })

  it('names the whole body when it is not an object at all', async () => {
    const { status, body } = await failure(await parseBody(post('[1, 2]'), createSchema))
    expect(status).toBe(400)
    expect(Object.keys(body.fields)).toEqual(['body'])
  })

  it('answers with the same headers as every other error', async () => {
    const result = (await parseBody(post('nope'), createSchema)) as Response
    expect(result.headers.get('Content-Type')).toBe('application/json')
    expect(result.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })
})
