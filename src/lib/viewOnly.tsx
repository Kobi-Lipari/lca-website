// src/lib/viewOnly.tsx
//
// LCA Observer ("view only") support for the admin screens. The server
// refuses every change an observer attempts; this just keeps the screens
// honest by disabling the controls instead of letting clicks fail.
import type { ReactNode } from 'react'

import { useAuth } from '@/contexts/auth-context'
import { isViewOnlyAdmin } from '@/lib/roles'

export function useViewOnly(): boolean {
  const { role } = useAuth()
  return isViewOnlyAdmin(role)
}

/**
 * Disables every input, select and button inside it for observers (links
 * still work). For everyone else it renders its children unchanged.
 */
export function ViewOnlyFieldset({ children }: { children: ReactNode }) {
  const viewOnly = useViewOnly()
  if (!viewOnly) return <>{children}</>
  return (
    <fieldset disabled className="m-0 min-w-0 border-0 p-0">
      {children}
    </fieldset>
  )
}

/** A small note shown at the top of screens an observer can't change. */
export function ViewOnlyNote({ children }: { children?: ReactNode }) {
  const viewOnly = useViewOnly()
  if (!viewOnly) return null
  return (
    <p className="mb-4 rounded-lg border border-lca-navy/15 bg-lca-navy/[0.04] px-3 py-2 text-xs text-lca-navy">
      {children ?? 'View only: you can see everything here, but changes are made by LCA admins.'}
    </p>
  )
}
