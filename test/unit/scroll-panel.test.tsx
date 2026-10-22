// @vitest-environment jsdom
//
// ScrollPanel (WS01 step 26), from K's October 8 note that long screens such
// as tournament setup sit in a scroll container so their content stays
// together. It is ADMIN_SCROLL made a component: a box bounded by the
// viewport that scrolls on its own and keeps its overscroll inside, a named
// region in the tab order so a keyboard can reach and scroll it, and an
// optional header that stays at its top. Since the header is drawn over the
// top of the scrolling box, the panel's scroll padding is the header's height
// and the focus ring's reach, read again whenever the header's height
// changes, so a control the keyboard moves to is scrolled out from under the
// header rather than left hidden there (WCAG 2.4.11). The browser half (Tab
// reaches it, Page Down scrolls it, the header stays put, and Shift+Tab onto
// a box under the header brings the box into view) is
// test/a11y/components.spec.ts.
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ScrollPanel } from '@/components/ScrollPanel'
import { ADMIN_SCROLL } from '@/lib/brand'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

/** jsdom lays nothing out, so the header's height is given: what offsetHeight reads for it. */
function headerHeight(px: () => number) {
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return this.getAttribute('data-slot') === 'scroll-panel-header' ? px() : 0
  })
}

/** A stand-in for ResizeObserver, which jsdom lacks: it keeps what it watches, and a test says when a size changed. */
interface Watcher {
  watched: Element[]
  stopped: boolean
  /** What the browser does when a watched box changes size. */
  resized: () => void
}

function stubResizeObserver(): Watcher[] {
  const made: Watcher[] = []
  vi.stubGlobal('ResizeObserver', class {
    private readonly watcher: Watcher
    constructor(changed: () => void) {
      this.watcher = { watched: [], stopped: false, resized: changed }
      made.push(this.watcher)
    }
    observe(target: Element) {
      this.watcher.watched.push(target)
    }
    unobserve() {}
    disconnect() {
      this.watcher.stopped = true
    }
  })
  return made
}

describe('ScrollPanel', () => {
  it('is a region named by its label, in the tab order', () => {
    render(<ScrollPanel label="Setup steps"><p>Event name and dates</p></ScrollPanel>)
    const panel = screen.getByRole('region', { name: 'Setup steps' })
    expect(panel.getAttribute('tabindex')).toBe('0')
    expect(panel.getAttribute('data-slot')).toBe('scroll-panel')
    expect(panel.textContent).toBe('Event name and dates')
  })

  it('is ADMIN_SCROLL generalised: bounded by the viewport, scrolling on its own, overscroll kept inside', () => {
    expect(ADMIN_SCROLL).toBe('max-h-[70vh] overflow-auto overscroll-contain')
    render(<ScrollPanel label="Setup steps">Rows</ScrollPanel>)
    const classes = screen.getByRole('region').className.split(' ')
    for (const cls of ADMIN_SCROLL.split(' ')) expect(classes, cls).toContain(cls)
  })

  it('takes a bound of its own from className in place of 70vh', () => {
    render(<ScrollPanel label="Setup steps" className="mt-3 max-h-48">Rows</ScrollPanel>)
    const classes = screen.getByRole('region').className.split(' ')
    expect(classes).toContain('max-h-48')
    expect(classes).not.toContain('max-h-[70vh]')
    expect(classes).toContain('overflow-auto')
    expect(classes).toContain('mt-3')
  })

  it('shows a focus ring when the keyboard reaches it, and draws its box in tokens', () => {
    render(<ScrollPanel label="Setup steps">Rows</ScrollPanel>)
    const classes = screen.getByRole('region').className.split(' ')
    for (const cls of ['focus-visible:ring-3', 'focus-visible:ring-focus', 'border-hairline', 'bg-surface']) expect(classes, cls).toContain(cls)
  })

  it('holds its header at the top while the rest scrolls under it, on a ground of its own', () => {
    render(
      <ScrollPanel label="Setup steps" header={<p>Setup steps</p>}>
        <ol><li>Event name and dates</li></ol>
      </ScrollPanel>,
    )
    const panel = screen.getByRole('region')
    const header = panel.firstElementChild as HTMLElement
    expect(header.getAttribute('data-slot')).toBe('scroll-panel-header')
    expect(header.tagName).toBe('DIV')
    for (const cls of ['sticky', 'top-0', 'z-10', 'bg-surface']) expect(header.className.split(' '), cls).toContain(cls)
    expect(header.textContent).toBe('Setup steps')
    expect(header.nextElementSibling?.tagName).toBe('OL')
  })

  it('draws no header when it has none', () => {
    const { container } = render(<ScrollPanel label="Setup steps"><p>Rows</p></ScrollPanel>)
    expect(container.querySelector('[data-slot="scroll-panel-header"]')).toBeNull()
    render(<ScrollPanel label="Other steps" header={null}><p>Rows</p></ScrollPanel>)
    expect(screen.getByRole('region', { name: 'Other steps' }).querySelector('[data-slot="scroll-panel-header"]')).toBeNull()
  })
})

describe('ScrollPanel keeps what the keyboard reaches clear of its header', () => {
  it('pads its scrolling by the header\'s height and the focus ring\'s 4px reach', () => {
    // No ResizeObserver here, as in jsdom: the height is read once, as the header is drawn.
    expect(typeof ResizeObserver).toBe('undefined')
    headerHeight(() => 37)
    render(
      <ScrollPanel label="Setup steps" header={<p>Setup steps</p>}>
        <ol><li><label><input type="checkbox" /> Event name and dates</label></li></ol>
      </ScrollPanel>,
    )
    expect(screen.getByRole('region').style.scrollPaddingTop).toBe('41px')
  })

  it('reads the header\'s height again whenever it changes, and stops watching when the panel goes', () => {
    let height = 37
    headerHeight(() => height)
    const watchers = stubResizeObserver()
    const { unmount } = render(<ScrollPanel label="Setup steps" header={<p>Setup steps</p>}><p>Rows</p></ScrollPanel>)
    const panel = screen.getByRole('region')
    expect(watchers).toHaveLength(1)
    expect(watchers[0].watched).toHaveLength(1)
    expect(watchers[0].watched[0]).toBe(panel.querySelector('[data-slot="scroll-panel-header"]'))
    expect(panel.style.scrollPaddingTop).toBe('41px')
    // The header's words wrap onto a second line, on a phone or with the text zoomed.
    height = 58
    watchers[0].resized()
    expect(panel.style.scrollPaddingTop).toBe('62px')
    unmount()
    expect(watchers[0].stopped).toBe(true)
  })

  it('has no scroll padding when it has no header', () => {
    headerHeight(() => 37)
    const watchers = stubResizeObserver()
    render(<ScrollPanel label="Setup steps"><p>Rows</p></ScrollPanel>)
    expect(screen.getByRole('region').style.scrollPaddingTop).toBe('')
    expect(watchers).toEqual([])
  })
})
