// test/integration/directors.test.ts
// Covers the directors endpoint: who may assign, listing, and removal.
// Assigning or removing a director never changes anyone's role: the
// assignment is access to that one event.
//
// Who may name or remove an event's directors is D21, the row "Name or
// remove directors" of brief 1.4's table "Who may do what on an event", which
// criterion 14 of its WS08 section holds cell by cell (WS08 step 5). With
// CREATION_ROLES_ON set, the president names a one-event director on an event
// the president created and on no other, and removes them again; that
// director saves every setup step today's manage page has and publishes the
// event, and is refused the membership switch, naming, removing and the
// delete; the president publishes their own draft and is refused its
// membership switch; no other officer names, nor a standing director, while a
// club rep names on its own club's events whatever else the rep holds. With
// it unset the president is refused, as today. CREATION_ROLES_ON is false in
// the tree; it is read here through a getter on the mocked module, as
// test/integration/tournament-create.test.ts reads it, so each case runs in
// the state its describe names, and canAssignDirectors is wrapped the same way
// for the one case that makes it refuse or allow, to hold that it alone
// decides. Every case reads the stored rows after the call.
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { env } from 'cloudflare:test'
import { flushWaitUntil, invoke, resetHarness } from './harness'
import {
  seedAdmin,
  seedClub,
  seedDirector,
  seedMember,
  seedPresident,
  seedTournament,
  seedTournamentDirector,
} from './factories'

import {
  onRequestGet as getDirectors,
  onRequestPost as assignDirector,
  onRequestDelete as removeDirector,
} from '../../functions/api/admin/tournaments/[id]/directors'
import { onRequestDelete as deleteTournament, onRequestPatch as tournamentPatch } from '../../functions/api/admin/tournaments/[id]'
import { onRequestPost as createTournament } from '../../functions/api/admin/tournaments'
import { onRequestGet as getManage } from '../../functions/api/admin/tournaments/[id]/manage'
import { onRequestPatch as patchRegistrationStatus } from '../../functions/api/admin/tournaments/[id]/registration'
import { onRequestGet as membersGet } from '../../functions/api/admin/members'

const flags = vi.hoisted(() => ({
  rolesOn: false,
  /** What canAssignDirectors answers: its own answer, or no or yes whatever it is asked. */
  assign: 'real' as 'real' | 'refuse' | 'allow',
  /** What canAssignDirectors was asked, call by call. */
  asked: [] as unknown[][],
}))
vi.mock('../../functions/utils/events/creation', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/events/creation')>()
  return {
    ...real,
    get CREATION_ROLES_ON() {
      return flags.rolesOn
    },
  }
})
vi.mock('../../domain/events/creation', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../domain/events/creation')>()
  return {
    ...real,
    canAssignDirectors: (...args: Parameters<typeof real.canAssignDirectors>) => {
      flags.asked.push(args)
      return flags.assign === 'real' ? real.canAssignDirectors(...args) : flags.assign === 'allow'
    },
  }
})

beforeEach(resetHarness)
afterEach(() => {
  flags.rolesOn = false
  flags.assign = 'real'
  flags.asked = []
})

/** Today's refusal of a naming or a removal, which WS08 step 5 keeps word for word. */
const NAMING_WORDS = "Only admins and the organizing club's rep can assign directors"
/** Today's refusal of the membership switch for anyone but an LCA admin and the organizing club's rep. */
const MEMBERSHIP_WORDS = "Only the organizing club's rep or an LCA admin can change whether an LCA membership is required"

const nameDirector = (as: string, tournamentId: string, memberId: string) =>
  invoke(assignDirector, { method: 'POST', as, params: { id: tournamentId }, body: { memberId } })
const removeNamed = (as: string, tournamentId: string, memberId: string) =>
  invoke(removeDirector, { method: 'DELETE', as, params: { id: tournamentId }, body: { memberId } })
const save = (as: string, tournamentId: string, body: Record<string, unknown>) =>
  invoke(tournamentPatch, { method: 'PATCH', as, params: { id: tournamentId }, body })

/** The event's directors, as tournament_directors holds them, in member id order. */
async function directorsOf(tournamentId: string): Promise<string[]> {
  const { results } = await env.DB.prepare('SELECT member_id FROM tournament_directors WHERE tournament_id = ? ORDER BY member_id')
    .bind(tournamentId).all<{ member_id: string }>()
  return results.map((r) => r.member_id)
}

