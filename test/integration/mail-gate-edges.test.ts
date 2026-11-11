// test/integration/mail-gate-edges.test.ts
//
// The edges of the do-not-send gate of WS16 step 2 that
// test/integration/mail-gate.test.ts leaves between its cases, on the same
// D1 database the migrations build, 0060 among them. MAIL_LISTS_ON,
// MAIL_SENDER, WORKERS_PLAN and COMPLAINT_STOPS_OTHER_SENDERS are read
// through getters on the mocked functions/utils/mail/switches, set before
// every case, so no value the code ships with decides one. Nothing here
// reaches an outside service: the harness answers every host.
//
// - The gate on its own (openGate, openLoopGate, emptyGate): no query for
//   no addresses or for addresses refused without one, one query for each
//   90 at every size on both sides of a chunk, repeats and case read once,
//   the order of the three refusals, a spam report's mark against a later
//   choice at the second, across UTC midnight and across the night
//   America/Chicago sets its clocks back, a list the gate was not read for,
//   and a read that fails.
// - The seam's use of a gate given to it, the runtime's words for too many
//   outside calls read as the limit only under the rules and only by those
//   words, and what each answer of the service means for a message with the
//   rules on and off.
// - The daily run: two runs at once, a claim another run took between the
//   read and the claim, a claim given back by every phase and kept by a
//   'never', a budget spread across the phases with the reminders whose
//   queries name one day first, the rating lookups' share of the outside
//   calls on each plan and with the rules off, and the next day's run
//   picking up the registration-open rows the budget left, while the
//   week-before rows past it, whose day has gone, are not read again.
// - Role safety with the rules on: the wrong role gets 401 or 403, reads no
//   gate and sends nothing.
// - The director's announce and Group email's batch with every entrant dead,
//   with a walk-in placeholder, and with a gate that cannot be read.
// - The tables on D1: the two list rows, the 24 columns, one contact for an
//   address, a person with no member account holding a choice, a family's
//   one address holding one, and the foreign keys.
// - The harness's knobs: reset by resetHarness and counted as documented.
//
// Since WS16 step 3 every list message here carries the one-click headers
// list mail must carry, and list mail the gate lets through waits for
// Amazon SES while Resend sends.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_FROM } from '../../domain/mail/addresses'
import { NEWSLETTER_LIST_ID, TOURNAMENTS_LIST_ID } from '../../domain/mail/lists'
import { onRequestPost as announcePost } from '../../functions/api/admin/tournaments/[id]/announce'
import { onRequestPatch as registrationStatusPatch } from '../../functions/api/admin/tournaments/[id]/registration'
import { processCampaign } from '../../functions/utils/admin/campaigns'
import { sendEmailOutcome } from '../../functions/utils/email'
import { emptyGate, GATE_QUERY_SIZE, GATE_UNREAD_LOG, GateUnread, openGate, openLoopGate, type MailGate } from '../../functions/utils/mail/gate'
import { deliver, REFUSAL_WORDS, TOO_MANY_OUTSIDE_CALLS, WAIT_FOR_SES_WORDS } from '../../functions/utils/mail/send'
import { seedAdmin, seedClub, seedMember, seedRegistration, seedTournament } from './factories'
import { emailBehavior, emailOutbox, fetchCount, flushWaitUntil, invoke, resetHarness, uscfBehavior } from './harness'
import {
  bell, bindings, countingDb, dayFromToday, dueToday, holdClock, mailTo, message, nextSeq, noLongerReceives, ONE_CLICK_HEADERS, rated, recordHosts, reminderRow,
  runDaily,
} from './mailRuns'

const flags = vi.hoisted(() => ({ listsOn: false, sender: 'resend', plan: 'free', complaintStops: true }))
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
    get WORKERS_PLAN() {
      return flags.plan
    },
    get COMPLAINT_STOPS_OTHER_SENDERS() {
      return flags.complaintStops
    },
  }
})

const CLUB_LIST = 'club-example'

const hex32 = (n: number) => n.toString(16).padStart(32, '0')
const reader = (i: number) => `reader${i}@chess.test.lca`

interface ContactMarks {
  optionalOff?: string | null
  complained?: string | null
  choices?: Record<string, { choice: 'in' | 'out'; at?: string }>
}

/** A contact for the address with the marks and choices given, written with the times given. */
async function contact(address: string, marks: ContactMarks = {}): Promise<string> {
  const id = hex32(nextSeq())
  await env.DB.prepare('INSERT INTO mail_contacts (id, address, optional_off_at, complained_at) VALUES (?, ?, ?, ?)')
    .bind(id, address, marks.optionalOff ?? null, marks.complained ?? null).run()
  for (const [listId, c] of Object.entries(marks.choices ?? {})) {
    await env.DB.prepare(`INSERT INTO mail_list_choices (contact_id, list_id, choice, source, updated_at) VALUES (?, ?, ?, 'link', ?)`)
      .bind(id, listId, c.choice, c.at ?? '2026-11-01 12:00:00').run()
  }
  return id
}

const attendeeRows = (tournamentId: string) =>
  env.DB.prepare('SELECT COUNT(*) AS n FROM tournament_attendee_reminders WHERE tournament_id = ?').bind(tournamentId).first<{ n: number }>().then((r) => r?.n ?? 0)

const columnsOf = (table: string) =>
  env.DB.prepare(`SELECT name FROM pragma_table_info('${table}') ORDER BY cid`).all<{ name: string }>().then((r) => r.results.map((c) => c.name))

