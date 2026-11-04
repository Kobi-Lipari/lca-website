// test/integration/creation-grant.test.ts
//
// The database half of the creation rules (functions/utils/events/creation.ts)
// on a D1 database built from the migrations, and the rules it feeds
// (domain/events/creation.ts) held to today's handlers:
// - holdsPresidentSeat reads the seat the migrations made, the President row
//   of 0011 with the slug 0025 gave it, held by no one until a test assigns
//   it: a current term holds it whatever the member's role; an ended term,
//   a term on another seat (Vice President's slug holds the word) and a
//   seat made inactive do not; two current holders each do, as 0027 allows;
//   and a member who held it, left and was given it again holds it again;
// - creationGrant and creationPerson give each role the grant in the brief's
//   order (an LCA admin first; with CREATION_ROLES_ON set, the seat, then the
//   tournament_director role; then a club rep with a club; else none), with
//   the club a club rep manages beside the grant whatever it is and no club
//   beside anyone else's, read as the member is now;
// - creatorGrant reads the grant an event's creator holds now, by the event,
//   the seat read for the creator alone, and null for an event with no
//   creator or no such event;
// - each reads in the statements the brief sets: one for the seat, one for
//   the creator, and none for the seat while the constant is unset;
// - with CREATION_ROLES_ON unset, the rules answer for each person what
//   today's handlers answer: who creates for which club, who names an event's
//   directors, who deletes an event and who saves a fee above $0, a refused
//   request writing nothing; and a creator who holds no director row and has
//   lost the grant that let them create is refused the event's setup, since
//   canManageTournament never reads created_by.
// CREATION_ROLES_ON is false in the tree. It is read here through a getter on
// the mocked module and held unset, so once a handler reads it, as the trim's
// handlers read theirs, the comparison still asks the handler and the rules
// the same question.
import { env } from 'cloudflare:test'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { canAssignDirectors, canChargeFees, canCreate, canDeleteDraft, type CreationGrant } from '../../domain/events/creation'
import * as creation from '../../functions/utils/events/creation'
import { creationGrant, creationPerson, creatorGrant, holdsPresidentSeat, type GrantMember } from '../../functions/utils/events/creation'
import { onRequestPost as createTournament } from '../../functions/api/admin/tournaments'
import { onRequestDelete as deleteTournament, onRequestPatch as patchTournament } from '../../functions/api/admin/tournaments/[id]'
import { onRequestPost as assignDirector } from '../../functions/api/admin/tournaments/[id]/directors'
import { seedAdmin, seedClub, seedMember, seedTournament, seedTournamentDirector } from './factories'
import { invoke, resetHarness } from './harness'

const flags = vi.hoisted(() => ({ rolesOn: false }))
vi.mock('../../functions/utils/events/creation', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/events/creation')>()
  return {
    ...real,
    get CREATION_ROLES_ON() {
      return flags.rolesOn
    },
  }
})

beforeEach(resetHarness)
afterEach(() => {
  flags.rolesOn = false
})

let seq = 0

/** The member's row as a handler holds it, read back from the database. */
async function memberRow(id: string): Promise<GrantMember> {
  const row = await env.DB.prepare('SELECT id, role, club_id FROM members WHERE id = ?').bind(id).first<GrantMember>()
  if (!row) throw new Error(`no member ${id}`)
  return row
}

async function seatId(slug: string): Promise<string> {
  const row = await env.DB.prepare('SELECT id FROM board_members WHERE slug = ?').bind(slug).first<{ id: string }>()
  if (!row) throw new Error(`no seat whose slug is ${slug}`)
  return row.id
}

/** Gives the member a current term on the seat, as the seats page does, and returns the term's id. */
async function assign(memberId: string, slug = 'president'): Promise<string> {
  const id = `term-${++seq}`
  await env.DB.prepare('INSERT INTO board_seat_assignments (id, seat_id, member_id) VALUES (?, ?, ?)').bind(id, await seatId(slug), memberId).run()
  return id
}

/** Ends a term as the seats page does: the row stays, with its end. */
async function endTerm(termId: string): Promise<void> {
  await env.DB.prepare("UPDATE board_seat_assignments SET ended_at = datetime('now') WHERE id = ?").bind(termId).run()
}

