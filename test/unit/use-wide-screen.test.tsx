// @vitest-environment jsdom
//
// src/hooks/useWideScreen.ts, the answer Navbar draws the new header by:
// whether the window is 1024 pixels wide or wider, read from the browser's
// own media query and followed as it changes. Beside it, useTabletScreen
// answers the 768-pixel line the same way (WS02 step 6), and Navbar reads
// the two together: the desktop form from 1024, the tablet form from 768 to
// 1023 and the phone's app bar below 768. Each holds the five cases below
// at its own line, and the two answer apart at every width.
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
import { TABLET_QUERY, WIDE_QUERY, useTabletScreen, useWideScreen } from '@/hooks/useWideScreen'

function Answer() {
  return <output data-testid="answer">{useWideScreen() ? 'wide' : 'narrow'}</output>
}

function TabletAnswer() {
  return <output data-testid="answer">{useTabletScreen() ? 'tablet or wider' : 'phone'}</output>
}

/** What Navbar reads: both answers, drawn by the one part. */
function BothAnswers() {
  const wide = useWideScreen()
  const tablet = useTabletScreen()
  return <output data-testid="answer">{`${wide ? 'wide' : 'narrow'}, ${tablet ? 'tablet or wider' : 'phone'}`}</output>
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

describe('useTabletScreen', () => {
  it('answers false with no matchMedia, as in the unit tests that draw the whole app, where the app bar is drawn', () => {
    vi.stubGlobal('matchMedia', undefined)
    render(<TabletAnswer />)
    expect(answer()).toBe('phone')
  })

  it('asks exactly the 768-pixel query, and answers what the browser says', () => {
    expect(TABLET_QUERY).toBe('(min-width: 768px)')
    for (const tablet of [true, false]) {
      const media = stubMatchMedia(tablet)
      render(<TabletAnswer />)
      expect(answer(), `tablet ${tablet}`).toBe(tablet ? 'tablet or wider' : 'phone')
      expect(new Set(media.state.asked)).toEqual(new Set([TABLET_QUERY]))
      cleanup()
      vi.unstubAllGlobals()
    }
  })

  it('draws the part that asked again when the answer changes, either way, and as often as it does', () => {
    const media = stubMatchMedia(false)
    render(<TabletAnswer />)
    expect(answer()).toBe('phone')
    media.change(true)
    expect(answer()).toBe('tablet or wider')
    media.change(false)
    expect(answer()).toBe('phone')
    media.change(true)
    expect(answer()).toBe('tablet or wider')
  })

  it('takes off the listener it added once the part that asked is gone', () => {
    const media = stubMatchMedia(true)
    const { unmount } = render(<TabletAnswer />)
    expect(media.listening()).toBe(1)
    unmount()
    expect(media.listening()).toBe(0)
    expect(media.state.removed).toEqual(media.state.added)
  })

  it('answers false when drawn to a string, as a server draws, whatever the browser would say', () => {
    stubMatchMedia(true)
    expect(renderToString(<TabletAnswer />)).toContain('phone')
  })
})

describe('the two lines together, as Navbar reads them', () => {
  /** A stand-in that answers each min-width query from the window's width, and can say the width changed. */
  function stubWidth(px: number) {
    let width = px
    const listeners = new Set<() => void>()
    vi.stubGlobal('matchMedia', (query: string) => ({
      get matches() {
        const line = /^\(min-width: (\d+)px\)$/.exec(query)
        return line !== null && width >= Number(line[1])
      },
      media: query,
      addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
    }))
    return {
      resize(next: number) {
        width = next
        act(() => listeners.forEach((listener) => listener()))
      },
      listening: () => listeners.size,
    }
  }

  it.each([
    [320, 'narrow, phone'],
    [767, 'narrow, phone'],
    [768, 'narrow, tablet or wider'],
    [900, 'narrow, tablet or wider'],
    [1023, 'narrow, tablet or wider'],
    [1024, 'wide, tablet or wider'],
    [1920, 'wide, tablet or wider'],
  ])('at %i pixels answers %s', (width, answers) => {
    stubWidth(width)
    render(<BothAnswers />)
    expect(answer()).toBe(answers)
  })

  it('follows the window across each line, one listener for each, both taken off when the part goes', () => {
    const media = stubWidth(1280)
    const { unmount } = render(<BothAnswers />)
    expect(media.listening()).toBe(2)
    const seen = [answer()]
    for (const width of [1023, 767, 768, 1024, 390, 1280]) {
      media.resize(width)
      seen.push(answer())
    }
    expect(seen).toEqual([
      'wide, tablet or wider',
      'narrow, tablet or wider',
      'narrow, phone',
      'narrow, tablet or wider',
      'wide, tablet or wider',
      'narrow, phone',
      'wide, tablet or wider',
    ])
    unmount()
    expect(media.listening()).toBe(0)
  })
})
