// test/integration/club-contact-relay-edges.test.ts
//
// The edges of POST /api/clubs/[id]/contact (the contact relay of WS09, D29),
// beside test/integration/club-contact-relay.test.ts, which holds the routes,
// the guards and the role-safety case: messages sent at once (the two counts
// are atomic, so the last place in an hour goes to one message only), the
// hour's own edges in UTC across the changes of America/Chicago's clock and
// its midnight, bodies the contract refuses, address parts that name nothing,
// keepers whose address cannot be written to, what every refusal carries
// (kept by no cache, no line of the log with what was typed, nor the words a
// mail service refuses a copy in, which may name its address) and the plain
// words of every copy. Each case sets CLUB_PAGES_ON and CLUB_KEEPERS_ON
// itself through a getter on a mock of their module, and MAIL_LISTS_ON and
// MAIL_SENDER through getters on a mock of the mail switches. The spam
// check's outside call is answered by the harness's catch point. Every club,
// person and address is made up, from the ranges set aside for documentation
// where it is a network address.
import { env } from 'cloudflare:test'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { errorBodySchema } from '../../domain/contracts'
import { CONTACT_NOT_SENT } from '../../domain/clubs/contactMessage'
import { DEFAULT_REPLY_TO } from '../../domain/mail/addresses'
import { CONTACT_CLUB_BUSY, CONTACT_CLOSED, CONTACT_NO_CLUB, onRequestOptions, onRequestPost as contactPost } from '../../functions/api/clubs/[id]/contact'
import { COPY_NOT_SENT_LOG } from '../../functions/utils/clubs/relay'
import { onRequestGet as pageGet } from '../../functions/api/clubs/[id]/page'
import { ADDRESS_HEADER, CANT_SEND_NOW, TOO_MANY } from '../../functions/utils/rateLimit'
import type { Env } from '../../functions/types'
import { seedMember } from './factories'
import { emailBehavior, emailOutbox, expectContract, invoke, resetHarness, spamCheckBehavior, spamCheckRequests } from './harness'
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

const KEYED = {
  SIGNING_SECRET: 'example-made-up-signing-key-for-the-edges-0026',
  TURNSTILE_SECRET_KEY: 'example-made-up-spam-check-secret-edges-0026',
}

let seq = 0
const mark = () => `${++seq}${crypto.randomUUID().slice(0, 6)}`
/** A made-up place of its own for each call, from 198.51.100.0/24 and 203.0.113.0/24. */
const place = () => `${seq++ % 2 === 0 ? '198.51.100' : '203.0.113'}.${(seq % 250) + 1}`

// ── The reply-to of each mail, read from the request the mail path makes ──

const replyTos: Array<{ to: string; replyTo: string[]; cc: unknown; bcc: unknown }> = []
/**
 * While set, the mail service refuses every copy in words that name the address it refused, as Resend's own words
 * and Amazon SES's sandbox refusal do, and the addresses refused are kept here.
 */
const serviceRefusal = { namesAddress: false, refused: [] as string[] }
let harnessFetch: typeof fetch
beforeAll(() => {
  harnessFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    if (serviceRefusal.namesAddress && typeof init?.body === 'string') {
      if (url.hostname === 'api.resend.com') {
        const body = JSON.parse(init.body) as { to?: string | string[] }
        const to = Array.isArray(body.to) ? body.to.join(',') : (body.to ?? '')
        serviceRefusal.refused.push(to)
        return new Response(JSON.stringify({ statusCode: 403, name: 'validation_error', message: `You can only send testing emails to your own address. ${to} is not allowed.` }), { status: 403 })
      }
      if (url.hostname === 'email.us-east-1.amazonaws.com') {
        const to = (JSON.parse(init.body) as { Destination: { ToAddresses: string[] } }).Destination.ToAddresses.join(',')
        serviceRefusal.refused.push(to)
        return new Response(
          JSON.stringify({ message: `Email address is not verified. The following identities failed the check in region US-EAST-1: ${to}` }),
          { status: 400, headers: { 'x-amzn-errortype': 'MessageRejected' } },
        )
      }
    }
    if (typeof init?.body === 'string' && url.hostname === 'api.resend.com') {
      const body = JSON.parse(init.body) as { to?: string | string[]; reply_to?: string[]; cc?: unknown; bcc?: unknown }
      replyTos.push({ to: Array.isArray(body.to) ? body.to.join(',') : (body.to ?? ''), replyTo: body.reply_to ?? [], cc: body.cc, bcc: body.bcc })
    }
    return harnessFetch(input, init)
  }) as typeof fetch
})
afterAll(() => {
  globalThis.fetch = harnessFetch
})

