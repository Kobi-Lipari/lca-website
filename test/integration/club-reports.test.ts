// test/integration/club-reports.test.ts
//
// Suggest an update (WS09 step 28): POST /api/clubs/[id]/reports, what a
// visitor sends from a club's page, and POST
// /api/admin/clubs/[id]/reports/[reportId], a keeper's answer to it, with the
// real handlers, the real limiter, the real spam check against the harness's
// catch point and the real mail path into the harness's outbox. Each case
// sets CLUB_PAGES_ON and CLUB_KEEPERS_ON itself through a getter on a mock of
// their module, and MAIL_LISTS_ON and MAIL_SENDER through getters on a mock
// of the mail switches; no case reads a shipped value of any switch. Every
// club, person and address is made up, and every network address is from
// the ranges set aside for documentation.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { contracts } from '../../domain/contracts'
import { SUGGESTION_FIELD_WORDS, SUGGESTION_LIMITS } from '../../domain/clubs/suggestion'
import { DEFAULT_REPLY_TO } from '../../domain/mail/addresses'
import {
  SUGGEST_CLOSED, SUGGEST_CLUB_BUSY, SUGGEST_NO_CLUB, onRequestPost as suggestPost,
} from '../../functions/api/clubs/[id]/reports'
import {
  ALREADY_HANDLED, NOT_THIS_CLUBS, NO_ADDRESS, SUGGESTIONS_CLOSED, onRequestPost as resolvePost,
} from '../../functions/api/admin/clubs/[id]/reports/[reportId]'
import { REPLY_NOT_SENT, REPLY_SECOND_FACTOR } from '../../functions/api/clubs/reply/[token]'
import { SUGGESTION_NOT_SENT_LOG } from '../../functions/utils/clubs/suggestions'
import { ADDRESS_HEADER, CANT_SEND_NOW, TOO_MANY } from '../../functions/utils/rateLimit'
import type { Env } from '../../functions/types'
import { seedMember } from './factories'
import { emailBehavior, emailOutbox, expectContract, invoke, resetHarness, spamCheckBehavior } from './harness'
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
  SIGNING_SECRET: 'example-made-up-signing-key-for-suggestions-0028',
  TURNSTILE_SECRET_KEY: 'example-made-up-spam-check-secret-0028',
}
const SITE = 'https://www.louisianachess.org'

let seq = 0
const mark = () => `${++seq}${crypto.randomUUID().slice(0, 6)}`
/** A made-up place of its own for each call that needs one, from 198.51.100.0/24 and 203.0.113.0/24. */
const place = () => (++seq % 2 === 0 ? `198.51.100.${seq % 250}` : `203.0.113.${seq % 250}`)

