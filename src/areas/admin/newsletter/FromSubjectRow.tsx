// src/areas/admin/newsletter/FromSubjectRow.tsx
//
// From and Subject, an email's own labelled boxes on one row above the
// letter's tools (board Newsletter-Page-4, P2 and P4; K's decision 48), each
// shown whole, and stacked when the row has no room for both.
//
// - From shows the one sender as a name, never an address, with no list to
//   open until there is a second sender (the plan's deviation for P3): the
//   newsletter's display name from domain/mail/addresses.ts beside the
//   newsletter's own name.
// - Subject is a field with its pencil mark. Clicked, it is outlined and
//   shows its count, "30 of 60 letters", under the field at its right, as
//   board P4 draws it, a guide to what an inbox shows that never stops the
//   typing; the server's limit is 200 characters, and a refusal, if it ever
//   comes, is shown in the server's words by the saved line. The count's
//   line under the row is kept at all times, so the field keeps its whole
//   width while the count shows, nothing moves when it appears, and it
//   never covers the tools below. Characters the server would refuse (line
//   breaks, tabs, other control characters and the nine that force a line's
//   direction) are dropped as they are typed or pasted, so nobody is asked
//   to find one.

import { useId, useState } from 'react'
import { Pencil } from 'lucide-react'
import { LIST_SENDERS, SENDER_NAME } from '@domain/mail/addresses'
import { NEWSLETTER_LIST_ID } from '@domain/mail/lists'
import { cn } from '@/lib/utils'
import { SUBJECT_GUIDE, keepVisible } from './letterRules'

/** The newsletter's name beside its sender, as the board writes it: the words every subject starts with. */
const NEWSLETTER_NAME = 'LCA Newsletter'

/** The sender as the From box shows it: a name, never an address. */
const FROM_WORDS = `${LIST_SENDERS[NEWSLETTER_LIST_ID]?.name ?? SENDER_NAME} · ${NEWSLETTER_NAME}`

/** One of the two boxes: its label on a quiet ground at the left, then what it holds. */
const BOX = 'flex min-h-[46px] min-w-0 items-stretch overflow-hidden rounded-lg border border-muted-foreground bg-background text-ink'
const LABEL = 'flex flex-none items-center border-r border-border bg-muted px-2.5 text-[13.5px] font-semibold text-ink'

export interface FromSubjectRowProps {
  subject: string
  onSubjectChange: (subject: string) => void
  /** Always stacked, and held to the letter's width, as on the letter that fills the window. */
  stacked?: boolean
}

export function FromSubjectRow({ subject, onSubjectChange, stacked = false }: FromSubjectRowProps) {
  const [counting, setCounting] = useState(false)
  const subjectId = useId()
  const countId = useId()
  const letters = [...subject].length
  return (
    <div
      role="group"
      aria-label="Who it is from and its subject"
      // The bottom room is the count's line: the count is drawn in it, under the Subject, and the tools start below it.
      className={cn('grid gap-2 pb-[18px]', stacked ? 'mx-auto w-full max-w-[1200px]' : '@3xl:grid-cols-[max-content_minmax(0,1fr)]')}
    >
      <p className={BOX}>
        <span className={LABEL}>From</span>
        {/* Shown whole: on a narrow window the name runs on to a second line rather than being cut. */}
        <span className="flex min-w-0 items-center px-2.5 py-2 text-base leading-snug">{FROM_WORDS}</span>
      </p>
      <div className="relative flex min-w-0 flex-col">
        {/* The box is the field's to press anywhere; its name is the label alone, so the count is said as its description. */}
        <div
          className={cn(BOX, 'flex-1 cursor-text focus-within:border-ink focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ink')}
          onMouseDown={(event) => {
            // A press on the label or the pencil leaves the caret after the last word, as the board draws it.
            const input = event.currentTarget.querySelector('input')
            if (input && event.target !== input) {
              event.preventDefault()
              input.focus()
              input.setSelectionRange(input.value.length, input.value.length)
            }
          }}
        >
          <label htmlFor={subjectId} className={cn(LABEL, 'cursor-text')}>Subject</label>
          <input
            id={subjectId}
            type="text"
            value={subject}
            spellCheck
            autoComplete="off"
            aria-describedby={countId}
            onFocus={() => setCounting(true)}
            onBlur={() => setCounting(false)}
            onChange={(event) => onSubjectChange(keepVisible(event.target))}
            className="min-w-0 flex-1 bg-transparent px-2.5 text-base text-ink outline-none"
            // The box around the field draws the focus, round the label and the pencil, so the new look's own ring,
            // drawn round the field itself, would be a second ring inside it; only a style on the field turns it off.
            style={{ outline: 'none' }}
          />
          <span className="flex flex-none items-center pl-1 pr-3" aria-hidden="true">
            <Pencil className="size-4" />
          </span>
        </div>
        {/*
          Under the field at its right, as board P4 draws it, so the field keeps its whole width while it shows. It is on
          the desk's tint, where the site's quiet grey is under 4.5 to 1 in today's look, so it takes the words' own colour.
        */}
        <span
          id={countId}
          hidden={!counting}
          className="pointer-events-none absolute right-0.5 top-full mt-1.5 whitespace-nowrap text-[13.5px] leading-4 text-ink"
        >
          {letters} of {SUBJECT_GUIDE} letters
        </span>
      </div>
    </div>
  )
}
