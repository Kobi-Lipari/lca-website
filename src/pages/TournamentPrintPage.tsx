// src/pages/TournamentPrintPage.tsx
//
// Printable sheets for the venue wall:
//   ?what=pairings&section=Open&round=3  — pairings by board
//   ?what=alpha&section=Open&round=3     — alphabetical "find your board"
//   ?what=standings&section=Open         — standings with tiebreaks
//   ?what=crosstable&section=Open        — crosstable (plus prize winners once finished)
//   section=all (the default with several sections) prints every section,
//   each on its own page; the alphabetical list covers them all at once.
// Plain black on white, no site header or footer when printed.
import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { StandingsTable } from '@/components/tournaments/StandingsTable'
import { Crosstable } from '@/components/tournaments/Crosstable'
import { PrizeWinners } from '@/components/tournaments/PrizeWinners'
import { getTournament, type ApiPrizeAward, type ApiStanding, type ApiTournamentDetail, type ApiTournamentPairing } from '@/lib/api'
import { usePageTitle } from '@/hooks/usePageTitle'
import { cn } from '@/lib/utils'

type What = 'pairings' | 'alpha' | 'standings' | 'crosstable'

const pts = (result: string, side: 'w' | 'b'): number => {
  if (result === '1/2-1/2') return 0.5
  if (result === 'bye') return side === 'w' ? 1 : 0
  if (result === 'bye-half') return side === 'w' ? 0.5 : 0
  if (result.startsWith('1-0')) return side === 'w' ? 1 : 0
  if (result.startsWith('0-1')) return side === 'w' ? 0 : 1
  return 0
}
const fmt = (n: number) => (n % 1 === 0 ? String(n) : n.toFixed(1).replace('.5', '½').replace('0½', '½'))

