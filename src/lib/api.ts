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
  color: string
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
  color: string
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
  sections: Array<string | { name: string; entryFee: number }>
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
  registration_status: string
  registration_closes_at: string | null
  club_id: string | null
  created_by: string | null
  created_at: string
  is_rated: number
  is_visible: number
  round_schedule: ApiRoundScheduleItem[]
  custom_details: ApiCustomDetail[]
  time_control: string | null
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
  isRated?: boolean
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
    color?: string | null
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
  byeRounds: number[] = [],
): Promise<{
  registration: ApiRegistration
  payment: { id: string; amount: number; status: string }
  paymentUrl: string
  message: string
}> {
  const response = await fetch('/api/registrations', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ tournamentId, section, byeRounds }),
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


// ── Contact ──────────────────────────────────────────────────────

export async function submitContact(data: {
  name: string
  email: string
  subject: string
  body: string
}): Promise<void> {
  const response = await fetch('/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
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

// ── Support tickets ──────────────────────────────────────────────

export interface ApiSupportTicket {
  id: string
  subject: string
  status: string
  created_at: string
  updated_at: string
  message_count: number
  last_message: string
}

export interface ApiSupportMessage {
  id: string
  ticket_id: string
  sender_type: string
  body: string
  created_at: string
}

export async function createSupportTicket(data: {
  name: string
  email: string
  subject: string
  body: string
}): Promise<{ ticketId: string }> {
  const response = await fetch('/api/support', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse(response)
}

export async function getMyTickets(): Promise<{
  tickets: ApiSupportTicket[]
}> {
  const response = await fetch('/api/support', {
    headers: await authHeaders(),
  })
  return handleResponse(response)
}

export async function getTicket(id: string): Promise<{
  ticket: ApiSupportTicket
  messages: ApiSupportMessage[]
}> {
  const response = await fetch(`/api/support/${id}`, {
    headers: await authHeaders(),
  })
  return handleResponse(response)
}

export async function replyToTicket(
  ticketId: string,
  body: string,
): Promise<void> {
  const response = await fetch(`/api/support/${ticketId}`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ body }),
  })
  return handleResponse(response)
}

export async function adminGetTickets(status?: string): Promise<{
  tickets: ApiSupportTicket[]
}> {
  const url = status ? `/api/admin/support?status=${status}` : '/api/admin/support'
  const response = await fetch(url, { headers: await authHeaders() })
  return handleResponse(response)
}

export async function adminUpdateTicket(
  ticketId: string,
  status: string,
): Promise<void> {
  const response = await fetch(`/api/admin/support/${ticketId}`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify({ status }),
  })
  return handleResponse(response)
}

export async function adminReplyToTicket(
  ticketId: string,
  body: string,
): Promise<void> {
  const response = await fetch(`/api/admin/support/${ticketId}`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ body }),
  })
  return handleResponse(response)
}

export async function adminGetTicket(id: string): Promise<{
  ticket: ApiSupportTicket
  messages: ApiSupportMessage[]
}> {
  const response = await fetch(`/api/admin/support/${id}`, {
    headers: await authHeaders(),
  })
  return handleResponse(response)
}

// Add to src/lib/api.ts

export async function adminDeleteMember(memberId: string): Promise<void> {
  const response = await fetch(`/api/admin/members/${memberId}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  })
  return handleResponse(response)
}

export async function adminDeleteTournament(tournamentId: string): Promise<void> {
  const response = await fetch(`/api/admin/tournaments/${tournamentId}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  })
  return handleResponse(response)
}

