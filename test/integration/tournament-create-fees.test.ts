// test/integration/tournament-create-fees.test.ts
//
// POST /api/admin/tournaments after WS08 step 4, past the cases of
// test/integration/tournament-create.test.ts:
//   1. The fee check reads the list the create hands the section writer
//      through savedSectionFees, each section as the writer stores it: a free
//      section's own early price, sections copied from another event's
//      answer, whose fees carry the regular price and set nothing, a bare
//      name and a fee that is not a number, each at the event's fee, and the
//      default Open section a create with no sections gets. canChargeFees is
//      made to refuse for the cases that need a refusal, since every grant
//      that may create is on D24's list in this phase; and it is asked about
//      the event being made, its club and its creator, only when the list
//      sets a price above $0.
//   2. An empty club id is no club for every creator, in both states: a club
//      rep's create is its own club's, as before; the president's, with the
//      constant set, is LCA-run with its first director row; an LCA admin's
//      that asks for no membership requirement is refused as any LCA-run
//      event's is; and everyone the create refuses is refused as before,
//      nothing written.
// CREATION_ROLES_ON is false in the tree. It is read here through a getter on
// the mocked module, as test/integration/tournament-create.test.ts reads it,
// and canChargeFees through a wrapper on the mocked rules module, which asks
// the real rule unless a case makes it refuse.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FEES_NEED_PAYOUT_ACCOUNT } from '../../domain/events/creation'
import { LCA_RUN_NEEDS_MEMBERSHIP } from '../../domain/membership/requirement'
import { onRequestPost as createTournament } from '../../functions/api/admin/tournaments'
import { seedAdmin, seedClub, seedDirector, seedMember, seedPresident } from './factories'
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

/** What the create asked canChargeFees, and whether a case makes it refuse. */
const fees = vi.hoisted(() => ({
  refuse: false,
  asked: [] as Array<{ grant: string; event: { clubId: string | null; createdBy: string | null }; rolesOn: boolean }>,
}))
vi.mock('../../domain/events/creation', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../domain/events/creation')>()
  return {
    ...real,
    canChargeFees: (...args: Parameters<typeof real.canChargeFees>) => {
      const [person, event, rolesOn] = args
      fees.asked.push({ grant: person.grant, event: { clubId: event.clubId, createdBy: event.createdBy }, rolesOn })
      return !fees.refuse && real.canChargeFees(...args)
    },
  }
})

beforeEach(() => {
  resetHarness()
  fees.asked.length = 0
})
afterEach(() => {
  flags.rolesOn = false
  fees.refuse = false
})

/** The two states of CREATION_ROLES_ON, for the cases that run in both. */
const STATES: ReadonlyArray<readonly [string, boolean]> = [['unset', false], ['set', true]]

let seq = 0
/** A create's body: a new name each time, so no two creates share an id. */
const body = (extra: Record<string, unknown> = {}) => ({ name: `Fee Probe Open ${++seq}`, location: 'Kenner, LA', date: '2026-12-05', entryFee: 20, ...extra })
const create = (as: string, payload: Record<string, unknown>) => invoke(createTournament, { method: 'POST', as, body: payload })

const count = async (sql: string) => (await env.DB.prepare(sql).first<{ n: number }>())?.n ?? 0
const eventCount = () => count('SELECT COUNT(*) AS n FROM tournaments')
const directorRowCount = () => count('SELECT COUNT(*) AS n FROM tournament_directors')

async function createdId(res: Awaited<ReturnType<typeof create>>): Promise<string> {
  expect(res.status).toBe(201)
  return (await res.json<{ tournament: { id: string } }>()).tournament.id
}

/** Each live section of the event as stored, in order. */
async function sectionsOf(tournamentId: string) {
  const { results } = await env.DB.prepare(
    'SELECT name, fee_regular, fee_early, fee_late, extra_json FROM tournament_sections WHERE tournament_id = ? AND archived_at IS NULL ORDER BY position',
  ).bind(tournamentId).all()
  return results
}

async function eventOf(tournamentId: string) {
  return env.DB.prepare('SELECT club_id, created_by, entry_fee, is_visible, requires_lca_membership FROM tournaments WHERE id = ?').bind(tournamentId).first()
}

