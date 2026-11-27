// test/integration/club-report-clock-edges.test.ts
//
// The edges of the 14 days (WS09 step 29), beside test/integration/club-report-clock.test.ts
// and in a file of their own: the run's edge across both changes of the clock
// and across midnight in America/Chicago, ties and the oldest first, a club
// with no one to write to, a stale row, two presses at once, a run cut short
// by a thrown error and a press the admin leaves, the do-not-send
// gate read once, and the words of the email for a club with marks in its
// name. CLUB_KEEPERS_ON and CLUB_PAGES_ON are set through getters on a mock of
// their module, and MAIL_LISTS_ON and MAIL_SENDER through getters on a mock of
// the mail switches; no case reads a shipped value. Every club, person,
// address and word is made up.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CLOCK_JOB, CLOCK_NONE_TAKEN_LOG, runReportClock, type ReportClockEnv,
} from '../../functions/utils/clubs/reportClock'
import { onRequestPost as checkPost } from '../../functions/api/admin/clubs/monthly-check'
import { SUGGESTION_ADDRESS_LEFT, SUGGESTION_NO_ADDRESS } from '../../functions/utils/clubs/emails'
import { seedMember } from './factories'
import { emailBehavior, emailOutbox, flushWaitUntil, invoke, resetHarness } from './harness'
import { countingDb } from './mailRuns'

const flags = vi.hoisted(() => ({ pagesOn: false, keepersOn: true, listsOn: false, sender: 'resend' as 'resend' | 'ses' }))
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

const SITE = 'https://www.louisianachess.org'
const DAY = 24 * 60 * 60 * 1000
const FAST = { pauseMs: 0 }
const stampOf = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ')
const msOf = (stamp: string) => Date.parse(`${stamp.replace(' ', 'T')}Z`)
const clockEnv = (db: D1Database = env.DB): ReportClockEnv => ({ ...(env as unknown as ReportClockEnv), DB: db, SITE_URL: SITE })

let seq = 0
const mark = () => `${++seq}${crypto.randomUUID().slice(0, 6)}`

interface Person { id: string; email: string }
interface MadeClub { id: string; slug: string; name: string; region: string; rep: Person | null; reps: Person[] }

async function person(role = 'member', email?: string, clubId?: string): Promise<Person> {
  const m = mark()
  const address = email ?? `player-${m}@example.org`
  const id = await seedMember({ fullName: `Player One ${m}`, email: address, role, clubId: clubId ?? null })
  return { id, email: address }
}

async function giveSeat(region: string, memberId: string): Promise<void> {
  const seat = `seat-${mark()}`
  await env.DB.prepare(
    `INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active) VALUES (?, 'Example Region Representative', '', 99, ?, 'regional_rep', 1)`,
  ).bind(seat, seat).run()
  await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(seat, region).run()
  await env.DB.prepare('INSERT INTO board_seat_assignments (seat_id, member_id) VALUES (?, ?)').bind(seat, memberId).run()
}

async function makeClub(opts: { rep?: boolean; reps?: number; name?: string } = {}): Promise<MadeClub> {
  const m = mark()
  const club = { id: `club-${m}`, slug: `example-knights-club-${m}`, name: opts.name ?? `Example Knights Club ${m}`, region: `Example Region ${m}` }
  await env.DB.prepare(
    `INSERT INTO clubs (id, name, city, slug, region, about_text, how_we_meet_text) VALUES (?, ?, 'Example City', ?, ?, 'A made up club.', 'Tuesdays at 7:00 PM')`,
  ).bind(club.id, club.name, club.slug, club.region).run()
  const rep = opts.rep ? await person('club_rep', undefined, club.id) : null
  const reps: Person[] = []
  for (let i = 0; i < (opts.reps ?? 0); i++) {
    const holder = await person()
    await giveSeat(club.region, holder.id)
    reps.push(holder)
  }
  return { ...club, rep, reps }
}

