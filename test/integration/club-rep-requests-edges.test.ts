// test/integration/club-rep-requests-edges.test.ts
//
// The edges of Ask to be its named rep (WS09 step 31) that the main file of
// the step leaves: the body's own refusals and the order of the guards, who
// may ask, the decision's own refusals (a body, an id, a request decided
// already, a seat that has ended, the second factor on a decline), the
// decision while only CLUB_KEEPERS_ON is set, what an audit row for a decline
// holds, the day a row is dated on at midnight and across the clock change
// in America/Chicago, two requests sent at the same second, a naming that
// meets a role or a request that has changed since the keeper read them, and
// a copy to the sign-in service that fails. Each case sets CLUB_PAGES_ON and
// CLUB_KEEPERS_ON through a getter on a mock of their module, and
// MAIL_LISTS_ON and MAIL_SENDER through getters on a mock of the mail
// switches, as the sibling files do; no case reads a shipped value of any
// switch. Every club, person and address is made up.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  REP_DECIDE_ALREADY, REP_DECIDE_FOR_KEEPERS, REP_DECIDE_NOT_THIS_CLUBS, REP_REQUESTS_CLOSED, REP_REQUEST_ALREADY, REP_REQUEST_FIELD_WORDS, REP_REQUEST_HAS_REP,
  REP_REQUEST_KEEPERS_BUSY, REP_REQUEST_LIMITS, REP_REQUEST_MEMBER_BUSY, REP_REQUEST_NO_CLUB, REP_CONNECTIONS,
} from '../../domain/clubs/repRequest'
import { onRequestPost as askPost } from '../../functions/api/clubs/[id]/rep-requests'
import { onRequestPost as decidePost } from '../../functions/api/admin/clubs/[id]/rep-requests/[requestId]'
import { onRequestGet as regionGet } from '../../functions/api/workspace/region'
import { onRequestGet as pageGet } from '../../functions/api/clubs/[id]/page'
import { declineRep, nameRep } from '../../functions/utils/clubs/nameRep'
import { getMemberById } from '../../functions/utils/admin/members'
import type { WorkspaceRegionResponse } from '../../domain/contracts'
import { seedClub, seedMember } from './factories'
import { emailBehavior, emailOutbox, invoke, resetHarness } from './harness'

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

const KEYED = { SIGNING_SECRET: 'example-made-up-signing-key-for-rep-request-edges' }
const NORTH = 'North Louisiana'
const LAKE = 'Lake Charles / Southwestern'
const SLOW = 30_000

let seq = 0
const mark = () => `${++seq}${crypto.randomUUID().slice(0, 6)}`

let underneath: typeof fetch
let copyStatus = 200
let copiesTried = 0

beforeEach(async () => {
  resetHarness()
  flags.pagesOn = true
  flags.keepersOn = true
  flags.listsOn = false
  flags.sender = 'resend'
  copyStatus = 200
  copiesTried = 0
  underneath = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(new Request(input as RequestInfo, init).url)
    if (url.origin === 'https://test-supabase.local' && url.pathname.startsWith('/auth/v1/admin/users/')) {
      copiesTried++
      if (copyStatus !== 200) return new Response(JSON.stringify({ message: 'example failure' }), { status: copyStatus, headers: { 'Content-Type': 'application/json' } })
    }
    return underneath(input, init)
  }) as typeof fetch
  const middle = new Date()
  middle.setUTCMinutes(30, 0, 0)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(middle)
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

async function giveSeat(regions: string[], memberId: string): Promise<string> {
  const seat = `seat-${mark()}`
  await env.DB.prepare(
    `INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active) VALUES (?, 'Example Region Representative', '', 99, ?, 'regional_rep', 1)`,
  ).bind(seat, seat).run()
  for (const region of regions) await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(seat, region).run()
  await env.DB.prepare('INSERT INTO board_seat_assignments (seat_id, member_id) VALUES (?, ?)').bind(seat, memberId).run()
  return seat
}

