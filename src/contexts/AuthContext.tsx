// src/contexts/AuthContext.tsx

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { AuthError, Session, User } from '@supabase/supabase-js'

import { AuthContext } from './auth-context'

import {
  adminEndImpersonation,
  adminImpersonateMember,
  ApiError,
  getMe,
  getMySeats,
  syncMember as apiSyncMember,
  type ApiDirectedTournament,
  type ApiMember,
  type ApiManagedClub,
  type ApiMySeat,
} from '@/lib/api'
import { getAssuranceLevel } from '@/lib/mfa'
import { isViewOnlyAdmin, resolveRole, type MemberRole } from '@/areas/admin/roles'
import { supabase } from '@/lib/supabase'

interface ImpersonationTarget {
  /** Needed to pair the audit log's start and end entries. */
  id: string
  fullName: string
  email: string
}

export interface AuthContextValue {
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
  /**
   * Clubs this member manages because a regional representative seat they
   * hold covers the club's region. A seat grant like `seats`, not a role.
   */
  managedClubs: ApiManagedClub[]
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
    getMySeats().catch(() => ({ seats: [] as ApiMySeat[], managedClubs: [] as ApiManagedClub[] })),
  ])
  return { ...data, seats: seatData.seats, managedClubs: seatData.managedClubs ?? [] }
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
  const [managedClubs, setManagedClubs] = useState<ApiManagedClub[]>([])
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
  /**
   * The access token whose first profile load has ended, well or badly.
   *
   * Between the draw that first knows a session and the end of that load the
   * member is null, and a guarded route reading the role, seats and clubs in
   * that draw would send a signed-in person away on a reload. Until this
   * holds the current token, memberLoading reads true for a signed-in person
   * with no member in hand (see firstLoadOpen below). firstLoadOpen never
   * reads true for a visitor with no session or while a member is in hand;
   * refreshMember's own state still does, as it always has.
   */
  const [firstLoadEndedFor, setFirstLoadEndedFor] = useState<string | null>(null)
  /** Profile loads under way: the listener's and refreshMember's. The first load has ended only when none is left. */
  const loadsInFlight = useRef(0)
  /** The access token of the session last set, so a load that ends marks the session that is current then. */
  const currentToken = useRef<string | null>(null)

  const profileLoadStarted = useCallback(() => {
    loadsInFlight.current += 1
  }, [])

  const profileLoadEnded = useCallback(() => {
    loadsInFlight.current = Math.max(0, loadsInFlight.current - 1)
    if (loadsInFlight.current === 0) setFirstLoadEndedFor(currentToken.current)
  }, [])

  const refreshMember = useCallback(async () => {
    if (!session) {
      setMember(null)
      setSeats([])
      setManagedClubs([])
      setDirectedTournaments([])
      return
    }

    setMemberLoading(true)
    profileLoadStarted()
    try {
      const data = await loadMemberProfile()
      setMember(data.member)
      setSeats(data.seats)
      setManagedClubs(data.managedClubs)
      setDirectedTournaments(data.directedTournaments ?? [])
    } catch (err) {
      setMember(null)
      setSeats([])
      setManagedClubs([])
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
      profileLoadEnded()
    }
  }, [session, profileLoadStarted, profileLoadEnded])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      currentToken.current = initialSession?.access_token ?? null
      setSession(initialSession)
      setUser(initialSession?.user ?? null)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      currentToken.current = nextSession?.access_token ?? null
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      setLoading(false)

      if (nextSession?.user) {
        // Counted before the first await, so a load that ends meanwhile
        // does not mark this session's load as ended.
        profileLoadStarted()
        try {
          await apiSyncMember()
          const data = await loadMemberProfile()
          setMember(data.member)
          setSeats(data.seats)
          setManagedClubs(data.managedClubs)
          setDirectedTournaments(data.directedTournaments ?? [])
        } catch {
          setMember(null)
          setSeats([])
          setManagedClubs([])
          setDirectedTournaments([])
        } finally {
          profileLoadEnded()
        }
      } else {
        setMember(null)
        setSeats([])
        setManagedClubs([])
        setDirectedTournaments([])
      }
    })

    return () => subscription.unsubscribe()
  }, [profileLoadStarted, profileLoadEnded])

  useEffect(() => {
    if (!session) {
      autoFetchedFor.current = null
      return
    }
    // The state itself, never the value handed out below, or the load that
    // ends the wait would never start. The one automatic attempt is per
    // access token, so a refreshed token after a failed load gets another.
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
    setManagedClubs([])
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

  // Worked out at each draw: a session is known, no member is in hand, and the
  // first load for this token has not ended. A visitor with no session, or a
  // person whose member is in hand, never reads true from this.
  const firstLoadOpen = !!session?.user && !member && firstLoadEndedFor !== session.access_token
  const memberLoadingShown = memberLoading || firstLoadOpen

  const directedTournamentIds = useMemo(
    () => directedTournaments.map((t) => t.id),
    [directedTournaments],
  )

  // lca_admin can read every seat's inbox, so the link shows for them too.
  const isBoardMember = seats.length > 0 || role === 'lca_admin' || isViewOnlyAdmin(role)

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
      managedClubs,
      isBoardMember,
      assuranceLevel,
      mfaRequired,
      refreshAssurance,
      directedTournaments,
      directedTournamentIds,
      loading,
      memberLoading: memberLoadingShown,
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
      managedClubs,
      isBoardMember,
      assuranceLevel,
      mfaRequired,
      refreshAssurance,
      directedTournaments,
      directedTournamentIds,
      loading,
      memberLoadingShown,
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