beforeEach(() => {
  resetHarness()
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
interface MadeClub { id: string; slug: string; name: string; region: string; rep: Person | null; reps: Person[] }

/** A seat over the region, held now by the member. */
async function giveSeat(region: string, memberId: string, ended = false): Promise<void> {
  const seat = `seat-${mark()}`
  await env.DB.prepare(
    `INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active) VALUES (?, 'Example Region Representative', '', 99, ?, 'regional_rep', 1)`,
  ).bind(seat, seat).run()
  await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(seat, region).run()
  await env.DB.prepare(`INSERT INTO board_seat_assignments (seat_id, member_id${ended ? ', ended_at' : ''}) VALUES (?, ?${ended ? ", datetime('now')" : ''})`)
    .bind(seat, memberId).run()
}

/** A club with a slug, in a region of its own, with a rep of its own or none, and that many region representatives. */
async function makeClub(opts: { rep?: boolean; reps?: number; vacantSeat?: boolean } = {}): Promise<MadeClub> {
  const m = mark()
  const club = { id: `club-${m}`, slug: `example-knights-club-${m}`, name: `Example Knights Club ${m}`, region: `Example Region ${m}` }
  await env.DB.prepare(
    `INSERT INTO clubs (id, name, city, slug, region, contact_email, about_text, how_we_meet_text) VALUES (?, ?, 'Example City', ?, ?, ?, 'A made up club.', 'Tuesdays at 7:00 PM')`,
  ).bind(club.id, club.name, club.slug, club.region, `club-${m}@example.org`).run()
  let rep: Person | null = null
  if (opts.rep) {
    rep = { id: '', name: `Example Club Rep ${m}`, email: `club-rep-${m}@example.org` }
    rep.id = await seedMember({ fullName: rep.name, email: rep.email, role: 'club_rep', clubId: club.id })
  }
  const reps: Person[] = []
  for (let i = 0; i < (opts.reps ?? 0); i++) {
    const person = { id: '', name: `Example Rep ${m} ${i}`, email: `rep-${m}-${i}@example.org` }
    person.id = await seedMember({ fullName: person.name, email: person.email })
    await giveSeat(club.region, person.id)
    reps.push(person)
  }
  if (opts.vacantSeat) {
    const former = await seedMember({ email: `former-${m}@example.org` })
    await giveSeat(club.region, former, true)
  }
  return { ...club, rep, reps }
}

/** An LCA admin of the case's own, and the only one on file, so the emails to the admins stay few. */
async function onlyAdmin(): Promise<Person> {
  await env.DB.prepare(`UPDATE members SET role = 'member' WHERE role = 'lca_admin'`).run()
  const m = mark()
  const person = { id: '', name: `Example Admin ${m}`, email: `admin-${m}@example.org` }
  person.id = await seedMember({ fullName: person.name, email: person.email, role: 'lca_admin' })
  return person
}

/** What a visitor sends, made up. */
function suggestion(over: Record<string, unknown> = {}) {
  const m = mark()
  return { field: 'venue', message: `Player One ${m} says the club moved to the Example Library.`, email: `player-${m}@example.org`, token: 'example-made-up-token', ...over }
}

const suggest = (part: string, body: unknown, opts: { address?: string; over?: Partial<Env>; as?: string } = {}) =>
  invoke(suggestPost, {
    method: 'POST',
    params: { id: part },
    body,
    env: opts.over ?? KEYED,
    path: `/api/clubs/${part}/reports`,
    headers: { [ADDRESS_HEADER]: opts.address ?? place() },
    as: opts.as,
  })

const resolve = (clubId: string, reportId: number | string, body: unknown, opts: { as?: string; aal?: 'aal1' | 'aal2'; over?: Partial<Env> } = {}) =>
  invoke(resolvePost, {
    method: 'POST',
    params: { id: clubId, reportId: String(reportId) },
    body,
    env: opts.over ?? KEYED,
    path: `/api/admin/clubs/${clubId}/reports/${reportId}`,
    headers: { [ADDRESS_HEADER]: place() },
    as: opts.as,
    aal: opts.aal,
  })

const sendContract = contracts['clubs/[id]/reports'].POST
const resolveContract = contracts['admin/clubs/[id]/reports/[reportId]'].POST

interface Row {
  id: number
  club_id: string
  kind: string
  field: string
  message: string
  proposed_json: string | null
  region: string | null
  reporter_email: string | null
  status: string
  resolved_by: string | null
  resolved_at: string | null
  escalated_at: string | null
}
const rowsOf = async (clubId: string) =>
  (await env.DB.prepare('SELECT * FROM club_reports WHERE club_id = ? ORDER BY id').bind(clubId).all<Row>()).results

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

/** Whether any row of any table holds the words, in any column. */
async function anyTableHolds(words: string): Promise<string[]> {
  const found: string[] = []
  for (const name of Object.keys(await tableCounts())) {
    const { results } = await env.DB.prepare(`SELECT * FROM "${name}"`).all<Record<string, unknown>>()
    if (results.some((row) => JSON.stringify(row).includes(words))) found.push(name)
  }
  return found
}

/** Every line written to the console while the work runs, each argument as text. */
async function logsOf(work: () => Promise<void>): Promise<string[]> {
  const lines: string[] = []
  for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => { lines.push(args.map((a) => (a instanceof Error ? a.message : typeof a === 'string' ? a : JSON.stringify(a))).join(' ')) })
  }
  await work()
  return lines
}

