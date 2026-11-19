// src/areas/admin/newsletter/blockPlace.ts
//
// Where a block of its own goes in the letter from the Add menu (an event's line, or a line across): after the
// top-level block that holds the end of the selection the letter kept, so no chosen words are written over and no
// heading, paragraph or list is cut in two. An empty paragraph there, as in an empty letter, is replaced rather than
// left above the new block. A selection with no block round it (a line across chosen whole) puts it just after.
//
// One rule for both, kept here with no React so the two cannot drift apart.
import type { Editor } from '@tiptap/react'

/** A position to insert at, or an empty paragraph's range to replace. */
export type BlockPlace = number | { from: number; to: number }

export function blockPlace(selection: Editor['state']['selection']): BlockPlace {
  const { $to } = selection
  const block = $to.depth > 0 ? $to.node(1) : null
  if (!block) return $to.pos
  if (block.isTextblock && block.content.size === 0) return { from: $to.before(1), to: $to.after(1) }
  return $to.after(1)
}
