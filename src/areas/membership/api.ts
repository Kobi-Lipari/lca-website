// src/areas/membership/api.ts
//
// The membership area's calls to the site's API: the signed-in member,
// joining and renewing, donations, the US Chess rating lookup, and the
// admin member list and export.
//
// Moved whole from src/lib/api.ts by scripts/split-api.ts, following
// scripts/moves/api-split.json. src/lib/api.ts re-exports everything here,
// so pages and components may keep importing from '@/lib/api'. A type
// another area owns is imported from that area's api.ts, never from
// '@/lib/api', which re-exports this file.

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
  membership_status: 'active' | 'expired' | 'pending'
  membership_expiry: string | null
  /** 'family' for a family membership; null if never bought. */
  membership_type?: string | null
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
 * What GET /api/admin/members returns. A tournament_director receives only
 * the fields their read-only view renders — id, name, email, USCF id,
 * membership status and expiry — so everything an admin alone can see is
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
  // payment to a signed-in member. The client no longer states who it is —
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
