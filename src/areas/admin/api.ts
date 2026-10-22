// src/areas/admin/api.ts
//
// The admin area's calls to the site's API: support tickets and the
// contact form, email campaigns, site announcements, acting as a member,
// and the audit log.
//
// Moved whole from src/lib/api.ts by scripts/split-api.ts, following
// scripts/moves/api-split.json. src/lib/api.ts re-exports everything here,
// so pages and components may keep importing from '@/lib/api'. A type
// another area owns is imported from that area's api.ts, never from
// '@/lib/api', which re-exports this file.

import { authHeaders, handleResponse } from '@/lib/http'

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
