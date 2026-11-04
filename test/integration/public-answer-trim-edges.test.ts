// test/integration/public-answer-trim-edges.test.ts
//
// The Phase 0 trim of the public answers at its edges, through the real
// handlers with rows each test seeds (brief section 4; D3, D15, D29;
// assumed, Q14 and Q38). public-answer-trim.test.ts and the role-safety
// cases in contracts/ hold the main rules; this file holds what they leave
// open:
// - who is answered created_by, keep_apart and report_settings, written out
//   viewer by viewer rather than read off canManageTournament: a session
//   that fails, an auditor, a member of the organizing club, a director of
//   another event, the event's creator once they no longer run it, a guest
//   with an assignment, a rep who directs another club's event; the hidden
//   draft; and a manager answered the stored nulls where anyone else gets
//   no key at all;
// - the manage page's answer, which only the event's managers reach, keeps
//   the three and every full name with both constants set, and turns
//   everyone else away with none of it;
// - with CLUB_EMAIL_HIDDEN set no public answer carries a club's address
//   (the club list, the club page's answer, the search and the page's link
//   preview), while the club's admin page still answers it to the club's
//   admins and its rep;
// - the roster before the event, the entrants list D15 is about: who is
//   shortened and who is not, the rest of each row and the order unchanged,
//   the standings, every entrant at no score, in full as before (D3), the
//   rule read entry by entry, a hidden draft's roster and an empty one;
// - two children tied for first: the standings and the shared prize keep
//   their full names for everyone (D3) while the roster is shortened;
// - reads made at once, and made again, give each viewer their own answer.
// The two constants are false in the tree; as in public-answer-trim.test.ts,
// each is read here through a getter on its mocked module.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { contracts } from '../../domain/contracts'
import type { Env } from '../../functions/types'
import { onRequestGet as clubsGet } from '../../functions/api/clubs'
import { onRequestGet as clubGet } from '../../functions/api/clubs/[id]'
import { onRequestGet as adminClubGet } from '../../functions/api/admin/clubs/[id]'
import { onRequestGet as searchGet } from '../../functions/api/search'
import { onRequestGet as clubPageGet } from '../../functions/clubs/[id]'
import { onRequestGet as tournamentsGet } from '../../functions/api/tournaments'
import { onRequestGet as tournamentGet } from '../../functions/api/tournaments/[id]'
import { onRequestGet as manageGet } from '../../functions/api/admin/tournaments/[id]/manage'
import { seedAdmin, seedClub, seedDirector, seedMember, seedRegistration, seedTournament, seedTournamentDirector } from './factories'
import { expectContract, invoke, resetHarness } from './harness'

const flags = vi.hoisted(() => ({ clubEmailHidden: false, rosterShortNames: false }))
vi.mock('../../functions/utils/clubs/publicAnswer', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/clubs/publicAnswer')>()
  return {
    ...real,
    get CLUB_EMAIL_HIDDEN() {
      return flags.clubEmailHidden
    },
  }
})
vi.mock('../../functions/utils/events/publicAnswer', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/events/publicAnswer')>()
  return {
    ...real,
    get ROSTER_SHORT_NAMES() {
      return flags.rosterShortNames
    },
  }
})

beforeEach(resetHarness)
afterEach(() => {
  flags.clubEmailHidden = false
  flags.rosterShortNames = false
  vi.restoreAllMocks()
})

const listContract = contracts['tournaments'].GET
const detailContract = contracts['tournaments/[id]'].GET
const manageContract = contracts['admin/tournaments/[id]/manage'].GET
const clubContract = contracts['clubs/[id]'].GET

const MANAGERS_ONLY = ['created_by', 'keep_apart', 'report_settings'] as const
/** The event's US Chess affiliate, a word no other part of any answer holds. */
const AFFILIATE = 'A6000417'
const SETTINGS = JSON.stringify({ affiliateId: AFFILIATE })

/** Which of the three an answer's tournament carries, in the list's order. */
const keysOf = (tournament: object) => MANAGERS_ONLY.filter((key) => Object.hasOwn(tournament, key))

