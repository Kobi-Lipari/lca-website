// test/integration/club-suggest-club-edges.test.ts
//
// The edges of Suggest a club and Start a club (WS09's thirtieth step), beside
// club-suggest-club.test.ts, which holds the main cases: POST /api/clubs/reports,
// the rows in GET /api/workspace/region and POST /api/admin/club-reports/[reportId].
// Here:
// - the two limits under requests at the same moment (a race test: the count
//   is one statement, so no more than the limit gets through);
// - the same answer for every place, found or not, an open seat or a held one;
// - a row's age in whole days at midnight and over each change of the clock in
//   America/Chicago (the age is whole days of 24 hours from the stored UTC stamp);
// - the shapes of an id and of a body, and the order of the guards on Mark as
//   handled, so one who may not answer learns nothing of a row's state;
// - seats that have ended, seats that are not active, a holder of two seats;
// - rows written by hand with words that cannot be read, and what the
//   stranger's words become on the row and in the answer;
// - the two halves apart: the door open with the keepers' side shut, and back;
// - every email read for the plain-language rules, and for what it holds when
//   a keeper's address is not taken.
// Each case sets CLUB_PAGES_ON and CLUB_KEEPERS_ON itself through a getter on
// a mock of their module, and MAIL_LISTS_ON and MAIL_SENDER through getters
// on a mock of the mail switches, as the sibling files do; no case reads a
// shipped value of any switch. Every
// club, person and address is made up; ZIP codes and town names are
// Louisiana's own, the data under test.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { REGIONS } from '../../domain/clubs/regions'
import { CLUB_REQUEST_SEND } from '../../domain/clubs/newClub'
import { CLUB_REQUESTS_BUSY, onRequestPost as requestPost } from '../../functions/api/clubs/reports'
import * as handledFile from '../../functions/api/admin/club-reports/[reportId]'
import {
  ALREADY_HANDLED, NOT_A_REQUEST, NOT_YOUR_REGION, REQUESTS_CLOSED, REQUESTS_FOR_KEEPERS, onRequestPost as handledPost,
} from '../../functions/api/admin/club-reports/[reportId]'
import { onRequestGet as regionGet } from '../../functions/api/workspace/region'
import { CLUB_REQUEST_NOT_SENT_LOG } from '../../functions/utils/clubs/clubRequests'
import { CLUB_REQUEST_SUBJECTS, SUGGESTION_FOOTER } from '../../functions/utils/clubs/emails'
import { ADDRESS_HEADER, TOO_MANY } from '../../functions/utils/rateLimit'
import type { Env } from '../../functions/types'
import type { WorkspaceRegionResponse } from '../../domain/contracts'
import { seedMember } from './factories'
import { emailBehavior, emailOutbox, invoke, resetHarness } from './harness'

/** US Chess's old initials, built in two parts so this file does not spell them. */
const OLD_NAME = new RegExp(`\\b${'US' + 'CF'}\\b`)

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

const [NEW_ORLEANS, BATON_ROUGE, LAFAYETTE, LAKE_CHARLES, NORTH] = REGIONS
const KEYED = {
  SIGNING_SECRET: 'example-made-up-signing-key-for-new-clubs-00030',
  TURNSTILE_SECRET_KEY: 'example-made-up-spam-check-secret-0030',
}
const SLOW = 60_000

let seq = 0
const mark = () => `${++seq}${crypto.randomUUID().slice(0, 6)}`
const place = () => (++seq % 2 === 0 ? `198.51.100.${seq % 250}` : `203.0.113.${seq % 250}`)
/** A made-up network address of its own for each of n requests. */
const places = (n: number) => Array.from({ length: n }, (_, i) => `198.51.100.${(seq++ + i) % 250}`)

