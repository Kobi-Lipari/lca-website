// test/integration/schedules.test.ts
//
// K2g: functions/utils/events/schedulesRepo.ts is the one writer of a
// tournament's round schedules, through the admin PATCH. After every write
// here, syncCheck proves:
//
// - the event has exactly one live primary schedule
// - the legacy round_schedule JSON holds the primary's rounds in today's
//   shape ([{ round, date, time }], nothing else) and equals the rows
// - the 0053 update trigger is installed, and running it again changes no
//   schedule, no round and no entry: once with round_schedule set to itself,
//   and once with the column cleared and written back, which makes the
//   trigger delete the primary's rounds and read them back from the JSON
// - every entry points at a schedule of its own event
//
// Because that trigger also fires on the writer's own JSON write, and would
// quietly repair a primary the writer got wrong, "the trigger finds the
// table final" runs each plan in two batches, everything before the JSON
// write and then the JSON write alone, and shows the second one changes
// nothing.
//
// It also covers a second schedule that merges at round 3 (saved, answered
// and sent back unchanged), the refusals (a merge round of 1 or past the
// last round, missing or extra rounds before the merge, two primaries, a
// schedule left out that has entries, both forms of the round times at
// once), a plan gone stale (409), the role checks on the edit, and that an
// entry keeps the primary schedule the 0053 trigger gives it.
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { contracts } from '../../domain/contracts'
import { normalizeRoundSchedule, SCHEDULE_FORMS_MESSAGE, SCHEDULES_CHANGED_MESSAGE, validateSchedules } from '../../domain/events/schedules'
import { getDb } from '../../functions/db/client'
import { buildSaveSchedules, isSchedulesConflict, loadSchedules, type SaveSchedulesInput } from '../../functions/utils/events/schedulesRepo'
import { runBatch } from '../../functions/utils/events/sectionsRepo'
import { onRequestPost as createTournament } from '../../functions/api/admin/tournaments'
import { onRequestPatch as patchTournament } from '../../functions/api/admin/tournaments/[id]'
import { onRequestGet as tournamentGet } from '../../functions/api/tournaments/[id]'
import { onRequestGet as manageGet } from '../../functions/api/admin/tournaments/[id]/manage'
import { expectContract, invoke, resetHarness } from './harness'
import { seedAdmin, seedClub, seedDirector, seedMember, seedRegistration, seedTournament, seedTournamentDirector } from './factories'

beforeEach(resetHarness)

interface ScheduleRow {
  id: string
  position: number
  label: string
  time_control: string | null
  is_primary: number
  merge_round: number | null
  archived_at: string | null
}

interface Round { round: number; date: string | null; time: string | null }

const scheduleRows = async (tournamentId: string) =>
  (await env.DB.prepare(
    'SELECT id, position, label, time_control, is_primary, merge_round, archived_at FROM tournament_schedules WHERE tournament_id = ? ORDER BY id',
  ).bind(tournamentId).all<ScheduleRow>()).results
const liveRows = async (tournamentId: string) =>
  (await scheduleRows(tournamentId)).filter((s) => s.archived_at === null).sort((a, b) => a.position - b.position)
const roundRows = async (tournamentId: string) =>
  (await env.DB.prepare(
    `SELECT r.schedule_id, r.round, r.date, r.time FROM tournament_schedule_rounds r
      JOIN tournament_schedules s ON s.id = r.schedule_id WHERE s.tournament_id = ? ORDER BY r.schedule_id, r.round`,
  ).bind(tournamentId).all<Round & { schedule_id: string }>()).results
const roundsOf = async (scheduleId: string) =>
  (await env.DB.prepare('SELECT round, date, time FROM tournament_schedule_rounds WHERE schedule_id = ? ORDER BY round')
    .bind(scheduleId).all<Round>()).results
const livePrimaries = async (tournamentId: string) =>
  (await liveRows(tournamentId)).filter((s) => s.is_primary === 1)
const primaryOf = async (tournamentId: string) => {
  const primaries = await livePrimaries(tournamentId)
  expect(primaries, `one live primary schedule for ${tournamentId}`).toHaveLength(1)
  return primaries[0]
}
const storedMirror = async (tournamentId: string) =>
  (await env.DB.prepare('SELECT round_schedule FROM tournaments WHERE id = ?').bind(tournamentId).first<{ round_schedule: string | null }>())?.round_schedule ?? null
const entries = async (tournamentId: string) =>
  (await env.DB.prepare('SELECT id, schedule_id, withdrawn_at FROM registrations WHERE tournament_id = ? ORDER BY id')
    .bind(tournamentId).all<{ id: string; schedule_id: string | null; withdrawn_at: string | null }>()).results
const tournamentName = async (tournamentId: string) =>
  (await env.DB.prepare('SELECT name FROM tournaments WHERE id = ?').bind(tournamentId).first<{ name: string }>())?.name
const snapshot = async (tournamentId: string) =>
  [await scheduleRows(tournamentId), await roundRows(tournamentId), await entries(tournamentId), await storedMirror(tournamentId), await tournamentName(tournamentId)]

/** The checks every write must pass; see the header. */
async function syncCheck(tournamentId: string) {
  const trigger = await env.DB.prepare(`SELECT name FROM sqlite_master WHERE type = 'trigger' AND name = 'tournaments_sections_sync_update'`).first()
  expect(trigger, 'the 0053 update trigger is installed').not.toBeNull()

  const primary = await primaryOf(tournamentId)
  const rows = await roundsOf(primary.id)
  const mirror = await storedMirror(tournamentId)
  const parsed: unknown = mirror === null ? null : JSON.parse(mirror)
  if (Array.isArray(parsed)) {
    for (const element of parsed) expect(Object.keys(element as object), 'the JSON keeps today\'s shape').toEqual(['round', 'date', 'time'])
    expect(parsed, 'the JSON equals the primary\'s rounds').toEqual(rows)
  } else {
    // NULL, or the JSON null an edit that sends roundSchedule: null stores.
    expect(parsed).toBeNull()
    expect(rows).toEqual([])
  }
  expect(normalizeRoundSchedule(mirror)).toEqual(rows)

  // The trigger, run again on the final JSON, finds nothing to change.
  const before = [await scheduleRows(tournamentId), await roundRows(tournamentId), await entries(tournamentId)]
  await env.DB.prepare('UPDATE tournaments SET round_schedule = round_schedule WHERE id = ?').bind(tournamentId).run()
  expect([await scheduleRows(tournamentId), await roundRows(tournamentId), await entries(tournamentId)]).toEqual(before)
  // Cleared and written back, it deletes the primary's rounds and reads them back from the JSON.
  await env.DB.prepare('UPDATE tournaments SET round_schedule = NULL WHERE id = ?').bind(tournamentId).run()
  await env.DB.prepare('UPDATE tournaments SET round_schedule = ? WHERE id = ?').bind(mirror, tournamentId).run()
  expect([await scheduleRows(tournamentId), await roundRows(tournamentId), await entries(tournamentId)]).toEqual(before)

  const ids = new Set((await scheduleRows(tournamentId)).map((s) => s.id))
  for (const entry of await entries(tournamentId)) expect(ids.has(entry.schedule_id as string), `entry ${entry.id} has a schedule of its event`).toBe(true)
}