/** The middle of an hour, held still, so every call of a case lands in one hour. */
function holdHour(at?: string) {
  vi.useFakeTimers({ toFake: ['Date'] })
  if (at) {
    vi.setSystemTime(new Date(at))
    return
  }
  const middle = new Date()
  middle.setUTCMinutes(30, 0, 0)
  vi.setSystemTime(middle)
}

beforeEach(() => {
  resetHarness()
  replyTos.length = 0
  serviceRefusal.namesAddress = false
  serviceRefusal.refused.length = 0
  flags.pagesOn = true
  flags.keepersOn = false
  flags.listsOn = false
  flags.sender = 'resend'
  holdHour()
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

// ── Made-up clubs and keepers ──

interface Person { id: string; name: string; email: string }
interface MadeClub { id: string; slug: string; name: string; region: string; email: string | null; reps: Person[] }

/** A club with a slug and a region of its own, an address or none, and that many seats each held by one representative. */
async function makeClub(opts: { email?: string | null; reps?: number; name?: string } = {}): Promise<MadeClub> {
  const m = mark()
  const id = `club-${m}`
  const slug = `example-chess-club-${m}`
  const name = opts.name ?? `Example Chess Club ${m}`
  const region = `Example Region ${m}`
  const email = opts.email === undefined ? `club-${m}@example.org` : opts.email
  await env.DB.prepare(
    `INSERT INTO clubs (id, name, city, slug, region, contact_email, contact_name_public, about_text, how_we_meet_text) VALUES (?, ?, 'Example City', ?, ?, ?, 'Contact P.', 'A made up club.', 'Tuesdays at 7:00 PM')`,
  ).bind(id, name, slug, region, email).run()
  const reps: Person[] = []
  for (let i = 0; i < (opts.reps ?? 0); i++) {
    const seat = `seat-${m}-${i}`
    await env.DB.prepare(
      `INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active) VALUES (?, 'Example Region Representative', '', 99, ?, 'regional_rep', 1)`,
    ).bind(seat, seat).run()
    await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(seat, region).run()
    const person = { id: '', name: `Example Rep ${m} ${i}`, email: `rep-${m}-${i}@example.org` }
    person.id = await seedMember({ fullName: person.name, email: person.email })
    await env.DB.prepare('INSERT INTO board_seat_assignments (seat_id, member_id) VALUES (?, ?)').bind(seat, person.id).run()
    reps.push(person)
  }
  return { id, slug, name, region, email, reps }
}

/** The only LCA admin on file, of the case's own, so the copies to LCA stay few. */
async function onlyAdmin(): Promise<Person> {
  await env.DB.prepare(`UPDATE members SET role = 'member' WHERE role = 'lca_admin'`).run()
  const m = mark()
  const person = { id: '', name: `Example Admin ${m}`, email: `admin-${m}@example.org` }
  person.id = await seedMember({ fullName: person.name, email: person.email, role: 'lca_admin' })
  return person
}

/** What a visitor typed, made up. */
function visitorWords(over: Record<string, unknown> = {}) {
  const m = mark()
  return { name: `Player One ${m}`, email: `player-${m}@example.org`, message: `Hello from Player One ${m}. When do you meet?`, token: 'example-made-up-token', ...over }
}

const send = (part: string, body: unknown, opts: { address?: string; env?: Partial<Env>; rawBody?: string; method?: string } = {}) =>
  invoke(contactPost, {
    method: opts.method ?? 'POST',
    params: { id: part },
    ...(opts.rawBody !== undefined ? { rawBody: opts.rawBody } : { body }),
    env: opts.env ?? KEYED,
    path: `/api/clubs/${part}/contact`,
    headers: { [ADDRESS_HEADER]: opts.address ?? place() },
  })

const rateRows = async () => (await env.DB.prepare('SELECT COUNT(*) AS n FROM rate_limits').first<{ n: number }>())!.n

async function logsOf(work: () => Promise<void>): Promise<string[]> {
  const lines: string[] = []
  for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => { lines.push(args.map((a) => (a instanceof Error ? a.message : typeof a === 'string' ? a : JSON.stringify(a))).join(' ')) })
  }
  await work()
  return lines
}

