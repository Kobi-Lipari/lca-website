// The plain code of the new club page (WS09 step 21), one rule at a time:
// which sections the page draws, the line the site writes under the club's
// name, the club's initials, when words are one sentence, which links may be
// drawn, the address the page goes by, who counts as a keeper, and which of
// a club's places become pins. Every name, address and club here is made up.
import { describe, expect, it } from 'vitest'
import { placePoints, directionsUrl } from '@/areas/clubs/clubMap'
import {
  DRAWN_SECTIONS, SECTION_IDS, SECTION_LABELS, cityLine, clubInitials, drawnSections, hasWords, keeperFor, keeperWords,
  oneSentence, pageAddress, paragraphs, siteOf, webLink, type KeeperAuth,
} from '@/areas/clubs/clubPage'

const CLUB = { id: 'c-example', slug: 'example-chess-club', region: 'Bayou Region' }

describe('the sections the page draws at this step', () => {
  it('are About, When and where, Events, News and Contact, in the nav\'s order, Events and News only with a row, whatever else the answer names', () => {
    expect([...DRAWN_SECTIONS]).toEqual(['about', 'when_and_where', 'events', 'news', 'contact'])
    expect(drawnSections(['about', 'when_and_where', 'events', 'news', 'photos', 'contact'])).toEqual(['about', 'when_and_where', 'contact'])
    expect(drawnSections(['about', 'when_and_where', 'events', 'news', 'photos', 'contact'], { events: 1, news: 2 })).toEqual(['about', 'when_and_where', 'events', 'news', 'contact'])
    // The answer's order is the answer's; the page keeps its own.
    expect(drawnSections(['contact', 'when_and_where', 'about'])).toEqual(['about', 'when_and_where', 'contact'])
  })

  it('leave out what the answer does not name, and name nothing for an answer with none of them', () => {
    expect(drawnSections(['about'])).toEqual(['about'])
    expect(drawnSections(['when_and_where', 'contact'])).toEqual(['when_and_where', 'contact'])
    expect(drawnSections(['events', 'news', 'photos', 'contact'])).toEqual(['contact'])
    expect(drawnSections([])).toEqual([])
  })

  it('each have a name for the nav and an id for the address, and the ids are address-safe', () => {
    for (const section of DRAWN_SECTIONS) {
      expect(SECTION_LABELS[section].length).toBeGreaterThan(0)
      expect(SECTION_IDS[section]).toMatch(/^[a-z][a-z-]*$/)
    }
    expect(SECTION_LABELS).toEqual({ about: 'About', when_and_where: 'When and where', events: 'Events', news: 'News', contact: 'Contact' })
    expect(SECTION_IDS).toEqual({ about: 'about', when_and_where: 'when-and-where', events: 'events', news: 'news', contact: 'contact' })
  })
})

describe('the line under the club\'s name', () => {
  it('reads "Chess club in {city}, Louisiana · {region}"', () => {
    expect(cityLine('Example City', 'Bayou Region')).toBe('Chess club in Example City, Louisiana · Bayou Region')
  })

  it('ends at Louisiana with no region, with no "null" and no dangling dot', () => {
    for (const region of [null, undefined, '', '   ']) {
      const line = cityLine('Example City', region)
      expect(line).toBe('Chess club in Example City, Louisiana')
      expect(line).not.toMatch(/null|undefined|·\s*$/)
    }
  })

  it('reads "Chess club in Louisiana" with no city, with the region after it when there is one', () => {
    for (const city of [null, undefined, '', '  ']) {
      expect(cityLine(city, null)).toBe('Chess club in Louisiana')
      expect(cityLine(city, 'Bayou Region')).toBe('Chess club in Louisiana · Bayou Region')
    }
  })

  it('takes the spaces off each end of the city and the region', () => {
    expect(cityLine('  Example City ', ' Bayou Region  ')).toBe('Chess club in Example City, Louisiana · Bayou Region')
  })
})

describe('the club\'s initials', () => {
  it.each([
    ['Example Chess Club', 'EC'],
    ['example chess club', 'EC'],
    ['Example', 'EX'],
    ['E', 'E'],
    ['Example-City Knights', 'EC'],
    ['  Example   Rooks ', 'ER'],
    ['The Example Club', 'TE'],
    ['42 Example Club', '4E'],
    ['École Example', 'ÉE'],
  ])('%s gives %s', (name, initials) => {
    expect(clubInitials(name)).toBe(initials)
  })

  it('gives a question mark for a name with no letters or numbers, never an empty tile', () => {
    expect(clubInitials('')).toBe('?')
    expect(clubInitials('   ')).toBe('?')
    expect(clubInitials('...')).toBe('?')
  })

  it('keeps a character outside the basic range whole', () => {
    expect([...clubInitials('\u{1D40E}ne Rooks')]).toHaveLength(2)
  })
})

