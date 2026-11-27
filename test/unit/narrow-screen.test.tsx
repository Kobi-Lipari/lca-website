// @vitest-environment jsdom
//
// useNarrowScreen (src/areas/clubs/narrowScreen.ts, WS09 step 35): whether the
// Clubs directory takes its phone layout.
// - It asks for a largest width, 1023.98 pixels, so it answers no where the
//   browser has no matchMedia or answers no to every query, and the directory
//   keeps its wide layout there.
// - It follows the window as the query's answer changes, and lets go of the
//   listener when the page goes.
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NARROW_QUERY, useNarrowScreen } from '@/areas/clubs/narrowScreen'

const original = window.matchMedia

function Probe() {
  return <p data-testid="answer">{useNarrowScreen() ? 'narrow' : 'wide'}</p>
}

/** A stand-in media query list that answers the one query it is told to, and says who is listening. */
function standIn(initial: boolean) {
  const state = { matches: initial, asked: [] as string[], listeners: new Set<() => void>(), added: 0, removed: 0 }
  window.matchMedia = ((query: string) => {
    state.asked.push(query)
    return {
      get matches() { return query === NARROW_QUERY && state.matches },
      media: query,
      addEventListener: (_type: string, fn: () => void) => { state.added++; state.listeners.add(fn) },
      removeEventListener: (_type: string, fn: () => void) => { state.removed++; state.listeners.delete(fn) },
    }
  }) as unknown as typeof window.matchMedia
  return state
}

beforeEach(() => {
  window.matchMedia = original
})
afterEach(() => {
  cleanup()
  window.matchMedia = original
})

describe('useNarrowScreen', () => {
  it('asks for a largest width just under 1024 pixels, the wide layout\'s own width', () => {
    expect(NARROW_QUERY).toBe('(max-width: 1023.98px)')
  })

  it('answers wide where the browser has no matchMedia', () => {
    // @ts-expect-error a page with no matchMedia at all
    window.matchMedia = undefined
    render(<Probe />)
    expect(screen.getByTestId('answer').textContent).toBe('wide')
  })

  it('answers wide where every query is answered no, and narrow where its query is answered yes', () => {
    standIn(false)
    render(<Probe />)
    expect(screen.getByTestId('answer').textContent).toBe('wide')
    cleanup()
    const state = standIn(true)
    render(<Probe />)
    expect(screen.getByTestId('answer').textContent).toBe('narrow')
    expect(state.asked.every((q) => q === NARROW_QUERY)).toBe(true)
  })

  it('follows the window across the width, both ways, and lets go of its listener when the page goes', () => {
    const state = standIn(false)
    const { unmount } = render(<Probe />)
    expect(state.listeners.size).toBe(1)
    act(() => {
      state.matches = true
      state.listeners.forEach((fn) => fn())
    })
    expect(screen.getByTestId('answer').textContent).toBe('narrow')
    act(() => {
      state.matches = false
      state.listeners.forEach((fn) => fn())
    })
    expect(screen.getByTestId('answer').textContent).toBe('wide')
    unmount()
    expect(state.listeners.size).toBe(0)
    expect(state.removed).toBe(state.added)
  })
})
