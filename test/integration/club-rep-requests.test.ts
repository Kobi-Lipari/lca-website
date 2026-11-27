// test/integration/club-rep-requests.test.ts
//
// Ask to be its named rep (WS09's thirty-first step): POST
// /api/clubs/[id]/rep-requests, what a signed-in member sends from a club's
// page; the rows it leaves in My region's answer (GET /api/workspace/region)
// and in a club's answer there (GET /api/admin/clubs/[id]); and POST
// /api/admin/clubs/[id]/rep-requests/[requestId], a keeper's decision, with
// the real handlers, the real limiter and the real mail path into the
// harness's outbox. Each case sets CLUB_PAGES_ON and CLUB_KEEPERS_ON itself
// through a getter on a mock of their module, and MAIL_LISTS_ON and
// MAIL_SENDER through getters on a mock of the mail switches; no case reads a
// shipped value of any switch. The copy to the sign-in service is read by a
// wrapper of fetch the cases put over the harness's own, which is left as it
// is. Every club, person and address is made up.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  REP_DECIDE_ALREADY, REP_DECIDE_CLOSED, REP_DECIDE_FOR_KEEPERS, REP_DECIDE_NOT_THIS_CLUBS, REP_DECIDE_OWN, REP_REQUESTS_CLOSED, REP_REQUEST_ALREADY,
  REP_DIRECTORY_WORDS, REP_REQUEST_GUEST, REP_REQUEST_HAS_REP, REP_REQUEST_KEEPERS_BUSY, REP_REQUEST_MEMBER_BUSY, REP_REQUEST_NO_CLUB, REP_ROLE_CHANGED,
  adminsDecideWords, neverNamed,
} from '../../domain/clubs/repRequest'
import { onRequestPost as askPost } from '../../functions/api/clubs/[id]/rep-requests'
import { onRequestPost as decidePost } from '../../functions/api/admin/clubs/[id]/rep-requests/[requestId]'
import { onRequestGet as regionGet } from '../../functions/api/workspace/region'
import { onRequestDelete as clubDelete, onRequestGet as clubGet } from '../../functions/api/admin/clubs/[id]'
import { onRequestGet as pageGet } from '../../functions/api/clubs/[id]/page'
import { onRequestDelete as memberDelete } from '../../functions/api/admin/members/[id]'
import { REP_REQUEST_NOT_SENT_LOG } from '../../functions/utils/clubs/repRequests'
import { REP_DECISION_NOT_SENT_LOG } from '../../functions/utils/clubs/nameRep'
import { REP_REQUEST_KEEPER_SUBJECT, repDeclinedLine, repNamedSubject } from '../../functions/utils/clubs/emails'
import { canManageClub } from '../../functions/utils/admin/permissions'
import { getMemberById } from '../../functions/utils/admin/members'
import { CANT_SEND_NOW } from '../../functions/utils/rateLimit'
import type { RepRequestRow, WorkspaceRegionResponse } from '../../domain/contracts'
import { seedClub, seedMember } from './factories'
import { emailBehavior, emailOutbox, invoke, resetHarness } from './harness'
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

const KEYED = { SIGNING_SECRET: 'example-made-up-signing-key-for-rep-requests-031' }
const NORTH = 'North Louisiana'
const LAKE = 'Lake Charles / Southwestern'

let seq = 0
const mark = () => `${++seq}${crypto.randomUUID().slice(0, 6)}`

/** Every request to the sign-in service's admin path, the copy of a member's role and club, by the member's id. */
let copies: Array<{ id: string; body: unknown }> = []
let underneath: typeof fetch

beforeEach(async () => {
  resetHarness()
  flags.pagesOn = false
  flags.keepersOn = false
  flags.listsOn = false
  flags.sender = 'resend'
  copies = []
  underneath = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input as RequestInfo, init)
    const url = new URL(request.url)
    if (url.origin === 'https://test-supabase.local' && url.pathname.startsWith('/auth/v1/admin/users/')) {
      copies.push({ id: decodeURIComponent(url.pathname.split('/').pop() ?? ''), body: await request.clone().json().catch(() => null) })
    }
    return underneath(input, init)
  }) as typeof fetch
  // The middle of the run's own hour, held still, so every call of a case lands in one hour.
  const middle = new Date()
  middle.setUTCMinutes(30, 0, 0)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(middle)
  // Each case starts with no seat over any region, no open request and no count, so where an email goes is its own.
  await env.DB.prepare(`UPDATE board_seat_assignments SET ended_at = datetime('now') WHERE ended_at IS NULL`).run()
  await env.DB.prepare(`UPDATE club_rep_requests SET status = 'declined' WHERE status = 'open'`).run()
  await env.DB.prepare('DELETE FROM rate_limits').run()
})
afterEach(() => {
  globalThis.fetch = underneath
  vi.useRealTimers()
  vi.restoreAllMocks()
})

// ── Made-up people and clubs ──

interface Person { id: string; name: string; email: string }

async function giveSeat(region: string, memberId: string): Promise<void> {
  const seat = `seat-${mark()}`
  await env.DB.prepare(
    `INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active) VALUES (?, 'Example Region Representative', '', 99, ?, 'regional_rep', 1)`,
  ).bind(seat, seat).run()
  await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(seat, region).run()
  await env.DB.prepare('INSERT INTO board_seat_assignments (seat_id, member_id) VALUES (?, ?)').bind(seat, memberId).run()
}

