// src/contexts/AuthContext.tsx

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'

import {
  adminImpersonateMember,
  getMe,
  getMySeats,
  syncMember as apiSyncMember,
  type ApiDirectedTournament,
  type ApiMember,
  type ApiMySeat,
} from '@/lib/api'
import { resolveRole, type MemberRole } from '@/lib/roles'
import { supabase } from '@/lib/supabase'

interface ImpersonationTarget {
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
  directedTournaments: ApiDirectedTournament[]
  directedTournamentIds: string[]
  loading: boolean
  memberLoading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (
    email: string,
    password: string,
    metadata?: { fullName?: string; uscfId?: string },
  ) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>
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
  const [impersonating, setImpersonating] = useState<ImpersonationTarget | null>(
    readStashedTarget,
  )

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
    } catch {
      setMember(null)
      setSeats([])
      setDirectedTournaments([])
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
    if (session && !member && !memberLoading) {
      refreshMember()
    }
  }, [session, member, memberLoading, refreshMember])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
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

      return {
        error: error?.message ?? null,
        needsEmailConfirmation: !data.session,
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

    await supabase.auth.setSession(adminTokens)
    sessionStorage.removeItem(ADMIN_SESSION_STASH_KEY)
    sessionStorage.removeItem(IMPERSONATION_TARGET_KEY)
    setImpersonating(null)
  }, [])

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

  const value = useMemo(
    () => ({
      user,
      session,
      member,
      role,
      seats,
      isBoardMember,
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