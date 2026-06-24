// src/pages/TournamentDetailPage.tsx
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Bell, BellOff, Calendar, CheckCircle2,
  Clock, MapPin, Trophy, Users, X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'
import {
  createRegistration,
  getTournament,
  optInTournamentReminder,
  optOutTournamentReminder,
  getTournamentReminderStatus,
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
  upcoming: { label: 'Upcoming', className: 'bg-[#c8a94a]/20 text-[#1a2744]' },
  active: { label: 'Active', className: 'bg-emerald-100 text-emerald-800' },
  completed: { label: 'Completed', className: 'bg-muted text-muted-foreground' },
}

const goldButtonClass = 'bg-[#c8a94a] font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90'

function RegistrationModal({
  tournament,
  member,
  selectedSection,
  byeRounds,
  onConfirm,
  onCancel,
  registering,
  error,
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
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="bg-background rounded-xl border shadow-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-lg font-bold text-[#1a2744]">Confirm Registration</h3>
          <button type="button" onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Registering for <span className="font-medium text-foreground">{tournament.name}</span>.
        </p>

        <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm mb-4">
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
          <div className="flex justify-between border-t pt-2 mt-2">
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

        {error && <p className="text-sm text-destructive mb-3">{error}</p>}

        <div className="flex gap-3">
          <Button type="button" variant="outline" className="flex-1" onClick={onCancel} disabled={registering}>
            Cancel
          </Button>
          <Button type="button" className={cn('flex-1', goldButtonClass)} onClick={onConfirm} disabled={registering}>
            {registering ? 'Registering…' : 'Confirm'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// Bye rounds editor — shown on dashboard and tournament page for registered members
function ByeRoundsEditor({
  registration,
  totalRounds,
  onSave,
}: {
  registration: ApiMyRegistration
  totalRounds: number
  onSave: (byeRounds: number[]) => Promise<void>
}) {
  const [selected, setSelected] = useState<number[]>(registration.bye_rounds ?? [])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const maxByes = totalRounds - 1

  function toggle(round: number) {
    setSelected((prev) =>
      prev.includes(round) ? prev.filter((r) => r !== round) : [...prev, round].sort((a, b) => a - b),
    )
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    await onSave(selected)
    setSaving(false)
    setSaved(true)
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Select rounds you need a bye for. Max {maxByes} bye{maxByes !== 1 ? 's' : ''} (half-point each).
      </p>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: totalRounds }, (_, i) => i + 1).map((round) => {
          const isSelected = selected.includes(round)
          const wouldExceedMax = !isSelected && selected.length >= maxByes
          return (
            <button
              key={round}
              type="button"
              disabled={wouldExceedMax}
              onClick={() => toggle(round)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                isSelected
                  ? 'border-[#1a2744] bg-[#1a2744] text-white'
                  : wouldExceedMax
                  ? 'border-border text-muted-foreground/40 cursor-not-allowed'
                  : 'border-border text-muted-foreground hover:border-[#1a2744]/40',
              )}
            >
              Round {round}
            </button>
          )
        })}
      </div>
      <Button
        type="button"
        size="sm"
        className={goldButtonClass}
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Update bye rounds'}
      </Button>
    </div>
  )
}