beforeEach(async () => {
  resetHarness()
  flags.pagesOn = false
  flags.keepersOn = false
  flags.listsOn = false
  flags.sender = 'resend'
  const middle = new Date()
  middle.setUTCMinutes(30, 0, 0)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(middle)
  await env.DB.prepare(`UPDATE board_seat_assignments SET ended_at = datetime('now') WHERE ended_at IS NULL`).run()
  await env.DB.prepare(`UPDATE club_reports SET status = 'answered' WHERE club_id IS NULL AND status = 'open'`).run()
  await env.DB.prepare('DELETE FROM rate_limits').run()
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

interface Person { id: string; name: string; email: string }

/** A seat over the regions, held now by the member, or held once and ended, or held but not active. */
async function giveSeat(regions: string[], memberId: string, how: 'held' | 'ended' | 'inactive' = 'held'): Promise<void> {
  const seat = `seat-${mark()}`
  await env.DB.prepare(
    `INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active) VALUES (?, 'Example Region Representative', '', 99, ?, 'regional_rep', ?)`,
  ).bind(seat, seat, how === 'inactive' ? 0 : 1).run()
  for (const region of regions) await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(seat, region).run()
  await env.DB.prepare(`INSERT INTO board_seat_assignments (seat_id, member_id${how === 'ended' ? ', ended_at' : ''}) VALUES (?, ?${how === 'ended' ? ", datetime('now')" : ''})`)
    .bind(seat, memberId).run()
}

async function person(opts: { role?: string } = {}): Promise<Person> {
  const m = mark()
  const made = { id: '', name: `Example Person ${m}`, email: `person-${m}@example.org` }
  made.id = await seedMember({ fullName: made.name, email: made.email, role: opts.role as never })
  return made
}

async function rep(regions: string | string[], how: 'held' | 'ended' | 'inactive' = 'held'): Promise<Person> {
  const made = await person()
  await giveSeat(Array.isArray(regions) ? regions : [regions], made.id, how)
  return made
}

async function onlyAdmin(): Promise<Person> {
  await env.DB.prepare(`UPDATE members SET role = 'member' WHERE role = 'lca_admin'`).run()
  return person({ role: 'lca_admin' })
}

function request(over: Record<string, unknown> = {}) {
  const m = mark()
  return {
    kind: 'new_club',
    clubName: `Example Knights Club ${m}`,
    place: '70791',
    message: `Tuesdays at 7:00 PM at the Example Library, ${m}.`,
    name: `Player One ${m}`,
    email: `player-${m}@example.org`,
    token: 'example-made-up-token',
    ...over,
  }
}

const post = (body: unknown, opts: { address?: string; over?: Partial<Env>; as?: string; headers?: Record<string, string> } = {}) =>
  invoke(requestPost, {
    method: 'POST',
    body,
    env: opts.over ?? KEYED,
    path: '/api/clubs/reports',
    headers: { [ADDRESS_HEADER]: opts.address ?? place(), ...opts.headers },
    as: opts.as,
  })

const handle = (reportId: number | string, as?: string, body: unknown = { action: 'handled' }) =>
  invoke(handledPost, { method: 'POST', params: { reportId: String(reportId) }, body, env: KEYED, path: `/api/admin/club-reports/${reportId}`, as })

const regionOf = (as: string) => invoke(regionGet, { as, path: '/api/workspace/region' })
const requestsOf = async (as: string) => (await (await regionOf(as)).json<WorkspaceRegionResponse>()).clubRequests

interface Row {
  id: number
  club_id: string | null
  kind: string
  message: string
  proposed_json: string | null
  region: string | null
  reporter_email: string | null
  status: string
  resolved_by: string | null
  resolved_at: string | null
}
const lastRow = async () => (await env.DB.prepare('SELECT * FROM club_reports WHERE club_id IS NULL ORDER BY id DESC LIMIT 1').first<Row>())!
const rowById = async (id: number) => (await env.DB.prepare('SELECT * FROM club_reports WHERE id = ?').bind(id).first<Row>())!
const auditCount = async (actor: string) =>
  (await env.DB.prepare(`SELECT COUNT(*) AS n FROM admin_audit_log WHERE action = 'club_request_handled' AND actor_id = ?`).bind(actor).first<{ n: number }>())!.n

/** A row written by hand, as the door would write it, but for the words under test. */
async function insertRow(over: { kind?: string; region?: string | null; proposed?: string | null; email?: string | null; message?: string; createdAt?: string } = {}): Promise<number> {
  const made = await env.DB.prepare(
    `INSERT INTO club_reports (club_id, kind, message, proposed_json, region, reporter_email, created_at)
     VALUES (NULL, ?, ?, ?, ?, ?, COALESCE(?, datetime('now'))) RETURNING id`,
  ).bind(
    over.kind ?? 'new_club',
    over.message ?? 'Tuesdays at 7:00 PM at the Example Library.',
    over.proposed === undefined ? JSON.stringify({ clubName: 'Example Pawns Club', place: '70791', name: 'Player Two' }) : over.proposed,
    over.region === undefined ? BATON_ROUGE : over.region,
    over.email === undefined ? 'player.two@example.org' : over.email,
    over.createdAt ?? null,
  ).first<{ id: number }>()
  return made!.id
}

/** The stored stamp of an instant: UTC, as SQLite's datetime('now') writes it. */
const stamp = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ')
const HOUR = 3_600_000
const DAY = 24 * HOUR

async function logsOf(work: () => Promise<void>): Promise<string[]> {
  const lines: string[] = []
  for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => { lines.push(args.map((a) => (a instanceof Error ? a.message : typeof a === 'string' ? a : JSON.stringify(a))).join(' ')) })
  }
  await work()
  return lines
}