// ── Who is answered the three ────────────────────────────────────────

interface Viewer {
  label: string
  as?: string
  headers?: Record<string, string>
  /** Whether this viewer manages the club's events, written out by hand. */
  manages: boolean
}

/**
 * A club with a visible event and a hidden draft, both carrying the three
 * fields, another club with an event of its own, and sixteen kinds of
 * viewer. The rep who made the two has since handed the club over and is a
 * plain member again.
 */
async function seedEventsAndViewers() {
  const clubId = await seedClub({ name: 'Bayou Pawns' })
  const otherClub = await seedClub({ name: 'Delta Knights' })
  const creator = await seedMember({ role: 'club_rep', clubId, fullName: 'Casey Creator' })
  const event = await seedTournament({ clubId, name: 'Bayou Fall Open' })
  const draft = await seedTournament({ clubId, name: 'Bayou Winter Open', isVisible: false })
  const elsewhere = await seedTournament({ clubId: otherClub, name: 'Delta Swiss' })
  for (const id of [event, draft]) {
    await env.DB.prepare(`UPDATE tournaments SET created_by = ?, keep_apart = 'family_club', report_settings = ? WHERE id = ?`)
      .bind(creator, SETTINGS, id).run()
  }
  await env.DB.prepare(`UPDATE members SET role = 'member' WHERE id = ?`).bind(creator).run()
  const assigned = async (memberId: string, ...tournamentIds: string[]) => {
    for (const id of tournamentIds) await seedTournamentDirector(id, memberId)
    return memberId
  }
  const viewers: Viewer[] = [
    { label: 'signed out', manages: false },
    { label: 'a session that fails', headers: { Authorization: 'Bearer invalid-session' }, manages: false },
    { label: 'a plain member', as: await seedMember(), manages: false },
    { label: 'a member of the organizing club', as: await seedMember({ clubId }), manages: false },
    { label: 'a director with no assignment', as: await seedDirector(), manages: false },
    { label: 'the director of another club\'s event', as: await assigned(await seedDirector(), elsewhere), manages: false },
    { label: 'another club\'s rep', as: await seedMember({ role: 'club_rep', clubId: otherClub }), manages: false },
    { label: 'an auditor', as: await seedMember({ role: 'lca_auditor' }), manages: false },
    { label: 'the creator, no longer the club\'s rep', as: creator, manages: false },
    { label: 'a guest assigned to direct it', as: await assigned(await seedMember({ role: 'guest' }), event), manages: false },
    { label: 'the organizing club\'s rep', as: await seedMember({ role: 'club_rep', clubId }), manages: true },
    { label: 'a member assigned to direct both', as: await assigned(await seedMember(), event, draft), manages: true },
    { label: 'another club\'s rep assigned to direct both', as: await assigned(await seedMember({ role: 'club_rep', clubId: otherClub }), event, draft), manages: true },
    { label: 'an LCA admin', as: await seedAdmin(), manages: true },
    { label: 'an observer', as: await seedMember({ role: 'lca_observer' }), manages: true },
    { label: 'an officer', as: await seedMember({ role: 'lca_officer' }), manages: true },
  ]
  return { creator, event, draft, viewers }
}

const signIn = (viewer: Viewer) => ({ as: viewer.as, headers: viewer.headers })
const listed = async (viewer: Viewer) =>
  expectContract(await invoke(tournamentsGet, { ...signIn(viewer), path: '/api/tournaments' }), listContract.response)

