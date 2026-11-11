// test/integration/mail-reminders-left.test.ts
//
// The daily run's attendee and week-before reminders under the mail
// engine's rules, as WS16 step 5 builds them, and the checked time a US
// Chess ID whose lookup finds nothing gets, through the daily-emails
// worker's own scheduled handler on the D1 database the migrations build.
// A 'later' among those reminders is sent again in the same run with the
// claim held, three sends at most, one second and then two seconds after
// the send before it, and from the run's first such 'later' each claim
// waits half a second; still 'later' after its three sends, the row's claim
// goes back and its phase ends, and the rows the phase leaves are counted
// in one log line that names no address. MAIL_LISTS_ON, MAIL_SENDER,
// WORKERS_PLAN and COMPLAINT_STOPS_OTHER_SENDERS are read through getters
// on the mocked functions/utils/mail/switches, over the real module, set
// before every case, so no value the code ships with decides one. The
// waits are real waits in the worker: every case runs with noWaits() from
// ./mailRuns, set before it, and run() below is the one way a case starts
// the daily run, so no case sleeps and the waits asked for are held as
// numbers. Nothing here reaches an outside service: the harness answers
// every host, and throttleMail answers the 429s.
//
// - (a) On Workers Paid, a 429 that passes among six attendee reminders,
//   and among six week-before reminders: each arrives once, in seven calls.
// - (b) A 429 that never passes: three calls for the first row, its claim
//   given back, the other rows untried, the count in the log, and the next
//   day's run sends none of them, which is the loss the record keeps.
// - (c) On the free plan: five first sends answered 429 once, and every row
//   needing three sends, counted against the 45 outside calls and the 50
//   queries; the first case also holds, in one log of the claims and the
//   waits, that the slowed gap comes before the claim it precedes.
// - (d) Two runs at once with a 429 among them send each reminder once at
//   most.
// - (e) The registration-open phase still ends on its first 'later', and
//   takes the gap once the run is slowed.
// - (f) With the rules off, a 429 among the attendee reminders leaves every
//   row tried once, with no wait, no claim, no stamp and no new log line.
// - (g) The checked time: snapshotMemberRatings with the option and
//   without it, and the daily run on the free plan over three nights, with
//   the rules on and off.
// - (h) The edges of the second try: the second attendee reminder phase, a
//   503 read as 'later' as a 429 is, a refusal of the message after a
//   'later' keeping its claim, the plan's calls running out in the middle of
//   a row's second send, and the week-before phase's count of what it left.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { snapshotMemberRatings } from '../../functions/utils/membership/ratingSnapshots'
import { seedMember, seedTournament } from './factories'
import { emailBehavior, emailOutbox, resetHarness, uscfBehavior } from './harness'
import { bell, countingDb, dayFromToday, holdClock, mailTo, nextSeq, noWaits, paidEntrants, rated, recordHosts, reminderRow, runDaily, throttleMail } from './mailRuns'

const flags = vi.hoisted(() => ({ listsOn: true, sender: 'resend', plan: 'free', complaintStops: true }))
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

const RATINGS_HOST = 'ratings-api.uschess.org'

/** The waits the code asked for since the case began, through the spy set before it. */
let waits: number[] = []

/** The daily run, the one way a case here starts it: answers the waits this run asked for, which took no time. */
async function run(db?: D1Database): Promise<number[]> {
  const from = waits.length
  await runDaily(db)
  return waits.slice(from)
}

/** The attendee reminders an event has on record: each row is a reminder's mark. */
const attendeeRows = (tournamentId: string) =>
  env.DB.prepare('SELECT COUNT(*) AS n FROM tournament_attendee_reminders WHERE tournament_id = ?').bind(tournamentId).first<{ n: number }>().then((r) => r?.n ?? 0)

/** The lines the run logged with console.warn that count the rows a phase left. */
const leftLines = (warn: { mock: { calls: unknown[][] } }) => warn.mock.calls.map(([words]) => String(words)).filter((words) => words.includes('not sent today'))

