// Event-mode phases (domain/events/eventMode.ts): the Phase 0 rules from the
// brief's WS02 "Event mode" paragraph, checked at their boundaries in
// Louisiana time, across midnight and both 2026 clock changes (Sun, Mar 8 and
// Sun, Nov 1), for one-day and multi-day events.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  AFTER_EVENT_MS,
  EVENT_PHASES,
  eventEndMs,
  eventModeWindow,
  eventPhase,
  firstRoundTimesFromSchedule,
  phaseKey,
  type EventPhase,
  type EventPhaseInput,
} from '../../domain/events/eventMode'
import { lcaTimeToMs } from '../../domain/format/centralTime'
import { zonedParts } from '../../domain/format/date'

/** A Louisiana wall-clock time as an instant. */
const ct = (wall: string) => lcaTimeToMs(wall)
/** An instant written in UTC, so the clock-change tests do not lean on the code under test. */
const utc = (iso: string) => Date.parse(`${iso}Z`)
const MS = 1

function event(over: Partial<EventPhaseInput> = {}): EventPhaseInput {
  return {
    date: '2026-10-24',
    endDate: null,
    status: 'upcoming',
    firstRoundTimes: { '2026-10-24': '10:00' },
    lastRoundResultsComplete: false,
    ...over,
  }
}

/** Every phase seen, in order, stepping through the window a minute at a time. */
function sequence(input: EventPhaseInput, from: number, to: number, stepMs = 60_000): Array<EventPhase | null> {
  const seen: Array<EventPhase | null> = []
  for (let t = from; t <= to; t += stepMs) {
    const p = eventPhase(input, t)
    if (seen[seen.length - 1] !== p) seen.push(p)
  }
  return seen
}

describe('the phase list', () => {
  it('names every phase in the brief', () => {
    expect([...EVENT_PHASES]).toEqual([
      'week', 'dayBefore', 'checkin', 'eventDay',
      'roundPosted', 'roundInProgress', 'between', 'final', 'after',
    ])
  })
})

describe('a one-day event (Sat, Oct 24, 2026, Round 1 at 10:00 AM, end_date null)', () => {
  const e = event()

  it.each<[string, number, EventPhase | null]>([
    ['Sun, Oct 18, 5:59 AM: before the window', ct('2026-10-18 05:59') + 59_999, null],
    ['Sun, Oct 18, 6:00 AM: the window opens', ct('2026-10-18 06:00'), 'week'],
    ['Wed, Oct 21, noon', ct('2026-10-21 12:00'), 'week'],
    ['Thu, Oct 22, the last moment before midnight', ct('2026-10-23 00:00') - MS, 'week'],
    ['Fri, Oct 23, midnight', ct('2026-10-23 00:00'), 'dayBefore'],
    ['Fri, Oct 23, 11:59 PM', ct('2026-10-23 23:59'), 'dayBefore'],
    ['Sat, Oct 24, midnight', ct('2026-10-24 00:00'), 'dayBefore'],
    ['Sat, Oct 24, 5:59 AM', ct('2026-10-24 05:59'), 'dayBefore'],
    ['Sat, Oct 24, 6:00 AM: check-in opens', ct('2026-10-24 06:00'), 'checkin'],
    ['Sat, Oct 24, the last moment before Round 1', ct('2026-10-24 10:00') - MS, 'checkin'],
    ['Sat, Oct 24, 10:00 AM: Round 1', ct('2026-10-24 10:00'), 'eventDay'],
    ['Sat, Oct 24, 11:59 PM', ct('2026-10-24 23:59'), 'eventDay'],
  ])('%s', (_label, now, phase) => {
    expect(eventPhase(e, now)).toBe(phase)
  })

  it('moves week, dayBefore, checkin, eventDay, after and then off, in that order', () => {
    expect(sequence(e, ct('2026-10-17 00:00'), ct('2026-10-28 00:00'))).toEqual([
      null, 'week', 'dayBefore', 'checkin', 'eventDay', 'after', null,
    ])
  })

  it('takes a Date as well as epoch milliseconds', () => {
    expect(eventPhase(e, new Date(ct('2026-10-24 09:00')))).toBe('checkin')
  })

  it('treats an end date equal to the start date like end_date null', () => {
    const same = event({ endDate: '2026-10-24' })
    for (const wall of ['2026-10-18 06:00', '2026-10-23 00:00', '2026-10-24 09:00', '2026-10-24 12:00', '2026-10-26 12:00']) {
      expect(eventPhase(same, ct(wall)), wall).toBe(eventPhase(e, ct(wall)))
    }
  })

  it('treats an end date before the start date as a one-day event', () => {
    expect(eventEndMs(event({ endDate: '2026-10-20' }))).toBe(ct('2026-10-24 23:59'))
  })
})