beforeEach(async () => {
  resetHarness()
  flags.listsOn = false
  flags.sender = 'resend'
  flags.plan = 'free'
  flags.complaintStops = true
  for (const table of ['tournament_attendee_reminders', 'tournament_reminders', 'mail_list_choices', 'mail_contacts', 'mail_do_not_send']) {
    await env.DB.prepare(`DELETE FROM ${table}`).run()
  }
  await env.DB.prepare(`DELETE FROM mail_lists WHERE id NOT IN ('lca-newsletter', 'lca-tournaments')`).run()
  await env.DB.prepare(`INSERT INTO mail_lists (id, kind, name, main_mailer) VALUES (?, 'club', 'Example Chess Club news', 0)`).bind(CLUB_LIST).run()
  await env.DB.prepare(`UPDATE tournaments SET reminder_1_enabled = 0, reminder_2_enabled = 0, registration_status = 'closed'`).run()
  // Only the members a case seeds are looked up for their ratings, so a case's counts are its own.
  await env.DB.prepare('UPDATE members SET uscf_id = NULL WHERE uscf_id IS NOT NULL').run()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('openGate: what it reads, and how many queries it makes', () => {
  it('reads nothing for no addresses, and nothing for addresses refused without a query, with or without a list', async () => {
    const { db, ran } = countingDb()
    const refused = ['guest-1@walkin.lca.invalid', 'a b@chess.test.lca', 'nobody', 'x@lca.test']
    await openGate(db, [])
    await openGate(db, refused)
    await openGate(db, [], NEWSLETTER_LIST_ID)
    const forList = await openGate(db, [...refused, 'pat@example.org', DEFAULT_FROM], NEWSLETTER_LIST_ID)
    expect(ran).toEqual([])
    // What needs no query is answered at once, and the names no list sends to are refused for list mail.
    for (const address of refused) expect(forList.refusal(address, 'optional', NEWSLETTER_LIST_ID), address).toBe('not_sendable')
    expect(forList.refusal('pat@example.org', 'optional', NEWSLETTER_LIST_ID)).toBe('not_sendable')
    expect(forList.refusal(DEFAULT_FROM, 'optional', NEWSLETTER_LIST_ID)).toBe('not_sendable')
    // Event mail to such an address was not read: the caller reads it on its own.
    expect(forList.refusal('pat@example.org', 'event')).toBeUndefined()
  })

  it('makes one query for each 90 addresses at every size on both sides of a chunk, and binds at most 91 values', async () => {
    const sizes: Array<[number, number[], number[]]> = [
      // size, binds without a list, binds with one (the list's id is one more value in each query)
      [1, [1], [2]],
      [89, [89], [90]],
      [GATE_QUERY_SIZE, [90], [91]],
      [91, [90, 1], [91, 2]],
      [180, [90, 90], [91, 91]],
      [181, [90, 90, 1], [91, 91, 2]],
    ]
    for (const [size, plain, withList] of sizes) {
      const addresses = Array.from({ length: size }, (_, i) => reader(i))
      const a = countingDb()
      await openGate(a.db, addresses)
      expect(a.ran.map((r) => r.binds), `${size} addresses`).toEqual(plain)
      const b = countingDb()
      await openGate(b.db, addresses, NEWSLETTER_LIST_ID)
      expect(b.ran.map((r) => r.binds), `${size} addresses, with a list`).toEqual(withList)
      expect(Math.max(...b.ran.map((r) => r.binds))).toBeLessThanOrEqual(100)
    }
  })

  it('reads a repeated address once, whatever its case or the spaces around it, and does not count the ones it refuses without a query', async () => {
    const { db, ran } = countingDb()
    const addresses = [reader(1), ` ${reader(1).toUpperCase()} `, reader(1), reader(2), 'guest-9@walkin.lca.invalid', 'pat@example.org']
    await openGate(db, addresses, NEWSLETTER_LIST_ID)
    expect(ran.map((r) => r.binds)).toEqual([3])
    const plain = countingDb()
    await openGate(plain.db, addresses)
    // Without a list, event mail's reach is today's: example.org is read, a placeholder is not.
    expect(plain.ran.map((r) => r.binds)).toEqual([3])
  })

  it('answers right on every side of the chunks: a dead address in the second, an out choice in the second and third', async () => {
    const addresses = Array.from({ length: 200 }, (_, i) => reader(i))
    await noLongerReceives(reader(95))
    await contact(reader(150), { choices: { [NEWSLETTER_LIST_ID]: { choice: 'out' } } })
    await contact(reader(195), { optionalOff: '2026-11-02 08:00:00' })
    const gate = await openGate(env.DB, addresses, NEWSLETTER_LIST_ID)
    const answers = addresses.map((address) => gate.refusal(address, 'optional', NEWSLETTER_LIST_ID))
    expect(answers.filter((a) => a === null)).toHaveLength(197)
    expect(answers[95]).toBe('do_not_send')
    expect(answers[150]).toBe('opted_out')
    expect(answers[195]).toBe('opted_out')
    // Asked for event mail the same gate refuses only the dead address.
    expect(addresses.map((address) => gate.refusal(address, 'event')).filter((a) => a !== null)).toEqual(['do_not_send'])
  })

  it('matches an address however the asker writes it, since the tables hold it trimmed and in lower case', async () => {
    await noLongerReceives('gone@chess.test.lca')
    const gate = await openGate(env.DB, ['gone@chess.test.lca'])
    expect(gate.refusal('  GONE@Chess.Test.LCA ', 'event')).toBe('do_not_send')
    expect(gate.refusal('gone@chess.test.lca', 'test')).toBe('do_not_send')
  })
})

describe('openGate: the three refusals, in their order', () => {
  it('an address that cannot be mailed is not_sendable even when it is on the do-not-send list, and the list comes before a choice', async () => {
    await noLongerReceives('guest-5@walkin.lca.invalid')
    await noLongerReceives(reader(1))
    await contact(reader(1), { optionalOff: '2026-11-02 08:00:00', choices: { [NEWSLETTER_LIST_ID]: { choice: 'out' } } })
    await contact(reader(2), { optionalOff: '2026-11-02 08:00:00', choices: { [NEWSLETTER_LIST_ID]: { choice: 'out' } } })
    const gate = await openGate(env.DB, ['guest-5@walkin.lca.invalid', reader(1), reader(2)], NEWSLETTER_LIST_ID)
    expect(gate.refusal('guest-5@walkin.lca.invalid', 'event')).toBe('not_sendable')
    expect(gate.refusal(reader(1), 'optional', NEWSLETTER_LIST_ID)).toBe('do_not_send')
    expect(gate.refusal(reader(2), 'optional', NEWSLETTER_LIST_ID)).toBe('opted_out')
    expect(gate.refusal(reader(1), 'event')).toBe('do_not_send')
    expect(gate.refusal(reader(2), 'event')).toBeNull()
  })

  it('a choice on one list stops that list alone, and an address with no contact, or a contact with no mark, goes', async () => {
    await contact(reader(1), { choices: { [TOURNAMENTS_LIST_ID]: { choice: 'out' } } })
    await contact(reader(2))
    await contact(reader(3), { choices: { [NEWSLETTER_LIST_ID]: { choice: 'in' } } })
    const addresses = [reader(1), reader(2), reader(3), reader(4)]
    const newsletter = await openGate(env.DB, addresses, NEWSLETTER_LIST_ID)
    const tournaments = await openGate(env.DB, addresses, TOURNAMENTS_LIST_ID)
    expect(addresses.map((a) => newsletter.refusal(a, 'optional', NEWSLETTER_LIST_ID))).toEqual([null, null, null, null])
    expect(addresses.map((a) => tournaments.refusal(a, 'optional', TOURNAMENTS_LIST_ID))).toEqual(['opted_out', null, null, null])
  })

  it('answers undefined for what it was not read for: another list, list mail naming no list, an address it was not given', async () => {
    const gate = await openGate(env.DB, [reader(1)], NEWSLETTER_LIST_ID)
    expect(gate.refusal(reader(1), 'optional', TOURNAMENTS_LIST_ID)).toBeUndefined()
    expect(gate.refusal(reader(1), 'optional')).toBeUndefined()
    expect(gate.refusal(reader(2), 'optional', NEWSLETTER_LIST_ID)).toBeUndefined()
    expect(gate.refusal(reader(2), 'event')).toBeUndefined()
    expect(gate.refusal(reader(1), 'optional', NEWSLETTER_LIST_ID)).toBeNull()
    const plain = await openGate(env.DB, [reader(1)])
    expect(plain.refusal(reader(1), 'optional', NEWSLETTER_LIST_ID)).toBeUndefined()
    expect(plain.refusal(reader(1), 'event')).toBeNull()
  })
})

describe('openGate: a spam report\'s mark against a later choice', () => {
  /** [what it is, the report's time, the choice's time, what a list that is not a main mailer is told]. */
  const cases: Array<[string, string, string, 'opted_out' | null]> = [
    ['a choice in the same second as the report', '2026-11-05 10:00:00', '2026-11-05 10:00:00', 'opted_out'],
    ['a choice a second before the report', '2026-11-05 10:00:00', '2026-11-05 09:59:59', 'opted_out'],
    ['a choice a second after the report', '2026-11-05 10:00:00', '2026-11-05 10:00:01', null],
    ['a choice a second after, one time written in ISO form', '2026-11-05 10:00:00', '2026-11-05T10:00:01Z', null],
    ['a choice in the same second, the report written in ISO form', '2026-11-05T10:00:00.000Z', '2026-11-05 10:00:00', 'opted_out'],
    ['a choice a second after, the report written in ISO form', '2026-11-05T10:00:00.000Z', '2026-11-05 10:00:01', null],
    // Times are kept in UTC, so midnight is the same instant wherever the member is.
    ['a choice a second after UTC midnight, the report a second before it', '2026-11-05 23:59:59', '2026-11-06 00:00:00', null],
    ['a choice a second before UTC midnight, the report a second after it', '2026-11-06 00:00:01', '2026-11-05 23:59:59', 'opted_out'],
    // Sunday, November 1, 2026: America/Chicago turns its clocks back at 2:00 AM CDT, which is 7:00:00 AM UTC, so 1:59:59 AM
    // CDT (6:59:59 AM UTC) is followed by 1:00:00 AM CST (7:00:00 AM UTC): a wall clock reads the later choice as earlier.
    ['a choice at 1:00:00 AM CST, the report at 1:59:59 AM CDT of the same night', '2026-11-01 06:59:59', '2026-11-01 07:00:00', null],
    ['a choice at 1:59:59 AM CDT, the report at 1:00:00 AM CST of the same night', '2026-11-01 07:00:00', '2026-11-01 06:59:59', 'opted_out'],
  ]

  it.each(cases)('%s', async (_label, complained, choiceAt, expected) => {
    await contact(reader(1), { complained, choices: { [CLUB_LIST]: { choice: 'in', at: choiceAt } } })
    const gate = await openGate(env.DB, [reader(1)], CLUB_LIST)
    expect(gate.refusal(reader(1), 'optional', CLUB_LIST)).toBe(expected)
  })

  it('stops a list that is not a main mailer and lets a main mailer through, until a later \'in\' on that list', async () => {
    await contact(reader(1), { complained: '2026-11-05 10:00:00' })
    const addresses = [reader(1)]
    const club = await openGate(env.DB, addresses, CLUB_LIST)
    const newsletter = await openGate(env.DB, addresses, NEWSLETTER_LIST_ID)
    expect(club.refusal(reader(1), 'optional', CLUB_LIST)).toBe('opted_out')
    expect(newsletter.refusal(reader(1), 'optional', NEWSLETTER_LIST_ID)).toBeNull()
    // The report always stops the list it was pressed on: an 'out' on a main mailer stops it, as any 'out' does.
    await env.DB.prepare(`INSERT INTO mail_list_choices (contact_id, list_id, choice, source) VALUES ((SELECT id FROM mail_contacts WHERE address = ?), ?, 'out', 'complaint')`)
      .bind(reader(1), NEWSLETTER_LIST_ID).run()
    expect((await openGate(env.DB, addresses, NEWSLETTER_LIST_ID)).refusal(reader(1), 'optional', NEWSLETTER_LIST_ID)).toBe('opted_out')
  })

  it('does not stop a list that is not a main mailer once the setting is off, whatever the choices say', async () => {
    flags.complaintStops = false
    await contact(reader(1), { complained: '2026-11-05 10:00:00' })
    await contact(reader(2), { complained: '2026-11-05 10:00:00', choices: { [CLUB_LIST]: { choice: 'out', at: '2026-11-06 10:00:00' } } })
    const gate = await openGate(env.DB, [reader(1), reader(2)], CLUB_LIST)
    expect(gate.refusal(reader(1), 'optional', CLUB_LIST)).toBeNull()
    // The person's own 'out' is theirs, not the report's, and still stops it.
    expect(gate.refusal(reader(2), 'optional', CLUB_LIST)).toBe('opted_out')
  })

  it('is lifted by a later \'in\' on that list alone: never the person\'s own stop-all mark, never the do-not-send list', async () => {
    const back = { [CLUB_LIST]: { choice: 'in' as const, at: '2026-11-06 10:00:00' } }
    await contact(reader(1), { complained: '2026-11-05 10:00:00', optionalOff: '2026-11-04 10:00:00', choices: back })
    await contact(reader(2), { complained: '2026-11-05 10:00:00', choices: back })
    await noLongerReceives(reader(2))
    await contact(reader(3), { complained: '2026-11-05 10:00:00', choices: back })
    const gate = await openGate(env.DB, [reader(1), reader(2), reader(3)], CLUB_LIST)
    expect(gate.refusal(reader(1), 'optional', CLUB_LIST)).toBe('opted_out')
    expect(gate.refusal(reader(2), 'optional', CLUB_LIST)).toBe('do_not_send')
    expect(gate.refusal(reader(3), 'optional', CLUB_LIST)).toBeNull()
  })

  it('reads a list that is not in mail_lists as not a main mailer, the stricter reading for a report', async () => {
    await contact(reader(1), { complained: '2026-11-05 10:00:00' })
    await contact(reader(2))
    const gate = await openGate(env.DB, [reader(1), reader(2)], 'club-never-made')
    expect(gate.refusal(reader(1), 'optional', 'club-never-made')).toBe('opted_out')
    expect(gate.refusal(reader(2), 'optional', 'club-never-made')).toBeNull()
  })
})

describe('openGate: a read that fails', () => {
  it('throws GateUnread, which keeps the cause and names no address, for a list gate and a plain one', async () => {
    for (const listId of [undefined, NEWSLETTER_LIST_ID]) {
      const { db } = countingDb({ refuse: 'mail_do_not_send' })
      const failed = await openGate(db, ['secret.reader@chess.test.lca'], listId).catch((err: unknown) => err)
      expect(failed).toBeInstanceOf(GateUnread)
      expect((failed as GateUnread).cause).toBeInstanceOf(Error)
      expect((failed as GateUnread).message).not.toMatch(/secret\.reader|@/)
    }
  })

  it('openLoopGate answers like an empty gate and logs once, with no address: event and test mail goes, list mail is left to the seam, a placeholder is still refused', async () => {
    const warn = vi.spyOn(console, 'warn')
    const { db } = countingDb({ refuse: 'mail_do_not_send' })
    const gate = await openLoopGate(db, ['secret.reader@chess.test.lca'], NEWSLETTER_LIST_ID)
    expect(warn.mock.calls).toEqual([[GATE_UNREAD_LOG]])
    expect(gate.refusal('secret.reader@chess.test.lca', 'event')).toBeNull()
    expect(gate.refusal('secret.reader@chess.test.lca', 'test')).toBeNull()
    expect(gate.refusal('secret.reader@chess.test.lca', 'optional', NEWSLETTER_LIST_ID)).toBeUndefined()
    expect(gate.refusal('guest-1@walkin.lca.invalid', 'event')).toBe('not_sendable')
    expect(gate.refusal('pat@example.org', 'test')).toBe('not_sendable')
    expect(gate.refusal('pat@example.org', 'event')).toBeNull()
  })

  it('openLoopGate logs nothing when the read works', async () => {
    const warn = vi.spyOn(console, 'warn')
    await openLoopGate(env.DB, [reader(1)])
    expect(warn).not.toHaveBeenCalled()
  })

  it('emptyGate answers the same without a database', () => {
    const gate = emptyGate()
    expect([gate.refusal(reader(1), 'event'), gate.refusal(reader(1), 'test'), gate.refusal(reader(1), 'optional', NEWSLETTER_LIST_ID)]).toEqual([null, null, undefined])
    expect([gate.refusal('x@walkin.lca.invalid', 'event'), gate.refusal('x@walkin.lca.invalid', 'optional', NEWSLETTER_LIST_ID)]).toEqual(['not_sendable', 'not_sendable'])
  })
})

describe('the seam and a gate it is given', () => {
  const fake = (answer: ReturnType<MailGate['refusal']>): MailGate => ({ refusal: () => answer })

  beforeEach(() => {
    flags.listsOn = true
  })

  it('asks the gate it was given and reads no table of its own when that gate answers, either way', async () => {
    const may = countingDb()
    expect(await deliver({ ...bindings, DB: may.db } as never, message(reader(1)), fake(null))).toEqual({ ok: true })
    // List mail the gate lets through waits for Amazon SES while Resend sends (WS16 step 3), with no read of its own either.
    expect(await deliver({ ...bindings, DB: may.db } as never, message(reader(2), { kind: 'optional', listId: NEWSLETTER_LIST_ID, headers: ONE_CLICK_HEADERS }), fake(null)))
      .toEqual({ ok: false, waitForSes: true, error: WAIT_FOR_SES_WORDS })
    expect(may.ran).toEqual([])
    const may2 = countingDb()
    const before = fetchCount
    expect(await deliver({ ...bindings, DB: may2.db } as never, message(reader(3)), fake('do_not_send'))).toEqual({ ok: false, refused: 'do_not_send', error: REFUSAL_WORDS.do_not_send })
    expect(may2.ran).toEqual([])
    expect(fetchCount).toBe(before)
    expect(emailOutbox.map((e) => e.to)).toEqual([reader(1)])
  })

  it('reads its own gate for exactly the one address when the gate it was given did not read it, or was read for another list', async () => {
    const own = countingDb()
    expect(await deliver({ ...bindings, DB: own.db } as never, message(reader(1)), fake(undefined))).toEqual({ ok: true })
    expect(own.mailReads().map((r) => r.binds)).toEqual([1])
    await noLongerReceives(reader(2))
    const other = countingDb()
    const forTournaments = await openGate(env.DB, [reader(2)], TOURNAMENTS_LIST_ID)
    const result = await deliver({ ...bindings, DB: other.db } as never, message(reader(2), { kind: 'optional', listId: NEWSLETTER_LIST_ID, headers: ONE_CLICK_HEADERS }), forTournaments)
    expect(result).toEqual({ ok: false, refused: 'do_not_send', error: REFUSAL_WORDS.do_not_send })
    expect(other.mailReads().map((r) => r.binds)).toEqual([2])
  })

  it('answers the refusal in words that name no address, none of the old initials and no dash', () => {
    for (const words of Object.values(REFUSAL_WORDS)) {
      expect(words).toMatch(/^Not sent: [a-z ]+\.$/)
      expect(words).not.toMatch(/@/)
      expect(words).not.toMatch(new RegExp(`${'US' + 'CF'}|[${String.fromCharCode(0x2013, 0x2014)}]`))
    }
  })
})

describe('the seam and the runtime\'s words for too many outside calls', () => {
  it('reads them as the limit with the rules on, whatever follows them and in any case, and as a lost answer with the rules off', async () => {
    const wordings = [TOO_MANY_OUTSIDE_CALLS, `Error: ${TOO_MANY_OUTSIDE_CALLS} To avoid this error, see the platform's limits.`, TOO_MANY_OUTSIDE_CALLS.toUpperCase()]
    for (const words of wordings) {
      flags.listsOn = true
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error(words))
      const on = await deliver(bindings as never, message(reader(1)))
      expect(on, words).toEqual({ ok: false, limitRefused: true, error: words })
      expect(Object.keys(on)).not.toContain('noAnswer')
      flags.listsOn = false
      const off = await deliver(bindings as never, message(reader(1)))
      expect(off, words).toEqual({ ok: false, noAnswer: true, error: words })
      vi.restoreAllMocks()
    }
  })

  it('reads any other failure of the request as a lost answer, with the rules on too, and never as the limit', async () => {
    flags.listsOn = true
    for (const words of ['Network connection lost.', 'Too many requests', 'subrequests', 'The operation was aborted']) {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error(words))
      expect(await deliver(bindings as never, message(reader(1))), words).toEqual({ ok: false, noAnswer: true, error: words })
      vi.restoreAllMocks()
    }
    vi.spyOn(globalThis, 'fetch').mockRejectedValue('plain text, not an error')
    expect(await deliver(bindings as never, message(reader(1)))).toEqual({ ok: false, noAnswer: true, error: 'Unknown send error' })
  })

  it('a call refused past emailBehavior.limitAfter reaches no service, and a lost answer is the one that did', async () => {
    flags.listsOn = true
    emailBehavior.limitAfter = 0
    expect(await deliver(bindings as never, message(reader(1)))).toMatchObject({ ok: false, limitRefused: true })
    expect(emailOutbox).toEqual([])
    emailBehavior.limitAfter = null
    emailBehavior.loseAnswer = 1
    expect(await deliver(bindings as never, message(reader(2)))).toMatchObject({ ok: false, noAnswer: true })
    expect(emailOutbox.map((e) => e.to)).toEqual([reader(2)])
  })
})

