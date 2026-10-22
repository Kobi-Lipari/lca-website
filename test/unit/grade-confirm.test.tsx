// @vitest-environment jsdom
//
// The grade confirmation after WS01 step 24 moved what it shares out of its
// component file, to fix the lint errors in a file the step rewrote
// (react-refresh/only-export-components: a component file exports only
// components). src/areas/events/gradeConfirm.ts now holds the ticks, the
// boxes a section asks for and the range the ticks confirm, reached through
// the events area's index; components/GradeConfirm.tsx draws the boxes. The
// code moved as it was (boxesFor is now gradeBoxes), and these tests hold
// what it does:
// - the boxes: one required box for a grade section, from its name or from
//   the director's rules; one optional box per grade prize the section's box
//   does not already cover, each range once; none for a section that asks
//   nothing, or for no section at all;
// - the range the ticks confirm, as it is sent with the entry: nothing
//   ticked gives nothing, the section's box its range, a prize's box with it
//   the overlap, and boxes that cannot all be true 'conflict';
// - the drawn boxes: the words for the signed-in member and for a family
//   member, what ticking and unticking each box sends, the conflict note,
//   and the navy tick (accent-ink, which is #1a2744 with newLook off);
// - where it is reached from: the area's index and the module are the same
//   code, the component file exports the component alone, and lint finds no
//   error in the files the move touched.
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ESLint } from 'eslint'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as events from '@/areas/events'
import * as componentFile from '@/areas/events/components/GradeConfirm'
import { asksGrade, confirmedRange, gradeBoxes, NO_TICKS, type GradeTicks } from '@/areas/events/gradeConfirm'
import type { ApiTournamentSection } from '@/lib/api'
import { ROOT } from './helpers/cssTokens'

const { GradeConfirm } = componentFile

afterEach(cleanup)

type PrizeClass = NonNullable<NonNullable<ApiTournamentSection['prizes']>['classes']>[number]

/** A section as the tournament page receives it: open to all unless the test says otherwise. */
function section(over: Partial<ApiTournamentSection> = {}): ApiTournamentSection {
  return {
    id: 'sec-1',
    name: 'Open',
    entryFee: 30,
    ratingMax: null,
    ratingMin: null,
    gradeMin: null,
    gradeMax: null,
    rulesSet: false,
    cap: null,
    fees: { regular: 30, early: null, late: null },
    ...over,
  }
}

/** A class prize with a grade range, such as "Top K-3". */
const gradePrize = (label: string, gradeMin: number | null, gradeMax: number | null): PrizeClass =>
  ({ label, gradeMin, gradeMax, prizes: [{ amount: 25 }] })

const ticks = (sectionTicked: boolean, prizes: string[] = []): GradeTicks => ({ section: sectionTicked, prizes })

