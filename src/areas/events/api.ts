// src/areas/events/api.ts
//
// The events area's calls to the site's API: tournaments and their setup,
// directors, the manage page, the US Chess rating report, event
// announcements, news posts and the club news feed, and state champions.
//
// Moved whole from src/lib/api.ts by scripts/split-api.ts, following
// scripts/moves/api-split.json. src/lib/api.ts re-exports everything here,
// so pages and components may keep importing from '@/lib/api'. A type
// another area owns is imported from that area's api.ts, never from
// '@/lib/api', which re-exports this file.

// Types only: a runtime import of the contracts would bring zod into the site
// bundle, which npm run check:bundle refuses.
import type { SavedSection, Schedule, ScheduleRound, TournamentDetailResponse, TournamentListItem } from '@domain/contracts'
import { authHeaders, handleResponse } from '@/lib/http'
import type { ApiMyRegistration } from '@/areas/registration/api'
import type { ApiTournamentPairing, ApiStanding, ApiTournamentGame } from '@/areas/live/api'

export type TournamentStatus = 'upcoming' | 'active' | 'completed'

/**
 * One section as every endpoint that returns a tournament answers it
 * (savedSectionSchema in domain/contracts/events.ts): a row of
 * tournament_sections with its id, cap and prices under the field names the
 * pages always read. The entry rules follow lib/sectionRules: they come from
 * the name unless rulesSet is true. fees are the regular, early and late
 * prices to show; entryFee equals fees.regular.
 */
export type ApiTournamentSection = SavedSection

/**
 * A section while the setup wizard or the manage page edits it, and as they
 * send it back. One loaded from the server keeps its id, so a save matches it
 * by id and a renamed section keeps its entries and pairings; one added in
 * the form has only a name and a fee until it is saved. Echoed fees carrying
 * `regular` are ignored by the server (sectionSchema).
 */
export type ApiSectionDraft = Partial<ApiTournamentSection> & Pick<ApiTournamentSection, 'name' | 'entryFee'>

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

/** One player's prize, worked out by the server (functions/utils/events/prizes). */
export interface ApiPrizeAward {
  member_id: string
  section: string
  prize: string
  cash: number
  items: string[]
}

/**
 * A tournament as GET /api/tournaments returns it (tournamentListItemSchema):
 * every column of tournaments, the live sections with their ids, the round
 * schedule as a list, and the club's name and colour from the join.
 * custom_details stays the stored JSON text on this endpoint.
 */
export type ApiTournamentListItem = TournamentListItem

/**
 * One round of the main schedule as every tournament answer gives it in
 * round_schedule (scheduleRoundSchema): the round number and the date and
 * time text the setup wrote, '' when not set. The manage page sends the
 * same shape back as roundSchedule.
 */
export type ApiRoundScheduleItem = ScheduleRound

/**
 * A live schedule of a tournament (scheduleSchema): the main one, and any
 * schedule that merges into it at mergeRound. Every tournament answer
 * carries them in `schedules`; no page reads them yet.
 */
export type ApiSchedule = Schedule

export interface ApiCustomDetail {
  title: string
  body: string
  color?: string | null
  image_url?: string | null
  region?: string | null
}

/**
 * A tournament as the event page (GET /api/tournaments/[id]) and the manage
 * page (GET /api/admin/tournaments/[id]/manage) load it
 * (tournamentDetailSchema): the list item's columns without the club join,
 * with custom_details read into a list and round_schedule the main
 * schedule's rounds. Only the event page gets waitlist_count. The contract
 * promises custom_details only as objects; this is the shape the setup form
 * writes into it.
 */
export type ApiTournamentDetail = Omit<TournamentDetailResponse['tournament'], 'waitlist_count' | 'custom_details'> & {
  waitlist_count?: number
  custom_details: ApiCustomDetail[]
}

export interface ApiRosterPlayer {
  member_id: string
  section: string
  withdrawn_at: string | null
  full_name: string
  uscf_id: string | null
  uscf_rating: number | null
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
  // Signed in, the page also gets your own entry, and directors can preview
  // an event that isn't public yet. Signed out it's the plain public view.
  const response = await fetch(`/api/tournaments/${id}`, { headers: await authHeaders() })
  return handleResponse(response)
}

export async function adminCreateTournament(body: {
  name: string
  location: string
  date: string
  entryFee: number
  venue?: string | null
  endDate?: string | null
  sections?: ApiSectionDraft[]
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
  /** Left out: on for an LCA-run event, off for a club-run one. */
  requiresLcaMembership?: boolean
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
    isStateChampionship?: boolean
    /** US Chess upload details (areas/events/uschessUpload UploadSettings). */
    reportSettings?: Record<string, unknown> | null
    name?: string
    location?: string
    venue?: string | null
    date?: string
    endDate?: string | null
    entryFee?: number
    /**
     * Every section, in order. Each one loaded from the server keeps its id,
     * so a renamed section keeps its entries and pairings; a section left
     * out is removed, which the server refuses while it has entries.
     */
    sections?: ApiSectionDraft[]
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
    /**
     * Whether entering needs an LCA membership. Only an LCA admin or the
     * organizing club's rep may send it; it cannot be false on an event
     * with no club.
     */
    requiresLcaMembership?: boolean
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

export async function adminDeleteTournament(tournamentId: string): Promise<void> {
  const response = await fetch(`/api/admin/tournaments/${tournamentId}`, {
    method: 'DELETE',
    headers: await authHeaders(),
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

// ── State champions ────────────────────────────────────────────────────────

export interface ApiChampion {
  id: string
  year: number
  title: string
  champion: string
  notes: string | null
  tournament_id: string | null
  tournament_name: string | null
  /** Which list the row is on: the state championship or the scholastic sections. */
  kind: 'state' | 'scholastic'
  /** A photo of the champion, or null. */
  photo_url: string | null
}

export interface ApiChampionshipEvent {
  id: string
  name: string
  date: string
  end_date: string | null
  location: string
  status: TournamentStatus
}

export async function getChampions(): Promise<{ champions: ApiChampion[]; upcoming: ApiChampionshipEvent[] }> {
  const response = await fetch('/api/champions')
  return handleResponse(response)
}

export type ChampionInput = {
  year: number | string
  title: string
  champion: string
  notes?: string | null
  tournamentId?: string | null
  kind?: 'state' | 'scholastic'
  photoUrl?: string | null
}

export async function adminAddChampions(rows: ChampionInput[]): Promise<{ added: number }> {
  const response = await fetch('/api/admin/champions', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(rows.length === 1 ? rows[0] : { rows }),
  })
  return handleResponse(response)
}

export async function adminUpdateChampion(id: string, body: Partial<ChampionInput>): Promise<void> {
  const response = await fetch(`/api/admin/champions/${id}`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  })
  await handleResponse(response)
}

export async function adminDeleteChampion(id: string): Promise<void> {
  const response = await fetch(`/api/admin/champions/${id}`, { method: 'DELETE', headers: await authHeaders() })
  await handleResponse(response)
}
