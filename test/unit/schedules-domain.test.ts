// test/unit/schedules-domain.test.ts
//
// The pure parts of the one schedule writer and reader (K2g):
// - domain/events/schedules.ts: reading the legacy round_schedule JSON
//   (checked here against the 0053 trigger itself on node:sqlite), the JSON
//   the writer stores, the schedule rules (one primary, merge rounds and the
//   rounds each schedule lists), a player's own rounds and the schedule a
//   player is paired within in a round
// - the schedule contracts in domain/contracts/events.ts
// - the helpers in functions/utils/events/schedulesRepo.ts that need no
//   database: answers, the fingerprint, new ids and conflict errors
import { describe, expect, it } from 'vitest'
import {
  SCHEDULE_LABEL_MAX,
  normalizeRoundSchedule,
  primarySchedule,
  roundScheduleJson,
  roundsFor,
  scheduleForRound,
  scheduleHasEntriesMessage,
  validateSchedules,
  type ScheduleRecord,
  type ScheduleShape,
} from '../../domain/events/schedules'
import {
  scheduleInputSchema,
  scheduleRoundSchema,
  scheduleSchema,
  tournamentListItemSchema,
  updateTournamentRequestSchema,
} from '../../domain/contracts/events'
import {
  isSchedulesConflict,
  newScheduleId,
  roundScheduleResponse,
  scheduleResponse,
  schedulesFingerprint,
} from '../../functions/utils/events/schedulesRepo'
import { openMigratedDb } from './helpers/sqlite'

const r = (round: number, date: string | null = '2026-10-24', time: string | null = '09:00') => ({ round, date, time })

/** A 5-round event: the 3-day main schedule and a 2-day schedule that merges at round 3. */
function twoSchedules(over: Partial<ScheduleShape> = {}): ScheduleShape<ReturnType<typeof r>>[] {
  return [
    { id: 'main', label: '3-day', isPrimary: true, mergeRound: null, rounds: [r(1, '2026-10-23', '19:00'), r(2, '2026-10-24', '10:00'), r(3, '2026-10-24', '16:00'), r(4, '2026-10-25', '10:00'), r(5, '2026-10-25', '15:00')] },
    { id: 'fast', label: '2-day', isPrimary: false, mergeRound: 3, rounds: [r(1, '2026-10-24', '09:00'), r(2, '2026-10-24', '12:00')], ...over } as ScheduleShape<ReturnType<typeof r>>,
  ]
}