const SLOW = 30_000

describe('messages sent at once', () => {
  it('the club\'s twenty is never passed by messages that arrive together, from twenty-five places', async () => {
    const club = await makeClub()
    const results = await Promise.all(Array.from({ length: 25 }, () => send(club.slug, visitorWords())))
    const statuses = results.map((r) => r.status)
    expect(statuses.filter((s) => s === 200)).toHaveLength(20)
    expect(statuses.filter((s) => s === 429)).toHaveLength(5)
    expect(statuses.every((s) => s === 200 || s === 429)).toBe(true)
    // Only the twenty that went were sent, each to the club's own address, once.
    expect(emailOutbox).toHaveLength(20)
    expect(emailOutbox.every((e) => e.to === club.email)).toBe(true)
    for (const refused of results.filter((r) => r.status === 429)) {
      expect(await refused.json()).toEqual({ error: CONTACT_CLUB_BUSY })
    }
    // Every place was asked of the spam check: the club's count is for a message that passed it, and all twenty-five did.
    expect(spamCheckRequests).toHaveLength(25)
  }, SLOW)

  it('a place\'s five is never passed by messages that arrive together from one place', async () => {
    const club = await makeClub()
    const address = place()
    const results = await Promise.all(Array.from({ length: 9 }, () => send(club.slug, visitorWords(), { address })))
    expect(results.filter((r) => r.status === 200)).toHaveLength(5)
    expect(results.filter((r) => r.status === 429)).toHaveLength(4)
    for (const refused of results.filter((r) => r.status === 429)) expect(await refused.json()).toEqual({ error: TOO_MANY })
    expect(emailOutbox).toHaveLength(5)
    // The four that were turned away never reached the spam check.
    expect(spamCheckRequests).toHaveLength(5)
  }, SLOW)

  it('messages that fail the spam check at once never use any of the club\'s hour', async () => {
    const club = await makeClub()
    spamCheckBehavior.answer = 'fail'
    const failed = await Promise.all(Array.from({ length: 30 }, () => send(club.slug, visitorWords())))
    expect(failed.every((r) => r.status === 403)).toBe(true)
    spamCheckBehavior.answer = 'pass'
    const good = await Promise.all(Array.from({ length: 20 }, () => send(club.slug, visitorWords())))
    expect(good.every((r) => r.status === 200)).toBe(true)
    expect(emailOutbox).toHaveLength(20)
  }, SLOW)
})

