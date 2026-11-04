// src/components/ImpersonationBanner.tsx
//
// The banner is an opaque gold ground, so it carries data-ring-ground="gold":
// under the new look the Exit button's focus ring is navy in the light look
// and in dark mode alike, never gold on the gold (src/index.css).
import { useAuth } from '@/contexts/auth-context'

export function ImpersonationBanner() {
  const { impersonating, exitImpersonation } = useAuth()
  if (!impersonating) return null

  return (
    <div className="flex items-center justify-center gap-3 bg-lca-gold px-4 py-2 text-sm font-medium text-brand-navy" data-ring-ground="gold">
      <span>
        Viewing as {impersonating.fullName} ({impersonating.email})
      </span>
      <button
        type="button"
        onClick={() => exitImpersonation()}
        className="rounded-md border border-brand-navy/30 px-2.5 py-0.5 text-xs font-semibold hover:bg-brand-navy/10"
      >
        Exit
      </button>
    </div>
  )
}