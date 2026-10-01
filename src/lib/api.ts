// src/lib/api.ts

import { supabase } from '@/lib/supabase'
import type { RawScan } from '@/lib/scanner/types'

export interface ApiMember {
  id: string
  email: string
  full_name: string
  uscf_id: string | null
  uscf_rating: number | null
  uscf_rating_updated_at: string | null
  membership_status: 'active' | 'expired' | 'pending'
  membership_expiry: string | null
  /** US Chess membership expiry, from the nightly sync. */
  uscf_expiration?: string | null
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
  /** Who the entry is for — set when it may be one of the member's children. */
  player_name?: string
  is_child_entry?: number
  withdrawn_at?: string | null
  waitlisted_at?: string | null
}

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
  /** Present when listed for a specific tournament (?tournamentId=). */
  registration?: {
    id: string
    section: string
    payment_status: string
    withdrawn_at: string | null
    waitlisted_at?: string | null
  } | null
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

/** Carries the HTTP status so callers can tell "your session died" (401)
 *  apart from "the server broke" (5xx) and react differently. */
export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  let data: T & { error?: string }
  try {
    data = (await response.json()) as T & { error?: string }
  } catch {
    // A non-JSON body — an HTML error page from the edge, say. Parsing it
    // blind surfaces "Unexpected token '<'" to the member, which tells them
    // nothing; the status is the part that actually matters.
    throw new ApiError(
      response.ok
        ? 'The server returned an unreadable response.'
        : `Request failed (${response.status})`,
      response.status,
    )
  }

  if (!response.ok) {
    throw new ApiError(
      data.error ?? `Request failed (${response.status})`,
      response.status,
    )
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
  image_url: string | null
  region: string | null
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
  /** Entry rules; see lib/sectionRules. Absent = taken from the name. */
  ratingMax?: number | null
  ratingMin?: number | null
  unratedOk?: boolean
  gradeMin?: number | null
  gradeMax?: number | null
  rulesSet?: boolean
  prizes?: ApiSectionPrizes
}

export interface ApiPrizeSlot {
  amount?: number
  label?: string
}

export interface ApiPrizeClass {
  label: string
  ratingMax?: number | null
  ratingMin?: number | null
  unratedOnly?: boolean
  unratedOk?: boolean
  gradeMin?: number | null
  gradeMax?: number | null
  prizes: ApiPrizeSlot[]
}

export interface ApiSectionPrizes {
  place?: ApiPrizeSlot[]
  classes?: ApiPrizeClass[]
}

/** One player's prize, worked out by the server (functions/utils/prizes). */
export interface ApiPrizeAward {
  member_id: string
  section: string
  prize: string
  cash: number
  items: string[]
}

/**
 * A tournament as the list endpoints return it.
 *
 * /api/tournaments selects t.* plus the joined club colour and name, so the
 * response has always carried far more than the eight fields this used to
 * declare. Pages needing registration_status or club_color reached for a
 * cast to any to get at them, which is how a type that under-declares its
 * own response spreads casts through every caller.
 *
 * Optional fields are the ones a row may genuinely leave null, not fields
 * whose presence is uncertain.
 */
export interface ApiTournamentListItem {
  id: string
  name: string
  date: string
  end_date?: string | null
  location: string
  venue?: string | null
  entry_fee: number
  sections: Array<string | { name: string; entryFee: number }>
  rounds: number
  status: TournamentStatus
  registration_status?: string | null
  registration_opens_at?: string | null
  registration_closes_at?: string | null
  registration_url?: string | null
  max_players?: number | null
  description?: string | null
  eligibility?: string | null
  organizer?: string | null
  time_control?: string | null
  /** Raw stored JSON string on the list endpoint (not parsed there). */
  custom_details?: unknown
  is_rated?: number
  is_visible?: number
  club_id?: string | null
  /** Joined from clubs, not a column on tournaments. */
  club_name?: string | null
  club_color?: string | null
}

export interface ApiRoundScheduleItem {
  round: number
  date: string
  time: string
}

export interface ApiCustomDetail {
  title: string
  body: string
  color?: string | null
  image_url?: string | null
  region?: string | null
}