describe('the hour a count lives in', () => {
  // The count's hour is the UTC hour, never the hour on the clock in America/Chicago: the hour never has 30 or 90 minutes,
  // and the hour the clocks repeat or skip is counted as the two or the one hour it is on a UTC clock.
  const EDGES: Array<[string, string, string]> = [
    ['an ordinary hour', '2026-11-18T11:59:59.000Z', '2026-11-18T12:00:00.000Z'],
    ['midnight in America/Chicago, Wednesday, November 18, 2026', '2026-11-18T05:59:59.000Z', '2026-11-18T06:00:00.000Z'],
    ['midnight at the end of the UTC day, Wednesday, November 18, 2026', '2026-11-18T23:59:59.000Z', '2026-11-19T00:00:00.000Z'],
    ['the clocks going back, Sunday, November 1, 2026, at 2:00 AM', '2026-11-01T06:59:59.000Z', '2026-11-01T07:00:00.000Z'],
    ['the clocks going forward, Sunday, March 14, 2027, at 2:00 AM', '2027-03-14T07:59:59.000Z', '2027-03-14T08:00:00.000Z'],
  ]
  for (const [label, last, next] of EDGES) {
    it(`a place that has used its five in the last second of an hour has a fresh five a second later: ${label}`, async () => {
      const club = await makeClub()
      const address = place()
      holdHour(last)
      for (let i = 1; i <= 5; i++) expect((await send(club.slug, visitorWords(), { address })).status, `message ${i}`).toBe(200)
      expect((await send(club.slug, visitorWords(), { address })).status).toBe(429)
      holdHour(next)
      for (let i = 1; i <= 5; i++) expect((await send(club.slug, visitorWords(), { address })).status, `next hour ${i}`).toBe(200)
      expect((await send(club.slug, visitorWords(), { address })).status).toBe(429)
      expect(emailOutbox).toHaveLength(10)
      // The stale hour's rows are gone: the table holds the current hour's only.
      const stale = await env.DB.prepare('SELECT COUNT(*) AS n FROM rate_limits WHERE window_start < ?').bind(next.slice(0, 13).replace('T', ' ') + ':00:00').first<{ n: number }>()
      expect(stale!.n).toBe(0)
    }, SLOW)
  }

  it('a club\'s twenty is fresh in the next hour too, and a club\'s count never carries to another club', async () => {
    const club = await makeClub()
    const other = await makeClub()
    holdHour('2026-11-18T11:30:00.000Z')
    for (let i = 1; i <= 20; i++) expect((await send(club.slug, visitorWords())).status).toBe(200)
    expect((await send(club.slug, visitorWords())).status).toBe(429)
    expect((await send(other.slug, visitorWords())).status).toBe(200)
    holdHour('2026-11-18T12:00:00.000Z')
    expect((await send(club.slug, visitorWords())).status).toBe(200)
  }, SLOW)
})

describe('bodies the contract refuses', () => {
  it('answers a body that is not an object of three strings in words, counts nothing, asks nothing and sends nothing', async () => {
    const club = await makeClub()
    const before = await rateRows()
    const tries: Array<[string, { body?: unknown; rawBody?: string }]> = [
      ['not json', { rawBody: '{not json' }],
      ['empty', { rawBody: '' }],
      ['an array', { rawBody: '[]' }],
      ['null', { rawBody: 'null' }],
      ['a bare string', { rawBody: '"hello"' }],
      ['an empty object', { body: {} }],
      ['numbers for text', { body: { name: 1, email: 2, message: 3 } }],
      ['lists for text', { body: { name: ['Player One'], email: ['player@example.org'], message: ['Hello'] } }],
      ['a token that is not text', { body: { ...visitorWords(), token: { a: 1 } } }],
    ]
    for (const [label, input] of tries) {
      const result = await send(club.slug, input.body, { rawBody: input.rawBody })
      expect(result.status, label).toBe(400)
      expect(result.response.headers.get('Cache-Control'), label).toBe('no-store')
      expect(typeof (await result.json<{ error: unknown }>()).error, label).toBe('string')
    }
    expect(await rateRows()).toBe(before)
    expect(spamCheckRequests).toEqual([])
    expect(emailOutbox).toEqual([])
  })

  it('takes fields a keeper could be misled by as plain text: markup, a line break in the message, trimmed spaces', async () => {
    const club = await makeClub()
    const words = visitorWords({
      name: '  Player One  ',
      email: '  player.one@example.org  ',
      message: '  First line\r\nBcc: hidden@example.org\nTo: another@example.org\n  ',
    })
    const result = await send(club.slug, words)
    expect(result.status).toBe(200)
    expect(emailOutbox.map((e) => e.to)).toEqual([club.email])
    // The reply-to is the address with its spaces off; a header typed into the message is only text in the body.
    expect(replyTos).toHaveLength(1)
    expect(replyTos[0].replyTo).toEqual(['player.one@example.org'])
    expect(replyTos[0].cc ?? null).toBeNull()
    expect(replyTos[0].bcc ?? null).toBeNull()
    expect(emailOutbox[0].text).toContain('From: Player One\n')
    expect(emailOutbox[0].text).toContain('Bcc: hidden@example.org')
    expect(emailOutbox[0].subject).toBe(`A message for ${club.name} from the LCA website`)
  })
})

