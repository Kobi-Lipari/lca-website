// test/integration/creation-pages-replay.test.ts
//
// The requests the two creation pages of WS08 step 8 make, replayed through
// the real handlers in the order the pages make them and with the headers
// the site's client sends (D20, D21, Q11; criterion 12 of brief 1.4's WS08
// section). With standingDirectors on, /workspace's Events list asks a
// standing director's grant, reads the tournament list signed in and keeps
// the events they direct and the ones whose created_by is theirs; Admin ›
// Tournaments asks an observer's or an officer's grant first and reads the
// list signed in only for the president, drawing New tournament, whose
// wizard sends no club, and a Directors button on the rows whose created_by
// is the president's and which have no club. Held here, with
// CREATION_ROLES_ON set:
// - the standing director's draft, made with the body the wizard sends, is
//   LCA-run, in the signed-in list with created_by theirs and among the
//   events GET /api/me says they direct, and in no signed-out list; no row
//   they do not manage carries created_by, so the page's rule picks none;
// - the president's list carries created_by on every row, other people's
//   drafts among them, and the naming endpoint accepts exactly the rows the
//   Directors button is drawn on, an event of theirs given to a club since
//   among the ones it refuses; the window that button opens loads;
// - role safety: an officer and an observer who hold no seat, a plain member
//   and a signed-out visitor are refused the create with nothing written,
//   and the observer's grant answer gives the page nothing to draw;
// - the three bodies requestPayoutAccount sends are each the handler's.
// With the constant unset, each page's requests get today's answers: no
// grant, the create refused and the naming refused, nothing written.
// CREATION_ROLES_ON is false in the tree; it is read here through a getter.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { onRequestPost as createTournament } from '../../functions/api/admin/tournaments'
import { onRequestPatch as patchTournament } from '../../functions/api/admin/tournaments/[id]'
import { onRequestGet as listDirectors, onRequestPost as nameDirector } from '../../functions/api/admin/tournaments/[id]/directors'
import { onRequestGet as adminMembers } from '../../functions/api/admin/members'
import { onRequestGet as getMe } from '../../functions/api/me'
import { onRequestPost as payoutPost } from '../../functions/api/me/payout-request'
import { onRequestGet as creationGet } from '../../functions/api/me/tournament-creation'
import { onRequestGet as listTournaments } from '../../functions/api/tournaments'
import { seedAdmin, seedClub, seedMember, seedPresident, seedTournament, seedTournamentDirector } from './factories'
import { invoke, resetHarness } from './harness'

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

beforeEach(() => {
  resetHarness()
  flags.rolesOn = true
})
afterEach(() => {
  flags.rolesOn = true
  vi.restoreAllMocks()
})

let seq = 0
/**
 * What the wizard sends when a draft is saved from its Basics step with no
 * club picker, as TournamentWizard's create builds it from its first state:
 * no clubId key at all, and customDetails left out as undefined.
 */
const wizardDraft = (name: string) => ({
  name, location: 'Lafayette, LA', date: '2027-03-06', endDate: null, venue: null, entryFee: 0, sections: [], rounds: 5,
  maxPlayers: null, description: null, isRated: true, status: 'upcoming', timeControl: 'G/90+30', registrationClosesAt: null,
})

/** The headers getTournaments({ signedIn: true }) and the other signed-in calls send beside the sign-in. */
const CLIENT_HEADERS = { 'Content-Type': 'application/json' }

type Row = Record<string, unknown> & { id: string }
/** GET /api/tournaments as the page asks it: signed in, or signed out as today. */
async function list(as?: string): Promise<Row[]> {
  const res = await invoke(listTournaments, as ? { as, path: '/api/tournaments', headers: CLIENT_HEADERS } : { path: '/api/tournaments' })
  expect(res.status).toBe(200)
  return (await res.json<{ tournaments: Row[] }>()).tournaments
}
const grantOf = async (as?: string) => {
  const res = await invoke(creationGet, { as, path: '/api/me/tournament-creation', headers: CLIENT_HEADERS })
  return { status: res.status, body: await res.json() }
}
async function create(as: string | undefined, name: string) {
  const res = await invoke(createTournament, { method: 'POST', as, body: wizardDraft(name), path: '/api/admin/tournaments' })
  return { status: res.status, body: await res.json<{ tournament?: { id: string; club_id: string | null }; error?: string }>() }
}
const tournamentCount = async () => (await env.DB.prepare('SELECT COUNT(*) AS n FROM tournaments').first<{ n: number }>())!.n
const directorRows = async (tournamentId: string) =>
  (await env.DB.prepare('SELECT member_id FROM tournament_directors WHERE tournament_id = ? ORDER BY member_id').bind(tournamentId).all<{ member_id: string }>()).results.map((r) => r.member_id)

