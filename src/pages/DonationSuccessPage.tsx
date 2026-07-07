// src/pages/DonationSuccessPage.tsx
import { Link } from 'react-router-dom'
import { Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePageTitle } from '@/hooks/usePageTitle'

export function DonationSuccessPage() {
  usePageTitle('Thank You')
  return (
    <div className="mx-auto max-w-lg px-6 py-16 text-center">
      <Heart className="mx-auto size-10 text-[#c8a94a]" />
      <h1 className="mt-4 text-2xl font-bold text-[#1a2744]">Thank you for your donation!</h1>
      <p className="mt-2 text-muted-foreground">
        Your support helps grow chess across Louisiana. A receipt has been sent to your email by Stripe.
      </p>
      <Button asChild className="mt-6 bg-[#c8a94a] font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90">
        <Link to="/">Return home</Link>
      </Button>
    </div>
  )
}