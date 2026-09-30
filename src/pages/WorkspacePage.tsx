// src/pages/WorkspacePage.tsx
// The club / event workspace: the tools page for club reps, tournament
// directors and auditors. It replaces the old practice of sending them into
// a trimmed-down copy of the admin panel — each role sees only what it can
// actually use, and the admin panel is left to admins.
//
//   club_rep            → My club · Events (create + manage) · Member lookup
//   tournament_director → Events (the ones they direct) · Member lookup
//   lca_auditor         → Member lookup
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Building2, ExternalLink, Search, Trophy, Users } from 'lucide-react'

import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/button'
import { MembersTable } from '@/components/admin/MembersTable'
import { TournamentList } from '@/components/admin/TournamentList'
import { useAuth } from '@/contexts/auth-context'
import {
  adminGetClub,
  adminGetMembers,
  getTournaments,
  type ApiAdminMember,
  type ApiClubDetail,
  type ApiTournamentListItem,
} from '@/lib/api'
import { ROLE_LABELS, WORKSPACE_ROLES } from '@/lib/roles'
import { cn } from '@/lib/utils'
import { usePageTitle } from '@/hooks/usePageTitle'
import { GOLD_BUTTON as GOLD } from '@/lib/brand'

type WorkspaceTab = 'club' | 'events' | 'lookup'

export function WorkspacePage() {
  usePageTitle('Workspace')
  const { role, member, directedTournamentIds } = useAuth()
  const [params, setParams] = useSearchParams()

  const isRep = role === 'club_rep'
  const clubId = isRep ? member?.club_id ?? null : null

  const tabs = useMemo(() => {
    const list: { id: WorkspaceTab; label: string; icon: typeof Users }[] = []
    if (clubId) list.push({ id: 'club', label: 'My club', icon: Building2 })
    if (role !== 'lca_auditor') list.push({ id: 'events', label: 'Events', icon: Trophy })
    // Member lookup comes with a role; being assigned to direct an event
    // doesn't include it.
    if (WORKSPACE_ROLES.includes(role)) list.push({ id: 'lookup', label: 'Member lookup', icon: Search })
    return list
  }, [clubId, role])

  const requested = params.get('tab') as WorkspaceTab | null
  const tab: WorkspaceTab = tabs.some((t) => t.id === requested) ? requested! : tabs[0].id

  function selectTab(next: WorkspaceTab) {
    setParams(next === tabs[0].id ? {} : { tab: next }, { replace: true })
  }

  const subtitle = role === 'lca_auditor'
    ? 'Look up a member to check their membership status.'
    : isRep
      ? 'Keep your club page current and run your club’s tournaments.'
      : 'Run the tournaments you direct.'

  return (
    <div>
      <PageHero
        title="Workspace"
        subtitle={subtitle}
        badges={<span className="rounded-full border border-white/20 px-2.5 py-0.5 text-xs text-white/80">{WORKSPACE_ROLES.includes(role) ? ROLE_LABELS[role] : 'Event director'}</span>}
        size="compact"
      />

      <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {isRep && !clubId && (
          <p className="mb-6 rounded-lg border border-lca-gold/40 bg-lca-gold/10 px-4 py-3 text-sm text-[#7a5c00]">
            Your account is a club rep account but isn’t linked to a club yet. Ask an LCA admin to assign your club,
            then you’ll be able to edit it and create its tournaments here.
          </p>
        )}

        {tabs.length > 1 && (
          <div role="tablist" className="mb-6 flex gap-1 overflow-x-auto border-b">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => selectTab(id)}
                className={cn(
                  '-mb-px flex flex-shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                  tab === id ? 'border-lca-gold text-lca-navy' : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-4" /> {label}
              </button>
            ))}
          </div>
        )}

        {tab === 'club' && clubId && <MyClubPanel clubId={clubId} onShowEvents={() => selectTab('events')} />}
        {tab === 'events' && (
          <EventsPanel
            role={role}
            clubId={clubId}
            memberId={member?.id ?? null}
            directedTournamentIds={directedTournamentIds}
          />
        )}
        {tab === 'lookup' && <LookupPanel />}
      </section>
    </div>
  )
}

// ── My club ──────────────────────────────────────────────────────────────────

