// src/contexts/auth-context.ts
//
// The context object and its hook, kept apart from the provider component.
// A module that exports both a component and a plain value loses Fast
// Refresh for the component, and AuthProvider is about the worst thing to
// lose it for: every edit to it remounts the whole tree and signs you out
// of the page you were testing. The type import below is erased at build,
// so this is not a runtime cycle.
import { createContext, useContext } from 'react'
import type { AuthContextValue } from './AuthContext'

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
