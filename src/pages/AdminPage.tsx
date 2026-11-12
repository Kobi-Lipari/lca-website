// src/pages/AdminPage.tsx
// The LCA admin panel, lca_admin only. Club reps, directors and auditors
// have their own workspace (WorkspacePage.tsx) instead of a trimmed copy of
// this page.
//
// Sections are grouped (People / Events / Communications / System) in a
// sidebar and each has its own URL, /admin/<section>, so a section can be
// linked to and survives a reload. On phones the sidebar becomes a select.
//
// With mailLists on, the media manager (WS16 step 6), let in by the route
// though Admin does not let their role in, gets one group, Communications,
// with Group email alone: any other Admin address goes to /admin/email
// before a section is drawn, so nothing of another section is asked for.
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import {
  Award, Building2, Crown, Mail, Megaphone, MessageSquare, Newspaper, Plus, ShieldAlert, Trash2, Trophy, Users,
  type LucideIcon,
} from 'lucide-react'

import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/auth-context'
import { AdminAnnouncementPanel } from '@/areas/admin/components/AdminAnnouncementPanel'
import { AuditLogPanel } from '@/areas/admin/components/AuditLogPanel'
import { BoardSeatsPanel } from '@/areas/admin/components/BoardSeatsPanel'
import { ConfirmDialog } from '@/areas/admin/components/ConfirmDialog'
import { MembersTable } from '@/areas/admin/components/MembersTable'
import { PostsPanel } from '@/areas/admin/components/PostsPanel'
import { TournamentList } from '@/areas/admin/components/TournamentList'
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
  getTournamentCreation,
  getTournaments,
  type ApiAdminBoardSeat,
  type ApiAdminMember,
  type ApiClubListItem,
  type ApiSeatHolder,
  type ApiTournamentCreation,
  type ApiTournamentListItem,
} from '@/lib/api'
import { useMediaManagerAnswer } from '@/areas/admin/mediaManagerAnswer'
import { canAccessAdmin, canUseMailing, type MemberRole } from '@/areas/admin/roles'
import { FEATURES } from '@/lib/features'
import { REGIONS } from '@/lib/regions'
import { cn } from '@/lib/utils'
import { usePageTitle } from '@/hooks/usePageTitle'
import { ADMIN_SCROLL, GOLD_BUTTON as GOLD } from '@/lib/brand'
import { ViewOnlyFieldset, ViewOnlyNote } from '@/lib/viewOnly'
import { useViewOnly } from '@/hooks/useViewOnly'
import { ChampionsPanel } from '@/areas/admin/components/ChampionsPanel'
import { MembersExportMenu } from '@/areas/admin/components/MembersExportMenu'

// ── Sections ─────────────────────────────────────────────────────────────────

type AdminSection =
  | 'members' | 'board-seats'
  | 'tournaments' | 'clubs' | 'champions'
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
    { id: 'champions', label: 'State champions', icon: Crown },
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


/** Old ?tab / section names that should still land somewhere sensible. */
const LEGACY: Record<string, AdminSection> = { boardseats: 'board-seats', audit: 'activity' }

/** The media manager's Admin, with mailLists on: Communications, with Group email alone. */
const MEDIA_MANAGER_GROUPS: typeof GROUPS = [
  { label: 'Communications', items: [{ id: 'email', label: 'Group email', icon: Mail }] },
]

// ── Page ─────────────────────────────────────────────────────────────────────

