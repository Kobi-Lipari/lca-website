// src/lib/viewOnly.tsx
//
// LCA Observer ("view only") support for the admin screens. The server
// refuses every change an observer attempts; this just keeps the screens
// honest by disabling the controls instead of letting clicks fail. Whether
// the member is an observer comes from useViewOnly (src/hooks/useViewOnly.ts),
// unless the screen passes viewOnly itself: the manage page does, since an
// observer who directs the event may change it.
import type { ReactNode } from 'react'

import { useViewOnly } from '@/hooks/useViewOnly'

/**
 * Disables every input, select and button inside it for observers (links
 * still work). For everyone else it renders its children unchanged. When
 * viewOnly is passed, it replaces the hook's answer.
 */
export function ViewOnlyFieldset({ children, viewOnly: given }: { children: ReactNode; viewOnly?: boolean }) {
  const byRole = useViewOnly()
  const viewOnly = given ?? byRole
  if (!viewOnly) return <>{children}</>
  return (
    <fieldset disabled className="m-0 min-w-0 border-0 p-0">
      {children}
    </fieldset>
  )
}

/**
 * A small note shown at the top of screens an observer can't change. When
 * viewOnly is passed, it replaces the hook's answer.
 */
export function ViewOnlyNote({ children, viewOnly: given }: { children?: ReactNode; viewOnly?: boolean }) {
  const byRole = useViewOnly()
  const viewOnly = given ?? byRole
  if (!viewOnly) return null
  return (
    <p className="mb-4 rounded-lg border border-ink/15 bg-ink/[0.04] px-3 py-2 text-xs text-ink">
      {children ?? 'View only: you can see everything here, but changes are made by LCA admins.'}
    </p>
  )
}
