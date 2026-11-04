// test/integration/public-answer-trim.test.ts
//
// The Phase 0 trim of the public answers through the real handlers, with
// each of its two server constants unset and set, as a manager and as anyone
// else (brief section 4; D15, D29; assumed, Q14 and Q38):
// - GET /api/clubs/[id] answers the club's contact_email as stored while
//   CLUB_EMAIL_HIDDEN is unset and no contact_email key once it is set,
//   whoever asks, and never an officer's email either way;
// - GET /api/tournaments/[id] answers the roster's names as stored while
//   ROSTER_SHORT_NAMES is unset, and once it is set writes each entrant under
//   18 (a guardian link, or an entry that confirmed a scholastic range) as
//   first name and last initial for anyone who does not manage the event, in
//   the roster alone; the event's managers get full names there, and the
//   standings, the pairings and the prizes keep them for everyone (D3),
//   before the event's first result as after it;
// - the list and the detail agree on who manages an event, and the list
//   reads the viewer's assignments once, however many events it lists.
// The constants are false in the tree. Here each is read through a getter
// on the mocked module, so one file turns them on and off; the handlers read
// the constant at each request, through the module.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { contracts } from '../../domain/contracts'
import { onRequestGet as clubGet } from '../../functions/api/clubs/[id]'
import { onRequestGet as tournamentsGet } from '../../functions/api/tournaments'
import { onRequestGet as tournamentGet } from '../../functions/api/tournaments/[id]'
import { canManageTournament } from '../../functions/utils/admin/permissions'
import { isObserver } from '../../functions/utils/auth'
import type { MemberRow } from '../../functions/types'
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

const clubContract = contracts['clubs/[id]'].GET
const detailContract = contracts['tournaments/[id]'].GET
const listContract = contracts['tournaments'].GET
// The trim's three keys, and review_notified_at, which WS08 step 2 added.
const MANAGERS_ONLY = ['created_by', 'keep_apart', 'report_settings', 'review_notified_at']
const label = (as: string | undefined) => as ?? 'signed out'

// ── The club page's answer ───────────────────────────────────────────

describe('GET /api/clubs/[id] with CLUB_EMAIL_HIDDEN unset and set', () => {
  async function seedClubPage() {
    const clubId = await seedClub({ name: 'Kenner Chess Club' })
    await env.DB.prepare(`UPDATE clubs SET contact_email = 'kenner.club@example.org' WHERE id = ?`).bind(clubId).run()
    const officer = await seedMember({ fullName: 'Avery Officer', email: 'avery.officer@example.org' })
    await env.DB.prepare(`INSERT INTO club_officers (id, club_id, member_id, role) VALUES (?, ?, ?, 'President')`).bind(`off-${clubId}`, clubId, officer).run()
    const askers = [undefined, await seedMember(), officer, await seedMember({ role: 'club_rep', clubId }), await seedAdmin(), await seedMember({ role: 'lca_observer' })]
    return { clubId, askers }
  }

  it('unset: everyone is answered the club\'s contact_email as stored, as today, and no officer\'s email', async () => {
    const { clubId, askers } = await seedClubPage()
    for (const as of askers) {
      const result = await invoke(clubGet, { as, params: { id: clubId } })
      const body = await expectContract(result, clubContract.response)
      expect(body.club.contact_email, label(as)).toBe('kenner.club@example.org')
      expect(await result.response.text(), label(as)).not.toContain('avery.officer@example.org')
    }
  })

  it('set: no one is answered a contact_email key, the club\'s own rep and an admin included, and the rest of the row is unchanged', async () => {
    const { clubId, askers } = await seedClubPage()
    const before = (await expectContract(await invoke(clubGet, { params: { id: clubId } }), clubContract.response)).club
    const rest: Record<string, unknown> = { ...before }
    delete rest.contact_email
    flags.clubEmailHidden = true
    for (const as of askers) {
      const result = await invoke(clubGet, { as, params: { id: clubId } })
      const body = await expectContract(result, clubContract.response)
      expect(Object.hasOwn(body.club, 'contact_email'), label(as)).toBe(false)
      expect(body.club, label(as)).toEqual(rest)
      const text = await result.response.text()
      expect(text, label(as)).not.toContain('kenner.club@example.org')
      expect(text, label(as)).not.toContain('avery.officer@example.org')
    }
  })

  it('set: a club with no address is answered without the key too, never as null', async () => {
    const clubId = await seedClub()
    flags.clubEmailHidden = true
    const body = await expectContract(await invoke(clubGet, { params: { id: clubId } }), clubContract.response)
    expect(Object.hasOwn(body.club, 'contact_email')).toBe(false)
  })
})

