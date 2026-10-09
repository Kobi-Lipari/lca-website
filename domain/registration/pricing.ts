// domain/registration/pricing.ts
// The one definition of entry pricing, used at checkout on the server and
// to show the price on the tournament page. functions/utils and src/lib
// keep one-line re-exports at their old paths.
//
// What an entry costs right now: the section's fee, less an early-entry
// discount (until the early deadline), plus a late fee (after the late
// date). Never below zero. The same function prices the entry at checkout
// and shows the price on the tournament page. Everyone entering the same
// section at the same moment pays the same: there is no member price
// (decision D11). tournaments.member_discount is still in the table but is
// no longer read.
//
// priceEntry takes a section's own prices and the tournament's own pricing
// columns, read live, so changing those columns changes the price at once.
// The server passes a section row (tournament_sections, as loadSections in
// functions/utils/events/sectionsRepo.ts reads it); the pages pass the
// section from the answer they loaded to priceShownSection, which works out
// which of its prices are the section's own.

import { hasPassed } from '../format/centralTime'
import { tierFees, type TierFees, type TierSection } from '../events/sections'

/** The tournament columns an entry is priced from. */
export interface PriceTournament {
  entry_fee: number
  early_deadline?: string | null
  early_discount?: number | null
  late_after?: string | null
  late_fee?: number | null
}

export interface PriceLine { label: string; amount: number }
export interface Price { amount: number; base: number; lines: PriceLine[] }

const cents = (n: number) => Math.round(n * 100) / 100

/**
 * What one entry into `section` costs at `nowMs`.
 *
 * The base is the section's fee_regular, else the tournament's entry_fee.
 * While the early deadline has not passed, the early line takes
 * early_discount off; after the late date, the late line adds late_fee.
 * Nothing about the player changes the price. A section's own early or late
 * price, when set, replaces that line's amount with its difference from the
 * base, under the same label. The lines add up, the total is rounded to the
 * cent and never goes below zero, and a free section has no lines.
 */
export function priceEntry(
  section: TierSection,
  tournament: PriceTournament,
  nowMs: number,
): Price {
  const base = section.feeRegular ?? tournament.entry_fee
  const lines: PriceLine[] = []
  if (base > 0) {
    if (tournament.early_deadline && !hasPassed(tournament.early_deadline, nowMs)) {
      const amount = section.feeEarly != null
        ? cents(section.feeEarly - base)
        : (tournament.early_discount ?? 0) > 0 ? -(tournament.early_discount as number) : 0
      if (amount !== 0) lines.push({ label: 'Early entry discount', amount })
    }
    if (tournament.late_after && hasPassed(tournament.late_after, nowMs)) {
      const amount = section.feeLate != null
        ? cents(section.feeLate - base)
        : (tournament.late_fee ?? 0) > 0 ? (tournament.late_fee as number) : 0
      if (amount !== 0) lines.push({ label: 'Late entry fee', amount })
    }
  }
  const amount = Math.max(0, Math.round((base + lines.reduce((s, l) => s + l.amount, 0)) * 100) / 100)
  return { amount, base, lines }
}

/**
 * What one entry into a section costs at `nowMs`, priced from the section as
 * an endpoint answers it (its `fees`), so the page shows what checkout
 * charges. `section` is undefined when no section is chosen yet, and the
 * entry is then priced at the event fee.
 *
 * The answer's early and late prices are either the section's own or worked
 * out from the tournament's columns, and the two price differently: an own
 * price replaces the line's amount, a worked-out one keeps the tournament's
 * discount or fee (and a worked-out early price is clamped at zero, which the
 * discount line is not). So a tier price is passed on as the section's own
 * only when it differs from the price the tournament alone would give.
 * An own price equal to that one prices the same either way, except an own
 * early price of $0 where the discount is larger than the fee: the answer
 * cannot tell it from the worked-out $0, and it is read as worked out.
 */
export function priceShownSection(
  section: { fees: TierFees } | undefined,
  tournament: PriceTournament,
  nowMs: number,
): Price {
  if (!section) return priceEntry({}, tournament, nowMs)
  const { regular, early, late } = section.fees
  const worked = tierFees({ feeRegular: regular }, tournament)
  return priceEntry({
    feeRegular: regular,
    feeEarly: early !== worked.early ? early : null,
    feeLate: late !== worked.late ? late : null,
  }, tournament, nowMs)
}
