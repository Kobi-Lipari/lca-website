// @vitest-environment jsdom
//
// The homepage hero with newLook on and off (WS01 step 29; acceptance
// criterion 4: nothing on the site moves on by itself).
//
// - With newLook on the hero is one still picture. HeroSlideshow is not
//   drawn, so the page starts no timer at all, and after 60 seconds of fake
//   time the hero is the same to the attribute. The picture is slide 1 as a
//   <picture>, its AVIF and WebP files at 640, 1024 and 1600 pixels, the
//   photo's own shape (2048 by 1237) as its width and height, fetched first
//   and never lazy, with the JPEG today's first slide shows as the img's own
//   src for a browser that shows neither format, under the slide's
//   darkening, tint, gradient and label;
//   the words, the two buttons and the three figures are today's, in the one
//   element marked data-ground="dark", with no slide control. Put today's
//   track of slides and its controls back in place of the still picture and
//   the hero is today's.
// - With newLook off the hero is today's slideshow to the attribute: the
//   literals in test/unit/fixtures/home-hero-today.ts, rendered from the file
//   before the step changed it, as the page opens, after 5 seconds (the
//   second slide) and after 25 (the first again); a dot shows its slide and
//   starts the 5 seconds again, as today.
//
// The switch is flipped inside this one file, through a getter on the mocked
// FEATURES, so both sides are drawn from the same code. The page's two lists
// are answered with empty ones and the Facebook band is left out: only the
// hero is read here.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import { HERO_TODAY, HERO_TODAY_AFTER_5S, markup } from './fixtures/home-hero-today'

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
// The Facebook band fetches from the server; the hero is what is read here.
vi.mock('@/components/FacebookFeed', () => ({ FacebookFeed: () => null }))

const { HomePage } = await import('@/pages/HomePage')

/** A visitor who is not signed in. */
const SIGNED_OUT = { user: null, member: null, session: null, role: 'member', loading: false } as unknown as AuthContextValue

/** The darkening the slideshow gives each photo, which the still picture keeps. */
const SHADE = 'filter: grayscale(35%) brightness(0.55) contrast(1.05); transform: scale(1.04);'
const FILES = '/src/assets/generated/LCA_Slide_1'
/** Slide 1's photo as the repository holds it, which today's slideshow draws. */
const SLIDE_1 = '/src/assets/LCA_Slide_1.jpg'
const srcset = (format: string) => [640, 1024, 1600].map((w) => `${FILES}-${w}.${format} ${w}w`).join(', ')

/** Today's hero, parsed from the fixture, to take parts of. */
function today(literal = HERO_TODAY): HTMLElement {
  const holder = document.createElement('div')
  holder.innerHTML = markup(literal)
  return holder.firstElementChild as HTMLElement
}

/** Draws the page with newLook on or off and lets its two list requests settle. */
async function drawHome(newLook: boolean) {
  flags.newLook = newLook
  const view = render(
    <AuthContext.Provider value={SIGNED_OUT}>
      <MemoryRouter initialEntries={['/']}>
        <HomePage />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  await act(async () => {})
  const hero = () => view.container.querySelector('[data-ground="dark"]') as HTMLElement
  return { ...view, hero }
}

/** Moves the fake clock on, inside act so the page draws what it changes. */
async function wait(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const body = String(url).startsWith('/api/clearinghouse') ? { tournaments: [] } : []
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }))
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  flags.newLook = false
})