describe('normalizeRoundSchedule', () => {
  it('reads text or a parsed value into rows by round, keeping only round, date and time', () => {
    const json = '[{"round":2,"date":"2026-10-24","time":"14:00","note":"x"},{"round":1,"date":"2026-10-24","time":"09:00"}]'
    expect(normalizeRoundSchedule(json)).toEqual([r(1), r(2, '2026-10-24', '14:00')])
    expect(normalizeRoundSchedule(JSON.parse(json))).toEqual(normalizeRoundSchedule(json))
  })

  it('gives no rounds for malformed JSON, a non-array, null or a number', () => {
    for (const value of ['[{"round":1', '{"round":1}', 'null', null, undefined, 42, { round: 1 }]) {
      expect(normalizeRoundSchedule(value)).toEqual([])
    }
  })

  it('keeps blank and free-text dates and times as written, and makes any other value null', () => {
    expect(normalizeRoundSchedule([
      { round: 1, date: '', time: '' },
      { round: 2, date: 'Sat, Oct 24', time: '7:00 PM' },
      { round: 3, date: 20261024, time: null },
      { round: 4 },
    ])).toEqual([r(1, '', ''), r(2, 'Sat, Oct 24', '7:00 PM'), r(3, null, null), r(4, null, null)])
  })

  it('skips what is not an object, a round below 1 or not a number, and keeps the first of a repeated round', () => {
    expect(normalizeRoundSchedule([
      'round 1', null, 3, [1], { round: 0 }, { round: -2 }, { round: true }, { round: null }, { date: 'x' },
      { round: 2, date: 'first' }, { round: 2, date: 'second' },
    ])).toEqual([r(2, 'first', null)])
  })

  it('reads a round written as a fraction or as text the way SQLite casts it', () => {
    expect(normalizeRoundSchedule([{ round: 2.9 }, { round: '3' }, { round: ' 4' }, { round: '5th' }, { round: 'abc' }, { round: '1e2' }])
      .map((x) => x.round)).toEqual([1, 2, 3, 4, 5])
  })

  it('matches the 0053 trigger row for row, and the JSON the writer stores reads back to the same rows', () => {
    const db = openMigratedDb()
    db.prepare(`INSERT INTO tournaments (id, name, location, date, entry_fee) VALUES ('t', 'T', 'Kenner, LA', '2026-10-24', 25)`).run()
    const rows = () => db.prepare(`SELECT round, date, time FROM tournament_schedule_rounds
      WHERE schedule_id = (SELECT id FROM tournament_schedules WHERE tournament_id = 't' AND is_primary = 1 AND archived_at IS NULL)
      ORDER BY round`).all().map((row) => ({ ...row }))
    const cases: unknown[] = [
      [{ round: 1, date: '2026-10-24', time: '09:00' }, { round: 2, date: '2026-10-24', time: '14:00' }],
      [{ round: 3, date: '', time: '' }, { round: '2', date: 'Sat, Oct 24', time: 7 }, { round: 1.5, extra: true }],
      [{ round: 2, date: 'first' }, { round: 2, date: 'second' }, { round: 0 }, 'x', null, { round: ' 4' }, { round: '5th' }],
      [],
    ]
    for (const value of cases) {
      db.prepare('UPDATE tournaments SET round_schedule = ? WHERE id = ?').run(JSON.stringify(value), 't')
      expect(rows(), JSON.stringify(value)).toEqual(normalizeRoundSchedule(value))
      // The writer's JSON for those rows makes the very same rows.
      const json = roundScheduleJson(normalizeRoundSchedule(value))
      db.prepare('UPDATE tournaments SET round_schedule = NULL WHERE id = ?').run('t')
      db.prepare('UPDATE tournaments SET round_schedule = ? WHERE id = ?').run(json, 't')
      expect(rows(), json).toEqual(normalizeRoundSchedule(value))
    }
  })
})

describe('roundScheduleJson: today\'s shape', () => {
  it('is [{ round, date, time }] by round, nulls kept, nothing else', () => {
    expect(JSON.parse(roundScheduleJson([r(2, '2026-10-24', '14:00'), r(1, null, '')]))).toEqual([
      { round: 1, date: null, time: '' }, { round: 2, date: '2026-10-24', time: '14:00' },
    ])
    expect(roundScheduleJson([])).toBe('[]')
  })
})

