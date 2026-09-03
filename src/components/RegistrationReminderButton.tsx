// src/components/RegistrationReminderButton.tsx
//
// Same feature as the inline Bell/BellOff toggle already on
// TournamentDetailPage (handleToggleReminder) — extracted here so
// TournamentsPage's list/calendar detail pane can offer it too, without
// duplicating that logic inline. Uses the existing api.ts functions;
// no new backend needed.

import { useEffect, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import {
  getTournamentReminderStatus,
  optInTournamentReminder,
  optOutTournamentReminder,
} from '@/lib/api'

interface RegistrationReminderButtonProps {
  tournamentId: string
}

export function RegistrationReminderButton({ tournamentId }: RegistrationReminderButtonProps) {
  const { user } = useAuth()
  const [optedIn, setOptedIn] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!user) {
      setOptedIn(false)
      return
    }
    let cancelled = false
    getTournamentReminderStatus(tournamentId)
      .then((s) => {
        if (!cancelled) setOptedIn(s.opted_in)
      })
      .catch(() => {
        if (!cancelled) setOptedIn(false)
      })
    return () => {
      cancelled = true
    }
  }, [tournamentId, user])

  async function toggle() {
    if (!user) return
    setBusy(true)
    try {
      if (optedIn) {
        await optOutTournamentReminder(tournamentId)
        setOptedIn(false)
      } else {
        await optInTournamentReminder(tournamentId)
        setOptedIn(true)
      }
    } catch {
      // matches TournamentDetailPage's existing silent-fail behavior
    } finally {
      setBusy(false)
    }
  }

  if (!user) {
    return (
      <p className="text-xs text-muted-foreground">
        <a href="/login" className="text-lca-navy hover:underline">
          Log in
        </a>{' '}
        to get notified when registration opens.
      </p>
    )
  }

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={optedIn === null || busy}
      onClick={toggle}
      className="h-7 gap-1.5 text-xs"
    >
      {optedIn ? <BellOff className="size-3.5" /> : <Bell className="size-3.5 text-lca-gold" />}
      {optedIn ? 'Remove notification' : 'Notify me when it opens'}
    </Button>
  )
}