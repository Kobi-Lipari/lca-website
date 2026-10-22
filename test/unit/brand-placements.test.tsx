// @vitest-environment jsdom
//
// The header, the footer and /about with newLook off and on, side by side
// (WS01 step 28): the three places that exist today of those decision D1
// gives the rook mark or the official logo.
//
// - With newLook off each draws today's markup to the attribute: the
//   literals in test/unit/fixtures/brand-today.ts, rendered from the three
//   files before the step changed them. Nothing a visitor sees changes until
//   the switch is turned on.
// - With newLook on the header's brand link holds the rook mark (LcaMark) and
//   no image: the favicon's path, 28px on a phone and 30px wider, in the
//   header's white with no colour of its own (a colour set on the mark would
//   outlast a contrast theme's change of ground), hidden from screen
//   readers, so the link is named once, by its words. Put today's image back
//   in the mark's place and the header is today's.
// - With newLook on the footer draws the official logo (LcaLogo) at 56px,
//   with empty words since the name stands beside it, straight on the navy
//   with no plate. Put today's image back, and today's empty line in place
//   of step 21's Appearance control, and the footer is today's.
// - With newLook on /about draws the official logo at 160px with its name,
//   in a frame on the surface (data-slot lca-logo-mat) and no white ground of
//   its own, before the "Who we are" block. Take the frame out and the page
//   is today's.
//
// The switch is flipped inside this one file, through a getter on the mocked
// FEATURES, so both sides are drawn from the same code. The clock is held at
// Wed, Oct 21, 2026, for the footer's year.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, render, screen, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import lcaLogo from '@/assets/lca-logo.webp'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import { ABOUT_TODAY, FOOTER_TODAY, NAVBAR_TODAY, markup } from './fixtures/brand-today'

const flags = vi.hoisted(() => ({ newLook: false }))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return {
    ...real,
    FEATURES: {
      ...real.FEATURES,
      get newLook() {
        return flags.newLook
      },
    },
  }
})
vi.mock('@/lib/supabase', () => ({ supabase: {} }))

const { Navbar } = await import('@/components/layout/Navbar')
const { Footer } = await import('@/components/layout/Footer')
const { AboutPage } = await import('@/pages/AboutPage')

const ROOT = join(__dirname, '../..')
const NAME = 'Louisiana Chess Association'
const ROOK = readFileSync(join(ROOT, 'public/favicon.svg'), 'utf8').match(/<path[^>]* d="([^"]+)"/)?.[1]

/** A visitor who is not signed in, as the header sees one. */
const SIGNED_OUT = {
  user: null, session: null, member: null, role: 'member', seats: [], managedClubs: [], isBoardMember: false,
  assuranceLevel: null, mfaRequired: false, loading: false, directedTournamentIds: [], signOut: async () => {},
} as unknown as AuthContextValue

const PLACES = {
  header: {
    today: NAVBAR_TODAY,
    draw: (): ReactElement => <AuthContext.Provider value={SIGNED_OUT}><MemoryRouter initialEntries={['/']}><Navbar /></MemoryRouter></AuthContext.Provider>,
  },
  footer: { today: FOOTER_TODAY, draw: (): ReactElement => <MemoryRouter initialEntries={['/']}><Footer /></MemoryRouter> },
  about: { today: ABOUT_TODAY, draw: (): ReactElement => <MemoryRouter initialEntries={['/about']}><AboutPage /></MemoryRouter> },
} as const
type Place = keyof typeof PLACES

/** A place drawn with newLook off or on, copied out of the document. */
function drawn(place: Place, newLook: boolean): HTMLElement {
  flags.newLook = newLook
  const { container } = render(PLACES[place].draw())
  const copy = container.cloneNode(true) as HTMLElement
  cleanup()
  return copy
}

/** Today's markup of a place, as an element to take parts from. */
function today(place: Place): HTMLElement {
  const holder = document.createElement('div')
  holder.innerHTML = markup(PLACES[place].today)
  return holder
}

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-21T12:00:00-05:00'))
})
afterAll(() => {
  vi.useRealTimers()
})
afterEach(() => {
  cleanup()
  flags.newLook = false
})