export interface ApiClubListItem {
  id: string
  name: string
  city: string
  meeting_schedule: string
  color: string | null
  image_url: string | null
  region: string | null
}

export interface ApiTournamentDetail {
  id: string
  name: string
  /** 'uscf' (default) or 'fide' */
  pairing_system?: 'uscf' | 'fide'
  /** 1 = accelerated pairings in rounds 1–2 */
  accelerated?: number
  keep_apart?: 'family' | 'family_club' | 'none'
  date: string
  end_date: string | null
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
  early_deadline?: string | null
  early_discount?: number | null
  late_after?: string | null
  late_fee?: number | null
  member_discount?: number | null
  waitlist_count?: number
}

export interface ApiRosterPlayer {
  member_id: string
  section: string
  withdrawn_at: string | null
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

export interface ApiStanding {
  member_id: string
  full_name: string
  section: string
  rating: number | null
  score: number
  wins: number
  draws: number
  losses: number
  /** Place in the section; tied players share it. */
  place: number
  /** "3" or "3-5" for a shared place. */
  placeLabel: string
  tiebreaks: {
    modifiedMedian: number
    solkoff: number
    cumulative: number
    oppCumulative: number
    blacks: number
  }
}

export async function getClubs(): Promise<ApiClubListItem[]> {
  const response = await fetch('/api/clubs')
  const data = await handleResponse<{ clubs: ApiClubListItem[] }>(response)
  return data.clubs
}

export interface ApiNewsItem {
  id: string
  club_id: string
  club_name: string
  club_color: string | null
  title: string
  news_date: string
  excerpt: string
}

/** Aggregate club-news feed for the News page, newest first. */
export async function getNews(): Promise<ApiNewsItem[]> {
  const response = await fetch('/api/news')
  const data = await handleResponse<{ news: ApiNewsItem[] }>(response)
  return data.news
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
  standings: ApiStanding[]
  /** Published once the event is finished. */
  prizes?: ApiPrizeAward[]
  myRegistration?: ApiMyRegistration | null
}> {
  const response = await fetch(`/api/tournaments/${id}`)
  return handleResponse(response)
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
  timeControl?: string | null
  registrationClosesAt?: string | null
  customDetails?: ApiCustomDetail[]
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

/**
 * Single wrapper for PATCH /api/admin/tournaments/:id.
 * (Consolidates the former untyped `adminUpdateTournament` and
 * `adminUpdateTournamentFull` — same route, one typed body.)
 *
 * Every field is optional: the backend uses field-present semantics
 * (undefined = keep existing, explicit null = clear), so callers should
 * send ONLY the keys that changed.
 */
export async function adminUpdateTournament(
  id: string,
  body: {
    pairingSystem?: 'uscf' | 'fide'
    accelerated?: boolean
    keepApart?: 'family' | 'family_club' | 'none'
    /** US Chess upload details (lib/uschessUpload UploadSettings). */
    reportSettings?: Record<string, unknown> | null
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
    timeControl?: string | null
    earlyDeadline?: string | null
    earlyDiscount?: number | null
    lateAfter?: string | null
    lateFee?: number | null
    memberDiscount?: number | null
    /** lca_admin only; null detaches the event from its club. */
    clubId?: string | null
  },
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
    imageUrl?: string | null
    region?: string | null
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

/** An officer as the manage page sees it — member_id lets the UI match the roster. */
export interface ApiAdminClubOfficer {
  id: string
  member_id: string
  role: string
  full_name: string
  email: string
}

/** A club tournament including hidden drafts, for the people who manage them. */
export interface ApiAdminClubTournament extends ApiClubTournament {
  end_date: string | null
  is_visible: number
  registration_status: string | null
}

/** GET /api/admin/clubs/:id — club reps (own club) and admins. */
export async function adminGetClub(id: string): Promise<{
  club: ApiClubDetail
  officers: ApiAdminClubOfficer[]
  roster: ApiAdminMember[]
  tournaments: ApiAdminClubTournament[]
}> {
  const response = await fetch(`/api/admin/clubs/${id}`, {
    headers: await authHeaders(),
  })
  return handleResponse(response)
}

export async function adminCreateClub(body: {
  name: string
  city: string
  region?: string | null
  contactEmail?: string | null
}): Promise<ApiClubDetail> {
  const response = await fetch('/api/admin/clubs', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  })
  const data = await handleResponse<{ club: ApiClubDetail }>(response)
  return data.club
}

export async function adminAddClubOfficer(
  clubId: string,
  body: { memberId: string; title: string },
): Promise<ApiAdminClubOfficer[]> {
  const response = await fetch(`/api/admin/clubs/${clubId}/officers`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  })
  const data = await handleResponse<{ officers: ApiAdminClubOfficer[] }>(response)
  return data.officers
}

export async function adminRemoveClubOfficer(clubId: string, officerId: string): Promise<void> {
  const response = await fetch(`/api/admin/clubs/${clubId}/officers/${officerId}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  })
  await handleResponse(response)
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

export interface ApiTournamentDirector {
  tournament_id: string
  member_id: string
  assigned_at: string
  full_name: string
  email: string
}

export async function adminGetTournamentDirectors(
  tournamentId: string,
): Promise<ApiTournamentDirector[]> {
  const response = await fetch(
    `/api/admin/tournaments/${tournamentId}/directors`,
    { headers: await authHeaders() },
  )
  const data = await handleResponse<{ directors: ApiTournamentDirector[] }>(
    response,
  )
  return data.directors
}

export async function adminAssignTournamentDirector(
  tournamentId: string,
  memberId: string,
): Promise<ApiTournamentDirector[]> {
  const response = await fetch(
    `/api/admin/tournaments/${tournamentId}/directors`,
    {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ memberId }),
    },
  )
  const data = await handleResponse<{ directors: ApiTournamentDirector[] }>(
    response,
  )
  return data.directors
}

export async function adminRemoveTournamentDirector(
  tournamentId: string,
  memberId: string,
): Promise<ApiTournamentDirector[]> {
  const response = await fetch(
    `/api/admin/tournaments/${tournamentId}/directors`,
    {
      method: 'DELETE',
      headers: await authHeaders(),
      body: JSON.stringify({ memberId }),
    },
  )
  const data = await handleResponse<{ directors: ApiTournamentDirector[] }>(
    response,
  )
  return data.directors
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

export interface ApiManageRosterPlayer {
  registration_id: string
  member_id: string
  section: string
  payment_status: string
  bye_rounds: number[]
  withdrawn_at: string | null
  checked_in_at: string | null
  full_name: string
  uscf_id: string | null
  uscf_rating: number | null
  waitlisted_at?: string | null
  grade?: string | null
  uscf_expiration?: string | null
}

export async function adminGetTournamentManage(tournamentId: string) {
  const response = await fetch(`/api/admin/tournaments/${tournamentId}/manage`, {
    headers: await authHeaders(),
  })
  return handleResponse<{
    tournament: ApiTournamentDetail
    roster: ApiManageRosterPlayer[]
    games: ApiTournamentGame[]
    standings: ApiStanding[]
    prizes?: ApiPrizeAward[]
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
    confirmReplace?: boolean
  },
) {
  const response = await fetch(`/api/admin/tournaments/${tournamentId}/games`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  })
  return handleResponse<{ games: ApiTournamentGame[]; warnings: string[] }>(response)
}

export async function adminGeneratePairings(
  tournamentId: string,
  body: { round: number; section: string; onlyCheckedIn?: boolean; allowExtraRound?: boolean },
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
    /** Plain-language notes for the director (rematch, repeat bye, skipped players). */
    warnings: string[]
  }>(response)
}

export async function adminDeleteRoundPairings(
  tournamentId: string,
  round: number,
  section: string,
): Promise<{ deleted: number; round: number; section: string }> {
  const response = await fetch(
    `/api/admin/tournaments/${tournamentId}/rounds/${round}?section=${encodeURIComponent(section)}`,
    {
      method: 'DELETE',
      headers: await authHeaders(),
    },
  )
  return handleResponse(response)
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

// ── USCF rating report ───────────────────────────────────────────

export interface ApiRatingReportRound {
  round: number
  code: 'W' | 'L' | 'D' | 'X' | 'F' | 'B' | 'H' | 'U'
  opponentPairingNum: number | null
  color: 'W' | 'B' | null
}

export interface ApiRatingReportPlayer {
  pairingNum: number
  name: string
  uscfId: string | null
  preRating: number | null
  score: number
  rounds: ApiRatingReportRound[]
}

export interface ApiRatingReport {
  tournament: {
    name: string
    startDate: string
    endDate: string
    location: string
    rounds: number
    timeControl?: string | null
  }
  /** For the US Chess upload files: saved details and suggestions. */
  upload?: {
    settings: unknown
    suggested: {
      chiefTdId: string
      chiefTdName: string
      assistantTdId: string
      city: string
      state: string
      zip: string
    }
  }
  sections: Array<{ name: string; players: ApiRatingReportPlayer[] }>
  validationErrors: string[]
}

export async function adminGetRatingReport(
  tournamentId: string,
): Promise<ApiRatingReport> {
  const response = await fetch(
    `/api/admin/tournaments/${tournamentId}/rating-report`,
    { headers: await authHeaders() },
  )
  return handleResponse(response)
}

export async function adminAnnounce(
  tournamentId: string,
  body: { subject: string; body: string },
): Promise<{ sent: number; failed: number; total: number }> {
  const response = await fetch(`/api/admin/tournaments/${tournamentId}/announce`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
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

// ── Contact ──────────────────────────────────────────────────────

export interface ApiBoardSeat {
  id: string
  slug: string
  role: string
  category: 'officer' | 'regional_rep'
  sort_order: number
  /** 1 = may be held by several people at once (e.g. USCF Delegate). */
  is_shared: number
  /** Holders joined with ' & ', or the seat's fallback name when vacant. */
  holder_name: string
  /** 0 when nobody currently holds the seat. */
  holder_count: number
  /** Photo for a seat with no member linked. */
  photo_url?: string | null
  /** Current holders, with their photos. */
  holders?: Array<{ member_id: string; name: string; photo_url: string | null }>
}

/** Admin: upload an officer photo (already cropped square) for a member or an unlinked seat. */
export async function adminUploadOfficerPhoto(target: { member?: string; seat?: string }, blob: Blob): Promise<{ photoUrl: string }> {
  const headers = await authHeaders()
  const q = target.member ? `member=${encodeURIComponent(target.member)}` : `seat=${encodeURIComponent(target.seat ?? '')}`
  const response = await fetch(`/api/admin/officer-photo?${q}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'image/jpeg' },
    body: blob,
  })
  return handleResponse(response)
}

