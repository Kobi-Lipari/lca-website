// test/integration/club-report-clock.test.ts
//
// The 14 days (WS09 step 29): runReportClock in
// functions/utils/clubs/reportClock.ts on D1 built from the migrations, and
// the LCA admin's second action of POST /api/admin/clubs/monthly-check
// through the real handler. Each case sets CLUB_KEEPERS_ON and CLUB_PAGES_ON
// itself through a getter on a mock of their module, and MAIL_LISTS_ON and
// MAIL_SENDER through getters on a mock of the mail switches; no case reads a
// shipped value of any switch. Each run is handed its own now. Every club,
// person, address and word is made up.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CLOCK_JOB, CLOCK_NONE_TAKEN_LOG, CLOCK_NOT_SENT_LOG, MAX_SENDS, runReportClock, type ReportClockEnv,
} from '../../functions/utils/clubs/reportClock'
import { CHECK_CLOSED, onRequestPost as checkPost } from '../../functions/api/admin/clubs/monthly-check'
import { onRequestGet as regionGet } from '../../functions/api/workspace/region'
import { onRequestDelete as clubDelete, onRequestGet as adminClubGet } from '../../functions/api/admin/clubs/[id]'
import { onRequestDelete as memberDelete } from '../../functions/api/admin/members/[id]'
import { onRequestPost as resolvePost } from '../../functions/api/admin/clubs/[id]/reports/[reportId]'
import { SUGGESTION_FOOTER } from '../../functions/utils/clubs/emails'
import { seedMember } from './factories'
import { emailBehavior, emailOutbox, invoke, resetHarness } from './harness'
import { countingDb, recordHosts } from './mailRuns'

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
/** The moment every suggestion here is sent, unless a case says otherwise: Mon, Nov 9, 2026, 6:00 PM UTC. */
const SENT_AT = '2026-11-09 18:00:00'
const SENT_MS = Date.parse('2026-11-09T18:00:00Z')
const at = (ms: number) => new Date(ms)
const DUE = at(SENT_MS + 14 * DAY)
const FAST = { pauseMs: 0 }
const clockEnv = (db: D1Database = env.DB): ReportClockEnv => ({ ...(env as unknown as ReportClockEnv), DB: db, SITE_URL: SITE })

let seq = 0
const mark = () => `${++seq}${crypto.randomUUID().slice(0, 6)}`

interface Person { id: string; email: string }
interface MadeClub { id: string; slug: string; name: string; region: string; rep: Person | null; reps: Person[] }

/** A made-up person; an address at example.org of their own unless one is given. */
async function person(role = 'member', email?: string, clubId?: string): Promise<Person> {
  const m = mark()
  const address = email ?? `player-${m}@example.org`
  const id = await seedMember({ fullName: `Player One ${m}`, email: address, role, clubId: clubId ?? null })
  return { id, email: address }
}

/** A seat over the region, held now by the member. */
async function giveSeat(region: string, memberId: string): Promise<void> {
  const seat = `seat-${mark()}`
  await env.DB.prepare(
    `INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active) VALUES (?, 'Example Region Representative', '', 99, ?, 'regional_rep', 1)`,
  ).bind(seat, seat).run()
  await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(seat, region).run()
  await env.DB.prepare('INSERT INTO board_seat_assignments (seat_id, member_id) VALUES (?, ?)').bind(seat, memberId).run()
}

