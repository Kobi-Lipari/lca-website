// test/unit/published-review-notice.test.ts
//
// The notice of WS08 step 6 (D22, the email half of criterion 13 of brief
// 1.4's WS08 section), functions/utils/events/publishedReview.ts, on its own,
// in node, with a stand-in database that answers each of the notice's
// statements and keeps their order, and a stand-in transport that keeps each
// message it is handed:
// - eventDays at the edges the dates of an event meet: the two weekends the
//   clocks change in Louisiana, an instant either side of midnight in
//   Central time across both changes, an end date that names the start's
//   day with a time, a leap day, a span of three days, of a month and over
//   New Year, an end before the start as it is stored, and a stored day that
//   is no real date; and four hundred spans drawn at random, each against
//   the calendar worked out here, with a weekday on every day, "to" between
//   two days and never a dash;
// - sendPublishedReviewNotice reads the grant the creator holds now, then
//   sets the mark, then reads the event and the admins, and only then sends,
//   so the mark is set before the first email; a creator who is not a
//   standing director, or the constant unset, ends it after the creator's
//   row with nothing marked or sent; a mark that changes no row ends it with
//   nothing more read; an event gone after the mark sends nothing;
// - each message names one address, trimmed, two admin rows that differ
//   only in letter case or spaces at either end get one between them, a
//   send that fails or throws is counted out while the rest still go, and
//   the link is built on the site's address however SITE_URL is written,
//   with the event's id written whole;
// - the email's words: the subject, the heading, the four details in order,
//   the paragraph and the button, and the same lines in plain text;
// - the pace: 400 ms between one admin's email and the next, after a send
//   that fails as after one that goes, and no wait before the first or
//   after the last;
// - a failure of the database on any of its five statements, the creator's
//   row, the President seat, the mark, the event and the admins' addresses,
//   is caught there and logged, nothing more is read or sent, and it answers
//   whether the mark had been set by then, so the save that called it never
//   fails.
// CREATION_ROLES_ON is false in the tree; it is read here through a getter
// on the mocked module, set for every case but the one that unsets it.
// setTimeout is faked: it moves on at once, but for the cases on the pace,
// which move the clock by hand.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { eventDays, sendPublishedReviewNotice } from '../../functions/utils/events/publishedReview'

const flags = vi.hoisted(() => ({ rolesOn: true }))
vi.mock('../../functions/utils/events/creation', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/events/creation')>()
  return {
    ...real,
    get CREATION_ROLES_ON() {
      return flags.rolesOn
    },
  }
})

/** An en dash or an em dash, written by code so that this file holds neither. */
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

