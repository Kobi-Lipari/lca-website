// test/integration/first-director.test.ts
//
// The creator as the event's first director (WS08 step 3: criterion 12 of
// brief 1.4's WS08 section, D20, and the brief's "The creator runs the event
// as its first director"). With CREATION_ROLES_ON set:
// - the row the create writes for a standing director and for the president
//   is a director's row like any other: assigned when the event is made,
//   listed among the event's directors, and read by the rating report, which
//   suggests the creator as its chief TD;
// - the creator runs the event by that row (the setup save, the manage
//   answer with its entrants, an entry's cash payment and the rating
//   report), the president as well whatever their role, while another
//   standing director and a plain member are refused with the plain
//   "Forbidden" and none of the event's data, and a signed-out visitor
//   gets 401;
// - the hidden draft is listed for its creator, with the keys only an
//   event's managers get, and its page answers the creator, while a
//   visitor, a plain member, another standing director and a club rep
//   neither list it nor open it;
// - the row stays until an LCA admin removes it, so a standing director who
//   loses the role and a president whose term ends keep the event they
//   direct, as any director does, and keep nothing once it is removed;
// - the row goes in the create's own batch, after the event's insert: a
//   batch that fails leaves neither the event nor the row, and two creates
//   at once give two events, each with its creator as its one director.
// CREATION_ROLES_ON is false in the tree. It is read here through a getter on
// the mocked module, set for every case, and put back after each.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { onRequestPost as createTournament } from '../../functions/api/admin/tournaments'
import { onRequestPatch as patchTournament } from '../../functions/api/admin/tournaments/[id]'
import { onRequestGet as getManage } from '../../functions/api/admin/tournaments/[id]/manage'
import { onRequestGet as getRatingReport } from '../../functions/api/admin/tournaments/[id]/rating-report'
import { onRequestDelete as removeDirector, onRequestGet as listDirectors } from '../../functions/api/admin/tournaments/[id]/directors'
import { onRequestPatch as patchRegistration } from '../../functions/api/registrations/[id]'
import { onRequestGet as listTournaments } from '../../functions/api/tournaments'
import { onRequestGet as getTournament } from '../../functions/api/tournaments/[id]'
import { seedAdmin, seedClub, seedMember, seedPresident, seedRegistration } from './factories'
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

beforeEach(() => {
  resetHarness()
  flags.rolesOn = true
})
afterEach(() => {
  flags.rolesOn = false
  vi.restoreAllMocks()
})

let seq = 0

const create = async (as: string, extra: Record<string, unknown> = {}) => {
  const res = await invoke(createTournament, {
    method: 'POST',
    as,
    body: { name: `First director probe ${++seq}`, location: 'Lafayette, LA', date: '2026-12-05', entryFee: 20, ...extra },
  })
  return res
}
const createdId = async (as: string, extra: Record<string, unknown> = {}) => {
  const res = await create(as, extra)
  expect(res.status).toBe(201)
  return (await res.json<{ tournament: { id: string } }>()).tournament.id
}

async function directorRows(tournamentId: string) {
  return (await env.DB.prepare('SELECT tournament_id, member_id, assigned_at FROM tournament_directors WHERE tournament_id = ? ORDER BY member_id')
    .bind(tournamentId).all<{ tournament_id: string; member_id: string; assigned_at: string | null }>()).results
}

async function paymentOf(registrationId: string): Promise<string | undefined> {
  return (await env.DB.prepare('SELECT payment_status FROM registrations WHERE id = ?').bind(registrationId).first<{ payment_status: string }>())?.payment_status
}

async function nameOf(tournamentId: string): Promise<string | undefined> {
  return (await env.DB.prepare('SELECT name FROM tournaments WHERE id = ?').bind(tournamentId).first<{ name: string }>())?.name
}

/** The president as the brief keeps the role, an LCA observer with a current term on the President seat, or another role holding it. */
async function seatedMember(role = 'lca_observer', extra: { uscfId?: string; fullName?: string } = {}): Promise<string> {
  const id = await seedMember({ role, ...extra })
  await seedPresident(id)
  return id
}

