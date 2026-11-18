// test/integration/contracts/club-reply.test.ts
// GET and POST /api/clubs/reply/[token] keep their contracts
// (domain/contracts/clubReply.ts): the real handlers, with CLUB_PAGES_ON set
// through a getter on a mock of its module and the mail switches through
// getters on a mock of theirs, since every one of them is off in the tree.
// The request the site's sendClubReply() in src/areas/clubs/api.ts sends
// passes the request contract, a key the contract does not name is dropped
// before the handler reads the body, each answer is strict, and every
// refusal is the plain error body or the field error body. The signing key,
// the club and every person are made up.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clubReplyResponseSchema, clubReplySentResponseSchema, contracts, errorBodySchema, fieldErrorBodySchema,
} from '../../../domain/contracts'
import { onRequestGet as replyGet, onRequestOptions as replyOptions, onRequestPost as replyPost } from '../../../functions/api/clubs/reply/[token]'
import { replyLink } from '../../../functions/utils/clubs/reply'
import { seedMember } from '../factories'
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

beforeEach(() => {
  resetHarness()
})
afterEach(() => {
  flags.pagesOn = false
})

const KEY = 'example-made-up-signing-key-for-contracts-0027'
const getContract = contracts['clubs/reply/[token]'].GET
const postContract = contracts['clubs/reply/[token]'].POST

/** A made-up club in a region of its own, a holder of the region's seat, and a good link for a made-up visitor. */
async function exampleLink() {
  const m = crypto.randomUUID().slice(0, 8)
  const region = `Example Region ${m}`
  const clubId = `club-${m}`
  await env.DB.prepare(`INSERT INTO clubs (id, name, city, slug, region) VALUES (?, 'Example Chess Club', 'Example City', ?, ?)`).bind(clubId, `example-chess-club-${m}`, region).run()
  const holder = await seedMember({ fullName: 'Example Rep', email: `rep-${m}@example.org` })
  const seat = `seat-${m}`
  await env.DB.prepare(
    `INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active) VALUES (?, 'Example Region Representative', '', 99, ?, 'regional_rep', 1)`,
  ).bind(seat, seat).run()
  await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(seat, region).run()
  await env.DB.prepare('INSERT INTO board_seat_assignments (seat_id, member_id) VALUES (?, ?)').bind(seat, holder).run()
  const link = await replyLink({ SIGNING_SECRET: KEY }, 'https://www.louisianachess.org', { name: 'Player One', email: `player-${m}@example.org`, message: 'When do you meet?' }, clubId)
  const token = decodeURIComponent(link!.split('/clubs/reply/')[1])
  return { holder, token }
}

describe('GET and POST /api/clubs/reply/[token] keep their contracts', () => {
  it('answers a good link and a sent reply within them, and each refusal as an error body, set and unset', async () => {
    const { holder, token } = await exampleLink()
    flags.pagesOn = true
    const read = await invoke(replyGet, { params: { token }, as: holder, env: { SIGNING_SECRET: KEY } })
    expect(read.status).toBe(200)
    expect(await expectContract(read, getContract.response)).toEqual({ firstName: 'Player', club: 'Example Chess Club', excerpt: 'When do you meet?' })
    // The request the site sends passes the request contract, and the handler takes it.
    const request = { message: 'We meet on Tuesdays at 7:00 PM.' }
    expect(postContract.request.parse(request)).toEqual(request)
    const sent = await invoke(replyPost, { method: 'POST', params: { token }, as: holder, body: request, env: { SIGNING_SECRET: KEY } })
    expect(sent.status).toBe(200)
    expect(await expectContract(sent, postContract.response)).toEqual({ sent: true, firstName: 'Player' })
    expect(emailOutbox).toHaveLength(1)
    for (const [status, over] of [[400, { token: 'not-a-token' }], [503, { secret: undefined }], [401, { as: undefined }], [403, { as: 'member' }]] as const) {
      const as = 'as' in over ? (over.as === 'member' ? await seedMember() : undefined) : holder
      for (const handler of [replyGet, replyPost]) {
        const refused = await invoke(handler, {
          method: handler === replyPost ? 'POST' : 'GET',
          params: { token: 'token' in over ? over.token : token },
          body: handler === replyPost ? request : undefined,
          env: { SIGNING_SECRET: 'secret' in over ? over.secret : KEY },
          as,
        })
        expect(refused.status, `${status}`).toBe(status)
        await expectContract(refused, errorBodySchema)
      }
    }
    const empty = await invoke(replyPost, { method: 'POST', params: { token }, as: holder, body: { message: '' }, env: { SIGNING_SECRET: KEY } })
    expect(empty.status).toBe(400)
    await expectContract(empty, fieldErrorBodySchema)
    flags.pagesOn = false
    for (const handler of [replyGet, replyPost]) {
      const closed = await invoke(handler, { method: handler === replyPost ? 'POST' : 'GET', params: { token }, as: holder, body: handler === replyPost ? request : undefined, env: { SIGNING_SECRET: KEY } })
      expect(closed.status).toBe(403)
      await expectContract(closed, errorBodySchema)
    }
    expect((await invoke(replyOptions, { method: 'OPTIONS' })).status).toBe(204)
  })

  it('the contracts are strict: an address, a whole name or a volunteer beside the answer is refused, and the request names the words alone', () => {
    const good = { firstName: 'Player', club: 'Example Chess Club', excerpt: 'When do you meet?' }
    expect(clubReplyResponseSchema.safeParse(good).success).toBe(true)
    for (const wrong of [{ ...good, email: 'player@example.org' }, { ...good, name: 'Player One' }, { ...good, rep: 'Example Rep' }, { firstName: 'Player', club: 'Example Chess Club' }]) {
      expect(clubReplyResponseSchema.safeParse(wrong).success, JSON.stringify(wrong)).toBe(false)
    }
    expect(clubReplySentResponseSchema.safeParse({ sent: true, firstName: 'Player' }).success).toBe(true)
    expect(clubReplySentResponseSchema.safeParse({ sent: true, firstName: 'Player', to: 'player@example.org' }).success).toBe(false)
    expect(clubReplySentResponseSchema.safeParse({ sent: false, firstName: 'Player' }).success).toBe(false)
    // A key the contract does not name is dropped, so no recipient, subject or reply-to reaches the handler.
    expect(postContract.request.parse({ message: 'Example answer.', to: 'other@example.org', subject: 'Example', replyTo: 'other@example.org' })).toEqual({ message: 'Example answer.' })
    for (const wrong of [{}, { message: '' }, { message: '  ' }, { message: 'M'.repeat(5001) }, { message: 7 }, null, []]) {
      expect(postContract.request.safeParse(wrong).success, JSON.stringify(wrong)?.slice(0, 30)).toBe(false)
    }
    expect(postContract.request.safeParse({ message: 'M'.repeat(5000) }).success).toBe(true)
  })
})
