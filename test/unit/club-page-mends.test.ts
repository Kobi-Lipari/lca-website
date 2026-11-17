// The plain code the rest of the new club page adds or mends (WS09 step
// 22), one rule at a time: the club's links, which refuse an address with a
// name or a password before the "@"; one sentence or more, where a full stop
// after a short word or before a word in lower case does not end the
// sentence; the page's own address and what Copy link says; and how an
// event, a news row, a nearest club and the foot line are said. Every name,
// address and club here is made up, Example Chess Club at example.org among
// them.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyLink, oneSentence, pageLink, webLink } from '@/areas/clubs/clubPage'
import { eventDates, eventFull, footPlace, nearbyHeading, nearbyLine, newsDate } from '@/areas/clubs/clubPageRows'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the links a club gave', () => {
  it.each([
    'https://player@example.org/chess',
    'https://player:secret@example.org/chess',
    'https://:secret@example.org',
    'https://example.org@example.org/',
    'HTTPS://Player@example.org',
  ])('draws %j, with a name or a password before the "@", as no link at all', (url) => {
    expect(webLink(url)).toBeNull()
  })

  it('still draws a web address with an "@" after its host, as it was written', () => {
    expect(webLink('https://example.org/@example-chess-club')).toBe('https://example.org/@example-chess-club')
    expect(webLink(' https://example.org/chess?ask=a@b ')).toBe('https://example.org/chess?ask=a@b')
  })

  it('reads the address with the browser\'s own reader, never the contract\'s, which the site\'s bundle does not carry', async () => {
    const { readFileSync } = await import('node:fs')
    const code = readFileSync(new URL('../../src/areas/clubs/clubPage.ts', import.meta.url), 'utf8')
    expect(code).toContain('new URL(trimmed)')
    expect(code).not.toMatch(/isWebAddress|from '@domain\/contracts\/clubs'|from 'zod'/)
  })
})

describe('one sentence or more', () => {
  it.each([
    'We meet at St. Example\'s hall on Tuesdays.',
    'Ask Dr. One or Mr. Two at the door.',
    'Mrs. One and Ms. Two keep the boards.',
    'We play near Mt. Example on Saturdays.',
    'Find us at 1 Example Ave. Example City.',
    'Example Blvd. at the corner, every Friday.',
    'Example Rd. past the library, upstairs.',
    'Doors open at 7:00 p.m. Tuesdays and Thursdays.',
    'Doors open at 9 a.m. Saturdays.',
    'Doors open at 7 P.M. Fridays.',
    'Bring a clock, e.g. a digital one, if you have it.',
    'Casual games, i.e. no clocks needed.',
  ])('sets %j large, as one sentence', (text) => {
    expect(oneSentence(text)).toBe(true)
  })

  it.each([
    'We meet on the 3rd. Bring a board.',
    'We meet at St. Example\'s hall. Everyone is welcome.',
    'Ask for Dr. One. She keeps the clocks.',
    'Said "St." Then left.',
    'Free to play! Bring a friend.',
    'Is this your first visit? Come early.',
    'Best. Club. Ever.',
  ])('still sets %j as paragraphs', (text) => {
    expect(oneSentence(text)).toBe(false)
  })

  it('reads a short word only as a word of its own, so a longer word that ends in its letters still ends a sentence', () => {
    expect(oneSentence('We meet in Belmont. Then we play.')).toBe(false)
    expect(oneSentence('Ask for Dr. One.')).toBe(true)
  })
})

describe('the page\'s own address and Copy link', () => {
  it('is the slug on this site, with no query and no hash, the slug encoded', () => {
    expect(pageLink('https://example.org', 'example-chess-club')).toBe('https://example.org/clubs/example-chess-club')
    expect(pageLink('https://example.org', 'a?b#c')).toBe('https://example.org/clubs/a%3Fb%23c')
  })

  it('says what copying did, in the words Share already says', async () => {
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    expect(await copyLink('https://example.org/clubs/example-chess-club')).toBe('Link copied.')
    expect(writeText).toHaveBeenCalledWith('https://example.org/clubs/example-chess-club')
    writeText.mockRejectedValueOnce(new Error('denied'))
    expect(await copyLink('https://example.org/clubs/example-chess-club')).toBe('The link could not be copied. The page\'s address is https://example.org/clubs/example-chess-club')
    vi.stubGlobal('navigator', {})
    expect(await copyLink('https://example.org/clubs/example-chess-club')).toBe('The link could not be copied. The page\'s address is https://example.org/clubs/example-chess-club')
  })
})

describe('how the rows are said', () => {
  it('gives an event\'s date with its weekday and year, and both ends for an event of more than one day', () => {
    expect(eventDates({ date: '2026-12-05', end_date: null })).toBe('Sat, Dec 5, 2026')
    expect(eventDates({ date: '2026-12-12', end_date: '2026-12-13' })).toBe('Sat, Dec 12, 2026 to Sun, Dec 13, 2026')
    expect(eventDates({ date: '2026-12-31', end_date: '2027-01-02' })).toBe('Thu, Dec 31, 2026 to Sat, Jan 2, 2027')
    expect(eventDates({ date: '2026-12-05', end_date: '2026-12-05' })).toBe('Sat, Dec 5, 2026')
  })

  it('counts an event full only at its limit, and never one with no limit', () => {
    expect(eventFull({ max_players: 16, registered_count: 16 })).toBe(true)
    expect(eventFull({ max_players: 16, registered_count: 15 })).toBe(false)
    expect(eventFull({ max_players: null, registered_count: 300 })).toBe(false)
    expect(eventFull({ max_players: 0, registered_count: 3 })).toBe(false)
  })

  it('gives a news row\'s date with its weekday and year, or none when it cannot be read', () => {
    expect(newsDate('2026-11-14')).toBe('Sat, Nov 14, 2026')
    expect(newsDate('2026-11-14 09:30:00')).toBe('Sat, Nov 14, 2026')
    for (const odd of ['', 'sometime soon', '2026-02-30', '2026-13-01', 'Invalid Date']) expect(newsDate(odd), odd).toBeNull()
  })

  it('says a nearest club\'s line with the distance as given, the statement quoted or "Schedule not listed", and no empty part', () => {
    expect(nearbyLine({ city: 'Example Town', distance: 'about 5 mi', statement: 'Sundays at 2:00 PM.' })).toBe('Example Town · about 5 mi · “Sundays at 2:00 PM.”')
    expect(nearbyLine({ city: 'Example Town', distance: 'less than 1 mi', statement: null })).toBe('Example Town · less than 1 mi · Schedule not listed')
    expect(nearbyLine({ city: '  ', distance: 'about 12 mi', statement: '  ' })).toBe('about 12 mi · Schedule not listed')
    // Whatever the server says of the distance is drawn as it says it.
    expect(nearbyLine({ city: 'Example Town', distance: 'about 7.4 mi', statement: null })).toContain('about 7.4 mi')
  })

  it('names the town in the nearest clubs\' heading and the foot line, and leaves it out, with no "null", when there is none', () => {
    expect(nearbyHeading('Example City')).toBe('Chess clubs near Example City')
    expect(footPlace('Example City')).toBe('Example City, Louisiana')
    for (const none of [null, undefined, '', '   ']) {
      expect(nearbyHeading(none)).toBe('Chess clubs nearby')
      expect(footPlace(none)).toBe('Louisiana')
    }
  })
})