/**
 * Runs a plan in two batches, everything before the JSON write and then the
 * JSON write alone, and shows the second changes no row: the trigger it
 * fires finds the table final.
 */
async function inTwoBatches(tournamentId: string, input: SaveSchedulesInput, roundCount = 4) {
  const db = getDb(env.DB)
  const plan = await buildSaveSchedules(db, tournamentId, input, { roundCount })
  if (!plan.ok) throw new Error(plan.error)
  await runBatch(db, plan.queries.slice(0, -1))
  const before = [await scheduleRows(tournamentId), await roundRows(tournamentId), await entries(tournamentId)]
  await runBatch(db, plan.queries.slice(-1))
  expect([await scheduleRows(tournamentId), await roundRows(tournamentId), await entries(tournamentId)], 'the JSON write changes nothing').toEqual(before)
  await syncCheck(tournamentId)
}

const patch = (as: string, id: string, body: unknown) => invoke(patchTournament, { method: 'PATCH', as, params: { id }, body })

const day = (round: number, date: string, time: string) => ({ round, date, time })
const threeDay = [
  day(1, '2026-10-23', '19:00'), day(2, '2026-10-24', '10:00'), day(3, '2026-10-24', '16:00'),
  day(4, '2026-10-25', '10:00'), day(5, '2026-10-25', '15:00'),
]
const twoDay = [day(1, '2026-10-24', '09:00'), day(2, '2026-10-24', '12:30')]

/** A 5-round event with its main schedule's rounds set the way the setup form sets them. */
async function fiveRounds() {
  const admin = await seedAdmin()
  const tournamentId = await seedTournament({ rounds: 5 })
  expect((await patch(admin, tournamentId, { roundSchedule: threeDay })).status).toBe(200)
  const primary = await primaryOf(tournamentId)
  return { admin, tournamentId, primaryId: primary.id }
}

/** The same event with a 2-day schedule that merges at round 3. */
async function withTwoDay() {
  const setup = await fiveRounds()
  const res = await patch(setup.admin, setup.tournamentId, {
    schedules: [
      { id: setup.primaryId, label: '3-day', isPrimary: true, rounds: threeDay },
      { label: '2-day', timeControl: 'G/60;d5', isPrimary: false, mergeRound: 3, rounds: twoDay },
    ],
  })
  expect(res.status).toBe(200)
  const fast = (await liveRows(setup.tournamentId)).find((s) => s.label === '2-day') as ScheduleRow
  return { ...setup, fastId: fast.id }
}

describe('the setup form\'s roundSchedule replaces the main schedule\'s rounds', () => {
  it('writes the rows, then the JSON in today\'s shape, and answers round_schedule from the rows', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament()
    const primaryBefore = await primaryOf(tournamentId)
    const roundSchedule = [day(1, '2026-10-24', '09:00'), day(2, '2026-10-24', '14:00'), day(3, '2026-10-25', '')]
    const res = await patch(admin, tournamentId, { roundSchedule })
    expect(res.status).toBe(200)
    const { tournament } = await expectContract(res, contracts['admin/tournaments/[id]'].PATCH.response)
    expect(tournament.round_schedule).toEqual(roundSchedule)
    expect(tournament.schedules).toEqual([
      { id: primaryBefore.id, label: 'Main schedule', timeControl: null, isPrimary: true, mergeRound: null, rounds: roundSchedule },
    ])
    // The trigger's primary is kept, not replaced by another.
    expect((await primaryOf(tournamentId)).id).toBe(primaryBefore.id)
    expect(await scheduleRows(tournamentId)).toHaveLength(1)
    expect(JSON.parse((await storedMirror(tournamentId))!)).toEqual(roundSchedule)
    await syncCheck(tournamentId)
  })

  it('keeps free-text times and blanks as written, and stores odd input as the rows the trigger would make', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament()
    const sent = [
      { round: 2, date: 'Sat, Oct 24', time: '7:00 PM', note: 'kept out of the JSON' },
      { round: '1', date: '', time: '' },
      { round: 2, date: 'repeated', time: 'x' },
      { round: 0, date: 'dropped', time: 'x' },
      { round: 3, date: 20261025, time: null },
    ]
    const res = await patch(admin, tournamentId, { roundSchedule: sent })
    expect(res.status).toBe(200)
    const expected = [{ round: 1, date: '', time: '' }, { round: 2, date: 'Sat, Oct 24', time: '7:00 PM' }, { round: 3, date: null, time: null }]
    expect(await roundsOf((await primaryOf(tournamentId)).id)).toEqual(expected)
    expect(JSON.parse((await storedMirror(tournamentId))!)).toEqual(expected)
    // A date or time not set is answered as the blank the form uses.
    expect((await res.json<{ tournament: { round_schedule: unknown } }>()).tournament.round_schedule)
      .toEqual([{ round: 1, date: '', time: '' }, { round: 2, date: 'Sat, Oct 24', time: '7:00 PM' }, { round: 3, date: '', time: '' }])
    await syncCheck(tournamentId)
  })

  it('an empty list and null clear the rounds; null is stored as the JSON null the column held before', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament()
    await patch(admin, tournamentId, { roundSchedule: [day(1, '2026-10-24', '19:00')] })
    expect((await patch(admin, tournamentId, { roundSchedule: [] })).status).toBe(200)
    expect(await storedMirror(tournamentId)).toBe('[]')
    await syncCheck(tournamentId)
    await patch(admin, tournamentId, { roundSchedule: [day(1, '2026-10-24', '19:00')] })
    const res = await patch(admin, tournamentId, { roundSchedule: null })
    expect(res.status).toBe(200)
    expect(await storedMirror(tournamentId)).toBe('null')
    expect((await res.json<{ tournament: { round_schedule: unknown } }>()).tournament.round_schedule).toEqual([])
    await syncCheck(tournamentId)
  })

  it('an edit that sends no round times leaves the rows and the JSON alone', async () => {
    const { admin, tournamentId } = await withTwoDay()
    const before = [await scheduleRows(tournamentId), await roundRows(tournamentId), await storedMirror(tournamentId)]
    expect((await patch(admin, tournamentId, { name: 'Renamed', description: 'x' })).status).toBe(200)
    expect([await scheduleRows(tournamentId), await roundRows(tournamentId), await storedMirror(tournamentId)]).toEqual(before)
    await syncCheck(tournamentId)
  })

  it('keeps a second schedule as it is, and checks it against the new round count', async () => {
    const { admin, tournamentId, fastId } = await withTwoDay()
    const res = await patch(admin, tournamentId, { rounds: 4, roundSchedule: threeDay.slice(0, 4) })
    expect(res.status).toBe(200)
    expect(await roundsOf(fastId)).toEqual(twoDay)
    expect((await liveRows(tournamentId)).find((s) => s.id === fastId)?.merge_round).toBe(3)
    await syncCheck(tournamentId)
    const refused = await patch(admin, tournamentId, { rounds: 2, roundSchedule: threeDay.slice(0, 2) })
    expect(refused.status).toBe(400)
    expect(await refused.json()).toEqual({ error: 'The “2-day” schedule must join the main schedule at a round from 2 to 2.' })
  })
})