async function onlyAdmins(n = 1): Promise<Person[]> {
  await env.DB.prepare(`UPDATE members SET role = 'member' WHERE role = 'lca_admin'`).run()
  const admins: Person[] = []
  for (let i = 0; i < n; i++) admins.push(await person('lca_admin'))
  return admins
}

async function suggest(club: MadeClub, opts: { createdAt: string; status?: string; email?: string | null; message?: string; passedOn?: string }): Promise<{ id: number; message: string; email: string | null }> {
  const m = mark()
  const message = opts.message ?? `Player Two ${m} says the club now meets at the Example Library.`
  const email = opts.email === undefined ? `visitor-${m}@example.org` : opts.email
  const row = await env.DB.prepare(
    `INSERT INTO club_reports (club_id, kind, field, message, region, reporter_email, status, created_at, escalated_at)
     VALUES (?, 'suggestion', 'venue', ?, ?, ?, ?, ?, ?) RETURNING id`,
  ).bind(club.id, message, club.region, email, opts.status ?? 'open', opts.createdAt, opts.passedOn ?? null).first<{ id: number }>()
  return { id: Number(row!.id), message, email }
}

const escalatedAt = async (id: number) => (await env.DB.prepare('SELECT escalated_at FROM club_reports WHERE id = ?').bind(id).first<{ escalated_at: string | null }>())!.escalated_at
const runRows = async () => (await env.DB.prepare('SELECT outcome, detail FROM automation_runs WHERE job = ? ORDER BY id').bind(CLOCK_JOB).all<{ outcome: string; detail: string | null }>()).results
const mailTo = (address: string) => emailOutbox.filter((e) => e.to === address)

function logLines(): string[] {
  const lines: string[] = []
  for (const level of ['log', 'warn', 'error', 'info'] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => { lines.push(args.map(String).join(' ')) })
  }
  return lines
}

beforeEach(async () => {
  resetHarness()
  flags.pagesOn = false
  flags.keepersOn = true
  flags.listsOn = false
  flags.sender = 'resend'
  await env.DB.batch([
    env.DB.prepare('DELETE FROM board_seat_assignments'),
    env.DB.prepare('DELETE FROM automation_runs'),
    env.DB.prepare('DELETE FROM mail_do_not_send'),
    env.DB.prepare("DELETE FROM club_reports WHERE kind = 'suggestion'"),
  ])
})
afterEach(() => {
  vi.restoreAllMocks()
})

/**
 * A suggestion sent at `sentAt` (a stored UTC stamp): one second before the 14 whole days of 24 hours are up nothing is
 * due and nothing is written, and at the very second they are up it is passed on, once.
 */
async function edgeAt(sentAt: string): Promise<void> {
  const club = await makeClub()
  const s = await suggest(club, { createdAt: sentAt })
  const due = msOf(sentAt) + 14 * DAY
  const before = await runReportClock(clockEnv(), new Date(due - 1000), FAST)
  expect(before, `${sentAt} one second early`).toMatchObject({ stopped: 'nothing_due', sent: 0 })
  expect(await escalatedAt(s.id), `${sentAt} one second early`).toBeNull()
  const on = await runReportClock(clockEnv(), new Date(due), FAST)
  expect(on, `${sentAt} on the second`).toMatchObject({ stopped: null, due: 1, passedOn: 1 })
  expect(await escalatedAt(s.id)).toBe(stampOf(due))
}