async function person(opts: { role?: string; clubId?: string | null; name?: string } = {}): Promise<Person> {
  const m = mark()
  const made = { id: '', name: opts.name ?? `Player ${m}`, email: `player-${m}@example.org` }
  // A member id is a UUID, as the sign-in service gives one, so its admin client takes it.
  made.id = await seedMember({ id: crypto.randomUUID(), fullName: made.name, email: made.email, role: opts.role, clubId: opts.clubId ?? null })
  return made
}

async function rep(region: string, opts: { role?: string; clubId?: string } = {}): Promise<Person> {
  const made = await person(opts)
  await giveSeat(region, made.id)
  return made
}

async function onlyAdmin(): Promise<Person> {
  await env.DB.prepare(`UPDATE members SET role = 'member' WHERE role = 'lca_admin'`).run()
  return person({ role: 'lca_admin' })
}

async function club(region: string | null = NORTH): Promise<{ id: string; name: string }> {
  const name = `Example Knights Club ${mark()}`
  const id = await seedClub({ name })
  await env.DB.prepare('UPDATE clubs SET region = ?, slug = ? WHERE id = ?').bind(region, `example-${id}`, id).run()
  return { id, name }
}

// ── Calls ──

const ask = (clubId: string, as?: string, body: unknown = { connection: 'runs_it', note: 'I have run the Tuesday nights since spring.' }, extra: Record<string, unknown> = {}) =>
  invoke(askPost, { method: 'POST', params: { id: clubId }, body, as, aal: 'aal1', env: { ...KEYED, ...extra }, path: `/api/clubs/${clubId}/rep-requests` })
const press = (clubId: string, requestId: number, body: unknown, as: string, aal: 'aal1' | 'aal2' = 'aal2') =>
  invoke(decidePost, { method: 'POST', params: { id: clubId, requestId: String(requestId) }, body, as, aal, env: KEYED, path: `/api/admin/clubs/${clubId}/rep-requests/${requestId}` })
const regionOf = async (as: string) => {
  const result = await invoke(regionGet, { as, aal: 'aal1' })
  return { status: result.status, body: await result.json<WorkspaceRegionResponse>(), cache: result.response.headers.get('Cache-Control') }
}
const clubAnswer = async (clubId: string, as: string) => {
  const result = await invoke(clubGet, { params: { id: clubId }, as, aal: 'aal1' })
  return { status: result.status, body: await result.json<{ repRequests?: RepRequestRow[] }>(), cache: result.response.headers.get('Cache-Control') }
}
const pageWanted = async (clubId: string) => (await (await invoke(pageGet, { params: { id: clubId } })).json<{ rep_wanted?: boolean }>()).rep_wanted

interface Row { id: number; club_id: string; member_id: string; connection: string; note: string | null; status: string; decided_by: string | null; decided_at: string | null }
const requestsOf = async (clubId: string) => (await env.DB.prepare('SELECT * FROM club_rep_requests WHERE club_id = ? ORDER BY id').bind(clubId).all<Row>()).results
const lastRequest = async (clubId: string) => (await requestsOf(clubId)).at(-1)!
const roleAndClub = async (id: string) => {
  const m = await getMemberById(env.DB, id)
  return { role: m?.role, club_id: m?.club_id ?? null }
}

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
const grown = (before: Record<string, number>, after: Record<string, number>) => Object.keys(after).filter((name) => after[name] !== before[name])

async function logsOf(work: () => Promise<void>): Promise<string[]> {
  const lines: string[] = []
  for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => { lines.push(args.map((a) => (a instanceof Error ? a.message : typeof a === 'string' ? a : JSON.stringify(a))).join(' ')) })
  }
  await work()
  return lines
}

const whole = (mail: unknown) => JSON.stringify(mail)
/** The cases that send to several people wait the pause between emails, so they are given longer. */
const SLOW = 30_000

/** Both switches set, a club of the north with its region's representative and an LCA admin, and a member who asks. */
async function scene(region: string | null = NORTH) {
  flags.pagesOn = true
  flags.keepersOn = true
  const admin = await onlyAdmin()
  const c = await club(region)
  const keeper = region ? await rep(region) : null
  const member = await person()
  return { admin, club: c, keeper, member }
}

/** A request saved for the member, answering its row. */
async function asked(clubId: string, memberId: string): Promise<Row> {
  const result = await ask(clubId, memberId)
  expect(result.status).toBe(200)
  return lastRequest(clubId)
}