describe('newLook off: today\'s markup, to the attribute', () => {
  it('is the starting state of the switch', async () => {
    const real = await vi.importActual<typeof import('@/lib/features')>('@/lib/features')
    expect(real.FEATURES.newLook).toBe(false)
  })

  it.each(Object.keys(PLACES) as Place[])('the %s draws today\'s markup', (place) => {
    expect(drawn(place, false).innerHTML).toBe(markup(PLACES[place].today))
  })

  it('today\'s header and footer draw the logo image, and today\'s /about no logo', () => {
    const header = drawn('header', false)
    expect(header.querySelectorAll('img')).toHaveLength(1)
    expect(header.querySelector('[data-slot="lca-mark"]')).toBeNull()
    const footer = drawn('footer', false)
    expect(footer.querySelectorAll('img')).toHaveLength(1)
    expect(footer.querySelector('[data-slot="lca-logo"]')).toBeNull()
    const about = drawn('about', false)
    expect(about.querySelector('img, [data-slot="lca-logo-mat"]')).toBeNull()
    for (const side of [header, footer]) expect(side.querySelector('img')?.getAttribute('src')).toBe(lcaLogo)
  })
})

describe('newLook on: the rook mark in the header', () => {
  it('the brand link holds one mark and the header no image; put today\'s image back and the header is today\'s', () => {
    const on = drawn('header', true)
    expect(on.querySelectorAll('img')).toHaveLength(0)
    const marks = on.querySelectorAll('[data-slot="lca-mark"]')
    expect(marks).toHaveLength(1)
    const link = marks[0].closest('a')!
    expect(link.getAttribute('href')).toBe('/')
    expect(link.firstElementChild).toBe(marks[0])
    marks[0].replaceWith(today('header').querySelector('a[href="/"] > img')!)
    expect(on.innerHTML).toBe(markup(NAVBAR_TODAY))
  })

  it('is the favicon\'s rook, 28px on a phone and 30px wider, in the header\'s white with no colour of its own, hidden from screen readers', () => {
    const mark = drawn('header', true).querySelector('[data-slot="lca-mark"]')!
    expect(mark.tagName.toLowerCase()).toBe('svg')
    expect(mark.querySelectorAll('path')).toHaveLength(1)
    expect(mark.querySelector('path')!.getAttribute('d')).toBe(ROOK)
    expect(mark.getAttribute('fill')).toBe('currentColor')
    // Its size and nothing else: a browser keeps a colour set on an SVG itself
    // in a contrast theme, which replaces the navy behind it. The mark takes
    // the header's white, and nothing between the two has a text class.
    expect(mark.getAttribute('class')).toBe('flex-none size-7 md:size-[30px]')
    const header = mark.closest('header')!
    expect(header.getAttribute('class')!.split(' ')).toEqual(expect.arrayContaining(['bg-brand-navy', 'text-white']))
    for (let el = mark.parentElement; el && el !== header; el = el.parentElement) expect(el.getAttribute('class') ?? '').not.toMatch(/(?:^|\s)(?:[\w-]+:)*text-/)
    expect(mark.getAttribute('aria-hidden')).toBe('true')
    expect(mark.hasAttribute('role')).toBe(false)
    expect(mark.querySelector('title')).toBeNull()
  })

  it('the brand link is named once, by its words; today it is named twice, by the image and the words', () => {
    flags.newLook = true
    render(PLACES.header.draw())
    const header = within(screen.getByRole('banner'))
    expect(header.getByRole('link', { name: NAME }).getAttribute('href')).toBe('/')
    expect(header.queryAllByRole('img')).toHaveLength(0)
    cleanup()
    flags.newLook = false
    render(PLACES.header.draw())
    expect(within(screen.getByRole('banner')).getByRole('link', { name: `${NAME} ${NAME}` }).getAttribute('href')).toBe('/')
  })
})

