// src/pages/TournamentManagePage.tsx
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle, ArrowLeft, Download, Eye, EyeOff, FileText, Mail, Plus,
  Sparkles, Trash2, Trophy, UserPlus,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { usePageTitle } from '@/hooks/usePageTitle'
import {
  adminAddWalkIn,
  adminAnnounce,
  adminCreatePairings,
  adminDeleteRoundPairings,
  adminDeleteTournament,
  adminGeneratePairings,
  adminGetRatingReport,
  adminGetTournamentManage,
  adminUpdateGameResult,
  adminUpdateTournament,
  getMe,
  lookupUscfRating,
  updateRegistration,
  updateTournamentRegistration,
  type ApiCustomDetail,
  type ApiManageRosterPlayer,
  type ApiRatingReport,
  type ApiRoundScheduleItem,
  type ApiStanding,
  type ApiTournamentDetail,
  type ApiTournamentGame,
  type ApiTournamentSection,
} from '@/lib/api'
import { cn } from '@/lib/utils'

const goldButtonClass = 'bg-lca-gold font-semibold text-lca-navy hover:bg-lca-gold/90'

const RESULT_OPTIONS = [
  { value: 'pending', label: 'pending' },
  { value: '1-0', label: '1-0' },
  { value: '0-1', label: '0-1' },
  { value: '1/2-1/2', label: '1/2-1/2' },
  { value: '1-0 F', label: '1-0 forfeit' },
  { value: '0-1 F', label: '0-1 forfeit' },
  { value: '0-0 F', label: '0-0 double forfeit' },
  { value: 'bye', label: 'Bye (1 pt)' },
  { value: 'bye-half', label: 'Bye (½ pt)' },
]

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

const VALID_TABS = ['details', 'registration', 'rounds', 'standings', 'email'] as const
type TabId = (typeof VALID_TABS)[number]

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'details', label: 'Details' },
  { id: 'registration', label: 'Registration' },
  { id: 'rounds', label: 'Rounds' },
  { id: 'standings', label: 'Standings' },
  { id: 'email', label: 'Email' },
]

/** Snapshot of the last-saved server state; every form field is compared
 *  against this to (a) mark tabs dirty and (b) build the minimal PATCH body. */
interface FormSnapshot {
  name: string
  date: string
  endDate: string
  location: string
  venue: string
  description: string
  maxPlayers: string
  isRated: boolean
  timeControl: string
  sections: string // JSON
  customDetails: string // JSON
  isVisible: boolean
  registrationStatus: string
  registrationClosesAt: string
  rounds: string
  roundSchedule: string // JSON
}

function normalizeSchedule(
  raw: ApiRoundScheduleItem[],
  n: number,
): ApiRoundScheduleItem[] {
  const count = Number.isFinite(n) && n >= 1 ? n : 1
  const next: ApiRoundScheduleItem[] = []
  for (let i = 1; i <= count; i++) {
    const existing = raw.find((r) => r.round === i)
    next.push(existing ?? { round: i, date: '', time: '' })
  }
  return next
}

