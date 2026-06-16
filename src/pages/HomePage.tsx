import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, MapPin, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { getTournaments, type ApiTournamentListItem } from '@/lib/api'
import { cn } from '@/lib/utils'

interface PlaceholderNewsItem {
  id: string
  title: string
  date: string
  excerpt: string
}

const stats = [
  { value: '500+', label: 'Members' },
  { value: '30+', label: 'Tournaments / Year' },
  { value: '15+', label: 'Affiliated Clubs' },
]

const latestNews: PlaceholderNewsItem[] = [
  {
    id: '1',
    title: '2026 LCA Membership Now Open',
    date: 'February 1, 2026',
    excerpt:
      'Renew or join the Louisiana Chess Association for the 2026 season. Members receive discounted entry fees and access to exclusive events across the state.',
  },
  {
    id: '2',
    title: 'New Club Affiliation: Lake Charles Chess Society',
    date: 'January 15, 2026',
    excerpt:
      'We are excited to welcome the Lake Charles Chess Society as the newest affiliated club in the LCA network. Visit their club page to learn about meeting times.',
  },
  {
    id: '3',
    title: 'Spring Open Registration Opens March 1',
    date: 'January 8, 2026',
    excerpt:
      'Mark your calendar for the LCA Spring Open in Baton Rouge. Early registration is encouraged — space is limited in each section.',
  },
]

const goldButtonClass =
  'bg-[#c8a94a] font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90'

export function HomePage() {
  const [upcomingTournaments, setUpcomingTournaments] = useState<
    ApiTournamentListItem[]
  >([])
  const [loadingTournaments, setLoadingTournaments] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const tournaments = await getTournaments()
        const upcoming = tournaments
          .filter((t) => t.status === 'upcoming')
          .reverse()
          .slice(0, 3)
        setUpcomingTournaments(upcoming)
      } catch {
        setUpcomingTournaments([])
      } finally {
        setLoadingTournaments(false)
      }
    }
    load()
  }, [])

  return (
    <div>
      <section className="border-b-4 border-[#c8a94a] bg-[#1a2744] text-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="max-w-2xl">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Louisiana&apos;s Chess Community
            </h1>
            <p className="mt-4 text-lg text-white/80 sm:text-xl">
              Join tournaments, connect with clubs across the state, and be part
              of the official Louisiana Chess Association.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
              <Button asChild size="lg" className={cn(goldButtonClass)}>
                <Link to="/membership">Join LCA</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <Link to="/tournaments">View Tournaments</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b bg-muted/40">
        <div className="mx-auto grid max-w-6xl grid-cols-1 divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {stats.map((stat) => (
            <div key={stat.label} className="px-4 py-8 text-center sm:px-6">
              <p className="text-3xl font-bold text-[#1a2744]">{stat.value}</p>
              <p className="mt-1 text-sm font-medium text-muted-foreground">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-[#1a2744] sm:text-3xl">
              Upcoming Tournaments
            </h2>
            <p className="mt-1 text-muted-foreground">
              Register online and compete with players from across Louisiana.
            </p>
          </div>
          <Button asChild variant="outline" className="mt-2 w-fit sm:mt-0">
            <Link to="/tournaments">View all tournaments</Link>
          </Button>
        </div>

        {loadingTournaments ? (
          <p className="mt-8 text-muted-foreground">Loading tournaments…</p>
        ) : upcomingTournaments.length === 0 ? (
          <p className="mt-8 text-muted-foreground">
            No upcoming tournaments scheduled. Check back soon.
          </p>
        ) : (
          <ul className="mt-8 space-y-4">
            {upcomingTournaments.map((tournament) => (
              <li
                key={tournament.id}
                className="rounded-xl border bg-card p-5 shadow-sm sm:p-6"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-[#1a2744]">
                      {tournament.name}
                    </h3>
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
                      ${tournament.entry_fee} entry · {tournament.rounds} rounds
                    </p>
                  </div>
                  <Button
                    asChild
                    className={cn('w-full sm:w-auto', goldButtonClass)}
                  >
                    <Link to={`/tournaments/${tournament.id}`}>Register</Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-[#1a2744] sm:text-3xl">
            Latest News
          </h2>
          <p className="mt-1 text-muted-foreground">
            Updates from the Louisiana Chess Association and affiliated clubs.
          </p>

          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {latestNews.map((item) => (
              <li
                key={item.id}
                className="flex flex-col rounded-xl border bg-card p-5 shadow-sm"
              >
                <p className="text-xs font-medium text-[#c8a94a]">{item.date}</p>
                <h3 className="mt-2 font-semibold text-[#1a2744]">{item.title}</h3>
                <p className="mt-2 flex-1 text-sm text-muted-foreground">
                  {item.excerpt}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="bg-[#1a2744] text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center px-4 py-16 text-center sm:px-6 lg:px-8">
          <Users className="size-12 text-[#c8a94a]" />
          <h2 className="mt-4 text-2xl font-bold sm:text-3xl">
            Become an LCA Member
          </h2>
          <p className="mt-3 max-w-xl text-white/80">
            Support chess in Louisiana and unlock member benefits including
            discounted tournament entry, your official membership profile, and
            access to events across the state.
          </p>
          <Button asChild size="lg" className={cn('mt-8', goldButtonClass)}>
            <Link to="/membership">Become a Member</Link>
          </Button>
        </div>
      </section>
    </div>
  )
}
