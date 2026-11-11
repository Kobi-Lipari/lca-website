// test/integration/mailRuns.ts
//
// One copy of the daily-run helpers the two do-not-send gate suites share,
// test/integration/mail-gate.test.ts and test/integration/mail-gate-edges.test.ts:
// the daily run, the held clock, the statement-counting database, the host
// log, the reminder seeds and the one-message seam helper. It depends on
// no mock: each suite keeps its own vi.mock of functions/utils/mail/switches
// and its flags, and sets them before every case.
import { env } from 'cloudflare:test'
import { vi } from 'vitest'
import { DEFAULT_FROM, DEFAULT_REPLY_TO } from '../../domain/mail/addresses'
import { type OutgoingMail } from '../../functions/utils/mail/send'
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
  const open = await seedTournament({ name: `Bayou Open ${nextSeq()}`, date: dayFromToday(30), registrationStatus: 'open' })
  const soon = await seedTournament({ name: `Delta Quads ${nextSeq()}`, date: dayFromToday(7), registrationStatus: 'closed' })
  const entered = await seedTournament({ name: `Crescent Swiss ${nextSeq()}`, date: dayFromToday(3), registrationStatus: 'closed' })
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
 */
export function countingDb(opts: { refuse?: string; afterAll?: (sql: string) => Promise<void> } = {}) {
  const ran: Ran[] = []
  const real = new WeakMap<object, D1PreparedStatement>()
  const wrap = (statement: D1PreparedStatement, sql: string, binds: number): D1PreparedStatement => {
    const run = <T>(work: () => Promise<T>): Promise<T> => {
      ran.push({ sql, binds })
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

/** A US Chess member record as the ratings service answers it. */
export const rated = (rating: number) => ({ ratings: [{ ratingSystem: 'R', rating, gamesPlayed: 12, isProvisional: false, floor: 100 }], lastChangedDate: '2026-09-03' })

/** One message through the seam, as a sender would hand it over. */
export const message = (to: string, extra: Partial<OutgoingMail> = {}) =>
  ({ from: DEFAULT_FROM, to, replyTo: DEFAULT_REPLY_TO, subject: 'Fall news', html: '<p>Hi</p>', shape: 'single', ...extra }) as OutgoingMail