/** A club in a region of its own, with a rep of its own or none, and that many region representatives. */
async function makeClub(opts: { rep?: boolean; reps?: number } = {}): Promise<MadeClub> {
  const m = mark()
  const club = { id: `club-${m}`, slug: `example-knights-club-${m}`, name: `Example Knights Club ${m}`, region: `Example Region ${m}` }
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

/** The LCA admins of the case, and the only ones on file. */
async function onlyAdmins(n = 1): Promise<Person[]> {
  await env.DB.prepare(`UPDATE members SET role = 'member' WHERE role = 'lca_admin'`).run()
  const admins: Person[] = []
  for (let i = 0; i < n; i++) admins.push(await person('lca_admin'))
  return admins
}

/** A visitor's suggestion for the club, open unless a status is given, sent at the moment given. */
async function suggest(club: MadeClub, opts: { createdAt?: string; status?: string; email?: string | null; message?: string } = {}): Promise<{ id: number; message: string; email: string | null }> {
  const m = mark()
  const message = opts.message ?? `Player Two ${m} says the club now meets at the Example Library.`
  const email = opts.email === undefined ? `visitor-${m}@example.org` : opts.email
  const row = await env.DB.prepare(
    `INSERT INTO club_reports (club_id, kind, field, message, region, reporter_email, status, created_at)
     VALUES (?, 'suggestion', 'venue', ?, ?, ?, ?, ?) RETURNING id`,
  ).bind(club.id, message, club.region, email, opts.status ?? 'open', opts.createdAt ?? SENT_AT).first<{ id: number }>()
  return { id: Number(row!.id), message, email }
}

const escalatedAt = async (id: number) => (await env.DB.prepare('SELECT escalated_at FROM club_reports WHERE id = ?').bind(id).first<{ escalated_at: string | null }>())!.escalated_at
const runRows = async () => (await env.DB.prepare('SELECT outcome, sent_count, failed_count, detail FROM automation_runs WHERE job = ? ORDER BY id').bind(CLOCK_JOB)
  .all<{ outcome: string; sent_count: number | null; failed_count: number | null; detail: string | null }>()).results
const mailTo = (address: string) => emailOutbox.filter((e) => e.to === address)

/** Every table's row count, so a case can say which moved. */
async function tableCounts(): Promise<Record<string, number>> {
  const { results } = await env.DB.prepare(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'd1_%' ORDER BY name`,
  ).all<{ name: string }>()
  const counts: Record<string, number> = {}
  for (const { name } of results ?? []) counts[name] = (await env.DB.prepare(`SELECT COUNT(*) AS n FROM "${name}"`).first<{ n: number }>())!.n
  return counts
}
const moved = (before: Record<string, number>, after: Record<string, number>) =>
  Object.keys(after).filter((name) => after[name] !== before[name]).map((name) => `${name} ${after[name] - (before[name] ?? 0)}`)

/** Every request body the mail service is sent, as text, for a look at what rides in it. */
function recordBodies(): { bodies: string[]; stop: () => void } {
  const underneath = globalThis.fetch
  const bodies: string[] = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    bodies.push(await request.clone().text())
    return underneath(request)
  }) as typeof fetch
  return { bodies, stop: () => { globalThis.fetch = underneath } }
}

/** Every line written to the log by the call. */
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
    env.DB.prepare("DELETE FROM club_reports WHERE kind = 'suggestion'"),
  ])
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('the 14 days', () => {
  it('at 14 days the admins get it once', async () => {
    const admins = await onlyAdmins(2)
    const club = await makeClub({ reps: 1 })
    const s = await suggest(club)
    const done = await runReportClock(clockEnv(), DUE, FAST)
    expect(done).toEqual({ stopped: null, due: 1, passedOn: 1, sent: 2, notSent: 0, notReached: 0 })
    for (const admin of admins) {
      const [mail, ...more] = mailTo(admin.email)
      expect(more).toEqual([])
      expect(mail.text).toContain('No one has answered it in 14 days. It went first to the region\'s representatives. It comes to you as an LCA admin.')
      expect(mail.text).toContain(`${SITE}/admin/clubs/${club.id}#suggestion-${s.id}`)
    }
    // The representatives had it first, so they are not written to again.
    expect(mailTo(club.reps[0].email)).toEqual([])
    expect(await escalatedAt(s.id)).toBe('2026-11-23 18:00:00')
    expect(await runRows()).toEqual([{ outcome: 'ok', sent_count: 2, failed_count: 0, detail: '1 passed on, 2 sent, 0 not sent, 0 left for the next run' }])
    // The next run finds nothing due, sends nothing and writes no row.
    expect(await runReportClock(clockEnv(), at(DUE.getTime() + DAY), FAST)).toMatchObject({ stopped: 'nothing_due', sent: 0 })
    expect(emailOutbox).toHaveLength(2)
    expect(await runRows()).toHaveLength(1)
  })

  it('the region\'s representatives too when the club\'s rep had it', async () => {
    const [admin] = await onlyAdmins(1)
    const club = await makeClub({ rep: true, reps: 2 })
    const s = await suggest(club)
    expect(await runReportClock(clockEnv(), DUE, FAST)).toMatchObject({ passedOn: 1, sent: 3, notSent: 0 })
    for (const rep of club.reps) {
      const [mail, ...more] = mailTo(rep.email)
      expect(more).toEqual([])
      expect(mail.text).toContain(`It went first to the club's representative. It comes to you as the ${club.region} representative.`)
      expect(mail.text).toContain(`${SITE}/workspace/region/clubs/${club.id}#suggestion-${s.id}`)
    }
    expect(mailTo(admin.email)[0].text).toContain('It comes to you as an LCA admin.')
    expect(mailTo(club.rep!.email)).toEqual([])
    // One email to each person: no message names two.
    expect(new Set(emailOutbox.map((e) => e.to)).size).toBe(emailOutbox.length)
  })

  it('the LCA admins again, as a reminder, when they had it first, naming no one', async () => {
    const [admin] = await onlyAdmins(1)
    const club = await makeClub()
    await suggest(club)
    await runReportClock(clockEnv(), DUE, FAST)
    const [mail] = mailTo(admin.email)
    expect(mail.text).toContain('No one has answered it in 14 days. It went first to the LCA admins, so this is a reminder.')
    expect(mail.text).not.toMatch(/Player One|Hi /)
  })

  it('an answered one is not passed on, nor one applied or dismissed', async () => {
    await onlyAdmins(1)
    const club = await makeClub({ rep: true, reps: 1 })
    for (const status of ['answered', 'applied', 'dismissed']) await suggest(club, { status })
    const before = await tableCounts()
    expect(await runReportClock(clockEnv(), at(SENT_MS + 40 * DAY), FAST)).toMatchObject({ stopped: 'nothing_due' })
    expect(emailOutbox).toEqual([])
    expect(moved(before, await tableCounts())).toEqual([])
  })

  it('one answered between the read and the send is not mailed', async () => {
    const [admin] = await onlyAdmins(1)
    const club = await makeClub()
    const s = await suggest(club)
    // A keeper's answer lands just before the run's claim: the claim's guard finds it closed.
    let answered = false
    const { db } = countingDb({ afterAll: async (sql) => {
      if (answered || !sql.includes('FROM club_reports r')) return
      answered = true
      await env.DB.prepare(`UPDATE club_reports SET status = 'dismissed', resolved_at = datetime('now'), reporter_email = NULL WHERE id = ?`).bind(s.id).run()
    } })
    expect(await runReportClock(clockEnv(db), DUE, FAST)).toMatchObject({ due: 0, passedOn: 0, sent: 0 })
    expect(mailTo(admin.email)).toEqual([])
    expect(await escalatedAt(s.id)).toBeNull()
  })

  it('not twice, also with two runs at once', async () => {
    const admins = await onlyAdmins(2)
    const club = await makeClub({ rep: true, reps: 1 })
    const s = await suggest(club)
    const [one, two] = await Promise.all([runReportClock(clockEnv(), DUE, FAST), runReportClock(clockEnv(), DUE, FAST)])
    expect(one.passedOn + two.passedOn).toBe(1)
    for (const who of [...admins, ...club.reps]) expect(mailTo(who.email), who.email).toHaveLength(1)
    await runReportClock(clockEnv(), at(DUE.getTime() + 3 * DAY), FAST)
    expect(emailOutbox).toHaveLength(3)
    expect(await escalatedAt(s.id)).toBe('2026-11-23 18:00:00')
  })

  it('nothing with the constant unset: no query, no email, no row', async () => {
    await onlyAdmins(1)
    await suggest(await makeClub())
    flags.keepersOn = false
    const { db, ran } = countingDb()
    expect(await runReportClock(clockEnv(db), DUE, FAST)).toEqual({ stopped: 'closed', due: 0, passedOn: 0, sent: 0, notSent: 0, notReached: 0 })
    expect(ran).toEqual([])
    expect(emailOutbox).toEqual([])
  })

  it('a run with nothing due, or with the constant unset, writes no row', async () => {
    await onlyAdmins(1)
    const club = await makeClub()
    const s = await suggest(club)
    const before = await tableCounts()
    // 13 days and 23 hours: not due.
    expect(await runReportClock(clockEnv(), at(SENT_MS + 14 * DAY - 60 * 60 * 1000), FAST)).toMatchObject({ stopped: 'nothing_due' })
    flags.keepersOn = false
    expect(await runReportClock(clockEnv(), at(SENT_MS + 30 * DAY), FAST)).toMatchObject({ stopped: 'closed' })
    expect(moved(before, await tableCounts())).toEqual([])
    expect(await runRows()).toEqual([])
    expect(await escalatedAt(s.id)).toBeNull()
    expect(emailOutbox).toEqual([])
  })

  it('a stamp that cannot be read is never due', async () => {
    await onlyAdmins(1)
    await suggest(await makeClub(), { createdAt: 'not a stamp' })
    expect(await runReportClock(clockEnv(), at(SENT_MS + 400 * DAY), FAST)).toMatchObject({ stopped: 'nothing_due' })
    expect(emailOutbox).toEqual([])
  })
})

