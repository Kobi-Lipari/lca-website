import { supabase } from '@/lib/supabase'

export interface ApiMember {
  id: string
  email: string
  full_name: string
  uscf_id: string | null
  uscf_rating: number | null
  uscf_rating_updated_at: string | null
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
  directedTournaments: ApiDirectedTournament[]
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

export interface ApiAdminMember extends ApiMember {
  club_name?: string | null
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
  rounds: number
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
  member_id: string
  section: string
  payment_status: string
  full_name: string
  uscf_id: string | null
  uscf_rating: number | null
}

export interface ApiTournamentPairing {
  id: string
  tournament_id: string
  round: number
  board: number
  section: string
  white_member_id: string | null
  black_member_id: string | null
  result: string
  white_name?: string
  black_name?: string
  white_rating?: number | null
  black_rating?: number | null
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
  pairings: ApiTournamentPairing[]
}> {
  const response = await fetch(`/api/tournaments/${id}`)
  return handleResponse(response)
}

export async function lookupUscfRating(uscfId: string): Promise<{
  uscfId: string
  rating: number | null
  name?: string | null
  cached?: boolean
}> {
  const response = await fetch(`/api/uscf/${encodeURIComponent(uscfId)}`)
  return handleResponse(response)
}

// --- Admin API ---

export async function adminGetMembers(): Promise<ApiAdminMember[]> {
  const response = await fetch('/api/admin/members', {
    headers: await authHeaders(),
  })
  const data = await handleResponse<{ members: ApiAdminMember[] }>(response)
  return data.members
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

export async function adminCreateTournament(body: {
  name: string
  location: string
  date: string
  entryFee: number
  venue?: string | null
  endDate?: string | null
  sections?: ApiTournamentSection[]
  rounds?: number
  maxPlayers?: number | null
  status?: TournamentStatus
  description?: string | null
  registrationDeadline?: string | null
  clubId?: string | null
}): Promise<Record<string, unknown>> {
  const response = await fetch('/api/admin/tournaments', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  })
  const data = await handleResponse<{ tournament: Record<string, unknown> }>(
    response,
  )
  return data.tournament
}

export async function adminUpdateTournament(
  id: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const response = await fetch(`/api/admin/tournaments/${id}`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  })
  const data = await handleResponse<{ tournament: Record<string, unknown> }>(
    response,
  )
  return data.tournament
}

export async function adminUpdateClub(
  id: string,
  body: {
    name?: string
    city?: string
    location?: string | null
    description?: string | null
    meetingSchedule?: string | null
    contactEmail?: string | null
  },
): Promise<ApiClubDetail> {
  const response = await fetch(`/api/admin/clubs/${id}`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  })
  const data = await handleResponse<{ club: ApiClubDetail }>(response)
  return data.club
}

export async function adminCreateClubNews(
  clubId: string,
  body: { title: string; newsDate: string; excerpt: string },
): Promise<ApiClubNews> {
  const response = await fetch(`/api/admin/clubs/${clubId}/news`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  })
  const data = await handleResponse<{ news: ApiClubNews }>(response)
  return data.news
}

export async function adminGetClubRoster(clubId: string) {
  const response = await fetch(`/api/admin/clubs/${clubId}/roster`, {
    headers: await authHeaders(),
  })
  const data = await handleResponse<{ roster: ApiAdminMember[] }>(response)
  return data.roster
}

export async function adminAssignTournamentDirector(
  tournamentId: string,
  memberId: string,
) {
  const response = await fetch(
    `/api/admin/tournaments/${tournamentId}/directors`,
    {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ memberId }),
    },
  )
  return handleResponse(response)
}

export interface ApiTournamentGame {
  id: string
  tournament_id: string
  round: number
  board: number
  section: string
  white_member_id: string | null
  black_member_id: string | null
  result: string
  white_name?: string
  black_name?: string
}

export interface ApiStanding {
  member_id: string
  full_name: string
  section: string
  score: number
  wins: number
  draws: number
  losses: number
}

export async function adminGetTournamentManage(tournamentId: string) {
  const response = await fetch(`/api/admin/tournaments/${tournamentId}/manage`, {
    headers: await authHeaders(),
  })
  return handleResponse<{
    tournament: ApiTournamentDetail
    roster: Array<{
      member_id: string
      section: string
      full_name: string
      uscf_id: string | null
      payment_status: string
    }>
    games: ApiTournamentGame[]
    standings: ApiStanding[]
    directors: Array<{ member_id: string; full_name: string; email: string }>
  }>(response)
}

export async function adminCreatePairings(
  tournamentId: string,
  body: {
    round: number
    section: string
    pairings: Array<{
      board?: number
      whiteMemberId?: string | null
      blackMemberId?: string | null
    }>
  },
) {
  const response = await fetch(`/api/admin/tournaments/${tournamentId}/games`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  })
  return handleResponse<{ games: ApiTournamentGame[] }>(response)
}

export async function adminGeneratePairings(
  tournamentId: string,
  body: { round: number; section: string },
) {
  const response = await fetch(
    `/api/admin/tournaments/${tournamentId}/generate-pairings`,
    {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(body),
    },
  )
  return handleResponse<{
    round: number
    section: string
    pairings: ApiTournamentGame[]
    count: number
  }>(response)
}

export async function adminUpdateGameResult(
  tournamentId: string,
  gameId: string,
  result: string,
) {
  const response = await fetch(
    `/api/admin/tournaments/${tournamentId}/games/${gameId}`,
    {
      method: 'PATCH',
      headers: await authHeaders(),
      body: JSON.stringify({ result }),
    },
  )
  return handleResponse<{ game: ApiTournamentGame }>(response)
}

export async function createRegistration(
  tournamentId: string,
  section: string,
): Promise<{
  registration: ApiRegistration
  payment: { id: string; amount: number; status: string }
  paymentUrl: string
  message: string
}> {
  const response = await fetch('/api/registrations', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ tournamentId, section }),
  })
  return handleResponse(response)
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

export async function confirmMembership(paymentId: string): Promise<{
  member: ApiMember
  tier?: string
  alreadyConfirmed?: boolean
}> {
  const response = await fetch('/api/membership/confirm', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ paymentId }),
  })
  return handleResponse(response)
}