describe('who is answered created_by, keep_apart and report_settings, viewer by viewer', () => {
  it('a visible event: both answers carry the three, as stored, to its managers alone, and no one else\'s answer holds a trace of them', async () => {
    const { creator, event, viewers } = await seedEventsAndViewers()
    for (const viewer of viewers) {
      const row = (await listed(viewer)).tournaments.find((t) => t.id === event)
      expect(row, viewer.label).toBeDefined()
      const result = await invoke(tournamentGet, { ...signIn(viewer), params: { id: event } })
      expect(result.status, viewer.label).toBe(200)
      const detail = await expectContract(result, detailContract.response)
      for (const tournament of [row!, detail.tournament]) {
        if (viewer.manages) {
          expect(tournament, viewer.label).toMatchObject({ created_by: creator, keep_apart: 'family_club', report_settings: SETTINGS })
        } else {
          expect(keysOf(tournament), viewer.label).toEqual([])
        }
      }
      if (!viewer.manages) {
        const text = await result.response.text()
        for (const key of MANAGERS_ONLY) expect(text, `${viewer.label}: ${key}`).not.toContain(`"${key}"`)
        expect(text, viewer.label).not.toContain(AFFILIATE)
        expect(text, viewer.label).not.toContain(creator)
      }
    }
  })

  it('a hidden draft: its managers find it in the list and the detail with the three; everyone else finds it in neither, and its 404 holds none of it', async () => {
    const { creator, draft, viewers } = await seedEventsAndViewers()
    for (const viewer of viewers) {
      const row = (await listed(viewer)).tournaments.find((t) => t.id === draft)
      const result = await invoke(tournamentGet, { ...signIn(viewer), params: { id: draft } })
      if (viewer.manages) {
        expect(row, viewer.label).toMatchObject({ created_by: creator, keep_apart: 'family_club', report_settings: SETTINGS })
        expect(result.status, viewer.label).toBe(200)
        const detail = await expectContract(result, detailContract.response)
        expect(detail.tournament, viewer.label).toMatchObject({ created_by: creator, keep_apart: 'family_club', report_settings: SETTINGS })
      } else {
        expect(row, viewer.label).toBeUndefined()
        expect(result.status, viewer.label).toBe(404)
        const text = await result.response.text()
        expect(text, viewer.label).not.toContain(AFFILIATE)
        expect(text, viewer.label).not.toContain('Bayou Winter Open')
      }
    }
  })

  it('an event with no creator and no report settings: its managers are answered the stored nulls, and everyone else no key at all, never a null', async () => {
    const clubId = await seedClub()
    const tournamentId = await seedTournament({ clubId })
    const managers = [await seedAdmin(), await seedMember({ role: 'club_rep', clubId })]
    for (const as of managers) {
      const row = (await expectContract(await invoke(tournamentsGet, { as, path: '/api/tournaments' }), listContract.response)).tournaments.find((t) => t.id === tournamentId)!
      const detail = await expectContract(await invoke(tournamentGet, { as, params: { id: tournamentId } }), detailContract.response)
      for (const tournament of [row, detail.tournament]) {
        expect(keysOf(tournament), as).toEqual([...MANAGERS_ONLY])
        expect(tournament, as).toMatchObject({ created_by: null, keep_apart: 'family', report_settings: null })
      }
    }
    for (const as of [undefined, await seedMember()]) {
      const listResult = await invoke(tournamentsGet, { as, path: '/api/tournaments' })
      const detailResult = await invoke(tournamentGet, { as, params: { id: tournamentId } })
      const row = (await expectContract(listResult, listContract.response)).tournaments.find((t) => t.id === tournamentId)!
      const detail = await expectContract(detailResult, detailContract.response)
      for (const tournament of [row, detail.tournament]) expect(keysOf(tournament), String(as)).toEqual([])
      for (const text of [await listResult.response.text(), await detailResult.response.text()]) {
        for (const key of MANAGERS_ONLY) expect(text, `${String(as)}: ${key}`).not.toContain(`"${key}"`)
      }
    }
  })

  it('reads made at once and made again give each viewer their own answer: a visitor\'s trimmed copy never reaches a manager, nor the reverse', async () => {
    const clubId = await seedClub()
    const rep = await seedMember({ role: 'club_rep', clubId })
    const tournamentId = await seedTournament({ clubId })
    await env.DB.prepare(`UPDATE tournaments SET created_by = ?, report_settings = ? WHERE id = ?`).bind(rep, SETTINGS, tournamentId).run()
    const admin = await seedAdmin()
    const member = await seedMember()
    const readers = [undefined, admin, member, rep, undefined, rep, admin, member]
    const manages = (as: string | undefined) => as === admin || as === rep
    const readAll = () => Promise.all(readers.flatMap((as) => [
      invoke(tournamentGet, { as, params: { id: tournamentId } })
        .then((r) => expectContract(r, detailContract.response))
        .then((body) => body.tournament as Record<string, unknown>),
      invoke(tournamentsGet, { as, path: '/api/tournaments' })
        .then((r) => expectContract(r, listContract.response))
        .then((body) => body.tournaments.find((t) => t.id === tournamentId) as Record<string, unknown>),
    ]))
    const first = await readAll()
    first.forEach((tournament, i) => {
      const as = readers[Math.floor(i / 2)]
      expect(keysOf(tournament), `${String(as)}, answer ${i}`).toEqual(manages(as) ? [...MANAGERS_ONLY] : [])
    })
    expect(await readAll()).toEqual(first)
  })
})