/** Writes the event's creator, as today's create writes created_by. */
async function setCreator(tournamentId: string, memberId: string | null): Promise<void> {
  await env.DB.prepare('UPDATE tournaments SET created_by = ? WHERE id = ?').bind(memberId, tournamentId).run()
}

async function count(sql: string, ...args: unknown[]): Promise<number> {
  const row = await env.DB.prepare(sql).bind(...args).first<{ n: number }>()
  return row?.n ?? 0
}

/** A database that keeps every statement it is asked to prepare, and answers from D1. */
function counting(): { db: D1Database; asked: string[] } {
  const asked: string[] = []
  const db = {
    prepare: (sql: string) => {
      asked.push(sql.replace(/\s+/g, ' ').trim())
      return env.DB.prepare(sql)
    },
  } as unknown as D1Database
  return { db, asked }
}

describe('holdsPresidentSeat on the migrated database', () => {
  let holdersAtStart = -1
  beforeAll(async () => {
    holdersAtStart = await count(
      `SELECT COUNT(*) AS n FROM board_seat_assignments a JOIN board_members s ON s.id = a.seat_id
        WHERE s.slug = 'president' AND a.ended_at IS NULL`,
    )
  })

  it('finds the seat the migrations made: the President row, slug president, active, an officer\'s seat, held by no one', async () => {
    const seat = await env.DB.prepare("SELECT role, slug, is_active, category FROM board_members WHERE slug = 'president'").first()
    expect(seat).toEqual({ role: 'President', slug: 'president', is_active: 1, category: 'officer' })
    expect(holdersAtStart).toBe(0)
  })

  it('holds for a current term on the seat, whatever the member\'s role: the seat is the grant', async () => {
    for (const role of ['member', 'lca_observer', 'lca_officer', 'lca_auditor', 'club_rep', 'tournament_director', 'lca_admin']) {
      const id = await seedMember({ role })
      expect(await holdsPresidentSeat(env.DB, id), `${role}, before the term`).toBe(false)
      await assign(id)
      expect(await holdsPresidentSeat(env.DB, id), `${role}, in the term`).toBe(true)
    }
  })

  it('does not hold once the term has ended', async () => {
    const id = await seedMember({ role: 'lca_observer' })
    const term = await assign(id)
    await endTerm(term)
    expect(await holdsPresidentSeat(env.DB, id)).toBe(false)
  })

  it('does not hold for a term on another seat, Vice President\'s among them, whose slug holds the word', async () => {
    const id = await seedMember({ role: 'lca_observer' })
    await assign(id, 'vice-president')
    expect(await holdsPresidentSeat(env.DB, id)).toBe(false)
  })

  it('does not hold while the seat is inactive, and holds again once it is active', async () => {
    const id = await seedMember({ role: 'lca_observer' })
    await assign(id)
    const seat = await seatId('president')
    await env.DB.prepare('UPDATE board_members SET is_active = 0 WHERE id = ?').bind(seat).run()
    try {
      expect(await holdsPresidentSeat(env.DB, id)).toBe(false)
    } finally {
      await env.DB.prepare('UPDATE board_members SET is_active = 1 WHERE id = ?').bind(seat).run()
    }
    expect(await holdsPresidentSeat(env.DB, id)).toBe(true)
  })

  it('holds for each of two current holders, as 0027 lets a seat have, and for neither once both terms end', async () => {
    const first = await seedMember({ role: 'lca_observer' })
    const second = await seedMember({ role: 'lca_officer' })
    const terms = [await assign(first), await assign(second)]
    expect([await holdsPresidentSeat(env.DB, first), await holdsPresidentSeat(env.DB, second)]).toEqual([true, true])
    for (const term of terms) await endTerm(term)
    expect([await holdsPresidentSeat(env.DB, first), await holdsPresidentSeat(env.DB, second)]).toEqual([false, false])
  })

  it('holds for a member who held it, left and was given it again', async () => {
    const id = await seedMember({ role: 'lca_observer' })
    await endTerm(await assign(id))
    expect(await holdsPresidentSeat(env.DB, id)).toBe(false)
    await assign(id)
    expect(await holdsPresidentSeat(env.DB, id)).toBe(true)
  })

  it('holds for no one it does not know', async () => {
    expect(await holdsPresidentSeat(env.DB, 'no-such-member')).toBe(false)
  })
})

