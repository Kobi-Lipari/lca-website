// test/unit/club-sections.test.ts
// Which sections a club page names (domain/clubs/sections.ts, WS09 step 20):
// the bare club, with only the five basics, has About, When and where and
// Contact and nothing else; a full club has every section the tree can fill,
// in the nav's order; and each other block, filled in turn, brings its own
// section and no other. Photos has no table yet, so it is named only for a
// count the answer never sends today.
import { describe, expect, it } from 'vitest'
import { CLUB_PAGE_SECTIONS, clubPageSections, filled, type ClubPageContent } from '../../domain/clubs/sections'

/** A club with nothing at all: no words, no ticks, no place, no event, no news. */
const EMPTY: ClubPageContent = {
  aboutText: null, costText: null, welcomeText: null, links: [null, null, null], weekendPlay: false, scholasticFriendly: false,
  statement: null, places: 0, events: 0, news: 0, photos: 0,
}

/**
 * The five basics: one sentence about the club, how it meets, a place, a
 * contact name and a contact email that stays private. The last two are not
 * read by the rule, since Contact is always named.
 */
const BARE: ClubPageContent = { ...EMPTY, aboutText: 'A friendly made up club for players of every level.', statement: 'Tuesdays at 7:00 PM in the library', places: 1 }

describe('clubPageSections', () => {
  it('gives the bare club About, When and where and Contact alone', () => {
    expect(clubPageSections(BARE)).toEqual(['about', 'when_and_where', 'contact'])
  })

  it('gives a club with nothing at all Contact alone, since the Contact form always reaches someone', () => {
    expect(clubPageSections(EMPTY)).toEqual(['contact'])
  })

  it('gives a full club every section the tree can fill, in the nav\'s order', () => {
    const full: ClubPageContent = {
      ...BARE, costText: '$5 a night', welcomeText: 'Everyone, from beginners up', links: ['https://example.org/club', null, null],
      weekendPlay: true, scholasticFriendly: true, places: 2, events: 3, news: 2,
    }
    expect(clubPageSections(full)).toEqual(['about', 'when_and_where', 'events', 'news', 'contact'])
    expect(clubPageSections({ ...full, photos: 1 })).toEqual([...CLUB_PAGE_SECTIONS])
  })

  it('names About for each of its parts filled in turn: the club\'s words, the cost, who is welcome, a link and each tick', () => {
    for (const change of [
      { aboutText: 'A made up club.' }, { costText: 'Free' }, { welcomeText: 'All ages' }, { links: [null, 'https://example.org', null] },
      { links: [null, null, 'https://example.org/other'] }, { weekendPlay: true }, { scholasticFriendly: true },
    ] satisfies Array<Partial<ClubPageContent>>) {
      expect(clubPageSections({ ...EMPTY, ...change }), JSON.stringify(change)).toEqual(['about', 'contact'])
    }
  })

  it('names When and where for a statement alone and for a place alone', () => {
    expect(clubPageSections({ ...EMPTY, statement: 'Saturdays at 10:00 AM' })).toEqual(['when_and_where', 'contact'])
    expect(clubPageSections({ ...EMPTY, places: 1 })).toEqual(['when_and_where', 'contact'])
  })

  it('names Events, News and Photos each for its own content alone', () => {
    expect(clubPageSections({ ...EMPTY, events: 1 })).toEqual(['events', 'contact'])
    expect(clubPageSections({ ...EMPTY, news: 1 })).toEqual(['news', 'contact'])
    expect(clubPageSections({ ...EMPTY, photos: 1 })).toEqual(['photos', 'contact'])
  })

  it('takes text of spaces alone as empty, so a block is never named for a blank', () => {
    expect(clubPageSections({ ...EMPTY, aboutText: '   ', costText: '\n', statement: ' ', links: [' ', '', null] })).toEqual(['contact'])
    expect([filled('x'), filled(' '), filled(''), filled(null), filled(undefined)]).toEqual([true, false, false, false, false])
  })
})