/** What a person gets from the event's four running endpoints, each status with its body. */
async function runs(as: string | undefined, event: string, entry: string, paymentStatus: 'paid' | 'pending') {
  const opts = as ? { as } : {}
  const save = await invoke(patchTournament, { method: 'PATCH', ...opts, params: { id: event }, body: { venue: `Hall ${++seq}` } })
  const manage = await invoke(getManage, { ...opts, params: { id: event } })
  const payment = await invoke(patchRegistration, { method: 'PATCH', ...opts, params: { id: entry }, body: { paymentStatus } })
  const report = await invoke(getRatingReport, { ...opts, params: { id: event } })
  return { save, manage, payment, report }
}

describe('the first director row is a director\'s row like any other (criterion 12, D20)', () => {
  it('a standing director\'s row is assigned when the event is made, listed among its directors, and suggested as the rating report\'s chief TD', async () => {
    const director = await seedMember({ role: 'tournament_director', uscfId: `3${String(++seq).padStart(7, '0')}`, fullName: 'Avery Thibodeaux' })
    const event = await createdId(director)
    const rows = await directorRows(event)
    expect(rows).toEqual([{ tournament_id: event, member_id: director, assigned_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/) }])

    for (const as of [await seedAdmin(), director]) {
      const listed = await invoke(listDirectors, { as, params: { id: event } })
      expect(listed.status).toBe(200)
      const { directors } = await listed.json<{ directors: Array<{ member_id: string; full_name: string }> }>()
      expect(directors.map((d) => [d.member_id, d.full_name])).toEqual([[director, 'Avery Thibodeaux']])
    }

    const report = await invoke(getRatingReport, { as: director, params: { id: event } })
    expect(report.status).toBe(200)
    const { upload } = await report.json<{ upload: { suggested: { chiefTdId: string; chiefTdName: string } } }>()
    const usChessId = (await env.DB.prepare('SELECT uscf_id FROM members WHERE id = ?').bind(director).first<{ uscf_id: string }>())?.uscf_id
    expect(upload.suggested).toMatchObject({ chiefTdId: usChessId, chiefTdName: 'Avery Thibodeaux' })
  })

  it('the president\'s row is the same, and an LCA admin\'s and a club rep\'s create leave the rating report with no chief TD to suggest', async () => {
    const president = await seatedMember('lca_observer', { uscfId: `4${String(++seq).padStart(7, '0')}`, fullName: 'Rene Broussard' })
    const event = await createdId(president)
    expect((await directorRows(event)).map((r) => r.member_id)).toEqual([president])
    const report = await invoke(getRatingReport, { as: president, params: { id: event } })
    expect((await report.json<{ upload: { suggested: { chiefTdName: string } } }>()).upload.suggested.chiefTdName).toBe('Rene Broussard')

    const club = await seedClub()
    for (const as of [await seedMember({ role: 'lca_admin', uscfId: `5${String(++seq).padStart(7, '0')}` }), await seedMember({ role: 'club_rep', clubId: club, uscfId: `6${String(++seq).padStart(7, '0')}` })]) {
      const made = await createdId(as)
      expect(await directorRows(made)).toEqual([])
      const answer = await invoke(getRatingReport, { as, params: { id: made } })
      expect(answer.status).toBe(200)
      expect((await answer.json<{ upload: { suggested: { chiefTdId: string; chiefTdName: string } } }>()).upload.suggested).toMatchObject({ chiefTdId: '', chiefTdName: '' })
    }
  })
})

