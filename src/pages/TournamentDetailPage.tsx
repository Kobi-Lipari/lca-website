// src/pages/TournamentDetailPage.tsx
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Bell, BellOff, Calendar, CheckCircle2,
  Clock, MapPin, Trophy, Users, X, ChevronRight,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/auth-context'
import {
  createRegistration,
  getTournament,
  optInTournamentReminder,
  optOutTournamentReminder,
  getTournamentReminderStatus,
  payRegistration,
  updateRegistration,
  updateRegistrationByes,
  type ApiMyRegistration,
  type ApiRosterPlayer,
  type ApiTournamentDetail,
  type ApiTournamentPairing,
  type TournamentStatus,
} from '@/lib/api'
import { cn } from '@/lib/utils'
import { describeRules, effectiveRules, eligibilityProblem, gradeRangeText, needsGrade, parseGradeRange } from '@/lib/sectionRules'
import { asksGrade, confirmedRange, GradeConfirm, NO_TICKS, type GradeTicks } from '@/components/tournaments/GradeConfirm'
import { priceShownSection, type Price } from '@/lib/pricing'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useNow } from '@/hooks/useNow'
import { FamilyRegistrationPanel } from '@/components/family/FamilyRegistrationPanel'
import { PreviewBanner } from '@/components/tournaments/PreviewBanner'

const statusConfig: Record<TournamentStatus, { label: string; className: string }> = {
  upcoming: { label: 'Upcoming', className: 'bg-lca-gold/20 text-lca-gold' },
  active:   { label: 'Active',   className: 'bg-emerald-500/20 text-emerald-300' },
  completed:{ label: 'Completed',className: 'bg-white/10 text-white/60' },
}

const goldBtn = 'bg-lca-gold font-semibold text-lca-navy hover:bg-lca-gold/90'

// ── Registration confirmation modal ─────────────────────────────────────────

