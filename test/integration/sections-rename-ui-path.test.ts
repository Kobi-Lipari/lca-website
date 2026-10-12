// test/integration/sections-rename-ui-path.test.ts
//
// The setup screens send each section back with its id, so a renamed
// section keeps its entries and pairings. These cases send the bodies the
// pages build, as src/lib/api.ts puts them on the wire:
//
// - the manage page loads the event (GET .../manage), keeps every section's
//   id while it is edited, and saves with adminUpdateTournament, which sends
//   JSON.stringify(body) as the PATCH body. A rename there keeps the row id
//   and moves its entries (section name updated, section_id unchanged) and
//   its games. The same rename without the ids is a removal plus an
//   addition, which decision 7 refuses while the section has entries.
// - the wizard copies sections from an event in the list (GET
//   /api/tournaments), leaves the source's ids behind, and creates the new
//   event with adminCreateTournament. The new event gets rows of its own and
//   the source is untouched.
//
// Neither screen offers a rename box today; the body is built the way the
// page builds every save, with the name changed.
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import type { adminCreateTournament, adminUpdateTournament, ApiSectionDraft, ApiTournamentDetail, ApiTournamentListItem } from '../../src/lib/api'
import { onRequestGet as manageGet } from '../../functions/api/admin/tournaments/[id]/manage'
import { onRequestPatch as patchTournament } from '../../functions/api/admin/tournaments/[id]'
import { onRequestPost as createTournament } from '../../functions/api/admin/tournaments'
import { onRequestGet as listTournaments } from '../../functions/api/tournaments'
import { invoke, resetHarness } from './harness'
import { seedAdmin, seedClub, seedMember, seedRegistration, seedTournament, seedTournamentDirector } from './factories'

beforeEach(resetHarness)

type UpdateBody = Parameters<typeof adminUpdateTournament>[1]
type CreateBody = Parameters<typeof adminCreateTournament>[0]

const liveRows = async (tournamentId: string) =>
  (await env.DB.prepare('SELECT id, name FROM tournament_sections WHERE tournament_id = ? AND archived_at IS NULL ORDER BY position')
    .bind(tournamentId).all<{ id: string; name: string }>()).results
const entry = (id: string) =>
  env.DB.prepare('SELECT section, section_id FROM registrations WHERE id = ?').bind(id).first<{ section: string; section_id: string }>()
const gameSection = async (id: string) =>
  (await env.DB.prepare('SELECT section FROM tournament_games WHERE id = ?').bind(id).first<{ section: string }>())?.section
const storedJson = async (tournamentId: string) =>
  (await env.DB.prepare('SELECT sections FROM tournaments WHERE id = ?').bind(tournamentId).first<{ sections: string }>())?.sections as string

/** Everything a rename could move, to show a refused save moved nothing. */
const state = async (tournamentId: string) => [
  await liveRows(tournamentId),
  (await env.DB.prepare('SELECT id, section, section_id FROM registrations WHERE tournament_id = ? ORDER BY id').bind(tournamentId).all()).results,
  (await env.DB.prepare('SELECT id, section FROM tournament_games WHERE tournament_id = ? ORDER BY id').bind(tournamentId).all()).results,
  await storedJson(tournamentId),
]

/** An event with two entries and a game in Open, and one entry in U1600. */
async function eventWithEntries(opts: { clubId?: string } = {}) {
  const tournamentId = await seedTournament({
    clubId: opts.clubId ?? null,
    sections: [{ name: 'Open', entryFee: 40, prizeFund: '$500' }, { name: 'U1600', entryFee: 30, ratingMax: 1599, rulesSet: true }],
  })
  const a = await seedMember()
  const b = await seedMember()
  const c = await seedMember()
  const openEntries = [
    await seedRegistration({ tournamentId, memberId: a, section: 'Open' }),
    await seedRegistration({ tournamentId, memberId: b, section: 'Open' }),
  ]
  const reserveEntry = await seedRegistration({ tournamentId, memberId: c, section: 'U1600' })
  const game = `game-${crypto.randomUUID()}`
  await env.DB.prepare(
    `INSERT INTO tournament_games (id, tournament_id, round, board, section, white_member_id, black_member_id, result)
     VALUES (?, ?, 1, 1, 'Open', ?, ?, 'pending')`,
  ).bind(game, tournamentId, a, b).run()
  const ids = Object.fromEntries((await liveRows(tournamentId)).map((r) => [r.name, r.id]))
  return { tournamentId, ids, openEntries, reserveEntry, game }
}

