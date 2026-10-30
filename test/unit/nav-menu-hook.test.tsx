// @vitest-environment jsdom
//
// The one hook both of the new header's menus share,
// src/components/layout/navMenu.ts, held on its own in a small menu of the
// test's making, so its edges show without the header round it:
//
// - the rows the keyboard moves through are the panel's links with an
//   address and its buttons that are not disabled, in their order; a
//   disabled button and a link with no address are passed over;
// - a panel with no rows opens and moves nothing, and nothing fails;
// - Esc closes the menu wherever the focus is, unless something drawn over
//   it (a dialog) has already answered that Esc;
// - its listeners on the document go when the menu closes and when it is
//   no longer drawn, so a press later reaches nothing of it;
// - each menu names its own panel, two menus two different ids;
// - only a change of page closes it: drawing it again on the same page
//   leaves it open;
// - the keys it does not answer are left to the browser, Tab among them,
//   and Home and End on the closed button open nothing.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { useRef, type ReactNode } from 'react'
import { Link, MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useNavMenu } from '@/components/layout/navMenu'

/** A menu of the test's making: a button and the panel it opens, wired as the header's two are. */
function Menu({ name, rows }: { name: string; rows: ReactNode }) {
  const wrapper = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const menu = useNavMenu({ wrapper, button, panel })
  return (
    <div ref={wrapper} onKeyDown={menu.onKeyDown} onBlur={menu.onBlur}>
      <button ref={button} type="button" aria-expanded={menu.open} aria-controls={menu.open ? menu.panelId : undefined} onClick={menu.toggle} onKeyDown={menu.onButtonKeyDown}>
        {name}
      </button>
      {menu.open && (
        <div ref={panel} id={menu.panelId} data-testid={`${name} panel`}>
          {rows}
        </div>
      )}
    </div>
  )
}

const ROWS = (
  <>
    <a href="/one">One</a>
    <button type="button" disabled>
      Not now
    </button>
    <a>No address</a>
    <button type="button">Two</button>
    <a href="/three">Three</a>
  </>
)

/** The page round the menu: the menu, anything else the case draws, a button after it and a link elsewhere. */
function Page({ rows = ROWS, more = null }: { rows?: ReactNode; more?: ReactNode }) {
  return (
    <MemoryRouter initialEntries={['/start']}>
      <Menu name="Menu" rows={rows} />
      {more}
      <button type="button">After the menu</button>
      <Link to="/elsewhere">Another page</Link>
    </MemoryRouter>
  )
}

const draw = (rows: ReactNode = ROWS, more: ReactNode = null) => render(<Page rows={rows} more={more} />)

