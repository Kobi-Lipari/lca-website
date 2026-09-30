import { describe, expect, it } from 'vitest'
import { describeRules, effectiveRules, eligibilityProblem, rulesFromName } from '../../functions/utils/sectionRules'
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
    expect(describeRules(effectiveRules({ name: 'K-5' }))).toBe('Grades K–5')
  })
})

describe('eligibility', () => {
  it('checks rating and grade with a clear reason', () => {
    expect(eligibilityProblem({ name: 'U1600' }, { rating: 1650 })).toMatch(/under 1600/)
    expect(eligibilityProblem({ name: 'U1600' }, { rating: 1599 })).toBeNull()
    expect(eligibilityProblem({ name: 'U1600' }, { rating: null })).toBeNull()
    expect(eligibilityProblem({ name: 'K-5' }, { rating: 700, grade: null })).toMatch(/grade/)
    expect(eligibilityProblem({ name: 'K-5' }, { rating: 700, grade: 6 })).toMatch(/grades K–5/)
    expect(eligibilityProblem({ name: 'K-5' }, { rating: 700, grade: 0 })).toBeNull()
  })

  it('has identical browser and server copies', () => {
    for (const name of ['U1600', 'K-8', '2000+', 'Open', '3rd Grade']) {
      expect(browser.rulesFromName(name)).toEqual(rulesFromName(name))
    }
  })
})