describe('newLook on: the official logo in the footer', () => {
  it('is LcaLogo at 56px with empty words, beside the name, on the navy with no plate; put today\'s image back and the footer is today\'s', () => {
    const on = drawn('footer', true)
    expect(on.querySelectorAll('img')).toHaveLength(1)
    const logos = on.querySelectorAll('[data-slot="lca-logo"]')
    expect(logos).toHaveLength(1)
    const logo = logos[0] as HTMLImageElement
    expect(logo.getAttribute('src')).toBe(lcaLogo)
    expect([logo.getAttribute('width'), logo.getAttribute('height')]).toEqual(['56', '56'])
    expect(logo.getAttribute('alt')).toBe('')
    expect(logo.getAttribute('class')).toBe('rounded-xl object-contain')
    // The name beside it, in words.
    expect(logo.nextElementSibling?.textContent).toContain(NAME)
    // No plate: nothing between the logo and the navy footer paints a ground.
    expect(logo.parentElement!.getAttribute('class')).toBe('flex items-center gap-3.5')
    for (let el = logo.parentElement; el && el.tagName !== 'FOOTER'; el = el.parentElement) expect(el.getAttribute('class') ?? '').not.toMatch(/(?:^|\s)bg-/)
    expect(logo.closest('footer')!.getAttribute('class')).toContain('bg-brand-navy')
    // Today's image back in the logo's place, and today's empty line back in
    // place of the Appearance control (step 21's, the footer's one other part
    // under the new look), and the footer is today's.
    const was = today('footer')
    logo.replaceWith(was.querySelector('footer img')!)
    const appearance = on.querySelector('[role="group"][aria-labelledby="appearance-label"]')!.parentElement!
    appearance.replaceWith(was.querySelector('footer p.text-white\\/40')!)
    expect(on.innerHTML).toBe(markup(FOOTER_TODAY))
  })

  it('is left out by a screen reader, which reads the name beside it once', () => {
    flags.newLook = true
    render(PLACES.footer.draw())
    const footer = within(screen.getByRole('contentinfo'))
    expect(footer.queryAllByRole('img')).toHaveLength(0)
    expect(footer.getAllByText(NAME)).toHaveLength(1)
  })
})

describe('newLook on: the official logo on /about', () => {
  it('is LcaLogo at 160px with its name, framed on the surface before "Who we are"; take the frame out and the page is today\'s', () => {
    const on = drawn('about', true)
    const mats = on.querySelectorAll('[data-slot="lca-logo-mat"]')
    expect(mats).toHaveLength(1)
    const mat = mats[0]
    const classes = (mat.getAttribute('class') ?? '').split(' ')
    for (const cls of ['w-fit', 'border', 'border-hairline', 'bg-surface', 'p-3']) expect(classes, cls).toContain(cls)
    // A frame in tokens, with no white ground of its own: the logo's file is white edge to edge.
    expect(classes.filter((c) => /^(?:[\w-]+:)*bg-white/.test(c))).toEqual([])
    expect(mat.children).toHaveLength(1)
    const logo = mat.firstElementChild as HTMLImageElement
    expect(logo.getAttribute('data-slot')).toBe('lca-logo')
    expect(logo.getAttribute('src')).toBe(lcaLogo)
    expect([logo.getAttribute('width'), logo.getAttribute('height')]).toEqual(['160', '160'])
    expect(logo.getAttribute('alt')).toBe(NAME)
    // The first thing in the page's words, just before the block "Who we are" heads.
    expect(mat.previousElementSibling).toBeNull()
    expect(mat.nextElementSibling?.querySelector('h2')?.textContent).toBe('Who we are')
    mat.remove()
    expect(on.innerHTML).toBe(markup(ABOUT_TODAY))
  })

  it('names the logo for a screen reader, after the page\'s heading', () => {
    flags.newLook = true
    render(PLACES.about.draw())
    const logo = screen.getByRole('img', { name: NAME })
    const heading = screen.getByRole('heading', { level: 1, name: 'About LCA' })
    expect(heading.compareDocumentPosition(logo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