describe('the limits under requests at the same moment', () => {
  it('lets no more than ten in an hour reach one representative when twelve places ask at once', async () => {
    flags.pagesOn = true
    await onlyAdmin()
    const holder = await rep(LAKE_CHARLES)
    const answers = await Promise.all(places(12).map((address) => post(request({ place: '70601' }), { address })))
    const statuses = answers.map((a) => a.status).sort()
    expect(statuses.filter((s) => s === 200)).toHaveLength(10)
    expect(statuses.filter((s) => s === 429)).toHaveLength(2)
    for (const refused of answers.filter((a) => a.status === 429)) expect(await refused.json()).toEqual({ error: CLUB_REQUESTS_BUSY })
    const saved = await env.DB.prepare(`SELECT COUNT(*) AS n FROM club_reports WHERE club_id IS NULL AND status = 'open' AND region = ?`).bind(LAKE_CHARLES).first<{ n: number }>()
    expect(saved!.n).toBe(10)
    expect(emailOutbox.filter((e) => e.to === holder.email)).toHaveLength(10)
  }, SLOW)

  it('lets no more than five in an hour from one place when eight come at once', async () => {
    flags.pagesOn = true
    await onlyAdmin()
    const here = place()
    const answers = await Promise.all(Array.from({ length: 8 }, () => post(request({ place: 'Example Nowhere' }), { address: here })))
    expect(answers.filter((a) => a.status === 200)).toHaveLength(5)
    const refused = answers.filter((a) => a.status === 429)
    expect(refused).toHaveLength(3)
    for (const one of refused) expect(await one.json()).toEqual({ error: TOO_MANY })
    expect((await env.DB.prepare(`SELECT COUNT(*) AS n FROM club_reports WHERE club_id IS NULL AND status = 'open'`).first<{ n: number }>())!.n).toBe(5)
  }, SLOW)

  it('starts the count afresh when the hour turns, for the place and for the keepers', async () => {
    flags.pagesOn = true
    await onlyAdmin()
    const here = place()
    for (let i = 0; i < 5; i++) expect((await post(request({ place: 'Example Nowhere' }), { address: here })).status).toBe(200)
    expect((await post(request({ place: 'Example Nowhere' }), { address: here })).status).toBe(429)
    vi.setSystemTime(Date.now() + HOUR)
    expect((await post(request({ place: 'Example Nowhere' }), { address: here })).status).toBe(200)
  }, SLOW)
})

describe('the answer is the same for every place', () => {
  it('answers a place found, a place not found, an open seat and a signed-in sender alike, saying nothing of a region or a keeper', async () => {
    flags.pagesOn = true
    const admin = await onlyAdmin()
    const holder = await rep(NORTH)
    const member = await person()
    const seen: Array<{ status: number; text: string; headers: string }> = []
    for (const [typed, as] of [['71201', undefined], ['Example Nowhere', undefined], ['70112', undefined], ['Shreveport', member.id], ['90210', undefined]] as const) {
      const result = await post(request({ place: typed }), { as })
      seen.push({ status: result.status, text: await result.response.clone().text(), headers: [...result.response.headers].filter(([k]) => ['content-type', 'cache-control'].includes(k)).map((h) => h.join(':')).sort().join('|') })
    }
    expect(new Set(seen.map((s) => JSON.stringify(s))).size).toBe(1)
    expect(seen[0]).toMatchObject({ status: 200, text: JSON.stringify({ sent: true }) })
    expect(seen[0].headers).toContain('cache-control:no-store')
    const everything = JSON.stringify(seen)
    for (const word of [...REGIONS, holder.email, admin.email, 'representative']) expect(everything).not.toContain(word)
  }, SLOW)

  it('names no region or keeper in a refusal either', async () => {
    flags.pagesOn = true
    await onlyAdmin()
    await rep(NORTH)
    const here = place()
    const refused: string[] = []
    refused.push(await (await post({ kind: 'new_club' }, { address: here })).response.text())
    for (let i = 0; i < 5; i++) await post(request({ place: '71201' }), { address: here })
    refused.push(await (await post(request({ place: '71201' }), { address: here })).response.text())
    for (const text of refused) for (const word of [...REGIONS, 'representative', '71201']) expect(text).not.toContain(word)
  }, SLOW)
})

