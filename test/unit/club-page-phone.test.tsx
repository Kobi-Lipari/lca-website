// @vitest-environment jsdom
//
// The new club page on a phone (WS09 step 22): the section nav as a row of
// pills below 768 pixels of the page's width, each 32 pixels for the eye in
// a link 44 pixels tall, which scrolls sideways inside itself while the
// page does not, with room for the focus ring; the row's three sticking
// states kept as WS09 step 21 set them; the cover's height; and the club
// bar, Directions alone, as a bar of kind action in the new chrome's dock,
// drawn only where the dock is and only for a club with a place that has a
// point, never empty, with Directions still in When and where. The page is
// drawn from its answer, inside the dock's provider where a case needs the
// dock, with the switches set through the mocked FEATURES and the window
// given through stand-ins for matchMedia, visualViewport and
// ResizeObserver, which jsdom lacks. Every name, address and club here is
// made up.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { act, cleanup, render, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { ClubPageResponse } from '@domain/contracts'
import { visitor } from './helpers/clubPageAnswer'
import { restAnswer } from './helpers/clubPageRest'

const flags = vi.hoisted(() => ({ newClubs: true, newLook: true, newNav: true, clubKeepers: false }))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return {
    ...real,
    FEATURES: new Proxy(real.FEATURES, {
      get: (target, key) => (typeof key === 'string' && key in flags ? flags[key as keyof typeof flags] : Reflect.get(target, key)),
    }),
  }
})
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) } },
}))
vi.mock('@/areas/clubs/components/LCAMap', () => ({ LCAMap: () => null }))

const { ClubPageView } = await import('@/areas/clubs/components/ClubPage')
const { BottomDock, DockProvider } = await import('@/components/layout/BottomDock')
const { REFLOW_QUERY } = await import('@/hooks/useWideScreen')
const { CLEAR_OF_BARS } = await import('@/areas/clubs/clubPage')

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

/** A stand-in for the browser's media query, answering min-width, max-width and max-height from a window's size, and any one of a list. */
function stubWindow(size: { width: number; height: number }) {
  const one = (part: string) => {
    const m = /^\((min-width|max-width|max-height): ([\d.]+)px\)$/.exec(part.trim())
    if (!m) return false
    const px = Number(m[2])
    if (m[1] === 'min-width') return size.width >= px
    if (m[1] === 'max-width') return size.width <= px
    return size.height <= px
  }
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.split(',').some(one),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
  const view = Object.assign(new EventTarget(), { height: size.height })
  vi.stubGlobal('visualViewport', view)
  vi.stubGlobal('innerHeight', size.height)
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  })
}

beforeEach(() => {
  Object.assign(flags, { newClubs: true, newLook: true, newNav: true, clubKeepers: false })
  stubWindow({ width: 390, height: 844 })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  document.documentElement.style.removeProperty('--bottom-chrome-h')
})

/** The page, with the dock beside it as the page frame draws them with the chrome on, or alone as with the chrome off. */
function draw(answer: ClubPageResponse = restAnswer(), dock = true) {
  const page = <ClubPageView answer={answer} keeper={null} />
  const tree: ReactNode = dock ? <DockProvider><main>{page}</main><BottomDock /></DockProvider> : <main>{page}</main>
  render(<AuthContext.Provider value={visitor()}><MemoryRouter initialEntries={['/clubs/example-chess-club']}>{tree}</MemoryRouter></AuthContext.Provider>)
  return document.querySelector<HTMLElement>('[data-slot="club-page"]')!
}

const nav = (page: HTMLElement) => page.querySelector<HTMLElement>('nav[aria-label="On this page"]')!
const dockAction = () => document.querySelector<HTMLElement>('[data-slot="bottom-dock"] [data-slot="dock-action"]')

