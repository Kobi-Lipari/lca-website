// src/areas/admin/useMediaManager.ts
//
// Whether the person signed in sends the LCA newsletter as the media manager
// (WS16 step 6), from GET /api/me/media-manager. The answer only draws the
// page: the two /admin routes, through RoleProtectedRoute's allowMediaManager,
// which hand it to Admin's page (./mediaManagerAnswer.ts) for Group email
// alone, and the account menu's Group email link. The grant is the
// newsletter's own guard, requireListMailer, which reads the seat again at
// each request, so a stale answer here opens a page whose every call is
// refused.
//
// It asks only with mailLists on, only for a signed-in member whose role
// Admin does not let in, and only when a caller needs the answer; and it asks
// once a session: the route and the menu share one answer, kept here by the
// person, their sign-in session and the session's assurance level. A token
// refreshed in the same session asks nothing more; a session stepped up to a
// second factor asks once more and shows the answer it had meanwhile, so the
// page never falls back to its loading line under a person who is writing.
// With mailLists off it asks nothing and answers no.

import { useEffect, useSyncExternalStore } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { getMediaManager, type ApiMediaManager } from '@/lib/api'
import { FEATURES } from '@/lib/features'
import { NOT_ASKED, type MediaManagerAnswer } from './mediaManagerAnswer'
import { canAccessAdmin } from './roles'

const ASKING: MediaManagerAnswer = { asking: true, mediaManager: false, secondFactor: false }
const NO: ApiMediaManager = { mediaManager: false, secondFactor: false }

/** Each answer, by the person, the sign-in session and its assurance level it was asked for. */
const answers = new Map<string, ApiMediaManager>()
/** The newest answer in each sign-in session, shown while a stepped-up session's own answer is on the way. */
const newest = new Map<string, ApiMediaManager>()
/** What has been asked already, answered or not. */
const asked = new Set<string>()
const listeners = new Set<() => void>()
let version = 0

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const snapshot = () => version

/** The two claims of the session's token the answer depends on, the sign-in session's id and the assurance level, or '' for each it lacks. */
function claimsOf(token: string | undefined): { session: string; aal: string } {
  try {
    const part = token?.split('.')[1]
    if (!part) return { session: '', aal: '' }
    const claims = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/'))) as { session_id?: unknown; aal?: unknown }
    return {
      session: typeof claims.session_id === 'string' ? claims.session_id : '',
      aal: typeof claims.aal === 'string' ? claims.aal : '',
    }
  } catch {
    return { session: '', aal: '' }
  }
}

/** Asks the server once for this key; a failure keeps the session's newest answer, or no. */
function ask(key: string, sessionKey: string): void {
  if (asked.has(key)) return
  asked.add(key)
  getMediaManager()
    .then((answer) => {
      answers.set(key, answer)
      newest.set(sessionKey, answer)
    })
    .catch(() => {
      answers.set(key, newest.get(sessionKey) ?? NO)
    })
    .finally(() => {
      version++
      for (const listener of listeners) listener()
    })
}

/**
 * The media manager's answer for the person signed in. `needed` says whether this caller needs it: the route only when
 * it lets the media manager in, the account menu only for a seat holder. Until it is asked for, or with mailLists off,
 * the answer is no and nothing is asked.
 */
export function useMediaManager(needed: boolean): MediaManagerAnswer {
  const { user, role, session, loading } = useAuth()
  useSyncExternalStore(subscribe, snapshot, snapshot)
  const wanted = FEATURES.mailLists && needed && !loading && !!user && !canAccessAdmin(role)
  const claims = claimsOf(session?.access_token)
  const sessionKey = wanted && user ? `${user.id}:${claims.session}` : ''
  const key = sessionKey ? `${sessionKey}:${claims.aal}` : ''

  useEffect(() => {
    if (key) ask(key, sessionKey)
  }, [key, sessionKey])

  if (!key) return NOT_ASKED
  const answer = answers.get(key) ?? newest.get(sessionKey)
  return answer ? { asking: false, ...answer } : ASKING
}