describe('what each answer of the service means for a message', () => {
  // [status, with the rules on, with the rules off]
  const answers: Array<[number, 'later' | 'never', 'later' | 'never']> = [
    [429, 'later', 'later'],
    [503, 'later', 'later'],
    [401, 'later', 'never'],
    [403, 'later', 'never'],
    [500, 'never', 'later'],
    [502, 'never', 'later'],
    [504, 'never', 'later'],
    [400, 'never', 'never'],
    [404, 'never', 'never'],
    [422, 'never', 'never'],
  ]

  it.each(answers)('a %i from the service is %s with the rules on and %s with them off, and the log line names no address', async (status, on, off) => {
    const warn = vi.spyOn(console, 'warn')
    emailBehavior.succeed = false
    emailBehavior.status = status
    const note = { to: reader(1), subject: 'Fall news', html: '<p>Hi</p>' }
    flags.listsOn = true
    expect(await sendEmailOutcome(bindings, note)).toBe(on)
    flags.listsOn = false
    expect(await sendEmailOutcome(bindings, note)).toBe(off)
    expect(warn.mock.calls.map(([words]) => words)).toEqual([`Email send failed (${status}): ${JSON.stringify({ message: 'harness: simulated Resend outage' })}`, expect.stringContaining(`(${status})`)])
    expect(JSON.stringify(warn.mock.calls)).not.toContain('@')
    expect(emailOutbox).toEqual([])
  })

  it('a message that went is sent with either rule, and a refused address is never, with the log line naming the refusal and not the address', async () => {
    const warn = vi.spyOn(console, 'warn')
    await noLongerReceives(reader(2))
    flags.listsOn = true
    expect(await sendEmailOutcome(bindings, { to: reader(1), subject: 'Fall news', html: '<p>Hi</p>' })).toBe('sent')
    expect(await sendEmailOutcome(bindings, { to: reader(2), subject: 'Fall news', html: '<p>Hi</p>' })).toBe('never')
    expect(warn.mock.calls).toEqual([[REFUSAL_WORDS.do_not_send]])
    flags.listsOn = false
    expect(await sendEmailOutcome(bindings, { to: reader(1), subject: 'Fall news', html: '<p>Hi</p>' })).toBe('sent')
    expect(emailOutbox.map((e) => e.to)).toEqual([reader(1), reader(1)])
  })
})