describe('a row\'s age in My region, in whole days of 24 hours from the stored UTC stamp', () => {
  async function ageAt(now: string, createdAt: string): Promise<number> {
    vi.setSystemTime(new Date(now))
    const admin = await onlyAdmin()
    const id = await insertRow({ createdAt })
    const row = (await requestsOf(admin.id))!.find((r) => r.id === id)
    await env.DB.prepare(`UPDATE club_reports SET status = 'answered' WHERE id = ?`).bind(id).run()
    return row!.ageDays
  }

  it('turns over at 24 hours exactly, not a second before', async () => {
    flags.keepersOn = true
    const now = Date.UTC(2026, 10, 25, 18, 0, 0)
    for (const [after, days] of [[0, 0], [DAY - 1000, 0], [DAY, 1], [2 * DAY - 1000, 1], [14 * DAY - 1000, 13], [14 * DAY, 14], [60 * DAY, 60]] as const) {
      expect(await ageAt(new Date(now).toISOString(), stamp(now - after)), `${after}`).toBe(days)
    }
  })

  it('never goes below 0 for a stamp ahead of the clock, and is 0 for a stamp that cannot be read', async () => {
    flags.keepersOn = true
    const now = Date.UTC(2026, 10, 25, 18, 0, 0)
    expect(await ageAt(new Date(now).toISOString(), stamp(now + 3 * DAY))).toBe(0)
    expect(await ageAt(new Date(now).toISOString(), 'not a time')).toBe(0)
  })

  it('does not move at midnight in Chicago: the day turns 24 hours after the stamp, wherever midnight falls', async () => {
    flags.keepersOn = true
    // Written at 11:59:59 PM on Monday, November 23, 2026 in Chicago (05:59:59 UTC on Tuesday, November 24).
    const written = '2026-11-24 05:59:59'
    expect(await ageAt('2026-11-24T06:00:00Z', written)).toBe(0)
    expect(await ageAt('2026-11-25T05:59:58Z', written)).toBe(0)
    expect(await ageAt('2026-11-25T05:59:59Z', written)).toBe(1)
  })

  it('does not move when the clocks go back in Chicago (Sunday, November 1, 2026: a day of 25 hours)', async () => {
    flags.keepersOn = true
    // Written at 7:00 AM Chicago time on Saturday, October 31 (12:00 UTC). The wall clocks read 23 hours apart a day
    // later, 24 hours have gone by: one whole day, not none.
    const written = '2026-10-31 12:00:00'
    expect(await ageAt('2026-11-01T11:59:59Z', written)).toBe(0)
    expect(await ageAt('2026-11-01T12:00:00Z', written)).toBe(1)
  })

  it('does not move when the clocks go forward in Chicago (Sunday, March 8, 2026: a day of 23 hours)', async () => {
    flags.keepersOn = true
    // Written at 6:00 AM Chicago time on Saturday, March 7 (12:00 UTC). A day later the wall clocks read 6:00 AM again
    // after 23 hours: not yet a whole day. 24 hours on it is.
    const written = '2026-03-07 12:00:00'
    expect(await ageAt('2026-03-08T11:00:00Z', written)).toBe(0)
    expect(await ageAt('2026-03-08T11:59:59Z', written)).toBe(0)
    expect(await ageAt('2026-03-08T12:00:00Z', written)).toBe(1)
  })

  it('lists the rows oldest first, those written in the same second by their number', async () => {
    flags.keepersOn = true
    const admin = await onlyAdmin()
    const newest = await insertRow({ createdAt: '2026-11-20 10:00:00' })
    const oldest = await insertRow({ createdAt: '2026-11-01 10:00:00' })
    const tieA = await insertRow({ createdAt: '2026-11-10 10:00:00' })
    const tieB = await insertRow({ createdAt: '2026-11-10 10:00:00' })
    const ids = (await requestsOf(admin.id))!.map((r) => r.id)
    expect(ids).toEqual([oldest, tieA, tieB, newest])
  })
})