/** The activity log's rows of one action about the event: who did it, and to whom. */
async function logOf(action: string, tournamentId: string) {
  const { results } = await env.DB.prepare(
    "SELECT actor_id, target_member_id FROM admin_audit_log WHERE action = ? AND json_extract(detail, '$.tournament_id') = ? ORDER BY created_at, id",
  ).bind(action, tournamentId).all<{ actor_id: string; target_member_id: string | null }>()
  return results
}

/** Every row of the activity log, counted. */
const logCount = async () => (await env.DB.prepare('SELECT COUNT(*) AS n FROM admin_audit_log').first<{ n: number }>())?.n ?? 0

/** The event's row, every column as stored. */
const eventOf = (tournamentId: string) =>
  env.DB.prepare('SELECT * FROM tournaments WHERE id = ?').bind(tournamentId).first<Record<string, unknown>>()

/** The event's section rows, archived ones too, every column as stored. */
async function sectionRowsOf(tournamentId: string) {
  return (await env.DB.prepare('SELECT * FROM tournament_sections WHERE tournament_id = ? ORDER BY id').bind(tournamentId).all()).results
}

/** The columns two rows of one table hold differently. */
function changed(before: Record<string, unknown> | null, after: Record<string, unknown> | null): string[] {
  return Object.keys({ ...before, ...after }).filter((k) => JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k])).sort()
}

/** The president as the brief keeps the role: an LCA observer with a current term on the President seat. */
async function seedSeatedObserver(): Promise<string> {
  const id = await seedMember({ role: 'lca_observer' })
  await seedPresident(id)
  return id
}

/** A hidden draft the member creates through POST /api/admin/tournaments, priced at $20. */
async function draftBy(as: string): Promise<string> {
  const res = await invoke(createTournament, {
    method: 'POST', as, body: { name: 'Bayou Winter Quads', location: 'Lafayette, LA', date: '2026-12-05', entryFee: 20 },
  })
  expect(res.status).toBe(201)
  return (await res.json<{ tournament: { id: string } }>()).tournament.id
}