/** What the manage page holds after loading: the answer's sections, ids included. */
async function loadForManagePage(as: string, tournamentId: string): Promise<ApiSectionDraft[]> {
  const res = await invoke(manageGet, { as, params: { id: tournamentId } })
  expect(res.status).toBe(200)
  const { tournament } = await res.json<{ tournament: ApiTournamentDetail }>()
  return tournament.sections
}

/** The manage page's save: only the changed keys, sent as adminUpdateTournament sends them. */
const save = (as: string, tournamentId: string, body: UpdateBody) =>
  invoke(patchTournament, { method: 'PATCH', as, params: { id: tournamentId }, rawBody: JSON.stringify(body) })

const renamed = (sections: ApiSectionDraft[], id: string, name: string): ApiSectionDraft[] =>
  sections.map((s) => (s.id === id ? { ...s, name } : s))

describe('renaming a section from the manage page keeps what hangs off it', () => {
  it('sends every section with its id, and the renamed one keeps its row, entries and game', async () => {
    const admin = await seedAdmin()
    const { tournamentId, ids, openEntries, reserveEntry, game } = await eventWithEntries()
    const loaded = await loadForManagePage(admin, tournamentId)
    expect(loaded.map((s) => s.id)).toEqual([ids.Open, ids.U1600])

    const body: UpdateBody = { sections: renamed(loaded, ids.Open, 'Championship') }
    // The ids are on the wire, as the page sends them.
    expect((JSON.parse(JSON.stringify(body)) as { sections: Array<{ id?: string; name: string }> }).sections.map((s) => [s.id, s.name]))
      .toEqual([[ids.Open, 'Championship'], [ids.U1600, 'U1600']])

    const res = await save(admin, tournamentId, body)
    const answer = await res.json<{ tournament: { sections: Array<{ id: string; name: string }> } }>()
    expect(res.status, JSON.stringify(answer)).toBe(200)

    expect(await liveRows(tournamentId)).toEqual([{ id: ids.Open, name: 'Championship' }, { id: ids.U1600, name: 'U1600' }])
    for (const id of openEntries) expect(await entry(id)).toEqual({ section: 'Championship', section_id: ids.Open })
    expect(await entry(reserveEntry)).toEqual({ section: 'U1600', section_id: ids.U1600 })
    expect(await gameSection(game)).toBe('Championship')
    // The JSON mirror carries the new name and no ids, caps or prices.
    const mirrored = JSON.parse(await storedJson(tournamentId)) as Array<Record<string, unknown>>
    expect(mirrored.map((s) => s.name)).toEqual(['Championship', 'U1600'])
    for (const key of ['id', 'cap', 'fees']) expect(mirrored[0]).not.toHaveProperty(key)

    // The answer and the next load show the same section under its new name.
    expect(answer.tournament.sections.map((s) => [s.id, s.name])).toEqual([[ids.Open, 'Championship'], [ids.U1600, 'U1600']])
    const reloaded = await loadForManagePage(admin, tournamentId)
    expect(reloaded.map((s) => [s.id, s.name])).toEqual([[ids.Open, 'Championship'], [ids.U1600, 'U1600']])
  })

  it('renames the section back and forth, and saving the loaded list unchanged moves nothing', async () => {
    const admin = await seedAdmin()
    const { tournamentId, ids, openEntries, game } = await eventWithEntries()
    expect((await save(admin, tournamentId, { sections: renamed(await loadForManagePage(admin, tournamentId), ids.Open, 'Main') })).status).toBe(200)
    expect((await save(admin, tournamentId, { sections: renamed(await loadForManagePage(admin, tournamentId), ids.Open, 'Open') })).status).toBe(200)
    for (const id of openEntries) expect(await entry(id)).toEqual({ section: 'Open', section_id: ids.Open })
    expect(await gameSection(game)).toBe('Open')

    const before = await state(tournamentId)
    expect((await save(admin, tournamentId, { sections: await loadForManagePage(admin, tournamentId) })).status).toBe(200)
    expect(await state(tournamentId)).toEqual(before)
  })

  it('a rename and a new section in one save: the new one gets a row, the renamed one keeps its id', async () => {
    const admin = await seedAdmin()
    const { tournamentId, ids, openEntries } = await eventWithEntries()
    const loaded = await loadForManagePage(admin, tournamentId)
    // A section added on the page has a name and a fee and no id yet.
    const added: ApiSectionDraft = { name: 'U1000', entryFee: 0 }
    const res = await save(admin, tournamentId, { sections: [...renamed(loaded, ids.Open, 'Championship'), added] })
    expect(res.status).toBe(200)
    const rows = await liveRows(tournamentId)
    expect(rows.slice(0, 2)).toEqual([{ id: ids.Open, name: 'Championship' }, { id: ids.U1600, name: 'U1600' }])
    expect(rows[2].name).toBe('U1000')
    expect([ids.Open, ids.U1600]).not.toContain(rows[2].id)
    for (const id of openEntries) expect(await entry(id)).toEqual({ section: 'Championship', section_id: ids.Open })
  })

  it('without the ids the same rename is a removal and is refused while the section has entries', async () => {
    const admin = await seedAdmin()
    const { tournamentId, ids } = await eventWithEntries()
    const before = await state(tournamentId)
    const withoutIds = renamed(await loadForManagePage(admin, tournamentId), ids.Open, 'Championship').map((s) => {
      const copy = { ...s }
      delete copy.id
      return copy
    })
    const res = await save(admin, tournamentId, { sections: withoutIds })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: '2 entries are in the Open section. Move them to another section first.' })
    expect(await state(tournamentId)).toEqual(before)
  })

  it('an assigned director and the organizing club rep may rename; another club rep and a plain member get 403 and nothing moves', async () => {
    const clubId = await seedClub()
    const { tournamentId, ids, openEntries } = await eventWithEntries({ clubId })
    const admin = await seedAdmin()
    const body: UpdateBody = { sections: renamed(await loadForManagePage(admin, tournamentId), ids.Open, 'Championship') }
    const before = await state(tournamentId)

    const otherRep = await seedMember({ role: 'club_rep', clubId: await seedClub() })
    const plain = await seedMember()
    for (const who of [otherRep, plain]) {
      const res = await save(who, tournamentId, body)
      expect(res.status).toBe(403)
      expect(await state(tournamentId)).toEqual(before)
    }
    const signedOut = await invoke(patchTournament, { method: 'PATCH', params: { id: tournamentId }, rawBody: JSON.stringify(body) })
    expect(signedOut.status).toBe(401)
    expect(await state(tournamentId)).toEqual(before)

    const director = await seedMember({ role: 'tournament_director' })
    await seedTournamentDirector(tournamentId, director)
    expect((await save(director, tournamentId, body)).status).toBe(200)
    for (const id of openEntries) expect(await entry(id)).toEqual({ section: 'Championship', section_id: ids.Open })

    const ownRep = await seedMember({ role: 'club_rep', clubId })
    expect((await save(ownRep, tournamentId, { sections: renamed(await loadForManagePage(ownRep, tournamentId), ids.Open, 'Main') })).status).toBe(200)
    for (const id of openEntries) expect(await entry(id)).toEqual({ section: 'Main', section_id: ids.Open })
  })
})

