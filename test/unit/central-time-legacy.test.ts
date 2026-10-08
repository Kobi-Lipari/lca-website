// domain/format/centralTime.ts now reads Central time through the shared
// zonedParts in domain/format/date.ts instead of its own Intl call. This test
// holds a copy of the conversion as it was before that change and checks the
// two agree, including inside the hour that does not exist in spring, the
// hour that happens twice in autumn, and on unreadable text.
import { describe, expect, it } from 'vitest'
import { lcaTimeToMs } from '../../domain/format/centralTime'

const ZONE = 'America/Chicago'

function oldOffsetMinutes(instantMs: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONE,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(instantMs))
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return Math.round((asUtc - instantMs) / 60000)
}

function oldLcaTimeToMs(value: string): number {
  const v = value.trim()
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(v)) return new Date(v).getTime()
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(v)
  if (!m) return new Date(v).getTime()
  const [, y, mo, d, h, mi, s] = m
  const dateOnly = h === undefined
  const wall = Date.UTC(Number(y), Number(mo) - 1, Number(d),
    dateOnly ? 23 : Number(h), dateOnly ? 59 : Number(mi), dateOnly ? 59 : Number(s ?? 0))
  let guess = wall - oldOffsetMinutes(wall) * 60000
  guess = wall - oldOffsetMinutes(guess) * 60000
  return guess
}

const pad = (n: number) => String(n).padStart(2, '0')

describe('lcaTimeToMs matches the conversion it replaced', () => {
  it('on every quarter hour around both 2026 and 2027 clock changes', () => {
    const days = ['2026-03-07', '2026-03-08', '2026-03-09', '2026-10-31', '2026-11-01', '2026-11-02',
      '2027-03-13', '2027-03-14', '2027-03-15', '2027-11-06', '2027-11-07', '2027-11-08']
    let checked = 0
    for (const day of days) {
      for (let h = 0; h < 24; h++) {
        for (const mi of [0, 15, 30, 45, 59]) {
          for (const form of [`${day}T${pad(h)}:${pad(mi)}`, `${day} ${pad(h)}:${pad(mi)}:30`]) {
            expect(lcaTimeToMs(form), form).toBe(oldLcaTimeToMs(form))
            checked++
          }
        }
      }
      expect(lcaTimeToMs(day), day).toBe(oldLcaTimeToMs(day))
    }
    expect(checked).toBeGreaterThan(2000)
  })

  it('on a spread of dates through the year, at midnight, noon and the last minute', () => {
    for (let dayOfYear = 0; dayOfYear < 366; dayOfYear += 3) {
      const d = new Date(Date.UTC(2026, 0, 1 + dayOfYear)).toISOString().slice(0, 10)
      for (const t of ['00:00', '12:00', '23:59']) {
        expect(lcaTimeToMs(`${d}T${t}`), `${d}T${t}`).toBe(oldLcaTimeToMs(`${d}T${t}`))
      }
    }
  })

  it('on zoned values and unreadable text', () => {
    for (const v of ['2026-10-17T18:00:00Z', '2026-10-17T18:00:00+02:00', '2026-10-17T18:00:00-0500', 'soon', '', '17/10/2026', '2026-13-45T99:99']) {
      const a = lcaTimeToMs(v)
      const b = oldLcaTimeToMs(v)
      expect(Number.isNaN(a) ? 'NaN' : a, v).toBe(Number.isNaN(b) ? 'NaN' : b)
    }
  })
})
