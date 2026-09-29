// src/pages/AdminPage.tsx
// The LCA admin panel — lca_admin only. Club reps, directors and auditors
// have their own workspace (WorkspacePage.tsx) instead of a trimmed copy of
// this page.
//
// Sections are grouped (People / Events / Communications / System) in a
// sidebar and each has its own URL, /admin/<section>, so a section can be
// linked to and survives a reload. On phones the sidebar becomes a select.
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import {
  Award, Building2, Mail, Megaphone, MessageSquare, Newspaper, Plus, ShieldAlert, Trash2, Trophy, Users,
  type LucideIcon,
} from 'lucide-react'

import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/auth-context'
import { AdminAnnouncementPanel } from '@/components/AdminAnnouncementPanel'
import { AuditLogPanel } from '@/components/admin/AuditLogPanel'
import { BoardSeatsPanel } from '@/components/admin/BoardSeatsPanel'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import { MembersTable } from '@/components/admin/MembersTable'
import { PostsPanel } from '@/components/admin/PostsPanel'
import { TournamentList } from '@/components/admin/TournamentList'
import { AdminEmailPage } from '@/pages/AdminEmailPage'
import { AdminSupportPage } from '@/pages/AdminSupportPage'
import {
  adminAssignBoardSeat,
  adminCreateClub,
  adminDeleteClub,
  adminDeleteMember,
  adminGetBoardSeats,
  adminGetMembers,
  adminRemoveBoardSeatHolder,
  adminUpdateMemberClub,
  adminUpdateMemberMembership,
  adminUpdateMemberName,
  adminUpdateMemberRole,
  adminUpdateTournament,
  getClubs,
  getTournaments,
  type ApiAdminBoardSeat,
  type ApiAdminMember,
  type ApiClubListItem,
  type ApiSeatHolder,
  type ApiTournamentListItem,
} from '@/lib/api'
import type { MemberRole } from '@/lib/roles'
import { cn } from '@/lib/utils'
import { usePageTitle } from '@/hooks/usePageTitle'
import { ADMIN_SCROLL, GOLD_BUTTON as GOLD } from '@/lib/brand'

// ── Sections ─────────────────────────────────────────────────────────────────

type AdminSection =
  | 'members' | 'board-seats'
  | 'tournaments' | 'clubs'
  | 'news' | 'email' | 'announcements' | 'support'
  | 'activity'

const GROUPS: { label: string; items: { id: AdminSection; label: string; icon: LucideIcon }[] }[] = [
  { label: 'People', items: [
    { id: 'members', label: 'Members', icon: Users },
    { id: 'board-seats', label: 'Board seats', icon: Award },
  ] },
  { label: 'Events', items: [
    { id: 'tournaments', label: 'Tournaments', icon: Trophy },
    { id: 'clubs', label: 'Clubs', icon: Building2 },
  ] },
  { label: 'Communications', items: [
    { id: 'news', label: 'News posts', icon: Newspaper },
    { id: 'email', label: 'Group email', icon: Mail },
    { id: 'announcements', label: 'Site banners', icon: Megaphone },
    { id: 'support', label: 'Support tickets', icon: MessageSquare },
  ] },
  { label: 'System', items: [
    { id: 'activity', label: 'Admin activity', icon: ShieldAlert },
  ] },
]

const ALL_SECTIONS = GROUPS.flatMap((g) => g.items)

/** Old ?tab / section names that should still land somewhere sensible. */
const LEGACY: Record<string, AdminSection> = { boardseats: 'board-seats', audit: 'activity' }

const REGIONS = [
  'North Louisiana', 'Central Louisiana', 'North of Lake Pontchartrain', 'New Orleans Metro',
  'Southwest Louisiana', 'South Central Louisiana', 'Bayou Region',
]

// ── Page ─────────────────────────────────────────────────────────────────────

