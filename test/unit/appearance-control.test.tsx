// @vitest-environment jsdom
//
// The Appearance control and the page's light and dark state with newLook on
// (WS01 step 21, acceptance criterion 7): it follows the device setting by
// default, can be set to Light or Dark, keeps the choice in this browser,
// marks the pressed option in words, sits in the footer, and a localStorage
// that throws neither breaks the page nor changes what the device says.
// Since WS02 step 3 the page's own scheme is handed the page's head as well,
// so a pick of Light or Dark sets the browser bar's colour there
// (test/unit/theme-color.test.tsx holds the rest of that). Since WS02 step 4
// it also holds that in today's footer the control sits on the footer's own
// navy, with nothing between giving a ground or a ring of its own. Since
// WS02 step 6 the control takes a label id of its own (labelId), so the Menu
// sheet can draw it beside the footer's without one id twice on the page,
// and the ground it is drawn on (on): navy, the footer's and its default,
// with white words and lines, or light, the sheet's, with the sheet's ink.
// With newLook off see appearance-control-off.test.tsx.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { APPEARANCE_KEY, THEME_COLOR_ATTRIBUTE, THEME_COLOR_DARK, THEME_COLOR_LIGHT } from '@/lib/colorScheme'

vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return { ...real, FEATURES: { ...real.FEATURES, newLook: true } }
})

const { AppearanceControl } = await import('@/components/AppearanceControl')
const { Footer } = await import('@/components/layout/Footer')
const { startColorScheme } = await import('@/hooks/useColorScheme')

/** A prefers-color-scheme stand-in the test can flip. */
const device = (() => {
  let dark = false
  const listeners = new Set<() => void>()
  return {
    get dark() {
      return dark
    },
    set(next: boolean) {
      dark = next
      for (const l of listeners) l()
    },
    listeners,
    query: (q: string) => ({
      get matches() {
        return q === '(prefers-color-scheme: dark)' && dark
      },
      media: q,
      addEventListener: (_t: string, l: () => void) => void listeners.add(l),
      removeEventListener: (_t: string, l: () => void) => void listeners.delete(l),
    }),
  }
})()

const html = document.documentElement
const isDark = () => html.classList.contains('dark')
const group = () => screen.getByRole('group', { name: 'Appearance' })
const option = (name: string) => within(group()).getByRole('button', { name })
const pressed = () => within(group()).getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.textContent)

let stop = () => {}
beforeEach(() => {
  window.matchMedia = device.query as unknown as typeof window.matchMedia
  window.localStorage.clear()
  device.set(false)
  // The page's own state is one instance for the whole file; start each test from System.
  stop = startColorScheme()
  render(<AppearanceControl />)
  act(() => fireEvent.click(option('System')))
})
afterEach(() => {
  stop()
  cleanup()
  html.classList.remove('dark')
  vi.restoreAllMocks()
})

