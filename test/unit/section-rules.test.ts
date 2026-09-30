import { describe, expect, it } from 'vitest'
import { describeRules, effectiveRules, eligibilityProblem, gradeRangeText, intersectGradeRanges, parseGradeRange, rulesFromName } from '../../functions/utils/sectionRules'
import * as browser from '../../src/lib/sectionRules'

describe('section rules from names', () => {
  it('reads common section names', () => {
    expect(rulesFromName('U1600')).toEqual({ ratingMax: 1599, unratedOk: true })
    expect(rulesFromName('Under 1200')).toEqual({ ratingMax: 1199, unratedOk: true })
    expect(rulesFromName('K-5')).toEqual({ gradeMin: 0, gradeMax: 5 })
    expect(rulesFromName('K-12')).toEqual({ gradeMin: 0, gradeMax: 12 })
    expect(rulesFromName('1800+')).toEqual({ ratingMin: 1800, unratedOk: false })
    expect(rulesFromName('Open')).toEqual({})
    expect(rulesFromName('Blitz')).toEqual({})
  })

  it('lets a director override or clear the rules', () => {
    expect(effectiveRules({ name: 'U1600', rulesSet: true })).toMatchObject({ ratingMax: null, unratedOk: true })
    expect(describeRules(effectiveRules({ name: 'U1600' }))).toBe('Rated under 1600 (unrated welcome)')
    expect(describeRules(effectiveRules({ name: 'K-5' }))).toBe('5th grade or below')
  })
})

describe('eligibility', () => {
  it('checks rating and grade with a clear reason', () => {
    expect(eligibilityProblem({ name: 'U1600' }, { rating: 1650 })).toMatch(/under 1600/)
    expect(eligibilityProblem({ name: 'U1600' }, { rating: 1599 })).toBeNull()
    expect(eligibilityProblem({ name: 'U1600' }, { rating: null })).toBeNull()
    expect(eligibilityProblem({ name: 'K-5' }, { rating: 700, gradeRange: null })).toMatch(/5th grade or below/)
    // Confirmed only "8th or below": not enough for a K-5 section.
    expect(eligibilityProblem({ name: 'K-5' }, { rating: 700, gradeRange: { min: 0, max: 8 } })).toMatch(/confirm/)
    expect(eligibilityProblem({ name: 'K-5' }, { rating: 700, gradeRange: { min: 0, max: 5 } })).toBeNull()
    expect(eligibilityProblem({ name: 'K-5' }, { rating: 700, gradeRange: { min: 0, max: 3 } })).toBeNull()
  })

  it('asks in plain words and keeps only the range confirmed', () => {
    expect(gradeRangeText(0, 8)).toBe('in 8th grade or below')
    expect(gradeRangeText(0, 0)).toBe('in kindergarten')
    expect(gradeRangeText(6, 8)).toBe('in 6th through 8th grade')
    expect(gradeRangeText(9, 12)).toBe('in 9th grade or above')
    expect(gradeRangeText(3, 3)).toBe('in 3rd grade')
    expect(parseGradeRange('0-8')).toEqual({ min: 0, max: 8 })
    expect(parseGradeRange('K-3')).toEqual({ min: 0, max: 3 })
    expect(parseGradeRange('9-3')).toBeNull()
    expect(parseGradeRange('13')).toBeNull()
    expect(intersectGradeRanges({ min: 0, max: 8 }, { min: 0, max: 3 })).toEqual({ min: 0, max: 3 })
    expect(intersectGradeRanges({ min: 9, max: 12 }, { min: 0, max: 3 })).toBeNull()
  })

  it('has identical browser and server copies', () => {
    for (const name of ['U1600', 'K-8', '2000+', 'Open', '3rd Grade']) {
      expect(browser.rulesFromName(name)).toEqual(rulesFromName(name))
    }
  })
})
