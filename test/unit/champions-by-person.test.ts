// test/unit/champions-by-person.test.ts
//
// The honor roll lists each person once, at their first win, newest first,
// with every later win under their name and a tie marked on the win.
import { describe, expect, it } from 'vitest'

import type { ApiChampion } from '../../src/areas/events/api'
import { groupByPerson, personSlug, winnersOfYear, yearsWon } from '../../src/areas/events/champions'

const row = (year: number, champion: string, title = 'Louisiana State Champion', extra: Partial<ApiChampion> = {}): ApiChampion => ({
  id: `${year}-${title}-${champion}`, year, title, champion, notes: null, tournament_id: null, tournament_name: null,
  kind: 'state', photo_url: null, ...extra,
})

const rows: ApiChampion[] = [
  row(2016, 'Dex Webster'),
  row(2018, 'Dex Webster', 'Louisiana State Champion', { photo_url: '/champions/photos/dex-2018.jpg' }),
  row(2021, 'Dex Webster'),
  row(2019, 'Miles Tisserand'),
  row(2020, 'Nicholas Matta'),
  row(2025, 'Nicholas Matta', 'Louisiana State Champion', { notes: 'FIDE Master' }),
  row(2014, 'Shayan Khan', 'K-8 U800', { kind: 'scholastic' }),
  row(2014, 'John B Gregory', 'K-8 U800', { kind: 'scholastic' }),
  row(2013, 'Dex Webster', 'K-8', { kind: 'scholastic' }),
  row(2012, 'Dex Webster', 'K-6', { kind: 'scholastic' }),
]

describe('groupByPerson', () => {
  it('puts each person once, at their first win, newest first', () => {
    const entries = groupByPerson(rows, 'state')
    expect(entries.map((e) => [e.name, e.firstYear])).toEqual([
      ['Nicholas Matta', 2020],
      ['Miles Tisserand', 2019],
      ['Dex Webster', 2016],
    ])
  })

  it('lists every win under the name, newest first, and keeps the notes', () => {
    const matta = groupByPerson(rows, 'state')[0]
    expect(matta.wins.map((w) => w.year)).toEqual([2025, 2020])
    expect(matta.wins[0].notes).toBe('FIDE Master')
    expect(matta.lastYear).toBe(2025)
  })

  it('keeps the lists apart, so a scholastic champion who later won the state title is on both', () => {
    const scholastic = groupByPerson(rows, 'scholastic')
    expect(scholastic.map((e) => e.name)).toEqual(['John B Gregory', 'Shayan Khan', 'Dex Webster'])
    expect(scholastic.find((e) => e.name === 'Dex Webster')?.wins.map((w) => `${w.year} ${w.title}`)).toEqual(['2013 K-8', '2012 K-6'])
  })

  it('marks a tie on the win, without splitting the people', () => {
    const scholastic = groupByPerson(rows, 'scholastic')
    expect(scholastic.find((e) => e.name === 'Shayan Khan')?.wins[0].shared).toBe(true)
    expect(scholastic.find((e) => e.name === 'Dex Webster')?.wins[0].shared).toBe(false)
  })

  it('uses the photo on file for the person, whichever win carries it', () => {
    const dex = groupByPerson(rows, 'state').find((e) => e.name === 'Dex Webster')
    expect(dex?.photoUrl).toBe('/champions/photos/dex-2018.jpg')
  })

  it('gives every entry an anchor from the list and the name', () => {
    expect(groupByPerson(rows, 'state').map((e) => e.anchor)).toEqual(['state-nicholas-matta', 'state-miles-tisserand', 'state-dex-webster'])
    expect(personSlug("Rene' Phillips")).toBe('rene-phillips')
    expect(personSlug('A.L. McAuley')).toBe('a-l-mcauley')
  })
})

describe('the year lookup', () => {
  it('lists the years won, newest first, per list', () => {
    expect(yearsWon(rows, 'state')).toEqual([2025, 2021, 2020, 2019, 2018, 2016])
    expect(yearsWon(rows, 'scholastic')).toEqual([2014, 2013, 2012])
  })

  it('answers a year with every winner and where their entry is', () => {
    expect(winnersOfYear(rows, 'scholastic', 2014)).toEqual([
      { title: 'K-8 U800', name: 'John B Gregory', anchor: 'scholastic-john-b-gregory', notes: null },
      { title: 'K-8 U800', name: 'Shayan Khan', anchor: 'scholastic-shayan-khan', notes: null },
    ])
    expect(winnersOfYear(rows, 'state', 1999)).toEqual([])
  })
})