export function AdminPage() {
  const { section: rawSection } = useParams<{ section?: string }>()
  const navigate = useNavigate()

  const viewOnly = useViewOnly()
  const { role } = useAuth()
  // The route lets in a role outside Admin's only for the media manager, on the server's answer, which it hands down;
  // this page asks nothing itself.
  const mediaManager = useMediaManagerAnswer()
  const asMediaManager = FEATURES.mailLists && !canAccessAdmin(role) && mediaManager.mediaManager
  // An LCA officer who holds the Media manager seat (K's decision 52, checkpoint M's review), with mailLists on, keeps
  // every read-only section and gains Group email in the media manager's form; while the answer is on the way their
  // Admin is today's, without Group email.
  const officerMediaManager = FEATURES.mailLists && role === 'lca_officer' && mediaManager.mediaManager
  // An officer who opened Group email's own address while the answer is on the way keeps the address, its section
  // showing the loading line until the answer says whether it is theirs; every other section draws at once.
  const officerWaitsOnEmail = FEATURES.mailLists && role === 'lca_officer' && mediaManager.asking && rawSection === 'email'
  // LCA Officers get everything an Observer does except the mailing tools.
  const mailing = canUseMailing(role)
  const groups = asMediaManager
    ? MEDIA_MANAGER_GROUPS
    : mailing || officerMediaManager
      ? GROUPS
      : GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => i.id !== 'email') }))
  const section = (LEGACY[rawSection ?? ''] ?? rawSection ?? 'members') as AdminSection
  const current = groups.flatMap((g) => g.items).find((s) => s.id === section)
  usePageTitle(current ? `Admin · ${current.label}` : 'Admin panel')

  // Any other Admin address, typed by hand or followed from an old link, goes to Group email before anything is drawn.
  if (asMediaManager && rawSection !== 'email') return <Navigate to="/admin/email" replace />
  if (!current && !officerWaitsOnEmail) return <Navigate to="/admin" replace />
  if (rawSection && LEGACY[rawSection]) return <Navigate to={`/admin/${section}`} replace />

  return (
    <div>
      <PageHero
        title="Admin panel"
        subtitle={asMediaManager
          ? undefined
          : viewOnly
            ? mailing
              ? 'See everything across the LCA. You can send group email, email entrants, answer support tickets and manage the bylaws and minutes; other changes are made by admins.'
              : officerMediaManager
                ? 'See everything across the LCA. You can send the LCA newsletter, answer support tickets and manage the bylaws and minutes; other changes are made by admins.'
                : 'See everything across the LCA. You can answer support tickets and manage the bylaws and minutes; other changes are made by admins.'
            : 'Manage members, clubs, tournaments and communications across the LCA.'}
        badges={viewOnly ? <span className="rounded-full border border-white/25 px-2.5 py-0.5 text-xs text-white/85">View only</span> : undefined}
        size="compact"
      />

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-8 lg:py-8">
        {/* Phone / tablet: a select instead of the sidebar */}
        <div className="mb-6 lg:hidden">
          <Label htmlFor="admin-section" className="sr-only">Section</Label>
          <select
            id="admin-section"
            className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm font-medium text-ink"
            value={section}
            onChange={(e) => navigate(`/admin/${e.target.value}`)}
          >
            {groups.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.items.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </optgroup>
            ))}
          </select>
        </div>

        <nav aria-label="Admin sections" className="hidden lg:block">
          <div className="sticky top-6 space-y-5">
            {groups.map((g) => (
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
                            ? 'bg-brand-navy font-medium text-white'
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
          {officerWaitsOnEmail ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : (
            <AdminSectionView section={section} mediaManager={asMediaManager || officerMediaManager ? { secondFactor: mediaManager.secondFactor } : undefined} />
          )}
        </main>
      </div>
    </div>
  )
}

function SectionHeading({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}

// Keyed by section so each one mounts fresh and loads only what it shows. The media manager reaches the email section
// alone, which then draws their own form of Group email.
function AdminSectionView({ section, mediaManager }: { section: AdminSection; mediaManager?: { secondFactor: boolean } }) {
  switch (section) {
    case 'members': return <MembersSection key="members" />
    case 'board-seats': return <><SectionHeading title="Board seats" description="Who holds each board seat, and for how long." /><ViewOnlyNote /><ViewOnlyFieldset><BoardSeatsPanel /></ViewOnlyFieldset></>
    case 'tournaments': return <TournamentsSection key="tournaments" />
    case 'clubs': return <ClubsSection key="clubs" />
    case 'champions': return <><SectionHeading title="State champions" description="The honor roll on the public State champions page." /><ViewOnlyNote /><ChampionsPanel /></>
    case 'news': return <PostsPanel />
    case 'email': return <AdminEmailPage embedded mediaManager={mediaManager} />
    case 'announcements': return <><SectionHeading title="Site banners" description="Short notices shown across the top of every page. For full announcements, use News posts." /><ViewOnlyNote /><ViewOnlyFieldset><AdminAnnouncementPanel /></ViewOnlyFieldset></>
    case 'support': return <AdminSupportPage embedded />
    case 'activity': return <><SectionHeading title="Admin activity" description="Who changed what: roles, memberships, events, payments and club pages." /><AuditLogPanel /></>
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
  const viewOnly = useViewOnly()
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

  // Seat assignment is deliberately NOT a members.role change: a seat is a
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
      <SectionHeading title="Members" description="Edit roles, clubs, and membership; log in as a member to see what they see." action={<MembersExportMenu />} />
      <ErrorNote error={error} />
      {loading ? <p className="text-muted-foreground" role="status">Loading…</p> : (
        <MembersTable
          members={members}
          admin={{
            viewOnly,
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
  const viewOnly = useViewOnly()
  const { role, member } = useAuth()
  const [tournaments, setTournaments] = useState<ApiTournamentListItem[]>([])
  const [clubs, setClubs] = useState<ApiClubListItem[]>([])
  const [creation, setCreation] = useState<ApiTournamentCreation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  // With standingDirectors on, an observer or an officer asks the server what
  // they may create, since the President seat, not the role, is the grant.
  // The president's list is then read signed in, so it holds who created
  // each event and the president's own drafts; everyone else's list is
  // today's. A failed creation answer leaves the section as it is today.
  const asksCreation = FEATURES.standingDirectors && (role === 'lca_observer' || role === 'lca_officer')

  useEffect(() => {
    let cancelled = false
    const load: Promise<readonly [ApiTournamentListItem[], ApiClubListItem[], ApiTournamentCreation | null]> = asksCreation
      ? getTournamentCreation()
        .catch(() => null)
        .then((answer) => Promise.all([getTournaments({ signedIn: answer?.grant === 'president' }), getClubs()])
          .then(([list, clubList]) => [list, clubList, answer] as const))
      : Promise.all([getTournaments(), getClubs()]).then(([list, clubList]) => [list, clubList, null] as const)
    load
      .then(([list, clubList, answer]) => { if (!cancelled) { setTournaments(list); setClubs(clubList); setCreation(answer) } })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load tournaments') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [asksCreation])

  // The president creates LCA-run events from the view-only Admin, with no
  // club picker, so the wizard sends no club, and names directors on the
  // LCA-run events they created, as the server's naming rule allows. The
  // signed-in answer gives an observer every draft on the site, so the
  // president's section keeps today's list, the listed events, and adds the
  // president's own drafts alone; the wizard's starting points are the same.
  const president = FEATURES.standingDirectors && creation?.grant === 'president'
  const listed = president
    ? tournaments.filter((t) => t.is_visible === 1 || (!!member && t.created_by === member.id))
    : tournaments

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
          tournaments={listed}
          canCreate={!viewOnly || president}
          canAssignDirectors={(t) => !viewOnly || (president && !!member && t.created_by === member.id && !t.club_id)}
          clubs={viewOnly ? undefined : clubs}
          onClubChange={viewOnly ? undefined : handleClubChange}
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
  const viewOnly = useViewOnly()

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
        action={!showNew && !viewOnly && (
          <Button type="button" size="sm" className={GOLD} onClick={() => setShowNew(true)}>
            <Plus className="mr-1.5 size-3.5" /> New club
          </Button>
        )}
      />
      <ErrorNote error={error} />

      {showNew && (
        <form onSubmit={handleCreate} className="mb-6 rounded-xl border bg-card p-5 shadow-sm">
          <p className="mb-4 text-sm font-semibold text-ink">New club</p>
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
                  <p className="truncate font-medium text-ink">{club.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {club.city}{club.region ? ` · ${club.region}` : ''}{club.meeting_schedule ? ` · ${club.meeting_schedule}` : ''}
                  </p>
                </div>
                <Button asChild size="sm" variant="outline" className="h-8">
                  <Link to={`/admin/clubs/${club.id}`}>{viewOnly ? 'View' : 'Edit'}</Link>
                </Button>
                {!viewOnly && (
                  <button type="button" onClick={() => handleDelete(club)} title={`Delete ${club.name}`}
                    className="p-1 text-muted-foreground transition-colors hover:text-destructive">
                    <Trash2 className="size-4" />
                  </button>
                )}
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