describe('the creator runs the event by the row, and no one else does (criterion 12, role safety)', () => {
  it.each([
    ['a standing director', 'tournament_director', false],
    ['the president, an LCA observer who holds the seat', 'lca_observer', true],
    ['the president, a member who holds the seat', 'member', true],
  ] as const)('%s saves the setup, reads the manage answer with its entrants, records cash and reads the rating report', async (_who, role, seat) => {
    const creator = seat ? await seatedMember(role) : await seedMember({ role })
    const event = await createdId(creator)
    const player = await seedMember({ fullName: 'Jordan Fontenot' })
    const entry = await seedRegistration({ tournamentId: event, memberId: player, paymentStatus: 'pending' })

    const { save, manage, payment, report } = await runs(creator, event, entry, 'paid')
    expect([save.status, manage.status, payment.status, report.status]).toEqual([200, 200, 200, 200])
    const { roster } = await manage.json<{ roster: Array<{ registration_id: string; full_name: string }> }>()
    expect(roster.map((r) => [r.registration_id, r.full_name])).toEqual([[entry, 'Jordan Fontenot']])
    expect(await paymentOf(entry)).toBe('paid')
  })

  it('another standing director and a plain member are refused with the plain "Forbidden" and get none of the event, and a visitor gets 401', async () => {
    const creator = await seedMember({ role: 'tournament_director' })
    const event = await createdId(creator)
    const entry = await seedRegistration({ tournamentId: event, memberId: await seedMember(), paymentStatus: 'paid' })
    const name = await nameOf(event)

    for (const [who, as] of [['another standing director', await seedMember({ role: 'tournament_director' })], ['a plain member', await seedMember()]] as const) {
      const { save, manage, payment, report } = await runs(as, event, entry, 'pending')
      for (const [what, res] of [['the setup save', save], ['the manage answer', manage], ['the payment change', payment], ['the rating report', report]] as const) {
        expect(res.status, `${who}, ${what}`).toBe(403)
        expect(await res.json(), `${who}, ${what}`).toEqual({ error: 'Forbidden' })
      }
      const listed = await invoke(listDirectors, { as, params: { id: event } })
      expect(listed.status, who).toBe(403)
      expect(await listed.json(), who).toEqual({ error: 'Forbidden' })
    }
    const visitor = await runs(undefined, event, entry, 'pending')
    for (const res of [visitor.save, visitor.manage, visitor.payment, visitor.report]) expect(res.status).toBe(401)
    expect(await nameOf(event)).toBe(name)
    expect(await paymentOf(entry)).toBe('paid')
  })
})

describe('the hidden draft is listed for its creator alone among those who could not see it before', () => {
  it('a standing director lists its draft with the keys an event\'s managers get and opens its page; a visitor, a member, another standing director and a club rep do neither', async () => {
    const creator = await seedMember({ role: 'tournament_director' })
    const event = await createdId(creator)
    const listedFor = async (as?: string) => {
      const res = await invoke(listTournaments, as ? { as } : {})
      expect(res.status).toBe(200)
      return (await res.json<{ tournaments: Array<Record<string, unknown>> }>()).tournaments.filter((t) => t.id === event)
    }

    const own = await listedFor(creator)
    expect(own).toHaveLength(1)
    expect(own[0]).toMatchObject({ id: event, is_visible: 0, club_id: null, created_by: creator })
    const page = await invoke(getTournament, { as: creator, params: { id: event } })
    expect(page.status).toBe(200)

    const club = await seedClub()
    const others: ReadonlyArray<readonly [string, string | undefined]> = [
      ['a signed-out visitor', undefined],
      ['a plain member', await seedMember()],
      ['another standing director', await seedMember({ role: 'tournament_director' })],
      ['a club rep', await seedMember({ role: 'club_rep', clubId: club })],
    ]
    for (const [who, as] of others) {
      expect(await listedFor(as), who).toEqual([])
      const res = await invoke(getTournament, { ...(as ? { as } : {}), params: { id: event } })
      expect(res.status, who).toBe(404)
      expect(await res.json(), who).toEqual({ error: 'Tournament not found' })
    }
  })
})

