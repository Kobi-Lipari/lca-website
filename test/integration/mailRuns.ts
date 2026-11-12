// test/integration/mailRuns.ts
//
// One copy of the daily-run helpers the two do-not-send gate suites share,
// test/integration/mail-gate.test.ts and test/integration/mail-gate-edges.test.ts:
// the daily run, the held clock, the statement-counting database, the host
// log, the reminder seeds and the one-message seam helper, with the
// one-click headers list mail carries since WS16 step 3. Since WS16 step 5
// it also holds what test/integration/mail-reminders-left.test.ts adds: a
// mail service that answers chosen calls with a 429, the waits the run asks
// for taken out of a case's time, and one event with its paid entrants. It
// depends on no mock: each suite keeps its own vi.mock of
// functions/utils/mail/switches and its flags, and sets them before every
// case.
import { env } from 'cloudflare:test'
import { vi } from 'vitest'
import { DEFAULT_FROM, DEFAULT_REPLY_TO } from '../../domain/mail/addresses'
import { type MailHeader, type OutgoingMail } from '../../functions/utils/mail/send'
import worker from '../../workers/daily-emails/src/index'
import { seedMember, seedRegistration, seedTournament } from './factories'
import { emailOutbox } from './harness'

type WorkerEnv = Parameters<typeof worker.scheduled>[1]
const DAILY = { cron: '0 12 * * *' } as ScheduledController

/** The worker's bindings as the suites hand them to the code under test. */
export const bindings = env as unknown as WorkerEnv & { CONTACT_EMAIL: string }

/** The daily run, on the test's database or on a wrapper over it. */
export async function runDaily(db: D1Database = env.DB): Promise<void> {
  await worker.scheduled(DAILY, { ...bindings, DB: db })
}

