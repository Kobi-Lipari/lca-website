// src/components/ImpersonationBanner.tsx
import { useAuth } from '@/contexts/auth-context'

export function ImpersonationBanner() {
  const { impersonating, exitImpersonation } = useAuth()
  if (!impersonating) return null

  return (
    <div className="flex items-center justify-center gap-3 bg-lca-gold px-4 py-2 text-sm font-medium text-lca-navy">
      <span>
        Viewing as {impersonating.fullName} ({impersonating.email})
      </span>
      <button
        type="button"
        onClick={() => exitImpersonation()}
        className="rounded-md border border-lca-navy/30 px-2.5 py-0.5 text-xs font-semibold hover:bg-lca-navy/10"
      >
        Exit
      </button>
    </div>
  )
}