// ── The manage page's answer ─────────────────────────────────────────

describe('the manage page\'s answer, which only the event\'s managers reach', () => {
  it('keeps the three and every full name with both constants set, for each kind of manager, and turns everyone else away with none of it', async () => {
    const clubId = await seedClub()
    const otherClub = await seedClub()
    const rep = await seedMember({ role: 'club_rep', clubId })
    const tournamentId = await seedTournament({ clubId, sections: [{ name: 'Open', entryFee: 20 }] })
    await env.DB.prepare(`UPDATE tournaments SET created_by = ?, keep_apart = 'none', report_settings = ? WHERE id = ?`).bind(rep, SETTINGS, tournamentId).run()
    const parent = await seedMember({ fullName: 'Nora Landry' })
    const child = await seedMember({ fullName: 'Theo Landry' })
    await env.DB.prepare('UPDATE members SET guardian_id = ? WHERE id = ?').bind(parent, child).run()
    await seedRegistration({ tournamentId, memberId: child })
    const director = await seedMember()
    await seedTournamentDirector(tournamentId, director)
    flags.clubEmailHidden = true
    flags.rosterShortNames = true

    for (const as of [await seedAdmin(), await seedMember({ role: 'lca_observer' }), await seedMember({ role: 'lca_officer' }), rep, director]) {
      const result = await invoke(manageGet, { as, params: { id: tournamentId } })
      expect(result.status, as).toBe(200)
      const body = await expectContract(result, manageContract.response)
      expect(body.tournament, as).toMatchObject({ created_by: rep, keep_apart: 'none', report_settings: SETTINGS })
      expect(body.roster.map((r) => r.full_name), as).toEqual(['Theo Landry'])
    }
    const turnedAway: Array<[string | undefined, number]> = [
      [undefined, 401],
      [await seedMember(), 403],
      [parent, 403],
      [await seedMember({ role: 'club_rep', clubId: otherClub }), 403],
    ]
    for (const [as, status] of turnedAway) {
      const result = await invoke(manageGet, { as, params: { id: tournamentId } })
      expect(result.status, String(as)).toBe(status)
      const text = await result.response.text()
      expect(text, String(as)).not.toContain(AFFILIATE)
      expect(text, String(as)).not.toContain('Theo')
    }
  })
})

// ── A club's address ─────────────────────────────────────────────────

const ADDRESS = 'point.club.contact@example.org'
const OFFICER_EMAIL = 'robin.officer@example.org'

/** The app's shell as Pages serves it, for the club page's own route to write its link preview into. */
const SHELL = '<!doctype html><html lang="en"><head><title>Louisiana Chess Association</title>'
  + '<meta name="description" content="" /><meta property="og:title" content="" /><meta property="og:description" content="" />'
  + '</head><body><div id="root"></div></body></html>'