describe('eventDays at the edges of the calendar', () => {
  it('writes the weekends the clocks change in Louisiana day by day, a weekday on each', () => {
    // Clocks go forward on Sunday, March 8, 2026 and back on Sunday, November 1, 2026.
    expect(eventDays('2026-03-07', '2026-03-08')).toBe('Sat, Mar 7 to Sun, Mar 8, 2026')
    expect(eventDays('2026-03-08', null)).toBe('Sun, Mar 8, 2026')
    expect(eventDays('2026-10-31', '2026-11-01')).toBe('Sat, Oct 31 to Sun, Nov 1, 2026')
    expect(eventDays('2026-11-01', '2026-11-01')).toBe('Sun, Nov 1, 2026')
  })

  it('reads an instant on the day it falls on in Louisiana, either side of midnight, across both changes', () => {
    // Standard time until 8:00 AM UTC on Sunday, March 8, 2026: 11:59 PM on the Saturday, then midnight on the Sunday.
    expect(eventDays('2026-03-08T05:59:00Z', null)).toBe('Sat, Mar 7, 2026')
    expect(eventDays('2026-03-08T06:00:00Z', null)).toBe('Sun, Mar 8, 2026')
    // Daylight time until 7:00 AM UTC on Sunday, November 1, 2026, standard time after it.
    expect(eventDays('2026-11-01T04:59:00Z', null)).toBe('Sat, Oct 31, 2026')
    expect(eventDays('2026-11-01T05:00:00Z', null)).toBe('Sun, Nov 1, 2026')
    expect(eventDays('2026-11-02T05:59:00Z', null)).toBe('Sun, Nov 1, 2026')
    expect(eventDays('2026-11-02T06:00:00Z', null)).toBe('Mon, Nov 2, 2026')
    // An end at 9:30 PM in Louisiana, already Sunday in UTC, is the start's own day.
    expect(eventDays('2026-12-05', '2026-12-06T03:30:00Z')).toBe('Sat, Dec 5, 2026')
    expect(eventDays('2026-12-05', '2026-12-06T06:30:00Z')).toBe('Sat, Dec 5 to Sun, Dec 6, 2026')
  })

  it('reads an end date that names the start\'s day with a time as one day', () => {
    expect(eventDays('2026-12-05', '2026-12-05T19:00')).toBe('Sat, Dec 5, 2026')
    expect(eventDays('2026-12-05 09:00', '2026-12-05 19:00')).toBe('Sat, Dec 5, 2026')
    expect(eventDays('2026-12-05T09:00', '2026-12-06T09:00')).toBe('Sat, Dec 5 to Sun, Dec 6, 2026')
  })

  it('writes a leap day, three days, a month\'s turn and New Year with their own weekdays', () => {
    expect(eventDays('2028-02-28', '2028-02-29')).toBe('Mon, Feb 28 to Tue, Feb 29, 2028')
    expect(eventDays('2028-02-29', '2028-03-01')).toBe('Tue, Feb 29 to Wed, Mar 1, 2028')
    expect(eventDays('2026-12-04', '2026-12-06')).toBe('Fri, Dec 4 to Sun, Dec 6, 2026')
    expect(eventDays('2026-12-30', '2027-01-02')).toBe('Wed, Dec 30, 2026 to Sat, Jan 2, 2027')
    expect(eventDays('2030-12-31', '2031-01-01')).toBe('Tue, Dec 31, 2030 to Wed, Jan 1, 2031')
  })

  it('writes an end before the start as it is stored, and a stored day that is no real date as it is stored', () => {
    expect(eventDays('2026-12-06', '2026-12-05')).toBe('Sun, Dec 6 to Sat, Dec 5, 2026')
    expect(eventDays('2027-01-01', '2026-12-31')).toBe('Fri, Jan 1, 2027 to Thu, Dec 31, 2026')
    // The thirtieth of February is no day: it shows as stored rather than as a wrong day.
    expect(eventDays('2026-02-30', null)).toBe('2026-02-30')
  })

  it('gives four hundred spans drawn at random the calendar\'s own days: a weekday on each, the end\'s year always, the start\'s when the years differ, "to" between two days and no dash', () => {
    let state = 20261105
    /** A small seeded generator, so a failure names the same span every run. */
    const next = () => {
      state = (state + 0x6d2b79f5) | 0
      let t = Math.imul(state ^ (state >>> 15), 1 | state)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
    const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)
    const written = (ms: number, withYear: boolean) => {
      const d = new Date(ms)
      const text = `${WEEKDAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`
      return withYear ? `${text}, ${d.getUTCFullYear()}` : text
    }
    const DAY = 86_400_000
    const first = Date.UTC(2025, 0, 1)
    for (let i = 0; i < 400; i++) {
      const start = first + Math.floor(next() * 365 * 8) * DAY
      const span = Math.floor(next() * 10)
      const end = start + span * DAY
      const endDate = span === 0 && next() < 0.5 ? null : iso(end)
      const got = eventDays(iso(start), endDate)
      const sameYear = new Date(start).getUTCFullYear() === new Date(end).getUTCFullYear()
      const want = span === 0 ? written(start, true) : `${written(start, !sameYear)} to ${written(end, true)}`
      const label = `${iso(start)} to ${endDate}`
      expect(got, label).toBe(want)
      expect(got, label).not.toMatch(DASHES)
      expect(got, label).not.toMatch(/-/)
      expect(got.split(' to '), label).toHaveLength(span === 0 ? 1 : 2)
      for (const part of got.split(' to ')) expect(part, label).toMatch(/^(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat), (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}(?:, \d{4})?$/)
    }
  })
})

// The notice against a stand-in database and transport.

/** What the stand-in database answers, statement by statement. */
interface Answers {
  creator: { id: string; role: string; club_id: string | null } | null
  seat: boolean
  changes: number
  event: { id: string; name: string; date: string; end_date: string | null; full_name: string } | null
  admins: string[]
  /** The one statement that fails when it runs, by its kind, as D1 fails a statement whose connection drops. */
  fails?: string
}

/** What D1 throws when its connection drops under a statement. */
const D1_FAILURE = 'D1_ERROR: Network connection lost.'

