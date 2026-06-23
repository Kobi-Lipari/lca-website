// src/pages/AdminPage.tsx
import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Building2, MessageSquare, Shield, Trophy, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  adminCreateTournament,
  adminGetMembers,
  adminUpdateMemberClub,
  adminUpdateMemberRole,
  getClubs,
  getTournaments,
  type ApiAdminMember,
  type ApiClubListItem,
  type ApiTournamentListItem,
} from '@/lib/api'
import { MEMBER_ROLES, ROLE_LABELS, type MemberRole } from '@/lib/roles'
import { cn } from '@/lib/utils'
import { usePageTitle } from '@/hooks/usePageTitle'

type AdminTab = 'members' | 'tournaments' | 'clubs'

const goldButtonClass =
  'bg-[#c8a94a] font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90'

export function AdminPage() {
  usePageTitle('Admin Panel')
  const [tab, setTab] = useState<AdminTab>('members')
  const [members, setMembers] = useState<ApiAdminMember[]>([])
  const [clubs, setClubs] = useState<ApiClubListItem[]>([])
  const [tournaments, setTournaments] = useState<ApiTournamentListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  const [newTournament, setNewTournament] = useState({
    name: '',
    location: '',
    date: '',
    entryFee: '45',
    clubId: '',
    isRated: true,
  })
  const [creatingTournament, setCreatingTournament] = useState(false)

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      const [memberList, clubList, tournamentList] = await Promise.all([
        adminGetMembers(),
        getClubs(),
        getTournaments(),
      ])
      setMembers(memberList)
      setClubs(clubList)
      setTournaments(tournamentList)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admin data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  async function handleRoleChange(memberId: string, role: MemberRole) {
    setSavingId(memberId)
    try {
      await adminUpdateMemberRole(memberId, role)
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role } : m)),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role')
    } finally {
      setSavingId(null)
    }
  }

  async function handleClubChange(memberId: string, clubId: string) {
    setSavingId(memberId)
    try {
      const updated = await adminUpdateMemberClub(memberId, clubId || null)
      setMembers((prev) =>
        prev.map((m) =>
          m.id === memberId
            ? {
                ...m,
                club_id: updated.club_id,
                club_name: clubs.find((c) => c.id === updated.club_id)?.name,
              }
            : m,
        ),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update club')
    } finally {
      setSavingId(null)
    }
  }

  async function handleCreateTournament(event: FormEvent) {
    event.preventDefault()
    setCreatingTournament(true)
    setError(null)
    try {
      await adminCreateTournament({
        name: newTournament.name,
        location: newTournament.location,
        date: newTournament.date,
        entryFee: Number(newTournament.entryFee),
        clubId: newTournament.clubId || null,
        isRated: newTournament.isRated,
      })
      setNewTournament({ name: '', location: '', date: '', entryFee: '45', clubId: '', isRated: true })
      const tournamentList = await getTournaments()
      setTournaments(tournamentList)
      setTab('tournaments')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tournament')
    } finally {
      setCreatingTournament(false)
    }
  }

  const tabs: { id: AdminTab; label: string; icon: typeof Users }[] = [
    { id: 'members', label: 'Members', icon: Users },
    { id: 'tournaments', label: 'Tournaments', icon: Trophy },
    { id: 'clubs', label: 'Clubs', icon: Building2 },
  ]

  return (
    <div>
      <section className="border-b-4 border-[#c8a94a] bg-[#1a2744] text-white">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex items-center gap-3">
            <Shield className="size-8 text-[#c8a94a] sm:size-10" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Admin Panel
              </h1>
              <p className="mt-2 max-w-2xl text-white/80">
                Manage members, roles, clubs, and tournaments across the LCA.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-wrap gap-2 border-b pb-4">
          {tabs.map(({ id, label, icon: Icon }) => (
            <Button
              key={id}
              type="button"
              variant={tab === id ? 'default' : 'outline'}
              className={cn(tab === id && goldButtonClass)}
              onClick={() => setTab(id)}
            >
              <Icon className="size-4" />
              {label}
            </Button>
          ))}
          <Button asChild variant="outline">
            <Link to="/admin/support">
              <MessageSquare className="size-4" />
              Support Tickets
            </Link>
          </Button>
        </div>

        {error && (
          <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {loading ? (
          <p className="mt-8 text-muted-foreground">Loading...</p>
        ) : (
          <>
            {tab === 'members' && (
              <div className="mt-8 overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 font-semibold">Name</th>
                      <th className="px-3 py-2 font-semibold">Email</th>
                      <th className="px-3 py-2 font-semibold">Role</th>
                      <th className="px-3 py-2 font-semibold">Club</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => (
                      <tr key={m.id} className="border-b">
                        <td className="px-3 py-3">{m.full_name}</td>
                        <td className="px-3 py-3 text-muted-foreground">{m.email}</td>
                        <td className="px-3 py-3">
                          <select
                            className="rounded-md border bg-background px-2 py-1"
                            value={m.role}
                            disabled={savingId === m.id}
                            onChange={(e) =>
                              handleRoleChange(m.id, e.target.value as MemberRole)
                            }
                          >
                            {MEMBER_ROLES.map((r) => (
                              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-3">
                          <select
                            className="max-w-[200px] rounded-md border bg-background px-2 py-1"
                            value={m.club_id ?? ''}
                            disabled={savingId === m.id}
                            onChange={(e) => handleClubChange(m.id, e.target.value)}
                          >
                            <option value="">No club</option>
                            {clubs.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tab === 'tournaments' && (
              <div className="mt-8 space-y-8">
                <form
                  onSubmit={handleCreateTournament}
                  className="rounded-xl border bg-card p-6 shadow-sm"
                >
                  <h2 className="text-lg font-bold text-[#1a2744]">
                    Create Tournament
                  </h2>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="t-name">Name</Label>
                      <Input
                        id="t-name"
                        value={newTournament.name}
                        onChange={(e) =>
                          setNewTournament((p) => ({ ...p, name: e.target.value }))
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="t-location">Location</Label>
                      <Input
                        id="t-location"
                        value={newTournament.location}
                        onChange={(e) =>
                          setNewTournament((p) => ({ ...p, location: e.target.value }))
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="t-date">Date</Label>
                      <Input
                        id="t-date"
                        type="date"
                        value={newTournament.date}
                        onChange={(e) =>
                          setNewTournament((p) => ({ ...p, date: e.target.value }))
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="t-fee">Entry fee ($)</Label>
                      <Input
                        id="t-fee"
                        type="number"
                        value={newTournament.entryFee}
                        onChange={(e) =>
                          setNewTournament((p) => ({ ...p, entryFee: e.target.value }))
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="t-club">Host club (optional)</Label>
                      <select
                        id="t-club"
                        className="w-full rounded-md border bg-background px-3 py-2"
                        value={newTournament.clubId}
                        onChange={(e) =>
                          setNewTournament((p) => ({ ...p, clubId: e.target.value }))
                        }
                      >
                        <option value="">No club</option>
                        {clubs.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Rated / Unrated toggle */}
                    <div className="sm:col-span-2">
                      <Label className="mb-2 block">Rating status</Label>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            setNewTournament((p) => ({ ...p, isRated: true }))
                          }
                          className={cn(
                            'flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-colors',
                            newTournament.isRated
                              ? 'border-[#1a2744] bg-[#1a2744] text-white'
                              : 'border-border text-muted-foreground hover:border-[#1a2744]/40',
                          )}
                        >
                          USCF Rated
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setNewTournament((p) => ({ ...p, isRated: false }))
                          }
                          className={cn(
                            'flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-colors',
                            !newTournament.isRated
                              ? 'border-[#1a2744] bg-[#1a2744] text-white'
                              : 'border-border text-muted-foreground hover:border-[#1a2744]/40',
                          )}
                        >
                          Unrated
                        </button>
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {newTournament.isRated
                          ? 'Players must have a USCF ID to register.'
                          : 'Open to all — no USCF ID required.'}
                      </p>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className={cn('mt-4', goldButtonClass)}
                    disabled={creatingTournament}
                  >
                    {creatingTournament ? 'Creating...' : 'Create tournament'}
                  </Button>
                </form>

                <ul className="space-y-3">
                  {tournaments.map((t) => (
                    <li
                      key={t.id}
                      className="flex flex-col gap-2 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-medium text-[#1a2744]">{t.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {t.date} · {t.location} · {t.status}
                        </p>
                      </div>
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/admin/tournaments/${t.id}`}>Manage</Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {tab === 'clubs' && (
              <ul className="mt-8 grid gap-4 sm:grid-cols-2">
                {clubs.map((club) => (
                  <li key={club.id} className="rounded-xl border bg-card p-5 shadow-sm">
                    <h3 className="font-semibold text-[#1a2744]">{club.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {club.city}, LA · {club.meeting_schedule}
                    </p>
                    <Button asChild className={cn('mt-4', goldButtonClass)} size="sm">
                      <Link to={`/admin/clubs/${club.id}`}>Edit club</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </div>
  )
}