describe('the daily run, run twice at once', () => {
  it('sends each reminder once when two runs read the same rows together', async () => {
    flags.listsOn = true
    const addresses = ['one@example.org', 'two@example.org', 'three@example.org']
    await dueToday(addresses)
    await Promise.all([runDaily(), runDaily()])
    expect(emailOutbox).toHaveLength(9)
    for (const address of addresses) expect(mailTo(address).map((e) => e.subject).sort(), address).toHaveLength(3)
    expect(new Set(emailOutbox.map((e) => `${e.to}|${e.subject}`)).size).toBe(9)
  })

  it('sends nothing for a row another run claimed between this run\'s read and its claim, in each of the three phases', async () => {
    flags.listsOn = true
    const { entered, rows } = await dueToday(['late@example.org'])
    const row = rows['late@example.org']
    const { db } = countingDb({
      afterAll: async (sql) => {
        if (sql.includes('tr.sent_registration_open = 0')) {
          await env.DB.prepare(`UPDATE tournament_reminders SET sent_registration_open = 1, registration_opened_notified_at = datetime('now') WHERE id = ?`).bind(row.open).run()
        } else if (sql.includes('tr.sent_week_before = 0')) {
          await env.DB.prepare('UPDATE tournament_reminders SET sent_week_before = 1 WHERE id = ?').bind(row.soon).run()
        } else if (sql.includes('FROM registrations r')) {
          await env.DB.prepare(`INSERT INTO tournament_attendee_reminders (id, tournament_id, member_id, reminder_number) VALUES (?, ?, ?, 1)`)
            .bind(`ar-${entered}-${row.member}-1`, entered, row.member).run()
        }
      },
    })
    await runDaily(db)
    expect(emailOutbox).toEqual([])
    expect(await reminderRow(row.open)).toMatchObject({ sent_registration_open: 1 })
    expect(await reminderRow(row.soon)).toMatchObject({ sent_week_before: 1 })
    expect(await attendeeRows(entered)).toBe(1)
  })
})

