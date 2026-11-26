// src/areas/clubs/api.ts
//
// The clubs area's calls to the site's API: the club directory and club
// pages, officers, club news and logos.
//
// Moved whole from src/lib/api.ts by scripts/split-api.ts, following
// scripts/moves/api-split.json. src/lib/api.ts re-exports everything here,
// so pages and components may keep importing from '@/lib/api'. A type
// another area owns is imported from that area's api.ts, never from
// '@/lib/api', which re-exports this file.

import { authHeaders, handleResponse } from '@/lib/http'
import type { ApiAdminMember } from '@/areas/membership/api'
import type { AdminClubResponse, ClubConfirmResponse, ClubPlace, UpdateClubRequest, WorkspaceRegionResponse } from '@domain/contracts'
import type {
  ClubContactRequest, ClubContactResponse, ClubLinkConfirmResponse, ClubLinkResponse, ClubPageResponse, ClubReplyRequest, ClubReplyResponse, ClubReplySentResponse, MonthlyCheckResponse, ReportClockResponse,
  ClubReportActionRequest, ClubReportActionResponse, ClubSuggestionRequest, ClubSuggestionResponse, OpenSuggestion,
  ClubRequest, ClubRequestHandledResponse, ClubRequestResponse,
  RepDecisionRequest, RepDecisionResponse, RepRequest, RepRequestResponse, RepRequestRow,
  ClubDirectoryItem,
} from '@domain/contracts'

export interface ApiClubDetail {
  id: string
  name: string
  city: string
  location: string | null
  description: string | null
  meeting_schedule: string | null
  /**
   * The admin's answers always carry it. The public club page's answer
   * leaves it out once CLUB_EMAIL_HIDDEN is set on the server, and the page
   * draws no address while clubEmailHidden is on.
   */
  contact_email?: string | null
  created_at: string
  color: string
  image_url: string | null
  region: string | null
  /** The club's pin on the map, when one has been set. */
  latitude?: number | null
  longitude?: number | null
}