/** The cases that send to several people wait the pause between emails, so they are given longer. */
const SLOW = 30_000

describe('403 with the constant unset', () => {
  it('answers the closed 403 in words before anything is read, and writes nothing', async () => {
    flags.keepersOn = true
    const club = await makeClub({ rep: true })
    const counting = countingDb()
    const before = await tableCounts()
    const result = await invoke(suggestPost, {
      method: 'POST', params: { id: club.slug }, body: suggestion(), env: { ...KEYED, DB: counting.db }, path: `/api/clubs/${club.slug}/reports`,
      headers: { [ADDRESS_HEADER]: place() },
    })
    expect(result.status).toBe(403)
    expect(await result.json()).toEqual({ error: SUGGEST_CLOSED })
    expect(counting.ran).toEqual([])
    expect(grown(before, await tableCounts())).toEqual([])
    expect(emailOutbox).toEqual([])
  })

  it('the keeper\'s answer answers its closed 403 while CLUB_KEEPERS_ON is unset, before the sign-in is read', async () => {
    const admin = await onlyAdmin()
    const counting = countingDb()
    const result = await invoke(resolvePost, {
      method: 'POST', params: { id: 'club-x', reportId: '1' }, body: { action: 'dismiss' }, env: { ...KEYED, DB: counting.db },
      path: '/api/admin/clubs/club-x/reports/1', as: admin.id,
    })
    expect(result.status).toBe(403)
    expect(await result.json()).toEqual({ error: SUGGESTIONS_CLOSED })
    expect(counting.ran).toEqual([])
  })
})

