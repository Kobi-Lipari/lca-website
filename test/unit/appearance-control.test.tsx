// @vitest-environment jsdom
//
// The Appearance control and the page's light and dark state with newLook on
// (WS01 step 21, acceptance criterion 7): it follows the device setting by
// default, can be set to Light or Dark, keeps the choice in this browser,
// marks the pressed option in words, sits in the footer, and a localStorage
// that throws neither breaks the page nor changes what the device says.
// With newLook off see appearance-control-off.test.tsx.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { APPEARANCE_KEY } from '@/lib/colorScheme'

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

  it('stops following the device once the page stops it', () => {
    expect(device.listeners.size).toBeGreaterThan(0)
    stop()
    expect(device.listeners.size).toBe(0)
    stop = startColorScheme()
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
})