export async function adminRemoveOfficerPhoto(target: { member?: string; seat?: string }): Promise<void> {
  const q = target.member ? `member=${encodeURIComponent(target.member)}` : `seat=${encodeURIComponent(target.seat ?? '')}`
  const response = await fetch(`/api/admin/officer-photo?${q}`, { method: 'DELETE', headers: await authHeaders() })
  await handleResponse(response)
}
 
export async function getBoardSeats(): Promise<ApiBoardSeat[]> {
  const response = await fetch('/api/board/seats')
  const data = await handleResponse<{ seats: ApiBoardSeat[] }>(response)
  return data.seats
}
 
/**
 * Opens a support ticket, optionally routed to a board seat.
 *
 * authHeaders (not bare Content-Type): a logged-in submitter gets their
 * member_id bound to the ticket, which is what lets them reopen it from
 * /support later. Guests are unaffected — the Authorization header is only
 * added when a session exists, and the endpoint accepts anonymous requests.
 */
export async function submitContact(data: {
  name: string
  email: string
  subject: string
  body: string
  /** Seat slug, e.g. 'scholastic-director'. Omit for a general inquiry. */
  seatRef?: string
}): Promise<{ ticketId: string; routedTo: string | null }> {
  const response = await fetch('/api/contact', {
    method: 'POST',
    headers: await authHeaders(),
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
  /** Staff/board reference, e.g. 1042. Only admin and board endpoints return it. */
  number?: number | null
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
  // authHeaders (not bare Content-Type): logged-in creators get their
  // member_id bound to the ticket, which is what lets them open it later.
  // Guests are unaffected — the Authorization header is only added when a
  // session exists, and the endpoint accepts anonymous requests.
  const response = await fetch('/api/support', {
    method: 'POST',
    headers: await authHeaders(),
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

/** Permanently deletes a ticket and its messages (admins only). */
export async function adminDeleteTicket(ticketId: string): Promise<void> {
  const response = await fetch(`/api/admin/support/${ticketId}`, {
    method: 'DELETE',
    headers: await authHeaders(),
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

// ── Governance types ──────────────────────────────────────────────────────────

export interface ApiBoardMember {
  id: string
  role: string
  name: string
  email: string | null
  sort_order: number
  created_at: string
  slug: string
  category: 'officer' | 'regional_rep'
  is_active: number
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
  content: string | null
}

// ── Board members ─────────────────────────────────────────────────────────────

export async function getBoardMembers(): Promise<ApiBoardMember[]> {
  const r = await fetch('/api/governance/board')
  const d = await handleResponse<{ members: ApiBoardMember[] }>(r)
  return d.members
}

export async function adminCreateBoardMember(body: {
  role: string
  name: string
  email?: string | null
  sort_order?: number
}): Promise<ApiBoardMember> {
  const r = await fetch('/api/governance/board', { method: 'POST', headers: await authHeaders(), body: JSON.stringify(body) })
  const d = await handleResponse<{ member: ApiBoardMember }>(r)
  return d.member
}

export async function adminUpdateBoardMember(id: string, body: {
  role?: string
  name?: string
  email?: string | null
  sort_order?: number
}): Promise<ApiBoardMember> {
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

// ── Append to src/lib/api.ts ──────────────────────────────────────────────────
// Uses the same handleResponse<T>() helper already defined earlier in this file.

export interface CampaignFilter {
  all?: boolean
  roles?: string[]
  clubIds?: string[]
  membershipStatuses?: string[]
}

export interface ApiCampaign {
  id: string
  subject: string
  total_recipients: number
  sent_count: number
  failed_count: number
  status: 'sending' | 'completed' | 'failed'
  created_at: string
  completed_at: string | null
}

export async function getCampaigns(): Promise<ApiCampaign[]> {
  const response = await fetch('/api/admin/campaigns', {
    headers: await authHeaders(),
  })
  const data = await handleResponse<{ campaigns: ApiCampaign[] }>(response)
  return data.campaigns
}

export async function previewCampaignCount(
  filter: CampaignFilter,
): Promise<{ count: number; recipients: ApiCampaignRecipient[] }> {
  const response = await fetch('/api/admin/campaigns/preview', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ filter }),
  })
  return handleResponse(response)
}

export async function createCampaign(payload: {
  subject: string
  bodyHtml: string
  filter: CampaignFilter
  excludeMemberIds?: string[]
  includeMemberIds?: string[]
  /** Only the hand-picked people and typed-in addresses; ignore the filter. */
  onlySelected?: boolean
  /** Addresses that don't have an account. */
  extraEmails?: string[]
}): Promise<{ campaignId: string; totalRecipients: number; status: string }> {
  const response = await fetch('/api/admin/campaigns', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(payload),
  })
  return handleResponse(response)
}

export async function sendTestCampaignEmail(payload: {
  email: string
  subject: string
  bodyHtml: string
}): Promise<{ sent: true }> {
  const response = await fetch('/api/admin/campaigns/test', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(payload),
  })
  return handleResponse(response)
}

export interface ApiCampaignRecipient {
  id: string
  email: string
  full_name: string
}

export type AnnouncementTone = 'gold' | 'navy' | 'urgent' | 'info'
export type AnnouncementSize = 'default' | 'compact'

export interface ApiAnnouncement {
  id: string
  message: string
  linkUrl: string | null
  linkLabel: string | null
  tone: AnnouncementTone
  size: AnnouncementSize
}

/** Every banner that should be on screen now, in display order. */
export async function getAnnouncements(): Promise<{ announcements: ApiAnnouncement[] }> {
  const response = await fetch('/api/announcement')
  return handleResponse(response)
}

export interface ApiAdminAnnouncement {
  id: string
  enabled: number
  message: string
  link_url: string | null
  link_label: string | null
  tone: AnnouncementTone
  size: AnnouncementSize
  sort_order: number
  /** Both null means "on until switched off", which is how it used to work. */
  starts_at: string | null
  ends_at: string | null
  updated_at: string
}

export interface AnnouncementInput {
  enabled?: boolean
  message?: string
  linkUrl?: string | null
  linkLabel?: string | null
  tone?: AnnouncementTone
  size?: AnnouncementSize
  sortOrder?: number
  startsAt?: string | null
  endsAt?: string | null
}

export async function adminGetAnnouncements(): Promise<{ announcements: ApiAdminAnnouncement[] }> {
  const response = await fetch('/api/admin/announcement', { headers: await authHeaders() })
  return handleResponse(response)
}

export async function adminCreateAnnouncement(
  body: AnnouncementInput,
): Promise<{ announcement: ApiAdminAnnouncement }> {
  const response = await fetch('/api/admin/announcement', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  })
  return handleResponse(response)
}

export async function adminUpdateAnnouncement(
  id: string,
  body: AnnouncementInput,
): Promise<{ announcement: ApiAdminAnnouncement }> {
  const response = await fetch(`/api/admin/announcement/${id}`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  })
  return handleResponse(response)
}

export async function adminDeleteAnnouncement(id: string): Promise<void> {
  const response = await fetch(`/api/admin/announcement/${id}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  })
  await handleResponse(response)
}

export async function adminUploadClubLogo(clubId: string, blob: Blob): Promise<{ imageUrl: string }> {
  const headers = await authHeaders()
  const response = await fetch(`/api/admin/clubs/${clubId}/logo`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'image/jpeg' },
    body: blob,
  })
  return handleResponse(response)
}

export async function adminGetClubNews(clubId: string): Promise<ApiClubNews[]> {
  const response = await fetch(`/api/admin/clubs/${clubId}/news`, {
    headers: await authHeaders(),
  })
  const data = await handleResponse<{ news: ApiClubNews[] }>(response)
  return data.news
}

export async function adminDeleteClubNews(clubId: string, newsId: string): Promise<void> {
  const response = await fetch(`/api/admin/clubs/${clubId}/news/${newsId}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  })
  return handleResponse(response)
}

export interface ApiImpersonateResult {
  session: { access_token: string; refresh_token: string }
  member: { id: string; fullName: string; email: string }
}

export async function adminImpersonateMember(memberId: string): Promise<ApiImpersonateResult> {
  const response = await fetch(`/api/admin/impersonate/${memberId}`, {
    method: 'POST',
    headers: await authHeaders(),
  })
  return handleResponse(response)
}

/** Closes out the audit entry. Call with the admin's restored session. */
export async function adminEndImpersonation(
  targetMemberId: string | null,
): Promise<{ ok: true }> {
  const response = await fetch('/api/admin/impersonate/end', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ targetMemberId }),
  })
  return handleResponse(response)
}