describe('asking: who may, and what is saved', () => {
  it('sign-in required: with CLUB_PAGES_ON unset nothing is read; signed out answers 401, a guest is refused in words, and nothing is saved', async () => {
    flags.keepersOn = true
    const c = await club()
    const member = await person()
    const guest = await person({ role: 'guest' })
    const counting = countingDb()
    const before = await tableCounts()
    const closed = await ask(c.id, member.id, undefined, { DB: counting.db })
    expect(closed.status).toBe(403)
    expect(await closed.json()).toEqual({ error: REP_REQUESTS_CLOSED })
    expect(counting.ran).toEqual([])
    flags.pagesOn = true
    expect((await ask(c.id)).status).toBe(401)
    const refused = await ask(c.id, guest.id)
    expect(refused.status).toBe(403)
    expect(await refused.json()).toEqual({ error: REP_REQUEST_GUEST })
    expect(grown(before, await tableCounts())).toEqual([])
    expect(emailOutbox).toHaveLength(0)
  })

  it('reaches the region\'s representatives and the LCA admins, one email each, a person in both once, never the member, with neither their name nor address', async () => {
    const { admin, club: c, keeper, member } = await scene()
    // An LCA admin who also holds the region's seat is written to once; a second representative of the region too.
    await giveSeat(NORTH, admin.id)
    const second = await rep(NORTH)
    // A representative of another region is not written to.
    await rep(LAKE)
    const before = await tableCounts()
    const result = await ask(c.id, member.id, { connection: 'keeps_page', note: 'I keep <b>Example</b> notes & dates.', memberId: admin.id })
    expect(result.status).toBe(200)
    expect(await result.json()).toEqual({ sent: true })
    expect(result.response.headers.get('Cache-Control')).toBe('no-store')
    expect(emailOutbox.map((m) => m.to).sort()).toEqual([admin.email, keeper!.email, second.email].sort())
    for (const mail of emailOutbox) {
      expect(mail.subject).toBe(REP_REQUEST_KEEPER_SUBJECT)
      expect(mail.html).toContain(c.name)
      expect(mail.text).toContain('How they are connected: Would keep the page')
      expect(mail.html).toContain('I keep &lt;b&gt;Example&lt;/b&gt; notes &amp; dates.')
      expect(mail.text).toContain('I keep <b>Example</b> notes & dates.')
      expect(mail.text).toContain(`/workspace/region#rep-request-`)
      expect(whole(mail)).not.toContain(member.email)
      expect(whole(mail)).not.toContain(member.name)
    }
    // The row holds the least: the member from the session, never from the body.
    const row = await lastRequest(c.id)
    expect(row).toMatchObject({ member_id: member.id, connection: 'keeps_page', note: 'I keep <b>Example</b> notes & dates.', status: 'open', decided_by: null })
    expect(grown(before, await tableCounts()).sort()).toEqual(['club_rep_requests', 'rate_limits'])
  }, SLOW)

  it('a keeper who asks is not written to about their own request, and a club whose seat is open goes to the admins alone', async () => {
    const { admin, club: c, keeper } = await scene(LAKE)
    const keeperWhoAsks = await rep(LAKE)
    expect((await ask(c.id, keeperWhoAsks.id)).status).toBe(200)
    expect(emailOutbox.map((m) => m.to).sort()).toEqual([admin.email, keeper!.email].sort())
    emailOutbox.length = 0
    const open = await club(null)
    const member = await person()
    expect((await ask(open.id, member.id)).status).toBe(200)
    expect(emailOutbox.map((m) => m.to)).toEqual([admin.email])
    expect(emailOutbox[0].text).toContain('It came to you as an LCA admin.')
  }, SLOW)

  it('refuses a club that has a named rep, an address that names no club, and a second open request, each in words with nothing saved', async () => {
    const { club: c, member } = await scene()
    await person({ role: 'club_rep', clubId: c.id })
    const has = await ask(c.id, member.id)
    expect(has.status).toBe(409)
    expect(await has.json()).toEqual({ error: REP_REQUEST_HAS_REP })
    const none = await ask('example-no-such-club', (await person()).id)
    expect(none.status).toBe(404)
    expect(await none.json()).toEqual({ error: REP_REQUEST_NO_CLUB })
    const other = await club()
    const asker = await person()
    await asked(other.id, asker.id)
    const again = await ask(other.id, asker.id)
    expect(again.status).toBe(409)
    expect(await again.json()).toEqual({ error: REP_REQUEST_ALREADY })
    expect(await requestsOf(c.id)).toHaveLength(0)
    expect(await requestsOf(other.id)).toHaveLength(1)
  }, SLOW)

  it('of two sends at once, one row is written and the other is told in words', async () => {
    const { club: c, member } = await scene(null)
    const [a, b] = await Promise.all([ask(c.id, member.id), ask(c.id, member.id)])
    expect([a.status, b.status].sort()).toEqual([200, 409])
    const refused = a.status === 409 ? a : b
    expect(await refused.json()).toEqual({ error: REP_REQUEST_ALREADY })
    expect((await requestsOf(c.id)).filter((r) => r.status === 'open')).toHaveLength(1)
  }, SLOW)

  it('the limits: three an hour from one member, ten an hour to one set of keepers, each refused in words with nothing saved, and 503 with no signing key', async () => {
    flags.pagesOn = true
    await onlyAdmin()
    emailBehavior.succeed = false
    const member = await person()
    const clubs = await Promise.all([1, 2, 3, 4].map(() => club(null)))
    for (const c of clubs.slice(0, 3)) expect((await ask(c.id, member.id)).status).toBe(200)
    const fourth = await ask(clubs[3].id, member.id)
    expect(fourth.status).toBe(429)
    expect(await fourth.json()).toEqual({ error: REP_REQUEST_MEMBER_BUSY })
    expect(await requestsOf(clubs[3].id)).toHaveLength(0)
    // Seven more from seven people make ten to the admins' set; the eleventh is refused.
    for (let i = 0; i < 7; i++) expect((await ask((await club(null)).id, (await person()).id)).status).toBe(200)
    const lastClub = await club(null)
    const eleventh = await ask(lastClub.id, (await person()).id)
    expect(eleventh.status).toBe(429)
    expect(await eleventh.json()).toEqual({ error: REP_REQUEST_KEEPERS_BUSY })
    expect(await requestsOf(lastClub.id)).toHaveLength(0)
    const unkeyed = await ask(lastClub.id, (await person()).id, undefined, { SIGNING_SECRET: '' })
    expect(unkeyed.status).toBe(503)
    expect(await unkeyed.json()).toEqual({ error: CANT_SEND_NOW })
  }, SLOW)

  it('the admins are counted for every request: with seats held in two regions, ten to the first and one to the second, the eleventh is refused and no admin has more than ten emails', async () => {
    const { admin, keeper } = await scene()
    const lake = await rep(LAKE)
    emailOutbox.length = 0
    for (let i = 0; i < 10; i++) expect((await ask((await club(NORTH)).id, (await person()).id)).status, `request ${i + 1}`).toBe(200)
    const lakeClub = await club(LAKE)
    const hits = async () => (await env.DB.prepare('SELECT COALESCE(SUM(hits), 0) AS n FROM rate_limits').first<{ n: number }>())!.n
    const hitsBefore = await hits()
    const eleventh = await ask(lakeClub.id, (await person()).id)
    expect(eleventh.status).toBe(429)
    expect(await eleventh.json()).toEqual({ error: REP_REQUEST_KEEPERS_BUSY })
    // The member's count, the second region's and the admins' were each taken, and the second region's is kept
    // though the admins' then refused.
    expect(await hits() - hitsBefore).toBe(3)
    expect(await requestsOf(lakeClub.id)).toHaveLength(0)
    expect(emailOutbox.filter((m) => m.to === admin.email)).toHaveLength(10)
    expect(emailOutbox.filter((m) => m.to === keeper!.email)).toHaveLength(10)
    expect(emailOutbox.filter((m) => m.to === lake.email)).toHaveLength(0)
  }, 60_000)

  it('a region\'s count used up refuses before the admins\' count is touched', async () => {
    await scene()
    for (let i = 0; i < 10; i++) expect((await ask((await club(NORTH)).id, (await person()).id)).status, `request ${i + 1}`).toBe(200)
    const counting = countingDb()
    const refused = await ask((await club(NORTH)).id, (await person()).id, undefined, { DB: counting.db })
    expect(refused.status).toBe(429)
    expect(await refused.json()).toEqual({ error: REP_REQUEST_KEEPERS_BUSY })
    // Two counts ran, the member's and the region's; the admins' was never asked.
    expect(counting.ran.filter((r) => r.sql === 'batch')).toHaveLength(2)
  }, 60_000)

  it.each([false, true])('a request no address took is saved all the same, and the logs carry neither the member\'s words nor their address, with the mail engine\'s rules on: %s', async (on) => {
    const { club: c, member } = await scene()
    flags.listsOn = on
    emailBehavior.succeed = false
    const note = `Example note ${mark()}`
    const lines = await logsOf(async () => {
      expect((await ask(c.id, member.id, { connection: 'other', note })).status).toBe(200)
    })
    expect((await lastRequest(c.id)).status).toBe('open')
    expect(lines).toContain(REP_REQUEST_NOT_SENT_LOG)
    for (const line of lines) {
      expect(line).not.toContain(note)
      expect(line).not.toContain(member.email)
    }
  }, SLOW)
})

