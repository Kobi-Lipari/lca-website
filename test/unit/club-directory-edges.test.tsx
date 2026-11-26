// @vitest-environment jsdom
//
// The edges of the Clubs directory (WS09 step 33), beside
// test/unit/club-directory.test.tsx:
// - the order: two clubs of one name go by id, a capital before a small
//   letter, and the same clubs in any order give the same list;
// - a card's words: markup in a club's text is read as text, a club with no
//   town has no stray separator, a statement of spaces counts as none;
// - the pins and the cards agree: one pin for each club with a point and
//   none for the rest, in the list's order, for a list of any size;
// - the tab order: the list's links come before the map's buttons;
// - a club that goes from the answer while its pin is selected leaves nothing
//   selected and nothing broken;
// - a map with no club that has a point draws no pin, says nothing of it,
//   and still lists every club;
// - the plain-language rules for the page's own words and files: US Chess,
//   no long dash, no keeper, no seat, no half written as .5, no fetch in a
//   page.
// Every club and name here is made up.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClubDirectoryItem } from '@/areas/clubs/api'
import * as words from '@/areas/clubs/directoryWords'
import { STAND_IN_FLAG } from '@/areas/clubs/directoryPins'

const { ClubDirectory } = await import('@/areas/clubs/components/ClubDirectory')

function row(id: string, name: string, city: string | null, point: [number, number] | null, statement: string | null, description: string | null = null, region: string | null = null): ApiClubDirectoryItem {
  return {
    id, name, city: city as string, meeting_schedule: statement ?? '', color: null, image_url: null, region, latitude: null, longitude: null,
    slug: `${id}-slug`, statement, description: statement ? null : description, point: point ? { latitude: point[0], longitude: point[1] } : null,
    weekend_play: false, scholastic_friendly: false,
  }
}

beforeEach(() => {
  Element.prototype.scrollIntoView = () => {}
  window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
  vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '')
})
afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  delete (window as unknown as Record<string, unknown>)[STAND_IN_FLAG]
})

function draw(clubs: ApiClubDirectoryItem[]) {
  return render(<MemoryRouter initialEntries={['/clubs']}><ClubDirectory clubs={clubs} /></MemoryRouter>)
}

/** The directory with the stand-in map, as the accessibility test build draws it when a page asks. */
async function drawWithMap(clubs: ApiClubDirectoryItem[]) {
  vi.stubEnv('MODE', 'a11y')
  ;(window as unknown as Record<string, unknown>)[STAND_IN_FLAG] = true
  const view = draw(clubs)
  const map = await screen.findByRole('group', { name: 'Map of the clubs' })
  return { view, map }
}

const cardLinks = () => within(screen.getByRole('list', { name: 'Clubs, A to Z' })).getAllByRole('link')
const cardNames = () => cardLinks().map((a) => a.getAttribute('data-card'))

describe('the order', () => {
  it('puts two clubs of one name in the order of their ids, and a capital before a small letter', () => {
    draw([
      row('z-9', 'Example Twin Club', 'Example City', null, 'Mondays at 7:00 PM.'),
      row('a-1', 'Example Twin Club', 'Example Town', null, 'Tuesdays at 7:00 PM.'),
      row('m-5', 'example Small Club', 'Example Village', null, 'Fridays at 6:00 PM.'),
      row('k-2', 'Example Zed Club', 'Example Hamlet', null, 'Sundays at 2:00 PM.'),
    ])
    expect(cardNames()).toEqual(['a-1', 'z-9', 'k-2', 'm-5'])
  })

  it('gives the same list for the same clubs in any order they arrive', () => {
    const clubs = ['d', 'b', 'a', 'c', 'e'].map((id, i) => row(id, `Example Club ${'DBACE'[i]}`, 'Example City', null, 'Mondays at 7:00 PM.'))
    draw(clubs)
    const first = cardNames()
    cleanup()
    draw([...clubs].reverse())
    expect(cardNames()).toEqual(first)
    expect(first).toEqual(['a', 'b', 'c', 'd', 'e'])
  })
})

