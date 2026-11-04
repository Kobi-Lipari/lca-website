// test/integration/contracts/admin-tournaments-creation.test.ts
//
// POST /api/admin/tournaments keeps its contract (domain/contracts/events.ts)
// with CREATION_ROLES_ON set (WS08 step 3), beside the cases of
// admin-tournaments.test.ts, which run with it unset:
// - the president's answer, as the standing director's there, is every
//   column of the new event with its section rows, ids included: an LCA-run
//   hidden draft with the president as its creator and the membership
//   requirement on;
// - the refusals the widened create gives keep the plain { error } body:
//   the LCA-run words for a club named by the president or a standing
//   director, "Forbidden" for a plain member and an officer who holds no
//   seat, the club rep's two refusals, and 401 for no sign-in;
// - the first director's setup save answers to the PATCH contract, as an
//   assigned director's does.
// The constant is read through a getter on the mocked module, set for every
// case here and put back after each.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { contracts, errorBodySchema } from '../../../domain/contracts'
import { LCA_RUN_ONLY } from '../../../domain/events/creation'
import { onRequestPost as createTournament } from '../../../functions/api/admin/tournaments'
import { onRequestPatch as patchTournament } from '../../../functions/api/admin/tournaments/[id]'
import { seedClub, seedMember, seedPresident } from '../factories'
import { expectContract, invoke, resetHarness } from '../harness'

const flags = vi.hoisted(() => ({ rolesOn: false }))
vi.mock('../../../functions/utils/events/creation', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../functions/utils/events/creation')>()
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

const create = contracts['admin/tournaments'].POST
const edit = contracts['admin/tournaments/[id]'].PATCH

/** What the wizard sends (TournamentWizard handleCreate) for an LCA-run event. */
const wizardBody = (extra: Record<string, unknown> = {}) => ({
  name: 'Creation Contract Open',
  location: 'Lafayette, LA',
  date: '2026-12-05',
  endDate: null,
  venue: 'Lafayette Library',
  entryFee: 25,
  sections: [{ name: 'Open', entryFee: 25 }, { name: 'U1200', entryFee: 15 }],
  rounds: 4,
  maxPlayers: null,
  description: null,
  isRated: true,
  status: 'upcoming',
  timeControl: 'G/45+5',
  registrationClosesAt: null,
  clubId: null,
  ...extra,
})

const liveRows = async (tournamentId: string) =>
  (await env.DB.prepare('SELECT id, name FROM tournament_sections WHERE tournament_id = ? AND archived_at IS NULL ORDER BY position')
    .bind(tournamentId).all<{ id: string; name: string }>()).results

async function president(): Promise<string> {
  const id = await seedMember({ role: 'lca_observer' })
  await seedPresident(id)
  return id
}

describe('POST /api/admin/tournaments contract, with CREATION_ROLES_ON set', () => {
  it('answers the president with every column and the section rows: an LCA-run hidden draft it created, the requirement on', async () => {
    const as = await president()
    const result = await invoke(createTournament, { method: 'POST', as, body: wizardBody() })
    expect(result.status).toBe(201)
    const { tournament } = await expectContract(result, create.response)
    expect(tournament).toMatchObject({ created_by: as, club_id: null, is_visible: 0, requires_lca_membership: 1, review_notified_at: null })
    expect(tournament.sections.map((s) => [s.id, s.name])).toEqual((await liveRows(tournament.id)).map((r) => [r.id, r.name]))
  })

  it('role safety: the refusals of the widened create keep the plain { error } body and write nothing', async () => {
    const own = await seedClub()
    const other = await seedClub()
    const refusals: ReadonlyArray<readonly [string, string, Record<string, unknown>, string]> = [
      ['the president naming a club', await president(), { clubId: own }, LCA_RUN_ONLY],
      ['a standing director naming a club', await seedMember({ role: 'tournament_director' }), { clubId: own }, LCA_RUN_ONLY],
      ['a plain member', await seedMember(), {}, 'Forbidden'],
      ['an officer who holds no seat', await seedMember({ role: 'lca_officer' }), {}, 'Forbidden'],
      ['a club rep naming another club', await seedMember({ role: 'club_rep', clubId: own }), { clubId: other }, 'Club reps can only create tournaments for their club'],
      ['a club rep with no club', await seedMember({ role: 'club_rep' }), {}, 'Your account is not linked to a club yet. Ask an LCA admin to assign you one.'],
    ]
    const before = await env.DB.prepare('SELECT COUNT(*) AS n FROM tournaments').first<{ n: number }>()
    for (const [who, as, extra, words] of refusals) {
      const res = await invoke(createTournament, { method: 'POST', as, body: wizardBody(extra) })
      expect(res.status, who).toBe(403)
      expect(await expectContract(res, errorBodySchema), who).toEqual({ error: words })
    }
    const anonymous = await invoke(createTournament, { method: 'POST', body: wizardBody() })
    expect(anonymous.status).toBe(401)
    await expectContract(anonymous, errorBodySchema)
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM tournaments').first<{ n: number }>()).toEqual(before)
  })

  it('answers the first director\'s setup save to the PATCH contract, as an assigned director\'s', async () => {
    const director = await seedMember({ role: 'tournament_director' })
    const made = await invoke(createTournament, { method: 'POST', as: director, body: wizardBody() })
    const { tournament } = await expectContract(made, create.response)
    const saved = await invoke(patchTournament, {
      method: 'PATCH', as: director, params: { id: tournament.id },
      body: { description: 'Four rounds, one day.', sections: [{ name: 'Open', entryFee: 25 }, { name: 'U1200', entryFee: 15 }, { name: 'U800', entryFee: 10 }] },
    })
    expect(saved.status).toBe(200)
    const answer = (await expectContract(saved, edit.response)).tournament
    expect(answer.description).toBe('Four rounds, one day.')
    expect(answer.sections.map((s) => [s.id, s.name])).toEqual((await liveRows(tournament.id)).map((r) => [r.id, r.name]))
  })
})