export function TournamentPrintPage() {
  const { id } = useParams<{ id: string }>()
  const [params, setParams] = useSearchParams()
  const [tournament, setTournament] = useState<ApiTournamentDetail | null>(null)
  const [pairings, setPairings] = useState<ApiTournamentPairing[]>([])
  const [standings, setStandings] = useState<ApiStanding[]>([])
  const [prizes, setPrizes] = useState<ApiPrizeAward[]>([])
  const [error, setError] = useState<string | null>(null)
  usePageTitle(tournament ? `Print · ${tournament.name}` : 'Print')

  useEffect(() => {
    if (!id) return
    getTournament(id)
      .then((d) => { setTournament(d.tournament); setPairings(d.pairings ?? []); setStandings(d.standings ?? []); setPrizes(d.prizes ?? []) })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
  }, [id])

  if (error) return <p className="mx-auto max-w-3xl px-6 py-12 text-destructive">{error}</p>
  if (!tournament) return <p className="mx-auto max-w-3xl px-6 py-12 text-muted-foreground">Loading…</p>

  const sections = tournament.sections.map((s) => s.name)
  const what = (params.get('what') as What) || 'pairings'
  const wanted = params.get('section')
  // 'all' prints every section, each starting on its own page.
  const all = sections.length > 1 && (wanted === 'all' || wanted === null)
  const section = wanted && sections.includes(wanted) ? wanted : sections[0]
  const printed = all ? sections : [section]
  const rounds = [...new Set(pairings.filter((p) => printed.includes(p.section)).map((p) => p.round))].sort((a, b) => a - b)
  const round = Number(params.get('round')) || rounds[rounds.length - 1] || 1
  const set = (k: string, v: string) => { const next = new URLSearchParams(params); next.set(k, v); setParams(next, { replace: true }) }

  // Score going into the round, for the pairing sheet.
  const scoreBefore = new Map<string, number>()
  for (const p of pairings) {
    if (!printed.includes(p.section) || p.round >= round) continue
    if (p.white_member_id) scoreBefore.set(p.white_member_id, (scoreBefore.get(p.white_member_id) ?? 0) + pts(p.result, 'w'))
    if (p.black_member_id) scoreBefore.set(p.black_member_id, (scoreBefore.get(p.black_member_id) ?? 0) + pts(p.result, 'b'))
  }
  const boardsIn = (sec: string) => pairings.filter((p) => p.section === sec && p.round === round).sort((a, b) => a.board - b.board)
  // One alphabetical list across everything printed: players find their name, then the section and board.
  const alpha = printed.flatMap((sec) => boardsIn(sec).flatMap((p) => {
    const rows = [{ name: p.white_name ?? '', section: sec, board: p.board, color: p.black_member_id ? 'White' : 'Bye', opponent: p.black_name ?? '' }]
    if (p.black_member_id) rows.push({ name: p.black_name ?? '', section: sec, board: p.board, color: 'Black', opponent: p.white_name ?? '' })
    return rows
  })).sort((a, b) => a.name.localeCompare(b.name))

  const label = all ? 'All sections' : section
  const title = what === 'standings' || what === 'crosstable'
    ? `${label} — ${what === 'crosstable' ? 'Crosstable' : 'Standings'}${rounds.length ? ` after round ${rounds[rounds.length - 1]}` : ''}`
    : `${label} — Round ${round} pairings${what === 'alpha' ? ' (alphabetical)' : ''}`

  const pairingSheet = (sec: string) => {
    const boards = boardsIn(sec)
    if (boards.length === 0) return <p>Round {round} hasn't been paired{all ? ` in ${sec}` : ''} yet.</p>
    return (
      <table className="w-full border-collapse text-[15px]">
        <thead>
          <tr className="border-b-2 border-black text-left">
            <th className="w-12 py-1.5 pr-2">Bd</th>
            <th className="py-1.5 pr-2">White</th>
            <th className="w-20 py-1.5 text-center">Result</th>
            <th className="py-1.5 pl-2">Black</th>
          </tr>
        </thead>
        <tbody>
          {boards.map((p) => (
            <tr key={p.id} className="border-b border-gray-300">
              <td className="py-1.5 pr-2 font-bold tabular-nums">{p.board}</td>
              <td className="py-1.5 pr-2">
                {p.white_name} <span className="text-gray-600">({p.white_rating ?? 'unr'}) {fmt(scoreBefore.get(p.white_member_id ?? '') ?? 0)}</span>
              </td>
              <td className="py-1.5 text-center">{p.black_member_id ? (p.result === 'pending' ? '' : p.result.replace('1/2-1/2', '½-½')) : ''}</td>
              <td className={cn('py-1.5 pl-2', !p.black_member_id && 'italic')}>
                {p.black_member_id
                  ? <>{p.black_name} <span className="text-gray-600">({p.black_rating ?? 'unr'}) {fmt(scoreBefore.get(p.black_member_id) ?? 0)}</span></>
                  : p.result === 'bye-half' ? 'Half-point bye' : 'Bye'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 print:max-w-none print:px-0 print:py-0 print:text-black">
      {!tournament.is_visible && (
        <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 print:hidden">
          Preview: this event is hidden from the public. Printing works as normal.
        </p>
      )}
      <div className="mb-6 flex flex-wrap items-center gap-3 print:hidden">
        <Button asChild variant="outline" size="sm">
          <Link to={`/tournaments/${id}/pairings`}><ArrowLeft className="size-4" /> Back</Link>
        </Button>
        <select aria-label="What to print" className="rounded-md border bg-background px-2.5 py-1.5 text-sm" value={what} onChange={(e) => set('what', e.target.value)}>
          <option value="pairings">Pairings by board</option>
          <option value="alpha">Pairings alphabetical</option>
          <option value="standings">Standings</option>
          <option value="crosstable">Crosstable</option>
        </select>
        {sections.length > 1 && (
          <select aria-label="Section" className="rounded-md border bg-background px-2.5 py-1.5 text-sm" value={all ? 'all' : section} onChange={(e) => set('section', e.target.value)}>
            <option value="all">All sections</option>
            {sections.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        {(what === 'pairings' || what === 'alpha') && rounds.length > 0 && (
          <select aria-label="Round" className="rounded-md border bg-background px-2.5 py-1.5 text-sm" value={round} onChange={(e) => set('round', e.target.value)}>
            {rounds.map((r) => <option key={r} value={r}>Round {r}</option>)}
          </select>
        )}
        <Button type="button" size="sm" className="ml-auto" onClick={() => window.print()}>
          <Printer className="size-4" /> Print
        </Button>
      </div>

      <header className="mb-4 border-b-2 border-black pb-2">
        <p className="text-sm">{tournament.name}</p>
        <h1 className="text-2xl font-bold">{title}</h1>
      </header>

      {what === 'alpha' && (
        alpha.length === 0 ? <p>This round hasn't been paired yet.</p> : (
          <table className="w-full border-collapse text-[15px]">
            <thead>
              <tr className="border-b-2 border-black text-left">
                <th className="py-1.5 pr-2">Player</th>
                {all && <th className="py-1.5 pr-2">Section</th>}
                <th className="w-16 py-1.5 text-center">Board</th>
                <th className="w-20 py-1.5">Color</th>
                <th className="py-1.5">Opponent</th>
              </tr>
            </thead>
            <tbody>
              {alpha.map((r) => (
                <tr key={`${r.section}-${r.name}-${r.board}-${r.color}`} className="border-b border-gray-300">
                  <td className="py-1.5 pr-2 font-medium">{r.name}</td>
                  {all && <td className="py-1.5 pr-2">{r.section}</td>}
                  <td className="py-1.5 text-center font-bold tabular-nums">{r.color === 'Bye' ? '—' : r.board}</td>
                  <td className="py-1.5">{r.color}</td>
                  <td className="py-1.5">{r.opponent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}

      {what !== 'alpha' && printed.map((sec, i) => (
        <section key={sec} className={cn(all && i > 0 && 'mt-10 print:mt-0 print:break-before-page')}>
          {all && <h2 className="mb-2 border-b border-black pb-1 text-lg font-bold">{sec}</h2>}
          {what === 'standings' && <StandingsTable standings={standings} sectionName={sec} showHeading={false} />}
          {what === 'crosstable' && (
            <>
              <Crosstable standings={standings} pairings={pairings} sectionName={sec} rounds={tournament.rounds} showHeading={false} />
              <PrizeWinners prizes={prizes} standings={standings} sectionName={sec} />
            </>
          )}
          {what === 'pairings' && pairingSheet(sec)}
        </section>
      ))}
    </div>
  )
}
