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

export interface ApiClubListItem {
  id: string
  name: string
  city: string
  meeting_schedule: string
}

export interface ApiClubDetail {
  id: string
  name: string
  city: string
  location: string | null
  description: string | null
  meeting_schedule: string | null
  contact_email: string | null
  created_at: string
}

export interface ApiClubOfficer {
  role: string
  full_name: string
  email: string
}

export interface ApiClubTournament {
  id: string
  name: string
  date: string
  status: string
}

export interface ApiClubNews {
  id: string
  title: string
  news_date: string
  excerpt: string
}

export type TournamentStatus = 'upcoming' | 'active' | 'completed'

export interface ApiTournamentSection {
  name: string
  entryFee: number
  prizeFund?: string
}

export interface ApiTournamentListItem {
  id: string
  name: string
  date: string
  location: string
  entry_fee: number
  sections: string[]
  status: TournamentStatus
}

export interface ApiTournamentDetail {
  id: string
  name: string
  date: string
  location: string
  venue: string | null
  entry_fee: number
  sections: ApiTournamentSection[]
  rounds: number
  max_players: number | null
  status: TournamentStatus
  description: string | null
  registration_deadline: string | null
  club_id: string | null
  created_by: string | null
  created_at: string
}

export interface ApiRosterPlayer {
  section: string
  payment_status: string
  full_name: string
  uscf_id: string | null
}

export async function getClubs(): Promise<ApiClubListItem[]> {
  const response = await fetch('/api/clubs')
  const data = await handleResponse<{ clubs: ApiClubListItem[] }>(response)
  return data.clubs
}

export async function getClub(id: string): Promise<{
  club: ApiClubDetail
  officers: ApiClubOfficer[]
  tournaments: ApiClubTournament[]
  news: ApiClubNews[]
}> {
  const response = await fetch(`/api/clubs/${id}`)
  return handleResponse(response)
}

export async function getTournaments(): Promise<ApiTournamentListItem[]> {
  const response = await fetch('/api/tournaments')
  const data = await handleResponse<{ tournaments: ApiTournamentListItem[] }>(
    response,
  )
  return data.tournaments
}

export async function getTournament(id: string): Promise<{
  tournament: ApiTournamentDetail
  roster: ApiRosterPlayer[]
}> {
  const response = await fetch(`/api/tournaments/${id}`)
  return handleResponse(response)
}
