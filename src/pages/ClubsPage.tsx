import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, MapPin, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { getClubs, type ApiClubListItem } from '@/lib/api'
import { cn } from '@/lib/utils'
import { usePageTitle } from '@/hooks/usePageTitle'

const goldButtonClass =
  'bg-[#c8a94a] font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90'

export function ClubsPage() {
  usePageTitle('Clubs')
  const [clubs, setClubs] = useState<ApiClubListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        setClubs(await getClubs())
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load clubs')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div>
      <section className="border-b-4 border-[#c8a94a] bg-[#1a2744] text-white">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex items-center gap-3">
            <Users className="size-8 text-[#c8a94a] sm:size-10" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Affiliated Clubs
              </h1>
              <p className="mt-2 max-w-2xl text-white/80">
                Find a chess club near you. LCA-affiliated clubs host regular
                meetings, lessons, and local tournaments across Louisiana.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        {loading ? (
          <p className="text-muted-foreground">Loading clubs…</p>
        ) : error ? (
          <p className="text-destructive">{error}</p>
        ) : (
          <>
            <p className="text-muted-foreground">
              {clubs.length} clubs affiliated with the Louisiana Chess
              Association.
            </p>

            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {clubs.map((club) => (
                <li
                  key={club.id}
                  className="flex flex-col rounded-xl border bg-card p-5 shadow-sm sm:p-6"
                >
                  <h2 className="text-lg font-semibold text-[#1a2744]">
                    {club.name}
                  </h2>

                  <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="size-4 shrink-0 text-[#c8a94a]" />
                      {club.city}, LA
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Calendar className="size-4 shrink-0 text-[#c8a94a]" />
                      {club.meeting_schedule}
                    </span>
                  </div>

                  <Button
                    asChild
                    className={cn('mt-5 w-full sm:w-auto', goldButtonClass)}
                  >
                    <Link to={`/clubs/${club.id}`}>View Club</Link>
                  </Button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  )
}

