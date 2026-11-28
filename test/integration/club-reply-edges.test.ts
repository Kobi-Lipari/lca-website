// test/integration/club-reply-edges.test.ts
//
// The edges of Reply through LCA (WS09 step 27) that club-reply.test.ts does
// not reach: who counts as a current holder of a regional seat (a seat that
// has ended, one that is no longer active, one of another kind, another
// region's), who answers as the region and who as LCA, the second factor an
// admin answering as LCA is asked, the 30 days measured
// in real time across the clock changes in America/Chicago and across its
// midnight, a key that has been rotated, a link whose claim is not whole, a
// burst of answers at once against the hourly limit, hostile words from a
// visitor end to end, and the plain-language rules on every mail and every
// refusal the step writes. Each case sets CLUB_PAGES_ON itself through a
// getter on a mock of its module, and the mail switches through getters on a
// mock of theirs; no case reads a shipped value of any switch. Every club,
// person and address is made up.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { errorBodySchema } from '../../domain/contracts'
import { onRequestPost as contactPost } from '../../functions/api/clubs/[id]/contact'
import {
  REPLIES_AN_HOUR, REPLY_BUSY, REPLY_CLOSED, REPLY_CLUB_GONE, REPLY_LINK_REFUSED, REPLY_NOT_SENT, REPLY_NOT_YOURS, REPLY_NO_KEY, REPLY_SECOND_FACTOR,
  onRequestGet as replyGet, onRequestPost as replyPost,
} from '../../functions/api/clubs/reply/[token]'
import { RELAY_NO_LINK_LINE, RELAY_OWN_MAIL_LINE, RELAY_REPLY_LABEL } from '../../functions/utils/clubs/emails'
import { REPLY_PURPOSE, REPLY_TTL_SECONDS, replyLink } from '../../functions/utils/clubs/reply'
import { ADDRESS_HEADER } from '../../functions/utils/rateLimit'
import { sealToken } from '../../functions/utils/tokens'
import type { Env } from '../../functions/types'
import { seedMember } from './factories'
import { emailOutbox, expectContract, invoke, resetHarness } from './harness'

const flags = vi.hoisted(() => ({ pagesOn: false, listsOn: false, sender: 'resend' as 'resend' | 'ses' }))
vi.mock('../../functions/utils/clubs/pages', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/clubs/pages')>()
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
vi.mock('../../functions/utils/mail/switches', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/mail/switches')>()
  return {
    ...real,
    get MAIL_LISTS_ON() {
      return flags.listsOn
    },
    get MAIL_SENDER() {
      return flags.sender
    },
  }
})

const KEY = 'example-made-up-signing-key-for-the-edges-0027'
const OLD_KEY = 'example-the-key-before-the-turn-of-the-year-0027'
const KEYED = { SIGNING_SECRET: KEY, TURNSTILE_SECRET_KEY: 'example-made-up-spam-check-secret-0027' }
const SITE = 'https://www.louisianachess.org'

let seq = 0
const mark = () => `${++seq}${crypto.randomUUID().slice(0, 6)}`
const place = () => (++seq % 2 === 0 ? `198.51.100.${seq % 250}` : `203.0.113.${seq % 250}`)

