// @vitest-environment jsdom
//
// The chrome's boundary brings its notice into view (src/components/layout/
// OnDemand.tsx, WS02 step 9) once each time the notice shows, and at no
// other time: here the boundary alone, with a loader handed in, and a stand
// in for scrollIntoView, which jsdom does not have.
//
// - a part that loads draws no notice and moves the page not at all;
// - the notice drawn again with new words, for the same ask, is not brought
//   into view again, and putting it away moves nothing;
// - a new ask that fails again brings the notice into view again, once;
// - each failure is told on the console in the chrome's words, once.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { lazy, type ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { OnDemand } = await import('@/components/layout/OnDemand')

const NOTICE = 'The menu could not be loaded. Reload the page to try again.'

/** Each element scrollIntoView was called on, with what it was given. */
let scrolled: Array<{ el: Element; options: unknown }> = []
let logged: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  scrolled = []
  Element.prototype.scrollIntoView = function (this: Element, options?: unknown) {
    scrolled.push({ el: this, options })
  }
  logged = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView
  vi.restoreAllMocks()
})

/** The boundary's own lines on the console. */
const ownLines = () => logged.mock.calls.filter((call: unknown[]) => call[0] === 'A part of the chrome could not be loaded:')

describe('the boundary brings its notice into view once each time it shows, and at no other time', () => {
  it('moves the page not at all for a part that loads', async () => {
    const Part = lazy(async () => ({ default: () => <p>The part</p> }))
    render(
      <OnDemand notice={NOTICE} onFailed={() => {}} tries={1}>
        <Part />
      </OnDemand>,
    )
    expect(await screen.findByText('The part')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(scrolled).toEqual([])
    expect(ownLines()).toEqual([])
  })

  it('does not bring the notice into view again when it is drawn again for the same ask, nor when it is put away', async () => {
    const Gone = lazy((): Promise<{ default: () => ReactElement }> => Promise.reject(new TypeError('Failed to fetch dynamically imported module: /assets/Gone.js')))
    const boundary = (words: string) => (
      <OnDemand notice={words} onFailed={() => {}} tries={1}>
        <Gone />
      </OnDemand>
    )
    const { rerender } = render(boundary(NOTICE))
    const notice = await screen.findByRole('alert')
    expect(scrolled).toEqual([{ el: notice, options: { block: 'nearest' } }])
    rerender(boundary('The donation form could not be loaded. Reload the page to try again.'))
    expect(screen.getByRole('alert').textContent).toContain('The donation form could not be loaded.')
    expect(scrolled).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(scrolled).toHaveLength(1)
    expect(ownLines()).toHaveLength(1)
  })

  it('brings the notice into view again, once, for a new ask that fails again, and tells the console once each time in the chrome\'s words', async () => {
    const Gone = lazy((): Promise<{ default: () => ReactElement }> => Promise.reject(new TypeError('Failed to fetch dynamically imported module: /assets/Gone.js')))
    const failed = vi.fn()
    const boundary = (tries: number) => (
      <OnDemand notice={NOTICE} onFailed={failed} tries={tries}>
        <Gone />
      </OnDemand>
    )
    const { rerender } = render(boundary(1))
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    act(() => rerender(boundary(2)))
    const again = await screen.findByRole('alert')
    expect(scrolled).toHaveLength(2)
    expect(scrolled[1]).toEqual({ el: again, options: { block: 'nearest' } })
    expect(failed).toHaveBeenCalledTimes(2)
    expect(ownLines()).toHaveLength(2)
    expect(logged.mock.calls.filter((call: unknown[]) => String(call[0]).includes('header'))).toEqual([])
  })
})
