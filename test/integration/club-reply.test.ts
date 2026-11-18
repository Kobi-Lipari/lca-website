// test/integration/club-reply.test.ts
//
// Reply through LCA (WS09 step 27): the link on a representative's and an
// LCA admin's copy of a relayed message, and GET and POST
// /api/clubs/reply/[token], with the real relay, the real handlers, the real
// limiter and the real mail path into the harness's outbox. The cases that
// step 26's file held for the relay stay there with their count; these are
// the reply's own. Each case sets CLUB_PAGES_ON and CLUB_KEEPERS_ON itself
// through a getter on a mock of their module, and MAIL_LISTS_ON and
// MAIL_SENDER through getters on a mock of the mail switches; no case reads
// a shipped value of any switch. The reply-to of each mail is read from the
// request the mail path makes, by a wrapper over the harness's own fetch that
// only looks and passes the request on. Every club, person and address is
// made up, and every network address is from the ranges set aside for
// documentation.
import { env } from 'cloudflare:test'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { contracts, errorBodySchema } from '../../domain/contracts'
import { isReservedSlug, RESERVED_SLUGS } from '../../domain/clubs/slug'
import { DEFAULT_FROM, DEFAULT_REPLY_TO } from '../../domain/mail/addresses'
import { onRequestPost as contactPost } from '../../functions/api/clubs/[id]/contact'
import {
  REPLIES_AN_HOUR, REPLY_BUSY, REPLY_CLOSED, REPLY_CLUB_GONE, REPLY_LINK_REFUSED, REPLY_NO_KEY, REPLY_NOT_SENT, REPLY_NOT_YOURS, REPLY_SECOND_FACTOR,
  onRequestGet as replyGet, onRequestOptions as replyOptions, onRequestPost as replyPost,
} from '../../functions/api/clubs/reply/[token]'
import { onRequestGet as routeGet } from '../../functions/clubs/[id]'
import { RELAY_NO_LINK_LINE, RELAY_OWN_MAIL_LINE, RELAY_REPLY_LABEL } from '../../functions/utils/clubs/emails'
import { relayMessage } from '../../functions/utils/clubs/relay'
import { REPLY_PURPOSE, REPLY_TTL_SECONDS, replyLink } from '../../functions/utils/clubs/reply'
import { ADDRESS_HEADER } from '../../functions/utils/rateLimit'
import { openToken, sealToken, signToken } from '../../functions/utils/tokens'
import type { Env } from '../../functions/types'
import { seedMember } from './factories'
import { emailBehavior, emailOutbox, expectContract, invoke, resetHarness } from './harness'
import { countingDb } from './mailRuns'