describe('the daily run, a claim given back and a claim kept', () => {
  it('every phase gives its claim back when the runtime refuses the call, and a second run on the same day sends all three', async () => {
    flags.listsOn = true
    const { entered, rows } = await dueToday(['limited@example.org'])
    const row = rows['limited@example.org']
    emailBehavior.limitAfter = 0
    await runDaily()
    expect(emailOutbox).toEqual([])
    expect(await reminderRow(row.open)).toEqual({ sent_registration_open: 0, sent_week_before: 0, registration_opened_notified_at: null })
    // The week-before row was due with its registration-open flag already set; only the week-before claim is given back.
    expect(await reminderRow(row.soon)).toMatchObject({ sent_registration_open: 1, sent_week_before: 0 })
    expect(await attendeeRows(entered)).toBe(0)
    emailBehavior.limitAfter = null
    await runDaily()
    expect(mailTo('limited@example.org')).toHaveLength(3)
    expect(await attendeeRows(entered)).toBe(1)
  })

  it('a 429 gives the claim back and ends the phase after one call; with the rules off every row is tried', async () => {
    const open = await seedTournament({ registrationStatus: 'open', date: dayFromToday(30) })
    const ids: string[] = []
    for (const address of ['a@example.org', 'b@example.org', 'c@example.org']) ids.push(await bell(open, await seedMember({ email: address }), address))
    emailBehavior.succeed = false
    emailBehavior.status = 429
    for (const [listsOn, calls] of [[true, 1], [false, 3]] as const) {
      flags.listsOn = listsOn
      const hosts = recordHosts()
      try {
        await runDaily()
      } finally {
        hosts.stop()
      }
      expect(hosts.hosts.filter((h) => h === 'api.resend.com'), `rules ${listsOn}`).toHaveLength(calls)
      for (const id of ids) expect(await reminderRow(id), `rules ${listsOn}`).toEqual({ sent_registration_open: 0, sent_week_before: 0, registration_opened_notified_at: null })
    }
  })

  it('a key refused with a 401 is given back and ends the phase as a 429 is', async () => {
    flags.listsOn = true
    const open = await seedTournament({ registrationStatus: 'open', date: dayFromToday(30) })
    const ids: string[] = []
    for (const address of ['a@example.org', 'b@example.org']) ids.push(await bell(open, await seedMember({ email: address }), address))
    emailBehavior.succeed = false
    emailBehavior.status = 401
    const hosts = recordHosts()
    try {
      await runDaily()
    } finally {
      hosts.stop()
    }
    expect(hosts.hosts.filter((h) => h === 'api.resend.com')).toHaveLength(1)
    for (const id of ids) expect((await reminderRow(id))?.sent_registration_open).toBe(0)
  })

  it('a 500 keeps the claim with the rules on, so the next run sends nothing; with the rules off the next run sends them', async () => {
    const open = await seedTournament({ registrationStatus: 'open', date: dayFromToday(30) })
    const ids: string[] = []
    for (const address of ['a@example.org', 'b@example.org', 'c@example.org']) ids.push(await bell(open, await seedMember({ email: address }), address))
    emailBehavior.succeed = false
    emailBehavior.status = 500
    flags.listsOn = true
    const hosts = recordHosts()
    try {
      await runDaily()
    } finally {
      hosts.stop()
    }
    // A 500 may come after the service took the message, so each row is tried once and none is tried again.
    expect(hosts.hosts.filter((h) => h === 'api.resend.com')).toHaveLength(3)
    for (const id of ids) expect((await reminderRow(id))?.sent_registration_open, id).toBe(1)
    emailBehavior.succeed = true
    await runDaily()
    expect(emailOutbox).toEqual([])

    flags.listsOn = false
    await env.DB.prepare(`UPDATE tournament_reminders SET sent_registration_open = 0, registration_opened_notified_at = NULL`).run()
    emailBehavior.succeed = false
    await runDaily()
    expect(emailOutbox).toEqual([])
    emailBehavior.succeed = true
    await runDaily()
    expect(emailOutbox.map((e) => e.to).sort()).toEqual(['a@example.org', 'b@example.org', 'c@example.org'])
  })

  it('a daily run over no rows reads no gate and makes no claim', async () => {
    flags.listsOn = true
    const { db, ran } = countingDb()
    await runDaily(db)
    expect(ran.filter((r) => /\bmail_|AND sent_registration_open = 0|AND sent_week_before = 0/.test(r.sql))).toEqual([])
    expect(emailOutbox).toEqual([])
  })
})