/** A day this many days from today, as the daily run reads its days: in UTC, written YYYY-MM-DD. */
export function dayFromToday(days: number): string {
  const day = new Date()
  day.setDate(day.getDate() + days)
  return day.toISOString().split('T')[0]
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Holds the clock at 12:00 PM UTC on Thursday, November 12, 2026, the daily run's hour, so a case seeds its events
 * against that day and runs the next day's run after nextDay(). Only Date is held; timers run as usual, and the
 * database's own clock is not moved.
 */
export function holdClock(): { nextDay: () => void } {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-12T12:00:00.000Z'))
  return { nextDay: () => vi.setSystemTime(new Date(Date.now() + DAY_MS)) }
}

let seq = 0
/** The next number of the one counter both suites draw ids, names and placeholders from. */
export const nextSeq = (): number => ++seq

/** The mail the harness took for this address. */
export const mailTo = (address: string) => emailOutbox.filter((e) => e.to === address)

/** A row of tournament_reminders: the member tapped the bell on the event. */
export async function bell(tournamentId: string, memberId: string, email: string, marks: { registrationOpen?: number } = {}): Promise<string> {
  const id = `bell-${nextSeq()}`
  await env.DB.prepare(
    `INSERT INTO tournament_reminders (id, member_id, tournament_id, email, sent_registration_open) VALUES (?, ?, ?, ?, ?)`,
  ).bind(id, memberId, tournamentId, email, marks.registrationOpen ?? 0).run()
  return id
}

export async function noLongerReceives(address: string): Promise<void> {
  await env.DB.prepare(`INSERT INTO mail_do_not_send (address, reason, detail) VALUES (?, 'bounce', 'General')`).bind(address).run()
}

export const reminderRow = (id: string) =>
  env.DB.prepare('SELECT sent_registration_open, sent_week_before, registration_opened_notified_at FROM tournament_reminders WHERE id = ?')
    .bind(id).first<{ sent_registration_open: number; sent_week_before: number; registration_opened_notified_at: string | null }>()

/**
 * Three events, each with one reminder due today for every address given: the registration-open reminder of an event
 * open now, the week-before reminder of an event a week away, and the first attendee reminder of an event three days
 * away that the member has entered.
 */
export async function dueToday(addresses: string[]) {
  const open = await seedTournament({ name: `Sample Winter Open ${nextSeq()}`, date: dayFromToday(30), registrationStatus: 'open' })
  const soon = await seedTournament({ name: `Sample Autumn Quads ${nextSeq()}`, date: dayFromToday(7), registrationStatus: 'closed' })
  const entered = await seedTournament({ name: `Sample Spring Swiss ${nextSeq()}`, date: dayFromToday(3), registrationStatus: 'closed' })
  await env.DB.prepare('UPDATE tournaments SET reminder_1_enabled = 1, reminder_1_days_before = 3, reminder_2_enabled = 0 WHERE id = ?').bind(entered).run()
  const rows: Record<string, { open: string; soon: string; member: string }> = {}
  for (const address of addresses) {
    const memberId = await seedMember({ email: address })
    rows[address] = { open: await bell(open, memberId, address), soon: await bell(soon, memberId, address, { registrationOpen: 1 }), member: memberId }
    await seedRegistration({ tournamentId: entered, memberId, paymentStatus: 'paid' })
  }
  return { open, soon, entered, rows }
}

export interface Ran { sql: string; binds: number }

/**
 * A database over the test's D1 that keeps every statement it runs, a batch counting as one query as D1 counts it;
 * refuses every statement that names `refuse`, as a database without that table would; and calls `afterAll` with the
 * statement's text once a read of rows has answered, so a test can play another run's write between a read and a claim.
 * With `log`, each statement's text also goes into that list as it runs, so a case can hold its order against the
 * waits noWaits(log) puts in the same list.
 */
export function countingDb(opts: { refuse?: string; afterAll?: (sql: string) => Promise<void>; log?: string[] } = {}) {
  const ran: Ran[] = []
  const real = new WeakMap<object, D1PreparedStatement>()
  const wrap = (statement: D1PreparedStatement, sql: string, binds: number): D1PreparedStatement => {
    const run = <T>(work: () => Promise<T>): Promise<T> => {
      ran.push({ sql, binds })
      opts.log?.push(sql)
      if (opts.refuse && sql.includes(opts.refuse)) return Promise.reject(new Error(`D1_ERROR: no such table: ${opts.refuse}: SQLITE_ERROR`))
      return work()
    }
    const wrapped = {
      bind: (...values: unknown[]) => wrap(statement.bind(...values), sql, values.length),
      first: (column?: string) => run(() => (column === undefined ? statement.first() : statement.first(column))),
      run: () => run(() => statement.run()),
      all: () => run(async () => {
        const answer = await statement.all()
        await opts.afterAll?.(sql)
        return answer
      }),
      raw: (options?: { columnNames?: boolean }) => run(() => statement.raw(options as { columnNames: true })),
    }
    real.set(wrapped, statement)
    return wrapped as unknown as D1PreparedStatement
  }
  const db = {
    prepare: (sql: string) => wrap(env.DB.prepare(sql), sql, 0),
    batch: (statements: D1PreparedStatement[]) => {
      ran.push({ sql: 'batch', binds: statements.length })
      return env.DB.batch(statements.map((s) => real.get(s) ?? s))
    },
    exec: (sql: string) => env.DB.exec(sql),
    dump: () => env.DB.dump(),
  }
  return { db: db as unknown as D1Database, ran, mailReads: () => ran.filter((r) => /\bmail_/.test(r.sql)) }
}

/** Every host the code calls, in order, through the harness's own interceptor underneath. */
export function recordHosts(): { hosts: string[]; stop: () => void } {
  const underneath = globalThis.fetch
  const hosts: string[] = []
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    hosts.push(new URL(input instanceof Request ? input.url : String(input)).hostname)
    return underneath(input, init)
  }) as typeof fetch
  return { hosts, stop: () => { globalThis.fetch = underneath } }
}

/** The mail service's host, as the harness catches it. */
export const MAIL_HOST = 'api.resend.com'

/** One outside call the code made, in order: its host, and whether throttleMail answered it with a 429. */
export interface OutsideCall { host: string; throttled: boolean }

