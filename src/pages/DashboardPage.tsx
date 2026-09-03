// src/pages/DashboardPage.tsx
import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  Building2,
  Calendar,
  CreditCard,
  KeyRound,
  LayoutDashboard,
  MessageSquare,
  Plus,
  Shield,
  Trophy,
  User,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'
import {
  ApiError,
  getMe,
  getMyTickets,
  updateMe,
  type ApiMember,
  type ApiRegistration,
  type ApiSupportTicket,
} from '@/lib/api'
import { ROLE_LABELS } from '@/lib/roles'
import UscfSearchInput, { type UscfPlayerResult } from '@/components/uscf/UscfSearchInput'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { usePageTitle } from '@/hooks/usePageTitle'

type MembershipStatus = 'active' | 'expired' | 'pending'

const statusConfig: Record<MembershipStatus, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-emerald-100 text-emerald-800' },
  expired: { label: 'Expired', className: 'bg-destructive/10 text-destructive' },
  pending: { label: 'Pending', className: 'bg-lca-gold/20 text-lca-navy' },
}

const ticketStatusColors: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800',
  new: 'bg-blue-100 text-blue-800',
  answered: 'bg-emerald-100 text-emerald-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  resolved: 'bg-gray-100 text-gray-600',
}

const ticketStatusLabels: Record<string, string> = {
  open: 'New',
  new: 'New',
  answered: 'Answered',
  in_progress: 'In Progress',
  resolved: 'Resolved',
}

const goldButtonClass =
  'bg-lca-gold font-semibold text-lca-navy hover:bg-lca-gold/90'

