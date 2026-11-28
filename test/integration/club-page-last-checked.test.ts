// test/integration/club-page-last-checked.test.ts
// The told line of GET /api/clubs/[id]/page, "Last checked" and a month, read
// through the real endpoint on a real database (K's decision 12, checkpoint
// W). The month is that of the later of the last save and the last Still
// accurate, read in Louisiana's time: at a month's end, across the clock
// changes of 2026, across a year's end, from each form a stored stamp takes,
// and never from the time of the request. A stamp that is no date is set
// aside; with no date left the line is empty. A told_updated_at no save made
// (migration 0067's stamp: no saver and no check) is not a save. The answer's keys are the
// contract's keys and no others. CLUB_PAGES_ON is set through a getter on a
// mock of its module; no case reads how it ships. Every club here is made up.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { env } from 'cloudflare:test'
import { invoke } from './harness'
import { seedClub, seedMember } from './factories'

import { onRequestGet as pageGet } from '../../functions/api/clubs/[id]/page'
import { clubPageResponseSchema } from '../../domain/contracts/clubPage'

const flags = vi.hoisted(() => ({ pagesOn: false }))
vi.mock('../../functions/utils/clubs/pages', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/clubs/pages')>()
  return {
    ...real,
    get CLUB_PAGES_ON() {
      return flags.pagesOn
    },
  }
})
afterEach(() => {
  flags.pagesOn = false
  vi.useRealTimers()
})

let made = 0

/**
 * A made-up club with meeting words and a place, and the two stamps given.
 * A save writes told_by with told_updated_at, so a given save has a made-up
 * saver unless `saver` is false, as migration 0067's stamp has none.
 */
async function clubStamped(saved: string | null, checked: string | null, saver = true): Promise<string> {
  const m = `${++made}${crypto.randomUUID().slice(0, 6)}`
  const id = await seedClub({ id: `example-stamped-${m}`, name: `Example Stamped Club ${m}`, city: 'Example City' })
  const by = saved !== null && saver ? await seedMember({ fullName: 'Player One', email: `player-${m}@example.org` }) : null
  await env.DB.prepare(
    `UPDATE clubs SET slug = ?, how_we_meet_text = 'Tuesdays at 7:00 PM', told_updated_at = ?, told_by = ?, last_confirmed_at = ? WHERE id = ?`,
  ).bind(`example-stamped-club-${m}`, saved, by, checked, id).run()
  await env.DB.prepare(`INSERT INTO club_places (club_id, name, street, note, sort) VALUES (?, 'Example Library', '1 Example Street', NULL, 0)`).bind(id).run()
  return id
}

async function told(id: string): Promise<string> {
  flags.pagesOn = true
  const res = await invoke(pageGet, { params: { id } })
  expect(res.status).toBe(200)
  const body = (await res.response.clone().json()) as { statement: { told: string } }
  return body.statement.told
}

describe('the month, in Louisiana\'s time', () => {
  it('reads a save at 11:59 PM on Mon, Nov 30 as November and one a minute on as December', async () => {
    expect(await told(await clubStamped('2026-12-01 05:59:59', null))).toBe('Last checked November 2026')
    expect(await told(await clubStamped('2026-12-01 06:00:00', null))).toBe('Last checked December 2026')
  })

  it('reads a Still accurate at a month\'s end the same way, with an older save beside it', async () => {
    expect(await told(await clubStamped('2026-09-10 15:00:00', '2026-11-01 04:59:59'))).toBe('Last checked October 2026')
    expect(await told(await clubStamped('2026-09-10 15:00:00', '2026-11-01 05:00:00'))).toBe('Last checked November 2026')
  })

  it('reads the offset in force on each side of the clock changes of 2026', async () => {
    // Daylight time began on Sun, Mar 8 and ends on Sun, Nov 1, 2026.
    expect(await told(await clubStamped('2026-04-01 04:59:59', null))).toBe('Last checked March 2026')
    expect(await told(await clubStamped('2026-04-01 05:00:00', null))).toBe('Last checked April 2026')
    expect(await told(await clubStamped(null, '2026-11-01 04:59:59'))).toBe('Last checked October 2026')
    expect(await told(await clubStamped(null, '2026-11-01 05:00:00'))).toBe('Last checked November 2026')
  })

  it('reads the new year in Louisiana: 11:59 PM on Thu, Dec 31, 2026 is still December 2026', async () => {
    expect(await told(await clubStamped('2027-01-01 05:59:59', null))).toBe('Last checked December 2026')
    expect(await told(await clubStamped('2027-01-01 06:00:00', null))).toBe('Last checked January 2027')
  })
})