describe('where a suggestion goes', () => {
  it('reaches the club\'s rep when it has one, with a link to Your club\'s page and no address of the visitor', async () => {
    flags.pagesOn = true
    const club = await makeClub({ rep: true, reps: 1 })
    const words = suggestion()
    const result = await suggest(club.slug, words)
    expect(result.status).toBe(200)
    expect(await expectContract(result, sendContract.response)).toEqual({ sent: true })
    const [row] = await rowsOf(club.id)
    expect(emailOutbox.map((e) => e.to)).toEqual([club.rep!.email])
    const [mail] = emailOutbox
    expect(mail.subject).toBe(`A suggestion for ${club.name}'s listing on the LCA website`)
    expect(mail.text).toContain('It came to you as the club\'s representative.')
    expect(mail.text).toContain('What changed: Venue or address')
    expect(mail.text).toContain(words.message)
    expect(mail.text).toContain('They left an email address, so you can reply to them from the site.')
    expect(mail.text).toContain(`${SITE}/my/club/${club.slug}#suggestion-${row.id}`)
    expect(mail.html).toContain('A reply to this email goes to the Louisiana Chess Association, not to the person who wrote.')
    expect(`${mail.subject}${mail.html}${mail.text}`).not.toContain(words.email)
  })

  it('else the region\'s representative, one email to each, each with the club\'s page in My region', async () => {
    flags.pagesOn = true
    const club = await makeClub({ reps: 2 })
    const words = suggestion({ field: 'meets' })
    expect((await suggest(club.slug, words)).status).toBe(200)
    const [row] = await rowsOf(club.id)
    expect(emailOutbox.map((e) => e.to).sort()).toEqual(club.reps.map((r) => r.email).sort())
    for (const rep of club.reps) {
      const mail = emailOutbox.find((e) => e.to === rep.email)!
      expect(mail.text).toContain(`It came to you as the ${club.region} representative.`)
      expect(mail.text).toContain('What changed: Meeting day or time')
      expect(mail.text).toContain(`${SITE}/workspace/region/clubs/${club.id}#suggestion-${row.id}`)
      for (const other of club.reps.filter((r) => r !== rep)) expect(`${mail.html}${mail.text}`).not.toContain(other.email)
      expect(`${mail.html}${mail.text}`).not.toContain(words.email)
    }
  }, SLOW)

  it('else the LCA admins while the seat is open, with the admin club page', async () => {
    flags.pagesOn = true
    const club = await makeClub({ vacantSeat: true })
    const admin = await onlyAdmin()
    expect((await suggest(club.slug, suggestion({ email: '' }))).status).toBe(200)
    const [row] = await rowsOf(club.id)
    expect(emailOutbox.map((e) => e.to)).toEqual([admin.email])
    expect(emailOutbox[0].text).toContain('It came to you as an LCA admin, since the club has no representative and no one holds its region\'s seat.')
    expect(emailOutbox[0].text).toContain(`${SITE}/admin/clubs/${club.id}#suggestion-${row.id}`)
    expect(emailOutbox[0].text).toContain('They left no email address, so there is no one to reply to.')
    expect(row.reporter_email).toBeNull()
  })

  it('goes on to the next keeper when no address takes it, and is saved and answered Sent. when none does', async () => {
    flags.pagesOn = true
    const club = await makeClub({ rep: true, reps: 1 })
    const admin = await onlyAdmin()
    emailBehavior.succeed = false
    emailBehavior.failFor = [club.rep!.email]
    const logs = await logsOf(async () => { expect((await suggest(club.slug, suggestion())).status).toBe(200) })
    expect(emailOutbox.map((e) => e.to)).toEqual([club.reps[0].email])
    expect(logs).toEqual([SUGGESTION_NOT_SENT_LOG])
    // A club with a rep whose address took nothing and an open seat: the admins are told it could not reach the
    // club's keepers, never that the club has no representative.
    emailOutbox.length = 0
    const unreached = await makeClub({ rep: true, vacantSeat: true })
    emailBehavior.failFor = [unreached.rep!.email]
    expect((await suggest(unreached.slug, suggestion())).status).toBe(200)
    expect(emailOutbox.map((e) => e.to)).toEqual([admin.email])
    expect(emailOutbox[0].text).toContain('It came to you as an LCA admin, since it could not reach the club\'s keepers.')
    expect(emailOutbox[0].text).not.toContain('has no representative')
    // Every keeper refused: the suggestion is saved all the same and the visitor told it went.
    emailOutbox.length = 0
    emailBehavior.failFor = [club.rep!.email, club.reps[0].email, admin.email]
    const words = suggestion()
    const result = await suggest(club.slug, words)
    expect(result.status).toBe(200)
    expect(await result.json()).toEqual({ sent: true })
    expect(emailOutbox).toEqual([])
    expect((await rowsOf(club.id)).map((r) => r.message)).toContain(words.message)
  }, SLOW)
})

describe('what the row holds', () => {
  it('holds the least, the same for a signed-in sender, grows no table but its own and the limiter\'s, and logs nothing, in each state of the mail switches', async () => {
    for (const [listsOn, sender] of [[false, 'resend'], [true, 'resend'], [true, 'ses']] as const) {
      resetHarness()
      flags.pagesOn = true
      flags.listsOn = listsOn
      flags.sender = sender
      const club = await makeClub({ rep: true })
      const member = await seedMember({ email: `member-${mark()}@example.org`, fullName: 'Player Two' })
      const before = await tableCounts()
      const words = suggestion()
      const signedIn = suggestion({ field: 'cost', email: undefined })
      const logs = await logsOf(async () => {
        expect((await suggest(club.slug, words)).status, sender).toBe(200)
        expect((await suggest(club.slug, signedIn, { as: member })).status, sender).toBe(200)
      })
      vi.restoreAllMocks()
      expect(grown(before, await tableCounts()).sort(), `${listsOn} ${sender}`).toEqual(['club_reports', 'rate_limits'])
      expect(emailOutbox.map((e) => e.to), sender).toEqual([club.rep!.email, club.rep!.email])
      const [first, second] = await rowsOf(club.id)
      expect(first).toMatchObject({
        club_id: club.id, kind: 'suggestion', field: 'venue', message: words.message, proposed_json: null, region: club.region,
        reporter_email: words.email, status: 'open', resolved_by: null, resolved_at: null, escalated_at: null,
      })
      // A signed-in sender's row holds no more than anyone's: no member id, no name, no address of the account.
      expect(second).toMatchObject({ field: 'cost', message: signedIn.message, reporter_email: null, resolved_by: null })
      expect(JSON.stringify(second)).not.toContain(member)
      expect(await anyTableHolds(member)).toEqual(['members'])
      for (const line of logs) {
        expect(line).not.toContain(words.message)
        expect(line).not.toContain(words.email)
      }
    }
  }, 60_000)
})