beforeEach(async () => {
  resetHarness()
  // The hour's counts of earlier cases, so a case reads only its own.
  await env.DB.prepare('DELETE FROM rate_limits').run()
  flags.pagesOn = true
  flags.listsOn = false
  flags.sender = 'resend'
  const middle = new Date()
  middle.setUTCMinutes(30, 0, 0)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(middle)
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

interface Person { id: string; name: string; email: string }
interface MadeClub { id: string; slug: string; name: string; region: string | null; email: string | null }

/** A seat of the given kind over the region, held by the member, with its assignment ended or its seat inactive on request. */
async function giveSeat(region: string, memberId: string, opts: { category?: string; active?: boolean; ended?: boolean } = {}) {
  const seat = `seat-${mark()}`
  await env.DB.prepare(
    `INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active) VALUES (?, 'Example Seat', '', 99, ?, ?, ?)`,
  ).bind(seat, seat, opts.category ?? 'regional_rep', opts.active === false ? 0 : 1).run()
  await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(seat, region).run()
  await env.DB.prepare('INSERT INTO board_seat_assignments (seat_id, member_id, ended_at) VALUES (?, ?, ?)')
    .bind(seat, memberId, opts.ended ? '2026-01-01 00:00:00' : null).run()
}

async function makeClub(opts: { region?: string | null } = {}): Promise<MadeClub> {
  const m = mark()
  const id = `club-${m}`
  const slug = `example-chess-club-${m}`
  const name = `Example Chess Club ${m}`
  const region = opts.region === undefined ? `Example Region ${m}` : opts.region
  await env.DB.prepare(
    `INSERT INTO clubs (id, name, city, slug, region, contact_email, contact_name_public, about_text, how_we_meet_text) VALUES (?, ?, 'Example City', ?, ?, NULL, 'Contact P.', 'A made up club.', 'Tuesdays at 7:00 PM')`,
  ).bind(id, name, slug, region).run()
  return { id, slug, name, region, email: null }
}

async function person(role: string = 'member'): Promise<Person> {
  const m = mark()
  const made = { id: '', name: `Example Volunteer ${m}`, email: `volunteer-${m}@example.org` }
  made.id = await seedMember({ fullName: made.name, email: made.email, role })
  return made
}

async function onlyAdmin(): Promise<Person> {
  await env.DB.prepare(`UPDATE members SET role = 'member' WHERE role = 'lca_admin'`).run()
  return person('lca_admin')
}

function visitorWords(over: Record<string, string> = {}) {
  const m = mark()
  return { name: `Player One ${m}`, email: `player-${m}@example.org`, message: `Hello from Player One ${m}. When do you meet on Saturdays?`, ...over }
}

const relay = (club: MadeClub, words: ReturnType<typeof visitorWords>) =>
  invoke(contactPost, {
    method: 'POST',
    params: { id: club.slug },
    body: { ...words, token: 'example-made-up-token' },
    env: KEYED,
    path: `/api/clubs/${club.slug}/contact`,
    headers: { [ADDRESS_HEADER]: place() },
  })

const tokenIn = (text: string | undefined): string => {
  const line = (text ?? '').split('\n').find((l) => l.startsWith(`${RELAY_REPLY_LABEL}: `))!
  return decodeURIComponent(line.slice(RELAY_REPLY_LABEL.length + 2).slice(`${SITE}/clubs/reply/`.length))
}

async function goodToken(club: MadeClub, words = visitorWords(), key = KEY): Promise<string> {
  const link = await replyLink({ SIGNING_SECRET: key }, SITE, words, club.id)
  return decodeURIComponent(link!.slice(`${SITE}/clubs/reply/`.length))
}

type Opts = { as?: string; aal?: 'aal1' | 'aal2'; over?: Partial<Env> }
const read = (token: string, opts: Opts = {}) =>
  invoke(replyGet, { params: { token }, env: opts.over ?? KEYED, path: `/api/clubs/reply/${token}`, as: opts.as, aal: opts.aal })
const answer = (token: string, body: unknown, opts: Opts = {}) =>
  invoke(replyPost, { method: 'POST', params: { token }, body, env: opts.over ?? KEYED, path: `/api/clubs/reply/${token}`, as: opts.as, aal: opts.aal })

async function logsOf(work: () => Promise<void>): Promise<string[]> {
  const lines: string[] = []
  for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => { lines.push(args.map((a) => (a instanceof Error ? a.message : typeof a === 'string' ? a : JSON.stringify(a))).join(' ')) })
  }
  await work()
  return lines
}

// ── Who counts as a current holder of the region's seat ──

