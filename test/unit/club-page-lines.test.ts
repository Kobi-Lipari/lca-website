// test/unit/club-page-lines.test.ts
// The words of a club page's two lines about who keeps it and whose words it
// shows (functions/utils/clubs/authorLine.ts, WS09 step 20): the three
// author lines as the brief words them, with a child never named and a club
// with no region; the name each line prints, the first name and last initial
// alone, at its edges; and the told line's two forms with its month read in
// Central time at a month's edge and on either side of a clock change.
import { describe, expect, it } from 'vitest'
import { authorWords, nameForLine, toldWords } from '../../functions/utils/clubs/authorLine'

describe('authorWords', () => {
  it('words the three lines as the brief does', () => {
    expect(authorWords('club_rep', 'Player O.', 'Bayou Region')).toBe('Kept by the club\'s rep, Player O.')
    expect(authorWords('region', 'Player T.', 'Bayou Region')).toBe('This club hasn\'t named a rep yet · Kept by Player T., the Bayou Region representative')
    expect(authorWords('admins', null, 'North Louisiana')).toBe('Kept by LCA admins until the North Louisiana seat is filled')
  })

  it('reads without a name where no name may be printed', () => {
    expect(authorWords('club_rep', null, 'Bayou Region')).toBe('Kept by the club\'s rep')
    expect(authorWords('region', null, 'Bayou Region')).toBe('This club hasn\'t named a rep yet · Kept by the Bayou Region representative')
  })

  it('reads "Kept by LCA admins" for a club with no region, which no seat can cover', () => {
    expect(authorWords('admins', null, null)).toBe('Kept by LCA admins')
    expect(authorWords('admins', null, '  ')).toBe('Kept by LCA admins')
    expect(authorWords('region', 'Player T.', null)).toBe('Kept by LCA admins')
  })
})

describe('nameForLine', () => {
  it('prints the first name and last initial alone', () => {
    expect(nameForLine('Player One', false)).toBe('Player O.')
    expect(nameForLine('Player Middle One', false)).toBe('Player O.')
  })

  it('prints a single name as it is, which is the whole of it', () => {
    expect(nameForLine('Prince', false)).toBe('Prince')
  })

  it('takes out extra spaces and a suffix', () => {
    expect(nameForLine('  Player    One  ', false)).toBe('Player O.')
    expect(nameForLine('Player One Jr.', false)).toBe('Player O.')
    expect(nameForLine('One, Player', false)).toBe('Player O.')
    expect(nameForLine('Player One III', false)).toBe('Player O.')
  })

  it('prints a name in another script with its own last initial', () => {
    expect(nameForLine('Иван Примеров', false)).toBe('Иван П.')
    expect(nameForLine('Νίκος Παράδειγμα', false)).toBe('Νίκος Π.')
    expect(nameForLine('例 太郎', false)).toBe('例 太.')
  })

  it('prints nothing for a child, whatever the name, and nothing for a blank name', () => {
    expect(nameForLine('Player One', true)).toBeNull()
    expect(nameForLine('Prince', true)).toBeNull()
    expect(nameForLine('', false)).toBeNull()
    expect(nameForLine('   ', false)).toBeNull()
    expect(nameForLine(null, false)).toBeNull()
  })

  it('never prints a full last name, an email, or the part of the email a name was made from at sign-in', () => {
    const name = nameForLine('Player Example', false) ?? ''
    expect(name).not.toContain('Example')
    expect(nameForLine('player.one@example.org', false)).toBeNull()
    expect(nameForLine('player.one', false, 'Player.One@example.org')).toBeNull()
    expect(nameForLine('player.one', false, 'someone.else@example.org')).toBe('player.one')
    expect(nameForLine('Player One', false, 'player.one@example.org')).toBe('Player O.')
  })
})

describe('toldWords', () => {
  it('gives the club\'s own form and LCA\'s, each with the month in words and its year', () => {
    expect(toldWords(true, '2026-11-16 18:00:00')).toBe('As told by the club, updated November 2026')
    expect(toldWords(false, '2026-11-16 18:00:00')).toBe('As told to LCA, November 2026')
  })

  it('gives each form with no month while no save has stamped one', () => {
    expect(toldWords(true, null)).toBe('As told by the club')
    expect(toldWords(false, null)).toBe('As told to LCA')
    expect(toldWords(false, undefined)).toBe('As told to LCA')
  })

  it('reads the month in Central time at a month\'s edge: a save at 11:59 PM on Mon, Nov 30 in Louisiana is November\'s', () => {
    expect(toldWords(false, '2026-12-01 05:59:59')).toBe('As told to LCA, November 2026')
    expect(toldWords(false, '2026-12-01 06:00:00')).toBe('As told to LCA, December 2026')
  })

  it('reads the month by the offset in force on either side of a clock change: daylight time ends on Sun, Nov 1, 2026', () => {
    // Sat, Oct 31 at 11:59 PM in daylight time is 4:59 AM on Sun, Nov 1 in UTC.
    expect(toldWords(true, '2026-11-01 04:59:59')).toBe('As told by the club, updated October 2026')
    expect(toldWords(true, '2026-11-01 05:00:00')).toBe('As told by the club, updated November 2026')
    // Tue, Mar 31 at 11:59 PM, after daylight time began on Sun, Mar 8, 2026.
    expect(toldWords(false, '2026-04-01 04:59:59')).toBe('As told to LCA, March 2026')
    expect(toldWords(false, '2026-04-01 05:00:00')).toBe('As told to LCA, April 2026')
  })
})
