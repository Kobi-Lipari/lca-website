// test/integration/sections-writer.test.ts
//
// K2b: functions/utils/events/sectionsRepo.ts is the one writer of a
// tournament's sections, through the admin POST and PATCH (and the
// factory). After every write here, syncCheck proves:
//
// - the live tournament_sections rows match the legacy JSON column: names,
//   order, fees, prize funds, rules, prizes and the leftover keys, worked
//   out as the 0053 trigger works them out
// - the JSON keeps today's shape: no id, cap or fees in it
// - the 0053 update trigger is installed, and running it again (an UPDATE
//   that sets sections to itself) changes no section row and no entry
//
// Because that trigger also fires on the writer's own JSON write, and would
// quietly repair a table the writer got wrong, "the trigger finds the table
// final" runs each plan in two batches, everything before the JSON write and
// then the JSON write alone, and shows the second one changes nothing.
// - every entry points at a section of its own name in its own event
//
// On a tournament with entries and pairings it also covers renames (by id),
// swaps and a three-way rotation, removals (decision 7: refused while a
// section has entries that are not withdrawn, or games), repeated names,
// caps and tier prices, and that each edit is one D1 batch. A plan that went
// stale before its batch ran (another save, a late entry or game on a section
// being removed) fails as a whole, and the PATCH answers 409.
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getDb } from '../../functions/db/client'
import { tournamentSections } from '../../functions/db/schema'
import {
  buildSaveSections, columnsFromLegacy, isSectionsConflict, loadSections, loadSectionsFor, runBatch, saveSections,
} from '../../functions/utils/events/sectionsRepo'
import type { SectionInput, SectionListItem } from '../../domain/events/sections'
import { normalizeLegacySections, SECTIONS_CHANGED_MESSAGE, tierFees } from '../../domain/events/sections'
import { onRequestPost as createTournament } from '../../functions/api/admin/tournaments'
import { onRequestPatch as patchTournament } from '../../functions/api/admin/tournaments/[id]'
import { invoke, resetHarness } from './harness'
import { seedAdmin, seedClub, seedMember, seedRegistration, seedTournament } from './factories'

beforeEach(resetHarness)

interface SectionRow {
  id: string
  tournament_id: string
  position: number
  name: string
  fee_regular: number | null
  fee_early: number | null
  fee_late: number | null
  cap: number | null
  prize_fund: string | null
  rating_min: number | null
  rating_max: number | null
  unrated_ok: number | null
  grade_min: number | null
  grade_max: number | null
  rules_set: number
  prizes_json: string | null
  extra_json: string | null
  archived_at: string | null
}

const allRows = async (tournamentId: string) =>
  (await env.DB.prepare('SELECT * FROM tournament_sections WHERE tournament_id = ? ORDER BY id').bind(tournamentId).all<SectionRow>()).results
const liveRows = async (tournamentId: string) =>
  (await env.DB.prepare('SELECT * FROM tournament_sections WHERE tournament_id = ? AND archived_at IS NULL ORDER BY position')
    .bind(tournamentId).all<SectionRow>()).results
const idsByName = async (tournamentId: string) => Object.fromEntries((await liveRows(tournamentId)).map((r) => [r.name, r.id]))
const storedJson = async (tournamentId: string) =>
  (await env.DB.prepare('SELECT sections FROM tournaments WHERE id = ?').bind(tournamentId).first<{ sections: string }>())?.sections as string
const entries = async (tournamentId: string) =>
  (await env.DB.prepare('SELECT id, member_id, section, section_id FROM registrations WHERE tournament_id = ? ORDER BY id')
    .bind(tournamentId).all<{ id: string; member_id: string; section: string; section_id: string | null }>()).results
const gameSections = async (tournamentId: string) =>
  (await env.DB.prepare('SELECT id, section FROM tournament_games WHERE tournament_id = ? ORDER BY id')
    .bind(tournamentId).all<{ id: string; section: string }>()).results
const reportSettings = async (tournamentId: string) =>
  (await env.DB.prepare('SELECT report_settings FROM tournaments WHERE id = ?').bind(tournamentId).first<{ report_settings: string | null }>())?.report_settings

/** The checks every write must pass; see the header. */
async function syncCheck(tournamentId: string) {
  const trigger = await env.DB.prepare(`SELECT name FROM sqlite_master WHERE type = 'trigger' AND name = 'tournaments_sections_sync_update'`).first()
  expect(trigger, 'the 0053 update trigger is installed').not.toBeNull()

  const json = await storedJson(tournamentId)
  const raw = JSON.parse(json) as Array<Record<string, unknown>>
  for (const element of raw) {
    expect(Object.keys(element), 'the JSON keeps today\'s shape').not.toEqual(expect.arrayContaining(['id']))
    expect(element).not.toHaveProperty('cap')
    expect(element).not.toHaveProperty('fees')
  }
  const legacy = normalizeLegacySections(json)
  expect(legacy).toHaveLength(raw.length)
  const live = await liveRows(tournamentId)
  expect(live.map((r) => [r.name, r.position])).toEqual(legacy.map((s, i) => [s.name, i]))
  live.forEach((row, i) => {
    const c = columnsFromLegacy(legacy[i])
    expect({
      fee_regular: row.fee_regular, prize_fund: row.prize_fund, rating_min: row.rating_min, rating_max: row.rating_max,
      unrated_ok: row.unrated_ok, grade_min: row.grade_min, grade_max: row.grade_max, rules_set: row.rules_set,
      prizes: row.prizes_json === null ? null : JSON.parse(row.prizes_json), extra: row.extra_json === null ? null : JSON.parse(row.extra_json),
    }, row.name).toEqual({
      fee_regular: c.feeRegular, prize_fund: c.prizeFund, rating_min: c.ratingMin, rating_max: c.ratingMax,
      unrated_ok: c.unratedOk, grade_min: c.gradeMin, grade_max: c.gradeMax, rules_set: c.rulesSet,
      prizes: c.prizesJson === null ? null : JSON.parse(c.prizesJson), extra: c.extraJson === null ? null : JSON.parse(c.extraJson),
    })
  })

  // The trigger, run again on the final JSON, finds nothing to change.
  const before = [await allRows(tournamentId), await entries(tournamentId)]
  await env.DB.prepare('UPDATE tournaments SET sections = sections WHERE id = ?').bind(tournamentId).run()
  expect([await allRows(tournamentId), await entries(tournamentId)]).toEqual(before)

  const byId = new Map((await allRows(tournamentId)).map((r) => [r.id, r]))
  for (const entry of await entries(tournamentId)) {
    const row = byId.get(entry.section_id as string)
    expect(row, `entry ${entry.id} has its section`).toBeDefined()
    expect(row?.name).toBe(entry.section)
  }
}

const patch = (as: string, id: string, body: unknown) => invoke(patchTournament, { method: 'PATCH', as, params: { id }, body })

async function insertGame(tournamentId: string, section: string, white: string, black: string | null, round = 1) {
  const id = `game-${crypto.randomUUID()}`
  await env.DB.prepare(
    `INSERT INTO tournament_games (id, tournament_id, round, board, section, white_member_id, black_member_id, result)
     VALUES (?, ?, ?, 1, ?, ?, ?, 'pending')`,
  ).bind(id, tournamentId, round, section, white, black).run()
  return id
}