export interface ApiAuditEntry {
  id: string
  actor_id: string
  actor_email: string
  action: string
  target_member_id: string | null
  target_label: string | null
  /** JSON string, shape depends on the action. */
  detail: string | null
  created_at: string
}

export async function adminGetAuditLog(params?: {
  action?: string
  limit?: number
}): Promise<ApiAuditEntry[]> {
  const query = new URLSearchParams()
  if (params?.action) query.set('action', params.action)
  if (params?.limit) query.set('limit', String(params.limit))

  const response = await fetch(`/api/admin/audit?${query}`, {
    headers: await authHeaders(),
  })
  const data = await handleResponse<{ entries: ApiAuditEntry[] }>(response)
  return data.entries
}

// ── Board seats (admin) ───────────────────────────────────────────────────────
 
export interface ApiAdminBoardSeat {
  id: string
  slug: string
  role: string
  category: 'officer' | 'regional_rep'
  is_active: number
  is_shared: number
  sort_order: number
  /** board_members.name — the display fallback for seats with no account linked. */
  fallback_name: string
  ticket_count: number
}
 
export interface ApiSeatAssignment {
  id: string
  seat_id: string
  member_id: string
  member_name: string | null
  started_at: string
  ended_at: string | null
  note: string | null
}

/** One current holder. A shared seat yields several rows with the same seat_id. */
export interface ApiSeatHolder {
  assignment_id: string
  seat_id: string
  member_id: string
  member_name: string
  member_email: string
  started_at: string
}
 
