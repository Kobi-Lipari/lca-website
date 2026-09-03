import { Link } from 'react-router-dom'
import { Home } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { usePageTitle } from '@/hooks/usePageTitle'

export function NotFoundPage() {
  usePageTitle('Page Not Found')

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-6 py-24 text-center">
      <p className="text-6xl font-bold text-[#1a2744]">404</p>
      <h1 className="mt-4 text-2xl font-bold text-[#1a2744]">Page not found</h1>
      <p className="mt-2 text-muted-foreground">
        The page you are looking for does not exist or may have been moved.
      </p>
      <Button asChild className="mt-8 bg-[#c8a94a] font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90">
        <Link to="/">
          <Home className="size-4" />
          Back to home
        </Link>
      </Button>
    </div>
  )
}