describe('creationGrant and creationPerson on the migrated database, CREATION_ROLES_ON set and unset', () => {
  type Row = readonly [label: string, role: string, withClub: boolean, holdsSeat: boolean, rolesOn: boolean, grant: CreationGrant, repClub: boolean]
  const ROWS: readonly Row[] = [
    ['an LCA admin, unset', 'lca_admin', false, false, false, 'admin', false],
    ['an LCA admin, set', 'lca_admin', false, false, true, 'admin', false],
    ['an LCA admin who holds the President seat, set: an admin still', 'lca_admin', false, true, true, 'admin', false],
    ['an LCA admin whose account names a club, set: no club beside the grant', 'lca_admin', true, false, true, 'admin', false],
    ['an LCA observer who holds the seat, set: the president', 'lca_observer', false, true, true, 'president', false],
    ['an LCA observer who holds the seat, unset: no grant, as today', 'lca_observer', false, true, false, 'none', false],
    ['an LCA observer with no seat, set', 'lca_observer', false, false, true, 'none', false],
    ['an LCA officer who holds the seat, set: the president', 'lca_officer', false, true, true, 'president', false],
    ['an LCA officer with no seat, set: no other officer creates', 'lca_officer', false, false, true, 'none', false],
    ['an auditor, set', 'lca_auditor', false, false, true, 'none', false],
    ['a standing director, set', 'tournament_director', false, false, true, 'standing_director', false],
    ['a standing director, unset: no grant, as today', 'tournament_director', false, false, false, 'none', false],
    ['a standing director whose account names a club, set: no club beside the grant', 'tournament_director', true, false, true, 'standing_director', false],
    ['a standing director who holds the seat, set: the seat wins', 'tournament_director', false, true, true, 'president', false],
    ['a club rep, unset', 'club_rep', true, false, false, 'club_rep', true],
    ['a club rep, set', 'club_rep', true, false, true, 'club_rep', true],
    ['a club rep who holds the seat, set: the president, its club beside the grant', 'club_rep', true, true, true, 'president', true],
    ['a club rep who holds the seat, unset: a club rep, as today', 'club_rep', true, true, false, 'club_rep', true],
    ['a club rep with no club, set', 'club_rep', false, false, true, 'none', false],
    ['a club rep with no club who holds the seat, set: the president, no club beside it', 'club_rep', false, true, true, 'president', false],
    ['a member, set', 'member', false, false, true, 'none', false],
    ['a member whose account names a club, set', 'member', true, false, true, 'none', false],
    ['a member who holds the seat, set: the seat is the grant', 'member', false, true, true, 'president', false],
    ['a member who holds the seat, unset', 'member', false, true, false, 'none', false],
    ['a guest, set', 'guest', false, false, true, 'none', false],
  ]

  it.each(ROWS)('%s', async (_label, role, withClub, holdsSeat, rolesOn, grant, repClub) => {
    const clubId = withClub ? await seedClub() : null
    const id = await seedMember({ role, clubId })
    if (holdsSeat) await assign(id)
    const member = await memberRow(id)
    expect(await creationGrant(env.DB, member, rolesOn)).toBe(grant)
    expect(await creationPerson(env.DB, member, rolesOn)).toEqual({ grant, memberId: id, repClubId: repClub ? clubId : null })
  })

  it('reads the grant as the member is now: a role taken away or a term ended takes the grant with it', async () => {
    const standing = await seedMember({ role: 'tournament_director' })
    expect(await creationGrant(env.DB, await memberRow(standing), true)).toBe('standing_director')
    await env.DB.prepare("UPDATE members SET role = 'member' WHERE id = ?").bind(standing).run()
    expect(await creationGrant(env.DB, await memberRow(standing), true)).toBe('none')

    const president = await seedMember({ role: 'lca_observer' })
    const term = await assign(president)
    expect(await creationGrant(env.DB, await memberRow(president), true)).toBe('president')
    await endTerm(term)
    expect(await creationGrant(env.DB, await memberRow(president), true)).toBe('none')

    const club = await seedClub()
    const rep = await seedMember({ role: 'club_rep', clubId: club })
    await env.DB.prepare('UPDATE members SET club_id = NULL WHERE id = ?').bind(rep).run()
    expect(await creationPerson(env.DB, await memberRow(rep), true)).toEqual({ grant: 'none', memberId: rep, repClubId: null })
  })
})

