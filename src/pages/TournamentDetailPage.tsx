// src/pages/TournamentDetailPage.tsx
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Bell, BellOff, Calendar, CheckCircle2,
  Clock, MapPin, Trophy, Users, X, ChevronRight,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/auth-context'
import {
  createRegistration,
  getTournament,
  optInTournamentReminder,
  optOutTournamentReminder,
  getTournamentReminderStatus,
  payRegistration,
  updateRegistrationByes,
  type ApiMyRegistration,
  type ApiRosterPlayer,
  type ApiTournamentDetail,
  type ApiTournamentPairing,
  type TournamentStatus,
} from '@/lib/api'
import { cn } from '@/lib/utils'
import { usePageTitle } from '@/hooks/usePageTitle'

const statusConfig: Record<TournamentStatus, { label: string; className: string }> = {
  upcoming: { label: 'Upcoming', className: 'bg-lca-gold/20 text-lca-gold' },
  active:   { label: 'Active',   className: 'bg-emerald-500/20 text-emerald-300' },
  completed:{ label: 'Completed',className: 'bg-white/10 text-white/60' },
}

const goldBtn = 'bg-lca-gold font-semibold text-lca-navy hover:bg-lca-gold/90'

// ── Registration confirmation modal ─────────────────────────────────────────

function RegistrationModal({
  tournament, member, selectedSection, byeRounds,
  onConfirm, onCancel, registering, error,
}: {
  tournament: ApiTournamentDetail
  member: { full_name: string; email: string; uscf_id?: string | null; uscf_rating?: number | null }
  selectedSection: string
  byeRounds: number[]
  onConfirm: () => void
  onCancel: () => void
  registering: boolean
  error: string | null
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="mx-4 w-full max-w-md rounded-xl border bg-background p-6 shadow-lg">
        <div className="mb-4 flex items-start justify-between">
          <h3 className="text-lg font-bold text-lca-navy">Confirm registration</h3>
          <button type="button" onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Registering for <span className="font-medium text-foreground">{tournament.name}</span>.
        </p>
        <div className="mb-4 space-y-2 rounded-lg border bg-muted/30 p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Name</span>
            <span className="font-medium">{member.full_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium">{member.email}</span>
          </div>
          {member.uscf_id && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">USCF ID</span>
              <span className="font-medium">{member.uscf_id}</span>
            </div>
          )}
          {member.uscf_rating != null && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rating</span>
              <span className="font-medium">{member.uscf_rating}</span>
            </div>
          )}
          <div className="flex justify-between border-t pt-2">
            <span className="text-muted-foreground">Section</span>
            <span className="font-medium">{selectedSection}</span>
          </div>
          {byeRounds.length > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bye rounds</span>
              <span className="font-medium">{byeRounds.map((r) => `Rd ${r}`).join(', ')}</span>
            </div>
          )}
        </div>
        {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
        <div className="flex gap-3">
          <Button type="button" variant="outline" className="flex-1" onClick={onCancel} disabled={registering}>
            Cancel
          </Button>
          <Button type="button" className={cn('flex-1', goldBtn)} onClick={onConfirm} disabled={registering}>
            {registering ? 'Registering…' : 'Confirm'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Bye rounds editor ────────────────────────────────────────────────────────

function ByeRoundsEditor({
  registration, totalRounds, onSave,
}: {
  registration: ApiMyRegistration
  totalRounds: number
  onSave: (byeRounds: number[]) => Promise<void>
}) {
  const [selected, setSelected] = useState<number[]>(registration.bye_rounds ?? [])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const maxByes = totalRounds - 1

  function toggle(round: number) {
    setSelected((prev) =>
      prev.includes(round) ? prev.filter((r) => r !== round) : [...prev, round].sort((a, b) => a - b),
    )
    setSaved(false)
    setSaveError(null)
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    try {
      await onSave(selected)
      setSaved(true)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to update byes')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Max {maxByes} bye{maxByes !== 1 ? 's' : ''} (half-point each).
      </p>
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: totalRounds }, (_, i) => i + 1).map((round) => {
          const isSel = selected.includes(round)
          const wouldExceed = !isSel && selected.length >= maxByes
          return (
            <button
              key={round}
              type="button"
              disabled={wouldExceed}
              onClick={() => toggle(round)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                isSel
                  ? 'border-lca-navy bg-lca-navy text-white'
                  : wouldExceed
                  ? 'cursor-not-allowed border-border text-muted-foreground/40'
                  : 'border-border text-muted-foreground hover:border-lca-navy/40',
              )}
            >
              Round {round}
            </button>
          )
        })}
      </div>
      {saveError && <p className="text-xs text-destructive">{saveError}</p>}
      <Button type="button" size="sm" className={goldBtn} onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Update bye rounds'}
      </Button>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export function TournamentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, member: authMember } = useAuth()

  const [tournament, setTournament] = useState<ApiTournamentDetail | null>(null)
  const [roster, setRoster] = useState<ApiRosterPlayer[]>([])
  const [pairings, setPairings] = useState<ApiTournamentPairing[]>([])
  const [myRegistration, setMyRegistration] = useState<ApiMyRegistration | null>(null)
  // The route param is known at first render, so a missing id is the state we
  // start in rather than something an effect corrects a render later.
  const [loading, setLoading] = useState(!!id)
  const [notFound, setNotFound] = useState(!id)
  const [error, setError] = useState<string | null>(null)

  const [selectedSection, setSelectedSection] = useState('')
  const [selectedByes, setSelectedByes] = useState<number[]>([])
  const [registering, setRegistering] = useState(false)
  const [registerError, setRegisterError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [payingNow, setPayingNow] = useState(false)
  const [confirmation, setConfirmation] = useState<{
    message: string; paymentUrl: string | null; section: string
  } | null>(null)

  const [reminderOptedIn, setReminderOptedIn] = useState(false)
  const [togglingReminder, setTogglingReminder] = useState(false)

  usePageTitle(tournament?.name ?? 'Tournament')

  useEffect(() => {
    if (!id) return
    async function load() {
      try {
        const data = await getTournament(id!)
        setTournament(data.tournament)
        setRoster(data.roster)
        setPairings(data.pairings ?? [])
        setMyRegistration(data.myRegistration ?? null)
        setSelectedSection(data.tournament.sections[0]?.name ?? '')
        setNotFound(false)
        setError(null)
        if (user) {
          try {
            const s = await getTournamentReminderStatus(id!)
            setReminderOptedIn(s.opted_in)
          } catch { /* ignore */ }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load tournament'
        if (msg.toLowerCase().includes('not found')) setNotFound(true)
        else setError(msg)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, user])

  async function handleRegisterClick(e: FormEvent) {
    e.preventDefault()
    if (!id || !selectedSection) return
    if (!user) { navigate('/login', { state: { from: location.pathname } }); return }
    if (tournament?.is_rated && !authMember?.uscf_id) {
      setRegisterError('This is a USCF-rated tournament. Add your USCF ID to your profile before registering.')
      return
    }
    setRegisterError(null)
    setShowModal(true)
  }

  async function handleConfirmRegistration() {
    if (!id || !selectedSection) return
    setRegistering(true)
    setRegisterError(null)
    try {
      const result = await createRegistration(id, selectedSection, selectedByes)
      setConfirmation({ message: result.message, paymentUrl: result.paymentUrl, section: selectedSection })
      setShowModal(false)
      const data = await getTournament(id)
      setRoster(data.roster)
      setMyRegistration(data.myRegistration ?? null)
    } catch (err) {
      setRegisterError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setRegistering(false)
    }
  }

  async function handlePayNow() {
    if (!myRegistration) return
    setPayingNow(true)
    setRegisterError(null)
    try {
      const { paymentUrl } = await payRegistration(myRegistration.id)
      window.location.href = paymentUrl
    } catch (err) {
      setRegisterError(err instanceof Error ? err.message : 'Could not start payment')
    } finally {
      setPayingNow(false)
    }
  }

  async function handleToggleReminder() {
    if (!id || !user) return
    setTogglingReminder(true)
    try {
      if (reminderOptedIn) {
        await optOutTournamentReminder(id)
        setReminderOptedIn(false)
      } else {
        await optInTournamentReminder(id)
        setReminderOptedIn(true)
      }
    } catch { /* ignore */ } finally {
      setTogglingReminder(false)
    }
  }

  async function handleUpdateByes(byeRounds: number[]) {
    if (!myRegistration) return
    await updateRegistrationByes(myRegistration.id, byeRounds)
    setMyRegistration((prev) => prev ? { ...prev, bye_rounds: byeRounds } : prev)
  }

  function toggleBye(round: number) {
    setSelectedByes((prev) =>
      prev.includes(round) ? prev.filter((r) => r !== round) : [...prev, round].sort((a, b) => a - b),
    )
  }

  // ── Loading / error states ───────────────────────────────────────────────

  if (loading) return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <p className="text-muted-foreground">Loading tournament…</p>
    </div>
  )

  if (error) return (
    <div className="mx-auto max-w-6xl px-6 py-12 text-center">
      <p className="text-destructive">{error}</p>
      <Button asChild className="mt-6" variant="outline">
        <Link to="/tournaments"><ArrowLeft className="size-4" /> Back</Link>
      </Button>
    </div>
  )

  if (notFound || !tournament) return (
    <div className="mx-auto max-w-6xl px-6 py-12 text-center">
      <Trophy className="mx-auto size-12 text-muted-foreground" />
      <h1 className="mt-4 text-2xl font-bold text-lca-navy">Tournament not found</h1>
      <Button asChild className="mt-6" variant="outline">
        <Link to="/tournaments"><ArrowLeft className="size-4" /> Back to tournaments</Link>
      </Button>
    </div>
  )

  // ── Derived values ───────────────────────────────────────────────────────

  const status    = statusConfig[tournament.status]
  const isRated   = tournament.is_rated !== 0
  const regStatus = tournament.registration_status ?? 'draft'
  const roundSchedule = tournament.round_schedule ?? []
  const customDetails = tournament.custom_details ?? []
  const maxPlayers = tournament.max_players ?? '—'
  const maxByes = tournament.rounds - 1
  const hasPairings = pairings.length > 0

  // Withdrawn players are excluded from public display and counts
  const activeRoster = roster.filter((p) => !p.withdrawn_at)

  // Group active roster by section, sorted by name within each section
  const rosterBySectionMap = new Map<string, ApiRosterPlayer[]>()
  for (const player of activeRoster) {
    const sec = player.section ?? 'Unknown'
    if (!rosterBySectionMap.has(sec)) rosterBySectionMap.set(sec, [])
    rosterBySectionMap.get(sec)!.push(player)
  }
  for (const players of rosterBySectionMap.values()) {
    players.sort((a, b) => a.full_name.localeCompare(b.full_name))
  }
  // Preserve section order from tournament.sections
  const sectionOrder = tournament.sections.map((s) => s.name)
  const rosterSections = [
    ...sectionOrder.filter((s) => rosterBySectionMap.has(s)),
    ...[...rosterBySectionMap.keys()].filter((s) => !sectionOrder.includes(s)),
  ]

  return (
    <div>
      {showModal && authMember && (
        <RegistrationModal
          tournament={tournament}
          member={authMember}
          selectedSection={selectedSection}
          byeRounds={selectedByes}
          onConfirm={handleConfirmRegistration}
          onCancel={() => { setShowModal(false); setRegisterError(null) }}
          registering={registering}
          error={registerError}
        />
      )}

      {/* ── Hero ── */}
      <section className="border-b-[3px] border-lca-gold bg-lca-navy text-white">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <Link
            to="/tournaments"
            className="inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-lca-gold transition-colors"
          >
            <ArrowLeft className="size-3.5" /> All tournaments
          </Link>

          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  {tournament.name}
                </h1>
                <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', status.className)}>
                  {status.label}
                </span>
                <span className={cn(
                  'rounded-full px-2.5 py-0.5 text-xs font-medium',
                  isRated ? 'bg-blue-500/20 text-blue-200' : 'bg-white/10 text-white/60',
                )}>
                  {isRated ? 'USCF Rated' : 'Unrated'}
                </span>
                {regStatus === 'open' && tournament.status === 'upcoming' && (
                  <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
                    Registration open
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-2 text-sm text-white/70 sm:flex-row sm:flex-wrap sm:gap-x-6">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="size-4 flex-shrink-0 text-lca-gold" />
                  {tournament.date}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-4 flex-shrink-0 text-lca-gold" />
                  {tournament.location}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="size-4 flex-shrink-0 text-lca-gold" />
                  {tournament.rounds} rounds
                  {tournament.time_control && ` · ${tournament.time_control}`}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Users className="size-4 flex-shrink-0 text-lca-gold" />
                  {activeRoster.length} / {maxPlayers} registered
                </span>
              </div>
            </div>

            {/* Pairings / Results button */}
            <div className="flex-shrink-0">
              {hasPairings ? (
                <Button
                  asChild
                  size="sm"
                  className="border-lca-gold/50 bg-lca-gold/15 text-lca-navy hover:bg-lca-gold/25"
                  variant="outline"
                >
                  <Link to={`/tournaments/${id}/pairings`}>
                    See pairings / results <ChevronRight className="ml-1 size-3.5" />
                  </Link>
                </Button>
              ) : (
                <div className="group relative">
                  <Button
                    size="sm"
                    disabled
                    variant="outline"
                    className="border-white/15 bg-white/5 text-white/30 cursor-not-allowed"
                  >
                    See pairings / results <ChevronRight className="ml-1 size-3.5" />
                  </Button>
                  <div className="pointer-events-none absolute right-0 top-full mt-1.5 w-max rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-muted-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100">
                    Not yet published
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Body ── */}
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-8 lg:grid-cols-3">

          {/* ── Main column ── */}
          <div className="space-y-8 lg:col-span-2">

            {/* About */}
            {(tournament.description || tournament.venue) && (
              <div>
                <h2 className="text-xl font-bold text-lca-navy">About</h2>
                {tournament.description && (
                  <p className="mt-3 text-muted-foreground">{tournament.description}</p>
                )}
                {tournament.venue && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    <span className="font-medium text-lca-navy">Venue:</span> {tournament.venue}
                  </p>
                )}
              </div>
            )}

            {/* Round schedule */}
            {roundSchedule.length > 0 && (
              <div>
                <h2 className="text-xl font-bold text-lca-navy">Round schedule</h2>
                <div className="mt-4 overflow-x-auto rounded-xl border">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-3 font-semibold text-lca-navy">Round</th>
                        <th className="px-4 py-3 font-semibold text-lca-navy">Date</th>
                        <th className="px-4 py-3 font-semibold text-lca-navy">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roundSchedule.map((rs) => (
                        <tr key={rs.round} className="border-b last:border-0">
                          <td className="px-4 py-3 font-medium">Round {rs.round}</td>
                          <td className="px-4 py-3 text-muted-foreground">{rs.date || '—'}</td>
                          <td className="px-4 py-3 text-muted-foreground">{rs.time || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Sections */}
            <div>
              <h2 className="text-xl font-bold text-lca-navy">Sections</h2>
              <div className="mt-4 overflow-x-auto rounded-xl border">
                <table className="w-full min-w-[360px] text-left text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 font-semibold text-lca-navy">Section</th>
                      <th className="px-4 py-3 font-semibold text-lca-navy">Entry fee</th>
                      <th className="px-4 py-3 font-semibold text-lca-navy">Prize fund</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tournament.sections.map((s) => (
                      <tr key={s.name} className="border-b last:border-0">
                        <td className="px-4 py-3 font-medium">{s.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {s.entryFee > 0 ? `$${s.entryFee}` : 'Free'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{s.prizeFund ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* My registration — bye rounds */}
            {myRegistration && (
              <div className="rounded-xl border border-lca-navy/20 bg-lca-navy/5 p-6">
                <h2 className="text-lg font-bold text-lca-navy">Your registration</h2>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex gap-4">
                    <dt className="font-medium text-lca-navy">Section</dt>
                    <dd className="text-muted-foreground">{myRegistration.section}</dd>
                  </div>
                  <div className="flex gap-4">
                    <dt className="font-medium text-lca-navy">Payment</dt>
                    <dd className="text-muted-foreground">{myRegistration.payment_status}</dd>
                  </div>
                </dl>
                <div className="mt-4">
                  <p className="mb-2 text-sm font-medium text-lca-navy">Bye rounds</p>
                  <ByeRoundsEditor
                    registration={myRegistration}
                    totalRounds={tournament.rounds}
                    onSave={handleUpdateByes}
                  />
                </div>
              </div>
            )}

            {/* Registered players — by section, sorted by name */}
            <div>
              <h2 className="text-xl font-bold text-lca-navy">
                Registered players
                {activeRoster.length > 0 && (
                  <span className="ml-2 text-base font-normal text-muted-foreground">
                    · {activeRoster.length}
                  </span>
                )}
              </h2>
              {activeRoster.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">No players registered yet.</p>
              ) : (
                <div className="mt-4 overflow-hidden rounded-xl border">
                  {rosterSections.map((sectionName) => {
                    const players = rosterBySectionMap.get(sectionName) ?? []
                    return (
                      <div key={sectionName}>
                        <div className="border-b bg-lca-gold/8 px-4 py-2">
                          <span className="text-xs font-semibold uppercase tracking-wide text-lca-navy">
                            {sectionName}
                          </span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            · {players.length} {players.length === 1 ? 'player' : 'players'}
                          </span>
                        </div>
                        <ul className="divide-y">
                          {players.map((player) => (
                            <li
                              key={player.member_id}
                              className="flex items-center justify-between px-4 py-2.5"
                            >
                              <div>
                                <p className="text-sm font-medium text-lca-navy">
                                  {player.full_name}
                                </p>
                                {player.uscf_id && (
                                  <p className="text-xs text-muted-foreground">
                                    USCF {player.uscf_id}
                                  </p>
                                )}
                              </div>
                              {player.uscf_rating != null && (
                                <span className="font-mono text-sm text-muted-foreground">
                                  {player.uscf_rating}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Custom details */}
            {customDetails.length > 0 && (
              <div className="space-y-6">
                {customDetails.map((cd, i) => (
                  <div key={i}>
                    <h2 className="text-xl font-bold text-lca-navy">{cd.title}</h2>
                    <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{cd.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Sidebar ── */}
          <div className="h-fit space-y-4 lg:sticky lg:top-20">

            {/* Registration card */}
            <div className="overflow-hidden rounded-xl border shadow-sm">
              <div className="bg-lca-navy px-5 py-4">
                <h2 className="font-semibold text-white">
                  {myRegistration ? 'Your registration' : 'Register'}
                </h2>
                {tournament.registration_deadline && !myRegistration && (
                  <p className="mt-0.5 text-xs text-white/50">
                    Closes {tournament.registration_deadline}
                  </p>
                )}
              </div>

              <div className="bg-card p-5">
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Spots</dt>
                    <dd className="font-medium">{activeRoster.length} / {maxPlayers}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Format</dt>
                    <dd className="font-medium">
                      {tournament.rounds}-round Swiss{isRated ? ', USCF-rated' : ', unrated'}
                    </dd>
                  </div>
                  {tournament.time_control && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Time control</dt>
                      <dd className="font-medium">{tournament.time_control}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Status</dt>
                    <dd>
                      {regStatus === 'open' && tournament.status === 'upcoming' ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                          Open
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground capitalize">{regStatus}</span>
                      )}
                    </dd>
                  </div>
                </dl>

                {/* Already registered */}
                {myRegistration && !confirmation && (
                  <div className="mt-5 space-y-3">
                    <div className={cn(
                      'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium',
                      myRegistration.payment_status === 'paid'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-lca-gold/40 bg-lca-gold/10 text-lca-navy',
                    )}>
                      <CheckCircle2 className="size-4" />
                      Registered · {myRegistration.section}
                      {myRegistration.payment_status !== 'paid' && ' · payment pending'}
                    </div>
                    {registerError && (
                      <p className="text-sm text-destructive">{registerError}</p>
                    )}
                    {myRegistration.payment_status === 'pending' && (
                      <Button
                        type="button"
                        className={cn('w-full', goldBtn)}
                        disabled={payingNow}
                        onClick={handlePayNow}
                      >
                        {payingNow ? 'Redirecting…' : 'Complete payment'}
                      </Button>
                    )}
                    <div>
                      <p className="mb-2 text-xs font-medium text-lca-navy">Bye rounds</p>
                      <ByeRoundsEditor
                        registration={myRegistration}
                        totalRounds={tournament.rounds}
                        onSave={handleUpdateByes}
                      />
                    </div>
                  </div>
                )}

                {/* Registration open form */}
                {!myRegistration && regStatus === 'open' && tournament.status === 'upcoming' && (
                  confirmation ? (
                    <div className="mt-5 space-y-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 size-5 flex-shrink-0 text-emerald-700" />
                        <div>
                          <p className="font-medium text-emerald-900">Registration submitted</p>
                          <p className="mt-1 text-sm text-emerald-800">{confirmation.message}</p>
                        </div>
                      </div>
                      {confirmation.paymentUrl && (
                        <Button asChild className={cn('w-full', goldBtn)}>
                          <a href={confirmation.paymentUrl} target="_blank" rel="noopener noreferrer">
                            Complete payment (Stripe)
                          </a>
                        </Button>
                      )}
                      <Button asChild variant="outline" className="w-full">
                        <Link to="/dashboard">View my dashboard</Link>
                      </Button>
                    </div>
                  ) : (
                    <form onSubmit={handleRegisterClick} className="mt-5 space-y-4">
                      {registerError && (
                        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                          {registerError}
                          {isRated && !authMember?.uscf_id && user && (
                            <Link to="/dashboard" className="mt-2 block font-medium underline">
                              Add USCF ID to your profile →
                            </Link>
                          )}
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <Label htmlFor="section">Section</Label>
                        <select
                          id="section"
                          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                          value={selectedSection}
                          onChange={(e) => setSelectedSection(e.target.value)}
                          required
                        >
                          {tournament.sections.map((s) => (
                            <option key={s.name} value={s.name}>
                              {s.name}{s.entryFee > 0 ? ` — $${s.entryFee}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {tournament.rounds > 1 && (
                        <div className="space-y-1.5">
                          <Label>
                            Bye rounds{' '}
                            <span className="text-xs font-normal text-muted-foreground">
                              (optional, max {maxByes})
                            </span>
                          </Label>
                          <div className="flex flex-wrap gap-1.5">
                            {Array.from({ length: tournament.rounds }, (_, i) => i + 1).map((round) => {
                              const isSel = selectedByes.includes(round)
                              const wouldExceed = !isSel && selectedByes.length >= maxByes
                              return (
                                <button
                                  key={round}
                                  type="button"
                                  disabled={wouldExceed}
                                  onClick={() => toggleBye(round)}
                                  className={cn(
                                    'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                                    isSel
                                      ? 'border-lca-navy bg-lca-navy text-white'
                                      : wouldExceed
                                      ? 'cursor-not-allowed border-border text-muted-foreground/40'
                                      : 'border-border text-muted-foreground hover:border-lca-navy/40',
                                  )}
                                >
                                  Rd {round}
                                </button>
                              )
                            })}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Half-point byes. You can update these later.
                          </p>
                        </div>
                      )}

                      <Button type="submit" size="lg" className={cn('w-full', goldBtn)} disabled={registering}>
                        {registering ? 'Registering…' : 'Register now'}
                      </Button>

                      {!user && (
                        <p className="text-center text-xs text-muted-foreground">
                          You'll be asked to log in or create an account.
                        </p>
                      )}
                    </form>
                  )
                )}

                {/* Registration not open */}
                {!myRegistration && regStatus !== 'open' && (
                  <div className="mt-5 space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {regStatus === 'closed'
                        ? 'Registration is closed.'
                        : 'Registration isn\'t open yet.'}
                    </p>
                    {user && regStatus !== 'closed' && (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={handleToggleReminder}
                        disabled={togglingReminder}
                      >
                        {reminderOptedIn ? (
                          <><BellOff className="mr-2 size-4" /> Remove notification</>
                        ) : (
                          <><Bell className="mr-2 size-4" /> Notify me when it opens</>
                        )}
                      </Button>
                    )}
                    {!user && (
                      <Button asChild size="lg" className={cn('w-full', goldBtn)}>
                        <Link to="/login" state={{ from: location.pathname }}>
                          Log in to get notified
                        </Link>
                      </Button>
                    )}
                  </div>
                )}

                {tournament.status !== 'upcoming' && (
                  <p className="mt-4 text-sm text-muted-foreground">
                    {tournament.status === 'active'
                      ? 'This tournament is in progress.'
                      : 'This tournament has concluded.'}
                  </p>
                )}
              </div>
            </div>

            {/* LCA membership note */}
            <p className="text-xs text-muted-foreground">
              LCA members receive discounted entry fees.{' '}
              <Link to="/membership" className="text-lca-navy hover:underline">
                Join LCA
              </Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