describe('tournament directors', () => {
  it('admin can assign a director; list reflects it', async () => {
    const adminId = await seedAdmin()
    const tdId = await seedDirector()
    const tournamentId = await seedTournament()

    const res = await invoke(assignDirector, {
      method: 'POST',
      as: adminId,
      params: { id: tournamentId },
      body: { memberId: tdId },
    })
    expect(res.status).toBe(201)
    const { directors } = (await res.json()) as { directors: Array<{ member_id: string }> }
    expect(directors.map((d) => d.member_id)).toContain(tdId)

    const list = await invoke(getDirectors, {
      method: 'GET',
      as: adminId,
      params: { id: tournamentId },
    })
    expect(list.status).toBe(200)
    const listed = (await list.json()) as { directors: Array<{ member_id: string }> }
    expect(listed.directors.map((d) => d.member_id)).toContain(tdId)
  })

  it('club_rep of a different club cannot assign', async () => {
    const clubA = await seedClub()
    const clubB = await seedClub()
    const repB = await seedMember({ role: 'club_rep', clubId: clubB })
    const tdId = await seedDirector()
    const tournamentId = await seedTournament({ clubId: clubA })

    const res = await invoke(assignDirector, {
      method: 'POST',
      as: repB,
      params: { id: tournamentId },
      body: { memberId: tdId },
    })
    expect(res.status).toBe(403)
  })

  it('club_rep of the tournament club CAN assign', async () => {
    const club = await seedClub()
    const rep = await seedMember({ role: 'club_rep', clubId: club })
    const tdId = await seedDirector()
    const tournamentId = await seedTournament({ clubId: club })

    const res = await invoke(assignDirector, {
      method: 'POST',
      as: rep,
      params: { id: tournamentId },
      body: { memberId: tdId },
    })
    expect(res.status).toBe(201)
  })

  it('a tournament director cannot assign other directors', async () => {
    const tdId = await seedDirector()
    const otherTdId = await seedDirector()
    const tournamentId = await seedTournament()
    await seedTournamentDirector(tournamentId, tdId)

    const res = await invoke(assignDirector, {
      method: 'POST',
      as: tdId,
      params: { id: tournamentId },
      body: { memberId: otherTdId },
    })
    expect(res.status).toBe(403)
  })

  it('plain member cannot list directors', async () => {
    const memberId = await seedMember()
    const tournamentId = await seedTournament()

    const res = await invoke(getDirectors, {
      method: 'GET',
      as: memberId,
      params: { id: tournamentId },
    })
    expect(res.status).toBe(403)
  })

  it('assigning an ordinary member gives them that event, not a new role', async () => {
    const club = await seedClub()
    const rep = await seedMember({ role: 'club_rep', clubId: club })
    const helper = await seedMember()
    const tournamentId = await seedTournament({ clubId: club })
    const otherEvent = await seedTournament({ clubId: club })

    const res = await invoke(assignDirector, {
      method: 'POST', as: rep, params: { id: tournamentId }, body: { memberId: helper },
    })
    expect(res.status).toBe(201)

    const row = await env.DB.prepare('SELECT role FROM members WHERE id = ?')
      .bind(helper).first<{ role: string }>()
    expect(row?.role).toBe('member')

    // They can run this event…
    const edit = await invoke(tournamentPatch, {
      method: 'PATCH', as: helper, params: { id: tournamentId }, body: { name: 'Renamed by helper' },
    })
    expect(edit.status).toBe(200)
    // …but not another one, not the member directory, and they can't hand out access.
    const other = await invoke(tournamentPatch, {
      method: 'PATCH', as: helper, params: { id: otherEvent }, body: { name: 'Nope' },
    })
    expect(other.status).toBe(403)
    expect((await invoke(membersGet, { as: helper })).status).toBe(403)
    const assign = await invoke(assignDirector, {
      method: 'POST', as: helper, params: { id: tournamentId }, body: { memberId: await seedMember() },
    })
    expect(assign.status).toBe(403)

    const log = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM admin_audit_log WHERE action = 'director_assign' AND target_member_id = ?`,
    ).bind(helper).first<{ n: number }>()
    expect(log?.n).toBe(1)
  })

  it('removing a director leaves their role alone', async () => {
    const adminId = await seedAdmin()
    const tdId = await seedDirector()
    const tournamentId = await seedTournament()
    await seedTournamentDirector(tournamentId, tdId)

    const res = await invoke(removeDirector, {
      method: 'DELETE',
      as: adminId,
      params: { id: tournamentId },
      body: { memberId: tdId },
    })
    expect(res.status).toBe(200)
    const { directors } = (await res.json()) as { directors: Array<{ member_id: string }> }
    expect(directors.map((d) => d.member_id)).not.toContain(tdId)

    const row = await env.DB.prepare('SELECT role FROM members WHERE id = ?')
      .bind(tdId)
      .first<{ role: string }>()
    expect(row?.role).toBe('tournament_director')
  })
})

describe('naming and removing directors with CREATION_ROLES_ON set (D21, criterion 14)', () => {
  beforeEach(() => {
    flags.rolesOn = true
  })

  it('the president, an LCA observer who holds the seat, creates an event, names a one-event director on it and removes them again, each in the activity log, and the director\'s role is unchanged', async () => {
    const president = await seedSeatedObserver()
    const event = await draftBy(president)
    expect(await directorsOf(event)).toEqual([president])
    const helper = await seedMember()

    const named = await nameDirector(president, event, helper)
    expect(named.status).toBe(201)
    expect(await directorsOf(event)).toEqual([president, helper].sort())
    expect(await logOf('director_assign', event)).toEqual([{ actor_id: president, target_member_id: helper }])
    const role = await env.DB.prepare('SELECT role FROM members WHERE id = ?').bind(helper).first<{ role: string }>()
    expect(role?.role).toBe('member')

    const removed = await removeNamed(president, event, helper)
    expect(removed.status).toBe(200)
    expect(await directorsOf(event)).toEqual([president])
    expect(await logOf('director_remove', event)).toEqual([{ actor_id: president, target_member_id: helper }])
  })

  it('the president is refused naming and removing on an event an LCA admin created, with today\'s words, and nothing is written', async () => {
    const president = await seedSeatedObserver()
    const event = await draftBy(await seedAdmin())
    const director = await seedMember()
    await seedTournamentDirector(event, director)
    const log = await logCount()

    const named = await nameDirector(president, event, await seedMember())
    expect(named.status).toBe(403)
    expect(await named.json()).toEqual({ error: NAMING_WORDS })
    const removed = await removeNamed(president, event, director)
    expect(removed.status).toBe(403)
    expect(await removed.json()).toEqual({ error: NAMING_WORDS })
    expect(await directorsOf(event)).toEqual([director])
    expect(await logCount()).toBe(log)
  })

  it('the president is refused naming and removing on a club\'s published event whose creator is the president, with today\'s words, and nothing is written', async () => {
    const president = await seedSeatedObserver()
    const club = await seedClub()
    // An event the seat holder made earlier, as the club's rep or as an LCA admin, is not one the president drafted.
    const event = await seedTournament({ clubId: club, createdBy: president })
    const director = await seedMember()
    await seedTournamentDirector(event, director)
    const log = await logCount()

    const named = await nameDirector(president, event, await seedMember())
    expect(named.status).toBe(403)
    expect(await named.json()).toEqual({ error: NAMING_WORDS })
    const removed = await removeNamed(president, event, director)
    expect(removed.status).toBe(403)
    expect(await removed.json()).toEqual({ error: NAMING_WORDS })
    expect(await directorsOf(event)).toEqual([director])
    expect(await logCount()).toBe(log)
  })

  it('an LCA admin names and removes on any event, the president\'s draft among them', async () => {
    const admin = await seedAdmin()
    const event = await draftBy(await seedSeatedObserver())
    const helper = await seedMember()
    expect((await nameDirector(admin, event, helper)).status).toBe(201)
    expect(await directorsOf(event)).toContain(helper)
    expect((await removeNamed(admin, event, helper)).status).toBe(200)
    expect(await directorsOf(event)).not.toContain(helper)
    expect(await logOf('director_assign', event)).toEqual([{ actor_id: admin, target_member_id: helper }])
    expect(await logOf('director_remove', event)).toEqual([{ actor_id: admin, target_member_id: helper }])
  })

  it('an officer and an observer who hold no seat are refused naming on any event, one recorded as theirs among them, and nothing is written (D21: no other officer)', async () => {
    const admin = await seedAdmin()
    for (const role of ['lca_officer', 'lca_observer']) {
      const officer = await seedMember({ role })
      const events = [await seedTournament({ isVisible: false, createdBy: officer }), await draftBy(admin), await seedTournament()]
      const log = await logCount()
      for (const event of events) {
        const res = await nameDirector(officer, event, await seedMember())
        expect(res.status, `${role} on ${event}`).toBe(403)
        expect(await res.json(), `${role} on ${event}`).toEqual({ error: NAMING_WORDS })
        expect(await directorsOf(event), `${role} on ${event}`).toEqual([])
      }
      expect(await logCount(), role).toBe(log)
    }
  })

  it('a standing director is refused naming and removing on the event they created and direct, and nothing is written', async () => {
    const director = await seedDirector()
    const event = await draftBy(director)
    expect(await directorsOf(event)).toEqual([director])
    const log = await logCount()

    const named = await nameDirector(director, event, await seedMember())
    expect(named.status).toBe(403)
    expect(await named.json()).toEqual({ error: NAMING_WORDS })
    const removed = await removeNamed(director, event, director)
    expect(removed.status).toBe(403)
    expect(await removed.json()).toEqual({ error: NAMING_WORDS })
    expect(await directorsOf(event)).toEqual([director])
    expect(await logCount()).toBe(log)
  })

  it('the one-event director the president names is refused the membership switch, naming, removing and the delete on the unpublished draft with no entries, and nothing is written', async () => {
    const president = await seedSeatedObserver()
    const event = await draftBy(president)
    const director = await seedMember()
    expect((await nameDirector(president, event, director)).status).toBe(201)
    const row = await eventOf(event)
    const log = await logCount()

    for (const requiresLcaMembership of [false, true]) {
      const res = await save(director, event, { requiresLcaMembership })
      expect(res.status, String(requiresLcaMembership)).toBe(403)
      expect(await res.json(), String(requiresLcaMembership)).toEqual({ error: MEMBERSHIP_WORDS })
    }
    const named = await nameDirector(director, event, await seedMember())
    expect(named.status).toBe(403)
    expect(await named.json()).toEqual({ error: NAMING_WORDS })
    const removed = await removeNamed(director, event, president)
    expect(removed.status).toBe(403)
    expect(await removed.json()).toEqual({ error: NAMING_WORDS })
    const deleted = await invoke(deleteTournament, { method: 'DELETE', as: director, params: { id: event } })
    expect(deleted.status).toBe(403)
    expect(await deleted.json()).toEqual({ error: 'Forbidden' })

    expect(await eventOf(event)).toEqual(row)
    expect(await directorsOf(event)).toEqual([president, director].sort())
    expect(await logCount()).toBe(log)
  })

  it('that director saves every setup step today\'s manage page has, each changing only what it sends, opens registration and publishes the event', async () => {
    const president = await seedSeatedObserver()
    const event = await draftBy(president)
    const director = await seedMember()
    expect((await nameDirector(president, event, director)).status).toBe(201)

    // Details: the page sends the keys that changed, and the sections whole,
    // as the manage answer gave them, with their fees, once any is edited.
    const manage = await invoke(getManage, { as: director, params: { id: event } })
    expect(manage.status).toBe(200)
    const { tournament } = await manage.json<{ tournament: { sections: Array<{ name: string; fees: { regular: number } }> } }>()
    expect(tournament.sections.map((s) => [s.name, s.fees.regular])).toEqual([['Open', 20]])
    let before = await eventOf(event)
    const sections = await sectionRowsOf(event)
    const details = await save(director, event, { name: 'Bayou Winter Open', sections: tournament.sections })
    expect(details.status).toBe(200)
    const detailed = await eventOf(event)
    expect(detailed?.name).toBe('Bayou Winter Open')
    // The section rows are as they were. The sections JSON kept beside them
    // says the same, one Open section at $20 with no rule, now with every
    // rule's key, as the section writer writes any list it is sent.
    expect(await sectionRowsOf(event)).toEqual(sections)
    expect(changed(before, detailed)).toEqual(['name', 'sections'])
    expect(JSON.parse(String(before?.sections))).toEqual([{ name: 'Open', entryFee: 20 }])
    expect(JSON.parse(String(detailed?.sections))).toEqual([{ name: 'Open', entryFee: 20, ratingMax: null, ratingMin: null, gradeMin: null, gradeMax: null, rulesSet: false }])

    // Registration settings: the page sends the close time and the early and
    // late keys that changed, never the sections; a discount with its
    // deadline and a late date with no late fee raise no price, and the
    // event stays hidden.
    before = await eventOf(event)
    const settings = await save(director, event, {
      registrationClosesAt: '2026-12-04T18:00', earlyDeadline: '2026-11-27T23:59', earlyDiscount: 5, lateAfter: '2026-12-03T12:00',
    })
    expect(settings.status).toBe(200)
    const settled = await eventOf(event)
    expect(changed(before, settled)).toEqual(['early_deadline', 'early_discount', 'late_after', 'registration_closes_at'])
    expect([settled?.registration_closes_at, settled?.early_discount, settled?.late_fee, settled?.is_visible]).toEqual(['2026-12-04T18:00', 5, 0, 0])
    expect(await sectionRowsOf(event)).toEqual(sections)

    // Schedule: a time for every round of the event, as the page sends them.
    before = await eventOf(event)
    const roundSchedule = Array.from({ length: Number(before?.rounds) }, (_, i) => ({ round: i + 1, date: '2026-12-05', time: `${String(9 + 2 * i).padStart(2, '0')}:00` }))
    const schedule = await save(director, event, { roundSchedule })
    expect(schedule.status).toBe(200)
    expect(changed(before, await eventOf(event))).toEqual(['round_schedule'])
    expect((await schedule.json<{ tournament: { round_schedule: unknown } }>()).tournament.round_schedule).toEqual(roundSchedule)

    // Opening registration, on its own endpoint, as the page sends it.
    before = await eventOf(event)
    expect(before?.registration_status).toBe('draft')
    const opened = await invoke(patchRegistrationStatus, { method: 'PATCH', as: director, params: { id: event }, body: { registration_status: 'open' } })
    expect(opened.status).toBe(200)
    await flushWaitUntil()
    expect(changed(before, await eventOf(event))).toEqual(['registration_status'])
    expect((await eventOf(event))?.registration_status).toBe('open')

    // Publishing, logged as the director's.
    before = await eventOf(event)
    const published = await save(director, event, { isVisible: true })
    expect(published.status).toBe(200)
    expect(changed(before, await eventOf(event))).toEqual(['is_visible'])
    expect((await eventOf(event))?.is_visible).toBe(1)
    expect(await logOf('tournament_publish', event)).toEqual([{ actor_id: director, target_member_id: null }])
    expect(await directorsOf(event)).toEqual([president, director].sort())
  })

  it('the president publishes a draft the president created, and is refused its membership switch with today\'s words (their events are LCA-run)', async () => {
    const president = await seedSeatedObserver()
    const event = await draftBy(president)

    const refused = await save(president, event, { requiresLcaMembership: false })
    expect(refused.status).toBe(403)
    expect(await refused.json()).toEqual({ error: MEMBERSHIP_WORDS })
    expect((await eventOf(event))?.requires_lca_membership).toBe(1)

    const before = await eventOf(event)
    const published = await save(president, event, { isVisible: true })
    expect(published.status).toBe(200)
    expect(changed(before, await eventOf(event))).toEqual(['is_visible'])
    expect(await logOf('tournament_publish', event)).toEqual([{ actor_id: president, target_member_id: null }])
  })

  it('canAssignDirectors alone decides: asked about the person, the event\'s club and creator and the constant, made to refuse it turns away an LCA admin and the club\'s rep, and made to allow it lets a plain member name', async () => {
    const club = await seedClub()
    const admin = await seedAdmin()
    const rep = await seedMember({ role: 'club_rep', clubId: club })
    const president = await seedSeatedObserver()
    const event = await seedTournament({ clubId: club, isVisible: false, createdBy: president })
    const log = await logCount()

    flags.assign = 'refuse'
    for (const as of [admin, rep]) {
      const res = await nameDirector(as, event, await seedMember())
      expect(res.status, as).toBe(403)
      expect(await res.json(), as).toEqual({ error: NAMING_WORDS })
    }
    expect(await directorsOf(event)).toEqual([])
    expect(await logCount()).toBe(log)

    flags.assign = 'allow'
    flags.asked = []
    const member = await seedMember()
    const helper = await seedMember()
    expect((await nameDirector(member, event, helper)).status).toBe(201)
    expect(await directorsOf(event)).toEqual([helper])
    expect(await logOf('director_assign', event)).toEqual([{ actor_id: member, target_member_id: helper }])
    expect(flags.asked).toEqual([[{ grant: 'none', memberId: member, repClubId: null }, { clubId: club, createdBy: president }, true]])
  })

  it('a club rep names on its own club\'s event and not on another club\'s, and so does a club rep who holds the President seat', async () => {
    const own = await seedClub()
    const other = await seedClub()
    const plainRep = await seedMember({ role: 'club_rep', clubId: own })
    const seatedRep = await seedMember({ role: 'club_rep', clubId: own })
    await seedPresident(seatedRep)
    const ownEvent = await seedTournament({ clubId: own })
    const otherEvent = await seedTournament({ clubId: other })
    const helpers: string[] = []
    for (const rep of [plainRep, seatedRep]) {
      const helper = await seedMember()
      helpers.push(helper)
      expect((await nameDirector(rep, ownEvent, helper)).status, rep).toBe(201)
      const refused = await nameDirector(rep, otherEvent, helper)
      expect(refused.status, rep).toBe(403)
      expect(await refused.json(), rep).toEqual({ error: NAMING_WORDS })
    }
    expect(await directorsOf(ownEvent)).toEqual([...helpers].sort())
    expect(await directorsOf(otherEvent)).toEqual([])
    expect((await logOf('director_assign', ownEvent)).map((r) => r.actor_id)).toEqual([plainRep, seatedRep])
    expect(await logOf('director_assign', otherEvent)).toEqual([])
  })
})

describe('naming with CREATION_ROLES_ON unset, as today', () => {
  it('the president is refused naming and removing on the event the president created and directs, with today\'s words, and nothing is written', async () => {
    const president = await seedSeatedObserver()
    const event = await seedTournament({ isVisible: false, createdBy: president })
    await seedTournamentDirector(event, president)
    const log = await logCount()

    const named = await nameDirector(president, event, await seedMember())
    expect(named.status).toBe(403)
    expect(await named.json()).toEqual({ error: NAMING_WORDS })
    const removed = await removeNamed(president, event, president)
    expect(removed.status).toBe(403)
    expect(await removed.json()).toEqual({ error: NAMING_WORDS })
    expect(await directorsOf(event)).toEqual([president])
    expect(await logCount()).toBe(log)
  })
})
