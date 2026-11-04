// test/integration/contracts/tournaments-list.test.ts
// GET /api/tournaments keeps its contract (domain/contracts/events.ts):
// the real handler, rows from the factories, every column checked. The
// site's getTournaments() in src/lib/api.ts sends no body and no sign-in;
// the signed-in views are checked too, because the handler serves them.
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { contracts } from '../../../domain/contracts'
import { onRequestGet as tournamentsGet } from '../../../functions/api/tournaments'
import { seedAdmin, seedClub, seedMember, seedTournament, seedTournamentDirector } from '../factories'
import { expectContract, invoke, resetHarness } from '../harness'

beforeEach(resetHarness)

const contract = contracts['tournaments'].GET

/** A club event with every optional column filled, a legacy section name and prizes. */
async function seedFullTournament(clubId: string): Promise<string> {
  const id = await seedTournament({
    clubId,
    maxPlayers: 40,
    isRated: true,
    sections: [
      {
        name: 'U1600',
        entryFee: 30,
        prizeFund: '$200 based on 20',
        ratingMax: 1599,
        unratedOk: true,
        rulesSet: true,
        prizes: {
          place: [{ amount: 100, label: '1st' }, { label: 'Trophy' }],
          classes: [{ label: 'Top U1000', ratingMax: 999, prizes: [{ amount: 25 }] }],
        },
      },
    ],
  })
  await env.DB.prepare(
    `UPDATE tournaments SET
       venue = 'Kenner Community Center', end_date = '2026-09-13', description = 'Two days, five rounds.',
       registration_deadline = '2026-09-10', registration_opens_at = '2026-08-01T09:00',
       registration_closes_at = '2026-09-11T21:00', round_schedule = ?, custom_details = ?,
       time_control = 'G/90+30', registration_url = NULL, eligibility = 'Open to all',
       organizer = 'Kenner Chess Club', early_deadline = '2026-09-01', early_discount = 5,
       late_after = '2026-09-11', late_fee = 10, report_settings = ?, keep_apart = 'family_club',
       pairing_system = 'fide', accelerated = 1, is_state_championship = 1
     WHERE id = ?`,
  ).bind(
    JSON.stringify([{ round: 1, date: '2026-09-12', time: '10:00' }]),
    JSON.stringify([{ label: 'Parking', value: 'Free' }]),
    JSON.stringify({ affiliateId: 'A6000001' }),
    id,
  ).run()
  await env.DB.prepare(`UPDATE clubs SET color = '#1a2744' WHERE id = ?`).bind(clubId).run()
  return id
}