describe('Mark as handled: the shapes it takes, and the order of its guards', () => {
  it('answers an id that is no number of a row with 404 in words, and leaves the rows as they were', async () => {
    flags.keepersOn = true
    const admin = await onlyAdmin()
    const id = await insertRow()
    const before = await rowById(id)
    for (const bad of ['abc', '0', '-1', '1.5', '01', '1e3', '%20', '99999999999999999999', `${id}x`, '']) {
      const result = await handle(bad, admin.id)
      expect(result.status, bad).toBe(404)
      expect(await result.json(), bad).toEqual({ error: NOT_A_REQUEST })
    }
    expect(await rowById(id)).toEqual(before)
  })

  it('refuses a body its contract does not take with 400, for an admin, and leaves the row', async () => {
    flags.keepersOn = true
    const admin = await onlyAdmin()
    const id = await insertRow()
    const before = await rowById(id)
    for (const bad of [{}, { action: 'dismiss' }, { action: 'Handled' }, { action: ['handled'] }, 'handled', null, []]) {
      const result = await handle(id, admin.id, bad)
      expect(result.status, JSON.stringify(bad)).toBe(400)
    }
    const raw = await invoke(handledPost, { method: 'POST', params: { reportId: String(id) }, rawBody: '{not json', headers: { 'Content-Type': 'application/json' }, env: KEYED, as: admin.id })
    expect(raw.status).toBe(400)
    expect(await rowById(id)).toEqual(before)
  })

  it('asks who it is before it reads the body or the row: signed out is 401, a member 403, whatever the body and the id', async () => {
    flags.keepersOn = true
    await onlyAdmin()
    const member = await person()
    const id = await insertRow()
    expect((await handle(id, undefined, { nonsense: true })).status).toBe(401)
    expect((await handle('abc')).status).toBe(401)
    for (const [target, body] of [[id, { nonsense: true }], ['abc', { action: 'handled' }], [987654321, { action: 'handled' }]] as const) {
      const result = await handle(target, member.id, body)
      expect(result.status).toBe(403)
      expect(await result.json()).toEqual({ error: REQUESTS_FOR_KEEPERS })
    }
  })

  it('tells another region\'s representative nothing of a row\'s state: 403 for a row handled already and for one that is not, and 404 only for no row', async () => {
    flags.keepersOn = true
    const admin = await onlyAdmin()
    const other = await rep(NORTH)
    const open = await insertRow({ region: LAFAYETTE })
    const done = await insertRow({ region: LAFAYETTE })
    const noRegion = await insertRow({ region: null })
    expect((await handle(done, admin.id)).status).toBe(200)
    for (const id of [open, done, noRegion]) {
      const result = await handle(id, other.id)
      expect(result.status, `${id}`).toBe(403)
      expect(await result.json()).toEqual({ error: NOT_YOUR_REGION })
    }
    expect((await handle(987654321, other.id)).status).toBe(404)
    expect((await rowById(open)).status).toBe('open')
  })

  it('answers a second press by anyone who may answer with 409 in words, a keeper after an admin and an admin after a keeper alike', async () => {
    flags.keepersOn = true
    const admin = await onlyAdmin()
    const holder = await rep(LAFAYETTE)
    const first = await insertRow({ region: LAFAYETTE })
    expect((await handle(first, admin.id)).status).toBe(200)
    const late = await handle(first, holder.id)
    expect(late.status).toBe(409)
    expect(await late.json()).toEqual({ error: ALREADY_HANDLED })
    const second = await insertRow({ region: LAFAYETTE })
    expect((await handle(second, holder.id)).status).toBe(200)
    expect((await handle(second, admin.id)).status).toBe(409)
    expect((await rowById(second)).resolved_by).toBe(holder.id)
  })

  it('of five presses at once, by an admin and a representative, one wins, four are told, and the audit holds one entry', async () => {
    flags.keepersOn = true
    const admin = await onlyAdmin()
    const holder = await rep(BATON_ROUGE)
    const id = await insertRow({ region: BATON_ROUGE })
    const presses: Array<[string, Person]> = [['a1', admin], ['h1', holder], ['a2', admin], ['h2', holder], ['a3', admin]]
    const results = await Promise.all(presses.map(([, who]) => handle(id, who.id)))
    expect(results.map((r) => r.status).sort()).toEqual([200, 409, 409, 409, 409])
    for (const lost of results.filter((r) => r.status === 409)) expect(await lost.json()).toEqual({ error: ALREADY_HANDLED })
    const winner = presses[results.findIndex((r) => r.status === 200)][1]
    const row = await rowById(id)
    expect(row).toMatchObject({ status: 'answered', resolved_by: winner.id, reporter_email: null })
    expect((await auditCount(admin.id)) + (await auditCount(holder.id))).toBe(1)
    expect(await auditCount(winner.id)).toBe(1)
  }, SLOW)

  it('answers a handled press in the same words with the same shape for a row of either kind', async () => {
    flags.keepersOn = true
    const admin = await onlyAdmin()
    for (const kind of ['new_club', 'start_club']) {
      const id = await insertRow({ kind })
      const result = await handle(id, admin.id)
      expect(result.status).toBe(200)
      expect(await result.json()).toEqual({ id, status: 'answered' })
      expect((await result.response.headers.get('cache-control'))).toBe('no-store')
    }
  })

  it('takes POST and OPTIONS alone', async () => {
    expect(Object.keys(handledFile).filter((name) => name.startsWith('onRequest')).sort()).toEqual(['onRequestOptions', 'onRequestPost'])
    const options = await invoke(handledFile.onRequestOptions, { method: 'OPTIONS', path: '/api/admin/club-reports/1' })
    expect(options.status).toBe(204)
  })
})

