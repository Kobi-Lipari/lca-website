// @vitest-environment jsdom
//
// ScrollPanel at its edges (WS01 step 26).
//
// - The header slot is optional: a header that draws nothing (false, an
//   empty string, an empty fragment), which is what a caller's
//   `header={cond && <p>...</p>}` gives when cond is false, draws no header
//   box, so no empty sticky bar with its hairline sits at the top.
// - The region is named by its label alone, whatever the header says, and
//   it is the one stop in the tab order the panel adds: its header and its
//   rows add none of their own.
// - A bound of the caller's own, in vh or pixels, replaces the 70vh one and
//   keeps the scrolling and the overscroll rule.
// - The scroll padding that keeps a focused control clear of the header
//   comes and goes with the header: a header that draws nothing gives none,
//   and the header's height stops being watched when the header goes.
//
// Class names a caller would pass are put together when the test runs, so
// Tailwind, which reads this file, builds no CSS for them.
import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ScrollPanel } from '@/components/ScrollPanel'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const maxH = (value: string) => ['max', 'h', value].join('-')

describe('a header that draws nothing', () => {
  it('false, an empty string and an empty fragment give no header box', () => {
    const empty: Array<[string, ReactNode]> = [
      ['false', false],
      ['an empty string', ''],
      ['an empty fragment', <></>],
    ]
    const drawn: string[] = []
    for (const [kind, header] of empty) {
      cleanup()
      render(<ScrollPanel label="Setup steps" header={header}><ol><li>Event name and dates</li></ol></ScrollPanel>)
      const panel = screen.getByRole('region', { name: 'Setup steps' })
      const box = panel.querySelector('[data-slot="scroll-panel-header"]')
      if (box) drawn.push(`${kind} draws ${box.outerHTML}`)
      else expect(panel.firstElementChild?.tagName, kind).toBe('OL')
    }
    expect(drawn).toEqual([])
  })
})

describe('the region', () => {
  it('is named by its label, not by its header\'s words', () => {
    render(<ScrollPanel label="Setup steps" header={<h3>Step 4 of 11</h3>}><p>Entry fees</p></ScrollPanel>)
    const panel = screen.getByRole('region', { name: 'Setup steps' })
    expect(panel.getAttribute('aria-label')).toBe('Setup steps')
    expect(panel.hasAttribute('aria-labelledby')).toBe(false)
    expect(screen.queryByRole('region', { name: 'Step 4 of 11' })).toBeNull()
  })

  it('is the one tab stop the panel adds', () => {
    const { container } = render(
      <ScrollPanel label="Setup steps" header={<p>Setup steps</p>}>
        <ol>{Array.from({ length: 11 }, (_, i) => <li key={i}>Step {i + 1}</li>)}</ol>
      </ScrollPanel>,
    )
    const stops = [...container.querySelectorAll('[tabindex]')]
    expect(stops).toHaveLength(1)
    expect(stops[0]).toBe(screen.getByRole('region'))
    expect((stops[0] as HTMLElement).tabIndex).toBe(0)
  })

  it('holds what it is given in order: the header, then the rows', () => {
    render(
      <ScrollPanel label="Setup steps" header={<p>Header words</p>}>
        <p>First row</p>
        <p>Second row</p>
      </ScrollPanel>,
    )
    const panel = screen.getByRole('region')
    expect([...panel.children].map((c) => c.textContent)).toEqual(['Header words', 'First row', 'Second row'])
  })
})

describe('a bound of the caller\'s own', () => {
  it.each([
    ['half the viewport', maxH('[50vh]')],
    ['a fixed height', maxH('96')],
  ])('%s replaces the 70vh bound and keeps the scrolling', (_, bound) => {
    render(<ScrollPanel label="Setup steps" className={bound}>Rows</ScrollPanel>)
    const classes = screen.getByRole('region').className.split(' ')
    expect(classes).toContain(bound)
    expect(classes).not.toContain(maxH('[70vh]'))
    expect(classes.filter((c) => c.startsWith('max-h-'))).toEqual([bound])
    for (const cls of ['overflow-auto', 'overscroll-contain']) expect(classes, cls).toContain(cls)
  })
})

describe('the scroll padding comes and goes with the header', () => {
  it('none while the header draws nothing, the header\'s height and 4px while it is drawn, and its watcher stopped when it goes', () => {
    // jsdom lays nothing out and has no ResizeObserver, so both are given here.
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.getAttribute('data-slot') === 'scroll-panel-header' ? 37 : 0
    })
    const watchers: Array<{ watched: Element[]; stopped: boolean }> = []
    vi.stubGlobal('ResizeObserver', class {
      private readonly watcher = { watched: [] as Element[], stopped: false }
      constructor() {
        watchers.push(this.watcher)
      }
      observe(target: Element) {
        this.watcher.watched.push(target)
      }
      unobserve() {}
      disconnect() {
        this.watcher.stopped = true
      }
    })
    const panelWith = (header: ReactNode) => <ScrollPanel label="Setup steps" header={header}><p>Rows</p></ScrollPanel>

    const { rerender } = render(panelWith(false))
    const panel = screen.getByRole('region')
    expect(panel.style.scrollPaddingTop).toBe('')
    expect(watchers).toEqual([])

    rerender(panelWith(<p>Step 1 of 11</p>))
    expect(panel.style.scrollPaddingTop).toBe('41px')
    expect(watchers).toHaveLength(1)

    // New words in the same header bar: the same watcher goes on watching it.
    rerender(panelWith(<p>Step 2 of 11</p>))
    expect(watchers).toHaveLength(1)
    expect(watchers[0].watched).toHaveLength(1)
    expect(watchers[0].watched[0]).toBe(panel.firstElementChild)
    expect(watchers[0].stopped).toBe(false)

    rerender(panelWith(''))
    expect(panel.querySelector('[data-slot="scroll-panel-header"]')).toBeNull()
    expect(panel.style.scrollPaddingTop).toBe('')
    expect(watchers[0].stopped).toBe(true)
  })
})