describe('the edge of the 14 days in a run, in America/Chicago', () => {
  it('is 14 whole days of 24 hours across the fall back on Sunday, November 1, 2026', async () => {
    await onlyAdmins(1)
    // Sent on Sunday, October 25, at 1:00 PM in Chicago (CDT); 14 days of 24 hours later it is 12:00 PM in Chicago (CST).
    await edgeAt('2026-10-25 18:00:00')
    expect(emailOutbox).toHaveLength(1)
  })

  it('is 14 whole days of 24 hours across the spring forward on Sunday, March 8, 2026', async () => {
    await onlyAdmins(1)
    // Sent on Sunday, March 1, at 12:00 PM in Chicago (CST); 14 days of 24 hours later it is 1:00 PM in Chicago (CDT).
    await edgeAt('2026-03-01 18:00:00')
    expect(emailOutbox).toHaveLength(1)
  })

  it('does not move at midnight in Chicago, a second before it or at it', async () => {
    await onlyAdmins(1)
    // 11:59:59 PM on Monday, November 9 in Chicago, and 12:00 AM on Tuesday, November 10.
    await edgeAt('2026-11-10 05:59:59')
    await edgeAt('2026-11-10 06:00:00')
    expect(emailOutbox).toHaveLength(2)
  })

  it('is the same on the run\'s own clock whatever hour it comes at: 13 days and 23 hours waits, 14 days and a minute goes', async () => {
    await onlyAdmins(1)
    const club = await makeClub()
    const sent = '2026-11-09 18:00:00'
    const s = await suggest(club, { createdAt: sent })
    expect(await runReportClock(clockEnv(), new Date(msOf(sent) + 14 * DAY - 60 * 60 * 1000), FAST)).toMatchObject({ stopped: 'nothing_due' })
    expect(await runRows()).toEqual([])
    expect(await runReportClock(clockEnv(), new Date(msOf(sent) + 14 * DAY + 60 * 1000), FAST)).toMatchObject({ passedOn: 1 })
    expect(await escalatedAt(s.id)).not.toBeNull()
    expect(mailTo((await env.DB.prepare(`SELECT email FROM members WHERE role = 'lca_admin' LIMIT 1`).first<{ email: string }>())!.email)[0].text).toContain('Waiting: 14 days')
  })
})

describe('ties and the oldest first', () => {
  it('two suggestions sent at the same second: the earlier row goes first and the other waits for the next run', async () => {
    await onlyAdmins(1)
    // Each costs six emails (five representatives and the admin), so only one fits in ten.
    const a = await makeClub({ rep: true, reps: 5 })
    const b = await makeClub({ rep: true, reps: 5 })
    const first = await suggest(a, { createdAt: '2026-11-09 18:00:00' })
    const second = await suggest(b, { createdAt: '2026-11-09 18:00:00' })
    const now = new Date(msOf('2026-11-09 18:00:00') + 14 * DAY)
    expect(await runReportClock(clockEnv(), now, FAST)).toMatchObject({ due: 2, passedOn: 1, sent: 6, notReached: 1 })
    expect(await escalatedAt(first.id)).not.toBeNull()
    expect(await escalatedAt(second.id)).toBeNull()
    emailOutbox.length = 0
    expect(await runReportClock(clockEnv(), new Date(now.getTime() + DAY), FAST)).toMatchObject({ due: 1, passedOn: 1, sent: 6, notReached: 0 })
    expect(await escalatedAt(second.id)).not.toBeNull()
  })

  it('the longest waiting is mailed first, though it was written to the table last', async () => {
    await onlyAdmins(1)
    const newer = await makeClub({ name: 'Example Newer Club' })
    const older = await makeClub({ name: 'Example Older Club' })
    await suggest(newer, { createdAt: '2026-11-09 18:00:00' })
    await suggest(older, { createdAt: '2026-11-02 18:00:00' })
    await runReportClock(clockEnv(), new Date(msOf('2026-11-09 18:00:00') + 14 * DAY), FAST)
    expect(emailOutbox.map((e) => e.subject)).toEqual([
      'A suggestion for Example Older Club\'s listing is still waiting',
      'A suggestion for Example Newer Club\'s listing is still waiting',
    ])
  })
})

