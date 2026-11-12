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
// It asks only with mailLists on, only once the person's own record has
// arrived, only for a signed-in member whose role Admin does not let in, or
// for an LCA officer who holds a seat (the seats the session already has),
// since the seat is what counts for the media manager whatever the role (K's
// decision 52, checkpoint M's review), and only when a caller needs the
// answer; and it asks once a session: the route and the menu share one
// answer, kept here by the person, their sign-in session and the session's
// assurance level. A token refreshed in the same session asks nothing more;
// a session stepped up to a second factor asks once more and shows the
// answer it had meanwhile, so the page never falls back to its loading line
// under a person who is writing. A question that fails answers no for the
// draw that met it, so nothing waits forever, and is asked again the next
// time a page needs the answer, which shows its loading line meanwhile and
// sends nobody away. With mailLists off it asks nothing and answers no.

import { useEffect, useId, useSyncExternalStore } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { getMediaManager, type ApiMediaManager } from '@/lib/api'
import { FEATURES } from '@/lib/features'
import { NOT_ASKED, type MediaManagerAnswer } from './mediaManagerAnswer'
import { canAccessAdmin, type MemberRole } from './roles'

const ASKING: MediaManagerAnswer = { asking: true, mediaManager: false, secondFactor: false }
const NO: ApiMediaManager = { mediaManager: false, secondFactor: false }
const NO_CLAIMS = { session: '', aal: '' }

/** Each answer, by the person, the sign-in session and its assurance level it was asked for. */
const answers = new Map<string, ApiMediaManager>()
/** The newest answer in each sign-in session, shown while a stepped-up session's own answer is on the way. */
const newest = new Map<string, ApiMediaManager>()
/** What has been asked, and is on the way or answered. */
const asked = new Set<string>()
/** What was asked and failed, answered no for the draws that met the failure until a page asks it again. */
const failed = new Set<string>()
/** For each question, the callers drawn while it was asked, by their own id, so a failure answers no only to them. */
const seenBy = new Map<string, Set<string>>()
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

/** Asks the server once for this key; a failure is kept apart, so the next page that needs the answer asks again. */
function ask(key: string, sessionKey: string): void {
  if (asked.has(key)) return
  asked.add(key)
  getMediaManager()
    .then((answer) => {
      answers.set(key, answer)
      newest.set(sessionKey, answer)
    })
    .catch(() => {
      asked.delete(key)
      failed.add(key)
    })
    .finally(() => {
      version++
      for (const listener of listeners) listener()
    })
}

/** Whether the question is one to ask for this role: a role Admin does not let in, or an LCA officer who holds a seat. */
function mayAsk(role: MemberRole, seatCount: number): boolean {
  return !canAccessAdmin(role) || (role === 'lca_officer' && seatCount > 0)
}

/**
 * The media manager's answer for the person signed in. `needed` says whether this caller needs it: the route only when
 * it lets the media manager in, the account menu only for a seat holder. Until it is asked for, or with mailLists off,
 * the answer is no and nothing is asked. The token's claims are read only when the answer is wanted.
 */
export function useMediaManager(needed: boolean): MediaManagerAnswer {
  const { user, role, session, loading, member, memberLoading, seats } = useAuth()
  const caller = useId()
  useSyncExternalStore(subscribe, snapshot, snapshot)
  const wanted = FEATURES.mailLists && needed && !loading && !memberLoading && !!user && !!member && mayAsk(role, seats?.length ?? 0)
  const claims = wanted ? claimsOf(session?.access_token) : NO_CLAIMS
  const sessionKey = wanted && user ? `${user.id}:${claims.session}` : ''
  const key = sessionKey ? `${sessionKey}:${claims.aal}` : ''

  useEffect(() => {
    if (!key) return
    const seen = seenBy.get(key) ?? new Set<string>()
    seenBy.set(key, seen)
    seen.add(caller)
    // A page that needs the answer afresh asks again a question that failed.
    failed.delete(key)
    ask(key, sessionKey)
    return () => {
      seen.delete(caller)
    }
  }, [key, sessionKey, caller])

  if (!key) return NOT_ASKED
  const answer = answers.get(key) ?? newest.get(sessionKey)
  if (answer) return { asking: false, ...answer }
  // The draw that met a failure answers no, so nothing waits on it; any other caller waits for the question asked again.
  if (failed.has(key) && seenBy.get(key)?.has(caller)) return { asking: false, ...NO }
  return ASKING
}