describe('the rows a keeper reads', () => {
  it('My region and a club\'s answer carry the rows for the region\'s representative and an LCA admin, kept by no cache, and for no one else', async () => {
    const { admin, club: c, keeper, member } = await scene()
    const elsewhere = await rep(LAKE)
    const ownRep = await person({ role: 'club_rep', clubId: (await club()).id })
    await giveSeat(LAKE, ownRep.id)
    const observer = await person({ role: 'lca_observer' })
    const row = await asked(c.id, member.id)
    for (const reader of [keeper!, admin]) {
      const mine = await regionOf(reader.id)
      const found = mine.body.repRequests?.find((r) => r.id === row.id)
      expect(found, reader.name).toMatchObject({ clubId: c.id, clubName: c.name, memberName: member.name, memberEmail: member.email, connection: 'runs_it', memberRole: 'member', noName: null })
      expect(found!.sentOn).toMatch(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), [A-Z][a-z]{2} \d{1,2}$/)
      expect(mine.cache).toBe('no-store')
      const theirs = await clubAnswer(c.id, reader.id)
      expect(theirs.body.repRequests?.map((r) => r.id)).toEqual([row.id])
      expect(theirs.cache).toBe('no-store')
    }
    expect((await regionOf(elsewhere.id)).body.repRequests).toBeUndefined()
    expect((await regionOf(ownRep.id)).body.repRequests).toBeUndefined()
    expect((await regionOf(member.id)).status).toBe(403)
    expect((await clubAnswer(c.id, observer.id)).body.repRequests).toBeUndefined()
    // The member's own request is not on a keeper's rows when the keeper is the member.
    expect((await regionOf(member.id)).body.repRequests).toBeUndefined()
  }, SLOW)

  it('with no request the answers are as before: the key absent and the headers as they were', async () => {
    const { admin, club: c, keeper } = await scene()
    for (const reader of [keeper!, admin]) {
      const mine = await regionOf(reader.id)
      expect(mine.body).not.toHaveProperty('repRequests')
      expect(mine.cache).toBeNull()
      const theirs = await clubAnswer(c.id, reader.id)
      expect(theirs.body).not.toHaveProperty('repRequests')
      expect(theirs.cache).toBeNull()
    }
    const counting = countingDb()
    const none = await invoke(decidePost, { method: 'POST', params: { id: c.id, requestId: '987654' }, body: { decision: 'decline' }, as: admin.id, env: { ...KEYED, DB: counting.db } })
    expect(none.status).toBe(404)
    expect(await none.json()).toEqual({ error: REP_DECIDE_NOT_THIS_CLUBS })
  }, SLOW)
})

