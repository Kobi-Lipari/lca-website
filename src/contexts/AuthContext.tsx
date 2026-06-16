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
  getMe,
  syncMember as apiSyncMember,
  type ApiDirectedTournament,
  type ApiMember,
} from '@/lib/api'
import { resolveRole, type MemberRole } from '@/lib/roles'
import { supabase } from '@/lib/supabase'

interface AuthContextValue {
  user: User | null
  session: Session | null
  member: ApiMember | null
  role: MemberRole
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
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function loadMemberProfile() {
  const data = await getMe()
  return data
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [member, setMember] = useState<ApiMember | null>(null)
  const [directedTournaments, setDirectedTournaments] = useState<
    ApiDirectedTournament[]
  >([])
  const [loading, setLoading] = useState(true)
  const [memberLoading, setMemberLoading] = useState(false)

  const refreshMember = useCallback(async () => {
    if (!session) {
      setMember(null)
      setDirectedTournaments([])
      return
    }

    setMemberLoading(true)
    try {
      const data = await loadMemberProfile()
      setMember(data.member)
      setDirectedTournaments(data.directedTournaments ?? [])
    } catch {
      setMember(null)
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
          setDirectedTournaments(data.directedTournaments ?? [])
        } catch {
          setMember(null)
          setDirectedTournaments([])
        }
      } else {
        setMember(null)
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
    setMember(null)
    setDirectedTournaments([])
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

  const value = useMemo(
    () => ({
      user,
      session,
      member,
      role,
      directedTournaments,
      directedTournamentIds,
      loading,
      memberLoading,
      signIn,
      signUp,
      signOut,
      syncMember,
      refreshMember,
    }),
    [
      user,
      session,
      member,
      role,
      directedTournaments,
      directedTournamentIds,
      loading,
      memberLoading,
      signIn,
      signUp,
      signOut,
      syncMember,
      refreshMember,
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
