import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Trophy,
  Users,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type TournamentStatus = 'upcoming' | 'active' | 'completed'

interface TournamentSection {
  name: string
  entryFee: number
  prizeFund?: string
}

interface RegisteredPlayer {
  name: string
  section: string
  rating?: number
  uscfId?: string
}

interface TournamentDetail {
  id: string
  name: string
  date: string
  location: string
  venue: string
  status: TournamentStatus
  rounds: number
  maxPlayers: number
  registrationDeadline: string
  description: string
  sections: TournamentSection[]
  roster: RegisteredPlayer[]
}

const tournamentDetails: Record<string, TournamentDetail> = {
  'spring-open-2026': {
    id: 'spring-open-2026',
    name: 'LCA Spring Open',
    date: 'Saturday, March 14, 2026',
    location: 'Baton Rouge, LA',
    venue: 'Baton Rouge Community Center, 555 Government St',
    status: 'upcoming',
    rounds: 5,
    maxPlayers: 120,
    registrationDeadline: 'March 12, 2026 at 11:59 PM',
    description:
      'The LCA Spring Open kicks off the 2026 tournament season with five rounds of USCF-rated Swiss pairings. Open to all players — join competitors from across Louisiana for a full day of chess.',
    sections: [
      { name: 'Open', entryFee: 45, prizeFund: '$800' },
      { name: 'U1800', entryFee: 40, prizeFund: '$400' },
      { name: 'U1400', entryFee: 35, prizeFund: '$250' },
    ],
    roster: [
      { name: 'James Whitfield', section: 'Open', rating: 2145, uscfId: '12345678' },
      { name: 'Maria Santos', section: 'Open', rating: 1987, uscfId: '23456789' },
      { name: 'David Chen', section: 'U1800', rating: 1762, uscfId: '34567890' },
      { name: 'Priya Patel', section: 'U1800', rating: 1698, uscfId: '45678901' },
      { name: 'Tyler Brooks', section: 'U1400', rating: 1385, uscfId: '56789012' },
    ],
  },
  'new-orleans-classic-2026': {
    id: 'new-orleans-classic-2026',
    name: 'New Orleans Classic',
    date: 'Saturday, April 18, 2026',
    location: 'New Orleans, LA',
    venue: 'New Orleans Marriott, 555 Canal St',
    status: 'upcoming',
    rounds: 4,
    maxPlayers: 80,
    registrationDeadline: 'April 16, 2026 at 11:59 PM',
    description:
      'A four-round Swiss tournament in the heart of New Orleans. Features Open, U1600, and Scholastic sections with cash prizes in each.',
    sections: [
      { name: 'Open', entryFee: 40, prizeFund: '$600' },
      { name: 'U1600', entryFee: 35, prizeFund: '$300' },
      { name: 'Scholastic', entryFee: 20, prizeFund: 'Trophies' },
    ],
    roster: [
      { name: 'Andre Williams', section: 'Open', rating: 2055, uscfId: '67890123' },
      { name: 'Sophie Martin', section: 'U1600', rating: 1542, uscfId: '78901234' },
      { name: 'Ethan Nguyen', section: 'Scholastic', rating: 1120, uscfId: '89012345' },
    ],
  },
  'shreveport-summer-swiss-2026': {
    id: 'shreveport-summer-swiss-2026',
    name: 'Shreveport Summer Swiss',
    date: 'Saturday, June 6, 2026',
    location: 'Shreveport, LA',
    venue: 'Shreveport Public Library, Main Branch',
    status: 'upcoming',
    rounds: 5,
    maxPlayers: 64,
    registrationDeadline: 'June 4, 2026 at 11:59 PM',
    description:
      'Beat the summer heat with five rounds of competitive chess in Shreveport. Family-friendly venue with plenty of parking.',
    sections: [
      { name: 'Open', entryFee: 35, prizeFund: '$500' },
      { name: 'U2000', entryFee: 30, prizeFund: '$250' },
      { name: 'U1200', entryFee: 25, prizeFund: '$150' },
    ],
    roster: [
      { name: 'Robert Hale', section: 'Open', rating: 1890, uscfId: '90123456' },
      { name: 'Linda Foster', section: 'U2000', rating: 1823, uscfId: '01234567' },
    ],
  },
  'lafayette-winter-classic-2026': {
    id: 'lafayette-winter-classic-2026',
    name: 'Lafayette Winter Classic',
    date: 'Saturday, February 8, 2026',
    location: 'Lafayette, LA',
    venue: 'Lafayette Science Museum',
    status: 'active',
    rounds: 5,
    maxPlayers: 96,
    registrationDeadline: 'Registration closed',
    description:
      'Round 3 is currently in progress. Five-round Swiss with four sections including a dedicated Scholastic division.',
    sections: [
      { name: 'Open', entryFee: 40, prizeFund: '$700' },
      { name: 'U1800', entryFee: 35, prizeFund: '$350' },
      { name: 'U1400', entryFee: 30, prizeFund: '$200' },
      { name: 'Scholastic', entryFee: 20, prizeFund: 'Trophies' },
    ],
    roster: [
      { name: 'Carlos Rivera', section: 'Open', rating: 2210, uscfId: '11223344' },
      { name: 'Anna Kowalski', section: 'Open', rating: 2012, uscfId: '22334455' },
      { name: 'Marcus Johnson', section: 'U1800', rating: 1745, uscfId: '33445566' },
      { name: 'Emily Tran', section: 'U1400', rating: 1360, uscfId: '44556677' },
      { name: 'Noah Davis', section: 'Scholastic', rating: 980, uscfId: '55667788' },
      { name: 'Grace Wilson', section: 'Scholastic', rating: 1055, uscfId: '66778899' },
    ],
  },
  'state-championship-2025': {
    id: 'state-championship-2025',
    name: 'Louisiana State Championship',
    date: 'November 15–17, 2025',
    location: 'New Orleans, LA',
    venue: 'Hilton New Orleans Riverside',
    status: 'completed',
    rounds: 7,
    maxPlayers: 150,
    registrationDeadline: 'Registration closed',
    description:
      'The premier event of the Louisiana chess calendar. Seven rounds over three days determine the state champion across four sections.',
    sections: [
      { name: 'Championship', entryFee: 75, prizeFund: '$2,000' },
      { name: 'Reserve', entryFee: 60, prizeFund: '$800' },
      { name: 'Class A', entryFee: 50, prizeFund: '$400' },
      { name: 'Class B', entryFee: 40, prizeFund: '$250' },
    ],
    roster: [
      { name: 'James Whitfield', section: 'Championship', rating: 2145, uscfId: '12345678' },
      { name: 'Andre Williams', section: 'Championship', rating: 2055, uscfId: '67890123' },
      { name: 'Maria Santos', section: 'Reserve', rating: 1987, uscfId: '23456789' },
      { name: 'David Chen', section: 'Class A', rating: 1762, uscfId: '34567890' },
    ],
  },
  'baton-rouge-fall-open-2025': {
    id: 'baton-rouge-fall-open-2025',
    name: 'Baton Rouge Fall Open',
    date: 'Saturday, October 11, 2025',
    location: 'Baton Rouge, LA',
    venue: 'Baton Rouge Community Center',
    status: 'completed',
    rounds: 5,
    maxPlayers: 100,
    registrationDeadline: 'Registration closed',
    description:
      'A five-round fall classic that drew players from across the Gulf South. Final standings are published below.',
    sections: [
      { name: 'Open', entryFee: 45, prizeFund: '$700' },
      { name: 'U2000', entryFee: 40, prizeFund: '$350' },
      { name: 'U1600', entryFee: 35, prizeFund: '$200' },
      { name: 'U1200', entryFee: 30, prizeFund: '$150' },
    ],
    roster: [
      { name: 'Robert Hale', section: 'Open', rating: 1890, uscfId: '90123456' },
      { name: 'Priya Patel', section: 'U1600', rating: 1698, uscfId: '45678901' },
      { name: 'Tyler Brooks', section: 'U1200', rating: 1385, uscfId: '56789012' },
    ],
  },
  'monroe-scholastic-2025': {
    id: 'monroe-scholastic-2025',
    name: 'Monroe Scholastic Championship',
    date: 'Saturday, September 20, 2025',
    location: 'Monroe, LA',
    venue: 'Monroe Civic Center',
    status: 'completed',
    rounds: 4,
    maxPlayers: 80,
    registrationDeadline: 'Registration closed',
    description:
      'Louisiana\'s premier scholastic event, organized by grade level. Trophies awarded in each section.',
    sections: [
      { name: 'K–5', entryFee: 20, prizeFund: 'Trophies' },
      { name: '6–8', entryFee: 20, prizeFund: 'Trophies' },
      { name: '9–12', entryFee: 25, prizeFund: 'Trophies' },
      { name: 'Open Scholastic', entryFee: 25, prizeFund: 'Trophies' },
    ],
    roster: [
      { name: 'Ethan Nguyen', section: '6–8', rating: 1120, uscfId: '89012345' },
      { name: 'Noah Davis', section: 'K–5', rating: 980, uscfId: '55667788' },
      { name: 'Grace Wilson', section: '9–12', rating: 1055, uscfId: '66778899' },
    ],
  },
}

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
  const tournament = id ? tournamentDetails[id] : undefined

  if (!tournament) {
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
              {tournament.roster.length} / {tournament.maxPlayers} registered
            </span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">
            <div>
              <h2 className="text-xl font-bold text-[#1a2744]">About</h2>
              <p className="mt-3 text-muted-foreground">
                {tournament.description}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                <span className="font-medium text-[#1a2744]">Venue:</span>{' '}
                {tournament.venue}
              </p>
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
              <p className="mt-1 text-sm text-muted-foreground">
                Placeholder roster — live registration data coming soon.
              </p>
              <ul className="mt-4 divide-y rounded-xl border bg-card">
                {tournament.roster.map((player) => (
                  <li
                    key={`${player.name}-${player.section}`}
                    className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium text-[#1a2744]">{player.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {player.section}
                        {player.rating != null && ` · ${player.rating}`}
                        {player.uscfId && ` · USCF ${player.uscfId}`}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="h-fit rounded-xl border bg-card p-6 shadow-sm lg:sticky lg:top-20">
            <h2 className="text-lg font-bold text-[#1a2744]">Registration</h2>

            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="font-medium text-[#1a2744]">Deadline</dt>
                <dd className="text-muted-foreground">
                  {tournament.registrationDeadline}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-[#1a2744]">Capacity</dt>
                <dd className="text-muted-foreground">
                  {tournament.roster.length} of {tournament.maxPlayers} spots
                  filled
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
              <Button
                asChild
                size="lg"
                className={cn('mt-6 w-full', goldButtonClass)}
              >
                <Link to="/login">Register Now</Link>
              </Button>
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