describe('the daily run\'s budget on the free plan, across its phases and its lookups', () => {
  it('spreads 25 reminders over the phases, the attendee and week-before reminders first; the next day sends the registration-open rows left and not the week-before rows past the cap, whose day has gone', async () => {
    flags.listsOn = true
    const clock = holdClock()
    const addresses = Array.from({ length: 20 }, (_, i) => `spread${i}@example.org`)
    const { soon, entered } = await dueToday(addresses)
    const subjects = () => ({
      open: emailOutbox.filter((e) => e.subject.startsWith('Registration is open')).length,
      week: emailOutbox.filter((e) => e.subject.startsWith('One week to go')).length,
      attendee: emailOutbox.filter((e) => e.subject.startsWith('See you')).length,
    })
    const weekBeforeLeft = () =>
      env.DB.prepare('SELECT COUNT(*) AS n FROM tournament_reminders WHERE tournament_id = ? AND sent_week_before = 0').bind(soon).first<{ n: number }>().then((r) => r?.n)
    await runDaily()
    expect(emailOutbox).toHaveLength(25)
    expect(subjects()).toEqual({ open: 0, week: 5, attendee: 20 })
    expect(await attendeeRows(entered)).toBe(20)
    resetHarness()
    clock.nextDay()
    await runDaily()
    expect(subjects()).toEqual({ open: 20, week: 0, attendee: 0 })
    // The 15 week-before rows past the first day's cap were never claimed, and the week-before query no longer reads
    // them: the follow-up for WS16 step 4 in REDESIGN_STATUS.md.
    expect(await weekBeforeLeft()).toBe(15)
    resetHarness()
    clock.nextDay()
    await runDaily()
    expect(emailOutbox).toEqual([])
  })

  // The day's 25 are rows claimed, a refused row included (see plan.ts), so what is held here is the ceiling and that no call is made for a dead address.
  it('keeps the day under 25 sends and 45 outside calls with a dead address among the rows, and calls no service for it', async () => {
    flags.listsOn = true
    const open = await seedTournament({ registrationStatus: 'open', date: dayFromToday(30) })
    const dead: string[] = []
    for (let i = 0; i < 30; i++) {
      await noLongerReceives(`dead${i}@example.org`)
      dead.push(await bell(open, await seedMember({ email: `dead${i}@example.org` }), `dead${i}@example.org`))
      const address = `live${i}@example.org`
      await bell(open, await seedMember({ email: address }), address)
    }
    await runDaily()
    expect(emailOutbox.length).toBeLessThanOrEqual(25)
    expect(emailOutbox.filter((e) => e.to.startsWith('dead'))).toEqual([])
    expect(fetchCount).toBeLessThanOrEqual(45)
  })

  /** Members with a US Chess ID the ratings service knows, not yet looked up, and the lookups a run makes. */
  async function ratedMembers(count: number): Promise<void> {
    for (let i = 0; i < count; i++) {
      const uscfId = `8${String(i).padStart(7, '0')}`
      uscfBehavior.members[uscfId] = rated(1300 + i)
      await seedMember({ email: `rated${i}@example.org`, uscfId })
    }
  }
  const lookedUp = () => env.DB.prepare('SELECT COUNT(*) AS n FROM members WHERE uscf_id IS NOT NULL AND uscf_rating_updated_at IS NOT NULL').first<{ n: number }>().then((r) => r?.n ?? 0)

  it('gives the lookups all 45 calls on a night with no reminder, and the next night the ones the first left', async () => {
    flags.listsOn = true
    await ratedMembers(60)
    await runDaily()
    expect(fetchCount).toBe(45)
    expect(await lookedUp()).toBe(45)
    resetHarness()
    uscfBehavior.members = {}
    for (let i = 0; i < 60; i++) uscfBehavior.members[`8${String(i).padStart(7, '0')}`] = rated(1300 + i)
    await runDaily()
    expect(fetchCount).toBe(45)
    expect(await lookedUp()).toBe(60)
  })

  it('gives the lookups what 3 reminders leave: 42 of the 45 calls', async () => {
    flags.listsOn = true
    await ratedMembers(60)
    const open = await seedTournament({ registrationStatus: 'open', date: dayFromToday(30) })
    for (const address of ['a@example.org', 'b@example.org', 'c@example.org']) await bell(open, await seedMember({ email: address }), address)
    const hosts = recordHosts()
    try {
      await runDaily()
    } finally {
      hosts.stop()
    }
    expect(emailOutbox).toHaveLength(3)
    expect(hosts.hosts.filter((h) => h === 'ratings-api.uschess.org')).toHaveLength(42)
    expect(fetchCount).toBe(45)
  })

  it('on Workers Paid looks every member up and sends every reminder, and with the rules off the lookups have no cap and go first', async () => {
    await ratedMembers(60)
    const open = await seedTournament({ registrationStatus: 'open', date: dayFromToday(30) })
    for (let i = 0; i < 30; i++) await bell(open, await seedMember({ email: `p${i}@example.org` }), `p${i}@example.org`)
    flags.listsOn = true
    flags.plan = 'paid'
    await runDaily()
    expect(emailOutbox).toHaveLength(30)
    expect(fetchCount).toBe(90)
    expect(await lookedUp()).toBe(60)

    resetHarness()
    for (let i = 0; i < 60; i++) uscfBehavior.members[`8${String(i).padStart(7, '0')}`] = rated(1400 + i)
    await env.DB.prepare('UPDATE members SET uscf_rating_updated_at = NULL WHERE uscf_id IS NOT NULL').run()
    await env.DB.prepare('UPDATE tournament_reminders SET sent_registration_open = 0, registration_opened_notified_at = NULL').run()
    flags.listsOn = false
    flags.plan = 'free'
    await runDaily()
    expect(emailOutbox).toHaveLength(30)
    expect(fetchCount).toBe(90)
  })
})

