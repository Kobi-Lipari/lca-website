// src/pages/ClubDetailPage.tsx
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
import { cn } from '@/lib/utils'
import { usePageTitle } from '@/hooks/usePageTitle'
import { LCAMap } from '@/components/maps/LCAMap'
import { LCA } from '@/lib/brand'

const LCA_GOLD = LCA.gold
const NAVY = LCA.navy

function formatOfficerRole(role: string): string {
  return role.replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Navy text on light club colors, white text on dark ones — some clubs use
 *  dark brand colors and the old hardcoded navy-on-color was unreadable. */
function readableTextOn(hex: string): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex)
  if (!m) return NAVY
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b
  return luminance > 150 ? NAVY : '#ffffff'
}

const statusBadge: Record<string, { label: string; className: string }> = {
  upcoming: { label: 'Upcoming', className: 'bg-lca-gold/15 text-[#8a6d1f]' },
  active: { label: 'In progress', className: 'bg-emerald-100 text-emerald-800' },
  completed: { label: 'Completed', className: 'bg-muted text-muted-foreground' },
}

function TournamentRow({ t, color }: { t: ApiClubTournament; color: string }) {
  const badge = statusBadge[t.status] ?? statusBadge.upcoming
  return (
    <li
      className="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
      style={{ backgroundColor: clubColorTint(color, 0.04) }}
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-lca-navy">{t.name}</p>
          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', badge.className)}>
            {badge.label}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{t.date}</p>
      </div>
      <Button asChild variant="outline" size="sm">
        <Link to={`/tournaments/${t.id}`}>
          {t.status === 'completed' ? 'View results' : 'View tournament'}
        </Link>
      </Button>
    </li>
  )
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
      <h1 className="mt-4 text-2xl font-bold text-lca-navy">Club not found</h1>
      <Button asChild className="mt-6" variant="outline">
        <Link to="/clubs"><ArrowLeft className="size-4" /> Back to clubs</Link>
      </Button>
    </div>
  )

  const color = club.color || LCA_GOLD
  const imageUrl = club.image_url
  const buttonText = readableTextOn(color)

  const upcoming = tournaments.filter((t) => t.status === 'upcoming' || t.status === 'active')
  const recent = tournaments.filter((t) => t.status === 'completed').slice(0, 5)

  return (
    <div>
      {/* ── Hero ── */}
<section
  className="border-b-[3px] text-white"
  style={{ backgroundColor: LCA.navy, borderBottomColor: color }}
>
  <div className="mx-auto max-w-6xl px-6 py-10">
    <Link
      to="/clubs"
      className="inline-flex items-center gap-1.5 text-sm text-white/55 transition-colors hover:text-lca-gold"
    >
      <ArrowLeft className="size-3.5" /> All clubs
    </Link>

    <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-center">
      {imageUrl && (
        <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl border border-white/15 bg-white shadow-sm sm:h-28 sm:w-28">
          <div
            className="h-full w-full bg-contain bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${imageUrl})` }}
          />
        </div>
      )}
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
            <MapPin className="size-4 flex-shrink-0 text-lca-gold" />
            {club.city}, LA
          </span>
          {club.meeting_schedule && (
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="size-4 flex-shrink-0 text-lca-gold" />
              {club.meeting_schedule}
            </span>
          )}
          {club.contact_email && (
            <span className="inline-flex items-center gap-1.5">
              <Mail className="size-4 flex-shrink-0 text-lca-gold" />
              {club.contact_email}
            </span>
          )}
        </div>
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
            {(club.description || club.location) && (
              <div>
                <h2 className="text-xl font-bold text-lca-navy">About</h2>
                {club.description && (
                  <p className="mt-3 text-muted-foreground">{club.description}</p>
                )}
                {club.location && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    <span className="font-medium text-lca-navy">Meeting location:</span>{' '}
                    {club.location}
                  </p>
                )}
              </div>
            )}

            {/* Officers */}
            {officers.length > 0 && (
              <div>
                <div className="flex items-center gap-2">
                  <User className="size-5 text-lca-gold" />
                  <h2 className="text-xl font-bold text-lca-navy">Officers</h2>
                </div>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {officers.map((officer) => (
                    <li
                      key={`${officer.full_name}-${officer.role}`}
                      className="overflow-hidden rounded-xl border bg-card shadow-sm"
                      style={{ borderLeftColor: color, borderLeftWidth: 3 }}
                    >
                      <div className="px-4 py-3">
                        <p className="font-medium text-lca-navy">{officer.full_name}</p>
                        <p className="text-sm" style={{ color }}>
                          {formatOfficerRole(officer.role)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Upcoming tournaments */}
            <div>
              <div className="flex items-center gap-2">
                <Trophy className="size-5 text-lca-gold" />
                <h2 className="text-xl font-bold text-lca-navy">Upcoming tournaments</h2>
              </div>
              {upcoming.length > 0 ? (
                <ul className="mt-4 space-y-3">
                  {upcoming.map((t) => (
                    <TournamentRow key={t.id} t={t} color={color} />
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  No upcoming club tournaments scheduled. Check back soon.
                </p>
              )}
            </div>

            {/* Recent results */}
            {recent.length > 0 && (
              <div>
                <h2 className="text-xl font-bold text-lca-navy">Recent tournaments</h2>
                <ul className="mt-4 space-y-3">
                  {recent.map((t) => (
                    <TournamentRow key={t.id} t={t} color={color} />
                  ))}
                </ul>
              </div>
            )}

            {/* News */}
            {news.length > 0 && (
              <div>
                <div className="flex items-center gap-2">
                  <Newspaper className="size-5 text-lca-gold" />
                  <h2 className="text-xl font-bold text-lca-navy">Club news</h2>
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
                      <h3 className="mt-1 font-semibold text-lca-navy">{item.title}</h3>
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
                      <dt className="font-medium text-lca-navy">When</dt>
                      <dd className="text-muted-foreground">{club.meeting_schedule}</dd>
                    </div>
                  )}
                  {club.location && (
                    <div>
                      <dt className="font-medium text-lca-navy">Where</dt>
                      <dd className="text-muted-foreground">{club.location}</dd>
                    </div>
                  )}
                  {club.contact_email && (
                    <div>
                      <dt className="font-medium text-lca-navy">Contact</dt>
                      <dd>
                        <a
                          href={`mailto:${club.contact_email}`}
                          className="hover:underline"
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
                  className="mt-4 w-full font-semibold"
                  style={{ backgroundColor: color, color: buttonText }}
                >
                  <Link to="/membership">Join LCA</Link>
                </Button>
                {/* Map goes LAST: the -mx-5/-mb-5 bleed means anything after it
                    renders on top of the map (the overlap bug in the screenshots). */}
                <div className="mt-5 -mx-5 -mb-5 overflow-hidden">
                  <LCAMap mode="single" clubName={club.name} height={200} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}