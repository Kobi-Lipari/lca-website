// src/areas/admin/components/FeeNotice.tsx
//
// The two fee notices of D24 on today's pages. G1 ("needs-account") is for
// someone who may not charge an entry fee yet and has typed a price above the
// one the page loaded: entry fees need a payout account first, with a way to
// keep the event at $0 and a way to ask LCA for the account. G2 ("accepted")
// sits under a standing director's fees and says where the money goes until a
// connected account exists. Both are information, never an error: navy words
// on the info tint, an "i" beside them, role note and no red. The words are
// K's, as brief 1.4 gives them, word for word. The callers read
// standingDirectors; this component reads no switch.
//
// The ask is the Button's gold variant. It is disabled from the press until
// its promise settles, so a double tap asks once, and once the caller says
// the request went (asked), it reads "Asked. LCA has your request." and stays
// disabled. A failed ask leaves it free to press again: the caller draws the
// failure and rejects the promise, and the focus goes back to the ask once
// it is free, since the press disabled it and a disabled button cannot keep
// the focus. Once the request has gone the focus moves to Keep it at $0, for
// the same reason. Keep it at $0 tells the caller whether the press came
// from the keyboard (a click whose detail is 0), so the caller moves the
// focus into a price box only then: a tap or a mouse press would open the
// number keyboard on a tablet. Both buttons wrap their words and shrink
// with the panel, so on a narrow screen neither runs past its edge and the
// page never scrolls sideways (WCAG 2.2, 1.4.10, reflow).
//
// G1's panel appears as a price is typed, or when the server refuses a save,
// and a note is not read out when it appears, so FeeNoticeStatus gives the
// caller a polite status line, visually hidden, that holds G1's title while
// the panel shows: a screen reader says it without the focus moving (WCAG
// 2.2, 4.1.3, status messages). After a failed ask the line says the
// failure's words, the ones the page's error line draws, until the next
// press.
import { useEffect, useId, useRef, useState } from 'react'
import { Info } from 'lucide-react'

import { Button } from '@/components/ui/button'

/** The info tint with the navy ink, in every look (the partner tag's tint and ink under the new look). */
const PANEL = 'rounded-lg border border-info-200 bg-info-50 px-4 py-3 text-sm text-ink'

/** G1's title, K's words: the panel's heading, and what FeeNoticeStatus says while the panel shows. */
const NEEDS_ACCOUNT_TITLE = 'Entry fees need a payout account first'

/**
 * G1's two buttons on a narrow screen: the words wrap and the button is never wider than the panel, so at 320 CSS px neither crosses
 * the panel's edge. One line keeps the Button's own height; a wrapped label grows the button, with a little room above and below.
 */
const WRAPS = 'h-auto min-h-8 max-w-full whitespace-normal py-1 text-left'

export interface FeeNoticeProps {
  /** needs-account: G1, the payout account comes first. accepted: G2, a standing director's fee is taken. */
  kind: 'needs-account' | 'accepted'
  /** G1's "Keep it at $0": the caller puts back the prices the page loaded; fromKeyboard is true for a press from the keyboard, when the caller may move the focus. */
  onKeepFree?: (fromKeyboard: boolean) => void
  /** G1's ask: the caller sends the payout request, once per press, and draws a failure itself; its promise rejects when the ask failed, so the focus goes back to the ask. */
  onAskForAccount?: () => Promise<void> | void
  /** Whether the request has gone; the ask then reads as done and stays disabled. */
  asked?: boolean
}

export function FeeNotice({ kind, onKeepFree, onAskForAccount, asked = false }: FeeNoticeProps) {
  const titleId = useId()
  const [pending, setPending] = useState(false)
  // A second press can arrive before the first one's render disables the
  // button, so the press itself is held here as well as in state.
  const inFlight = useRef(false)
  /** Keep it at $0, which takes the focus once the ask has gone and the ask's button stays disabled. */
  const keepButton = useRef<HTMLButtonElement>(null)
  /** Set by a press of the ask, so that only an ask made here moves the focus, never a panel drawn already asked. */
  const pressed = useRef(false)
  useEffect(() => {
    if (asked && pressed.current) {
      pressed.current = false
      keepButton.current?.focus()
    }
  }, [asked])
  /** The ask's button, which takes the focus back after a failed ask. */
  const askButton = useRef<HTMLButtonElement>(null)
  // Failed asks are counted, and the count changes in the same render that
  // frees the button, so the focus goes back to it once it can take it.
  const [failures, setFailures] = useState(0)
  useEffect(() => {
    if (failures > 0) askButton.current?.focus()
  }, [failures])

  async function ask() {
    if (inFlight.current || asked) return
    inFlight.current = true
    pressed.current = true
    setPending(true)
    try {
      await onAskForAccount?.()
    } catch {
      pressed.current = false
      // The caller draws its own failure; the button is free to press again.
      setFailures((n) => n + 1)
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }

  if (kind === 'accepted') {
    return (
      <div role="note" className={PANEL}>
        <div className="flex gap-3">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <p>
            You can charge an entry fee. Fees are paid into LCA's Stripe account. To have them paid straight to you, LCA sets up a
            connected account for you inside its Stripe account (Stripe Connect), so your event's money stays apart from LCA's. Until
            then, your fees wait in LCA's account and are paid out to you after the event.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div role="note" aria-labelledby={titleId} className={PANEL}>
      <div className="flex gap-3">
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0 space-y-3">
          <h3 id={titleId} className="font-semibold">{NEEDS_ACCOUNT_TITLE}</h3>
          <p>
            LCA takes entry fees through its own Stripe account. Before your event can charge a fee, LCA sets up an account for you
            inside LCA's Stripe account, called a connected account (Stripe Connect). It keeps your event's money apart from LCA's and
            pays it out to you. Until then, your event can run at $0.
          </p>
          <div className="flex flex-wrap gap-2" aria-live="polite">
            <Button ref={keepButton} type="button" variant="outline" className={WRAPS} onClick={(event) => onKeepFree?.(event.detail === 0)}>
              Keep it at $0
            </Button>
            <Button ref={askButton} type="button" variant="gold" className={WRAPS} disabled={pending || asked} onClick={ask}>
              {asked ? 'Asked. LCA has your request.' : 'Ask LCA to set up my payout account'}
            </Button>
          </div>
          <p>Who can charge fees for now: LCA admins, club reps, the president and standing directors.</p>
        </div>
      </div>
    </div>
  )
}

/**
 * The line a screen reader hears when G1's panel shows: a polite status line, visually hidden, empty until `shows` is true and then
 * holding the panel's title, K's words, so the change is announced and the focus stays where it is. A live region is read out only
 * when what it holds changes, so the caller draws this line from before the panel can show, once for every place the panel may take,
 * and passes whether the panel shows. It takes no space, and drawn first in its container it changes no other child's spacing, so
 * nothing on the page moves. After a failed ask the caller passes `failure`, the words its error line draws, which the line says in
 * the title's place while the panel shows, so the failure is heard with no new words on the page; the caller clears them at the next
 * press.
 */
export function FeeNoticeStatus({ shows, failure = null }: { shows: boolean; failure?: string | null }) {
  return (
    <p role="status" aria-live="polite" className="sr-only">
      {shows ? failure || NEEDS_ACCOUNT_TITLE : ''}
    </p>
  )
}