describe('who holds the region\'s seat', () => {
  it('refuses a seat that has ended, one no longer active, one of another kind, and one over another region, for GET and POST alike', async () => {
    const club = await makeClub()
    const other = await makeClub()
    const token = await goodToken(club)
    const former = await person()
    await giveSeat(club.region!, former.id, { ended: true })
    const inactive = await person()
    await giveSeat(club.region!, inactive.id, { active: false })
    const officer = await person()
    await giveSeat(club.region!, officer.id, { category: 'officer' })
    const elsewhere = await person()
    await giveSeat(other.region!, elsewhere.id)
    for (const who of [former, inactive, officer, elsewhere]) {
      for (const result of [await read(token, { as: who.id }), await answer(token, { message: 'Example answer.' }, { as: who.id })]) {
        expect(result.status, who.name).toBe(403)
        expect(await result.json()).toEqual({ error: REPLY_NOT_YOURS })
      }
    }
    expect(emailOutbox).toEqual([])
    // A holder who is current is let in, so the refusals above are the seat's doing and not the link's.
    const current = await person()
    await giveSeat(club.region!, current.id)
    expect((await read(token, { as: current.id })).status).toBe(200)
  })

  it('refuses a representative whose seat ended after the message, on a link that was good before', async () => {
    const club = await makeClub()
    const rep = await person()
    await giveSeat(club.region!, rep.id)
    const token = await goodToken(club)
    expect((await read(token, { as: rep.id })).status).toBe(200)
    await env.DB.prepare('UPDATE board_seat_assignments SET ended_at = ? WHERE member_id = ?').bind('2026-11-18 00:00:00', rep.id).run()
    expect((await read(token, { as: rep.id })).status).toBe(403)
    expect((await answer(token, { message: 'Example answer.' }, { as: rep.id })).status).toBe(403)
    expect(emailOutbox).toEqual([])
  })

  it('a seat over two regions lets its holder answer for either, and for neither once it ends', async () => {
    const first = await makeClub()
    const second = await makeClub()
    const rep = await person()
    await giveSeat(first.region!, rep.id)
    await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) SELECT seat_id, ? FROM board_seat_assignments WHERE member_id = ?').bind(second.region, rep.id).run()
    expect((await read(await goodToken(first), { as: rep.id })).status).toBe(200)
    expect((await read(await goodToken(second), { as: rep.id })).status).toBe(200)
    await env.DB.prepare('UPDATE board_seat_assignments SET ended_at = ? WHERE member_id = ?').bind('2026-11-18 00:00:00', rep.id).run()
    expect((await read(await goodToken(first), { as: rep.id })).status).toBe(403)
    expect((await read(await goodToken(second), { as: rep.id })).status).toBe(403)
  })

  it('an LCA admin who also holds the seat signs as the region, one who does not signs as LCA, and a club with no region is signed as LCA', async () => {
    const club = await makeClub()
    const regionless = await makeClub({ region: null })
    const seated = await person('lca_admin')
    await giveSeat(club.region!, seated.id)
    const plain = await person('lca_admin')
    const words = visitorWords()
    const token = await goodToken(club, words)
    expect((await answer(token, { message: 'Example answer one.' }, { as: seated.id })).status).toBe(200)
    expect((await answer(token, { message: 'Example answer two.' }, { as: plain.id })).status).toBe(200)
    expect((await answer(await goodToken(regionless, words), { message: 'Example answer three.' }, { as: plain.id })).status).toBe(200)
    expect(emailOutbox.map((m) => m.text!.split('\n').filter((l) => /^(LCA .* representative|Louisiana Chess Association)$/.test(l)))).toEqual([
      [`LCA ${club.region} representative`],
      ['Louisiana Chess Association'],
      ['Louisiana Chess Association'],
    ])
    // Nobody who holds no seat and is no admin is let in on a club with no region.
    const member = await person()
    expect((await read(await goodToken(regionless), { as: member.id })).status).toBe(403)
  })

  it('the second factor is asked of an LCA admin who answers as LCA, and not of one who answers as the region\'s representative', async () => {
    const club = await makeClub()
    const regionless = await makeClub({ region: null })
    const seated = await person('lca_admin')
    await giveSeat(club.region!, seated.id)
    const plain = await person('lca_admin')
    const words = visitorWords()
    const token = await goodToken(club, words)
    // With no second factor: the admin with no seat is refused on both methods, before the club is read, and nothing is sent or counted.
    const before = await env.DB.prepare('SELECT COUNT(*) AS n FROM rate_limits').first<{ n: number }>()
    for (const t of [token, await goodToken(regionless, words)]) {
      for (const result of [await read(t, { as: plain.id, aal: 'aal1' }), await answer(t, { message: 'Example answer.' }, { as: plain.id, aal: 'aal1' })]) {
        expect(result.status).toBe(403)
        expect(await expectContract(result, errorBodySchema)).toEqual({ error: REPLY_SECOND_FACTOR })
      }
    }
    expect(emailOutbox).toEqual([])
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM rate_limits').first<{ n: number }>()).toEqual(before)
    // The admin who holds the seat answers as the region's representative, asked what any holder is asked.
    expect((await read(token, { as: seated.id, aal: 'aal1' })).status).toBe(200)
    expect((await answer(token, { message: 'Example answer one.' }, { as: seated.id, aal: 'aal1' })).status).toBe(200)
    // With a second factor the admin with no seat answers as LCA.
    expect((await answer(token, { message: 'Example answer two.' }, { as: plain.id, aal: 'aal2' })).status).toBe(200)
    expect(emailOutbox.map((m) => m.text!.split('\n').filter((l) => /^(LCA .* representative|Louisiana Chess Association)$/.test(l)))).toEqual([
      [`LCA ${club.region} representative`],
      ['Louisiana Chess Association'],
    ])
    // A link that was changed is refused in the link's words whoever holds it, so the second factor's words say nothing of a forged link.
    expect(await (await read(`${token}x`, { as: plain.id, aal: 'aal1' })).json()).toEqual({ error: REPLY_LINK_REFUSED })
  })
})

