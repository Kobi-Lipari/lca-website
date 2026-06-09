import { Link } from 'react-router-dom'
import { Calendar, MapPin, Trophy } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type TournamentStatus = 'upcoming' | 'active' | 'completed'

interface Tournament {
  id: string
  name: string
  date: string
  location: string
  entryFee: number
  sections: string[]
  status: TournamentStatus
}

const tournaments: Tournament[] = [
  {
    id: 'spring-open-2026',
    name: 'LCA Spring Open',
    date: 'Saturday, March 14, 2026',
    location: 'Baton Rouge, LA',
    entryFee: 45,
    sections: ['Open', 'U1800', 'U1400'],
    status: 'upcoming',
  },
  {
    id: 'new-orleans-classic-2026',
    name: 'New Orleans Classic',
    date: 'Saturday, April 18, 2026',
    location: 'New Orleans, LA',
    entryFee: 40,
    sections: ['Open', 'U1600', 'Scholastic'],
    status: 'upcoming',
  },
  {
    id: 'shreveport-summer-swiss-2026',
    name: 'Shreveport Summer Swiss',
    date: 'Saturday, June 6, 2026',
    location: 'Shreveport, LA',
    entryFee: 35,
    sections: ['Open', 'U2000', 'U1200'],
    status: 'upcoming',
  },
  {
    id: 'lafayette-winter-classic-2026',
    name: 'Lafayette Winter Classic',
    date: 'Saturday, February 8, 2026',
    location: 'Lafayette, LA',
    entryFee: 40,
    sections: ['Open', 'U1800', 'U1400', 'Scholastic'],
    status: 'active',
  },
  {
    id: 'state-championship-2025',
    name: 'Louisiana State Championship',
    date: 'November 15–17, 2025',
    location: 'New Orleans, LA',
    entryFee: 75,
    sections: ['Championship', 'Reserve', 'Class A', 'Class B'],
    status: 'completed',
  },
  {
    id: 'baton-rouge-fall-open-2025',
    name: 'Baton Rouge Fall Open',
    date: 'Saturday, October 11, 2025',
    location: 'Baton Rouge, LA',
    entryFee: 45,
    sections: ['Open', 'U2000', 'U1600', 'U1200'],
    status: 'completed',
  },
  {
    id: 'monroe-scholastic-2025',
    name: 'Monroe Scholastic Championship',
    date: 'Saturday, September 20, 2025',
    location: 'Monroe, LA',
    entryFee: 25,
    sections: ['K–5', '6–8', '9–12', 'Open Scholastic'],
    status: 'completed',
  },
]

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

function TournamentCard({ tournament }: { tournament: Tournament }) {
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
                key={section}
                className="rounded-full bg-[#1a2744]/10 px-2.5 py-0.5 text-xs font-medium text-[#1a2744]"
              >
                {section}
              </span>
            ))}
          </div>

          <p className="text-sm text-muted-foreground">
            ${tournament.entryFee} entry
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

      <section className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="text-2xl font-bold text-[#1a2744]">
          Upcoming &amp; Active
        </h2>
        <p className="mt-1 text-muted-foreground">
          Tournaments open for registration or currently in progress.
        </p>
        <ul className="mt-8 space-y-4">
          {upcomingAndActive.map((tournament) => (
            <TournamentCard key={tournament.id} tournament={tournament} />
          ))}
        </ul>
      </section>

      <section className="bg-muted/30">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <h2 className="text-2xl font-bold text-[#1a2744]">Past Tournaments</h2>
          <p className="mt-1 text-muted-foreground">
            Results and details from completed events.
          </p>
          <ul className="mt-8 space-y-4">
            {past.map((tournament) => (
              <TournamentCard key={tournament.id} tournament={tournament} />
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}