async function person(opts: { role?: string; clubId?: string | null } = {}): Promise<Person> {
  const m = mark()
  const made = { id: crypto.randomUUID(), name: `Player ${m}`, email: `player-${m}@example.org` }
  await seedMember({ id: made.id, fullName: made.name, email: made.email, role: opts.role, clubId: opts.clubId ?? null })
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

const ask = (clubId: string, as?: string, body: unknown = { connection: 'runs_it', note: 'I run the Tuesday nights.' }, extra: Record<string, unknown> = {}) =>
  invoke(askPost, { method: 'POST', params: { id: clubId }, body, as, aal: 'aal1', env: { ...KEYED, ...extra }, path: `/api/clubs/${clubId}/rep-requests` })
const press = (clubId: string, requestId: string | number, body: unknown, as: string, aal: 'aal1' | 'aal2' = 'aal2') =>
  invoke(decidePost, { method: 'POST', params: { id: clubId, requestId: String(requestId) }, body, as, aal, env: KEYED, path: `/api/admin/clubs/${clubId}/rep-requests/${requestId}` })
const regionOf = async (as: string) => (await (await invoke(regionGet, { as, aal: 'aal1' })).json<WorkspaceRegionResponse>())

interface Row { id: number; club_id: string; member_id: string; connection: string; note: string | null; status: string; decided_by: string | null; decided_at: string | null }
const requestsOf = async (clubId: string) => (await env.DB.prepare('SELECT * FROM club_rep_requests WHERE club_id = ? ORDER BY id').bind(clubId).all<Row>()).results
const roleAndClub = async (id: string) => {
  const m = await getMemberById(env.DB, id)
  return { role: m?.role, club_id: m?.club_id ?? null }
}
const rateRows = async () => (await env.DB.prepare('SELECT COUNT(*) AS n FROM rate_limits').first<{ n: number }>())!.n
const auditOf = async (action: string, memberId: string) =>
  (await env.DB.prepare('SELECT * FROM admin_audit_log WHERE action = ? AND target_member_id = ?').bind(action, memberId).all<{ actor_id: string; detail: string }>()).results
// A decline's entry names the club and the request, never the member (so a
// declined member can still be deleted), so it is found by the request's id.
const declineAuditOf = async (requestId: number) =>
  (await env.DB.prepare(`SELECT * FROM admin_audit_log WHERE action = 'club_rep_request_declined' AND json_extract(detail, '$.requestId') = ?`).bind(requestId).all<{ actor_id: string; detail: string; target_member_id: string | null; target_label: string | null }>()).results

async function openRequest(clubId: string, memberId: string, createdAt?: string): Promise<number> {
  if (createdAt) {
    await env.DB.prepare(`INSERT INTO club_rep_requests (club_id, member_id, connection, created_at) VALUES (?, ?, 'other', ?)`).bind(clubId, memberId, createdAt).run()
  } else {
    await env.DB.prepare(`INSERT INTO club_rep_requests (club_id, member_id, connection) VALUES (?, ?, 'other')`).bind(clubId, memberId).run()
  }
  return (await requestsOf(clubId)).at(-1)!.id
}

describe('the body of a request, and the order of the guards', () => {
  it.each([
    ['no connection', { note: 'Example note' }, REP_REQUEST_FIELD_WORDS.connectionMissing],
    ['a connection the list does not hold', { connection: 'owns_it', note: '' }, REP_REQUEST_FIELD_WORDS.connectionMissing],
    ['a note one character over its cap', { connection: 'runs_it', note: 'x'.repeat(REP_REQUEST_LIMITS.note + 1) }, REP_REQUEST_FIELD_WORDS.noteLong],
  ])('%s is refused with 400, the field\'s words, kept by no cache, and nothing saved or counted', async (_label, body, words) => {
    await onlyAdmin()
    const c = await club()
    const member = await person()
    const result = await ask(c.id, member.id, body)
    expect(result.status).toBe(400)
    expect(JSON.stringify(await result.json())).toContain(words)
    expect(result.response.headers.get('Cache-Control')).toBe('no-store')
    expect(await requestsOf(c.id)).toHaveLength(0)
    expect(await rateRows()).toBe(0)
    expect(emailOutbox).toHaveLength(0)
  })

  it('a note of exactly its cap, and each of the four connections with no note, are saved; the connection is kept as its fixed key', async () => {
    await onlyAdmin()
    const member = await person()
    const c = await club(null)
    expect((await ask(c.id, member.id, { connection: 'helps_run_it', note: 'x'.repeat(REP_REQUEST_LIMITS.note) })).status).toBe(200)
    const [row] = await requestsOf(c.id)
    expect(row.connection).toBe('helps_run_it')
    expect(row.note).toHaveLength(REP_REQUEST_LIMITS.note)
    for (const { key } of REP_CONNECTIONS) {
      const other = await club(null)
      const asker = await person()
      expect((await ask(other.id, asker.id, { connection: key })).status, key).toBe(200)
      const [saved] = await requestsOf(other.id)
      expect(saved.connection).toBe(key)
      expect(saved.note === null || saved.note === '').toBe(true)
    }
  }, SLOW)

  it('signed out is 401 whatever the body, and the closed answer comes before the body is read', async () => {
    const c = await club()
    expect((await ask(c.id, undefined, { connection: 'nope' })).status).toBe(401)
    flags.pagesOn = false
    const member = await person()
    const closed = await ask(c.id, member.id, { connection: 'nope' })
    expect(closed.status).toBe(403)
    expect(await closed.json()).toEqual({ error: REP_REQUESTS_CLOSED })
  })

  it('the member\'s count comes before the club: a fourth request is a 429 even for a club that has a rep or none', async () => {
    await onlyAdmin()
    emailBehavior.succeed = false
    const member = await person()
    for (let i = 0; i < 3; i++) expect((await ask((await club(null)).id, member.id)).status).toBe(200)
    const withRep = await club()
    await person({ role: 'club_rep', clubId: withRep.id })
    const hasRep = await ask(withRep.id, member.id)
    expect(hasRep.status).toBe(429)
    expect(await hasRep.json()).toEqual({ error: REP_REQUEST_MEMBER_BUSY })
    const none = await ask('example-no-such-club', member.id)
    expect(none.status).toBe(429)
  }, SLOW)

  it('a club with a rep, an address naming no club and an open request each answer before the keepers\' count is spent', async () => {
    await onlyAdmin()
    emailBehavior.succeed = false
    const asker = await person()
    const c = await club(null)
    expect((await ask(c.id, asker.id)).status).toBe(200)
    // Nine more to the admins' set make ten, which is all it takes this hour.
    for (let i = 0; i < 9; i++) expect((await ask((await club(null)).id, (await person()).id)).status).toBe(200)
    const again = await ask(c.id, asker.id)
    expect(again.status).toBe(409)
    expect(await again.json()).toEqual({ error: REP_REQUEST_ALREADY })
    const none = await ask('example-no-such-club', (await person()).id)
    expect(none.status).toBe(404)
    expect(await none.json()).toEqual({ error: REP_REQUEST_NO_CLUB })
    const ruled = await club(null)
    await person({ role: 'club_rep', clubId: ruled.id })
    const has = await ask(ruled.id, (await person()).id)
    expect(has.status).toBe(409)
    expect(await has.json()).toEqual({ error: REP_REQUEST_HAS_REP })
    const fresh = await ask((await club(null)).id, (await person()).id)
    expect(fresh.status).toBe(429)
    expect(await fresh.json()).toEqual({ error: REP_REQUEST_KEEPERS_BUSY })
  }, SLOW)
})

describe('who may ask', () => {
  it.each(['member', 'club_rep', 'tournament_director', 'lca_officer', 'lca_auditor', 'lca_observer', 'lca_admin'] as const)('a signed-in %s may ask, and the row is theirs from the session', async (role) => {
    await onlyAdmin()
    const c = await club(null)
    const other = await club()
    const asker = await person({ role, clubId: role === 'club_rep' ? other.id : null })
    const result = await ask(c.id, asker.id)
    expect(result.status).toBe(200)
    expect((await requestsOf(c.id)).map((r) => r.member_id)).toEqual([asker.id])
  }, SLOW)

  it('a member with an open request for one club may ask for another, and may ask again once it is decided', async () => {
    const admin = await onlyAdmin()
    const member = await person()
    const one = await club(null)
    const two = await club(null)
    expect((await ask(one.id, member.id)).status).toBe(200)
    expect((await ask(two.id, member.id)).status).toBe(200)
    const [row] = await requestsOf(one.id)
    expect((await press(one.id, row.id, { decision: 'decline' }, admin.id)).status).toBe(200)
    expect((await ask(one.id, member.id)).status).toBe(200)
    expect((await requestsOf(one.id)).map((r) => r.status)).toEqual(['declined', 'open'])
  }, SLOW)

  it('only a club_rep with this club on their row is its named rep: a plain member on its roster does not stop a request', async () => {
    await onlyAdmin()
    const c = await club(null)
    await person({ clubId: c.id })
    const page = await (await invoke(pageGet, { params: { id: c.id } })).json<{ rep_wanted?: boolean }>()
    expect(page.rep_wanted).toBe(true)
    expect((await ask(c.id, (await person()).id)).status).toBe(200)
    await person({ role: 'club_rep', clubId: c.id })
    expect((await (await invoke(pageGet, { params: { id: c.id } })).json<{ rep_wanted?: boolean }>()).rep_wanted).toBe(false)
  }, SLOW)
})

describe('the decision\'s own refusals', () => {
  it.each([
    ['no decision', {}],
    ['a decision that is neither', { decision: 'maybe' }],
    ['a role that is not a text', { decision: 'approve', role: 7 }],
  ])('%s is refused with 400 and nothing changes', async (_label, body) => {
    const admin = await onlyAdmin()
    const c = await club()
    const member = await person()
    const id = await openRequest(c.id, member.id)
    const result = await press(c.id, id, body, admin.id)
    expect(result.status).toBe(400)
    expect(result.response.headers.get('Cache-Control')).toBe('no-store')
    expect(await roleAndClub(member.id)).toEqual({ role: 'member', club_id: null })
    expect((await requestsOf(c.id))[0].status).toBe('open')
  })

  it.each(['0', '-1', '1.5', 'abc', '99999999999999999999', '1e3'])('a request id of %s names no request of this club', async (rawId) => {
    const admin = await onlyAdmin()
    const c = await club()
    const result = await press(c.id, rawId, { decision: 'decline' }, admin.id)
    expect(result.status).toBe(404)
    expect(await result.json()).toEqual({ error: REP_DECIDE_NOT_THIS_CLUBS })
  })

  it('a request of another club, or of a club that does not exist, is a 404 and is left open', async () => {
    const admin = await onlyAdmin()
    const c = await club()
    const other = await club()
    const id = await openRequest(c.id, (await person()).id)
    expect((await press(other.id, id, { decision: 'decline' }, admin.id)).status).toBe(404)
    expect((await press('example-no-such-club', id, { decision: 'decline' }, admin.id)).status).toBe(404)
    expect((await requestsOf(c.id))[0].status).toBe('open')
  })

  it('a request decided already is a 409 in words for either decision, replayed, with the member unchanged and no second audit row or email', async () => {
    const admin = await onlyAdmin()
    const c = await club()
    const member = await person()
    const id = await openRequest(c.id, member.id)
    expect((await press(c.id, id, { decision: 'decline' }, admin.id)).status).toBe(200)
    emailOutbox.length = 0
    for (const body of [{ decision: 'decline' }, { decision: 'approve', role: 'member' }]) {
      const again = await press(c.id, id, body, admin.id)
      expect(again.status).toBe(409)
      expect(await again.json()).toEqual({ error: REP_DECIDE_ALREADY })
    }
    expect(await roleAndClub(member.id)).toEqual({ role: 'member', club_id: null })
    expect(await declineAuditOf(id)).toHaveLength(1)
    expect(await auditOf('club_rep_named', member.id)).toHaveLength(0)
    expect(emailOutbox).toHaveLength(0)
  })

  it('an LCA admin is asked the second factor on a decline too, and nothing changes without it', async () => {
    const admin = await onlyAdmin()
    const c = await club()
    const member = await person()
    const id = await openRequest(c.id, member.id)
    const result = await press(c.id, id, { decision: 'decline' }, admin.id, 'aal1')
    expect(result.status).toBe(403)
    expect(await result.json()).toMatchObject({ mfaRequired: true })
    expect((await requestsOf(c.id))[0].status).toBe('open')
  })
})

describe('who holds the seat', () => {
  it('a representative whose seat has ended, or whose seat is no longer active, is 403 and changes nothing', async () => {
    await onlyAdmin()
    const c = await club()
    const member = await person()
    const id = await openRequest(c.id, member.id)
    const past = await person()
    const pastSeat = await giveSeat([NORTH], past.id)
    await env.DB.prepare(`UPDATE board_seat_assignments SET ended_at = datetime('now') WHERE seat_id = ?`).bind(pastSeat).run()
    const retired = await person()
    const retiredSeat = await giveSeat([NORTH], retired.id)
    await env.DB.prepare('UPDATE board_members SET is_active = 0 WHERE id = ?').bind(retiredSeat).run()
    for (const who of [past, retired]) {
      const result = await press(c.id, id, { decision: 'approve', role: 'member' }, who.id, 'aal1')
      expect(result.status).toBe(403)
      expect(await result.json()).toEqual({ error: REP_DECIDE_FOR_KEEPERS })
    }
    expect(await roleAndClub(member.id)).toEqual({ role: 'member', club_id: null })
  })

  it('a seat that covers several regions, this club\'s among them, decides it; the same seat sees no row of a region it does not cover', async () => {
    await onlyAdmin()
    const c = await club(LAKE)
    const away = await club('Southeast Louisiana')
    const keeper = await person()
    await giveSeat([NORTH, LAKE], keeper.id)
    const member = await person()
    const here = await openRequest(c.id, member.id)
    const there = await openRequest(away.id, (await person()).id)
    const rows = (await regionOf(keeper.id)).repRequests ?? []
    expect(rows.map((r) => r.id)).toEqual([here])
    expect((await press(away.id, there, { decision: 'decline' }, keeper.id, 'aal1')).status).toBe(403)
    expect((await press(c.id, here, { decision: 'approve', role: 'member' }, keeper.id, 'aal1')).status).toBe(200)
    expect(await roleAndClub(member.id)).toEqual({ role: 'club_rep', club_id: c.id })
  }, SLOW)

  it('with only CLUB_KEEPERS_ON set, a request already saved can still be decided, and no new one can be sent', async () => {
    const admin = await onlyAdmin()
    const c = await club()
    const member = await person()
    const id = await openRequest(c.id, member.id)
    flags.pagesOn = false
    expect((await ask(c.id, (await person()).id)).status).toBe(403)
    const result = await press(c.id, id, { decision: 'approve', role: 'member' }, admin.id)
    expect(result.status).toBe(200)
    expect(await roleAndClub(member.id)).toEqual({ role: 'club_rep', club_id: c.id })
  }, SLOW)
})

describe('what a decision writes', () => {
  it('a decline writes one audit row naming the request and the club and never the member, and the request keeps who and when', async () => {
    const admin = await onlyAdmin()
    const c = await club()
    const member = await person()
    const id = await openRequest(c.id, member.id)
    expect((await press(c.id, id, { decision: 'decline' }, admin.id)).status).toBe(200)
    const audit = await declineAuditOf(id)
    expect(audit).toHaveLength(1)
    expect(audit[0].actor_id).toBe(admin.id)
    expect(audit[0].target_member_id).toBeNull()
    expect(audit[0].target_label).toBe(c.name)
    expect(JSON.parse(audit[0].detail)).toEqual({ requestId: id, clubId: c.id })
    const [row] = await requestsOf(c.id)
    expect(row).toMatchObject({ status: 'declined', decided_by: admin.id })
    expect(row.decided_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  })

  it('naming a rep who held another role records the role before in the audit row, and a club the member was on', async () => {
    const admin = await onlyAdmin()
    const c = await club()
    const other = await club()
    const member = await person({ role: 'tournament_director', clubId: other.id })
    const id = await openRequest(c.id, member.id)
    expect((await press(c.id, id, { decision: 'approve', role: 'tournament_director' }, admin.id)).status).toBe(200)
    const audit = await auditOf('club_rep_named', member.id)
    expect(audit).toHaveLength(1)
    expect(JSON.parse(audit[0].detail)).toEqual({ requestId: id, clubId: c.id, from: 'tournament_director', to: 'club_rep', clubFrom: other.id })
  }, SLOW)

  it('a copy to the sign-in service that fails does not undo the naming: the role and club stand, the request reads approved, the member is told', async () => {
    const admin = await onlyAdmin()
    const c = await club()
    const member = await person()
    const id = await openRequest(c.id, member.id)
    copyStatus = 500
    const result = await press(c.id, id, { decision: 'approve', role: 'member' }, admin.id)
    expect(result.status).toBe(200)
    expect(copiesTried).toBeGreaterThan(0)
    expect(await roleAndClub(member.id)).toEqual({ role: 'club_rep', club_id: c.id })
    expect((await requestsOf(c.id))[0].status).toBe('approved')
    expect(await auditOf('club_rep_named', member.id)).toHaveLength(1)
    expect(emailOutbox.map((m) => m.to)).toEqual([member.email])
  }, SLOW)
})

describe('a naming that meets a change since the keeper read the row', () => {
  const site = () => new Request('https://example.org/api/admin/clubs/x/rep-requests/1', { method: 'POST' })

  it('the member\'s role changed since the read: nothing is written, nothing is copied, audited or sent, and the request stays open', async () => {
    const admin = await onlyAdmin()
    const c = await club()
    const member = await person()
    const id = await openRequest(c.id, member.id)
    const read = (await getMemberById(env.DB, member.id))!
    await env.DB.prepare(`UPDATE members SET role = 'tournament_director' WHERE id = ?`).bind(member.id).run()
    const decider = (await getMemberById(env.DB, admin.id))!
    expect(await nameRep(env as never, site(), decider, id, c, read)).toBe(false)
    expect(await roleAndClub(member.id)).toEqual({ role: 'tournament_director', club_id: null })
    expect((await requestsOf(c.id))[0]).toMatchObject({ status: 'open', decided_by: null, decided_at: null })
    expect(copiesTried).toBe(0)
    expect(await auditOf('club_rep_named', member.id)).toHaveLength(0)
    expect(emailOutbox).toHaveLength(0)
  })

  it('the member was made this club\'s rep by other hands since the read: the request, moot by then, is marked approved, and nothing else is written', async () => {
    const admin = await onlyAdmin()
    const c = await club()
    const member = await person()
    const id = await openRequest(c.id, member.id)
    const read = (await getMemberById(env.DB, member.id))!
    await env.DB.prepare(`UPDATE members SET role = 'club_rep', club_id = ? WHERE id = ?`).bind(c.id, member.id).run()
    const decider = (await getMemberById(env.DB, admin.id))!
    // Neither guard reads the count of the statement before: each reads the rows themselves.
    expect(await nameRep(env as never, site(), decider, id, c, read)).toBe(false)
    expect(await roleAndClub(member.id)).toEqual({ role: 'club_rep', club_id: c.id })
    expect((await requestsOf(c.id))[0]).toMatchObject({ status: 'approved', decided_by: admin.id })
    expect(copiesTried).toBe(0)
    expect(await auditOf('club_rep_named', member.id)).toHaveLength(0)
    expect(emailOutbox).toHaveLength(0)
  })

  it('the request was decided since the read: the member is not changed, and a decline is refused the same way', async () => {
    const admin = await onlyAdmin()
    const c = await club()
    const member = await person()
    const id = await openRequest(c.id, member.id)
    const read = (await getMemberById(env.DB, member.id))!
    await env.DB.prepare(`UPDATE club_rep_requests SET status = 'declined' WHERE id = ?`).bind(id).run()
    const decider = (await getMemberById(env.DB, admin.id))!
    expect(await nameRep(env as never, site(), decider, id, c, read)).toBe(false)
    expect(await declineRep(env as never, site(), decider, id, c, read)).toBe(false)
    expect(await roleAndClub(member.id)).toEqual({ role: 'member', club_id: null })
    expect(copiesTried).toBe(0)
    expect(await auditOf('club_rep_named', member.id)).toHaveLength(0)
    expect(await declineAuditOf(id)).toHaveLength(0)
    expect(emailOutbox).toHaveLength(0)
  })

  it('a request that belongs to another member or club than the one named is never decided by a mismatched call', async () => {
    const admin = await onlyAdmin()
    const c = await club()
    const other = await club()
    const asker = await person()
    const bystander = await person()
    const id = await openRequest(c.id, asker.id)
    const decider = (await getMemberById(env.DB, admin.id))!
    const bystanderRow = (await getMemberById(env.DB, bystander.id))!
    expect(await nameRep(env as never, site(), decider, id, c, bystanderRow)).toBe(false)
    expect(await nameRep(env as never, site(), decider, id, other, (await getMemberById(env.DB, asker.id))!)).toBe(false)
    expect(await roleAndClub(bystander.id)).toEqual({ role: 'member', club_id: null })
    expect(await roleAndClub(asker.id)).toEqual({ role: 'member', club_id: null })
    expect((await requestsOf(c.id))[0].status).toBe('open')
  })
})

describe('the date on a row', () => {
  // Louisiana keeps America/Chicago: UTC-5 until 2:00 AM on Sunday, November 1, 2026, then UTC-6; UTC-6 until
  // 2:00 AM on Sunday, March 8, 2026, then UTC-5.
  it.each([
    ['2026-11-01 04:59:59', 'Sat, Oct 31'],
    ['2026-11-01 05:00:00', 'Sun, Nov 1'],
    ['2026-11-01 06:59:59', 'Sun, Nov 1'],
    ['2026-11-01 07:00:00', 'Sun, Nov 1'],
    ['2026-11-02 05:59:59', 'Sun, Nov 1'],
    ['2026-11-02 06:00:00', 'Mon, Nov 2'],
    ['2026-03-08 05:59:59', 'Sat, Mar 7'],
    ['2026-03-08 06:00:00', 'Sun, Mar 8'],
    ['2026-03-09 04:59:59', 'Sun, Mar 8'],
    ['2026-03-09 05:00:00', 'Mon, Mar 9'],
  ])('a request saved at %s UTC is dated %s', async (stored, expected) => {
    const admin = await onlyAdmin()
    const c = await club()
    const id = await openRequest(c.id, (await person()).id, stored)
    const row = (await regionOf(admin.id)).repRequests?.find((r) => r.id === id)
    expect(row?.sentOn).toBe(expected)
  })

  it('two requests saved in the same second are listed oldest first, ties by their number', async () => {
    const admin = await onlyAdmin()
    const c = await club()
    const first = await openRequest(c.id, (await person()).id, '2026-10-20 15:00:00')
    const second = await openRequest(c.id, (await person()).id, '2026-10-20 15:00:00')
    const earlier = await openRequest(c.id, (await person()).id, '2026-10-19 12:00:00')
    expect(((await regionOf(admin.id)).repRequests ?? []).map((r) => r.id)).toEqual([earlier, first, second])
  })
})

describe('stale and empty data', () => {
  it('a request whose member has no club and whose note is empty draws a row with no note; an empty note is no note', async () => {
    const admin = await onlyAdmin()
    const c = await club()
    const id = await openRequest(c.id, (await person()).id)
    const row = (await regionOf(admin.id)).repRequests?.find((r) => r.id === id)
    expect(row?.note ?? '').toBe('')
  })

  it('a request already decided is on no keeper\'s rows, and My region carries no key once none is open', async () => {
    const admin = await onlyAdmin()
    const c = await club()
    const id = await openRequest(c.id, (await person()).id)
    expect((await press(c.id, id, { decision: 'decline' }, admin.id)).status).toBe(200)
    expect(await regionOf(admin.id)).not.toHaveProperty('repRequests')
  })
})
