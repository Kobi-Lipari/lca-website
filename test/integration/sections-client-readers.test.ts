// test/integration/sections-client-readers.test.ts
//
// What the tournament page and the family panel read from the server. They
// take each section from the answer (id, name, entryFee, fees) and price an
// entry with priceShownSection, which passes the section's own prices to
// priceEntry with the tournament's own pricing columns, with no sections JSON
// passed to pricing. These cases run the real handlers and then price as the
// pages do:
//
// - an event saved with plain-name sections comes back from the list, detail
//   and manage endpoints as objects with an id, a name, an entryFee equal to
//   fees.regular, and the fees triple, so matching by name still works
// - the price the page shows for each section equals the amount the server
//   charges when it prices the same entry (a waitlist offer), across early,
//   member and late settings, member and non-member, and for a section with
//   an early or late price of its own
// - the answers match the section contract the client types come from
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { savedSectionSchema, tournamentDetailResponseSchema, tournamentsListResponseSchema } from '../../domain/contracts'
import { priceShownSection } from '../../domain/registration/pricing'
import type { ApiTournamentDetail, ApiTournamentListItem } from '../../src/lib/api'
import { onRequestPatch as patchTournament } from '../../functions/api/admin/tournaments/[id]'
import { onRequestGet as manageGet } from '../../functions/api/admin/tournaments/[id]/manage'
import { onRequestPost as waitlistPost } from '../../functions/api/admin/tournaments/[id]/waitlist'
import { onRequestGet as detailGet } from '../../functions/api/tournaments/[id]'
import { onRequestGet as listGet } from '../../functions/api/tournaments'
import { invoke, resetHarness } from './harness'
import { seedAdmin, seedMember, seedRegistration, seedTournament } from './factories'

beforeEach(resetHarness)

const detailOf = async (tournamentId: string): Promise<ApiTournamentDetail> => {
  const res = await invoke(detailGet, { params: { id: tournamentId } })
  expect(res.status).toBe(200)
  return (await res.json<{ tournament: ApiTournamentDetail }>()).tournament
}

describe('an event saved with plain-name sections is answered with section objects', () => {
  it('list, detail and manage each return id, name, entryFee, cap and the fees triple', async () => {
    const admin = await seedAdmin()
    // Plain names are taken as names (seedTournament passes them to the writer).
    const tournamentId = await seedTournament({
      entryFee: 30,
      sections: ['Open', 'Reserve', { name: 'Championship', entryFee: 45 }] as unknown as Array<{ name: string; entryFee: number }>,
    })

    const list = await invoke(listGet, { as: admin })
    const { tournaments } = await list.json<{ tournaments: ApiTournamentListItem[] }>()
    const manage = await invoke(manageGet, { as: admin, params: { id: tournamentId } })
    const managed = (await manage.json<{ tournament: ApiTournamentDetail }>()).tournament
    const answers = [
      ['list', tournaments.find((t) => t.id === tournamentId)!.sections],
      ['detail', (await detailOf(tournamentId)).sections],
      ['manage', managed.sections],
    ] as const

    const ids = new Set<string>()
    for (const [where, sections] of answers) {
      expect(sections.map((s) => s.name), where).toEqual(['Open', 'Reserve', 'Championship'])
      for (const s of sections) {
        expect(typeof s, `${where} ${s.name}`).toBe('object')
        expect(typeof s.id, `${where} ${s.name}`).toBe('string')
        expect(s.id.length, `${where} ${s.name}`).toBeGreaterThan(0)
        expect(s.entryFee, `${where} ${s.name}`).toBe(s.fees.regular)
        expect(s).toHaveProperty('cap')
        expect(savedSectionSchema.safeParse(s).success, `${where} ${s.name}`).toBe(true)
        ids.add(s.id)
      }
      // A section without a price of its own is the event fee.
      expect(sections.map((s) => s.entryFee), where).toEqual([30, 30, 45])
    }
    // The same three rows in every answer.
    expect(ids.size).toBe(3)
    // Matching by name, as the pages do, finds the row for every section.
    const detail = await detailOf(tournamentId)
    for (const name of ['Open', 'Reserve', 'Championship']) expect(detail.sections.find((s) => s.name === name)?.name).toBe(name)
  })

  it('the detail and list answers pass their response contracts', async () => {
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 20 }, { name: 'U1200', entryFee: 0 }] })
    const detail = await invoke(detailGet, { params: { id: tournamentId } })
    expect(tournamentDetailResponseSchema.safeParse(await detail.json()).success).toBe(true)
    const list = await invoke(listGet, {})
    expect(tournamentsListResponseSchema.safeParse(await list.json()).success).toBe(true)
  })

  it('an event with no sections answers an empty list, which the pages treat as no section chosen', async () => {
    const tournamentId = await seedTournament({ sections: [] })
    expect((await detailOf(tournamentId)).sections).toEqual([])
  })
})

