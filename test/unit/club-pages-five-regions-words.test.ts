// The words and the contract of the public club page, read with the five
// regions main took in (domain/clubs/regions.ts). Where checkpoint W's page
// words meet the new list: the line under the club's name for each of the
// five regions, the contract's answer for a club of each, and the club
// page's read in the one registry both sides add to. Every club and place
// here is made up.
import { describe, expect, it } from 'vitest'
import { REGIONS, isRegion } from '../../domain/clubs/regions'
import { cityLine } from '../../domain/clubs/pageWords'
import { contracts } from '../../domain/contracts/registry'
import { clubPageResponseSchema } from '../../domain/contracts/clubPage'

describe('cityLine with the five regions', () => {
  it.each([...REGIONS])('writes the town, Louisiana and %s once each, with the dot between', (region) => {
    const line = cityLine('Example Town', region)
    expect(line).toBe(`Chess club in Example Town, Louisiana · ${region}`)
    expect(line.split(region)).toHaveLength(2)
    expect(line.split('Louisiana')).toHaveLength(region.includes('Louisiana') ? 3 : 2)
  })

  it('keeps the slash and the spaces of a region as written, and trims stray space around it', () => {
    expect(cityLine('Example Town', '  Baton Rouge / East Central ')).toBe('Chess club in Example Town, Louisiana · Baton Rouge / East Central')
  })

  it('ends at Louisiana with no region, and never says null or undefined', () => {
    for (const none of [null, undefined, '', '   ']) {
      expect(cityLine('Example Town', none)).toBe('Chess club in Example Town, Louisiana')
      expect(cityLine(null, none)).toBe('Chess club in Louisiana')
    }
    for (const region of REGIONS) expect(cityLine(null, region)).toBe(`Chess club in Louisiana · ${region}`)
  })

  it('for a club in a seat\'s own town the town is said twice, as the words are built today', () => {
    expect(cityLine('Lake Charles', 'Lake Charles / Southwestern')).toBe('Chess club in Lake Charles, Louisiana · Lake Charles / Southwestern')
  })
})

describe('the club page contract with the five regions', () => {
  const answer = (region: string | null) => ({
    club: { id: 'example-chess-club', slug: 'example-chess-club', name: 'Example Chess Club', city: 'Example Town', region, color: '#0a1f44', logo: null },
    sections: ['about'],
    about: { text: 'A made up club.', cost: null, welcome: null, facebook: null, website: null, other: null, weekend_play: false, scholastic_friendly: false },
    statement: { text: 'Tuesdays at 7:00 PM', told: '' },
    places: [],
    contact: { name: null },
    events: [],
    news: [],
    nearest: [],
  })

  it.each([...REGIONS, null])('parses a club of %s', (region) => {
    const parsed = clubPageResponseSchema.safeParse(answer(region))
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true)
  })

  it('holds every region a club can be filed under to a plain string, and the list to the five', () => {
    expect(REGIONS).toHaveLength(5)
    expect(new Set(REGIONS).size).toBe(5)
    for (const region of REGIONS) expect(isRegion(region)).toBe(true)
  })
})

describe('the contract registry both sides add to', () => {
  it('has the club page\'s read, with the one method it lists', () => {
    const club = contracts['clubs/[id]/page'] as Record<string, unknown>
    expect(Object.keys(club)).toEqual(['GET'])
  })
})