describe('role safety with the engine\'s rules on', () => {
  beforeEach(() => {
    flags.listsOn = true
  })

  it('the director\'s announce turns away no sign-in with 401, a member and an officer with 403, reads no gate and sends nothing', async () => {
    const tournamentId = await seedTournament({ name: 'Bayou Open' })
    await seedRegistration({ tournamentId, memberId: await seedMember({ email: 'entrant@example.org' }) })
    const body = { subject: 'Parking', body: 'Use the north lot.' }
    const { db, ran } = countingDb()
    const asked = [
      [undefined, 401],
      [await seedMember({ email: 'plain.member@example.org' }), 403],
      [await seedMember({ role: 'lca_officer', email: 'officer@example.org' }), 403],
    ] as const
    for (const [as, status] of asked) {
      const res = await invoke(announcePost, { method: 'POST', as, params: { id: tournamentId }, body, env: { DB: db } })
      expect(res.status, String(as)).toBe(status)
      expect(JSON.stringify(await res.json())).not.toContain('entrant@example.org')
    }
    expect(ran.filter((r) => /\bmail_/.test(r.sql))).toEqual([])
    expect(emailOutbox).toEqual([])
  })

  it('the registration status change turns away no sign-in with 401 and a member with 403, and starts no notice loop', async () => {
    const tournamentId = await seedTournament({ name: 'Bayou Open', registrationStatus: 'draft' })
    const row = await bell(tournamentId, await seedMember({ email: 'subscriber@example.org' }), 'subscriber@example.org')
    const { db, ran } = countingDb()
    for (const [as, status] of [[undefined, 401], [await seedMember({ email: 'plain.member@example.org' }), 403]] as const) {
      const res = await invoke(registrationStatusPatch, { method: 'PATCH', as, params: { id: tournamentId }, body: { registration_status: 'open' }, env: { DB: db } })
      expect(res.status, String(as)).toBe(status)
    }
    await flushWaitUntil()
    expect(ran.filter((r) => /\bmail_/.test(r.sql))).toEqual([])
    expect(emailOutbox).toEqual([])
    expect(await reminderRow(row)).toEqual({ sent_registration_open: 0, sent_week_before: 0, registration_opened_notified_at: null })
  })

  it('the director\'s announce with no entrant answers 400 and reads no gate', async () => {
    const tournamentId = await seedTournament({ name: 'Empty Open' })
    const { db, ran } = countingDb()
    const res = await invoke(announcePost, { method: 'POST', as: await seedAdmin(), params: { id: tournamentId }, body: { subject: 'Parking', body: 'Use the north lot.' }, env: { DB: db } })
    expect(res.status).toBe(400)
    expect(ran.filter((r) => /\bmail_/.test(r.sql))).toEqual([])
  })
})

describe('the director\'s announce and Group email\'s batch under the rules', () => {
  beforeEach(() => {
    flags.listsOn = true
  })

  it('counts every entrant in failed when all are dead, answers 200, and calls no service', async () => {
    const tournamentId = await seedTournament({ name: 'Bayou Open' })
    for (const address of ['gone1@example.org', 'gone2@example.org']) {
      await noLongerReceives(address)
      await seedRegistration({ tournamentId, memberId: await seedMember({ email: address }) })
    }
    const hosts = recordHosts()
    try {
      const res = await invoke(announcePost, { method: 'POST', as: await seedAdmin(), params: { id: tournamentId }, body: { subject: 'Parking', body: 'Use the north lot.' } })
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ sent: 0, failed: 2, total: 2 })
    } finally {
      hosts.stop()
    }
    expect(hosts.hosts.filter((h) => h === 'api.resend.com')).toEqual([])
    const logged = await env.DB.prepare(`SELECT detail FROM admin_audit_log WHERE action = 'announcement_sent' ORDER BY rowid DESC LIMIT 1`).first<{ detail: string }>()
    expect(JSON.parse(logged!.detail)).toMatchObject({ sent: 0, failed: 2 })
  })

  it('mails every entrant when its gate cannot be read, with one log line that names no address', async () => {
    const warn = vi.spyOn(console, 'warn')
    const tournamentId = await seedTournament({ name: 'Bayou Open' })
    for (const address of ['one@example.org', 'two@example.org']) await seedRegistration({ tournamentId, memberId: await seedMember({ email: address }) })
    const { db } = countingDb({ refuse: 'mail_do_not_send' })
    const res = await invoke(announcePost, { method: 'POST', as: await seedAdmin(), params: { id: tournamentId }, body: { subject: 'Parking', body: 'Use the north lot.' }, env: { DB: db } })
    expect(await res.json()).toEqual({ sent: 2, failed: 0, total: 2 })
    expect(warn.mock.calls.filter(([words]) => words === GATE_UNREAD_LOG)).toHaveLength(1)
    expect(JSON.stringify(warn.mock.calls)).not.toContain('@')
  })

  async function campaignOf(recipients: string[]): Promise<string> {
    const id = `campaign-edge-${nextSeq()}`
    await env.DB.prepare(`INSERT INTO email_campaigns (id, subject, body_html, filter_json, total_recipients) VALUES (?, 'Fall news', '<p>Hi</p>', '{}', ?)`).bind(id, recipients.length).run()
    for (const address of recipients) {
      await env.DB.prepare(`INSERT INTO email_campaign_recipients (id, campaign_id, member_id, email) VALUES (?, ?, NULL, ?)`).bind(`${id}-${address}`, id, address).run()
    }
    return id
  }
  const recipient = (id: string, address: string) =>
    env.DB.prepare('SELECT status, error, attempts FROM email_campaign_recipients WHERE id = ?').bind(`${id}-${address}`).first()

  it('writes a walk-in placeholder off as not a real address, tried once, and mails the other; with the rules off the placeholder is sent as today', async () => {
    const placeholder = 'guest-4@walkin.lca.invalid'
    const id = await campaignOf([placeholder, 'here@example.org'])
    expect(await processCampaign(bindings as never, id)).toEqual({ sent: 1, failed: 1, remaining: 0, done: true })
    expect(await recipient(id, placeholder)).toEqual({ status: 'failed', error: REFUSAL_WORDS.not_sendable, attempts: 1 })
    expect(emailOutbox.map((e) => e.to)).toEqual(['here@example.org'])

    flags.listsOn = false
    const today = await campaignOf([placeholder])
    expect(await processCampaign(bindings as never, today)).toEqual({ sent: 1, failed: 0, remaining: 0, done: true })
    expect(emailOutbox.map((e) => e.to)).toEqual(['here@example.org', placeholder])
  })

  it('mails a batch when the gate cannot be read, and reads the gate once for it when it can', async () => {
    const id = await campaignOf(['p@example.org', 'q@example.org', 'r@example.org'])
    const unread = countingDb({ refuse: 'mail_do_not_send' })
    expect(await processCampaign({ ...bindings, DB: unread.db } as never, id)).toEqual({ sent: 3, failed: 0, remaining: 0, done: true })
    const again = await campaignOf(['s@example.org', 't@example.org'])
    const read = countingDb()
    expect(await processCampaign({ ...bindings, DB: read.db } as never, again)).toEqual({ sent: 2, failed: 0, remaining: 0, done: true })
    expect(read.ran.filter((r) => r.sql.includes('mail_do_not_send')).map((r) => r.binds)).toEqual([2])
  })
})