/** A tournament with three sections, two entries and a pairing in each, and per-section report settings. */
async function pairedEvent() {
  const tournamentId = await seedTournament({
    sections: [{ name: 'Open', entryFee: 40 }, { name: 'U1600', entryFee: 30, ratingMax: 1599, rulesSet: true }, { name: 'U1000', entryFee: 20 }],
  })
  const people: Record<string, { entries: string[]; game: string }> = {}
  for (const section of ['Open', 'U1600', 'U1000']) {
    const a = await seedMember()
    const b = await seedMember()
    const entryIds = [
      await seedRegistration({ tournamentId, memberId: a, section }),
      await seedRegistration({ tournamentId, memberId: b, section }),
    ]
    people[section] = { entries: entryIds, game: await insertGame(tournamentId, section, a, b) }
  }
  await env.DB.prepare('UPDATE tournaments SET report_settings = ? WHERE id = ?').bind(JSON.stringify({
    affiliateId: 'A6000001',
    sections: {
      Open: { ratingSystem: 'R', sendCrosstable: true },
      U1600: { ratingSystem: 'D', sendCrosstable: false },
      U1000: { ratingSystem: 'Q', sendCrosstable: true },
    },
  }), tournamentId).run()
  const ids = await idsByName(tournamentId)
  return { tournamentId, ids, people }
}

const sectionOfEntry = async (entryId: string) =>
  env.DB.prepare('SELECT section, section_id FROM registrations WHERE id = ?').bind(entryId).first<{ section: string; section_id: string }>()
const sectionOfGame = async (gameId: string) =>
  (await env.DB.prepare('SELECT section FROM tournament_games WHERE id = ?').bind(gameId).first<{ section: string }>())?.section

describe('the writer keeps the rows and the JSON together', () => {
  it('create, edit by name, reorder, add and remove an empty section through the endpoints', async () => {
    const admin = await seedAdmin()
    const created = await invoke(createTournament, {
      method: 'POST', as: admin,
      body: {
        name: 'Writer Open', location: 'Kenner, LA', date: '2026-11-07', entryFee: 30,
        sections: [
          { name: 'Open', entryFee: 30, prizeFund: '$800' },
          { name: 'U1400', entryFee: 20, ratingMax: 1399, unratedOk: true, rulesSet: true, prizes: { place: [{ amount: 100 }] } },
          { name: 'K-5', gradeMin: 0, gradeMax: 5, note: 'Lunch on site' },
        ],
      },
    })
    expect(created.status).toBe(201)
    const { tournament } = await created.json<{ tournament: { id: string; sections: Array<{ id: string; name: string }> } }>()
    const tournamentId = tournament.id
    await syncCheck(tournamentId)
    const ids = await idsByName(tournamentId)
    expect(tournament.sections.map((s) => s.id)).toEqual([ids.Open, ids.U1400, ids['K-5']])
    // The key the writer has no column for stays in the JSON and in extra_json.
    expect((await liveRows(tournamentId))[2].extra_json).toBe('{"note":"Lunch on site"}')

    // The setup form sends no ids: sections match by name and keep their rows.
    const byName = [
      { name: 'U1400', entryFee: 25, ratingMax: 1399, unratedOk: false, rulesSet: true },
      { name: 'Open', entryFee: 35, prizeFund: '$900' },
      { name: 'K-5', gradeMin: 0, gradeMax: 5 },
      { name: 'Scholastic', entryFee: 0 },
    ]
    expect((await patch(admin, tournamentId, { sections: byName })).status).toBe(200)
    await syncCheck(tournamentId)
    expect(JSON.parse(await storedJson(tournamentId))).toEqual(byName)
    const after = await idsByName(tournamentId)
    expect([after.U1400, after.Open, after['K-5']]).toEqual([ids.U1400, ids.Open, ids['K-5']])
    expect((await liveRows(tournamentId)).map((r) => r.name)).toEqual(['U1400', 'Open', 'K-5', 'Scholastic'])
    expect(after.Scholastic).toMatch(/^[0-9a-f]{16}$/)

    // An empty section left out is archived, not deleted.
    expect((await patch(admin, tournamentId, { sections: byName.slice(0, 3) })).status).toBe(200)
    await syncCheck(tournamentId)
    const scholastic = (await allRows(tournamentId)).find((r) => r.id === after.Scholastic)
    expect(scholastic?.archived_at).not.toBeNull()

    // Sent back by name, the archived row returns with its id.
    expect((await patch(admin, tournamentId, { sections: byName })).status).toBe(200)
    await syncCheck(tournamentId)
    expect((await idsByName(tournamentId)).Scholastic).toBe(after.Scholastic)
  })

  it('a PATCH without sections, or with sections: null, writes no section row and leaves the JSON text as it was', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament()
    const rows = await allRows(tournamentId)
    const json = await storedJson(tournamentId)
    expect((await patch(admin, tournamentId, { name: 'Renamed' })).status).toBe(200)
    expect((await patch(admin, tournamentId, { sections: null, roundSchedule: [{ round: 1, date: '2026-09-12', time: '10:00' }] })).status).toBe(200)
    expect(await allRows(tournamentId)).toEqual(rows)
    expect(await storedJson(tournamentId)).toBe(json)
    await syncCheck(tournamentId)
  })

  it('the factory writes through the same writer', async () => {
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 10 }, 'Reserve' as unknown as { name: string; entryFee: number }] })
    await syncCheck(tournamentId)
    expect(JSON.parse(await storedJson(tournamentId))).toEqual([{ name: 'Open', entryFee: 10 }, { name: 'Reserve' }])
  })

  it('old code writing only the JSON (the deploy window) is still followed by the 0053 trigger', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 10 }] })
    const openId = (await idsByName(tournamentId)).Open
    await env.DB.prepare('UPDATE tournaments SET sections = ? WHERE id = ?')
      .bind(JSON.stringify([{ name: 'Open', entryFee: 12 }, { name: 'Late Add', entryFee: 5 }]), tournamentId).run()
    await syncCheck(tournamentId)
    expect((await liveRows(tournamentId)).map((r) => [r.id === openId, r.name, r.fee_regular])).toEqual([[true, 'Open', 12], [false, 'Late Add', 5]])
    // And the next edit through the writer carries on from there.
    expect((await patch(admin, tournamentId, { sections: [{ name: 'Late Add', entryFee: 6 }, { name: 'Open', entryFee: 12 }] })).status).toBe(200)
    await syncCheck(tournamentId)
  })
})