export async function adminGetBoardSeats(): Promise<{
  seats: ApiAdminBoardSeat[]
  holders: ApiSeatHolder[]
  history: ApiSeatAssignment[]
}> {
  const response = await fetch('/api/admin/board-seats', {
    headers: await authHeaders(),
  })
  return handleResponse(response)
}
 
/** memberId null vacates the seat. Either way the sitting term is closed. */
export async function adminAssignBoardSeat(
  seatId: string,
  memberId: string | null,
  note?: string,
): Promise<void> {
  const response = await fetch('/api/admin/board-seats', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({
      seatId,
      memberId,
      vacate: memberId === null,
      note: note ?? null,
    }),
  })
  return handleResponse(response)
}
 
// ── Board inbox (seat holders) ────────────────────────────────────────────────
 
export interface ApiBoardTicket {
  id: string
  number: number | null
  name: string
  email: string
  subject: string
  status: 'open' | 'in_progress' | 'resolved'
  seat_id: string
  seat_role: string
  created_at: string
  updated_at: string
  message_count: number
  last_message: string
  /**
   * Sender of the last real message (notes excluded). 'admin' means someone
   * from LCA answered; 'member' or 'guest' means the visitor is still waiting.
   */
  last_sender_type: 'member' | 'admin' | 'guest' | null
  /** Newest message time, using occurred_at for logged correspondence. */
  last_activity_at: string | null
  /** 0 = nobody currently holds this seat, so only admins are seeing it. */
  seat_holder_count: number
}
 