/** Members with a US Chess ID the ratings service knows, each at a made-up address. */
async function ratedMembers(count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    const uscfId = `7${String(nextSeq()).padStart(7, '0')}`
    uscfBehavior.members[uscfId] = rated(1300 + i)
    await seedMember({ email: `rated${uscfId}@example.org`, uscfId })
  }
}

/** Members with a US Chess ID the ratings service does not know, which it answers as not found. */
async function unknownMembers(count: number): Promise<string[]> {
  const ids: string[] = []
  for (let i = 0; i < count; i++) {
    const uscfId = `9${String(nextSeq()).padStart(7, '0')}`
    ids.push(await seedMember({ email: `unknown${uscfId}@example.org`, uscfId }))
  }
  return ids
}

const checkedTime = (memberId: string) =>
  env.DB.prepare('SELECT uscf_rating, uscf_rating_updated_at, uscf_expiration FROM members WHERE id = ?').bind(memberId)
    .first<{ uscf_rating: number | null; uscf_rating_updated_at: string | null; uscf_expiration: string | null }>()

const stamped = () =>
  env.DB.prepare('SELECT COUNT(*) AS n FROM members WHERE uscf_id IS NOT NULL AND uscf_rating_updated_at IS NOT NULL').first<{ n: number }>().then((r) => r?.n ?? 0)