describe('deciding: who may', () => {
  it('with CLUB_KEEPERS_ON unset everyone gets 403 before anything is read', async () => {
    flags.pagesOn = true
    const admin = await onlyAdmin()
    const counting = countingDb()
    const result = await invoke(decidePost, { method: 'POST', params: { id: 'c-any', requestId: '1' }, body: { decision: 'approve' }, as: admin.id, env: { ...KEYED, DB: counting.db } })
    expect(result.status).toBe(403)
    expect(await result.json()).toEqual({ error: REP_DECIDE_CLOSED })
    expect(counting.ran).toEqual([])
  })

  it('another region\'s representative, the club\'s own rep and a member get 403, with a director, an officer, an observer, another club\'s rep and a guest, before anything of the row is told', async () => {
    const { club: c, member } = await scene()
    const row = await asked(c.id, member.id)
    const ownRep = await person({ role: 'club_rep', clubId: c.id })
    await giveSeat(NORTH, ownRep.id)
    const guestWithSeat = await rep(NORTH, { role: 'guest' })
    const others = [
      await rep(LAKE), ownRep, await person(), await person({ role: 'tournament_director' }), await person({ role: 'lca_officer' }),
      await person({ role: 'lca_observer' }), await person({ role: 'club_rep', clubId: (await club()).id }), guestWithSeat,
    ]
    for (const who of others) {
      const result = await press(c.id, row.id, { decision: 'approve', role: 'member' }, who.id)
      expect(result.status, who.name).toBe(403)
      expect(await result.json(), who.name).toEqual({ error: REP_DECIDE_FOR_KEEPERS })
    }
    expect(await press(c.id, row.id, { decision: 'decline' }, others[0].id).then((r) => r.status)).toBe(403)
    expect(await roleAndClub(member.id)).toEqual({ role: 'member', club_id: null })
    expect((await lastRequest(c.id)).status).toBe('open')
    // Signed out: the site's own 401.
    expect((await invoke(decidePost, { method: 'POST', params: { id: c.id, requestId: String(row.id) }, body: { decision: 'decline' }, env: KEYED })).status).toBe(401)
  }, SLOW)

  it('an LCA admin is asked the second factor today\'s role endpoint asks, and no keeper decides their own request', async () => {
    const { admin, club: c, keeper } = await scene()
    const member = await person()
    const row = await asked(c.id, member.id)
    const noFactor = await press(c.id, row.id, { decision: 'approve', role: 'member' }, admin.id, 'aal1')
    expect(noFactor.status).toBe(403)
    expect(await noFactor.json()).toMatchObject({ mfaRequired: true })
    const own = await asked(c.id, keeper!.id)
    const self = await press(c.id, own.id, { decision: 'approve', role: 'member' }, keeper!.id, 'aal1')
    expect(self.status).toBe(403)
    expect(await self.json()).toEqual({ error: REP_DECIDE_OWN })
    expect(await roleAndClub(keeper!.id)).toEqual({ role: 'member', club_id: null })
    const elsewhere = await club()
    const wrong = await press(elsewhere.id, row.id, { decision: 'decline' }, admin.id)
    expect(wrong.status).toBe(404)
    expect(await wrong.json()).toEqual({ error: REP_DECIDE_NOT_THIS_CLUBS })
  }, SLOW)
})