describe('midnight', () => {
  const e = event()

  it('switches week to dayBefore at midnight starting the day before', () => {
    expect(eventPhase(e, ct('2026-10-23 00:00') - MS)).toBe('week')
    expect(eventPhase(e, ct('2026-10-23 00:00'))).toBe('dayBefore')
  })

  it('keeps dayBefore through the night until 6:00 AM on day 1', () => {
    expect(eventPhase(e, ct('2026-10-24 00:00') - MS)).toBe('dayBefore')
    expect(eventPhase(e, ct('2026-10-24 00:00'))).toBe('dayBefore')
    expect(eventPhase(e, ct('2026-10-24 06:00') - MS)).toBe('dayBefore')
  })

  it('keeps a round that runs past midnight on its day until 6:00 AM', () => {
    expect(eventPhase(e, ct('2026-10-25 00:30'))).toBe('eventDay')
    expect(eventPhase(e, ct('2026-10-25 06:00') - MS)).toBe('eventDay')
  })

  it('goes straight to after when the last results come in after midnight', () => {
    const late = event({ lastRoundResultsComplete: true })
    expect(eventPhase(late, ct('2026-10-24 23:58'))).toBe('final')
    expect(eventPhase(late, ct('2026-10-25 00:40'))).toBe('after')
  })

  it('is after once the morning after comes with no final results', () => {
    expect(eventPhase(e, ct('2026-10-25 06:00'))).toBe('after')
    expect(eventPhase(e, ct('2026-10-26 23:58'))).toBe('after')
  })
})

describe('final', () => {
  it('is final for a completed event while the event day lasts', () => {
    const done = event({ status: 'completed', lastRoundResultsComplete: true })
    expect(eventPhase(done, ct('2026-10-24 18:00'))).toBe('final')
    expect(eventPhase(done, ct('2026-10-24 23:59') - MS)).toBe('final')
  })

  it('is final when the last round has results but the event is not marked completed', () => {
    const results = event({ status: 'active', lastRoundResultsComplete: true })
    expect(eventPhase(results, ct('2026-10-24 21:00'))).toBe('final')
  })

  it('is final for a completed event with no results', () => {
    const noResults = event({ status: 'completed', lastRoundResultsComplete: false })
    expect(eventPhase(noResults, ct('2026-10-24 21:00'))).toBe('final')
    expect(eventPhase(noResults, ct('2026-10-24 12:00'))).toBe('final')
  })

  it('wins over the calendar phases inside the window', () => {
    const done = event({ status: 'completed' })
    expect(eventPhase(done, ct('2026-10-20 12:00'))).toBe('final')
    expect(eventPhase(done, ct('2026-10-24 08:00'))).toBe('final')
  })

  it('is still null outside the window', () => {
    const done = event({ status: 'completed', lastRoundResultsComplete: true })
    expect(eventPhase(done, ct('2026-10-18 06:00') - MS)).toBeNull()
    expect(eventPhase(done, ct('2026-10-26 23:59'))).toBeNull()
  })

  it('a status other than completed does not make it final', () => {
    for (const status of ['upcoming', 'active', 'Completed', '']) {
      expect(eventPhase(event({ status }), ct('2026-10-24 12:00')), status).toBe('eventDay')
    }
  })
})

describe('after, and the end of the window', () => {
  const done = event({ status: 'completed', lastRoundResultsComplete: true })

  it('starts at 11:59 PM on the last day', () => {
    expect(eventEndMs(done)).toBe(ct('2026-10-24 23:59'))
    expect(eventPhase(done, ct('2026-10-24 23:59'))).toBe('after')
  })

  it('lasts 48 hours from the end of the event and then switches off', () => {
    const end = ct('2026-10-24 23:59') + AFTER_EVENT_MS
    expect(end).toBe(ct('2026-10-26 23:59'))
    expect(eventPhase(done, end - MS)).toBe('after')
    expect(eventPhase(done, end)).toBeNull()
    expect(eventPhase(event(), end - MS)).toBe('after')
    expect(eventPhase(event(), end)).toBeNull()
  })

  it('reports the window it uses', () => {
    expect(eventModeWindow(done)).toEqual({
      start: ct('2026-10-18 06:00'),
      end: ct('2026-10-26 23:59'),
    })
  })
})