describe('a standing director\'s Events list on /workspace, replayed', () => {
  it('asks the grant, makes an LCA-run draft with the wizard\'s body, and finds it signed in, with created_by theirs, among the events they direct, and in no signed-out list', async () => {
    const director = await seedMember({ role: 'tournament_director' })
    const admin = await seedAdmin()
    const directed = await seedTournament({ name: `Acadiana Open ${++seq}`, createdBy: admin })
    await seedTournamentDirector(directed, director)
    const notTheirs = await seedTournament({ name: `Shreveport Swiss ${++seq}`, createdBy: admin })

    expect(await grantOf(director)).toEqual({ status: 200, body: { grant: 'standing_director', canCreate: true, canChargeFees: true, clubId: null } })

    const made = await create(director, `Lafayette Spring Quads ${++seq}`)
    expect(made.status).toBe(201)
    const draft = made.body.tournament!.id
    expect(made.body.tournament!.club_id).toBeNull()

    const signedIn = await list(director)
    const row = signedIn.find((t) => t.id === draft)
    expect(row).toMatchObject({ id: draft, is_visible: 0, club_id: null, created_by: director })
    expect(signedIn.find((t) => t.id === directed)).toMatchObject({ created_by: admin })
    // A listed event the director does not manage carries no creator, so the page's created_by rule never picks it.
    expect(Object.hasOwn(signedIn.find((t) => t.id === notTheirs)!, 'created_by')).toBe(false)

    // Every row the page's created_by rule picks is one GET /api/me names among the events they direct, after a reload.
    const me = await invoke(getMe, { as: director, path: '/api/me', headers: CLIENT_HEADERS })
    expect(me.status).toBe(200)
    const directedIds = (await me.json<{ directedTournaments: Array<{ id: string }> }>()).directedTournaments.map((t) => t.id)
    const picked = signedIn.filter((t) => t.created_by === director).map((t) => t.id)
    expect(picked).toEqual([draft])
    for (const id of [...picked, directed]) expect(directedIds, id).toContain(id)
    expect(directedIds).not.toContain(notTheirs)

    // Signed out, as the list was read before this step: no draft, and no creator on any row.
    const signedOut = await list()
    expect(signedOut.find((t) => t.id === draft)).toBeUndefined()
    expect(signedOut.filter((t) => Object.hasOwn(t, 'created_by'))).toEqual([])
  })

  it('gives another standing director, a plain member and a club rep neither the draft nor its creator', async () => {
    const director = await seedMember({ role: 'tournament_director' })
    const made = await create(director, `Bayou Rapid ${++seq}`)
    expect(made.status).toBe(201)
    const draft = made.body.tournament!.id
    const club = await seedClub()
    for (const [who, as] of [
      ['another standing director', await seedMember({ role: 'tournament_director' })],
      ['a plain member', await seedMember()],
      ['a club rep', await seedMember({ role: 'club_rep', clubId: club })],
    ] as const) {
      const rows = await list(as)
      expect(rows.find((t) => t.id === draft), who).toBeUndefined()
      expect(rows.filter((t) => t.created_by === director), who).toEqual([])
    }
  })
})

describe('the president\'s Admin › Tournaments, replayed', () => {
  it.each(['lca_observer', 'lca_officer'])('for a %s who holds the seat: the naming endpoint accepts exactly the rows the Directors button is drawn on', async (role) => {
    const president = await seedMember({ role })
    await seedPresident(president)
    const admin = await seedAdmin()
    const club = await seedClub()
    const rep = await seedMember({ role: 'club_rep', clubId: club })
    const plain = await seedMember()

    expect(await grantOf(president)).toEqual({ status: 200, body: { grant: 'president', canCreate: true, canChargeFees: true, clubId: null } })

    const own = await create(president, `Presidents Cup ${++seq}`)
    expect(own.status).toBe(201)
    expect(own.body.tournament!.club_id).toBeNull()
    const ownDraft = own.body.tournament!.id
    // An event of the president's that an LCA admin has since given to a club, as Admin's club picker does.
    const moved = (await create(president, `Kenner Winter Swiss ${++seq}`)).body.tournament!.id
    const patched = await invoke(patchTournament, { method: 'PATCH', as: admin, params: { id: moved }, body: { clubId: club } })
    expect(patched.status).toBe(200)
    const adminEvent = await seedTournament({ name: `Louisiana Open ${++seq}`, createdBy: admin })
    const adminDraft = await seedTournament({ name: `Bayou Scholastic ${++seq}`, createdBy: admin, isVisible: false })
    const repEvent = await seedTournament({ name: `Kenner Club Quads ${++seq}`, clubId: club, createdBy: rep })
    const noCreator = await seedTournament({ name: `Crescent City Classic ${++seq}` })
    const ours = [ownDraft, moved, adminEvent, adminDraft, repEvent, noCreator]

    const rows = (await list(president)).filter((t) => ours.includes(t.id))
    expect(rows.map((t) => t.id).sort()).toEqual([...ours].sort())
    // The observer manages every event, so every row carries its creator, another person's draft among them.
    for (const row of rows) expect(Object.hasOwn(row, 'created_by'), row.id).toBe(true)

    const drawn = (t: Row) => t.created_by === president && !t.club_id
    expect(rows.filter(drawn).map((t) => t.id)).toEqual([ownDraft])
    for (const row of rows) {
      const before = await directorRows(row.id)
      const res = await invoke(nameDirector, { method: 'POST', as: president, params: { id: row.id }, body: { memberId: plain } })
      if (drawn(row)) {
        expect(res.status, row.id).toBe(201)
        expect(await directorRows(row.id), row.id).toEqual([...before, plain].sort())
      } else {
        expect(res.status, row.id).toBe(403)
        expect(await res.json(), row.id).toEqual({ error: 'Only admins and the organizing club\'s rep can assign directors' })
        expect(await directorRows(row.id), row.id).toEqual(before)
      }
    }

    // What the Directors window loads, with the president's sign-in.
    const window = await invoke(listDirectors, { as: president, params: { id: ownDraft }, headers: CLIENT_HEADERS })
    expect(window.status).toBe(200)
    expect((await window.json<{ directors: Array<{ member_id: string }> }>()).directors.map((d) => d.member_id).sort()).toEqual([president, plain].sort())
    const pool = await invoke(adminMembers, { as: president, path: '/api/admin/members', headers: CLIENT_HEADERS })
    expect(pool.status).toBe(200)
  })

  it('role safety: an officer and an observer with no seat, a plain member and a signed-out visitor are refused the wizard\'s create, and nothing is written', async () => {
    const officer = await seedMember({ role: 'lca_officer' })
    const observer = await seedMember({ role: 'lca_observer' })
    const plain = await seedMember()
    for (const as of [officer, observer]) {
      expect(await grantOf(as)).toEqual({ status: 200, body: { grant: 'none', canCreate: false, canChargeFees: false, clubId: null } })
    }
    const before = await tournamentCount()
    for (const [who, as, status] of [['an officer', officer, 403], ['an observer', observer, 403], ['a plain member', plain, 403], ['a signed-out visitor', undefined, 401]] as const) {
      const res = await create(as, `Refused Open ${++seq}`)
      expect(res.status, who).toBe(status)
      expect(Object.keys(res.body), who).toEqual(['error'])
    }
    expect(await tournamentCount()).toBe(before)
    expect((await grantOf(undefined)).status).toBe(401)
  })
})