const flags = vi.hoisted(() => ({ pagesOn: false, keepersOn: false, listsOn: false, sender: 'resend' as 'resend' | 'ses' }))
vi.mock('../../functions/utils/clubs/pages', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/clubs/pages')>()
  return {
    ...real,
    get CLUB_PAGES_ON() {
      return flags.pagesOn
    },
    get CLUB_KEEPERS_ON() {
      return flags.keepersOn
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

const KEY = 'example-made-up-signing-key-for-the-reply-0027'
const KEYED = { SIGNING_SECRET: KEY, TURNSTILE_SECRET_KEY: 'example-made-up-spam-check-secret-0027' }
const SITE = 'https://www.louisianachess.org'
const SHELL = '<!doctype html><title>Example shell</title><div id="root"></div>'

let seq = 0
const mark = () => `${++seq}${crypto.randomUUID().slice(0, 6)}`
/** A made-up place of its own for each call that needs one, from 198.51.100.0/24 and 203.0.113.0/24. */
const place = () => (++seq % 2 === 0 ? `198.51.100.${seq % 250}` : `203.0.113.${seq % 250}`)

// ── The reply-to of each mail, read from the request the mail path makes ──

const replyTos: Array<{ to: string; replyTo: string[]; body: string }> = []
let harnessFetch: typeof fetch
beforeAll(() => {
  harnessFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    if (typeof init?.body === 'string' && (url.hostname === 'api.resend.com' || url.hostname === 'email.us-east-1.amazonaws.com')) {
      const body = JSON.parse(init.body) as { to?: string | string[]; reply_to?: string[]; Destination?: { ToAddresses: string[] }; ReplyToAddresses?: string[] }
      const to = body.Destination?.ToAddresses[0] ?? (Array.isArray(body.to) ? body.to[0] : body.to) ?? ''
      replyTos.push({ to, replyTo: body.ReplyToAddresses ?? body.reply_to ?? [], body: init.body })
    }
    return harnessFetch(input, init)
  }) as typeof fetch
})
afterAll(() => {
  globalThis.fetch = harnessFetch
})
const replyToOf = (address: string) => replyTos.filter((r) => r.to === address).map((r) => r.replyTo)

beforeEach(() => {
  resetHarness()
  replyTos.length = 0
  flags.pagesOn = false
  flags.keepersOn = false
  flags.listsOn = false
  flags.sender = 'resend'
  // The middle of the run's own hour, held still, so every call of a case lands in one hour.
  const middle = new Date()
  middle.setUTCMinutes(30, 0, 0)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(middle)
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

// ── Made-up clubs, keepers and visitors ──

interface Person { id: string; name: string; email: string }
interface MadeClub { id: string; slug: string; name: string; region: string | null; email: string | null; reps: Person[] }

/** One active regional seat over the region, held by the member. */
async function giveSeat(region: string, memberId: string) {
  const seat = `seat-${mark()}`
  await env.DB.prepare(
    `INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active) VALUES (?, 'Example Region Representative', '', 99, ?, 'regional_rep', 1)`,
  ).bind(seat, seat).run()
  await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(seat, region).run()
  await env.DB.prepare('INSERT INTO board_seat_assignments (seat_id, member_id) VALUES (?, ?)').bind(seat, memberId).run()
}

/** A club with a slug, in a region of its own, with its own address or none, and that many representatives. */
async function makeClub(opts: { email?: boolean; reps?: number } = {}): Promise<MadeClub> {
  const m = mark()
  const id = `club-${m}`
  const slug = `example-chess-club-${m}`
  const name = `Example Chess Club ${m}`
  const region = `Example Region ${m}`
  const email = opts.email === false ? null : `club-${m}@example.org`
  await env.DB.prepare(
    `INSERT INTO clubs (id, name, city, slug, region, contact_email, contact_name_public, about_text, how_we_meet_text) VALUES (?, ?, 'Example City', ?, ?, ?, 'Contact P.', 'A made up club.', 'Tuesdays at 7:00 PM')`,
  ).bind(id, name, slug, region, email).run()
  const reps: Person[] = []
  for (let i = 0; i < (opts.reps ?? 0); i++) {
    const person = { id: '', name: `Example Rep ${m} ${i}`, email: `rep-${m}-${i}@example.org` }
    person.id = await seedMember({ fullName: person.name, email: person.email })
    await giveSeat(region, person.id)
    reps.push(person)
  }
  return { id, slug, name, region, email, reps }
}

/** An LCA admin of the case's own, and the only one on file. */
async function onlyAdmin(): Promise<Person> {
  await env.DB.prepare(`UPDATE members SET role = 'member' WHERE role = 'lca_admin'`).run()
  const m = mark()
  const person = { id: '', name: `Example Admin ${m}`, email: `admin-${m}@example.org` }
  person.id = await seedMember({ fullName: person.name, email: person.email, role: 'lca_admin' })
  return person
}

/** What a visitor typed, made up. */
function visitorWords(over: Record<string, string> = {}) {
  const m = mark()
  return { name: `Player One ${m}`, email: `player-${m}@example.org`, message: `Hello from Player One ${m}. When do you meet on Saturdays?`, ...over }
}

/** Sends a message from the club's page through the real contact endpoint. */
const relay = (club: MadeClub, words: ReturnType<typeof visitorWords>) =>
  invoke(contactPost, {
    method: 'POST',
    params: { id: club.slug },
    body: { ...words, token: 'example-made-up-token' },
    env: KEYED,
    path: `/api/clubs/${club.slug}/contact`,
    headers: { [ADDRESS_HEADER]: place() },
  })

/** The Reply through LCA link a copy carries, from its plain part, or null for none. */
function linkOf(text: string | undefined): string | null {
  const line = (text ?? '').split('\n').find((l) => l.startsWith(`${RELAY_REPLY_LABEL}: `))
  return line ? line.slice(RELAY_REPLY_LABEL.length + 2) : null
}
const tokenOf = (link: string) => decodeURIComponent(link.slice(`${SITE}/clubs/reply/`.length))

/** A good link for the visitor's message to the club, sealed as the relay seals it. */
async function goodToken(club: MadeClub, words = visitorWords()): Promise<string> {
  const link = await replyLink({ SIGNING_SECRET: KEY }, SITE, words, club.id)
  return tokenOf(link!)
}

const read = (token: string, opts: { as?: string; aal?: 'aal1' | 'aal2'; over?: Partial<Env> } = {}) =>
  invoke(replyGet, { params: { token }, env: opts.over ?? KEYED, path: `/api/clubs/reply/${token}`, as: opts.as, aal: opts.aal })
const answer = (token: string, body: unknown, opts: { as?: string; aal?: 'aal1' | 'aal2'; over?: Partial<Env> } = {}) =>
  invoke(replyPost, { method: 'POST', params: { token }, body, env: opts.over ?? KEYED, path: `/api/clubs/reply/${token}`, as: opts.as, aal: opts.aal })

const getContract = contracts['clubs/reply/[token]'].GET
const postContract = contracts['clubs/reply/[token]'].POST

/** Every table of the database with its count of rows. */
async function tableCounts(): Promise<Record<string, number>> {
  const { results } = await env.DB.prepare(
    `SELECT name FROM sqlite_master WHERE type = 'table'
       AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\'
       AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\'
       AND name <> 'd1_migrations' ORDER BY name`,
  ).all<{ name: string }>()
  const counts: Record<string, number> = {}
  for (const { name } of results) counts[name] = (await env.DB.prepare(`SELECT COUNT(*) AS n FROM "${name}"`).first<{ n: number }>())!.n
  return counts
}
const grown = (before: Record<string, number>, after: Record<string, number>) =>
  Object.keys(after).filter((name) => after[name] !== before[name])

/** Every line written to the console while the work runs, each argument as text. */
async function logsOf(work: () => Promise<void>): Promise<string[]> {
  const lines: string[] = []
  for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => { lines.push(args.map((a) => (a instanceof Error ? a.message : typeof a === 'string' ? a : JSON.stringify(a))).join(' ')) })
  }
  await work()
  return lines
}

/** Each part of a token's text decoded as base64url, read as text. */
function partsAsText(token: string): string[] {
  return token.split('.').map((part) => {
    try {
      return atob(part.replace(/-/g, '+').replace(/_/g, '/'))
    } catch {
      return part
    }
  })
}

describe('the link', () => {
  it('the representative\'s copy carries the link and not the visitor\'s address, and the club\'s own copy is as before', async () => {
    flags.pagesOn = true
    const club = await makeClub({ email: false, reps: 1 })
    const words = visitorWords()
    expect((await relay(club, words)).status).toBe(200)
    const [mail] = emailOutbox
    expect(mail.to).toBe(club.reps[0].email)
    const link = linkOf(mail.text)
    // On the site's own host, as its other emailed links are, never the host the request came to.
    expect(link).toMatch(new RegExp(`^${SITE.replace(/\./g, '\\.')}/clubs/reply/v1\\.x\\.`))
    expect(mail.html).toContain(`>${RELAY_REPLY_LABEL}</a>`)
    expect(mail.html).toContain(`href="${link}"`)
    expect(mail.text).toContain(RELAY_OWN_MAIL_LINE)
    // The visitor's address is in no part of the copy and no header the mail path sent.
    expect(`${mail.subject}${mail.html}${mail.text}${JSON.stringify(mail.headers ?? {})}`).not.toContain(words.email)
    expect(replyTos.find((r) => r.to === mail.to)!.body).not.toContain(words.email)
    expect(replyToOf(mail.to)).toEqual([[DEFAULT_REPLY_TO]])
    expect(mail.text).not.toMatch(/Their email/)

    // The club's own copy: the visitor's address in its body and as its reply-to, and no link.
    emailOutbox.length = 0
    const own = await makeClub({ reps: 1 })
    const ownWords = visitorWords()
    expect((await relay(own, ownWords)).status).toBe(200)
    expect(emailOutbox.map((e) => e.to)).toEqual([own.email])
    expect(emailOutbox[0].text).toContain(`Their email: ${ownWords.email}`)
    expect(replyToOf(own.email!)).toEqual([[ownWords.email]])
    expect(linkOf(emailOutbox[0].text)).toBeNull()
    expect(emailOutbox[0].html).not.toContain('/clubs/reply/')
  })

  it('the LCA admins\' copy carries the link and not the visitor\'s address', async () => {
    flags.pagesOn = true
    const club = await makeClub({ email: false })
    const admin = await onlyAdmin()
    const words = visitorWords()
    expect((await relay(club, words)).status).toBe(200)
    const mail = emailOutbox.find((e) => e.to === admin.email)!
    expect(mail.text).toContain(`${club.name} has no connected email yet, so this message came to you as an LCA admin.`)
    expect(linkOf(mail.text)).toMatch(/\/clubs\/reply\/v1\.x\./)
    expect(`${mail.subject}${mail.html}${mail.text}`).not.toContain(words.email)
    expect(replyToOf(admin.email)).toEqual([[DEFAULT_REPLY_TO]])
  })

  it('the link\'s text cannot be read without the key', async () => {
    flags.pagesOn = true
    const club = await makeClub({ email: false, reps: 1 })
    const words = visitorWords()
    await relay(club, words)
    const token = tokenOf(linkOf(emailOutbox[0].text)!)
    // No part of the token, read as base64url or as it stands, holds the address, the name or the message's words.
    for (const text of [token, ...partsAsText(token)]) {
      for (const secret of [words.email, words.name, 'Player One', 'example.org', 'Saturdays', club.id]) expect(text, secret).not.toContain(secret)
    }
    // Another key opens nothing; the site's key opens the claim.
    expect(await openToken({ current: 'example-another-made-up-key-of-enough-length' }, REPLY_PURPOSE, token, new Date())).toEqual({ ok: false, reason: 'forged' })
    const opened = await openToken({ current: KEY }, REPLY_PURPOSE, token, new Date())
    expect(opened).toEqual({ ok: true, claim: { n: words.name, e: words.email, c: club.id, m: words.message } })
  })

  it('with no signing key the relay still sends, the two copies carry neither a link nor the address, and the endpoint says so in words', async () => {
    flags.pagesOn = true
    const club = await makeClub({ email: false, reps: 1 })
    const admin = await onlyAdmin()
    const words = visitorWords()
    // The endpoint's own limiter refuses first with no key (step 25), so the relay is called as the endpoint calls it.
    for (const over of [{ SIGNING_SECRET: undefined }, { SIGNING_SECRET: '' }, { SIGNING_SECRET: 'too-short-a-key' }]) {
      emailOutbox.length = 0
      const relayEnv = { ...(env as unknown as Env), ...over }
      const request = new Request(`${SITE}/api/clubs/${club.slug}/contact`, { method: 'POST' })
      expect(await relayMessage(relayEnv, request, { id: club.id, name: club.name, region: club.region }, words)).toBe('sent')
      expect(emailOutbox.map((e) => e.to)).toEqual([club.reps[0].email])
      const [mail] = emailOutbox
      expect(mail.text).toContain(RELAY_NO_LINK_LINE)
      expect(mail.text).not.toContain(RELAY_OWN_MAIL_LINE)
      expect(`${mail.html}${mail.text}`).not.toMatch(/\/clubs\/reply\/|Reply through LCA</)
      expect(`${mail.subject}${mail.html}${mail.text}`).not.toContain(words.email)
    }
    // A good link read where the key is missing: the same words, in GET and POST, to a person who would be let in.
    const token = await goodToken(club, words)
    for (const over of [{ SIGNING_SECRET: undefined }, { SIGNING_SECRET: '' }]) {
      for (const result of [await read(token, { as: admin.id, over }), await answer(token, { message: 'Example answer.' }, { as: admin.id, over })]) {
        expect(result.status).toBe(503)
        expect(await expectContract(result, errorBodySchema)).toEqual({ error: REPLY_NO_KEY })
      }
    }
  })
})

describe('who may reply', () => {
  it('lets in the region\'s representative and an LCA admin, and refuses everyone else in words that say nothing of the message', async () => {
    flags.pagesOn = true
    const club = await makeClub({ email: false, reps: 1 })
    const other = await makeClub({ email: false, reps: 1 })
    const admin = await onlyAdmin()
    const member = await seedMember({ email: `member-${mark()}@example.org` })
    const guest = await seedMember({ role: 'guest', email: `guest-${mark()}@example.org` })
    await giveSeat(club.region!, guest)
    const clubRep = await seedMember({ role: 'club_rep', clubId: club.id, email: `club-rep-${mark()}@example.org` })
    const words = visitorWords()
    const token = await goodToken(club, words)
    const refused: Array<[string | undefined, number, string]> = [
      [undefined, 401, 'Unauthorized'],
      [member, 403, REPLY_NOT_YOURS],
      [guest, 403, REPLY_NOT_YOURS],
      [clubRep, 403, REPLY_NOT_YOURS],
      [other.reps[0].id, 403, REPLY_NOT_YOURS],
      // An account the sign-in service knows with no member row is refused, and no row is made for it.
      [`mem-unknown-${mark()}`, 403, REPLY_NOT_YOURS],
    ]
    for (const [as, status, error] of refused) {
      for (const result of [await read(token, { as }), await answer(token, { message: 'Example answer.' }, { as })]) {
        expect(result.status, String(as)).toBe(status)
        const text = await result.response.clone().text()
        expect(JSON.parse(text)).toEqual({ error })
        for (const piece of [words.name, words.email, 'Player', 'Saturdays', club.name]) expect(text, piece).not.toContain(piece)
      }
    }
    expect(emailOutbox).toEqual([])
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM members WHERE id LIKE ?').bind('mem-unknown-%').first<{ n: number }>()).toEqual({ n: 0 })

    // An LCA admin with no seat and no second factor is refused, as every admin mail guard refuses one, in words that say nothing of the message.
    for (const result of [await read(token, { as: admin.id, aal: 'aal1' }), await answer(token, { message: 'Example answer.' }, { as: admin.id, aal: 'aal1' })]) {
      expect(result.status).toBe(403)
      const text = await result.response.clone().text()
      expect(JSON.parse(text)).toEqual({ error: REPLY_SECOND_FACTOR })
      for (const piece of [words.name, words.email, 'Player', 'Saturdays', club.name]) expect(text, piece).not.toContain(piece)
    }
    expect(emailOutbox).toEqual([])

    // The region's representative with no second factor, and an LCA admin with one: each let in, and each answer sent.
    for (const [as, aal] of [[club.reps[0].id, 'aal1'], [admin.id, 'aal2']] as const) {
      const got = await read(token, { as, aal })
      expect(got.status, `${as} ${aal}`).toBe(200)
      expect(await expectContract(got, getContract.response)).toEqual({ firstName: 'Player', club: club.name, excerpt: words.message })
      const sent = await answer(token, { message: `Example answer from ${aal}.` }, { as, aal })
      expect(sent.status, `${as} ${aal}`).toBe(200)
      expect(await expectContract(sent, postContract.response)).toEqual({ sent: true, firstName: 'Player' })
    }
    expect(emailOutbox.map((e) => e.to)).toEqual([words.email, words.email])
  })

  it('a token for one club cannot be used to answer as another\'s representative', async () => {
    flags.pagesOn = true
    const mine = await makeClub({ email: false, reps: 1 })
    const theirs = await makeClub({ email: false, reps: 1 })
    const token = await goodToken(theirs)
    expect((await read(token, { as: mine.reps[0].id })).status).toBe(403)
    expect((await answer(token, { message: 'Example answer.' }, { as: mine.reps[0].id })).status).toBe(403)
    expect((await read(token, { as: theirs.reps[0].id })).status).toBe(200)
    expect(emailOutbox).toEqual([])
  })

  it('a link past its 30 days, changed, or made for another purpose is refused in the same words', async () => {
    flags.pagesOn = true
    const club = await makeClub({ email: false, reps: 1 })
    const as = club.reps[0].id
    const words = visitorWords()
    const claim = { n: words.name, e: words.email, c: club.id, m: words.message }
    const now = Date.now()
    // Sealed 30 days less a second ago: still good. Sealed 30 days ago: past its life.
    const lastSecond = await sealToken(KEY, REPLY_PURPOSE, claim, REPLY_TTL_SECONDS, new Date(now - REPLY_TTL_SECONDS * 1000 + 1000))
    expect((await read(lastSecond, { as })).status).toBe(200)
    const expired = await sealToken(KEY, REPLY_PURPOSE, claim, REPLY_TTL_SECONDS, new Date(now - REPLY_TTL_SECONDS * 1000))
    const good = await goodToken(club, words)
    const parts = good.split('.')
    const flip = (part: string) => (part[0] === 'A' ? `B${part.slice(1)}` : `A${part.slice(1)}`)
    const changed = [
      [parts[0], parts[1], parts[2], parts[3], flip(parts[4])].join('.'),
      [parts[0], parts[1], flip(parts[2]), parts[3], parts[4]].join('.'),
      good.slice(0, -4),
      `${good}x`,
      'not-a-token',
    ]
    const otherPurpose = await sealToken(KEY, 'club_confirm', claim, REPLY_TTL_SECONDS)
    const signedOnly = await signToken(KEY, REPLY_PURPOSE, { c: club.id }, REPLY_TTL_SECONDS)
    const otherKey = await sealToken('example-another-made-up-key-of-enough-length', REPLY_PURPOSE, claim, REPLY_TTL_SECONDS)
    const answers = new Set<string>()
    for (const token of [expired, ...changed, otherPurpose, signedOnly, otherKey]) {
      for (const result of [await read(token, { as }), await answer(token, { message: 'Example answer.' }, { as })]) {
        expect(result.status, token.slice(0, 12)).toBe(400)
        answers.add(await result.response.clone().text())
      }
    }
    expect([...answers]).toEqual([JSON.stringify({ error: REPLY_LINK_REFUSED })])
    expect(emailOutbox).toEqual([])
  })

  it('a club deleted since the message is said in words to an LCA admin', async () => {
    flags.pagesOn = true
    const club = await makeClub({ email: false })
    const admin = await onlyAdmin()
    const token = await goodToken(club)
    await env.DB.prepare('DELETE FROM clubs WHERE id = ?').bind(club.id).run()
    const gone = await read(token, { as: admin.id })
    expect(gone.status).toBe(404)
    expect(await gone.json()).toEqual({ error: REPLY_CLUB_GONE })
  })
})

describe('the reply', () => {
  it('reaches the visitor from LCA\'s address with no volunteer\'s address in any header or line, signed by the role alone', async () => {
    flags.pagesOn = true
    const club = await makeClub({ email: false, reps: 1 })
    const admin = await onlyAdmin()
    const words = visitorWords()
    expect((await relay(club, words)).status).toBe(200)
    const token = tokenOf(linkOf(emailOutbox[0].text)!)
    const rep = club.reps[0]
    for (const [by, signOff] of [[rep, `LCA ${club.region} representative`], [admin, 'Louisiana Chess Association']] as const) {
      emailOutbox.length = 0
      replyTos.length = 0
      const result = await answer(token, { message: 'We meet on Saturdays at 10:00 AM. You are welcome to come by.' }, { as: by.id })
      expect(result.status).toBe(200)
      expect(emailOutbox).toHaveLength(1)
      const [mail] = emailOutbox
      expect(mail.to).toBe(words.email)
      expect(mail.from).toContain(DEFAULT_FROM)
      expect(replyToOf(words.email)).toEqual([[DEFAULT_REPLY_TO]])
      expect(mail.subject).toBe(`An answer to your message to ${club.name}`)
      expect(mail.text).toContain('Hi Player,')
      expect(mail.text).toContain('We meet on Saturdays at 10:00 AM. You are welcome to come by.')
      expect(mail.text).toContain(`\n${signOff}\n`)
      // The last line: the address is LCA's own, and the club's page is the way to write again.
      expect(mail.text!.split('\n').at(-1)).toBe(`This email comes from the Louisiana Chess Association's own address. To write to ${club.name} again, use the club's page: ${SITE}/clubs/${club.slug}`)
      expect(mail.html).toContain(`href="${SITE}/clubs/${club.slug}"`)
      // No name and no address of the person answering anywhere: not the body, the headers or the request the mail path made.
      const everything = `${mail.from}${mail.subject}${mail.html}${mail.text}${JSON.stringify(mail.headers ?? {})}${replyTos[0].body}`
      for (const piece of [rep.email, rep.name, admin.email, admin.name, 'Example Rep', 'Example Admin']) expect(everything, piece).not.toContain(piece)
      if (by === admin) expect(everything).not.toContain('representative')
    }
  })

  it('takes nothing from the request but the words: no recipient, copy, subject or reply-to', async () => {
    flags.pagesOn = true
    const club = await makeClub({ email: false, reps: 1 })
    const words = visitorWords()
    const token = await goodToken(club, words)
    const result = await answer(token, {
      message: 'Example answer.',
      to: 'someone-else@example.org', email: 'other@example.org', cc: 'copy@example.org', bcc: ['hidden@example.org'], replyTo: 'reply@example.org',
      reply_to: 'reply2@example.org', subject: 'A subject of the request', from: 'from@example.org', signOff: 'Player Two', name: 'Player Two',
    }, { as: club.reps[0].id })
    expect(result.status).toBe(200)
    expect(emailOutbox.map((e) => e.to)).toEqual([words.email])
    expect(emailOutbox[0].subject).toBe(`An answer to your message to ${club.name}`)
    expect(replyToOf(words.email)).toEqual([[DEFAULT_REPLY_TO]])
    expect(JSON.stringify(emailOutbox) + replyTos[0].body).not.toMatch(/someone-else@|\bother@example|copy@example|hidden@example|\breply@example|reply2@example|\bfrom@example|A subject of the request|Player Two/)
  })

  it('escapes the answer\'s words in the HTML, writes them as text, and refuses an answer empty or over 5,000 characters beside the field', async () => {
    flags.pagesOn = true
    const club = await makeClub({ email: false, reps: 1 })
    const token = await goodToken(club)
    const as = club.reps[0].id
    const markup = '<script>alert(1)</script>\n<img src=x onerror="y()"> & </td></table>'
    expect((await answer(token, { message: markup }, { as })).status).toBe(200)
    const [mail] = emailOutbox
    expect(mail.html).not.toMatch(/<script>|<img src=x/)
    expect(mail.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(mail.html).toContain('&lt;img src=x onerror=&quot;y()&quot;&gt; &amp; &lt;/td&gt;&lt;/table&gt;')
    expect(mail.text).toContain(markup)
    emailOutbox.length = 0
    for (const [body, words] of [
      [{ message: '' }, 'Write your reply.'],
      [{ message: '   \n ' }, 'Write your reply.'],
      [{}, 'Write your reply.'],
      [{ message: 'M'.repeat(5001) }, 'Your reply can be at most 5,000 characters.'],
    ] as const) {
      const result = await answer(token, body, { as })
      expect(result.status, JSON.stringify(body).slice(0, 40)).toBe(400)
      expect((await result.json<{ fields: Record<string, string> }>()).fields).toEqual({ message: words })
      expect(result.response.headers.get('Cache-Control')).toBe('no-store')
    }
    expect(emailOutbox).toEqual([])
    expect((await answer(token, { message: 'M'.repeat(5000) }, { as })).status).toBe(200)
  })

  it('the limit refuses the eleventh reply from one person in an hour, in words, and the same link may be answered again until then', async () => {
    flags.pagesOn = true
    const club = await makeClub({ email: false, reps: 2 })
    const words = visitorWords()
    const token = await goodToken(club, words)
    const [first, second] = club.reps
    for (let i = 1; i <= REPLIES_AN_HOUR; i++) expect((await answer(token, { message: `Example answer ${i}.` }, { as: first.id })).status, `reply ${i}`).toBe(200)
    const late = await answer(token, { message: 'Example answer late.' }, { as: first.id })
    expect(late.status).toBe(429)
    expect(await expectContract(late, errorBodySchema)).toEqual({ error: REPLY_BUSY })
    expect(emailOutbox).toHaveLength(REPLIES_AN_HOUR)
    // The GET is not counted: it still opens. Another person is counted on their own.
    expect((await read(token, { as: first.id })).status).toBe(200)
    expect((await answer(token, { message: 'Example answer from the other.' }, { as: second.id })).status).toBe(200)
    // The next hour, the first person is served again.
    vi.setSystemTime(new Date(Date.now() + 60 * 60 * 1000))
    expect((await answer(token, { message: 'Example answer next hour.' }, { as: first.id })).status).toBe(200)
  })

  it('a reply the mail path does not take is said in words, and logged in fixed words alone', async () => {
    flags.pagesOn = true
    const club = await makeClub({ email: false, reps: 1 })
    const words = visitorWords()
    const token = await goodToken(club, words)
    emailBehavior.succeed = false
    emailBehavior.status = 422
    const lines = await logsOf(async () => {
      const result = await answer(token, { message: 'Example answer.' }, { as: club.reps[0].id })
      expect(result.status).toBe(503)
      expect(await expectContract(result, errorBodySchema)).toEqual({ error: REPLY_NOT_SENT })
    })
    expect(lines).toEqual(['Reply through LCA: a reply was not sent.'])
  })
})

describe('nothing stored, nothing shown', () => {
  it('no table but rate_limits grows and no log line carries the message, a name or an address, in both states of the mail switches', async () => {
    flags.pagesOn = true
    for (const [listsOn, sender] of [[false, 'resend'], [true, 'ses']] as const) {
      flags.listsOn = listsOn
      flags.sender = sender
      const club = await makeClub({ email: false, reps: 1 })
      const admin = await onlyAdmin()
      const words = visitorWords()
      const reply = `An example answer for ${mark()}.`
      emailOutbox.length = 0
      // The GET alone grows nothing at all.
      const token = await goodToken(club, words)
      const quiet = await tableCounts()
      expect((await read(token, { as: club.reps[0].id })).status).toBe(200)
      expect(grown(quiet, await tableCounts())).toEqual([])
      const before = await tableCounts()
      const lines = await logsOf(async () => {
        expect((await relay(club, words)).status, sender).toBe(200)
        const sealed = tokenOf(linkOf(emailOutbox[0].text)!)
        for (const as of [club.reps[0].id, admin.id]) {
          expect((await read(sealed, { as })).status).toBe(200)
          expect((await answer(sealed, { message: reply }, { as })).status).toBe(200)
        }
        // A reply the mail path does not take logs its failure, and that line too names nobody.
        emailBehavior.succeed = false
        expect((await answer(sealed, { message: reply }, { as: admin.id })).status).toBe(503)
        emailBehavior.succeed = true
      })
      expect(grown(before, await tableCounts()), sender).toEqual(['rate_limits'])
      const { results } = await env.DB.prepare('SELECT * FROM rate_limits').all<Record<string, unknown>>()
      for (const row of results) expect(Object.keys(row).sort()).toEqual(['bucket', 'hits', 'window_start'])
      expect(JSON.stringify(results)).not.toMatch(/example\.org|Player One/)
      const secrets = [words.name, words.email, words.message, reply, token, club.reps[0].email, club.reps[0].name, admin.email, admin.name, 'v1.x.']
      for (const line of lines) for (const secret of secrets) expect(line, secret).not.toContain(secret)
    }
  })

  it('no answer of the endpoint carries the visitor\'s address, and every one is kept by no cache, sent with no referrer and not indexed', async () => {
    flags.pagesOn = true
    const club = await makeClub({ email: false, reps: 1 })
    const admin = await onlyAdmin()
    // A message that does not name its writer, so the whole name is looked for apart from the first lines.
    const words = visitorWords({ message: 'Hello. When do you meet on Saturdays?' })
    const token = await goodToken(club, words)
    const as = club.reps[0].id
    const answers = [
      await read(token, { as }),
      await read(token, { as: admin.id }),
      await read(token),
      await read(token, { as: await seedMember() }),
      await read('not-a-token', { as }),
      await read(token, { as, over: { SIGNING_SECRET: undefined } }),
      await answer(token, { message: '' }, { as }),
      await answer(token, { message: 'Example answer.' }, { as }),
      await invoke(replyOptions, { method: 'OPTIONS' }),
    ]
    flags.pagesOn = false
    answers.push(await read(token, { as }), await answer(token, { message: 'Example answer.' }, { as }))
    for (const result of answers) {
      expect(result.response.headers.get('Cache-Control'), String(result.status)).toBe('no-store')
      expect(result.response.headers.get('Referrer-Policy')).toBe('no-referrer')
      expect(result.response.headers.get('X-Robots-Tag')).toBe('noindex')
      const text = await result.response.clone().text()
      for (const piece of [words.email, words.name, club.reps[0].email, admin.email]) expect(text, piece).not.toContain(piece)
      expect(text).not.toMatch(/@/)
    }
  })
})

describe('the switch and the address', () => {
  it('403 with the constant unset, reading nothing, whatever the keepers\' constant and the role', async () => {
    const club = await makeClub({ email: false, reps: 1 })
    const admin = await onlyAdmin()
    const token = await goodToken(club)
    for (const keepersOn of [false, true]) {
      flags.keepersOn = keepersOn
      for (const as of [undefined, club.reps[0].id, admin.id]) {
        const counting = countingDb()
        for (const result of [
          await read(token, { as, over: { ...KEYED, DB: counting.db } }),
          await answer(token, { message: 'Example answer.' }, { as, over: { ...KEYED, DB: counting.db } }),
          await invoke(replyPost, { method: 'POST', params: { token }, rawBody: '{not json', env: { ...KEYED, DB: counting.db }, as }),
        ]) {
          expect(result.status).toBe(403)
          expect(await expectContract(result, errorBodySchema)).toEqual({ error: REPLY_CLOSED })
        }
        expect(counting.ran).toEqual([])
      }
    }
    expect(emailOutbox).toEqual([])
  })

  it('"reply" is a reserved short address, and the written club page passes /clubs/reply by with the constant set and unset', async () => {
    expect(RESERVED_SLUGS).toContain('reply')
    expect(isReservedSlug('reply')).toBe(true)
    for (const pagesOn of [true, false]) {
      flags.pagesOn = pagesOn
      const counting = countingDb()
      const context = {
        request: new Request(`${SITE}/clubs/reply`),
        env: { ...(env as unknown as Env), DB: counting.db },
        params: { id: 'reply' },
        data: {},
        functionPath: '/clubs/reply',
        waitUntil: () => {},
        passThroughOnException: () => {},
        next: async () => new Response(SHELL, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }),
      } as unknown as EventContext<Env, string, Record<string, unknown>>
      const page = await routeGet(context)
      expect(page.status).toBe(200)
      // The plain shell, with nothing of a club written into it.
      expect(await page.text()).toBe(SHELL)
      // With the constant set the reserved word is passed by unread; unset, today's preview looks for a club of that id and finds none.
      expect(counting.ran.length, String(pagesOn)).toBe(pagesOn ? 0 : 1)
    }
  })
})