/** An officer as the public club page's answer gives one: by role and name, never with an email. */
export interface ApiClubOfficer {
  role: string
  full_name: string
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

export interface ApiClubListItem {
  id: string
  name: string
  city: string
  meeting_schedule: string
  color: string | null
  image_url: string | null
  region: string | null
  /** The club's pin on the map, when one has been set. */
  latitude?: number | null
  longitude?: number | null
}

/**
 * One club of GET /api/clubs while CLUB_PAGES_ON is set on the server (WS09
 * step 32): today's fields and the directory's after them. No call reads it
 * yet: getClubs() keeps today's type, ApiClubListItem, so every caller of
 * the list reads today's fields alone and the directory's keys pass them by.
 */
export type ApiClubDirectoryItem = ClubDirectoryItem

export async function getClubs(): Promise<ApiClubListItem[]> {
  const response = await fetch('/api/clubs')
  const data = await handleResponse<{ clubs: ApiClubListItem[] }>(response)
  return data.clubs
}

/**
 * The same list as getClubs(), asked by the Clubs page that chooses between
 * the directory and today's page, with this site's origin alone as the
 * referrer: the page's address can hold a ZIP code (near=), which the call
 * then never carries on. Every other caller asks through getClubs(), as it
 * always has.
 */
export async function getClubsFromOrigin(): Promise<ApiClubListItem[]> {
  const response = await fetch('/api/clubs', { referrerPolicy: 'strict-origin' })
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

/**
 * The new club page's answer, GET /api/clubs/:address/page, by the club's
 * slug, an old slug or its id. Sent signed in when there is a session, since
 * a club's keepers see the page before the public does; anyone the server
 * does not let read it gets 404, as for a club that does not exist.
 */
export async function getClubPage(address: string): Promise<ClubPageResponse> {
  const response = await fetch(`/api/clubs/${encodeURIComponent(address)}/page`, {
    headers: await authHeaders(),
  })
  return handleResponse<ClubPageResponse>(response)
}

/**
 * A message to a club from its page's Contact form, POST
 * /api/clubs/:address/contact (WS09 step 26): the visitor's name, address and
 * message, and the spam check's token. The server relays it by email and
 * keeps none of it. Sent with no sign-in, since the answer is the same for
 * everyone. A refusal throws an ApiError with its status and words.
 */
export async function sendClubMessage(address: string, body: ClubContactRequest): Promise<ClubContactResponse> {
  const response = await fetch(`/api/clubs/${encodeURIComponent(address)}/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return handleResponse<ClubContactResponse>(response)
}

/**
 * A suggestion for a club's listing from its page's Suggest an update sheet,
 * POST /api/clubs/:address/reports (WS09 step 28): which of the six parts
 * changed, the visitor's words, an address only if they give one, and the
 * spam check's token. The server saves it for whoever keeps the listing and
 * emails them. Sent with no sign-in, since the answer is the same for
 * everyone and the row holds no more for a member. A refusal throws an
 * ApiError with its status and words.
 */
export async function sendClubSuggestion(address: string, body: ClubSuggestionRequest): Promise<ClubSuggestionResponse> {
  const response = await fetch(`/api/clubs/${encodeURIComponent(address)}/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return handleResponse<ClubSuggestionResponse>(response)
}

/**
 * A keeper's answer to one open suggestion of a club, POST
 * /api/admin/clubs/:id/reports/:reportId (WS09 step 28): apply, answer with
 * the keeper's words, or dismiss. Answers the row and its new status; a
 * suggestion already handled is refused with 409 in words.
 */
export async function resolveClubSuggestion(clubId: string, reportId: number, body: ClubReportActionRequest): Promise<ClubReportActionResponse> {
  const response = await fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/reports/${encodeURIComponent(String(reportId))}`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  })
  return handleResponse<ClubReportActionResponse>(response)
}

/**
 * Suggest a club or Start a club, POST /api/clubs/reports (WS09 step 30):
 * which of the two, the club's name, a city or ZIP code, where and when in
 * the person's words, their name and address, and the spam check's token.
 * Sent with no sign-in, since the answer is the same for everyone and the
 * row holds no more for a member. The answer says only that it was sent. A
 * refusal throws an ApiError with its status and words.
 */
export async function sendClubRequest(body: ClubRequest): Promise<ClubRequestResponse> {
  const response = await fetch('/api/clubs/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return handleResponse<ClubRequestResponse>(response)
}

/**
 * Mark as handled for one row of Suggest a club or Start a club, POST
 * /api/admin/club-reports/:reportId (WS09 step 30). Answers the row and its
 * new status; a row already handled is refused with 409 in words.
 */
export async function markClubRequestHandled(reportId: number): Promise<ClubRequestHandledResponse> {
  const response = await fetch(`/api/admin/club-reports/${encodeURIComponent(String(reportId))}`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ action: 'handled' }),
  })
  return handleResponse<ClubRequestHandledResponse>(response)
}

/**
 * Ask to be its named rep, POST /api/clubs/:address/rep-requests (WS09 step
 * 31): how the member is connected to the club and an optional note, sent
 * signed in, since the request is the member's own. The answer says only
 * that it was sent. A refusal throws an ApiError with its status and words.
 */
export async function sendRepRequest(address: string, body: RepRequest): Promise<RepRequestResponse> {
  const response = await fetch(`/api/clubs/${encodeURIComponent(address)}/rep-requests`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  })
  return handleResponse<RepRequestResponse>(response)
}

/**
 * A keeper's decision on one request of Ask to be its named rep, POST
 * /api/admin/clubs/:id/rep-requests/:requestId (WS09 step 31): approve, with
 * the member's role as the question named it, or decline. Answers the
 * request and its new status; a request decided already, or a member whose
 * role has changed, is refused with 409 in words.
 */
export async function decideRepRequest(clubId: string, requestId: number, body: RepDecisionRequest): Promise<RepDecisionResponse> {
  const response = await fetch(`/api/admin/clubs/${encodeURIComponent(clubId)}/rep-requests/${encodeURIComponent(String(requestId))}`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  })
  return handleResponse<RepDecisionResponse>(response)
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
    mapLocation?: { lat: number; lng: number } | null
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
  /** The approval wait's three columns, answered only while REGION_EVENTS_ON is set on the server. */
  needs_lca_approval?: number
  approval_requested_at?: string | null
  approved_at?: string | null
}

/**
 * The club as the admin answers give it: today's columns, and while
 * CLUB_KEEPERS_ON is set on the server the listing's new ones as well
 * (adminClubRowSchema in domain/contracts/clubs.ts), each optional here
 * because an answer with the constant unset carries none of them.
 */
export type ApiClubListing = ApiClubDetail & Partial<Omit<AdminClubResponse['club'], keyof ApiClubDetail>>

/** One of the club's places, first place first, as the admin endpoints answer it. */
export type ApiClubPlace = ClubPlace

/**
 * GET /api/admin/clubs/:id: club reps (own club), the region's representative
 * and admins. While CLUB_KEEPERS_ON is set on the server the value may be the
 * club's page address as well as its id (Your club's page asks by it). The
 * value is sent as one part of the path, so a typed address never reaches
 * another endpoint.
 */
export async function adminGetClub(id: string): Promise<{
  club: ApiClubListing
  /** Not answered while CLUB_PAGES_ON is set on the server: a player is no longer tied to a club. */
  officers?: ApiAdminClubOfficer[]
  /** Not answered while CLUB_PAGES_ON is set on the server, as the officers. */
  roster?: ApiAdminMember[]
  /** Set only for a person a regional seat alone admits: the empty roster is held back, not empty. */
  rosterKeptBack?: true
  tournaments: ApiAdminClubTournament[]
  /** Answered only while CLUB_KEEPERS_ON is set on the server. */
  places?: ApiClubPlace[]
  /** What the person may do with the club's events, answered only while REGION_EVENTS_ON is set on the server. */
  eventRights?: AdminClubResponse['eventRights']
  /** The club's open suggestions, answered to a keeper only while one is open and CLUB_KEEPERS_ON is set (WS09 step 28). */
  openSuggestions?: OpenSuggestion[]
  /** The club's open requests of Ask to be its named rep, answered only to a keeper who may decide them, only while one is open (WS09 step 31). */
  repRequests?: RepRequestRow[]
}> {
  const response = await fetch(`/api/admin/clubs/${encodeURIComponent(id)}`, {
    headers: await authHeaders(),
  })
  return handleResponse(response)
}

/**
 * The club editor's one save: PATCH /api/admin/clubs/:id with the listing's
 * fields and, when sent, its places (updateClubRequestSchema), written by
 * the server in one batch, so a press saves all of it or none of it.
 * Answers the club as saved, and its places as saved when they were sent.
 */
export async function saveClubListing(id: string, body: UpdateClubRequest): Promise<{ club: ApiClubListing; places?: ApiClubPlace[] }> {
  const response = await fetch(`/api/admin/clubs/${id}`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  })
  return handleResponse<{ club: ApiClubListing; places?: ApiClubPlace[] }>(response)
}

/**
 * My region's answer, GET /api/workspace/region (WS09 step 11's page): the
 * cards in the server's order with their words, This month and the regions.
 * Answered only while CLUB_KEEPERS_ON is set on the server, and only to a
 * holder of an active regional seat or an LCA admin; everyone else gets 403
 * in words, which the page draws.
 */
export async function getWorkspaceRegion(): Promise<WorkspaceRegionResponse> {
  const response = await fetch(`/api/workspace/region`, {
    headers: await authHeaders(),
  })
  return handleResponse<WorkspaceRegionResponse>(response)
}

/**
 * Still accurate for one club, POST /api/admin/clubs/:id/confirm, with no
 * field of its own: the body is `{}`. Answers the club's new last check and
 * its words for the card ("Checked Nov 2026").
 */
export async function confirmClubStillAccurate(id: string): Promise<ClubConfirmResponse> {
  const response = await fetch(`/api/admin/clubs/${encodeURIComponent(id)}/confirm`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({}),
  })
  return handleResponse<ClubConfirmResponse>(response)
}

/**
 * The club a Still accurate link in the monthly check names, GET
 * /api/clubs/confirm/:token (WS09 step 14's page), which changes nothing.
 * No sign-in: the token is the key, so no Authorization header is sent, and
 * no referrer goes with the call, so the token rides in its own address alone.
 */
export async function getClubLink(token: string): Promise<ClubLinkResponse> {
  const response = await fetch(`/api/clubs/confirm/${encodeURIComponent(token)}`, {
    headers: { Accept: 'application/json' },
    referrerPolicy: 'no-referrer',
  })
  return handleResponse<ClubLinkResponse>(response)
}

/**
 * Still accurate by the link, POST /api/clubs/confirm/:token, with the body
 * `{}` and no sign-in. Answers the club and the month it is marked as
 * checked for, in words.
 */
export async function confirmClubByLink(token: string): Promise<ClubLinkConfirmResponse> {
  const response = await fetch(`/api/clubs/confirm/${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    referrerPolicy: 'no-referrer',
    body: '{}',
  })
  return handleResponse<ClubLinkConfirmResponse>(response)
}

/**
 * The message a Reply through LCA link answers, GET /api/clubs/reply/:token
 * (WS09 step 27): the visitor's first name, the club and the first lines of
 * the message, never an address. Sent with the sign-in, since only the
 * region's representative and the LCA admins are let in, and with no
 * referrer, so the token rides in its own address alone.
 */
export async function getClubReply(token: string): Promise<ClubReplyResponse> {
  const response = await fetch(`/api/clubs/reply/${encodeURIComponent(token)}`, {
    headers: await authHeaders(),
    referrerPolicy: 'no-referrer',
  })
  return handleResponse<ClubReplyResponse>(response)
}

/**
 * The answer's words, POST /api/clubs/reply/:token, with the sign-in. The
 * server sends them to the visitor from LCA's own address; nothing in the
 * body can name a recipient. A refusal throws an ApiError with its status and
 * words.
 */
export async function sendClubReply(token: string, body: ClubReplyRequest): Promise<ClubReplySentResponse> {
  const response = await fetch(`/api/clubs/reply/${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: await authHeaders(),
    referrerPolicy: 'no-referrer',
    body: JSON.stringify(body),
  })
  return handleResponse<ClubReplySentResponse>(response)
}

/**
 * How many people this month's check goes to, for the LCA admin's one
 * question in My region: POST /api/admin/clubs/monthly-check with `send`
 * false, which sends nothing.
 */
export async function countMonthlyCheck(): Promise<MonthlyCheckResponse> {
  const response = await fetch('/api/admin/clubs/monthly-check', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ send: false }),
  })
  return handleResponse<MonthlyCheckResponse>(response)
}

/**
 * Sends this month's check now, the LCA admin's button: POST
 * /api/admin/clubs/monthly-check with `send` true. Answers how many emails
 * went, how many did not and how many people were not reached.
 */
export async function sendMonthlyCheck(): Promise<MonthlyCheckResponse> {
  const response = await fetch('/api/admin/clubs/monthly-check', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ send: true }),
  })
  return handleResponse<MonthlyCheckResponse>(response)
}

/**
 * How many visitors' suggestions have had no answer in 14 days, for the LCA
 * admin's one question in My region (WS09 step 29): POST
 * /api/admin/clubs/monthly-check with `action` run_report_clock and `send`
 * false, which sends nothing.
 */
export async function countOverdueSuggestions(): Promise<ReportClockResponse> {
  const response = await fetch('/api/admin/clubs/monthly-check', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ action: 'run_report_clock', send: false }),
  })
  return handleResponse<ReportClockResponse>(response)
}

/**
 * Sends the overdue suggestions on to the LCA admins and, where the club's
 * rep had one, the region's representatives: the same call with `send`
 * true. Answers how many were passed on, how many emails went and did not,
 * and how many wait for another press.
 */
export async function sendOverdueSuggestions(): Promise<ReportClockResponse> {
  const response = await fetch('/api/admin/clubs/monthly-check', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ action: 'run_report_clock', send: true }),
  })
  return handleResponse<ReportClockResponse>(response)
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

export async function adminDeleteClub(clubId: string): Promise<void> {
  const response = await fetch(`/api/admin/clubs/${clubId}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  })
  return handleResponse(response)
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