describe('naming', () => {
  it('the region\'s representative approves and the member becomes the club\'s rep: the role and the club together with the outcome, copied to the sign-in service, audited and emailed', async () => {
    const { club: c, keeper, member } = await scene()
    expect(await pageWanted(c.id)).toBe(true)
    const row = await asked(c.id, member.id)
    emailOutbox.length = 0
    const before = await tableCounts()
    const result = await press(c.id, row.id, { decision: 'approve', role: 'member' }, keeper!.id, 'aal1')
    expect(result.status).toBe(200)
    expect(await result.json()).toEqual({ id: row.id, status: 'approved', told: true })
    expect(await roleAndClub(member.id)).toEqual({ role: 'club_rep', club_id: c.id })
    const decided = await lastRequest(c.id)
    expect(decided).toMatchObject({ status: 'approved', decided_by: keeper!.id })
    expect(decided.decided_at).not.toBeNull()
    expect(copies).toEqual([{ id: member.id, body: { user_metadata: { role: 'club_rep', club_id: c.id } } }])
    const audit = await env.DB.prepare(`SELECT * FROM admin_audit_log WHERE action = 'club_rep_named' AND target_member_id = ?`).bind(member.id).all<{ actor_id: string; target_label: string; detail: string }>()
    expect(audit.results).toHaveLength(1)
    expect(audit.results[0].actor_id).toBe(keeper!.id)
    expect(audit.results[0].target_label).toBe(`${member.name} <${member.email}>`)
    expect(JSON.parse(audit.results[0].detail)).toEqual({ requestId: row.id, clubId: c.id, from: 'member', to: 'club_rep', clubFrom: null })
    expect(emailOutbox.map((m) => m.to)).toEqual([member.email])
    expect(emailOutbox[0].subject).toBe(repNamedSubject(c.name))
    expect(emailOutbox[0].text).toContain('As its rep you can edit the club\'s page, create its events and set their fees.')
    expect(emailOutbox[0].text).toContain('/manage/club')
    expect(whole(emailOutbox[0])).not.toContain(keeper!.name)
    expect(whole(emailOutbox[0])).not.toContain(NORTH)
    expect(grown(before, await tableCounts()).sort()).toEqual(['admin_audit_log'])
  }, SLOW)

  it('the page then names no one and drops the invitation, and the member keeps the club as its rep', async () => {
    const { admin, club: c, member } = await scene()
    expect(await pageWanted(c.id)).toBe(true)
    const pageBefore = await (await invoke(pageGet, { params: { id: c.id } })).json<Record<string, unknown>>()
    const row = await asked(c.id, member.id)
    expect((await press(c.id, row.id, { decision: 'approve', role: 'member' }, admin.id)).status).toBe(200)
    const pageAfter = await (await invoke(pageGet, { params: { id: c.id } })).json<Record<string, unknown>>()
    expect(pageAfter.rep_wanted).toBe(false)
    expect(JSON.stringify(pageAfter)).not.toContain(member.name)
    expect(JSON.stringify(pageAfter)).not.toContain(member.email)
    expect({ ...pageAfter, rep_wanted: true, suggestion: pageBefore.suggestion }).toEqual(pageBefore)
    const now = (await getMemberById(env.DB, member.id))!
    expect(await canManageClub(env.DB, now, c.id)).toBe(true)
    // A later request for the club is refused: it has a named rep.
    const late = await ask(c.id, (await person()).id)
    expect(late.status).toBe(409)
  }, SLOW)

  it('with CLUB_PAGES_ON unset the keepers\' preview carries no rep_wanted key, and is the public answer without it', async () => {
    const { admin, club: c, keeper } = await scene()
    const clubRep = await person({ role: 'club_rep', clubId: c.id })
    const bare = await club()
    flags.pagesOn = true
    const open = await (await invoke(pageGet, { params: { id: bare.id } })).json<Record<string, unknown>>()
    expect(open.rep_wanted).toBe(true)
    const withoutIt = { ...open }
    delete withoutIt.rep_wanted
    flags.pagesOn = false
    for (const who of [admin.id, keeper!.id]) {
      const res = await invoke(pageGet, { params: { id: bare.id }, as: who })
      expect(res.status).toBe(200)
      expect(res.response.headers.get('Cache-Control')).toBe('no-store')
      const text = await res.response.clone().text()
      expect(text).not.toContain('rep_wanted')
      expect(text).toBe(JSON.stringify(withoutIt))
    }
    const own = await invoke(pageGet, { params: { id: c.id }, as: clubRep.id })
    expect(own.status).toBe(200)
    expect(await own.response.clone().text()).not.toContain('rep_wanted')
  }, SLOW)

  it('an admin approves while the seat is open, and the other open requests for the club stay open', async () => {
    const { admin, club: c } = await scene(null)
    const one = await person()
    const two = await person()
    const first = await asked(c.id, one.id)
    const second = await asked(c.id, two.id)
    expect((await press(c.id, first.id, { decision: 'approve', role: 'member' }, admin.id)).status).toBe(200)
    expect(await roleAndClub(one.id)).toEqual({ role: 'club_rep', club_id: c.id })
    expect((await requestsOf(c.id)).find((r) => r.id === second.id)?.status).toBe('open')
  }, SLOW)

  it('a plain member on another club\'s roster is moved to this club, and the question says so', async () => {
    const { admin, club: c } = await scene()
    const other = await club()
    const member = await person({ clubId: other.id })
    const row = await asked(c.id, member.id)
    const found = (await regionOf(admin.id)).body.repRequests!.find((r) => r.id === row.id)!
    // Moved by WS09 checkpoint Z's review: the scene sets the club pages on, where no page shows a roster, so the
    // question names the member's account. test/unit/rep-request-words.test.ts holds today's sentence with it unset.
    expect(found.nameQuestion).toBe(`${member.name} will be able to edit ${c.name}'s page, create its events and set their fees. ${REP_DIRECTORY_WORDS} ${member.name}'s account names ${other.name} as their club. Naming them rep changes that to ${c.name}.`)
    expect(JSON.stringify(found)).not.toMatch(/roster/i)
    expect((await press(c.id, row.id, { decision: 'approve', role: 'member' }, admin.id)).status).toBe(200)
    expect(await roleAndClub(member.id)).toEqual({ role: 'club_rep', club_id: c.id })
  }, SLOW)

  it('of two presses at once, one wins and the other is told so', async () => {
    const { admin, club: c, keeper, member } = await scene()
    const row = await asked(c.id, member.id)
    const [a, b] = await Promise.all([
      press(c.id, row.id, { decision: 'approve', role: 'member' }, admin.id),
      press(c.id, row.id, { decision: 'approve', role: 'member' }, keeper!.id, 'aal1'),
    ])
    expect([a.status, b.status].sort()).toEqual([200, 409])
    expect(await (a.status === 409 ? a : b).json()).toEqual({ error: REP_DECIDE_ALREADY })
    const audits = await env.DB.prepare(`SELECT COUNT(*) AS n FROM admin_audit_log WHERE action = 'club_rep_named' AND target_member_id = ?`).bind(member.id).first<{ n: number }>()
    expect(audits!.n).toBe(1)
    const [x, y] = await Promise.all([
      press(c.id, row.id, { decision: 'decline' }, admin.id),
      press(c.id, row.id, { decision: 'decline' }, keeper!.id, 'aal1'),
    ])
    expect([x.status, y.status]).toEqual([409, 409])
    expect(await roleAndClub(member.id)).toEqual({ role: 'club_rep', club_id: c.id })
  }, SLOW)

  it('an email to the member that did not go leaves one fixed line, and the naming stands, with told false in the answer', async () => {
    const { admin, club: c, member } = await scene()
    const row = await asked(c.id, member.id)
    emailBehavior.succeed = false
    let answer: unknown
    const lines = await logsOf(async () => {
      const result = await press(c.id, row.id, { decision: 'approve', role: 'member' }, admin.id)
      expect(result.status).toBe(200)
      answer = await result.json()
    })
    expect(answer).toEqual({ id: row.id, status: 'approved', told: false })
    expect(lines).toContain(REP_DECISION_NOT_SENT_LOG)
    for (const line of lines) expect(line).not.toContain(member.email)
    expect(await roleAndClub(member.id)).toEqual({ role: 'club_rep', club_id: c.id })
  }, SLOW)

  it('a representative pressing Name as rep for a member made another club\'s rep since the page was read is told an LCA admin decides it, never to read the question again', async () => {
    const { admin, club: c, keeper } = await scene()
    const second = await club()
    const member = await person()
    const first = await asked(second.id, member.id)
    const row = await asked(c.id, member.id)
    expect((await press(second.id, first.id, { decision: 'approve', role: 'member' }, admin.id)).status).toBe(200)
    // The page still holds the row as it was read: the role it sends is member.
    const result = await press(c.id, row.id, { decision: 'approve', role: 'member' }, keeper!.id, 'aal1')
    expect(result.status).toBe(409)
    expect(await result.json()).toEqual({ error: adminsDecideWords(member.name, 'club_rep', second.name) })
    expect(await roleAndClub(member.id)).toEqual({ role: 'club_rep', club_id: second.id })
    // An LCA admin's order is as before: the body's role is compared first.
    const stale = await press(c.id, row.id, { decision: 'approve', role: 'member' }, admin.id)
    expect(stale.status).toBe(409)
    expect(await stale.json()).toEqual({ error: REP_ROLE_CHANGED })
  }, SLOW)
})

