// domain/membership/requirement.ts
//
// Whether entering an event needs a current LCA membership (decision D12).
//
// An LCA-run event (no organizing club) always requires one. A club running
// its own event may switch the requirement off with the per-tournament
// tournaments.requires_lca_membership column. Club-run events start with it
// off, existing and new, because clubs get tournament creation first, free
// of charge; only the organizing club's rep or an LCA admin may change it.
//
// FORCE_LCA_MEMBERSHIP turns the requirement on for every event, whatever
// the column says. It is a constant today (off). The brief plans an
// admin-only site setting, membership_required_for_all, that replaces it
// (built with the site settings in WS08), so the board can require a
// membership on every event without a code change.
//
// Nothing enforces the rule yet. Today's registration cannot add a
// membership inside the same checkout, so refusing a non-member now would
// leave them no way forward. The checkout that adds the right membership in
// the same payment (WS06) is the first caller of needsMembershipAtCheckout.

/** Off: each event's own setting decides. See the note above. */
export const FORCE_LCA_MEMBERSHIP = false

/** The refusal when a save would switch the requirement off on an LCA-run event. */
export const LCA_RUN_NEEDS_MEMBERSHIP =
  'An LCA membership is always required for an event LCA runs. Only a club-run event can switch it off.'

/** The tournament columns the requirement is read from. */
export interface MembershipRequirementTournament {
  club_id: string | null
  /** 0 or 1, as stored. Left out or null reads as required (the default). */
  requires_lca_membership?: number | boolean | null
}

/** Does entering this event need a current LCA membership? */
export function requiresLcaMembership(
  tournament: MembershipRequirementTournament,
  opts: { forceAll?: boolean } = {},
): boolean {
  if (opts.forceAll ?? FORCE_LCA_MEMBERSHIP) return true
  if (!tournament.club_id) return true
  const value = tournament.requires_lca_membership
  if (value == null) return true
  return Boolean(Number(value))
}

/** The member columns membership is read from. */
export interface MembershipHolder {
  membership_status: string | null
  /** 'YYYY-MM-DD', the last day the membership is good for. */
  membership_expiry: string | null
}

/**
 * Is this membership good on `date` ('YYYY-MM-DD', the event's first day)?
 * Active, and either no expiry on record or an expiry on or after that day:
 * a membership expiring on the day of the event still covers it, as the
 * nightly expiry sweep reads it.
 */
export function hasActiveMembershipOn(player: MembershipHolder, date: string): boolean {
  if (player.membership_status !== 'active') return false
  if (!player.membership_expiry) return true
  return player.membership_expiry.slice(0, 10) >= date.slice(0, 10)
}

/**
 * Must the checkout add an LCA membership for this player before they can
 * enter? True when the event requires one and the player has no membership
 * that is active on the event's date.
 */
export function needsMembershipAtCheckout(
  player: MembershipHolder,
  tournament: MembershipRequirementTournament & { date: string },
  opts: { forceAll?: boolean } = {},
): boolean {
  return requiresLcaMembership(tournament, opts) && !hasActiveMembershipOn(player, tournament.date)
}