describe('whose seat answers', () => {
  it('does not take a seat that has ended, or one that is not active, as a seat: no row in My region and no press that goes through', async () => {
    flags.keepersOn = true
    await onlyAdmin()
    const ended = await rep(BATON_ROUGE, 'ended')
    const inactive = await rep(BATON_ROUGE, 'inactive')
    const id = await insertRow({ region: BATON_ROUGE })
    for (const who of [ended, inactive]) {
      const result = await handle(id, who.id)
      expect(result.status, who.email).toBe(403)
      expect(await result.json()).toEqual({ error: REQUESTS_FOR_KEEPERS })
      const mine = await regionOf(who.id)
      expect(JSON.stringify(await mine.json())).not.toContain('player.two@example.org')
    }
    expect((await rowById(id)).status).toBe('open')
  })

  it('gives a holder of one seat over two regions the rows of both, and the press on both, and none of a third', async () => {
    flags.keepersOn = true
    await onlyAdmin()
    const both = await rep([BATON_ROUGE, NORTH])
    const a = await insertRow({ region: BATON_ROUGE })
    const b = await insertRow({ region: NORTH })
    const c = await insertRow({ region: LAFAYETTE })
    const d = await insertRow({ region: null })
    expect((await requestsOf(both.id))!.map((r) => r.id)).toEqual([a, b])
    expect((await handle(c, both.id)).status).toBe(403)
    expect((await handle(d, both.id)).status).toBe(403)
    expect((await handle(a, both.id)).status).toBe(200)
    expect((await handle(b, both.id)).status).toBe(200)
    expect(await requestsOf(both.id)).toBeUndefined()
  })

  it('gives a holder of two seats the rows of each seat\'s regions', async () => {
    flags.keepersOn = true
    await onlyAdmin()
    const holder = await rep(LAKE_CHARLES)
    await giveSeat([LAFAYETTE], holder.id)
    const ids = [await insertRow({ region: LAKE_CHARLES }), await insertRow({ region: LAFAYETTE }), await insertRow({ region: NEW_ORLEANS })]
    expect((await requestsOf(holder.id))!.map((r) => r.id)).toEqual(ids.slice(0, 2))
  })

  it('shows an LCA admin every open row and no handled one, and shows a row handled by hand\'s outcome to no one', async () => {
    flags.keepersOn = true
    const admin = await onlyAdmin()
    const open = await insertRow({ region: null })
    const handled = await insertRow({ region: LAKE_CHARLES })
    await env.DB.prepare(`UPDATE club_reports SET status = 'dismissed' WHERE id = ?`).bind(handled).run()
    expect((await requestsOf(admin.id))!.map((r) => r.id)).toEqual([open])
  })
})