describe('address parts that name nothing', () => {
  it('answers each with the not-found words, counts the place once, and sends nothing', async () => {
    const parts = ['', ' ', 'EXAMPLE-NO-SUCH-CLUB', 'example no such club', `x'; DROP TABLE clubs; --`, 'club%2Fother', '../contact', 'x'.repeat(400), '\u0000']
    for (const part of parts) {
      const before = await rateRows()
      const result = await send(part, visitorWords())
      expect(result.status, JSON.stringify(part)).toBe(404)
      expect(await expectContract(result, errorBodySchema)).toEqual({ error: CONTACT_NO_CLUB })
      // The place's count is the one row that may begin; the club's count never does.
      expect(await rateRows() - before, JSON.stringify(part)).toBeLessThanOrEqual(1)
    }
    expect(emailOutbox).toEqual([])
    // The clubs table is whole.
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM clubs').first<{ n: number }>())!.n).toBeGreaterThan(0)
  })

  it('begins one row for a place whose message names no club, and two for a message to a club that is there', async () => {
    const start = await rateRows()
    expect((await send('example-no-such-club-at-all', visitorWords(), { address: place() })).status).toBe(404)
    expect(await rateRows()).toBe(start + 1)
    const club = await makeClub()
    expect((await send(club.slug, visitorWords(), { address: place() })).status).toBe(200)
    expect(await rateRows()).toBe(start + 3)
  })
})