describe('validateSchedules', () => {
  it('accepts one schedule, and a second one that merges at round 3 of 5 listing rounds 1 and 2', () => {
    expect(validateSchedules([twoSchedules()[0]], 5)).toBeNull()
    expect(validateSchedules(twoSchedules(), 5)).toBeNull()
    expect(validateSchedules(twoSchedules({ mergeRound: 5, rounds: [r(1), r(2), r(3), r(4)] }), 5)).toBeNull()
    expect(validateSchedules(twoSchedules({ mergeRound: 2, rounds: [r(1)] }), 2)).toBeNull()
  })

  it('needs exactly one primary, with no merge round', () => {
    const [main, fast] = twoSchedules()
    expect(validateSchedules([], 5)).toBe('Mark exactly one schedule as the main schedule.')
    expect(validateSchedules([{ ...fast }], 5)).toBe('Mark exactly one schedule as the main schedule.')
    expect(validateSchedules([main, { ...fast, isPrimary: true, mergeRound: null }], 5)).toBe('Mark exactly one schedule as the main schedule.')
    expect(validateSchedules([{ ...main, mergeRound: 3 }], 5)).toBe('The main schedule has no merge round.')
  })

  it('refuses a merge round of 1, past the last round, or missing', () => {
    const message = 'The “2-day” schedule must join the main schedule at a round from 2 to 5.'
    expect(validateSchedules(twoSchedules({ mergeRound: 1, rounds: [] }), 5)).toBe(message)
    expect(validateSchedules(twoSchedules({ mergeRound: 6, rounds: [r(1), r(2), r(3), r(4), r(5)] }), 5)).toBe(message)
    expect(validateSchedules(twoSchedules({ mergeRound: null }), 5)).toBe(message)
    expect(validateSchedules(twoSchedules({ mergeRound: 2.5 }), 5)).toBe(message)
    expect(validateSchedules(twoSchedules(), 1)).toMatch(/needs an event of at least 2 rounds/)
  })

  it('refuses missing or extra rounds before the merge', () => {
    expect(validateSchedules(twoSchedules({ rounds: [r(1)] }), 5))
      .toBe('The “2-day” schedule needs its own time for each round from 1 to 2 (round 2 is missing).')
    expect(validateSchedules(twoSchedules({ rounds: [r(2)] }), 5)).toMatch(/round 1 is missing/)
    expect(validateSchedules(twoSchedules({ rounds: [r(1), r(2), r(3)] }), 5))
      .toBe('From round 3 the “2-day” schedule plays on the main schedule\'s times, so it lists only rounds 1 to 2.')
    expect(validateSchedules(twoSchedules({ rounds: [] }), 5)).toMatch(/round 1 is missing/)
  })

  it('refuses a round listed twice, or one that is not a whole number from 1', () => {
    expect(validateSchedules(twoSchedules({ rounds: [r(1), r(1), r(2)] }), 5)).toBe('Round 1 is listed twice in the “2-day” schedule.')
    const [main] = twoSchedules()
    expect(validateSchedules([{ ...main, rounds: [r(2), r(2)] }], 5)).toBe('Round 2 is listed twice in the main schedule.')
    expect(validateSchedules([{ ...main, rounds: [r(0)] }], 5)).toBe('Round numbers are whole numbers from 1 up.')
    expect(validateSchedules([{ ...main, rounds: [r(1.5)] }], 5)).toBe('Round numbers are whole numbers from 1 up.')
  })

  it('does not hold the main schedule to the round count (the setup keeps them in step)', () => {
    const [main] = twoSchedules()
    expect(validateSchedules([main], 3)).toBeNull()
  })

  it('refuses repeated or blank names and a schedule listed twice', () => {
    expect(validateSchedules(twoSchedules({ label: '3-day' }), 5)).toBe('Two schedules are named “3-day”. Give each schedule its own name.')
    expect(validateSchedules(twoSchedules({ label: '  ' }), 5)).toBe('Every schedule needs a name.')
    expect(validateSchedules(twoSchedules({ label: 'x'.repeat(SCHEDULE_LABEL_MAX + 1) }), 5)).toMatch(/at most 80 characters/)
    expect(validateSchedules(twoSchedules({ id: 'main' }), 5)).toBe('The same schedule is listed twice.')
  })
})

describe('roundsFor: a player\'s own rounds', () => {
  const schedules = twoSchedules()

  it('gives a 2-day player their own rounds before the merge and the main schedule\'s from the merge on', () => {
    expect(roundsFor(schedules, 'fast')).toEqual([
      r(1, '2026-10-24', '09:00'), r(2, '2026-10-24', '12:00'),
      r(3, '2026-10-24', '16:00'), r(4, '2026-10-25', '10:00'), r(5, '2026-10-25', '15:00'),
    ])
  })

  it('gives everyone else the main schedule: a main-schedule player, no schedule, and a schedule the event does not have', () => {
    for (const id of ['main', null, undefined, 'gone']) expect(roundsFor(schedules, id)).toEqual(schedules[0].rounds)
  })

  it('is by round even when the lists are not, and empty when there is no main schedule', () => {
    const shuffled = schedules.map((s) => ({ ...s, rounds: [...s.rounds].reverse() }))
    expect(roundsFor(shuffled, 'fast').map((x) => x.round)).toEqual([1, 2, 3, 4, 5])
    expect(roundsFor([schedules[1]], 'nobody')).toEqual([])
  })
})

