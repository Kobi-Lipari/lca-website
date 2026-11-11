// test/integration/contracts/mail-links.test.ts
//
// The two public endpoints WS16 step 3 adds under functions/api/mail/, each
// to its contracts in domain/contracts/mail.ts, on the database every
// integration test runs on:
// - GET /api/mail/unsubscribe/:token, the list's name for a GET that asks
//   for JSON, and POST, the one-click unsubscribe, with the person's fresh
//   preferences token;
// - GET and PATCH /api/mail/preferences/:token, the masked address, the
//   person's lists on and off and the stop-all choice, the PATCH's body read
//   through its request contract.
// Every refusal answers the shared error bodies: 404 with the fixed words
// for a link that does not open, 400 for a list that is not the person's,
// and parseBody's 400 with its fields for a body that is not valid. Each
// token is signed with the key the harness binds, read from the
// environment. MAIL_LISTS_ON is read through a getter on the mocked
// switches module, set before every case, with the module's other
// constants set beside it.
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { contracts, errorBodySchema, fieldErrorBodySchema } from '../../../domain/contracts'
import { NEWSLETTER_LIST_ID } from '../../../domain/mail/lists'
import { onRequestGet as preferencesGet, onRequestPatch as preferencesPatch } from '../../../functions/api/mail/preferences/[token]'
import { onRequestGet as unsubscribeGet, onRequestPost as unsubscribePost } from '../../../functions/api/mail/unsubscribe/[token]'
import { signLink } from '../../../functions/utils/mail/links'
import type { Env } from '../../../functions/types'
import { seedMailContact, seedMember } from '../factories'
import { expectContract, invoke, resetHarness } from '../harness'

const flags = vi.hoisted(() => ({ listsOn: true, sender: 'resend', plan: 'free', complaintStops: true }))
vi.mock('../../../functions/utils/mail/switches', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../functions/utils/mail/switches')>()
  return {
    ...real,
    get MAIL_LISTS_ON() {
      return flags.listsOn
    },
    get MAIL_SENDER() {
      return flags.sender
    },
    get WORKERS_PLAN() {
      return flags.plan
    },
    get COMPLAINT_STOPS_OTHER_SENDERS() {
      return flags.complaintStops
    },
  }
})

const unsubscribeLink = contracts['mail/unsubscribe/[token]'].GET
const unsubscribe = contracts['mail/unsubscribe/[token]'].POST
const choices = contracts['mail/preferences/[token]'].GET
const saveChoices = contracts['mail/preferences/[token]'].PATCH

const key = () => (env as unknown as Env).MAIL_LINK_SECRET

/** A member's address with a contact, as the newsletter's send makes one, and its two links. */
async function linked(address: string) {
  await seedMember({ email: address, fullName: 'Player One' })
  const contactId = await seedMailContact({ address })
  return {
    contactId,
    unsubscribeToken: await signLink(key(), contactId, 'unsubscribe', NEWSLETTER_LIST_ID),
    preferencesToken: await signLink(key(), contactId, 'preferences'),
  }
}

beforeEach(async () => {
  resetHarness()
  flags.listsOn = true
  flags.sender = 'resend'
  flags.plan = 'free'
  flags.complaintStops = true
  for (const table of ['mail_list_choices', 'mail_contacts']) await env.DB.prepare(`DELETE FROM ${table}`).run()
})

describe('GET /api/mail/unsubscribe/:token', () => {
  it('answers the page\'s JSON question to its contract', async () => {
    const { unsubscribeToken } = await linked('contract.reader@test.lca')
    const res = await invoke(unsubscribeGet, { params: { token: unsubscribeToken }, headers: { Accept: 'application/json' } })
    expect(res.status).toBe(200)
    expect(await expectContract(res, unsubscribeLink.response)).toEqual({ list: 'LCA newsletter' })
  })

  it('answers a link that does not open with the error body', async () => {
    const res = await invoke(unsubscribeGet, { params: { token: 'never-signed-at-all' }, headers: { Accept: 'application/json' } })
    expect(res.status).toBe(404)
    expect(await expectContract(res, errorBodySchema)).toEqual({ error: "This link isn't working." })
  })
})

