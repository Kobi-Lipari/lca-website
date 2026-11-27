// test/integration/contracts/club-contact.test.ts
// POST /api/clubs/[id]/contact keeps its contract (domain/contracts/clubContact.ts):
// the real handler, with CLUB_PAGES_ON set through a getter on a mock of its
// module and the mail switches through getters on a mock of theirs, since
// every one of them is off in the tree. The request the site's
// sendClubMessage() in src/areas/clubs/api.ts sends passes the request
// contract, a key the contract does not name is dropped before the handler
// reads the body, the answer is the strict { sent: true }, and every refusal
// is the plain error body. The club and the visitor are made up.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { contracts, errorBodySchema } from '../../../domain/contracts'
import { onRequestPost as contactPost } from '../../../functions/api/clubs/[id]/contact'
import { ADDRESS_HEADER } from '../../../functions/utils/rateLimit'
import { emailOutbox, expectContract, invoke, resetHarness } from '../harness'

const flags = vi.hoisted(() => ({ pagesOn: false }))
vi.mock('../../../functions/utils/clubs/pages', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../functions/utils/clubs/pages')>()
  return {
    ...real,
    get CLUB_PAGES_ON() {
      return flags.pagesOn
    },
    get CLUB_KEEPERS_ON() {
      return false
    },
  }
})
vi.mock('../../../functions/utils/mail/switches', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../functions/utils/mail/switches')>()
  return {
    ...real,
    get MAIL_LISTS_ON() {
      return false
    },
    get MAIL_SENDER() {
      return 'resend' as const
    },
  }
})
beforeEach(resetHarness)
afterEach(() => {
  flags.pagesOn = false
})

const contract = contracts['clubs/[id]/contact'].POST
const KEYED = { SIGNING_SECRET: 'example-made-up-signing-key-for-the-contract-26', TURNSTILE_SECRET_KEY: 'example-made-up-spam-check-secret-26' }
let n = 0
const send = (part: string, body: unknown) =>
  invoke(contactPost, { method: 'POST', params: { id: part }, body, env: KEYED, headers: { [ADDRESS_HEADER]: `192.0.2.${++n}` } })

/** The body sendClubMessage() sends, made up. */
const siteBody = () => ({ name: 'Player One', email: 'player.one@example.org', message: 'Hello. When do you meet?', token: 'example-made-up-token' })

async function contractClub(): Promise<string> {
  const id = `example-contract-contact-${crypto.randomUUID().slice(0, 6)}`
  await env.DB.prepare(`INSERT INTO clubs (id, name, city, slug, contact_email) VALUES (?, 'Example Contract Club', 'Example City', ?, 'contract.club@example.org')`).bind(id, id).run()
  return id
}

describe('POST /api/clubs/[id]/contact keeps its contract', () => {
  it('takes the body the site sends, drops a key it does not name, and answers the strict { sent: true }', async () => {
    flags.pagesOn = true
    const id = await contractClub()
    const body = siteBody()
    expect(contract.request.safeParse(body).success).toBe(true)
    const parsed = contract.request.parse({ ...body, to: 'someone@example.org', subject: 'Example' })
    expect(Object.keys(parsed).sort()).toEqual(['email', 'message', 'name', 'token'])
    const result = await send(id, body)
    expect(result.status).toBe(200)
    expect(await expectContract(result, contract.response)).toEqual({ sent: true })
    expect(contract.response.safeParse({ sent: true, to: 'contract.club@example.org' }).success).toBe(false)
    expect(contract.response.safeParse({ sent: false }).success).toBe(false)
    expect(emailOutbox.map((e) => e.to)).toEqual(['contract.club@example.org'])
  })

  it('refuses the fields it holds, and answers every refusal with the plain error body', async () => {
    flags.pagesOn = true
    const id = await contractClub()
    for (const over of [{ name: 'Player\nOne' }, { email: 'a@example.org, b@example.org' }, { message: '  ' }, { name: 7 }]) {
      expect(contract.request.safeParse({ ...siteBody(), ...over }).success, JSON.stringify(over)).toBe(false)
      const result = await send(id, { ...siteBody(), ...over })
      expect(result.status).toBe(400)
      const answer = await result.json<{ error: string; fields: Record<string, string> }>()
      expect(answer.error).toBe('Some fields are missing or not valid.')
      expect(Object.keys(answer.fields)).toHaveLength(1)
    }
    const lost = await send('example-contract-no-such-club', siteBody())
    expect(lost.status).toBe(404)
    await expectContract(lost, errorBodySchema)
    flags.pagesOn = false
    const closed = await send(id, siteBody())
    expect(closed.status).toBe(403)
    await expectContract(closed, errorBodySchema)
    expect(emailOutbox).toEqual([])
  })
})