// ── The event page's roster ──────────────────────────────────────────

/**
 * A finished club event with four entrants: Leo, a child profile (a guardian
 * link) who won the one game; Maya, an adult account whose entry confirmed a
 * scholastic range; Pat, an adult with neither; and Sam, a child profile who
 * withdrew. Wendy, a child on the waitlist, is not on the roster at all.
 */
async function seedEntrants() {
  const clubId = await seedClub()
  const otherClub = await seedClub()
  const tournamentId = await seedTournament({
    clubId,
    rounds: 1,
    status: 'completed',
    sections: [{ name: 'Open', entryFee: 20, prizes: { place: [{ amount: 50, label: '1st' }] } }],
  })
  const parent = await seedMember({ fullName: 'Pat Parent' })
  const child = async (fullName: string) => {
    const id = await seedMember({ fullName })
    await env.DB.prepare('UPDATE members SET guardian_id = ? WHERE id = ?').bind(parent, id).run()
    return id
  }
  const leo = await child('Leo Robichaux V')
  const maya = await seedMember({ fullName: 'Maya Fontenot' })
  const pat = await seedMember({ fullName: 'Pat Grownup' })
  const sam = await child('Sam Robichaux 3rd')
  const wendy = await child('Wendy Waitlist')
  await seedRegistration({ tournamentId, memberId: leo })
  const mayaEntry = await seedRegistration({ tournamentId, memberId: maya })
  await env.DB.prepare(`UPDATE registrations SET grade = '0-8' WHERE id = ?`).bind(mayaEntry).run()
  await seedRegistration({ tournamentId, memberId: pat })
  const samEntry = await seedRegistration({ tournamentId, memberId: sam })
  await env.DB.prepare(`UPDATE registrations SET withdrawn_at = datetime('now') WHERE id = ?`).bind(samEntry).run()
  const wendyEntry = await seedRegistration({ tournamentId, memberId: wendy })
  await env.DB.prepare(`UPDATE registrations SET waitlisted_at = datetime('now') WHERE id = ?`).bind(wendyEntry).run()
  await env.DB.prepare(
    `INSERT INTO tournament_games (id, tournament_id, round, board, section, white_member_id, black_member_id, result)
     VALUES (?, ?, 1, 1, 'Open', ?, ?, '1-0')`,
  ).bind(`g-${tournamentId}`, tournamentId, leo, pat).run()
  const director = await seedDirector()
  await seedTournamentDirector(tournamentId, director)
  const strangers = [undefined, await seedMember(), parent, await seedMember({ role: 'club_rep', clubId: otherClub })]
  const managers = [await seedAdmin(), await seedMember({ role: 'club_rep', clubId }), director, await seedMember({ role: 'lca_observer' }), await seedMember({ role: 'lca_officer' })]
  return { tournamentId, leo, strangers, managers }
}

const FULL = ['Leo Robichaux V', 'Maya Fontenot', 'Pat Grownup', 'Sam Robichaux 3rd']
const SHORT = ['Leo R.', 'Maya F.', 'Pat Grownup', 'Sam R.']

