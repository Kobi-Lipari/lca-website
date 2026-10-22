// src/areas/households/api.ts
//
// The households area's calls to the site's API: the children on a family account.
//
// Moved whole from src/lib/api.ts by scripts/split-api.ts, following
// scripts/moves/api-split.json. src/lib/api.ts re-exports everything here,
// so pages and components may keep importing from '@/lib/api'. A type
// another area owns is imported from that area's api.ts, never from
// '@/lib/api', which re-exports this file.

import { authHeaders, handleResponse } from '@/lib/http'

/** A child on a family account: a profile the parent manages, no login. */
export interface ApiChild {
  id: string
  full_name: string
  uscf_id: string | null
  uscf_rating: number | null
  membership_status: 'active' | 'expired' | 'pending'
  membership_expiry: string | null
  membership_type: string | null
  created_at: string
  /** US Chess membership expiry, from the nightly check. */
  uscf_expiration?: string | null
  /** Present when listed for a specific tournament (?tournamentId=). */
  registration?: {
    id: string
    section: string
    payment_status: string
    withdrawn_at: string | null
    waitlisted_at?: string | null
  } | null
}

// ── Family accounts ─────────────────────────────────────────────────────────

export async function getMyChildren(tournamentId?: string): Promise<ApiChild[]> {
  // An empty tournamentId means "just the list" — kept in one literal so the
  // route audit can see which endpoint this calls.
  const response = await fetch(`/api/me/children?tournamentId=${encodeURIComponent(tournamentId ?? '')}`, {
    headers: await authHeaders(),
  })
  const data = await handleResponse<{ children: ApiChild[] }>(response)
  return data.children
}

export async function addChild(body: { fullName: string; uscfId?: string | null }): Promise<ApiChild[]> {
  const response = await fetch('/api/me/children', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  })
  const data = await handleResponse<{ children: ApiChild[] }>(response)
  return data.children
}

export async function updateChild(
  childId: string,
  body: { fullName?: string; uscfId?: string | null },
): Promise<ApiChild[]> {
  const response = await fetch(`/api/me/children/${childId}`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  })
  const data = await handleResponse<{ children: ApiChild[] }>(response)
  return data.children
}

export async function removeChild(childId: string): Promise<ApiChild[]> {
  const response = await fetch(`/api/me/children/${childId}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  })
  const data = await handleResponse<{ children: ApiChild[] }>(response)
  return data.children
}