async function directorsOf(tournamentId: string): Promise<string[]> {
  const { results } = await env.DB.prepare('SELECT member_id FROM tournament_directors WHERE tournament_id = ? ORDER BY member_id')
    .bind(tournamentId).all<{ member_id: string }>()
  return results.map((r) => r.member_id)
}

/** Expects the payout words with 403, and no event written. */
async function expectRefused(res: Awaited<ReturnType<typeof create>>, events: number, label = '') {
  expect(res.status, label).toBe(403)
  expect(await res.json(), label).toEqual({ error: FEES_NEED_PAYOUT_ACCOUNT })
  expect(await eventCount(), label).toBe(events)
}

describe('the create\'s fee check reads each section as the section writer stores it, with CREATION_ROLES_ON set (D24)', () => {
  beforeEach(() => {
    flags.rolesOn = true
  })

  it('a free section with its own early price above $0 is refused with canChargeFees made to refuse, and created for a creator it lets charge, the price stored', async () => {
    const director = await seedDirector()
    const payload = body({ entryFee: 0, sections: [{ name: 'Open', entryFee: 0, fees: { early: 5 } }] })
    fees.refuse = true
    await expectRefused(await create(director, payload), await eventCount())
    fees.refuse = false
    const id = await createdId(await create(director, payload))
    expect(await sectionsOf(id)).toEqual([{ name: 'Open', fee_regular: 0, fee_early: 5, fee_late: null, extra_json: null }])
  })

  it('sections copied from another event\'s answer, their fees carrying the regular price, set no early or late price: a free event copied with its shown prices is created with canChargeFees made to refuse, and stores none', async () => {
    fees.refuse = true
    const director = await seedDirector()
    const copied = [
      { id: 'a-row-of-another-event', name: 'Open', entryFee: 0, fees: { regular: 0, early: null, late: 10 } },
      { name: 'U1200', entryFee: 0, fees: { regular: 0, early: 3, late: null } },
    ]
    const id = await createdId(await create(director, body({ entryFee: 0, sections: copied })))
    expect(await sectionsOf(id)).toEqual([
      { name: 'Open', fee_regular: 0, fee_early: null, fee_late: null, extra_json: null },
      { name: 'U1200', fee_regular: 0, fee_early: null, fee_late: null, extra_json: null },
    ])
    expect(fees.asked).toEqual([])
  })

  it('a bare name pays the event\'s fee: on a priced event it is refused with canChargeFees made to refuse, and on a free one it is created, each row paying the event\'s $0', async () => {
    fees.refuse = true
    const director = await seedDirector()
    await expectRefused(await create(director, body({ entryFee: 20, sections: ['Open', 'Reserve'] })), await eventCount())
    const id = await createdId(await create(director, body({ entryFee: 0, sections: ['Open', 'Reserve'] })))
    expect(await sectionsOf(id)).toEqual([
      { name: 'Open', fee_regular: null, fee_early: null, fee_late: null, extra_json: null },
      { name: 'Reserve', fee_regular: null, fee_early: null, fee_late: null, extra_json: null },
    ])
  })

  it('a section whose fee is not a number pays the event\'s fee, as the writer stores it: on a free event it is created with canChargeFees made to refuse, the text kept beside a row at the event\'s fee, and on a priced event it is refused', async () => {
    fees.refuse = true
    const director = await seedDirector()
    const sections = [{ name: 'Open', entryFee: '15' }]
    const id = await createdId(await create(director, body({ entryFee: 0, sections })))
    expect(await sectionsOf(id)).toEqual([{ name: 'Open', fee_regular: null, fee_early: null, fee_late: null, extra_json: '{"entryFee":"15"}' }])
    await expectRefused(await create(director, body({ entryFee: 20, sections })), await eventCount())
  })

  it('with no sections sent, or an empty list, the default Open section at the event\'s fee: refused at $20 with canChargeFees made to refuse, and created at $0', async () => {
    fees.refuse = true
    const director = await seedDirector()
    for (const sections of [undefined, null, []]) {
      const label = JSON.stringify(sections) ?? 'left out'
      await expectRefused(await create(director, body({ entryFee: 20, ...(sections === undefined ? {} : { sections }) })), await eventCount(), label)
      const id = await createdId(await create(director, body({ entryFee: 0, ...(sections === undefined ? {} : { sections }) })))
      expect(await sectionsOf(id), label).toEqual([{ name: 'Open', fee_regular: 0, fee_early: null, fee_late: null, extra_json: null }])
    }
  })

  it('asks canChargeFees about the event being made, its club and its creator, an empty club id read as none, and only when the list sets a price above $0', async () => {
    const admin = await seedAdmin()
    const club = await seedClub()
    const rep = await seedMember({ role: 'club_rep', clubId: club })
    const director = await seedDirector()
    for (const [who, as, payload, grant, clubId] of [
      ['an LCA admin, an empty club id', admin, body({ clubId: '' }), 'admin', null],
      ['an LCA admin, a club', admin, body({ clubId: club }), 'admin', club],
      ['a club rep, no club sent', rep, body(), 'club_rep', club],
      ['a club rep, an empty club id', rep, body({ clubId: '' }), 'club_rep', club],
      ['a standing director', director, body(), 'standing_director', null],
    ] as const) {
      fees.asked.length = 0
      await createdId(await create(as, payload))
      expect(fees.asked, who).toEqual([{ grant, event: { clubId, createdBy: as }, rolesOn: true }])
    }
    fees.asked.length = 0
    await createdId(await create(director, body({ entryFee: 0 })))
    expect(fees.asked).toEqual([])
  })
})