describe('the trigger finds the table final', () => {
  it('for rounds replaced, cleared, set to null and sent with odd values', async () => {
    const tournamentId = await seedTournament()
    await inTwoBatches(tournamentId, { roundSchedule: [day(1, '2026-10-24', '09:00'), day(2, '2026-10-24', '14:00')] })
    await inTwoBatches(tournamentId, { roundSchedule: [day(2, '2026-10-24', '15:00'), day(1, '2026-10-24', '09:30'), day(3, '', '')] })
    await inTwoBatches(tournamentId, { roundSchedule: [{ round: '2', date: 7 }, { round: 1, time: 'noon' }, 'x', { round: 1, time: 'second' }] })
    await inTwoBatches(tournamentId, { roundSchedule: [] })
    await inTwoBatches(tournamentId, { roundSchedule: [day(1, '2026-10-24', '09:00')] })
    await inTwoBatches(tournamentId, { roundSchedule: null })
    // The same rounds again: the JSON write is a no-op too.
    await inTwoBatches(tournamentId, { roundSchedule: [day(1, '2026-10-24', '09:00')] })
    await inTwoBatches(tournamentId, { roundSchedule: [day(1, '2026-10-24', '09:00')] })
  })

  it('for a second schedule added, changed, made the primary and removed', async () => {
    const { tournamentId, primaryId } = await fiveRounds()
    await inTwoBatches(tournamentId, { schedules: [
      { id: primaryId, isPrimary: true, rounds: threeDay },
      { label: '2-day', isPrimary: false, mergeRound: 3, rounds: twoDay },
    ] }, 5)
    const fastId = (await liveRows(tournamentId)).find((s) => s.label === '2-day')!.id
    await inTwoBatches(tournamentId, { schedules: [
      { id: primaryId, isPrimary: true, rounds: threeDay.slice(0, 3) },
      { id: fastId, isPrimary: false, mergeRound: 4, rounds: [...twoDay, day(3, '2026-10-24', '15:00')] },
    ] }, 5)
    // The 2-day schedule becomes the main one, and the 3-day one merges into it at round 3.
    await inTwoBatches(tournamentId, { schedules: [
      { id: fastId, isPrimary: true, rounds: [...twoDay, day(3, '2026-10-24', '16:00')] },
      { id: primaryId, isPrimary: false, mergeRound: 3, rounds: threeDay.slice(0, 2) },
    ] }, 5)
    expect((await primaryOf(tournamentId)).id).toBe(fastId)
    await inTwoBatches(tournamentId, { schedules: [{ id: fastId, isPrimary: true, rounds: twoDay }] }, 5)
    expect((await scheduleRows(tournamentId)).find((s) => s.id === primaryId)?.archived_at).not.toBeNull()
  })
})

describe('a tournament never has two live primary schedules', () => {
  it('after the create, an edit of the rounds, a second schedule, a switch of the primary and new ones in its place', async () => {
    const admin = await seedAdmin()
    const created = await invoke(createTournament, {
      method: 'POST', as: admin,
      body: { name: 'Bayou Fall Open', location: 'Kenner, LA', date: '2026-10-24', entryFee: 40, rounds: 5, sections: [{ name: 'Open', entryFee: 40 }] },
    })
    expect(created.status).toBe(201)
    const { tournament } = await expectContract(created, contracts['admin/tournaments'].POST.response)
    expect(tournament.round_schedule).toEqual([])
    expect(tournament.schedules).toHaveLength(1)
    const tournamentId = tournament.id
    const first = await primaryOf(tournamentId)
    expect(tournament.schedules[0]).toMatchObject({ id: first.id, isPrimary: true, rounds: [] })

    const steps: unknown[] = [
      { roundSchedule: threeDay },
      { schedules: [{ id: first.id, isPrimary: true, rounds: threeDay }, { label: '2-day', isPrimary: false, mergeRound: 3, rounds: twoDay }] },
    ]
    for (const body of steps) {
      expect((await patch(admin, tournamentId, body)).status).toBe(200)
      expect(await livePrimaries(tournamentId)).toHaveLength(1)
      await syncCheck(tournamentId)
    }
    const fastId = (await liveRows(tournamentId)).find((s) => s.label === '2-day')!.id

    // Switch: the old primary is demoted before the other is promoted.
    expect((await patch(admin, tournamentId, { schedules: [
      { id: fastId, isPrimary: true, rounds: [...twoDay, ...threeDay.slice(2)] },
      { id: first.id, isPrimary: false, mergeRound: 3, rounds: threeDay.slice(0, 2) },
    ] })).status).toBe(200)
    expect((await livePrimaries(tournamentId)).map((s) => s.id)).toEqual([fastId])
    await syncCheck(tournamentId)

    // A new primary (no id) while the current one stays as a second schedule.
    expect((await patch(admin, tournamentId, { schedules: [
      { label: 'Weekend', isPrimary: true, rounds: threeDay },
      { id: fastId, label: '2-day', isPrimary: false, mergeRound: 3, rounds: twoDay },
    ] })).status).toBe(200)
    const [newPrimary] = await livePrimaries(tournamentId)
    expect(newPrimary.label).toBe('Weekend')
    expect([first.id, fastId]).not.toContain(newPrimary.id)
    await syncCheck(tournamentId)

    // The primary left out: archived before the remaining one becomes the primary.
    expect((await patch(admin, tournamentId, { schedules: [{ id: fastId, isPrimary: true, rounds: twoDay }] })).status).toBe(200)
    expect((await livePrimaries(tournamentId)).map((s) => s.id)).toEqual([fastId])
    expect((await scheduleRows(tournamentId)).filter((s) => s.archived_at !== null).map((s) => s.id).sort()).toEqual([first.id, newPrimary.id].sort())
    await syncCheck(tournamentId)
  })

  it('a primary sent without an id is the existing primary, kept with its id', async () => {
    const { admin, tournamentId, primaryId } = await fiveRounds()
    expect((await patch(admin, tournamentId, { schedules: [{ isPrimary: true, label: '3-day', rounds: threeDay.slice(0, 2) }] })).status).toBe(200)
    expect(await scheduleRows(tournamentId)).toEqual([expect.objectContaining({ id: primaryId, label: '3-day', is_primary: 1, archived_at: null })])
    await syncCheck(tournamentId)
  })
})

