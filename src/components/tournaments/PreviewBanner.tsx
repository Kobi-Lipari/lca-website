// src/components/tournaments/PreviewBanner.tsx
//
// Shown to directors and admins looking at an event that isn't public yet:
// the page looks exactly as visitors will see it, with this strip on top.
import { Link } from 'react-router-dom'
import { EyeOff } from 'lucide-react'

export function PreviewBanner({ tournamentId, visible }: { tournamentId: string; visible: number | boolean | undefined }) {
  if (visible === undefined || visible === null || Number(visible) === 1 || visible === true) return null
  return (
    <div className="border-b border-amber-300 bg-amber-50 text-amber-900 print:hidden">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-6 py-2 text-sm">
        <EyeOff className="size-4 flex-shrink-0" />
        <span><span className="font-semibold">Preview.</span> This event is hidden, so only directors and admins can see this page.</span>
        <Link to={`/admin/tournaments/${tournamentId}?tab=registration`} className="ml-auto font-medium underline underline-offset-2">
          Publish it
        </Link>
      </div>
    </div>
  )
}
