import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  Trophy,
  Users,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'
import {
  createRegistration,
  getTournament,
  type ApiRosterPlayer,
  type ApiTournamentDetail,
  type ApiTournamentPairing,
  type TournamentStatus,
} from '@/lib/api'
import { cn } from '@/lib/utils'
import { usePageTitle } from '@/hooks/usePageTitle'

const statusConfig: Record<
  TournamentStatus,
  { label: string; className: string }
> = {
  upcoming: {
    label: 'Upcoming',
    className: 'bg-[#c8a94a]/20 text-[#1a2744]',
  },
  active: {
    label: 'Active',
    className: 'bg-emerald-100 text-emerald-800',
  },
  completed: {
    label: 'Completed',
    className: 'bg-muted text-muted-foreground',
  },
}

const goldButtonClass =
  'bg-[#c8a94a] font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90'

export function TournamentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const { user } = useAuth()
  const [tournament, setTournament] = useState<ApiTournamentDetail | null>(null)
  const [roster, setRoster] = useState<ApiRosterPlayer[]>([])
  const [pairings, setPairings] = useState<ApiTournamentPairing[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedSection, setSelectedSection] = useState('')
  const [registering, setRegistering] = useState(false)
  const [registerError, setRegisterError] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<{
    message: string
    paymentUrl: string
    section: string
  } | null>(null)

  usePageTitle(tournament?.name ?? 'Tournament')

  useEffect(() => {
    if (!id) {
      setNotFound(true)
      setLoading(false)
      return
    }

    async function load() {
      try {
        const data = await getTournament(id!)
        setTournament(data.tournament)
        setRoster(data.roster)
        setPairings(data.pairings ?? [])
        setSelectedSection(data.tournament.sections[0]?.name ?? '')
        setNotFound(false)
        setError(null)
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to load tournament'
        if (message.toLowerCase().includes('not found')) {
          setNotFound(true)
        } else {
          setError(message)
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  async function handleRegister(event: FormEvent) {
    event.preventDefault()
    if (!id || !selectedSection) return
    setRegistering(true)
    setRegisterError(null)
    try {
      const result = await createRegistration(id, selectedSection)
      setConfirmation({
        message: result.message,
        paymentUrl: result.paymentUrl,
        section: selectedSection,
      })
      const data = await getTournament(id)
      setRoster(data.roster)
    } catch (err) {
      setRegisterError(
        err instanceof Error ? err.message : 'Registration failed',
      )
    } finally {
      setRegistering(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12">
        <p className="text-muted-foreground">Loading tournament…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12 text-center">
        <p className="text-destructive">{error}</p>
        <Button asChild className="mt-6" variant="outline">
          <Link to="/tournaments">
            <ArrowLeft className="size-4" />
            Back to tournaments
          </Link>
        </Button>
      </div>
    )
  }

  if (notFound || !tournament) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12 text-center">
        <Trophy className="mx-auto size-12 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-bold text-[#1a2744]">
          Tournament not found
        </h1>
        <p className="mt-2 text-muted-foreground">
          The tournament you are looking for does not exist or may have been
          removed.
        </p>
        <Button asChild className="mt-6" variant="outline">
          <Link to="/tournaments">
            <ArrowLeft className="size-4" />
            Back to tournaments
          </Link>
        </Button>
      </div>
    )
  }

  const status = statusConfig[tournament.status]
  const maxPlayers = tournament.max_players ?? '—'

  const pairingRounds = [...new Set(pairings.map((p) => p.round))].sort(
    (a, b) => a - b,
  )

  function formatPlayer(name?: string, rating?: number | null) {
    if (!name) return '—'
    return rating != null ? `${name} (${rating})` : name
  }

  return (
    <div>
      <section className="border-b-4 border-[#c8a94a] bg-[#1a2744] text-white">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <Link
            to="/tournaments"
            className="inline-flex items-center gap-1.5 text-sm text-white/70 transition-colors hover:text-[#c8a94a]"
          >
            <ArrowLeft className="size-4" />
            All tournaments
          </Link>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {tournament.name}
            </h1>
            <span
              className={cn(
                'rounded-full px-2.5 py-0.5 text-xs font-medium',
                status.className,
              )}
            >
              {status.label}
            </span>
          </div>

          <div className="mt-4 flex flex-col gap-2 text-sm text-white/80 sm:flex-row sm:flex-wrap sm:gap-x-6">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="size-4 shrink-0 text-[#c8a94a]" />
              {tournament.date}
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
            <div>
              <h2 className="text-xl font-bold text-[#1a2744]">About</h2>
              {tournament.description && (
                <p className="mt-3 text-muted-foreground">
                  {tournament.description}
                </p>
              )}
              {tournament.venue && (
                <p className="mt-2 text-sm text-muted-foreground">
                  <span className="font-medium text-[#1a2744]">Venue:</span>{' '}
                  {tournament.venue}
                </p>
              )}
            </div>

            <div>
              <h2 className="text-xl font-bold text-[#1a2744]">Sections</h2>
              <div className="mt-4 overflow-x-auto rounded-xl border">
                <table className="w-full min-w-[400px] text-left text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 font-semibold text-[#1a2744]">
                        Section
                      </th>
                      <th className="px-4 py-3 font-semibold text-[#1a2744]">
                        Entry Fee
                      </th>
                      <th className="px-4 py-3 font-semibold text-[#1a2744]">
                        Prize Fund
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tournament.sections.map((section) => (
                      <tr key={section.name} className="border-b last:border-0">
                        <td className="px-4 py-3 font-medium">
                          {section.name}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          ${section.entryFee}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {section.prizeFund ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h2 className="text-xl font-bold text-[#1a2744]">
                Registered Players
              </h2>
              {roster.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  No players registered yet.
                </p>
              ) : (
                <ul className="mt-4 divide-y rounded-xl border bg-card">
                  {roster.map((player) => (
                    <li
                      key={player.member_id}
                      className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-medium text-[#1a2744]">
                          {player.full_name}
                          {player.uscf_rating != null && (
                            <span className="ml-2 text-sm font-normal text-muted-foreground">
                              {player.uscf_rating}
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {player.section}
                          {player.uscf_id && ` · USCF ${player.uscf_id}`}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {pairingRounds.length > 0 && (
              <div>
                <h2 className="text-xl font-bold text-[#1a2744]">Pairings</h2>
                <div className="mt-4 space-y-6">
                  {pairingRounds.map((round) => {
                    const roundGames = pairings.filter((p) => p.round === round)
                    const sections = [
                      ...new Set(roundGames.map((g) => g.section)),
                    ]
                    return (
                      <div key={round}>
                        <h3 className="font-semibold text-[#1a2744]">
                          Round {round}
                        </h3>
                        {sections.map((section) => (
                          <div key={`${round}-${section}`} className="mt-3">
                            <p className="text-sm font-medium text-[#c8a94a]">
                              {section}
                            </p>
                            <ul className="mt-2 divide-y rounded-xl border bg-card">
                              {roundGames
                                .filter((g) => g.section === section)
                                .map((game) => (
                                  <li
                                    key={game.id}
                                    className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                                  >
                                    <span className="text-muted-foreground">
                                      Board {game.board}
                                    </span>
                                    <span>
                                      {formatPlayer(
                                        game.white_name,
                                        game.white_rating,
                                      )}{' '}
                                      vs{' '}
                                      {game.black_member_id
                                        ? formatPlayer(
                                            game.black_name,
                                            game.black_rating,
                                          )
                                        : 'BYE'}
                                    </span>
                                    {game.result !== 'pending' && (
                                      <span className="font-medium">
                                        {game.result}
                                      </span>
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
          </div>

          <div className="h-fit rounded-xl border bg-card p-6 shadow-sm lg:sticky lg:top-20">
            <h2 className="text-lg font-bold text-[#1a2744]">Registration</h2>

            <dl className="mt-4 space-y-3 text-sm">
              {tournament.registration_deadline && (
                <div>
                  <dt className="font-medium text-[#1a2744]">Deadline</dt>
                  <dd className="text-muted-foreground">
                    {tournament.registration_deadline}
                  </dd>
                </div>
              )}
              <div>
                <dt className="font-medium text-[#1a2744]">Capacity</dt>
                <dd className="text-muted-foreground">
                  {roster.length} of {maxPlayers} spots filled
                </dd>
              </div>
              <div>
                <dt className="font-medium text-[#1a2744]">Format</dt>
                <dd className="text-muted-foreground">
                  {tournament.rounds}-round Swiss, USCF-rated
                </dd>
              </div>
            </dl>

            {tournament.status === 'upcoming' ? (
              confirmation ? (
                <div className="mt-6 space-y-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" />
                    <div>
                      <p className="font-medium text-emerald-900">
                        Registration submitted
                      </p>
                      <p className="mt-1 text-sm text-emerald-800">
                        {confirmation.message}
                      </p>
                      <p className="mt-2 text-sm text-emerald-800">
                        Section: <strong>{confirmation.section}</strong>
                      </p>
                    </div>
                  </div>
                  <Button asChild className={cn('w-full', goldButtonClass)}>
                    <a
                      href={confirmation.paymentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Complete payment (Stripe)
                    </a>
                  </Button>
                  <Button asChild variant="outline" className="w-full">
                    <Link to="/dashboard">View my dashboard</Link>
                  </Button>
                </div>
              ) : user ? (
                <form onSubmit={handleRegister} className="mt-6 space-y-4">
                  {registerError && (
                    <p className="text-sm text-destructive">{registerError}</p>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="section">Select section</Label>
                    <select
                      id="section"
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={selectedSection}
                      onChange={(e) => setSelectedSection(e.target.value)}
                      required
                      disabled={registering}
                    >
                      {tournament.sections.map((section) => (
                        <option key={section.name} value={section.name}>
                          {section.name} — ${section.entryFee}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    type="submit"
                    size="lg"
                    className={cn('w-full', goldButtonClass)}
                    disabled={registering}
                  >
                    {registering ? 'Registering…' : 'Register Now'}
                  </Button>
                </form>
              ) : (
                <Button
                  asChild
                  size="lg"
                  className={cn('mt-6 w-full', goldButtonClass)}
                >
                  <Link
                    to="/login"
                    state={{ from: location.pathname }}
                  >
                    Log in to register
                  </Link>
                </Button>
              )
            ) : (
              <p className="mt-6 text-sm text-muted-foreground">
                {tournament.status === 'active'
                  ? 'This tournament is in progress. Registration is closed.'
                  : 'This tournament has concluded. Registration is closed.'}
              </p>
            )}

            <p className="mt-4 text-xs text-muted-foreground">
              LCA members receive discounted entry fees.{' '}
              <Link to="/membership" className="text-[#c8a94a] hover:underline">
                Join LCA
              </Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