export function AdminPage() {
  const { section: rawSection } = useParams<{ section?: string }>()
  const navigate = useNavigate()

  const section = (LEGACY[rawSection ?? ''] ?? rawSection ?? 'members') as AdminSection
  const current = ALL_SECTIONS.find((s) => s.id === section)
  usePageTitle(current ? `Admin · ${current.label}` : 'Admin panel')

  if (!current) return <Navigate to="/admin" replace />
  if (rawSection && LEGACY[rawSection]) return <Navigate to={`/admin/${section}`} replace />

  return (
    <div>
      <PageHero title="Admin panel" subtitle="Manage members, clubs, tournaments and communications across the LCA." size="compact" />

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-8 lg:py-8">
        {/* Phone / tablet: a select instead of the sidebar */}
        <div className="mb-6 lg:hidden">
          <Label htmlFor="admin-section" className="sr-only">Section</Label>
          <select
            id="admin-section"
            className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm font-medium text-lca-navy"
            value={section}
            onChange={(e) => navigate(`/admin/${e.target.value}`)}
          >
            {GROUPS.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.items.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </optgroup>
            ))}
          </select>
        </div>

        <nav aria-label="Admin sections" className="hidden lg:block">
          <div className="sticky top-6 space-y-5">
            {GROUPS.map((g) => (
              <div key={g.label}>
                <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</p>
                <ul className="space-y-0.5">
                  {g.items.map(({ id, label, icon: Icon }) => (
                    <li key={id}>
                      <Link
                        to={`/admin/${id}`}
                        aria-current={section === id ? 'page' : undefined}
                        className={cn(
                          'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                          section === id
                            ? 'bg-lca-navy font-medium text-white'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                      >
                        <Icon className={cn('size-4', section === id && 'text-lca-gold')} /> {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        <main className="min-w-0">
          <AdminSectionView section={section} />
        </main>
      </div>
    </div>
  )
}

function SectionHeading({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold text-lca-navy">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}

// Keyed by section so each one mounts fresh and loads only what it shows.
function AdminSectionView({ section }: { section: AdminSection }) {
  switch (section) {
    case 'members': return <MembersSection key="members" />
    case 'board-seats': return <><SectionHeading title="Board seats" description="Who holds each board seat, and for how long." /><BoardSeatsPanel /></>
    case 'tournaments': return <TournamentsSection key="tournaments" />
    case 'clubs': return <ClubsSection key="clubs" />
    case 'news': return <PostsPanel />
    case 'email': return <AdminEmailPage embedded />
    case 'announcements': return <><SectionHeading title="Site banners" description="Short notices shown across the top of every page. For full announcements, use News posts." /><AdminAnnouncementPanel /></>
    case 'support': return <AdminSupportPage embedded />
    case 'activity': return <><SectionHeading title="Admin activity" description="Role changes, membership overrides, club changes and impersonation." /><AuditLogPanel /></>
  }
}

function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null
  return (
    <p className="mb-5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
  )
}

// ── Members ──────────────────────────────────────────────────────────────────

function MembersSection() {
  const { startImpersonation } = useAuth()
  const navigate = useNavigate()

  const [members, setMembers] = useState<ApiAdminMember[]>([])
  const [clubs, setClubs] = useState<ApiClubListItem[]>([])
  const [boardSeats, setBoardSeats] = useState<ApiAdminBoardSeat[]>([])
  const [seatHolders, setSeatHolders] = useState<ApiSeatHolder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([adminGetMembers(), getClubs(), adminGetBoardSeats()])
      .then(([memberList, clubList, seatData]) => {
        if (cancelled) return
        setMembers(memberList)
        setClubs(clubList)
        setBoardSeats(seatData.seats)
        setSeatHolders(seatData.holders)
      })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load members') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  // Seat assignment is deliberately NOT a members.role change — a seat is a
  // time-bounded grant, so holding one never disturbs whether someone is a
  // club_rep, and losing one never touches their account.
  async function refreshSeats() {
    const seatData = await adminGetBoardSeats()
    setBoardSeats(seatData.seats)
    setSeatHolders(seatData.holders)
  }

  async function handleSeatAdd(seatId: string, memberId: string) {
    setSavingId(memberId)
    try {
      await adminAssignBoardSeat(seatId, memberId)
      await refreshSeats()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign seat')
    } finally { setSavingId(null) }
  }

  async function handleSeatRemove(seatId: string, memberId: string) {
    setSavingId(memberId)
    try {
      await adminRemoveBoardSeatHolder(seatId, memberId)
      await refreshSeats()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove seat')
    } finally { setSavingId(null) }
  }

  async function handleRoleChange(memberId: string, newRole: MemberRole) {
    setSavingId(memberId)
    try {
      await adminUpdateMemberRole(memberId, newRole)
      setMembers((prev) => prev.map((m) => m.id === memberId ? { ...m, role: newRole } : m))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role')
    } finally { setSavingId(null) }
  }

  async function handleClubChange(memberId: string, clubId: string) {
    setSavingId(memberId)
    try {
      const updated = await adminUpdateMemberClub(memberId, clubId || null)
      setMembers((prev) => prev.map((m) =>
        m.id === memberId ? { ...m, club_id: updated.club_id, club_name: clubs.find((c) => c.id === updated.club_id)?.name } : m))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update club')
    } finally { setSavingId(null) }
  }

  async function handleMembershipChange(memberId: string, field: 'status' | 'expiry', value: string) {
    setSavingId(memberId)
    try {
      const body = field === 'status'
        ? { membershipStatus: value }
        : { membershipExpiry: value || null }
      const updated = await adminUpdateMemberMembership(memberId, body)
      setMembers((prev) => prev.map((m) =>
        m.id === memberId ? { ...m, membership_status: updated.membership_status, membership_expiry: updated.membership_expiry } : m))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update membership')
    } finally { setSavingId(null) }
  }

  /** Returns false when the save failed, so the cell can restore what was stored. */
  async function handleNameChange(memberId: string, fullName: string): Promise<boolean> {
    setSavingId(memberId)
    try {
      const updated = await adminUpdateMemberName(memberId, fullName)
      setMembers((prev) => prev.map((m) =>
        m.id === memberId ? { ...m, full_name: updated.full_name } : m))
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update name')
      return false
    } finally { setSavingId(null) }
  }

  function confirmDelete(message: string, action: () => Promise<void>) {
    setConfirm({ message, onConfirm: async () => { setConfirm(null); try { await action() } catch (err) { setError(err instanceof Error ? err.message : 'Delete failed') } } })
  }

  function handleDeleteMember(m: ApiAdminMember) {
    confirmDelete(`Delete member "${m.full_name}"? This will remove all their data. This cannot be undone.`,
      async () => { await adminDeleteMember(m.id); setMembers((prev) => prev.filter((x) => x.id !== m.id)) })
  }

  async function handleImpersonate(m: ApiAdminMember) {
    setError(null)
    try {
      await startImpersonation(m.id)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start impersonation')
    }
  }

  return (
    <>
      {confirm && <ConfirmDialog message={confirm.message} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />}
      <SectionHeading title="Members" description="Edit roles, clubs, and membership; log in as a member to see what they see." />
      <ErrorNote error={error} />
      {loading ? <p className="text-muted-foreground" role="status">Loading…</p> : (
        <MembersTable
          members={members}
          admin={{
            clubs, savingId, boardSeats, seatHolders,
            onRoleChange: handleRoleChange,
            onClubChange: handleClubChange,
            onMembershipChange: handleMembershipChange,
            onNameChange: handleNameChange,
            onDelete: handleDeleteMember,
            onImpersonate: handleImpersonate,
            onSeatAdd: handleSeatAdd,
            onSeatRemove: handleSeatRemove,
          }}
        />
      )}
    </>
  )
}

// ── Tournaments ──────────────────────────────────────────────────────────────

function TournamentsSection() {
  const [tournaments, setTournaments] = useState<ApiTournamentListItem[]>([])
  const [clubs, setClubs] = useState<ApiClubListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([getTournaments(), getClubs()])
      .then(([list, clubList]) => { if (!cancelled) { setTournaments(list); setClubs(clubList) } })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load tournaments') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  async function handleClubChange(t: ApiTournamentListItem, clubId: string | null) {
    setSavingId(t.id)
    setError(null)
    try {
      await adminUpdateTournament(t.id, { clubId })
      const club = clubs.find((c) => c.id === clubId)
      setTournaments((prev) => prev.map((x) => x.id === t.id
        ? { ...x, club_id: clubId, club_name: club?.name ?? null, club_color: club?.color ?? null }
        : x))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change the organizing club')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <>
      <ErrorNote error={error} />
      {loading ? <p className="text-muted-foreground" role="status">Loading…</p> : (
        <TournamentList
          tournaments={tournaments}
          canCreate
          canAssignDirectors={() => true}
          clubs={clubs}
          onClubChange={handleClubChange}
          savingId={savingId}
        />
      )}
    </>
  )
}

// ── Clubs ────────────────────────────────────────────────────────────────────

function ClubsSection() {
  const [clubs, setClubs] = useState<ApiClubListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [newClub, setNewClub] = useState({ name: '', city: '', region: '' })
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    getClubs()
      .then((list) => { if (!cancelled) setClubs(list) })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load clubs') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setCreating(true)
    setError(null)
    try {
      const club = await adminCreateClub({
        name: newClub.name.trim(),
        city: newClub.city.trim(),
        region: newClub.region || null,
      })
      navigate(`/admin/clubs/${club.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create club')
      setCreating(false)
    }
  }

  function handleDelete(club: ApiClubListItem) {
    setConfirm({
      message: `Delete club "${club.name}"? Members will be unassigned. This cannot be undone.`,
      onConfirm: async () => {
        setConfirm(null)
        try {
          await adminDeleteClub(club.id)
          setClubs((prev) => prev.filter((c) => c.id !== club.id))
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Delete failed')
        }
      },
    })
  }

  const q = search.trim().toLowerCase()
  const visible = q
    ? clubs.filter((c) => c.name.toLowerCase().includes(q) || c.city.toLowerCase().includes(q))
    : clubs

  return (
    <>
      {confirm && <ConfirmDialog message={confirm.message} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />}
      <SectionHeading
        title="Clubs"
        description={`${clubs.length} clubs. Club reps can edit their own club; renaming, region and deleting stay with admins.`}
        action={!showNew && (
          <Button type="button" size="sm" className={GOLD} onClick={() => setShowNew(true)}>
            <Plus className="mr-1.5 size-3.5" /> New club
          </Button>
        )}
      />
      <ErrorNote error={error} />

      {showNew && (
        <form onSubmit={handleCreate} className="mb-6 rounded-xl border bg-card p-5 shadow-sm">
          <p className="mb-4 text-sm font-semibold text-lca-navy">New club</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="nc-name">Name</Label>
              <Input id="nc-name" required value={newClub.name} onChange={(e) => setNewClub((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nc-city">City</Label>
              <Input id="nc-city" required value={newClub.city} onChange={(e) => setNewClub((p) => ({ ...p, city: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nc-region">Region</Label>
              <select id="nc-region" className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={newClub.region} onChange={(e) => setNewClub((p) => ({ ...p, region: e.target.value }))}>
                <option value="">Select a region…</option>
                {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">You'll add the description, meeting details, logo and officers on the next screen.</p>
          <div className="mt-4 flex gap-2">
            <Button type="submit" className={GOLD} disabled={creating}>{creating ? 'Creating…' : 'Create club'}</Button>
            <Button type="button" variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {loading ? <p className="text-muted-foreground" role="status">Loading…</p> : (
        <>
          <Input type="search" placeholder="Search clubs by name or city…" value={search}
            onChange={(e) => setSearch(e.target.value)} className="mb-4 h-9 max-w-sm text-sm" />
          <ul className={`${ADMIN_SCROLL} divide-y rounded-xl border bg-card shadow-sm`}>
            {visible.map((club) => (
              <li key={club.id} className="flex items-center gap-3 px-4 py-3">
                <span className="size-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: club.color || '#c8a94a' }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-lca-navy">{club.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {club.city}{club.region ? ` · ${club.region}` : ''}{club.meeting_schedule ? ` · ${club.meeting_schedule}` : ''}
                  </p>
                </div>
                <Button asChild size="sm" variant="outline" className="h-8">
                  <Link to={`/admin/clubs/${club.id}`}>Edit</Link>
                </Button>
                <button type="button" onClick={() => handleDelete(club)} title={`Delete ${club.name}`}
                  className="p-1 text-muted-foreground transition-colors hover:text-destructive">
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
            {visible.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">No clubs match "{search.trim()}".</li>
            )}
          </ul>
        </>
      )}
    </>
  )
}