// ── The 30 days, in real time, across America/Chicago's clock changes and midnight ──

describe('the 30 days are 720 hours, whatever the clocks in America/Chicago do', () => {
  /** Sealed at one instant, read at others: the status of a GET at each. */
  async function statusesAt(sealedAt: string, readAt: string[]): Promise<number[]> {
    const club = await makeClub()
    const rep = await person()
    await giveSeat(club.region!, rep.id)
    const words = visitorWords()
    const token = await sealToken(KEY, REPLY_PURPOSE, { n: words.name, e: words.email, c: club.id, m: words.message }, REPLY_TTL_SECONDS, new Date(sealedAt))
    const statuses: number[] = []
    for (const at of readAt) {
      vi.setSystemTime(new Date(at))
      statuses.push((await read(token, { as: rep.id })).status)
    }
    return statuses
  }

  it('across the fall back of Sunday, November 1, 2026: a link sealed at midnight Thursday, October 15 CDT ends at 11:00 PM CST on Friday, November 13', async () => {
    // Sealed 2026-10-15 12:00 AM CDT (05:00Z). 720 hours on is 2026-11-14 05:00Z, which is 11:00 PM CST on November 13: an hour
    // before the midnight a count of calendar days would give.
    expect(await statusesAt('2026-10-15T05:00:00Z', [
      '2026-11-14T04:59:59Z', // 10:59:59 PM CST on Friday, November 13: good
      '2026-11-14T05:00:00Z', // 11:00:00 PM CST: past its life
      '2026-11-14T05:59:59Z', // 11:59:59 PM CST: still past
      '2026-11-14T06:00:00Z', // 12:00:00 AM CST on Saturday, November 14: a calendar day's reading would end here
    ])).toEqual([200, 400, 400, 400])
  })

  it('across the spring forward of Sunday, March 14, 2027: a link sealed at midnight Saturday, February 20 CST lasts into 1:00 AM CDT on Monday, March 22', async () => {
    // Sealed 2027-02-20 12:00 AM CST (06:00Z). 720 hours on is 2027-03-22 06:00Z, which is 1:00 AM CDT: an hour after the
    // midnight a count of calendar days would give.
    expect(await statusesAt('2027-02-20T06:00:00Z', [
      '2027-03-22T05:00:00Z', // 12:00:00 AM CDT on Monday, March 22: a calendar day's reading would end here, yet still good
      '2027-03-22T05:59:59Z', // 12:59:59 AM CDT: good
      '2027-03-22T06:00:00Z', // 1:00:00 AM CDT: past its life
    ])).toEqual([200, 200, 400])
  })

  it('at the turn of a Chicago day: sealed at 11:59 PM CST on Thursday, December 10, 2026, good one second short of 30 days on and refused at 30', async () => {
    // 2026-12-10 11:59 PM CST is 2026-12-11T05:59:00Z; no clock change lies between it and 11:59 PM CST on Saturday, January 9,
    // 2027, which is 2027-01-10T05:59:00Z.
    expect(await statusesAt('2026-12-11T05:59:00Z', [
      '2027-01-10T05:58:59Z',
      '2027-01-10T05:59:00Z',
      '2027-01-10T06:00:00Z',
    ])).toEqual([200, 400, 400])
  })

  it('the same boundary holds for a POST: the last second sends, the next sends nothing', async () => {
    const club = await makeClub()
    const rep = await person()
    await giveSeat(club.region!, rep.id)
    const words = visitorWords()
    const token = await sealToken(KEY, REPLY_PURPOSE, { n: words.name, e: words.email, c: club.id, m: words.message }, REPLY_TTL_SECONDS, new Date('2026-10-15T05:00:00Z'))
    vi.setSystemTime(new Date('2026-11-14T04:59:59Z'))
    expect((await answer(token, { message: 'Example answer.' }, { as: rep.id })).status).toBe(200)
    expect(emailOutbox.map((m) => m.to)).toEqual([words.email])
    vi.setSystemTime(new Date('2026-11-14T05:00:00Z'))
    const late = await answer(token, { message: 'Example answer.' }, { as: rep.id })
    expect(late.status).toBe(400)
    expect(await late.json()).toEqual({ error: REPLY_LINK_REFUSED })
    expect(emailOutbox).toHaveLength(1)
  })

  it('a link is bounded by its expiry alone: one sealed ten minutes ahead of the clock opens, and ends 30 days after it was sealed', async () => {
    const club = await makeClub()
    const rep = await person()
    await giveSeat(club.region!, rep.id)
    const words = visitorWords()
    const sealedAt = Date.now() + 10 * 60 * 1000
    const token = await sealToken(KEY, REPLY_PURPOSE, { n: words.name, e: words.email, c: club.id, m: words.message }, REPLY_TTL_SECONDS, new Date(sealedAt))
    expect((await read(token, { as: rep.id })).status).toBe(200)
    vi.setSystemTime(new Date(sealedAt + REPLY_TTL_SECONDS * 1000))
    expect((await read(token, { as: rep.id })).status).toBe(400)
  })
})

