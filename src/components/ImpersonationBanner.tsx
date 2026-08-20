// src/components/ImpersonationBanner.tsx
import { useAuth } from '@/contexts/AuthContext'

export function ImpersonationBanner() {
  const { impersonating, exitImpersonation } = useAuth()
  if (!impersonating) return null

  return (
    <div className="flex items-center justify-center gap-3 bg-[#c8a94a] px-4 py-2 text-sm font-medium text-[#1a2744]">
      <span>
        Viewing as {impersonating.fullName} ({impersonating.email})
      </span>
      <button
        type="button"
        onClick={() => exitImpersonation()}
        className="rounded-md border border-[#1a2744]/30 px-2.5 py-0.5 text-xs font-semibold hover:bg-[#1a2744]/10"
      >
        Exit
      </button>
    </div>
  )
}