describe('keepers whose address cannot be written to', () => {
  it('a club address that is not one goes to the region\'s representative, and the page says so', async () => {
    const admin = await onlyAdmin()
    for (const stored of ['', '   ', 'not an address', 'no-at-sign.example.org', '@example.org', 'club@', 'a b@example.org']) {
      emailOutbox.length = 0
      const club = await makeClub({ email: stored, reps: 1 })
      const page = await invoke(pageGet, { params: { id: club.slug }, path: `/api/clubs/${club.slug}/page` })
      expect((await page.json<{ contact: { goes_to: string } }>()).contact.goes_to, JSON.stringify(stored)).toBe('region')
      expect((await send(club.slug, visitorWords())).status).toBe(200)
      expect(emailOutbox.map((e) => e.to), JSON.stringify(stored)).toEqual([club.reps[0].email])
      expect(emailOutbox.some((e) => e.to === admin.email)).toBe(false)
    }
  }, SLOW)

  it('a representative with no address, and one who is a guest, are not written to: the message goes to the LCA admins, and the page says LCA', async () => {
    const admin = await onlyAdmin()
    const noAddress = await makeClub({ email: null, reps: 1 })
    await env.DB.prepare('UPDATE members SET email = ? WHERE id = ?').bind('no-address-on-file', noAddress.reps[0].id).run()
    const guest = await makeClub({ email: null, reps: 1 })
    await env.DB.prepare(`UPDATE members SET role = 'guest' WHERE id = ?`).bind(guest.reps[0].id).run()
    for (const club of [noAddress, guest]) {
      emailOutbox.length = 0
      const page = await invoke(pageGet, { params: { id: club.slug }, path: `/api/clubs/${club.slug}/page` })
      expect((await page.json<{ contact: { goes_to: string } }>()).contact.goes_to).toBe('lca')
      expect((await send(club.slug, visitorWords())).status).toBe(200)
      expect(emailOutbox.map((e) => e.to)).toEqual([admin.email])
      expect(emailOutbox.some((e) => e.to === club.reps[0].email)).toBe(false)
    }
  }, SLOW)

  it('an address the visitor types in other capitals than the keeper\'s is still the keeper\'s, and gets no copy', async () => {
    const club = await makeClub({ reps: 1 })
    const admin = await onlyAdmin()
    const words = visitorWords({ email: club.email!.toUpperCase() })
    expect((await send(club.slug, words)).status).toBe(200)
    expect(emailOutbox.map((e) => e.to)).toEqual([club.reps[0].email])
    expect(emailOutbox.some((e) => e.to.toLowerCase() === words.email.toLowerCase())).toBe(false)
    expect(emailOutbox.some((e) => e.to === admin.email)).toBe(false)
  })

  it('a visitor who is the only keeper is told it could not be sent, and nothing goes to their own address', async () => {
    // A club with no address, one representative who is the visitor, and no LCA admin with an address.
    await env.DB.prepare(`UPDATE members SET role = 'member' WHERE role = 'lca_admin'`).run()
    const club = await makeClub({ email: null, reps: 1 })
    const result = await send(club.slug, visitorWords({ email: club.reps[0].email }))
    expect(result.status).toBe(503)
    expect(await expectContract(result, errorBodySchema)).toEqual({ error: CONTACT_NOT_SENT })
    expect(emailOutbox).toEqual([])
  })

  it('an address held by a representative and an LCA admin both is written to once', async () => {
    await env.DB.prepare(`UPDATE members SET role = 'member' WHERE role = 'lca_admin'`).run()
    const club = await makeClub({ email: null, reps: 1 })
    await env.DB.prepare(`UPDATE members SET role = 'lca_admin' WHERE id = ?`).bind(club.reps[0].id).run()
    // The representative's address fails; the same address as an admin is not tried again.
    emailBehavior.succeed = false
    emailBehavior.status = 422
    emailBehavior.failFor = [club.reps[0].email]
    const result = await send(club.slug, visitorWords())
    expect(result.status).toBe(503)
    expect(emailOutbox).toEqual([])
    emailBehavior.succeed = true
    emailBehavior.failFor = null
    expect((await send(club.slug, visitorWords())).status).toBe(200)
    expect(emailOutbox.map((e) => e.to)).toEqual([club.reps[0].email])
  }, SLOW)
})