describe('GET /api/tournaments/[id]\'s roster with ROSTER_SHORT_NAMES unset and set', () => {
  const read = async (tournamentId: string, as?: string) =>
    expectContract(await invoke(tournamentGet, { as, params: { id: tournamentId } }), detailContract.response)

  it('unset: everyone is answered every name as stored, as today', async () => {
    const { tournamentId, strangers, managers } = await seedEntrants()
    for (const as of [...strangers, ...managers]) {
      expect((await read(tournamentId, as)).roster.map((r) => r.full_name), label(as)).toEqual(FULL)
    }
  })

  it('set: a visitor, a signed-in stranger, a parent and another club\'s rep get the under-18 entrants as first name and last initial', async () => {
    const { tournamentId, strangers } = await seedEntrants()
    flags.rosterShortNames = true
    for (const as of strangers) {
      const result = await invoke(tournamentGet, { as, params: { id: tournamentId } })
      const body = await expectContract(result, detailContract.response)
      expect(body.roster.map((r) => r.full_name), label(as)).toEqual(SHORT)
      // The withdrawn entrant keeps the flag, and the waitlisted child is not listed.
      expect(body.roster.map((r) => r.withdrawn_at === null), label(as)).toEqual([true, true, true, false])
    }
  })

  it('set: the event\'s managers get every full name', async () => {
    const { tournamentId, managers } = await seedEntrants()
    flags.rosterShortNames = true
    for (const as of managers) {
      expect((await read(tournamentId, as)).roster.map((r) => r.full_name), as).toEqual(FULL)
    }
  })

  it('set: the standings, the pairings and the prizes keep full names and are the same for everyone', async () => {
    const { tournamentId, leo, strangers, managers } = await seedEntrants()
    const before = await read(tournamentId)
    flags.rosterShortNames = true
    for (const as of [...strangers, ...managers]) {
      const body = await read(tournamentId, as)
      expect(body.standings, label(as)).toEqual(before.standings)
      expect(body.pairings, label(as)).toEqual(before.pairings)
      expect(body.prizes, label(as)).toEqual(before.prizes)
    }
    expect(before.standings.find((s) => s.member_id === leo)).toMatchObject({ full_name: 'Leo Robichaux V', place: 1 })
    expect(before.pairings[0]).toMatchObject({ white_name: 'Leo Robichaux V', black_name: 'Pat Grownup' })
    expect(before.prizes).toEqual([expect.objectContaining({ member_id: leo, cash: 50 })])
  })

  it('set: before the event\'s first result the standings, every entrant at no score, keep full names for everyone, as they do from it, while the roster alone is shortened', async () => {
    const clubId = await seedClub()
    const tournamentId = await seedTournament({ clubId, status: 'upcoming', rounds: 3, sections: [{ name: 'Open', entryFee: 20 }] })
    const parent = await seedMember({ fullName: 'Pat Parent' })
    const leo = await seedMember({ fullName: 'Leo Robichaux V' })
    await env.DB.prepare('UPDATE members SET guardian_id = ? WHERE id = ?').bind(parent, leo).run()
    const pat = await seedMember({ fullName: 'Pat Grownup' })
    for (const memberId of [leo, pat]) await seedRegistration({ tournamentId, memberId })
    const director = await seedDirector()
    await seedTournamentDirector(tournamentId, director)
    const strangers = [undefined, await seedMember(), parent, await seedMember({ role: 'club_rep', clubId: await seedClub() })]
    const managers = [await seedAdmin(), await seedMember({ role: 'club_rep', clubId }), director, await seedMember({ role: 'lca_observer' })]
    const names = async (as?: string) => Object.fromEntries((await read(tournamentId, as)).standings.map((s) => [s.member_id, s.full_name]))
    const full = { [leo]: 'Leo Robichaux V', [pat]: 'Pat Grownup' }

    // Unset: every entrant in full for everyone, as today.
    const before = await read(tournamentId)
    expect(before.standings.map((s) => s.score)).toEqual([0, 0])
    for (const as of [...strangers, ...managers]) expect(await names(as), label(as)).toEqual(full)

    // Set, no game paired: the roster shortens the child for anyone who does
    // not manage the event, and the standings are as they were for everyone.
    flags.rosterShortNames = true
    for (const as of strangers) {
      const body = await read(tournamentId, as)
      expect(body.roster.map((r) => r.full_name), label(as)).toEqual(['Leo R.', 'Pat Grownup'])
      expect(body.standings, label(as)).toEqual(before.standings)
    }
    for (const as of managers) {
      const body = await read(tournamentId, as)
      expect(body.roster.map((r) => r.full_name), as).toEqual(['Leo Robichaux V', 'Pat Grownup'])
      expect(body.standings, as).toEqual(before.standings)
    }

    // Round 1 paired, its one game still pending: still no result, still full names.
    await env.DB.prepare(
      `INSERT INTO tournament_games (id, tournament_id, round, board, section, white_member_id, black_member_id, result)
       VALUES (?, ?, 1, 1, 'Open', ?, ?, 'pending')`,
    ).bind(`g-${tournamentId}`, tournamentId, leo, pat).run()
    for (const as of [...strangers, ...managers]) expect(await names(as), label(as)).toEqual(full)

    // The first result: full names for everyone (D3), while the roster stays shortened.
    await env.DB.prepare(`UPDATE tournament_games SET result = '1-0' WHERE id = ?`).bind(`g-${tournamentId}`).run()
    for (const as of [...strangers, ...managers]) expect(await names(as), label(as)).toEqual(full)
    expect((await read(tournamentId)).roster.map((r) => r.full_name)).toEqual(['Leo R.', 'Pat Grownup'])
  })

  it('set: an entrant is shortened by a guardian link alone or by a confirmed range alone, and not by being someone\'s parent', async () => {
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 0 }] })
    const guardian = await seedMember({ fullName: 'Gail Guardian' })
    const kid = await seedMember({ fullName: 'Kit Kidd' })
    await env.DB.prepare('UPDATE members SET guardian_id = ? WHERE id = ?').bind(guardian, kid).run()
    const marked = await seedMember({ fullName: 'Mo Marked' })
    for (const memberId of [guardian, kid, marked]) await seedRegistration({ tournamentId, memberId })
    await env.DB.prepare(`UPDATE registrations SET grade = '9-12' WHERE tournament_id = ? AND member_id = ?`).bind(tournamentId, marked).run()
    flags.rosterShortNames = true
    expect((await read(tournamentId)).roster.map((r) => r.full_name)).toEqual(['Gail Guardian', 'Kit K.', 'Mo M.'])
  })
})

