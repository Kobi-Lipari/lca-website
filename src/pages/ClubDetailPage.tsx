import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft, Calendar, Mail, MapPin, Newspaper, Trophy, User, Users,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  getClub,
  type ApiClubDetail,
  type ApiClubNews,
  type ApiClubOfficer,
  type ApiClubTournament,
} from '@/lib/api'
import { clubColorTint } from '@/lib/clubColors'
import { usePageTitle } from '@/hooks/usePageTitle'

const LCA_GOLD = '#c8a94a'
const NAVY = '#1a2744'

function formatOfficerRole(role: string): string {
  return role.replace(/\b\w/g, (c) => c.toUpperCase())
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

  usePageTitle(club?.name ?? 'Club')

  useEffect(() => {
    if (!id) { setNotFound(true); setLoading(false); return }
    getClub(id)
      .then((data) => {
        setClub(data.club)
        setOfficers(data.officers)
        setTournaments(data.tournaments)
        setNews(data.news)
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : 'Failed to load club'
        if (msg.toLowerCase().includes('not found')) setNotFound(true)
        else setError(msg)
      })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <p className="text-muted-foreground">Loading club…</p>
    </div>
  )

  if (error) return (
    <div className="mx-auto max-w-6xl px-6 py-12 text-center">
      <p className="text-destructive">{error}</p>
      <Button asChild className="mt-6" variant="outline">
        <Link to="/clubs"><ArrowLeft className="size-4" /> Back to clubs</Link>
      </Button>
    </div>
  )

  if (notFound || !club) return (
    <div className="mx-auto max-w-6xl px-6 py-12 text-center">
      <Users className="mx-auto size-12 text-muted-foreground" />
      <h1 className="mt-4 text-2xl font-bold text-[#1a2744]">Club not found</h1>
      <Button asChild className="mt-6" variant="outline">
        <Link to="/clubs"><ArrowLeft className="size-4" /> Back to clubs</Link>
      </Button>
    </div>
  )

  const color = (club as any).color || LCA_GOLD
  const imageUrl = (club as any).image_url as string | null | undefined

  return (
    <div>
      {/* ── Hero ── */}
      <section
        className="border-b-[3px] text-white"
        style={{ backgroundColor: '#1a2744', borderBottomColor: color }}
      >
        <div className="mx-auto max-w-6xl px-6 py-10">
          <Link
            to="/clubs"
            className="inline-flex items-center gap-1.5 text-sm text-white/55 transition-colors hover:text-[#c8a94a]"
          >
            <ArrowLeft className="size-3.5" /> All clubs
          </Link>

          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2.5">
                <span
                  className="size-2.5 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  {club.name}
                </h1>
              </div>
              <div className="flex flex-col gap-2 text-sm text-white/70 sm:flex-row sm:flex-wrap sm:gap-x-5">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-4 flex-shrink-0 text-[#c8a94a]" />
                  {club.city}, LA
                </span>
                {club.meeting_schedule && (
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="size-4 flex-shrink-0 text-[#c8a94a]" />
                    {club.meeting_schedule}
                  </span>
                )}
                {club.contact_email && (
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="size-4 flex-shrink-0 text-[#c8a94a]" />
                    {club.contact_email}
                  </span>
                )}
              </div>
            </div>

            {/* Club image in hero if available */}
            {imageUrl && (
              <div
                className="h-20 w-32 flex-shrink-0 overflow-hidden rounded-xl border border-white/20 bg-cover bg-center shadow-sm"
                style={{ backgroundImage: `url(${imageUrl})` }}
              />
            )}
          </div>
        </div>
      </section>

      {/* ── Body ── */}
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-8 lg:grid-cols-3">

          {/* ── Main column ── */}
          <div className="space-y-8 lg:col-span-2">

            {/* About */}
            {(club.description || club.location) && (
              <div>
                <h2 className="text-xl font-bold text-[#1a2744]">About</h2>
                {club.description && (
                  <p className="mt-3 text-muted-foreground">{club.description}</p>
                )}
                {club.location && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    <span className="font-medium text-[#1a2744]">Meeting location:</span>{' '}
                    {club.location}
                  </p>
                )}
              </div>
            )}

            {/* Officers */}
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
                      className="overflow-hidden rounded-xl border bg-card shadow-sm"
                      style={{ borderLeftColor: color, borderLeftWidth: 3 }}
                    >
                      <div className="px-4 py-3">
                        <p className="font-medium text-[#1a2744]">{officer.full_name}</p>
                        <p className="text-sm" style={{ color }}>
                          {formatOfficerRole(officer.role)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Tournaments */}
            <div>
              <div className="flex items-center gap-2">
                <Trophy className="size-5 text-[#c8a94a]" />
                <h2 className="text-xl font-bold text-[#1a2744]">Club tournaments</h2>
              </div>
              {tournaments.length > 0 ? (
                <ul className="mt-4 space-y-3">
                  {tournaments.map((t) => (
                    <li
                      key={t.id}
                      className="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                      style={{ backgroundColor: clubColorTint(color, 0.04) }}
                    >
                      <div>
                        <p className="font-medium text-[#1a2744]">{t.name}</p>
                        <p className="text-sm text-muted-foreground">{t.date}</p>
                      </div>
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/tournaments/${t.id}`}>View tournament</Link>
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

            {/* News */}
            {news.length > 0 && (
              <div>
                <div className="flex items-center gap-2">
                  <Newspaper className="size-5 text-[#c8a94a]" />
                  <h2 className="text-xl font-bold text-[#1a2744]">Club news</h2>
                </div>
                <ul className="mt-4 space-y-4">
                  {news.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-xl border bg-card p-5 shadow-sm"
                    >
                      <p className="text-xs font-medium" style={{ color }}>
                        {item.news_date}
                      </p>
                      <h3 className="mt-1 font-semibold text-[#1a2744]">{item.title}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">{item.excerpt}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* ── Sidebar ── */}
          <div className="h-fit space-y-4 lg:sticky lg:top-20">
            <div className="overflow-hidden rounded-xl border shadow-sm">
              <div
                className="px-5 py-4 text-white"
                style={{ backgroundColor: NAVY }}
              >
                <h2 className="font-semibold">Visit us</h2>
              </div>
              <div className="bg-card p-5">
                <dl className="space-y-3 text-sm">
                  {club.meeting_schedule && (
                    <div>
                      <dt className="font-medium text-[#1a2744]">When</dt>
                      <dd className="text-muted-foreground">{club.meeting_schedule}</dd>
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
                          className="text-muted-foreground hover:underline"
                          style={{ color }}
                        >
                          {club.contact_email}
                        </a>
                      </dd>
                    </div>
                  )}
                </dl>
                <p className="mt-4 text-xs text-muted-foreground">
                  New players are always welcome. No membership required to attend your first meeting.
                </p>
                <Button
                  asChild
                  className="mt-4 w-full font-semibold text-[#1a2744]"
                  style={{ backgroundColor: color }}
                >
                  <Link to="/membership">Join LCA</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}