beforeEach(async () => {
  resetHarness()
  flags.listsOn = true
  flags.sender = 'resend'
  flags.plan = 'free'
  flags.complaintStops = true
  waits = noWaits()
  for (const table of ['tournament_attendee_reminders', 'tournament_reminders', 'mail_list_choices', 'mail_contacts', 'mail_do_not_send']) {
    await env.DB.prepare(`DELETE FROM ${table}`).run()
  }
  await env.DB.prepare(`UPDATE tournaments SET reminder_1_enabled = 0, reminder_2_enabled = 0, registration_status = 'closed'`).run()
  // Only the members a case seeds are looked up for their ratings, so a case's counts are its own.
  await env.DB.prepare('UPDATE members SET uscf_id = NULL WHERE uscf_id IS NOT NULL').run()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('(a) a 429 that passes, on Workers Paid', () => {
  it('six attendee reminders with the third call to the mail service answered 429 once all arrive once each, in seven calls, the row sent again a second later and each claim after it half a second apart', async () => {
    flags.plan = 'paid'
    const warn = vi.spyOn(console, 'warn')
    const { tournamentId, addresses } = await paidEntrants(6)
    const throttle = throttleMail((call) => call === 3)
    let asked: number[]
    try {
      asked = await run()
    } finally {
      throttle.stop()
    }
    expect(throttle.mail()).toHaveLength(7)
    expect(throttle.mail().filter((c) => c.throttled)).toHaveLength(1)
    expect(emailOutbox).toHaveLength(6)
    for (const address of addresses) expect(mailTo(address), address).toHaveLength(1)
    expect(await attendeeRows(tournamentId)).toBe(6)
    expect(asked).toEqual([1000, 500, 500, 500])
    expect(leftLines(warn)).toEqual([])
  })

  it('the same among six week-before reminders', async () => {
    flags.plan = 'paid'
    const soon = await seedTournament({ name: `Sample Winter Quads ${nextSeq()}`, date: dayFromToday(7), registrationStatus: 'closed' })
    const rows: string[] = []
    const addresses: string[] = []
    for (let i = 0; i < 6; i++) {
      const address = `week${nextSeq()}@example.org`
      addresses.push(address)
      rows.push(await bell(soon, await seedMember({ email: address }), address, { registrationOpen: 1 }))
    }
    const throttle = throttleMail((call) => call === 3)
    let asked: number[]
    try {
      asked = await run()
    } finally {
      throttle.stop()
    }
    expect(throttle.mail()).toHaveLength(7)
    expect(emailOutbox).toHaveLength(6)
    for (const address of addresses) expect(mailTo(address).map((e) => e.subject), address).toEqual([expect.stringMatching(/^One week to go: Sample Winter Quads/)])
    for (const id of rows) expect((await reminderRow(id))?.sent_week_before, id).toBe(1)
    expect(asked).toEqual([1000, 500, 500, 500])
  })
})

describe('(b) a 429 that never passes', () => {
  it('makes three calls for the first row, gives its claim back, leaves the other rows untried, logs the count with no address, and the next day\'s run sends none of them', async () => {
    const clock = holdClock()
    const warn = vi.spyOn(console, 'warn')
    const { tournamentId } = await paidEntrants(4)
    const throttle = throttleMail(() => true)
    let asked: number[]
    try {
      asked = await run()
    } finally {
      throttle.stop()
    }
    expect(throttle.mail()).toHaveLength(3)
    expect(asked).toEqual([1000, 2000])
    expect(emailOutbox).toEqual([])
    expect(await attendeeRows(tournamentId)).toBe(0)
    expect(leftLines(warn)).toEqual(['daily-emails: 4 row(s) of "attendee reminder 1" not sent today'])
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(/@/)

    // The attendee query names the day each reminder falls on, so no later day reads these rows: the loss the record keeps.
    resetHarness()
    clock.nextDay()
    const next = recordHosts()
    try {
      await run()
    } finally {
      next.stop()
    }
    expect(next.hosts).toEqual([])
    expect(emailOutbox).toEqual([])
    expect(await attendeeRows(tournamentId)).toBe(0)
  })
})

describe('(c) the free plan\'s 45 outside calls and 50 queries', () => {
  it('30 attendee rows with five first sends answered 429 once give 25 sent, 30 calls to the mail service, 15 lookups and 45 outside calls, in 35 queries', async () => {
    const warn = vi.spyOn(console, 'warn')
    await ratedMembers(60)
    const { tournamentId } = await paidEntrants(30)
    const throttle = throttleMail((call) => [1, 3, 5, 7, 9].includes(call))
    // One log for the statements the database runs and the waits the spy is asked for, in the order they came.
    const log: string[] = []
    waits = noWaits(log)
    const { db, ran } = countingDb({ log })
    let asked: number[]
    try {
      asked = await run(db)
    } finally {
      throttle.stop()
    }
    // The slowed gap is waited before the claim of the row it precedes, so no claim is held across it: the first row's
    // claim and its wait of a second before its second send; for each of the next four rows the gap, its claim and its
    // own wait of a second; and from the sixth row on the gap and the claim alone.
    const claimsAndWaits = log.filter((entry) => entry.startsWith('wait ') || entry.includes('INSERT OR IGNORE INTO tournament_attendee_reminders'))
      .map((entry) => (entry.startsWith('wait ') ? entry : 'claim'))
    expect(claimsAndWaits).toEqual([
      'claim', 'wait 1000',
      ...Array.from({ length: 4 }, () => ['wait 500', 'claim', 'wait 1000']).flat(),
      ...Array.from({ length: 20 }, () => ['wait 500', 'claim']).flat(),
    ])
    expect(emailOutbox).toHaveLength(25)
    expect(new Set(emailOutbox.map((e) => e.to)).size).toBe(25)
    expect(await attendeeRows(tournamentId)).toBe(25)
    expect(throttle.mail()).toHaveLength(30)
    expect(throttle.calls.filter((c) => c.host === RATINGS_HOST)).toHaveLength(15)
    expect(throttle.calls).toHaveLength(45)
    // The rows' sends came before the lookups.
    expect(throttle.calls.map((c) => c.host).lastIndexOf('api.resend.com')).toBeLessThan(throttle.calls.map((c) => c.host).indexOf(RATINGS_HOST))
    // 3 for the bookkeeping phases; the attendee phase's find, its one gate for 30 addresses and its 25 claims; the
    // finds of the second attendee phase and the week-before phase, which read their rows once the budget is spent, so
    // as to count what they leave; none for the registration-open phase, which waits for the next day; no query for a
    // second send or a wait; and 3 for the lookups.
    expect(ran.length).toBe(35)
    expect(ran.length).toBeLessThan(50)
    expect(asked).toEqual([1000, ...Array.from({ length: 4 }, () => [500, 1000]).flat(), ...Array.from({ length: 20 }, () => 500)])
    expect(leftLines(warn)).toEqual(['daily-emails: 5 row(s) of "attendee reminder 1" not sent today'])
  })

  it('every row needing three sends gives 15 sent in 45 calls, no lookup, and the other 15 rows unclaimed', async () => {
    const warn = vi.spyOn(console, 'warn')
    await ratedMembers(10)
    const { tournamentId } = await paidEntrants(30)
    const throttle = throttleMail((call) => call % 3 !== 0)
    const { db, ran } = countingDb()
    let asked: number[]
    try {
      asked = await run(db)
    } finally {
      throttle.stop()
    }
    expect(emailOutbox).toHaveLength(15)
    expect(await attendeeRows(tournamentId)).toBe(15)
    expect(throttle.mail()).toHaveLength(45)
    expect(throttle.calls.filter((c) => c.host === RATINGS_HOST)).toEqual([])
    expect(throttle.calls).toHaveLength(45)
    expect(await stamped()).toBe(0)
    expect(ran.length).toBeLessThan(50)
    expect(asked).toEqual([1000, 2000, ...Array.from({ length: 14 }, () => [500, 1000, 2000]).flat()])
    expect(leftLines(warn)).toEqual(['daily-emails: 15 row(s) of "attendee reminder 1" not sent today'])
  })
})

describe('(d) two runs at once', () => {
  it('with a 429 among them, send each reminder once at most, and here every one once', async () => {
    const { tournamentId, addresses } = await paidEntrants(6)
    const throttle = throttleMail((call) => call === 2)
    try {
      await Promise.all([run(), run()])
    } finally {
      throttle.stop()
    }
    for (const address of addresses) expect(mailTo(address).length, address).toBeLessThanOrEqual(1)
    expect(emailOutbox.map((e) => e.to).sort()).toEqual([...addresses].sort())
    expect(await attendeeRows(tournamentId)).toBe(6)
  })
})

describe('(e) the registration-open phase', () => {
  it('still ends on its first later, its rows read again the next day, and takes the gap once the run is slowed', async () => {
    const clock = holdClock()
    const warn = vi.spyOn(console, 'warn')
    await paidEntrants(2)
    const open = await seedTournament({ name: `Sample Winter Open ${nextSeq()}`, registrationStatus: 'open', date: dayFromToday(30) })
    const rows: string[] = []
    for (let i = 0; i < 3; i++) {
      const address = `bell${nextSeq()}@example.org`
      rows.push(await bell(open, await seedMember({ email: address }), address))
    }
    // The first attendee send, and every call from the registration-open phase's first on.
    const throttle = throttleMail((call) => call === 1 || call >= 4)
    let asked: number[]
    try {
      asked = await run()
    } finally {
      throttle.stop()
    }
    expect(throttle.mail()).toHaveLength(4)
    expect(emailOutbox).toHaveLength(2)
    expect(emailOutbox.every((e) => e.subject.startsWith('See you'))).toBe(true)
    for (const id of rows) expect(await reminderRow(id), id).toEqual({ sent_registration_open: 0, sent_week_before: 0, registration_opened_notified_at: null })
    // The attendee row sent again a second after its 429, the second attendee row after the gap, and the
    // registration-open row after the gap and not again.
    expect(asked).toEqual([1000, 500, 500])
    expect(leftLines(warn)).toEqual([])

    resetHarness()
    clock.nextDay()
    await run()
    expect(emailOutbox.filter((e) => e.subject.startsWith('Registration is open'))).toHaveLength(3)
  })
})

describe('(f) with the rules off', () => {
  it('a 429 among the attendee reminders leaves every row tried once, with no wait, no claim, no stamp and no new log line, as today', async () => {
    flags.listsOn = false
    const warn = vi.spyOn(console, 'warn')
    const { tournamentId } = await paidEntrants(3)
    const [unknown] = await unknownMembers(1)
    const throttle = throttleMail(() => true)
    const { db, ran } = countingDb()
    let asked: number[]
    try {
      asked = await run(db)
    } finally {
      throttle.stop()
    }
    expect(throttle.mail()).toHaveLength(3)
    expect(asked).toEqual([])
    expect(emailOutbox).toEqual([])
    expect(await attendeeRows(tournamentId)).toBe(0)
    expect(ran.filter((r) => /INSERT OR IGNORE INTO tournament_attendee_reminders|AND sent_registration_open = 0|AND sent_week_before = 0|\bmail_/.test(r.sql))).toEqual([])
    // The lookup ran, as today, and found nothing: nothing is written for it.
    expect(throttle.calls.filter((c) => c.host === RATINGS_HOST)).toHaveLength(1)
    expect((await checkedTime(unknown))?.uscf_rating_updated_at).toBeNull()
    // Today's three lines, one for each send that failed, and nothing else.
    expect(warn.mock.calls.map(([words]) => words)).toEqual(Array.from({ length: 3 }, () => expect.stringMatching(/^Email send failed \(429\): /)))
  })
})

describe('(g) the checked time for a US Chess ID whose lookup finds nothing', () => {
  it('with stampUnanswered, a not-found ID gets the checked time alone, keeping its rating and its expiry', async () => {
    holdClock()
    const [member] = await unknownMembers(1)
    await env.DB.prepare(`UPDATE members SET uscf_rating = 1450, uscf_expiration = '2027-01-31' WHERE id = ?`).bind(member).run()
    const result = await snapshotMemberRatings(env.DB, { stampUnanswered: true })
    expect(result).toEqual({ checked: 1, changed: 0, unreachable: 0 })
    expect(await checkedTime(member)).toEqual({ uscf_rating: 1450, uscf_rating_updated_at: '2026-11-12T12:00:00.000Z', uscf_expiration: '2027-01-31' })
  })

  it('with stampUnanswered, an ID in the wrong form gets the checked time with no outside call', async () => {
    holdClock()
    const member = await seedMember({ email: `wrong-form${nextSeq()}@example.org`, uscfId: 'SAMPLE-ID' })
    const hosts = recordHosts()
    try {
      await snapshotMemberRatings(env.DB, { stampUnanswered: true })
    } finally {
      hosts.stop()
    }
    expect(hosts.hosts).toEqual([])
    expect((await checkedTime(member))?.uscf_rating_updated_at).toBe('2026-11-12T12:00:00.000Z')
  })

  it('with stampUnanswered, an answer with no id gets the checked time', async () => {
    holdClock()
    const uscfId = `9${String(nextSeq()).padStart(7, '0')}`
    const member = await seedMember({ email: `no-id${uscfId}@example.org`, uscfId })
    const underneath = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input))
      if (url.hostname === RATINGS_HOST && url.pathname.endsWith(`/members/${uscfId}`)) return Response.json({ firstName: 'Player', lastName: 'One' })
      return underneath(input, init)
    }) as typeof fetch
    try {
      expect(await snapshotMemberRatings(env.DB, { stampUnanswered: true })).toEqual({ checked: 1, changed: 0, unreachable: 0 })
    } finally {
      globalThis.fetch = underneath
    }
    expect((await checkedTime(member))?.uscf_rating_updated_at).toBe('2026-11-12T12:00:00.000Z')
  })

  it('stamps no one when the ratings service cannot be reached, with the option or without it', async () => {
    const [member] = await unknownMembers(1)
    uscfBehavior.reachable = false
    expect(await snapshotMemberRatings(env.DB, { stampUnanswered: true })).toEqual({ checked: 1, changed: 0, unreachable: 1 })
    expect(await snapshotMemberRatings(env.DB)).toEqual({ checked: 1, changed: 0, unreachable: 1 })
    expect((await checkedTime(member))?.uscf_rating_updated_at).toBeNull()
  })

  it('without the option writes nothing for a not-found ID, as before', async () => {
    const [member] = await unknownMembers(1)
    await env.DB.prepare(`UPDATE members SET uscf_rating = 1450 WHERE id = ?`).bind(member).run()
    expect(await snapshotMemberRatings(env.DB)).toEqual({ checked: 1, changed: 0, unreachable: 0 })
    expect(await checkedTime(member)).toEqual({ uscf_rating: 1450, uscf_rating_updated_at: null, uscf_expiration: null })
  })

  it('through the daily run on the free plan, 50 IDs the ratings service does not know and 60 it does all hold a checked time after three nights; with the rules off the 50 stay unstamped', async () => {
    const clock = holdClock()
    const unknown = await unknownMembers(50)
    await ratedMembers(60)
    // 45 lookups a night with no reminder due: 45, 90, then the last 20 and 25 checked before.
    const nights: number[] = []
    for (let night = 0; night < 3; night++) {
      if (night > 0) clock.nextDay()
      await run()
      nights.push(await stamped())
    }
    expect(nights).toEqual([45, 90, 110])

    await env.DB.prepare('UPDATE members SET uscf_rating_updated_at = NULL WHERE uscf_id IS NOT NULL').run()
    flags.listsOn = false
    clock.nextDay()
    await run()
    expect(await stamped()).toBe(60)
    for (const member of unknown) expect((await checkedTime(member))?.uscf_rating_updated_at, member).toBeNull()
  })
})