// ── A key that has been turned, and a claim that is not whole ──

describe('the signing key and the claim', () => {
  it('a link sealed under the key before the turn opens while that key is kept as the previous one, and not once it is dropped', async () => {
    const club = await makeClub()
    const rep = await person()
    await giveSeat(club.region!, rep.id)
    const words = visitorWords()
    const old = await goodToken(club, words, OLD_KEY)
    const turned = { ...KEYED, SIGNING_SECRET: KEY, SIGNING_SECRET_PREVIOUS: OLD_KEY }
    const got = await read(old, { as: rep.id, over: turned })
    expect(got.status).toBe(200)
    expect((await answer(old, { message: 'Example answer.' }, { as: rep.id, over: turned })).status).toBe(200)
    expect(emailOutbox.map((m) => m.to)).toEqual([words.email])
    const dropped = await read(old, { as: rep.id, over: { ...KEYED, SIGNING_SECRET_PREVIOUS: undefined } })
    expect(dropped.status).toBe(400)
    expect(await dropped.json()).toEqual({ error: REPLY_LINK_REFUSED })
  })

  it('a claim sealed under the right key and purpose but not whole is refused in the same words', async () => {
    const club = await makeClub()
    const rep = await person()
    await giveSeat(club.region!, rep.id)
    const whole = { n: 'Player One', e: 'player-one@example.org', c: club.id, m: 'Hello.' }
    const without = (key: string) => Object.fromEntries(Object.entries(whole).filter(([k]) => k !== key))
    const broken: Array<Record<string, string | number | boolean>> = [
      { ...whole, e: '' },
      { ...whole, c: '' },
      without('n'),
      without('m'),
      without('e'),
      without('c'),
      { ...whole, e: 42 },
      { ...whole, c: true },
      {},
    ]
    const bodies = new Set<string>()
    for (const claim of broken) {
      const token = await sealToken(KEY, REPLY_PURPOSE, claim, REPLY_TTL_SECONDS)
      for (const result of [await read(token, { as: rep.id }), await answer(token, { message: 'Example answer.' }, { as: rep.id })]) {
        expect(result.status, JSON.stringify(claim)).toBe(400)
        bodies.add(await result.response.clone().text())
      }
    }
    expect([...bodies]).toEqual([JSON.stringify({ error: REPLY_LINK_REFUSED })])
    expect(emailOutbox).toEqual([])
    // A claim that names a club that is not on file is the club-gone answer for an admin, and a refusal for anyone with no seat over it.
    const admin = await onlyAdmin()
    const ghost = await sealToken(KEY, REPLY_PURPOSE, { ...whole, c: `club-none-${mark()}` }, REPLY_TTL_SECONDS)
    expect((await read(ghost, { as: admin.id })).status).toBe(404)
    expect(await (await read(ghost, { as: admin.id })).json()).toEqual({ error: REPLY_CLUB_GONE })
    expect((await read(ghost, { as: rep.id })).status).toBe(403)
  })

  it('a token cut or padded in the address, or percent-encoded as the mail program may leave it, behaves as the plain text does', async () => {
    const club = await makeClub()
    const rep = await person()
    await giveSeat(club.region!, rep.id)
    const token = await goodToken(club)
    // The link carries the token through encodeURIComponent and the platform hands the handler the decoded text: both reads agree.
    expect((await read(token, { as: rep.id })).status).toBe(200)
    expect((await read(encodeURIComponent(token), { as: rep.id })).status).toBe(200)
    for (const damaged of ['', ' ', `${token}.`, token.toUpperCase(), token.slice(1), `${token}%`]) {
      const got = await read(damaged, { as: rep.id })
      expect(got.status, damaged.slice(0, 10)).toBe(400)
      expect(await got.json()).toEqual({ error: REPLY_LINK_REFUSED })
    }
  })
})