describe('the price the page shows is the amount the server charges', () => {
  const settings: Array<Record<string, unknown>> = [
    {},
    { member_discount: 5 },
    { early_deadline: '2099-01-01T00:00', early_discount: 4, member_discount: 3 },
    { early_deadline: '2020-01-01T00:00', early_discount: 4 },
    { late_after: '2020-01-01T00:00', late_fee: 10, member_discount: 5 },
    { early_deadline: '2099-01-01T00:00', early_discount: 60 },
    { early_deadline: '2099-01-01', late_after: '2020-01-01', early_discount: 5, late_fee: 5, member_discount: 5 },
  ]

  it('for sections with a fee, no fee of their own, and a free section, member or not (member_discount left in the row is not read)', async () => {
    const admin = await seedAdmin()
    for (const columns of settings) {
      for (const membershipStatus of ['active', 'pending']) {
        const tournamentId = await seedTournament({
          entryFee: 40,
          sections: ['Side', { name: 'Open', entryFee: 25 }, { name: 'Free', entryFee: 0 }] as unknown as Array<{ name: string; entryFee: number }>,
        })
        const sets = Object.keys(columns).map((k) => `${k} = ?`).join(', ')
        if (sets) await env.DB.prepare(`UPDATE tournaments SET ${sets} WHERE id = ?`).bind(...Object.values(columns), tournamentId).run()
        const tournament = await detailOf(tournamentId)
        for (const section of tournament.sections) {
          const memberId = await seedMember({ membershipStatus })
          const reg = await seedRegistration({ tournamentId, memberId, section: section.name, paymentStatus: 'pending' })
          await env.DB.prepare(`UPDATE registrations SET waitlisted_at = datetime('now') WHERE id = ?`).bind(reg).run()
          const label = `${JSON.stringify(columns)} ${membershipStatus} ${section.name}`

          // The same shown price for a member and a guest: there is no member price.
          const shown = priceShownSection(section, tournament, Date.now())
          const res = await invoke(waitlistPost, { method: 'POST', as: admin, params: { id: tournamentId }, body: { registrationId: reg } })
          expect(res.status, label).toBe(200)
          expect((await res.json<{ amount: number }>()).amount, label).toBe(shown.amount)
        }
      }
    }
  })

  const offerFor = async (tournamentId: string, admin: Awaited<ReturnType<typeof seedAdmin>>) => {
    const memberId = await seedMember({ membershipStatus: 'pending' })
    const reg = await seedRegistration({ tournamentId, memberId, section: 'Open', paymentStatus: 'pending' })
    await env.DB.prepare(`UPDATE registrations SET waitlisted_at = datetime('now') WHERE id = ?`).bind(reg).run()
    const res = await invoke(waitlistPost, { method: 'POST', as: admin, params: { id: tournamentId }, body: { registrationId: reg } })
    expect(res.status).toBe(200)
    return (await res.json<{ amount: number }>()).amount
  }

  it('a section with its own early or late price is shown the price the server charges', async () => {
    const cases: Array<{ columns: string; own: string; charged: number }> = [
      { columns: `early_deadline = '2099-01-01', early_discount = 5`, own: 'fee_early = 22', charged: 22 },
      { columns: `late_after = '2020-01-01', late_fee = 5`, own: 'fee_late = 52', charged: 52 },
      { columns: `early_deadline = '2099-01-01', early_discount = 5, late_after = '2020-01-01', late_fee = 5`, own: 'fee_early = 30, fee_late = 47', charged: 37 },
    ]
    const admin = await seedAdmin()
    for (const { columns, own, charged } of cases) {
      const tournamentId = await seedTournament({ entryFee: 40, sections: [{ name: 'Open', entryFee: 40 }] })
      await env.DB.prepare(`UPDATE tournaments SET ${columns} WHERE id = ?`).bind(tournamentId).run()
      await env.DB.prepare(`UPDATE tournament_sections SET ${own} WHERE tournament_id = ?`).bind(tournamentId).run()
      const tournament = await detailOf(tournamentId)
      expect(await offerFor(tournamentId, admin), own).toBe(charged)
      expect(priceShownSection(tournament.sections[0], tournament, Date.now()).amount, own).toBe(charged)
    }
  })

  it('an early discount larger than the fee, with the late fee also due, is shown as the server charges it', async () => {
    // The answer's worked-out early price is clamped at zero; checkout takes
    // the whole discount off and then adds the late fee: 25 - 30 + 10 = 5.
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ entryFee: 25, sections: [{ name: 'Open', entryFee: 25 }] })
    await env.DB.prepare(`UPDATE tournaments SET early_deadline = '2099-01-01', early_discount = 30, late_after = '2020-01-01', late_fee = 10 WHERE id = ?`)
      .bind(tournamentId).run()
    const tournament = await detailOf(tournamentId)
    expect(tournament.sections[0].fees).toEqual({ regular: 25, early: 0, late: 35 })
    expect(await offerFor(tournamentId, admin)).toBe(5)
    expect(priceShownSection(tournament.sections[0], tournament, Date.now()).amount).toBe(5)
  })
})