describe('no one to write to, and stale rows', () => {
  const now = new Date(msOf('2026-11-09 18:00:00') + 14 * DAY)

  it('a club with no keeper and no LCA admin on file: nothing is sent or claimed, no error, and it stays due', async () => {
    await onlyAdmins(0)
    const s = await suggest(await makeClub(), { createdAt: '2026-11-09 18:00:00' })
    const lines = logLines()
    expect(await runReportClock(clockEnv(), now, FAST)).toMatchObject({ stopped: null, due: 1, passedOn: 0, sent: 0, notSent: 0 })
    expect(emailOutbox).toEqual([])
    expect(await escalatedAt(s.id)).toBeNull()
    expect(lines).toEqual([CLOCK_NONE_TAKEN_LOG])
    // Once someone is an LCA admin, the next run passes it on.
    const [admin] = await onlyAdmins(1)
    expect(await runReportClock(clockEnv(), new Date(now.getTime() + DAY), FAST)).toMatchObject({ passedOn: 1, sent: 1 })
    expect(mailTo(admin.email)).toHaveLength(1)
  })

  it('the visitor\'s own address is never written to, even where it is the only LCA admin\'s: it stays due', async () => {
    const [admin] = await onlyAdmins(1)
    const s = await suggest(await makeClub(), { createdAt: '2026-11-09 18:00:00', email: admin.email })
    expect(await runReportClock(clockEnv(), now, FAST)).toMatchObject({ due: 1, passedOn: 0, sent: 0 })
    expect(emailOutbox).toEqual([])
    expect(await escalatedAt(s.id)).toBeNull()
  })

  it('an older suggestion with no one to write to does not hold back a later one that needs more than ten emails', async () => {
    const [admin] = await onlyAdmins(1)
    const none = await suggest(await makeClub(), { createdAt: '2026-11-01 18:00:00', email: admin.email })
    const big = await suggest(await makeClub({ rep: true, reps: 11 }), { createdAt: '2026-11-09 18:00:00' })
    // The older one costs no email, so the later one is still the first that costs any, and goes whole: 11 and the admin.
    expect(await runReportClock(clockEnv(), now, FAST)).toMatchObject({ due: 2, passedOn: 1, sent: 12, notSent: 0, notReached: 0 })
    expect(await escalatedAt(none.id)).toBeNull()
    expect(await escalatedAt(big.id)).not.toBeNull()
  })

  it('a suggestion already passed on, however old, is not passed on again, and a replay of an old run finds nothing', async () => {
    await onlyAdmins(1)
    const s = await suggest(await makeClub({ rep: true, reps: 1 }), { createdAt: '2026-09-01 18:00:00', passedOn: '2026-09-15 18:00:00' })
    for (const days of [0, 1, 30, 300]) {
      expect(await runReportClock(clockEnv(), new Date(msOf('2026-11-09 18:00:00') + days * DAY), FAST)).toMatchObject({ stopped: 'nothing_due' })
    }
    expect(emailOutbox).toEqual([])
    expect(await runRows()).toEqual([])
    expect(await escalatedAt(s.id)).toBe('2026-09-15 18:00:00')
  })

  it('a club whose rep had it, with no seat holder in its region: the LCA admins alone, and the words say the rep had it first', async () => {
    const [admin] = await onlyAdmins(1)
    const club = await makeClub({ rep: true })
    await suggest(club, { createdAt: '2026-11-09 18:00:00' })
    expect(await runReportClock(clockEnv(), now, FAST)).toMatchObject({ passedOn: 1, sent: 1 })
    expect(mailTo(admin.email)[0].text).toContain('It went first to the club\'s rep.')
    expect(mailTo(club.rep!.email)).toEqual([])
  })
})

describe('two presses at once', () => {
  it('through the endpoint, each person is written to once, and the stamp is the one the winner set', async () => {
    const admins = await onlyAdmins(2)
    const club = await makeClub({ rep: true, reps: 1 })
    const s = await suggest(club, { createdAt: stampOf(Date.now() - 15 * DAY) })
    const press = () => invoke(checkPost, { method: 'POST', as: admins[0].id, body: { action: 'run_report_clock', send: true } })
    const [one, two] = await Promise.all([press(), press()])
    const answers = [await one.json<{ passedOn: number; sent: number }>(), await two.json<{ passedOn: number; sent: number }>()]
    expect(answers[0].passedOn + answers[1].passedOn).toBe(1)
    expect(answers[0].sent + answers[1].sent).toBe(3)
    for (const who of [...admins, ...club.reps]) expect(mailTo(who.email), who.email).toHaveLength(1)
    expect(await escalatedAt(s.id)).not.toBeNull()
    expect((await runRows()).length).toBeGreaterThanOrEqual(1)
  })
})

