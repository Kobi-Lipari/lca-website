// src/pages/ChampionsPage.tsx
//
// The LCA honor roll: reigning state champions up top, upcoming state
// championships, then every past champion by year, filterable by title and
// searchable by name. Entered by admins (Admin → State champions).
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, Crown, MapPin, Search, Trophy } from 'lucide-react'

import { PageHero } from '@/components/PageHero'
import { getChampions, type ApiChampion, type ApiChampionshipEvent } from '@/lib/api'
import { usePageTitle } from '@/hooks/usePageTitle'
import { cn } from '@/lib/utils'

const fmtDate = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

export function ChampionsPage() {
  usePageTitle('State champions')
  const [champions, setChampions] = useState<ApiChampion[]>([])
  const [upcoming, setUpcoming] = useState<ApiChampionshipEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState<string>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    getChampions()
      .then((d) => { setChampions(d.champions); setUpcoming(d.upcoming) })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load champions'))
      .finally(() => setLoading(false))
  }, [])

  // Titles in order of how often they've been awarded, the main one first.
  const titles = useMemo(() => {
    const count = new Map<string, number>()
    for (const c of champions) count.set(c.title, (count.get(c.title) ?? 0) + 1)
    return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t)
  }, [champions])

  // The latest year's winner(s) for each title.
  const reigning = useMemo(() => titles.map((t) => {
    const rows = champions.filter((c) => c.title === t)
    const year = Math.max(...rows.map((r) => r.year))
    return { title: t, year, rows: rows.filter((r) => r.year === year) }
  }), [champions, titles])

  const q = search.trim().toLowerCase()
  const shown = champions.filter((c) => (title === 'all' || c.title === title) && (!q || c.champion.toLowerCase().includes(q)))
  const years = [...new Set(shown.map((c) => c.year))]

  return (
    <div>
      <PageHero
        title="State champions"
        subtitle="Louisiana's chess champions, past and present, and the championships coming up."
      />

      <div className="mx-auto max-w-6xl space-y-12 px-6 py-10">
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {upcoming.length > 0 && (
          <section>
            <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-lca-navy">
              <Calendar className="size-5 text-lca-gold" /> Upcoming state championships
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {upcoming.map((t) => (
                <Link key={t.id} to={`/tournaments/${t.id}`}
                  className="rounded-xl border-l-[3px] border-l-lca-gold bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
                  <p className="font-semibold text-lca-navy">{t.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{fmtDate(t.date)}{t.end_date && t.end_date !== t.date ? ` – ${fmtDate(t.end_date)}` : ''}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="size-3.5" />{t.location}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {!loading && champions.length === 0 && !error && (
          <div className="rounded-xl border border-dashed p-8 text-center">
            <Trophy className="mx-auto size-10 text-muted-foreground" />
            <p className="mt-3 font-medium text-lca-navy">The honor roll is being put together.</p>
            <p className="mt-1 text-sm text-muted-foreground">Check back soon for Louisiana's state champions.</p>
          </div>
        )}

        {reigning.length > 0 && (
          <section>
            <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-lca-navy">
              <Crown className="size-5 text-lca-gold" /> Reigning champions
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {reigning.map((r) => (
                <div key={r.title} className="rounded-xl border bg-card p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#7a5c00]">{r.title} · {r.year}</p>
                  {r.rows.map((c) => (
                    <p key={c.id} className="mt-1 text-lg font-bold text-lca-navy">{c.champion}</p>
                  ))}
                  {r.rows[0]?.notes && <p className="mt-1 text-xs text-muted-foreground">{r.rows[0].notes}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {champions.length > 0 && (
          <section>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-xl font-bold text-lca-navy">All champions</h2>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a name…"
                  className="h-9 w-56 rounded-full border bg-background pl-8 pr-3 text-sm outline-none focus:border-lca-navy/50" />
              </div>
            </div>
            {titles.length > 1 && (
              <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Championship">
                {['all', ...titles].map((t) => (
                  <button key={t} type="button" onClick={() => setTitle(t)} aria-pressed={title === t}
                    className={cn('rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      title === t ? 'border-lca-navy bg-lca-navy text-white' : 'text-muted-foreground hover:border-lca-navy/40')}>
                    {t === 'all' ? 'All championships' : t}
                  </button>
                ))}
              </div>
            )}
            {shown.length === 0 ? (
              <p className="text-sm text-muted-foreground">No champions match.</p>
            ) : (
              <div className="overflow-hidden rounded-xl border">
                {years.map((y) => (
                  <div key={y}>
                    <div className="border-b bg-muted/50 px-4 py-1.5 text-sm font-bold text-lca-navy">{y}</div>
                    <ul className="divide-y">
                      {shown.filter((c) => c.year === y).map((c) => (
                        <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-4 py-2.5 text-sm">
                          <span>
                            <span className="font-semibold text-lca-navy">{c.champion}</span>
                            {c.notes && <span className="ml-2 text-xs text-muted-foreground">{c.notes}</span>}
                          </span>
                          <span className="text-muted-foreground">
                            {c.tournament_id && c.tournament_name
                              ? <Link to={`/tournaments/${c.tournament_id}`} className="hover:text-lca-navy hover:underline">{c.title}</Link>
                              : c.title}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
