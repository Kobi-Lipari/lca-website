// test/unit/approval-words.test.ts
//
// waitWords (WS09 step 19), the approval wait's state in words, for the
// manage page, the admin club page and a club's Events tab. The state is
// approvalState's, read from the event's own columns; each date carries its
// weekday and year; the stored times are UTC (datetime('now')) and are shown
// as the day it was in Louisiana, so the cases here are the two clock changes
// and the midnights either side of them. Every event is made up.
import { describe, expect, it } from 'vitest'
import { approvalState } from '../../domain/events/approval'
import { waitWords } from '../../domain/events/approvalWords'

const draft = { needs_lca_approval: 1, approval_requested_at: null, approved_at: null }
const review = (at: string | null) => ({ needs_lca_approval: 1, approval_requested_at: at, approved_at: null })
const approved = (at: string | null, sent: string | null = '2026-11-14 18:00:00') => ({ needs_lca_approval: 1, approval_requested_at: sent, approved_at: at })

/** An en dash or an em dash, written by code so that this file holds neither. */
const LONG_DASH = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
/** US Chess's old initials, put together so that this file does not hold them. */
const OLD_INITIALS = new RegExp('US' + 'CF')

describe('waitWords: each state in words', () => {
  it('says nothing for an event that never waits, whatever its other columns hold', () => {
    expect(waitWords({ needs_lca_approval: 0, approval_requested_at: null, approved_at: null })).toBeNull()
    expect(waitWords({ needs_lca_approval: 0, approval_requested_at: '2026-11-14 18:00:00', approved_at: '2026-11-16 15:00:00' })).toBeNull()
    // Only the number 1 marks an event, as mayList reads it.
    expect(waitWords({ needs_lca_approval: 2, approval_requested_at: null, approved_at: null })).toBeNull()
  })

  it('says a draft is not sent yet, with no date', () => {
    expect(waitWords(draft)).toBe('Draft. Not sent for LCA review yet.')
  })

  it('says in review with the day it was sent, weekday and year included', () => {
    expect(waitWords(review('2026-11-14 18:00:00'))).toBe('Waiting for LCA approval. Sent for review on Sat, Nov 14, 2026.')
  })

  it('says approved with the day it was approved, not the day it was sent', () => {
    expect(waitWords(approved('2026-11-16 15:00:00'))).toBe('Approved by LCA on Mon, Nov 16, 2026.')
  })

  it('reads a blank or white space time as not set, so a blank send is a draft and a blank approval is still in review', () => {
    expect(waitWords(review('   '))).toBe(waitWords(draft))
    expect(waitWords(review(''))).toBe(waitWords(draft))
    expect(waitWords(approved('  '))).toBe(waitWords(review('2026-11-14 18:00:00')))
    expect(waitWords(approved(''))).toBe(waitWords(review('2026-11-14 18:00:00')))
  })

  it('is the state approvalState gives, in every combination of the three columns', () => {
    const times = [null, '', '  ', '2026-11-14 18:00:00']
    for (const needs of [0, 1]) {
      for (const sent of times) {
        for (const done of times) {
          const event = { needs_lca_approval: needs, approval_requested_at: sent, approved_at: done }
          const words = waitWords(event)
          const state = approvalState(event)
          if (state === 'not_marked') expect(words, JSON.stringify(event)).toBeNull()
          else if (state === 'draft') expect(words, JSON.stringify(event)).toBe('Draft. Not sent for LCA review yet.')
          else if (state === 'in_review') expect(words, JSON.stringify(event)).toMatch(/^Waiting for LCA approval\. Sent for review on [A-Z][a-z]{2}, /)
          else expect(words, JSON.stringify(event)).toMatch(/^Approved by LCA on [A-Z][a-z]{2}, /)
        }
      }
    }
  })
})

describe('waitWords: the Louisiana day of a UTC time', () => {
  const sentOn = (stamp: string) => waitWords(review(stamp))

  it('puts 5:59 PM, the last minute of a day in standard time, on that day and the next minute on the next, in winter', () => {
    expect(sentOn('2026-11-16 05:59:59')).toContain('on Sun, Nov 15, 2026.')
    expect(sentOn('2026-11-16 06:00:00')).toContain('on Mon, Nov 16, 2026.')
  })

  it('moves the midnight an hour earlier in daylight time', () => {
    expect(sentOn('2026-07-04 04:59:59')).toContain('on Fri, Jul 3, 2026.')
    expect(sentOn('2026-07-04 05:00:00')).toContain('on Sat, Jul 4, 2026.')
  })

  it('follows the fall clock change on Sunday, November 1, 2026: the day before it is daylight time, the day after it standard', () => {
    expect(sentOn('2026-11-01 04:59:59')).toContain('on Sat, Oct 31, 2026.')
    expect(sentOn('2026-11-01 05:00:00')).toContain('on Sun, Nov 1, 2026.')
    // The extra hour of that Sunday stays on that Sunday.
    expect(sentOn('2026-11-01 06:30:00')).toContain('on Sun, Nov 1, 2026.')
    expect(sentOn('2026-11-02 05:59:59')).toContain('on Sun, Nov 1, 2026.')
    expect(sentOn('2026-11-02 06:00:00')).toContain('on Mon, Nov 2, 2026.')
  })

  it('follows the spring clock change on Sunday, March 14, 2027', () => {
    expect(sentOn('2027-03-14 05:59:59')).toContain('on Sat, Mar 13, 2027.')
    expect(sentOn('2027-03-14 06:00:00')).toContain('on Sun, Mar 14, 2027.')
    expect(sentOn('2027-03-15 04:59:59')).toContain('on Sun, Mar 14, 2027.')
    expect(sentOn('2027-03-15 05:00:00')).toContain('on Mon, Mar 15, 2027.')
  })

  it('carries the year across New Year in Louisiana, not in UTC', () => {
    expect(sentOn('2027-01-01 05:59:59')).toContain('on Thu, Dec 31, 2026.')
    expect(sentOn('2027-01-01 06:00:00')).toContain('on Fri, Jan 1, 2027.')
  })

  it('reads an approval the same way', () => {
    expect(waitWords(approved('2026-11-17 05:59:59'))).toBe('Approved by LCA on Mon, Nov 16, 2026.')
    expect(waitWords(approved('2026-11-17 06:00:00'))).toBe('Approved by LCA on Tue, Nov 17, 2026.')
  })
})

describe('waitWords: the plain-language rules', () => {
  const every = [
    draft,
    review('2026-11-14 18:00:00'),
    approved('2026-11-16 15:00:00'),
    review('2027-03-14 06:00:00'),
  ]

  it('has no long dash, no old initials for US Chess and no decimal half, and never a time of day', () => {
    for (const event of every) {
      const words = waitWords(event) as string
      expect(words).not.toMatch(LONG_DASH)
      expect(words).not.toMatch(OLD_INITIALS)
      expect(words).not.toMatch(/\.5\b/)
      expect(words).not.toMatch(/\d:\d\d/)
    }
  })

  it('gives a weekday to every date it writes', () => {
    for (const event of every.slice(1)) {
      expect(waitWords(event)).toMatch(/\b(Sun|Mon|Tue|Wed|Thu|Fri|Sat), [A-Z][a-z]{2} \d{1,2}, \d{4}\./)
    }
  })

  it('does not change what it is given', () => {
    const event = Object.freeze(review('2026-11-14 18:00:00'))
    expect(() => waitWords(event)).not.toThrow()
    expect(waitWords(event)).toBe(waitWords({ ...event }))
  })
})