describe('rate limit and spam check', () => {
  it('refuses in words in the relay\'s order: the body, the limit by place, the spam check, the club, the limit by club', async () => {
    flags.pagesOn = true
    const club = await makeClub({ rep: true })
    const before = await tableCounts()
    // The body, beside each field.
    const bad = await suggest(club.slug, { message: 'x'.repeat(SUGGESTION_LIMITS.message + 1), email: 'not an address', token: 't' })
    expect(bad.status).toBe(400)
    expect((await bad.json<{ fields: Record<string, string> }>()).fields).toEqual({
      field: SUGGESTION_FIELD_WORDS.fieldMissing, message: SUGGESTION_FIELD_WORDS.messageLong, email: SUGGESTION_FIELD_WORDS.emailForm,
    })
    const empty = await suggest(club.slug, { field: 'other', message: '   ', token: 't' })
    expect((await empty.json<{ fields: Record<string, string> }>()).fields).toEqual({ message: SUGGESTION_FIELD_WORDS.messageMissing })
    // The spam check says no.
    spamCheckBehavior.answer = 'fail'
    const spam = await suggest(club.slug, suggestion())
    expect(spam.status).toBe(403)
    expect(await spam.json()).toEqual({ error: CANT_SEND_NOW })
    spamCheckBehavior.answer = 'pass'
    // A club that is not there, after the spam check.
    const none = await suggest('no-such-club-anywhere', suggestion())
    expect(none.status).toBe(404)
    expect(await none.json()).toEqual({ error: SUGGEST_NO_CLUB })
    // Five an hour from one place, the sixth refused before the spam check is asked.
    const here = place()
    for (let i = 0; i < 5; i++) expect((await suggest(club.slug, suggestion(), { address: here })).status).toBe(200)
    const sixth = await suggest(club.slug, suggestion(), { address: here })
    expect(sixth.status).toBe(429)
    expect(await sixth.json()).toEqual({ error: TOO_MANY })
    expect((await rowsOf(club.id))).toHaveLength(5)
    expect(grown(before, await tableCounts()).sort()).toEqual(['club_reports', 'rate_limits'])
  }, SLOW)

  it('refuses the twenty-first to one club in an hour in words of its own, counted only after the spam check', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    await onlyAdmin()
    // Refused by the spam check: never counted against the club.
    spamCheckBehavior.answer = 'fail'
    for (let i = 0; i < 3; i++) expect((await suggest(club.slug, suggestion())).status).toBe(403)
    spamCheckBehavior.answer = 'pass'
    for (let i = 0; i < 20; i++) expect((await suggest(club.slug, suggestion())).status).toBe(200)
    const busy = await suggest(club.slug, suggestion())
    expect(busy.status).toBe(429)
    expect(await busy.json()).toEqual({ error: SUGGEST_CLUB_BUSY })
    expect(await rowsOf(club.id)).toHaveLength(20)
  }, 60_000)

  it('answers 503 in words with no signing key, and saves nothing', async () => {
    flags.pagesOn = true
    const club = await makeClub({ rep: true })
    const result = await suggest(club.slug, suggestion(), { over: { TURNSTILE_SECRET_KEY: KEYED.TURNSTILE_SECRET_KEY, SIGNING_SECRET: '' } })
    expect(result.status).toBe(503)
    expect(await rowsOf(club.id)).toEqual([])
    expect(emailOutbox).toEqual([])
  })
})

