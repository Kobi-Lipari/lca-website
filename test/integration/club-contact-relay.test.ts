// test/integration/club-contact-relay.test.ts
//
// POST /api/clubs/[id]/contact, the contact relay (WS09 step 26, D29:
// relayed, never shown, never stored), with the real handler, the real
// limiter, the real spam check against the harness's catch point, and the
// real mail path into the harness's outbox. Each case sets CLUB_PAGES_ON and
// CLUB_KEEPERS_ON itself through a getter on a mock of their module, and
// MAIL_LISTS_ON and MAIL_SENDER through getters on a mock of the mail
// switches; no case reads a shipped value of any switch. The reply-to of
// each mail is read from the request the mail path makes, by a wrapper over
// the harness's own fetch that only looks and passes the request on. Every
// club, person and address is made up, and every network address is from
// the ranges set aside for documentation.
import { env } from 'cloudflare:test'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { contracts, errorBodySchema } from '../../domain/contracts'
import { CONTACT_NOT_SENT, CONTACT_GOES_TO } from '../../domain/clubs/contactMessage'
import { CONTACT_HEADING, CONTACT_WRITTEN_LINE } from '../../domain/clubs/pageWords'
import { DEFAULT_REPLY_TO } from '../../domain/mail/addresses'
import {
  CONTACT_CLOSED, CONTACT_CLUB_BUSY, CONTACT_NO_CLUB, onRequestPost as contactPost,
} from '../../functions/api/clubs/[id]/contact'
import { onRequestGet as pageGet } from '../../functions/api/clubs/[id]/page'
import { onRequestGet as routeGet } from '../../functions/clubs/[id]'
import { RELAY_OWN_MAIL_LINE } from '../../functions/utils/clubs/emails'
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
  SIGNING_SECRET: 'example-made-up-signing-key-for-the-relay-0026',
  TURNSTILE_SECRET_KEY: 'example-made-up-spam-check-secret-0026',
}
const SITE = 'https://www.louisianachess.org'
const SHELL = Object.values(import.meta.glob('../../index.html', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)[0]

let seq = 0
const mark = () => `${++seq}${crypto.randomUUID().slice(0, 6)}`
/** A made-up place of its own for each call that needs one, from 198.51.100.0/24 and 203.0.113.0/24. */
const place = () => (++seq % 2 === 0 ? `198.51.100.${seq % 250}` : `203.0.113.${seq % 250}`)

// ── The reply-to of each mail, read from the request the mail path makes ──

const replyTos: Array<{ to: string; replyTo: string[] }> = []
let harnessFetch: typeof fetch
beforeAll(() => {
  harnessFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    if (typeof init?.body === 'string' && (url.hostname === 'api.resend.com' || url.hostname === 'email.us-east-1.amazonaws.com')) {
      const body = JSON.parse(init.body) as { to?: string | string[]; reply_to?: string[]; Destination?: { ToAddresses: string[] }; ReplyToAddresses?: string[] }
      const to = body.Destination?.ToAddresses[0] ?? (Array.isArray(body.to) ? body.to[0] : body.to) ?? ''
      replyTos.push({ to, replyTo: body.ReplyToAddresses ?? body.reply_to ?? [] })
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

// ── Made-up clubs and keepers ──

interface Person { id: string; name: string; email: string }
interface MadeClub { id: string; slug: string; name: string; region: string | null; email: string | null; reps: Person[] }

/** A club with a slug, in a region of its own, with its own address or none, and that many seats each held by one representative. */
async function makeClub(opts: { email?: boolean; reps?: number; vacantSeat?: boolean; region?: boolean } = {}): Promise<MadeClub> {
  const m = mark()
  const id = `club-${m}`
  const slug = `example-chess-club-${m}`
  const name = `Example Chess Club ${m}`
  const region = opts.region === false ? null : `Example Region ${m}`
  const email = opts.email === false ? null : `club-${m}@example.org`
  await env.DB.prepare(
    `INSERT INTO clubs (id, name, city, slug, region, contact_email, contact_name_public, about_text, how_we_meet_text) VALUES (?, ?, 'Example City', ?, ?, ?, 'Contact P.', 'A made up club.', 'Tuesdays at 7:00 PM')`,
  ).bind(id, name, slug, region, email).run()
  const reps: Person[] = []
  if (region) {
    for (let i = 0; i < (opts.reps ?? 0) || (opts.vacantSeat && i === 0); i++) {
      const seat = `seat-${m}-${i}`
      await env.DB.prepare(
        `INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active) VALUES (?, 'Example Region Representative', '', 99, ?, 'regional_rep', 1)`,
      ).bind(seat, seat).run()
      await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(seat, region).run()
      const person = { id: '', name: `Example Rep ${m} ${i}`, email: `rep-${m}-${i}@example.org` }
      person.id = await seedMember({ fullName: person.name, email: person.email })
      await env.DB.prepare(`INSERT INTO board_seat_assignments (seat_id, member_id${opts.vacantSeat ? ', ended_at' : ''}) VALUES (?, ?${opts.vacantSeat ? ", datetime('now')" : ''})`)
        .bind(seat, person.id).run()
      if (!opts.vacantSeat) reps.push(person)
      if (opts.vacantSeat) break
    }
  }
  return { id, slug, name, region, email, reps }
}

/** The cases that send to many people wait the relay's pause between copies, so they are given longer. */
const SLOW = 30_000

/**
 * An LCA admin of the case's own, and the only one on file: the relay writes to every LCA admin, so each case that
 * needs one sets the others back to members first, and the copies stay few.
 */
async function onlyAdmin(): Promise<Person> {
  await env.DB.prepare(`UPDATE members SET role = 'member' WHERE role = 'lca_admin'`).run()
  return makeAdmin()
}

/** An LCA admin of the case's own. */
async function makeAdmin(): Promise<Person> {
  const m = mark()
  const person = { id: '', name: `Example Admin ${m}`, email: `admin-${m}@example.org` }
  person.id = await seedMember({ fullName: person.name, email: person.email, role: 'lca_admin' })
  return person
}
const adminAddresses = async () =>
  (await env.DB.prepare(`SELECT email FROM members WHERE role = 'lca_admin' AND email LIKE '%@%'`).all<{ email: string }>()).results.map((r) => r.email.trim())

/** What a visitor typed, made up. */
function visitorWords(over: Record<string, unknown> = {}) {
  const m = mark()
  return { name: `Player One ${m}`, email: `player-${m}@example.org`, message: `Hello from Player One ${m}. When do you meet?`, token: 'example-made-up-token', ...over }
}

const send = (part: string, body: unknown, opts: { address?: string; over?: Record<string, unknown>; as?: string } = {}) =>
  invoke(contactPost, {
    method: 'POST',
    params: { id: part },
    body,
    env: opts.over ?? KEYED,
    path: `/api/clubs/${part}/contact`,
    headers: { [ADDRESS_HEADER]: opts.address ?? place() },
    as: opts.as,
  })

const contract = contracts['clubs/[id]/contact'].POST

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

describe('where a message goes', () => {
  it('to the club\'s own email with the visitor as reply-to', async () => {
    flags.pagesOn = true
    const club = await makeClub({ reps: 1 })
    const words = visitorWords()
    const result = await send(club.slug, words)
    expect(result.status).toBe(200)
    expect(await expectContract(result, contract.response)).toEqual({ sent: true })
    expect(emailOutbox.map((e) => e.to)).toEqual([club.email])
    expect(replyToOf(club.email!)).toEqual([[words.email]])
    const [mail] = emailOutbox
    expect(mail.subject).toBe(`A message for ${club.name} from the LCA website`)
    expect(mail.text).toContain(words.message)
    expect(mail.text).toContain(`From: ${words.name}`)
    expect(mail.html).toContain('A reply to this email goes to the person who wrote.')
    // The representative gets nothing while the club's own address takes the message.
    expect(emailOutbox.some((e) => e.to === club.reps[0].email)).toBe(false)
  })

  it('to the representative with the no-connected-email line and no reply-to of the visitor', async () => {
    flags.pagesOn = true
    const club = await makeClub({ email: false, reps: 2 })
    const words = visitorWords()
    const result = await send(club.slug, words)
    expect(result.status).toBe(200)
    expect(await result.json()).toEqual({ sent: true })
    expect(emailOutbox.map((e) => e.to).sort()).toEqual(club.reps.map((r) => r.email).sort())
    for (const rep of club.reps) {
      const mail = emailOutbox.find((e) => e.to === rep.email)!
      expect(mail.text).toContain(`${club.name} has no connected email yet, so this message came to you as the ${club.region} representative.`)
      expect(mail.text).toContain(RELAY_OWN_MAIL_LINE)
      expect(mail.text).toContain(`Their email: ${words.email}`)
      expect(mail.html).toContain('not to the person who wrote')
      // The visitor's address is in the body alone; the reply-to is the site's own.
      expect(replyToOf(rep.email)).toEqual([[DEFAULT_REPLY_TO]])
      // One email to each person: no representative sees another's address.
      for (const other of club.reps.filter((r) => r !== rep)) expect(`${mail.html}${mail.text}`).not.toContain(other.email)
    }
  }, SLOW)

  it('to the LCA admins while the seat is open', async () => {
    flags.pagesOn = true
    const club = await makeClub({ email: false, vacantSeat: true })
    const admin = await onlyAdmin()
    const second = await makeAdmin()
    const words = visitorWords()
    const result = await send(club.slug, words)
    expect(result.status).toBe(200)
    const admins = await adminAddresses()
    expect(admins.sort()).toEqual([admin.email, second.email].sort())
    expect(emailOutbox.map((e) => e.to).sort()).toEqual([...admins].sort())
    const mail = emailOutbox.find((e) => e.to === admin.email)!
    expect(mail.text).toContain(`${club.name} has no connected email yet, so this message came to you as an LCA admin.`)
    expect(mail.text).toContain(RELAY_OWN_MAIL_LINE)
    expect(replyToOf(admin.email)).toEqual([[DEFAULT_REPLY_TO]])
  })

  it('a club address the gate refuses falls to the region\'s representative, and the visitor is told Sent', async () => {
    flags.pagesOn = true
    // The gate is asked for event mail once the engine's rules are on.
    flags.listsOn = true
    const club = await makeClub({ reps: 1 })
    await env.DB.prepare(`INSERT INTO mail_do_not_send (address, reason, detail) VALUES (?, 'bounce', 'example made-up bounce')`).bind(club.email).run()
    const words = visitorWords()
    const result = await send(club.slug, words)
    expect(result.status).toBe(200)
    expect(await result.json()).toEqual({ sent: true })
    expect(emailOutbox.map((e) => e.to)).toEqual([club.reps[0].email])
    const [mail] = emailOutbox
    expect(mail.text).toContain(`${club.name}'s email could not be reached, so this message came to you as the ${club.region} representative.`)
    expect(replyToOf(club.reps[0].email)).toEqual([[DEFAULT_REPLY_TO]])
  })

  it('says it could not be sent only when no keeper\'s address takes the message, and Sent while one still does', async () => {
    flags.pagesOn = true
    const club = await makeClub({ reps: 1 })
    const admin = await onlyAdmin()
    // The club's address and its representative's both refused by the service: the LCA admins take it, and it is Sent.
    emailBehavior.succeed = false
    emailBehavior.status = 422
    emailBehavior.failFor = [club.email!, club.reps[0].email]
    const fell = await send(club.slug, visitorWords())
    expect(fell.status).toBe(200)
    expect(emailOutbox.map((e) => e.to)).toContain(admin.email)
    expect(emailOutbox.find((e) => e.to === admin.email)!.text).toContain(`${club.name}'s email could not be reached, so this message came to you as an LCA admin.`)
    // No address takes anything: the visitor is told so, in words, and never which keeper was tried.
    emailOutbox.length = 0
    emailBehavior.failFor = null
    const none = await send(club.slug, visitorWords())
    expect(none.status).toBe(503)
    expect(await expectContract(none, errorBodySchema)).toEqual({ error: CONTACT_NOT_SENT })
    expect(emailOutbox).toEqual([])
  }, SLOW)
})

describe('before any script', () => {
  it('the server-written body carries the Contact heading and its line, and no address', async () => {
    flags.pagesOn = true
    for (const club of [await makeClub({ reps: 1 }), await makeClub({ email: false, reps: 1 }), await makeClub({ email: false, region: false })]) {
      const context = {
        request: new Request(`${SITE}/clubs/${club.slug}`),
        env: env as unknown as Env,
        params: { id: club.slug },
        data: {},
        functionPath: `/clubs/${club.slug}`,
        waitUntil: () => {},
        passThroughOnException: () => {},
        next: async () => new Response(SHELL, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }),
      } as unknown as EventContext<Env, string, Record<string, unknown>>
      const html = await (await routeGet(context)).text()
      const body = html.slice(html.indexOf('<main data-club-written-page>'), html.indexOf('</main>') + '</main>'.length)
      expect(body, club.slug).toContain(`<section><h2>${CONTACT_HEADING}</h2><p>${CONTACT_WRITTEN_LINE}</p></section></main>`)
      // No form, no address and no name of a volunteer, in the body or anywhere in the page.
      expect(body).not.toMatch(/<form|<input|<textarea|mailto:/)
      for (const piece of [club.email, ...club.reps.flatMap((r) => [r.email, r.name])].filter((p): p is string => !!p)) expect(html, piece).not.toContain(piece)
      expect(html).not.toMatch(/[\w.+-]+@example\.org/)
      // The JSON-LD block gains nothing of Contact.
      const ld = html.slice(html.indexOf('<script type="application/ld+json">'), html.indexOf('</script>', html.indexOf('<script type="application/ld+json">')))
      expect(ld).not.toMatch(/Contact|contactPoint|email/)
    }
  })
})

describe('the guards', () => {
  it('the spam check failing refuses and sends nothing', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    spamCheckBehavior.answer = 'fail'
    const failed = await send(club.slug, visitorWords())
    expect(failed.status).toBe(403)
    expect(await expectContract(failed, errorBodySchema)).toEqual({ error: CANT_SEND_NOW })
    expect(spamCheckRequests).toHaveLength(1)
    // No token at all: refused before the provider is asked.
    spamCheckBehavior.answer = 'pass'
    const noToken: Record<string, unknown> = visitorWords()
    delete noToken.token
    const missing = await send(club.slug, noToken)
    expect(missing.status).toBe(403)
    expect(spamCheckRequests).toHaveLength(1)
    expect(emailOutbox).toEqual([])
  })

  it('no signing secret refuses and sends nothing', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    const before = await tableCounts()
    for (const over of [{ ...KEYED, SIGNING_SECRET: undefined }, { ...KEYED, SIGNING_SECRET: 'too-short-a-key' }]) {
      const result = await send(club.slug, visitorWords(), { over })
      expect(result.status).toBe(503)
      expect(await expectContract(result, errorBodySchema)).toEqual({ error: CANT_SEND_NOW })
    }
    // Refused before the spam check is asked and before anything is counted.
    expect(spamCheckRequests).toEqual([])
    expect(grown(before, await tableCounts())).toEqual([])
    // No spam check secret: refused too, after the place is counted.
    const noSpamKey = await send(club.slug, visitorWords(), { over: { ...KEYED, TURNSTILE_SECRET_KEY: undefined } })
    expect(noSpamKey.status).toBe(503)
    expect(emailOutbox).toEqual([])
  })

  it('the sixth message in an hour is refused', async () => {
    flags.pagesOn = true
    const address = place()
    const clubs = await Promise.all([1, 2, 3, 4, 5, 6].map(() => makeClub()))
    // Five from one place, to five clubs, all go: the place's count is for every club together.
    for (const club of clubs.slice(0, 5)) expect((await send(club.slug, visitorWords(), { address })).status, club.slug).toBe(200)
    const sixth = await send(clubs[5].slug, visitorWords(), { address })
    expect(sixth.status).toBe(429)
    expect(await expectContract(sixth, errorBodySchema)).toEqual({ error: TOO_MANY })
    expect(emailOutbox.map((e) => e.to)).toEqual(clubs.slice(0, 5).map((c) => c.email))
    // Refused before the spam check: five asks, not six.
    expect(spamCheckRequests).toHaveLength(5)
    // Another place is still served.
    expect((await send(clubs[5].slug, visitorWords())).status).toBe(200)
  }, SLOW)

  it('the twenty-first message to one club in an hour is refused, from whatever place', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    for (let i = 1; i <= 20; i++) expect((await send(club.slug, visitorWords())).status, `message ${i}`).toBe(200)
    const late = await send(club.slug, visitorWords())
    expect(late.status).toBe(429)
    expect(await expectContract(late, errorBodySchema)).toEqual({ error: CONTACT_CLUB_BUSY })
    expect(emailOutbox).toHaveLength(20)
    // Another club is still written to.
    const other = await makeClub()
    expect((await send(other.slug, visitorWords())).status).toBe(200)
  }, SLOW)

  it('a club\'s hour is never used up by messages that fail the spam check', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    spamCheckBehavior.answer = 'fail'
    for (let i = 1; i <= 25; i++) expect((await send(club.slug, visitorWords())).status, `message ${i}`).toBe(403)
    spamCheckBehavior.answer = 'pass'
    const good = await send(club.slug, visitorWords())
    expect(good.status).toBe(200)
    expect(emailOutbox.map((e) => e.to)).toEqual([club.email])
  }, SLOW)

  it('reads the body first, then the place\'s count, the spam check, the club and the club\'s count, each refusing with nothing sent', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    const rows = async () => (await env.DB.prepare('SELECT COUNT(*) AS n FROM rate_limits').first<{ n: number }>())!.n
    const start = await rows()
    // A body the contract refuses: 400 in the field's words, nothing counted and the provider never asked.
    const bad = await send(club.slug, { ...visitorWords(), email: 'not an address' })
    expect(bad.status).toBe(400)
    expect((await bad.json<{ fields: Record<string, string> }>()).fields).toEqual({ email: 'Enter one email address, like name@example.org.' })
    expect(await rows()).toBe(start)
    expect(spamCheckRequests).toEqual([])
    // An address part that names no club: the place is counted and the provider asked, then the tree's not-found in
    // words, and no club's count is begun.
    const lost = await send('example-no-such-club', visitorWords())
    expect(lost.status).toBe(404)
    expect(await expectContract(lost, errorBodySchema)).toEqual({ error: CONTACT_NO_CLUB })
    expect(spamCheckRequests).toHaveLength(1)
    expect(await rows()).toBe(start + 1)
    // A club found by its id and by an old slug, as the page finds it, each counted for the club too.
    await env.DB.prepare('INSERT INTO club_slug_history (old_slug, club_id) VALUES (?, ?)').bind(`old-${club.slug}`, club.id).run()
    for (const part of [club.id, `old-${club.slug}`]) expect((await send(part, visitorWords())).status, part).toBe(200)
    expect(emailOutbox.map((e) => e.to)).toEqual([club.email, club.email])
  })
})