describe('at most ten emails a run, with nothing half sent', () => {
  it('the first suggestion goes whole even past ten, and the next waits for the next run', async () => {
    await onlyAdmins(1)
    const big = await makeClub({ rep: true, reps: 11 })
    const first = await suggest(big, { createdAt: '2026-11-01 18:00:00' })
    const small = await makeClub()
    const second = await suggest(small)
    const done = await runReportClock(clockEnv(), DUE, FAST)
    expect(done).toMatchObject({ due: 2, passedOn: 1, sent: 12, notReached: 1 })
    expect(await escalatedAt(first.id)).not.toBeNull()
    expect(await escalatedAt(second.id)).toBeNull()
    expect((await runRows())[0]).toMatchObject({ outcome: 'partial', detail: '1 passed on, 12 sent, 0 not sent, 1 left for the next run' })
    emailOutbox.length = 0
    expect(await runReportClock(clockEnv(), at(DUE.getTime() + DAY), FAST)).toMatchObject({ passedOn: 1, sent: 1, notReached: 0 })
  })

  it('a later suggestion starts only while the total stays at ten or under, oldest first', async () => {
    await onlyAdmins(1)
    const clubs = [await makeClub({ rep: true, reps: 3 }), await makeClub({ rep: true, reps: 3 }), await makeClub({ rep: true, reps: 3 }), await makeClub()]
    const rows = []
    for (const [i, club] of clubs.entries()) rows.push(await suggest(club, { createdAt: `2026-11-0${i + 1} 18:00:00` }))
    // Each of the first three costs four emails: two fit in ten, the third would make twelve, so it and the fourth wait.
    expect(await runReportClock(clockEnv(), DUE, FAST)).toMatchObject({ due: 4, passedOn: 2, sent: 8, notReached: 2 })
    expect(emailOutbox.length).toBeLessThanOrEqual(MAX_SENDS)
    expect(await escalatedAt(rows[2].id)).toBeNull()
    expect(await escalatedAt(rows[3].id)).toBeNull()
  })
})