describe('a multi-day event (Sat–Sun, Jun 12–13, 2027)', () => {
  const e = event({
    date: '2027-06-12',
    endDate: '2027-06-13',
    firstRoundTimes: { '2027-06-12': '10:00', '2027-06-13': '09:30' },
  })

  it.each<[string, EventPhase | null]>([
    ['2027-06-06 06:00', 'week'],
    ['2027-06-11 00:00', 'dayBefore'],
    ['2027-06-12 06:00', 'checkin'],
    ['2027-06-12 09:59', 'checkin'],
    ['2027-06-12 10:00', 'eventDay'],
    ['2027-06-12 23:59', 'eventDay'],
    ['2027-06-13 00:00', 'eventDay'],
    ['2027-06-13 05:59', 'eventDay'],
    ['2027-06-13 06:00', 'checkin'],
    ['2027-06-13 09:29', 'checkin'],
    ['2027-06-13 09:30', 'eventDay'],
    ['2027-06-13 23:58', 'eventDay'],
    ['2027-06-14 06:00', 'after'],
    ['2027-06-15 23:58', 'after'],
    ['2027-06-15 23:59', null],
  ])('%s is %s', (wall, phase) => {
    expect(eventPhase(e, ct(wall))).toBe(phase)
  })

  it('switches from checkin to eventDay at each day\'s first round time', () => {
    expect(sequence(e, ct('2027-06-12 05:00'), ct('2027-06-14 07:00'))).toEqual([
      'dayBefore', 'checkin', 'eventDay', 'checkin', 'eventDay', 'after',
    ])
    expect(eventPhase(e, ct('2027-06-12 10:00') - MS)).toBe('checkin')
    expect(eventPhase(e, ct('2027-06-13 09:30') - MS)).toBe('checkin')
  })

  it('counts the 48 hours from the last day, not day 1', () => {
    expect(eventEndMs(e)).toBe(ct('2027-06-13 23:59'))
    expect(eventModeWindow(e)?.end).toBe(ct('2027-06-15 23:59'))
  })

  it('stays in checkin all day when a day has no round time yet', () => {
    const tba = event({
      date: '2027-06-11',
      endDate: '2027-06-13',
      firstRoundTimes: { '2027-06-11': '19:00', '2027-06-12': null, '2027-06-13': '09:30' },
    })
    expect(eventPhase(tba, ct('2027-06-11 19:00'))).toBe('eventDay')
    expect(eventPhase(tba, ct('2027-06-12 06:00'))).toBe('checkin')
    expect(eventPhase(tba, ct('2027-06-12 22:00'))).toBe('checkin')
    expect(eventPhase(tba, ct('2027-06-13 05:59'))).toBe('checkin')
    expect(eventPhase(tba, ct('2027-06-13 09:30'))).toBe('eventDay')
  })

  it('treats a missing day or a time that is not HH:MM as not set', () => {
    for (const firstRoundTimes of [{}, { '2027-06-12': '' }, { '2027-06-12': '10:00 AM' }, { '2027-06-12': '25:00' }]) {
      expect(eventPhase(event({ ...e, firstRoundTimes }), ct('2027-06-12 15:00'))).toBe('checkin')
    }
  })

  it('starts eventDay at 6:00 AM when the first round is set before then', () => {
    const early = event({ date: '2027-06-12', firstRoundTimes: { '2027-06-12': '05:00' } })
    expect(eventPhase(early, ct('2027-06-12 05:30'))).toBe('dayBefore')
    expect(eventPhase(early, ct('2027-06-12 06:00'))).toBe('eventDay')
  })

  it('is final on day 1 when the event is marked completed early, then after', () => {
    const done = event({ ...e, status: 'completed' })
    expect(eventPhase(done, ct('2027-06-12 15:00'))).toBe('final')
    expect(eventPhase(done, ct('2027-06-13 23:59'))).toBe('after')
  })
})