describe('copying sections in the wizard', () => {
  it('creates new rows for the new event and leaves the source event alone', async () => {
    const admin = await seedAdmin()
    const { tournamentId: sourceId, ids } = await eventWithEntries()
    const sourceBefore = await state(sourceId)

    const list = await invoke(listTournaments, { as: admin })
    const { tournaments } = await list.json<{ tournaments: ApiTournamentListItem[] }>()
    const src = tournaments.find((t) => t.id === sourceId)!
    // What the wizard's "From an existing tournament" step keeps.
    const sections = src.sections.map((s) => {
      const copy: ApiSectionDraft = { ...s }
      delete copy.id
      return copy
    })
    const body: CreateBody = { name: 'Copied Open', location: 'Kenner, LA', date: '2026-11-07', entryFee: sections[0].entryFee, sections, status: 'upcoming' }
    const created = await invoke(createTournament, { method: 'POST', as: admin, rawBody: JSON.stringify(body) })
    expect(created.status).toBe(201)
    const { tournament } = await created.json<{ tournament: { id: string; sections: Array<{ id: string; name: string; entryFee: number }> } }>()

    expect(tournament.sections.map((s) => [s.name, s.entryFee])).toEqual([['Open', 40], ['U1600', 30]])
    for (const s of tournament.sections) expect(Object.values(ids)).not.toContain(s.id)
    expect((await liveRows(tournament.id)).map((r) => r.id)).toEqual(tournament.sections.map((s) => s.id))
    expect(await state(sourceId)).toEqual(sourceBefore)
  })
})
