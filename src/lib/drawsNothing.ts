// src/lib/drawsNothing.ts
//
// Whether a React node draws nothing on the page: nothing at all, a
// boolean, text that is only spaces, or a list or a fragment holding only
// those. A caller's `{cond && <p>...</p>}` or `<>{opensOn && ...}</>` gives
// such a node when its condition fails, so a component that wraps
// what it is given in a box, or falls back to words of its own, asks this
// first: ScrollPanel draws no empty header bar, and a status tag never
// shows its mark without words. Any other element counts as drawing
// something, since what a component draws is known only when it renders.
import { Fragment, isValidElement, type ReactNode } from 'react'

export function drawsNothing(node: ReactNode): boolean {
  if (node === null || node === undefined || typeof node === 'boolean') return true
  if (typeof node === 'string') return node.trim() === ''
  if (Array.isArray(node)) return node.every(drawsNothing)
  if (isValidElement<{ children?: ReactNode }>(node) && node.type === Fragment) return drawsNothing(node.props.children)
  return false
}
