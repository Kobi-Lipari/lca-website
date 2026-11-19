// test/unit/champions-by-person.test.ts
//
// The honor roll lists each person once, ordered by their latest win so the
// reigning champion is first, with every title under their name and a tie
// marked on the win. A note that is a chess title and nothing else, such as
// "FIDE Master", is the person's chess title on that list, taken from their
// newest win that records one; the win keeps its note as it was written.
import { describe, expect, it } from 'vitest'

import type { ApiChampion } from '../../src/areas/events/api'
import { CHESS_TITLES, CHESS_TITLE_SHORT, chessTitleOf, groupByPerson, personSlug, winnersOfYear, yearsWon } from '../../src/areas/events/champions'

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
  it('puts each person once, ordered by their latest win, the reigning champion first', () => {
    const entries = groupByPerson(rows, 'state')
    expect(entries.map((e) => [e.name, e.lastYear, e.firstYear])).toEqual([
      ['Nicholas Matta', 2025, 2020],
      ['Dex Webster', 2021, 2016],
      ['Miles Tisserand', 2019, 2019],
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
    // Both 2014 co-champions sit above the 2013 winner: latest win first, then name.
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
    expect(groupByPerson(rows, 'state').map((e) => e.anchor)).toEqual(['state-nicholas-matta', 'state-dex-webster', 'state-miles-tisserand'])
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

describe('a chess title in a note', () => {
  it('reads each of the nine titles from a note that is the title and nothing else, in any letter case and with any spacing', () => {
    expect(CHESS_TITLES).toHaveLength(9)
    for (const title of CHESS_TITLES) {
      expect(chessTitleOf(title), title).toBe(title)
      expect(chessTitleOf(title.toUpperCase()), title).toBe(title)
      expect(chessTitleOf(`  ${title.toLowerCase().replace(/ /g, '   ')}\t`), title).toBe(title)
    }
  })

  it('gives each title the short form written before the name', () => {
    expect(CHESS_TITLES.map((t) => [t, CHESS_TITLE_SHORT[t]])).toEqual([
      ['Grandmaster', 'GM'],
      ['International Master', 'IM'],
      ['FIDE Master', 'FM'],
      ['Candidate Master', 'CM'],
      ['National Master', 'NM'],
      ['Woman Grandmaster', 'WGM'],
      ['Woman International Master', 'WIM'],
      ['Woman FIDE Master', 'WFM'],
      ['Woman Candidate Master', 'WCM'],
    ])
  })

  it('reads no title from any other note: a short form alone, a title with more words, a tiebreak, a section, an empty note or none', () => {
    for (const note of ['FM', 'FIDE Master, co-champion', 'tiebreaks over Player Six', 'Player Seven won section', 'Won with 2½ of 3.', 'Master', '', '   ', null]) {
      expect(chessTitleOf(note), String(note)).toBeNull()
    }
  })
})

describe('the person\'s chess title', () => {
  it('is the title a note records, while the win keeps the note as written, and none when no note is a title', () => {
    const [matta, dex, miles] = groupByPerson(rows, 'state')
    expect(matta.chessTitle).toBe('FIDE Master')
    expect(matta.wins[0].notes).toBe('FIDE Master')
    expect(dex.chessTitle).toBeNull()
    expect(miles.chessTitle).toBeNull()
  })

  it('comes from the newest win that records one, past a newer note that is not a title', () => {
    const [entry] = groupByPerson([
      row(2010, 'Player Four', 'Louisiana State Champion', { notes: 'International Master' }),
      row(2020, 'Player Four'),
      row(2015, 'Player Four', 'Louisiana State Champion', { notes: 'grandmaster' }),
      row(2018, 'Player Four', 'Louisiana State Champion', { notes: 'tiebreaks over Player Five' }),
    ], 'state')
    expect(entry.wins.map((w) => w.year)).toEqual([2020, 2018, 2015, 2010])
    expect(entry.chessTitle).toBe('Grandmaster')
  })

  it('belongs to its own list: a title on the state list is not written on the same person\'s scholastic entry', () => {
    const both = [
      row(2024, 'Player Four', 'Louisiana State Champion', { notes: 'National Master' }),
      row(2012, 'Player Four', 'K-12', { kind: 'scholastic' }),
    ]
    expect(groupByPerson(both, 'state')[0].chessTitle).toBe('National Master')
    expect(groupByPerson(both, 'scholastic')[0].chessTitle).toBeNull()
  })
})
