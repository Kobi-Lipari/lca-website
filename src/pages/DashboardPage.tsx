import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  Building2,
  Calendar,
  CreditCard,
  LayoutDashboard,
  Shield,
  Trophy,
  User,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'
import {
  getMe,
  updateMe,
  type ApiMember,
  type ApiRegistration,
} from '@/lib/api'
import { ROLE_LABELS } from '@/lib/roles'
import { cn } from '@/lib/utils'
import { usePageTitle } from '@/hooks/usePageTitle'

type MembershipStatus = 'active' | 'expired' | 'pending'

const statusConfig: Record<
  MembershipStatus,
  { label: string; className: string }
> = {
  active: {
    label: 'Active',
    className: 'bg-emerald-100 text-emerald-800',
  },
  expired: {
    label: 'Expired',
    className: 'bg-destructive/10 text-destructive',
  },
  pending: {
    label: 'Pending',
    className: 'bg-[#c8a94a]/20 text-[#1a2744]',
  },
}

const goldButtonClass =
  'bg-[#c8a94a] font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90'

export function DashboardPage() {
  const { user, role, member: authMember, directedTournaments } = useAuth()
  const [member, setMember] = useState<ApiMember | null>(null)
  const [registrations, setRegistrations] = useState<ApiRegistration[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [fullName, setFullName] = useState('')
  const [uscfId, setUscfId] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  usePageTitle('My Dashboard')

  useEffect(() => {
    async function load() {
      try {
        const data = await getMe()
        setMember(data.member)
        setRegistrations(data.registrations)
        setFullName(data.member.full_name)
        setUscfId(data.member.uscf_id ?? '')
        setLoadError(null)
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load profile')
      } finally {
        setLoadingData(false)
      }
    }
    load()
  }, [user?.id])

  async function handleProfileSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setSaveError(null)
    try {
      const updated = await updateMe({
        fullName,
        uscfId: uscfId.trim() || null,
      })
      setMember(updated)
      setEditing(false)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  const displayName = member?.full_name || user?.email?.split('@')[0] || 'Member'
  const email = member?.email || user?.email || ''
  const membershipStatus = (member?.membership_status ?? 'pending') as MembershipStatus
  const status = statusConfig[membershipStatus]
  const membershipExpiry = member?.membership_expiry ?? 'Not yet purchased'

  const upcomingRegistrations = registrations.filter((reg) => {
    return reg.payment_status === 'paid' || reg.payment_status === 'pending'
  })

  return (
    <div>
      <section className="border-b-4 border-[#c8a94a] bg-[#1a2744] text-white">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="size-8 text-[#c8a94a] sm:size-10" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                My Dashboard
              </h1>
              <p className="mt-2 max-w-2xl text-white/80">
                Welcome back, {displayName}. Manage your membership, view
                registrations, and track your tournament history.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        {loadingData && (
          <p className="text-muted-foreground" role="status">
            Loading your profile...
          </p>
        )}
        {loadError && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {loadError}
          </p>
        )}

        {!loadingData && !loadError && (
          <>
          {(role === 'lca_admin' ||
            role === 'club_rep' ||
            role === 'tournament_director') && (
            <div className="mb-8 rounded-xl border bg-card p-6 shadow-sm">
              <h2 className="text-lg font-bold text-[#1a2744]">
                {ROLE_LABELS[role]} tools
              </h2>
              <div className="mt-4 flex flex-wrap gap-3">
                {role === 'lca_admin' && (
                  <Button asChild className={goldButtonClass}>
                    <Link to="/admin">
                      <Shield className="size-4" />
                      Admin Panel
                    </Link>
                  </Button>
                )}
                {role === 'club_rep' && authMember?.club_id && (
                  <Button asChild className={goldButtonClass}>
                    <Link to="/manage/club">
                      <Building2 className="size-4" />
                      Manage Club
                    </Link>
                  </Button>
                )}
                {role === 'tournament_director' &&
                  directedTournaments.map((t) => (
                    <Button key={t.id} asChild variant="outline">
                      <Link to={`/admin/tournaments/${t.id}`}>
                        <Trophy className="size-4" />
                        Manage {t.name}
                      </Link>
                    </Button>
                  ))}
              </div>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-xl border bg-card p-6 shadow-sm lg:col-span-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <User className="size-5 text-[#c8a94a]" />
                  <h2 className="text-lg font-bold text-[#1a2744]">Profile</h2>
                </div>
                {!editing && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditing(true)}
                  >
                    Edit
                  </Button>
                )}
              </div>

              {editing ? (
                <form onSubmit={handleProfileSave} className="mt-4 space-y-4">
                  {saveError && (
                    <p className="text-sm text-destructive">{saveError}</p>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      disabled={saving}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="uscfId">USCF ID</Label>
                    <Input
                      id="uscfId"
                      value={uscfId}
                      onChange={(e) => setUscfId(e.target.value)}
                      disabled={saving}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      className={goldButtonClass}
                      disabled={saving}
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={saving}
                      onClick={() => {
                        setEditing(false)
                        setFullName(member?.full_name ?? '')
                        setUscfId(member?.uscf_id ?? '')
                        setSaveError(null)
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <dl className="mt-4 space-y-3 text-sm">
                  <div>
                    <dt className="font-medium text-[#1a2744]">Name</dt>
                    <dd className="text-muted-foreground">{displayName}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-[#1a2744]">Email</dt>
                    <dd className="text-muted-foreground">{email}</dd>
                  </div>
                  {member?.uscf_id && (
                    <div>
                      <dt className="font-medium text-[#1a2744]">USCF ID</dt>
                      <dd className="text-muted-foreground">{member.uscf_id}</dd>
                    </div>
                  )}
                  {member?.uscf_rating != null && (
                    <div>
                      <dt className="font-medium text-[#1a2744]">USCF Rating</dt>
                      <dd className="text-muted-foreground">
                        {member.uscf_rating}
                        {member.uscf_rating_updated_at && (
                          <span className="block text-xs text-muted-foreground/80">
                            Updated{' '}
                            {new Date(
                              member.uscf_rating_updated_at,
                            ).toLocaleDateString()}
                          </span>
                        )}
                      </dd>
                    </div>
                  )}
                </dl>
              )}
            </div>

            <div className="rounded-xl border bg-card p-6 shadow-sm lg:col-span-2">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="size-5 text-[#c8a94a]" />
                  <h2 className="text-lg font-bold text-[#1a2744]">
                    Membership
                  </h2>
                </div>
                <span
                  className={cn(
                    'w-fit rounded-full px-2.5 py-0.5 text-xs font-medium',
                    status.className,
                  )}
                >
                  {status.label}
                </span>
              </div>

              <p className="mt-4 text-sm text-muted-foreground">
                {membershipStatus === 'active' ? (
                  <>
                    Your LCA membership is valid through{' '}
                    <span className="font-medium text-[#1a2744]">
                      {membershipExpiry}
                    </span>
                    .
                  </>
                ) : (
                  <>Membership status: {status.label.toLowerCase()}.</>
                )}
              </p>

              <Button asChild className={cn('mt-4', goldButtonClass)}>
                <Link to="/membership">Join / Renew Membership</Link>
              </Button>
            </div>
          </div>
          </>
        )}
      </section>

      <section className="bg-muted/30">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex items-center gap-2">
            <Calendar className="size-6 text-[#c8a94a]" />
            <h2 className="text-2xl font-bold text-[#1a2744]">
              My Registrations
            </h2>
          </div>
          <p className="mt-1 text-muted-foreground">
            Tournaments you are registered for (from D1).
          </p>

          {upcomingRegistrations.length > 0 ? (
            <ul className="mt-8 space-y-4">
              {upcomingRegistrations.map((reg) => (
                <li
                  key={reg.id}
                  className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <h3 className="font-semibold text-[#1a2744]">
                      {reg.tournament_name ?? reg.tournament_id}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {reg.tournament_date ?? ''}{' '}
                      {reg.tournament_location
                        ? `· ${reg.tournament_location}`
                        : ''}{' '}
                      · {reg.section}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-0.5 text-xs font-medium',
                        reg.payment_status === 'paid'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-[#c8a94a]/20 text-[#1a2744]',
                      )}
                    >
                      {reg.payment_status === 'paid' ? 'Paid' : 'Payment pending'}
                    </span>
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/tournaments/${reg.tournament_id}`}>View</Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-8 text-sm text-muted-foreground">
              No registrations yet.{' '}
              <Link to="/tournaments" className="text-[#c8a94a] hover:underline">
                Browse tournaments
              </Link>
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