export async function getBoardTickets(status?: string): Promise<{
  tickets: ApiBoardTicket[]
  seatIds: string[]
  isAdmin?: boolean
}> {
  const url = status
    ? `/api/board/tickets?status=${encodeURIComponent(status)}`
    : '/api/board/tickets'
  const response = await fetch(url, { headers: await authHeaders() })
  return handleResponse(response)
}
 
export async function getBoardTicket(id: string): Promise<{
  ticket: ApiBoardTicket
  messages: ApiTicketMessage[]
}> {
  const response = await fetch(`/api/board/tickets/${id}`, {
    headers: await authHeaders(),
  })
  return handleResponse(response)
}
 
export async function replyToBoardTicket(
  ticketId: string,
  body: string,
): Promise<void> {
  const response = await fetch(`/api/board/tickets/${ticketId}`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ body }),
  })
  return handleResponse(response)
}
 
export async function updateBoardTicketStatus(
  ticketId: string,
  status: 'open' | 'in_progress' | 'resolved',
): Promise<void> {
  const response = await fetch(`/api/board/tickets/${ticketId}`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify({ status }),
  })
  return handleResponse(response)
}

/**
 * Removes a ticket and its messages for good. Available to the seat holder as
 * well as an admin: the person who most needs to remove something sensitive
 * before a seat changes hands is the one who can see it.
 */