describe('a day of the event with no round (no key, while other days have one)', () => {
  // Fri, Oct 2 to Sun, Oct 4, 2026, with rounds on Friday and Sunday only.
  const weekend = event({
    date: '2026-10-02',
    endDate: '2026-10-04',
    firstRoundTimes: { '2026-10-02': '19:00', '2026-10-04': '09:00' },
  })

  it.each<[string, EventPhase | null]>([
    ['2026-10-02 19:00', 'eventDay'],
    ['2026-10-03 05:59', 'eventDay'],
    ['2026-10-03 06:00', 'dayBefore'],
    ['2026-10-03 14:00', 'dayBefore'],
    ['2026-10-04 05:59', 'dayBefore'],
    ['2026-10-04 06:00', 'checkin'],
    ['2026-10-04 09:00', 'eventDay'],
  ])('%s is %s, never checkin on the Saturday', (wall, phase) => {
    expect(eventPhase(weekend, ct(wall))).toBe(phase)
  })

  it('is the same when built from a schedule with no Saturday round', () => {
    const firstRoundTimes = firstRoundTimesFromSchedule([
      { date: '2026-10-02', time: '19:00' },
      { date: '2026-10-04', time: '09:00' },
      { date: '2026-10-04', time: '14:00' },
    ], '2026-10-02', '2026-10-04')
    expect(Object.keys(firstRoundTimes)).not.toContain('2026-10-03')
    expect(eventPhase(event({ ...weekend, firstRoundTimes }), ct('2026-10-03 14:00'))).toBe('dayBefore')
  })

  it('is week when the next round day is more than a day off (one round a week)', () => {
    // Sat, Oct 3 to Sat, Oct 17, 2026, a round each Saturday at 10:00 AM.
    const weekly = event({
      date: '2026-10-03',
      endDate: '2026-10-17',
      firstRoundTimes: { '2026-10-03': '10:00', '2026-10-10': '10:00', '2026-10-17': '10:00' },
    })
    expect(eventPhase(weekly, ct('2026-10-04 05:59'))).toBe('eventDay')
    expect(eventPhase(weekly, ct('2026-10-04 06:00'))).toBe('week')
    expect(eventPhase(weekly, ct('2026-10-07 12:00'))).toBe('week')
    expect(eventPhase(weekly, ct('2026-10-09 05:59'))).toBe('week')
    expect(eventPhase(weekly, ct('2026-10-09 06:00'))).toBe('dayBefore')
    expect(eventPhase(weekly, ct('2026-10-10 06:00'))).toBe('checkin')
    expect(eventPhase(weekly, ct('2026-10-14 12:00'))).toBe('week')
    expect(eventPhase(weekly, ct('2026-10-17 10:00'))).toBe('eventDay')
  })

  it('is eventDay when no round day is left, then after the next morning', () => {
    const sundayOff = event({
      date: '2026-10-02',
      endDate: '2026-10-04',
      firstRoundTimes: { '2026-10-02': '19:00', '2026-10-03': '09:00' },
    })
    expect(eventPhase(sundayOff, ct('2026-10-04 06:00'))).toBe('eventDay')
    expect(eventPhase(sundayOff, ct('2026-10-04 23:00'))).toBe('eventDay')
    expect(eventPhase(sundayOff, ct('2026-10-05 06:00'))).toBe('after')
  })

  it('treats day 1 with no round as the day before the first round day', () => {
    const satOnly = event({ date: '2026-10-02', endDate: '2026-10-03', firstRoundTimes: { '2026-10-03': '10:00' } })
    expect(eventPhase(satOnly, ct('2026-10-01 12:00'))).toBe('dayBefore')
    expect(eventPhase(satOnly, ct('2026-10-02 06:00'))).toBe('dayBefore')
    expect(eventPhase(satOnly, ct('2026-10-02 20:00'))).toBe('dayBefore')
    expect(eventPhase(satOnly, ct('2026-10-03 06:00'))).toBe('checkin')
  })

  it('keeps a null value (a round with no time yet) in checkin', () => {
    const tba = event({ ...weekend, firstRoundTimes: { ...weekend.firstRoundTimes, '2026-10-03': null } })
    expect(eventPhase(tba, ct('2026-10-03 14:00'))).toBe('checkin')
  })

  it('treats every day as time to be announced when no key falls inside the event', () => {
    const stray = event({ firstRoundTimes: { '2026-10-23': '09:00' } })
    expect(eventPhase(stray, ct('2026-10-24 12:00'))).toBe('checkin')
  })

  it('is still final for a completed event on an off day', () => {
    expect(eventPhase(event({ ...weekend, status: 'completed' }), ct('2026-10-03 14:00'))).toBe('final')
  })
})

