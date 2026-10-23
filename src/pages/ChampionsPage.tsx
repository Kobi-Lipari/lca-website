// src/pages/ChampionsPage.tsx
//
// The LCA honor roll: reigning state champions up top, upcoming state
// championships, then two lists, the state champions since 1915 and the
// scholastic section winners since 2009. Each list names every person once,
// at the year they first won, newest first, with every later win under their
// name, and has a "winner of a year" lookup so nobody scrolls a century to
// answer one question. Entered by admins (Admin → State champions).
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, Crown, MapPin, Search, Trophy } from 'lucide-react'

import { PageHero } from '@/components/PageHero'
import { ThickThinRule } from '@/components/ThickThinRule'
import { useHeritageHook, useHeritageOrnaments } from '@/contexts/heritage-layout'
import { getChampions, type ApiChampion, type ApiChampionshipEvent } from '@/lib/api'
import { groupByPerson, winnersOfYear, yearsWon, type ChampionEntry, type ChampionKind } from '@/areas/events/champions'
import { usePageTitle } from '@/hooks/usePageTitle'
import { cn } from '@/lib/utils'

const fmtDate = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

export function ChampionsPage() {
  usePageTitle('State champions')
  const [champions, setChampions] = useState<ApiChampion[]>([])
  const [upcoming, setUpcoming] = useState<ApiChampionshipEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  // In the heritage layout the cards and the lists' frames take the look's
  // hooks, and under the new look a thick-thin rule opens the page under its
  // heading band and parts its sections.
  const ornaments = useHeritageOrnaments()
  const hook = useHeritageHook()

  useEffect(() => {
    getChampions()
      .then((d) => { setChampions(d.champions); setUpcoming(d.upcoming) })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load champions'))
      .finally(() => setLoading(false))
  }, [])

  // The state list's titles in order of how often they've been awarded, the
  // main one first; the latest year's winner(s) of each is reigning.
  const reigning = useMemo(() => {
    const count = new Map<string, number>()
    for (const c of champions) if (c.kind === 'state') count.set(c.title, (count.get(c.title) ?? 0) + 1)
    const titles = [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t)
    return titles.map((t) => {
      const rows = champions.filter((c) => c.kind === 'state' && c.title === t)
      const year = Math.max(...rows.map((r) => r.year))
      return { title: t, year, rows: rows.filter((r) => r.year === year) }
    })
  }, [champions])

  const stateEntries = useMemo(() => groupByPerson(champions, 'state'), [champions])
  const scholasticEntries = useMemo(() => groupByPerson(champions, 'scholastic'), [champions])
  const q = search.trim().toLowerCase()

  return (
    <div>
      <PageHero
        title="State champions"
        subtitle="Louisiana's state champions since 1915, the scholastic section champions since 2009, and the championships coming up."
      />

      <div className="mx-auto max-w-6xl space-y-12 px-6 py-10">
        {ornaments && <ThickThinRule />}
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {upcoming.length > 0 && (
          <section>
            <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-ink">
              <Calendar className="size-5 text-gold-ink" aria-hidden="true" /> Upcoming state championships
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {upcoming.map((t) => (
                <Link key={t.id} to={`/tournaments/${t.id}`} data-heritage={hook('card')}
                  className="rounded-xl border-l-[3px] border-l-lca-gold bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
                  <p className="font-semibold text-ink">{t.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{fmtDate(t.date)}{t.end_date && t.end_date !== t.date ? ` to ${fmtDate(t.end_date)}` : ''}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="size-3.5" aria-hidden="true" />{t.location}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {!loading && champions.length === 0 && !error && (
          <div className="rounded-xl border border-dashed p-8 text-center">
            <Trophy className="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
            <p className="mt-3 font-medium text-ink">The honor roll is being put together.</p>
            <p className="mt-1 text-sm text-muted-foreground">Check back soon for Louisiana's state champions.</p>
          </div>
        )}

        {ornaments && upcoming.length > 0 && reigning.length > 0 && <ThickThinRule />}

        {reigning.length > 0 && (
          <section>
            <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-ink">
              <Crown className="size-5 text-gold-ink" aria-hidden="true" /> Reigning champions
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {reigning.map((r) => (
                <div key={r.title} data-heritage={hook('card')} className="rounded-xl border bg-card p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gold-ink-badge">{r.title} · {r.year}</p>
                  {r.rows.map((c) => (
                    <p key={c.id} className="mt-1 text-lg font-bold text-ink">{c.champion}</p>
                  ))}
                  {r.rows[0]?.notes && <p className="mt-1 text-xs text-muted-foreground">{r.rows[0].notes}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {ornaments && champions.length > 0 && <ThickThinRule />}

        {champions.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <nav aria-label="On this page" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {stateEntries.length > 0 && <a href="#state-champions" className="font-medium text-ink underline-offset-4 hover:underline">State champions</a>}
              {scholasticEntries.length > 0 && <a href="#scholastic-champions" className="font-medium text-ink underline-offset-4 hover:underline">Scholastic champions</a>}
            </nav>
            <div className="relative">
              <label htmlFor="champion-search" className="sr-only">Find a name</label>
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input id="champion-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a name…"
                className="h-9 w-56 rounded-full border bg-background pl-8 pr-3 text-sm outline-none focus:border-ink/50" />
            </div>
          </div>
        )}

        {stateEntries.length > 0 && (
          <HonorRoll
            kind="state"
            heading="State champions"
            intro="Every Louisiana State Champion, listed once at the year they first won. A champion who won again has each later title under their name."
            champions={champions}
            entries={stateEntries}
            query={q}
            frameHook={hook('table')}
          />
        )}

        {ornaments && stateEntries.length > 0 && scholasticEntries.length > 0 && <ThickThinRule />}

        {scholasticEntries.length > 0 && (
          <HonorRoll
            kind="scholastic"
            heading="Scholastic champions"
            intro="The section winners of the Louisiana scholastic championships, each listed once at their first win. Sections are named as the records of each year have them: grade bands such as K-8, and from 2021 Lower Elementary, Upper Elementary, Middle School and High School."
            champions={champions}
            entries={scholasticEntries}
            query={q}
            frameHook={hook('table')}
          />
        )}
      </div>
    </div>
  )
}

/** Moves to a person's entry and puts keyboard focus on it, so the jump is real for everyone. */
function goToEntry(anchor: string) {
  const el = document.getElementById(anchor)
  if (!el) return
  el.scrollIntoView({ block: 'start' })
  el.focus({ preventScroll: true })
}

function HonorRoll({ kind, heading, intro, champions, entries, query, frameHook }: {
  kind: ChampionKind
  heading: string
  intro: string
  champions: ApiChampion[]
  entries: ChampionEntry[]
  query: string
  frameHook: string | undefined
}) {
  const [year, setYear] = useState('')
  const years = useMemo(() => yearsWon(champions, kind), [champions, kind])
  const picked = year ? winnersOfYear(champions, kind, Number(year)) : []
  // On a list with one title the win lines name only the year; on one with
  // several (the scholastic sections) each win names its section.
  const manyTitles = new Set(champions.filter((c) => c.kind === kind).map((c) => c.title)).size > 1
  const shown = query ? entries.filter((e) => e.name.toLowerCase().includes(query)) : entries

  return (
    <section id={`${kind}-champions`} aria-labelledby={`${kind}-champions-heading`} className="scroll-mt-24">
      <h2 id={`${kind}-champions-heading`} className="text-xl font-bold text-ink">{heading}</h2>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{intro}</p>

      <div className="mt-4 rounded-xl border bg-muted/30 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor={`${kind}-year`} className="text-sm font-medium text-ink">Winner of a year</label>
          <select id={`${kind}-year`} value={year} onChange={(e) => setYear(e.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm text-ink">
            <option value="">Choose a year</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <p role="status" aria-live="polite" className="mt-2 min-h-5 text-sm text-ink">
          {year && picked.length === 0 && <>No champion is recorded for {year}.</>}
          {year && picked.length > 0 && (
            <>
              <span className="font-semibold">{year}:</span>{' '}
              {picked.map((w, i) => (
                <span key={`${w.anchor}-${w.title}`}>
                  {i > 0 && '; '}
                  {manyTitles && <>{w.title}: </>}
                  <a href={`#${w.anchor}`} className="font-medium underline underline-offset-4"
                    onClick={(e) => { e.preventDefault(); goToEntry(w.anchor) }}>{w.name}</a>
                </span>
              ))}
            </>
          )}
        </p>
      </div>

      {shown.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No names match.</p>
      ) : (
        <ol data-heritage={frameHook} className="mt-4 divide-y overflow-hidden rounded-xl border">
          {shown.map((e) => (
            <li key={e.anchor} id={e.anchor} tabIndex={-1} className="scroll-mt-24 px-4 py-4 outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <div className="flex gap-4">
                {e.photoUrl ? (
                  <img src={e.photoUrl} alt={e.name} loading="lazy" width={96} height={128}
                    className="h-32 w-24 shrink-0 rounded-md bg-muted object-cover" />
                ) : (
                  <div aria-hidden="true" className="flex h-32 w-24 shrink-0 items-center justify-center rounded-md bg-muted">
                    <Trophy className="size-8 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-bold text-ink">{e.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    First won in {e.firstYear}
                    {e.wins.length > 1 && <>, {e.wins.length} titles through {e.lastYear}</>}
                  </p>
                  <ul className={cn('mt-2 text-sm text-ink', e.wins.length > 1 && 'space-y-0.5')}>
                    {e.wins.map((w) => (
                      <li key={w.id} className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-semibold tabular-nums">{w.year}</span>
                        {manyTitles && (
                          w.tournamentId && w.tournamentName
                            ? <Link to={`/tournaments/${w.tournamentId}`} className="hover:underline">{w.title}</Link>
                            : <span>{w.title}</span>
                        )}
                        {!manyTitles && w.tournamentId && w.tournamentName && (
                          <Link to={`/tournaments/${w.tournamentId}`} className="text-muted-foreground hover:underline">{w.tournamentName}</Link>
                        )}
                        {w.shared && <span className="rounded-full bg-lca-gold/20 px-2 text-xs font-medium text-ink">Co-champion</span>}
                        {w.notes && <span className="text-xs text-muted-foreground">{w.notes}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