describe('(h) the edges of the second try', () => {
  it('the second attendee reminder phase sends a row again after a 429 as the first does, and logs nothing when every row arrives', async () => {
    flags.plan = 'paid'
    const warn = vi.spyOn(console, 'warn')
    const { tournamentId, addresses } = await paidEntrants(3)
    await env.DB.prepare('UPDATE tournaments SET reminder_1_enabled = 0, reminder_2_enabled = 1, reminder_2_days_before = 3 WHERE id = ?').bind(tournamentId).run()
    const throttle = throttleMail((call) => call === 1)
    let asked: number[]
    try {
      asked = await run()
    } finally {
      throttle.stop()
    }
    expect(throttle.mail()).toHaveLength(4)
    expect(emailOutbox.map((e) => e.to).sort()).toEqual([...addresses].sort())
    const marks = await env.DB.prepare('SELECT DISTINCT reminder_number AS n FROM tournament_attendee_reminders WHERE tournament_id = ?').bind(tournamentId).all<{ n: number }>()
    expect(marks.results).toEqual([{ n: 2 }])
    expect(asked).toEqual([1000, 500, 500])
    expect(leftLines(warn)).toEqual([])
  })

  it('reads a 503 as it reads a 429: three calls for the first row, its claim given back, and the count of the rest in the log', async () => {
    const warn = vi.spyOn(console, 'warn')
    const { tournamentId } = await paidEntrants(3)
    emailBehavior.succeed = false
    emailBehavior.status = 503
    const hosts = recordHosts()
    let asked: number[]
    try {
      asked = await run()
    } finally {
      hosts.stop()
    }
    expect(hosts.hosts.filter((h) => h === 'api.resend.com')).toHaveLength(3)
    expect(asked).toEqual([1000, 2000])
    expect(await attendeeRows(tournamentId)).toBe(0)
    expect(leftLines(warn)).toEqual(['daily-emails: 3 row(s) of "attendee reminder 1" not sent today'])
  })

  it('does not send again after an answer that is not a later one: a 500 is tried once per row, the claims are kept, no wait is asked for and nothing is logged', async () => {
    const warn = vi.spyOn(console, 'warn')
    const { tournamentId } = await paidEntrants(4)
    emailBehavior.succeed = false
    emailBehavior.status = 500
    const hosts = recordHosts()
    let asked: number[]
    try {
      asked = await run()
    } finally {
      hosts.stop()
    }
    expect(hosts.hosts.filter((h) => h === 'api.resend.com')).toHaveLength(4)
    expect(asked).toEqual([])
    expect(await attendeeRows(tournamentId)).toBe(4)
    expect(emailOutbox).toEqual([])
    expect(leftLines(warn)).toEqual([])
  })

  it('keeps the claim of a row the service refuses on its second send, goes on to the next rows, and leaves the run slowed', async () => {
    flags.plan = 'paid'
    const warn = vi.spyOn(console, 'warn')
    const { tournamentId, addresses } = await paidEntrants(3)
    const underneath = globalThis.fetch
    let mailCalls = 0
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (new URL(input instanceof Request ? input.url : String(input)).hostname === 'api.resend.com') {
        mailCalls++
        if (mailCalls === 1) return Response.json({ message: 'harness: too many requests' }, { status: 429 })
        if (mailCalls === 2) return Response.json({ message: 'harness: refused' }, { status: 422 })
      }
      return underneath(input, init)
    }) as typeof fetch
    let asked: number[]
    try {
      asked = await run()
    } finally {
      globalThis.fetch = underneath
    }
    expect(mailCalls).toBe(4)
    expect(emailOutbox).toHaveLength(2)
    expect(await attendeeRows(tournamentId)).toBe(3)
    expect(addresses.filter((a) => mailTo(a).length === 0)).toHaveLength(1)
    expect(asked).toEqual([1000, 500, 500])
    expect(leftLines(warn)).toEqual([])
  })

  it('gives the claim back and ends the phase when the plan\'s 45 outside calls run out in the middle of a row\'s second send', async () => {
    const warn = vi.spyOn(console, 'warn')
    await ratedMembers(5)
    const { tournamentId } = await paidEntrants(25)
    // Every row's first send is answered 429, so each needs two: 22 rows take 44 calls and the 23rd row's first is the 45th.
    const throttle = throttleMail((call) => call % 2 === 1)
    let asked: number[]
    try {
      asked = await run()
    } finally {
      throttle.stop()
    }
    expect(throttle.calls).toHaveLength(45)
    expect(throttle.mail()).toHaveLength(45)
    expect(emailOutbox).toHaveLength(22)
    expect(await attendeeRows(tournamentId)).toBe(22)
    expect(await stamped()).toBe(0)
    expect(asked).toEqual([1000, ...Array.from({ length: 21 }, () => [500, 1000]).flat(), 500])
    expect(leftLines(warn)).toEqual(['daily-emails: 3 row(s) of "attendee reminder 1" not sent today'])
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(/@/)
  })

  it('counts what the week-before phase leaves in the log by its name, with no address', async () => {
    const warn = vi.spyOn(console, 'warn')
    const soon = await seedTournament({ name: `Sample Winter Quads ${nextSeq()}`, date: dayFromToday(7), registrationStatus: 'closed' })
    for (let i = 0; i < 27; i++) {
      const address = `week${nextSeq()}@example.org`
      await bell(soon, await seedMember({ email: address }), address, { registrationOpen: 1 })
    }
    await run()
    expect(emailOutbox).toHaveLength(25)
    expect(leftLines(warn)).toEqual(['daily-emails: 2 row(s) of "week-before reminders" not sent today'])
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(/@/)
  })

  it('the stamp writes no rating history for an ID that finds nothing, and the rows of a batch that did find one are written as before', async () => {
    holdClock()
    const [unknown] = await unknownMembers(1)
    const knownId = `7${String(nextSeq()).padStart(7, '0')}`
    uscfBehavior.members[knownId] = rated(1500)
    const known = await seedMember({ email: `known${knownId}@example.org`, uscfId: knownId })
    const history = (id: string) => env.DB.prepare('SELECT COUNT(*) AS n FROM uscf_rating_history WHERE member_id = ?').bind(id).first<{ n: number }>().then((r) => r?.n ?? 0)
    expect(await snapshotMemberRatings(env.DB, { stampUnanswered: true })).toEqual({ checked: 2, changed: 1, unreachable: 0 })
    expect(await history(unknown)).toBe(0)
    expect(await history(known)).toBeGreaterThan(0)
    expect((await checkedTime(unknown))?.uscf_rating).toBeNull()
    expect((await checkedTime(known))?.uscf_rating).toBe(1500)
    expect((await checkedTime(known))?.uscf_rating_updated_at).toBe('2026-11-12T12:00:00.000Z')
  })
})
