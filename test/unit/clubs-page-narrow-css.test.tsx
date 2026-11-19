// @vitest-environment jsdom
//
// The public Clubs page on a narrow phone (K's decision 4, answer 1 (a), of
// Saturday, November 14, 2026), held at the stylesheet. A test with no browser
// cannot measure a page's width, so this reads what Tailwind itself writes
// for the classes the page draws: the grid's one column is a column that may
// shrink below its widest card (minmax(0, 1fr)), it is set for every width
// and the wide template comes after it, under 1,024 pixels and up, so at
// 1,024 and wider the two columns win as before; the meeting line sets
// nothing that would stop a long time wrapping; and the list's own scroll box
// at 1,024 and wider is left as it was.
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClubListItem } from '@/lib/api'
import { builder } from './helpers/tailwindPx'

const api = vi.hoisted(() => ({ getClubs: vi.fn() }))
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}))
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api')>()), ...api }))
vi.mock('@/areas/clubs/components/LCAMap', () => ({ LCAMap: () => null }))

const { ClubsPage } = await import('@/pages/ClubsPage')

const LONG_MEETING = '1st, 3rd & 5th Tuesdays 5:30 PM'
// A made up time with no space in it at all, the hardest case for a line that must wrap.
const NO_SPACES = 'Example-Tuesdays-and-Thursdays-in-the-Example-Library-Annex'
const CLUBS: ApiClubListItem[] = [
  { id: 'c1', name: 'Example Chess Club', city: 'Example City', meeting_schedule: LONG_MEETING, color: '#1f4e79', image_url: null, region: 'North Louisiana', latitude: 29.7, longitude: -91.2 },
  { id: 'c2', name: 'Example Rooks Club', city: 'Example Town', meeting_schedule: NO_SPACES, color: '#c8a94a', image_url: null, region: 'North Louisiana', latitude: 30.1, longitude: -91.5 },
  { id: 'c3', name: 'Example Knights Club', city: 'Example Village', meeting_schedule: null, color: '#c8a94a', image_url: null, region: null, latitude: null, longitude: null },
]

beforeAll(() => {
  window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
  Element.prototype.scrollIntoView = () => {}
})
beforeEach(() => {
  api.getClubs.mockReset()
  api.getClubs.mockResolvedValue(CLUBS)
})
afterEach(() => cleanup())

async function drawPage() {
  const view = render(
    <MemoryRouter initialEntries={['/clubs']}>
      <Routes><Route path="/clubs" element={<ClubsPage />} /></Routes>
    </MemoryRouter>,
  )
  await screen.findByText(LONG_MEETING)
  return view.container
}

/** The grid that holds the map and the list, found by its list. */
function gridOf(): HTMLElement {
  return screen.getByRole('heading', { level: 2, name: /^\d+ clubs?/ }).closest('.lg\\:order-1')!.parentElement as HTMLElement
}

/**
 * The first rule that styles `selector` in the compile: its declarations, where it stands, and the width
 * condition of the @media block around it (null when it is not inside one, whatever its place in the block).
 */
function ruleOf(css: string, selector: string): { body: string; at: number; media: string | null } | null {
  const escaped = selector.replace(/[^\w-]/g, (c) => `\\${c}`).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const found = new RegExp(`\\.${escaped}\\s*\\{([^}]*)\\}`).exec(css)
  if (!found) return null
  let media: string | null = null
  for (const open of css.slice(0, found.index).matchAll(/@media \(([^)]+)\) \{/g)) {
    const between = css.slice(open.index! + open[0].length, found.index)
    // The block is still open at the rule when its braces have not all been closed.
    if ((between.match(/\{/g) ?? []).length >= (between.match(/\}/g) ?? []).length) media = open[1]
  }
  return { body: found[1], at: found.index, media }
}

describe('the Clubs page grid, as Tailwind writes it', () => {
  it('has one column that may shrink below its content at every width, and the wide template after it from 1,024 pixels', async () => {
    await drawPage()
    const classes = gridOf().className.split(' ')
    const css = (await builder())(classes)

    const one = ruleOf(css, 'grid-cols-1')
    expect(one, 'grid-cols-1 compiles').not.toBeNull()
    // A column of minmax(0, 1fr) has a floor of zero, so a wide card cannot hold it open; a bare 1fr would.
    expect(one!.body).toMatch(/grid-template-columns:\s*repeat\(1,\s*minmax\(0,\s*1fr\)\)/)
    expect(one!.media, 'the one column is not held to a width').toBeNull()

    const wide = ruleOf(css, 'lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]')
    expect(wide, 'the wide template compiles').not.toBeNull()
    expect(wide!.body).toMatch(/grid-template-columns:\s*minmax\(0,\s*400px\)\s+minmax\(0,\s*1fr\)/)
    // 64rem is 1,024 pixels at the browser's own size: below it the grid has the one column, at it the two.
    expect(wide!.media).toMatch(/^width\s*>=\s*64rem$/)
    // Same weight, so the later rule wins: the wide template must come after the one column.
    expect(wide!.at).toBeGreaterThan(one!.at)

    // The gap beside it is as it was: 20 pixels, 24 pixels from 1,024.
    expect(ruleOf(css, 'gap-5')!.body).toContain('calc(var(--spacing) * 5)')
    const wideGap = ruleOf(css, 'lg:gap-6')
    expect(wideGap!.media).toMatch(/^width\s*>=\s*64rem$/)
    expect(wideGap!.at).toBeGreaterThan(ruleOf(css, 'gap-5')!.at)
  })

  it('keeps the list scroll box and the map pinned in place for 1,024 pixels and wider, as before', async () => {
    await drawPage()
    const list = screen.getByRole('heading', { level: 2, name: /^\d+ clubs?/ }).closest('.lg\\:order-1') as HTMLElement
    const box = list.querySelector('.space-y-2\\.5') as HTMLElement
    expect(box.className).toBe('space-y-2.5 lg:max-h-[calc(100vh-11rem)] lg:overflow-y-auto lg:pb-2 lg:pl-1 lg:pr-2 lg:pt-1 [scrollbar-width:thin]')
    const css = (await builder())(box.className.split(' '))
    for (const cls of ['lg:max-h-[calc(100vh-11rem)]', 'lg:overflow-y-auto']) {
      expect(ruleOf(css, cls)?.media, cls).toMatch(/^width\s*>=\s*64rem$/)
    }
    // Nothing on the small screen scrolls the list inside a box: the scroll is the wide layout's alone.
    expect(ruleOf(css, 'overflow-y-auto')).toBeNull()
    const map = gridOf().firstElementChild as HTMLElement
    expect((map.firstElementChild as HTMLElement).className).toBe('lg:sticky lg:top-20')
  })
})