/** What each statement the notice prepares is, by its words. */
function kindOf(sql: string): string {
  if (/^SELECT m\.id, m\.role, m\.club_id FROM tournaments t JOIN members m ON m\.id = t\.created_by WHERE t\.id = \?$/.test(sql)) return 'creator'
  if (/FROM board_seat_assignments/.test(sql)) return 'seat'
  if (/^UPDATE tournaments SET review_notified_at = /.test(sql)) return 'mark'
  if (/m\.full_name FROM tournaments t JOIN members m ON m\.id = t\.created_by WHERE t\.id = \?$/.test(sql)) return 'event'
  if (/FROM members WHERE role = 'lca_admin'/.test(sql)) return 'admins'
  return `unexpected: ${sql}`
}

/** A database that answers the notice's statements from `answers` and writes each one it runs, in order, to `timeline`. */
function standInDb(answers: Answers, timeline: string[], bound: Array<{ kind: string; args: unknown[] }>): D1Database {
  return {
    prepare(text: string) {
      const sql = text.replace(/\s+/g, ' ').trim()
      const kind = kindOf(sql)
      let args: unknown[] = []
      /** Keeps the statement as run, and fails it if it is the one that fails. */
      const ran = () => {
        timeline.push(kind)
        bound.push({ kind, args })
        if (kind === answers.fails) throw new Error(D1_FAILURE)
      }
      const statement = {
        bind(...values: unknown[]) {
          args = values
          return statement
        },
        async first() {
          ran()
          if (kind === 'creator') return answers.creator
          if (kind === 'seat') return answers.seat ? { 1: 1 } : null
          if (kind === 'event') return answers.event
          return null
        },
        async run() {
          ran()
          return { success: true, meta: { changes: kind === 'mark' ? answers.changes : 0 } }
        },
        async all() {
          ran()
          return { success: true, results: kind === 'admins' ? answers.admins.map((email) => ({ email, full_name: `Admin ${email}` })) : [] }
        },
      }
      return statement
    },
  } as unknown as D1Database
}

/** A message as the transport is handed it. */
interface Handed { url: string; to: string[]; from: string; reply_to: string[]; subject: string; html: string; text?: string }

const GERALD = { id: 'mem-gerald', role: 'tournament_director', club_id: null }
const QUADS = { id: 'lafayette-winter-quads', name: 'Lafayette Winter Quads', date: '2026-12-05', end_date: null, full_name: 'Gerald Landry' }
const AFTER_THE_FACT = "After the fact: nothing holds a standing director's event. It is already listed. Look it over when you can."

let timeline: string[]
let bound: Array<{ kind: string; args: unknown[] }>
let handed: Handed[]
/** How the transport answers an address: a status, or 'throw' for a request that never arrives. */
let transport: Map<string, number | 'throw'>