/** The database, but the claim of the suggestion `id` throws, as a D1 error would. */
function claimThrowsFor(id: number): D1Database {
  return new Proxy(env.DB, {
    get(target, key) {
      if (key !== 'prepare') return Reflect.get(target, key).bind(target)
      return (sql: string) => {
        const statement = target.prepare(sql)
        if (!/SET escalated_at = \?/.test(sql)) return statement
        return new Proxy(statement, {
          get(inner, name) {
            if (name !== 'bind') return Reflect.get(inner, name).bind(inner)
            return (...values: unknown[]) => {
              const bound = inner.bind(...values)
              if (values[1] !== id) return bound
              return { ...bound, run: () => Promise.reject(new Error('D1_ERROR: made up for the test')) } as unknown as D1PreparedStatement
            }
          },
        })
      }
    },
  }) as D1Database
}

describe('a run cut short', () => {
  const now = new Date(msOf('2026-11-09 18:00:00') + 14 * DAY)

  it('a claim none of whose emails was taken is given back though a later claim throws, and the next run sends it', async () => {
    const [admin] = await onlyAdmins(1)
    const first = await suggest(await makeClub(), { createdAt: '2026-11-09 17:00:00' })
    const second = await suggest(await makeClub(), { createdAt: '2026-11-09 18:00:00' })
    logLines()
    emailBehavior.succeed = false
    emailBehavior.status = 422
    expect(await runReportClock(clockEnv(claimThrowsFor(second.id)), now, FAST)).toMatchObject({ stopped: null, passedOn: 0, sent: 0, notSent: 1 })
    expect(await escalatedAt(first.id)).toBeNull()
    expect(await escalatedAt(second.id)).toBeNull()
    expect((await runRows())[0].outcome).toBe('failed')
    emailBehavior.succeed = true
    expect(await runReportClock(clockEnv(), new Date(now.getTime() + DAY), FAST)).toMatchObject({ passedOn: 2, sent: 2 })
    expect(mailTo(admin.email)).toHaveLength(2)
  })

  it('a claim one of whose emails was taken keeps its stamp though a later claim throws', async () => {
    await onlyAdmins(1)
    const first = await suggest(await makeClub(), { createdAt: '2026-11-09 17:00:00' })
    const second = await suggest(await makeClub(), { createdAt: '2026-11-09 18:00:00' })
    logLines()
    expect(await runReportClock(clockEnv(claimThrowsFor(second.id)), now, FAST)).toMatchObject({ passedOn: 1, sent: 1 })
    expect(await escalatedAt(first.id)).toBe(stampOf(now.getTime()))
    expect(await escalatedAt(second.id)).toBeNull()
  })

  it('a press is handed to waitUntil as well as awaited, so it finishes though the admin leaves', async () => {
    const [admin] = await onlyAdmins(1)
    await suggest(await makeClub(), { createdAt: stampOf(Date.now() - 15 * DAY) })
    const handed: Promise<unknown>[] = []
    const answer = await invoke((context) => checkPost({
      ...context,
      waitUntil: (work: Promise<unknown>) => { handed.push(work); context.waitUntil(work) },
    }), { method: 'POST', as: admin.id, body: { action: 'run_report_clock', send: true } })
    expect(answer.status).toBe(200)
    expect(handed).toHaveLength(1)
    await flushWaitUntil()
    expect(await handed[0]).toMatchObject({ passedOn: 1, sent: 1 })
  })
})