/** A club with an address, meeting on Thursdays, and an officer with an address of their own. */
async function seedClubWithAddress(name: string) {
  const clubId = await seedClub({ name, city: 'Houma' })
  await env.DB.prepare(`UPDATE clubs SET contact_email = ?, meeting_schedule = 'Thursdays at 7:00 PM', location = 'Houma Library' WHERE id = ?`)
    .bind(ADDRESS, clubId).run()
  const officer = await seedMember({ fullName: 'Robin Officer', email: OFFICER_EMAIL })
  await env.DB.prepare(`INSERT INTO club_officers (id, club_id, member_id, role) VALUES (?, ?, ?, 'President')`).bind(`off-${clubId}`, clubId, officer).run()
  return { clubId, rep: await seedMember({ role: 'club_rep', clubId }), admin: await seedAdmin() }
}

/**
 * Every public answer that carries the club, as text, by its route: the
 * club list, the club page's answer, the search for `query` and the club
 * page's own route with its link preview. Each is checked to have found the
 * club, so that an answer without the address is not merely an answer
 * without the club.
 */
async function publicAnswers(clubId: string, name: string, query: string, as?: string): Promise<Record<string, string>> {
  const list = await invoke(clubsGet, { as, path: '/api/clubs' })
  expect(list.status).toBe(200)
  expect((await list.json<{ clubs: Array<{ id: string }> }>()).clubs.map((c) => c.id)).toContain(clubId)

  const detail = await invoke(clubGet, { as, params: { id: clubId } })
  expect((await expectContract(detail, clubContract.response)).club.name).toBe(name)

  const search = await invoke(searchGet, { as, path: `/api/search?q=${encodeURIComponent(query)}` })
  expect(search.status).toBe(200)
  const searchText = await search.response.text()
  expect(searchText).toContain(`/clubs/${clubId}`)

  const page = await clubPageGet({
    request: new Request(`https://lca-website.pages.dev/clubs/${clubId}`),
    env: env as unknown as Env,
    params: { id: clubId },
    data: {},
    functionPath: `/clubs/${clubId}`,
    waitUntil: () => {},
    passThroughOnException: () => {},
    next: async () => new Response(SHELL, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }),
  } as unknown as EventContext<Env, string, unknown>)
  expect(page.status).toBe(200)
  const pageText = await page.text()
  expect(pageText).toContain(`<title>${name} | `)

  return {
    'GET /api/clubs': await list.response.text(),
    'GET /api/clubs/[id]': await detail.response.text(),
    'GET /api/search': searchText,
    'GET /clubs/[id]': pageText,
  }
}

describe('a club\'s address in every public answer', () => {
  it('unset: the club page\'s answer alone carries the club\'s address, as today, and no answer carries an officer\'s', async () => {
    const name = 'Heron Point Chess Club'
    const { clubId, rep, admin } = await seedClubWithAddress(name)
    for (const as of [undefined, rep, admin]) {
      for (const [route, text] of Object.entries(await publicAnswers(clubId, name, 'heron point', as))) {
        expect(text.includes(ADDRESS), `${route} as ${String(as)}`).toBe(route === 'GET /api/clubs/[id]')
        expect(text, `${route} as ${String(as)}`).not.toContain(OFFICER_EMAIL)
      }
    }
  })

  it('set: no public answer carries the club\'s address, its key or an officer\'s address, whoever asks, the club\'s own rep and an admin included', async () => {
    const name = 'Egret Point Chess Club'
    const { clubId, rep, admin } = await seedClubWithAddress(name)
    flags.clubEmailHidden = true
    for (const as of [undefined, await seedMember(), rep, admin]) {
      for (const [route, text] of Object.entries(await publicAnswers(clubId, name, 'egret point', as))) {
        expect(text, `${route} as ${String(as)}`).not.toContain(ADDRESS)
        expect(text, `${route} as ${String(as)}`).not.toContain('contact_email')
        expect(text, `${route} as ${String(as)}`).not.toContain(OFFICER_EMAIL)
      }
    }
  })

  it('set: the club\'s admin page still answers the address and the officers\' to the club\'s admins and its rep, and turns everyone else away without them', async () => {
    const { clubId, rep, admin } = await seedClubWithAddress('Ibis Point Chess Club')
    flags.clubEmailHidden = true
    for (const as of [admin, rep, await seedMember({ role: 'lca_observer' })]) {
      const result = await invoke(adminClubGet, { as, params: { id: clubId } })
      expect(result.status, as).toBe(200)
      const body = await result.json<{ club: { contact_email: string | null }; officers: Array<{ email: string }> }>()
      expect(body.club.contact_email, as).toBe(ADDRESS)
      expect(body.officers.map((o) => o.email), as).toEqual([OFFICER_EMAIL])
    }
    const turnedAway: Array<[string | undefined, number]> = [
      [undefined, 401],
      [await seedMember(), 403],
      [await seedMember({ role: 'club_rep', clubId: await seedClub() }), 403],
    ]
    for (const [as, status] of turnedAway) {
      const result = await invoke(adminClubGet, { as, params: { id: clubId } })
      expect(result.status, String(as)).toBe(status)
      const text = await result.response.text()
      expect(text, String(as)).not.toContain(ADDRESS)
      expect(text, String(as)).not.toContain(OFFICER_EMAIL)
    }
  })
})