describe('one press within the limits of Workers Free', () => {
  it('ten suggestions in one press make at most 11 outside calls and 47 queries, sent or refused', async () => {
    const [admin] = await onlyAdmins(1)
    for (let i = 0; i < 11; i++) await suggest(await makeClub(), { createdAt: new Date(Date.now() - (20 + i) * DAY).toISOString().slice(0, 19).replace('T', ' ') })
    for (const succeed of [false, true]) {
      emailBehavior.succeed = succeed
      emailBehavior.status = 422
      const { db, ran } = countingDb()
      const before = emailOutbox.length
      const { hosts, stop } = recordHosts()
      try {
        const press = await invoke(checkPost, { method: 'POST', as: admin.id, body: { action: 'run_report_clock', send: true }, env: { DB: db } })
        expect(await press.json()).toMatchObject({ due: 11, passedOn: succeed ? 10 : 0, notReached: 1 })
      } finally {
        stop()
      }
      expect(ran.length, String(succeed)).toBeLessThanOrEqual(47)
      expect(hosts.length, String(succeed)).toBeLessThanOrEqual(11)
      expect(emailOutbox.length - before).toBe(succeed ? 10 : 0)
    }
  }, 30000)
})

describe('escalated_at only when a mail was taken', () => {
  it('none taken: it stays due, with one fixed log line, and the next run sends it', async () => {
    const [admin] = await onlyAdmins(1)
    const club = await makeClub()
    const s = await suggest(club)
    const lines = logLines()
    emailBehavior.succeed = false
    emailBehavior.status = 422
    expect(await runReportClock(clockEnv(), DUE, FAST)).toMatchObject({ passedOn: 0, sent: 0, notSent: 1 })
    expect(await escalatedAt(s.id)).toBeNull()
    expect(lines).toEqual(expect.arrayContaining([CLOCK_NOT_SENT_LOG, CLOCK_NONE_TAKEN_LOG]))
    for (const line of lines) {
      expect(line).not.toContain('@')
      expect(line).not.toContain(s.message)
    }
    expect((await runRows())[0]).toMatchObject({ outcome: 'failed', sent_count: 0, failed_count: 1 })
    emailBehavior.succeed = true
    expect(await runReportClock(clockEnv(), at(DUE.getTime() + DAY), FAST)).toMatchObject({ passedOn: 1, sent: 1 })
    expect(mailTo(admin.email)).toHaveLength(1)
  })

  it('one taken of two: it is passed on, and the one not taken is counted', async () => {
    const admins = await onlyAdmins(2)
    const s = await suggest(await makeClub())
    emailBehavior.succeed = false
    emailBehavior.status = 422
    emailBehavior.failFor = [admins[0].email]
    expect(await runReportClock(clockEnv(), DUE, FAST)).toMatchObject({ passedOn: 1, sent: 1, notSent: 1 })
    expect(await escalatedAt(s.id)).not.toBeNull()
  })
})