describe('a second schedule that merges at round 3', () => {
  it('is saved, answered by every reader with round_schedule still the main schedule\'s, and sent back changes nothing', async () => {
    const { admin, tournamentId, primaryId } = await fiveRounds()
    const sent = [
      { id: primaryId, label: '3-day', isPrimary: true, rounds: threeDay },
      { label: '2-day', timeControl: 'G/60;d5', isPrimary: false, mergeRound: 3, rounds: twoDay },
    ]
    const res = await patch(admin, tournamentId, { schedules: sent })
    expect(res.status).toBe(200)
    const { tournament } = await expectContract(res, contracts['admin/tournaments/[id]'].PATCH.response)
    const fastId = (await liveRows(tournamentId)).find((s) => s.label === '2-day')!.id
    const expected = [
      { id: primaryId, label: '3-day', timeControl: null, isPrimary: true, mergeRound: null, rounds: threeDay },
      { id: fastId, label: '2-day', timeControl: 'G/60;d5', isPrimary: false, mergeRound: 3, rounds: twoDay },
    ]
    expect(tournament.schedules).toEqual(expected)
    expect(tournament.round_schedule).toEqual(threeDay)
    expect(JSON.parse((await storedMirror(tournamentId))!)).toEqual(threeDay)
    await syncCheck(tournamentId)

    const detail = await expectContract(await invoke(tournamentGet, { params: { id: tournamentId } }), contracts['tournaments/[id]'].GET.response)
    const manage = await expectContract(await invoke(manageGet, { as: admin, params: { id: tournamentId } }), contracts['admin/tournaments/[id]/manage'].GET.response)
    for (const answer of [detail.tournament, manage.tournament]) {
      expect(answer.schedules).toEqual(expected)
      expect(answer.round_schedule).toEqual(threeDay)
    }
    expect(await loadSchedules(getDb(env.DB), tournamentId)).toEqual(expected.map((s, position) => ({
      ...s, tournamentId, position, archivedAt: null,
    })))

    // The answer sent back as it came: same rows, same ids, same rounds.
    const before = [await scheduleRows(tournamentId), await roundRows(tournamentId), await storedMirror(tournamentId)]
    expect((await patch(admin, tournamentId, { schedules: tournament.schedules })).status).toBe(200)
    expect([await scheduleRows(tournamentId), await roundRows(tournamentId), await storedMirror(tournamentId)]).toEqual(before)
    await syncCheck(tournamentId)
  })

  it('the setup form\'s roundSchedule then changes only the main schedule', async () => {
    const { admin, tournamentId, fastId } = await withTwoDay()
    const moved = threeDay.map((r) => ({ ...r, time: r.time === '19:00' ? '18:30' : r.time }))
    expect((await patch(admin, tournamentId, { roundSchedule: moved })).status).toBe(200)
    expect(await roundsOf((await primaryOf(tournamentId)).id)).toEqual(moved)
    expect(await roundsOf(fastId)).toEqual(twoDay)
    await syncCheck(tournamentId)
  })

  it('new entries still get the main schedule from the trigger until entries can choose one', async () => {
    const { tournamentId, primaryId, fastId } = await withTwoDay()
    const entry = await seedRegistration({ tournamentId, memberId: await seedMember(), section: 'Open' })
    expect((await entries(tournamentId)).find((e) => e.id === entry)?.schedule_id).toBe(primaryId)
    expect(fastId).not.toBe(primaryId)
  })
})