describe('the boxes a section asks the entrant to tick', () => {
  it('asks nothing of a section open to all, or when no section is chosen', () => {
    expect(gradeBoxes(undefined)).toEqual([])
    expect(gradeBoxes(section())).toEqual([])
    expect(gradeBoxes(section({ name: 'U1600' }))).toEqual([])
    expect(asksGrade(undefined)).toBe(false)
    expect(asksGrade(section({ name: 'U1600' }))).toBe(false)
  })

  it('asks one required box for a grade section named for its grades, kindergarten counted as 0', () => {
    expect(gradeBoxes(section({ name: 'K-5' }))).toEqual([{ key: 'section', range: { min: 0, max: 5 }, required: true }])
    expect(gradeBoxes(section({ name: '3rd Grade' }))).toEqual([{ key: 'section', range: { min: 3, max: 3 }, required: true }])
    expect(asksGrade(section({ name: 'K-5' }))).toBe(true)
  })

  it('takes the director\'s grades once the rules are set, an open end running to K or 12', () => {
    expect(gradeBoxes(section({ name: 'K-5', rulesSet: true, gradeMin: null, gradeMax: 8 }))[0].range).toEqual({ min: 0, max: 8 })
    expect(gradeBoxes(section({ name: 'Open', rulesSet: true, gradeMin: 9, gradeMax: null }))[0].range).toEqual({ min: 9, max: 12 })
    // Rules set with no grades: the name no longer asks for one.
    expect(gradeBoxes(section({ name: 'K-5', rulesSet: true }))).toEqual([])
  })

  it('adds one optional box per grade prize the section\'s box does not cover, each range once, after the section\'s', () => {
    const s = section({
      name: 'K-8',
      prizes: {
        classes: [
          gradePrize('Top K-12', 0, 12), // covers K-8, so the section's box settles it
          gradePrize('Top K-3', 0, 3),
          gradePrize('Top K-3 girls', 0, 3), // the same range again
          gradePrize('Top 5th grade and below', null, 5),
          { label: 'Top U1000', ratingMax: 999, prizes: [{ amount: 20 }] }, // not a grade prize
        ],
      },
    })
    expect(gradeBoxes(s)).toEqual([
      { key: 'section', range: { min: 0, max: 8 }, required: true },
      { key: '0-3', range: { min: 0, max: 3 }, required: false, prizeLabel: 'Top K-3' },
      { key: '0-5', range: { min: 0, max: 5 }, required: false, prizeLabel: 'Top 5th grade and below' },
    ])
  })

  it('asks only the prize boxes in a section open to all', () => {
    const s = section({ prizes: { classes: [gradePrize('Top high school', 9, null)] } })
    expect(gradeBoxes(s)).toEqual([{ key: '9-12', range: { min: 9, max: 12 }, required: false, prizeLabel: 'Top high school' }])
    expect(asksGrade(s)).toBe(true)
  })
})

describe('the range the ticked boxes confirm, as sent with the entry', () => {
  const s = section({ name: 'K-8', prizes: { classes: [gradePrize('Top K-3', 0, 3), gradePrize('Top 6th grade and up', 6, null)] } })

  it('starts with nothing ticked, and sends nothing until a box is', () => {
    expect(NO_TICKS).toEqual({ section: false, prizes: [] })
    expect(confirmedRange(s, NO_TICKS)).toBeNull()
    expect(confirmedRange(undefined, ticks(true))).toBeNull()
  })

  it('sends the section\'s range for its box, and the overlap when a prize\'s box is ticked with it', () => {
    expect(confirmedRange(s, ticks(true))).toBe('0-8')
    expect(confirmedRange(s, ticks(true, ['0-3']))).toBe('0-3')
    expect(confirmedRange(s, ticks(true, ['6-12']))).toBe('6-8')
    // A prize's box alone confirms its own range.
    expect(confirmedRange(s, ticks(false, ['6-12']))).toBe('6-12')
  })

  it('says conflict when the ticked boxes cannot all be true', () => {
    expect(confirmedRange(s, ticks(true, ['0-3', '6-12']))).toBe('conflict')
    expect(confirmedRange(s, ticks(false, ['0-3', '6-12']))).toBe('conflict')
  })

  it('ignores a ticked prize the section no longer asks about, as after a change of section', () => {
    expect(confirmedRange(section({ name: 'K-5' }), ticks(true, ['6-12']))).toBe('0-5')
    expect(confirmedRange(section(), ticks(true, ['0-3']))).toBeNull()
  })
})

