// test/integration/region-directors.test.ts
//
// A regional representative and the directors of a club event they drafted
// (WS09 checkpoint V's review and the ruling on the check's third finding), through
// the real handlers: GET, POST and DELETE
// /api/admin/tournaments/[id]/directors, GET
// /api/admin/tournaments/[id]/manage and, to approve a draft, POST
// /api/admin/tournaments/[id]/approval. REGION_EVENTS_ON is false in the
// tree; here it is read through a getter on its mocked module.
// - With it set, a representative whose standing on the club is the region
//   alone may not name themselves a director of their own draft: 403 in
//   words and no row. Naming someone else still works. Once the seat ends,
//   the manage page is 403 for the former representative.
// - With it set, on an event marked for approval (every representative's
//   draft, approved or not) only an LCA admin, an observer and the club's own
//   rep read the directors' emails; everyone else, a director named there
//   included, is answered each email as null, in GET directors, in the
//   manage answer and in the POST's and the DELETE's answers. So two
//   representatives who name each other directors read no email on either
//   draft, nor does a member with no seat named on one.
// - With it set, on a club rep's own event, which is not marked, an assigned
//   director reads the emails as before and a representative does not.
// - The statements: no seat is read for a director or the club's own rep on
//   either kind of event; on GET directors each costs one read of the
//   event's club and its mark, and the manage answer costs them nothing more.
// - With it unset, every answer is the base's and no statement names the
//   mark's column.
// Approving emails the person who drafted the event, so both mail switches
// are read through getters on their mocked module, at today's values. Every
// club, region, person and address here is made up.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  NO_SELF_DIRECTOR,
  onRequestDelete as removeDirector,
  onRequestGet as listDirectors,
  onRequestPost as assignDirector,
} from '../../functions/api/admin/tournaments/[id]/directors'
import { onRequestGet as manageGet } from '../../functions/api/admin/tournaments/[id]/manage'
import { onRequestPost as approval } from '../../functions/api/admin/tournaments/[id]/approval'
import { tournamentDirectorsResponseSchema, tournamentManageResponseSchema } from '../../domain/contracts/events'
import { seedAdmin, seedClub, seedMember, seedRegistration, seedTournament, seedTournamentDirector } from './factories'
import { expectContract, invoke, resetHarness, type Aal } from './harness'
import { countingDb, noWaits, type Ran } from './mailRuns'

