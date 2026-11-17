// src/areas/clubs/useManagesEvent.ts
//
// Whether the server lets the person signed in manage one event (WS09 step
// 19), for the manage page's route, RoleProtectedRoute: since WS09 step 17 a
// regional representative runs every club event in their region whatever
// their role, which the route's roles cannot know, so the route asks. The
// question is GET /api/admin/tournaments/[id]/directors, which the server
// answers only to an observer and to a person canManageTournament admits,
// the rule every manage call reads; an observer is let in by the route's
// roles already, so only the people those roles leave out are asked about.
// The answer opens the page and nothing more: every call the page makes is
// checked again by the server.
//
// It asks only when its caller says so, which RoleProtectedRoute does only
// with regionEvents on, and once for each event and person. While the
// answer is on the way it says so, and the route shows its loading line,
// sending nobody away; an answer that fails reads as no.
import { useEffect, useState } from 'react'

import { adminGetTournamentDirectors } from '@/lib/api'

export interface ManagesEventAnswer {
  /** The question is on its way. */
  asking: boolean
  /** The server said the person manages the event. */
  manages: boolean
}

const NOT_ASKED: ManagesEventAnswer = { asking: false, manages: false }
const ASKING: ManagesEventAnswer = { asking: true, manages: false }

export function useManagesEvent(ask: boolean, tournamentId: string | undefined, memberId: string | undefined): ManagesEventAnswer {
  const key = ask && tournamentId && memberId ? `${memberId}:${tournamentId}` : ''
  const [answer, setAnswer] = useState<{ key: string; manages: boolean } | null>(null)
  useEffect(() => {
    if (!key || !tournamentId) return
    let cancelled = false
    adminGetTournamentDirectors(tournamentId)
      .then(() => { if (!cancelled) setAnswer({ key, manages: true }) })
      .catch(() => { if (!cancelled) setAnswer({ key, manages: false }) })
    return () => { cancelled = true }
  }, [key, tournamentId])
  if (!key) return NOT_ASKED
  if (answer?.key !== key) return ASKING
  return { asking: false, manages: answer.manages }
}
