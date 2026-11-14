// src/areas/admin/newsletter/InThisIssue.tsx
//
// "In this issue" on the letter (board Newsletter-Page-4, P6; the strip of
// board Newsletter-Email-6), made from the letter's headings as they are
// typed by letterParts, the function the email's own strip is made with,
// and never typed itself. Like the email, it is left out while the letter
// has fewer than two parts. Its parts run down the first column and then
// the second, so the reading order is the order of the parts. Each moves
// the caret to the start of its part. The board's line beside it, "Made
// from your headings. Updates by itself.", only explains, so it is not on
// the page (K's decision 40).

import type { LetterPart } from '@domain/mail/letter'

export interface InThisIssueProps {
  parts: readonly LetterPart[]
  /** Moves the caret to the start of the part at this place among the parts. */
  onGo: (index: number) => void
}

export function InThisIssue({ parts, onGo }: InThisIssueProps) {
  if (parts.length < 2) return null
  const rows = Math.ceil(parts.length / 2)
  return (
    <nav aria-label="In this issue" className="bg-surface">
      <div className="border-b border-lca-gold/30 bg-lca-gold/10 px-5 pb-[22px] pt-5 font-sans sm:px-[52px]">
        <p className="text-[13px] font-bold uppercase leading-tight tracking-[0.12em] text-gold-ink-badge">In this issue</p>
        <ul
          className="mt-2.5 grid grid-flow-col grid-cols-2 gap-x-8 gap-y-0.5"
          style={{ gridTemplateRows: `repeat(${rows}, auto)` }}
        >
          {parts.map((part, index) => (
            <li key={part.name}>
              <button
                type="button"
                onClick={() => onGo(index)}
                className="min-h-8 rounded-sm text-left text-base font-medium leading-normal text-ink underline underline-offset-3 outline-none hover:decoration-2 focus-visible:ring-3 focus-visible:ring-focus"
              >
                {part.title}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}