describe('the drawn boxes', () => {
  const s = section({ name: 'K-8', prizes: { classes: [gradePrize('Top K-3', 0, 3), gradePrize('Top 6th grade and up', 6, null)] } })

  it('draws nothing for a section that asks nothing', () => {
    const { container } = render(<GradeConfirm section={section()} ticks={NO_TICKS} onChange={() => {}} who={null} />)
    expect(container.innerHTML).toBe('')
  })

  /** The words of each box's label, as drawn. */
  const labels = () => screen.getAllByRole('checkbox').map((box) => box.closest('label')?.textContent)

  it('asks the signed-in member in the first person and a family member by name, in plain words', () => {
    render(<GradeConfirm section={s} ticks={NO_TICKS} onChange={() => {}} who={null} />)
    expect(labels()).toEqual([
      "I'm in 8th grade or below this school year (required for this section)",
      "I'm in 3rd grade or below this school year (optional, for the Top K-3 prize)",
      "I'm in 6th grade or above this school year (optional, for the Top 6th grade and up prize)",
    ])
    // Each box takes its words as its name, so a screen reader reads them with it.
    expect(screen.getByRole('checkbox', { name: /^I'm in 8th grade or below this school year/ })).toBeTruthy()
    cleanup()
    render(<GradeConfirm section={s} ticks={NO_TICKS} onChange={() => {}} who="Avery Example" />)
    expect(labels()[0]).toBe('Avery Example is in 8th grade or below this school year (required for this section)')
  })

  it('sends the ticks each box changes, and keeps the others', () => {
    const onChange = vi.fn()
    render(<GradeConfirm section={s} ticks={ticks(false, ['6-12'])} onChange={onChange} who={null} />)
    const [sectionBox, k3Box, upperBox] = screen.getAllByRole('checkbox') as HTMLInputElement[]
    expect([sectionBox.checked, k3Box.checked, upperBox.checked]).toEqual([false, false, true])
    fireEvent.click(sectionBox)
    expect(onChange).toHaveBeenLastCalledWith({ section: true, prizes: ['6-12'] })
    fireEvent.click(k3Box)
    expect(onChange).toHaveBeenLastCalledWith({ section: false, prizes: ['6-12', '0-3'] })
    fireEvent.click(upperBox)
    expect(onChange).toHaveBeenLastCalledWith({ section: false, prizes: [] })
  })

  it('says so in words when the ticked boxes cannot all be true, and not before', () => {
    const note = "Those can't all be true. Untick the ones that don't apply."
    render(<GradeConfirm section={s} ticks={ticks(true, ['0-3'])} onChange={() => {}} who={null} />)
    expect(screen.queryByText(note)).toBeNull()
    cleanup()
    render(<GradeConfirm section={s} ticks={ticks(true, ['0-3', '6-12'])} onChange={() => {}} who={null} />)
    expect(screen.getByText(note)).toBeTruthy()
  })

  it('draws each tick in the ink (accent-ink, the navy #1a2744 with newLook off), as accent-[#1a2744] did', () => {
    render(<GradeConfirm section={s} ticks={NO_TICKS} onChange={() => {}} who={null} compact />)
    for (const box of screen.getAllByRole('checkbox')) {
      expect(box.className.split(' ')).toContain('accent-ink')
      expect(box.className).not.toContain('#')
    }
  })
})

describe('where the grade confirmation is reached from', () => {
  it('the events area\'s index gives the same code as the module', () => {
    expect(events.gradeBoxes).toBe(gradeBoxes)
    expect(events.asksGrade).toBe(asksGrade)
    expect(events.confirmedRange).toBe(confirmedRange)
    expect(events.NO_TICKS).toBe(NO_TICKS)
  })

  it('the component file exports the component alone', () => {
    expect(Object.keys(componentFile)).toEqual(['GradeConfirm'])
  })

  it('lint finds no error in the files the move touched, and no react-refresh finding at all', async () => {
    const eslint = new ESLint({ cwd: ROOT })
    const results = await eslint.lintFiles([
      'src/areas/events/gradeConfirm.ts',
      'src/areas/events/components/GradeConfirm.tsx',
      'src/areas/events/index.ts',
      'src/pages/TournamentDetailPage.tsx',
      'src/areas/households/components/FamilyRegistrationPanel.tsx',
    ])
    const messages = results.flatMap((r) => r.messages.map((m) => ({ file: r.filePath.slice(ROOT.length + 1), rule: m.ruleId, severity: m.severity })))
    expect(messages.filter((m) => m.severity === 2)).toEqual([])
    expect(messages.filter((m) => m.rule === 'react-refresh/only-export-components')).toEqual([])
    // The one warning is the listed cross-area import of the component itself (a follow-up for WS06).
    expect(messages).toEqual([
      { file: 'src/areas/households/components/FamilyRegistrationPanel.tsx', rule: '@typescript-eslint/no-restricted-imports', severity: 1 },
    ])
  }, 60_000)
})