beforeEach(() => {
  flags.rolesOn = true
  timeline = []
  bound = []
  handed = []
  transport = new Map()
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as Omit<Handed, 'url'>
    handed.push({ url: String(input), ...body })
    timeline.push(`send ${body.to.join(',')}`)
    const answer = transport.get(body.to[0]) ?? 200
    if (answer === 'throw') throw new Error('the network is down')
    return new Response(JSON.stringify(answer === 200 ? { id: 'sent' } : { message: 'refused' }), { status: answer })
  }))
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.useFakeTimers({ toFake: ['setTimeout'] })
  vi.setTimerTickMode('nextTimerAsync')
})
afterEach(() => {
  flags.rolesOn = false
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const answersWith = (over: Partial<Answers> = {}): Answers => ({
  creator: GERALD, seat: false, changes: 1, event: QUADS, admins: ['a@lca.test', 'b@lca.test'], ...over,
})
const notice = (answers: Answers, env: { SITE_URL?: string; FROM_EMAIL?: string } = {}) =>
  sendPublishedReviewNotice({ DB: standInDb(answers, timeline, bound), RESEND_API_KEY: 're_unit_test', ...env }, QUADS.id)

describe('sendPublishedReviewNotice: the order of what it reads, writes and sends', () => {
  it('reads the creator\'s grant, then sets the mark, then reads the event and the admins, and only then sends, one message for each admin', async () => {
    expect(await notice(answersWith())).toEqual({ notified: true, sent: 2 })
    expect(timeline).toEqual(['creator', 'seat', 'mark', 'event', 'admins', 'send a@lca.test', 'send b@lca.test'])
    // Each statement about the event is bound to the event's id alone; the admins' read takes nothing.
    expect(bound.filter((b) => ['creator', 'mark', 'event'].includes(b.kind)).map((b) => b.args)).toEqual([[QUADS.id], [QUADS.id], [QUADS.id]])
    expect(bound.find((b) => b.kind === 'seat')?.args).toEqual([GERALD.id])
    expect(bound.find((b) => b.kind === 'admins')?.args).toEqual([])
  })

  it.each([
    ['an LCA admin', { id: 'mem-admin', role: 'lca_admin', club_id: null }, false, ['creator']],
    ['a club rep', { id: 'mem-rep', role: 'club_rep', club_id: 'club-1' }, false, ['creator', 'seat']],
    ['a standing director who holds the President seat', GERALD, true, ['creator', 'seat']],
    ['a plain member', { id: 'mem-plain', role: 'member', club_id: null }, false, ['creator', 'seat']],
    ['a guest', { id: 'mem-guest', role: 'guest', club_id: null }, false, ['creator', 'seat']],
    ['no one, an event with no creator', null, false, ['creator']],
  ] as const)('a creator who is %s: the mark is never tried, nothing else is read and nothing is sent', async (_, creator, seat, read) => {
    expect(await notice(answersWith({ creator, seat }))).toEqual({ notified: false, sent: 0 })
    expect(timeline).toEqual(read)
    expect(handed).toEqual([])
  })

  it('with the constant unset a tournament director is no standing director: the creator\'s row is read, the seat is not, and nothing is marked or sent', async () => {
    flags.rolesOn = false
    expect(await notice(answersWith())).toEqual({ notified: false, sent: 0 })
    expect(timeline).toEqual(['creator'])
    expect(handed).toEqual([])
  })

  it('a mark that changes no row, the event already marked or hidden again, ends it: nothing more is read and nothing is sent', async () => {
    expect(await notice(answersWith({ changes: 0 }))).toEqual({ notified: false, sent: 0 })
    expect(timeline).toEqual(['creator', 'seat', 'mark'])
    expect(handed).toEqual([])
  })

  it('an event gone between the mark and its read sends nothing, and answers that the mark was set', async () => {
    expect(await notice(answersWith({ event: null }))).toEqual({ notified: true, sent: 0 })
    expect(timeline).toEqual(['creator', 'seat', 'mark', 'event'])
    expect(handed).toEqual([])
  })

  it('with no admin address, the mark is set and nothing is sent', async () => {
    expect(await notice(answersWith({ admins: [] }))).toEqual({ notified: true, sent: 0 })
    expect(timeline).toEqual(['creator', 'seat', 'mark', 'event', 'admins'])
    expect(handed).toEqual([])
  })
})

describe('sendPublishedReviewNotice: one message for each address', () => {
  it('hands the transport one address each time, trimmed, one message for two rows that differ only in letter case or spaces, and the same message otherwise', async () => {
    // As the query orders them: a space sorts before a capital, a capital before a small letter.
    const admins = [' Board.Chair@LCA.test ', 'TREASURER@lca.test', 'board.chair@lca.test', 'treasurer@lca.test ']
    expect(await notice(answersWith({ admins }))).toEqual({ notified: true, sent: 2 })
    expect(handed.map((m) => m.to)).toEqual([['Board.Chair@LCA.test'], ['TREASURER@lca.test']])
    expect(new Set(handed.map((m) => m.url))).toEqual(new Set(['https://api.resend.com/emails']))
    expect(new Set(handed.map((m) => JSON.stringify([m.subject, m.html, m.text, m.from, m.reply_to]))).size).toBe(1)
    // No message names any address: no admin sees another's.
    for (const m of handed) for (const address of admins) expect(`${m.subject}\n${m.html}\n${m.text}`.toLowerCase()).not.toContain(address.trim().toLowerCase())
    expect(handed[0].from).toBe('Louisiana Chess Association <noreply@louisianachess.org>')
  })

  it('counts a send the transport refuses, and one that never arrives, out, while the rest still go', async () => {
    transport.set('a@lca.test', 500)
    transport.set('b@lca.test', 'throw')
    transport.set('c@lca.test', 422)
    const admins = ['a@lca.test', 'b@lca.test', 'c@lca.test', 'd@lca.test']
    expect(await notice(answersWith({ admins }))).toEqual({ notified: true, sent: 1 })
    expect(handed.map((m) => m.to[0])).toEqual(admins)
    expect(timeline.slice(0, 5)).toEqual(['creator', 'seat', 'mark', 'event', 'admins'])
  })
})

describe('sendPublishedReviewNotice: the email', () => {
  it('gives the subject, the heading, the four details in order, the paragraph and the button, and the same lines in plain text', async () => {
    await notice(answersWith({ admins: ['a@lca.test'] }))
    const [m] = handed
    const link = 'https://www.louisianachess.org/admin/tournaments/lafayette-winter-quads'
    expect(m.subject).toBe('Published by Gerald Landry, standing director: Lafayette Winter Quads (Sat, Dec 5, 2026)')
    expect(m.text).toBe([
      'A standing director published an event.',
      '',
      'Published by: Gerald Landry, standing director',
      'Event: Lafayette Winter Quads',
      'When: Sat, Dec 5, 2026',
      'Listed: now, on Tournaments',
      '',
      AFTER_THE_FACT,
      '',
      `Look it over: ${link}`,
    ].join('\n'))
    expect(m.html).toContain('<title>A standing director published an event</title>')
    expect(m.html).toMatch(/<h1[^>]*>A standing director published an event<\/h1>/)
    const order = [
      '>Published by<', '>Gerald Landry, standing director<', '>Event<', '>Lafayette Winter Quads<', '>When<', '>Sat, Dec 5, 2026<',
      '>Listed<', '>now, on Tournaments<', `>${AFTER_THE_FACT}<`, `href="${link}"`, '>Look it over<',
    ]
    const at = order.map((piece) => m.html.indexOf(piece))
    for (const [i, piece] of order.entries()) expect(at[i], piece).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })

  it('writes a two-day event day by day in the subject, the details and the text', async () => {
    await notice(answersWith({ admins: ['a@lca.test'], event: { ...QUADS, date: '2026-12-31', end_date: '2027-01-01' } }))
    const [m] = handed
    expect(m.subject).toBe('Published by Gerald Landry, standing director: Lafayette Winter Quads (Thu, Dec 31, 2026 to Fri, Jan 1, 2027)')
    expect(m.html).toContain('>Thu, Dec 31, 2026 to Fri, Jan 1, 2027<')
    expect(m.text?.split('\n')).toContain('When: Thu, Dec 31, 2026 to Fri, Jan 1, 2027')
    for (const text of [m.subject, m.html, m.text ?? '']) expect(text).not.toMatch(DASHES)
  })

  it.each([
    ['with a trailing slash and spaces', ' https://preview.lca.test/ ', 'https://preview.lca.test'],
    ['with two trailing slashes', 'https://preview.lca.test//', 'https://preview.lca.test'],
    ['unset', undefined, 'https://www.louisianachess.org'],
    ['blank', '   ', 'https://www.louisianachess.org'],
  ] as const)('builds the link on the site\'s address with SITE_URL %s, one slash before the path', async (_, siteUrl, origin) => {
    await notice(answersWith({ admins: ['a@lca.test'] }), siteUrl === undefined ? {} : { SITE_URL: siteUrl })
    const [m] = handed
    expect(m.html).toContain(`href="${origin}/admin/tournaments/lafayette-winter-quads"`)
    expect(m.html).toContain(`src="${origin}/email-logo.jpg"`)
    expect(m.text?.split('\n').at(-1)).toBe(`Look it over: ${origin}/admin/tournaments/lafayette-winter-quads`)
    expect(`${m.html}\n${m.text}`).not.toMatch(/[^:]\/\/admin/)
  })

  it('writes the event\'s id into the link whole, whatever it holds, so the link opens that event and no other', async () => {
    await notice(answersWith({ admins: ['a@lca.test'], event: { ...QUADS, id: 'gulf coast/quads & blitz #1?x' } }))
    const [m] = handed
    const path = '/admin/tournaments/gulf%20coast%2Fquads%20%26%20blitz%20%231%3Fx'
    expect(m.html).toContain(`href="https://www.louisianachess.org${path}"`)
    expect(m.text?.split('\n').at(-1)).toBe(`Look it over: https://www.louisianachess.org${path}`)
  })

  it('escapes the event\'s and the director\'s names in the html, and keeps them as written in the subject and the text', async () => {
    const event = { ...QUADS, name: 'Quads <b>& "Blitz"</b>', full_name: "Gerald O'Landry <TD>" }
    await notice(answersWith({ admins: ['a@lca.test'], event }))
    const [m] = handed
    expect(m.subject).toBe(`Published by Gerald O'Landry <TD>, standing director: Quads <b>& "Blitz"</b> (Sat, Dec 5, 2026)`)
    expect(m.text?.split('\n')).toContain('Event: Quads <b>& "Blitz"</b>')
    expect(m.html).toContain('>Quads &lt;b&gt;&amp; &quot;Blitz&quot;&lt;/b&gt;<')
    expect(m.html).toContain('>Gerald O&#39;Landry &lt;TD&gt;, standing director<')
    expect(m.html).not.toContain('<b>')
    expect(m.html).not.toContain('<TD>')
  })
})

describe('sendPublishedReviewNotice: the pace of the emails', () => {
  /** The addresses the transport has been handed, in order. */
  const sentTo = () => handed.map((m) => m.to[0])

  it('waits 400 ms between one admin\'s email and the next, with no wait before the first and none after the last', async () => {
    vi.setTimerTickMode('manual')
    const done = notice(answersWith({ admins: ['a@lca.test', 'b@lca.test', 'c@lca.test'] }))
    await vi.advanceTimersByTimeAsync(0)
    expect(sentTo()).toEqual(['a@lca.test'])
    await vi.advanceTimersByTimeAsync(399)
    expect(sentTo()).toEqual(['a@lca.test'])
    await vi.advanceTimersByTimeAsync(1)
    expect(sentTo()).toEqual(['a@lca.test', 'b@lca.test'])
    await vi.advanceTimersByTimeAsync(399)
    expect(sentTo()).toEqual(['a@lca.test', 'b@lca.test'])
    await vi.advanceTimersByTimeAsync(1)
    expect(await done).toEqual({ notified: true, sent: 3 })
    expect(sentTo()).toEqual(['a@lca.test', 'b@lca.test', 'c@lca.test'])
    expect(vi.getTimerCount()).toBe(0)
    // The mark was set before the first email, and nothing was read between the emails.
    expect(timeline).toEqual(['creator', 'seat', 'mark', 'event', 'admins', 'send a@lca.test', 'send b@lca.test', 'send c@lca.test'])
  })

  it('waits the same after a send the transport refuses, the email after it going 400 ms later', async () => {
    vi.setTimerTickMode('manual')
    transport.set('a@lca.test', 429)
    const done = notice(answersWith({ admins: ['a@lca.test', 'b@lca.test'] }))
    await vi.advanceTimersByTimeAsync(0)
    expect(sentTo()).toEqual(['a@lca.test'])
    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(399)
    expect(sentTo()).toEqual(['a@lca.test'])
    await vi.advanceTimersByTimeAsync(1)
    expect(await done).toEqual({ notified: true, sent: 1 })
    expect(sentTo()).toEqual(['a@lca.test', 'b@lca.test'])
  })

  it('sends one admin\'s email with no wait at all', async () => {
    vi.setTimerTickMode('manual')
    expect(await notice(answersWith({ admins: ['solo@lca.test'] }))).toEqual({ notified: true, sent: 1 })
    expect(sentTo()).toEqual(['solo@lca.test'])
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('sendPublishedReviewNotice: a failure of the database never reaches the save', () => {
  it.each([
    ['the creator\'s row', 'creator', false, ['creator']],
    ['the President seat', 'seat', false, ['creator', 'seat']],
    ['the mark\'s own statement', 'mark', false, ['creator', 'seat', 'mark']],
    ['the event\'s read, after the mark', 'event', true, ['creator', 'seat', 'mark', 'event']],
    ['the admins\' addresses, after the mark', 'admins', true, ['creator', 'seat', 'mark', 'event', 'admins']],
  ] as const)('on %s is caught and logged, nothing more is read or sent, and it answers whether the mark was set by then', async (_, fails, notified, read) => {
    await expect(notice(answersWith({ fails }))).resolves.toEqual({ notified, sent: 0 })
    expect(timeline).toEqual(read)
    expect(handed).toEqual([])
    expect(vi.mocked(console.warn).mock.calls).toEqual([
      [`published review notice failed for ${QUADS.id} (${notified ? 'after' : 'before'} the mark, 0 sent):`, D1_FAILURE],
    ])
  })
})