describe('roundsFor and scheduleForRound at the edges', () => {
  it('a merge round of 2 gives one own round; the merge round itself is already on the main schedule', () => {
    const schedules = twoSchedules({ mergeRound: 2, rounds: [r(1, '2026-10-24', '08:00')] })
    expect(roundsFor(schedules, 'fast').map((x) => [x.round, x.time])).toEqual([[1, '08:00'], ...schedules[0].rounds.filter((x) => x.round >= 2).map((x) => [x.round, x.time])])
    expect(scheduleForRound(schedules, 'fast', 1)?.id).toBe('fast')
    expect(scheduleForRound(schedules, 'fast', 2)?.id).toBe('main')
  })

  it('a main schedule that stops short lists only what it has after the merge, and nothing is invented', () => {
    const schedules = twoSchedules()
    const short = [{ ...schedules[0], rounds: schedules[0].rounds.filter((x) => x.round <= 3) }, schedules[1]]
    expect(roundsFor(short, 'fast').map((x) => x.round)).toEqual([1, 2, 3])
    expect(roundsFor(short, 'main').map((x) => x.round)).toEqual([1, 2, 3])
  })

  it('does not change the lists it is given', () => {
    const schedules = twoSchedules()
    const copy = JSON.parse(JSON.stringify(schedules))
    roundsFor(schedules, 'fast')
    scheduleForRound(schedules, 'fast', 1)
    expect(schedules).toEqual(copy)
  })
})

describe('scheduleForRound: who plays together in a round', () => {
  const schedules = twoSchedules()

  it('keeps a 2-day player with the 2-day schedule before the merge round, and with the main schedule from it', () => {
    expect(scheduleForRound(schedules, 'fast', 1)?.id).toBe('fast')
    expect(scheduleForRound(schedules, 'fast', 2)?.id).toBe('fast')
    expect(scheduleForRound(schedules, 'fast', 3)?.id).toBe('main')
    expect(scheduleForRound(schedules, 'fast', 5)?.id).toBe('main')
  })

  it('puts a main-schedule player, no schedule and an unknown one on the main schedule; null without one', () => {
    for (const id of ['main', null, 'gone']) expect(scheduleForRound(schedules, id, 1)?.id).toBe('main')
    expect(scheduleForRound([schedules[1]], 'nobody', 1)).toBeNull()
    expect(primarySchedule(schedules)?.id).toBe('main')
  })
})

describe('messages', () => {
  it('a schedule left out with entries, one and many', () => {
    expect(scheduleHasEntriesMessage('2-day', 1)).toBe('1 entry is on the “2-day” schedule. Move it to another schedule first.')
    expect(scheduleHasEntriesMessage('2-day', 3)).toBe('3 entries are on the “2-day” schedule. Move them to another schedule first.')
  })
})

describe('the schedule contracts', () => {
  const answer = {
    id: 'a1', label: '2-day', timeControl: 'G/60;d5', isPrimary: false, mergeRound: 3,
    rounds: [{ round: 1, date: '2026-10-24', time: '09:00' }, { round: 2, date: '', time: '' }],
  }

  it('an answer: strict, merge round 2 or more or null, rounds with text dates and times', () => {
    expect(scheduleSchema.safeParse(answer).success).toBe(true)
    expect(scheduleSchema.safeParse({ ...answer, isPrimary: true, mergeRound: null }).success).toBe(true)
    expect(scheduleSchema.safeParse({ ...answer, extra: 1 }).success).toBe(false)
    expect(scheduleSchema.safeParse({ ...answer, mergeRound: 1 }).success).toBe(false)
    expect(scheduleRoundSchema.safeParse({ round: 1, date: null, time: '' }).success).toBe(false)
    expect(scheduleRoundSchema.safeParse({ round: 0, date: '', time: '' }).success).toBe(false)
  })

  it('every tournament answer carries round_schedule as rounds and the schedules', () => {
    expect(Object.keys(tournamentListItemSchema.shape)).toEqual(expect.arrayContaining(['round_schedule', 'schedules']))
  })

  it('a request: an answer sent back passes, rounds need a whole round number, the label 1 to 80 characters', () => {
    expect(scheduleInputSchema.safeParse(answer).success).toBe(true)
    expect(scheduleInputSchema.safeParse({ isPrimary: true, rounds: [{ round: 1 }] }).success).toBe(true)
    expect(scheduleInputSchema.safeParse({ isPrimary: true, rounds: [{ round: 1.5 }] }).success).toBe(false)
    expect(scheduleInputSchema.safeParse({ isPrimary: true, rounds: [{ round: 0 }] }).success).toBe(false)
    expect(scheduleInputSchema.safeParse({ rounds: [] }).success).toBe(false)
    expect(scheduleInputSchema.safeParse({ ...answer, label: 'x'.repeat(SCHEDULE_LABEL_MAX) }).success).toBe(true)
    expect(scheduleInputSchema.safeParse({ ...answer, label: 'x'.repeat(SCHEDULE_LABEL_MAX + 1) }).success).toBe(false)
    expect(scheduleInputSchema.safeParse({ ...answer, label: ' ' }).success).toBe(false)
    // The merge round is checked against the event's rounds by validateSchedules, not here.
    expect(scheduleInputSchema.safeParse({ ...answer, mergeRound: 1 }).success).toBe(true)
    expect(updateTournamentRequestSchema.safeParse({ schedules: [answer] }).success).toBe(true)
    expect(updateTournamentRequestSchema.safeParse({ roundSchedule: [{ round: 1, date: '', time: '' }] }).success).toBe(true)
  })
})

