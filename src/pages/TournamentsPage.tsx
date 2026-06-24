import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, MapPin, Trophy } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  getTournaments,
  type ApiTournamentListItem,
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

function TournamentCard({ tournament }: { tournament: ApiTournamentListItem }) {
  const status = statusConfig[tournament.status]

  return (
    <li className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-[#1a2744]">
              <Link
                to={`/tournaments/${tournament.id}`}
                className="hover:text-[#c8a94a] hover:underline"
              >
                {tournament.name}
              </Link>
            </h3>
            <span
              className={cn(
                'rounded-full px-2.5 py-0.5 text-xs font-medium',
                status.className,
              )}
            >
              {status.label}
            </span>
          </div>

          <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-6">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="size-4 shrink-0 text-[#c8a94a]" />
              {tournament.date}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4 shrink-0 text-[#c8a94a]" />
              {tournament.location}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {tournament.sections.map((section) => (
              <span
                key={typeof section === "string" ? section : section.name}
                className="rounded-full bg-[#1a2744]/10 px-2.5 py-0.5 text-xs font-medium text-[#1a2744]"
              >
                {typeof section === "string" ? section : section.name}
              </span>
            ))}
          </div>

          <p className="text-sm text-muted-foreground">
            ${tournament.entry_fee} entry
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto">
          {tournament.status === 'upcoming' && (
            <Button asChild className={cn('w-full sm:w-auto', goldButtonClass)}>
              <Link to={`/tournaments/${tournament.id}`}>Register</Link>
            </Button>
          )}
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link to={`/tournaments/${tournament.id}`}>View details</Link>
          </Button>
        </div>
      </div>
    </li>
  )
}

export function TournamentsPage() {
  usePageTitle('Tournaments')
  const [tournaments, setTournaments] = useState<ApiTournamentListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        setTournaments(await getTournaments())
        setError(null)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load tournaments',
        )
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const upcomingAndActive = tournaments.filter(
    (t) => t.status === 'upcoming' || t.status === 'active',
  )
  const past = tournaments.filter((t) => t.status === 'completed')

  return (
    <div>
      <section className="border-b-4 border-[#c8a94a] bg-[#1a2744] text-white">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex items-center gap-3">
            <Trophy className="size-8 text-[#c8a94a] sm:size-10" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Tournaments
              </h1>
              <p className="mt-2 max-w-2xl text-white/80">
                Browse upcoming, active, and past LCA tournaments across
                Louisiana. Register online and compete with players statewide.
              </p>
            </div>
          </div>
        </div>
      </section>

      {loading ? (
        <section className="mx-auto max-w-6xl px-6 py-12">
          <p className="text-muted-foreground">Loading tournaments…</p>
        </section>
      ) : error ? (
        <section className="mx-auto max-w-6xl px-6 py-12">
          <p className="text-destructive">{error}</p>
        </section>
      ) : (
        <>
          <section className="mx-auto max-w-6xl px-6 py-12">
            <h2 className="text-2xl font-bold text-[#1a2744]">
              Upcoming &amp; Active
            </h2>
            <p className="mt-1 text-muted-foreground">
              Tournaments open for registration or currently in progress.
            </p>
            {upcomingAndActive.length === 0 ? (
              <p className="mt-8 text-muted-foreground">
                No upcoming or active tournaments at this time.
              </p>
            ) : (
              <ul className="mt-8 space-y-4">
                {upcomingAndActive.map((tournament) => (
                  <TournamentCard key={tournament.id} tournament={tournament} />
                ))}
              </ul>
            )}
          </section>

          <section className="bg-muted/30">
            <div className="mx-auto max-w-6xl px-6 py-12">
              <h2 className="text-2xl font-bold text-[#1a2744]">
                Past Tournaments
              </h2>
              <p className="mt-1 text-muted-foreground">
                Results and details from completed events.
              </p>
              {past.length === 0 ? (
                <p className="mt-8 text-muted-foreground">
                  No past tournaments to display.
                </p>
              ) : (
                <ul className="mt-8 space-y-4">
                  {past.map((tournament) => (
                    <TournamentCard key={tournament.id} tournament={tournament} />
                  ))}
                </ul>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