// ── The roster before the event ──────────────────────────────────────

/** Each entrant's name as stored, in the roster's order, and as a visitor reads it with ROSTER_SHORT_NAMES set. */
const ENTRANTS: Array<[stored: string, short: string]> = [
  ['Gail Guidry', 'Gail Guidry'],
  ['Leo Robichaux V', 'Leo R.'],
  ['Maya Fontenot', 'Maya F.'],
  ['Pat Grownup', 'Pat Grownup'],
  ['Robichaux, Ana', 'Ana R.'],
  ['Rémi Thibodeaux', 'Rémi Thibodeaux'],
  ['Zed', 'Zed'],
]

/**
 * A club event that has not started, no game paired, with one section and
 * these entrants, each with a US Chess ID and a rating: Gail, a guardian,
 * and three children on her account, one written "Last, First" as US Chess
 * writes names and one with a single name; Maya, an adult account whose
 * entry confirmed a scholastic range; Rémi, whose guardian link has been
 * cleared; and Pat, an adult with neither, who has withdrawn. A fourth
 * child waits on the waitlist and is no entrant yet.
 */
async function seedUpcoming() {
  const clubId = await seedClub()
  const otherClub = await seedClub()
  const tournamentId = await seedTournament({ clubId, status: 'upcoming', sections: [{ name: 'Open', entryFee: 25 }] })
  let usChessId = 30417000
  const player = async (fullName: string, guardian: string | null = null) => {
    usChessId += 1
    const id = await seedMember({ fullName, uscfId: String(usChessId), uscfRating: 800 + (usChessId % 1000) })
    if (guardian) await env.DB.prepare('UPDATE members SET guardian_id = ? WHERE id = ?').bind(guardian, id).run()
    return id
  }
  const gail = await player('Gail Guidry')
  const children = [await player('Leo Robichaux V', gail), await player('Robichaux, Ana', gail), await player('Zed', gail)]
  const maya = await player('Maya Fontenot')
  const remi = await player('Rémi Thibodeaux', gail)
  await env.DB.prepare('UPDATE members SET guardian_id = NULL WHERE id = ?').bind(remi).run()
  const pat = await player('Pat Grownup')
  const wren = await player('Wren Waitlist', gail)
  for (const memberId of [gail, ...children, maya, remi, pat, wren]) await seedRegistration({ tournamentId, memberId })
  await env.DB.prepare(`UPDATE registrations SET grade = '0-8', rating_at_entry = 1105 WHERE tournament_id = ? AND member_id = ?`).bind(tournamentId, maya).run()
  await env.DB.prepare(`UPDATE registrations SET withdrawn_at = datetime('now') WHERE tournament_id = ? AND member_id = ?`).bind(tournamentId, pat).run()
  await env.DB.prepare(`UPDATE registrations SET waitlisted_at = datetime('now') WHERE tournament_id = ? AND member_id = ?`).bind(tournamentId, wren).run()
  const director = await seedMember()
  await seedTournamentDirector(tournamentId, director)
  const strangers: Viewer[] = [
    { label: 'signed out', manages: false },
    { label: 'a session that fails', headers: { Authorization: 'Bearer invalid-session' }, manages: false },
    { label: 'a plain member', as: await seedMember(), manages: false },
    { label: 'the children\'s guardian', as: gail, manages: false },
    { label: 'another club\'s rep', as: await seedMember({ role: 'club_rep', clubId: otherClub }), manages: false },
  ]
  const managers: Viewer[] = [
    { label: 'an LCA admin', as: await seedAdmin(), manages: true },
    { label: 'the organizing club\'s rep', as: await seedMember({ role: 'club_rep', clubId }), manages: true },
    { label: 'the event\'s director', as: director, manages: true },
    { label: 'an observer', as: await seedMember({ role: 'lca_observer' }), manages: true },
    { label: 'an officer', as: await seedMember({ role: 'lca_officer' }), manages: true },
  ]
  return { tournamentId, strangers, managers }
}

