// test/unit/mail-contract-schemas.test.ts
//
// The four schemas of WS16 step 3's two public endpoints,
// domain/contracts/mail.ts, on their own: the responses are strict, so an
// answer that grew a field no one meant to send (an address that is not
// masked, a contact's id) fails the contract test that reads it; the
// request is loose and takes only booleans. The registry holds the four
// methods under the two routes, and the files that serve them are in the
// tree. Nothing here makes a request.
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contracts, emailChoicesRequestSchema, emailChoicesResponseSchema, unsubscribeLinkResponseSchema, unsubscribeResponseSchema } from '../../domain/contracts'

const ROOT = resolve(__dirname, '../..')

describe('the responses are strict', () => {
  it('takes the one-click answer as written, and turns away a missing field, an extra one and a false', () => {
    const ok = { unsubscribed: true, list: 'LCA newsletter', preferencesToken: 'sample.p.token' }
    expect(unsubscribeResponseSchema.safeParse(ok).success).toBe(true)
    for (const bad of [{ ...ok, unsubscribed: false }, { ...ok, contactId: 'x' }, { ...ok, address: 'player.one@example.org' }, { unsubscribed: true, list: 'x' }, { ...ok, list: 1 }]) {
      expect(unsubscribeResponseSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false)
    }
  })

  it('takes the GET\'s answer as the list\'s name alone', () => {
    expect(unsubscribeLinkResponseSchema.safeParse({ list: 'LCA newsletter' }).success).toBe(true)
    for (const bad of [{}, { list: 'x', token: 'y' }, { list: null }]) expect(unsubscribeLinkResponseSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false)
  })

  it('takes the choices answer as the address, each list with its id, name and on, and the stop-all, and turns away anything else', () => {
    const ok = { address: 'p...@example.org', lists: [{ id: 'lca-newsletter', name: 'LCA newsletter', on: true }], optionalOff: false }
    expect(emailChoicesResponseSchema.safeParse(ok).success).toBe(true)
    expect(emailChoicesResponseSchema.safeParse({ ...ok, lists: [] }).success).toBe(true)
    for (const bad of [
      { ...ok, contactId: 'x' }, { ...ok, optionalOff: 'no' }, { address: ok.address, lists: ok.lists },
      { ...ok, lists: [{ id: 'a', name: 'b' }] }, { ...ok, lists: [{ id: 'a', name: 'b', on: true, source: 'link' }] },
    ]) {
      expect(emailChoicesResponseSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false)
    }
  })
})

describe('the request is loose and takes booleans only', () => {
  it('takes an empty body, either key alone, both, and a key beside them', () => {
    for (const ok of [{}, { lists: {} }, { optionalOff: true }, { lists: { a: true, b: false }, optionalOff: false }, { optionalOff: true, from: 'the page' }]) {
      expect(emailChoicesRequestSchema.safeParse(ok).success, JSON.stringify(ok)).toBe(true)
    }
  })

  it('turns away a list value or a stop-all that is not a boolean, a list of lists, and a body that is not an object', () => {
    for (const bad of [{ lists: { a: 'yes' } }, { lists: { a: 1 } }, { lists: [true] }, { lists: null }, { optionalOff: 'true' }, { optionalOff: 0 }, null, 'text', []]) {
      expect(emailChoicesRequestSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false)
    }
  })
})

describe('the registry', () => {
  it('holds the four methods under the two routes, each with a response, and the PATCH and nothing else with a request', () => {
    const unsubscribe = contracts['mail/unsubscribe/[token]']
    const preferences = contracts['mail/preferences/[token]']
    expect(Object.keys(unsubscribe).sort()).toEqual(['GET', 'POST'])
    expect(Object.keys(preferences).sort()).toEqual(['GET', 'PATCH'])
    for (const contract of [unsubscribe.GET, unsubscribe.POST, preferences.GET, preferences.PATCH]) expect(contract.response).toBeDefined()
    expect(preferences.PATCH.request).toBe(emailChoicesRequestSchema)
  })

  it('has a handler file for each route, which the route audit counts', () => {
    for (const route of ['mail/unsubscribe/[token]', 'mail/preferences/[token]']) expect(existsSync(join(ROOT, 'functions/api', `${route}.ts`)), route).toBe(true)
  })
})