describe('words that cannot be read, and the stranger\'s words as they are kept', () => {
  it('shows a row whose proposed words are not JSON, or hold other types, as empty parts, and lets it be handled', async () => {
    flags.keepersOn = true
    const admin = await onlyAdmin()
    const broken = await insertRow({ proposed: 'not json at all', region: null, email: '  spaced@example.org  ' })
    const typed = await insertRow({ proposed: JSON.stringify({ clubName: 5, place: null, name: ['Player', 'Two'] }), region: null })
    const none = await insertRow({ proposed: null, region: null, email: null })
    const rows = (await requestsOf(admin.id))!
    expect(rows.map((r) => [r.id, r.clubName, r.place, r.name, r.email, r.region])).toEqual([
      [broken, '', '', '', 'spaced@example.org', null],
      [typed, '', '', '', 'player.two@example.org', null],
      [none, '', '', '', '', null],
    ])
    for (const id of [broken, typed, none]) expect((await handle(id, admin.id)).status).toBe(200)
    expect(await rowById(broken)).toMatchObject({ status: 'answered', reporter_email: null, proposed_json: null })
    expect(JSON.parse((await rowById(typed)).proposed_json!)).toEqual({ clubName: 5, place: null })
    expect(await rowById(none)).toMatchObject({ status: 'answered', proposed_json: null })
  })

  it('keeps the words as typed but for the ends: html, quotes, accents and line breaks come back whole, and the answer is read as text', async () => {
    flags.pagesOn = true
    flags.keepersOn = true
    const admin = await onlyAdmin()
    const message = 'Fridays at 6:30 PM\nat the "Example" Café <i>Évangéline</i> & Co.\n\nBring a clock.'
    const body = request({
      clubName: '  <b>Example</b> Knights & Rooks  ', place: '  Example Nowhere  ', message: `  ${message}  `, name: '  D\'Arcy "Player" O\'Neil  ',
      email: '  player.one@example.org  ',
    })
    expect((await post(body)).status).toBe(200)
    const row = await lastRow()
    expect(row.message).toBe(message)
    expect(row.reporter_email).toBe('player.one@example.org')
    expect(JSON.parse(row.proposed_json!)).toEqual({ clubName: '<b>Example</b> Knights & Rooks', place: 'Example Nowhere', name: 'D\'Arcy "Player" O\'Neil' })
    const seen = (await requestsOf(admin.id))!.find((r) => r.id === row.id)!
    expect(seen).toMatchObject({ clubName: '<b>Example</b> Knights & Rooks', message, name: 'D\'Arcy "Player" O\'Neil', email: 'player.one@example.org' })
  })

  it('reads a ZIP code with its four digits, a ZIP after a town, and a town with its state, on the way in', async () => {
    flags.pagesOn = true
    await onlyAdmin()
    for (const [typed, region] of [
      ['70791-1234', BATON_ROUGE], ['Zachary, LA 70791', BATON_ROUGE], ['  st. gabriel ', BATON_ROUGE], ['SAINT GABRIEL, Louisiana', BATON_ROUGE],
      ['70791 Zachary', null], ['707911', null], ['7079', null], ['Zachary, Texas', null],
    ] as const) {
      expect((await post(request({ place: typed }))).status, typed).toBe(200)
      expect((await lastRow()).region, typed).toBe(region)
    }
  }, SLOW)
})

describe('the two halves apart', () => {
  it('saves a row while the keepers\' side is shut, shows it to no one, and shows it once the keepers\' side opens', async () => {
    flags.pagesOn = true
    flags.keepersOn = false
    const admin = await onlyAdmin()
    expect((await post(request({ place: 'Example Nowhere' }))).status).toBe(200)
    const row = await lastRow()
    expect(row).toMatchObject({ status: 'open', region: null })
    expect((await regionOf(admin.id)).status).toBe(403)
    const shut = await handle(row.id, admin.id)
    expect(shut.status).toBe(403)
    expect(await shut.json()).toEqual({ error: REQUESTS_CLOSED })
    expect((await rowById(row.id)).status).toBe('open')
    flags.keepersOn = true
    expect((await requestsOf(admin.id))!.map((r) => r.id)).toEqual([row.id])
    expect((await handle(row.id, admin.id)).status).toBe(200)
  })

  it('shuts the door while the keepers\' side is open, and the rows already there stay for the keepers', async () => {
    flags.pagesOn = false
    flags.keepersOn = true
    const admin = await onlyAdmin()
    const id = await insertRow({ region: null })
    const before = await env.DB.prepare('SELECT COUNT(*) AS n FROM club_reports').first<{ n: number }>()
    expect((await post(request())).status).toBe(403)
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM club_reports').first<{ n: number }>())!.n).toBe(before!.n)
    expect((await requestsOf(admin.id))!.map((r) => r.id)).toEqual([id])
  })
})

