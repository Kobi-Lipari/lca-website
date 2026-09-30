import { describe, expect, it } from 'vitest'
import { awardPrizes, prizeFundTotal, type PrizeStanding, type SectionPrizes } from '../../functions/utils/prizes'

const S = 'Open'
const p = (member_id: string, score: number, rating: number | null, grade?: number): PrizeStanding =>
  ({ member_id, section: S, score, rating, grade })

const field = [p('A', 4, 1800), p('B', 3.5, 1300), p('C', 3.5, 1700), p('D', 3, 1350), p('E', 2, 1200), p('U', 1, null)]
const cash = (awards: ReturnType<typeof awardPrizes>) => Object.fromEntries(awards.map((a) => [a.member_id, a.cash]))

describe('prizes', () => {
  it('splits place prizes among players tied on score', () => {
    const prizes: SectionPrizes = { place: [{ amount: 100 }, { amount: 60 }, { amount: 40 }] }
    const awards = awardPrizes([{ name: S, prizes }], field)
    expect(cash(awards)).toEqual({ A: 100, B: 50, C: 50 })
    expect(awards.find((a) => a.member_id === 'B')?.prize).toBe('2nd–3rd place (tie)')
  })

  it('pools the remaining prizes when a tie runs past the last prize', () => {
    const tied = [p('A', 3, 1500), p('B', 3, 1400), p('C', 3, 1300), p('D', 2, 1200)]
    const awards = awardPrizes([{ name: S, prizes: { place: [{ amount: 90 }, { amount: 30 }] } }], tied)
    expect(cash(awards)).toEqual({ A: 40, B: 40, C: 40 })
  })

  it('gives each player the larger of a place or class prize, and moves others up', () => {
    const small: SectionPrizes = {
      place: [{ amount: 100 }, { amount: 60 }, { amount: 40 }],
      classes: [{ label: 'Top U1400', ratingMax: 1399, prizes: [{ amount: 50 }] }],
    }
    // B's place share (50) equals the class prize, so B keeps the place
    // prize and the class prize passes to D.
    expect(cash(awardPrizes([{ name: S, prizes: small }], field))).toEqual({ A: 100, B: 50, C: 50, D: 50 })

    const big: SectionPrizes = { ...small, classes: [{ label: 'Top U1400', ratingMax: 1399, prizes: [{ amount: 80 }] }] }
    // B takes the bigger class prize; C and D move up in the place prizes.
    const awards = awardPrizes([{ name: S, prizes: big }], field)
    expect(cash(awards)).toEqual({ A: 100, B: 80, C: 60, D: 40 })
    expect(awards.find((a) => a.member_id === 'B')?.prize).toBe('Top U1400')
  })

  it('keeps unrated players out of rating classes unless allowed', () => {
    const fieldU = [p('A', 3, 1800), p('U', 2, null), p('L', 1, 1100)]
    const cls = (unratedOk: boolean): SectionPrizes => ({
      classes: [{ label: 'Top U1400', ratingMax: 1399, unratedOk, prizes: [{ amount: 30 }] }, { label: 'Top unrated', unratedOnly: true, prizes: [{ amount: 20 }] }],
    })
    expect(cash(awardPrizes([{ name: S, prizes: cls(false) }], fieldU))).toEqual({ U: 20, L: 30 })
    // Allowed in, U takes the bigger U1400 prize and L gets nothing.
    expect(cash(awardPrizes([{ name: S, prizes: cls(true) }], fieldU))).toEqual({ U: 30 })
  })

  it('awards grade classes by grade', () => {
    const kids = [p('A', 3, 900, 5), p('B', 2.5, 700, 2), p('C', 2, 600, 3)]
    const prizes: SectionPrizes = { classes: [{ label: 'Top K-3', gradeMax: 3, prizes: [{ amount: 0, label: 'Trophy' }, { label: 'Trophy' }] }] }
    const awards = awardPrizes([{ name: S, prizes }], kids)
    expect(awards.map((a) => [a.member_id, a.items])).toEqual([['B', ['Trophy (Top K-3)']], ['C', ['Trophy (Top K-3)']]])
  })

  it('gives non-cash prizes by tiebreak order, alongside cash', () => {
    const prizes: SectionPrizes = { place: [{ amount: 100, label: 'Trophy' }, { amount: 60 }, { amount: 40, label: 'Medal' }] }
    const awards = awardPrizes([{ name: S, prizes }], field)
    expect(awards.find((a) => a.member_id === 'A')?.items).toEqual(['Trophy (1st)'])
    // C is third in tiebreak order even though B and C split the cash.
    expect(awards.find((a) => a.member_id === 'C')?.items).toEqual(['Medal (3rd)'])
  })

  it('adds up the cash on offer', () => {
    expect(prizeFundTotal({ place: [{ amount: 100 }, { label: 'Trophy' }], classes: [{ label: 'x', prizes: [{ amount: 25 }] }] })).toBe(125)
  })
})