describe('the do-not-send gate', () => {
  const now = new Date(msOf('2026-11-09 18:00:00') + 14 * DAY)
  const stop = (address: string) => env.DB.prepare(`INSERT INTO mail_do_not_send (address, reason, detail) VALUES (?, 'bounce', 'General')`).bind(address).run()

  it('with the engine\'s rules on it is read once for the run, an address on it gets none, and the others are sent', async () => {
    flags.listsOn = true
    const admins = await onlyAdmins(3)
    const club = await makeClub({ rep: true, reps: 2 })
    await stop(admins[1].email)
    await stop(club.reps[0].email)
    const s = await suggest(club, { createdAt: '2026-11-09 18:00:00' })
    const { db, ran } = countingDb()
    expect(await runReportClock(clockEnv(db), now, FAST)).toMatchObject({ due: 1, passedOn: 1, sent: 3, notSent: 2 })
    expect(ran.filter((r) => /\bmail_do_not_send\b/.test(r.sql))).toHaveLength(1)
    expect(mailTo(admins[1].email)).toEqual([])
    expect(mailTo(club.reps[0].email)).toEqual([])
    expect(mailTo(admins[0].email)).toHaveLength(1)
    expect(mailTo(club.reps[1].email)).toHaveLength(1)
    expect(await escalatedAt(s.id)).not.toBeNull()
  })

  it('with every address refused nothing is taken: it stays due, with the fixed line, and the next run sends it once the list is cleared', async () => {
    flags.listsOn = true
    const [admin] = await onlyAdmins(1)
    await stop(admin.email)
    const s = await suggest(await makeClub(), { createdAt: '2026-11-09 18:00:00' })
    const lines = logLines()
    expect(await runReportClock(clockEnv(), now, FAST)).toMatchObject({ passedOn: 0, sent: 0, notSent: 1 })
    expect(await escalatedAt(s.id)).toBeNull()
    expect(lines).toContain(CLOCK_NONE_TAKEN_LOG)
    for (const line of lines) expect(line).not.toContain('@')
    await env.DB.prepare('DELETE FROM mail_do_not_send').run()
    expect(await runReportClock(clockEnv(), new Date(now.getTime() + DAY), FAST)).toMatchObject({ passedOn: 1, sent: 1 })
  })

  it('with the engine\'s rules off no mail table is read, and an address on the list is mailed as today', async () => {
    const [admin] = await onlyAdmins(1)
    await stop(admin.email)
    await suggest(await makeClub(), { createdAt: '2026-11-09 18:00:00' })
    const { db, ran } = countingDb()
    expect(await runReportClock(clockEnv(db), now, FAST)).toMatchObject({ passedOn: 1, sent: 1 })
    expect(ran.filter((r) => /\bmail_/.test(r.sql))).toEqual([])
  })
})

describe('the words of the email for what the club and the visitor typed', () => {
  const now = new Date(msOf('2026-11-09 18:00:00') + 14 * DAY)

  it('a club name with marks in it is escaped in the HTML part and plain in the text part', async () => {
    const [admin] = await onlyAdmins(1)
    await suggest(await makeClub({ name: 'Example <Knights> & Rooks Club' }), { createdAt: '2026-11-09 18:00:00' })
    await runReportClock(clockEnv(), now, FAST)
    const [mail] = mailTo(admin.email)
    expect(mail.html).not.toContain('<Knights>')
    expect(mail.html).toContain('Example &lt;Knights&gt; &amp; Rooks Club')
    expect(mail.text).toContain('Example <Knights> & Rooks Club')
  })

  it('a visitor who left no address: the email says so and no address rides anywhere; one who left an address is told it is kept private', async () => {
    const [admin] = await onlyAdmins(1)
    const withNone = await makeClub()
    const withOne = await makeClub()
    await suggest(withNone, { createdAt: '2026-11-09 18:00:00', email: null })
    const typed = await suggest(withOne, { createdAt: '2026-11-09 18:01:00' })
    await runReportClock(clockEnv(), new Date(now.getTime() + 60 * 1000), FAST)
    const [none, kept] = mailTo(admin.email)
    expect(none.text).toContain(SUGGESTION_NO_ADDRESS)
    expect(kept.text).toContain(SUGGESTION_ADDRESS_LEFT)
    for (const mail of [none, kept]) expect(`${mail.subject}${mail.text}${mail.html}`).not.toContain(typed.email!)
  })
})