describe('the manage page sends the fees it loaded back unchanged', () => {
  const columnsOf = (tournamentId: string) =>
    env.DB.prepare('SELECT name, fee_regular, fee_early, fee_late FROM tournament_sections WHERE tournament_id = ? AND archived_at IS NULL ORDER BY position')
      .bind(tournamentId).all<{ name: string; fee_regular: number | null; fee_early: number | null; fee_late: number | null }>()

  it('a rename that echoes the derived early and late prices sets no price of its own, so later changes to the event columns still flow', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ entryFee: 40, sections: [{ name: 'Open', entryFee: 25 }, { name: 'Reserve', entryFee: 15 }] })
    await env.DB.prepare(`UPDATE tournaments SET early_deadline = '2099-01-01', early_discount = 5, late_after = '2099-02-01', late_fee = 10 WHERE id = ?`)
      .bind(tournamentId).run()
    const before = (await columnsOf(tournamentId)).results

    const manage = await invoke(manageGet, { as: admin, params: { id: tournamentId } })
    const loaded = (await manage.json<{ tournament: ApiTournamentDetail }>()).tournament.sections
    // The answer carries derived early and late prices for each section.
    expect(loaded.map((s) => s.fees)).toEqual([{ regular: 25, early: 20, late: 35 }, { regular: 15, early: 10, late: 25 }])

    const sections = loaded.map((s) => (s.name === 'Open' ? { ...s, name: 'Championship' } : s))
    const res = await invoke(patchTournament, { method: 'PATCH', as: admin, params: { id: tournamentId }, rawBody: JSON.stringify({ sections }) })
    expect(res.status).toBe(200)
    expect((await columnsOf(tournamentId)).results).toEqual(before.map((r) => (r.name === 'Open' ? { ...r, name: 'Championship' } : r)))

    // Change the event's early discount: both sections follow it.
    await env.DB.prepare(`UPDATE tournaments SET early_discount = 8 WHERE id = ?`).bind(tournamentId).run()
    const after = await detailOf(tournamentId)
    expect(after.sections.map((s) => [s.name, s.fees.early])).toEqual([['Championship', 17], ['Reserve', 7]])
  })
})
