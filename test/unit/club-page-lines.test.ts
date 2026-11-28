// test/unit/club-page-lines.test.ts
// The told line a club page writes under the club's meeting words
// (functions/utils/clubs/authorLine.ts, WS09 step 20), as K's decision 12
// words it: "Last checked" and the month of the later of the listing's last
// save and its last Still accurate, read in Central time at a month's edge
// and on either side of a clock change, and no line with neither or with a
// value that is no date. Who keeps a club is no longer built here: the file
// exports the told line alone, and the answer's contract has no author key.
import { describe, expect, it } from 'vitest'
import * as lines from '../../functions/utils/clubs/authorLine'
import { clubToldLine, toldWords } from '../../functions/utils/clubs/authorLine'
import { clubPageResponseSchema } from '../../domain/contracts/clubPage'
import { bareAnswer } from './helpers/clubPageAnswer'

describe('the told line\'s file', () => {
  it('exports the told line alone, with no author words left', () => {
    expect(Object.keys(lines).sort()).toEqual(['clubToldLine', 'toldWords'])
  })

  it('has no author key in the answer\'s contract, which refuses one', () => {
    expect(Object.keys(clubPageResponseSchema.shape)).not.toContain('author')
    expect(clubPageResponseSchema.safeParse({ ...bareAnswer(), author: 'Kept by LCA admins' }).success).toBe(false)
  })

  it('reads the two stamps a club row holds', () => {
    expect(clubToldLine({ told_updated_at: '2026-10-05 15:00:00', told_by: 'm1', last_confirmed_at: '2026-11-16 18:00:00' })).toBe('Last checked November 2026')
    expect(clubToldLine({ told_updated_at: null, told_by: null, last_confirmed_at: null })).toBe('')
    // Migration 0067's stamp, with no saver and no check, is not a save.
    expect(clubToldLine({ told_updated_at: '2026-11-16 18:00:00', told_by: null, last_confirmed_at: null })).toBe('')
  })
})

describe('the later of the last save and the last Still accurate', () => {
  it('gives the save\'s month when the save is later, in these words and no others', () => {
    expect(toldWords('2026-11-16 18:00:00', '2026-09-02 14:00:00')).toBe('Last checked November 2026')
  })

  it('gives the Still accurate\'s month when it is later', () => {
    expect(toldWords('2026-06-10 14:00:00', '2026-11-03 18:00:00')).toBe('Last checked November 2026')
  })

  it('gives the one month when both fall in it', () => {
    expect(toldWords('2026-11-02 14:00:00', '2026-11-16 18:00:00')).toBe('Last checked November 2026')
    expect(toldWords('2026-11-16 18:00:00', '2026-11-16 18:00:00')).toBe('Last checked November 2026')
  })

  it('gives the save\'s month when there has been no Still accurate', () => {
    expect(toldWords('2026-08-20 15:00:00', null)).toBe('Last checked August 2026')
  })

  it('gives the Still accurate\'s month when there has been no save', () => {
    expect(toldWords(null, '2026-07-01 15:00:00')).toBe('Last checked July 2026')
    expect(toldWords(undefined, '2026-07-01 15:00:00')).toBe('Last checked July 2026')
  })

  it('reads the later across a year\'s end, in each order', () => {
    expect(toldWords('2026-12-15 15:00:00', '2027-01-04 15:00:00')).toBe('Last checked January 2027')
    expect(toldWords('2027-01-04 15:00:00', '2026-12-15 15:00:00')).toBe('Last checked January 2027')
  })
})

describe('toldWords', () => {
  it('gives no line with neither stamp', () => {
    expect(toldWords(null, null)).toBe('')
    expect(toldWords(undefined, undefined)).toBe('')
    expect(toldWords('', '  ')).toBe('')
  })

  it('gives no line for a value that is no date, never Invalid Date, and lets the other stand', () => {
    expect(toldWords('not a date', null)).toBe('')
    expect(toldWords('2026-13-40 10:00:00', 'soon')).toBe('')
    expect(toldWords('not a date', '2026-10-05 15:00:00')).toBe('Last checked October 2026')
    expect(toldWords('2026-10-05 15:00:00', 'not a date')).toBe('Last checked October 2026')
    for (const words of [toldWords('not a date', 'soon'), toldWords('2026-02-30 10:00:00', null)]) expect(words).not.toMatch(/Invalid|NaN|undefined/)
  })

  it('reads the month in Central time at a month\'s edge: a save at 11:59 PM on Mon, Nov 30 in Louisiana is November\'s', () => {
    expect(toldWords('2026-12-01 05:59:59', null)).toBe('Last checked November 2026')
    expect(toldWords('2026-12-01 06:00:00', null)).toBe('Last checked December 2026')
    // A Still accurate late on Mon, Nov 30 in Louisiana is later than a save that morning, and both are November's.
    expect(toldWords('2026-11-30 15:00:00', '2026-12-01 05:59:59')).toBe('Last checked November 2026')
  })

  it('reads the month by the offset in force on either side of a clock change: daylight time ends on Sun, Nov 1, 2026', () => {
    // Sat, Oct 31 at 11:59 PM in daylight time is 4:59 AM on Sun, Nov 1 in UTC.
    expect(toldWords(null, '2026-11-01 04:59:59')).toBe('Last checked October 2026')
    expect(toldWords(null, '2026-11-01 05:00:00')).toBe('Last checked November 2026')
    // Tue, Mar 31 at 11:59 PM, after daylight time began on Sun, Mar 8, 2026.
    expect(toldWords('2026-04-01 04:59:59', null)).toBe('Last checked March 2026')
    expect(toldWords('2026-04-01 05:00:00', null)).toBe('Last checked April 2026')
  })
})
