// domain/registration/pricing.ts
// The one definition of entry pricing, used at checkout on the server and
// to show the price on the tournament page. functions/utils and src/lib
// keep one-line re-exports at their old paths.
//
// What an entry costs right now: the section's fee, less an early-entry
// discount (until the early deadline), less the LCA member discount, plus
// a late fee (after the late date). Never below zero. The same function
// prices the entry at checkout and shows the price on the tournament page.

import { hasPassed } from '../format/centralTime'

export interface PricedTournament {
  entry_fee: number
  sections: string
  early_deadline?: string | null
  early_discount?: number | null
  late_after?: string | null
  late_fee?: number | null
  member_discount?: number | null
}

export interface PriceLine { label: string; amount: number }
export interface Price { amount: number; base: number; lines: PriceLine[] }

export function sectionBaseFee(sectionsJson: string, sectionName: string, defaultFee: number): number {
  try {
    const parsed = JSON.parse(sectionsJson) as Array<{ name: string; entryFee?: number } | string>
    const match = parsed.find((s) => typeof s !== 'string' && s.name === sectionName) as { entryFee?: number } | undefined
    return match?.entryFee ?? defaultFee
  } catch {
    return defaultFee
  }
}

export function entryPrice(
  t: PricedTournament,
  sectionName: string,
  opts: { isLcaMember: boolean; nowMs?: number },
): Price {
  const now = opts.nowMs ?? Date.now()
  const base = sectionBaseFee(t.sections, sectionName, t.entry_fee)
  const lines: PriceLine[] = []
  if (base > 0) {
    if (t.early_deadline && (t.early_discount ?? 0) > 0 && !hasPassed(t.early_deadline, now)) {
      lines.push({ label: 'Early entry discount', amount: -(t.early_discount as number) })
    }
    if (opts.isLcaMember && (t.member_discount ?? 0) > 0) {
      lines.push({ label: 'LCA member discount', amount: -(t.member_discount as number) })
    }
    if (t.late_after && (t.late_fee ?? 0) > 0 && hasPassed(t.late_after, now)) {
      lines.push({ label: 'Late entry fee', amount: t.late_fee as number })
    }
  }
  const amount = Math.max(0, Math.round((base + lines.reduce((s, l) => s + l.amount, 0)) * 100) / 100)
  return { amount, base, lines }
}
