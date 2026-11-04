// src/components/layout/navMenu.ts
//
// What the new header's two menus, About and My LCA, share. Each is a
// disclosure: a button that shows or hides a short list of links, the
// pattern a list of a site's own pages takes, rather than an application
// menu of commands, so the button carries aria-expanded, and aria-controls
// naming the panel while it is drawn, and no aria-haspopup. The panel is
// drawn only while it is open, so no hidden copy of a row sits in the page.
//
// A click, or Enter or Space on the button, shows or hides it; nothing opens
// it on hover. ArrowDown on the button opens it on its first row, ArrowUp
// on its last; inside it the arrow keys move from row to row and wrap, and
// Home and End go to the first and the last. Esc closes it and gives the
// focus back to the button. Tab goes on in the page's order, and the menu
// closes once the focus has gone to something outside it. A press outside
// it, a change of page and choosing a row close it too.
import { useEffect, useId, useLayoutEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type RefObject } from 'react'
import { useLocation } from 'react-router-dom'

/** The rows the keyboard moves through: the panel's links and buttons, in their order. */
const ROWS = 'a[href], button:not([disabled])'

/**
 * The menu's three elements, which the component that draws it holds: the
 * wrapper around the button and the panel, the button, and the panel.
 */
export interface NavMenuRefs {
  readonly wrapper: RefObject<HTMLDivElement | null>
  readonly button: RefObject<HTMLButtonElement | null>
  readonly panel: RefObject<HTMLDivElement | null>
}

export interface NavMenu {
  readonly open: boolean
  /** The panel's id, for the button's aria-controls while the panel is drawn. */
  readonly panelId: string
  /** Shows or hides the panel: the button's click, which Enter and Space give it too. */
  readonly toggle: () => void
  /** Hides the panel, as choosing a row does. */
  readonly close: () => void
  /** On the button: ArrowDown and ArrowUp open the panel on its first or its last row. */
  readonly onButtonKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void
  /** On the wrapper: Esc, and the arrow keys, Home and End inside the panel. */
  readonly onKeyDown: (event: KeyboardEvent<HTMLElement>) => void
  /** On the wrapper: the panel closes once the focus has gone to something outside it. */
  readonly onBlur: (event: FocusEvent<HTMLElement>) => void
}

type Row = 'first' | 'last'

/** The panel's rows, in their order. */
const rowsOf = (panel: HTMLElement | null): HTMLElement[] => [...(panel?.querySelectorAll<HTMLElement>(ROWS) ?? [])]

/** Moves the focus to the first or the last row. */
function focusRow(rows: HTMLElement[], row: Row) {
  rows[row === 'first' ? 0 : rows.length - 1]?.focus()
}

export function useNavMenu({ wrapper: wrapperRef, button: buttonRef, panel: panelRef }: NavMenuRefs): NavMenu {
  const [open, setOpen] = useState(false)
  /** The row to move the focus to once the panel is drawn, when a key opened it. */
  const focusOnOpen = useRef<Row | null>(null)
  const panelId = useId()
  const location = useLocation()

  // A change of page closes the menu. Adjusted while drawing, as React
  // recommends for state that follows a changed value, so the menu is shut
  // before the new page paints rather than one frame later.
  const [lastPath, setLastPath] = useState(location.pathname)
  if (location.pathname !== lastPath) {
    setLastPath(location.pathname)
    setOpen(false)
  }

  // Once a key has opened the panel, the focus goes to the row it asked for.
  useLayoutEffect(() => {
    if (!open) return
    const row = focusOnOpen.current
    focusOnOpen.current = null
    if (row) focusRow(rowsOf(panelRef.current), row)
  }, [open, panelRef])

  // While it is open, a press anywhere outside the menu closes it, and so
  // does Esc wherever the focus is (a browser that does not focus a button
  // it clicks leaves the focus on the page).
  useEffect(() => {
    if (!open) return
    function onPress(event: MouseEvent | TouchEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setOpen(false)
    }
    function onEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('mousedown', onPress)
    document.addEventListener('touchstart', onPress)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onPress)
      document.removeEventListener('touchstart', onPress)
      document.removeEventListener('keydown', onEscape)
    }
  }, [open, wrapperRef, buttonRef])

  function onButtonKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const row: Row = event.key === 'ArrowDown' ? 'first' : 'last'
    if (open) {
      focusRow(rowsOf(panelRef.current), row)
      return
    }
    focusOnOpen.current = row
    setOpen(true)
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!open) return
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      buttonRef.current?.focus()
      return
    }
    const panel = panelRef.current
    if (!panel || !panel.contains(event.target as Node)) return
    const all = rowsOf(panel)
    const at = all.indexOf(event.target as HTMLElement)
    let next: number
    switch (event.key) {
      case 'ArrowDown':
        next = (at + 1) % all.length
        break
      case 'ArrowUp':
        next = (at - 1 + all.length) % all.length
        break
      case 'Home':
        next = 0
        break
      case 'End':
        next = all.length - 1
        break
      default:
        return
    }
    event.preventDefault()
    all[next]?.focus()
  }

  function onBlur(event: FocusEvent<HTMLElement>) {
    // The focus went to something outside the menu, as Tab past the last row
    // sends it. With nowhere named (a press on the page, or a browser that
    // does not focus what it clicks), the press outside decides instead, so
    // a click on a row is never lost to the panel closing first.
    const to = event.relatedTarget as Node | null
    if (open && to && wrapperRef.current && !wrapperRef.current.contains(to)) setOpen(false)
  }

  return {
    open,
    panelId,
    toggle: () => setOpen((was) => !was),
    close: () => setOpen(false),
    onButtonKeyDown,
    onKeyDown,
    onBlur,
  }
}
