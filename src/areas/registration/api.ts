// src/areas/registration/api.ts
//
// The registration area's calls to the site's API: entries (one player, a
// family or a walk-in), byes, paying, the waitlist, reminders and the
// registration settings.
//
// Moved whole from src/lib/api.ts by scripts/split-api.ts, following
// scripts/moves/api-split.json. src/lib/api.ts re-exports everything here,
// so pages and components may keep importing from '@/lib/api'. A type
// another area owns is imported from that area's api.ts, never from
// '@/lib/api', which re-exports this file.

import { authHeaders, handleResponse } from '@/lib/http'

export interface ApiRegistration {
  id: string
  tournament_id: string
  member_id: string
  section: string
  payment_status: 'paid' | 'pending' | 'refunded'
  registered_at: string
  tournament_name?: string
  tournament_date?: string
  tournament_location?: string
  /** Who the entry is for — set when it may be one of the member's children. */
  player_name?: string
  is_child_entry?: number
  withdrawn_at?: string | null
  waitlisted_at?: string | null
}

export interface ApiMyRegistration {
  id: string
  tournament_id: string
  member_id: string
  section: string
  payment_status: string
  bye_rounds: number[]
  registered_at: string
  withdrawn_at?: string | null
  checked_in_at?: string | null
  waitlisted_at?: string | null
  /** Grade range the player confirmed, "min-max" (K = 0). */
  grade?: string | null
}

export async function createRegistration(
  tournamentId: string,
  section: string,
  byeRounds: number[] = [],
  extra: { gradeRange?: string | null; waitlist?: boolean } = {},
): Promise<{
  registration: ApiRegistration & { waitlisted?: boolean }
  payment?: { id: string; amount: number; status: string }
  paymentUrl: string | null
  message: string
  warnings?: string[]
}> {
  const response = await fetch('/api/registrations', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ tournamentId, section, byeRounds, gradeRange: extra.gradeRange ?? undefined, waitlist: extra.waitlist || undefined }),
  })
  return handleResponse(response)
}

/** Director: move a waitlisted player into the event. */
export async function offerWaitlistSpot(
  tournamentId: string,
  registrationId: string,
): Promise<{ success: boolean; amount: number }> {
  const response = await fetch(`/api/admin/tournaments/${tournamentId}/waitlist`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ registrationId }),
  })
  return handleResponse(response)
}

/** Register several players (you and/or your children) in one checkout. */
export async function createBatchRegistration(
  tournamentId: string,
  entries: Array<{ memberId?: string; section: string; byeRounds?: number[]; gradeRange?: string | null }>,
): Promise<{
  registrations: Array<{ id: string; memberId: string; section: string; amount: number; paymentStatus: string }>
  total: number
  paymentUrl: string | null
  message: string
}> {
  const response = await fetch('/api/registrations/batch', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ tournamentId, entries }),
  })
  return handleResponse(response)
}

export interface UpdateRegistrationResult {
  registration: ApiMyRegistration
  feeNote: string | null
}

export async function updateRegistration(
  registrationId: string,
  body: {
    byeRounds?: number[]
    section?: string
    paymentStatus?: 'paid' | 'pending' | 'refunded'
    withdrawn?: boolean
    checkedIn?: boolean
  },
): Promise<UpdateRegistrationResult> {
  const response = await fetch(`/api/registrations/${registrationId}`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  })
  return handleResponse<UpdateRegistrationResult>(response)
}

export async function updateRegistrationByes(
  registrationId: string,
  byeRounds: number[],
): Promise<void> {
  await updateRegistration(registrationId, { byeRounds })
}

export async function payRegistration(
  registrationId: string,
): Promise<{ paymentUrl: string }> {
  const response = await fetch(`/api/registrations/${registrationId}/pay`, {
    method: 'POST',
    headers: await authHeaders(),
  })
  return handleResponse(response)
}

export async function adminAddWalkIn(
  tournamentId: string,
  body: {
    fullName: string
    uscfId?: string | null
    uscfRating?: number | null
    section: string
    markPaid?: boolean
  },
): Promise<{ registration: ApiRegistration; guestId: string }> {
  const response = await fetch(`/api/admin/tournaments/${tournamentId}/walk-ins`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  })
  return handleResponse(response)
}

// ── Tournament reminders ─────────────────────────────────────────

export async function getTournamentReminderStatus(
  tournamentId: string,
): Promise<{ opted_in: boolean }> {
  const response = await fetch(`/api/tournaments/${tournamentId}/remind`, {
    headers: await authHeaders(),
  })
  return handleResponse(response)
}

export async function optInTournamentReminder(
  tournamentId: string,
): Promise<void> {
  const response = await fetch(`/api/tournaments/${tournamentId}/remind`, {
    method: 'POST',
    headers: await authHeaders(),
  })
  return handleResponse(response)
}

export async function optOutTournamentReminder(
  tournamentId: string,
): Promise<void> {
  const response = await fetch(`/api/tournaments/${tournamentId}/remind`, {
    method: 'DELETE',
    headers: await authHeaders(),
  })
  return handleResponse(response)
}

export async function updateTournamentRegistration(
  tournamentId: string,
  data: {
    registration_status?: 'draft' | 'open' | 'closed'
    registration_opens_at?: string | null
    reminder_1_days_before?: number
    reminder_1_enabled?: boolean
    reminder_2_days_before?: number
    reminder_2_enabled?: boolean
  },
): Promise<void> {
  const response = await fetch(
    `/api/admin/tournaments/${tournamentId}/registration`,
    {
      method: 'PATCH',
      headers: await authHeaders(),
      body: JSON.stringify(data),
    },
  )
  return handleResponse(response)
}