describe.each(STATES)('an empty club id is no club for every creator, with CREATION_ROLES_ON %s', (_state, rolesOn) => {
  beforeEach(() => {
    flags.rolesOn = rolesOn
  })

  it('a club rep who sends an empty club id creates its own club\'s hidden draft, its requirement off unless it asks for one, as before', async () => {
    const club = await seedClub()
    const rep = await seedMember({ role: 'club_rep', clubId: club })
    const plain = await createdId(await create(rep, body({ clubId: '' })))
    expect(await eventOf(plain)).toEqual({ club_id: club, created_by: rep, entry_fee: 20, is_visible: 0, requires_lca_membership: 0 })
    const asked = await createdId(await create(rep, body({ clubId: '', requiresLcaMembership: true })))
    expect(await eventOf(asked)).toMatchObject({ club_id: club, requires_lca_membership: 1 })
    expect(await directorsOf(plain)).toEqual([])
  })

  it('an LCA admin who sends an empty club id and asks for no membership requirement is refused with the words for any event with no club, and nothing is written', async () => {
    const admin = await seedAdmin()
    const events = await eventCount()
    const res = await create(admin, body({ clubId: '', requiresLcaMembership: false }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: LCA_RUN_NEEDS_MEMBERSHIP })
    expect(await eventCount()).toBe(events)
  })

  it('a plain member and an auditor who send an empty club id are refused with "Forbidden", and nothing is written', async () => {
    const events = await eventCount()
    const rows = await directorRowCount()
    for (const [who, as] of [['a plain member', await seedMember()], ['an auditor', await seedMember({ role: 'lca_auditor' })]] as const) {
      const res = await create(as, body({ clubId: '' }))
      expect(res.status, who).toBe(403)
      expect(await res.json(), who).toEqual({ error: 'Forbidden' })
    }
    expect(await eventCount()).toBe(events)
    expect(await directorRowCount()).toBe(rows)
  })
})

describe('an empty club id for the president and a standing director', () => {
  it('with the constant set, the president who sends an empty club id creates an LCA-run hidden draft and is written as its first director', async () => {
    flags.rolesOn = true
    const president = await seedMember({ role: 'lca_observer' })
    await seedPresident(president)
    const res = await create(president, body({ clubId: '' }))
    const id = await createdId(res)
    expect(await eventOf(id)).toEqual({ club_id: null, created_by: president, entry_fee: 20, is_visible: 0, requires_lca_membership: 1 })
    expect(await directorsOf(id)).toEqual([president])
  })

  it('with the constant unset, a standing director and the president who send an empty club id are refused with "Forbidden", as today, and nothing is written', async () => {
    const president = await seedMember({ role: 'lca_observer' })
    await seedPresident(president)
    const events = await eventCount()
    const rows = await directorRowCount()
    for (const [who, as] of [['a standing director', await seedDirector()], ['the president', president]] as const) {
      const res = await create(as, body({ clubId: '' }))
      expect(res.status, who).toBe(403)
      expect(await res.json(), who).toEqual({ error: 'Forbidden' })
    }
    expect(await eventCount()).toBe(events)
    expect(await directorRowCount()).toBe(rows)
  })
})