describe('the spring clock change (Sun, Mar 8, 2026: 2:00 AM becomes 3:00 AM)', () => {
  const e = event({
    date: '2026-03-07',
    endDate: '2026-03-08',
    firstRoundTimes: { '2026-03-07': '10:00', '2026-03-08': '09:00' },
  })

  it('opens check-in at 6:00 AM CST on Saturday and 6:00 AM CDT on Sunday', () => {
    expect(eventPhase(e, utc('2026-03-07T11:59:59.999'))).toBe('dayBefore')
    expect(eventPhase(e, utc('2026-03-07T12:00:00'))).toBe('checkin')
    // Sunday 5:59 AM CDT is 10:59 UTC: still Saturday's event day.
    expect(eventPhase(e, utc('2026-03-08T10:59:59.999'))).toBe('eventDay')
    expect(eventPhase(e, utc('2026-03-08T11:00:00'))).toBe('checkin')
    // Round 2 at 9:00 AM CDT is 14:00 UTC.
    expect(eventPhase(e, utc('2026-03-08T13:59:59.999'))).toBe('checkin')
    expect(eventPhase(e, utc('2026-03-08T14:00:00'))).toBe('eventDay')
  })

  it('stays on Saturday\'s event day through the skipped hour', () => {
    // 1:59 AM CST is 07:59 UTC; the next minute, 08:00 UTC, is 3:00 AM CDT.
    expect(eventPhase(e, utc('2026-03-08T07:59:00'))).toBe('eventDay')
    expect(eventPhase(e, utc('2026-03-08T08:00:00'))).toBe('eventDay')
  })

  it('opens the window at 6:00 AM CDT on the Sunday of the change', () => {
    const sat14 = event({ date: '2026-03-14', firstRoundTimes: { '2026-03-14': '10:00' } })
    expect(eventModeWindow(sat14)?.start).toBe(utc('2026-03-08T11:00:00'))
    expect(eventPhase(sat14, utc('2026-03-08T10:59:59.999'))).toBeNull()
    expect(eventPhase(sat14, utc('2026-03-08T11:00:00'))).toBe('week')
    // Midnight starting Fri, Mar 13 (CDT) is 05:00 UTC.
    expect(eventPhase(sat14, utc('2026-03-13T04:59:59.999'))).toBe('week')
    expect(eventPhase(sat14, utc('2026-03-13T05:00:00'))).toBe('dayBefore')
  })

  it('ends the window 48 real hours after 11:59 PM CST, at 12:59 AM CDT', () => {
    const fri6 = event({ date: '2026-03-06', firstRoundTimes: { '2026-03-06': '19:00' }, status: 'completed' })
    // Fri 11:59 PM CST is Sat 05:59 UTC; 48 hours later is Mon 05:59 UTC.
    expect(eventEndMs(fri6)).toBe(utc('2026-03-07T05:59:00'))
    const end = eventModeWindow(fri6)?.end as number
    expect(end).toBe(utc('2026-03-09T05:59:00'))
    expect(zonedParts(end)).toEqual({ year: 2026, month: 3, day: 9, hour: 0, minute: 59 })
    expect(eventPhase(fri6, end - MS)).toBe('after')
    expect(eventPhase(fri6, end)).toBeNull()
  })
})