// ── Bursts and the hourly bound ──

describe('the hourly bound under a burst', () => {
  it('twelve answers at once from one person send exactly the allowed number, and the rest are refused in words', async () => {
    const club = await makeClub()
    const rep = await person()
    await giveSeat(club.region!, rep.id)
    const words = visitorWords()
    const token = await goodToken(club, words)
    const results = await Promise.all(Array.from({ length: REPLIES_AN_HOUR + 2 }, (_, i) => answer(token, { message: `Example answer ${i}.` }, { as: rep.id })))
    const statuses = results.map((r) => r.status).sort()
    expect(statuses.filter((s) => s === 200)).toHaveLength(REPLIES_AN_HOUR)
    expect(statuses.filter((s) => s === 429)).toHaveLength(2)
    expect(emailOutbox).toHaveLength(REPLIES_AN_HOUR)
    for (const refused of results.filter((r) => r.status === 429)) expect(await expectContract(refused, errorBodySchema)).toEqual({ error: REPLY_BUSY })
    // One count row for the person's hour, and it holds the whole burst.
    const { results: rows } = await env.DB.prepare('SELECT hits FROM rate_limits').all<{ hits: number }>()
    expect(rows.map((r) => r.hits)).toEqual([REPLIES_AN_HOUR + 2])
  })

  it('the count is by the person and not by the link: a second link answered by the same person shares their hour', async () => {
    const club = await makeClub()
    const rep = await person()
    await giveSeat(club.region!, rep.id)
    const first = await goodToken(club)
    const second = await goodToken(club)
    for (let i = 0; i < REPLIES_AN_HOUR; i++) expect((await answer(i % 2 ? first : second, { message: `Example answer ${i}.` }, { as: rep.id })).status).toBe(200)
    expect((await answer(first, { message: 'Example answer late.' }, { as: rep.id })).status).toBe(429)
    expect((await answer(second, { message: 'Example answer late.' }, { as: rep.id })).status).toBe(429)
  })

  it('a refused body, a refused link and a closed switch do not use the hour up', async () => {
    const club = await makeClub()
    const rep = await person()
    await giveSeat(club.region!, rep.id)
    const token = await goodToken(club)
    for (let i = 0; i < REPLIES_AN_HOUR * 2; i++) {
      expect((await answer(token, { message: '' }, { as: rep.id })).status).toBe(400)
      expect((await answer('not-a-token', { message: 'Example answer.' }, { as: rep.id })).status).toBe(400)
    }
    flags.pagesOn = false
    expect((await answer(token, { message: 'Example answer.' }, { as: rep.id })).status).toBe(403)
    flags.pagesOn = true
    const { results: rows } = await env.DB.prepare('SELECT hits FROM rate_limits').all<{ hits: number }>()
    expect(rows).toEqual([])
    expect((await answer(token, { message: 'Example answer.' }, { as: rep.id })).status).toBe(200)
  })

  it('a mail that does not go still counts toward the hour, so a failing service cannot be hammered', async () => {
    const club = await makeClub()
    const rep = await person()
    await giveSeat(club.region!, rep.id)
    const token = await goodToken(club)
    const { emailBehavior } = await import('./harness')
    emailBehavior.succeed = false
    emailBehavior.status = 422
    const lines = await logsOf(async () => {
      for (let i = 0; i < REPLIES_AN_HOUR; i++) expect((await answer(token, { message: 'Example answer.' }, { as: rep.id })).status).toBe(503)
      expect((await answer(token, { message: 'Example answer.' }, { as: rep.id })).status).toBe(429)
    })
    expect(new Set(lines)).toEqual(new Set(['Reply through LCA: a reply was not sent.']))
    expect(REPLY_NOT_SENT).not.toMatch(/@/)
  })
})

// ── Hostile words from a visitor, end to end ──

