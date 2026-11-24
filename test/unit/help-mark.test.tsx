// @vitest-environment jsdom
//
// The one small question mark of Help (src/areas/clubs/components/HelpMark.tsx,
// K's decision 16): its name and state, a press, Escape, a press elsewhere,
// the focus leaving, a mouse resting and leaving, a touch, one bubble open
// at a time, the focus alone opening nothing, its timers cleared when it
// leaves the page, and the span it is drawn as inside an observer's shut
// fieldset. Every word here is made up.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HelpMark } from '@/areas/clubs/components/HelpMark'
import { HelpMarksShut } from '@/areas/clubs/helpMarks'

const ONE = [['Example part', 'Words that say what the example part is for.']] as const
const TWO = [['First example', 'Words of the first example.'], ['Second example', 'Words of the second example.']] as const

function draw(shut = false) {
  render(
    <HelpMarksShut value={shut}>
      <div className="relative">
        <span>Example part</span>
        <HelpMark name="Example part" entries={ONE} />
      </div>
      <div className="relative">
        <span>Another part</span>
        <HelpMark name="Another part" entries={TWO} />
      </div>
      <button type="button">Another control</button>
      <p>Words elsewhere on the page</p>
    </HelpMarksShut>,
  )
  const mark = screen.getByRole('button', { name: 'Help: Example part' })
  const other = screen.getByRole('button', { name: 'Help: Another part' })
  return { mark, other, bubble: bubbleOf(mark), otherBubble: bubbleOf(other) }
}
const bubbleOf = (mark: HTMLElement) => document.getElementById(mark.getAttribute('aria-controls') ?? '') as HTMLElement
const classes = (el: Element) => (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('the mark and its bubble', () => {
  it('is a button of type button named "Help: " and its part, with no words in sight, closed, its bubble hidden and its own', () => {
    const { mark, other, bubble } = draw()
    expect(mark.tagName).toBe('BUTTON')
    expect(mark.getAttribute('type')).toBe('button')
    expect(mark.textContent).toBe('')
    expect(mark.getAttribute('aria-expanded')).toBe('false')
    expect(bubble.hidden).toBe(true)
    // The bubble follows the mark in the page's order, and two marks never share an id.
    expect(mark.nextElementSibling).toBe(bubble)
    expect(mark.getAttribute('aria-controls')).not.toBe(other.getAttribute('aria-controls'))
    // The question mark in a circle is hidden from assistive technology.
    expect(mark.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    // A plain disclosure: no dialog, no tooltip, no live region.
    for (const name of ['role', 'aria-live', 'aria-modal', 'tabindex']) expect(bubble.hasAttribute(name), name).toBe(false)
    expect(screen.queryByRole('tooltip')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('draws 24 pixels across, pressed across a wider area that takes no room, ringed on focus, in the page\'s muted ink, never gold', () => {
    const { mark, bubble } = draw()
    expect(classes(mark)).toEqual(expect.arrayContaining([
      'size-6', '-my-1', 'relative', 'before:absolute', 'before:-left-2', 'before:-right-3', 'before:-top-2.5', 'before:-bottom-2.5',
      'focus-visible:ring-3', 'focus-visible:ring-focus', 'text-ink-muted',
    ]))
    expect(mark.className).not.toMatch(/gold|#c8a94a/)
    // The bubble: a small card in the page, under the mark's line, never wider than 24rem or its part.
    expect(classes(bubble)).toEqual(expect.arrayContaining(['absolute', 'w-[min(24rem,100%)]', 'left-0', 'bg-card', 'border-hairline', 'shadow-sm', 'p-3', 'text-sm', 'text-ink']))
    expect(classes(bubble).filter((c) => /^(fixed|top-|bottom-|translate)/.test(c))).toEqual([])
    expect(bubble.closest('body')).toBe(document.body)
    expect(bubble.parentElement?.parentElement?.className).toBe('relative')
  })

  it('a mark on a label\'s line takes less room on a phone, so a label that ends near its column keeps its one line, its pressable area still 44 pixels wide', () => {
    render(<div className="relative"><label htmlFor="example-box">Example label</label><HelpMark name="Example label" entries={ONE} tight /><input id="example-box" /></div>)
    const mark = screen.getByRole('button', { name: 'Help: Example label' })
    const list = classes(mark)
    // From sm up: 8 pixels after the label, the area 8 to its left and 12 to its right (8 + 24 + 12 = 44).
    expect(list).toEqual(expect.arrayContaining(['ml-2', 'before:-left-2', 'before:-right-3', 'before:bottom-0', '-mt-2']))
    // Below sm: 4 pixels after it, 12 pixels less room on the line, the area 4 to its left and 16 to its right (4 + 24 + 16 = 44).
    expect(list).toEqual(expect.arrayContaining(['max-sm:ml-1', 'max-sm:-mr-3', 'max-sm:before:-left-1', 'max-sm:before:-right-4']))
    // The field's name is its label alone.
    expect(screen.getByRole('textbox', { name: 'Example label' })).toBeTruthy()
  })

  it('opens on a press and closes on a second, and a bubble of one entry shows the words alone, of two each term first', () => {
    const { mark, bubble, other, otherBubble } = draw()
    fireEvent.click(mark)
    expect(mark.getAttribute('aria-expanded')).toBe('true')
    expect(bubble.hidden).toBe(false)
    expect(bubble.textContent).toBe('Words that say what the example part is for.')
    expect(bubble.querySelector('dt')).toBeNull()
    fireEvent.click(mark)
    expect(mark.getAttribute('aria-expanded')).toBe('false')
    expect(bubble.hidden).toBe(true)
    fireEvent.click(other)
    expect([...otherBubble.querySelectorAll('dt')].map((dt) => [dt.textContent, dt.className])).toEqual([['First example', 'font-medium'], ['Second example', 'font-medium']])
  })

  it('closes on Escape, leaving the focus where it is, and the Escape goes no further; with no bubble open, Escape passes on', () => {
    const { mark, bubble } = draw()
    const heard = vi.fn()
    document.addEventListener('keydown', heard)
    try {
      mark.focus()
      fireEvent.keyDown(mark, { key: 'Escape' })
      expect(heard).toHaveBeenCalledTimes(1)
      fireEvent.click(mark)
      fireEvent.keyDown(mark, { key: 'Escape' })
      expect(bubble.hidden).toBe(true)
      expect(document.activeElement).toBe(mark)
      expect(heard).toHaveBeenCalledTimes(1)
      // A bubble a resting mouse opened closes the same way.
      vi.useFakeTimers()
      fireEvent.pointerEnter(mark, { pointerType: 'mouse' })
      act(() => { vi.advanceTimersByTime(200) })
      expect(bubble.hidden).toBe(false)
      fireEvent.keyDown(screen.getByRole('button', { name: 'Another control' }), { key: 'Escape' })
      expect(bubble.hidden).toBe(true)
      expect(heard).toHaveBeenCalledTimes(1)
    } finally {
      document.removeEventListener('keydown', heard)
    }
  })

  it('closes on a press anywhere outside the mark and its bubble, and on the focus moving to another control', () => {
    const { mark, bubble } = draw()
    fireEvent.click(mark)
    fireEvent.pointerDown(bubble)
    expect(bubble.hidden).toBe(false)
    fireEvent.pointerDown(screen.getByText('Words elsewhere on the page'))
    expect(bubble.hidden).toBe(true)
    fireEvent.click(mark)
    mark.focus()
    expect(bubble.hidden).toBe(false)
    act(() => { screen.getByRole('button', { name: 'Another control' }).focus() })
    expect(bubble.hidden).toBe(true)
  })

  it('stays open when a press on its words moves the focus to the box around it, and a key or a finished press lets that box\'s focus close it again', () => {
    render(
      <div role="region" aria-label="Example box" tabIndex={0}>
        <div className="relative">
          <span>Example part</span>
          <HelpMark name="Example part" entries={ONE} />
        </div>
      </div>,
    )
    const box = screen.getByRole('region', { name: 'Example box' })
    const mark = screen.getByRole('button', { name: 'Help: Example part' })
    const bubble = bubbleOf(mark)
    const words = bubble.firstElementChild as HTMLElement
    fireEvent.click(mark)
    // A browser focuses the box when a press lands on the bubble's words.
    fireEvent.pointerDown(words)
    act(() => { box.focus() })
    expect(bubble.hidden).toBe(false)
    fireEvent.click(words)
    expect(bubble.hidden).toBe(false)
    // Some browsers focus the box for a press on the mark itself: the second press still closes it, and only by the press.
    act(() => { mark.focus() })
    fireEvent.pointerDown(mark)
    act(() => { box.focus() })
    expect(mark.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(mark)
    expect(bubble.hidden).toBe(true)
    // A press inside that ends, and then a Shift+Tab back to the box, closes it.
    fireEvent.click(mark)
    act(() => { mark.focus() })
    fireEvent.pointerDown(words)
    fireEvent.click(words)
    act(() => { box.focus() })
    expect(bubble.hidden).toBe(true)
    // So does a key pressed after a press inside that never became a click.
    fireEvent.click(mark)
    act(() => { mark.focus() })
    fireEvent.pointerDown(words)
    fireEvent.keyDown(mark, { key: 'Tab', shiftKey: true })
    act(() => { box.focus() })
    expect(bubble.hidden).toBe(true)
    // And a press inside never keeps it open for the focus moving to a control that is not around it.
    fireEvent.click(mark)
    fireEvent.pointerDown(words)
    const elsewhere = document.createElement('button')
    document.body.append(elsewhere)
    act(() => { elsewhere.focus() })
    expect(bubble.hidden).toBe(true)
    elsewhere.remove()
  })

  it('opens for a resting mouse after a short wait, lets the mouse cross onto the bubble, and closes a short wait after it leaves both', () => {
    vi.useFakeTimers()
    const { mark, bubble } = draw()
    fireEvent.pointerEnter(mark, { pointerType: 'mouse' })
    act(() => { vi.advanceTimersByTime(100) })
    expect(bubble.hidden).toBe(true)
    act(() => { vi.advanceTimersByTime(60) })
    expect(bubble.hidden).toBe(false)
    expect(mark.getAttribute('aria-expanded')).toBe('true')
    // From the mark onto the bubble: it stays.
    fireEvent.pointerLeave(mark, { pointerType: 'mouse' })
    act(() => { vi.advanceTimersByTime(100) })
    fireEvent.pointerEnter(bubble, { pointerType: 'mouse' })
    act(() => { vi.advanceTimersByTime(1000) })
    expect(bubble.hidden).toBe(false)
    // Off both: it closes after the wait.
    fireEvent.pointerLeave(bubble, { pointerType: 'mouse' })
    act(() => { vi.advanceTimersByTime(100) })
    expect(bubble.hidden).toBe(false)
    act(() => { vi.advanceTimersByTime(300) })
    expect(bubble.hidden).toBe(true)
    // A mouse that passes over the mark without resting opens nothing.
    fireEvent.pointerEnter(mark, { pointerType: 'mouse' })
    fireEvent.pointerLeave(mark, { pointerType: 'mouse' })
    act(() => { vi.advanceTimersByTime(1000) })
    expect(bubble.hidden).toBe(true)
  })

  it('keeps a bubble a press opened when the mouse leaves, and a press on a bubble the mouse opened keeps it too', () => {
    vi.useFakeTimers()
    const { mark, bubble } = draw()
    fireEvent.click(mark)
    fireEvent.pointerEnter(mark, { pointerType: 'mouse' })
    fireEvent.pointerLeave(mark, { pointerType: 'mouse' })
    act(() => { vi.advanceTimersByTime(2000) })
    expect(bubble.hidden).toBe(false)
    fireEvent.click(mark)
    expect(bubble.hidden).toBe(true)
    fireEvent.pointerEnter(mark, { pointerType: 'mouse' })
    act(() => { vi.advanceTimersByTime(200) })
    fireEvent.click(mark)
    fireEvent.pointerLeave(mark, { pointerType: 'mouse' })
    act(() => { vi.advanceTimersByTime(2000) })
    expect(bubble.hidden).toBe(false)
  })

  it('never opens for a touch that rests, nor for the focus alone', () => {
    vi.useFakeTimers()
    const { mark, bubble } = draw()
    fireEvent.pointerEnter(mark, { pointerType: 'touch' })
    act(() => { vi.advanceTimersByTime(2000) })
    expect(bubble.hidden).toBe(true)
    fireEvent.pointerEnter(mark, { pointerType: 'pen' })
    act(() => { vi.advanceTimersByTime(2000) })
    expect(bubble.hidden).toBe(true)
    act(() => { mark.focus() })
    act(() => { vi.advanceTimersByTime(2000) })
    expect(document.activeElement).toBe(mark)
    expect(bubble.hidden).toBe(true)
  })

  it('opens one bubble at a time: opening one closes any other, by a press or a resting mouse', () => {
    vi.useFakeTimers()
    const { mark, bubble, other, otherBubble } = draw()
    fireEvent.click(mark)
    fireEvent.click(other)
    expect(bubble.hidden).toBe(true)
    expect(otherBubble.hidden).toBe(false)
    // A resting mouse never takes the place of a bubble a press opened.
    fireEvent.pointerEnter(mark, { pointerType: 'mouse' })
    act(() => { vi.advanceTimersByTime(200) })
    expect(bubble.hidden).toBe(true)
    expect(otherBubble.hidden).toBe(false)
    fireEvent.pointerLeave(mark, { pointerType: 'mouse' })
    // It takes the place of one a resting mouse opened.
    fireEvent.click(other)
    fireEvent.pointerEnter(other, { pointerType: 'mouse' })
    act(() => { vi.advanceTimersByTime(200) })
    expect(otherBubble.hidden).toBe(false)
    fireEvent.pointerLeave(other, { pointerType: 'mouse' })
    fireEvent.pointerEnter(mark, { pointerType: 'mouse' })
    act(() => { vi.advanceTimersByTime(200) })
    expect(bubble.hidden).toBe(false)
    expect(otherBubble.hidden).toBe(true)
    expect(document.querySelectorAll('[data-slot="help-mark-bubble"]:not([hidden])')).toHaveLength(1)
  })

  it('clears every timer when it leaves the page, and keeps nothing in the browser', () => {
    vi.useFakeTimers()
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const getItem = vi.spyOn(Storage.prototype, 'getItem')
    const { mark } = draw()
    fireEvent.pointerEnter(mark, { pointerType: 'mouse' })
    expect(vi.getTimerCount()).toBe(1)
    cleanup()
    expect(vi.getTimerCount()).toBe(0)
    expect(setItem).not.toHaveBeenCalled()
    expect(getItem).not.toHaveBeenCalled()
  })

  it('brings a bubble a press opened into view by its nearest edge, and never for a resting mouse', () => {
    const scrolled = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { value: scrolled, configurable: true, writable: true })
    vi.useFakeTimers()
    const { mark, bubble } = draw()
    fireEvent.click(mark)
    expect(scrolled.mock.contexts).toEqual([bubble])
    expect(scrolled.mock.calls).toEqual([[{ block: 'nearest', inline: 'nearest' }]])
    fireEvent.click(mark)
    scrolled.mockClear()
    fireEvent.pointerEnter(mark, { pointerType: 'mouse' })
    act(() => { vi.advanceTimersByTime(200) })
    expect(bubble.hidden).toBe(false)
    expect(scrolled).not.toHaveBeenCalled()
  })
})

describe('the mark inside a shut fieldset', () => {
  it('is a span that answers as a button, which the fieldset does not disable: a press, Enter and Space open and close it', () => {
    render(
      <fieldset disabled>
        <HelpMarksShut value>
          <div className="relative"><span>Example part</span><HelpMark name="Example part" entries={ONE} /></div>
        </HelpMarksShut>
        <input aria-label="Example box" />
      </fieldset>,
    )
    const mark = screen.getByRole('button', { name: 'Help: Example part' })
    const bubble = bubbleOf(mark)
    expect(mark.tagName).toBe('SPAN')
    expect(mark.tabIndex).toBe(0)
    expect(mark.matches(':disabled')).toBe(false)
    expect((screen.getByLabelText('Example box') as HTMLInputElement).matches(':disabled')).toBe(true)
    fireEvent.click(mark)
    expect(bubble.hidden).toBe(false)
    fireEvent.keyDown(mark, { key: 'Enter' })
    expect(bubble.hidden).toBe(true)
    // Space acts as it is let go, as a button's does, and its press never scrolls the page.
    const space = fireEvent.keyDown(mark, { key: ' ' })
    expect(space).toBe(false)
    expect(bubble.hidden).toBe(true)
    fireEvent.keyUp(mark, { key: ' ' })
    expect(bubble.hidden).toBe(false)
    expect(mark.getAttribute('aria-expanded')).toBe('true')
    fireEvent.keyDown(mark, { key: 'Escape' })
    expect(bubble.hidden).toBe(true)
  })
})
