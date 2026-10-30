// @vitest-environment jsdom
//
// src/hooks/useWideScreen.ts, the answer Navbar draws the new header by:
// whether the window is 1024 pixels wide or wider, read from the browser's
// own media query and followed as it changes.
//
// - with no matchMedia (as in the unit tests that draw the whole app), it
//   answers false;
// - it asks exactly the 1024-pixel query, and answers what the browser
//   says;
// - when the browser says the answer changed, the part that asked is drawn
//   again with the new answer, and when that part goes, so does its
//   listener, the same one it added;
// - drawn to a string, as a server would, it answers false whatever the
//   browser would say, so nothing can draw the new header before the page
//   has asked.
import { act, cleanup, render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WIDE_QUERY, useWideScreen } from '@/hooks/useWideScreen'

function Answer() {
  return <output data-testid="answer">{useWideScreen() ? 'wide' : 'narrow'}</output>
}

const answer = () => screen.getByTestId('answer').textContent

/** A stand-in for the browser's media query that records what was asked and who listens. */
function stubMatchMedia(wide: boolean) {
  const state = { wide, asked: [] as string[], added: [] as unknown[], removed: [] as unknown[] }
  const listeners = new Set<() => void>()
  vi.stubGlobal('matchMedia', (query: string) => {
    state.asked.push(query)
    return {
      get matches() {
        return state.wide
      },
      media: query,
      addEventListener: (type: string, listener: () => void) => {
        if (type === 'change') listeners.add(listener)
        state.added.push(listener)
      },
      removeEventListener: (type: string, listener: () => void) => {
        if (type === 'change') listeners.delete(listener)
        state.removed.push(listener)
      },
    }
  })
  const change = (next: boolean) => {
    state.wide = next
    act(() => listeners.forEach((listener) => listener()))
  }
  return { state, change, listening: () => listeners.size }
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('useWideScreen', () => {
  it('answers false with no matchMedia, as in the unit tests that draw the whole app', () => {
    vi.stubGlobal('matchMedia', undefined)
    render(<Answer />)
    expect(answer()).toBe('narrow')
  })

  it('asks exactly the 1024-pixel query, and answers what the browser says', () => {
    expect(WIDE_QUERY).toBe('(min-width: 1024px)')
    for (const wide of [true, false]) {
      const media = stubMatchMedia(wide)
      render(<Answer />)
      expect(answer(), `wide ${wide}`).toBe(wide ? 'wide' : 'narrow')
      expect(new Set(media.state.asked)).toEqual(new Set([WIDE_QUERY]))
      cleanup()
      vi.unstubAllGlobals()
    }
  })

  it('draws the part that asked again when the answer changes, either way, and as often as it does', () => {
    const media = stubMatchMedia(false)
    render(<Answer />)
    expect(answer()).toBe('narrow')
    media.change(true)
    expect(answer()).toBe('wide')
    media.change(false)
    expect(answer()).toBe('narrow')
    media.change(true)
    expect(answer()).toBe('wide')
  })

  it('takes off the listener it added once the part that asked is gone', () => {
    const media = stubMatchMedia(true)
    const { unmount } = render(<Answer />)
    expect(media.listening()).toBe(1)
    unmount()
    expect(media.listening()).toBe(0)
    expect(media.state.removed).toEqual(media.state.added)
  })

  it('answers false when drawn to a string, as a server draws, whatever the browser would say', () => {
    stubMatchMedia(true)
    expect(renderToString(<Answer />)).toContain('narrow')
  })
})