function MyClubPanel({ clubId, onShowEvents }: { clubId: string; onShowEvents: () => void }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof adminGetClub>> | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    adminGetClub(clubId)
      .then((d) => { if (!cancelled) setData(d) })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load club') })
    return () => { cancelled = true }
  }, [clubId])

  if (error) return <p className="text-sm text-destructive">{error}</p>
  if (!data) return <p className="text-muted-foreground" role="status">Loading…</p>

  const { club, roster, officers, tournaments } = data
  const upcoming = tournaments.filter((t) => t.status !== 'completed')
  const drafts = tournaments.filter((t) => t.is_visible === 0 && t.status !== 'completed')

  // Things a rep would want to fix before their page looks finished.
  const gaps = [
    !club.description && 'a description',
    !club.meeting_schedule && 'a meeting schedule',
    !club.location && 'a meeting location',
    !club.contact_email && 'a contact email',
    !club.image_url && 'a logo',
  ].filter(Boolean) as string[]

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <ClubMark club={club} />
            <div className="min-w-0">
              <h2 className="truncate text-xl font-bold text-lca-navy">{club.name}</h2>
              <p className="text-sm text-muted-foreground">
                {club.city}, LA{club.meeting_schedule ? ` · ${club.meeting_schedule}` : ''}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to={`/clubs/${club.id}`}><ExternalLink className="mr-1.5 size-3.5" /> Public page</Link>
            </Button>
            <Button asChild size="sm" className={GOLD}>
              <Link to={`/admin/clubs/${club.id}`}>Edit club</Link>
            </Button>
          </div>
        </div>

        {gaps.length > 0 && (
          <p className="mt-4 rounded-lg bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            Your public page is missing {listPhrase(gaps)}.{' '}
            <Link to={`/admin/clubs/${club.id}`} className="font-medium text-lca-navy underline-offset-2 hover:underline">Add {gaps.length > 1 ? 'them' : 'it'}</Link>
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Members on roster" value={roster.length} to={`/admin/clubs/${club.id}?tab=roster`} />
        <Stat label="Officers listed" value={officers.length} to={`/admin/clubs/${club.id}?tab=roster`} />
        <Stat
          label={drafts.length ? `Upcoming events · ${drafts.length} draft` : 'Upcoming events'}
          value={upcoming.length}
          onClick={onShowEvents}
        />
      </div>
    </div>
  )
}

function ClubMark({ club }: { club: ApiClubDetail }) {
  if (club.image_url) {
    return <img src={club.image_url} alt="" className="size-14 flex-shrink-0 rounded-lg border bg-white object-contain p-1" />
  }
  return (
    <div className="flex size-14 flex-shrink-0 items-center justify-center rounded-lg text-lg font-bold text-white"
      style={{ backgroundColor: club.color || '#1a2744' }}>
      {club.name.charAt(0)}
    </div>
  )
}

function Stat({ label, value, to, onClick }: { label: string; value: number; to?: string; onClick?: () => void }) {
  const inner = (
    <>
      <p className="text-2xl font-bold text-lca-navy">{value}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">{label}</p>
    </>
  )
  const cls = 'block rounded-xl border bg-card p-5 text-left shadow-sm transition-colors hover:border-lca-gold'
  if (to) return <Link to={to} className={cls}>{inner}</Link>
  return <button type="button" onClick={onClick} className={cn(cls, 'w-full')}>{inner}</button>
}

function listPhrase(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

// ── Events ───────────────────────────────────────────────────────────────────

function EventsPanel({ role, clubId, memberId, directedTournamentIds }: {
  role: string
  clubId: string | null
  memberId: string | null
  directedTournamentIds: string[]
}) {
  const [tournaments, setTournaments] = useState<ApiTournamentListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getTournaments()
      .then((list) => { if (!cancelled) setTournaments(list) })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load tournaments') })
    return () => { cancelled = true }
  }, [])

  if (error) return <p className="text-sm text-destructive">{error}</p>
  if (!tournaments) return <p className="text-muted-foreground" role="status">Loading…</p>

  // The list endpoint also returns every public event; keep only the ones
  // this person can manage — their club's, plus any they direct.
  const directed = new Set(directedTournamentIds)
  const mine = tournaments.filter((t) =>
    (role === 'club_rep' && clubId && t.club_id === clubId) || directed.has(t.id))

  const ownClub = (t: ApiTournamentListItem) => role === 'club_rep' && !!clubId && t.club_id === clubId

  return (
    <TournamentList
      tournaments={mine}
      canCreate={role === 'club_rep' && !!clubId && !!memberId}
      canAssignDirectors={ownClub}
      emptyHint={role === 'club_rep'
        ? 'Create your club’s first tournament to get started.'
        : 'Events you’re assigned to direct will appear here.'}
    />
  )
}

// ── Member lookup ────────────────────────────────────────────────────────────

function LookupPanel() {
  const [members, setMembers] = useState<ApiAdminMember[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    adminGetMembers()
      .then((list) => { if (!cancelled) setMembers(list) })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load members') })
    return () => { cancelled = true }
  }, [])

  if (error) return <p className="text-sm text-destructive">{error}</p>
  if (!members) return <p className="text-muted-foreground" role="status">Loading…</p>
  return <MembersTable members={members} />
}
