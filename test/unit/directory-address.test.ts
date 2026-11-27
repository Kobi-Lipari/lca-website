// test/unit/directory-address.test.ts
//
// The Clubs page's choices in its address (WS09 step 32,
// domain/clubs/directoryAddress.ts): near is a ZIP code of five digits and
// nothing else; sort, region (by its short key), weekends and scholastic.
// Reading is forgiving, dropping a part it cannot read; writing is
// canonical, the same choices always giving the same address, with the
// defaults left out.
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ADDRESS, readDirectoryAddress, regionByKey, regionKey, writeDirectoryAddress, type DirectoryAddress,
} from '../../domain/clubs/directoryAddress'
import { REGIONS } from '../../domain/clubs/regions'
import { slugFor } from '../../domain/clubs/slug'

const BATON_ROUGE = REGIONS.find((r) => r.startsWith('Baton Rouge'))!

describe('the region\'s key', () => {
  it('is the first name of each of REGIONS as the slug rule writes it, one key a region, and read back to its region', () => {
    const keys = REGIONS.map(regionKey)
    expect(new Set(keys).size).toBe(REGIONS.length)
    for (const region of REGIONS) {
      expect(regionKey(region)).toBe(slugFor(region.split('/')[0]))
      expect(regionKey(region)).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      expect(regionByKey(regionKey(region))).toBe(region)
    }
    expect(regionKey(BATON_ROUGE)).toBe('baton-rouge')
    expect(regionByKey(BATON_ROUGE)).toBeNull()
    expect(regionByKey('example-region')).toBeNull()
  })
})

describe('reading the address', () => {
  it('reads nothing as the defaults: no place, A to Z, no filter', () => {
    expect(readDirectoryAddress('')).toEqual(DEFAULT_ADDRESS)
    expect(readDirectoryAddress('?')).toEqual(DEFAULT_ADDRESS)
    expect(DEFAULT_ADDRESS).toEqual({ near: null, sort: 'az', region: null, weekends: false, scholastic: false })
  })

  it('reads a ZIP code as the place, nearest first unless A to Z is asked for', () => {
    expect(readDirectoryAddress('?near=70808')).toEqual({ ...DEFAULT_ADDRESS, near: '70808', sort: 'nearest' })
    expect(readDirectoryAddress('near=70808&sort=az')).toEqual({ ...DEFAULT_ADDRESS, near: '70808', sort: 'az' })
    expect(readDirectoryAddress('?sort=nearest')).toEqual(DEFAULT_ADDRESS)
  })

  it('drops a near that is not five digits alone: a point, a town, free text, a ZIP code with four more', () => {
    for (const near of ['30.45,-91.15', 'Baton%20Rouge', 'Example%20Town', '70808-1234', '7080', '708080', '']) {
      expect(readDirectoryAddress(`?near=${near}`).near, near).toBeNull()
    }
  })

  it('reads the region by its key alone, the ticks by "1", and drops what it does not know', () => {
    expect(readDirectoryAddress('?region=baton-rouge&weekends=1&scholastic=1')).toEqual({ ...DEFAULT_ADDRESS, region: BATON_ROUGE, weekends: true, scholastic: true })
    expect(readDirectoryAddress(`?region=${encodeURIComponent(BATON_ROUGE)}`).region).toBeNull()
    expect(readDirectoryAddress('?region=example-region&weekends=0&scholastic=maybe&city=Example%20City&q=kni')).toEqual(DEFAULT_ADDRESS)
    expect(readDirectoryAddress('?weekends=true&scholastic=YES')).toMatchObject({ weekends: true, scholastic: true })
    expect(readDirectoryAddress('?near=70808&near=70112').near).toBe('70808')
  })
})

describe('writing the address', () => {
  it('writes the defaults as nothing, and each choice in its one order with the defaults left out', () => {
    expect(writeDirectoryAddress(DEFAULT_ADDRESS)).toBe('')
    expect(writeDirectoryAddress({ ...DEFAULT_ADDRESS, near: '70808', sort: 'nearest' })).toBe('?near=70808')
    expect(writeDirectoryAddress({ ...DEFAULT_ADDRESS, near: '70808', sort: 'az' })).toBe('?near=70808&sort=az')
    expect(writeDirectoryAddress({ ...DEFAULT_ADDRESS, sort: 'nearest' })).toBe('')
    expect(writeDirectoryAddress({ near: '70808', sort: 'az', region: BATON_ROUGE, weekends: true, scholastic: true })).toBe('?near=70808&sort=az&region=baton-rouge&weekends=1&scholastic=1')
    expect(writeDirectoryAddress({ ...DEFAULT_ADDRESS, near: 'Baton Rouge' })).toBe('')
  })

  it('reads back what it writes, and writes the same address for every way of asking the same thing', () => {
    const choices: DirectoryAddress[] = [
      DEFAULT_ADDRESS,
      { ...DEFAULT_ADDRESS, near: '70112', sort: 'nearest' },
      { near: '71101', sort: 'az', region: REGIONS[REGIONS.length - 1], weekends: false, scholastic: true },
      ...REGIONS.map((region) => ({ ...DEFAULT_ADDRESS, region, weekends: true })),
    ]
    for (const choice of choices) expect(readDirectoryAddress(writeDirectoryAddress(choice))).toEqual(choice)
    const asked = ['?scholastic=1&near=70808&weekends=true', '?weekends=yes&near=70808&scholastic=on&sort=nearest&zip=70808', 'near=70808&weekends=1&scholastic=1']
    const written = asked.map((search) => writeDirectoryAddress(readDirectoryAddress(search)))
    expect(new Set(written)).toEqual(new Set(['?near=70808&weekends=1&scholastic=1']))
  })
})