describe('schedulesRepo helpers', () => {
  const record = (over: Partial<ScheduleRecord> = {}): ScheduleRecord => ({
    id: 'p', tournamentId: 't', position: 0, label: 'Main schedule', timeControl: null, isPrimary: true, mergeRound: null,
    archivedAt: null, rounds: [r(1, null, null), r(2, '2026-10-24', '14:00')], ...over,
  })

  it('answers a date or time not set as the blank the setup form uses', () => {
    expect(scheduleResponse(record())).toEqual({
      id: 'p', label: 'Main schedule', timeControl: null, isPrimary: true, mergeRound: null,
      rounds: [{ round: 1, date: '', time: '' }, { round: 2, date: '2026-10-24', time: '14:00' }],
    })
    expect(scheduleSchema.safeParse(scheduleResponse(record())).success).toBe(true)
  })

  it('round_schedule is the live primary\'s rounds, [] without one', () => {
    const other = record({ id: 'o', isPrimary: false, mergeRound: 2, rounds: [r(1, 'x', 'y')] })
    const archived = record({ id: 'old', archivedAt: '2026-10-01 00:00:00', rounds: [r(9)] })
    expect(roundScheduleResponse([other, archived, record()])).toEqual([{ round: 1, date: '', time: '' }, { round: 2, date: '2026-10-24', time: '14:00' }])
    expect(roundScheduleResponse([other])).toEqual([])
    expect(roundScheduleResponse([])).toEqual([])
  })

  it('the fingerprint is by id and changes with the primary flag, the merge round and archiving', () => {
    const a = record({ id: 'a' })
    const b = record({ id: 'b', isPrimary: false, mergeRound: 3 })
    expect(schedulesFingerprint([b, a])).toBe(schedulesFingerprint([a, b]))
    expect(schedulesFingerprint([a, b])).toBe('a\u001f1\u001f\u001f\u001eb\u001f0\u001f3\u001f')
    expect(schedulesFingerprint([a, { ...b, mergeRound: 4 }])).not.toBe(schedulesFingerprint([a, b]))
    expect(schedulesFingerprint([{ ...a, isPrimary: false }, b])).not.toBe(schedulesFingerprint([a, b]))
    expect(schedulesFingerprint([a, { ...b, archivedAt: 'now' }])).not.toBe(schedulesFingerprint([a, b]))
  })

  it('new ids are 16 hex characters and differ', () => {
    const ids = new Set(Array.from({ length: 50 }, newScheduleId))
    expect(ids.size).toBe(50)
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{16}$/)
  })

  it('recognises a failed guard and a second primary, through wrapped causes, and nothing else', () => {
    const guard = new Error("D1_ERROR: bad JSON path: '$schedules changed t1'")
    expect(isSchedulesConflict(guard)).toBe(true)
    expect(isSchedulesConflict(new Error('Failed query', { cause: new Error('x', { cause: guard }) }))).toBe(true)
    expect(isSchedulesConflict(new Error('UNIQUE constraint failed: tournament_schedules.tournament_id'))).toBe(true)
    expect(isSchedulesConflict(new Error("bad JSON path: '$sections changed t1'"))).toBe(false)
    expect(isSchedulesConflict(new Error('UNIQUE constraint failed: tournament_schedule_rounds.schedule_id, tournament_schedule_rounds.round'))).toBe(false)
    expect(isSchedulesConflict(null)).toBe(false)
  })
})