describe('the Appearance control', () => {
  it('is a labelled group of System, Light and Dark, with System pressed by default', () => {
    expect(within(group()).getAllByRole('button').map((b) => b.textContent)).toEqual(['System', 'Light', 'Dark'])
    expect(pressed()).toEqual(['System'])
    for (const b of within(group()).getAllByRole('button')) expect(b.getAttribute('type')).toBe('button')
  })

  it('follows the device setting by default, live as it changes', () => {
    expect(isDark()).toBe(false)
    act(() => device.set(true))
    expect(isDark()).toBe(true)
    expect(pressed()).toEqual(['System'])
    act(() => device.set(false))
    expect(isDark()).toBe(false)
  })

  it('Dark and Light override the device and are kept in this browser', () => {
    act(() => fireEvent.click(option('Dark')))
    expect(isDark()).toBe(true)
    expect(pressed()).toEqual(['Dark'])
    expect(window.localStorage.getItem(APPEARANCE_KEY)).toBe('dark')
    act(() => device.set(true))
    act(() => fireEvent.click(option('Light')))
    expect(isDark()).toBe(false)
    expect(pressed()).toEqual(['Light'])
    expect(window.localStorage.getItem(APPEARANCE_KEY)).toBe('light')
    // The device flipping back and forth leaves a chosen Light alone.
    act(() => device.set(false))
    act(() => device.set(true))
    expect(isDark()).toBe(false)
  })

  it('System removes the stored choice and hands the page back to the device', () => {
    act(() => fireEvent.click(option('Light')))
    act(() => device.set(true))
    expect(isDark()).toBe(false)
    act(() => fireEvent.click(option('System')))
    expect(window.localStorage.getItem(APPEARANCE_KEY)).toBeNull()
    expect(isDark()).toBe(true)
  })

  it('a second control on the page shows the same choice', () => {
    render(<AppearanceControl />)
    const groups = screen.getAllByRole('group', { name: 'Appearance' })
    expect(groups).toHaveLength(2)
    act(() => fireEvent.click(within(groups[0]).getByRole('button', { name: 'Dark' })))
    expect(within(groups[1]).getByRole('button', { name: 'Dark' }).getAttribute('aria-pressed')).toBe('true')
    expect(within(groups[1]).getByRole('button', { name: 'System' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('a localStorage that throws leaves the page on the device setting and a choice still applies for the visit', () => {
    const blocked = () => {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    }
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(blocked)
    act(() => device.set(true))
    expect(isDark()).toBe(true)
    expect(pressed()).toEqual(['System'])
    expect(() => act(() => fireEvent.click(option('Light')))).not.toThrow()
    expect(isDark()).toBe(false)
    expect(pressed()).toEqual(['Light'])
    expect(() => act(() => fireEvent.click(option('System')))).not.toThrow()
    expect(isDark()).toBe(true)
  })

  it('a pick of Light or Dark gives the page\'s head that look\'s browser bar colour, first in it, and System takes it away', () => {
    const own = () => [...document.head.querySelectorAll(`meta[name="theme-color"][${THEME_COLOR_ATTRIBUTE}]`)]
    expect(own()).toEqual([])
    act(() => fireEvent.click(option('Dark')))
    expect(own().map((m) => m.getAttribute('content'))).toEqual([THEME_COLOR_DARK])
    expect(document.head.firstElementChild).toBe(own()[0])
    act(() => fireEvent.click(option('Light')))
    expect(own().map((m) => m.getAttribute('content'))).toEqual([THEME_COLOR_LIGHT])
    act(() => fireEvent.click(option('System')))
    expect(own()).toEqual([])
  })

  it('stops following the device once the page stops it', () => {
    expect(device.listeners.size).toBeGreaterThan(0)
    stop()
    expect(device.listeners.size).toBe(0)
    stop = startColorScheme()
  })
})

describe('its label id and its ground (WS02 step 6)', () => {
  it('names its group by appearance-label unless given an id of its own, so two controls never share one id', () => {
    render(<AppearanceControl labelId="fx-sheet-appearance" on="light" />)
    const groups = screen.getAllByRole('group', { name: 'Appearance' })
    expect(groups).toHaveLength(2)
    expect(groups.map((g) => g.getAttribute('aria-labelledby'))).toEqual(['appearance-label', 'fx-sheet-appearance'])
    expect(document.querySelectorAll('[id="appearance-label"]')).toHaveLength(1)
    expect(document.querySelectorAll('[id="fx-sheet-appearance"]')).toHaveLength(1)
    for (const group of groups) {
      const label = document.getElementById(group.getAttribute('aria-labelledby')!)!
      expect(label.textContent).toBe('Appearance')
      // The label sits just before the group, in the same control.
      expect(label.nextElementSibling).toBe(group)
    }
  })

  it('on navy, its default, draws white words and lines; on light, none, the pressed option marked by the sheet\'s ink line, its muted fill and its weight, 44 pixels high', () => {
    render(<AppearanceControl labelId="fx-sheet-appearance" on="light" />)
    const [navy, light] = screen.getAllByRole('group', { name: 'Appearance' })
    const classes = (el: Element) => (el.getAttribute('class') ?? '').split(/\s+/)
    expect(classes(document.getElementById('appearance-label')!)).toContain('text-white/70')
    for (const button of within(navy).getAllByRole('button')) expect(classes(button).some((c) => c.includes('white'))).toBe(true)
    const lightLabel = document.getElementById('fx-sheet-appearance')!
    expect(classes(lightLabel)).toEqual(expect.arrayContaining(['text-sm', 'font-semibold']))
    expect(classes(lightLabel).some((c) => c.includes('white'))).toBe(false)
    for (const button of within(light).getAllByRole('button')) {
      const own = classes(button)
      expect(own.some((c) => c.includes('white')), button.textContent ?? '').toBe(false)
      expect(own, button.textContent ?? '').toContain('h-11')
      expect(own, button.textContent ?? '').not.toContain('h-8')
      const isPressed = button.getAttribute('aria-pressed') === 'true'
      expect(own.includes('border-ink'), button.textContent ?? '').toBe(isPressed)
      expect(own.includes('bg-muted'), button.textContent ?? '').toBe(isPressed)
      expect(own.includes('font-semibold'), button.textContent ?? '').toBe(isPressed)
      expect(own.includes('border-hairline'), button.textContent ?? '').toBe(!isPressed)
    }
  })

  it('shows a pick made in one in the other, whatever ground each is drawn on', () => {
    render(<AppearanceControl labelId="fx-sheet-appearance" on="light" />)
    const [navy, light] = screen.getAllByRole('group', { name: 'Appearance' })
    act(() => fireEvent.click(within(light).getByRole('button', { name: 'Dark' })))
    expect(within(navy).getByRole('button', { name: 'Dark' }).getAttribute('aria-pressed')).toBe('true')
    expect(isDark()).toBe(true)
    act(() => fireEvent.click(within(navy).getByRole('button', { name: 'Light' })))
    expect(within(light).getByRole('button', { name: 'Light' }).getAttribute('aria-pressed')).toBe('true')
    expect(isDark()).toBe(false)
  })
})

describe('the footer under newLook', () => {
  it('carries the control beside the copyright line, once', () => {
    cleanup()
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    )
    const footer = screen.getByRole('contentinfo')
    expect(within(footer).getAllByRole('group', { name: 'Appearance' })).toHaveLength(1)
    expect(within(footer).getByText(/All rights reserved/)).toBeTruthy()
    expect(within(footer).getByText(/Louisiana Chess Association/, { selector: 'p' })).toBeTruthy()
  })

  it('sits on the footer\'s own navy, with nothing between giving a ground or a ring of its own, so the navy band rule rings it gold', () => {
    cleanup()
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    )
    const footer = screen.getByRole('contentinfo')
    const group = within(footer).getByRole('group', { name: 'Appearance' })
    // The footer is the navy band whose rule in src/index.css gives a control inside it the gold ring.
    expect(footer.getAttribute('class')!.split(' ')).toContain('bg-brand-navy')
    // From the group up to the footer, and on each of its buttons, nothing paints a ground or sets a ring of its own.
    const between: Element[] = []
    for (let el = group.parentElement; el && el !== footer; el = el.parentElement) between.push(el)
    expect(between.length).toBeGreaterThan(0)
    for (const el of [group, ...between]) {
      expect(el.getAttribute('class') ?? '', el.tagName).not.toMatch(/(?:^|\s)(?:[\w-]+:)*bg-/)
      expect(el.hasAttribute('data-ground'), el.tagName).toBe(false)
      expect(el.hasAttribute('data-ring-ground'), el.tagName).toBe(false)
    }
    const buttons = within(group).getAllByRole('button')
    expect(buttons).toHaveLength(3)
    for (const button of buttons) {
      expect(button.getAttribute('class') ?? '').not.toMatch(/(?:^|\s)(?:[\w-]+:)*bg-popover\b/)
      expect(button.hasAttribute('data-ground') || button.hasAttribute('data-ring-ground')).toBe(false)
    }
  })
})