/** A saved suggestion's id, for the club, sent as a visitor would. */
async function saved(club: MadeClub, over: Record<string, unknown> = {}): Promise<{ id: number; words: ReturnType<typeof suggestion> }> {
  const words = suggestion(over)
  expect((await suggest(club.slug, words)).status).toBe(200)
  const rows = await rowsOf(club.id)
  return { id: rows[rows.length - 1].id, words }
}

describe('apply, answer and dismiss, by a keeper only', () => {
  it('lets in the club\'s rep, the region\'s representative and an LCA admin, and no one else', async () => {
    flags.pagesOn = true
    flags.keepersOn = true
    const club = await makeClub({ rep: true, reps: 1 })
    const other = await makeClub({ rep: true, reps: 1 })
    const admin = await onlyAdmin()
    const member = await seedMember({ email: `member-${mark()}@example.org` })
    const guest = await seedMember({ role: 'guest', email: `guest-${mark()}@example.org` })
    await giveSeat(club.region, guest)
    const refused: Array<[string | undefined, number]> = [
      [undefined, 401], [member, 403], [guest, 403], [other.rep!.id, 403], [other.reps[0].id, 403],
    ]
    const { id } = await saved(club)
    for (const [as, status] of refused) {
      const result = await resolve(club.id, id, { action: 'dismiss' }, { as })
      expect(result.status, String(as)).toBe(status)
      expect(JSON.stringify(await result.json())).not.toContain('@')
    }
    expect((await rowsOf(club.id))[0].status).toBe('open')
    // Each keeper is let in: the club's rep applies, the region's representative dismisses, an admin with a second factor applies.
    const second = await saved(club)
    const third = await saved(club)
    for (const [as, reportId, action, status, aal] of [
      [club.rep!.id, id, 'apply', 'applied', 'aal1'],
      [club.reps[0].id, second.id, 'dismiss', 'dismissed', 'aal1'],
      [admin.id, third.id, 'apply', 'applied', 'aal2'],
    ] as const) {
      const result = await resolve(club.id, reportId, { action }, { as, aal })
      expect(result.status, as).toBe(200)
      expect(await expectContract(result, resolveContract.response)).toEqual({ id: reportId, status })
    }
    const rows = await rowsOf(club.id)
    expect(rows.map((r) => [r.status, r.resolved_by, r.reporter_email])).toEqual([
      ['applied', club.rep!.id, null], ['dismissed', club.reps[0].id, null], ['applied', admin.id, null],
    ])
    for (const row of rows) expect(row.resolved_at).toMatch(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/)
    // An LCA admin with no second factor may apply and dismiss, and is asked one only to answer as LCA.
    const fourth = await saved(club)
    const asked = await resolve(club.id, fourth.id, { action: 'answer', message: 'Example answer.' }, { as: admin.id, aal: 'aal1' })
    expect(asked.status).toBe(403)
    expect(await asked.json()).toEqual({ error: REPLY_SECOND_FACTOR })
    expect((await rowsOf(club.id)).at(-1)?.reporter_email).toBe(fourth.words.email)
    expect((await resolve(club.id, fourth.id, { action: 'dismiss' }, { as: admin.id, aal: 'aal1' })).status).toBe(200)
  }, SLOW)

  it('writes one audit entry each, naming the club, the row and the action, and none of the visitor\'s words or an address', async () => {
    flags.pagesOn = true
    flags.keepersOn = true
    const club = await makeClub({ rep: true })
    const { id, words } = await saved(club)
    expect((await resolve(club.id, id, { action: 'dismiss' }, { as: club.rep!.id })).status).toBe(200)
    const entries = (await env.DB.prepare(`SELECT * FROM admin_audit_log WHERE action = 'club_suggestion_resolved' AND target_label = ?`).bind(club.name).all<Record<string, string>>()).results
    expect(entries).toHaveLength(1)
    expect(JSON.parse(entries[0].detail)).toEqual({ clubId: club.id, reportId: id, action: 'dismissed' })
    expect(JSON.stringify(entries[0])).not.toContain(words.message)
    expect(JSON.stringify(entries[0])).not.toContain(words.email)
  })

  it('refuses another club\'s row, another kind, a row already handled, and an answer with no address, each in words', async () => {
    flags.pagesOn = true
    flags.keepersOn = true
    const club = await makeClub({ rep: true })
    const other = await makeClub({ rep: true })
    const { id } = await saved(club)
    const theirs = await saved(other)
    const notOurs = await resolve(club.id, theirs.id, { action: 'dismiss' }, { as: club.rep!.id })
    expect(notOurs.status).toBe(404)
    expect(await notOurs.json()).toEqual({ error: NOT_THIS_CLUBS })
    const newClub = await env.DB.prepare(`INSERT INTO club_reports (club_id, kind, message, region) VALUES (NULL, 'new_club', 'Example new club.', ?) RETURNING id`).bind(club.region).first<{ id: number }>()
    expect((await resolve(club.id, newClub!.id, { action: 'dismiss' }, { as: club.rep!.id })).status).toBe(404)
    expect((await resolve(club.id, 'not-a-number', { action: 'dismiss' }, { as: club.rep!.id })).status).toBe(404)
    expect((await resolve(club.id, id, { action: 'dismiss' }, { as: club.rep!.id })).status).toBe(200)
    const again = await resolve(club.id, id, { action: 'apply' }, { as: club.rep!.id })
    expect(again.status).toBe(409)
    expect(await again.json()).toEqual({ error: ALREADY_HANDLED })
    const quiet = await saved(club, { email: undefined })
    const noAddress = await resolve(club.id, quiet.id, { action: 'answer', message: 'Example answer.' }, { as: club.rep!.id })
    expect(noAddress.status).toBe(400)
    expect(await noAddress.json()).toEqual({ error: NO_ADDRESS })
    const emptyAnswer = await resolve(club.id, quiet.id, { action: 'answer', message: '  ' }, { as: club.rep!.id })
    expect(emptyAnswer.status).toBe(400)
    expect((await rowsOf(club.id)).at(-1)?.status).toBe('open')
  })

  it('of two keepers pressing at once, one wins and the other is told it was already handled', async () => {
    flags.pagesOn = true
    flags.keepersOn = true
    const club = await makeClub({ rep: true, reps: 1 })
    const { id } = await saved(club)
    const [a, b] = await Promise.all([
      resolve(club.id, id, { action: 'apply' }, { as: club.rep!.id }),
      resolve(club.id, id, { action: 'dismiss' }, { as: club.reps[0].id }),
    ])
    expect([a.status, b.status].sort()).toEqual([200, 409])
    const loser = a.status === 409 ? a : b
    expect(await loser.json()).toEqual({ error: ALREADY_HANDLED })
    expect((await rowsOf(club.id))[0].status).toBe(a.status === 200 ? 'applied' : 'dismissed')
    expect((await env.DB.prepare(`SELECT COUNT(*) AS n FROM admin_audit_log WHERE action = 'club_suggestion_resolved' AND target_label = ?`).bind(club.name).first<{ n: number }>())!.n).toBe(1)
  })
})