describe('what every answer carries', () => {
  it('is kept by no cache: the 200 and each refusal say so', async () => {
    const club = await makeClub()
    const address = place()
    const answers: Array<[string, Response]> = []
    answers.push(['200', (await send(club.slug, visitorWords(), { address })).response])
    answers.push(['400', (await send(club.slug, { ...visitorWords(), name: '' }, { address })).response])
    answers.push(['404', (await send('example-no-such-club', visitorWords(), { address })).response])
    spamCheckBehavior.answer = 'fail'
    answers.push(['403', (await send(club.slug, visitorWords(), { address })).response])
    spamCheckBehavior.answer = 'pass'
    answers.push(['503', (await send(club.slug, visitorWords(), { address, env: { ...KEYED, SIGNING_SECRET: undefined } })).response])
    for (let i = 0; i < 4; i++) await send(club.slug, visitorWords(), { address })
    answers.push(['429', (await send(club.slug, visitorWords(), { address })).response])
    for (const [status, response] of answers) {
      expect(String(response.status), status).toBe(status)
      expect(response.headers.get('Cache-Control'), status).toBe('no-store')
    }
  }, SLOW)

  it('counts for each message one row for its place, and one for its club only once the spam check has passed it', async () => {
    const club = await makeClub()
    const start = await rateRows()
    // Refused by the contract: nothing counted.
    expect((await send(club.slug, { ...visitorWords(), message: '' })).status).toBe(400)
    expect(await rateRows()).toBe(start)
    // Refused by the spam check: the place only.
    spamCheckBehavior.answer = 'fail'
    expect((await send(club.slug, visitorWords())).status).toBe(403)
    expect(await rateRows()).toBe(start + 1)
    // Sent: the place and the club.
    spamCheckBehavior.answer = 'pass'
    expect((await send(club.slug, visitorWords())).status).toBe(200)
    expect(await rateRows()).toBe(start + 3)
  })

  it('writes no line of the log with what was typed, the place or a keeper\'s address, on any refusal', async () => {
    const club = await makeClub({ reps: 1 })
    const admin = await onlyAdmin()
    const address = place()
    const words = visitorWords()
    const lines = await logsOf(async () => {
      spamCheckBehavior.answer = 'fail'
      await send(club.slug, words, { address })
      spamCheckBehavior.answer = 'none'
      await send(club.slug, words, { address })
      spamCheckBehavior.answer = 'pass'
      await send('example-no-such-club', words, { address })
      await send(club.slug, { ...words, email: 'x' }, { address })
      await send(club.slug, words, { address, env: { ...KEYED, SIGNING_SECRET: undefined } })
      await send(club.slug, words, { address, env: { ...KEYED, TURNSTILE_SECRET_KEY: undefined } })
      for (let i = 0; i < 6; i++) await send(club.slug, words, { address })
    })
    for (const line of lines) {
      for (const secret of [words.name, words.email, words.message, address, club.email!, club.reps[0].email, club.reps[0].name, admin.email, admin.name, KEYED.SIGNING_SECRET, KEYED.TURNSTILE_SECRET_KEY]) {
        expect(line, secret).not.toContain(secret)
      }
    }
  }, SLOW)

  it('logs a copy the mail service refuses in fixed words alone, though the service\'s own words name the address, with either sender', async () => {
    for (const sender of ['resend', 'ses'] as const) {
      flags.sender = sender
      const club = await makeClub({ reps: 1 })
      const admin = await onlyAdmin()
      const words = visitorWords()
      serviceRefusal.refused.length = 0
      serviceRefusal.namesAddress = true
      let status = 0
      const lines = await logsOf(async () => {
        status = (await send(club.slug, words)).status
      })
      serviceRefusal.namesAddress = false
      // Every keeper was tried in order and each refused, so the visitor is told it could not be sent.
      expect(status, sender).toBe(503)
      expect(serviceRefusal.refused, sender).toEqual([club.email, club.reps[0].email, admin.email])
      expect(emailOutbox, sender).toEqual([])
      // One fixed line for each copy that did not go, and nothing the service said.
      expect(lines, sender).toEqual([COPY_NOT_SENT_LOG, COPY_NOT_SENT_LOG, COPY_NOT_SENT_LOG])
      for (const line of lines) {
        for (const secret of [club.email!, club.reps[0].email, admin.email, words.email, words.name, words.message, 'example.org', 'not allowed', 'not verified']) {
          expect(line, `${sender} ${secret}`).not.toContain(secret)
        }
      }
    }
  }, SLOW)

  it('answers OPTIONS with no body for every caller, and reads nothing, with the constant set or not', async () => {
    for (const pagesOn of [false, true]) {
      flags.pagesOn = pagesOn
      const counting = countingDb()
      const result = await invoke(onRequestOptions, { method: 'OPTIONS', params: { id: 'example-chess-club' }, env: { ...KEYED, DB: counting.db } })
      expect(result.status).toBe(204)
      expect(await result.response.text()).toBe('')
      expect(counting.ran).toEqual([])
    }
  })

  it('with the constant unset answers in the closed words before the body is read, however bad the body, and counts and asks nothing', async () => {
    flags.pagesOn = false
    const club = await makeClub()
    const before = await rateRows()
    for (const input of [{ rawBody: '{nope' }, { body: {} }, { body: visitorWords() }]) {
      const result = await send(club.slug, input.body, { rawBody: input.rawBody })
      expect(result.status).toBe(403)
      expect(await result.json()).toEqual({ error: CONTACT_CLOSED })
    }
    expect(await rateRows()).toBe(before)
    expect(spamCheckRequests).toEqual([])
    expect(emailOutbox).toEqual([])
  })
})