describe('a card\'s words', () => {
  it('reads markup in a club\'s text as text, so no element comes of it', () => {
    const { container } = draw([row('c1', 'Example <b>Bold</b> Club', 'Example <i>City</i>', null, 'Mondays at <script>7:00 PM</script>.')])
    expect(container.querySelector('script, b, i')).toBeNull()
    expect(container.querySelector('li')!.textContent).not.toMatch(/[<>]/)
  })

  it('draws a club with no town without a stray separator or the word null', () => {
    draw([row('c1', 'Example Chess Club', null, null, 'Mondays at 7:00 PM.')])
    const card = cardLinks()[0]
    expect(card.textContent).toBe('Example Chess ClubMondays at 7:00 PM.')
    expect(card.textContent).not.toMatch(/null|undefined|·/)
  })

  it('takes a statement of spaces as none: the thin card\'s words and a hollow pin', async () => {
    const { map } = await drawWithMap([row('c1', 'Example Chess Club', 'Example City', [30.4, -91.1], '   ', 'A made-up club for every strength.')])
    // The answer sends a statement of spaces with no description, so the card holds only its own words.
    expect(cardLinks()[0].textContent).toBe(`Example Chess Club · Example City${words.THIN_CARD}`)
    expect(map.querySelector('[data-pin="c1"]')!.getAttribute('data-listed')).toBe('false')
  })

  it('draws the thin card\'s words without a description line when the answer has none', () => {
    draw([row('c1', 'Example Chess Club', 'Example City', null, null, null)])
    expect(cardLinks()[0].textContent).toBe(`Example Chess Club · Example City${words.THIN_CARD}`)
    expect(cardLinks()[0].querySelectorAll('span.text-muted-foreground')).toHaveLength(0)
  })

  it('holds a very long statement to two lines that break at any word, with no second link', () => {
    const long = 'Every Tuesday at 7:00 PM, ' + 'with a long made-up schedule that keeps going '.repeat(30)
    draw([row('c1', 'Example Chess Club', 'Example City', null, long)])
    const statement = cardLinks()[0].querySelector('span.line-clamp-2')!
    expect(statement.textContent).toBe(long.trim())
    expect(statement.className).toContain('break-words')
    expect(screen.getAllByRole('link')).toHaveLength(1)
  })
})