describe('the later of the two', () => {
  it('gives the later month in each order, across a year\'s end too', async () => {
    expect(await told(await clubStamped('2026-10-05 15:00:00', '2026-11-02 15:00:00'))).toBe('Last checked November 2026')
    expect(await told(await clubStamped('2026-11-02 15:00:00', '2026-10-05 15:00:00'))).toBe('Last checked November 2026')
    expect(await told(await clubStamped('2026-12-20 15:00:00', '2027-01-10 15:00:00'))).toBe('Last checked January 2027')
    expect(await told(await clubStamped('2027-01-10 15:00:00', '2026-12-20 15:00:00'))).toBe('Last checked January 2027')
  })

  it('gives the one month when both fall in it, whichever stamp is later in that month', async () => {
    expect(await told(await clubStamped('2026-11-03 15:00:00', '2026-11-28 15:00:00'))).toBe('Last checked November 2026')
    expect(await told(await clubStamped('2026-11-28 15:00:00', '2026-11-03 15:00:00'))).toBe('Last checked November 2026')
  })

  it('compares months as months: an earlier year\'s later month is not later', async () => {
    expect(await told(await clubStamped('2025-12-15 15:00:00', '2026-01-15 15:00:00'))).toBe('Last checked January 2026')
    expect(await told(await clubStamped('2026-01-15 15:00:00', '2025-12-15 15:00:00'))).toBe('Last checked January 2026')
  })

  it('lets the one date stand when the other stamp is missing, empty or no date', async () => {
    for (const other of [null, '', 'not a date', '2026-13-40 10:00:00']) {
      expect(await told(await clubStamped('2026-10-05 15:00:00', other)), `checked ${other}`).toBe('Last checked October 2026')
      expect(await told(await clubStamped(other, '2026-10-05 15:00:00')), `saved ${other}`).toBe('Last checked October 2026')
    }
  })

  it('reads a stored stamp given in the T and Z form as the same moment', async () => {
    expect(await told(await clubStamped('2026-12-01T05:59:59Z', null))).toBe('Last checked November 2026')
    expect(await told(await clubStamped('2026-12-01T06:00:00Z', null))).toBe('Last checked December 2026')
  })
})

describe('a stamp no save made', () => {
  it('draws no line for migration 0067\'s stamp, with no saver and no check, and counts a save whose saver is gone', async () => {
    expect(await told(await clubStamped('2026-11-16 18:00:00', null, false))).toBe('')
    // A saver whose account is later deleted loses told_by; the save's last_confirmed_at stays.
    expect(await told(await clubStamped('2026-11-16 18:00:00', '2026-10-05 15:00:00', false))).toBe('Last checked November 2026')
  })
})

describe('never the time of the request', () => {
  it('reads the same month whatever the clock says when it is asked', async () => {
    const id = await clubStamped('2026-10-05 15:00:00', '2026-10-20 15:00:00')
    for (const now of ['2026-11-17T12:00:00Z', '2031-03-01T12:00:00Z', '2026-10-31T23:59:59-05:00']) {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date(now))
      expect(await told(id), now).toBe('Last checked October 2026')
      vi.useRealTimers()
    }
  })

  it('draws no line, and does not fall back to the request\'s month, with neither stamp', async () => {
    const id = await clubStamped(null, null)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-17T12:00:00Z'))
    expect(await told(id)).toBe('')
  })
})

describe('the answer\'s keys', () => {
  it('are the contract\'s keys and no others, with the told key in place and no author key', async () => {
    flags.pagesOn = true
    const id = await clubStamped('2026-10-05 15:00:00', '2026-11-02 15:00:00')
    const res = await invoke(pageGet, { params: { id } })
    const body = (await res.response.clone().json()) as Record<string, unknown>
    expect(Object.keys(body).sort()).toEqual(Object.keys(clubPageResponseSchema.shape).sort())
    expect(Object.keys(body.statement as object).sort()).toEqual(['text', 'told'])
    expect(JSON.stringify(body)).not.toMatch(/"author"|Kept by|As told/)
    expect(clubPageResponseSchema.safeParse(body).success).toBe(true)
  })
})