describe('who it goes to', () => {
  it('a person who is an admin and holds the seat is written to once; a guest who holds it, and the visitor\'s own address, never', async () => {
    const [admin] = await onlyAdmins(1)
    const club = await makeClub({ rep: true })
    await giveSeat(club.region, admin.id)
    const guest = await person('guest')
    await giveSeat(club.region, guest.id)
    const keeperTyped = await person()
    await giveSeat(club.region, keeperTyped.id)
    await suggest(club, { email: keeperTyped.email.toUpperCase() })
    await runReportClock(clockEnv(), DUE, FAST)
    expect(mailTo(admin.email)).toHaveLength(1)
    expect(mailTo(admin.email)[0].text).toContain('It comes to you as an LCA admin.')
    expect(mailTo(guest.email)).toEqual([])
    expect(mailTo(keeperTyped.email)).toEqual([])
  })

  it('no address of the visitor anywhere in the request, its words never in the subject, and the last line step 28 ends on', async () => {
    const [admin] = await onlyAdmins(1)
    const club = await makeClub({ rep: true, reps: 1 })
    const s = await suggest(club, { message: 'Player Two <b>says</b> the club moved & meets on Fridays.' })
    const { bodies, stop } = recordBodies()
    try {
      await runReportClock(clockEnv(), DUE, FAST)
    } finally {
      stop()
    }
    expect(bodies).toHaveLength(2)
    for (const body of bodies) expect(body).not.toContain(s.email!)
    const mail = mailTo(admin.email)[0]
    expect(mail.subject).toBe(`A suggestion for ${club.name}'s listing is still waiting`)
    expect(mail.html).toContain('Player Two &lt;b&gt;says&lt;/b&gt; the club moved &amp; meets on Fridays.')
    expect(mail.text).toContain('Player Two <b>says</b> the club moved & meets on Fridays.')
    expect(mail.text).toContain('What changed: Venue or address')
    expect(mail.text).toContain('Waiting: 14 days')
    expect(mail.text!.trim().endsWith(SUGGESTION_FOOTER)).toBe(true)
    expect(`${mail.subject}${mail.text}${mail.html}`).not.toMatch(new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`))
  })
})

/** One run in one state of the mail switches: only escalated_at and one run row change, and no log line holds the words or an address. */
async function leastKept(listsOn: boolean, sender: 'resend' | 'ses') {
  flags.listsOn = listsOn
  flags.sender = sender
  await onlyAdmins(1)
  const club = await makeClub({ rep: true, reps: 1 })
  const s = await suggest(club)
  const rowBefore = await env.DB.prepare('SELECT * FROM club_reports WHERE id = ?').bind(s.id).first<Record<string, unknown>>()
  const before = await tableCounts()
  const lines = logLines()
  expect(await runReportClock(clockEnv(), DUE, FAST)).toMatchObject({ passedOn: 1, sent: 2 })
  expect(moved(before, await tableCounts())).toEqual(['automation_runs 1'])
  const rowAfter = await env.DB.prepare('SELECT * FROM club_reports WHERE id = ?').bind(s.id).first<Record<string, unknown>>()
  expect({ ...rowAfter, escalated_at: null }).toEqual({ ...rowBefore, escalated_at: null })
  const detail = (await runRows())[0].detail ?? ''
  for (const text of [...lines, detail]) {
    expect(text).not.toContain('@')
    expect(text).not.toContain(s.message)
  }
}

describe('the least is kept', () => {
  it('a run changes escalated_at and adds one run row, and no log line holds the words or an address, with the mail lists off and Resend sending', async () => {
    await leastKept(false, 'resend')
  })

  it('the same with the mail lists on and Amazon SES sending', async () => {
    await leastKept(true, 'ses')
  })
})

describe('the passed-on stamp in the keepers\' answers', () => {
  it('is absent before and given after, in My region and the admin club answer', async () => {
    const [admin] = await onlyAdmins(1)
    const club = await makeClub()
    const s = await suggest(club, { createdAt: new Date(Date.now() - 15 * DAY).toISOString().slice(0, 19).replace('T', ' ') })
    const items = async () => {
      const region = await (await invoke(regionGet, { as: admin.id })).json<{ clubs: Array<{ id: string; openItems: Array<Record<string, unknown>> }> }>()
      const mine = region.clubs.find((c) => c.id === club.id)!.openItems
      const adminClub = await (await invoke(adminClubGet, { as: admin.id, params: { id: club.id } })).json<{ openSuggestions: Array<Record<string, unknown>> }>()
      return { mine, adminOnes: adminClub.openSuggestions }
    }
    const before = await items()
    expect(Object.keys(before.mine[0])).toEqual(['kind', 'id', 'field', 'message', 'hasAddress', 'ageDays'])
    expect(Object.keys(before.adminOnes[0])).toEqual(['kind', 'id', 'field', 'message', 'hasAddress', 'ageDays'])
    await runReportClock(clockEnv(), new Date(), FAST)
    const after = await items()
    const stamp = await escalatedAt(s.id)
    expect(after.mine[0].passedOnAt).toBe(stamp)
    expect(after.adminOnes[0].passedOnAt).toBe(stamp)
  })

  it('a passed-on suggestion is answered as before, and step 4\'s deletes take its row', async () => {
    const [admin] = await onlyAdmins(1)
    const club = await makeClub()
    const s = await suggest(club)
    const t = await suggest(club, { createdAt: '2026-11-08 18:00:00' })
    await runReportClock(clockEnv(), DUE, FAST)
    expect(await escalatedAt(s.id)).not.toBeNull()
    expect(await escalatedAt(t.id)).not.toBeNull()
    const resolved = await invoke(resolvePost, { method: 'POST', as: admin.id, params: { id: club.id, reportId: String(s.id) }, body: { action: 'dismiss' } })
    expect(resolved.status).toBe(200)
    // A member who resolved the other one leaves: the row keeps its outcome with no member id.
    const resolver = await person()
    await env.DB.prepare(`UPDATE club_reports SET status = 'applied', resolved_by = ?, resolved_at = datetime('now'), reporter_email = NULL WHERE id = ?`).bind(resolver.id, t.id).run()
    const leaving = await invoke(memberDelete, { method: 'DELETE', as: admin.id, params: { id: resolver.id } })
    expect(leaving.status).toBe(200)
    expect(await env.DB.prepare('SELECT status, resolved_by FROM club_reports WHERE id = ?').bind(t.id).first()).toEqual({ status: 'applied', resolved_by: null })
    const gone = await invoke(clubDelete, { method: 'DELETE', as: admin.id, params: { id: club.id } })
    expect(gone.status).toBe(200)
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM club_reports WHERE id IN (?, ?)').bind(s.id, t.id).first<{ n: number }>())!.n).toBe(0)
  })
})

describe('the LCA admin\'s button: the second action of POST /api/admin/clubs/monthly-check', () => {
  const ask = (as: string | undefined, send: boolean, aal: 'aal1' | 'aal2' = 'aal2') =>
    invoke(checkPost, { method: 'POST', as, aal, body: { action: 'run_report_clock', send } })
  const fifteenDaysAgo = () => new Date(Date.now() - 15 * DAY).toISOString().slice(0, 19).replace('T', ' ')

  it('asks how many are due and sends nothing, then sends, marked manual, with one audit entry of counts alone', async () => {
    const [admin] = await onlyAdmins(1)
    const club = await makeClub({ rep: true, reps: 1 })
    const s = await suggest(club, { createdAt: fifteenDaysAgo() })
    const before = await tableCounts()
    const asked = await ask(admin.id, false)
    expect(asked.status).toBe(200)
    expect(await asked.json()).toEqual({ due: 1, passedOn: 0, sent: 0, notSent: 0, notReached: 0 })
    expect(emailOutbox).toEqual([])
    expect(moved(before, await tableCounts())).toEqual([])
    const sent = await ask(admin.id, true)
    expect(await sent.json()).toEqual({ due: 1, passedOn: 1, sent: 2, notSent: 0, notReached: 0 })
    expect(moved(before, await tableCounts()).sort()).toEqual(['admin_audit_log 1', 'automation_runs 1'])
    expect((await runRows())[0].detail).toBe('manual: 1 passed on, 2 sent, 0 not sent, 0 left for the next run')
    const audit = await env.DB.prepare(`SELECT actor_id, action, target_member_id, target_label, detail FROM admin_audit_log WHERE action = 'club_report_clock_sent' AND actor_id = ?`)
      .bind(admin.id).all<Record<string, unknown>>()
    expect(audit.results).toEqual([{ actor_id: admin.id, action: 'club_report_clock_sent', target_member_id: null, target_label: 'Overdue suggestions', detail: JSON.stringify({ passedOn: 1, sent: 2, notSent: 0, notReached: 0 }) }])
    expect(JSON.stringify(audit.results)).not.toContain(s.message)
    // Pressed again with nothing due: nothing sent, no run row, no audit entry.
    const again = await ask(admin.id, true)
    expect(await again.json()).toEqual({ due: 0, passedOn: 0, sent: 0, notSent: 0, notReached: 0 })
    expect(await runRows()).toHaveLength(1)
    expect((await env.DB.prepare(`SELECT COUNT(*) AS n FROM admin_audit_log WHERE action = 'club_report_clock_sent' AND actor_id = ?`).bind(admin.id).first<{ n: number }>())!.n).toBe(1)
  })

  it('role safety: refused signed out, to a member, a guest who holds the seat, a club\'s rep, a region\'s representative and an admin without a second factor', async () => {
    const [admin] = await onlyAdmins(1)
    const club = await makeClub({ rep: true, reps: 1 })
    await suggest(club, { createdAt: fifteenDaysAgo() })
    const guest = await person('guest')
    await giveSeat(club.region, guest.id)
    const member = await person()
    expect((await ask(undefined, true)).status).toBe(401)
    for (const who of [member.id, guest.id, club.rep!.id, club.reps[0].id]) {
      const refused = await ask(who, true)
      expect(refused.status, who).toBe(403)
    }
    const noFactor = await ask(admin.id, true, 'aal1')
    expect(noFactor.status).toBe(403)
    expect(await noFactor.json()).toMatchObject({ mfaRequired: true })
    expect(emailOutbox).toEqual([])
    expect(await runRows()).toEqual([])
    const allowed = await ask(admin.id, false)
    expect(allowed.status).toBe(200)
  })

  it('with the constant unset everyone gets the closed 403, the admin too, and nothing is read', async () => {
    const [admin] = await onlyAdmins(1)
    await suggest(await makeClub(), { createdAt: fifteenDaysAgo() })
    flags.keepersOn = false
    const { db, ran } = countingDb()
    for (const send of [false, true]) {
      const closed = await invoke(checkPost, { method: 'POST', as: admin.id, body: { action: 'run_report_clock', send }, env: { DB: db } })
      expect(closed.status).toBe(403)
      expect(await closed.json()).toEqual({ error: CHECK_CLOSED })
    }
    expect(ran).toEqual([])
    expect(emailOutbox).toEqual([])
  })

  it('needs no signing key, and an action it does not know is refused in words', async () => {
    const [admin] = await onlyAdmins(1)
    const noKey = await invoke(checkPost, { method: 'POST', as: admin.id, body: { action: 'run_report_clock', send: false }, env: { SIGNING_SECRET: undefined } })
    expect(noKey.status).toBe(200)
    const wrong = await invoke(checkPost, { method: 'POST', as: admin.id, body: { action: 'something_else', send: true } })
    expect(wrong.status).toBe(400)
    expect(await wrong.json()).toMatchObject({ fields: { action: expect.any(String) } })
  })
})