describe('words that are one sentence', () => {
  it.each([
    'A friendly made-up club for casual games',
    'A friendly made-up club for casual games.',
    'Does the club play on Tuesdays?',
    'Come and play!',
    'We play at 7:00 PM every Tuesday.',
    '  Padded with spaces.  ',
    'Version 2.5 of the plan, said "hello."',
  ])('sets %j large', (text) => {
    expect(oneSentence(text)).toBe(true)
  })

  it.each([
    'We meet on Tuesdays. Everyone is welcome.',
    'Do you play? Come and see.',
    'Come and play! Bring a board.',
    'Said "hello." Then left.',
    'Two lines\nof words',
    'First paragraph.\n\nSecond paragraph.',
  ])('sets %j as paragraphs', (text) => {
    expect(oneSentence(text)).toBe(false)
  })

  it('is false for words with nothing in them', () => {
    expect(oneSentence('')).toBe(false)
    expect(oneSentence('   ')).toBe(false)
    expect(oneSentence('\n')).toBe(false)
  })
})

describe('paragraphs', () => {
  it('split at blank lines, keep a single line break inside its paragraph, and drop empty parts', () => {
    expect(paragraphs('One.\nStill one.\n\nTwo.\n  \n\n  Three.  ')).toEqual(['One.\nStill one.', 'Two.', 'Three.'])
    expect(paragraphs('   ')).toEqual([])
    expect(paragraphs('')).toEqual([])
  })
})

describe('hasWords', () => {
  it('is true only for text with something in it once its spaces are taken off', () => {
    expect(hasWords('a')).toBe(true)
    expect(hasWords(' a ')).toBe(true)
    expect(hasWords('')).toBe(false)
    expect(hasWords('  \n\t ')).toBe(false)
    expect(hasWords(null)).toBe(false)
    expect(hasWords(undefined)).toBe(false)
  })
})

describe('the links a club gave', () => {
  it('draws a web address as it was written, with the spaces taken off', () => {
    expect(webLink('https://example.org/chess')).toBe('https://example.org/chess')
    expect(webLink('http://example.org')).toBe('http://example.org')
    expect(webLink('  HTTPS://Example.org/x  ')).toBe('HTTPS://Example.org/x')
  })

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,example',
    'mailto:club@example.org',
    'ftp://example.org',
    '//example.org/chess',
    'example.org/chess',
    'https://',
    'https:///nothing',
    'https:// example.org',
    '',
    '   ',
  ])('draws %j as no link at all', (url) => {
    expect(webLink(url)).toBeNull()
  })

  it('draws no link for no address', () => {
    expect(webLink(null)).toBeNull()
    expect(webLink(undefined)).toBeNull()
  })

  it('names a site without its www.', () => {
    expect(siteOf('https://www.example.org/chess')).toBe('example.org')
    expect(siteOf('https://club.example.org')).toBe('club.example.org')
    expect(siteOf('not an address')).toBe('not an address')
  })
})

describe('the address the page goes by', () => {
  it('is the slug, with the query and the hash it was opened with', () => {
    expect(pageAddress('example-chess-club', '', '')).toBe('/clubs/example-chess-club')
    expect(pageAddress('example-chess-club', '?from=example', '#when-and-where')).toBe('/clubs/example-chess-club?from=example#when-and-where')
  })

  it('encodes a slug that needs it, so it cannot add a path, a query or a hash of its own', () => {
    expect(pageAddress('a/b', '', '')).toBe('/clubs/a%2Fb')
    expect(pageAddress('a?b#c', '', '')).toBe('/clubs/a%3Fb%23c')
  })
})

