// src/areas/clubs/components/MonthlyCheckButton.tsx
//
// "Send this month's check now", the LCA admin's button in My region (WS09
// step 14), drawn for an LCA admin alone. It is how the monthly check goes
// out until the five-minute run sends it on the first Monday, and a way to
// send it again: every press sends to everyone.
//
// A press first asks the server how many people the check goes to, then
// asks one plain question that names that number, in a dialog built from the
// site's own dialog parts as Confirm all's is; Cancel or Escape leaves
// everything as it was and puts the focus back on the button. Sending says
// afterwards, in the one status line, how many were sent and how many were
// not. A refusal, an LCA admin's missing second factor among them, is said
// in the server's own words, plainly. Its two calls live in
// src/areas/clubs/api.ts.
//
// "Not sent" is said only of a refusal in the server's own words, with a
// status below 500: the server refuses before it sends anything. A press
// takes many seconds, one email after another, so any other failure (a
// dropped connection, a 5xx, an answer that could not be read) may have come
// part way through the sends, and the words say so, since pressing again
// sends to everyone again (sendFailedWords in src/areas/clubs/region.ts).
import { useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'

import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { countMonthlyCheck, sendMonthlyCheck } from '@/lib/api'
import { askFailedWords, peopleWord, sendFailedWords, sentWords } from '@/areas/clubs/region'

const CONTROL = 'min-h-11 px-4 whitespace-normal'

export function MonthlyCheckButton() {
  const [people, setPeople] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState('')

  async function ask() {
    if (busy) return
    setBusy(true)
    setSaid('')
    try {
      const count = await countMonthlyCheck()
      if (count.people === 0) setSaid('No one holds a regional seat that keeps a club, so the check has no one to go to.')
      else setPeople(count.people)
    } catch (err) {
      setSaid(askFailedWords(err))
    } finally {
      setBusy(false)
    }
  }

  async function send() {
    setPeople(null)
    setBusy(true)
    setSaid('Sending this month\'s check…')
    try {
      setSaid(sentWords(await sendMonthlyCheck()))
    } catch (err) {
      setSaid(sendFailedWords(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="monthly-check-title" className="space-y-2 rounded-lg border border-hairline bg-card p-4 text-sm text-ink">
      <h2 id="monthly-check-title" className="font-semibold">Monthly check</h2>
      <Dialog open={people !== null} onOpenChange={(open) => { if (!open) setPeople(null) }}>
        {/* The dialog's trigger, so Cancel and Escape put the focus back on it; the question opens once the count is in. */}
        <DialogTrigger asChild>
          <Button
            type="button"
            className={CONTROL}
            aria-disabled={busy || undefined}
            onClick={(e) => { e.preventDefault(); void ask() }}
          >
            Send this month's check now
          </Button>
        </DialogTrigger>
        <DialogPortal>
          <DialogOverlay />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border bg-background p-6 text-ink shadow-lg outline-none"
          >
            <DialogTitle className="break-words text-lg font-semibold leading-snug">
              Send this month's check to {peopleWord(people ?? 0)} now?
            </DialogTitle>
            <div className="flex flex-wrap justify-end gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline" className={CONTROL}>Cancel</Button>
              </DialogClose>
              <Button type="button" className={CONTROL} onClick={() => { void send() }}>
                Send to {peopleWord(people ?? 0)}
              </Button>
            </div>
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>
      <p role="status" className="min-w-0 break-words">{said}</p>
    </section>
  )
}