describe('the trigger finds the table final', () => {
  /** Runs a save in two batches and returns what the JSON write (and its trigger) changed. */
  async function saveInTwoSteps(tournamentId: string, input: SectionListItem[]) {
    const db = getDb(env.DB)
    const plan = await buildSaveSections(db, tournamentId, input)
    if (!plan.ok) throw new Error(plan.error)
    const last = plan.queries[plan.queries.length - 1]
    await runBatch(db, plan.queries.slice(0, -1))
    const before = [await allRows(tournamentId), await entries(tournamentId)]
    await runBatch(db, [last])
    const after = [await allRows(tournamentId), await entries(tournamentId)]
    await syncCheck(tournamentId)
    return { before, after }
  }

  it('for new sections, edits by name, renames, swaps, removals, returns, legacy keys, prizes, caps and fees', async () => {
    const { tournamentId, ids } = await pairedEvent()
    const steps: SectionInput[][] = [
      [
        { name: 'Open', entryFee: 45, prizeFund: '$1,000', prizes: { place: [{ amount: 300 }, { label: 'Trophy' }] } },
        { name: 'U1600', entryFee: 30, ratingMax: 1599, unratedOk: false, rulesSet: true, cap: 30, fees: { early: 25, late: null } },
        { name: 'U1000', entryFee: 20, gradeMax: 8, note: 'kept', ratingMin: 'not a number' },
        { name: 'Blitz' },
      ],
      [
        { id: ids.U1600, name: 'Open', entryFee: 30 },
        { id: ids.Open, name: 'U1600', entryFee: 45, unratedOk: null, rulesSet: null, prizes: null },
        { id: ids.U1000, name: 'Rapid', entryFee: 20 },
        { name: 'Blitz', entryFee: 5 },
      ],
      [
        { id: ids.U1600, name: 'Open', entryFee: 30 },
        { id: ids.Open, name: 'U1600', entryFee: 45 },
        { id: ids.U1000, name: 'Rapid', entryFee: 20 },
      ],
      [
        { id: ids.U1000, name: 'Rapid', entryFee: 20 },
        { id: ids.U1600, name: 'Open', entryFee: 30 },
        { id: ids.Open, name: 'U1600', entryFee: 45 },
        { name: 'Blitz', entryFee: 6 },
        { name: 'Brand New', entryFee: 0, prizeFund: null },
      ],
    ]
    for (const [i, input] of steps.entries()) {
      const { before, after } = await saveInTwoSteps(tournamentId, input)
      expect(after, `step ${i + 1}: the JSON write changed the table`).toEqual(before)
    }
    expect((await liveRows(tournamentId)).map((r) => r.name)).toEqual(['Rapid', 'Open', 'U1600', 'Blitz', 'Brand New'])
  })

  it('for a brand new tournament with a legacy string section', async () => {
    const tournamentId = await seedTournament({ sections: [] })
    const { before, after } = await saveInTwoSteps(tournamentId, [{ name: 'Open', entryFee: 10 }, 'Reserve'])
    expect(after).toEqual(before)
    expect(JSON.parse(await storedJson(tournamentId))).toEqual([{ name: 'Open', entryFee: 10 }, 'Reserve'])
  })

  it('for a stored list of bare names and old values sent back through PATCH with a section added', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ sections: [] })
    const stored: SectionListItem[] = ['Open', 'U1400', { name: 'Reserve', entryFee: '40', unratedOk: 'yes' }]
    await env.DB.prepare('UPDATE tournaments SET sections = ? WHERE id = ?').bind(JSON.stringify(stored), tournamentId).run()
    await syncCheck(tournamentId)
    const ids = await idsByName(tournamentId)
    const member = await seedMember()
    await seedRegistration({ tournamentId, memberId: member, section: 'U1400' })

    const sent = ['Open', { name: 'U1400', entryFee: 15 }, ...stored.slice(2), { name: 'Scholastic', entryFee: 0 }]
    expect((await patch(admin, tournamentId, { sections: sent })).status).toBe(200)
    await syncCheck(tournamentId)
    expect(JSON.parse(await storedJson(tournamentId))).toEqual(sent)
    const after = await idsByName(tournamentId)
    expect([after.Open, after.U1400, after.Reserve]).toEqual([ids.Open, ids.U1400, ids.Reserve])
    expect((await entries(tournamentId)).map((e) => e.section_id)).toEqual([ids.U1400])
  })
})

describe('renames keep the section and move what hangs off it', () => {
  it('a rename by id keeps the id and moves entries, games and the report settings key', async () => {
    const admin = await seedAdmin()
    const { tournamentId, ids, people } = await pairedEvent()
    const res = await patch(admin, tournamentId, {
      sections: [
        { id: ids.Open, name: 'Championship', entryFee: 40 },
        { id: ids.U1600, name: 'U1600', entryFee: 30, ratingMax: 1599, rulesSet: true },
        { id: ids.U1000, name: 'U1000', entryFee: 20 },
      ],
    })
    expect(res.status).toBe(200)
    await syncCheck(tournamentId)
    expect((await idsByName(tournamentId)).Championship).toBe(ids.Open)
    for (const entry of people.Open.entries) expect(await sectionOfEntry(entry)).toEqual({ section: 'Championship', section_id: ids.Open })
    expect(await sectionOfGame(people.Open.game)).toBe('Championship')
    expect(await sectionOfGame(people.U1600.game)).toBe('U1600')
    expect(JSON.parse(await reportSettings(tournamentId) as string)).toEqual({
      affiliateId: 'A6000001',
      sections: {
        Championship: { ratingSystem: 'R', sendCrosstable: true },
        U1600: { ratingSystem: 'D', sendCrosstable: false },
        U1000: { ratingSystem: 'Q', sendCrosstable: true },
      },
    })
    // The JSON has no ids even though the request did.
    expect(JSON.parse(await storedJson(tournamentId))[0]).toEqual({ name: 'Championship', entryFee: 40 })
  })

  it('a swap (Open to U1600 and U1600 to Open) succeeds and leaves every entry on its own section id', async () => {
    const admin = await seedAdmin()
    const { tournamentId, ids, people } = await pairedEvent()
    const res = await patch(admin, tournamentId, {
      sections: [
        { id: ids.Open, name: 'U1600', entryFee: 40 },
        { id: ids.U1600, name: 'Open', entryFee: 30 },
        { id: ids.U1000, name: 'U1000', entryFee: 20 },
      ],
    })
    expect(res.status, JSON.stringify(await res.json())).toBe(200)
    await syncCheck(tournamentId)
    expect(await idsByName(tournamentId)).toEqual({ U1600: ids.Open, Open: ids.U1600, U1000: ids.U1000 })
    for (const entry of people.Open.entries) expect(await sectionOfEntry(entry)).toEqual({ section: 'U1600', section_id: ids.Open })
    for (const entry of people.U1600.entries) expect(await sectionOfEntry(entry)).toEqual({ section: 'Open', section_id: ids.U1600 })
    expect(await sectionOfGame(people.Open.game)).toBe('U1600')
    expect(await sectionOfGame(people.U1600.game)).toBe('Open')
    const settings = JSON.parse(await reportSettings(tournamentId) as string) as { sections: Record<string, { ratingSystem: string }> }
    expect(settings.sections.U1600.ratingSystem).toBe('R')
    expect(settings.sections.Open.ratingSystem).toBe('D')
  })

  it('a three-way rotation succeeds, and the same request again changes nothing', async () => {
    const admin = await seedAdmin()
    const { tournamentId, ids, people } = await pairedEvent()
    const body = {
      sections: [
        { id: ids.Open, name: 'U1600', entryFee: 40 },
        { id: ids.U1600, name: 'U1000', entryFee: 30 },
        { id: ids.U1000, name: 'Open', entryFee: 20 },
      ],
    }
    expect((await patch(admin, tournamentId, body)).status).toBe(200)
    await syncCheck(tournamentId)
    expect(await idsByName(tournamentId)).toEqual({ U1600: ids.Open, U1000: ids.U1600, Open: ids.U1000 })
    const expected: Record<string, [string, string]> = { Open: ['U1600', ids.Open], U1600: ['U1000', ids.U1600], U1000: ['Open', ids.U1000] }
    for (const [was, [now, id]] of Object.entries(expected)) {
      for (const entry of people[was].entries) expect(await sectionOfEntry(entry)).toEqual({ section: now, section_id: id })
      expect(await sectionOfGame(people[was].game)).toBe(now)
    }
    const settings = JSON.parse(await reportSettings(tournamentId) as string) as { sections: Record<string, { ratingSystem: string }> }
    expect(Object.fromEntries(Object.entries(settings.sections).map(([k, v]) => [k, v.ratingSystem]))).toEqual({ U1600: 'R', U1000: 'D', Open: 'Q' })

    const snapshot = [await allRows(tournamentId), await entries(tournamentId), await gameSections(tournamentId), await reportSettings(tournamentId)]
    expect((await patch(admin, tournamentId, body)).status).toBe(200)
    expect([await allRows(tournamentId), await entries(tournamentId), await gameSections(tournamentId), await reportSettings(tournamentId)]).toEqual(snapshot)
  })

  it('report settings that are not an object with sections are left alone by a rename', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 10 }] })
    const ids = await idsByName(tournamentId)
    await env.DB.prepare('UPDATE tournaments SET report_settings = ? WHERE id = ?').bind('{"affiliateId":"A1"}', tournamentId).run()
    expect((await patch(admin, tournamentId, { sections: [{ id: ids.Open, name: 'Main', entryFee: 10 }] })).status).toBe(200)
    expect(await reportSettings(tournamentId)).toBe('{"affiliateId":"A1"}')
    await syncCheck(tournamentId)
  })
})