describe('the words of the copies and the refusals', () => {
  // Plain language: "US Chess" and never the old abbreviation, no long dash, and the visitor's words never in a subject.
  const LONG_DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
  const OLD_ABBREVIATION = new RegExp(String.fromCharCode(85, 83, 67, 70))
  const HALF = /\b\d*\.5\b/

  it('none of the three copies, nor any refusal, holds a long dash, the old abbreviation for US Chess, or a decimal half', async () => {
    const admin = await onlyAdmin()
    const withClub = await makeClub({ reps: 1 })
    const withRep = await makeClub({ email: null, reps: 1 })
    const withAdmin = await makeClub({ email: null })
    const refusals: string[] = []
    for (const club of [withClub, withRep, withAdmin]) {
      emailOutbox.length = 0
      const result = await send(club.slug, visitorWords())
      expect(result.status).toBe(200)
      expect(emailOutbox).toHaveLength(1)
      const [mail] = emailOutbox
      for (const text of [mail.subject, mail.text, mail.html]) {
        expect(text).not.toMatch(LONG_DASHES)
        expect(text).not.toMatch(OLD_ABBREVIATION)
        expect(text).not.toMatch(HALF)
      }
      expect(mail.to).toBe(club === withClub ? club.email : club === withRep ? club.reps[0].email : admin.email)
    }
    const address = place()
    spamCheckBehavior.answer = 'fail'
    refusals.push(await (await send(withClub.slug, visitorWords(), { address })).response.text())
    spamCheckBehavior.answer = 'pass'
    refusals.push(await (await send(withClub.slug, { ...visitorWords(), email: 'x' }, { address })).response.text())
    refusals.push(await (await send('example-no-such-club', visitorWords(), { address })).response.text())
    refusals.push(await (await send(withClub.slug, visitorWords(), { env: { ...KEYED, SIGNING_SECRET: undefined } })).response.text())
    for (let i = 0; i < 6; i++) refusals.push(await (await send(withClub.slug, visitorWords(), { address })).response.text())
    for (const text of refusals) {
      expect(text).not.toMatch(LONG_DASHES)
      expect(text).not.toMatch(OLD_ABBREVIATION)
    }
    expect(refusals).toContain(JSON.stringify({ error: CANT_SEND_NOW }))
  }, SLOW)

  it('draws the club\'s and the region\'s names into the copies as escaped text, and into the subject as it stands', async () => {
    await onlyAdmin()
    const name = 'Example <Chess> & "Club"'
    const club = await makeClub({ name, email: null, reps: 1 })
    await env.DB.prepare('UPDATE clubs SET region = ? WHERE id = ?').bind('Example <East> & Region', club.id).run()
    await env.DB.prepare('UPDATE seat_regions SET region = ? WHERE region = ?').bind('Example <East> & Region', club.region).run()
    expect((await send(club.slug, visitorWords())).status).toBe(200)
    const [mail] = emailOutbox
    expect(mail.to).toBe(club.reps[0].email)
    expect(mail.subject).toBe(`A message for ${name} from the LCA website`)
    expect(mail.html).not.toMatch(/<Chess>|<East>/)
    expect(mail.html).toContain('Example &lt;Chess&gt; &amp; &quot;Club&quot;')
    expect(mail.html).toContain('Example &lt;East&gt; &amp; Region')
    expect(mail.text).toContain('Example <Chess> & "Club" has no connected email yet, so this message came to you as the Example <East> & Region representative.')
    expect(replyTos.find((r) => r.to === club.reps[0].email)!.replyTo).toEqual([DEFAULT_REPLY_TO])
  })
})
