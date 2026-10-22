// Lint fixture: area-boundaries.test.ts lints this text as if it sat at
// src/pages/PageCallsFetchPage.tsx. Each of the three calls below must be a
// warning: a page gets its data through an area's api module. Nothing
// imports this file, and the default lint run skips it.
import { useEffect } from 'react'

export function PageCallsFetchPage() {
  useEffect(() => {
    void fetch('/api/clearinghouse?upcoming=true')
    void window.fetch('/api/clearinghouse?upcoming=false')
    void globalThis.fetch('/api/tournaments')
  }, [])
  return null
}