describe('the autumn clock change (Sun, Nov 1, 2026: 2:00 AM becomes 1:00 AM)', () => {
  const e = event({
    date: '2026-10-31',
    endDate: '2026-11-01',
    firstRoundTimes: { '2026-10-31': '10:00', '2026-11-01': '09:00' },
  })

  it('opens check-in at 6:00 AM CDT on Saturday and 6:00 AM CST on Sunday', () => {
    expect(eventPhase(e, utc('2026-10-31T10:59:59.999'))).toBe('dayBefore')
    expect(eventPhase(e, utc('2026-10-31T11:00:00'))).toBe('checkin')
    // Sunday 5:59 AM CST is 11:59 UTC: still Saturday's event day.
    expect(eventPhase(e, utc('2026-11-01T11:59:59.999'))).toBe('eventDay')
    expect(eventPhase(e, utc('2026-11-01T12:00:00'))).toBe('checkin')
    // Round 2 at 9:00 AM CST is 15:00 UTC.
    expect(eventPhase(e, utc('2026-11-01T14:59:59.999'))).toBe('checkin')
    expect(eventPhase(e, utc('2026-11-01T15:00:00'))).toBe('eventDay')
  })

  it('stays on Saturday\'s event day through both 1:30 AMs', () => {
    expect(eventPhase(e, utc('2026-11-01T06:30:00'))).toBe('eventDay') // 1:30 AM CDT
    expect(eventPhase(e, utc('2026-11-01T07:30:00'))).toBe('eventDay') // 1:30 AM CST
  })

  it('opens the window at 6:00 AM CST on the Sunday of the change', () => {
    const sat7 = event({ date: '2026-11-07', firstRoundTimes: { '2026-11-07': '10:00' } })
    expect(eventModeWindow(sat7)?.start).toBe(utc('2026-11-01T12:00:00'))
    expect(eventPhase(sat7, utc('2026-11-01T11:59:59.999'))).toBeNull()
    expect(eventPhase(sat7, utc('2026-11-01T12:00:00'))).toBe('week')
  })

  it('ends the window 48 real hours after 11:59 PM CDT, at 10:59 PM CST', () => {
    const fri30 = event({ date: '2026-10-30', firstRoundTimes: { '2026-10-30': '19:00' }, lastRoundResultsComplete: true })
    // Fri 11:59 PM CDT is Sat 04:59 UTC; 48 hours later is Mon 04:59 UTC, Sun 10:59 PM CST.
    expect(eventEndMs(fri30)).toBe(utc('2026-10-31T04:59:00'))
    const end = eventModeWindow(fri30)?.end as number
    expect(end).toBe(utc('2026-11-02T04:59:00'))
    expect(zonedParts(end)).toEqual({ year: 2026, month: 11, day: 1, hour: 22, minute: 59 })
    expect(eventPhase(fri30, end - MS)).toBe('after')
    expect(eventPhase(fri30, end)).toBeNull()
  })

  it('ends a weekend event that finishes on the Sunday of the change 48 hours after 11:59 PM CST', () => {
    const done = event({ ...e, status: 'completed' })
    expect(eventEndMs(done)).toBe(utc('2026-11-02T05:59:00'))
    expect(eventPhase(done, utc('2026-11-04T05:58:59.999'))).toBe('after')
    expect(eventPhase(done, utc('2026-11-04T05:59:00'))).toBeNull()
  })
})

describe('round phases (WS07)', () => {
  it('are never produced in Phase 0', () => {
    const inputs = [
      event(),
      event({ date: '2026-10-31', endDate: '2026-11-01', firstRoundTimes: { '2026-10-31': '10:00', '2026-11-01': '09:00' } }),
      event({ status: 'completed' }),
      event({ lastRoundResultsComplete: true }),
      event({ firstRoundTimes: {} }),
    ]
    const seen = new Set<EventPhase | null>()
    for (const input of inputs) {
      const span = eventModeWindow(input) as { start: number; end: number }
      for (const p of sequence(input, span.start - 3_600_000, span.end + 3_600_000, 15 * 60_000)) seen.add(p)
    }
    for (const p of ['roundPosted', 'roundInProgress', 'between'] as const) expect(seen.has(p), p).toBe(false)
    for (const p of [null, 'week', 'dayBefore', 'checkin', 'eventDay', 'final', 'after'] as const) expect(seen.has(p), String(p)).toBe(true)
  })
})

describe('inputs that cannot be read', () => {
  it('returns null for a date that is not a calendar day', () => {
    for (const date of ['', '2026-02-30', 'Oct 24', '2026-10-24T10:00']) {
      expect(eventPhase(event({ date }), ct('2026-10-24 12:00')), date).toBeNull()
      expect(eventModeWindow(event({ date })), date).toBeNull()
    }
  })

  it('treats an unreadable end date as a one-day event', () => {
    expect(eventEndMs(event({ endDate: 'soon' }))).toBe(ct('2026-10-24 23:59'))
  })

  it('returns null for a time that is not a number', () => {
    expect(eventPhase(event(), Number.NaN)).toBeNull()
    expect(eventPhase(event(), new Date('nonsense'))).toBeNull()
  })

  it('ignores a round time for a day outside the event', () => {
    const e = event({ firstRoundTimes: { '2026-10-23': '09:00', '2026-10-24': '10:00' } })
    expect(eventPhase(e, ct('2026-10-23 12:00'))).toBe('dayBefore')
  })
})