describe('the homepage hero with newLook on: one still picture, nothing on a timer', () => {
  it('draws no slideshow and starts no timer, so after 60 seconds the hero is the same to the attribute', async () => {
    const interval = vi.spyOn(globalThis, 'setInterval')
    const timeout = vi.spyOn(globalThis, 'setTimeout')
    const { container, hero } = await drawHome(true)
    expect(container.querySelectorAll('[data-ground="dark"]')).toHaveLength(1)
    expect(interval).not.toHaveBeenCalled()
    expect(timeout).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
    const before = hero().outerHTML
    await wait(60_000)
    expect(hero().outerHTML).toBe(before)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('has no slide control, no track that moves and no slide but the first', async () => {
    const { hero } = await drawHome(true)
    expect(screen.queryByRole('button', { name: /slide/i })).toBeNull()
    expect(hero().querySelectorAll('button')).toHaveLength(0)
    expect(hero().querySelector('[style*="translateX"]')).toBeNull()
    expect(hero().querySelector('[style*="background-image"]')).toBeNull()
    expect(hero().querySelectorAll('img')).toHaveLength(1)
    expect(hero().textContent).toContain('Louisiana Chess Community')
    for (const label of ['Club tournaments across the state', 'Scholastic chess in Louisiana', 'Players across the Pelican State', 'Chess for every generation']) {
      expect(hero().textContent, label).not.toContain(label)
    }
  })

  it('draws slide 1 as a picture: AVIF and WebP at three widths, its own shape, fetched first, its JPEG the fallback, and decoration', async () => {
    const { hero } = await drawHome(true)
    const picture = hero().querySelector(':scope > picture') as HTMLElement
    expect(picture).not.toBeNull()
    const sources = [...picture.querySelectorAll('source')].map((s) => ({ type: s.getAttribute('type'), srcset: s.getAttribute('srcset'), sizes: s.getAttribute('sizes') }))
    expect(sources).toEqual([
      { type: 'image/avif', srcset: srcset('avif'), sizes: '(max-width: 695px) 696px, 100vw' },
      { type: 'image/webp', srcset: srcset('webp'), sizes: '(max-width: 695px) 696px, 100vw' },
    ])
    const img = picture.querySelector('img') as HTMLImageElement
    // The photo's own shape, which test/unit/image-budget.test.ts reads from LCA_Slide_1.jpg's header.
    expect([img.getAttribute('width'), img.getAttribute('height')]).toEqual(['2048', '1237'])
    expect(img.getAttribute('fetchpriority')).toBe('high')
    expect(img.getAttribute('loading')).toBe('eager')
    expect(img.getAttribute('alt')).toBe('')
    // Its own src, which only a browser that can show neither AVIF nor WebP takes, is slide 1's JPEG, the photo today's first slide shows.
    const photo = today().children[0].children[0].children[0]
    expect(photo.getAttribute('style')).toContain(`url("${SLIDE_1}")`)
    expect(img.getAttribute('src')).toBe(SLIDE_1)
    expect(img.hasAttribute('srcset')).toBe(false)
    expect(img.getAttribute('class')).toBe('absolute inset-0 h-full w-full object-cover')
    expect(img.getAttribute('style')).toBe(SHADE)
  })

  it('keeps slide 1\'s tint, gradient and label over the picture, and today\'s words, buttons and figures over them', async () => {
    const { hero } = await drawHome(true)
    const was = today()
    const [track, words] = [was.children[0], was.children[1]]
    const slide1 = track.children[0]
    const still = [...hero().children]
    expect(still.map((el) => el.tagName.toLowerCase())).toEqual(['picture', 'div', 'div', 'div', 'div'])
    // Slide 1's photo layer was its first child; the tint, the gradient and the label follow it, as here.
    expect(slide1.children[0].getAttribute('style')).toContain(SHADE)
    for (let i = 1; i <= 3; i++) expect(still[i].outerHTML, `layer ${i}`).toBe(slide1.children[i].outerHTML)
    expect(still[1].className).toBe('absolute inset-0 bg-brand-navy/55 mix-blend-multiply')
    expect(still[4].outerHTML).toBe(words.outerHTML)
    expect(screen.getByRole('heading', { level: 1, name: 'Play. Compete. Connect.' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Find a tournament' }).getAttribute('href')).toBe('/tournaments')
    expect(hero().textContent).toContain('300+')
  })

  it('is today\'s hero once today\'s track and controls are put back in place of the still picture', async () => {
    const { hero } = await drawHome(true)
    const was = today()
    const copy = hero().cloneNode(true) as HTMLElement
    for (const el of [...copy.children].slice(0, 4)) el.remove()
    copy.prepend(was.children[0].cloneNode(true))
    copy.append(was.children[2].cloneNode(true))
    expect(copy.outerHTML).toBe(markup(HERO_TODAY))
  })
})

describe('the homepage hero with newLook off: today\'s slideshow', () => {
  it('draws today\'s hero to the attribute as the page opens', async () => {
    const { hero } = await drawHome(false)
    expect(hero().outerHTML).toBe(markup(HERO_TODAY))
  })

  it('moves on to the second slide after 5 seconds and back to the first after 25, as today', async () => {
    const { hero } = await drawHome(false)
    expect(vi.getTimerCount()).toBe(1)
    await wait(4_999)
    expect(hero().outerHTML).toBe(markup(HERO_TODAY))
    await wait(1)
    expect(hero().outerHTML).toBe(markup(HERO_TODAY_AFTER_5S))
    await wait(20_000)
    expect(hero().outerHTML).toBe(markup(HERO_TODAY))
  })

  it('shows the slide a dot names and starts the 5 seconds again, as today', async () => {
    const { hero } = await drawHome(false)
    await wait(3_000)
    fireEvent.click(screen.getByRole('button', { name: 'Slide 3' }))
    const track = () => hero().firstElementChild as HTMLElement
    expect(track().style.transform).toBe('translateX(-200%)')
    await wait(4_999)
    expect(track().style.transform).toBe('translateX(-200%)')
    await wait(1)
    expect(track().style.transform).toBe('translateX(-300%)')
    fireEvent.click(screen.getByRole('button', { name: 'Previous slide' }))
    expect(track().style.transform).toBe('translateX(-200%)')
    expect(vi.getTimerCount()).toBe(1)
  })
})
