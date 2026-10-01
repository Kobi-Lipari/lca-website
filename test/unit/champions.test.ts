import { describe, expect, it } from 'vitest'
import { parsePasted } from '../../src/lib/champions'

describe('pasting champions', () => {
  it('reads comma and tab separated lines, with an optional note', () => {
    const { rows, bad } = parsePasted('2019, Louisiana State Champion, Jane Doe\n\n2018\tState Scholastic K-12\tJohn Roe\tco-champion')
    expect(bad).toEqual([])
    expect(rows).toEqual([
      { year: 2019, title: 'Louisiana State Champion', champion: 'Jane Doe', notes: null },
      { year: 2018, title: 'State Scholastic K-12', champion: 'John Roe', notes: 'co-champion' },
    ])
  })

  it('points at the lines it could not read', () => {
    expect(parsePasted('nineteen, x, y\n2020, Title\n2021, Title, Name').bad).toEqual([1, 2])
  })
})
