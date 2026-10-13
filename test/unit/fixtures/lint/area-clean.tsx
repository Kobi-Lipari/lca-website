// Lint fixture: area-boundaries.test.ts lints this text as if it sat at
// src/areas/admin/components/AreaClean.tsx and expects no problem at all. It
// imports its own area's files, other areas through their index.ts and
// api.ts, and the shared components and library, and calls no fetch.
// Nothing imports this file, and the default lint run skips it.
import { useEffect, useState } from 'react'
import { StatusBadge } from '@/components/StatusBadge'
import { ADMIN_PANEL_ROLES } from '@/areas/admin/roles'
import { ConfirmDialog } from '@/areas/admin/components/ConfirmDialog'
import { TOURNAMENT_STATUS } from '@/areas/events'
import { getTournaments } from '@/areas/events/api'
import { getClubs } from '@/areas/clubs/api'
import { cn } from '@/lib/utils'

export function AreaClean() {
  const [count, setCount] = useState(0)
  useEffect(() => {
    void Promise.all([getTournaments(), getClubs()]).then(([events, clubs]) => setCount(events.length + clubs.length))
  }, [])
  return (
    <div className={cn('p-4')}>
      <StatusBadge tone="muted">{`${count} ${Object.keys(TOURNAMENT_STATUS).length} ${ADMIN_PANEL_ROLES.length}`}</StatusBadge>
      <ConfirmDialog message="Remove?" onConfirm={() => setCount(0)} onCancel={() => setCount(count)} />
    </div>
  )
}