describe('POST /api/mail/unsubscribe/:token', () => {
  it('answers the one-click POST to its contract, with a fresh preferences token that opens the preferences endpoint', async () => {
    const { unsubscribeToken, preferencesToken } = await linked('contract.reader@test.lca')
    const res = await invoke(unsubscribePost, {
      method: 'POST',
      params: { token: unsubscribeToken },
      rawBody: 'List-Unsubscribe=One-Click',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    expect(res.status).toBe(200)
    const body = await expectContract(res, unsubscribe.response)
    expect(body).toEqual({ unsubscribed: true, list: 'LCA newsletter', preferencesToken })
    const opened = await invoke(preferencesGet, { params: { token: body.preferencesToken } })
    expect(opened.status).toBe(200)
  })

  it('answers a link that does not open with the error body', async () => {
    const res = await invoke(unsubscribePost, { method: 'POST', params: { token: 'never-signed-at-all' }, rawBody: '{}', headers: { 'Content-Type': 'application/json' } })
    expect(res.status).toBe(404)
    await expectContract(res, errorBodySchema)
  })
})

describe('GET /api/mail/preferences/:token', () => {
  it('answers to its contract', async () => {
    const { preferencesToken } = await linked('contract.reader@test.lca')
    const res = await invoke(preferencesGet, { params: { token: preferencesToken } })
    expect(res.status).toBe(200)
    expect(await expectContract(res, choices.response)).toEqual({
      address: 'c...@test.lca',
      lists: [{ id: NEWSLETTER_LIST_ID, name: 'LCA newsletter', on: true }],
      optionalOff: false,
    })
  })

  it('answers a link that does not open, and links not live yet, with the error body', async () => {
    const { preferencesToken } = await linked('contract.reader@test.lca')
    flags.listsOn = false
    const res = await invoke(preferencesGet, { params: { token: preferencesToken } })
    expect(res.status).toBe(404)
    await expectContract(res, errorBodySchema)
  })
})

describe('PATCH /api/mail/preferences/:token', () => {
  it('takes a body its request contract accepts, a key beside the two passing through, and answers to its contract', async () => {
    const { preferencesToken } = await linked('contract.reader@test.lca')
    const body = { lists: { [NEWSLETTER_LIST_ID]: false }, optionalOff: true, from: 'the page' }
    expect(saveChoices.request.safeParse(body).success).toBe(true)
    const res = await invoke(preferencesPatch, { method: 'PATCH', params: { token: preferencesToken }, body })
    expect(res.status).toBe(200)
    expect(await expectContract(res, saveChoices.response)).toEqual({
      address: 'c...@test.lca',
      lists: [{ id: NEWSLETTER_LIST_ID, name: 'LCA newsletter', on: false }],
      optionalOff: true,
    })
  })

  it('answers a list that is not the person\'s with the error body, and a body that is not valid with the field errors', async () => {
    const { preferencesToken } = await linked('contract.reader@test.lca')
    const notTheirs = await invoke(preferencesPatch, { method: 'PATCH', params: { token: preferencesToken }, body: { lists: { 'lca-tournaments': true } } })
    expect(notTheirs.status).toBe(400)
    expect(await expectContract(notTheirs, errorBodySchema)).toEqual({ error: 'That list is not one of yours.' })
    const invalid = { optionalOff: 'yes' }
    expect(saveChoices.request.safeParse(invalid).success).toBe(false)
    const res = await invoke(preferencesPatch, { method: 'PATCH', params: { token: preferencesToken }, body: invalid })
    expect(res.status).toBe(400)
    expect(Object.keys((await expectContract(res, fieldErrorBodySchema)).fields)).toEqual(['optionalOff'])
  })
})
