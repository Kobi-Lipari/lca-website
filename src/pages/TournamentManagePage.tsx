import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Sparkles, Trophy } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { usePageTitle } from '@/hooks/usePageTitle'
import {
  adminCreatePairings,
  adminGeneratePairings,
  adminGetTournamentManage,
  adminUpdateGameResult,
  type ApiStanding,
  type ApiTournamentDetail,
  type ApiTournamentGame,
} from '@/lib/api'
import { cn } from '@/lib/utils'

const goldButtonClass =
  'bg-[#c8a94a] font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90'

const RESULT_OPTIONS = ['pending', '1-0', '0-1', '1/2-1/2', 'bye']

export function TournamentManagePage() {
  const { id } = useParams<{ id: string }>()
  const [tournament, setTournament] = useState<ApiTournamentDetail | null>(
    null,
  )
  const [games, setGames] = useState<ApiTournamentGame[]>([])
  const [standings, setStandings] = useState<ApiStanding[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [savingPairings, setSavingPairings] = useState(false)

  const [generateForm, setGenerateForm] = useState({
    round: '1',
    section: 'Open',
  })

  const [pairingForm, setPairingForm] = useState({
    round: '1',
    section: 'Open',
    whiteMemberId: '',
    blackMemberId: '',
    board: '1',
  })

  usePageTitle(
    tournament ? `Manage ${tournament.name}` : 'Manage Tournament',
  )

  async function loadManage() {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const data = await adminGetTournamentManage(id)
      setTournament(data.tournament)
      setGames(data.games)
      setStandings(data.standings)
      const defaultSection = data.tournament.sections[0]?.name ?? 'Open'
      setGenerateForm((p) => ({ ...p, section: defaultSection }))
      setPairingForm((p) => ({ ...p, section: defaultSection }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tournament')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadManage()
  }, [id])

  async function handleGeneratePairings() {
    if (!id) return
    setGenerating(true)
    setError(null)
    try {
      await adminGeneratePairings(id, {
        round: Number(generateForm.round),
        section: generateForm.section,
      })
      await loadManage()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate pairings')
    } finally {
      setGenerating(false)
    }
  }

  async function handleAddPairing(event: FormEvent) {
    event.preventDefault()
    if (!id) return
    setSavingPairings(true)
    setError(null)
    try {
      await adminCreatePairings(id, {
        round: Number(pairingForm.round),
        section: pairingForm.section,
        pairings: [
          {
            board: Number(pairingForm.board),
            whiteMemberId: pairingForm.whiteMemberId || null,
            blackMemberId: pairingForm.blackMemberId || null,
          },
        ],
      })
      setPairingForm((p) => ({
        ...p,
        whiteMemberId: '',
        blackMemberId: '',
        board: String(Number(p.board) + 1),
      }))
      await loadManage()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add pairing')
    } finally {
      setSavingPairings(false)
    }
  }

  async function handleResultChange(gameId: string, result: string) {
    if (!id) return
    try {
      await adminUpdateGameResult(id, gameId, result)
      await loadManage()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update result')
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12">
        <p className="text-muted-foreground" role="status">
          Loading tournament...
        </p>
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12 text-center">
        <p className="text-destructive">{error ?? 'Tournament not found'}</p>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    )
  }

  const maxRound =
    games.length > 0 ? Math.max(...games.map((g) => g.round)) : 0
  const suggestedRound = String(maxRound > 0 ? maxRound + 1 : 1)

  return (
    <div>
      <section className="border-b-4 border-[#c8a94a] bg-[#1a2744] text-white">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-[#c8a94a]"
          >
            <ArrowLeft className="size-4" />
            Dashboard
          </Link>
          <div className="mt-4 flex items-center gap-3">
            <Trophy className="size-8 text-[#c8a94a]" />
            <div>
              <h1 className="text-3xl font-bold">{tournament.name}</h1>
              <p className="mt-1 text-white/80">
                Tournament director panel · {tournament.status}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl space-y-10 px-6 py-12">
        {error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-[#c8a94a]" />
            <h2 className="text-lg font-bold text-[#1a2744]">
              Generate pairings (FIDE Dutch)
            </h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Pair all registered players in a section using the FIDE Dutch system
            (C.04) — rating order in round 1, score groups with optimal matching
            thereafter.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="gen-round">Round</Label>
              <Input
                id="gen-round"
                type="number"
                min={1}
                value={generateForm.round}
                placeholder={suggestedRound}
                onChange={(e) =>
                  setGenerateForm((p) => ({ ...p, round: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gen-section">Section</Label>
              <select
                id="gen-section"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={generateForm.section}
                onChange={(e) =>
                  setGenerateForm((p) => ({ ...p, section: e.target.value }))
                }
              >
                {tournament.sections.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                className={cn('w-full', goldButtonClass)}
                disabled={generating}
                onClick={handleGeneratePairings}
              >
                {generating ? 'Generating…' : 'Generate pairings'}
              </Button>
            </div>
          </div>
        </div>

        <details className="rounded-xl border bg-card p-6 shadow-sm">
          <summary className="cursor-pointer text-lg font-bold text-[#1a2744]">
            Manual pairing override
          </summary>
          <form onSubmit={handleAddPairing} className="mt-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="round">Round</Label>
                <Input
                  id="round"
                  type="number"
                  min={1}
                  value={pairingForm.round}
                  onChange={(e) =>
                    setPairingForm((p) => ({ ...p, round: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="section">Section</Label>
                <select
                  id="section"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={pairingForm.section}
                  onChange={(e) =>
                    setPairingForm((p) => ({ ...p, section: e.target.value }))
                  }
                >
                  {tournament.sections.map((s) => (
                    <option key={s.name} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="board">Board</Label>
                <Input
                  id="board"
                  type="number"
                  min={1}
                  value={pairingForm.board}
                  onChange={(e) =>
                    setPairingForm((p) => ({ ...p, board: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="white">White (member ID)</Label>
                <Input
                  id="white"
                  value={pairingForm.whiteMemberId}
                  onChange={(e) =>
                    setPairingForm((p) => ({
                      ...p,
                      whiteMemberId: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="black">Black (member ID)</Label>
                <Input
                  id="black"
                  value={pairingForm.blackMemberId}
                  onChange={(e) =>
                    setPairingForm((p) => ({
                      ...p,
                      blackMemberId: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <Button
              type="submit"
              variant="outline"
              className="mt-4"
              disabled={savingPairings}
            >
              {savingPairings ? 'Saving...' : 'Add manual pairing'}
            </Button>
          </form>
        </details>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-bold text-[#1a2744]">Pairings &amp; results</h2>
          {games.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No pairings yet. Generate round 1 pairings above.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2">Rd</th>
                    <th className="px-3 py-2">Bd</th>
                    <th className="px-3 py-2">Section</th>
                    <th className="px-3 py-2">White</th>
                    <th className="px-3 py-2">Black</th>
                    <th className="px-3 py-2">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {games.map((game) => (
                    <tr key={game.id} className="border-b">
                      <td className="px-3 py-2">{game.round}</td>
                      <td className="px-3 py-2">{game.board}</td>
                      <td className="px-3 py-2">{game.section}</td>
                      <td className="px-3 py-2">
                        {game.white_name ?? game.white_member_id ?? '—'}
                      </td>
                      <td className="px-3 py-2">
                        {game.black_name ?? game.black_member_id ?? 'BYE'}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          className="rounded-md border bg-background px-2 py-1"
                          value={game.result}
                          aria-label={`Result for board ${game.board}`}
                          onChange={(e) =>
                            handleResultChange(game.id, e.target.value)
                          }
                        >
                          {RESULT_OPTIONS.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-bold text-[#1a2744]">Standings</h2>
          {standings.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Standings appear once results are recorded.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2">Player</th>
                    <th className="px-3 py-2">Section</th>
                    <th className="px-3 py-2">Score</th>
                    <th className="px-3 py-2">W-D-L</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((s) => (
                    <tr key={s.member_id} className="border-b">
                      <td className="px-3 py-2 font-medium">{s.full_name}</td>
                      <td className="px-3 py-2">{s.section}</td>
                      <td className="px-3 py-2">{s.score}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {s.wins}-{s.draws}-{s.losses}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <Button asChild variant="outline">
          <Link to={`/tournaments/${id}`}>View public tournament page</Link>
        </Button>
      </section>
    </div>
  )
}
