// src/areas/admin/newsletter/AddEventForm.tsx
//
// "An event", from the Add menu: a small form on the page, under the tools, where the Link field opens, with no part of
// the page made inert. The person types the event and pastes its link; nothing is read from the site's calendar and no
// call is made (K's decisions 24, 26 and 67). Its words become one line in the letter (eventLine.ts), put in as a
// paragraph of its own after the block that holds the caret the letter kept, so no chosen words are written over and no
// heading or paragraph is cut in two; the caret then sits after it, and the letter saves itself as for any typing.
//
// It takes the focus into its first field when it opens, and again each time "An event" is chosen while it is open.
// Escape and Cancel close it and give the focus back to the Add button. A field it refuses says why in words beside it,
// tied to the field for a screen reader, and the focus goes to the first refused field, whose words are also said aloud
// in case the focus was there already. Every control is at least 44 pixels tall. Its words are kept by the editor, so
// the form closed by Link opens again as it was left; only adding the event, Cancel and Escape empty it.

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import type { Editor } from '@tiptap/react'
import { blockPlace } from './blockPlace'
import { checkEvent, eventLine, type EventField, type EventFields } from './eventLine'

const FIELD = 'h-11 rounded-lg border border-muted-foreground bg-background px-3 text-base font-normal text-ink outline-none focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-focus aria-invalid:border-destructive'
const LABEL = 'flex min-w-[min(100%,12rem)] flex-1 flex-col gap-1 text-sm font-semibold text-ink'

/** The fields in the form's order, with their labels, each a name and not an explanation. */
const FIELDS: { field: EventField; label: string; type: 'text' | 'date'; inputMode?: 'url' }[] = [
  { field: 'name', label: 'Event name', type: 'text' },
  { field: 'firstDay', label: 'First day', type: 'date' },
  { field: 'lastDay', label: 'Last day (if more than one)', type: 'date' },
  { field: 'place', label: 'Place', type: 'text' },
  { field: 'runBy', label: 'Run by', type: 'text' },
  { field: 'link', label: 'Link address', type: 'text', inputMode: 'url' },
  { field: 'linkWords', label: 'Link words', type: 'text' },
]

export function AddEventForm({ editor, id, values, onValues, opened, onClose }: {
  editor: Editor
  id: string
  values: EventFields
  onValues: (change: (now: EventFields) => EventFields) => void
  /** Counts each choice of "An event", so a second choice while the form is open still brings the focus in. */
  opened: number
  onClose: (to: 'add' | 'letter') => void
}) {
  const [refused, setRefused] = useState<Partial<Record<EventField, string>>>({})
  const [sayFirst, setSayFirst] = useState<EventField | null>(null)
  const inputs = useRef<Partial<Record<EventField, HTMLInputElement | null>>>({})
  const base = useId()

  useEffect(() => {
    inputs.current.name?.focus()
  }, [opened])

  function add() {
    const refusals = checkEvent(values)
    if (refusals.length > 0) {
      setRefused(Object.fromEntries(refusals.map((r) => [r.field, r.words])))
      setSayFirst(refusals[0].field)
      inputs.current[refusals[0].field]?.focus()
      return
    }
    const line = eventLine(values)
    if (!line) return
    // After the block that holds the caret (the whole list, for a caret in one), never over chosen words or inside a
    // heading, by the rule "A line" uses too (blockPlace.ts).
    editor.chain().focus().insertContentAt(blockPlace(editor.state.selection), line).run()
    onClose('letter')
  }

  function onKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onClose('add')
    }
  }

  return (
    <div
      id={id}
      role="group"
      aria-label="Add an event"
      className="flex flex-wrap items-start gap-3 border-x border-b border-border bg-background px-3 py-3"
      onKeyDown={onKey}
    >
      {FIELDS.map(({ field, label, type, inputMode }) => {
        const wrongId = `${base}-${field}-why`
        const why = refused[field]
        return (
          <div key={field} className={LABEL}>
            <label htmlFor={`${base}-${field}`}>{label}</label>
            <input
              ref={(element) => {
                inputs.current[field] = element
              }}
              id={`${base}-${field}`}
              type={type}
              inputMode={inputMode}
              autoComplete="off"
              value={values[field]}
              placeholder={field === 'link' ? 'https://' : undefined}
              aria-invalid={why ? true : undefined}
              aria-describedby={why ? wrongId : undefined}
              onChange={(event) => {
                const value = event.target.value
                onValues((now) => ({ ...now, [field]: value }))
                setRefused((now) => ({ ...now, [field]: undefined }))
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  add()
                }
              }}
              className={FIELD}
            />
            {why && (
              <p id={wrongId} role={field === sayFirst ? 'alert' : undefined} className="text-[0.9375rem] font-semibold text-destructive">
                {why}
              </p>
            )}
          </div>
        )
      })}
      {/* Level with the field beside them: a label's line and the gap under it are 1.5rem. */}
      <div className="flex flex-wrap gap-2 pt-6">
        <button type="button" onClick={add} className="inline-flex h-11 items-center rounded-lg border border-transparent bg-brand-navy px-4 text-[0.90625rem] font-semibold text-white outline-none focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-focus">
          Add the event
        </button>
        <button type="button" onClick={() => onClose('add')} className="inline-flex h-11 items-center rounded-lg px-3 text-[0.90625rem] font-semibold text-ink underline underline-offset-3 outline-none focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-focus">
          Cancel
        </button>
      </div>
    </div>
  )
}
