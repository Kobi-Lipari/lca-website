// src/areas/clubs/components/OverdueSuggestionsButton.tsx
//
// "Send overdue suggestions on", the LCA admin's button in My region (WS09
// step 29), drawn for an LCA admin alone, under the heading of the to-do
// list, and only while a suggestion there has waited 14 days or more with no
// answer and has not been passed on yet. It is how such a suggestion reaches
// the LCA admins, and the region's representatives when the club's rep had
// it, until the daily run sends it on by itself.
//
// A press first asks the server how many are waiting, then asks one plain
// question that names that number, in a dialog built from the site's own
// dialog parts as the monthly check's is; Cancel or Escape leaves everything
// as it was and puts the focus back on the button. Send on closes the
// dialog, which puts the focus back on the button, and the status beside
// the button says what happened in words: how many were passed on, how many
// emails went and how many did not. The page then reads its answer again, so
// each row passed on shows when it was. Its two calls live in
// src/areas/clubs/api.ts.
import { useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'

import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { countOverdueSuggestions, sendOverdueSuggestions } from '@/lib/api'
import {
  NONE_DUE, OVERDUE_BUTTON, OVERDUE_SEND, OVERDUE_SENDING, overdueAskFailedWords, overdueQuestion, overdueSendFailedWords, overdueSentWords,
} from '@/areas/clubs/overdueWords'

const CONTROL = 'min-h-11 px-4 whitespace-normal'

export function OverdueSuggestionsButton({ onSent }: {
  /** A press has sent: the page reads its answer again. */
  onSent: () => void
}) {
  const [due, setDue] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState('')

  async function ask() {
    if (busy) return
    setBusy(true)
    setSaid('')
    try {
      const count = await countOverdueSuggestions()
      if (count.due === 0) setSaid(NONE_DUE)
      else setDue(count.due)
    } catch (err) {
      setSaid(overdueAskFailedWords(err))
    } finally {
      setBusy(false)
    }
  }

  async function send() {
    setDue(null)
    setBusy(true)
    setSaid(OVERDUE_SENDING)
    try {
      setSaid(overdueSentWords(await sendOverdueSuggestions()))
      onSent()
    } catch (err) {
      setSaid(overdueSendFailedWords(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <Dialog open={due !== null} onOpenChange={(open) => { if (!open) setDue(null) }}>
        {/* The dialog's trigger, so Cancel, Escape and Send on put the focus back on it; the question opens once the count is in. */}
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={CONTROL}
            aria-disabled={busy || undefined}
            onClick={(e) => { e.preventDefault(); void ask() }}
          >
            {OVERDUE_BUTTON}
          </Button>
        </DialogTrigger>
        <DialogPortal>
          <DialogOverlay />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border bg-background p-6 text-ink shadow-lg outline-none"
          >
            <DialogTitle className="break-words text-lg font-semibold leading-snug">
              {overdueQuestion(due ?? 0)}
            </DialogTitle>
            <div className="flex flex-wrap justify-end gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline" className={CONTROL}>Cancel</Button>
              </DialogClose>
              <Button type="button" className={CONTROL} onClick={() => { void send() }}>
                {OVERDUE_SEND}
              </Button>
            </div>
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>
      <p role="status" className="min-w-0 break-words text-sm text-ink">{said}</p>
    </div>
  )
}
