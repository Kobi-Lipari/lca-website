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
import type { AdminClubResponse, ClubPlace, UpdateClubRequest } from '@domain/contracts'

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

/** GET /api/admin/clubs/:id: club reps (own club), the region's representative and admins. */
export async function adminGetClub(id: string): Promise<{
  club: ApiClubListing
  officers: ApiAdminClubOfficer[]
  roster: ApiAdminMember[]
  /** Set only for a person a regional seat alone admits: the empty roster is held back, not empty. */
  rosterKeptBack?: true
  tournaments: ApiAdminClubTournament[]
  /** Answered only while CLUB_KEEPERS_ON is set on the server. */
  places?: ApiClubPlace[]
}> {
  const response = await fetch(`/api/admin/clubs/${id}`, {
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