describe('GET /api/tournaments contract', () => {
  it('holds for the public list, with nullable columns empty and filled', async () => {
    const clubId = await seedClub({ name: 'Kenner Chess Club' })
    const full = await seedFullTournament(clubId)
    const bare = await seedTournament({ name: 'Bare event' })
    await env.DB.prepare(`UPDATE tournaments SET sections = ? WHERE id = ?`)
      .bind(JSON.stringify(['Open', { name: 'Reserve', entryFee: 0 }]), bare).run()

    const result = await invoke(tournamentsGet, { path: '/api/tournaments' })
    expect(result.status).toBe(200)
    const body = await expectContract(result, contract.response)

    const fullRow = body.tournaments.find((t) => t.id === full)
    expect(fullRow?.club_name).toBe('Kenner Chess Club')
    expect(fullRow?.club_color).toBe('#1a2744')
    expect(fullRow?.end_date).toBe('2026-09-13')
    // round_schedule is read into a list; custom_details stays raw JSON text
    // on this endpoint (the setup wizard parses it when it copies an event).
    expect(fullRow?.round_schedule).toEqual([{ round: 1, date: '2026-09-12', time: '10:00' }])
    expect(typeof fullRow?.custom_details).toBe('string')
    // The section comes from tournament_sections: every field the JSON had,
    // plus its id, cap and prices (early less $5, late plus $10).
    const row = await env.DB.prepare('SELECT id FROM tournament_sections WHERE tournament_id = ?').bind(full).first<{ id: string }>()
    expect(fullRow?.sections).toEqual([{
      id: row?.id,
      name: 'U1600',
      entryFee: 30,
      prizeFund: '$200 based on 20',
      ratingMax: 1599,
      ratingMin: null,
      unratedOk: true,
      gradeMin: null,
      gradeMax: null,
      rulesSet: true,
      prizes: {
        place: [{ amount: 100, label: '1st' }, { label: 'Trophy' }],
        classes: [{ label: 'Top U1000', ratingMax: 999, prizes: [{ amount: 25 }] }],
      },
      cap: null,
      fees: { regular: 30, early: 25, late: 40 },
    }])
    const bareRow = body.tournaments.find((t) => t.id === bare)
    expect(bareRow?.club_name).toBeNull()
    expect(bareRow?.venue).toBeNull()
    expect(bareRow?.round_schedule).toEqual([])
    // A section stored as a bare name is an object now, priced at the event's fee.
    expect(bareRow?.sections.map((s) => [s.name, s.entryFee, s.fees.regular])).toEqual([['Open', 25, 25], ['Reserve', 0, 0]])
  })

  it('holds for an admin, a club rep and a director, who also see drafts', async () => {
    const clubId = await seedClub()
    const draft = await seedTournament({ clubId, isVisible: false, registrationStatus: 'draft' })
    await seedTournament()
    const admin = await seedAdmin()
    const rep = await seedMember({ role: 'club_rep', clubId })
    const director = await seedMember()
    await seedTournamentDirector(draft, director)

    for (const as of [admin, rep, director]) {
      const body = await expectContract(await invoke(tournamentsGet, { as, path: '/api/tournaments' }), contract.response)
      expect(body.tournaments.map((t) => t.id), as).toContain(draft)
    }
  })

  it('role safety: created_by, keep_apart, report_settings and review_notified_at only on the rows of events the viewer manages', async () => {
    const clubId = await seedClub()
    const otherClub = await seedClub()
    const ours = await seedTournament({ clubId })
    const theirs = await seedTournament({ clubId: otherClub })
    const directed = await seedTournament()
    const creator = await seedAdmin()
    for (const id of [ours, theirs, directed]) {
      await env.DB.prepare(`UPDATE tournaments SET created_by = ?, keep_apart = 'none', report_settings = '{}' WHERE id = ?`).bind(creator, id).run()
    }
    const director = await seedMember({ role: 'tournament_director' })
    await seedTournamentDirector(directed, director)
    // The trim's three keys, and review_notified_at, which WS08 step 2 added.
    const managersOnly = ['created_by', 'keep_apart', 'report_settings', 'review_notified_at']

    /** The events among the three whose row carries the four keys; a row carries all four or none. */
    const carried = async (as?: string) => {
      const body = await expectContract(await invoke(tournamentsGet, { as, path: '/api/tournaments' }), contract.response)
      const rows = body.tournaments.filter((t) => [ours, theirs, directed].includes(t.id))
      expect(rows, String(as)).toHaveLength(3)
      for (const t of rows) expect([0, 4], `${String(as)} ${t.id}`).toContain(managersOnly.filter((key) => Object.hasOwn(t, key)).length)
      return rows.filter((t) => Object.hasOwn(t, 'keep_apart')).map((t) => t.id).sort()
    }
    expect(await carried()).toEqual([])
    expect(await carried(await seedMember())).toEqual([])
    expect(await carried(await seedMember({ clubId }))).toEqual([])
    expect(await carried(await seedMember({ role: 'club_rep', clubId: otherClub }))).toEqual([theirs])
    expect(await carried(await seedMember({ role: 'club_rep', clubId }))).toEqual([ours])
    expect(await carried(director)).toEqual([directed])
    for (const role of ['lca_admin', 'lca_observer', 'lca_officer']) {
      expect(await carried(await seedMember({ role })), role).toEqual([ours, theirs, directed].sort())
    }
  })

  it('keeps drafts out of the public and plain-member lists', async () => {
    const draft = await seedTournament({ isVisible: false })
    const member = await seedMember()
    for (const as of [undefined, member]) {
      const body = await expectContract(await invoke(tournamentsGet, { as, path: '/api/tournaments' }), contract.response)
      expect(body.tournaments.map((t) => t.id)).not.toContain(draft)
    }
  })
})

describe('expectContract', () => {
  const answer = (body: unknown) => ({ status: 200, json: async <T>() => body as T })

  /** One real row from the handler, to break in different ways. */
  async function realRow(): Promise<Record<string, unknown>> {
    const id = await seedTournament()
    const body = await (await invoke(tournamentsGet, { path: '/api/tournaments' })).json<{ tournaments: Record<string, unknown>[] }>()
    const row = body.tournaments.find((t) => t.id === id)
    expect(row).toBeDefined()
    // The unbroken row passes, so each failure below is the change alone.
    await expectContract(answer({ tournaments: [row] }), contract.response)
    return row as Record<string, unknown>
  }

  it('fails on a field the contract does not name, and prints it', async () => {
    const row = await realRow()
    await expect(expectContract(answer({ tournaments: [{ ...row, member_price: 20 }] }), contract.response))
      .rejects.toThrow(/member_price/)
  })

  it('fails on a missing or mistyped field, and prints the path', async () => {
    const row = await realRow()
    const missing = { ...row }
    delete missing.location
    await expect(expectContract(answer({ tournaments: [missing] }), contract.response)).rejects.toThrow(/location/)
    await expect(expectContract(answer({ tournaments: [{ ...row, entry_fee: '25' }] }), contract.response))
      .rejects.toThrow(/entry_fee/)
    await expect(expectContract(answer({ tournaments: [{ ...row, date: 'Sat, Sep 12' }] }), contract.response))
      .rejects.toThrow(/date/)
  })
})
