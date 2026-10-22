// src/hooks/useViewOnly.ts
//
// Whether the signed-in member is an LCA Observer ("view only") on the admin
// screens. The server refuses every change an observer attempts; screens use
// this to disable their controls instead of letting clicks fail. The
// fieldset and note that use it are in src/lib/viewOnly.tsx.
import { useAuth } from '@/contexts/auth-context'
import { isViewOnlyAdmin } from '@/areas/admin/roles'

export function useViewOnly(): boolean {
  const { role } = useAuth()
  return isViewOnlyAdmin(role)
}