export function TournamentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, member: authMember } = useAuth()
  const [tournament, setTournament] = useState<ApiTournamentDetail | null>(null)
  const [roster, setRoster] = useState<ApiRosterPlayer[]>([])
  const [pairings, setPairings] = useState<ApiTournamentPairing[]>([])
  const [myRegistration, setMyRegistration] = useState<ApiMyRegistration | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedSection, setSelectedSection] = useState('')
  const [selectedByes, setSelectedByes] = useState<number[]>([])
  const [registering, setRegistering] = useState(false)
  const [registerError, setRegisterError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [confirmation, setConfirmation] = useState<{
    message: string; paymentUrl: string; section: string
  } | null>(null)
  const [reminderOptedIn, setReminderOptedIn] = useState(false)
  const [togglingReminder, setTogglingReminder] = useState(false)

  usePageTitle(tournament?.name ?? 'Tournament')

  useEffect(() => {
    if (!id) { setNotFound(true); setLoading(false); return }
    async function load() {
      try {
        const data = await getTournament(id!)
        setTournament(data.tournament)
        setRoster(data.roster)
        setPairings(data.pairings ?? [])
        setMyRegistration((data as any).myRegistration ?? null)
        setSelectedSection(data.tournament.sections[0]?.name ?? '')
        setNotFound(false)
        setError(null)

        if (user) {
          try {
            const reminderStatus = await getTournamentReminderStatus(id!)
            setReminderOptedIn(reminderStatus.opted_in)
          } catch { /* ignore */ }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load tournament'
        if (message.toLowerCase().includes('not found')) setNotFound(true)
        else setError(message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, user])

  async function handleRegisterClick(event: FormEvent) {
    event.preventDefault()
    if (!id || !selectedSection) return
    if (!user) { navigate('/login', { state: { from: location.pathname } }); return }
    if (tournament?.is_rated && !authMember?.uscf_id) {
      setRegisterError('This is a USCF-rated tournament. Please add your USCF ID to your profile before registering.')
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
      setMyRegistration((data as any).myRegistration ?? null)
    } catch (err) {
      setRegisterError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setRegistering(false)
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

  if (loading) return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <p className="text-muted-foreground">Loading tournament…</p>
    </div>
  )

  if (error) return (
    <div className="mx-auto max-w-6xl px-6 py-12 text-center">
      <p className="text-destructive">{error}</p>
      <Button asChild className="mt-6" variant="outline">
        <Link to="/tournaments"><ArrowLeft className="size-4" />Back</Link>
      </Button>
    </div>
  )

  if (notFound || !tournament) return (
    <div className="mx-auto max-w-6xl px-6 py-12 text-center">
      <Trophy className="mx-auto size-12 text-muted-foreground" />
      <h1 className="mt-4 text-2xl font-bold text-[#1a2744]">Tournament not found</h1>
      <Button asChild className="mt-6" variant="outline">
        <Link to="/tournaments"><ArrowLeft className="size-4" />Back to tournaments</Link>
      </Button>
    </div>
  )

  const status = statusConfig[tournament.status]
  const isRated = tournament.is_rated !== 0
  const regStatus = (tournament as any).registration_status ?? 'draft'
  const roundSchedule = (tournament as any).round_schedule ?? []
  const customDetails = (tournament as any).custom_details ?? []
  const maxPlayers = tournament.max_players ?? '—'
  const maxByes = tournament.rounds - 1
  const pairingRounds = [...new Set(pairings.map((p) => p.round))].sort((a, b) => a - b)

  function toggleBye(round: number) {
    setSelectedByes((prev) =>
      prev.includes(round) ? prev.filter((r) => r !== round) : [...prev, round].sort((a, b) => a - b),
    )
  }

  function formatPlayer(name?: string, rating?: number | null) {
    if (!name) return '—'
    return rating != null ? `${name} (${rating})` : name
  }

  // Multi-day aware date range display
  const dateDisplay = tournament.date

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

      <section className="border-b-4 border-[#c8a94a] bg-[#1a2744] text-white">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <Link to="/tournaments" className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-[#c8a94a]">
            <ArrowLeft className="size-4" />All tournaments
          </Link>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{tournament.name}</h1>
            <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', status.className)}>
              {status.label}
            </span>
            <span className={cn(
              'rounded-full px-2.5 py-0.5 text-xs font-medium',
              isRated ? 'bg-blue-100 text-blue-800' : 'bg-white/20 text-white',
            )}>
              {isRated ? 'USCF Rated' : 'Unrated'}
            </span>
          </div>
          <div className="mt-4 flex flex-col gap-2 text-sm text-white/80 sm:flex-row sm:flex-wrap sm:gap-x-6">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="size-4 shrink-0 text-[#c8a94a]" />
              {dateDisplay}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4 shrink-0 text-[#c8a94a]" />
              {tournament.location}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-4 shrink-0 text-[#c8a94a]" />
              {tournament.rounds} rounds
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-4 shrink-0 text-[#c8a94a]" />
              {roster.length} / {maxPlayers} registered
            </span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">

            {/* Description */}
            {tournament.description && (
              <div>
                <h2 className="text-xl font-bold text-[#1a2744]">About</h2>
                <p className="mt-3 text-muted-foreground">{tournament.description}</p>
                {tournament.venue && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    <span className="font-medium text-[#1a2744]">Venue:</span> {tournament.venue}
                  </p>
                )}
              </div>
            )}

            {/* Round schedule */}
            {roundSchedule.length > 0 && (
              <div>
                <h2 className="text-xl font-bold text-[#1a2744]">Round schedule</h2>
                <div className="mt-4 overflow-x-auto rounded-xl border">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-3 font-semibold text-[#1a2744]">Round</th>
                        <th className="px-4 py-3 font-semibold text-[#1a2744]">Date</th>
                        <th className="px-4 py-3 font-semibold text-[#1a2744]">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roundSchedule.map((rs: any) => (
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
              <h2 className="text-xl font-bold text-[#1a2744]">Sections</h2>
              <div className="mt-4 overflow-x-auto rounded-xl border">
                <table className="w-full min-w-[400px] text-left text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 font-semibold text-[#1a2744]">Section</th>
                      <th className="px-4 py-3 font-semibold text-[#1a2744]">Entry Fee</th>
                      <th className="px-4 py-3 font-semibold text-[#1a2744]">Prize Fund</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tournament.sections.map((section) => (
                      <tr key={section.name} className="border-b last:border-0">
                        <td className="px-4 py-3 font-medium">{section.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {section.entryFee > 0 ? `$${section.entryFee}` : 'Free'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{section.prizeFund ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* My registration — bye rounds editor */}
            {myRegistration && (
              <div className="rounded-xl border border-[#1a2744]/20 bg-[#1a2744]/5 p-6">
                <h2 className="text-lg font-bold text-[#1a2744]">Your registration</h2>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex gap-4">
                    <dt className="font-medium text-[#1a2744]">Section</dt>
                    <dd className="text-muted-foreground">{myRegistration.section}</dd>
                  </div>
                  <div className="flex gap-4">
                    <dt className="font-medium text-[#1a2744]">Payment</dt>
                    <dd className="text-muted-foreground">{myRegistration.payment_status}</dd>
                  </div>
                </dl>
                <div className="mt-4">
                  <p className="text-sm font-medium text-[#1a2744] mb-2">Bye rounds</p>
                  <ByeRoundsEditor
                    registration={myRegistration}
                    totalRounds={tournament.rounds}
                    onSave={handleUpdateByes}
                  />
                </div>
              </div>
            )}

            {/* Registered players */}
            <div>
              <h2 className="text-xl font-bold text-[#1a2744]">Registered Players</h2>
              {roster.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">No players registered yet.</p>
              ) : (
                <ul className="mt-4 divide-y rounded-xl border bg-card">
                  {roster.map((player) => (
                    <li key={player.member_id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium text-[#1a2744]">
                          {player.full_name}
                          {player.uscf_rating != null && (
                            <span className="ml-2 text-sm font-normal text-muted-foreground">{player.uscf_rating}</span>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {player.section}{player.uscf_id && ` · USCF ${player.uscf_id}`}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Pairings */}
            {pairingRounds.length > 0 && (
              <div>
                <h2 className="text-xl font-bold text-[#1a2744]">Pairings</h2>
                <div className="mt-4 space-y-6">
                  {pairingRounds.map((round) => {
                    const roundGames = pairings.filter((p) => p.round === round)
                    const sections = [...new Set(roundGames.map((g) => g.section))]
                    return (
                      <div key={round}>
                        <h3 className="font-semibold text-[#1a2744]">Round {round}</h3>
                        {sections.map((section) => (
                          <div key={`${round}-${section}`} className="mt-3">
                            <p className="text-sm font-medium text-[#c8a94a]">{section}</p>
                            <ul className="mt-2 divide-y rounded-xl border bg-card">
                              {roundGames.filter((g) => g.section === section).map((game) => (
                                <li key={game.id} className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                                  <span className="text-muted-foreground">Board {game.board}</span>
                                  <span>
                                    {formatPlayer(game.white_name, game.white_rating)} vs{' '}
                                    {game.black_member_id ? formatPlayer(game.black_name, game.black_rating) : 'BYE'}
                                  </span>
                                  {game.result !== 'pending' && (
                                    <span className="font-medium">{game.result}</span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Custom details */}
            {customDetails.length > 0 && (
              <div className="space-y-4">
                {customDetails.map((cd: any, i: number) => (
                  <div key={i}>
                    <h2 className="text-xl font-bold text-[#1a2744]">{cd.title}</h2>
                    <p className="mt-2 text-muted-foreground whitespace-pre-wrap">{cd.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Registration sidebar */}
          <div className="h-fit rounded-xl border bg-card p-6 shadow-sm lg:sticky lg:top-20">
            <h2 className="text-lg font-bold text-[#1a2744]">Registration</h2>

            <dl className="mt-4 space-y-3 text-sm">
              {tournament.registration_deadline && (
                <div>
                  <dt className="font-medium text-[#1a2744]">Deadline</dt>
                  <dd className="text-muted-foreground">{tournament.registration_deadline}</dd>
                </div>
              )}
              <div>
                <dt className="font-medium text-[#1a2744]">Capacity</dt>
                <dd className="text-muted-foreground">{roster.length} of {maxPlayers} spots filled</dd>
              </div>
              <div>
                <dt className="font-medium text-[#1a2744]">Format</dt>
                <dd className="text-muted-foreground">
                  {tournament.rounds}-round Swiss{isRated ? ', USCF-rated' : ', unrated'}
                </dd>
              </div>
            </dl>

            {/* Already registered */}
            {myRegistration && !confirmation && (
              <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <div className="flex items-center gap-2 text-emerald-800 text-sm font-medium">
                  <CheckCircle2 className="size-4" />
                  You're registered ({myRegistration.section})
                </div>
              </div>
            )}

            {/* Registration open */}
            {!myRegistration && regStatus === 'open' && tournament.status === 'upcoming' && (
              confirmation ? (
                <div className="mt-6 space-y-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" />
                    <div>
                      <p className="font-medium text-emerald-900">Registration submitted</p>
                      <p className="mt-1 text-sm text-emerald-800">{confirmation.message}</p>
                    </div>
                  </div>
                  <Button asChild className={cn('w-full', goldButtonClass)}>
                    <a href={confirmation.paymentUrl} target="_blank" rel="noopener noreferrer">
                      Complete payment (Stripe)
                    </a>
                  </Button>
                  <Button asChild variant="outline" className="w-full">
                    <Link to="/dashboard">View my dashboard</Link>
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleRegisterClick} className="mt-6 space-y-4">
                  {registerError && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                      {registerError}
                      {isRated && !authMember?.uscf_id && user && (
                        <Link to="/dashboard" className="block mt-2 font-medium underline">
                          Go to profile to add USCF ID →
                        </Link>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="section">Section</Label>
                    <select
                      id="section"
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={selectedSection}
                      onChange={(e) => setSelectedSection(e.target.value)}
                      required
                    >
                      {tournament.sections.map((section) => (
                        <option key={section.name} value={section.name}>
                          {section.name}{section.entryFee > 0 ? ` — $${section.entryFee}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Bye round selection */}
                  {tournament.rounds > 1 && (
                    <div className="space-y-2">
                      <Label>Bye rounds <span className="text-muted-foreground font-normal text-xs">(optional, max {maxByes})</span></Label>
                      <div className="flex flex-wrap gap-1.5">
                        {Array.from({ length: tournament.rounds }, (_, i) => i + 1).map((round) => {
                          const isSelected = selectedByes.includes(round)
                          const wouldExceedMax = !isSelected && selectedByes.length >= maxByes
                          return (
                            <button
                              key={round}
                              type="button"
                              disabled={wouldExceedMax}
                              onClick={() => toggleBye(round)}
                              className={cn(
                                'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                                isSelected
                                  ? 'border-[#1a2744] bg-[#1a2744] text-white'
                                  : wouldExceedMax
                                  ? 'border-border text-muted-foreground/40 cursor-not-allowed'
                                  : 'border-border text-muted-foreground hover:border-[#1a2744]/40',
                              )}
                            >
                              Rd {round}
                            </button>
                          )
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground">Half-point byes. You can update these later from this page.</p>
                    </div>
                  )}

                  <Button type="submit" size="lg" className={cn('w-full', goldButtonClass)} disabled={registering}>
                    {registering ? 'Registering…' : 'Register Now'}
                  </Button>

                  {!user && (
                    <p className="text-xs text-center text-muted-foreground">You'll be asked to log in or create an account.</p>
                  )}
                </form>
              )
            )}

            {/* Registration not open — notify button */}
            {!myRegistration && regStatus !== 'open' && (
              <div className="mt-6 space-y-3">
                <p className="text-sm text-muted-foreground">
                  {regStatus === 'draft' || regStatus === 'closed'
                    ? 'Registration is not yet open for this tournament.'
                    : 'Registration is closed.'}
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
                      <><BellOff className="size-4 mr-2" />Remove notification</>
                    ) : (
                      <><Bell className="size-4 mr-2" />Notify me when registration opens</>
                    )}
                  </Button>
                )}
                {!user && (
                  <Button asChild size="lg" className={cn('w-full', goldButtonClass)}>
                    <Link to="/login" state={{ from: location.pathname }}>
                      Log in to get notified
                    </Link>
                  </Button>
                )}
              </div>
            )}

            {/* Closed */}
            {tournament.status !== 'upcoming' && (
              <p className="mt-6 text-sm text-muted-foreground">
                {tournament.status === 'active'
                  ? 'This tournament is in progress.'
                  : 'This tournament has concluded.'}
              </p>
            )}

            <p className="mt-4 text-xs text-muted-foreground">
              LCA members receive discounted entry fees.{' '}
              <Link to="/membership" className="text-[#c8a94a] hover:underline">Join LCA</Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}