const answerFor = async (tournamentId: string, viewer?: Viewer) =>
  expectContract(await invoke(tournamentGet, { ...(viewer ? signIn(viewer) : {}), params: { id: tournamentId } }), detailContract.response)
const rosterFor = async (tournamentId: string, viewer?: Viewer) => (await answerFor(tournamentId, viewer)).roster

describe('the roster before the event, the entrants list D15 is about', () => {
  it('unset: everyone is answered every name as stored, in the roster\'s order, the waitlist left off', async () => {
    const { tournamentId, strangers, managers } = await seedUpcoming()
    for (const viewer of [...strangers, ...managers]) {
      expect((await rosterFor(tournamentId, viewer)).map((r) => r.full_name), viewer.label).toEqual(ENTRANTS.map(([stored]) => stored))
    }
  })

  it('set: anyone who does not run the event reads each child and the marked entry as first name and last initial, a single name whole, every other field and the order as before, and the standings in full', async () => {
    const { tournamentId, strangers } = await seedUpcoming()
    const before = await answerFor(tournamentId)
    flags.rosterShortNames = true
    for (const viewer of strangers) {
      const { roster, standings } = await answerFor(tournamentId, viewer)
      expect(roster.map((r) => r.full_name), viewer.label).toEqual(ENTRANTS.map(([, short]) => short))
      expect(roster.map((r) => ({ ...r, full_name: '' })), viewer.label).toEqual(before.roster.map((r) => ({ ...r, full_name: '' })))
      // No game is paired, so the standings are the same entrants at no score, each in full as before (D3).
      expect(standings.map((s) => s.score), viewer.label).toEqual(roster.map(() => 0))
      expect(standings, viewer.label).toEqual(before.standings)
      expect(standings.map((s) => s.full_name).sort(), viewer.label).toEqual(ENTRANTS.map(([stored]) => stored).sort())
    }
  })

  it('set: the event\'s managers read the roster and the standings exactly as they were', async () => {
    const { tournamentId, managers } = await seedUpcoming()
    const before = await answerFor(tournamentId)
    flags.rosterShortNames = true
    for (const viewer of managers) {
      const { roster, standings } = await answerFor(tournamentId, viewer)
      expect(roster, viewer.label).toEqual(before.roster)
      expect(standings, viewer.label).toEqual(before.standings)
    }
  })

  it('set: the rule is read entry by entry, so the same adult account is shortened where its entry confirmed a range and not where it did not', async () => {
    const scholastic = await seedTournament({ sections: [{ name: 'K-8', entryFee: 10 }] })
    const open = await seedTournament({ sections: [{ name: 'Open', entryFee: 25 }] })
    const jules = await seedMember({ fullName: 'Jules Broussard' })
    await seedRegistration({ tournamentId: scholastic, memberId: jules, section: 'K-8' })
    await seedRegistration({ tournamentId: open, memberId: jules })
    await env.DB.prepare(`UPDATE registrations SET grade = '6-8' WHERE tournament_id = ? AND member_id = ?`).bind(scholastic, jules).run()
    flags.rosterShortNames = true
    expect((await rosterFor(scholastic)).map((r) => r.full_name)).toEqual(['Jules B.'])
    expect((await rosterFor(open)).map((r) => r.full_name)).toEqual(['Jules Broussard'])
  })

  it('set: a hidden draft\'s managers read every full name, and everyone else is answered 404 with no entrant\'s name in it', async () => {
    const clubId = await seedClub()
    const draft = await seedTournament({ clubId, isVisible: false })
    const parent = await seedMember({ fullName: 'Nell Arceneaux' })
    const child = await seedMember({ fullName: 'Owen Arceneaux' })
    await env.DB.prepare('UPDATE members SET guardian_id = ? WHERE id = ?').bind(parent, child).run()
    await seedRegistration({ tournamentId: draft, memberId: child })
    flags.rosterShortNames = true
    for (const as of [await seedAdmin(), await seedMember({ role: 'club_rep', clubId })]) {
      expect((await rosterFor(draft, { label: as, as, manages: true })).map((r) => r.full_name), as).toEqual(['Owen Arceneaux'])
    }
    for (const as of [undefined, parent, await seedMember()]) {
      const result = await invoke(tournamentGet, { as, params: { id: draft } })
      expect(result.status, String(as)).toBe(404)
      expect(await result.response.text(), String(as)).not.toContain('Owen')
    }
  })

  it('an event nobody has entered: an empty roster and no standings, with the constant unset or set', async () => {
    const tournamentId = await seedTournament()
    for (const set of [false, true]) {
      flags.rosterShortNames = set
      const body = await expectContract(await invoke(tournamentGet, { params: { id: tournamentId } }), detailContract.response)
      expect(body.roster, String(set)).toEqual([])
      expect(body.standings, String(set)).toEqual([])
    }
  })
})