describe('the pins and the cards agree', () => {
  it('gives one pin for each club with a point and none for the rest, in the list\'s order, for sixty clubs', async () => {
    const clubs = Array.from({ length: 60 }, (_, i) => {
      const id = `club-${String(i).padStart(2, '0')}`
      // Every third club has no point; the rest are spread over the state, each in a town of its own.
      const point: [number, number] | null = i % 3 === 0 ? null : [29.2 + (i % 20) * 0.2, -93.5 + Math.floor(i / 20) * 1.5 + (i % 7) * 0.1]
      return row(id, `Example Club ${String(59 - i).padStart(2, '0')}`, `Example Town ${i}`, point, i % 2 ? 'Mondays at 7:00 PM.' : null)
    })
    const { map } = await drawWithMap(clubs)
    expect(cardLinks()).toHaveLength(60)
    const expected = cardNames().filter((id) => clubs.find((c) => c.id === id)!.point !== null)
    expect(expected).toHaveLength(40)
    expect([...map.querySelectorAll('[data-pin]')].map((p) => p.getAttribute('data-pin'))).toEqual(expected)
    expect(map.querySelectorAll('[data-circle]')).toHaveLength(0)
    for (const pin of map.querySelectorAll('[data-pin]')) {
      const club = clubs.find((c) => c.id === pin.getAttribute('data-pin'))!
      expect(pin.getAttribute('data-listed')).toBe(club.statement ? 'true' : 'false')
      expect(pin.getAttribute('aria-label')).toBe(`${club.name}, ${club.city}`)
    }
  })

  it('draws the same pins again for the same clubs', async () => {
    const clubs = [row('a', 'Example A Club', 'Example City', [30, -91], 'Mondays at 7:00 PM.'), row('b', 'Example B Club', 'Example Town', [31, -92], null)]
    const first = (await drawWithMap(clubs)).map.innerHTML
    cleanup()
    expect((await drawWithMap(clubs)).map.innerHTML).toBe(first)
  })

  it('names two clubs of one name in one town by one circle, never by two pins that sound alike', async () => {
    const { map } = await drawWithMap([
      row('a', 'Example Twin Club', 'Example City', [30, -91], 'Mondays at 7:00 PM.'),
      row('b', 'Example Twin Club', 'Example City', [30, -91], null),
    ])
    expect(map.querySelectorAll('[data-pin]')).toHaveLength(0)
    expect(within(map).getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual(['2 clubs in Example City, show each', words.WHOLE_STATE])
    fireEvent.click(within(map).getByRole('button', { name: '2 clubs in Example City, show each' }))
    expect(map.querySelectorAll('[data-pin]')).toHaveLength(2)
  })
})

describe('the tab order', () => {
  it('meets the skip link, then every card, then the map\'s pins in the list\'s order, then All of Louisiana', async () => {
    const { view } = await drawWithMap([
      row('c', 'Example C Club', 'Example Town', [30, -91], 'Mondays at 7:00 PM.'),
      row('a', 'Example A Club', 'Example City', [31, -92], null),
      row('b', 'Example B Club', 'Example Village', [32, -93], 'Fridays at 6:00 PM.'),
    ])
    const order = [...view.container.querySelectorAll<HTMLElement>('a, button')].map((el) => el.getAttribute('data-card') ?? el.getAttribute('data-pin') ?? el.textContent)
    // The field's question mark, Near me, the two orders and Filters (WS09 step 34) come before the skip link, which goes straight before the list.
    expect(order).toEqual(['', words.NEAR_ME, words.A_TO_Z, words.NEAREST, 'Filters', 'Skip to the map', 'a', 'b', 'c', 'a', 'b', 'c', words.WHOLE_STATE])
    expect(view.container.querySelectorAll('[tabindex]:not([tabindex="-1"])')).toHaveLength(0)
  })
})

describe('a club that leaves the answer', () => {
  it('leaves nothing selected and nothing broken when the selected club is no longer listed', async () => {
    vi.stubEnv('MODE', 'a11y')
    ;(window as unknown as Record<string, unknown>)[STAND_IN_FLAG] = true
    const clubs = [row('a', 'Example A Club', 'Example City', [30, -91], 'Mondays at 7:00 PM.'), row('b', 'Example B Club', 'Example Town', [31, -92], 'Fridays at 6:00 PM.')]
    const view = render(<MemoryRouter><ClubDirectory clubs={clubs} /></MemoryRouter>)
    const map = await screen.findByRole('group', { name: 'Map of the clubs' })
    fireEvent.click(within(map).getByRole('button', { name: 'Example B Club, Example Town' }))
    expect(map.querySelector('[aria-pressed="true"]')).not.toBeNull()
    view.rerender(<MemoryRouter><ClubDirectory clubs={clubs.slice(0, 1)} /></MemoryRouter>)
    expect(map.querySelector('[aria-pressed="true"]')).toBeNull()
    expect(map.querySelector('[data-pin="b"]')).toBeNull()
    expect(cardLinks()).toHaveLength(1)
    expect(cardLinks()[0].getAttribute('data-selected')).toBeNull()
    expect(screen.getByText('1 club · 0 regions · Find the nearest, or look around the whole state.')).toBeTruthy()
  })
})

describe('a list in which no club has a point', () => {
  it('lists every club, draws no pin, and says nothing of the missing points', async () => {
    const { map, view } = await drawWithMap([
      row('a', 'Example A Club', 'Example City', null, 'Mondays at 7:00 PM.'),
      row('b', 'Example B Club', 'Example Town', null, null),
    ])
    expect(cardLinks()).toHaveLength(2)
    expect(map.querySelectorAll('[data-pin], [data-circle]')).toHaveLength(0)
    expect(within(map).getAllByRole('button').map((b) => b.textContent)).toEqual([words.WHOLE_STATE])
    expect(view.container.textContent).not.toMatch(/no point|no pin|not on the map|location/i)
  })
})

describe('the words and the files, by the plain-language rules', () => {
  const ROOT = resolve(__dirname, '../..')
  const FILES = [
    'src/pages/ClubsIndexPage.tsx',
    'src/areas/clubs/components/ClubCard.tsx',
    'src/areas/clubs/components/ClubDirectory.tsx',
    'src/areas/clubs/components/DirectoryMap.tsx',
    'src/areas/clubs/directoryPins.ts',
    'src/areas/clubs/directoryRows.ts',
    'src/areas/clubs/directoryWords.ts',
    'test/a11y/clubs-directory.spec.ts',
    'test/unit/club-directory.test.tsx',
    'test/unit/club-map-pins.test.ts',
    'test/unit/clubs-index-page.test.tsx',
    'test/unit/clubs-page-base-markup.test.tsx',
    'test/integration/clubs-directory-site-reads.test.ts',
  ]
  const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
  /** The en dash and the em dash, written by their codes so this file holds neither. */
  const LONG_DASH = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
  const OLD_NAME = new RegExp(`USC${'F'}`)

  it('writes no long dash and never the old name of US Chess in any file of the directory or its tests', () => {
    for (const path of [...FILES, 'test/unit/club-directory-edges.test.tsx']) expect(read(path), path).not.toMatch(LONG_DASH)
    for (const path of FILES) expect(read(path), path).not.toMatch(OLD_NAME)
  })

  it('names no keeper, seat or representative in the page\'s own words and files, and asks for nothing by fetch', () => {
    for (const path of FILES.filter((p) => p.startsWith('src/'))) {
      const text = read(path).replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
      expect(text, path).not.toMatch(/keeper|representative|\bseat\b|\bfetch\(/i)
    }
  })

  it('writes every word the page adds in plain English: no .5 for a half and no 24 hour time', () => {
    const all = Object.values(words).filter((v): v is string => typeof v === 'string').concat([words.stripLine(25, 5), words.listCaption(25)])
    for (const text of all) {
      expect(text).not.toMatch(/\.5\b|\b([01]?\d|2[0-3]):[0-5]\d\b(?! ?[AP]M)/)
      expect(text).not.toMatch(LONG_DASH)
    }
    expect(words.stripLine(25, 5)).toBe('25 clubs · 5 regions · Find the nearest, or look around the whole state.')
    expect(words.listCaption(25)).toBe('All 25 clubs, A to Z. Meeting times are as each club states them; confirm before a first visit.')
  })

  it('keeps today\'s "300+ members" out of the directory\'s strip and cards, as K\'s rule keeps it on the home page', async () => {
    const { view } = await drawWithMap([row('a', 'Example A Club', 'Example City', [30, -91], 'Mondays at 7:00 PM.')])
    expect(view.container.textContent).not.toMatch(/300|members/i)
    expect(read('src/areas/clubs/directoryWords.ts')).not.toMatch(/300|members/i)
  })
})