export function DashboardPage() {
  const { user, role, member: authMember, directedTournaments } = useAuth()
  const [member, setMember] = useState<ApiMember | null>(null)
  const [registrations, setRegistrations] = useState<ApiRegistration[]>([])
  const [tickets, setTickets] = useState<ApiSupportTicket[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [fullName, setFullName] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [emailChangePassword, setEmailChangePassword] = useState('')
  const [uscfPlayer, setUscfPlayer] = useState<UscfPlayerResult | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveNotice, setSaveNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [changingPassword, setChangingPassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null)
  const [passwordSaving, setPasswordSaving] = useState(false)

  usePageTitle('My Dashboard')

  useEffect(() => {
    async function load() {
      try {
        const data = await getMe()
        setMember(data.member)
        setRegistrations(data.registrations)
        setFullName(data.member.full_name)
        setEmailInput(data.member.email)
        setLoadError(null)
      } catch (err) {
        // AuthContext signs out on a 401, so ProtectedRoute is about to send
        // them to /login — say something human in the moment before it does,
        // rather than flashing a bare "Unauthorized".
        setLoadError(
          err instanceof ApiError && err.status === 401
            ? 'Your session has expired. Taking you back to the login page…'
            : err instanceof Error
              ? err.message
              : 'Failed to load profile',
        )
      } finally {
        setLoadingData(false)
      }
      // Tickets load separately and best-effort: a support hiccup should
      // never block the dashboard itself.
      try {
        const t = await getMyTickets()
        setTickets(t.tickets)
      } catch {
        // leave tickets empty; the section still links to /support
      }
    }
    load()
  }, [user?.id])

  /**
   * Proves the person at the keyboard knows the current password, not just
   * that a session is open. Changing either the password or the email is
   * enough to take an account over for good — a new address plus a password
   * reset locks the real owner out — so both are gated the same way.
   */
  async function reauthenticate(password: string): Promise<boolean> {
    const accountEmail = member?.email || user?.email || ''
    if (!accountEmail) return false
    const { error } = await supabase.auth.signInWithPassword({
      email: accountEmail,
      password,
    })
    return !error
  }

  async function handleProfileSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedEmail = emailInput.trim()
    const changingEmail = !!trimmedEmail && trimmedEmail !== member?.email

    setSaving(true)
    setSaveError(null)
    setSaveNotice(null)
    try {
      // Checked before anything is written, so a wrong password leaves the
      // profile untouched rather than half-saved.
      if (changingEmail && !(await reauthenticate(emailChangePassword))) {
        setSaveError('That password is incorrect, so your email was not changed.')
        return
      }

      const updated = await updateMe({
        fullName,
        uscfId: uscfPlayer?.uscfId ?? member?.uscf_id ?? null,
      })
      setMember(updated)
      setUscfPlayer(null)

      // Email lives on the Supabase auth identity, not the D1 member row —
      // change it separately and let Supabase's confirmation-link flow
      // gate when it actually takes effect.
      let emailChangeStarted = false
      if (changingEmail) {
        const { error: emailError } = await supabase.auth.updateUser({ email: trimmedEmail })
        if (emailError) {
          // The profile write above has already committed. Saying only that
          // the email failed would read as "nothing saved", so name the part
          // that did land — and leave the form open so they can correct the
          // address without retyping everything.
          setSaveError(
            `Saved your name and USCF details, but the email address was not changed: ${emailError.message}`,
          )
          return
        }
        emailChangeStarted = true
      }

      setEditing(false)
      setEmailChangePassword('')
      setSaveNotice(
        emailChangeStarted
          ? `Saved. Check ${trimmedEmail} for a link to confirm your new email address — it won't change until you do.`
          : null,
      )
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  async function handlePasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPasswordError(null)
    setPasswordNotice(null)

    if (newPassword !== confirmNewPassword) {
      setPasswordError('New passwords do not match.')
      return
    }
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.')
      return
    }
    setPasswordSaving(true)
    try {
      if (!(await reauthenticate(currentPassword))) {
        setPasswordError('Current password is incorrect.')
        return
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) {
        setPasswordError(updateError.message)
        return
      }

      setPasswordNotice('Password updated.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmNewPassword('')
      setChangingPassword(false)
    } finally {
      setPasswordSaving(false)
    }
  }

  const displayName = member?.full_name || user?.email?.split('@')[0] || 'Member'
  const email = member?.email || user?.email || ''
  const membershipStatus = (member?.membership_status ?? 'pending') as MembershipStatus
  const status = statusConfig[membershipStatus]
  const membershipExpiry = member?.membership_expiry ?? 'Not yet purchased'

  const upcomingRegistrations = registrations.filter(
    (reg) => reg.payment_status === 'paid' || reg.payment_status === 'pending',
  )

  // Most recently updated first; the dashboard shows the top 3.
  const recentTickets = [...tickets]
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
    .slice(0, 3)
  const openCount = tickets.filter(
    (t) => t.status !== 'resolved',
  ).length

  return (
    <div>
      <section className="border-b-4 border-lca-gold bg-lca-navy text-white">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="size-8 text-lca-gold sm:size-10" />
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
          <p className="text-muted-foreground" role="status">Loading your profile...</p>
        )}
        {loadError && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {loadError}
          </p>
        )}

        {!loadingData && !loadError && (
          <>
            {(role === 'lca_admin' || role === 'club_rep' || role === 'tournament_director') && (
              <div className="mb-8 rounded-xl border bg-card p-6 shadow-sm">
                <h2 className="text-lg font-bold text-lca-navy">
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
                    <User className="size-5 text-lca-gold" />
                    <h2 className="text-lg font-bold text-lca-navy">Profile</h2>
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

                {saveNotice && !editing && (
                  <p className="mt-3 rounded-lg border border-lca-gold/30 bg-lca-gold/10 px-3 py-2 text-xs text-lca-navy">
                    {saveNotice}
                  </p>
                )}

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
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        required
                        disabled={saving}
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Changing this sends a confirmation link to the new address — it
                        won't take effect until you click it.
                      </p>
                    </div>

                    {/* Only asked for when the address actually changed, so
                        editing a name stays a one-field edit. */}
                    {emailInput.trim() !== (member?.email ?? '') && (
                      <div className="space-y-2 rounded-lg border border-lca-gold/40 bg-lca-gold/5 p-3">
                        <Label htmlFor="emailChangePassword" className="text-xs">
                          Confirm your password to change your email
                        </Label>
                        <Input
                          id="emailChangePassword"
                          type="password"
                          autoComplete="current-password"
                          value={emailChangePassword}
                          onChange={(e) => setEmailChangePassword(e.target.value)}
                          required
                          disabled={saving}
                        />
                        <p className="text-[11px] text-muted-foreground">
                          Your email address is how you sign in and how you recover the
                          account, so we check it's really you.
                        </p>
                      </div>
                    )}

                    {/* USCF lookup — replaces the old plain text input */}
                    <UscfSearchInput
                      onSelect={(player) => setUscfPlayer(player)}
                      initialUscfId={member?.uscf_id ?? ''}
                    />

                    {/* Show current USCF ID if they haven't changed it */}
                    {!uscfPlayer && member?.uscf_id && (
                      <p className="text-xs text-muted-foreground">
                        Current USCF ID: {member.uscf_id}
                        {member.uscf_rating != null && ` · Rating: ${member.uscf_rating}`}
                      </p>
                    )}

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
                          setEmailInput(member?.email ?? '')
                          setEmailChangePassword('')
                          setUscfPlayer(null)
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
                      <dt className="font-medium text-lca-navy">Name</dt>
                      <dd className="text-muted-foreground">{displayName}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-lca-navy">Email</dt>
                      <dd className="text-muted-foreground">{email}</dd>
                    </div>
                    {member?.uscf_id && (
                      <div>
                        <dt className="font-medium text-lca-navy">USCF ID</dt>
                        <dd className="text-muted-foreground">{member.uscf_id}</dd>
                      </div>
                    )}
                    {member?.uscf_rating != null && (
                      <div>
                        <dt className="font-medium text-lca-navy">USCF Rating</dt>
                        <dd className="text-muted-foreground">
                          {member.uscf_rating}
                          {member.uscf_rating_updated_at && (
                            <span className="block text-xs text-muted-foreground/80">
                              Updated{' '}
                              {new Date(member.uscf_rating_updated_at).toLocaleDateString()}
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
                    <CreditCard className="size-5 text-lca-gold" />
                    <h2 className="text-lg font-bold text-lca-navy">Membership</h2>
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
                      <span className="font-medium text-lca-navy">{membershipExpiry}</span>.
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

            <div className="mt-6 rounded-xl border bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <KeyRound className="size-5 text-lca-gold" />
                  <h2 className="text-lg font-bold text-lca-navy">Security</h2>
                </div>
                {!changingPassword && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setChangingPassword(true)
                      setPasswordNotice(null)
                      setPasswordError(null)
                    }}
                  >
                    Change password
                  </Button>
                )}
              </div>

              {passwordNotice && !changingPassword && (
                <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  {passwordNotice}
                </p>
              )}

              {changingPassword ? (
                <form onSubmit={handlePasswordChange} className="mt-4 max-w-sm space-y-4">
                  {passwordError && (
                    <p className="text-sm text-destructive">{passwordError}</p>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      disabled={passwordSaving}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      autoComplete="new-password"
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      disabled={passwordSaving}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
                    <Input
                      id="confirmNewPassword"
                      type="password"
                      autoComplete="new-password"
                      minLength={6}
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      required
                      disabled={passwordSaving}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" className={goldButtonClass} disabled={passwordSaving}>
                      {passwordSaving ? 'Updating...' : 'Update password'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={passwordSaving}
                      onClick={() => {
                        setChangingPassword(false)
                        setCurrentPassword('')
                        setNewPassword('')
                        setConfirmNewPassword('')
                        setPasswordError(null)
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  Update the password you use to sign in.
                </p>
              )}

              <div className="mt-4 border-t pt-4">
                <p className="text-sm font-medium text-lca-navy">
                  Two-factor authentication
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {role === 'lca_admin'
                    ? 'Required for admin accounts — the admin panel stays locked until it is set up.'
                    : 'Add a code from your phone on top of your password.'}
                </p>
                <Button asChild variant="outline" size="sm" className="mt-3">
                  <Link to="/account/security">Manage two-factor</Link>
                </Button>
              </div>
            </div>
          </>
        )}
      </section>

      <section className="bg-muted/30">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex items-center gap-2">
            <Calendar className="size-6 text-lca-gold" />
            <h2 className="text-2xl font-bold text-lca-navy">My Registrations</h2>
          </div>
          <p className="mt-1 text-muted-foreground">
            Tournaments you are registered for.
          </p>
          {upcomingRegistrations.length > 0 ? (
            <ul className="mt-8 space-y-4">
              {upcomingRegistrations.map((reg) => (
                <li
                  key={reg.id}
                  className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <h3 className="font-semibold text-lca-navy">
                      {reg.tournament_name ?? reg.tournament_id}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {reg.tournament_date ?? ''}{' '}
                      {reg.tournament_location ? `· ${reg.tournament_location}` : ''}{' '}
                      · {reg.section}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-0.5 text-xs font-medium',
                        reg.payment_status === 'paid'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-lca-gold/20 text-lca-navy',
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
              <Link to="/tournaments" className="text-lca-navy hover:underline">
                Browse tournaments
              </Link>
            </p>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <MessageSquare className="size-6 text-lca-gold" />
              <h2 className="text-2xl font-bold text-lca-navy">My Support Tickets</h2>
              {openCount > 0 && (
                <span className="rounded-full bg-lca-gold/20 px-2.5 py-0.5 text-xs font-semibold text-lca-navy">
                  {openCount} open
                </span>
              )}
            </div>
            <p className="mt-1 text-muted-foreground">
              Questions and issues you've raised with the LCA team, and our replies.
            </p>
          </div>
          <Button asChild className={goldButtonClass}>
            <Link to="/support?new=1">
              <Plus className="size-4" />
              New ticket
            </Link>
          </Button>
        </div>

        {recentTickets.length > 0 ? (
          <>
            <ul className="mt-6 space-y-3">
              {recentTickets.map((ticket) => (
                <li key={ticket.id}>
                  <Link
                    to={`/support?ticket=${encodeURIComponent(ticket.id)}`}
                    className="flex flex-col gap-2 rounded-xl border bg-card p-5 shadow-sm transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-lca-navy">
                        {ticket.subject}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
                        {ticket.last_message}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-xs text-muted-foreground">
                        {new Date(ticket.updated_at).toLocaleDateString()} ·{' '}
                        {ticket.message_count} message{ticket.message_count !== 1 ? 's' : ''}
                      </span>
                      <span
                        className={cn(
                          'rounded-full px-2.5 py-0.5 text-xs font-medium',
                          ticketStatusColors[ticket.status] ?? 'bg-muted text-muted-foreground',
                        )}
                      >
                        {ticketStatusLabels[ticket.status] ?? ticket.status}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            {tickets.length > recentTickets.length && (
              <p className="mt-4 text-sm">
                <Link to="/support" className="font-medium text-lca-navy hover:underline">
                  View all {tickets.length} tickets →
                </Link>
              </p>
            )}
          </>
        ) : (
          <div className="mt-6 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            No support tickets yet. If you hit a problem or have a question,{' '}
            <Link to="/support?new=1" className="font-medium text-lca-navy hover:underline">
              open a ticket
            </Link>{' '}
            and the LCA team will get back to you.
          </div>
        )}
      </section>
    </div>
  )
}
