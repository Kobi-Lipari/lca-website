// src/components/DonateButton.tsx
//
// The donation dialog: an amount, then Stripe's checkout for it. The new
// header opens it from its Donate button, and from the About menu's Donate
// row when the bar is too tight to hold the button, until the Give page
// exists behind newMembership; DonateButton is the dialog with its own
// trigger, as it has always been drawn.
//
// The dialog sends the donor to the checkout in the same tab. It used to
// open the checkout in a new tab once the request came back, and browsers,
// phones above all, block a new tab that is not opened straight from the
// tap; with noopener the call says nothing either way, so the dialog closed
// and nothing happened. The membership and household checkouts hand off the
// same way. Stripe sends the donor back to /donate/success, or to the home
// page if they cancel.
//
// A donor who closes the dialog while the checkout is being asked for has
// changed their mind: when the answer comes, the tab stays where it is and
// the button is theirs again. The same holds if the dialog leaves the page.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { createDonationCheckout } from '@/lib/api'

/** Sends the donor to the payment page in this tab. */
function sameTab(url: string) {
  window.location.assign(url)
}

export interface DonateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** A control that opens the dialog, drawn as its own trigger. */
  trigger?: ReactNode
  /**
   * Where the focus goes when the dialog closes, when that is not its
   * trigger: the control that opened it, such as the About menu's button
   * once the menu's Donate row is gone.
   */
  returnFocus?: () => HTMLElement | null
  /** Hands the donor to the payment page; the same tab, unless a test hands in its own. */
  handOff?: (url: string) => void
}

export function DonateDialog({ open, onOpenChange, trigger, returnFocus, handOff = sameTab }: DonateDialogProps) {
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /**
   * Set when the dialog is closed, or leaves the page, so a checkout asked
   * for before then sends the donor nowhere; each press of Continue to
   * payment clears it.
   */
  const dropped = useRef(false)

  // A donor who comes back with the browser's Back button gets the page as
  // they left it, kept by the browser, waiting on the checkout; the button
  // is given back to them then.
  useEffect(() => {
    function onShow(event: PageTransitionEvent) {
      if (event.persisted) setLoading(false)
    }
    window.addEventListener('pageshow', onShow)
    return () => window.removeEventListener('pageshow', onShow)
  }, [])

  // The dialog leaving the page drops a checkout still on its way.
  useEffect(() => {
    return () => {
      dropped.current = true
    }
  }, [])

  function changeOpen(next: boolean) {
    if (!next) dropped.current = true
    onOpenChange(next)
  }

  async function handleDonate() {
    const parsed = Number(amount)
    if (!amount || isNaN(parsed) || parsed < 1) {
      setError('Please enter an amount of at least $1')
      return
    }

    dropped.current = false
    setLoading(true)
    setError(null)
    try {
      const checkout = await createDonationCheckout(parsed)
      // Closed while the checkout was asked for: the donor stays where they
      // are, and the button is theirs again.
      if (dropped.current) {
        setLoading(false)
        return
      }
      // The page leaves for the checkout: the dialog stays as it is, saying
      // "Starting checkout…", until it has gone.
      handOff(checkout.paymentUrl)
    } catch (err) {
      // A failure the donor no longer waits for is not shown when the dialog
      // is opened again.
      if (!dropped.current) setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        className="sm:max-w-sm"
        onCloseAutoFocus={(event) => {
          const to = returnFocus?.()
          if (!to || !to.isConnected) return
          event.preventDefault()
          // Without scrolling, as the dialog's own focus moves are made: the
          // control named is in a bar fixed to the top of the window, and the
          // page's scroll padding would otherwise move the page under it.
          to.focus({ preventScroll: true })
        }}
      >
        <DialogHeader>
          <DialogTitle>Support the Louisiana Chess Association</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <p className="text-sm text-muted-foreground">
            Your donation helps fund scholastic programs, tournaments, and chess access across Louisiana.
          </p>
          <div>
            <Label htmlFor="donation-amount" className="text-xs">Amount (USD)</Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <Input
                id="donation-amount"
                type="number"
                min="1"
                step="1"
                placeholder="25"
                className="pl-6"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            type="button"
            className="w-full bg-lca-gold font-semibold text-brand-navy hover:bg-lca-gold/90"
            disabled={loading}
            onClick={handleDonate}
          >
            {loading ? 'Starting checkout…' : 'Continue to payment'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function DonateButton() {
  const [open, setOpen] = useState(false)
  return (
    <DonateDialog
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button type="button" variant="outline" size="sm">
          <Heart className="mr-1.5 size-3.5" />
          Donate
        </Button>
      }
    />
  )
}