describe('never an open relay', () => {
  it('takes no recipient, copy or subject from the request and sends nothing to the visitor\'s own address', async () => {
    flags.pagesOn = true
    const club = await makeClub({ reps: 1 })
    const words = visitorWords()
    const result = await send(club.slug, {
      ...words,
      to: 'someone-else@example.org', cc: 'copy@example.org', bcc: ['hidden@example.org'], replyTo: 'other@example.org',
      subject: 'A subject of the visitor\'s', recipients: ['many@example.org'], club_email: 'club-over@example.org',
    })
    expect(result.status).toBe(200)
    expect(emailOutbox.map((e) => e.to)).toEqual([club.email])
    expect(emailOutbox[0].subject).toBe(`A message for ${club.name} from the LCA website`)
    expect(replyToOf(club.email!)).toEqual([[words.email]])
    expect(JSON.stringify(emailOutbox)).not.toMatch(/someone-else|copy@|hidden@|other@|many@|club-over@|A subject of the visitor/)
    expect(emailOutbox.some((e) => e.to === words.email)).toBe(false)

    // A visitor who types the club's own address gets no copy at it: the message goes on to the next keeper.
    emailOutbox.length = 0
    replyTos.length = 0
    const same = await send(club.slug, visitorWords({ email: club.email }))
    expect(same.status).toBe(200)
    expect(emailOutbox.map((e) => e.to)).toEqual([club.reps[0].email])
    expect(replyToOf(club.reps[0].email)).toEqual([[DEFAULT_REPLY_TO]])
  })

  it('refuses a line break typed into the name or the address, and an address that is not one plain address', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    const LS = String.fromCharCode(0x2028)
    const tries: Array<[Record<string, unknown>, string, string]> = [
      [{ name: 'Player One\nBcc: hidden@example.org' }, 'name', 'Write your name on one line.'],
      [{ name: 'Player One\r' }, 'name', 'Write your name on one line.'],
      [{ name: `Player${LS}One` }, 'name', 'Write your name on one line.'],
      [{ email: 'player@example.org\nBcc: hidden@example.org' }, 'email', 'Enter one email address, like name@example.org.'],
      [{ email: 'player@example.org, hidden@example.org' }, 'email', 'Enter one email address, like name@example.org.'],
      [{ email: 'Player One <player@example.org>' }, 'email', 'Enter one email address, like name@example.org.'],
      [{ email: 'player@example' }, 'email', 'Enter one email address, like name@example.org.'],
      [{ name: '   ' }, 'name', 'Enter your name.'],
      [{ name: 'P'.repeat(101) }, 'name', 'Your name can be at most 100 characters.'],
      [{ email: `${'p'.repeat(250)}@example.org` }, 'email', 'Your email address can be at most 254 characters.'],
      [{ message: '' }, 'message', 'Write your message.'],
      [{ message: 'M'.repeat(5001) }, 'message', 'Your message can be at most 5,000 characters.'],
    ]
    for (const [over, field, words] of tries) {
      const result = await send(club.slug, visitorWords(over))
      expect(result.status, JSON.stringify(over).slice(0, 60)).toBe(400)
      expect((await result.json<{ fields: Record<string, string> }>()).fields[field]).toBe(words)
    }
    // At the caps exactly, the message goes.
    expect((await send(club.slug, visitorWords({ name: 'P'.repeat(100), message: 'M'.repeat(5000) }))).status).toBe(200)
    expect(emailOutbox).toHaveLength(1)
    expect(spamCheckRequests).toHaveLength(1)
  })

  it('escapes markup typed into every field in the mail\'s HTML and writes it as text in its plain part', async () => {
    flags.pagesOn = true
    for (const club of [await makeClub(), await makeClub({ email: false, reps: 1 })]) {
      emailOutbox.length = 0
      const words = visitorWords({
        name: '<b>Player</b> "One" & \'Two\'',
        email: `player.o'one&co-${mark()}@example.org`,
        message: '<script>alert(1)</script>\n<img src=x onerror="y()"> & </td></table>',
      })
      expect((await send(club.slug, words)).status).toBe(200)
      const [mail] = emailOutbox
      expect(mail.html).not.toMatch(/<script>|<img src=x|<b>Player<\/b>/)
      for (const piece of ['&lt;b&gt;Player&lt;/b&gt; &quot;One&quot; &amp; &#39;Two&#39;', '&lt;script&gt;alert(1)&lt;/script&gt;', '&lt;img src=x onerror=&quot;y()&quot;&gt;', '&amp; &lt;/td&gt;&lt;/table&gt;', words.email.replace(/&/g, '&amp;').replace(/'/g, '&#39;')]) {
        expect(mail.html, piece).toContain(piece)
      }
      expect(mail.text).toContain(`From: ${words.name}`)
      expect(mail.text).toContain(words.message)
      // The subject is the fixed words and the club's name, never the visitor's.
      expect(mail.subject).toBe(`A message for ${club.name} from the LCA website`)
    }
  }, SLOW)
})

describe('nothing stored, nothing shown', () => {
  it('no table but rate_limits grows and no log line carries the message, the name or an address, in both states of the mail switches', async () => {
    flags.pagesOn = true
    for (const [listsOn, sender] of [[false, 'resend'], [true, 'ses']] as const) {
      flags.listsOn = listsOn
      flags.sender = sender
      for (const club of [await makeClub({ reps: 1 }), await makeClub({ email: false, reps: 1 }), await makeClub({ email: false, vacantSeat: true })]) {
        await onlyAdmin()
        emailOutbox.length = 0
        const words = visitorWords()
        const visitorPlace = place()
        const before = await tableCounts()
        const lines = await logsOf(async () => {
          expect((await send(club.slug, words, { address: visitorPlace })).status, `${sender} ${club.slug}`).toBe(200)
          // A send no address takes logs its failure, and that line too names nobody.
          emailBehavior.succeed = false
          expect((await send(club.slug, visitorWords())).status).toBe(503)
          emailBehavior.succeed = true
        })
        const after = await tableCounts()
        expect(grown(before, after), `${sender} ${club.slug}`).toEqual(['rate_limits'])
        // Every row of the one table that grew: a keyed hash, a count and an hour, and none of what was typed.
        const { results } = await env.DB.prepare('SELECT * FROM rate_limits').all<Record<string, unknown>>()
        for (const row of results) {
          expect(Object.keys(row).sort()).toEqual(['bucket', 'hits', 'window_start'])
          expect(String(row.bucket)).toMatch(/^[0-9a-f]{64}$/)
        }
        const keepers = [club.email, ...club.reps.map((r) => r.email), ...(await adminAddresses())].filter((a): a is string => !!a)
        const secrets = [words.name, words.email, words.message, visitorPlace, ...keepers]
        for (const line of lines) for (const secret of secrets) expect(line, secret).not.toContain(secret)
        expect(JSON.stringify(results)).not.toMatch(/example\.org|Player One/)
        expect(emailOutbox.every((e) => keepers.includes(e.to))).toBe(true)
      }
    }
  }, SLOW)

  it('no response and no page answer or page HTML carries a club\'s or a volunteer\'s address or a volunteer\'s name, whatever the routing', async () => {
    flags.pagesOn = true
    const admin = await onlyAdmin()
    const kinds: Array<[MadeClub, (typeof CONTACT_GOES_TO)[number]]> = [
      [await makeClub({ reps: 1 }), 'club'],
      [await makeClub({ email: false, reps: 2 }), 'region'],
      [await makeClub({ email: false, vacantSeat: true }), 'lca'],
    ]
    for (const [club, kind] of kinds) {
      const people = [club.email, admin.email, admin.name, ...club.reps.flatMap((r) => [r.email, r.name])].filter((p): p is string => !!p)
      const page = await invoke(pageGet, { params: { id: club.slug }, path: `/api/clubs/${club.slug}/page` })
      const pageText = await page.response.clone().text()
      expect(JSON.parse(pageText).contact, club.slug).toEqual({ name: 'Contact P.', goes_to: kind })
      const sent = await send(club.slug, visitorWords())
      const refused = await send(club.slug, { ...visitorWords(), email: 'x' })
      for (const text of [pageText, await sent.response.clone().text(), await refused.response.clone().text()]) {
        for (const piece of people) expect(text, piece).not.toContain(piece)
        // The one address any answer holds is the field's own example, name@example.org, which is nobody's.
        expect(text.replaceAll('name@example.org', '')).not.toMatch(/@example\.org/)
      }
    }
    // A dead club address is never told: the page says the club's own address all the same.
    const dead = await makeClub({ reps: 1 })
    await env.DB.prepare(`INSERT INTO mail_do_not_send (address, reason, detail) VALUES (?, 'bounce', NULL)`).bind(dead.email).run()
    expect((await (await invoke(pageGet, { params: { id: dead.slug }, path: `/api/clubs/${dead.slug}/page` })).json<{ contact: unknown }>()).contact).toEqual({ name: 'Contact P.', goes_to: 'club' })
  }, SLOW)
})

describe('who may send', () => {
  it('gives the same answer, and the same one copy, to a visitor signed out, a member, the club\'s rep, the region\'s representative and an LCA admin', async () => {
    flags.pagesOn = true
    flags.keepersOn = true
    const club = await makeClub({ reps: 1 })
    const member = await seedMember({ email: `member-${mark()}@example.org` })
    const rep = await seedMember({ role: 'club_rep', clubId: club.id, email: `club-rep-${mark()}@example.org` })
    const admin = await onlyAdmin()
    const answers: string[] = []
    for (const as of [undefined, member, rep, club.reps[0].id, admin.id]) {
      emailOutbox.length = 0
      const result = await send(club.slug, visitorWords(), { as })
      expect(result.status, String(as)).toBe(200)
      answers.push(await result.response.clone().text())
      expect(emailOutbox.map((e) => e.to), String(as)).toEqual([club.email])
    }
    expect(new Set(answers)).toEqual(new Set(['{"sent":true}']))
    // With CLUB_PAGES_ON unset, the one 403 for each of them, whatever their role.
    flags.pagesOn = false
    for (const as of [undefined, member, rep, club.reps[0].id, admin.id]) {
      const result = await send(club.slug, visitorWords(), { as })
      expect(result.status, String(as)).toBe(403)
      expect(await result.json()).toEqual({ error: CONTACT_CLOSED })
    }
  }, SLOW)

  it('403 with the constant unset, reading nothing, whatever the keepers\' constant says', async () => {
    const club = await makeClub()
    for (const keepersOn of [false, true]) {
      flags.keepersOn = keepersOn
      const counting = countingDb()
      const result = await send(club.slug, visitorWords(), { over: { ...KEYED, DB: counting.db } })
      expect(result.status).toBe(403)
      expect(await expectContract(result, errorBodySchema)).toEqual({ error: CONTACT_CLOSED })
      expect(counting.ran).toEqual([])
      // A body that is not even JSON is answered the same, unread.
      const raw = await invoke(contactPost, { method: 'POST', params: { id: club.slug }, rawBody: '{not json', env: { ...KEYED, DB: counting.db }, headers: { [ADDRESS_HEADER]: place() } })
      expect(raw.status).toBe(403)
      expect(counting.ran).toEqual([])
    }
    expect(spamCheckRequests).toEqual([])
    expect(emailOutbox).toEqual([])
  })
})
