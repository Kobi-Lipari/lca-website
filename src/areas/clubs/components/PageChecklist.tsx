// src/areas/clubs/components/PageChecklist.tsx
//
// The page's checklist in the club editor's preview column: how the club
// meets in its own words, a place pinned on the map, the email for messages,
// a logo and a colour (a photo joins with the club's photos, in a later
// step), each with its state in words, "Done" or "Not yet", and the count
// done. The marks beside them are drawn for the eye alone; the words carry
// the state, and no colour does.
import { Circle, CircleCheck } from 'lucide-react'

import type { ChecklistItem } from '@/areas/clubs/previews'

export function PageChecklist({ items }: { items: ChecklistItem[] }) {
  const done = items.filter((i) => i.done).length
  return (
    <section aria-labelledby="preview-checklist-title" className="space-y-2">
      <h3 id="preview-checklist-title" className="text-sm font-semibold text-ink">Your page's checklist</h3>
      <p className="text-sm text-ink">{done} of {items.length} done</p>
      <ul className="space-y-1.5 text-sm text-ink">
        {items.map((item) => (
          <li key={item.label} className="flex items-start gap-2">
            {item.done
              ? <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              : <Circle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
            <span>
              {item.label}<span className="sr-only">:</span>{' '}
              <span className="font-medium">{item.done ? 'Done' : 'Not yet'}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