// ── The standings and the prizes ─────────────────────────────────────

describe('the standings and the prizes keep full names (D3)', () => {
  it('set: a finished event whose two children drew for first: the standings and the shared prize name and pay them as before, for everyone, and the roster alone is shortened', async () => {
    const tournamentId = await seedTournament({
      rounds: 1,
      status: 'completed',
      sections: [{ name: 'K-5', entryFee: 10, prizes: { place: [{ amount: 100 }, { amount: 50 }] } }],
    })
    const parent = await seedMember({ fullName: 'Dana Hebert' })
    const child = async (fullName: string) => {
      const id = await seedMember({ fullName })
      await env.DB.prepare('UPDATE members SET guardian_id = ? WHERE id = ?').bind(parent, id).run()
      await seedRegistration({ tournamentId, memberId: id, section: 'K-5' })
      return id
    }
    const lily = await child('Lily Hebert')
    const noah = await child('Noah Hebert')
    await env.DB.prepare(
      `INSERT INTO tournament_games (id, tournament_id, round, board, section, white_member_id, black_member_id, result)
       VALUES (?, ?, 1, 1, 'K-5', ?, ?, '1/2-1/2')`,
    ).bind(`g-${tournamentId}`, tournamentId, lily, noah).run()
    const before = await expectContract(await invoke(tournamentGet, { params: { id: tournamentId } }), detailContract.response)
    const byName = (rows: Array<{ full_name: string }>) => [...rows].sort((a, b) => a.full_name.localeCompare(b.full_name))
    // Tied on score: the tiebreaks order the two, and the cash for first and second is shared.
    expect(byName(before.standings).map((s) => [s.full_name, s.score])).toEqual([['Lily Hebert', 0.5], ['Noah Hebert', 0.5]])
    expect(before.prizes.map((p) => [p.member_id, p.cash]).sort()).toEqual([[lily, 75], [noah, 75]].sort())

    flags.rosterShortNames = true
    for (const as of [undefined, parent, await seedMember(), await seedAdmin()]) {
      const body = await expectContract(await invoke(tournamentGet, { as, params: { id: tournamentId } }), detailContract.response)
      expect(body.standings, String(as)).toEqual(before.standings)
      expect(body.prizes, String(as)).toEqual(before.prizes)
      expect(body.pairings, String(as)).toEqual(before.pairings)
    }
    expect((await rosterFor(tournamentId)).map((r) => r.full_name)).toEqual(['Lily H.', 'Noah H.'])
  })
})