describe('creatorGrant: the grant an event\'s creator holds now', () => {
  it('reads the creator by the event, for each grant, with the constant set and unset', async () => {
    const club = await seedClub()
    const creators: ReadonlyArray<readonly [string, string, string | null, CreationGrant, CreationGrant]> = [
      ['an LCA admin', await seedAdmin(), null, 'admin', 'admin'],
      ['the president', await seedMember({ role: 'lca_observer' }), null, 'president', 'none'],
      ['a standing director', await seedMember({ role: 'tournament_director' }), null, 'standing_director', 'none'],
      ['a club rep', await seedMember({ role: 'club_rep', clubId: club }), club, 'club_rep', 'club_rep'],
      ['a member', await seedMember(), null, 'none', 'none'],
    ]
    await assign(creators[1][1])
    for (const [name, creator, clubId, set, unset] of creators) {
      const event = await seedTournament({ clubId, isVisible: false })
      await setCreator(event, creator)
      expect(await creatorGrant(env.DB, event, true), `${name}, set`).toBe(set)
      expect(await creatorGrant(env.DB, event, false), `${name}, unset`).toBe(unset)
    }
  })

  it('reads the seat for the creator, not for whoever else holds it', async () => {
    const standing = await seedMember({ role: 'tournament_director' })
    await assign(await seedMember({ role: 'lca_observer' }))
    const event = await seedTournament({ isVisible: false })
    await setCreator(event, standing)
    expect(await creatorGrant(env.DB, event, true)).toBe('standing_director')
  })

  it('reads the grant the creator holds now, not the one they created with', async () => {
    const standing = await seedMember({ role: 'tournament_director' })
    const event = await seedTournament({ isVisible: false })
    await setCreator(event, standing)
    expect(await creatorGrant(env.DB, event, true)).toBe('standing_director')
    await env.DB.prepare("UPDATE members SET role = 'member' WHERE id = ?").bind(standing).run()
    expect(await creatorGrant(env.DB, event, true)).toBe('none')

    const president = await seedMember({ role: 'lca_observer' })
    const term = await assign(president)
    const own = await seedTournament({ isVisible: false })
    await setCreator(own, president)
    expect(await creatorGrant(env.DB, own, true)).toBe('president')
    await endTerm(term)
    expect(await creatorGrant(env.DB, own, true)).toBe('none')
  })

  it('answers null for an event with no creator and for an event that does not exist', async () => {
    const event = await seedTournament()
    expect(await count('SELECT COUNT(*) AS n FROM tournaments WHERE id = ? AND created_by IS NULL', event)).toBe(1)
    for (const rolesOn of [false, true]) {
      expect(await creatorGrant(env.DB, event, rolesOn)).toBeNull()
      expect(await creatorGrant(env.DB, 'no-such-event', rolesOn)).toBeNull()
    }
  })
})

describe('the statements each reads, on the database itself', () => {
  it('holdsPresidentSeat reads one; creationGrant reads none while the constant is unset, none for an LCA admin, and the seat alone otherwise', async () => {
    const seat = counting()
    await holdsPresidentSeat(seat.db, await seedMember())
    expect(seat.asked).toHaveLength(1)
    expect(seat.asked[0]).toContain('FROM board_seat_assignments a JOIN board_members s ON s.id = a.seat_id')

    const club = await seedClub()
    for (const role of ['lca_admin', 'lca_observer', 'tournament_director', 'club_rep', 'member']) {
      const member = await memberRow(await seedMember({ role, clubId: role === 'club_rep' ? club : null }))
      const unset = counting()
      await creationGrant(unset.db, member, false)
      expect(unset.asked, `${role}, unset`).toEqual([])
      const set = counting()
      await creationGrant(set.db, member, true)
      expect(set.asked.length, `${role}, set`).toBe(role === 'lca_admin' ? 0 : 1)
    }
  })

  it('creatorGrant reads the creator in one statement, and the creator\'s seat as well only with the constant set', async () => {
    const event = await seedTournament({ isVisible: false })
    await setCreator(event, await seedMember({ role: 'tournament_director' }))
    const unset = counting()
    await creatorGrant(unset.db, event, false)
    expect(unset.asked).toEqual(['SELECT m.id, m.role, m.club_id FROM tournaments t JOIN members m ON m.id = t.created_by WHERE t.id = ?'])
    const set = counting()
    await creatorGrant(set.db, event, true)
    expect(set.asked).toHaveLength(2)
    const missing = counting()
    await creatorGrant(missing.db, 'no-such-event', true)
    expect(missing.asked).toHaveLength(1)
  })
})

