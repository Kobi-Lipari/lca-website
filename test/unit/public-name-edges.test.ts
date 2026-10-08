import { describe, expect, it } from 'vitest'
import { firstNameLastInitial, publicName } from '../../domain/households/publicName'

const shown = (fullName: string, flags: { hasActiveGuardianLink?: boolean; entryMarkedMinor?: boolean } = { hasActiveGuardianLink: true }) =>
  publicName({ fullName, hasActiveGuardianLink: false, entryMarkedMinor: false, ...flags }, 'entrants')

describe('publicName triggers', () => {
  it('a household dependent with no active guardian link and no under-18 mark is shown in full', () => {
    // Being in a household is not the trigger; the guardian link ending is.
    expect(shown('Leo Robichaux', {})).toBe('Leo Robichaux')
  })

  it('a handed-over player (link ended) is shortened only if the entry is marked', () => {
    expect(shown('Leo Robichaux', { hasActiveGuardianLink: false, entryMarkedMinor: false })).toBe('Leo Robichaux')
    expect(shown('Leo Robichaux', { hasActiveGuardianLink: false, entryMarkedMinor: true })).toBe('Leo R.')
  })

  it('does not change the input', () => {
    const input = { fullName: 'Leo Robichaux', hasActiveGuardianLink: true, entryMarkedMinor: true }
    const copy = { ...input }
    publicName(input, 'entrants')
    publicName(input, 'results')
    expect(input).toEqual(copy)
  })

  it('results keep every character of the full name, apart from tidying spaces', () => {
    for (const name of ["Zoë Écuyer", "Sean O'Neal", 'Maya Fontenot-Guidry', 'Ana de la Cruz', 'Leo']) {
      expect(publicName({ fullName: name, hasActiveGuardianLink: true, entryMarkedMinor: true }, 'results')).toBe(name)
    }
  })

  it('entrants shows full names for adults with the same shapes', () => {
    for (const name of ["Zoë Écuyer", 'Maya Fontenot-Guidry', 'Ana de la Cruz']) expect(shown(name, {})).toBe(name)
  })
})

describe('first name and last initial, further shapes', () => {
  it('handles empty and whitespace-only names without throwing', () => {
    expect(firstNameLastInitial('')).toBe('')
    expect(firstNameLastInitial('   ')).toBe('')
    expect(shown('   ')).toBe('')
  })

  it('collapses tabs and repeated spaces', () => {
    expect(firstNameLastInitial('Leo\t  Robichaux')).toBe('Leo R.')
  })

  it('never ends with a bare initial and a missing letter', () => {
    expect(firstNameLastInitial('Leo 3')).toBe('Leo')
    expect(firstNameLastInitial('Leo -')).toBe('Leo')
  })

  it('a name that is only a suffix keeps the first word', () => {
    expect(firstNameLastInitial('Leo Jr.')).toBe('Leo')
    expect(firstNameLastInitial('Leo Robichaux Jr., III')).toBe('Leo R.')
  })

  it('keeps hyphenated first names and uses the hyphenated surname start', () => {
    expect(firstNameLastInitial('Mary-Kate Olsen-Boudreaux')).toBe('Mary-Kate O.')
  })

  it('keeps a particle with a hyphenated or accented surname', () => {
    expect(firstNameLastInitial('Ana de la Cruz-Perez')).toBe('Ana D.')
    expect(firstNameLastInitial('Eli van der Écuyer')).toBe('Eli V.')
  })

  it('a two-word name where the second word is a particle still gives an initial', () => {
    expect(firstNameLastInitial('Remy Le')).toBe('Remy L.')
  })

  it('upper-cases the initial and ends it with a full stop', () => {
    expect(firstNameLastInitial('ana cruz')).toBe('ana C.')
    expect(firstNameLastInitial('Ana Cruz')).toMatch(/\.$/)
  })

  it('"Last, First Middle" reads first name first', () => {
    expect(firstNameLastInitial('Robichaux, Leo James')).toBe('Leo R.')
  })

  it('a comma with nothing before it does not break', () => {
    expect(firstNameLastInitial(', Leo')).toBe('Leo')
  })
})