describe('removing a section (decision 7)', () => {
  it('is refused while it has entries that are not withdrawn, waitlisted ones included, and nothing is written', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 0 }, { name: 'Reserve', entryFee: 0 }] })
    const first = await seedRegistration({ tournamentId, memberId: await seedMember(), section: 'Reserve' })
    const second = await seedRegistration({ tournamentId, memberId: await seedMember(), section: 'Reserve' })
    const third = await seedRegistration({ tournamentId, memberId: await seedMember(), section: 'Reserve' })
    await env.DB.prepare(`UPDATE registrations SET waitlisted_at = datetime('now') WHERE id = ?`).bind(second).run()
    await env.DB.prepare(`UPDATE registrations SET withdrawn_at = datetime('now') WHERE id = ?`).bind(third).run()
    const snapshot = [await allRows(tournamentId), await storedJson(tournamentId), await entries(tournamentId)]

    const res = await patch(admin, tournamentId, { name: 'Should not save', sections: [{ name: 'Open', entryFee: 0 }] })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: '2 entries are in the Reserve section. Move them to another section first.' })
    expect([await allRows(tournamentId), await storedJson(tournamentId), await entries(tournamentId)]).toEqual(snapshot)
    expect((await env.DB.prepare('SELECT name FROM tournaments WHERE id = ?').bind(tournamentId).first<{ name: string }>())?.name).not.toBe('Should not save')
    expect(first).toBeTruthy()
  })

  it('is refused while it has games, even with every entry withdrawn', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 0 }, { name: 'Blitz', entryFee: 0 }] })
    const player = await seedMember()
    const entry = await seedRegistration({ tournamentId, memberId: player, section: 'Blitz' })
    await insertGame(tournamentId, 'Blitz', player, null)
    await env.DB.prepare(`UPDATE registrations SET withdrawn_at = datetime('now') WHERE id = ?`).bind(entry).run()
    const res = await patch(admin, tournamentId, { sections: [{ name: 'Open', entryFee: 0 }] })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Games have been paired in the Blitz section, so it cannot be removed.' })
    expect((await liveRows(tournamentId)).map((r) => r.name)).toEqual(['Open', 'Blitz'])
  })

  it('archives an empty section; withdrawn entries keep their section_id on the archived row', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 0 }, { name: 'Reserve', entryFee: 0 }] })
    const reserveId = (await idsByName(tournamentId)).Reserve
    const entry = await seedRegistration({ tournamentId, memberId: await seedMember(), section: 'Reserve' })
    await env.DB.prepare(`UPDATE registrations SET withdrawn_at = datetime('now') WHERE id = ?`).bind(entry).run()
    expect((await patch(admin, tournamentId, { sections: [{ name: 'Open', entryFee: 0 }] })).status).toBe(200)
    await syncCheck(tournamentId)
    const archived = (await allRows(tournamentId)).filter((r) => r.archived_at !== null)
    expect(archived.map((r) => [r.id, r.name])).toEqual([[reserveId, 'Reserve']])
    expect(await sectionOfEntry(entry)).toEqual({ section: 'Reserve', section_id: reserveId })
  })

  it('removing a section and adding one in the same list moves nobody', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 0 }, { name: 'Old', entryFee: 0 }] })
    const entry = await seedRegistration({ tournamentId, memberId: await seedMember(), section: 'Open' })
    const before = await sectionOfEntry(entry)
    expect((await patch(admin, tournamentId, { sections: [{ name: 'Open', entryFee: 0 }, { name: 'New', entryFee: 0 }] })).status).toBe(200)
    await syncCheck(tournamentId)
    expect(await sectionOfEntry(entry)).toEqual(before)
  })
})

describe('lists the writer refuses', () => {
  it('repeated live names are 400 in the plain { error } shape, on PATCH and POST, and nothing is written', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament()
    const snapshot = [await allRows(tournamentId), await storedJson(tournamentId)]
    const res = await patch(admin, tournamentId, { sections: [{ name: 'Open', entryFee: 0 }, { name: 'U1200', entryFee: 0 }, { name: 'Open', entryFee: 5 }] })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Two sections are named “Open”. Give each section its own name.' })
    expect([await allRows(tournamentId), await storedJson(tournamentId)]).toEqual(snapshot)

    const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM tournaments').first<{ n: number }>()
    const post = await invoke(createTournament, {
      method: 'POST', as: admin,
      body: { name: 'Twice', location: 'Kenner, LA', date: '2026-11-07', entryFee: 5, sections: [{ name: 'A', entryFee: 5 }, { name: 'A', entryFee: 5 }] },
    })
    expect(post.status).toBe(400)
    expect(Object.keys(await post.json())).toEqual(['error'])
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM tournaments').first<{ n: number }>()).toEqual(count)
  })

  it('the same id twice, or an id from another event, is 400 and nothing is written', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament()
    const otherEvent = await seedTournament()
    const ids = await idsByName(tournamentId)
    const foreignId = (await idsByName(otherEvent)).Open
    const snapshot = [await allRows(tournamentId), await allRows(otherEvent), await storedJson(tournamentId)]

    const twice = await patch(admin, tournamentId, { sections: [{ id: ids.Open, name: 'Open', entryFee: 0 }, { id: ids.Open, name: 'Again', entryFee: 0 }] })
    expect(twice.status).toBe(400)
    expect(await twice.json()).toEqual({ error: 'The same section is listed twice.' })

    const foreign = await patch(admin, tournamentId, { sections: [{ id: foreignId, name: 'Stolen', entryFee: 0 }, { name: 'Open', entryFee: 0 }, { name: 'U1200', entryFee: 0 }] })
    expect(foreign.status).toBe(400)
    expect(await foreign.json()).toEqual({ error: 'One of these sections is not part of this event. Reload the page and try again.' })
    expect([await allRows(tournamentId), await allRows(otherEvent), await storedJson(tournamentId)]).toEqual(snapshot)
  })

  it('role safety: another club’s rep and a plain member get 403 and nothing is written', async () => {
    const clubId = await seedClub()
    const tournamentId = await seedTournament({ clubId })
    const snapshot = [await allRows(tournamentId), await storedJson(tournamentId)]
    const otherRep = await seedMember({ role: 'club_rep', clubId: await seedClub() })
    for (const who of [otherRep, await seedMember()]) {
      const res = await patch(who, tournamentId, { sections: [{ name: 'Hijacked', entryFee: 0 }] })
      expect(res.status).toBe(403)
    }
    const ownRep = await seedMember({ role: 'club_rep', clubId })
    const move = await patch(ownRep, tournamentId, { clubId: null, sections: [{ name: 'Open', entryFee: 1 }] })
    expect(move.status).toBe(403)
    expect([await allRows(tournamentId), await storedJson(tournamentId)]).toEqual(snapshot)
  })
})