describe('refused with 400, and nothing written', () => {
  const cases: Array<[string, (ids: { primaryId: string; fastId: string }) => unknown, string | RegExp]> = [
    ['a merge round of 1', ({ primaryId, fastId }) => ({ schedules: [
      { id: primaryId, isPrimary: true, rounds: threeDay }, { id: fastId, isPrimary: false, mergeRound: 1, rounds: [] },
    ] }), 'The “2-day” schedule must join the main schedule at a round from 2 to 5.'],
    ['a merge round past the last round', ({ primaryId, fastId }) => ({ schedules: [
      { id: primaryId, isPrimary: true, rounds: threeDay }, { id: fastId, isPrimary: false, mergeRound: 6, rounds: threeDay },
    ] }), 'The “2-day” schedule must join the main schedule at a round from 2 to 5.'],
    ['no merge round on a second schedule', ({ primaryId, fastId }) => ({ schedules: [
      { id: primaryId, isPrimary: true, rounds: threeDay }, { id: fastId, isPrimary: false, rounds: twoDay },
    ] }), 'The “2-day” schedule must join the main schedule at a round from 2 to 5.'],
    ['a round missing before the merge', ({ primaryId, fastId }) => ({ schedules: [
      { id: primaryId, isPrimary: true, rounds: threeDay }, { id: fastId, isPrimary: false, mergeRound: 3, rounds: twoDay.slice(0, 1) },
    ] }), 'The “2-day” schedule needs its own time for each round from 1 to 2 (round 2 is missing).'],
    ['an extra round before the merge', ({ primaryId, fastId }) => ({ schedules: [
      { id: primaryId, isPrimary: true, rounds: threeDay }, { id: fastId, isPrimary: false, mergeRound: 3, rounds: [...twoDay, day(3, '2026-10-24', '15:00')] },
    ] }), 'From round 3 the “2-day” schedule plays on the main schedule\'s times, so it lists only rounds 1 to 2.'],
    ['a round listed twice', ({ primaryId, fastId }) => ({ schedules: [
      { id: primaryId, isPrimary: true, rounds: [...threeDay, threeDay[0]] }, { id: fastId, isPrimary: false, mergeRound: 3, rounds: twoDay },
    ] }), 'Round 1 is listed twice in the main schedule.'],
    ['two primaries', ({ primaryId, fastId }) => ({ schedules: [
      { id: primaryId, isPrimary: true, rounds: threeDay }, { id: fastId, isPrimary: true, rounds: twoDay },
    ] }), 'Mark exactly one schedule as the main schedule.'],
    ['no primary', ({ fastId }) => ({ schedules: [{ id: fastId, isPrimary: false, mergeRound: 3, rounds: twoDay }] }),
      'Mark exactly one schedule as the main schedule.'],
    ['an id from another event', ({ primaryId }) => ({ schedules: [
      { id: primaryId, isPrimary: true, rounds: threeDay }, { id: 'not-this-event', isPrimary: false, mergeRound: 3, rounds: twoDay },
    ] }), 'One of these schedules is not part of this event. Reload the page and try again.'],
    ['both forms of the round times', ({ primaryId }) => ({ roundSchedule: threeDay, schedules: [{ id: primaryId, isPrimary: true, rounds: threeDay }] }),
      SCHEDULE_FORMS_MESSAGE],
    ['fewer rounds than the merge round needs', () => ({ rounds: 2 }), 'The “2-day” schedule must join the main schedule at a round from 2 to 2.'],
  ]

  for (const [name, body, message] of cases) {
    it(name, async () => {
      const { admin, tournamentId, primaryId, fastId } = await withTwoDay()
      const before = await snapshot(tournamentId)
      const res = await patch(admin, tournamentId, { name: 'Should not change', ...(body({ primaryId, fastId }) as object) })
      expect(res.status).toBe(400)
      const answer = await res.json<{ error: string }>()
      if (typeof message === 'string') expect(answer).toEqual({ error: message })
      else expect(answer.error).toMatch(message)
      expect(await snapshot(tournamentId)).toEqual(before)
    })
  }

  it('a round number that is not a whole number from 1 fails the contract, with the field named', async () => {
    const { admin, tournamentId, primaryId } = await withTwoDay()
    const before = await snapshot(tournamentId)
    const res = await patch(admin, tournamentId, { schedules: [{ id: primaryId, isPrimary: true, rounds: [{ round: 0, date: '', time: '' }] }] })
    expect(res.status).toBe(400)
    expect(await res.json<{ fields?: Record<string, unknown> }>()).toHaveProperty('fields')
    expect(await snapshot(tournamentId)).toEqual(before)
  })

  it('a second schedule left out while it has entries; a withdrawn entry does not hold it', async () => {
    const { admin, tournamentId, primaryId, fastId } = await withTwoDay()
    const entry = await seedRegistration({ tournamentId, memberId: await seedMember(), section: 'Open' })
    await env.DB.prepare('UPDATE registrations SET schedule_id = ? WHERE id = ?').bind(fastId, entry).run()
    const before = await snapshot(tournamentId)
    const body = { schedules: [{ id: primaryId, isPrimary: true, rounds: threeDay }] }
    const res = await patch(admin, tournamentId, body)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: '1 entry is on the “2-day” schedule. Move it to another schedule first.' })
    expect(await snapshot(tournamentId)).toEqual(before)

    await env.DB.prepare(`UPDATE registrations SET withdrawn_at = datetime('now') WHERE id = ?`).bind(entry).run()
    expect((await patch(admin, tournamentId, body)).status).toBe(200)
    // Archived, never deleted: the withdrawn entry keeps its schedule.
    expect((await scheduleRows(tournamentId)).find((s) => s.id === fastId)?.archived_at).not.toBeNull()
    expect((await entries(tournamentId)).find((e) => e.id === entry)?.schedule_id).toBe(fastId)
    await syncCheck(tournamentId)
  })
})

