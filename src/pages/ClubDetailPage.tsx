import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Calendar,
  Mail,
  MapPin,
  Newspaper,
  Trophy,
  User,
  Users,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  getClub,
  type ApiClubDetail,
  type ApiClubNews,
  type ApiClubOfficer,
  type ApiClubTournament,
} from '@/lib/api'

function formatOfficerRole(role: string): string {
  return role.replace(/\b\w/g, (char) => char.toUpperCase())
}

export function ClubDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [club, setClub] = useState<ApiClubDetail | null>(null)
  const [officers, setOfficers] = useState<ApiClubOfficer[]>([])
  const [tournaments, setTournaments] = useState<ApiClubTournament[]>([])
  const [news, setNews] = useState<ApiClubNews[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setNotFound(true)
      setLoading(false)
      return
    }

    async function load() {
      try {
        const data = await getClub(id!)
        setClub(data.club)
        setOfficers(data.officers)
        setTournaments(data.tournaments)
        setNews(data.news)
        setNotFound(false)
        setError(null)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load club'
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

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12">
        <p className="text-muted-foreground">Loading club…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12 text-center">
        <p className="text-destructive">{error}</p>
        <Button asChild className="mt-6" variant="outline">
          <Link to="/clubs">
            <ArrowLeft className="size-4" />
            Back to clubs
          </Link>
        </Button>
      </div>
    )
  }

  if (notFound || !club) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12 text-center">
        <Users className="mx-auto size-12 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-bold text-[#1a2744]">Club not found</h1>
        <p className="mt-2 text-muted-foreground">
          The club you are looking for does not exist or may have been removed.
        </p>
        <Button asChild className="mt-6" variant="outline">
          <Link to="/clubs">
            <ArrowLeft className="size-4" />
            Back to clubs
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div>
      <section className="border-b-4 border-[#c8a94a] bg-[#1a2744] text-white">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <Link
            to="/clubs"
            className="inline-flex items-center gap-1.5 text-sm text-white/70 transition-colors hover:text-[#c8a94a]"
          >
            <ArrowLeft className="size-4" />
            All clubs
          </Link>

          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            {club.name}
          </h1>

          <div className="mt-4 flex flex-col gap-2 text-sm text-white/80 sm:flex-row sm:flex-wrap sm:gap-x-6">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4 shrink-0 text-[#c8a94a]" />
              {club.city}, LA
            </span>
            {club.meeting_schedule && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="size-4 shrink-0 text-[#c8a94a]" />
                {club.meeting_schedule}
              </span>
            )}
            {club.contact_email && (
              <span className="inline-flex items-center gap-1.5">
                <Mail className="size-4 shrink-0 text-[#c8a94a]" />
                {club.contact_email}
              </span>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">
            <div>
              <h2 className="text-xl font-bold text-[#1a2744]">About</h2>
              {club.description && (
                <p className="mt-3 text-muted-foreground">{club.description}</p>
              )}
              {club.location && (
                <p className="mt-3 text-sm text-muted-foreground">
                  <span className="font-medium text-[#1a2744]">
                    Meeting location:
                  </span>{' '}
                  {club.location}
                </p>
              )}
            </div>

            {officers.length > 0 && (
              <div>
                <div className="flex items-center gap-2">
                  <User className="size-5 text-[#c8a94a]" />
                  <h2 className="text-xl font-bold text-[#1a2744]">Officers</h2>
                </div>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {officers.map((officer) => (
                    <li
                      key={`${officer.full_name}-${officer.role}`}
                      className="rounded-xl border bg-card px-4 py-3 shadow-sm"
                    >
                      <p className="font-medium text-[#1a2744]">
                        {officer.full_name}
                      </p>
                      <p className="text-sm text-[#c8a94a]">
                        {formatOfficerRole(officer.role)}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <div className="flex items-center gap-2">
                <Trophy className="size-5 text-[#c8a94a]" />
                <h2 className="text-xl font-bold text-[#1a2744]">
                  Club Tournaments
                </h2>
              </div>
              {tournaments.length > 0 ? (
                <ul className="mt-4 space-y-3">
                  {tournaments.map((tournament) => (
                    <li
                      key={tournament.id}
                      className="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-medium text-[#1a2744]">
                          {tournament.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {tournament.date}
                        </p>
                      </div>
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/tournaments/${tournament.id}`}>
                          View tournament
                        </Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  No upcoming club tournaments scheduled. Check back soon.
                </p>
              )}
            </div>

            {news.length > 0 && (
              <div>
                <div className="flex items-center gap-2">
                  <Newspaper className="size-5 text-[#c8a94a]" />
                  <h2 className="text-xl font-bold text-[#1a2744]">Club News</h2>
                </div>
                <ul className="mt-4 space-y-4">
                  {news.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-xl border bg-card p-5 shadow-sm"
                    >
                      <p className="text-xs font-medium text-[#c8a94a]">
                        {item.news_date}
                      </p>
                      <h3 className="mt-1 font-semibold text-[#1a2744]">
                        {item.title}
                      </h3>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {item.excerpt}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="h-fit rounded-xl border bg-card p-6 shadow-sm lg:sticky lg:top-20">
            <h2 className="text-lg font-bold text-[#1a2744]">Visit Us</h2>

            <dl className="mt-4 space-y-4 text-sm">
              {club.meeting_schedule && (
                <div>
                  <dt className="font-medium text-[#1a2744]">When</dt>
                  <dd className="text-muted-foreground">
                    {club.meeting_schedule}
                  </dd>
                </div>
              )}
              {club.location && (
                <div>
                  <dt className="font-medium text-[#1a2744]">Where</dt>
                  <dd className="text-muted-foreground">{club.location}</dd>
                </div>
              )}
              {club.contact_email && (
                <div>
                  <dt className="font-medium text-[#1a2744]">Contact</dt>
                  <dd>
                    <a
                      href={`mailto:${club.contact_email}`}
                      className="text-muted-foreground hover:text-[#c8a94a]"
                    >
                      {club.contact_email}
                    </a>
                  </dd>
                </div>
              )}
            </dl>

            <p className="mt-6 text-xs text-muted-foreground">
              New players are always welcome. No membership required to attend
              your first meeting.
            </p>

            <Button
              asChild
              className="mt-4 w-full bg-[#c8a94a] font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90"
            >
              <Link to="/membership">Join LCA</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