const flags = vi.hoisted(() => ({ regionOn: false, listsOn: false, sender: 'resend' as 'resend' | 'ses' }))
vi.mock('../../functions/utils/clubs/pages', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/clubs/pages')>()
  return {
    ...real,
    get REGION_EVENTS_ON() {
      return flags.regionOn
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

beforeEach(() => {
  resetHarness()
  flags.regionOn = true
  flags.listsOn = false
  flags.sender = 'resend'
  noWaits()
})
afterEach(() => {
  flags.regionOn = false
  vi.restoreAllMocks()
})

let seq = 0

/** A seat over the region, held by the member. */
async function seatFor(memberId: string, region: string): Promise<string> {
  const seat = `seat-directors-${++seq}`
  await env.DB.prepare("INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active) VALUES (?, 'Example Region Representative', '', 99, ?, 'regional_rep', 1)").bind(seat, seat).run()
  await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(seat, region).run()
  await env.DB.prepare('INSERT INTO board_seat_assignments (id, seat_id, member_id) VALUES (?, ?, ?)').bind(`term-${seat}`, seat, memberId).run()
  return seat
}

/** A club in its own region, with its own rep and the club rep's own event, which is not marked. */
async function clubInRegion() {
  const n = ++seq
  const region = `Example Region ${n}-${crypto.randomUUID().slice(0, 6)}`
  const clubId = await seedClub({ name: `Example Chess Club ${n}` })
  await env.DB.prepare('UPDATE clubs SET region = ? WHERE id = ?').bind(region, clubId).run()
  const ownRep = await seedMember({ role: 'club_rep', clubId, fullName: 'Player One', email: `player.one.${n}@example.org` })
  const repEvent = await seedTournament({ name: `Example Club Quads ${n}`, clubId, createdBy: ownRep })
  return { n, region, clubId, ownRep, repEvent }
}

/** A representative's draft of the club, marked for approval as the representative's create writes it. */
async function draftOf(clubId: string, createdBy: string): Promise<string> {
  const id = await seedTournament({ name: `Example Winter Open ${++seq}`, date: '2026-12-12', clubId, createdBy, entryFee: 0, sections: [{ name: 'Open', entryFee: 0 }], isVisible: false })
  await env.DB.prepare('UPDATE tournaments SET needs_lca_approval = 1 WHERE id = ?').bind(id).run()
  return id
}

/** A club in its own region with its own rep, the region's representative (a plain member) with a seat, an entrant of the rep's event, the representative's draft and an LCA admin. */
async function example() {
  const { n, region, clubId, ownRep, repEvent } = await clubInRegion()
  const representative = await seedMember({ fullName: 'Player Two', email: `player.two.${n}@example.org` })
  const seat = await seatFor(representative, region)
  const entrantEmail = `player.three.${n}@example.org`
  const entrant = await seedMember({ fullName: 'Player Three', email: entrantEmail })
  await seedRegistration({ tournamentId: repEvent, memberId: entrant })
  const draft = await draftOf(clubId, representative)
  return { seat, ownRep, representative, entrant, entrantEmail, repEvent, draft, admin: await seedAdmin() }
}

/**
 * Two plain-member representatives of one region, each with a seat and a
 * draft; a third member with no seat; a fourth with no seat, for the club
 * rep's own event; the club's own rep and an LCA admin.
 */
async function twoRepresentatives() {
  const { n, region, clubId, ownRep, repEvent } = await clubInRegion()
  const first = await seedMember({ fullName: 'Player Two', email: `player.two.${n}@example.org` })
  const second = await seedMember({ fullName: 'Player Four', email: `player.four.${n}@example.org` })
  await seatFor(first, region)
  await seatFor(second, region)
  const third = await seedMember({ fullName: 'Player Three', email: `player.three.${n}@example.org` })
  const helper = await seedMember({ fullName: 'Player Five', email: `player.five.${n}@example.org` })
  return {
    ownRep, repEvent, first, second, third, helper,
    firstDraft: await draftOf(clubId, first),
    secondDraft: await draftOf(clubId, second),
    admin: await seedAdmin(),
    email: {
      [first]: `player.two.${n}@example.org`,
      [second]: `player.four.${n}@example.org`,
      [third]: `player.three.${n}@example.org`,
      [helper]: `player.five.${n}@example.org`,
    } as Record<string, string>,
  }
}

const aalFor = (who: string, admin: string): Aal => (who === admin ? 'aal2' : 'aal1')
const withDb = (db?: D1Database) => (db ? { env: { DB: db } } : {})
const name = (as: string, id: string, memberId: string, aal: Aal = 'aal1', db?: D1Database) =>
  invoke(assignDirector, { method: 'POST', as, aal, params: { id }, body: { memberId }, ...withDb(db) })
const unname = (as: string, id: string, memberId: string, aal: Aal = 'aal1', db?: D1Database) =>
  invoke(removeDirector, { method: 'DELETE', as, aal, params: { id }, body: { memberId }, ...withDb(db) })
const list = (as: string, id: string, aal: Aal = 'aal1', db?: D1Database) =>
  invoke(listDirectors, { as, aal, params: { id }, ...withDb(db) })
const manage = (as: string, id: string, aal: Aal = 'aal1', db?: D1Database) =>
  invoke(manageGet, { as, aal, params: { id }, ...withDb(db) })
const rowsOn = async (id: string) => (await env.DB.prepare('SELECT member_id FROM tournament_directors WHERE tournament_id = ? ORDER BY member_id').bind(id).all<{ member_id: string }>()).results.map((r) => r.member_id)
const emails = (directors: Array<{ email: string | null }>) => directors.map((d) => d.email)
const statements = (ran: Ran[]) => ran.map((r) => r.sql)
const readsASeat = (ran: Ran[]) => statements(ran).filter((sql) => /seat_regions|board_seat_assignments/.test(sql))

/** The one read GET directors adds, while REGION_EVENTS_ON is set, for a caller who is not an LCA admin or an observer. */
const EVENT_READ = 'SELECT club_id, needs_lca_approval FROM tournaments WHERE id = ?'
/** The directors' list, the base's own statement. */
const BASE_LIST_SQL = `SELECT td.tournament_id, td.member_id, td.assigned_at, m.full_name, m.email
     FROM tournament_directors td
     JOIN members m ON m.id = td.member_id
     WHERE td.tournament_id = ?`

/** Every director's email in GET directors and in the manage answer, for the person on the event. */
async function emailsSeen(who: string, id: string, admin: string) {
  const aal = aalFor(who, admin)
  const listed = await expectContract(await list(who, id, aal), tournamentDirectorsResponseSchema)
  const managed = await expectContract(await manage(who, id, aal), tournamentManageResponseSchema)
  return { list: emails(listed.directors), manage: emails(managed.directors) }
}

describe('with REGION_EVENTS_ON set, a representative naming themselves', () => {
  it('is refused with 403 in words on their own draft, and no row is written', async () => {
    const p = await example()
    const res = await name(p.representative, p.draft, p.representative)
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: NO_SELF_DIRECTOR })
    expect(await rowsOn(p.draft)).toEqual([])
  })

  it('names someone else, and once the seat ends the manage page is 403 for the former representative', async () => {
    const p = await example()
    expect((await name(p.representative, p.draft, p.entrant)).status).toBe(201)
    expect(await rowsOn(p.draft)).toEqual([p.entrant])
    expect((await manage(p.representative, p.draft)).status).toBe(200)
    await env.DB.prepare("UPDATE board_seat_assignments SET ended_at = datetime('now') WHERE seat_id = ?").bind(p.seat).run()
    expect((await manage(p.representative, p.draft)).status).toBe(403)
    expect((await list(p.representative, p.draft)).status).toBe(403)
  })

  it('leaves the club\'s own rep and an LCA admin today\'s rule: each may name themselves on the draft', async () => {
    const p = await example()
    expect((await name(p.ownRep, p.draft, p.ownRep)).status).toBe(201)
    expect((await name(p.admin, p.draft, p.admin, 'aal2')).status).toBe(201)
    expect(await rowsOn(p.draft)).toEqual([p.admin, p.ownRep].sort())
  })
})

describe('with REGION_EVENTS_ON set, the directors\' emails', () => {
  it('are not given to a plain-member representative who names an entrant of a club rep\'s event on their own draft', async () => {
    const p = await example()
    const roster = await (await manage(p.representative, p.repEvent)).json<{ roster: Array<{ member_id: string }> }>()
    expect(roster.roster.map((r) => r.member_id)).toEqual([p.entrant])

    const naming = await name(p.representative, p.draft, p.entrant)
    expect(naming.status).toBe(201)
    const named = await expectContract(naming, tournamentDirectorsResponseSchema)
    expect(emails(named.directors)).toEqual([null])
    const listed = await expectContract(await list(p.representative, p.draft), tournamentDirectorsResponseSchema)
    expect(emails(listed.directors)).toEqual([null])
    const managed = await expectContract(await manage(p.representative, p.draft), tournamentManageResponseSchema)
    expect(managed.directors).toEqual([{ member_id: p.entrant, full_name: 'Player Three', email: null }])
    const removed = await expectContract(await unname(p.representative, p.draft, p.entrant), tournamentDirectorsResponseSchema)
    expect(removed.directors).toEqual([])
    for (const text of [JSON.stringify(named), JSON.stringify(listed), JSON.stringify(managed)]) expect(text).not.toContain(p.entrantEmail)
  })

  it('are read by the club\'s own rep and an LCA admin on the same event', async () => {
    const p = await example()
    expect((await name(p.representative, p.draft, p.entrant)).status).toBe(201)
    for (const who of [p.ownRep, p.admin]) {
      expect(await emailsSeen(who, p.draft, p.admin), who).toEqual({ list: [p.entrantEmail], manage: [p.entrantEmail] })
    }
  })
})

describe('with REGION_EVENTS_ON set, on an event marked for approval', () => {
  it('two representatives who name each other directors read no director\'s email on either draft, in any of the answers', async () => {
    const p = await twoRepresentatives()
    const answers: unknown[] = []
    const named = async (as: string, id: string, memberId: string) => {
      const res = await name(as, id, memberId)
      expect(res.status, `${as} names ${memberId}`).toBe(201)
      const body = await expectContract(res, tournamentDirectorsResponseSchema)
      expect(emails(body.directors).every((e) => e === null), `${as} names ${memberId}`).toBe(true)
      answers.push(body)
    }
    await named(p.first, p.firstDraft, p.second)
    await named(p.second, p.secondDraft, p.first)
    await named(p.first, p.firstDraft, p.third)
    expect(await rowsOn(p.firstDraft)).toEqual([p.second, p.third].sort())
    expect(await rowsOn(p.secondDraft)).toEqual([p.first])

    for (const who of [p.first, p.second]) {
      for (const [id, count] of [[p.firstDraft, 2], [p.secondDraft, 1]] as const) {
        const listed = await expectContract(await list(who, id), tournamentDirectorsResponseSchema)
        const managed = await expectContract(await manage(who, id), tournamentManageResponseSchema)
        expect(emails(listed.directors), `${who} on ${id}`).toEqual(Array(count).fill(null))
        expect(emails(managed.directors), `${who} on ${id}`).toEqual(Array(count).fill(null))
        answers.push(listed, managed)
      }
    }
    const removing = await unname(p.first, p.firstDraft, p.third)
    expect(removing.status).toBe(200)
    const removed = await expectContract(removing, tournamentDirectorsResponseSchema)
    expect(removed.directors).toEqual([expect.objectContaining({ member_id: p.second, email: null })])
    answers.push(removed)
    const text = JSON.stringify(answers)
    for (const address of Object.values(p.email)) expect(text).not.toContain(address)
  })

  it('a member with no seat named a director of a representative\'s draft reads no director\'s email there', async () => {
    const p = await twoRepresentatives()
    expect((await name(p.first, p.firstDraft, p.third)).status).toBe(201)
    expect((await name(p.first, p.firstDraft, p.second)).status).toBe(201)
    expect(await emailsSeen(p.third, p.firstDraft, p.admin)).toEqual({ list: [null, null], manage: [null, null] })
  })

  it('the club\'s own rep and an LCA admin read every email on the same drafts', async () => {
    const p = await twoRepresentatives()
    expect((await name(p.first, p.firstDraft, p.second)).status).toBe(201)
    expect((await name(p.second, p.secondDraft, p.first)).status).toBe(201)
    expect((await name(p.first, p.firstDraft, p.third)).status).toBe(201)
    for (const who of [p.ownRep, p.admin]) {
      const first = await emailsSeen(who, p.firstDraft, p.admin)
      expect([...first.list].sort(), who).toEqual([p.email[p.second], p.email[p.third]].sort())
      expect([...first.manage].sort(), who).toEqual([p.email[p.second], p.email[p.third]].sort())
      expect(await emailsSeen(who, p.secondDraft, p.admin), who).toEqual({ list: [p.email[p.first]], manage: [p.email[p.first]] })
    }
    // Their own namings and removals answer the emails too.
    const byRep = await expectContract(await name(p.ownRep, p.firstDraft, p.helper), tournamentDirectorsResponseSchema)
    expect(emails(byRep.directors)).not.toContain(null)
    const byAdmin = await expectContract(await unname(p.admin, p.firstDraft, p.helper, 'aal2'), tournamentDirectorsResponseSchema)
    expect(emails(byAdmin.directors)).not.toContain(null)
  })

  it('still holds once an LCA admin approves the draft: the mark stays 1', async () => {
    const p = await twoRepresentatives()
    expect((await name(p.first, p.firstDraft, p.second)).status).toBe(201)
    expect((await name(p.first, p.firstDraft, p.third)).status).toBe(201)
    const approved = await invoke(approval, { method: 'POST', as: p.admin, aal: 'aal2', params: { id: p.firstDraft }, body: { action: 'approve' } })
    expect(approved.status).toBe(200)
    expect(await env.DB.prepare('SELECT needs_lca_approval, approved_at IS NOT NULL AS approved FROM tournaments WHERE id = ?').bind(p.firstDraft).first())
      .toEqual({ needs_lca_approval: 1, approved: 1 })
    for (const who of [p.first, p.second, p.third]) {
      expect(await emailsSeen(who, p.firstDraft, p.admin), who).toEqual({ list: [null, null], manage: [null, null] })
    }
    for (const who of [p.ownRep, p.admin]) {
      const seen = await emailsSeen(who, p.firstDraft, p.admin)
      expect([...seen.list].sort(), who).toEqual([p.email[p.second], p.email[p.third]].sort())
    }
  })
})

describe('with REGION_EVENTS_ON set, on a club rep\'s own event, which is not marked', () => {
  it('an assigned director reads the emails as before and a representative does not', async () => {
    const p = await twoRepresentatives()
    expect((await name(p.ownRep, p.repEvent, p.helper)).status).toBe(201)
    expect(await emailsSeen(p.helper, p.repEvent, p.admin)).toEqual({ list: [p.email[p.helper]], manage: [p.email[p.helper]] })
    expect(await emailsSeen(p.first, p.repEvent, p.admin)).toEqual({ list: [null], manage: [null] })
  })
})

describe('with REGION_EVENTS_ON set, the statements', () => {
  it('read no seat for a director or the club\'s own rep on either kind of event, and cost each one read more than the base, on GET directors alone', async () => {
    const p = await twoRepresentatives()
    expect((await name(p.first, p.firstDraft, p.third)).status).toBe(201)
    await seedTournamentDirector(p.repEvent, p.helper)
    const cases = [
      ['a director on a marked event', p.third, p.firstDraft],
      ['the club\'s own rep on a marked event', p.ownRep, p.firstDraft],
      ['a director on an event not marked', p.helper, p.repEvent],
      ['the club\'s own rep on an event not marked', p.ownRep, p.repEvent],
    ] as const
    for (const [label, who, id] of cases) {
      const reading = async () => {
        const onList = countingDb()
        expect((await list(who, id, 'aal1', onList.db)).status, label).toBe(200)
        const onManage = countingDb()
        expect((await manage(who, id, 'aal1', onManage.db)).status, label).toBe(200)
        return { list: onList.ran, manage: onManage.ran }
      }
      flags.regionOn = false
      const unset = await reading()
      flags.regionOn = true
      const set = await reading()
      expect([...readsASeat(set.list), ...readsASeat(set.manage)], label).toEqual([])
      // The base's statements, then the one read of the event's club and its mark after the directors' list.
      expect(statements(unset.list).at(-1), label).toBe(BASE_LIST_SQL)
      expect(statements(set.list), label).toEqual([...statements(unset.list), EVENT_READ])
      // The manage answer reads the mark from the event row it already loads: not one statement more.
      expect(statements(set.manage), label).toEqual(statements(unset.manage))
    }
  })

  it('answer the club\'s own rep\'s naming without a read of the mark, and a representative\'s with that one read', async () => {
    const p = await twoRepresentatives()
    const MARK_READ = 'SELECT needs_lca_approval FROM tournaments WHERE id = ?'
    const byRep = countingDb()
    expect((await name(p.ownRep, p.firstDraft, p.helper, 'aal1', byRep.db)).status).toBe(201)
    expect(statements(byRep.ran)).not.toContain(MARK_READ)
    expect(statements(byRep.ran).at(-1)).toBe(BASE_LIST_SQL)
    const byRepresentative = countingDb()
    expect((await name(p.first, p.firstDraft, p.third, 'aal1', byRepresentative.db)).status).toBe(201)
    expect(statements(byRepresentative.ran).slice(-2)).toEqual([BASE_LIST_SQL, MARK_READ])
    const byAdmin = countingDb()
    expect((await unname(p.admin, p.firstDraft, p.third, 'aal2', byAdmin.db)).status).toBe(200)
    expect(statements(byAdmin.ran).at(-1)).toBe(BASE_LIST_SQL)
    expect(statements(byAdmin.ran).filter((sql) => sql.includes('needs_lca_approval'))).toEqual([])
  })
})

describe('with REGION_EVENTS_ON unset', () => {
  it('gives every caller the emails, and costs an LCA admin and the club\'s own rep no read more than with it set', async () => {
    const p = await example()
    expect((await name(p.ownRep, p.draft, p.entrant)).status).toBe(201)
    flags.regionOn = false
    for (const who of [p.ownRep, p.admin]) {
      const aal = aalFor(who, p.admin)
      const offList = countingDb()
      const listed = await (await list(who, p.draft, aal, offList.db)).json<{ directors: Array<{ email: string | null }> }>()
      expect(emails(listed.directors), who).toEqual([p.entrantEmail])
      const offManage = countingDb()
      const managed = await (await manage(who, p.draft, aal, offManage.db)).json<{ directors: Array<{ email: string | null }> }>()
      expect(emails(managed.directors), who).toEqual([p.entrantEmail])
      // The directors' read is the last statement of each, as before: nothing is read after it to decide on the emails.
      expect(offList.ran.at(-1)?.sql, who).toContain('SELECT td.tournament_id, td.member_id')
      expect(offManage.ran.at(-1)?.sql, who).toContain('SELECT td.member_id, m.full_name, m.email')
    }
    // The list is the base's byte for byte, built here from the base's own statement.
    const baseRows = (await env.DB.prepare(BASE_LIST_SQL).bind(p.draft).all()).results
    expect(await (await list(p.ownRep, p.draft)).response.text()).toBe(JSON.stringify({ directors: baseRows }))
    // An LCA admin's answers read the same statements whichever way the constant is.
    const off = countingDb()
    await list(p.admin, p.draft, 'aal2', off.db)
    await manage(p.admin, p.draft, 'aal2', off.db)
    flags.regionOn = true
    const on = countingDb()
    await list(p.admin, p.draft, 'aal2', on.db)
    await manage(p.admin, p.draft, 'aal2', on.db)
    expect(on.ran.map((r) => r.sql)).toEqual(off.ran.map((r) => r.sql))
  })

  it('answers each person on both drafts and the club rep\'s own event as the base does, and no statement names the mark', async () => {
    const p = await twoRepresentatives()
    expect((await name(p.first, p.firstDraft, p.second)).status).toBe(201)
    expect((await name(p.second, p.secondDraft, p.first)).status).toBe(201)
    expect((await name(p.first, p.firstDraft, p.third)).status).toBe(201)
    expect((await name(p.ownRep, p.repEvent, p.helper)).status).toBe(201)
    flags.regionOn = false
    const ran: Ran[] = []
    const count = () => {
      const counted = countingDb()
      return { db: counted.db, done: () => ran.push(...counted.ran) }
    }
    const people = [p.first, p.second, p.third, p.helper, p.ownRep, p.admin]
    for (const id of [p.firstDraft, p.secondDraft, p.repEvent]) {
      const baseRows = (await env.DB.prepare(BASE_LIST_SQL).bind(id).all()).results
      const baseManage = (await env.DB.prepare('SELECT td.member_id, m.full_name, m.email FROM tournament_directors td JOIN members m ON m.id = td.member_id WHERE td.tournament_id = ?').bind(id).all()).results
      const directors = baseRows.map((r) => String(r.member_id))
      for (const who of people) {
        // With the constant unset the base lets in an LCA admin, the club's own rep and the event's own directors.
        const allowed = who === p.admin || who === p.ownRep || directors.includes(who)
        const aal = aalFor(who, p.admin)
        const onList = count()
        const listed = await list(who, id, aal, onList.db)
        onList.done()
        expect(listed.status, `${who} on ${id}`).toBe(allowed ? 200 : 403)
        const onManage = count()
        const managed = await manage(who, id, aal, onManage.db)
        onManage.done()
        expect(managed.status, `${who} on ${id}`).toBe(allowed ? 200 : 403)
        if (!allowed) continue
        expect(await listed.response.text(), `${who} on ${id}`).toBe(JSON.stringify({ directors: baseRows }))
        expect((await managed.json<{ directors: unknown[] }>()).directors, `${who} on ${id}`).toEqual(baseManage)
      }
    }
    // The namings' answers, by the club's own rep and an LCA admin, the only ones the base lets name.
    const naming = count()
    const byRep = await name(p.ownRep, p.firstDraft, p.helper, 'aal1', naming.db)
    naming.done()
    expect(await byRep.response.text()).toBe(JSON.stringify({ directors: (await env.DB.prepare(BASE_LIST_SQL).bind(p.firstDraft).all()).results }))
    const removing = count()
    const byAdmin = await unname(p.admin, p.firstDraft, p.helper, 'aal2', removing.db)
    removing.done()
    expect(await byAdmin.response.text()).toBe(JSON.stringify({ directors: (await env.DB.prepare(BASE_LIST_SQL).bind(p.firstDraft).all()).results }))
    expect(ran.length).toBeGreaterThan(0)
    expect(statements(ran).filter((sql) => sql.includes('needs_lca_approval'))).toEqual([])
  })
})
