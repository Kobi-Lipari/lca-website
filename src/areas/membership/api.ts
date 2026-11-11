// src/areas/membership/api.ts
//
// The membership area's calls to the site's API: the signed-in member,
// what they may create and their request for a payout account, joining and
// renewing, donations, the US Chess rating lookup, and the admin member
// list and export.
//
// Moved whole from src/lib/api.ts by scripts/split-api.ts, following
// scripts/moves/api-split.json. src/lib/api.ts re-exports everything here,
// so pages and components may keep importing from '@/lib/api'. A type
// another area owns is imported from that area's api.ts, never from
// '@/lib/api', which re-exports this file. The calls added since the split,
// getTournamentCreation and requestPayoutAccount, and the four a link in
// optional email opens its page with, are listed with their types in
// test/unit/fixtures/api-added-since-split.json.

// Types only: a runtime import of the contracts would bring zod into the site
// bundle, which npm run check:bundle refuses.
import type { EmailChoicesResponse, PayoutRequestResponse, TournamentCreationResponse, UnsubscribeLinkResponse, UnsubscribeResponse } from '@domain/contracts'
import { authHeaders, handleResponse } from '@/lib/http'
import type { ApiRegistration } from '@/areas/registration/api'
import type { ApiChild } from '@/areas/households/api'

export interface ApiMember {
  id: string
  email: string
  full_name: string
  uscf_id: string | null
  uscf_rating: number | null
  uscf_rating_updated_at: string | null
  membership_status: 'active' | 'expired' | 'none'
  membership_expiry: string | null
  /** 'family' for a family membership; null if never bought. */
  membership_type?: string | null
  /** The guardian's member id when this row is a guardian's child, such as a child covered by a family membership; null or absent otherwise. */
  guardian_id?: string | null
  /** US Chess membership expiry, from the nightly sync. */
  uscf_expiration?: string | null
  role: string
  club_id: string | null
  created_at: string
}

export async function syncMember(): Promise<ApiMember> {
  const response = await fetch('/api/me', {
    method: 'POST',
    headers: await authHeaders(),
  })
  const data = await handleResponse<{ member: ApiMember }>(response)
  return data.member
}

export async function getMe(): Promise<{
  member: ApiMember
  registrations: ApiRegistration[]
  directedTournaments: ApiDirectedTournament[]
  children?: ApiChild[]
}> {
  const response = await fetch('/api/me', {
    headers: await authHeaders(),
  })
  return handleResponse(response)
}

export interface ApiDirectedTournament {
  id: string
  name: string
  date: string
  status: string
}

/**
 * What GET /api/me/tournament-creation answers the signed-in member
 * (tournamentCreationResponseSchema in domain/contracts/me.ts): their grant;
 * canCreate, whether they may create an LCA-run event, one with no club;
 * canChargeFees, whether they may set an entry fee above $0; and clubId,
 * the club they run as its club rep, null for everyone else.
 */
export type ApiTournamentCreation = TournamentCreationResponse

/** What the signed-in member may create, as the server reads their grant at this request. */
export async function getTournamentCreation(): Promise<ApiTournamentCreation> {
  const response = await fetch('/api/me/tournament-creation', {
    headers: await authHeaders(),
  })
  return handleResponse(response)
}

/**
 * What POST /api/me/payout-request answers (payoutRequestResponseSchema in
 * domain/contracts/me.ts): the member's open payout request, by its id,
 * kind and status, never its number, and whether this request opened it.
 */
export type ApiPayoutRequest = PayoutRequestResponse

/**
 * Asks LCA for a payout account, naming the event the request is about when
 * there is one. A member has one request open at a time: asking again
 * answers the open one, with created false.
 */
export async function requestPayoutAccount(tournamentId?: string | null): Promise<ApiPayoutRequest> {
  const response = await fetch('/api/me/payout-request', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ tournamentId }),
  })
  return handleResponse(response)
}

/**
 * What GET /api/admin/members returns. A tournament_director receives only
 * the fields their read-only view renders (id, name, email, US Chess id,
 * membership status and expiry), so everything an admin alone can see is
 * optional here, and the members table reads those only under isAdmin.
 */