export async function deleteBoardTicket(ticketId: string): Promise<void> {
  const response = await fetch(`/api/board/tickets/${ticketId}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  })
  return handleResponse(response)
}

export interface ApiMySeat {
  id: string
  slug: string
  role: string
  category: 'officer' | 'regional_rep'
  started_at: string
}
 
export async function getMySeats(): Promise<{ seats: ApiMySeat[] }> {
  const response = await fetch('/api/board/my-seats', {
    headers: await authHeaders(),
  })
  return handleResponse(response)
}

export interface ApiTicketMessage {
  id: string
  ticket_id: string
  sender_type: 'member' | 'admin' | 'guest'
  body: string
  created_at: string
  /** 1 = logged correspondence pasted in after the fact, not a live message. */
  is_note: number
  /** When the correspondence happened. Null falls back to created_at. */
  occurred_at: string | null
  logged_by_name: string | null
}

export async function addBoardTicketNote(
  ticketId: string,
  body: string,
  occurredAt?: string | null,
): Promise<void> {
  const response = await fetch(`/api/board/tickets/${ticketId}`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ body, kind: 'note', occurredAt: occurredAt ?? null }),
  })
  return handleResponse(response)
}

export async function adminRemoveBoardSeatHolder(
  seatId: string,
  memberId: string,
): Promise<void> {
  const response = await fetch('/api/admin/board-seats', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ seatId, endMemberId: memberId }),
  })
  return handleResponse(response)
}

// ── Scoresheet scanner ─────────────────────────────────────────────

/** Send a photo already shrunk with downscaleImage (resizeImage.ts). */
export async function scanScoresheet(
  photo: Blob,
): Promise<{ scan: RawScan; scansLeftToday: number }> {
  const headers = await authHeaders()
  const response = await fetch('/api/scan', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': photo.type || 'image/jpeg' },
    body: photo,
  })
  return handleResponse(response)
}

// ── LCA news posts ──────────────────────────────────────────────────────────

export interface ApiPost {
  id: string
  slug: string
  title: string
  summary: string
  /** Only on the single-post and admin responses. */
  body_html?: string
  image_url: string | null
  link_url: string | null
  link_label: string | null
  status?: 'draft' | 'published'
  pinned: number
  published_at: string | null
  updated_at?: string
}

export interface ApiPostInput {
  title?: string
  slug?: string
  summary?: string
  bodyHtml?: string
  linkUrl?: string | null
  linkLabel?: string | null
  status?: 'draft' | 'published'
  pinned?: boolean
  publishedAt?: string | null
}

export async function getPosts(limit = 20): Promise<ApiPost[]> {
  const response = await fetch(`/api/posts?limit=${limit}`)
  const data = await handleResponse<{ posts: ApiPost[] }>(response)
  return data.posts
}

export async function getPost(slug: string): Promise<ApiPost> {
  const response = await fetch(`/api/posts/${encodeURIComponent(slug)}`)
  const data = await handleResponse<{ post: ApiPost }>(response)
  return data.post
}

export async function adminGetPosts(): Promise<ApiPost[]> {
  const response = await fetch('/api/admin/posts', { headers: await authHeaders() })
  const data = await handleResponse<{ posts: ApiPost[] }>(response)
  return data.posts
}

export async function adminGetPost(id: string): Promise<ApiPost> {
  const response = await fetch(`/api/admin/posts/${id}`, { headers: await authHeaders() })
  const data = await handleResponse<{ post: ApiPost }>(response)
  return data.post
}

export async function adminCreatePost(body: ApiPostInput): Promise<ApiPost> {
  const response = await fetch('/api/admin/posts', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  })
  const data = await handleResponse<{ post: ApiPost }>(response)
  return data.post
}

export async function adminUpdatePost(id: string, body: ApiPostInput): Promise<ApiPost> {
  const response = await fetch(`/api/admin/posts/${id}`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  })
  const data = await handleResponse<{ post: ApiPost }>(response)
  return data.post
}

export async function adminDeletePost(id: string): Promise<void> {
  const response = await fetch(`/api/admin/posts/${id}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  })
  await handleResponse(response)
}

export async function adminUploadPostImage(id: string, blob: Blob): Promise<{ imageUrl: string }> {
  const headers = await authHeaders()
  const response = await fetch(`/api/admin/posts/${id}/image`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'image/jpeg' },
    body: blob,
  })
  return handleResponse(response)
}

export async function adminRemovePostImage(id: string): Promise<void> {
  const response = await fetch(`/api/admin/posts/${id}/image`, {
    method: 'DELETE',
    headers: await authHeaders(),
  })
  await handleResponse(response)
}