describe('the bodies requestPayoutAccount sends', () => {
  it.each([
    ['no event named', undefined],
    ['an event named as null', null],
    ['an event the member directs', 'directed'],
  ] as const)('are each the handler\'s, with %s: 201 with constant set, 403 with it unset and nothing stored', async (_label, named) => {
    const member = await seedMember({ role: 'tournament_director' })
    const event = await seedTournament({ name: `Payout Probe ${++seq}` })
    await seedTournamentDirector(event, member)
    const tournamentId = named === 'directed' ? event : named
    // The wrapper's body, JSON.stringify({ tournamentId }): no key at all when no event is named.
    const rawBody = JSON.stringify({ tournamentId })
    if (named === undefined) expect(rawBody).toBe('{}')
    const ask = () => invoke(payoutPost, { method: 'POST', as: member, rawBody, headers: CLIENT_HEADERS, path: '/api/me/payout-request' })
    const stored = async () => (await env.DB.prepare(`SELECT about_id FROM support_tickets WHERE member_id = ? AND kind = 'payout_request'`).bind(member).all<{ about_id: string | null }>()).results

    flags.rolesOn = false
    const refused = await ask()
    expect(refused.status).toBe(403)
    expect(await refused.json()).toEqual({ error: 'Not available yet.' })
    expect(await stored()).toEqual([])

    flags.rolesOn = true
    const opened = await ask()
    expect(opened.status).toBe(201)
    expect(await opened.json()).toMatchObject({ ticket: { kind: 'payout_request', status: 'open' }, created: true })
    expect(await stored()).toEqual([{ about_id: named === 'directed' ? event : null }])
  })
})

describe('with CREATION_ROLES_ON unset, each page\'s requests get today\'s answers', () => {
  it('no grant for the standing director or the president, the wizard\'s create refused and the naming refused, nothing written', async () => {
    flags.rolesOn = false
    const director = await seedMember({ role: 'tournament_director' })
    const president = await seedMember({ role: 'lca_observer' })
    await seedPresident(president)
    const plain = await seedMember()
    const theirs = await seedTournament({ name: `Presidents Cup ${++seq}`, createdBy: president })

    expect(await grantOf(director)).toEqual({ status: 200, body: { grant: 'none', canCreate: false, canChargeFees: true, clubId: null } })
    expect(await grantOf(president)).toEqual({ status: 200, body: { grant: 'none', canCreate: false, canChargeFees: true, clubId: null } })

    const before = await tournamentCount()
    for (const as of [director, president]) {
      const res = await create(as, `Today Open ${++seq}`)
      expect(res.status).toBe(403)
      expect(Object.keys(res.body)).toEqual(['error'])
    }
    expect(await tournamentCount()).toBe(before)

    const naming = await invoke(nameDirector, { method: 'POST', as: president, params: { id: theirs }, body: { memberId: plain } })
    expect(naming.status).toBe(403)
    expect(await directorRows(theirs)).toEqual([])
  })
})