function buildReportCsv(report: ApiRatingReport): string {
  const rounds = report.tournament.rounds
  const header = ['Section', 'Pairing#', 'Name', 'USCF ID', 'Pre-Rating', 'Total']
  for (let r = 1; r <= rounds; r++) {
    header.push(`Rd${r}`, `Rd${r} Opp`, `Rd${r} Color`)
  }
  const esc = (v: string | number | null) => {
    const s = v == null ? '' : String(v)
    return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [header.join(',')]
  for (const section of report.sections) {
    for (const p of section.players) {
      const row = [
        esc(section.name), p.pairingNum, esc(p.name), esc(p.uscfId),
        p.preRating ?? '', p.score,
      ]
      for (let r = 1; r <= rounds; r++) {
        const entry = p.rounds.find((x) => x.round === r)
        row.push(entry?.code ?? 'U', entry?.opponentPairingNum ?? '', entry?.color ?? '')
      }
      lines.push(row.join(','))
    }
  }
  return lines.join('\n')
}

export function TournamentManagePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [tournament, setTournament] = useState<ApiTournamentDetail | null>(null)
  const [roster, setRoster] = useState<ApiManageRosterPlayer[]>([])
  const [games, setGames] = useState<ApiTournamentGame[]>([])
  const [standings, setStandings] = useState<ApiStanding[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [savingPairings, setSavingPairings] = useState(false)

  // Role — danger zone is lca_admin only.
  // NOTE: sourced via getMe() to avoid depending on an auth context this file
  // can't see; if the app has a useAuth() hook exposing member.role, swap it in.
  const [myRole, setMyRole] = useState<string | null>(null)

  // ── Details tab form state ──
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [location, setLocation] = useState('')
  const [venue, setVenue] = useState('')
  const [description, setDescription] = useState('')
  const [maxPlayers, setMaxPlayers] = useState('')
  const [isRated, setIsRated] = useState(true)
  const [timeControl, setTimeControl] = useState('')
  const [customTimeControl, setCustomTimeControl] = useState('')
  const [sections, setSections] = useState<ApiTournamentSection[]>([])
  const [customPreset, setCustomPreset] = useState('')
  const [customDetails, setCustomDetails] = useState<ApiCustomDetail[]>([])

  // ── Registration tab form state ──
  const [isVisible, setIsVisible] = useState(true)
  const [registrationStatus, setRegistrationStatus] = useState('draft')
  const [registrationClosesAt, setRegistrationClosesAt] = useState('')

  // ── Rounds tab form state ──
  const [rounds, setRounds] = useState('5')
  const [roundSchedule, setRoundSchedule] = useState<ApiRoundScheduleItem[]>([])
  const [autoFillGap, setAutoFillGap] = useState(120)

  // State, not a ref: the dirty-state markers below are derived from this
  // during render, so React has to know when it changes. As a ref, saving a
  // tab left its "unsaved" dot showing until some unrelated state happened
  // to trigger the next render.
  const [snapshot, setSnapshot] = useState<FormSnapshot | null>(null)
  const appliedDefaultTab = useRef(false)

  const [generateForm, setGenerateForm] = useState({ round: '1', section: 'Open' })
  const [pairingForm, setPairingForm] = useState({
    round: '1', section: 'Open', whiteMemberId: '', blackMemberId: '', board: '1',
  })

  // Roster editing
  const [rosterSaving, setRosterSaving] = useState<string | null>(null)

  // Check-in filter for pairing generation (defaults on when any check-ins exist,
  // until the TD touches it)
  const [onlyCheckedIn, setOnlyCheckedIn] = useState(false)
  const onlyCheckedInTouched = useRef(false)

  // Walk-in form
  const [walkIn, setWalkIn] = useState({ fullName: '', uscfId: '', uscfRating: '', section: '' })
  const [walkInSaving, setWalkInSaving] = useState(false)
  const [walkInLookingUp, setWalkInLookingUp] = useState(false)
  const [walkInMarkPaid, setWalkInMarkPaid] = useState(true)

  // Delete-round control
  const [deleteSection, setDeleteSection] = useState('')
  const [deletingRound, setDeletingRound] = useState(false)

  // Announce
  const [announce, setAnnounce] = useState({ subject: '', body: '' })
  const [announceSending, setAnnounceSending] = useState(false)
  const [announceResult, setAnnounceResult] = useState<string | null>(null)

  // Rating report
  const [report, setReport] = useState<ApiRatingReport | null>(null)
  const [reportLoading, setReportLoading] = useState(false)

  // Danger zone
  const [deleteConfirmName, setDeleteConfirmName] = useState('')
  const [deletingTournament, setDeletingTournament] = useState(false)

  usePageTitle(tournament ? `Manage ${tournament.name}` : 'Manage Tournament')

  type ManageData = Awaited<ReturnType<typeof adminGetTournamentManage>>

  /**
   * Everything a fetch result puts on screen, split out from the fetch
   * itself. The mount effect can then apply it from a promise callback —
   * a mount effect must not call something that sets state synchronously —
   * while the nine mutation handlers below still get one loadManage() to
   * await after they change something.
   */
  function applyManage(data: ManageData) {
    const t = data.tournament
    setTournament(t)
    setRoster(data.roster ?? [])
    setGames(data.games)
    setStandings(data.standings)

    // Normalize once so form state, the rounds→schedule sync effect, and the
    // snapshot all agree — no false "unsaved changes" straight after load.
    const nName = t.name ?? ''
    const nDate = (t.date ?? '').slice(0, 10)
    const nEndDate = (t.end_date ?? '').slice(0, 10)
    const nLocation = t.location ?? ''
    const nVenue = t.venue ?? ''
    const nDescription = t.description ?? ''
    const nMaxPlayers = t.max_players != null ? String(t.max_players) : ''
    const nIsRated = t.is_rated !== 0
    const nTimeControl = t.time_control ?? ''
    const nSections = t.sections ?? []
    const nCustomDetails = t.custom_details ?? []
    const nIsVisible = t.is_visible !== 0
    const nRegistrationStatus = t.registration_status ?? 'draft'
    const nRegistrationClosesAt = (t.registration_closes_at ?? '').slice(0, 16)
    const nRounds = String(t.rounds ?? 5)
    const nRoundSchedule = normalizeSchedule(t.round_schedule ?? [], Number(nRounds))

    setName(nName)
    setDate(nDate)
    setEndDate(nEndDate)
    setLocation(nLocation)
    setVenue(nVenue)
    setDescription(nDescription)
    setMaxPlayers(nMaxPlayers)
    setIsRated(nIsRated)
    setTimeControl(nTimeControl)
    setCustomTimeControl(
      nTimeControl && !TIME_CONTROL_PRESETS.includes(nTimeControl) ? nTimeControl : '',
    )
    setSections(nSections)
    setCustomDetails(nCustomDetails)
    setIsVisible(nIsVisible)
    setRegistrationStatus(nRegistrationStatus)
    setRegistrationClosesAt(nRegistrationClosesAt)
    setRounds(nRounds)
    setRoundSchedule(nRoundSchedule)

    setSnapshot({
      name: nName,
      date: nDate,
      endDate: nEndDate,
      location: nLocation,
      venue: nVenue,
      description: nDescription,
      maxPlayers: nMaxPlayers,
      isRated: nIsRated,
      timeControl: nTimeControl,
      sections: JSON.stringify(nSections),
      customDetails: JSON.stringify(nCustomDetails),
      isVisible: nIsVisible,
      registrationStatus: nRegistrationStatus,
      registrationClosesAt: nRegistrationClosesAt,
      rounds: nRounds,
      roundSchedule: JSON.stringify(nRoundSchedule),
    })

    const defaultSection = nSections[0]?.name ?? 'Open'
    setGenerateForm((p) => ({ ...p, section: defaultSection }))
    setPairingForm((p) => ({ ...p, section: defaultSection }))
    setWalkIn((p) => ({ ...p, section: p.section || defaultSection }))
    setDeleteSection((p) => p || defaultSection)
  }

  async function loadManage() {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      applyManage(await adminGetTournamentManage(id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tournament')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!id) return
    let cancelled = false
    adminGetTournamentManage(id)
      .then((data) => { if (!cancelled) applyManage(data) })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load tournament')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    getMe()
      .then((data) => setMyRole(data.member.role))
      .catch(() => setMyRole(null))
  }, [])

  // Default the check-in filter on when any check-ins exist — but never
  // override a choice the TD has made this session.
  useEffect(() => {
    if (!onlyCheckedInTouched.current) {
      setOnlyCheckedIn(roster.some((p) => p.checked_in_at && !p.withdrawn_at))
    }
  }, [roster])

  // Sync round schedule rows when the rounds count changes. Adjusting state
  // during render is React's own answer to resetting on a changed value, and
  // it keeps the times a user has already typed, which is why this cannot
  // just be computed fresh each render.
  const [lastRounds, setLastRounds] = useState(rounds)
  if (rounds !== lastRounds) {
    setLastRounds(rounds)
    const n = Number(rounds)
    if (n && n >= 1) setRoundSchedule((prev) => normalizeSchedule(prev, n))
  }

  // ── Tabs ──

  const tabParam = searchParams.get('tab')
  const activeTab: TabId = (VALID_TABS as readonly string[]).includes(tabParam ?? '')
    ? (tabParam as TabId)
    : 'details'

  // Default tab (only when no explicit ?tab= in URL), once, after first load:
  // games exist → rounds; else reg not draft → registration; else details.
  useEffect(() => {
    if (loading || !tournament || appliedDefaultTab.current) return
    appliedDefaultTab.current = true
    const param = searchParams.get('tab')
    if (param && (VALID_TABS as readonly string[]).includes(param)) return
    const def: TabId = games.length > 0
      ? 'rounds'
      : registrationStatus !== 'draft'
      ? 'registration'
      : 'details'
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('tab', def)
      return next
    }, { replace: true })
  }, [loading, tournament]) // eslint-disable-line react-hooks/exhaustive-deps

  const snap = snapshot
  const detailsDirty = !!snap && (
    name !== snap.name ||
    date !== snap.date ||
    endDate !== snap.endDate ||
    location !== snap.location ||
    venue !== snap.venue ||
    description !== snap.description ||
    maxPlayers !== snap.maxPlayers ||
    isRated !== snap.isRated ||
    timeControl !== snap.timeControl ||
    JSON.stringify(sections) !== snap.sections ||
    JSON.stringify(customDetails) !== snap.customDetails
  )
  const registrationDirty = !!snap && (
    isVisible !== snap.isVisible ||
    registrationStatus !== snap.registrationStatus ||
    registrationClosesAt !== snap.registrationClosesAt
  )
  const scheduleDirty = !!snap && (
    rounds !== snap.rounds ||
    JSON.stringify(roundSchedule) !== snap.roundSchedule
  )
  const dirtyByTab: Partial<Record<TabId, boolean>> = {
    details: detailsDirty,
    registration: registrationDirty,
    rounds: scheduleDirty,
  }

  function resetFormsFromSnapshot() {
    const s = snapshot
    if (!s) return
    setName(s.name)
    setDate(s.date)
    setEndDate(s.endDate)
    setLocation(s.location)
    setVenue(s.venue)
    setDescription(s.description)
    setMaxPlayers(s.maxPlayers)
    setIsRated(s.isRated)
    setTimeControl(s.timeControl)
    setCustomTimeControl(
      s.timeControl && !TIME_CONTROL_PRESETS.includes(s.timeControl) ? s.timeControl : '',
    )
    setSections(JSON.parse(s.sections) as ApiTournamentSection[])
    setCustomDetails(JSON.parse(s.customDetails) as ApiCustomDetail[])
    setIsVisible(s.isVisible)
    setRegistrationStatus(s.registrationStatus)
    setRegistrationClosesAt(s.registrationClosesAt)
    setRounds(s.rounds)
    setRoundSchedule(JSON.parse(s.roundSchedule) as ApiRoundScheduleItem[])
  }

  function selectTab(next: TabId) {
    if (next === activeTab) return
    const anyDirty = detailsDirty || registrationDirty || scheduleDirty
    if (anyDirty) {
      if (!window.confirm('You have unsaved changes. Discard them and switch tabs?')) return
      resetFormsFromSnapshot()
    }
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev)
      p.set('tab', next)
      return p
    }, { replace: true })
  }

  // ── Save handlers (dirty-diff: only changed keys go on the wire) ──

  async function handleSaveDetails() {
    const s = snapshot
    if (!id || !s) return
    if (!name.trim() || !date || !location.trim()) {
      setError('Name, start date, and location are required.')
      return
    }
    const body: Parameters<typeof adminUpdateTournament>[1] = {}
    if (name !== s.name) body.name = name.trim()
    if (date !== s.date) body.date = date
    if (endDate !== s.endDate) body.endDate = endDate || null
    if (location !== s.location) body.location = location.trim()
    if (venue !== s.venue) body.venue = venue.trim() || null
    if (description !== s.description) body.description = description.trim() || null
    if (maxPlayers !== s.maxPlayers) body.maxPlayers = maxPlayers ? Number(maxPlayers) : null
    if (isRated !== s.isRated) body.isRated = isRated
    if (timeControl !== s.timeControl) body.timeControl = timeControl || null
    if (JSON.stringify(sections) !== s.sections) body.sections = sections
    if (JSON.stringify(customDetails) !== s.customDetails) body.customDetails = customDetails
    if (Object.keys(body).length === 0) return

    setSaving(true)
    setError(null)
    try {
      await adminUpdateTournament(id, body)
      await loadManage()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save details')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveRegistrationSettings() {
    const s = snapshot
    if (!id || !s) return
    const body: Parameters<typeof adminUpdateTournament>[1] = {}
    if (isVisible !== s.isVisible) body.isVisible = isVisible
    if (registrationClosesAt !== s.registrationClosesAt) {
      body.registrationClosesAt = registrationClosesAt || null
    }
    const statusChanged = registrationStatus !== s.registrationStatus
    if (Object.keys(body).length === 0 && !statusChanged) return

    setSaving(true)
    setError(null)
    try {
      if (Object.keys(body).length > 0) {
        await adminUpdateTournament(id, body)
      }
      if (statusChanged) {
        // registration_status lives on its own endpoint — never fold into the main PATCH
        await updateTournamentRegistration(id, {
          registration_status: registrationStatus as 'draft' | 'open' | 'closed',
        })
      }
      await loadManage()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save registration settings')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveSchedule() {
    const s = snapshot
    if (!id || !s) return
    const body: Parameters<typeof adminUpdateTournament>[1] = {}
    if (rounds !== s.rounds) body.rounds = Number(rounds)
    if (JSON.stringify(roundSchedule) !== s.roundSchedule) body.roundSchedule = roundSchedule
    if (Object.keys(body).length === 0) return

    setSaving(true)
    setError(null)
    try {
      await adminUpdateTournament(id, body)
      await loadManage()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save schedule')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteTournament() {
    if (!id || !tournament) return
    if (deleteConfirmName.trim() !== tournament.name) return
    if (!window.confirm(
      `Permanently delete "${tournament.name}"? All registrations, pairings, and results will be removed. This cannot be undone.`,
    )) return
    setDeletingTournament(true)
    setError(null)
    try {
      await adminDeleteTournament(id)
      navigate('/admin/tournaments')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete tournament')
      setDeletingTournament(false)
    }
  }

  // ── Everything below is moved, not rewritten ──

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

  function addSectionPreset(presetName: string) {
    if (sections.some((s) => s.name === presetName)) return
    setSections((prev) => [...prev, { name: presetName, entryFee: 0 }])
  }

  function addCustomSection() {
    const sectionName = customPreset.trim()
    if (!sectionName || sections.some((s) => s.name === sectionName)) return
    setSections((prev) => [...prev, { name: sectionName, entryFee: 0 }])
    setCustomPreset('')
  }

  function removeSection(sectionName: string) {
    setSections((prev) => prev.filter((s) => s.name !== sectionName))
  }

  function updateSectionFee(sectionName: string, fee: string) {
    setSections((prev) =>
      prev.map((s) => s.name === sectionName ? { ...s, entryFee: Number(fee) } : s),
    )
  }

  function updateSectionPrize(sectionName: string, prizeFund: string) {
    setSections((prev) =>
      prev.map((s) => s.name === sectionName ? { ...s, prizeFund } : s),
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
        onlyCheckedIn,
      })
      await loadManage()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate pairings')
    } finally {
      setGenerating(false)
    }
  }

  async function handleDeleteLastRound() {
    if (!id || !deleteSection) return
    const sectionRounds = games.filter((g) => g.section === deleteSection).map((g) => g.round)
    if (sectionRounds.length === 0) return
    const lastRound = Math.max(...sectionRounds)
    if (!window.confirm(
      `Delete all round ${lastRound} pairings and results in ${deleteSection}? This cannot be undone.`,
    )) return
    setDeletingRound(true)
    setError(null)
    try {
      await adminDeleteRoundPairings(id, lastRound, deleteSection)
      await loadManage()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete round')
    } finally {
      setDeletingRound(false)
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

  async function handleRosterUpdate(
    player: ApiManageRosterPlayer,
    patch: {
      section?: string
      paymentStatus?: 'paid' | 'pending' | 'refunded'
      byeRounds?: number[]
      withdrawn?: boolean
      checkedIn?: boolean
    },
  ) {
    setRosterSaving(player.registration_id)
    setError(null)
    try {
      const result = await updateRegistration(player.registration_id, patch)
      if (result.feeNote) setError(result.feeNote) // surfaced as a warning, not a failure
      await loadManage()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update registration')
    } finally {
      setRosterSaving(null)
    }
  }

  async function handleWalkInLookup() {
    if (!walkIn.uscfId.trim()) return
    setWalkInLookingUp(true)
    try {
      const r = await lookupUscfRating(walkIn.uscfId.trim())
      setWalkIn((p) => ({
        ...p,
        uscfRating: r.rating != null ? String(r.rating) : p.uscfRating,
        fullName: p.fullName || (r.name ?? ''),
      }))
    } catch { /* lookup is best-effort */ } finally {
      setWalkInLookingUp(false)
    }
  }

  async function handleAddWalkIn(event: FormEvent) {
    event.preventDefault()
    if (!id || !walkIn.fullName.trim() || !walkIn.section) return
    setWalkInSaving(true)
    setError(null)
    try {
      await adminAddWalkIn(id, {
        fullName: walkIn.fullName.trim(),
        uscfId: walkIn.uscfId.trim() || null,
        uscfRating: walkIn.uscfRating ? Number(walkIn.uscfRating) : null,
        section: walkIn.section,
        markPaid: walkInMarkPaid,
      })
      setWalkIn({ fullName: '', uscfId: '', uscfRating: '', section: walkIn.section })
      await loadManage()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add walk-in')
    } finally {
      setWalkInSaving(false)
    }
  }

  async function handleSendAnnouncement() {
    if (!id || !announce.subject.trim() || !announce.body.trim()) return
    const activeCount = roster.filter(
      (p) => !p.withdrawn_at && !p.member_id.startsWith('guest-'),
    ).length
    if (!window.confirm(`Send this email to ${activeCount} active entrants?`)) return
    setAnnounceSending(true)
    setAnnounceResult(null)
    setError(null)
    try {
      const result = await adminAnnounce(id, {
        subject: announce.subject.trim(),
        body: announce.body.trim(),
      })
      setAnnounceResult(
        result.failed > 0
          ? `Sent ${result.sent} of ${result.total} — ${result.failed} failed`
          : `Sent to all ${result.sent} entrants`,
      )
      if (result.failed === 0) setAnnounce({ subject: '', body: '' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send announcement')
    } finally {
      setAnnounceSending(false)
    }
  }

  async function handleLoadReport() {
    if (!id) return
    setReportLoading(true)
    setError(null)
    try {
      const data = await adminGetRatingReport(id)
      setReport(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rating report')
    } finally {
      setReportLoading(false)
    }
  }

  function handleDownloadCsv() {
    if (!report) return
    const csv = buildReportCsv(report)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${report.tournament.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-rating-report.csv`
    a.click()
    URL.revokeObjectURL(url)
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
          <Link to="/admin/tournaments">Back to tournaments</Link>
        </Button>
      </div>
    )
  }

  const activeRoster = roster.filter((p) => !p.withdrawn_at)
  const checkedInCount = roster.filter((p) => p.checked_in_at && !p.withdrawn_at).length
  const roundsCount = Number(rounds) || tournament.rounds
  const roundsPaired = games.length > 0 ? Math.max(...games.map((g) => g.round)) : 0
  const sectionsInGames = [...new Set(games.map((g) => g.section))]
  const deleteSectionRounds = games
    .filter((g) => g.section === deleteSection)
    .map((g) => g.round)
  const deleteLastRound = deleteSectionRounds.length > 0
    ? Math.max(...deleteSectionRounds)
    : null

  return (
    <div>
      {/* Hero */}
      <section className="border-b-4 border-lca-gold bg-lca-navy text-white">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <Link to="/admin/tournaments" className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-lca-gold">
            <ArrowLeft className="size-4" />All Tournaments
          </Link>
          <div className="mt-4 flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <Trophy className="size-8 text-lca-gold" />
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
            {/* Stat strip */}
            <div className="flex gap-6 text-sm">
              <div>
                <p className="text-2xl font-bold text-lca-gold">{activeRoster.length}</p>
                <p className="text-white/60">registered</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-lca-gold">{checkedInCount}</p>
                <p className="text-white/60">checked in</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-lca-gold">{roundsPaired}<span className="text-base font-normal text-white/60">/{roundsCount}</span></p>
                <p className="text-white/60">rounds paired</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tab bar */}
      <div className="border-b bg-white sticky top-0 z-10">
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-6">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => selectTab(t.id)}
              className={cn(
                'relative whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                activeTab === t.id
                  ? 'border-lca-gold text-lca-navy font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-lca-navy',
              )}
            >
              {t.label}
              {dirtyByTab[t.id] && (
                <span
                  className="ml-1.5 inline-block size-1.5 rounded-full bg-lca-gold align-middle"
                  title="Unsaved changes"
                />
              )}
            </button>
          ))}
        </div>
      </div>

      <section className="mx-auto max-w-6xl space-y-8 px-6 py-12">
        {error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {/* ══════════ DETAILS ══════════ */}
        {activeTab === 'details' && (
          <>
            <div className="rounded-xl border bg-card p-6 shadow-sm space-y-8">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="text-lg font-bold text-lca-navy">Tournament details</h2>
                {detailsDirty && (
                  <span className="text-xs font-medium text-amber-600">Unsaved changes</span>
                )}
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="d-name">Tournament name</Label>
                  <Input id="d-name" value={name} required
                    onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="d-date">Start date</Label>
                  <Input id="d-date" type="date" value={date} required
                    onChange={(e) => setDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="d-end-date">End date (optional)</Label>
                  <Input id="d-end-date" type="date" value={endDate}
                    onChange={(e) => setEndDate(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Leave blank for one-day events.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="d-location">Location (city)</Label>
                  <Input id="d-location" value={location} required
                    onChange={(e) => setLocation(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="d-venue">Venue (optional)</Label>
                  <Input id="d-venue" value={venue} placeholder="e.g. Broadmoor Methodist Church"
                    onChange={(e) => setVenue(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="d-max">Max players (optional)</Label>
                  <Input id="d-max" type="number" min={2} value={maxPlayers} placeholder="No cap"
                    onChange={(e) => setMaxPlayers(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Rating type</Label>
                  <div className="flex gap-2">
                    <button type="button"
                      onClick={() => setIsRated(true)}
                      className={cn('flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                        isRated ? 'border-lca-navy bg-lca-navy text-white' : 'border-border text-muted-foreground')}
                    >USCF Rated</button>
                    <button type="button"
                      onClick={() => setIsRated(false)}
                      className={cn('flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                        !isRated ? 'border-lca-navy bg-lca-navy text-white' : 'border-border text-muted-foreground')}
                    >Unrated</button>
                  </div>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="d-description">Description</Label>
                  <textarea
                    id="d-description"
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[100px]"
                    value={description}
                    placeholder="Shown on the public tournament page."
                    onChange={(e) => setDescription(e.target.value)}
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
                          ? 'border-lca-navy bg-lca-navy text-white'
                          : 'border-border text-muted-foreground hover:border-lca-gold hover:text-lca-navy',
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

              {/* Sections */}
              <div className="space-y-3">
                <Label>Sections</Label>
                <div className="flex flex-wrap gap-2">
                  {SECTION_PRESETS.map((presetName) => (
                    <button
                      key={presetName}
                      type="button"
                      onClick={() => addSectionPreset(presetName)}
                      disabled={sections.some((s) => s.name === presetName)}
                      className={cn(
                        'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                        sections.some((s) => s.name === presetName)
                          ? 'border-lca-navy bg-lca-navy text-white cursor-default'
                          : 'border-border text-muted-foreground hover:border-lca-gold hover:text-lca-navy',
                      )}
                    >
                      {presetName}
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

              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  className={goldButtonClass}
                  disabled={saving || !detailsDirty}
                  onClick={handleSaveDetails}
                >
                  {saving ? 'Saving…' : 'Save details'}
                </Button>
                {detailsDirty && !saving && (
                  <Button type="button" variant="outline" onClick={resetFormsFromSnapshot}>
                    Discard changes
                  </Button>
                )}
              </div>
            </div>

            {/* Danger zone — lca_admin only; backend DELETE is requireAdmin regardless */}
            {myRole === 'lca_admin' && (
              <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-5 text-destructive" />
                  <h2 className="text-lg font-bold text-destructive">Danger zone</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  Deleting this tournament permanently removes all registrations, pairings,
                  results, and director assignments. This cannot be undone. Stripe payments
                  are not refunded automatically.
                </p>
                <div className="space-y-2 max-w-md">
                  <Label htmlFor="delete-confirm">
                    Type <span className="font-semibold text-foreground">{tournament.name}</span> to confirm
                  </Label>
                  <Input
                    id="delete-confirm"
                    value={deleteConfirmName}
                    placeholder={tournament.name}
                    onChange={(e) => setDeleteConfirmName(e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={deletingTournament || deleteConfirmName.trim() !== tournament.name}
                  onClick={handleDeleteTournament}
                >
                  <Trash2 className="mr-1 size-4" />
                  {deletingTournament ? 'Deleting…' : 'Delete tournament'}
                </Button>
              </div>
            )}
          </>
        )}

        {/* ══════════ REGISTRATION ══════════ */}
        {activeTab === 'registration' && (
          <>
            <div className="rounded-xl border bg-card p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="text-lg font-bold text-lca-navy">Visibility &amp; registration</h2>
                {registrationDirty && (
                  <span className="text-xs font-medium text-amber-600">Unsaved changes</span>
                )}
              </div>
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Visibility</Label>
                  <div className="flex gap-2">
                    <button type="button"
                      onClick={() => setIsVisible(true)}
                      className={cn('flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                        isVisible ? 'border-lca-navy bg-lca-navy text-white' : 'border-border text-muted-foreground hover:border-lca-navy/40')}
                    >Visible to public</button>
                    <button type="button"
                      onClick={() => setIsVisible(false)}
                      className={cn('flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                        !isVisible ? 'border-lca-navy bg-lca-navy text-white' : 'border-border text-muted-foreground hover:border-lca-navy/40')}
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
                  <Label htmlFor="reg-closes">Auto-close registration at</Label>
                  <Input
                    id="reg-closes"
                    type="datetime-local"
                    value={registrationClosesAt}
                    onChange={(e) => setRegistrationClosesAt(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Registration will automatically close at this time.</p>
                </div>
              </div>
              <Button
                type="button"
                className={goldButtonClass}
                disabled={saving || !registrationDirty}
                onClick={handleSaveRegistrationSettings}
              >
                {saving ? 'Saving…' : 'Save registration settings'}
              </Button>
            </div>

            {/* Roster: check-in, editing, withdrawal */}
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <h2 className="text-lg font-bold text-lca-navy">
                Registered players ({activeRoster.length})
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  · {checkedInCount} checked in
                </span>
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Withdrawing removes a player from future pairings. Played games stand. Refunds are
                handled manually in the Stripe dashboard — nothing is refunded automatically.
              </p>
              {roster.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">No players registered yet.</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[840px] text-left text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-3 py-2 font-semibold">Check-in</th>
                        <th className="px-3 py-2 font-semibold">Name</th>
                        <th className="px-3 py-2 font-semibold">USCF ID</th>
                        <th className="px-3 py-2 font-semibold">Rating</th>
                        <th className="px-3 py-2 font-semibold">Section</th>
                        <th className="px-3 py-2 font-semibold">Payment</th>
                        <th className="px-3 py-2 font-semibold">Bye rounds</th>
                        <th className="px-3 py-2 font-semibold"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {roster.map((player) => {
                        const busy = rosterSaving === player.registration_id
                        const withdrawn = !!player.withdrawn_at
                        return (
                          <tr key={player.registration_id} className={cn('border-b', withdrawn && 'opacity-50')}>
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                disabled={busy || withdrawn}
                                onClick={() => handleRosterUpdate(player, { checkedIn: !player.checked_in_at })}
                                className={cn(
                                  'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                                  player.checked_in_at
                                    ? 'border-emerald-600 bg-emerald-600 text-white'
                                    : 'border-border text-muted-foreground hover:border-emerald-600/50',
                                  withdrawn && 'opacity-40 cursor-not-allowed',
                                )}
                              >
                                {player.checked_in_at ? '✓ Present' : 'Check in'}
                              </button>
                            </td>
                            <td className="px-3 py-2 font-medium">
                              {player.full_name}
                              {withdrawn && (
                                <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
                                  Withdrawn
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground font-mono text-xs">
                              {player.uscf_id ?? '—'}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {player.uscf_rating ?? '—'}
                            </td>
                            <td className="px-3 py-2">
                              <select
                                className="rounded-md border bg-background px-2 py-1 text-sm"
                                value={player.section}
                                disabled={busy || withdrawn}
                                onChange={(e) => handleRosterUpdate(player, { section: e.target.value })}
                              >
                                {sections.map((s) => (
                                  <option key={s.name} value={s.name}>{s.name}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <select
                                className={cn(
                                  'rounded-md border px-2 py-1 text-xs font-medium',
                                  player.payment_status === 'paid'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-lca-gold/20 text-lca-navy',
                                )}
                                value={player.payment_status}
                                disabled={busy || withdrawn}
                                onChange={(e) =>
                                  handleRosterUpdate(player, {
                                    paymentStatus: e.target.value as 'paid' | 'pending' | 'refunded',
                                  })
                                }
                              >
                                <option value="pending">pending</option>
                                <option value="paid">paid</option>
                                <option value="refunded">refunded</option>
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex flex-wrap gap-1">
                                {Array.from({ length: roundsCount }, (_, i) => i + 1).map((round) => {
                                  const isSel = (player.bye_rounds ?? []).includes(round)
                                  return (
                                    <button
                                      key={round}
                                      type="button"
                                      disabled={busy || withdrawn}
                                      title={`Round ${round} bye`}
                                      onClick={() => {
                                        const current = player.bye_rounds ?? []
                                        const next = isSel
                                          ? current.filter((r) => r !== round)
                                          : [...current, round].sort((a, b) => a - b)
                                        handleRosterUpdate(player, { byeRounds: next })
                                      }}
                                      className={cn(
                                        'size-6 rounded-full border text-[11px] font-medium transition-colors',
                                        isSel
                                          ? 'border-lca-navy bg-lca-navy text-white'
                                          : 'border-border text-muted-foreground hover:border-lca-navy/40',
                                      )}
                                    >
                                      {round}
                                    </button>
                                  )
                                })}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={busy}
                                onClick={() => handleRosterUpdate(player, { withdrawn: !withdrawn })}
                              >
                                {withdrawn ? 'Reinstate' : 'Withdraw'}
                              </Button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Add walk-in */}
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <div className="flex items-center gap-2">
                <UserPlus className="size-5 text-lca-gold" />
                <h2 className="text-lg font-bold text-lca-navy">Add walk-in player</h2>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Registers a player without a site account. Collect payment at the door.
              </p>
              <form onSubmit={handleAddWalkIn} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <div className="space-y-2 lg:col-span-1">
                  <Label htmlFor="wi-uscf">USCF ID {isRated ? '' : '(optional)'}</Label>
                  <div className="flex gap-1.5">
                    <Input id="wi-uscf" value={walkIn.uscfId}
                      onChange={(e) => setWalkIn((p) => ({ ...p, uscfId: e.target.value }))}
                      required={isRated} />
                    <Button type="button" variant="outline" size="sm" className="shrink-0"
                      onClick={handleWalkInLookup}
                      disabled={walkInLookingUp || !walkIn.uscfId.trim()}>
                      {walkInLookingUp ? '…' : 'Look up'}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wi-name">Full name</Label>
                  <Input id="wi-name" value={walkIn.fullName}
                    onChange={(e) => setWalkIn((p) => ({ ...p, fullName: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wi-rating">Rating</Label>
                  <Input id="wi-rating" type="number" value={walkIn.uscfRating}
                    onChange={(e) => setWalkIn((p) => ({ ...p, uscfRating: e.target.value }))}
                    placeholder="unrated" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wi-section">Section</Label>
                  <select id="wi-section" required
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={walkIn.section}
                    onChange={(e) => setWalkIn((p) => ({ ...p, section: e.target.value }))}>
                    <option value="">Select…</option>
                    {sections.map((s) => (
                      <option key={s.name} value={s.name}>
                        {s.name}{(s.entryFee ?? 0) > 0 ? ` — $${s.entryFee}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Payment</Label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setWalkInMarkPaid(true)}
                      className={cn('flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                        walkInMarkPaid ? 'border-lca-navy bg-lca-navy text-white' : 'border-border text-muted-foreground')}>
                      Paid (cash/check)
                    </button>
                    <button type="button" onClick={() => setWalkInMarkPaid(false)}
                      className={cn('flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                        !walkInMarkPaid ? 'border-lca-navy bg-lca-navy text-white' : 'border-border text-muted-foreground')}>
                      Pending
                    </button>
                  </div>
                </div>
                <div className="sm:col-span-2 lg:col-span-5">
                  <Button type="submit" className={goldButtonClass} disabled={walkInSaving}>
                    {walkInSaving ? 'Adding…' : 'Add walk-in'}
                  </Button>
                </div>
              </form>
            </div>
          </>
        )}

        {/* ══════════ ROUNDS ══════════ */}
        {activeTab === 'rounds' && (
          <>
            {/* Rounds count + schedule */}
            <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="text-lg font-bold text-lca-navy">Rounds &amp; schedule</h2>
                {scheduleDirty && (
                  <span className="text-xs font-medium text-amber-600">Unsaved changes</span>
                )}
              </div>
              <div className="space-y-2 max-w-xs">
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
              <p className="text-xs text-muted-foreground">
                Set round 1 date and time, then use auto-fill to populate the rest. You can adjust any round individually after.
              </p>

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
                    <span className="text-sm font-medium text-lca-navy">Round {rs.round}</span>
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

              <Button
                type="button"
                className={goldButtonClass}
                disabled={saving || !scheduleDirty}
                onClick={handleSaveSchedule}
              >
                {saving ? 'Saving…' : 'Save schedule'}
              </Button>
            </div>

            {/* Generate pairings */}
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <div className="flex items-center gap-2">
                <Sparkles className="size-5 text-lca-gold" />
                <h2 className="text-lg font-bold text-lca-navy">Generate pairings (FIDE Dutch)</h2>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Pair players using the FIDE Dutch system. Requested byes are applied as
                half-point bye rows.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="gen-round">Round</Label>
                  <Input
                    id="gen-round"
                    type="number"
                    min={1}
                    value={generateForm.round}
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
                    {sections.map((s) => (
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
                <label className="flex items-center gap-2 text-sm text-muted-foreground sm:col-span-3">
                  <input
                    type="checkbox"
                    checked={onlyCheckedIn}
                    onChange={(e) => {
                      onlyCheckedInTouched.current = true
                      setOnlyCheckedIn(e.target.checked)
                    }}
                  />
                  Only pair checked-in players
                  {onlyCheckedIn && (
                    <span className="text-xs">
                      ({roster.filter((p) => p.checked_in_at && !p.withdrawn_at && p.section === generateForm.section).length} in {generateForm.section})
                    </span>
                  )}
                </label>
              </div>
            </div>

            {/* Manual pairing */}
            <details className="rounded-xl border bg-card p-6 shadow-sm">
              <summary className="cursor-pointer text-lg font-bold text-lca-navy">
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
                      {sections.map((s) => (
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
                    <Label>White</Label>
                    <select className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={pairingForm.whiteMemberId}
                      onChange={(e) => setPairingForm((p) => ({ ...p, whiteMemberId: e.target.value }))}>
                      <option value="">Select player…</option>
                      {roster
                        .filter((p) => !p.withdrawn_at && p.section === pairingForm.section)
                        .map((p) => (
                          <option key={p.member_id} value={p.member_id}>
                            {p.full_name}{p.uscf_rating != null ? ` (${p.uscf_rating})` : ''}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Black (empty = bye)</Label>
                    <select className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={pairingForm.blackMemberId}
                      onChange={(e) => setPairingForm((p) => ({ ...p, blackMemberId: e.target.value }))}>
                      <option value="">— Bye —</option>
                      {roster
                        .filter((p) => !p.withdrawn_at && p.section === pairingForm.section)
                        .map((p) => (
                          <option key={p.member_id} value={p.member_id}>
                            {p.full_name}{p.uscf_rating != null ? ` (${p.uscf_rating})` : ''}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
                <Button type="submit" variant="outline" className="mt-4" disabled={savingPairings}>
                  {savingPairings ? 'Saving...' : 'Add manual pairing'}
                </Button>
              </form>
            </details>

            {/* Pairings & results */}
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-lca-navy">Pairings &amp; results</h2>
                {sectionsInGames.length > 0 && (
                  <div className="flex items-center gap-2">
                    <select
                      className="rounded-md border bg-background px-2 py-1 text-sm"
                      value={deleteSection}
                      onChange={(e) => setDeleteSection(e.target.value)}
                    >
                      {sectionsInGames.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={deletingRound || deleteLastRound == null}
                      onClick={handleDeleteLastRound}
                    >
                      <Trash2 className="mr-1 size-3.5" />
                      {deleteLastRound != null
                        ? `Delete Rd ${deleteLastRound} pairings`
                        : 'No rounds'}
                    </Button>
                  </div>
                )}
              </div>
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
                                <option key={r.value} value={r.value}>{r.label}</option>
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
          </>
        )}

        {/* ══════════ STANDINGS ══════════ */}
        {activeTab === 'standings' && (
          <>
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <h2 className="text-lg font-bold text-lca-navy">Standings</h2>
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
                          <td className="px-3 py-2">{s.score % 1 === 0 ? s.score : s.score.toFixed(1)}</td>
                          <td className="px-3 py-2 text-muted-foreground">{s.wins}-{s.draws}-{s.losses}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* USCF rating report */}
            {isRated && (
              <div className="rounded-xl border bg-card p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <FileText className="size-5 text-lca-gold" />
                    <h2 className="text-lg font-bold text-lca-navy">USCF rating report</h2>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" disabled={reportLoading} onClick={handleLoadReport}>
                      {reportLoading ? 'Loading…' : report ? 'Refresh report' : 'View report'}
                    </Button>
                    {report && (
                      <Button type="button" variant="outline" size="sm" onClick={handleDownloadCsv}>
                        <Download className="mr-1 size-3.5" />Download CSV
                      </Button>
                    )}
                  </div>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Submit at uschess.org → your affiliate dashboard → Tournament Rating Reports →
                  New Event → Start Blank, and key in each section below. Only affiliate-authorized
                  certified TDs can submit.
                </p>

                {report && (
                  <div className="mt-4 space-y-6">
                    {report.validationErrors.length > 0 && (
                      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                        <p className="font-semibold">Fix these before submitting to US Chess:</p>
                        <ul className="mt-1 list-disc pl-5">
                          {report.validationErrors.map((e, i) => <li key={i}>{e}</li>)}
                        </ul>
                      </div>
                    )}
                    {report.sections.map((section) => (
                      <div key={section.name}>
                        <h3 className="mb-2 text-base font-semibold text-lca-navy">{section.name}</h3>
                        <div className="overflow-x-auto rounded-lg border">
                          <table className="w-full text-left text-sm">
                            <thead>
                              <tr className="border-b bg-muted/50">
                                <th className="px-3 py-2">#</th>
                                <th className="px-3 py-2">Name</th>
                                <th className="px-3 py-2">USCF ID</th>
                                <th className="px-3 py-2">Rating</th>
                                <th className="px-3 py-2">Total</th>
                                {Array.from({ length: report.tournament.rounds }, (_, i) => i + 1).map((r) => (
                                  <th key={r} className="px-3 py-2">Rd {r}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {section.players.map((p) => (
                                <tr key={p.pairingNum} className="border-b last:border-0">
                                  <td className="px-3 py-2 font-medium">{p.pairingNum}</td>
                                  <td className="px-3 py-2">{p.name}</td>
                                  <td className={cn('px-3 py-2 font-mono text-xs', !p.uscfId && 'text-destructive font-semibold')}>
                                    {p.uscfId ?? 'MISSING'}
                                  </td>
                                  <td className="px-3 py-2 text-muted-foreground">{p.preRating ?? 'unr.'}</td>
                                  <td className="px-3 py-2 font-semibold">
                                    {p.score % 1 === 0 ? p.score : p.score.toFixed(1)}
                                  </td>
                                  {Array.from({ length: report.tournament.rounds }, (_, i) => i + 1).map((r) => {
                                    const entry = p.rounds.find((x) => x.round === r)
                                    return (
                                      <td key={r} className="px-3 py-2 font-mono text-xs">
                                        {entry
                                          ? `${entry.code}${entry.opponentPairingNum ?? ''}${entry.color ? `/${entry.color}` : ''}`
                                          : 'U'}
                                      </td>
                                    )
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ══════════ EMAIL ══════════ */}
        {activeTab === 'email' && (
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <Mail className="size-5 text-lca-gold" />
              <h2 className="text-lg font-bold text-lca-navy">Email all entrants</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Will send to {roster.filter((p) => !p.withdrawn_at && !p.member_id.startsWith('guest-')).length} active
              entrants. Walk-ins and withdrawn players are not emailed.
            </p>
            <div className="mt-4 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="announce-subject">Subject</Label>
                <Input
                  id="announce-subject"
                  value={announce.subject}
                  placeholder="e.g. Round 3 moved to 3:00 PM"
                  onChange={(e) => setAnnounce((p) => ({ ...p, subject: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="announce-body">Message</Label>
                <textarea
                  id="announce-body"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[120px]"
                  value={announce.body}
                  onChange={(e) => setAnnounce((p) => ({ ...p, body: e.target.value }))}
                />
              </div>
              {announceResult && (
                <p className="text-sm font-medium text-emerald-700">{announceResult}</p>
              )}
              <Button
                type="button"
                className={goldButtonClass}
                disabled={announceSending || !announce.subject.trim() || !announce.body.trim()}
                onClick={handleSendAnnouncement}
              >
                {announceSending ? 'Sending…' : 'Send announcement'}
              </Button>
            </div>
          </div>
        )}

        <Button asChild variant="outline">
          <Link to={`/tournaments/${id}`}>View public tournament page</Link>
        </Button>
      </section>
    </div>
  )
}