describe('caps and tier prices live in the table only', () => {
  it('are set by id, kept when a later list leaves them out, cleared by null, and never reach the JSON', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ entryFee: 25, sections: [{ name: 'Open', entryFee: 40 }, { name: 'Reserve' } as { name: string; entryFee: number }] })
    const ids = await idsByName(tournamentId)
    await env.DB.prepare(`UPDATE tournaments SET early_deadline = '2026-09-01T23:59', early_discount = 5, late_after = '2026-09-10T12:00', late_fee = 10 WHERE id = ?`)
      .bind(tournamentId).run()

    expect((await patch(admin, tournamentId, {
      sections: [{ id: ids.Open, name: 'Open', entryFee: 40, cap: 40, fees: { early: 30 } }, { id: ids.Reserve, name: 'Reserve' }],
    })).status).toBe(200)
    await syncCheck(tournamentId)
    const tournament = await env.DB.prepare('SELECT entry_fee, early_deadline, early_discount, late_after, late_fee FROM tournaments WHERE id = ?')
      .bind(tournamentId).first<{ entry_fee: number; early_deadline: string; early_discount: number; late_after: string; late_fee: number }>()
    const [open, reserve] = await loadSections(getDb(env.DB), tournamentId)
    expect(open).toMatchObject({ id: ids.Open, cap: 40, feeRegular: 40, feeEarly: 30, feeLate: null })
    expect(tierFees(open, tournament!)).toEqual({ regular: 40, early: 30, late: 50 })
    expect(tierFees(reserve, tournament!)).toEqual({ regular: 25, early: 20, late: 35 })

    // The setup form sends neither cap nor fees: both stay.
    expect((await patch(admin, tournamentId, { sections: [{ name: 'Open', entryFee: 45 }, { name: 'Reserve' }] })).status).toBe(200)
    await syncCheck(tournamentId)
    expect((await loadSections(getDb(env.DB), tournamentId))[0]).toMatchObject({ id: ids.Open, cap: 40, feeRegular: 45, feeEarly: 30 })

    // null clears them.
    expect((await patch(admin, tournamentId, { sections: [{ id: ids.Open, name: 'Open', entryFee: 45, cap: null, fees: { early: null } }, { name: 'Reserve' }] })).status).toBe(200)
    expect((await loadSections(getDb(env.DB), tournamentId))[0]).toMatchObject({ cap: null, feeEarly: null })
    expect(JSON.parse(await storedJson(tournamentId))).toEqual([{ name: 'Open', entryFee: 45 }, { name: 'Reserve' }])
  })
})

describe('reading the sections back', () => {
  it('loadSectionsFor reads more events than D1 binds in one statement, live rows only unless asked', async () => {
    const db = getDb(env.DB)
    const ids: string[] = []
    for (let i = 0; i < 105; i++) ids.push(await seedTournament({ sections: [{ name: `S${i}`, entryFee: i }] }))
    const archivedOne = ids[0]
    await env.DB.prepare(`UPDATE tournament_sections SET archived_at = datetime('now') WHERE tournament_id = ?`).bind(archivedOne).run()
    const found = await loadSectionsFor(db, [...ids, 'no-such-event', ids[1]])
    expect(found.size).toBe(106)
    expect(found.get('no-such-event')).toEqual([])
    expect(found.get(archivedOne)).toEqual([])
    expect(found.get(ids[104])?.map((s) => [s.name, s.feeRegular])).toEqual([['S104', 104]])
    const withArchived = await loadSectionsFor(db, [archivedOne], { includeArchived: true })
    expect(withArchived.get(archivedOne)?.map((s) => s.name)).toEqual(['S0'])
  })
})

describe('each edit is one D1 batch', () => {
  /** Records the statements run on env.DB: those sent alone and those sent in a batch. */
  async function recording<T>(work: () => Promise<T>) {
    const real = env.DB
    const alone: string[] = []
    const batches: string[][] = []
    const SQL = Symbol('sql')
    const REAL = Symbol('real')
    type Tagged = D1PreparedStatement & { [SQL]?: string; [REAL]?: D1PreparedStatement }
    const wrap = (stmt: D1PreparedStatement, text: string): D1PreparedStatement => new Proxy(stmt, {
      get(target, prop) {
        if (prop === SQL) return text
        if (prop === REAL) return target
        if (prop === 'bind') return (...values: unknown[]) => wrap(target.bind(...values), text)
        if (prop === 'run' || prop === 'all' || prop === 'first' || prop === 'raw') {
          return (...args: unknown[]) => {
            alone.push(text)
            return (target[prop] as (...a: unknown[]) => unknown).apply(target, args)
          }
        }
        const value = Reflect.get(target, prop, target)
        return typeof value === 'function' ? value.bind(target) : value
      },
    })
    const proxy = new Proxy(real, {
      get(target, prop) {
        if (prop === 'prepare') return (text: string) => wrap(target.prepare(text), text)
        if (prop === 'batch') {
          return (stmts: Tagged[]) => {
            batches.push(stmts.map((s) => s[SQL] ?? '?'))
            return target.batch(stmts.map((s) => s[REAL] ?? s))
          }
        }
        const value = Reflect.get(target, prop, target)
        return typeof value === 'function' ? value.bind(target) : value
      },
    })
    const bindings = env as unknown as { DB: D1Database }
    bindings.DB = proxy
    try {
      const result = await work()
      const writesAlone = alone.filter((s) => /^\s*(insert|update|delete|replace)\b/i.test(s))
      return { result, writesAlone, batches }
    } finally {
      bindings.DB = real
    }
  }

  it('PATCH with sections: the tournament write and every section write go in one batch, the JSON last', async () => {
    const admin = await seedAdmin()
    const { tournamentId, ids } = await pairedEvent()
    const { result, writesAlone, batches } = await recording(() => patch(admin, tournamentId, {
      description: 'One batch',
      sections: [{ id: ids.Open, name: 'U1000', entryFee: 40 }, { id: ids.U1000, name: 'Open', entryFee: 20 }, { name: 'U1600', entryFee: 30 }],
    }))
    expect(result.status).toBe(200)
    expect(writesAlone).toEqual([])
    expect(batches).toHaveLength(1)
    const [batch] = batches
    expect(batch[0]).toMatch(/^update "tournaments" set "name"/)
    expect(batch[batch.length - 1]).toMatch(/^update "tournaments" set "sections" = \?/)
    expect(batch.filter((s) => /"sections" =/.test(s))).toHaveLength(1)
    await syncCheck(tournamentId)
  })

  it('PATCH without sections: one batch holding the one tournament update, nothing written alone', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament()
    const { result, writesAlone, batches } = await recording(() => patch(admin, tournamentId, { name: 'Only the name' }))
    expect(result.status).toBe(200)
    expect(writesAlone).toEqual([])
    expect(batches).toHaveLength(1)
    expect(batches[0]).toHaveLength(1)
    expect(batches[0][0]).toMatch(/^update "tournaments" set "name"/)
  })

  it('POST: the insert and the section writes go in one batch', async () => {
    const admin = await seedAdmin()
    const { result, writesAlone, batches } = await recording(() => invoke(createTournament, {
      method: 'POST', as: admin,
      body: { name: 'Batch Open', location: 'Kenner, LA', date: '2026-11-07', entryFee: 20, sections: [{ name: 'Open', entryFee: 20 }, { name: 'U1200', entryFee: 10 }] },
    }))
    expect(result.status).toBe(201)
    // recordAdminAction writes the audit log on its own, as before.
    expect(writesAlone.every((s) => /admin_audit_log|audit/i.test(s))).toBe(true)
    expect(batches).toHaveLength(1)
    expect(batches[0][0]).toMatch(/^insert into "tournaments"/)
    expect(batches[0][batches[0].length - 1]).toMatch(/^update "tournaments" set "sections" = \?/)
    const { tournament } = await result.json<{ tournament: { id: string } }>()
    await syncCheck(tournament.id)
  })
})