describe('the section nav on a phone', () => {
  it('is a row of pills below 768 pixels of the page, each 32 pixels for the eye in a 44 pixel link with the look\'s focus ring', () => {
    const page = draw()
    const links = [...nav(page).querySelectorAll<HTMLAnchorElement>('a')]
    expect(links.map((a) => a.textContent)).toEqual(['About', 'When and where', 'Events', 'News'])
    for (const link of links) {
      expect(link.className).toMatch(/\bmin-h-11\b/)
      expect(link.className).toMatch(/focus-visible:ring-3 focus-visible:ring-focus/)
      expect(link.className).toContain('@max-3xl:rounded-full')
      const pill = link.querySelector<HTMLElement>('[data-slot="club-section-pill"]')!
      for (const part of ['@max-3xl:min-h-8', '@max-3xl:rounded-full', '@max-3xl:border', '@max-3xl:border-field', '@max-3xl:px-3']) expect(pill.className, part).toContain(part)
    }
    // The pills stand 6 pixels apart, as the phone board sets them; the page is the container the row measures.
    expect(nav(page).querySelector('ul')!.className).toContain('@max-3xl:gap-1.5')
    expect(page.className).toMatch(/@container/)
  })

  it('scrolls sideways inside itself, with room at both ends for the focus ring, while nothing else on the page is wider than it', () => {
    const page = draw()
    const row = nav(page).querySelector<HTMLElement>('[data-slot="club-section-row"]')!
    expect(row.className).toMatch(/\boverflow-x-auto\b/)
    expect(row.className).toMatch(/\bpx-4\b/)
    const list = row.querySelector('ul')!
    expect(list.className).toMatch(/\bw-max\b/)
    expect(list.className).toMatch(/\bmin-w-full\b/)
    expect(list.className).toMatch(/\bpy-1\b/)
    for (const li of list.querySelectorAll('li')) expect(li.className).toMatch(/\bshrink-0\b/)
    // Only the row scrolls: the nav and the page itself set no sideways scroll, and the long words of the new blocks may break.
    expect(nav(page).className).not.toMatch(/overflow-x/)
    expect(page.className).not.toMatch(/overflow-x|w-max|min-w-/)
    for (const selector of ['#events h3', '#news h3', '[data-slot="nearby-clubs"] li p', '[data-slot="club-foot"] p']) {
      expect(page.querySelector(selector)!.className, selector).toMatch(/break-words/)
    }
    expect(page.querySelector('[data-slot="club-foot"] p span')!.className).toMatch(/break-all/)
  })

  it('keeps step 21\'s three states with four links: static in the reflow fallback, under the new chrome\'s bar, and under today\'s 65 pixel header', () => {
    expect(nav(draw()).className).toContain('sticky top-[var(--header-h,0px)]')
    cleanup()
    flags.newNav = false
    expect(nav(draw(restAnswer(), false)).className).toContain('sticky top-[var(--header-h,4.0625rem)]')
    cleanup()
    // A phone on its side, 667 by 375: the reflow query answers yes, the row scrolls with the page and the dock is not drawn.
    for (const newNav of [true, false]) {
      flags.newNav = newNav
      vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === REFLOW_QUERY, media: query, addEventListener: () => {}, removeEventListener: () => {} }))
      const className = nav(draw(restAnswer(), newNav)).className
      expect(className).toMatch(/\bstatic\b/)
      expect(className).not.toMatch(/\bsticky\b|\btop-/)
      expect(document.querySelector('[data-slot="club-bar"]')).toBeNull()
      cleanup()
    }
  })

  it('takes no more room than the page keeps above a control the keyboard brings into view', () => {
    // The pill row is as tall as the row it replaces: a 44 pixel link, the list's padding and the border under it.
    const navHeight = 44 + 4 + 4 + 1
    const room = /scroll-mt-\[calc\((\d+(?:\.\d+)?)rem/.exec(CLEAR_OF_BARS)
    expect(Number(room![1]) * 16).toBeGreaterThanOrEqual(navHeight)
    const page = draw()
    for (const selector of ['#events', '#news']) expect(page.querySelector(selector)!.className, selector).toContain('scroll-mt-')
  })

  it('keeps the cover at 200 pixels on a phone and 260 wide', () => {
    const page = draw()
    expect(page.querySelector('[aria-hidden="true"][style]')!.className).toContain('h-[200px] @3xl:h-[260px]')
  })
})

describe('the club bar', () => {
  it('holds Directions alone, to the club\'s first place with a point, as a bar of kind action in the dock, with Directions still in When and where', async () => {
    const page = draw()
    await act(async () => {})
    const bar = dockAction()!.querySelector<HTMLElement>('[data-slot="club-bar"]')!
    expect(bar).not.toBeNull()
    const links = within(bar).getAllByRole('link')
    expect(links.map((a) => [a.textContent, a.getAttribute('aria-label'), a.getAttribute('href'), a.getAttribute('target')])).toEqual([
      ['Directions', 'Directions to Example Library (opens in a new tab)', 'https://www.google.com/maps/dir/?api=1&destination=30.1,-91.2', '_blank'],
    ])
    expect(links[0].className).toMatch(/\bmin-h-11\b/)
    expect(links[0].className).toMatch(/focus-visible:ring-3 focus-visible:ring-focus/)
    expect(within(bar).queryByText(/Message the club/)).toBeNull()
    expect(page.contains(bar)).toBe(false)
    expect(within(page.querySelector<HTMLElement>('#when-and-where')!).getByRole('link', { name: 'Directions to Example Library (opens in a new tab)' })).toBeTruthy()
  })

  it('is not drawn, and leaves no empty bar, for a club with no place that has a point', async () => {
    const answer = restAnswer()
    draw({ ...answer, places: answer.places.map((p) => ({ ...p, latitude: null, longitude: null })) })
    await act(async () => {})
    expect(document.querySelector('[data-slot="club-bar"]')).toBeNull()
    expect(dockAction()!.children).toHaveLength(0)
  })

  it('is not drawn where there is no dock: with the chrome off, and from 768 pixels up', async () => {
    flags.newNav = false
    draw(restAnswer(), false)
    await act(async () => {})
    expect(document.querySelector('[data-slot="club-bar"], [data-slot="bottom-dock"]')).toBeNull()
    cleanup()
    flags.newNav = true
    stubWindow({ width: 1024, height: 800 })
    draw()
    await act(async () => {})
    expect(document.querySelector('[data-slot="club-bar"], [data-slot="bottom-dock"]')).toBeNull()
  })

  it('leaves a focused control clear of the dock, by the room the dock already keeps at the page\'s foot', async () => {
    draw()
    await act(async () => {})
    // The dock, bar and all, writes its height on the page's root, and the new look keeps that much room in its scroll padding.
    expect(document.documentElement.style.getPropertyValue('--bottom-chrome-h')).toMatch(/^\d+px$/)
    expect(document.querySelector('[data-slot="bottom-dock"]')!.contains(document.querySelector('[data-slot="club-bar"]'))).toBe(true)
    expect(read('src/index.css')).toContain('scroll-padding-bottom: var(--bottom-chrome-h, 0px);')
  })
})
