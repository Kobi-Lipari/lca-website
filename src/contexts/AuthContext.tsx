// src/contexts/AuthContext.tsx

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { AuthError, Session, User } from '@supabase/supabase-js'

import {
  adminEndImpersonation,
  adminImpersonateMember,
  ApiError,
  getMe,
  getMySeats,
  syncMember as apiSyncMember,
  type ApiDirectedTournament,
  type ApiMember,
  type ApiMySeat,
} from '@/lib/api'
import { getAssuranceLevel } from '@/lib/mfa'
import { resolveRole, type MemberRole } from '@/lib/roles'
import { supabase } from '@/lib/supabase'

interface ImpersonationTarget {
  /** Needed to pair the audit log's start and end entries. */
  id: string
  fullName: string
  email: string
}

interface AuthContextValue {
  user: User | null
  session: Session | null
  member: ApiMember | null
  role: MemberRole
  /**
   * Board seats this member currently holds. Almost always empty.
   *
   * This is NOT part of `role` on purpose: a seat is a time-bounded grant on
   * top of an account, so holding one must never disturb whether someone is a
   * club_rep or a plain member, and losing one must never touch their account.
   */
  seats: ApiMySeat[]
  isBoardMember: boolean
  /**
   * Assurance level of the current session: 'aal2' once a second factor has
   * been verified for it. Null until the first check resolves.
   */
  assuranceLevel: string | null
  /**
   * lca_admin without a second factor verified for this session. The API
   * refuses admin endpoints in this state, so the UI routes them to setup
   * rather than letting them walk into a wall of 403s.
   */
  mfaRequired: boolean
  refreshAssurance: () => Promise<void>
  directedTournaments: ApiDirectedTournament[]
  directedTournamentIds: string[]
  loading: boolean
  memberLoading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (
    email: string,
    password: string,
    metadata?: { fullName?: string; uscfId?: string },
  ) => Promise<{
    error: string | null
    needsEmailConfirmation: boolean
    /** The address already has an account — no mail was sent. */
    alreadyRegistered: boolean
  }>
  signOut: () => Promise<void>
  syncMember: () => Promise<void>
  refreshMember: () => Promise<void>
  impersonating: ImpersonationTarget | null
  startImpersonation: (memberId: string) => Promise<void>
  exitImpersonation: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const IMPERSONATION_TARGET_KEY = 'lca_impersonation_target'
const ADMIN_SESSION_STASH_KEY = 'lca_admin_session_stash'

/**
 * Seats load in parallel with the profile and fail soft: a seat lookup error
 * shouldn't cost someone their session, it should just hide the board inbox
 * link until the next load.
 */
async function loadMemberProfile() {
  const [data, seatData] = await Promise.all([
    getMe(),
    getMySeats().catch(() => ({ seats: [] as ApiMySeat[] })),
  ])
  return { ...data, seats: seatData.seats }
}

/**
 * Supabase does not always put something readable in `message`. A 5xx from
 * the auth service (a mail-transport failure, say) has been seen to surface
 * as the literal string "{}", which is what the member then reads on the
 * form. Fall back to something they can act on.
 */
function authErrorMessage(error: AuthError | null): string | null {
  if (!error) return null
  const message = error.message?.trim()
  if (!message || message === '{}') {
    return 'Something went wrong on our end. Please try again — if it keeps happening, contact support.'
  }
  return message
}

function readStashedTarget(): ImpersonationTarget | null {
  try {
    const stashed = sessionStorage.getItem(IMPERSONATION_TARGET_KEY)
    return stashed ? (JSON.parse(stashed) as ImpersonationTarget) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [member, setMember] = useState<ApiMember | null>(null)
  const [seats, setSeats] = useState<ApiMySeat[]>([])
  const [directedTournaments, setDirectedTournaments] = useState<
    ApiDirectedTournament[]
  >([])
  const [loading, setLoading] = useState(true)
  const [memberLoading, setMemberLoading] = useState(false)
  const [assuranceLevel, setAssuranceLevel] = useState<string | null>(null)
  const [impersonating, setImpersonating] = useState<ImpersonationTarget | null>(
    readStashedTarget,
  )
  /**
   * Which session we have already auto-fetched the profile for.
   *
   * Without this the auto-fetch effect below spins: a failed load leaves
   * `member` null and `memberLoading` false, which are the effect's own
   * dependencies, so it fires again immediately and hammers /api/me for as
   * long as the tab is open. One automatic attempt per session is enough —
   * an explicit refreshMember() call still re-fetches on demand.
   */
  const autoFetchedFor = useRef<string | null>(null)

  const refreshMember = useCallback(async () => {
    if (!session) {
      setMember(null)
      setSeats([])
      setDirectedTournaments([])
      return
    }

    setMemberLoading(true)
    try {
      const data = await loadMemberProfile()
      setMember(data.member)
      setSeats(data.seats)
      setDirectedTournaments(data.directedTournaments ?? [])
    } catch (err) {
      setMember(null)
      setSeats([])
      setDirectedTournaments([])

      // A 401 means the server rejected this token outright — the session is
      // dead even though the client still holds one. Confirming an email
      // change is one way to land here. Leaving the stale session in place
      // strands the member on a page showing a bare "Unauthorized"; dropping
      // it lets ProtectedRoute send them to /login, which is the only thing
      // that actually helps.
      if (err instanceof ApiError && err.status === 401) {
        await supabase.auth.signOut()
      }
    } finally {
      setMemberLoading(false)
    }
  }, [session])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession)
      setUser(initialSession?.user ?? null)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      setLoading(false)

      if (nextSession?.user) {
        try {
          await apiSyncMember()
          const data = await loadMemberProfile()
          setMember(data.member)
          setSeats(data.seats)
          setDirectedTournaments(data.directedTournaments ?? [])
        } catch {
          setMember(null)
          setSeats([])
          setDirectedTournaments([])
        }
      } else {
        setMember(null)
        setSeats([])
        setDirectedTournaments([])
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) {
      autoFetchedFor.current = null
      return
    }
    if (member || memberLoading) return
    if (autoFetchedFor.current === session.access_token) return

    autoFetchedFor.current = session.access_token
    refreshMember()
  }, [session, member, memberLoading, refreshMember])

  const refreshAssurance = useCallback(async () => {
    if (!session) {
      setAssuranceLevel(null)
      return
    }
    try {
      const { current } = await getAssuranceLevel()
      setAssuranceLevel(current)
    } catch {
      // Treated as "not stepped up". The server enforces this regardless, so
      // guessing high here would only produce a confusing wall of 403s.
      setAssuranceLevel(null)
    }
  }, [session])

  useEffect(() => {
    let cancelled = false

    async function check() {
      if (!session) {
        if (!cancelled) setAssuranceLevel(null)
        return
      }
      try {
        const { current } = await getAssuranceLevel()
        if (!cancelled) setAssuranceLevel(current)
      } catch {
        if (!cancelled) setAssuranceLevel(null)
      }
    }

    check()
    return () => {
      cancelled = true
    }
  }, [session])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: authErrorMessage(error) }
  }, [])

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      metadata?: { fullName?: string; uscfId?: string },
    ) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: metadata?.fullName,
            uscf_id: metadata?.uscfId || undefined,
            role: 'member',
          },
        },
      })

      // Signing up with an address that already has an account is NOT an
      // error as far as Supabase is concerned: rather than confirm the
      // address exists, it returns a decoy user with an empty `identities`
      // array and no session, and sends no mail. Read as-is that looks
      // identical to "created, pending confirmation", so the person is told
      // to go check an inbox that will never receive anything. Detect the
      // decoy so we can point them at logging in or resetting instead.
      const alreadyRegistered =
        !error && !!data.user && (data.user.identities?.length ?? 0) === 0

      return {
        error: authErrorMessage(error),
        needsEmailConfirmation: !data.session,
        alreadyRegistered,
      }
    },
    [],
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    sessionStorage.removeItem(ADMIN_SESSION_STASH_KEY)
    sessionStorage.removeItem(IMPERSONATION_TARGET_KEY)
    setImpersonating(null)
    setMember(null)
    setSeats([])
    setDirectedTournaments([])
  }, [])

  const startImpersonation = useCallback(async (memberId: string) => {
    const {
      data: { session: adminSession },
    } = await supabase.auth.getSession()
    if (!adminSession) throw new Error('No active session to impersonate from')

    const result = await adminImpersonateMember(memberId)

    sessionStorage.setItem(
      ADMIN_SESSION_STASH_KEY,
      JSON.stringify({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token,
      }),
    )
    sessionStorage.setItem(
      IMPERSONATION_TARGET_KEY,
      JSON.stringify(result.member),
    )

    await supabase.auth.setSession(result.session)
    setImpersonating(result.member)
  }, [])

  const exitImpersonation = useCallback(async () => {
    const stashed = sessionStorage.getItem(ADMIN_SESSION_STASH_KEY)
    if (!stashed) return
    const adminTokens = JSON.parse(stashed) as {
      access_token: string
      refresh_token: string
    }
    const targetId = impersonating?.id ?? null

    await supabase.auth.setSession(adminTokens)
    sessionStorage.removeItem(ADMIN_SESSION_STASH_KEY)
    sessionStorage.removeItem(IMPERSONATION_TARGET_KEY)
    setImpersonating(null)

    // After setSession, so the entry is attributed to the admin rather than
    // to the member they were acting as. Best-effort: closing the tab ends
    // the session without ever reaching here, and an unclosed entry is
    // better than blocking the exit on a logging call.
    try {
      await adminEndImpersonation(targetId)
    } catch {
      // Leaves a start with no end, which the log view reports honestly.
    }
  }, [impersonating])

  const syncMember = useCallback(async () => {
    const synced = await apiSyncMember()
    setMember(synced)
    await refreshMember()
  }, [refreshMember])

  const role = resolveRole(
    member?.role,
    user?.user_metadata?.role as string | undefined,
  )

  const directedTournamentIds = useMemo(
    () => directedTournaments.map((t) => t.id),
    [directedTournaments],
  )

  // lca_admin can read every seat's inbox, so the link shows for them too.
  const isBoardMember = seats.length > 0 || role === 'lca_admin'

  // Only meaningful once the profile has loaded and the assurance check has
  // resolved; before that `member` is null and this would flap true.
  const mfaRequired =
    !!member && role === 'lca_admin' && assuranceLevel !== null
      ? assuranceLevel !== 'aal2'
      : false

  const value = useMemo(
    () => ({
      user,
      session,
      member,
      role,
      seats,
      isBoardMember,
      assuranceLevel,
      mfaRequired,
      refreshAssurance,
      directedTournaments,
      directedTournamentIds,
      loading,
      memberLoading,
      signIn,
      signUp,
      signOut,
      syncMember,
      refreshMember,
      impersonating,
      startImpersonation,
      exitImpersonation,
    }),
    [
      user,
      session,
      member,
      role,
      seats,
      isBoardMember,
      assuranceLevel,
      mfaRequired,
      refreshAssurance,
      directedTournaments,
      directedTournamentIds,
      loading,
      memberLoading,
      signIn,
      signUp,
      signOut,
      syncMember,
      refreshMember,
      impersonating,
      startImpersonation,
      exitImpersonation,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}