export interface ApiAdminMember
  extends Pick<ApiMember, 'id' | 'email' | 'full_name' | 'uscf_id' | 'membership_status' | 'membership_expiry'> {
  role?: string
  club_id?: string | null
  club_name?: string | null
  uscf_rating?: number | null
  uscf_rating_updated_at?: string | null
  created_at?: string
}

export async function updateMe(body: {
  fullName?: string
  uscfId?: string | null
}): Promise<ApiMember> {
  const response = await fetch('/api/me', {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  })
  const data = await handleResponse<{ member: ApiMember }>(response)
  return data.member
}

export async function lookupUscfRating(uscfId: string): Promise<{
  uscfId: string
  rating: number | null
  name?: string | null
  upstreamUnavailable?: boolean
}> {
  const response = await fetch(
    `/api/uscf/lookup?id=${encodeURIComponent(uscfId)}`,
  )
  // 503 = US Chess unreachable: degrade to "no prefill" rather than throwing,
  // matching how the manage page treats an unavailable lookup.
  if (response.status === 503) {
    return { uscfId, rating: null, name: null, upstreamUnavailable: true }
  }
  const data = await handleResponse<{
    upstreamUnavailable: boolean
    player: { rating: number | null; fullName: string | null } | null
  }>(response)
  return {
    uscfId,
    rating: data.player?.rating ?? null,
    name: data.player?.fullName ?? null,
    upstreamUnavailable: data.upstreamUnavailable,
  }
}

// --- Admin API ---

export async function adminGetMembers(): Promise<ApiAdminMember[]> {
  const response = await fetch('/api/admin/members', {
    headers: await authHeaders(),
  })
  const data = await handleResponse<{ members: ApiAdminMember[] }>(response)
  return data.members
}

export async function adminUpdateMemberName(
  memberId: string,
  fullName: string,
): Promise<ApiMember> {
  const response = await fetch(`/api/admin/members/${memberId}/name`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify({ fullName }),
  })
  const data = await handleResponse<{ member: ApiMember }>(response)
  return data.member
}

export async function adminUpdateMemberRole(
  memberId: string,
  role: string,
): Promise<ApiMember> {
  const response = await fetch(`/api/admin/members/${memberId}/role`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify({ role }),
  })
  const data = await handleResponse<{ member: ApiMember }>(response)
  return data.member
}

export async function adminUpdateMemberClub(
  memberId: string,
  clubId: string | null,
): Promise<ApiMember> {
  const response = await fetch(`/api/admin/members/${memberId}/club`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify({ clubId }),
  })
  const data = await handleResponse<{ member: ApiMember }>(response)
  return data.member
}

export async function adminUpdateMemberMembership(
  memberId: string,
  body: { membershipStatus?: string; membershipExpiry?: string | null },
): Promise<ApiMember> {
  const response = await fetch(`/api/admin/members/${memberId}/membership`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  })
  const data = await handleResponse<{ member: ApiMember }>(response)
  return data.member
}

export async function createMembershipCheckout(tier: string): Promise<{
  paymentId: string
  tier: string
  amount: number
  paymentUrl: string
  successUrl: string
}> {
  const response = await fetch('/api/membership/checkout', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ tier }),
  })
  return handleResponse(response)
}

/**
 * Checks one payment, or with no id the member's latest membership payment,
 * so the profile can answer "what is going on?" from any device. The answer's
 * shape, and the words for each state, live in paymentState.ts: the barrel
 * '@/lib/api' exports exactly what it did before the split (api-exports.test.ts).
 */
export async function confirmMembership(paymentId?: string | null): Promise<{
  member: ApiMember
  tier?: string | null
  paymentId?: string
  /** When the payment was started, as the database stores it (UTC, "YYYY-MM-DD HH:MM:SS"). */
  startedAt?: string
  /** 'paid' is the only state in which the membership is active; the rest say nothing was charged, or that the answer is not in yet. */
  paymentState: 'paid' | 'processing' | 'open' | 'expired' | 'unknown' | 'none'
  /** The Stripe page to finish paying on, only while the checkout is still open. */
  paymentUrl?: string
  alreadyConfirmed?: boolean
  pending?: boolean
}> {
  const response = await fetch('/api/membership/confirm', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(paymentId ? { paymentId } : {}),
  })
  return handleResponse(response)
}

