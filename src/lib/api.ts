import { supabase } from '@/lib/supabase'

export interface ApiMember {
  id: string
  email: string
  full_name: string
  uscf_id: string | null
  membership_status: 'active' | 'expired' | 'pending'
  membership_expiry: string | null
  role: string
  club_id: string | null
  created_at: string
}

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
}

async function authHeaders(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`
  }

  return headers
}

async function handleResponse<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T & { error?: string }
  if (!response.ok) {
    throw new Error(data.error ?? `Request failed (${response.status})`)
  }
  return data
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
}> {
  const response = await fetch('/api/me', {
    headers: await authHeaders(),
  })
  return handleResponse(response)
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

export async function getClubs(): Promise<
  Array<{ id: string; name: string; city: string; meeting_schedule: string }>
> {
  const response = await fetch('/api/clubs')
  const data = await handleResponse<{
    clubs: Array<{ id: string; name: string; city: string; meeting_schedule: string }>
  }>(response)
  return data.clubs
}

export async function getClub(id: string) {
  const response = await fetch(`/api/clubs/${id}`)
  return handleResponse(response)
}

export async function getTournaments() {
  const response = await fetch('/api/tournaments')
  return handleResponse<{ tournaments: unknown[] }>(response)
}

export async function getTournament(id: string) {
  const response = await fetch(`/api/tournaments/${id}`)
  return handleResponse(response)
}