describe('edges: other events, archived names, withdrawn entries, stale ids', () => {
  const settingsFor = (names: string[]) => JSON.stringify({
    affiliateId: 'A6000001',
    sections: Object.fromEntries(names.map((n) => [n, { ratingSystem: 'R', sendCrosstable: true }])),
  })

  it('a rename leaves another event with the same section names alone', async () => {
    const admin = await seedAdmin()
    const mine = await pairedEvent()
    const theirs = await pairedEvent()
    const theirSnapshot = [
      await allRows(theirs.tournamentId), await entries(theirs.tournamentId), await gameSections(theirs.tournamentId),
      await reportSettings(theirs.tournamentId), await storedJson(theirs.tournamentId),
    ]
    const res = await patch(admin, mine.tournamentId, {
      sections: [
        { id: mine.ids.Open, name: 'U1600', entryFee: 40 },
        { id: mine.ids.U1600, name: 'Open', entryFee: 30 },
        { id: mine.ids.U1000, name: 'Scholastic', entryFee: 20 },
      ],
    })
    expect(res.status).toBe(200)
    await syncCheck(mine.tournamentId)
    await syncCheck(theirs.tournamentId)
    expect([
      await allRows(theirs.tournamentId), await entries(theirs.tournamentId), await gameSections(theirs.tournamentId),
      await reportSettings(theirs.tournamentId), await storedJson(theirs.tournamentId),
    ]).toEqual(theirSnapshot)
  })

  it('withdrawn and waitlisted entries follow a rename with their section', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 0 }, { name: 'Reserve', entryFee: 0 }] })
    const ids = await idsByName(tournamentId)
    const withdrawn = await seedRegistration({ tournamentId, memberId: await seedMember(), section: 'Reserve' })
    const waitlisted = await seedRegistration({ tournamentId, memberId: await seedMember(), section: 'Reserve' })
    await env.DB.prepare(`UPDATE registrations SET withdrawn_at = datetime('now') WHERE id = ?`).bind(withdrawn).run()
    await env.DB.prepare(`UPDATE registrations SET waitlisted_at = datetime('now') WHERE id = ?`).bind(waitlisted).run()
    const res = await patch(admin, tournamentId, {
      sections: [{ id: ids.Open, name: 'Open', entryFee: 0 }, { id: ids.Reserve, name: 'Under 1200', entryFee: 0 }],
    })
    expect(res.status).toBe(200)
    await syncCheck(tournamentId)
    expect(await sectionOfEntry(withdrawn)).toEqual({ section: 'Under 1200', section_id: ids.Reserve })
    expect(await sectionOfEntry(waitlisted)).toEqual({ section: 'Under 1200', section_id: ids.Reserve })
  })

  it('renaming a section to the name of an archived one leaves the archived row and its withdrawn entry where they are', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 0 }, { name: 'Old', entryFee: 0 }] })
    const ids = await idsByName(tournamentId)
    const gone = await seedRegistration({ tournamentId, memberId: await seedMember(), section: 'Old' })
    await env.DB.prepare(`UPDATE registrations SET withdrawn_at = datetime('now') WHERE id = ?`).bind(gone).run()
    const kept = await seedRegistration({ tournamentId, memberId: await seedMember(), section: 'Open' })
    expect((await patch(admin, tournamentId, { sections: [{ id: ids.Open, name: 'Open', entryFee: 0 }] })).status).toBe(200)

    const res = await patch(admin, tournamentId, { sections: [{ id: ids.Open, name: 'Old', entryFee: 0 }] })
    expect(res.status, JSON.stringify(await res.json())).toBe(200)
    await syncCheck(tournamentId)
    expect(await sectionOfEntry(kept)).toEqual({ section: 'Old', section_id: ids.Open })
    expect(await sectionOfEntry(gone)).toEqual({ section: 'Old', section_id: ids.Old })
    const rows = await allRows(tournamentId)
    expect(rows.find((r) => r.id === ids.Old)?.archived_at).not.toBeNull()
    expect(rows.find((r) => r.id === ids.Open)?.archived_at).toBeNull()
  })

  it('an id sent for an archived section brings that row back with its entries', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 0 }, { name: 'Old', entryFee: 0 }] })
    const ids = await idsByName(tournamentId)
    const gone = await seedRegistration({ tournamentId, memberId: await seedMember(), section: 'Old' })
    await env.DB.prepare(`UPDATE registrations SET withdrawn_at = datetime('now') WHERE id = ?`).bind(gone).run()
    expect((await patch(admin, tournamentId, { sections: [{ name: 'Open', entryFee: 0 }] })).status).toBe(200)
    // The page was open before the section was removed and sends its id back.
    const res = await patch(admin, tournamentId, { sections: [{ id: ids.Open, name: 'Open', entryFee: 0 }, { id: ids.Old, name: 'Revived', entryFee: 5 }] })
    expect(res.status).toBe(200)
    await syncCheck(tournamentId)
    expect((await idsByName(tournamentId)).Revived).toBe(ids.Old)
    expect(await sectionOfEntry(gone)).toEqual({ section: 'Revived', section_id: ids.Old })
  })

  it('an empty list archives every empty section, and is refused while any has entries', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 0 }, { name: 'Reserve', entryFee: 0 }] })
    await seedRegistration({ tournamentId, memberId: await seedMember(), section: 'Reserve' })
    const refused = await patch(admin, tournamentId, { sections: [] })
    expect(refused.status).toBe(400)
    expect(await refused.json()).toEqual({ error: '1 entry is in the Reserve section. Move it to another section first.' })
    await syncCheck(tournamentId)
    expect((await liveRows(tournamentId)).map((r) => r.name)).toEqual(['Open', 'Reserve'])

    const empty = await seedTournament({ sections: [{ name: 'Open', entryFee: 0 }, { name: 'Reserve', entryFee: 0 }] })
    expect((await patch(admin, empty, { sections: [] })).status).toBe(200)
    await syncCheck(empty)
    expect(await storedJson(empty)).toBe('[]')
    expect(await liveRows(empty)).toEqual([])
    expect((await allRows(empty)).every((r) => r.archived_at !== null)).toBe(true)
  })

  it('names of 80 characters, quotes and accented letters rename cleanly, with their games and report settings', async () => {
    const admin = await seedAdmin()
    const long = 'L'.repeat(80)
    const tricky = 'Café “A” – O\'Brien Cup'
    const tournamentId = await seedTournament({ sections: [{ name: long, entryFee: 0 }, { name: tricky, entryFee: 0 }] })
    const ids = await idsByName(tournamentId)
    const a = await seedMember()
    const b = await seedMember()
    const gameLong = await insertGame(tournamentId, long, a, b)
    const gameTricky = await insertGame(tournamentId, tricky, a, b, 2)
    await env.DB.prepare('UPDATE tournaments SET report_settings = ? WHERE id = ?').bind(settingsFor([long, tricky]), tournamentId).run()
    // swap the long one with the other one
    const res = await patch(admin, tournamentId, {
      sections: [{ id: ids[long], name: tricky, entryFee: 0 }, { id: ids[tricky], name: long, entryFee: 0 }],
    })
    expect(res.status, JSON.stringify(await res.json())).toBe(200)
    await syncCheck(tournamentId)
    expect(await sectionOfGame(gameLong)).toBe(tricky)
    expect(await sectionOfGame(gameTricky)).toBe(long)
    expect(Object.keys((JSON.parse(await reportSettings(tournamentId) as string) as { sections: object }).sections).sort()).toEqual([long, tricky].sort())

    const tooLong = await patch(admin, tournamentId, { sections: [{ id: ids[long], name: 'L'.repeat(81), entryFee: 0 }] })
    expect(tooLong.status).toBe(400)
  })

  it('names that differ only by capital letters are two sections', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament()
    const res = await patch(admin, tournamentId, { sections: [{ name: 'Open', entryFee: 0 }, { name: 'open', entryFee: 0 }] })
    expect(res.status).toBe(200)
    await syncCheck(tournamentId)
    expect((await liveRows(tournamentId)).map((r) => r.name)).toEqual(['Open', 'open'])
  })

  it('a body that sends report settings with the old key and renames the section moves that key too', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 0 }] })
    const ids = await idsByName(tournamentId)
    const res = await patch(admin, tournamentId, {
      reportSettings: { affiliateId: 'A6000002', sections: { Open: { ratingSystem: 'D', sendCrosstable: false } } },
      sections: [{ id: ids.Open, name: 'Championship', entryFee: 0 }],
    })
    expect(res.status).toBe(200)
    await syncCheck(tournamentId)
    expect(JSON.parse(await reportSettings(tournamentId) as string)).toEqual({
      affiliateId: 'A6000002', sections: { Championship: { ratingSystem: 'D', sendCrosstable: false } },
    })
  })

  it('no report settings stay none through a rename', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 0 }] })
    const ids = await idsByName(tournamentId)
    expect(await reportSettings(tournamentId)).toBeNull()
    expect((await patch(admin, tournamentId, { sections: [{ id: ids.Open, name: 'Main', entryFee: 0 }] })).status).toBe(200)
    expect(await reportSettings(tournamentId)).toBeNull()
    await syncCheck(tournamentId)
  })
})

