import { useState } from 'react'
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

export function DonateButton() {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDonate() {
    const parsed = Number(amount)
    if (!amount || isNaN(parsed) || parsed < 1) {
      setError('Please enter an amount of at least $1')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const checkout = await createDonationCheckout(parsed)
      window.open(checkout.paymentUrl, '_blank', 'noopener,noreferrer')
      setOpen(false)
      setAmount('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Heart className="mr-1.5 size-3.5" />
          Donate
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
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
            className="w-full bg-[#c8a94a] font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90"
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