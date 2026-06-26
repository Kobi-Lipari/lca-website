// src/pages/TournamentManagePage.tsx
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft, Eye, EyeOff, Plus, Sparkles, Trash2, Trophy,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { usePageTitle } from '@/hooks/usePageTitle'
import {
  adminGeneratePairings,
  adminGetTournamentManage,
  adminUpdateGameResult,
  adminUpdateTournamentFull,
  adminCreatePairings,
  updateTournamentRegistration,
  type ApiCustomDetail,
  type ApiRoundScheduleItem,
  type ApiStanding,
  type ApiTournamentDetail,
  type ApiTournamentGame,
  type ApiTournamentSection,
} from '@/lib/api'
import { cn } from '@/lib/utils'

const goldButtonClass = 'bg-[#c8a94a] font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90'
const RESULT_OPTIONS = ['pending', '1-0', '0-1', '1/2-1/2', 'bye']

const SECTION_PRESETS = [
  'Open', 'U2200', 'U2000', 'U1800', 'U1600',
  'U1400', 'U1200', 'U1000', 'K-12', 'K-8', 'K-5', 'Blitz', 'Quick',
]

const TIME_CONTROL_PRESETS = [
  'G/60+5', 'G/90+30', 'G/120+30', 'G/30+5', 'G/15+2', 'G/5+2', 'G/3+2',
]

const ROUND_GAP_OPTIONS = [
  { label: '1.5 hours', minutes: 90 },
  { label: '2 hours', minutes: 120 },
  { label: '2.5 hours', minutes: 150 },
  { label: '3 hours', minutes: 180 },
  { label: '3.5 hours', minutes: 210 },
  { label: '4 hours', minutes: 240 },
]

interface RosterPlayer {
  registration_id: string
  member_id: string
  full_name: string
  uscf_id: string | null
  uscf_rating: number | null
  section: string
  payment_status: string
  bye_rounds: number[]
}