function RegistrationModal({
  tournament, member, selectedSection, byeRounds, grade, price, waitlist,
  onConfirm, onCancel, registering, error,
}: {
  tournament: ApiTournamentDetail
  member: { full_name: string; email: string; uscf_id?: string | null; uscf_rating?: number | null }
  selectedSection: string
  byeRounds: number[]
  grade: string
  price: Price
  waitlist: boolean
  onConfirm: () => void
  onCancel: () => void
  registering: boolean
  error: string | null
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="mx-4 w-full max-w-md rounded-xl border bg-background p-6 shadow-lg">
        <div className="mb-4 flex items-start justify-between">
          <h3 className="text-lg font-bold text-lca-navy">{waitlist ? 'Join the waitlist' : 'Confirm registration'}</h3>
          <button type="button" onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          {waitlist ? 'Waitlist for' : 'Registering for'} <span className="font-medium text-foreground">{tournament.name}</span>.
          {waitlist && ' You won\'t be charged unless the director offers you a spot.'}
        </p>
        <div className="mb-4 space-y-2 rounded-lg border bg-muted/30 p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Name</span>
            <span className="font-medium">{member.full_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium">{member.email}</span>
          </div>
          {member.uscf_id && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">USCF ID</span>
              <span className="font-medium">{member.uscf_id}</span>
            </div>
          )}
          {member.uscf_rating != null && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rating</span>
              <span className="font-medium">{member.uscf_rating}</span>
            </div>
          )}
          <div className="flex justify-between border-t pt-2">
            <span className="text-muted-foreground">Section</span>
            <span className="font-medium">{selectedSection}</span>
          </div>
          {byeRounds.length > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bye rounds</span>
              <span className="font-medium">{byeRounds.map((r) => `Rd ${r}`).join(', ')}</span>
            </div>
          )}
          {grade && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Confirmed</span>
              <span className="text-right font-medium">{grade}</span>
            </div>
          )}
          {!waitlist && <PriceLines price={price} />}
        </div>
        {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
        <div className="flex gap-3">
          <Button type="button" variant="outline" className="flex-1" onClick={onCancel} disabled={registering}>
            Cancel
          </Button>
          <Button type="button" className={cn('flex-1', goldBtn)} onClick={onConfirm} disabled={registering}>
            {registering ? 'Submitting…' : waitlist ? 'Join waitlist' : 'Confirm'}
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Entry fee with any discounts or late fee, one line each. */
function PriceLines({ price }: { price: Price }) {
  const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`
  return (
    <>
      {price.lines.length > 0 && (
        <div className="flex justify-between border-t pt-2">
          <span className="text-muted-foreground">Entry fee</span>
          <span>{money(price.base)}</span>
        </div>
      )}
      {price.lines.map((l) => (
        <div key={l.label} className="flex justify-between">
          <span className="text-muted-foreground">{l.label}</span>
          <span>{l.amount < 0 ? `−${money(-l.amount)}` : `+${money(l.amount)}`}</span>
        </div>
      ))}
      <div className={cn('flex justify-between font-medium', price.lines.length === 0 && 'border-t pt-2')}>
        <span className="text-muted-foreground">{price.lines.length ? 'You pay' : 'Entry fee'}</span>
        <span>{price.amount > 0 ? money(price.amount) : 'Free'}</span>
      </div>
    </>
  )
}

// ── Bye rounds editor ────────────────────────────────────────────────────────

function ByeRoundsEditor({
  registration, totalRounds, onSave,
}: {
  registration: ApiMyRegistration
  totalRounds: number
  onSave: (byeRounds: number[]) => Promise<void>
}) {
  const [selected, setSelected] = useState<number[]>(registration.bye_rounds ?? [])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const maxByes = totalRounds - 1

  function toggle(round: number) {
    setSelected((prev) =>
      prev.includes(round) ? prev.filter((r) => r !== round) : [...prev, round].sort((a, b) => a - b),
    )
    setSaved(false)
    setSaveError(null)
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    try {
      await onSave(selected)
      setSaved(true)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to update byes')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Max {maxByes} bye{maxByes !== 1 ? 's' : ''} (half-point each).
      </p>
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: totalRounds }, (_, i) => i + 1).map((round) => {
          const isSel = selected.includes(round)
          const wouldExceed = !isSel && selected.length >= maxByes
          return (
            <button
              key={round}
              type="button"
              disabled={wouldExceed}
              onClick={() => toggle(round)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                isSel
                  ? 'border-lca-navy bg-lca-navy text-white'
                  : wouldExceed
                  ? 'cursor-not-allowed border-border text-muted-foreground/40'
                  : 'border-border text-muted-foreground hover:border-lca-navy/40',
              )}
            >
              Round {round}
            </button>
          )
        })}
      </div>
      {saveError && <p className="text-xs text-destructive">{saveError}</p>}
      <Button type="button" size="sm" className={goldBtn} onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Update bye rounds'}
      </Button>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export function TournamentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, member: authMember } = useAuth()

  const [tournament, setTournament] = useState<ApiTournamentDetail | null>(null)
  const [roster, setRoster] = useState<ApiRosterPlayer[]>([])
  const [pairings, setPairings] = useState<ApiTournamentPairing[]>([])
  const [myRegistration, setMyRegistration] = useState<ApiMyRegistration | null>(null)
  // The route param is known at first render, so a missing id is the state we
  // start in rather than something an effect corrects a render later.
  const [loading, setLoading] = useState(!!id)
  const [notFound, setNotFound] = useState(!id)
  const [error, setError] = useState<string | null>(null)

  const [selectedSection, setSelectedSection] = useState('')
  const [selectedByes, setSelectedByes] = useState<number[]>([])
  const [gradeTicks, setGradeTicks] = useState<GradeTicks>(NO_TICKS)
  const [warnings, setWarnings] = useState<string[]>([])
  const [withdrawing, setWithdrawing] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [registerError, setRegisterError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [payingNow, setPayingNow] = useState(false)
  const [confirmation, setConfirmation] = useState<{
    message: string; paymentUrl: string | null; section: string
  } | null>(null)
  // The time the prices are shown for. Checkout prices the entry on the
  // server at the moment it is made, so this follows the clock (a timer, plus
  // a fresh read on loading, on changing section and on opening the
  // confirmation) and the early deadline or late fee turns over on screen as
  // it does at checkout.
  const [nowMs, refreshNow] = useNow()

  const [reminderOptedIn, setReminderOptedIn] = useState(false)
  const [togglingReminder, setTogglingReminder] = useState(false)

  usePageTitle(tournament?.name ?? 'Tournament')

  useEffect(() => {
    if (!id) return
    async function load() {
      try {
        const data = await getTournament(id!)
        setTournament(data.tournament)
        setRoster(data.roster)
        setPairings(data.pairings ?? [])
        setMyRegistration(data.myRegistration ?? null)
        setSelectedSection(data.tournament.sections[0]?.name ?? '')
        refreshNow()
        setNotFound(false)
        setError(null)
        if (user) {
          try {
            const s = await getTournamentReminderStatus(id!)
            setReminderOptedIn(s.opted_in)
          } catch { /* ignore */ }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load tournament'
        if (msg.toLowerCase().includes('not found')) setNotFound(true)
        else setError(msg)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, user, refreshNow])

  async function handleRegisterClick(e: FormEvent) {
    e.preventDefault()
    if (!id || !selectedSection) return
    if (!user) { navigate('/login', { state: { from: location.pathname } }); return }
    if (tournament?.is_rated && !authMember?.uscf_id) {
      setRegisterError('This is a USCF-rated tournament. Add your USCF ID to your profile before registering.')
      return
    }
    const section = tournament?.sections.find((s) => s.name === selectedSection)
    const range = confirmedRange(section, gradeTicks)
    if (range === 'conflict') { setRegisterError("The grade boxes you ticked can't all be true."); return }
    const problem = section && eligibilityProblem(section, { rating: authMember?.uscf_rating ?? null, gradeRange: parseGradeRange(range) })
    if (problem) { setRegisterError(problem); return }
    setRegisterError(null)
    refreshNow()
    setShowModal(true)
  }

  async function handleConfirmRegistration() {
    if (!id || !selectedSection) return
    setRegistering(true)
    setRegisterError(null)
    try {
      const full = !!tournament?.max_players && roster.filter((p) => !p.withdrawn_at).length >= tournament.max_players
      const section = tournament?.sections.find((s) => s.name === selectedSection)
      const range = confirmedRange(section, gradeTicks)
      const result = await createRegistration(id, selectedSection, selectedByes, {
        gradeRange: range === 'conflict' ? null : range,
        waitlist: full,
      })
      setWarnings(result.warnings ?? [])
      setConfirmation({ message: result.message, paymentUrl: result.paymentUrl, section: selectedSection })
      setShowModal(false)
      const data = await getTournament(id)
      setRoster(data.roster)
      setMyRegistration(data.myRegistration ?? null)
    } catch (err) {
      setRegisterError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setRegistering(false)
    }
  }

  async function handlePayNow() {
    if (!myRegistration) return
    setPayingNow(true)
    setRegisterError(null)
    try {
      const { paymentUrl } = await payRegistration(myRegistration.id)
      window.location.href = paymentUrl
    } catch (err) {
      setRegisterError(err instanceof Error ? err.message : 'Could not start payment')
    } finally {
      setPayingNow(false)
    }
  }

  async function handleWithdraw() {
    if (!myRegistration || !id) return
    const paid = myRegistration.payment_status === 'paid'
    const ok = window.confirm(
      myRegistration.waitlisted_at
        ? 'Leave the waitlist for this tournament?'
        : `Withdraw from this tournament?${paid ? ' Refunds are up to the organizers; they\'ll be notified.' : ''} Only the director can put you back in.`,
    )
    if (!ok) return
    setWithdrawing(true)
    setRegisterError(null)
    try {
      await updateRegistration(myRegistration.id, { withdrawn: true })
      const data = await getTournament(id)
      setRoster(data.roster)
      setMyRegistration(data.myRegistration ?? null)
    } catch (err) {
      setRegisterError(err instanceof Error ? err.message : 'Could not withdraw')
    } finally {
      setWithdrawing(false)
    }
  }

  async function handleToggleReminder() {
    if (!id || !user) return
    setTogglingReminder(true)
    try {
      if (reminderOptedIn) {
        await optOutTournamentReminder(id)
        setReminderOptedIn(false)
      } else {
        await optInTournamentReminder(id)
        setReminderOptedIn(true)
      }
    } catch { /* ignore */ } finally {
      setTogglingReminder(false)
    }
  }

  async function handleUpdateByes(byeRounds: number[]) {
    if (!myRegistration) return
    await updateRegistrationByes(myRegistration.id, byeRounds)
    setMyRegistration((prev) => prev ? { ...prev, bye_rounds: byeRounds } : prev)
  }

  function toggleBye(round: number) {
    setSelectedByes((prev) =>
      prev.includes(round) ? prev.filter((r) => r !== round) : [...prev, round].sort((a, b) => a - b),
    )
  }

  // ── Loading / error states ───────────────────────────────────────────────

  if (loading) return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <p className="text-muted-foreground">Loading tournament…</p>
    </div>
  )

  if (error) return (
    <div className="mx-auto max-w-6xl px-6 py-12 text-center">
      <p className="text-destructive">{error}</p>
      <Button asChild className="mt-6" variant="outline">
        <Link to="/tournaments"><ArrowLeft className="size-4" /> Back</Link>
      </Button>
    </div>
  )

  if (notFound || !tournament) return (
    <div className="mx-auto max-w-6xl px-6 py-12 text-center">
      <Trophy className="mx-auto size-12 text-muted-foreground" />
      <h1 className="mt-4 text-2xl font-bold text-lca-navy">Tournament not found</h1>
      <Button asChild className="mt-6" variant="outline">
        <Link to="/tournaments"><ArrowLeft className="size-4" /> Back to tournaments</Link>
      </Button>
    </div>
  )

  // ── Derived values ───────────────────────────────────────────────────────

  const status    = statusConfig[tournament.status]
  const isRated   = tournament.is_rated !== 0
  const regStatus = tournament.registration_status ?? 'draft'
  const roundSchedule = tournament.round_schedule ?? []
  const customDetails = tournament.custom_details ?? []
  const maxByes = tournament.rounds - 1
  const hasPairings = pairings.length > 0

  // Withdrawn players are excluded from public display and counts
  const activeRoster = roster.filter((p) => !p.withdrawn_at)
  const isFull = !!tournament.max_players && activeRoster.length >= tournament.max_players
  // Priced as checkout prices it: the section's own prices where it has
  // them, else the tournament's early and late lines. Everyone pays the same
  // for a section; there is no member price. A name with no section (none
  // chosen yet) is priced at the event fee.
  const priceFor = (sectionName: string) =>
    priceShownSection(tournament.sections.find((s) => s.name === sectionName), tournament, nowMs)
  const chosenSection = tournament.sections.find((s) => s.name === selectedSection)
  const chosenRules = chosenSection ? effectiveRules(chosenSection) : {}
  const chosenPrice = priceFor(selectedSection)
  // Only a rating problem blocks the button up front; the grade box sits
  // right below, so an unticked box is checked on submit instead.
  const blockingProblem = user && chosenSection
    ? eligibilityProblem(chosenSection, {
      rating: authMember?.uscf_rating ?? null,
      gradeRange: needsGrade(chosenRules) ? { min: chosenRules.gradeMin ?? 0, max: chosenRules.gradeMax ?? 12 } : null,
    })
    : null
  const confirmed = confirmedRange(chosenSection, gradeTicks)
  const confirmedGrade = confirmed && confirmed !== 'conflict' ? parseGradeRange(confirmed) : null
  const confirmedText = confirmedGrade ? `In ${gradeRangeText(confirmedGrade.min, confirmedGrade.max).slice(3)}` : ''
  const myWithdrawn = !!myRegistration?.withdrawn_at
  const myWaitlisted = !!myRegistration?.waitlisted_at && !myWithdrawn
  const mySectionPaired = !!myRegistration && pairings.some((g) => g.section === myRegistration.section)
  const expiresBefore = isRated && authMember?.uscf_expiration && authMember.uscf_expiration.slice(0, 10) < tournament.date.slice(0, 10)
    ? authMember.uscf_expiration.slice(0, 10) : null

  // Group active roster by section, sorted by name within each section
  const rosterBySectionMap = new Map<string, ApiRosterPlayer[]>()
  for (const player of activeRoster) {
    const sec = player.section ?? 'Unknown'
    if (!rosterBySectionMap.has(sec)) rosterBySectionMap.set(sec, [])
    rosterBySectionMap.get(sec)!.push(player)
  }
  for (const players of rosterBySectionMap.values()) {
    players.sort((a, b) => a.full_name.localeCompare(b.full_name))
  }
  // Preserve section order from tournament.sections
  const sectionOrder = tournament.sections.map((s) => s.name)
  const rosterSections = [
    ...sectionOrder.filter((s) => rosterBySectionMap.has(s)),
    ...[...rosterBySectionMap.keys()].filter((s) => !sectionOrder.includes(s)),
  ]

  return (
    <div>
      {showModal && authMember && (
        <RegistrationModal
          tournament={tournament}
          member={authMember}
          selectedSection={selectedSection}
          byeRounds={selectedByes}
          grade={confirmedText}
          price={chosenPrice}
          waitlist={isFull}
          onConfirm={handleConfirmRegistration}
          onCancel={() => { setShowModal(false); setRegisterError(null) }}
          registering={registering}
          error={registerError}
        />
      )}

      <PreviewBanner tournamentId={tournament.id} visible={tournament.is_visible} />

      {/* ── Hero ── */}
      <section className="border-b-[3px] border-lca-gold bg-lca-navy text-white">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <Link
            to="/tournaments"
            className="inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-lca-gold transition-colors"
          >
            <ArrowLeft className="size-3.5" /> All tournaments
          </Link>

          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  {tournament.name}
                </h1>
                <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', status.className)}>
                  {status.label}
                </span>
                {!!tournament.is_state_championship && (
                  <Link to="/champions" className="rounded-full bg-lca-gold px-2.5 py-0.5 text-xs font-semibold text-lca-navy hover:bg-lca-gold/90">
                    State Championship
                  </Link>
                )}
                <span className={cn(
                  'rounded-full px-2.5 py-0.5 text-xs font-medium',
                  isRated ? 'bg-blue-500/20 text-blue-200' : 'bg-white/10 text-white/60',
                )}>
                  {isRated ? 'USCF Rated' : 'Unrated'}
                </span>
                {regStatus === 'open' && tournament.status === 'upcoming' && (
                  <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
                    Registration open
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-2 text-sm text-white/70 sm:flex-row sm:flex-wrap sm:gap-x-6">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="size-4 flex-shrink-0 text-lca-gold" />
                  {tournament.date}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-4 flex-shrink-0 text-lca-gold" />
                  {tournament.location}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="size-4 flex-shrink-0 text-lca-gold" />
                  {tournament.rounds} rounds
                  {tournament.time_control && ` · ${tournament.time_control}`}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Users className="size-4 flex-shrink-0 text-lca-gold" />
                  {tournament.max_players
                    ? `${activeRoster.length} of ${tournament.max_players} spots filled`
                    : `${activeRoster.length} registered`}
                </span>
              </div>
            </div>

            {/* Pairings / Results button */}
            <div className="flex-shrink-0">
              {hasPairings ? (
                <Button
                  asChild
                  size="sm"
                  className="border-lca-gold/50 bg-lca-gold/15 text-lca-navy hover:bg-lca-gold/25"
                  variant="outline"
                >
                  <Link to={`/tournaments/${id}/pairings`}>
                    See pairings / results <ChevronRight className="ml-1 size-3.5" />
                  </Link>
                </Button>
              ) : (
                <div className="group relative">
                  <Button
                    size="sm"
                    disabled
                    variant="outline"
                    className="border-white/15 bg-white/5 text-white/30 cursor-not-allowed"
                  >
                    See pairings / results <ChevronRight className="ml-1 size-3.5" />
                  </Button>
                  <div className="pointer-events-none absolute right-0 top-full mt-1.5 w-max rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-muted-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100">
                    Not yet published
                  </div>
                </div>
              )}
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
            {(tournament.description || tournament.venue) && (
              <div>
                <h2 className="text-xl font-bold text-lca-navy">About</h2>
                {tournament.description && (
                  <p className="mt-3 text-muted-foreground">{tournament.description}</p>
                )}
                {tournament.venue && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    <span className="font-medium text-lca-navy">Venue:</span> {tournament.venue}
                  </p>
                )}
              </div>
            )}

            {/* Round schedule */}
            {roundSchedule.length > 0 && (
              <div>
                <h2 className="text-xl font-bold text-lca-navy">Round schedule</h2>
                <div className="mt-4 overflow-x-auto rounded-xl border">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-3 font-semibold text-lca-navy">Round</th>
                        <th className="px-4 py-3 font-semibold text-lca-navy">Date</th>
                        <th className="px-4 py-3 font-semibold text-lca-navy">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roundSchedule.map((rs) => (
                        <tr key={rs.round} className="border-b last:border-0">
                          <td className="px-4 py-3 font-medium">Round {rs.round}</td>
                          <td className="px-4 py-3 text-muted-foreground">{rs.date || '—'}</td>
                          <td className="px-4 py-3 text-muted-foreground">{rs.time || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Sections */}
            <div>
              <h2 className="text-xl font-bold text-lca-navy">Sections</h2>
              <div className="mt-4 overflow-x-auto rounded-xl border">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 font-semibold text-lca-navy">Section</th>
                      <th className="px-4 py-3 font-semibold text-lca-navy">Who can enter</th>
                      <th className="px-4 py-3 font-semibold text-lca-navy">Entry fee</th>
                      <th className="px-4 py-3 font-semibold text-lca-navy">Prize fund</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tournament.sections.map((s) => (
                      <tr key={s.name} className="border-b last:border-0">
                        <td className="px-4 py-3 font-medium">{s.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{describeRules(effectiveRules(s))}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {s.entryFee > 0 ? `$${s.entryFee}` : 'Free'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{s.prizeFund || prizeFundLabel(s) || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* My registration — bye rounds */}
            {myRegistration && (
              <div className="rounded-xl border border-lca-navy/20 bg-lca-navy/5 p-6">
                <h2 className="text-lg font-bold text-lca-navy">Your registration</h2>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex gap-4">
                    <dt className="font-medium text-lca-navy">Section</dt>
                    <dd className="text-muted-foreground">{myRegistration.section}</dd>
                  </div>
                  <div className="flex gap-4">
                    <dt className="font-medium text-lca-navy">{myWithdrawn || myWaitlisted ? 'Status' : 'Payment'}</dt>
                    <dd className="text-muted-foreground">
                      {myWithdrawn ? 'Withdrawn' : myWaitlisted ? 'On the waitlist' : myRegistration.payment_status}
                    </dd>
                  </div>
                </dl>
                {!myWithdrawn && <div className="mt-4">
                  <p className="mb-2 text-sm font-medium text-lca-navy">Bye rounds</p>
                  <ByeRoundsEditor
                    registration={myRegistration}
                    totalRounds={tournament.rounds}
                    onSave={handleUpdateByes}
                  />
                </div>}
              </div>
            )}

            {/* Registered players — by section, sorted by name */}
            <div>
              <h2 className="text-xl font-bold text-lca-navy">
                Registered players
                {activeRoster.length > 0 && (
                  <span className="ml-2 text-base font-normal text-muted-foreground">
                    · {activeRoster.length}
                  </span>
                )}
              </h2>
              {activeRoster.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">No players registered yet.</p>
              ) : (
                <div className="mt-4 overflow-hidden rounded-xl border">
                  {rosterSections.map((sectionName) => {
                    const players = rosterBySectionMap.get(sectionName) ?? []
                    return (
                      <div key={sectionName}>
                        <div className="border-b bg-lca-gold/8 px-4 py-2">
                          <span className="text-xs font-semibold uppercase tracking-wide text-lca-navy">
                            {sectionName}
                          </span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            · {players.length} {players.length === 1 ? 'player' : 'players'}
                          </span>
                        </div>
                        <ul className="divide-y">
                          {players.map((player) => (
                            <li
                              key={player.member_id}
                              className="flex items-center justify-between px-4 py-2.5"
                            >
                              <div>
                                <p className="text-sm font-medium text-lca-navy">
                                  {player.full_name}
                                </p>
                                {player.uscf_id && (
                                  <p className="text-xs text-muted-foreground">
                                    USCF {player.uscf_id}
                                  </p>
                                )}
                              </div>
                              {player.uscf_rating != null && (
                                <span className="font-mono text-sm text-muted-foreground">
                                  {player.uscf_rating}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Custom details */}
            {customDetails.length > 0 && (
              <div className="space-y-6">
                {customDetails.map((cd, i) => (
                  <div key={i}>
                    <h2 className="text-xl font-bold text-lca-navy">{cd.title}</h2>
                    <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{cd.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Sidebar ── */}
          <div className="h-fit space-y-4 lg:sticky lg:top-20">

            {/* Registration card */}
            <div className="overflow-hidden rounded-xl border shadow-sm">
              <div className="bg-lca-navy px-5 py-4">
                <h2 className="font-semibold text-white">
                  {myRegistration ? 'Your registration' : 'Register'}
                </h2>
                {(tournament.registration_closes_at || tournament.registration_deadline) && !myRegistration && (
                  <p className="mt-0.5 text-xs text-white/50">
                    Registration closes {formatCloseTime(tournament.registration_closes_at || tournament.registration_deadline || '')}
                  </p>
                )}
              </div>

              <div className="bg-card p-5">
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{tournament.max_players ? 'Spots filled' : 'Registered'}</dt>
                    <dd className="font-medium">
                      {tournament.max_players ? `${activeRoster.length} of ${tournament.max_players}` : activeRoster.length}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Format</dt>
                    <dd className="font-medium">
                      {tournament.rounds}-round Swiss{isRated ? ', USCF-rated' : ', unrated'}
                    </dd>
                  </div>
                  {tournament.time_control && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Time control</dt>
                      <dd className="font-medium">{tournament.time_control}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Status</dt>
                    <dd>
                      {regStatus === 'open' && tournament.status === 'upcoming' ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                          Open
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground capitalize">{regStatus}</span>
                      )}
                    </dd>
                  </div>
                </dl>

                {/* Already registered */}
                {myRegistration && !confirmation && myWithdrawn && (
                  <div className="mt-5 space-y-2 rounded-lg border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">You've withdrawn from this tournament.</p>
                    <p>To be put back in, contact the tournament director.</p>
                    {registerError && <p className="text-destructive">{registerError}</p>}
                  </div>
                )}
                {myRegistration && !confirmation && !myWithdrawn && (
                  <div className="mt-5 space-y-3">
                    <div className={cn(
                      'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium',
                      myWaitlisted
                        ? 'border-border bg-muted/40 text-lca-navy'
                        : myRegistration.payment_status === 'paid'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-lca-gold/40 bg-lca-gold/10 text-lca-navy',
                    )}>
                      <CheckCircle2 className="size-4" />
                      {myWaitlisted ? 'Waitlisted' : 'Registered'} · {myRegistration.section}
                      {!myWaitlisted && myRegistration.payment_status !== 'paid' && ' · payment pending'}
                    </div>
                    {myWaitlisted && (
                      <p className="text-xs text-muted-foreground">
                        If a spot opens, the director will email you. You won't be charged until then.
                      </p>
                    )}
                    {registerError && (
                      <p className="text-sm text-destructive">{registerError}</p>
                    )}
                    {!myWaitlisted && myRegistration.payment_status === 'pending' && (
                      <Button
                        type="button"
                        className={cn('w-full', goldBtn)}
                        disabled={payingNow}
                        onClick={handlePayNow}
                      >
                        {payingNow ? 'Redirecting…' : 'Complete payment'}
                      </Button>
                    )}
                    {!myWaitlisted && (
                      <div>
                        <p className="mb-2 text-xs font-medium text-lca-navy">Bye rounds</p>
                        <ByeRoundsEditor
                          registration={myRegistration}
                          totalRounds={tournament.rounds}
                          onSave={handleUpdateByes}
                        />
                      </div>
                    )}
                    {!mySectionPaired && tournament.status !== 'completed' && (
                      <button
                        type="button"
                        onClick={handleWithdraw}
                        disabled={withdrawing}
                        className="w-full text-center text-xs text-muted-foreground underline-offset-2 hover:text-destructive hover:underline"
                      >
                        {withdrawing ? 'Withdrawing…' : myWaitlisted ? 'Leave the waitlist' : 'Withdraw from this tournament'}
                      </button>
                    )}
                  </div>
                )}

                {/* Registration open form */}
                {!myRegistration && regStatus === 'open' && tournament.status === 'upcoming' && (
                  confirmation ? (
                    <div className="mt-5 space-y-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 size-5 flex-shrink-0 text-emerald-700" />
                        <div>
                          <p className="font-medium text-emerald-900">Registration submitted</p>
                          <p className="mt-1 text-sm text-emerald-800">{confirmation.message}</p>
                        </div>
                      </div>
                      {warnings.map((w) => (
                        <p key={w} className="rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900">{w}</p>
                      ))}
                      {confirmation.paymentUrl && (
                        <Button asChild className={cn('w-full', goldBtn)}>
                          <a href={confirmation.paymentUrl} target="_blank" rel="noopener noreferrer">
                            Complete payment (Stripe)
                          </a>
                        </Button>
                      )}
                      <Button asChild variant="outline" className="w-full">
                        <Link to="/dashboard">View my profile</Link>
                      </Button>
                    </div>
                  ) : (
                    <form onSubmit={handleRegisterClick} className="mt-5 space-y-4">
                      {registerError && (
                        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                          {registerError}
                          {isRated && !authMember?.uscf_id && user && (
                            <Link to="/dashboard" className="mt-2 block font-medium underline">
                              Add USCF ID to your profile →
                            </Link>
                          )}
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <Label htmlFor="section">Section</Label>
                        <select
                          id="section"
                          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                          value={selectedSection}
                          onChange={(e) => { setSelectedSection(e.target.value); setGradeTicks(NO_TICKS); refreshNow() }}
                          required
                        >
                          {tournament.sections.map((s) => {
                            const amount = priceFor(s.name).amount
                            return (
                              <option key={s.name} value={s.name}>
                                {s.name}{amount > 0 ? ` — $${amount}` : ''}
                              </option>
                            )
                          })}
                        </select>
                        <p className="text-xs text-muted-foreground">{describeRules(chosenRules)}</p>
                      </div>

                      {asksGrade(chosenSection) && (
                        <GradeConfirm section={chosenSection} ticks={gradeTicks} onChange={setGradeTicks} who={null} />
                      )}

                      {blockingProblem && (
                        <p className="rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900">
                          {blockingProblem} Pick another section, or ask the director if you think this is wrong.
                        </p>
                      )}

                      {expiresBefore && (
                        <p className="rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900">
                          Your US Chess membership expires {expiresBefore}, before this event. Renew it at uschess.org so your games can be rated.
                        </p>
                      )}

                      {!isFull && (chosenPrice.lines.length > 0) && (
                        <div className="space-y-1 rounded-lg border bg-muted/30 p-3 text-xs">
                          <PriceLines price={chosenPrice} />
                        </div>
                      )}

                      {isFull && (
                        <p className="text-xs text-muted-foreground">
                          This tournament is full{tournament.waitlist_count ? ` (${tournament.waitlist_count} on the waitlist)` : ''}.
                          Join the waitlist and the director will email you if a spot opens. No charge until then.
                        </p>
                      )}

                      {tournament.rounds > 1 && (
                        <div className="space-y-1.5">
                          <Label>
                            Bye rounds{' '}
                            <span className="text-xs font-normal text-muted-foreground">
                              (optional, max {maxByes})
                            </span>
                          </Label>
                          <div className="flex flex-wrap gap-1.5">
                            {Array.from({ length: tournament.rounds }, (_, i) => i + 1).map((round) => {
                              const isSel = selectedByes.includes(round)
                              const wouldExceed = !isSel && selectedByes.length >= maxByes
                              return (
                                <button
                                  key={round}
                                  type="button"
                                  disabled={wouldExceed}
                                  onClick={() => toggleBye(round)}
                                  className={cn(
                                    'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                                    isSel
                                      ? 'border-lca-navy bg-lca-navy text-white'
                                      : wouldExceed
                                      ? 'cursor-not-allowed border-border text-muted-foreground/40'
                                      : 'border-border text-muted-foreground hover:border-lca-navy/40',
                                  )}
                                >
                                  Rd {round}
                                </button>
                              )
                            })}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Half-point byes. You can update these later.
                          </p>
                        </div>
                      )}

                      <Button type="submit" size="lg" className={cn('w-full', goldBtn)} disabled={registering || !!blockingProblem}>
                        {registering ? 'Submitting…' : isFull ? 'Join the waitlist' : 'Register now'}
                      </Button>

                      {!user && (
                        <p className="text-center text-xs text-muted-foreground">
                          You'll be asked to log in or create an account.
                        </p>
                      )}
                    </form>
                  )
                )}

                {/* Family registration: only renders for members with children */}
                {user && authMember && regStatus === 'open' && tournament.status === 'upcoming' && (
                  <FamilyRegistrationPanel
                    tournament={tournament}
                    selfName={authMember.full_name}
                    selfUscfId={authMember.uscf_id ?? null}
                    selfRating={authMember.uscf_rating ?? null}
                    selfRegistered={!!myRegistration || !!confirmation}
                  />
                )}

                {/* Registration not open */}
                {!myRegistration && regStatus !== 'open' && (
                  <div className="mt-5 space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {regStatus === 'closed'
                        ? 'Registration is closed.'
                        : 'Registration isn\'t open yet.'}
                    </p>
                    {user && regStatus !== 'closed' && (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={handleToggleReminder}
                        disabled={togglingReminder}
                      >
                        {reminderOptedIn ? (
                          <><BellOff className="mr-2 size-4" /> Remove notification</>
                        ) : (
                          <><Bell className="mr-2 size-4" /> Notify me when it opens</>
                        )}
                      </Button>
                    )}
                    {!user && (
                      <Button asChild size="lg" className={cn('w-full', goldBtn)}>
                        <Link to="/login" state={{ from: location.pathname }}>
                          Log in to get notified
                        </Link>
                      </Button>
                    )}
                  </div>
                )}

                {tournament.status !== 'upcoming' && (
                  <p className="mt-4 text-sm text-muted-foreground">
                    {tournament.status === 'active'
                      ? 'This tournament is in progress.'
                      : 'This tournament has concluded.'}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

/** "$300 in prizes" from the prizes the director set, when there's cash. */
function prizeFundLabel(s: ApiTournamentDetail['sections'][number]): string | null {
  const sum = (slots: Array<{ amount?: number }> = []) => slots.reduce((a, x) => a + Math.max(0, x.amount ?? 0), 0)
  const cash = sum(s.prizes?.place) + (s.prizes?.classes ?? []).reduce((a, c) => a + sum(c.prizes), 0)
  return cash > 0 ? `$${cash} in prizes` : null
}

/** "Fri, Oct 16, 6:00 PM" for a Central wall-clock value like "2026-10-16T18:00". */
function formatCloseTime(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(value)
  if (!m) return value
  const [, y, mo, d, h, mi] = m
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h ?? 23), Number(mi ?? 59)))
  const day = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
  if (h === undefined) return day
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })
  return `${day}, ${time} Central`
}