describe('a plan that went stale is refused as a whole', () => {
  it('another save between the read and the batch: 409, and not even the tournament columns are written', async () => {
    const { admin, tournamentId, primaryId } = await fiveRounds()
    const db = getDb(env.DB)
    const nameBefore = await tournamentName(tournamentId)
    const original = env.DB.batch.bind(env.DB)
    const batch = vi.spyOn(env.DB, 'batch').mockImplementationOnce(async (statements) => {
      const other = await buildSaveSchedules(db, tournamentId, { schedules: [
        { id: primaryId, isPrimary: true, rounds: threeDay },
        { label: '2-day', isPrimary: false, mergeRound: 3, rounds: twoDay },
      ] }, { roundCount: 5 })
      if (!other.ok) throw new Error(other.error)
      await runBatch(db, other.queries)
      return original(statements)
    })
    let res: Awaited<ReturnType<typeof patch>>
    try {
      res = await patch(admin, tournamentId, {
        name: 'Renamed While Saving',
        schedules: [{ id: primaryId, isPrimary: true, rounds: threeDay.slice(0, 4) }],
      })
    } finally {
      batch.mockRestore()
    }
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: SCHEDULES_CHANGED_MESSAGE })
    expect(await tournamentName(tournamentId)).toBe(nameBefore)
    expect((await liveRows(tournamentId)).map((s) => s.label)).toEqual(['Main schedule', '2-day'])
    await syncCheck(tournamentId)
  })

  it('an entry that lands on a schedule being removed after the plan was made', async () => {
    const { tournamentId, primaryId, fastId } = await withTwoDay()
    const db = getDb(env.DB)
    const plan = await buildSaveSchedules(db, tournamentId, { schedules: [{ id: primaryId, isPrimary: true, rounds: threeDay }] }, { roundCount: 5 })
    if (!plan.ok) throw new Error(plan.error)
    const late = await seedRegistration({ tournamentId, memberId: await seedMember(), section: 'Open' })
    await env.DB.prepare('UPDATE registrations SET schedule_id = ? WHERE id = ?').bind(fastId, late).run()
    const err = await runBatch(db, plan.queries).then(() => null, (e: unknown) => e)
    expect(isSchedulesConflict(err)).toBe(true)
    expect((await scheduleRows(tournamentId)).find((s) => s.id === fastId)?.archived_at).toBeNull()
    await syncCheck(tournamentId)
  })

  it('a second schedule that merges past a new round count, saved between the check and the batch: 409, the round count kept', async () => {
    const { admin, tournamentId, primaryId } = await fiveRounds()
    const db = getDb(env.DB)
    const roundsOfEvent = async () =>
      (await env.DB.prepare('SELECT rounds FROM tournaments WHERE id = ?').bind(tournamentId).first<{ rounds: number }>())?.rounds
    const original = env.DB.batch.bind(env.DB)
    const batch = vi.spyOn(env.DB, 'batch').mockImplementationOnce(async (statements) => {
      const other = await buildSaveSchedules(db, tournamentId, { schedules: [
        { id: primaryId, isPrimary: true, rounds: threeDay },
        { label: '2-day', isPrimary: false, mergeRound: 5, rounds: [...twoDay, ...threeDay.slice(2, 4)] },
      ] }, { roundCount: 5 })
      if (!other.ok) throw new Error(other.error)
      await runBatch(db, other.queries)
      return original(statements)
    })
    let res: Awaited<ReturnType<typeof patch>>
    try {
      res = await patch(admin, tournamentId, { rounds: 3 })
    } finally {
      batch.mockRestore()
    }
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: SCHEDULES_CHANGED_MESSAGE })
    expect(await roundsOfEvent()).toBe(5)
    expect((await liveRows(tournamentId)).find((s) => s.label === '2-day')?.merge_round).toBe(5)
    await syncCheck(tournamentId)
  })

  it('a plain edit read before another save added rounds and a second schedule: the newer round count is kept', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ rounds: 3 })
    expect((await patch(admin, tournamentId, { roundSchedule: threeDay.slice(0, 3) })).status).toBe(200)
    const primaryId = (await primaryOf(tournamentId)).id
    const original = env.DB.batch.bind(env.DB)
    let other: Awaited<ReturnType<typeof patch>> | undefined
    const batch = vi.spyOn(env.DB, 'batch').mockImplementationOnce(async (statements) => {
      other = await patch(admin, tournamentId, {
        rounds: 5,
        schedules: [
          { id: primaryId, isPrimary: true, rounds: threeDay },
          { label: '2-day', isPrimary: false, mergeRound: 5, rounds: [...twoDay, ...threeDay.slice(2, 4)] },
        ],
      })
      return original(statements)
    })
    let res: Awaited<ReturnType<typeof patch>>
    try {
      res = await patch(admin, tournamentId, { description: 'Edited while another director saved' })
    } finally {
      batch.mockRestore()
    }
    expect(other?.status).toBe(200)
    expect(res.status).toBe(200)
    const after = await env.DB.prepare('SELECT rounds, description FROM tournaments WHERE id = ?').bind(tournamentId).first<{ rounds: number; description: string }>()
    expect(after).toEqual({ rounds: 5, description: 'Edited while another director saved' })
    expect((await liveRows(tournamentId)).find((s) => s.label === '2-day')?.merge_round).toBe(5)
    expect(validateSchedules(await loadSchedules(getDb(env.DB), tournamentId), 5)).toBeNull()
    await syncCheck(tournamentId)
  })

  it('a second schedule saved without a round count while another save lowers it past the merge round: 409, the lower count kept', async () => {
    const { admin, tournamentId, primaryId } = await fiveRounds()
    const original = env.DB.batch.bind(env.DB)
    let other: Awaited<ReturnType<typeof patch>> | undefined
    const batch = vi.spyOn(env.DB, 'batch').mockImplementationOnce(async (statements) => {
      other = await patch(admin, tournamentId, { rounds: 3 })
      return original(statements)
    })
    let res: Awaited<ReturnType<typeof patch>>
    try {
      res = await patch(admin, tournamentId, {
        schedules: [
          { id: primaryId, isPrimary: true, rounds: threeDay },
          { label: '2-day', isPrimary: false, mergeRound: 4, rounds: [...twoDay, threeDay[2]] },
        ],
      })
    } finally {
      batch.mockRestore()
    }
    expect(other?.status).toBe(200)
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: SCHEDULES_CHANGED_MESSAGE })
    const rounds = await env.DB.prepare('SELECT rounds FROM tournaments WHERE id = ?').bind(tournamentId).first<{ rounds: number }>()
    expect(rounds?.rounds).toBe(3)
    expect((await liveRows(tournamentId)).map((s) => s.label)).toEqual(['Main schedule'])
    await syncCheck(tournamentId)
  })
})

describe('each edit is one D1 batch, the round_schedule JSON last', () => {
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

  it('sections and round times together: the tournament first, the sections JSON, then the round_schedule JSON last', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament()
    const { result, writesAlone, batches } = await recording(() => patch(admin, tournamentId, {
      description: 'One batch',
      sections: [{ name: 'Open', entryFee: 30 }, { name: 'U1200', entryFee: 10 }],
      roundSchedule: [day(1, '2026-10-24', '09:00'), day(2, '2026-10-24', '14:00')],
    }))
    expect(result.status).toBe(200)
    expect(writesAlone).toEqual([])
    expect(batches).toHaveLength(1)
    const [batch] = batches
    expect(batch[0]).toMatch(/^update "tournaments" set "name"/)
    expect(batch[0]).not.toMatch(/round_schedule/)
    expect(batch[batch.length - 1]).toMatch(/^update "tournaments" set "round_schedule" = \?/)
    expect(batch.filter((s) => /"round_schedule" =/.test(s))).toHaveLength(1)
    expect(batch.findIndex((s) => /set "sections" =/.test(s))).toBeLessThan(batch.length - 1)
    await syncCheck(tournamentId)
  })

  it('an edit without round times holds no schedule write', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament()
    const { batches } = await recording(() => patch(admin, tournamentId, { name: 'Only the name' }))
    expect(batches).toEqual([[expect.stringMatching(/^update "tournaments" set "name"/)]])
  })
})