describe('one role', () => {
  it.each(['lca_auditor', 'lca_officer', 'lca_observer', 'tournament_director', 'club_rep'] as const)('a member who holds %s goes to the admins with the reason in words, and nothing of their role or club changes', async (role) => {
    const { admin, club: c, keeper } = await scene()
    const other = await club(LAKE)
    const member = await person({ role, clubId: role === 'club_rep' ? other.id : null })
    const row = await asked(c.id, member.id)
    const before = await roleAndClub(member.id)
    const result = await press(c.id, row.id, { decision: 'approve', role }, keeper!.id, 'aal1')
    expect(result.status).toBe(409)
    expect(await result.json()).toEqual({ error: adminsDecideWords(member.name, role, role === 'club_rep' ? other.name : null) })
    expect(await roleAndClub(member.id)).toEqual(before)
    expect((await lastRequest(c.id)).status).toBe('open')
    // The representative's row says why in place of Name as rep; the admin's row offers it.
    const repRow = (await regionOf(keeper!.id)).body.repRequests!.find((r) => r.id === row.id)!
    expect(repRow.noName).toMatch(/^An LCA admin decides this one: /)
    const adminRow = (await regionOf(admin.id)).body.repRequests!.find((r) => r.id === row.id)!
    expect(adminRow.noName).toBeNull()
    expect(adminRow.nameQuestion).toContain(role === 'club_rep' ? `Naming them here takes them off ${other.name}.` : 'Naming them rep replaces that.')
  }, SLOW)

  it('another club\'s rep goes to the admins and keeps their club; an admin\'s naming replaces the role only when it is the one the question named', async () => {
    const { admin, club: c, keeper } = await scene()
    const other = await club(LAKE)
    const member = await person({ role: 'club_rep', clubId: other.id })
    const row = await asked(c.id, member.id)
    expect((await press(c.id, row.id, { decision: 'approve', role: 'club_rep' }, keeper!.id, 'aal1')).status).toBe(409)
    expect(await roleAndClub(member.id)).toEqual({ role: 'club_rep', club_id: other.id })
    const stale = await press(c.id, row.id, { decision: 'approve', role: 'member' }, admin.id)
    expect(stale.status).toBe(409)
    expect(await stale.json()).toEqual({ error: REP_ROLE_CHANGED })
    const none = await press(c.id, row.id, { decision: 'approve' }, admin.id)
    expect(none.status).toBe(409)
    expect(await roleAndClub(member.id)).toEqual({ role: 'club_rep', club_id: other.id })
    expect((await press(c.id, row.id, { decision: 'approve', role: 'club_rep' }, admin.id)).status).toBe(200)
    expect(await roleAndClub(member.id)).toEqual({ role: 'club_rep', club_id: c.id })
  }, SLOW)

  it.each(['lca_auditor', 'lca_officer', 'lca_observer', 'tournament_director'] as const)('an LCA admin may name a member who holds %s, which replaces that role', async (role) => {
    const { admin, club: c } = await scene()
    const member = await person({ role })
    const row = await asked(c.id, member.id)
    expect((await press(c.id, row.id, { decision: 'approve', role }, admin.id)).status).toBe(200)
    expect(await roleAndClub(member.id)).toEqual({ role: 'club_rep', club_id: c.id })
  }, SLOW)

  it.each(['lca_admin', 'guest'] as const)('no one names a member who holds %s through this door', async (role) => {
    const { admin, club: c, keeper } = await scene()
    const member = await person({ role })
    // A guest cannot ask, so the row is written as one might stand from before.
    await env.DB.prepare(`INSERT INTO club_rep_requests (club_id, member_id, connection) VALUES (?, ?, 'other')`).bind(c.id, member.id).run()
    const row = await lastRequest(c.id)
    const other = role === 'lca_admin' ? (await person({ role: 'lca_admin' })) : admin
    for (const [who, aal] of [[other.id, 'aal2'], [keeper!.id, 'aal1']] as const) {
      const result = await press(c.id, row.id, { decision: 'approve', role }, who, aal)
      expect(result.status).toBe(409)
      expect(await result.json()).toEqual({ error: neverNamed(member.name, role) })
    }
    expect(await roleAndClub(member.id)).toEqual({ role, club_id: null })
  }, SLOW)
})