describe('the host time zone', () => {
  const original = process.env.TZ
  afterEach(() => {
    if (original === undefined) delete process.env.TZ
    else process.env.TZ = original
  })

  it('gives the same phases in UTC, Tokyo and Honolulu', () => {
    const e = event({ date: '2026-10-31', endDate: '2026-11-01', firstRoundTimes: { '2026-10-31': '10:00', '2026-11-01': '09:00' } })
    const times = ['2026-10-25 06:00', '2026-10-30 00:00', '2026-10-31 06:00', '2026-10-31 10:00', '2026-11-01 05:59', '2026-11-01 06:00', '2026-11-01 09:00', '2026-11-03 22:58'].map(ct)
    const expected = ['week', 'dayBefore', 'checkin', 'eventDay', 'eventDay', 'checkin', 'eventDay', 'after']
    for (const tz of ['UTC', 'Asia/Tokyo', 'Pacific/Honolulu']) {
      process.env.TZ = tz
      expect(times.map((t) => eventPhase(e, t)), tz).toEqual(expected)
    }
  })

  it('reads no local-time Date method and never the host clock', () => {
    const source = readFileSync(resolve(__dirname, '../../domain/events/eventMode.ts'), 'utf8')
    expect(source).not.toMatch(/\.(get|set)(FullYear|Month|Date|Day|Hours|Minutes|Seconds|TimezoneOffset)\(/)
    expect(source).not.toMatch(/Date\.now\(|new Date\(\)/)
    expect(source).not.toMatch(/toLocale/)
  })
})

describe('phaseKey', () => {
  it('is event:phase:round, with 0 when there is no round', () => {
    expect(phaseKey('t_42', 'week')).toBe('t_42:week:0')
    expect(phaseKey('t_42', 'checkin', null)).toBe('t_42:checkin:0')
    expect(phaseKey('t_42', 'roundPosted', 3)).toBe('t_42:roundPosted:3')
    expect(phaseKey(7, 'after', undefined)).toBe('7:after:0')
  })

  it('changes with the phase and with the round', () => {
    expect(phaseKey('t', 'roundPosted', 3)).not.toBe(phaseKey('t', 'roundInProgress', 3))
    expect(phaseKey('t', 'roundPosted', 3)).not.toBe(phaseKey('t', 'roundPosted', 4))
  })

  it('tells the day before day 1 from an off day before round 2 when the next round is passed', () => {
    // A weekly event, Thu, Oct 1 to Thu, Oct 22, 2026, one round at 7:00 PM each Thursday.
    const weekly = event({
      date: '2026-10-01',
      endDate: '2026-10-22',
      firstRoundTimes: { '2026-10-01': '19:00', '2026-10-08': '19:00', '2026-10-15': '19:00', '2026-10-22': '19:00' },
    })
    const beforeDay1 = eventPhase(weekly, ct('2026-09-30 12:00'))
    const beforeRound2 = eventPhase(weekly, ct('2026-10-07 12:00'))
    expect(beforeDay1).toBe('dayBefore')
    expect(beforeRound2).toBe('dayBefore')
    // Without a round both keys are the same, so a strip hidden on Wed, Sep 30 would stay hidden on Wed, Oct 7.
    expect(phaseKey(9, beforeDay1 as EventPhase)).toBe(phaseKey(9, beforeRound2 as EventPhase))
    expect(phaseKey(9, beforeDay1 as EventPhase, 1)).toBe('9:dayBefore:1')
    expect(phaseKey(9, beforeRound2 as EventPhase, 2)).toBe('9:dayBefore:2')
    expect(phaseKey(9, beforeDay1 as EventPhase, 1)).not.toBe(phaseKey(9, beforeRound2 as EventPhase, 2))
    // The same holds for check-in on each playing day.
    expect(eventPhase(weekly, ct('2026-10-01 12:00'))).toBe('checkin')
    expect(eventPhase(weekly, ct('2026-10-08 12:00'))).toBe('checkin')
    expect(phaseKey(9, 'checkin', 1)).not.toBe(phaseKey(9, 'checkin', 2))
  })
})

describe('firstRoundTimesFromSchedule', () => {
  it('takes the earliest round time of each day', () => {
    expect(firstRoundTimesFromSchedule([
      { date: '2027-06-12', time: '14:30' },
      { date: '2027-06-12', time: '10:00' },
      { date: '2027-06-12', time: '19:00' },
      { date: '2027-06-13', time: '9:30' },
      { date: '2027-06-13', time: '14:00' },
    ], '2027-06-12', '2027-06-13')).toEqual({ '2027-06-12': '10:00', '2027-06-13': '09:30' })
  })

  it('marks a day whose rounds have no time yet as null', () => {
    expect(firstRoundTimesFromSchedule([
      { date: '2027-06-12', time: '' },
      { date: '2027-06-13', time: '' },
      { date: '2027-06-13', time: '13:00' },
    ], '2027-06-12', '2027-06-13')).toEqual({ '2027-06-12': null, '2027-06-13': '13:00' })
  })

  it('leaves a day with no round without a key when every round is dated inside the event', () => {
    expect(firstRoundTimesFromSchedule([
      { date: '2026-10-02', time: '19:00' },
      { date: '2026-10-04', time: '09:00' },
    ], '2026-10-02', '2026-10-04')).toEqual({ '2026-10-02': '19:00', '2026-10-04': '09:00' })
  })

  it('gives every other event day null while any round has no date', () => {
    expect(firstRoundTimesFromSchedule([
      { date: '2027-06-12', time: '10:00' },
      { date: '', time: '10:00' },
      { date: null, time: null },
      {},
    ], '2027-06-12', '2027-06-14')).toEqual({ '2027-06-12': '10:00', '2027-06-13': null, '2027-06-14': null })
  })

  it('gives every other event day null when a round is dated outside the event, and leaves that round out', () => {
    expect(firstRoundTimesFromSchedule([
      { date: '2026-10-03', time: '09:00' },
      { date: '2026-10-11', time: '09:00' },
    ], '2026-10-03', '2026-10-04')).toEqual({ '2026-10-03': '09:00', '2026-10-04': null })
  })

  it('handles a missing schedule', () => {
    expect(firstRoundTimesFromSchedule(null, '2027-06-12', null)).toEqual({})
    expect(firstRoundTimesFromSchedule(undefined, '2027-06-12', null)).toEqual({})
  })

  it('feeds eventPhase directly', () => {
    const e = event({
      date: '2027-06-12',
      endDate: '2027-06-13',
      firstRoundTimes: firstRoundTimesFromSchedule([
        { date: '2027-06-12', time: '10:00' },
        { date: '2027-06-12', time: '14:30' },
        { date: '2027-06-13', time: '09:30' },
      ], '2027-06-12', '2027-06-13'),
    })
    expect(eventPhase(e, ct('2027-06-12 12:00'))).toBe('eventDay')
    expect(eventPhase(e, ct('2027-06-13 09:00'))).toBe('checkin')
  })
})

describe('a schedule still being written never makes an off day', () => {
  // Fri, Oct 2 to Sun, Oct 4, 2026. The setup form writes one row per round;
  // only round 1 has a date so far, rounds 2 to 5 have times but no dates.
  const partly = event({
    date: '2026-10-02',
    endDate: '2026-10-04',
    firstRoundTimes: firstRoundTimesFromSchedule([
      { date: '2026-10-02', time: '19:00' },
      { date: '', time: '10:00' },
      { date: '', time: '15:00' },
      { date: '', time: '09:00' },
      { date: '', time: '14:00' },
    ], '2026-10-02', '2026-10-04'),
  })

  it.each<[string, EventPhase | null]>([
    ['2026-10-02 18:59', 'checkin'],
    ['2026-10-02 19:00', 'eventDay'],
    ['2026-10-03 05:59', 'eventDay'],
    ['2026-10-03 06:00', 'checkin'],
    ['2026-10-03 07:00', 'checkin'],
    ['2026-10-03 23:59', 'checkin'],
    ['2026-10-04 06:00', 'checkin'],
    ['2026-10-04 07:00', 'checkin'],
    ['2026-10-04 23:59', 'checkin'],
    ['2026-10-05 05:00', 'checkin'],
    ['2026-10-05 06:00', 'after'],
  ])('round 1 dated, rounds 2 to 5 undated: %s is %s', (wall, phase) => {
    expect(eventPhase(partly, ct(wall))).toBe(phase)
  })

  it('keeps day 2 in checkin when its rounds carry a date outside the event', () => {
    // Sat, Oct 3 to Sun, Oct 4, 2026; Sunday's round was typed as Oct 11.
    const typo = event({
      date: '2026-10-03',
      endDate: '2026-10-04',
      firstRoundTimes: firstRoundTimesFromSchedule([
        { date: '2026-10-03', time: '09:00' },
        { date: '2026-10-11', time: '09:00' },
      ], '2026-10-03', '2026-10-04'),
    })
    expect(eventPhase(typo, ct('2026-10-03 10:00'))).toBe('eventDay')
    expect(eventPhase(typo, ct('2026-10-04 07:00'))).toBe('checkin')
    expect(eventPhase(typo, ct('2026-10-04 23:00'))).toBe('checkin')
  })
})