describe('the row stays until an LCA admin removes it', () => {
  it('a standing director who loses the role keeps the event it directs, as any director does, and keeps nothing once an LCA admin removes the row', async () => {
    const creator = await seedMember({ role: 'tournament_director' })
    const event = await createdId(creator)
    const entry = await seedRegistration({ tournamentId: event, memberId: await seedMember(), paymentStatus: 'pending' })
    await env.DB.prepare("UPDATE members SET role = 'member' WHERE id = ?").bind(creator).run()

    const kept = await runs(creator, event, entry, 'paid')
    expect([kept.save.status, kept.manage.status, kept.payment.status, kept.report.status]).toEqual([200, 200, 200, 200])

    const removed = await invoke(removeDirector, { method: 'DELETE', as: await seedAdmin(), params: { id: event }, body: { memberId: creator } })
    expect(removed.status).toBe(200)
    expect(await directorRows(event)).toEqual([])
    const after = await runs(creator, event, entry, 'pending')
    for (const res of [after.save, after.manage, after.payment, after.report]) {
      expect(res.status).toBe(403)
      expect(await res.json()).toEqual({ error: 'Forbidden' })
    }
    expect(await paymentOf(entry)).toBe('paid')
  })

  it('a president whose term on the seat ends keeps the event it directs, and is refused a new one', async () => {
    const president = await seatedMember('member')
    const event = await createdId(president)
    await env.DB.prepare("UPDATE board_seat_assignments SET ended_at = datetime('now') WHERE member_id = ? AND ended_at IS NULL").bind(president).run()
    const entry = await seedRegistration({ tournamentId: event, memberId: await seedMember(), paymentStatus: 'pending' })

    const kept = await runs(president, event, entry, 'paid')
    expect([kept.save.status, kept.manage.status, kept.payment.status, kept.report.status]).toEqual([200, 200, 200, 200])
    const refused = await create(president)
    expect(refused.status).toBe(403)
    expect(await refused.json()).toEqual({ error: 'Forbidden' })
  })
})

describe('the row goes in the create\'s own batch', () => {
  it('a batch that fails after the event\'s insert leaves neither the event nor the row', async () => {
    const creator = await seedMember({ role: 'tournament_director' })
    const name = `Batch probe ${++seq}`
    // A section of this name makes the batch fail at its section rows, after the event and the director row went in.
    await env.DB.prepare(
      "CREATE TRIGGER first_director_probe BEFORE INSERT ON tournament_sections WHEN NEW.name = 'Batch probe section' BEGIN SELECT RAISE(ABORT, 'batch probe'); END",
    ).run()
    try {
      await expect(invoke(createTournament, {
        method: 'POST', as: creator, body: { name, location: 'Lafayette, LA', date: '2026-12-05', entryFee: 0, sections: [{ name: 'Batch probe section', entryFee: 0 }] },
      })).rejects.toThrow(/batch probe/)
    } finally {
      await env.DB.prepare('DROP TRIGGER IF EXISTS first_director_probe').run()
    }
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM tournaments WHERE name = ?').bind(name).first<{ n: number }>()).toEqual({ n: 0 })
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM tournament_directors WHERE member_id = ?').bind(creator).first<{ n: number }>()).toEqual({ n: 0 })
    // With the trigger gone, the same request creates the event and its row.
    const event = await createdId(creator, { sections: [{ name: 'Batch probe section', entryFee: 0 }] })
    expect((await directorRows(event)).map((r) => r.member_id)).toEqual([creator])
  })

  it('two creates at once by one standing director give two events, each with the creator as its one director', async () => {
    const creator = await seedMember({ role: 'tournament_director' })
    const [first, second] = await Promise.all([create(creator), create(creator)])
    expect([first.status, second.status]).toEqual([201, 201])
    const ids = [
      (await first.json<{ tournament: { id: string } }>()).tournament.id,
      (await second.json<{ tournament: { id: string } }>()).tournament.id,
    ]
    expect(new Set(ids).size).toBe(2)
    for (const id of ids) expect((await directorRows(id)).map((r) => r.member_id)).toEqual([creator])
  })
})