describe('edges: long lists', () => {
  const many = (n: number, prefix = 'Sec') => Array.from({ length: n }, (_, i) => ({ name: `${prefix} ${i}`, entryFee: i }))

  it('reversing 30 sections by id keeps each entry on its own section id', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ sections: many(30) })
    const ids = await idsByName(tournamentId)
    const owners: Array<[string, string]> = []
    for (let i = 0; i < 30; i += 5) {
      owners.push([await seedRegistration({ tournamentId, memberId: await seedMember(), section: `Sec ${i}` }), ids[`Sec ${i}`]])
    }
    const reversed = many(30).map((s, i) => ({ id: ids[`Sec ${i}`], name: `Sec ${29 - i}`, entryFee: i }))
    const res = await patch(admin, tournamentId, { sections: reversed })
    expect(res.status, JSON.stringify(await res.json())).toBe(200)
    await syncCheck(tournamentId)
    for (const [entry, id] of owners) expect((await sectionOfEntry(entry)).section_id).toBe(id)
    expect((await entries(tournamentId)).every((e) => e.section === (e.section_id === ids['Sec 0'] ? 'Sec 29' : e.section))).toBe(true)
  })

  it('removing 120 empty sections at once archives them all (the lists are chunked)', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ sections: many(122) })
    const res = await patch(admin, tournamentId, { sections: many(2) })
    expect(res.status, JSON.stringify(await res.json())).toBe(200)
    await syncCheck(tournamentId)
    const rows = await allRows(tournamentId)
    expect(rows.filter((r) => r.archived_at === null)).toHaveLength(2)
    expect(rows.filter((r) => r.archived_at !== null)).toHaveLength(120)
  })

  it('an entry or a game in the last of 120 removed sections is still found', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ sections: many(122) })
    const player = await seedMember()
    await seedRegistration({ tournamentId, memberId: player, section: 'Sec 118' })
    const withEntry = await patch(admin, tournamentId, { sections: many(2) })
    expect(withEntry.status).toBe(400)
    expect(await withEntry.json()).toEqual({ error: '1 entry is in the Sec 118 section. Move it to another section first.' })

    await env.DB.prepare('DELETE FROM registrations WHERE tournament_id = ?').bind(tournamentId).run()
    await insertGame(tournamentId, 'Sec 121', player, null)
    const withGame = await patch(admin, tournamentId, { sections: many(2) })
    expect(withGame.status).toBe(400)
    expect(await withGame.json()).toEqual({ error: 'Games have been paired in the Sec 121 section, so it cannot be removed.' })
    await syncCheck(tournamentId)
    expect(await liveRows(tournamentId)).toHaveLength(122)
  })
})