describe('a visitor\'s own words, end to end', () => {
  it('markup in the name and the message is escaped in the representative\'s copy and in the reply, and no line of either is added by it', async () => {
    const club = await makeClub()
    const rep = await person()
    await giveSeat(club.region!, rep.id)
    const words = visitorWords({ name: '<b>Player</b> One & Co', message: 'Hi <script>alert(1)</script> "quoted" & <i>more</i>.\nSecond line.' })
    expect((await relay(club, words)).status).toBe(200)
    const copy = emailOutbox.find((m) => m.to === rep.email)!
    expect(`${copy.html}`).not.toMatch(/<script>|<b>Player|<i>more/)
    expect(copy.html).toContain('&lt;script&gt;')
    expect(`${copy.subject}${copy.html}${copy.text}`).not.toContain(words.email)
    const token = tokenIn(copy.text)
    const got = await read(token, { as: rep.id })
    // JSON carries the visitor's words as data; the first name is the first word, whole, and the excerpt is one line.
    const body = await got.json<{ firstName: string; club: string; excerpt: string }>()
    expect(body.firstName).toBe('<b>Player</b>')
    expect(body.excerpt).toBe('Hi <script>alert(1)</script> "quoted" & <i>more</i>. Second line.')
    emailOutbox.length = 0
    expect((await answer(token, { message: 'Example answer.' }, { as: rep.id })).status).toBe(200)
    const [mail] = emailOutbox
    expect(mail.to).toBe(words.email)
    expect(mail.html).not.toMatch(/<script>|<b>Player|<i>more/)
    expect(mail.html).toContain('Hi &lt;b&gt;Player&lt;/b&gt;,')
    expect(mail.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(mail.text).toContain('Hi <b>Player</b>,')
    // The subject is fixed words with the club's name: nothing of the visitor's is in it.
    expect(mail.subject).toBe(`An answer to your message to ${club.name}`)
  })

  it('a name with a line break and a header written into it cannot add a recipient, a copy or a header', async () => {
    const club = await makeClub()
    const rep = await person()
    await giveSeat(club.region!, rep.id)
    const words = visitorWords()
    const token = await sealToken(
      KEY, REPLY_PURPOSE,
      { n: 'Player\r\nBcc: stranger@example.org\r\nSubject: Taken over', e: words.email, c: club.id, m: 'Line one Bcc: stranger@example.org' },
      REPLY_TTL_SECONDS,
    )
    const got = await read(token, { as: rep.id })
    expect(await got.json()).toEqual({ firstName: 'Player', club: club.name, excerpt: 'Line one Bcc: stranger@example.org' })
    expect((await answer(token, { message: 'Example answer.' }, { as: rep.id })).status).toBe(200)
    const [mail] = emailOutbox
    expect(mail.to).toBe(words.email)
    expect(mail.subject).toBe(`An answer to your message to ${club.name}`)
    expect(JSON.stringify(mail.headers ?? {})).not.toMatch(/stranger|Taken over/)
    expect(mail.text).toContain('Hi Player,')
    expect(mail.text).not.toMatch(/Taken over/)
  })

  it('a message of 5,000 characters and a long name are carried as the first lines only, and the link stays short enough to be opened', async () => {
    const club = await makeClub()
    const rep = await person()
    await giveSeat(club.region!, rep.id)
    const words = visitorWords({ message: `${'Word '.repeat(1000)}end`.slice(0, 5000), name: `Player ${'Longname'.repeat(10)}` })
    expect((await relay(club, words)).status).toBe(200)
    const copy = emailOutbox.find((m) => m.to === rep.email)!
    const link = (copy.text ?? '').split('\n').find((l) => l.startsWith(`${RELAY_REPLY_LABEL}: `))!
    expect(link.length).toBeLessThan(1500)
    const got = await read(tokenIn(copy.text), { as: rep.id })
    const body = await got.json<{ excerpt: string }>()
    expect(body.excerpt.length).toBeLessThanOrEqual(160)
    expect(body.excerpt.endsWith('…')).toBe(true)
    expect(JSON.stringify(body)).not.toContain(words.email)
  })
})

// ── The two copies, a club with its own address and a region with two keepers ──

describe('the copies when a region has several keepers', () => {
  it('every representative and every admin is handed a link and none an address, and each link opens for the person who holds the seat', async () => {
    const club = await makeClub()
    const first = await person()
    const second = await person()
    await giveSeat(club.region!, first.id)
    await giveSeat(club.region!, second.id)
    const words = visitorWords()
    expect((await relay(club, words)).status).toBe(200)
    expect(emailOutbox.map((m) => m.to).sort()).toEqual([first.email, second.email].sort())
    for (const mail of emailOutbox) {
      expect(`${mail.subject}${mail.html}${mail.text}`).not.toContain(words.email)
      expect(mail.text).toContain(RELAY_OWN_MAIL_LINE)
      expect(mail.text).not.toContain(RELAY_NO_LINK_LINE)
    }
    for (const who of [first, second]) {
      const copy = emailOutbox.find((m) => m.to === who.email)!
      expect((await read(tokenIn(copy.text), { as: who.id })).status).toBe(200)
    }
  })

  it('a copy relayed again is a new message with a link of its own, and the first link keeps working', async () => {
    const club = await makeClub()
    const rep = await person()
    await giveSeat(club.region!, rep.id)
    const words = visitorWords()
    expect((await relay(club, words)).status).toBe(200)
    expect((await relay(club, words)).status).toBe(200)
    const [one, two] = emailOutbox.map((m) => tokenIn(m.text))
    expect(one).not.toBe(two)
    for (const token of [one, two]) expect((await read(token, { as: rep.id })).status).toBe(200)
  })
})

// ── The plain-language rules on everything the step writes ──

/** An en dash or an em dash, written by code so that this file holds neither. */
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
/** The old initials of US Chess, written in parts so that this file does not hold them. */
const NAMES_AN_ABBREVIATION = new RegExp(`\\b${'US' + 'CF'}\\b`)
/** Words about how a text was made, split up so that this file does not hold them either. */
const AUTOMATION_WORDS = new RegExp(`\\b(${['A' + 'I', 'cla' + 'ude', 'assis' + 'tant', 'chat' + 'bot', 'l' + 'lm', 'g' + 'pt', 'copi' + 'lot'].join('|')})\\b`, 'i')

describe('plain words', () => {
  it('every mail the step writes and every refusal it gives has no long dash, never the old initials of US Chess and no word about how it was made', async () => {
    const club = await makeClub()
    const rep = await person()
    await giveSeat(club.region!, rep.id)
    const admin = await onlyAdmin()
    const words = visitorWords()
    expect((await relay(club, words)).status).toBe(200)
    const token = tokenIn(emailOutbox[0].text)
    expect((await answer(token, { message: 'We meet on Saturdays at 10:00 AM. Come by.' }, { as: rep.id })).status).toBe(200)
    expect((await answer(token, { message: 'And on Tuesdays at 7:00 PM.' }, { as: admin.id })).status).toBe(200)
    // The copy with no link, as the relay writes it when this deployment has no key.
    const { relayMessage } = await import('../../functions/utils/clubs/relay')
    await relayMessage({ ...(env as unknown as Env), SIGNING_SECRET: undefined }, new Request(`${SITE}/api/clubs/${club.slug}/contact`, { method: 'POST' }), { id: club.id, name: club.name, region: club.region }, words)
    const written = emailOutbox.flatMap((m) => [m.subject, m.html, m.text ?? '', m.from ?? ''])
    expect(written.length).toBeGreaterThan(6)
    for (const text of written) {
      expect(text).not.toMatch(DASHES)
      expect(text).not.toMatch(NAMES_AN_ABBREVIATION)
      expect(text).not.toMatch(AUTOMATION_WORDS)
    }
    // Every refusal and every notice the endpoint can give.
    for (const words of [REPLY_CLOSED, REPLY_NOT_YOURS, REPLY_LINK_REFUSED, REPLY_NO_KEY, REPLY_SECOND_FACTOR, REPLY_CLUB_GONE, REPLY_BUSY, REPLY_NOT_SENT]) {
      expect(words).not.toMatch(DASHES)
      expect(words).not.toMatch(NAMES_AN_ABBREVIATION)
      expect(words).not.toMatch(AUTOMATION_WORDS)
      expect(words).not.toMatch(/@|https?:/)
      expect(words.endsWith('.')).toBe(true)
    }
    for (const line of [RELAY_OWN_MAIL_LINE, RELAY_NO_LINK_LINE, RELAY_REPLY_LABEL]) {
      expect(line).not.toMatch(DASHES)
      expect(line).not.toMatch(NAMES_AN_ABBREVIATION)
    }
  })

  it('the words of every refusal say nothing of the message, the visitor or the club', async () => {
    const club = await makeClub()
    for (const words of [REPLY_CLOSED, REPLY_NOT_YOURS, REPLY_LINK_REFUSED, REPLY_NO_KEY, REPLY_SECOND_FACTOR, REPLY_NOT_SENT, REPLY_BUSY]) {
      expect(words).not.toContain(club.name)
      expect(words.toLowerCase()).not.toMatch(/visitor|player|address/)
    }
  })
})