/**
 * A fetch over the harness's own that answers the calls to the mail service it chooses with a 429, as a throttle would,
 * each once: `chosen` is asked about each call to the mail service by its number among them, from 1. A call it answers
 * goes no further, so the message is not in the outbox and the harness's fetchCount does not count it; every call, of
 * every host, is kept in `calls`, so a case counts the outside calls a run made there.
 */
export function throttleMail(chosen: (call: number) => boolean): { calls: OutsideCall[]; mail: () => OutsideCall[]; stop: () => void } {
  const underneath = globalThis.fetch
  const calls: OutsideCall[] = []
  let mailCalls = 0
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const host = new URL(input instanceof Request ? input.url : String(input)).hostname
    if (host === MAIL_HOST && chosen(++mailCalls)) {
      calls.push({ host, throttled: true })
      return Response.json({ message: 'harness: too many requests' }, { status: 429 })
    }
    calls.push({ host, throttled: false })
    return underneath(input, init)
  }) as typeof fetch
  return { calls, mail: () => calls.filter((c) => c.host === MAIL_HOST), stop: () => { globalThis.fetch = underneath } }
}

/**
 * Takes the time out of every wait the code under test asks for, as test/integration/published-review-edges.test.ts
 * does: setTimeout calls back on the next microtask. The waits asked for are kept, in milliseconds, in order. The
 * spy goes with vi.restoreAllMocks(), which both gate suites and test/integration/mail-reminders-left.test.ts call
 * after every case. With `log`, each wait also goes into that list as it is asked for, written "wait <ms>".
 */
export function noWaits(log?: string[]): number[] {
  const asked: number[] = []
  vi.spyOn(globalThis, 'setTimeout').mockImplementation(((callback: () => void, ms?: number) => {
    asked.push(ms ?? 0)
    log?.push(`wait ${ms ?? 0}`)
    queueMicrotask(callback)
    return 0
  }) as unknown as typeof setTimeout)
  return asked
}

/**
 * One event three days away whose first attendee reminder is due today, entered and paid for by this many members,
 * each at an address of their own, plainly made up; its second reminder is off. Answers the event and the addresses,
 * in the order the entrants were seeded.
 */
export async function paidEntrants(count: number): Promise<{ tournamentId: string; addresses: string[] }> {
  const n = nextSeq()
  const tournamentId = await seedTournament({ name: `Sample Autumn Swiss ${n}`, date: dayFromToday(3), registrationStatus: 'closed' })
  await env.DB.prepare('UPDATE tournaments SET reminder_1_enabled = 1, reminder_1_days_before = 3, reminder_2_enabled = 0 WHERE id = ?').bind(tournamentId).run()
  const addresses: string[] = []
  for (let i = 0; i < count; i++) {
    const address = `entrant${n}-${i}@example.org`
    await seedRegistration({ tournamentId, memberId: await seedMember({ email: address, fullName: `Player ${i + 1}` }), paymentStatus: 'paid' })
    addresses.push(address)
  }
  return { tournamentId, addresses }
}

/** A US Chess member record as the ratings service answers it. */
export const rated = (rating: number) => ({ ratings: [{ ratingSystem: 'R', rating, gamesPlayed: 12, isProvisional: false, floor: 100 }], lastChangedDate: '2026-09-03' })

/** One message through the seam, as a sender would hand it over. */
export const message = (to: string, extra: Partial<OutgoingMail> = {}) =>
  ({ from: DEFAULT_FROM, to, replyTo: DEFAULT_REPLY_TO, subject: 'Fall news', html: '<p>Hi</p>', shape: 'single', ...extra }) as OutgoingMail

/**
 * The two one-click headers list mail must carry since WS16 step 3, in the form the seam checks: List-Unsubscribe with
 * one HTTPS address, here a made-up one, then List-Unsubscribe-Post with the one-click value. The seam checks their
 * form and not where they lead, so a case about the gate gives them to every list message it sends.
 */
export const ONE_CLICK_HEADERS: MailHeader[] = [
  { name: 'List-Unsubscribe', value: '<https://links.test.lca/api/mail/unsubscribe/sample-link>' },
  { name: 'List-Unsubscribe-Post', value: 'List-Unsubscribe=One-Click' },
]