describe('who keeps a club', () => {
  const none: KeeperAuth = { role: 'member', member: null, managedClubs: [] }
  const rep = (clubId: string | null, role = 'club_rep'): KeeperAuth => ({ role, member: { club_id: clubId }, managedClubs: [] })

  it('is nobody for a visitor who is not signed in, even one who somehow holds seats', () => {
    expect(keeperFor(CLUB, none)).toBeNull()
    expect(keeperFor(CLUB, { ...none, managedClubs: [{ id: CLUB.id, region: 'Bayou Region' }] })).toBeNull()
  })

  it('is the club\'s rep for a club rep whose club is this one, with Edit to Your club\'s page', () => {
    expect(keeperFor(CLUB, rep(CLUB.id))).toEqual({ kind: 'rep', edit: '/my/club/example-chess-club' })
  })

  it('is nobody for a club rep of another club, a rep with no club, or a plain member of this club', () => {
    expect(keeperFor(CLUB, rep('c-other'))).toBeNull()
    expect(keeperFor(CLUB, rep(null))).toBeNull()
    expect(keeperFor(CLUB, rep(CLUB.id, 'member'))).toBeNull()
  })

  it('is nobody for an LCA admin, who is no keeper of the club on this page', () => {
    expect(keeperFor(CLUB, rep(CLUB.id, 'admin'))).toBeNull()
    expect(keeperFor(CLUB, { role: 'admin', member: { club_id: null }, managedClubs: [] })).toBeNull()
  })

  it('is the region\'s representative for a seat whose clubs include this one, with Edit to the club\'s page in My region', () => {
    const keeper = keeperFor(CLUB, { role: 'member', member: { club_id: null }, managedClubs: [{ id: 'c-other', region: 'Delta Region' }, { id: CLUB.id, region: 'Bayou Region' }] })
    expect(keeper).toEqual({ kind: 'region', region: 'Bayou Region', edit: '/workspace/region/clubs/c-example' })
  })

  it('names the club\'s region when the seat holds none, and neither when neither is known', () => {
    const auth: KeeperAuth = { role: 'member', member: { club_id: null }, managedClubs: [{ id: CLUB.id, region: null }] }
    expect(keeperFor(CLUB, auth)).toMatchObject({ kind: 'region', region: 'Bayou Region' })
    expect(keeperFor({ ...CLUB, region: null }, auth)).toMatchObject({ kind: 'region', region: null })
  })

  it('reads a person who is both as the club\'s rep, and an unrelated region\'s representative as nobody', () => {
    const both: KeeperAuth = { role: 'club_rep', member: { club_id: CLUB.id }, managedClubs: [{ id: CLUB.id, region: 'Bayou Region' }] }
    expect(keeperFor(CLUB, both)?.kind).toBe('rep')
    const other: KeeperAuth = { role: 'member', member: { club_id: null }, managedClubs: [{ id: 'c-other', region: 'Delta Region' }] }
    expect(keeperFor(CLUB, other)).toBeNull()
  })

  it('encodes an id or slug that needs it in the address Edit leads to', () => {
    expect(keeperFor({ ...CLUB, slug: 'a/b' }, rep(CLUB.id))?.edit).toBe('/my/club/a%2Fb')
    expect(keeperFor({ ...CLUB, id: 'a b' }, { role: 'member', member: { club_id: null }, managedClubs: [{ id: 'a b', region: null }] })?.edit).toBe('/workspace/region/clubs/a%20b')
  })

  it('says each line in the words the brief gives', () => {
    expect(keeperWords({ kind: 'rep', edit: '' })).toBe('This is your club\'s page')
    expect(keeperWords({ kind: 'region', region: 'Bayou Region', edit: '' })).toBe('You can edit this page as the Bayou Region representative')
  })
})

describe('the places that become pins', () => {
  const place = (name: string, latitude: number | null, longitude: number | null) => ({ name, street: null, note: null, latitude, longitude })

  it('are those with a point, in their order, as plain points', () => {
    expect(placePoints([place('Example Library', 30.1, -91.2), place('Example Cafe', 30.2, -91.3)])).toEqual([
      { name: 'Example Library', lat: 30.1, lng: -91.2 }, { name: 'Example Cafe', lat: 30.2, lng: -91.3 },
    ])
  })

  it('leave out a place with no point, or with only half of one', () => {
    expect(placePoints([place('Example Library', null, null), place('Example Cafe', 30.2, -91.3)])).toEqual([{ name: 'Example Cafe', lat: 30.2, lng: -91.3 }])
    expect(placePoints([place('Example Library', 30.1, null), place('Example Cafe', null, -91.3)])).toEqual([])
    expect(placePoints([])).toEqual([])
  })

  it('keep a point on the equator or the prime meridian, which are zero and still a point', () => {
    expect(placePoints([place('Example Library', 0, 0)])).toEqual([{ name: 'Example Library', lat: 0, lng: 0 }])
  })

  it('make directions at the point with the maps link the site already builds, with no key', () => {
    expect(directionsUrl({ lat: 30.1, lng: -91.2 })).toBe('https://www.google.com/maps/dir/?api=1&destination=30.1,-91.2')
    expect(directionsUrl({ lat: 30.1, lng: -91.2 })).not.toMatch(/key=/)
  })
})