export async function createDonationCheckout(amount: number): Promise<{ paymentId: string; paymentUrl: string }> {
  // Anyone may donate, but sending the session lets the server attribute the
  // payment to a signed-in member. The client no longer states who it is:
  // the server reads that from the token.
  const response = await fetch('/api/donations/checkout', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ amount }),
  })
  return handleResponse(response)
}

export async function adminDeleteMember(memberId: string): Promise<void> {
  const response = await fetch(`/api/admin/members/${memberId}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  })
  return handleResponse(response)
}

// ── Member export (admins and observers) ───────────────────────────────────

export interface MemberExportOptions {
  type: 'emails' | 'full'
  who: 'all' | 'current' | 'lapsed'
  children?: boolean
}

function exportQuery(o: MemberExportOptions, extra = ''): string {
  return `type=${o.type}&who=${o.who}${o.children ? '&children=1' : ''}${extra}`
}

/** The CSV as a file to save, with how many rows it holds. */
export async function adminExportMembers(o: MemberExportOptions): Promise<{ blob: Blob; filename: string; count: number }> {
  const response = await fetch(`/api/admin/members/export?${exportQuery(o)}`, { headers: await authHeaders() })
  if (!response.ok) await handleResponse(response)
  const name = /filename="([^"]+)"/.exec(response.headers.get('Content-Disposition') ?? '')?.[1] ?? 'lca-members.csv'
  return { blob: await response.blob(), filename: name, count: Number(response.headers.get('X-Row-Count') ?? 0) }
}

/** Just the email addresses, one per line, for pasting into an email's BCC. */
export async function adminExportEmailList(o: MemberExportOptions): Promise<string[]> {
  const response = await fetch(`/api/admin/members/export?${exportQuery({ ...o, type: 'emails' }, '&format=list')}`, { headers: await authHeaders() })
  if (!response.ok) await handleResponse(response)
  return (await response.text()).split('\n').filter(Boolean)
}

// ── A member's email choices, from a link in optional email (WS16 step 5) ──
// The unsubscribe page and the email preferences page call these. Both
// endpoints are public and signed: the person and the list come from the
// token alone, so no call here sends a sign-in header, even for a person who
// is signed in, and the token goes to these two endpoints and nowhere else.
// A link that does not open answers 404 "This link isn't working.".

/** What GET /api/mail/unsubscribe/:token answers a request that asks for JSON: the list's name (unsubscribeLinkResponseSchema). */
export type ApiUnsubscribeLink = UnsubscribeLinkResponse

/** What POST /api/mail/unsubscribe/:token answers: done, the list's name and a preferences token to link on with (unsubscribeResponseSchema). */
export type ApiUnsubscribed = UnsubscribeResponse

/** What GET and PATCH /api/mail/preferences/:token answer: the masked address, each list on or off, and the stop-all (emailChoicesResponseSchema). */
export type ApiEmailChoices = EmailChoicesResponse

/** The list an unsubscribe link leaves, read with the GET that asks for JSON, which changes nothing. */
export async function unsubscribeLinkStatus(token: string): Promise<ApiUnsubscribeLink> {
  const response = await fetch(`/api/mail/unsubscribe/${encodeURIComponent(token)}`, {
    headers: { Accept: 'application/json' },
  })
  return handleResponse(response)
}

/** The unsubscribe page's one press: the one-click unsubscribe, sent with an empty JSON body. */
export async function unsubscribeByLink(token: string): Promise<ApiUnsubscribed> {
  const response = await fetch(`/api/mail/unsubscribe/${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: '{}',
  })
  return handleResponse(response)
}

/** The person's email choices, as the preferences page shows them. */
export async function getEmailChoices(token: string): Promise<ApiEmailChoices> {
  const response = await fetch(`/api/mail/preferences/${encodeURIComponent(token)}`, {
    headers: { Accept: 'application/json' },
  })
  return handleResponse(response)
}

/** Saves a change to the person's choices: lists turned on or off by id, and the stop-all. Answers the choices as saved. */
export async function saveEmailChoices(token: string, change: { lists?: Record<string, boolean>; optionalOff?: boolean }): Promise<ApiEmailChoices> {
  const response = await fetch(`/api/mail/preferences/${encodeURIComponent(token)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(change),
  })
  return handleResponse(response)
}
