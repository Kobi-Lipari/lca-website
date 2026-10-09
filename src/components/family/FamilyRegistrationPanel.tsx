// src/components/family/FamilyRegistrationPanel.tsx
//
// "Who's playing?" on a tournament page, for parents with children on their
// account: pick any of the children (and yourself, if not already entered),
// choose each one's section and byes, and pay for everyone in one checkout.
// Renders nothing for members without children, so the page is unchanged
// for everyone else.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { createBatchRegistration, getMyChildren, type ApiChild, type ApiTournamentDetail } from '@/lib/api'
import { cn } from '@/lib/utils'
import { GOLD_BUTTON as GOLD } from '@/lib/brand'
import { effectiveRules, eligibilityProblem, needsGrade } from '@/lib/sectionRules'
import { confirmedRange, GradeConfirm, NO_TICKS, type GradeTicks } from '@/components/tournaments/GradeConfirm'
import { priceShownSection } from '@/lib/pricing'

interface Player {
  /** undefined = the signed-in member */
  memberId?: string
  name: string
  uscfId: string | null
  rating: number | null
}

interface Choice {
  selected: boolean
  section: string
  byes: number[]
  /** Grade-range boxes ticked (grade sections and grade prizes). */
  ticks: GradeTicks
}

export function FamilyRegistrationPanel({ tournament, selfName, selfUscfId, selfRating = null, selfRegistered }: {
  tournament: ApiTournamentDetail
  selfName: string
  selfUscfId: string | null
  selfRating?: number | null
  selfRegistered: boolean
}) {
  const [children, setChildren] = useState<ApiChild[] | null>(null)
  const [choices, setChoices] = useState<Record<string, Choice>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ message: string; paymentUrl: string | null } | null>(null)
  // The time the prices below are shown for, read once when the panel opens
  // (checkout prices each entry again on the server).
  const [nowMs] = useState(() => Date.now())

  useEffect(() => {
    let cancelled = false
    getMyChildren(tournament.id)
      .then((list) => { if (!cancelled) setChildren(list) })
      .catch(() => { if (!cancelled) setChildren([]) })
    return () => { cancelled = true }
  }, [tournament.id])

  if (!children || children.length === 0) return null

  const defaultSection = tournament.sections[0]?.name ?? ''
  const maxByes = Math.max(tournament.rounds - 1, 0)

  const entered = children.filter((c) => c.registration)
  const players: Player[] = [
    ...(selfRegistered ? [] : [{ name: `${selfName} (me)`, uscfId: selfUscfId, rating: selfRating }]),
    ...children.filter((c) => !c.registration).map((c) => ({
      memberId: c.id, name: c.full_name, uscfId: c.uscf_id, rating: c.uscf_rating,
    })),
  ]

  const keyOf = (p: Player) => p.memberId ?? 'self'
  const choiceOf = (p: Player): Choice => choices[keyOf(p)] ?? { selected: false, section: defaultSection, byes: [], ticks: NO_TICKS }
  const setChoice = (p: Player, patch: Partial<Choice>) =>
    setChoices((prev) => ({ ...prev, [keyOf(p)]: { ...choiceOf(p), ...patch } }))

  const picked = players.filter((p) => choiceOf(p).selected)
  const sectionOf = (name: string) => tournament.sections.find((s) => s.name === name)
  // Priced as the tournament page and checkout price one entry: by the
  // section alone, the same for every player.
  const feeOf = (section: string) => priceShownSection(sectionOf(section), tournament, nowMs).amount
  const total = picked.reduce((sum, p) => sum + feeOf(choiceOf(p).section), 0)
  const missingUscf = tournament.is_rated !== 0 ? picked.filter((p) => !p.uscfId) : []
  /** Rating problems; the grade box is checked separately (it sits right there). */
  const problemOf = (p: Player) => {
    const s = sectionOf(choiceOf(p).section)
    if (!s) return null
    const r = effectiveRules(s)
    return eligibilityProblem(s, { rating: p.rating, gradeRange: needsGrade(r) ? { min: r.gradeMin ?? 0, max: r.gradeMax ?? 12 } : null })
  }
  const gradeUnconfirmed = (p: Player) => {
    const c = choiceOf(p)
    const s = sectionOf(c.section)
    return (!!s && needsGrade(effectiveRules(s)) && !c.ticks.section) || confirmedRange(s, c.ticks) === 'conflict'
  }
  const blocked = picked.some((p) => problemOf(p) || gradeUnconfirmed(p))

  async function submit() {
    setSubmitting(true)
    setError(null)
    try {
      const result = await createBatchRegistration(
        tournament.id,
        picked.map((p) => {
          const c = choiceOf(p)
          const range = confirmedRange(sectionOf(c.section), c.ticks)
          return { memberId: p.memberId, section: c.section, byeRounds: c.byes, gradeRange: range === 'conflict' ? null : range }
        }),
      )
      if (result.paymentUrl) {
        window.location.assign(result.paymentUrl)
        return
      }
      setDone({ message: result.message, paymentUrl: null })
      setChoices({})
      // Free entries are confirmed immediately. Reload so the roster, the
      // spots count and (if you entered yourself) your own registration
      // box all reflect it.
      window.setTimeout(() => window.location.reload(), 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mt-6 border-t pt-5">
      <div className="flex items-center gap-2">
        <Users className="size-4 text-lca-gold" />
        <p className="text-sm font-semibold text-lca-navy">Register your family</p>
      </div>

      {entered.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {entered.map((c) => (
            <li key={c.id} className="flex items-center gap-2 text-sm text-emerald-800">
              <CheckCircle2 className="size-4 flex-shrink-0" />
              <span className="truncate">
                {c.full_name} · {c.registration!.section}
                {c.registration!.withdrawn_at ? ' · withdrawn' : c.registration!.waitlisted_at ? ' · waitlisted' : c.registration!.payment_status !== 'paid' ? ' · payment pending' : ''}
              </span>
            </li>
          ))}
        </ul>
      )}

      {done && (
        <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{done.message}</p>
      )}

      {players.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">Everyone on your account is entered.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {players.map((p) => {
            const c = choiceOf(p)
            return (
              <div key={keyOf(p)} className={cn('rounded-lg border p-3', c.selected && 'border-lca-navy/40 bg-lca-navy/[0.03]')}>
                <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium">
                  <input type="checkbox" className="size-4 accent-[#1a2744]" checked={c.selected}
                    onChange={(e) => setChoice(p, { selected: e.target.checked })} />
                  <span className="truncate">{p.name}</span>
                </label>
                {c.selected && (
                  <div className="mt-2.5 space-y-2 pl-6">
                    <select aria-label={`Section for ${p.name}`}
                      className="w-full rounded-md border bg-background px-2.5 py-1.5 text-sm"
                      value={c.section} onChange={(e) => setChoice(p, { section: e.target.value, ticks: NO_TICKS })}>
                      {tournament.sections.map((s) => {
                        const fee = feeOf(s.name)
                        return <option key={s.name} value={s.name}>{s.name}{fee > 0 ? ` — $${fee}` : ''}</option>
                      })}
                    </select>
                    <GradeConfirm
                      section={sectionOf(c.section)}
                      ticks={c.ticks}
                      onChange={(ticks) => setChoice(p, { ticks })}
                      who={p.memberId ? p.name : null}
                      compact
                    />
                    {problemOf(p) && (
                      <p className="text-xs text-amber-800">{problemOf(p)}</p>
                    )}
                    {maxByes > 0 && (
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="mr-1 text-xs text-muted-foreground">Byes:</span>
                        {Array.from({ length: tournament.rounds }, (_, i) => i + 1).map((round) => {
                          const on = c.byes.includes(round)
                          const blocked = !on && c.byes.length >= maxByes
                          return (
                            <button key={round} type="button" disabled={blocked}
                              onClick={() => setChoice(p, { byes: on ? c.byes.filter((r) => r !== round) : [...c.byes, round].sort((a, b) => a - b) })}
                              className={cn('rounded-full border px-2 py-0.5 text-[11px] font-medium',
                                on ? 'border-lca-navy bg-lca-navy text-white'
                                  : blocked ? 'cursor-not-allowed border-border text-muted-foreground/40'
                                  : 'border-border text-muted-foreground hover:border-lca-navy/40')}>
                              {round}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {missingUscf.length > 0 && (
            <p className="text-xs text-destructive">
              This is a rated event: {missingUscf.map((p) => p.name).join(', ')} {missingUscf.length === 1 ? 'needs' : 'need'} a USCF ID.{' '}
              <Link to="/dashboard" className="underline">Add it on your profile</Link>
            </p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="button" className={cn('w-full', GOLD)}
            disabled={submitting || picked.length === 0 || missingUscf.length > 0 || blocked}
            onClick={submit}>
            {submitting
              ? 'Registering…'
              : picked.length === 0
                ? 'Choose who is playing'
                : total > 0
                  ? `Register ${picked.length} · pay $${total}`
                  : `Register ${picked.length}`}
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">One checkout for everyone you select.</p>
        </div>
      )}
    </div>
  )
}