export function TournamentManagePage() {
  const { id } = useParams<{ id: string }>()
  const [tournament, setTournament] = useState<ApiTournamentDetail | null>(null)
  const [roster, setRoster] = useState<RosterPlayer[]>([])
  const [games, setGames] = useState<ApiTournamentGame[]>([])
  const [standings, setStandings] = useState<ApiStanding[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [savingPairings, setSavingPairings] = useState(false)

  // Settings panel state
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [sections, setSections] = useState<ApiTournamentSection[]>([])
  const [customPreset, setCustomPreset] = useState('')
  const [rounds, setRounds] = useState('5')
  const [isVisible, setIsVisible] = useState(true)
  const [isRated, setIsRated] = useState(true)
  const [registrationStatus, setRegistrationStatus] = useState('draft')
  const [registrationClosesAt, setRegistrationClosesAt] = useState('')
  const [roundSchedule, setRoundSchedule] = useState<ApiRoundScheduleItem[]>([])
  const [customDetails, setCustomDetails] = useState<ApiCustomDetail[]>([])
  const [timeControl, setTimeControl] = useState('')
  const [customTimeControl, setCustomTimeControl] = useState('')
  const [autoFillGap, setAutoFillGap] = useState(120)

  const [generateForm, setGenerateForm] = useState({ round: '1', section: 'Open' })
  const [pairingForm, setPairingForm] = useState({
    round: '1', section: 'Open', whiteMemberId: '', blackMemberId: '', board: '1',
  })

  usePageTitle(tournament ? `Manage ${tournament.name}` : 'Manage Tournament')

  async function loadManage() {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const data = await adminGetTournamentManage(id)
      setTournament(data.tournament)
      setRoster((data.roster as unknown as RosterPlayer[]) ?? [])
      setGames(data.games)
      setStandings(data.standings)

      setSections(data.tournament.sections ?? [])
      setRounds(String(data.tournament.rounds ?? 5))
      setIsVisible((data.tournament as any).is_visible !== 0)
      setIsRated((data.tournament as any).is_rated !== 0)
      setRegistrationStatus((data.tournament as any).registration_status ?? 'draft')
      setRegistrationClosesAt((data.tournament as any).registration_closes_at ?? '')
      setRoundSchedule((data.tournament as any).round_schedule ?? [])
      setCustomDetails((data.tournament as any).custom_details ?? [])
      setTimeControl((data.tournament as any).time_control ?? '')

      const defaultSection = data.tournament.sections[0]?.name ?? 'Open'
      setGenerateForm((p) => ({ ...p, section: defaultSection }))
      setPairingForm((p) => ({ ...p, section: defaultSection }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tournament')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadManage() }, [id])

  // Sync round schedule rows when rounds count changes
  useEffect(() => {
    const n = Number(rounds)
    if (!n || n < 1) return
    setRoundSchedule((prev) => {
      const next: ApiRoundScheduleItem[] = []
      for (let i = 1; i <= n; i++) {
        const existing = prev.find((r) => r.round === i)
        next.push(existing ?? { round: i, date: '', time: '' })
      }
      return next
    })
  }, [rounds])

  async function handleSaveSettings() {
    if (!id) return
    setSaving(true)
    setError(null)
    try {
      await adminUpdateTournamentFull(id, {
        sections,
        rounds: Number(rounds),
        isVisible,
        isRated,
        roundSchedule,
        registrationClosesAt: registrationClosesAt || null,
        customDetails,
        timeControl: timeControl || null,
      })
      await updateTournamentRegistration(id, {
        registration_status: registrationStatus as 'draft' | 'open' | 'closed',
      })
      await loadManage()
      setSettingsOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  function autoFillSchedule() {
    if (!roundSchedule[0]?.date || !roundSchedule[0]?.time) return
    const baseDate = new Date(`${roundSchedule[0].date}T${roundSchedule[0].time}`)
    if (isNaN(baseDate.getTime())) return
    setRoundSchedule((prev) =>
      prev.map((r, i) => {
        if (i === 0) return r
        const d = new Date(baseDate.getTime() + i * autoFillGap * 60 * 1000)
        const date = d.toISOString().split('T')[0]
        const time = d.toTimeString().slice(0, 5)
        return { ...r, date, time }
      }),
    )
  }

  function addSectionPreset(name: string) {
    if (sections.some((s) => s.name === name)) return
    setSections((prev) => [...prev, { name, entryFee: 0 }])
  }

  function addCustomSection() {
    const name = customPreset.trim()
    if (!name || sections.some((s) => s.name === name)) return
    setSections((prev) => [...prev, { name, entryFee: 0 }])
    setCustomPreset('')
  }

  function removeSection(name: string) {
    setSections((prev) => prev.filter((s) => s.name !== name))
  }

  function updateSectionFee(name: string, fee: string) {
    setSections((prev) =>
      prev.map((s) => s.name === name ? { ...s, entryFee: Number(fee) } : s),
    )
  }

  function updateSectionPrize(name: string, prizeFund: string) {
    setSections((prev) =>
      prev.map((s) => s.name === name ? { ...s, prizeFund } : s),
    )
  }

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
        pairings: [{
          board: Number(pairingForm.board),
          whiteMemberId: pairingForm.whiteMemberId || null,
          blackMemberId: pairingForm.blackMemberId || null,
        }],
      })
      setPairingForm((p) => ({
        ...p, whiteMemberId: '', blackMemberId: '',
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
        <p className="text-muted-foreground">Loading tournament...</p>
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

  const maxRound = games.length > 0 ? Math.max(...games.map((g) => g.round)) : 0

  return (
    <div>
      <section className="border-b-4 border-[#c8a94a] bg-[#1a2744] text-white">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-[#c8a94a]">
            <ArrowLeft className="size-4" />Dashboard
          </Link>
          <div className="mt-4 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <Trophy className="size-8 text-[#c8a94a]" />
              <div>
                <h1 className="text-3xl font-bold">{tournament.name}</h1>
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  <span className="text-white/80 text-sm">{tournament.status}</span>
                  <span className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium',
                    isVisible ? 'bg-green-500/20 text-green-300' : 'bg-white/10 text-white/50',
                  )}>
                    {isVisible
                      ? <><Eye className="inline size-3 mr-1" />Visible</>
                      : <><EyeOff className="inline size-3 mr-1" />Hidden</>}
                  </span>
                  <span className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium',
                    registrationStatus === 'open'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : registrationStatus === 'closed'
                      ? 'bg-red-500/20 text-red-300'
                      : 'bg-white/10 text-white/50',
                  )}>
                    Reg: {registrationStatus}
                  </span>
                </div>
              </div>
            </div>
            <Button
              type="button"
              className={goldButtonClass}
              onClick={() => setSettingsOpen((p) => !p)}
            >
              {settingsOpen ? 'Close settings' : 'Tournament settings'}
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl space-y-8 px-6 py-12">
        {error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {/* Settings panel */}
        {settingsOpen && (
          <div className="rounded-xl border bg-card p-6 shadow-sm space-y-8">
            <h2 className="text-lg font-bold text-[#1a2744]">Tournament Settings</h2>

            {/* Visibility, status, rating, auto-close, rounds */}
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Visibility</Label>
                <div className="flex gap-2">
                  <button type="button"
                    onClick={() => setIsVisible(true)}
                    className={cn('flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                      isVisible ? 'border-[#1a2744] bg-[#1a2744] text-white' : 'border-border text-muted-foreground hover:border-[#1a2744]/40')}
                  >Visible to public</button>
                  <button type="button"
                    onClick={() => setIsVisible(false)}
                    className={cn('flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                      !isVisible ? 'border-[#1a2744] bg-[#1a2744] text-white' : 'border-border text-muted-foreground hover:border-[#1a2744]/40')}
                  >Hidden (draft)</button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Registration status</Label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={registrationStatus}
                  onChange={(e) => setRegistrationStatus(e.target.value)}
                >
                  <option value="draft">Draft — not open</option>
                  <option value="open">Open — accepting registrations</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label>Rating type</Label>
                <div className="flex gap-2">
                  <button type="button"
                    onClick={() => setIsRated(true)}
                    className={cn('flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                      isRated ? 'border-[#1a2744] bg-[#1a2744] text-white' : 'border-border text-muted-foreground')}
                  >USCF Rated</button>
                  <button type="button"
                    onClick={() => setIsRated(false)}
                    className={cn('flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                      !isRated ? 'border-[#1a2744] bg-[#1a2744] text-white' : 'border-border text-muted-foreground')}
                  >Unrated</button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reg-closes">Auto-close registration at</Label>
                <Input
                  id="reg-closes"
                  type="datetime-local"
                  value={registrationClosesAt}
                  onChange={(e) => setRegistrationClosesAt(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Registration will automatically close at this time.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rounds-count">Number of rounds</Label>
                <Input
                  id="rounds-count"
                  type="number"
                  min={1}
                  max={20}
                  value={rounds}
                  onChange={(e) => setRounds(e.target.value)}
                />
              </div>
            </div>

            {/* Time control */}
            <div className="space-y-3">
              <Label>Time control</Label>
              <div className="flex flex-wrap gap-2">
                {TIME_CONTROL_PRESETS.map((tc) => (
                  <button
                    key={tc}
                    type="button"
                    onClick={() => { setTimeControl(tc); setCustomTimeControl('') }}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      timeControl === tc
                        ? 'border-[#1a2744] bg-[#1a2744] text-white'
                        : 'border-border text-muted-foreground hover:border-[#c8a94a] hover:text-[#1a2744]',
                    )}
                  >
                    {tc}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Custom time control (e.g. G/45+15)…"
                  value={customTimeControl}
                  onChange={(e) => {
                    setCustomTimeControl(e.target.value)
                    setTimeControl(e.target.value)
                  }}
                />
              </div>
              {timeControl && !TIME_CONTROL_PRESETS.includes(timeControl) && (
                <p className="text-xs text-muted-foreground">
                  Custom: <span className="font-medium text-foreground">{timeControl}</span>
                </p>
              )}
            </div>

            {/* Round schedule with auto-fill */}
            <div className="space-y-3">
              <Label>Round schedule</Label>
              <p className="text-xs text-muted-foreground">
                Set round 1 date and time, then use auto-fill to populate the rest. You can adjust any round individually after.
              </p>

              {/* Auto-fill controls */}
              <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 p-3">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Time between rounds</p>
                  <select
                    className="rounded-md border bg-background px-3 py-1.5 text-sm"
                    value={autoFillGap}
                    onChange={(e) => setAutoFillGap(Number(e.target.value))}
                  >
                    {ROUND_GAP_OPTIONS.map((o) => (
                      <option key={o.minutes} value={o.minutes}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={autoFillSchedule}
                  disabled={!roundSchedule[0]?.date || !roundSchedule[0]?.time}
                >
                  Auto-fill rounds 2–{rounds}
                </Button>
                <p className="text-xs text-muted-foreground">Set round 1 first, then click auto-fill.</p>
              </div>

              <div className="space-y-2">
                {roundSchedule.map((rs, i) => (
                  <div key={rs.round} className="grid grid-cols-3 gap-2 items-center">
                    <span className="text-sm font-medium text-[#1a2744]">Round {rs.round}</span>
                    <Input
                      type="date"
                      value={rs.date}
                      onChange={(e) => setRoundSchedule((prev) =>
                        prev.map((r, j) => j === i ? { ...r, date: e.target.value } : r)
                      )}
                    />
                    <Input
                      type="time"
                      value={rs.time}
                      onChange={(e) => setRoundSchedule((prev) =>
                        prev.map((r, j) => j === i ? { ...r, time: e.target.value } : r)
                      )}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Sections */}
            <div className="space-y-3">
              <Label>Sections</Label>
              <div className="flex flex-wrap gap-2">
                {SECTION_PRESETS.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => addSectionPreset(name)}
                    disabled={sections.some((s) => s.name === name)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      sections.some((s) => s.name === name)
                        ? 'border-[#1a2744] bg-[#1a2744] text-white cursor-default'
                        : 'border-border text-muted-foreground hover:border-[#c8a94a] hover:text-[#1a2744]',
                    )}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Custom section name…"
                  value={customPreset}
                  onChange={(e) => setCustomPreset(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomSection() } }}
                />
                <Button type="button" variant="outline" onClick={addCustomSection}>
                  <Plus className="size-4" />Add
                </Button>
              </div>

              {sections.length > 0 && (
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-3 py-2 text-left font-semibold">Section</th>
                        <th className="px-3 py-2 text-left font-semibold">Entry fee ($)</th>
                        <th className="px-3 py-2 text-left font-semibold">Prize fund</th>
                        <th className="px-3 py-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {sections.map((s) => (
                        <tr key={s.name} className="border-b last:border-0">
                          <td className="px-3 py-2 font-medium">{s.name}</td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              min={0}
                              className="h-8 w-24"
                              value={s.entryFee}
                              onChange={(e) => updateSectionFee(s.name, e.target.value)}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              className="h-8 w-32"
                              placeholder="e.g. $500"
                              value={s.prizeFund ?? ''}
                              onChange={(e) => updateSectionPrize(s.name, e.target.value)}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => removeSection(s.name)}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Custom detail sections */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Additional details</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCustomDetails((prev) => [...prev, { title: '', body: '' }])}
                >
                  <Plus className="size-4 mr-1" />Add section
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Add any extra info like parking, prizes, schedule notes, etc.</p>
              {customDetails.map((cd, i) => (
                <div key={i} className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Section title (e.g. Prizes)"
                      value={cd.title}
                      onChange={(e) => setCustomDetails((prev) =>
                        prev.map((d, j) => j === i ? { ...d, title: e.target.value } : d)
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setCustomDetails((prev) => prev.filter((_, j) => j !== i))}
                      className="text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <textarea
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[80px]"
                    placeholder="Details…"
                    value={cd.body}
                    onChange={(e) => setCustomDetails((prev) =>
                      prev.map((d, j) => j === i ? { ...d, body: e.target.value } : d)
                    )}
                  />
                </div>
              ))}
            </div>

            <Button
              type="button"
              className={goldButtonClass}
              disabled={saving}
              onClick={handleSaveSettings}
            >
              {saving ? 'Saving…' : 'Save settings'}
            </Button>
          </div>
        )}

        {/* Roster with bye rounds */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-bold text-[#1a2744]">
            Registered players ({roster.length})
          </h2>
          {roster.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No players registered yet.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 font-semibold">Name</th>
                    <th className="px-3 py-2 font-semibold">USCF ID</th>
                    <th className="px-3 py-2 font-semibold">Rating</th>
                    <th className="px-3 py-2 font-semibold">Section</th>
                    <th className="px-3 py-2 font-semibold">Payment</th>
                    <th className="px-3 py-2 font-semibold">Bye rounds</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((player) => (
                    <tr key={player.member_id} className="border-b">
                      <td className="px-3 py-2 font-medium">{player.full_name}</td>
                      <td className="px-3 py-2 text-muted-foreground font-mono text-xs">
                        {player.uscf_id ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {player.uscf_rating ?? '—'}
                      </td>
                      <td className="px-3 py-2">{player.section}</td>
                      <td className="px-3 py-2">
                        <span className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-medium',
                          player.payment_status === 'paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-[#c8a94a]/20 text-[#1a2744]',
                        )}>
                          {player.payment_status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground text-xs">
                        {player.bye_rounds?.length > 0
                          ? player.bye_rounds.map((r) => `Rd ${r}`).join(', ')
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Generate pairings */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-[#c8a94a]" />
            <h2 className="text-lg font-bold text-[#1a2744]">Generate pairings (FIDE Dutch)</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Pair all registered players using the FIDE Dutch system. Requested byes are automatically applied.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="gen-round">Round</Label>
              <Input
                id="gen-round"
                type="number"
                min={1}
                value={generateForm.round}
                placeholder={String(maxRound + 1)}
                onChange={(e) => setGenerateForm((p) => ({ ...p, round: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gen-section">Section</Label>
              <select
                id="gen-section"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={generateForm.section}
                onChange={(e) => setGenerateForm((p) => ({ ...p, section: e.target.value }))}
              >
                {tournament.sections.map((s) => (
                  <option key={s.name} value={s.name}>{s.name}</option>
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

        {/* Manual pairing */}
        <details className="rounded-xl border bg-card p-6 shadow-sm">
          <summary className="cursor-pointer text-lg font-bold text-[#1a2744]">
            Manual pairing override
          </summary>
          <form onSubmit={handleAddPairing} className="mt-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label>Round</Label>
                <Input type="number" min={1} value={pairingForm.round}
                  onChange={(e) => setPairingForm((p) => ({ ...p, round: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label>Section</Label>
                <select className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={pairingForm.section}
                  onChange={(e) => setPairingForm((p) => ({ ...p, section: e.target.value }))}>
                  {tournament.sections.map((s) => (
                    <option key={s.name} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Board</Label>
                <Input type="number" min={1} value={pairingForm.board}
                  onChange={(e) => setPairingForm((p) => ({ ...p, board: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label>White (member ID)</Label>
                <Input value={pairingForm.whiteMemberId}
                  onChange={(e) => setPairingForm((p) => ({ ...p, whiteMemberId: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Black (member ID)</Label>
                <Input value={pairingForm.blackMemberId}
                  onChange={(e) => setPairingForm((p) => ({ ...p, blackMemberId: e.target.value }))} />
              </div>
            </div>
            <Button type="submit" variant="outline" className="mt-4" disabled={savingPairings}>
              {savingPairings ? 'Saving...' : 'Add manual pairing'}
            </Button>
          </form>
        </details>

        {/* Pairings & results */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-bold text-[#1a2744]">Pairings &amp; results</h2>
          {games.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No pairings yet.</p>
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
                      <td className="px-3 py-2">{game.white_name ?? game.white_member_id ?? '—'}</td>
                      <td className="px-3 py-2">{game.black_name ?? game.black_member_id ?? 'BYE'}</td>
                      <td className="px-3 py-2">
                        <select
                          className="rounded-md border bg-background px-2 py-1"
                          value={game.result}
                          onChange={(e) => handleResultChange(game.id, e.target.value)}
                        >
                          {RESULT_OPTIONS.map((r) => (
                            <option key={r} value={r}>{r}</option>
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

        {/* Standings */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-bold text-[#1a2744]">Standings</h2>
          {standings.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Standings appear once results are recorded.</p>
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
                      <td className="px-3 py-2 text-muted-foreground">{s.wins}-{s.draws}-{s.losses}</td>
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