describe('the reply is sent and not kept', () => {
  it('goes from LCA\'s own address to the visitor alone, signed by the role, and its words are in no table', async () => {
    flags.pagesOn = true
    flags.keepersOn = true
    const club = await makeClub({ reps: 1 })
    const admin = await onlyAdmin()
    const { id, words } = await saved(club)
    emailOutbox.length = 0
    const before = await tableCounts()
    const reply = `Thanks, Player One. Example reply ${mark()}.`
    const result = await resolve(club.id, id, { action: 'answer', message: reply }, { as: club.reps[0].id, aal: 'aal1' })
    expect(result.status).toBe(200)
    expect(await result.json()).toEqual({ id, status: 'answered' })
    expect(emailOutbox.map((e) => e.to)).toEqual([words.email])
    const [mail] = emailOutbox
    expect(mail.subject).toBe(`An answer to your message to ${club.name}`)
    expect(mail.text).toContain(reply)
    expect(mail.text).toContain(`LCA ${club.region} representative`)
    expect(mail.text).toContain(`To write to ${club.name} again, use the club's page: ${SITE}/clubs/${club.slug}`)
    expect(`${mail.html}${mail.text}`).not.toContain(club.reps[0].email)
    expect(`${mail.html}${mail.text}`).not.toContain(club.reps[0].name)
    expect(mail.from).not.toContain(club.reps[0].email)
    // Kept nowhere: no table grows but the limiter's count and the audit entry, and no row of any table holds the words.
    expect(grown(before, await tableCounts()).sort()).toEqual(['admin_audit_log', 'rate_limits'])
    expect(await anyTableHolds(reply)).toEqual([])
    expect((await rowsOf(club.id))[0]).toMatchObject({ status: 'answered', reporter_email: null, resolved_by: club.reps[0].id })
    // An LCA admin with a second factor signs as the association.
    const next = await saved(club)
    emailOutbox.length = 0
    expect((await resolve(club.id, next.id, { action: 'answer', message: 'Example answer from LCA.' }, { as: admin.id, aal: 'aal2' })).status).toBe(200)
    expect(emailOutbox[0].text).toContain('Louisiana Chess Association')
    expect(emailOutbox[0].text).not.toContain('representative\n')
  }, SLOW)

  it('is signed by the club\'s own rep as the club\'s representative, naming nobody, with LCA\'s own reply-to', async () => {
    flags.pagesOn = true
    flags.keepersOn = true
    const club = await makeClub({ rep: true })
    const { id, words } = await saved(club)
    emailOutbox.length = 0
    expect((await resolve(club.id, id, { action: 'answer', message: 'Example answer.' }, { as: club.rep!.id, aal: 'aal1' })).status).toBe(200)
    expect(emailOutbox.map((e) => e.to)).toEqual([words.email])
    expect(emailOutbox[0].text).toContain(`${club.name} representative`)
    expect(emailOutbox[0].text).not.toContain(club.rep!.name)
    expect(DEFAULT_REPLY_TO).not.toContain(club.rep!.email)
  })

  it('puts the row back as it was when the mail does not go, and logs fixed words alone', async () => {
    flags.pagesOn = true
    flags.keepersOn = true
    const club = await makeClub({ rep: true })
    const { id, words } = await saved(club)
    emailBehavior.succeed = false
    emailBehavior.failFor = [words.email]
    const logs = await logsOf(async () => {
      const result = await resolve(club.id, id, { action: 'answer', message: 'Example answer.' }, { as: club.rep!.id })
      expect(result.status).toBe(503)
      expect(await result.json()).toEqual({ error: REPLY_NOT_SENT })
    })
    expect(logs).toEqual(['Suggest an update: a reply to a visitor was not sent.'])
    expect((await rowsOf(club.id))[0]).toMatchObject({ status: 'open', reporter_email: words.email, resolved_by: null, resolved_at: null })
    emailBehavior.succeed = true
    emailBehavior.failFor = null
    expect((await resolve(club.id, id, { action: 'answer', message: 'Example answer.' }, { as: club.rep!.id })).status).toBe(200)
  })
})