describe('who may change the schedules', () => {
  const body = (primaryId: string) => ({ schedules: [
    { id: primaryId, isPrimary: true, rounds: [day(1, '2026-10-24', '09:00'), day(2, '2026-10-24', '14:00')] },
    { label: '2-day', isPrimary: false, mergeRound: 2, rounds: [day(1, '2026-10-24', '08:00')] },
  ] })

  async function clubEvent() {
    const clubId = await seedClub()
    const tournamentId = await seedTournament({ clubId, rounds: 2 })
    return { clubId, tournamentId, primaryId: (await primaryOf(tournamentId)).id }
  }

  it('a plain member, another club\'s rep and a director of another event get 403; no sign-in 401; nothing written', async () => {
    const { tournamentId, primaryId } = await clubEvent()
    const otherClub = await seedClub()
    const otherEvent = await seedTournament()
    const director = await seedDirector()
    await seedTournamentDirector(otherEvent, director)
    const before = await snapshot(tournamentId)
    for (const as of [await seedMember(), await seedMember({ role: 'club_rep', clubId: otherClub }), director]) {
      expect((await patch(as, tournamentId, body(primaryId))).status).toBe(403)
    }
    expect((await invoke(patchTournament, { method: 'PATCH', params: { id: tournamentId }, body: body(primaryId) })).status).toBe(401)
    expect(await snapshot(tournamentId)).toEqual(before)
  })

  it('the organizing club\'s rep, the assigned director and an LCA admin may', async () => {
    for (const who of ['rep', 'director', 'admin'] as const) {
      const { clubId, tournamentId, primaryId } = await clubEvent()
      let as: string
      if (who === 'rep') as = await seedMember({ role: 'club_rep', clubId })
      else if (who === 'director') {
        as = await seedDirector()
        await seedTournamentDirector(tournamentId, as)
      } else as = await seedAdmin()
      expect((await patch(as, tournamentId, body(primaryId))).status, who).toBe(200)
      expect(await liveRows(tournamentId), who).toHaveLength(2)
      await syncCheck(tournamentId)
    }
  })
})

describe('the round times are not shown to anyone who may not see the event', () => {
  it('the manage page: no sign-in 401, a plain member, another club\'s rep and another event\'s director 403, and no schedules in the body', async () => {
    const { tournamentId } = await withTwoDay()
    const otherEvent = await seedTournament()
    const director = await seedDirector()
    await seedTournamentDirector(otherEvent, director)
    const otherClub = await seedClub()
    const clubEvent = await seedTournament({ clubId: await seedClub() })
    const refused = [
      await invoke(manageGet, { params: { id: tournamentId } }),
      await invoke(manageGet, { as: await seedMember(), params: { id: tournamentId } }),
      await invoke(manageGet, { as: director, params: { id: tournamentId } }),
      await invoke(manageGet, { as: await seedMember({ role: 'club_rep', clubId: otherClub }), params: { id: clubEvent } }),
    ]
    expect(refused.map((r) => r.status)).toEqual([401, 403, 403, 403])
    for (const res of refused) {
      const text = JSON.stringify(await res.json())
      expect(text).not.toMatch(/schedules|round_schedule|mergeRound/)
    }
  })

  it('a hidden event: the public page answers 404 without schedules; an admin sees them', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ isVisible: false, rounds: 5 })
    expect((await patch(admin, tournamentId, { roundSchedule: threeDay })).status).toBe(200)
    for (const as of [undefined, await seedMember()]) {
      const res = await invoke(tournamentGet, { as, params: { id: tournamentId } })
      expect(res.status).toBe(404)
      expect(JSON.stringify(await res.json())).not.toMatch(/schedules|round_schedule|2026-10-23/)
    }
    const seen = await expectContract(await invoke(tournamentGet, { as: admin, params: { id: tournamentId } }), contracts['tournaments/[id]'].GET.response)
    expect(seen.tournament.round_schedule).toEqual(threeDay)
  })
})

describe('the same save sent again', () => {
  it('roundSchedule sent twice leaves every row, id and the JSON as the first send left them', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ rounds: 5 })
    expect((await patch(admin, tournamentId, { roundSchedule: threeDay })).status).toBe(200)
    const first = await snapshot(tournamentId)
    for (let i = 0; i < 2; i++) {
      expect((await patch(admin, tournamentId, { roundSchedule: threeDay })).status).toBe(200)
      expect(await snapshot(tournamentId)).toEqual(first)
      await syncCheck(tournamentId)
    }
  })

  it('a schedules list sent twice does not add a schedule or change an id', async () => {
    const { admin, tournamentId, primaryId } = await fiveRounds()
    const body = { schedules: [
      { id: primaryId, isPrimary: true, rounds: threeDay },
      { label: '2-day', isPrimary: false, mergeRound: 3, rounds: twoDay },
    ] }
    expect((await patch(admin, tournamentId, body)).status).toBe(200)
    const fastId = (await liveRows(tournamentId)).find((s) => s.label === '2-day')!.id
    // The second send has no id for the 2-day schedule, so it is a new schedule
    // and the first one is archived in its place (nothing is on it): still one
    // live primary and one live second schedule, never two of either.
    expect((await patch(admin, tournamentId, body)).status).toBe(200)
    const live = await liveRows(tournamentId)
    expect(live.map((s) => s.label)).toEqual(['Main schedule', '2-day'])
    expect(live.filter((s) => s.is_primary === 1)).toHaveLength(1)
    expect(live[0].id).toBe(primaryId)
    expect((await scheduleRows(tournamentId)).find((s) => s.id === fastId)?.archived_at).not.toBeNull()
    await syncCheck(tournamentId)
  })
})

describe('two saves at the same moment', () => {
  it('never leave two live primaries, a half-written schedule or an answer other than 200 or 409', async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const { admin, tournamentId, primaryId } = await fiveRounds()
      const bodies = [
        { schedules: [{ id: primaryId, isPrimary: true, rounds: threeDay }, { label: 'A', isPrimary: false, mergeRound: 3, rounds: twoDay }] },
        { schedules: [{ label: 'B-main', isPrimary: true, rounds: threeDay.slice(0, 4) }, { id: primaryId, label: 'B', isPrimary: false, mergeRound: 3, rounds: twoDay }] },
        { roundSchedule: threeDay.slice(0, 3) },
      ]
      const results = await Promise.all(bodies.map((body) => patch(admin, tournamentId, body)))
      const statuses = results.map((r) => r.status)
      for (const s of statuses) expect([200, 409], `statuses ${statuses}`).toContain(s)
      expect(statuses).toContain(200)
      for (const res of results) {
        if (res.status === 409) expect(await res.json()).toEqual({ error: SCHEDULES_CHANGED_MESSAGE })
      }
      expect(await livePrimaries(tournamentId)).toHaveLength(1)
      await syncCheck(tournamentId)
    }
  })
})