describe('with CREATION_ROLES_ON unset, the rules answer what today\'s handlers answer', () => {
  /** The people of the table, each with the role the database gives them, and the two clubs they are asked about. */
  async function people() {
    const own = await seedClub()
    const other = await seedClub()
    const ids: Record<string, string> = {
      'an LCA admin': await seedAdmin(),
      'the club\'s rep': await seedMember({ role: 'club_rep', clubId: own }),
      'the club\'s rep who holds the President seat': await seedMember({ role: 'club_rep', clubId: own }),
      'the president, an LCA observer': await seedMember({ role: 'lca_observer' }),
      'a standing director': await seedMember({ role: 'tournament_director' }),
      'an officer who is not the president': await seedMember({ role: 'lca_officer' }),
      'an auditor': await seedMember({ role: 'lca_auditor' }),
      'a member': await seedMember(),
    }
    await assign(ids['the club\'s rep who holds the President seat'])
    await assign(ids['the president, an LCA observer'])
    return { own, other, ids }
  }
  /** The person the rules ask about, built as a handler builds it, with the constant read through the module. */
  const personOf = async (id: string) => creationPerson(env.DB, await memberRow(id), creation.CREATION_ROLES_ON)

  it('reads the constant unset', () => {
    expect(creation.CREATION_ROLES_ON).toBe(false)
  })

  it('creating: for the person\'s own club, another club, or an LCA-run event; a refused create writes no event', async () => {
    const { own, other, ids } = await people()
    for (const [name, id] of Object.entries(ids)) {
      const person = await personOf(id)
      for (const clubId of [own, other, null]) {
        const title = `Creation probe ${++seq}`
        const res = await invoke(createTournament, {
          method: 'POST',
          as: id,
          body: { name: title, location: 'Kenner, LA', date: '2026-12-12', entryFee: 20, ...(clubId ? { clubId } : {}) },
        })
        const label = `${name}, ${clubId === own ? 'its own club' : clubId === other ? 'another club' : 'an LCA-run event'}`
        // Today's create gives a club rep's event its own club when it names none, so the rules are asked about that club.
        const asked = clubId === null && person.repClubId !== null ? person.repClubId : clubId
        const allowed = canCreate(person, asked, creation.CREATION_ROLES_ON)
        expect(res.status, label).toBe(allowed ? 201 : 403)
        const rows = await env.DB.prepare('SELECT id, club_id, created_by, is_visible FROM tournaments WHERE name = ?')
          .bind(title).all<{ id: string; club_id: string | null; created_by: string; is_visible: number }>()
        expect(rows.results, label).toHaveLength(allowed ? 1 : 0)
        if (!allowed) continue
        // A hidden draft, its creator recorded, and no director row: today's create, as the record's verify item says.
        const [row] = rows.results
        expect([row.club_id, row.created_by, row.is_visible], label).toEqual([asked, id, 0])
        expect(await count('SELECT COUNT(*) AS n FROM tournament_directors WHERE tournament_id = ?', row.id), label).toBe(0)
      }
    }
  })

  it('naming a director: on the person\'s own club\'s event, another club\'s, and an LCA-run event the person created; a refused naming writes no director', async () => {
    const { own, other, ids } = await people()
    for (const [name, id] of Object.entries(ids)) {
      const person = await personOf(id)
      for (const [clubId, creator] of [[own, null], [other, null], [null, id]] as const) {
        const event = await seedTournament({ clubId, isVisible: false })
        await setCreator(event, creator)
        const director = await seedMember()
        const res = await invoke(assignDirector, { method: 'POST', as: id, params: { id: event }, body: { memberId: director } })
        const label = `${name}, ${clubId === own ? 'its own club\'s event' : clubId === other ? 'another club\'s event' : 'an LCA-run event it created'}`
        const allowed = canAssignDirectors(person, { clubId, createdBy: creator }, creation.CREATION_ROLES_ON)
        expect(res.status, label).toBe(allowed ? 201 : 403)
        expect(await count('SELECT COUNT(*) AS n FROM tournament_directors WHERE tournament_id = ? AND member_id = ?', event, director), label).toBe(allowed ? 1 : 0)
      }
    }
  })

  it('deleting an unpublished draft with no entries the person created: an LCA admin alone, and a refused delete leaves the draft', async () => {
    const { own, ids } = await people()
    for (const [name, id] of Object.entries(ids)) {
      const person = await personOf(id)
      const clubId = person.repClubId ?? (name === 'an LCA admin' ? own : null)
      const event = await seedTournament({ clubId, isVisible: false })
      await setCreator(event, id)
      const res = await invoke(deleteTournament, { method: 'DELETE', as: id, params: { id: event } })
      const allowed = canDeleteDraft(person, { clubId, createdBy: id, isVisible: 0, entries: 0 }, creation.CREATION_ROLES_ON)
      expect(res.status, name).toBe(allowed ? 200 : 403)
      expect(await count('SELECT COUNT(*) AS n FROM tournaments WHERE id = ?', event), name).toBe(allowed ? 0 : 1)
    }
  })

  it('saving a fee above $0: everyone the manage check admits, an assigned director with no grant among them, as canChargeFees answers', async () => {
    const own = await seedClub()
    const managers: ReadonlyArray<readonly [string, string, boolean]> = [
      ['an LCA admin', await seedAdmin(), false],
      ['the club\'s rep', await seedMember({ role: 'club_rep', clubId: own }), false],
      ['an assigned director who is a member', await seedMember(), true],
      ['an assigned director who is a standing director', await seedMember({ role: 'tournament_director' }), true],
    ]
    for (const [name, id, assigned] of managers) {
      const event = await seedTournament({ clubId: own, entryFee: 20, isVisible: false })
      if (assigned) await seedTournamentDirector(event, id)
      const allowed = canChargeFees(await personOf(id), { clubId: own, createdBy: null }, creation.CREATION_ROLES_ON)
      expect(allowed, name).toBe(true)
      const res = await invoke(patchTournament, { method: 'PATCH', as: id, params: { id: event }, body: { entryFee: 35 } })
      expect(res.status, name).toBe(200)
      expect(await count('SELECT entry_fee AS n FROM tournaments WHERE id = ?', event), name).toBe(35)
    }
  })

  it('a creator with no director row who has lost the grant that let them create is refused the event\'s setup, and it is left as it was', async () => {
    const own = await seedClub()
    const rep = await seedMember({ role: 'club_rep', clubId: own })
    const admin = await seedAdmin()
    const made: string[] = []
    // The rep's event is its club's, the admin's LCA-run.
    for (const as of [rep, admin]) {
      const res = await invoke(createTournament, {
        method: 'POST',
        as,
        body: { name: `Creator probe ${++seq}`, location: 'Kenner, LA', date: '2026-12-12', entryFee: 20 },
      })
      expect(res.status).toBe(201)
      made.push((await res.json<{ tournament: { id: string } }>()).tournament.id)
    }
    // While they hold the grant, each manages the event they made.
    for (const [as, event] of [[rep, made[0]], [admin, made[1]]] as const) {
      expect((await invoke(patchTournament, { method: 'PATCH', as, params: { id: event }, body: { venue: 'Hall A' } })).status).toBe(200)
    }
    // A former club rep and a former LCA admin keep nothing on it.
    await env.DB.prepare("UPDATE members SET role = 'member' WHERE id IN (?, ?)").bind(rep, admin).run()
    for (const [as, event] of [[rep, made[0]], [admin, made[1]]] as const) {
      expect(await creatorGrant(env.DB, event, creation.CREATION_ROLES_ON)).toBe('none')
      const res = await invoke(patchTournament, { method: 'PATCH', as, params: { id: event }, body: { venue: 'Hall B' } })
      expect(res.status).toBe(403)
      const row = await env.DB.prepare('SELECT venue FROM tournaments WHERE id = ?').bind(event).first<{ venue: string }>()
      expect(row?.venue).toBe('Hall A')
    }
  })
})