describe('what the emails hold', () => {
  it('writes to the LCA admins in their own words when no representative\'s address takes the email, once, logging one fixed line each', async () => {
    flags.pagesOn = true
    const admin = await onlyAdmin()
    const holder = await rep(BATON_ROUGE)
    // The representative's address is refused (a 422), a verdict on the address, so the row falls to the admins.
    emailBehavior.succeed = false
    emailBehavior.status = 422
    emailBehavior.failFor = [holder.email]
    const body = request({ kind: 'start_club', place: 'Baton Rouge' })
    const logs = await logsOf(async () => {
      expect((await post(body)).status).toBe(200)
    })
    vi.restoreAllMocks()
    expect(emailOutbox.map((e) => e.to)).toEqual([admin.email])
    expect(emailOutbox[0].subject).toBe(CLUB_REQUEST_SUBJECTS.start_club)
    expect(emailOutbox[0].text).toContain('since it could not reach the region\'s representatives')
    expect(logs.filter((l) => l === CLUB_REQUEST_NOT_SENT_LOG)).toHaveLength(1)
    for (const line of logs) for (const secret of [holder.email, admin.email, body.email, body.name, body.message, 'Baton Rouge']) expect(line).not.toContain(secret)
    expect((await lastRow()).status).toBe('open')
  }, SLOW)

  it('ends every email on step 28\'s line, links to the row on the configured site with no double slash, and sets no reply-to of the person\'s', async () => {
    flags.pagesOn = true
    await onlyAdmin()
    const holder = await rep(NEW_ORLEANS)
    const body = request({ place: 'Slidell' })
    expect((await post(body, { over: { ...KEYED, SITE_URL: 'https://example.org/' } })).status).toBe(200)
    const row = await lastRow()
    expect(emailOutbox).toHaveLength(1)
    const mail = emailOutbox[0] as unknown as Record<string, unknown>
    expect(mail.to).toBe(holder.email)
    const text = String(mail.text)
    expect(text.trimEnd().split('\n').at(-1)).toBe(SUGGESTION_FOOTER)
    expect(text).toContain(`https://example.org/workspace/region#club-request-${row.id}`)
    expect(text).not.toContain('example.org//')
    expect(String(mail.html)).toContain(`https://example.org/workspace/region#club-request-${row.id}`)
    // The person's name and address are in no part and no header, and no reply-to is theirs.
    const whole = JSON.stringify(mail)
    for (const secret of [body.name, body.email]) expect(whole).not.toContain(secret)
    const headers = JSON.stringify(mail.headers ?? {}).toLowerCase()
    expect(headers).not.toContain(body.email.toLowerCase())
    expect(JSON.stringify(mail.replyTo ?? mail.reply_to ?? '')).not.toContain(body.email)
  })

  it('keeps the plain-language rules in every email it sends: no long dash, no old name for US Chess, the send button\'s words not in it', async () => {
    flags.pagesOn = true
    const admin = await onlyAdmin()
    await rep(LAFAYETTE)
    const former = await person()
    await giveSeat([NORTH], former.id, 'ended')
    for (const [typed, kind] of [['70501', 'new_club'], ['71201', 'start_club'], ['Example Nowhere', 'new_club'], ['70112', 'start_club']] as const) {
      expect((await post(request({ place: typed, kind }))).status, typed).toBe(200)
    }
    expect(emailOutbox.length).toBeGreaterThanOrEqual(4)
    expect(emailOutbox.some((e) => e.to === admin.email)).toBe(true)
    for (const mail of emailOutbox) {
      for (const part of [mail.subject, mail.text, mail.html]) {
        expect(part).not.toMatch(/[\u2013\u2014]/)
        expect(part).not.toMatch(OLD_NAME)
        expect(part).not.toContain(CLUB_REQUEST_SEND)
      }
      expect(Object.values(CLUB_REQUEST_SUBJECTS)).toContain(mail.subject)
    }
  }, SLOW)
})