describe('the meeting line, as Tailwind writes it', () => {
  it('may wrap, at any width, and sets nothing that cuts a line short', async () => {
    await drawPage()
    const span = screen.getByText(LONG_MEETING)
    const line = span.parentElement as HTMLElement
    const mark = line.querySelector('svg') as SVGElement
    const css = (await builder())([...line.className.split(' '), ...(mark.getAttribute('class') ?? '').split(' '), ...span.className.split(' ')])

    // The text may shrink below its own width and breaks inside a long word: the line wraps and nothing runs past the card.
    expect(ruleOf(css, 'min-w-0')!.body).toMatch(/min-width:\s*(0|calc\(var\(--spacing\)\s*\*\s*0\))/)
    expect(ruleOf(css, 'break-words')!.body).toMatch(/overflow-wrap:\s*break-word/)
    // The mark is level with the first line and is not squeezed by a long time.
    expect(ruleOf(css, 'items-start')!.body).toMatch(/align-items:\s*flex-start/)
    expect(ruleOf(css, 'mt-0.5')!.body).toContain('calc(var(--spacing) * 0.5)')
    expect(ruleOf(css, 'flex-shrink-0')!.body).toMatch(/flex-shrink:\s*0/)
    // Nothing sets a no-wrap, an ellipsis or a clamp.
    expect(css).not.toMatch(/white-space:\s*nowrap/)
    expect(css).not.toMatch(/text-overflow/)
    expect(css).not.toMatch(/-webkit-line-clamp|line-clamp/)
    // The line is a flex row whose text is its only child that may shrink: the one beside the mark.
    expect(line.children).toHaveLength(2)
    expect(line.children[0]).toBe(mark)
    expect(line.children[1]).toBe(span)
  })

  it('is drawn whole, in the same two parts, for a time with no space in it and with the card chosen', async () => {
    await drawPage()
    const odd = screen.getByText(NO_SPACES)
    expect(odd.textContent).toBe(NO_SPACES)
    expect(odd.className).toBe('min-w-0 break-words')
    expect(odd.parentElement?.className).toBe('flex items-start gap-1.5')
    // The card of the other club is also whole when chosen, which only changes its border and tint.
    const card = screen.getByRole('button', { name: 'Show Example Chess Club on the map' })
    fireEvent.click(card)
    const after = screen.getByText(LONG_MEETING)
    expect(after.textContent).toBe(LONG_MEETING)
    expect(after.className).toBe('min-w-0 break-words')
    expect(after.parentElement?.className).toBe('flex items-start gap-1.5')
    expect(screen.queryByText(/…|\.\.\./)).toBeNull()
  })
})

describe('the grid with a region pressed and with nothing to list', () => {
  it('keeps the same grid, the same list box and the same meeting line when a region is pressed', async () => {
    const container = await drawPage()
    const before = gridOf().className
    fireEvent.click(screen.getByRole('button', { name: 'North LA' }))
    expect(screen.getByRole('heading', { level: 2, name: /^\d+ clubs?/ }).textContent).toBe('2 clubs in North Louisiana')
    expect(gridOf().className).toBe(before)
    expect(gridOf().className).toContain('grid-cols-1')
    for (const time of [LONG_MEETING, NO_SPACES]) {
      const span = screen.getByText(time)
      expect(span.className).toBe('min-w-0 break-words')
      expect(span.parentElement?.className).toBe('flex items-start gap-1.5')
    }
    expect(container.querySelectorAll('.truncate')).toHaveLength(0)
  })

  it('keeps the grid, the map and the count when a region has no clubs', async () => {
    api.getClubs.mockResolvedValue([CLUBS[2]])
    render(
      <MemoryRouter initialEntries={['/clubs']}>
        <Routes><Route path="/clubs" element={<ClubsPage />} /></Routes>
      </MemoryRouter>,
    )
    await screen.findByText('Example Knights Club')
    fireEvent.click(screen.getByRole('button', { name: 'Lafayette / South Central' }))
    expect(screen.getByText('No clubs in this region yet')).toBeTruthy()
    expect(gridOf().className.split(' ')).toEqual(['grid', 'grid-cols-1', 'gap-5', 'lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]', 'lg:gap-6'])
    expect(gridOf().children).toHaveLength(2)
  })
})