describe('the tables on D1', () => {
  it('holds the two lists migration 0060 wrote, each one of LCA\'s main mailers with no club, and no other', async () => {
    const { results } = await env.DB.prepare('SELECT id, kind, name, main_mailer, club_id FROM mail_lists WHERE id != ? ORDER BY id').bind(CLUB_LIST).all()
    expect(results).toEqual([
      { id: 'lca-newsletter', kind: 'newsletter', name: 'LCA newsletter', main_mailer: 1, club_id: null },
      { id: 'lca-tournaments', kind: 'tournaments', name: 'LCA tournament email', main_mailer: 1, club_id: null },
    ])
  })

  it('has the four tables with 20 columns and the two campaign tables with the four added, 24 in all', async () => {
    expect(await columnsOf('mail_lists')).toEqual(['id', 'kind', 'name', 'main_mailer', 'club_id', 'created_at'])
    expect(await columnsOf('mail_contacts')).toEqual(['id', 'address', 'optional_off_at', 'complained_at', 'created_at'])
    expect(await columnsOf('mail_list_choices')).toEqual(['contact_id', 'list_id', 'choice', 'source', 'updated_at'])
    expect(await columnsOf('mail_do_not_send')).toEqual(['address', 'reason', 'detail', 'created_at'])
    expect(await columnsOf('email_campaigns')).toEqual(expect.arrayContaining(['list_id', 'skipped_count']))
    expect(await columnsOf('email_campaign_recipients')).toEqual(expect.arrayContaining(['contact_id', 'sending_at']))
  })

  it('gives today\'s campaign rows the new columns as nothing: no list, none skipped, no contact, nothing sent', async () => {
    const id = await campaignOf()
    const campaign = await env.DB.prepare('SELECT list_id, skipped_count FROM email_campaigns WHERE id = ?').bind(id).first()
    const recipient = await env.DB.prepare('SELECT contact_id, sending_at FROM email_campaign_recipients WHERE campaign_id = ?').bind(id).first()
    expect(campaign).toEqual({ list_id: null, skipped_count: 0 })
    expect(recipient).toEqual({ contact_id: null, sending_at: null })
  })
  async function campaignOf(): Promise<string> {
    const id = `campaign-cols-${nextSeq()}`
    await env.DB.prepare(`INSERT INTO email_campaigns (id, subject, body_html, filter_json, total_recipients) VALUES (?, 'Fall news', '<p>Hi</p>', '{}', 1)`).bind(id).run()
    await env.DB.prepare(`INSERT INTO email_campaign_recipients (id, campaign_id, member_id, email) VALUES (?, ?, NULL, ?)`).bind(`${id}-r`, id, 'here@example.org').run()
    return id
  }

  it('keeps one contact for an address, and one choice for a contact on a list', async () => {
    const id = await contact(reader(1), { choices: { [NEWSLETTER_LIST_ID]: { choice: 'out' } } })
    await expect(contact(reader(1))).rejects.toThrow()
    await expect(env.DB.prepare(`INSERT INTO mail_list_choices (contact_id, list_id, choice, source) VALUES (?, ?, 'in', 'link')`).bind(id, NEWSLETTER_LIST_ID).run()).rejects.toThrow()
  })

  it('lets an address with no member account hold a choice that stops list mail and no event mail', async () => {
    flags.listsOn = true
    const stranger = 'stranger@chess.test.lca'
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM members WHERE email = ?').bind(stranger).first()).toEqual({ n: 0 })
    await contact(stranger, { choices: { [NEWSLETTER_LIST_ID]: { choice: 'out' } } })
    expect(await deliver(bindings as never, message(stranger, { kind: 'optional', listId: NEWSLETTER_LIST_ID, headers: ONE_CLICK_HEADERS }))).toMatchObject({ ok: false, refused: 'opted_out' })
    expect(await deliver(bindings as never, message(stranger))).toEqual({ ok: true })
  })

  it('holds a family\'s one address as one choice for every account that writes it, and event mail still reaches each', async () => {
    flags.listsOn = true
    const family = 'family@chess.test.lca'
    for (const fullName of ['Pat Parent', 'Alpha Kid', 'Bravo Kid']) await seedMember({ email: family, fullName })
    await contact(family, { choices: { [NEWSLETTER_LIST_ID]: { choice: 'out' } } })
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM mail_contacts WHERE address = ?').bind(family).first()).toEqual({ n: 1 })
    const gate = await openGate(env.DB, ['Family@Chess.Test.LCA', family], NEWSLETTER_LIST_ID)
    expect(gate.refusal(family, 'optional', NEWSLETTER_LIST_ID)).toBe('opted_out')
    expect(gate.refusal('FAMILY@chess.test.lca', 'optional', NEWSLETTER_LIST_ID)).toBe('opted_out')
    expect(gate.refusal(family, 'event')).toBeNull()
  })

  it('takes a contact\'s or a list\'s choices with it, and will not delete a club from under its list', async () => {
    const id = await contact(reader(1), { choices: { [CLUB_LIST]: { choice: 'out' }, [NEWSLETTER_LIST_ID]: { choice: 'out' } } })
    const choices = () => env.DB.prepare('SELECT COUNT(*) AS n FROM mail_list_choices WHERE contact_id = ?').bind(id).first<{ n: number }>().then((r) => r?.n)
    expect(await choices()).toBe(2)
    await env.DB.prepare('DELETE FROM mail_lists WHERE id = ?').bind(CLUB_LIST).run()
    expect(await choices()).toBe(1)
    await env.DB.prepare('DELETE FROM mail_contacts WHERE id = ?').bind(id).run()
    expect(await choices()).toBe(0)

    const clubId = await seedClub({ name: 'Example Knights' })
    await env.DB.prepare(`INSERT INTO mail_lists (id, kind, name, main_mailer, club_id) VALUES ('club-knights', 'club', 'Example Knights news', 0, ?)`).bind(clubId).run()
    await expect(env.DB.prepare('DELETE FROM clubs WHERE id = ?').bind(clubId).run()).rejects.toThrow()
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM clubs WHERE id = ?').bind(clubId).first()).toEqual({ n: 1 })
  })
})

describe('the harness\'s knobs', () => {
  it('resetHarness gives every knob and the counter back, and a call past limitAfter is refused and not counted', async () => {
    emailBehavior.loseAnswer = 4
    emailBehavior.limitAfter = 2
    const lookup = () => fetch('https://ratings-api.uschess.org/api/v1/members/12345678')
    await lookup()
    await lookup()
    expect(fetchCount).toBe(2)
    await expect(lookup()).rejects.toThrow(TOO_MANY_OUTSIDE_CALLS)
    expect(fetchCount).toBe(2)
    resetHarness()
    expect([emailBehavior.loseAnswer, emailBehavior.limitAfter, fetchCount]).toEqual([null, null, 0])
    await lookup()
    expect(fetchCount).toBe(1)
  })

  it('invoke lays the bindings it is given over the pool\'s and leaves the rest, so a handler reads the wrapped database', async () => {
    const tournamentId = await seedTournament({ name: 'Bayou Open' })
    const { db, ran } = countingDb()
    const res = await invoke(announcePost, { method: 'POST', as: await seedAdmin(), params: { id: tournamentId }, body: { subject: 'Parking', body: 'Use the north lot.' }, env: { DB: db } })
    expect(res.status).toBe(400)
    const read = ran.length
    expect(read).toBeGreaterThan(0)
    // Without the override the handler reads the pool's own database, not the wrapper.
    const plain = await invoke(announcePost, { method: 'POST', as: await seedAdmin(), params: { id: tournamentId }, body: { subject: 'Parking', body: 'Use the north lot.' } })
    expect(plain.status).toBe(400)
    expect(ran.length).toBe(read)
  })
})