// ── Who manages an event, in the list and in the detail ──────────────

describe('the list and the detail answer the four keys to the same people', () => {
  it('for every kind of viewer and both kinds of event, as the detail\'s own rule names them', async () => {
    const clubId = await seedClub()
    const clubEvent = await seedTournament({ clubId })
    const looseEvent = await seedTournament()
    const director = await seedDirector()
    await seedTournamentDirector(looseEvent, director)
    const guest = await seedMember({ role: 'guest' })
    await seedTournamentDirector(clubEvent, guest)
    const viewers = [
      undefined,
      await seedMember(),
      await seedMember({ clubId }),
      await seedMember({ role: 'club_rep', clubId }),
      await seedMember({ role: 'club_rep', clubId: await seedClub() }),
      director,
      guest,
      await seedAdmin(),
      await seedMember({ role: 'lca_observer' }),
      await seedMember({ role: 'lca_officer' }),
    ]
    for (const as of viewers) {
      const member = as ? await env.DB.prepare('SELECT * FROM members WHERE id = ?').bind(as).first<MemberRow>() : null
      const list = await expectContract(await invoke(tournamentsGet, { as, path: '/api/tournaments' }), listContract.response)
      for (const id of [clubEvent, looseEvent]) {
        const expected = member !== null && (isObserver(member) || await canManageTournament(env.DB, member, id))
        const row = list.tournaments.find((t) => t.id === id)!
        const detail = await expectContract(await invoke(tournamentGet, { as, params: { id } }), detailContract.response)
        for (const key of MANAGERS_ONLY) {
          expect(Object.hasOwn(row, key), `list ${label(as)} ${id} ${key}`).toBe(expected)
          expect(Object.hasOwn(detail.tournament, key), `detail ${label(as)} ${id} ${key}`).toBe(expected)
        }
      }
    }
  })

  it('the list reads the viewer\'s assignments once however many events it lists, and not at all for a visitor or an admin', async () => {
    const clubId = await seedClub()
    const ids = Array.from({ length: 120 }, (_, i) => `trim-many-${String(i).padStart(3, '0')}`)
    await env.DB.batch(ids.map((id, i) => env.DB.prepare(
      `INSERT INTO tournaments (id, name, location, date, entry_fee, sections, rounds, club_id) VALUES (?, ?, 'Kenner, LA', '2026-10-24', 20, '["Open"]', 4, ?)`,
    ).bind(id, `Event ${i}`, clubId)))
    const assignmentReads = async (as?: string) => {
      const spy = vi.spyOn(env.DB, 'prepare')
      try {
        const body = await expectContract(await invoke(tournamentsGet, { as, path: '/api/tournaments' }), listContract.response)
        expect(body.tournaments.length).toBeGreaterThanOrEqual(120)
        return spy.mock.calls.map((call) => String(call[0])).filter((sql) => /\btournament_directors\b/.test(sql)).length
      } finally {
        spy.mockRestore()
      }
    }
    // The rep's list query names tournament_directors in its WHERE clause; the manager rule reads it once more.
    expect(await assignmentReads(await seedMember({ role: 'club_rep', clubId }))).toBe(2)
    expect(await assignmentReads()).toBe(0)
    expect(await assignmentReads(await seedAdmin())).toBe(0)
  })
})