export async function adminDeleteClub(clubId: string): Promise<void> {
  const response = await fetch(`/api/admin/clubs/${clubId}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  })
  return handleResponse(response)
}

// Add to existing interfaces:

export interface ApiRoundScheduleItem {
  round: number
  date: string
  time: string
}

export interface ApiCustomDetail {
  title: string
  body: string
}

// Update ApiTournamentDetail to include new fields:
// (add these fields to the existing interface)
//   is_visible: number
//   round_schedule: ApiRoundScheduleItem[]
//   custom_details: ApiCustomDetail[]
//   registration_closes_at: string | null
//   myRegistration?: ApiMyRegistration | null

export interface ApiMyRegistration {
  id: string
  tournament_id: string
  member_id: string
  section: string
  payment_status: string
  bye_rounds: number[]
  registered_at: string
}

// Add these new API functions:

export async function updateRegistrationByes(
  registrationId: string,
  byeRounds: number[],
): Promise<void> {
  const response = await fetch(`/api/registrations/${registrationId}`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify({ byeRounds }),
  })
  return handleResponse(response)
}

export async function adminUpdateTournamentFull(
  id: string,
  body: {
    name?: string
    location?: string
    venue?: string | null
    date?: string
    endDate?: string | null
    entryFee?: number
    sections?: ApiTournamentSection[]
    rounds?: number
    maxPlayers?: number | null
    status?: TournamentStatus
    description?: string | null
    registrationDeadline?: string | null
    isRated?: boolean
    isVisible?: boolean
    roundSchedule?: ApiRoundScheduleItem[]
    registrationClosesAt?: string | null
    customDetails?: ApiCustomDetail[]
    timeControl: string | null
  },
): Promise<Record<string, unknown>> {
  const response = await fetch(`/api/admin/tournaments/${id}`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  })
  const data = await handleResponse<{ tournament: Record<string, unknown> }>(response)
  return data.tournament
}

// ── Governance types ──────────────────────────────────────────────────────────

export interface ApiBoardMember {
  id: string
  role: string
  name: string
  email: string | null
  sort_order: number
  created_at: string
}

export interface ApiGovernanceDocument {
  id: string
  category: 'bylaws' | 'rules' | 'minutes' | 'treasurer' | 'amendments'
  title: string
  filename: string | null
  file_url: string | null
  doc_date: string | null
  year: number | null
  created_at: string
}

// ── Board members ─────────────────────────────────────────────────────────────

export async function getBoardMembers(): Promise<ApiBoardMember[]> {
  const r = await fetch('/api/governance/board')
  const d = await handleResponse<{ members: ApiBoardMember[] }>(r)
  return d.members
}

export async function adminCreateBoardMember(body: Omit<ApiBoardMember, 'id' | 'created_at'>): Promise<ApiBoardMember> {
  const r = await fetch('/api/governance/board', { method: 'POST', headers: await authHeaders(), body: JSON.stringify(body) })
  const d = await handleResponse<{ member: ApiBoardMember }>(r)
  return d.member
}

export async function adminUpdateBoardMember(id: string, body: Partial<Omit<ApiBoardMember, 'id' | 'created_at'>>): Promise<ApiBoardMember> {
  const r = await fetch(`/api/governance/board/${id}`, { method: 'PUT', headers: await authHeaders(), body: JSON.stringify(body) })
  const d = await handleResponse<{ member: ApiBoardMember }>(r)
  return d.member
}

export async function adminDeleteBoardMember(id: string): Promise<void> {
  const r = await fetch(`/api/governance/board/${id}`, { method: 'DELETE', headers: await authHeaders() })
  await handleResponse(r)
}

// ── Governance documents ──────────────────────────────────────────────────────

export async function getGovernanceDocuments(category?: string): Promise<ApiGovernanceDocument[]> {
  const url = category ? `/api/governance/documents?category=${category}` : '/api/governance/documents'
  const r = await fetch(url)
  const d = await handleResponse<{ documents: ApiGovernanceDocument[] }>(r)
  return d.documents
}

export async function adminCreateGovernanceDocument(body: Omit<ApiGovernanceDocument, 'id' | 'created_at'>): Promise<ApiGovernanceDocument> {
  const r = await fetch('/api/governance/documents', { method: 'POST', headers: await authHeaders(), body: JSON.stringify(body) })
  const d = await handleResponse<{ document: ApiGovernanceDocument }>(r)
  return d.document
}

export async function adminUpdateGovernanceDocument(id: string, body: Partial<Omit<ApiGovernanceDocument, 'id' | 'created_at'>>): Promise<ApiGovernanceDocument> {
  const r = await fetch(`/api/governance/documents/${id}`, { method: 'PUT', headers: await authHeaders(), body: JSON.stringify(body) })
  const d = await handleResponse<{ document: ApiGovernanceDocument }>(r)
  return d.document
}

export async function adminDeleteGovernanceDocument(id: string): Promise<void> {
  const r = await fetch(`/api/governance/documents/${id}`, { method: 'DELETE', headers: await authHeaders() })
  await handleResponse(r)
}