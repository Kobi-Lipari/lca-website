// src/components/ScrollPanel.tsx
//
// A long part of a screen in a box that scrolls on its own. K asked on
// October 8 for long screens such as tournament setup to sit in a scroll
// container, so the content stays together; on the setup board
// (Event-Final-Setup, note 13) the form scrolls in its own container while
// the steps and the preview stay in view. This is ADMIN_SCROLL from
// src/lib/brand.ts made a component: a height bounded by the viewport (70vh,
// which a max-h-* in className replaces), overscroll kept inside the box,
// and an optional header that stays at the top while the rest scrolls under
// it.
//
// A box that scrolls must be reachable by keyboard, or a keyboard user cannot
// read what is below its fold (axe's scrollable-region-focusable), so the
// panel is a named region in the tab order: Tab reaches it, and the arrow,
// Page Up, Page Down, Home and End keys scroll it.
//
// The header is drawn over the top of the scrolling box, so a browser takes a
// control under it for one already in view and leaves it hidden there when
// the keyboard moves to it, as Shift+Tab does after a person scrolls a form
// down (WCAG 2.4.11, Focus Not Obscured). The panel's scroll padding is
// therefore the header's height and the reach of the focus ring, so the
// browser scrolls such a control out from under the header, ring and all. A
// caller's header can be any height and wraps on a phone or when the text is
// zoomed, so the height is read as the header is drawn and again whenever it
// changes, rather than written as a class.
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { ADMIN_SCROLL } from '@/lib/brand'
import { drawsNothing } from '@/lib/drawsNothing'
import { cn } from '@/lib/utils'

/**
 * How far a focus ring reaches outside its control, in pixels: the new
 * look's 2px gap and 2px line, which also covers today's 3px glow.
 */
const RING_REACH = 4

interface ScrollPanelProps {
  /** What the panel holds, as a screen reader names the region ("Setup steps"). */
  label: string
  /**
   * A header that stays at the top of the panel while its content scrolls.
   * One that draws nothing (false, blank text, an empty fragment), as
   * `header={cond && ...}` gives when cond is false, adds no header bar.
   */
  header?: ReactNode
  /** Classes for the panel itself; a max-h-* here replaces the 70vh bound. */
  className?: string
  children: ReactNode
}

export function ScrollPanel({ label, header, className, children }: ScrollPanelProps) {
  const panel = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  const hasHeader = !drawsNothing(header)

  // Keeps the scroll padding at the header's height and the ring's reach. It
  // is set on the element, not through React, so a change of the header's
  // height draws nothing again; with no header there is no padding.
  useLayoutEffect(() => {
    const box = panel.current
    const top = bar.current
    if (!box || !top) return
    const fit = () => {
      box.style.scrollPaddingTop = `${top.offsetHeight + RING_REACH}px`
    }
    fit()
    const watch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit)
    watch?.observe(top)
    return () => {
      watch?.disconnect()
      box.style.scrollPaddingTop = ''
    }
  }, [hasHeader])

  return (
    <div
      ref={panel}
      role="region"
      aria-label={label}
      tabIndex={0}
      data-slot="scroll-panel"
      className={cn(
        ADMIN_SCROLL,
        'rounded-lg border border-hairline bg-surface outline-none focus-visible:ring-3 focus-visible:ring-focus',
        className,
      )}
    >
      {hasHeader && (
        <div ref={bar} data-slot="scroll-panel-header" className="sticky top-0 z-10 border-b border-hairline bg-surface">
          {header}
        </div>
      )}
      {children}
    </div>
  )
}
