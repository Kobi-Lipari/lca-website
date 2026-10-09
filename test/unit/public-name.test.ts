import { describe, expect, it } from 'vitest'
import { firstNameLastInitial, publicName } from '../../domain/households/publicName'

const leo = { fullName: 'Leo Robichaux', hasActiveGuardianLink: false, entryMarkedMinor: false }

describe('publicName on the entrants list', () => {
  it('shortens a player with an active guardian link', () => {
    expect(publicName({ ...leo, hasActiveGuardianLink: true }, 'entrants')).toBe('Leo R.')
  })

  it('shortens a player whose entry is marked under 18', () => {
    expect(publicName({ ...leo, entryMarkedMinor: true }, 'entrants')).toBe('Leo R.')
  })

  it('shortens a player with both', () => {
    expect(publicName({ ...leo, hasActiveGuardianLink: true, entryMarkedMinor: true }, 'entrants')).toBe('Leo R.')
  })

  it('shows everyone else in full', () => {
    expect(publicName(leo, 'entrants')).toBe('Leo Robichaux')
  })
})

describe('publicName in results', () => {
  it('always shows the full name, whatever marks the player as a minor', () => {
    for (const hasActiveGuardianLink of [false, true]) {
      for (const entryMarkedMinor of [false, true]) {
        expect(publicName({ ...leo, hasActiveGuardianLink, entryMarkedMinor }, 'results')).toBe('Leo Robichaux')
      }
    }
  })

  it('tidies stray spaces but keeps every word', () => {
    expect(publicName({ ...leo, fullName: '  Ana  de la Cruz ', entryMarkedMinor: true }, 'results')).toBe('Ana de la Cruz')
  })
})

describe('first name and last initial', () => {
  const minor = (fullName: string) => publicName({ fullName, hasActiveGuardianLink: true, entryMarkedMinor: false }, 'entrants')

  it('leaves a single name as it is', () => {
    expect(minor('Leo')).toBe('Leo')
    expect(minor('  Leo  ')).toBe('Leo')
    expect(minor('')).toBe('')
  })

  it('uses the first letter of a hyphenated surname', () => {
    expect(minor('Maya Fontenot-Guidry')).toBe('Maya F.')
    expect(minor('Jean-Luc Robichaux')).toBe('Jean-Luc R.')
  })

  it('keeps a two-word surname together', () => {
    expect(minor('Ana de la Cruz')).toBe('Ana D.')
    expect(minor('Remy Le Blanc')).toBe('Remy L.')
    expect(minor('Pieter Van Dyke')).toBe('Pieter V.')
    expect(minor('Claire St. Romain')).toBe('Claire S.')
  })

  it('uses the last name, not a middle name or middle initial', () => {
    expect(minor('Leo James Robichaux')).toBe('Leo R.')
    expect(minor('Leo J. Robichaux')).toBe('Leo R.')
  })

  it('ignores Jr., Sr. and numerals', () => {
    expect(minor('Leo Robichaux Jr.')).toBe('Leo R.')
    expect(minor('Leo Robichaux III')).toBe('Leo R.')
    expect(minor('Leo Robichaux, Jr.')).toBe('Leo R.')
  })

  it('reads a "Last, First" name the way US Chess writes it', () => {
    expect(minor('Robichaux, Leo')).toBe('Leo R.')
  })

  it('handles apostrophes, accents and lower case', () => {
    expect(minor("Sean O'Neal")).toBe('Sean O.')
    expect(minor('Zoë Écuyer')).toBe('Zoë É.')
    expect(minor('leo robichaux')).toBe('leo R.')
  })

  it('is the same helper publicName uses', () => {
    expect(firstNameLastInitial('Leo Robichaux')).toBe('Leo R.')
  })
})