describe('declining', () => {
  it('decline changes nothing of the member, is audited and tells the member, who may ask again', async () => {
    const { club: c, keeper, member } = await scene()
    const row = await asked(c.id, member.id)
    emailOutbox.length = 0
    const before = await tableCounts()
    const result = await press(c.id, row.id, { decision: 'decline' }, keeper!.id, 'aal1')
    expect(result.status).toBe(200)
    expect(await result.json()).toEqual({ id: row.id, status: 'declined', told: true })
    expect(await roleAndClub(member.id)).toEqual({ role: 'member', club_id: null })
    expect(await lastRequest(c.id)).toMatchObject({ status: 'declined', decided_by: keeper!.id })
    expect(copies).toEqual([])
    expect(grown(before, await tableCounts())).toEqual(['admin_audit_log'])
    expect(emailOutbox.map((m) => m.to)).toEqual([member.email])
    expect(emailOutbox[0].text).toContain(repDeclinedLine(c.name))
    expect(whole(emailOutbox[0])).not.toContain(keeper!.name)
    expect((await ask(c.id, member.id)).status).toBe(200)
  }, SLOW)

  it('a decline whose email to the member did not go still stands, and its answer carries told false', async () => {
    const { club: c, keeper, member } = await scene()
    const row = await asked(c.id, member.id)
    emailBehavior.succeed = false
    const lines = await logsOf(async () => {
      const result = await press(c.id, row.id, { decision: 'decline' }, keeper!.id, 'aal1')
      expect(result.status).toBe(200)
      expect(await result.json()).toEqual({ id: row.id, status: 'declined', told: false })
    })
    expect(lines).toContain(REP_DECISION_NOT_SENT_LOG)
    expect(await lastRequest(c.id)).toMatchObject({ status: 'declined', decided_by: keeper!.id })
  }, SLOW)
})

describe('the deletes of WS09 step 4 still clear the table', () => {
  it('the member delete takes a member\'s own requests, and the club delete a club\'s', async () => {
    const { admin, club: c } = await scene(null)
    const member = await person()
    await asked(c.id, member.id)
    const leaving = await invoke(memberDelete, { method: 'DELETE', as: admin.id, params: { id: member.id } })
    expect(leaving.status).toBe(200)
    expect(await requestsOf(c.id)).toHaveLength(0)
    const another = await person()
    await asked(c.id, another.id)
    expect((await invoke(clubDelete, { method: 'DELETE', as: admin.id, params: { id: c.id } })).status).toBe(200)
    expect(await requestsOf(c.id)).toHaveLength(0)
  }, SLOW)

  it('a member named through this door is named by an audit row, so their delete fails while main\'s audit table refers to them', async () => {
    const { admin, club: c, member } = await scene(null)
    const row = await asked(c.id, member.id)
    expect((await press(c.id, row.id, { decision: 'approve', role: 'member' }, admin.id)).status).toBe(200)
    await expect(invoke(memberDelete, { method: 'DELETE', as: admin.id, params: { id: member.id } })).rejects.toThrow(/FOREIGN KEY constraint failed/)
  }, SLOW)

  it('a member whose request was declined is not named by the audit row, so their delete still clears the table', async () => {
    const { admin, club: c, member } = await scene(null)
    const row = await asked(c.id, member.id)
    expect((await press(c.id, row.id, { decision: 'decline' }, admin.id)).status).toBe(200)
    const entry = await env.DB.prepare(`SELECT target_member_id, target_label, detail FROM admin_audit_log WHERE action = 'club_rep_request_declined' AND json_extract(detail, '$.requestId') = ?`)
      .bind(row.id).first<{ target_member_id: string | null; target_label: string | null; detail: string }>()
    expect(entry).toMatchObject({ target_member_id: null, target_label: c.name })
    expect(JSON.parse(entry!.detail)).toEqual({ requestId: row.id, clubId: c.id })
    expect(JSON.stringify(entry)).not.toContain(member.email)
    expect(JSON.stringify(entry)).not.toContain(member.name)
    const leaving = await invoke(memberDelete, { method: 'DELETE', as: admin.id, params: { id: member.id } })
    expect(leaving.status).toBe(200)
    expect(await requestsOf(c.id)).toHaveLength(0)
  }, SLOW)
})
