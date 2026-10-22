// @vitest-environment jsdom
//
// With newLook off the Appearance work leaves the page exactly as it is today
// (WS01 step 21, acceptance criteria 2 and 3): the footer shows no control and
// keeps its empty line, and the colour scheme code never adds .dark or
// data-look, never follows the device setting, even when Dark is stored and
// the device is dark, so the stock shadcn dark block stays asleep.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { APPEARANCE_KEY } from '@/lib/colorScheme'
import { FEATURES } from '@/lib/features'

const { AppearanceControl } = await import('@/components/AppearanceControl')
const { Footer } = await import('@/components/layout/Footer')
const { startColorScheme } = await import('@/hooks/useColorScheme')

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  document.documentElement.className = ''
  document.documentElement.removeAttribute('data-look')
})

describe('newLook off', () => {
  it('is the starting state of the switch', () => {
    expect(FEATURES.newLook).toBe(false)
  })

  it('the footer has no Appearance control and keeps its empty bottom line', () => {
    const { container } = render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    )
    expect(screen.queryByRole('group', { name: 'Appearance' })).toBeNull()
    expect(screen.queryByText('Appearance')).toBeNull()
    const bottom = screen.getByText(/All rights reserved/).parentElement!
    expect(bottom.querySelectorAll('p')).toHaveLength(2)
    expect(bottom.querySelectorAll('p')[1].textContent?.trim()).toBe('')
    expect(container.querySelector('[aria-pressed]')).toBeNull()
  })

  it('a dark device with Dark stored adds no .dark and no data-look, and no device listener is made', () => {
    const addEventListener = vi.fn()
    window.matchMedia = ((q: string) => ({ matches: true, media: q, addEventListener, removeEventListener: vi.fn() })) as unknown as typeof window.matchMedia
    window.localStorage.setItem(APPEARANCE_KEY, 'dark')
    const stop = startColorScheme()
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.hasAttribute('data-look')).toBe(false)
    expect(addEventListener).not.toHaveBeenCalled()
    stop()
  })

  it('choosing Dark in a control that is somehow rendered still never wakes the stock dark block', () => {
    window.matchMedia = ((q: string) => ({ matches: true, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() })) as unknown as typeof window.matchMedia
    render(<AppearanceControl />)
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Dark' })))
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.hasAttribute('data-look')).toBe(false)
  })
})
