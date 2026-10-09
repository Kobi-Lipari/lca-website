// domain/registration/pricing.ts
// The one definition of entry pricing, used at checkout on the server and
// to show the price on the tournament page. functions/utils and src/lib
// keep one-line re-exports at their old paths.
//
// What an entry costs right now: the section's fee, less an early-entry
// discount (until the early deadline), less the LCA member discount, plus
// a late fee (after the late date). Never below zero. The same function
// prices the entry at checkout and shows the price on the tournament page.
//
// priceEntry is the core: it takes a section row (tournament_sections, as
// loadSections in functions/utils/events/sectionsRepo.ts reads it) and the
// tournament's own pricing columns, read live, so changing those columns
// changes the price at once. entryPrice is the older form the pages still
// call with the legacy sections JSON; it finds the section there and hands
// it to priceEntry.

import { hasPassed } from '../format/centralTime'
import { normalizeLegacySections, type TierSection } from '../events/sections'

/** The tournament columns an entry is priced from. */
export interface PriceTournament {
  entry_fee: number
  early_deadline?: string | null
  early_discount?: number | null
  late_after?: string | null
  late_fee?: number | null
  member_discount?: number | null
}

/** A tournament with its legacy sections JSON, as the pages hold it. */
export interface PricedTournament extends PriceTournament {
  sections: string
}

export interface PriceLine { label: string; amount: number }
export interface Price { amount: number; base: number; lines: PriceLine[] }

const cents = (n: number) => Math.round(n * 100) / 100

/**
 * What one entry into `section` costs at `nowMs`.
 *
 * The base is the section's fee_regular, else the tournament's entry_fee.
 * While the early deadline has not passed, the early line takes
 * early_discount off; after the late date, the late line adds late_fee; an
 * active LCA member gets member_discount off. A section's own early or late
 * price, when set, replaces that line's amount with its difference from the
 * base, under the same label. The lines add up, the total is rounded to the
 * cent and never goes below zero, and a free section has no lines.
 */
export function priceEntry(
  section: TierSection,
  tournament: PriceTournament,
  nowMs: number,
  opts: { isLcaMember: boolean },
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
    if (opts.isLcaMember && (tournament.member_discount ?? 0) > 0) {
      lines.push({ label: 'LCA member discount', amount: -(tournament.member_discount as number) })
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
 * A section's regular fee from the legacy sections JSON: its entryFee when
 * that is a number, else `defaultFee`. Text that is not a list of sections
 * gives `defaultFee`.
 */
export function sectionBaseFee(sectionsJson: string, sectionName: string, defaultFee: number): number {
  const match = normalizeLegacySections(sectionsJson).find((s) => s.name === sectionName)
  return typeof match?.entryFee === 'number' ? match.entryFee : defaultFee
}

/**
 * The price of an entry for a tournament that carries the legacy sections
 * JSON (the tournament page and the family entry panel). Prices exactly as
 * priceEntry does; a section the JSON lacks is priced at the event fee.
 */
export function entryPrice(
  t: PricedTournament,
  sectionName: string,
  opts: { isLcaMember: boolean; nowMs?: number },
): Price {
  const feeRegular = sectionBaseFee(t.sections, sectionName, t.entry_fee)
  return priceEntry({ feeRegular }, t, opts.nowMs ?? Date.now(), { isLcaMember: opts.isLcaMember })
}