const button = (name = 'Menu') => screen.getByRole('button', { name })
const panel = (name = 'Menu') => screen.queryByTestId(`${name} panel`)
const isOpen = (name = 'Menu') => button(name).getAttribute('aria-expanded') === 'true'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('the rows the keyboard moves through', () => {
  it('are the links with an address and the buttons that are not disabled, in their order', () => {
    draw()
    button().focus()
    fireEvent.keyDown(button(), { key: 'ArrowDown' })
    const rows = within(panel()!)
    const [one, two, three] = [rows.getByText('One'), rows.getByText('Two'), rows.getByText('Three')]
    expect(document.activeElement).toBe(one)
    fireEvent.keyDown(one, { key: 'ArrowDown' })
    expect(document.activeElement, 'past the disabled button and the link with no address').toBe(two)
    fireEvent.keyDown(two, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(three)
    fireEvent.keyDown(three, { key: 'ArrowDown' })
    expect(document.activeElement, 'round to the first').toBe(one)
    fireEvent.keyDown(one, { key: 'End' })
    expect(document.activeElement).toBe(three)
    fireEvent.keyDown(three, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(two)
  })

  it('in a panel with none, open it and move nothing, and nothing fails', () => {
    draw(<p>Nothing here yet</p>)
    button().focus()
    fireEvent.keyDown(button(), { key: 'ArrowDown' })
    expect(isOpen()).toBe(true)
    expect(document.activeElement).toBe(button())
    fireEvent.keyDown(button(), { key: 'ArrowUp' })
    fireEvent.keyDown(screen.getByText('Nothing here yet'), { key: 'ArrowDown' })
    fireEvent.keyDown(screen.getByText('Nothing here yet'), { key: 'End' })
    expect(isOpen()).toBe(true)
    expect(document.activeElement).toBe(button())
  })
})

describe('Esc', () => {
  it('closes the menu wherever the focus is, and gives the focus to its button', () => {
    draw()
    fireEvent.click(button())
    screen.getByRole('button', { name: 'After the menu' }).focus()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(isOpen()).toBe(false)
    expect(document.activeElement).toBe(button())
  })

  it('is left alone once something drawn over the menu, a dialog, has answered it first', () => {
    draw()
    fireEvent.click(button())
    const answered = (event: KeyboardEvent) => {
      if (event.key === 'Escape') event.preventDefault()
    }
    document.addEventListener('keydown', answered, { capture: true })
    try {
      fireEvent.keyDown(document.body, { key: 'Escape' })
      expect(isOpen(), 'the dialog took that Esc').toBe(true)
    } finally {
      document.removeEventListener('keydown', answered, { capture: true })
    }
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(isOpen()).toBe(false)
  })
})

describe('its listeners on the document', () => {
  const kinds = (spy: ReturnType<typeof vi.spyOn>) => (spy.mock.calls as unknown[][]).map(([type]) => type).filter((type) => ['mousedown', 'touchstart', 'keydown'].includes(type as string))

  it('are added while it is open and taken off when it closes, each the one added', () => {
    const added = vi.spyOn(document, 'addEventListener')
    const removed = vi.spyOn(document, 'removeEventListener')
    draw()
    expect(kinds(added)).toEqual([])
    fireEvent.click(button())
    expect(kinds(added).sort()).toEqual(['keydown', 'mousedown', 'touchstart'])
    fireEvent.click(button())
    expect(kinds(removed).sort()).toEqual(['keydown', 'mousedown', 'touchstart'])
    for (const type of ['mousedown', 'touchstart', 'keydown']) {
      const on = added.mock.calls.find(([t]) => t === type)?.[1]
      const off = removed.mock.calls.find(([t]) => t === type)?.[1]
      expect(off, type).toBe(on)
    }
  })

  it('are taken off when the menu is no longer drawn while open, and a press later changes nothing', () => {
    const removed = vi.spyOn(document, 'removeEventListener')
    const { unmount } = draw()
    fireEvent.click(button())
    unmount()
    expect(kinds(removed).sort()).toEqual(['keydown', 'mousedown', 'touchstart'])
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    fireEvent.mouseDown(document.body)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(errors).not.toHaveBeenCalled()
  })
})

describe('two menus', () => {
  it('name each its own panel, and a press in one closes the other', () => {
    draw(ROWS, <Menu name="Other" rows={<a href="/four">Four</a>} />)
    fireEvent.click(button('Menu'))
    fireEvent.mouseDown(button('Other'))
    fireEvent.click(button('Other'))
    expect(isOpen('Menu')).toBe(false)
    expect(isOpen('Other')).toBe(true)
    const otherId = button('Other').getAttribute('aria-controls')
    expect(document.getElementById(otherId!)).toBe(panel('Other'))
    fireEvent.click(button('Menu'))
    const menuId = button('Menu').getAttribute('aria-controls')
    expect(menuId).not.toBe(otherId)
    expect(document.getElementById(menuId!)).toBe(panel('Menu'))
  })
})

describe('a change of page', () => {
  it('closes the menu; the same page drawn again leaves it open', () => {
    const { rerender } = draw()
    fireEvent.click(button())
    rerender(<Page />)
    expect(isOpen(), 'drawn again on the same page').toBe(true)
    // A click with no press first, so only the change of page can close it.
    fireEvent.click(screen.getByRole('link', { name: 'Another page' }))
    expect(isOpen(), 'on another page').toBe(false)
    expect(panel()).toBeNull()
  })
})

describe('the keys it does not answer', () => {
  it('are left to the browser: Tab and a letter inside the panel, and Home and End on the closed button, which open nothing', () => {
    draw()
    for (const key of ['Home', 'End', 'Enter', ' ']) {
      expect(fireEvent.keyDown(button(), { key }), `${key} on the closed button is the browser's`).toBe(true)
      expect(isOpen(), key).toBe(false)
    }
    button().focus()
    fireEvent.keyDown(button(), { key: 'ArrowDown' })
    const one = within(panel()!).getByText('One')
    expect(fireEvent.keyDown(one, { key: 'Tab' }), 'Tab goes on in the page\'s order').toBe(true)
    expect(fireEvent.keyDown(one, { key: 'a' })).toBe(true)
    expect(document.activeElement).toBe(one)
    expect(fireEvent.keyDown(one, { key: 'ArrowDown' }), 'an arrow is the menu\'s').toBe(false)
  })

  it('keeps the menu open while the focus moves inside it, and closes it once the focus has gone elsewhere', () => {
    draw()
    button().focus()
    fireEvent.keyDown(button(), { key: 'ArrowDown' })
    const one = within(panel()!).getByText('One')
    fireEvent.blur(one, { relatedTarget: button() })
    expect(isOpen(), 'back to its own button').toBe(true)
    fireEvent.blur(one, { relatedTarget: screen.getByRole('button', { name: 'After the menu' }) })
    expect(isOpen()).toBe(false)
  })
})