describe('edges: a failed batch changes nothing, and a plan that went stale is refused', () => {
  it('a statement that fails inside the batch rolls back every section write before it', async () => {
    const { tournamentId, ids } = await pairedEvent()
    const snapshot = [
      await allRows(tournamentId), await entries(tournamentId), await gameSections(tournamentId),
      await reportSettings(tournamentId), await storedJson(tournamentId),
    ]
    const db = getDb(env.DB)
    const plan = await buildSaveSections(db, tournamentId, [
      { id: ids.Open, name: 'U1600', entryFee: 1 }, { id: ids.U1600, name: 'Open', entryFee: 2 }, { id: ids.U1000, name: 'U1000', entryFee: 3 },
    ])
    if (!plan.ok) throw new Error(plan.error)
    const broken = db.insert(tournamentSections).values({ id: ids.Open, tournamentId, name: 'Dup', position: 9 })
    await expect(runBatch(db, [...plan.queries.slice(0, -1), broken, plan.queries[plan.queries.length - 1]])).rejects.toThrow()
    expect([
      await allRows(tournamentId), await entries(tournamentId), await gameSections(tournamentId),
      await reportSettings(tournamentId), await storedJson(tournamentId),
    ]).toEqual(snapshot)
    await syncCheck(tournamentId)
  })

  it('two edits sent together leave the rows and the JSON in step; the one that loses gets 409', async () => {
    const admin = await seedAdmin()
    const { tournamentId, ids } = await pairedEvent()
    const results = await Promise.all([
      patch(admin, tournamentId, { sections: [
        { id: ids.Open, name: 'U1600', entryFee: 1 }, { id: ids.U1600, name: 'Open', entryFee: 2 }, { id: ids.U1000, name: 'U1000', entryFee: 3 },
      ] }),
      patch(admin, tournamentId, { sections: [
        { id: ids.Open, name: 'Open', entryFee: 4 }, { id: ids.U1600, name: 'U1600', entryFee: 5 }, { id: ids.U1000, name: 'Rapid', entryFee: 6 },
      ] }),
    ])
    expect(results.some((r) => r.status === 200)).toBe(true)
    for (const r of results.filter((r) => r.status !== 200)) {
      expect(r.status).toBe(409)
      expect(await r.json()).toEqual({ error: SECTIONS_CHANGED_MESSAGE })
    }
    await syncCheck(tournamentId)
  })

  it('a save whose rows changed under it answers 409 and writes nothing, not even the tournament columns', async () => {
    const admin = await seedAdmin()
    const { tournamentId, ids } = await pairedEvent()
    const db = getDb(env.DB)
    const swap = [
      { id: ids.Open, name: 'U1600', entryFee: 40 }, { id: ids.U1600, name: 'Open', entryFee: 30 }, { id: ids.U1000, name: 'U1000', entryFee: 20 },
    ]
    const tournamentName = async () =>
      (await env.DB.prepare('SELECT name FROM tournaments WHERE id = ?').bind(tournamentId).first<{ name: string }>())?.name
    const nameBefore = await tournamentName()
    // Another save lands after this request read the sections and just
    // before its batch runs.
    const original = env.DB.batch.bind(env.DB)
    const batch = vi.spyOn(env.DB, 'batch').mockImplementationOnce(async (statements) => {
      const other = await saveSections(db, tournamentId, swap)
      if (!other.ok) throw new Error(other.error)
      return original(statements)
    })
    let res: Awaited<ReturnType<typeof patch>>
    try {
      res = await patch(admin, tournamentId, {
        name: 'Renamed While Saving',
        sections: [{ id: ids.Open, name: 'Main', entryFee: 40 }, { id: ids.U1600, name: 'U1600', entryFee: 30 }, { id: ids.U1000, name: 'U1000', entryFee: 20 }],
      })
    } finally {
      batch.mockRestore()
    }
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: SECTIONS_CHANGED_MESSAGE })
    expect(await tournamentName()).toBe(nameBefore)
    expect((await liveRows(tournamentId)).map((r) => [r.id, r.name])).toEqual([[ids.Open, 'U1600'], [ids.U1600, 'Open'], [ids.U1000, 'U1000']])
    await syncCheck(tournamentId)
  })

  it('a plan made before another save renamed its sections is refused as a whole, and the other save stands', async () => {
    const { tournamentId, ids, people } = await pairedEvent()
    const db = getDb(env.DB)
    // Both plans are made from the same rows. P1 swaps Open and U1600; P2
    // renames Open to Main and leaves U1600 as it is.
    const p1 = await buildSaveSections(db, tournamentId, [
      { id: ids.Open, name: 'U1600', entryFee: 40 }, { id: ids.U1600, name: 'Open', entryFee: 30 }, { id: ids.U1000, name: 'U1000', entryFee: 20 },
    ])
    const p2 = await buildSaveSections(db, tournamentId, [
      { id: ids.Open, name: 'Main', entryFee: 40 }, { id: ids.U1600, name: 'U1600', entryFee: 30 }, { id: ids.U1000, name: 'U1000', entryFee: 20 },
    ])
    if (!p1.ok || !p2.ok) throw new Error('both plans should be made')
    await runBatch(db, p1.queries)
    await syncCheck(tournamentId)
    const afterP1 = [
      await allRows(tournamentId), await entries(tournamentId), await gameSections(tournamentId),
      await reportSettings(tournamentId), await storedJson(tournamentId),
    ]

    const err = await runBatch(db, p2.queries).then(() => null, (e: unknown) => e)
    expect(err, 'the stale plan is refused').not.toBeNull()
    expect(isSectionsConflict(err)).toBe(true)
    expect([
      await allRows(tournamentId), await entries(tournamentId), await gameSections(tournamentId),
      await reportSettings(tournamentId), await storedJson(tournamentId),
    ]).toEqual(afterP1)
    for (const entry of people.U1600.entries) expect(await sectionOfEntry(entry)).toEqual({ section: 'Open', section_id: ids.U1600 })
    expect(await sectionOfGame(people.Open.game)).toBe('U1600')
    expect(await sectionOfGame(people.U1600.game)).toBe('Open')
    await syncCheck(tournamentId)
  })

  it('an entry that arrives after the plan was made refuses the save, and stays on the live section', async () => {
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 0 }, { name: 'Reserve', entryFee: 0 }] })
    const db = getDb(env.DB)
    const plan = await buildSaveSections(db, tournamentId, [{ name: 'Open', entryFee: 0 }])
    if (!plan.ok) throw new Error(plan.error)
    const late = await seedRegistration({ tournamentId, memberId: await seedMember(), section: 'Reserve' })
    const err = await runBatch(db, plan.queries).then(() => null, (e: unknown) => e)
    expect(isSectionsConflict(err)).toBe(true)
    const landed = await sectionOfEntry(late)
    const row = (await allRows(tournamentId)).find((r) => r.id === landed?.section_id)
    expect(row?.name).toBe('Reserve')
    expect(row?.archived_at ?? null, 'the late entry stays on a live section').toBeNull()
    await syncCheck(tournamentId)
  })

  it('only a guard or a taken live name counts as the sections having changed', async () => {
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 0 }] })
    const db = getDb(env.DB)
    const [open] = await loadSections(db, tournamentId)
    const taken = await runBatch(db, [db.insert(tournamentSections).values({ id: 'other-open', tournamentId, name: 'Open', position: 1 })])
      .then(() => null, (e: unknown) => e)
    expect(isSectionsConflict(taken)).toBe(true)
    const other = await runBatch(db, [db.insert(tournamentSections).values({ id: open.id, tournamentId, name: 'Elsewhere', position: 1 })])
      .then(() => null, (e: unknown) => e)
    expect(other).not.toBeNull()
    expect(isSectionsConflict(other)).toBe(false)
    expect(isSectionsConflict(new Error('network down'))).toBe(false)
  })

  it('a game paired after the plan was made refuses the save too', async () => {
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 0 }, { name: 'Reserve', entryFee: 0 }] })
    const db = getDb(env.DB)
    const plan = await buildSaveSections(db, tournamentId, [{ name: 'Open', entryFee: 0 }])
    if (!plan.ok) throw new Error(plan.error)
    await insertGame(tournamentId, 'Reserve', await seedMember(), null)
    const err = await runBatch(db, plan.queries).then(() => null, (e: unknown) => e)
    expect(isSectionsConflict(err)).toBe(true)
    expect((await liveRows(tournamentId)).map((r) => r.name)).toEqual(['Open', 'Reserve'])
    await syncCheck(tournamentId)
  })
})