describe('what the readers show of changed and removed schedules', () => {
  it('an archived schedule is in no answer, and its rounds are kept in the table', async () => {
    const { admin, tournamentId, primaryId, fastId } = await withTwoDay()
    expect((await patch(admin, tournamentId, { schedules: [{ id: primaryId, isPrimary: true, rounds: threeDay }] })).status).toBe(200)
    const detail = await expectContract(await invoke(tournamentGet, { params: { id: tournamentId } }), contracts['tournaments/[id]'].GET.response)
    const manage = await expectContract(await invoke(manageGet, { as: admin, params: { id: tournamentId } }), contracts['admin/tournaments/[id]/manage'].GET.response)
    for (const t of [detail.tournament, manage.tournament]) {
      expect(t.schedules.map((s) => s.id)).toEqual([primaryId])
      expect(t.round_schedule).toEqual(threeDay)
    }
    expect(await roundsOf(fastId)).toEqual(twoDay)
    const all = await loadSchedules(getDb(env.DB), tournamentId, { includeArchived: true })
    expect(all.map((s) => [s.id, s.archivedAt === null])).toEqual([[primaryId, true], [fastId, false]])
  })

  it('an archived schedule\'s id cannot be sent again: 400, nothing brought back', async () => {
    const { admin, tournamentId, primaryId, fastId } = await withTwoDay()
    expect((await patch(admin, tournamentId, { schedules: [{ id: primaryId, isPrimary: true, rounds: threeDay }] })).status).toBe(200)
    const before = await snapshot(tournamentId)
    const res = await patch(admin, tournamentId, { schedules: [
      { id: primaryId, isPrimary: true, rounds: threeDay },
      { id: fastId, isPrimary: false, mergeRound: 3, rounds: twoDay },
    ] })
    expect(res.status).toBe(400)
    expect(await snapshot(tournamentId)).toEqual(before)
  })

  it('the order sent is the order answered, and the primary is the one flagged, not the first', async () => {
    const { admin, tournamentId, primaryId, fastId } = await withTwoDay()
    const res = await patch(admin, tournamentId, { schedules: [
      { id: fastId, isPrimary: false, mergeRound: 3, rounds: twoDay },
      { id: primaryId, isPrimary: true, rounds: threeDay },
    ] })
    expect(res.status).toBe(200)
    const { tournament } = await expectContract(res, contracts['admin/tournaments/[id]'].PATCH.response)
    expect(tournament.schedules.map((s) => s.id)).toEqual([fastId, primaryId])
    expect(tournament.round_schedule).toEqual(threeDay)
    await syncCheck(tournamentId)
  })

  it('a time control left out is kept, and null clears it; a label left out is kept', async () => {
    const { admin, tournamentId, primaryId, fastId } = await withTwoDay()
    const send = (second: object) => patch(admin, tournamentId, { schedules: [
      { id: primaryId, isPrimary: true, rounds: threeDay },
      { id: fastId, isPrimary: false, mergeRound: 3, rounds: twoDay, ...second },
    ] })
    const control = async () => (await liveRows(tournamentId)).find((s) => s.id === fastId)
    expect((await send({})).status).toBe(200)
    expect(await control()).toMatchObject({ label: '2-day', time_control: 'G/60;d5' })
    expect((await send({ timeControl: null })).status).toBe(200)
    expect(await control()).toMatchObject({ label: '2-day', time_control: null })
    expect((await send({ timeControl: 'G/30;d5' })).status).toBe(200)
    expect(await control()).toMatchObject({ time_control: 'G/30;d5' })
    await syncCheck(tournamentId)
  })

  it('times are free text and are never reinterpreted: "7:00 PM", "TBD", an empty time and a date with a weekday come back as written', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ rounds: 4 })
    const written = [
      { round: 1, date: 'Fri, Oct 23', time: '7:00 PM' },
      { round: 2, date: '2026-10-24', time: 'TBD' },
      { round: 3, date: '2026-10-24', time: '' },
      { round: 4, date: '', time: '10:00 AM' },
    ]
    const res = await patch(admin, tournamentId, { roundSchedule: written })
    expect(res.status).toBe(200)
    const { tournament } = await expectContract(res, contracts['admin/tournaments/[id]'].PATCH.response)
    expect(tournament.round_schedule).toEqual(written)
    expect(await roundsOf((await primaryOf(tournamentId)).id)).toEqual(written)
    expect(JSON.parse((await storedMirror(tournamentId))!)).toEqual(written)
    await syncCheck(tournamentId)
  })
})

describe('the edges of the merge round and the round count', () => {
  it('a merge round of 2 and a merge round at the last round are accepted', async () => {
    const { admin, tournamentId, primaryId } = await fiveRounds()
    for (const [mergeRound, rounds] of [[2, twoDay.slice(0, 1)], [5, [...twoDay, ...threeDay.slice(2, 4)]]] as const) {
      const res = await patch(admin, tournamentId, { schedules: [
        { id: primaryId, isPrimary: true, rounds: threeDay },
        { label: `merge ${mergeRound}`, isPrimary: false, mergeRound, rounds },
      ] })
      expect(res.status, `merge round ${mergeRound}`).toBe(200)
      expect((await liveRows(tournamentId)).find((s) => s.merge_round === mergeRound)).toBeDefined()
      await syncCheck(tournamentId)
    }
  })

  it('the round count can be lowered to the merge round and raised, and one below the merge round is refused', async () => {
    const { admin, tournamentId, fastId } = await withTwoDay()
    expect((await patch(admin, tournamentId, { rounds: 3 })).status).toBe(200)
    expect((await liveRows(tournamentId)).find((s) => s.id === fastId)?.merge_round).toBe(3)
    expect((await patch(admin, tournamentId, { rounds: 2 })).status).toBe(400)
    expect((await patch(admin, tournamentId, { rounds: 7 })).status).toBe(200)
    await syncCheck(tournamentId)
  })

  it('more rounds than one insert holds are written and read back whole', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ rounds: 45 })
    const many = Array.from({ length: 45 }, (_, i) => day(i + 1, `2026-10-${String(10 + (i % 15)).padStart(2, '0')}`, `${String(8 + (i % 10)).padStart(2, '0')}:00`))
    const res = await patch(admin, tournamentId, { roundSchedule: many })
    expect(res.status).toBe(200)
    const { tournament } = await expectContract(res, contracts['admin/tournaments/[id]'].PATCH.response)
    expect(tournament.round_schedule).toEqual(many)
    expect(await roundsOf((await primaryOf(tournamentId)).id)).toEqual(many)
    await syncCheck(tournamentId)
  })

  it('a tournament that has no round times yet answers [] and one empty main schedule from every reader', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament()
    const detail = await expectContract(await invoke(tournamentGet, { params: { id: tournamentId } }), contracts['tournaments/[id]'].GET.response)
    const manage = await expectContract(await invoke(manageGet, { as: admin, params: { id: tournamentId } }), contracts['admin/tournaments/[id]/manage'].GET.response)
    for (const t of [detail.tournament, manage.tournament]) {
      expect(t.round_schedule).toEqual([])
      expect(t.schedules).toEqual([expect.objectContaining({ isPrimary: true, mergeRound: null, rounds: [] })])
    }
  })
})
