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

// The LCA newsletter in Group email (WS16 step 5): its four methods under /api/admin/mail/newsletter, behind
// requireListMailer, each answering 404 while the newsletter is switched off on the server. Their answers are the
// contracts in domain/contracts/mail.ts, written here by hand, as ApiCampaign is, since no area module but events' and
// membership's imports from @domain (test/unit/api-split-modules.test.ts). A refusal throws ApiError with the server's
// own words, which the page shows as they are.

/** What GET /api/admin/mail/newsletter answers (newsletterSummaryResponseSchema). */
export interface ApiNewsletter {
  list: { id: string; name: string }
  /** The newsletter's From line, as the server gives it. */
  from: string
  /** The service that sends now: 'resend' while the newsletter waits for Amazon SES. */
  sendsThrough: string
  summary: {
    /** Every address in the audience; the three after it may overlap. */
    addresses: number
    turnedOff: number
    stoppedAll: number
    doNotSend: number
    /** The addresses the next send goes to. */
    willGet: number
    /** The last 10 newsletter sends, newest first. */
    recent: Array<{
      id: string
      subject: string
      totalRecipients: number
      sentCount: number
      failedCount: number
      skippedCount: number
      status: 'sending' | 'completed' | 'failed'
      createdAt: string
      completedAt: string | null
    }>
    /** Why the newsletter that is sending waits, in the server's words, or null. */
    waits: string | null
  }
}

/** What POST /api/admin/mail/newsletter answers once it has made a send (newsletterResponseSchema). */
export interface ApiNewsletterSent {
  campaignId: string
  totalRecipients: number
  status: 'sending'
}

/** What POST /api/admin/mail/newsletter/stop answers (newsletterStopResponseSchema): the addresses the stop kept it from. */
export interface ApiNewsletterStopped {
  stopped: number
}

export async function getNewsletter(): Promise<ApiNewsletter> {
  const response = await fetch('/api/admin/mail/newsletter', {
    headers: await authHeaders(),
  })
  return handleResponse(response)
}

/** Sends the newsletter to its list. Refused with 409 while Resend sends and while one is sending. */
export async function sendNewsletter(payload: { subject: string; bodyHtml: string }): Promise<ApiNewsletterSent> {
  const response = await fetch('/api/admin/mail/newsletter', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(payload),
  })
  return handleResponse(response)
}

/**
 * Sends one test of the newsletter as written to one address, with the real footer and links for it. `service` asks
 * for the test through Amazon SES, which the server allows an LCA admin alone. For the media manager the server takes
 * only their own account's address.
 */
export async function sendNewsletterTest(payload: { to: string; subject: string; bodyHtml: string; service?: 'ses' }): Promise<{ sent: true }> {
  const response = await fetch('/api/admin/mail/newsletter/test', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(payload),
  })
  return handleResponse(response)
}

/** Stops the newsletter that is sending: the addresses not yet reached do not get it. */
export async function stopNewsletter(): Promise<ApiNewsletterStopped> {
  const response = await fetch('/api/admin/mail/newsletter/stop', {
    method: 'POST',
    headers: await authHeaders(),
  })
  return handleResponse(response)
}

// The newsletter's own page (WS16 part two, page step 3): its four methods under /api/admin/mail/newsletter/issue and
// /issues, behind requireListMailer, each answering 404 while the page is switched off on the server. Their answers are
// the contracts in domain/contracts/newsletter.ts, written here by hand, as the newsletter's above are. Nothing imports
// these yet; the page that calls them comes in WS16 part two step 4.

/** One letter as the server keeps it (newsletterLetterSchema): its words are the cleaner's own, its times the database's. */
export interface ApiNewsletterLetter {
  id: string
  /** 1 when the letter is made, one more at each write; a save sends the version it read. */
  version: number
  monthLabel: string
  subject: string
  /** The inbox preview line. */
  preheader: string
  bodyHtml: string
  createdAt: string
  updatedAt: string
}

/** What GET /api/admin/mail/newsletter/issue answers, and POST .../issue/start once it has started a letter. */
export interface ApiNewsletterIssue {
  issue: ApiNewsletterLetter | null
  state: 'none' | 'draft'
  /** Who wrote to the letter last, by name; null once their account is gone. */
  lastSavedBy: string | null
  lastSavedAt: string | null
}

/** What a save answers once it has saved: the new version, when, and the stored letter when the cleaner changed it, else null. */
export interface ApiNewsletterIssueSaved {
  id: string
  version: number
  savedAt: string
  bodyHtml: string | null
}

/**
 * What a save or a start refused with 409 answers, nothing written: why, who did it, by name, and when. 'changed' when
 * someone wrote to the letter after it was read, 'sent' or 'set_aside' when it was sent or a new letter took its place.
 */
export interface ApiNewsletterIssueRefused {
  error: string
  reason: 'changed' | 'sent' | 'set_aside'
  changedBy: string | null
  changedAt: string
}

/** One of the last newsletters, without its words: a letter sent or set aside, or a send on the list with no letter. */
export interface ApiLastNewsletter {
  issueId: string | null
  campaignId: string | null
  /** '' for a send with no letter. */
  monthLabel: string
  subject: string
  state: 'sending' | 'completed' | 'failed' | 'set_aside'
  at: string
  by: string | null
  /** How many a send went to; null for a letter never sent. */
  totalRecipients: number | null
}

/** The newsletter's open letter, or none, with who wrote to it last and when. */
export async function getNewsletterIssue(): Promise<ApiNewsletterIssue> {
  const response = await fetch('/api/admin/mail/newsletter/issue', {
    headers: await authHeaders(),
  })
  return handleResponse(response)
}

/**
 * Saves the open letter, by the id and version the page read (id null and version 0 for the first save when it read
 * none). A 409 is answered, not thrown, so the page keeps the person's words and can name who changed the letter and
 * when; every other refusal throws ApiError with the server's words.
 */
export async function saveNewsletterIssue(payload: {
  id: string | null
  version: number
  monthLabel: string
  subject: string
  preheader: string
  bodyHtml: string
}): Promise<{ saved: ApiNewsletterIssueSaved } | { refused: ApiNewsletterIssueRefused }> {
  const response = await fetch('/api/admin/mail/newsletter/issue', {
    method: 'PUT',
    headers: await authHeaders(),
    body: JSON.stringify(payload),
  })
  if (response.status === 409) {
    const refused = (await response.clone().json().catch(() => null)) as ApiNewsletterIssueRefused | null
    if (refused && typeof refused.reason === 'string') return { refused }
  }
  return { saved: await handleResponse<ApiNewsletterIssueSaved>(response) }
}

/**
 * Starts a new letter for a month, from a blank letter or one of LCA's starters by its id (STARTER_IDS in
 * domain/mail/letter.ts), a past letter or a past send. The open letter is set aside, its words kept, when it holds any.
 */
export async function startNewsletterIssue(payload: {
  from: 'blank' | 'monthly' | 'results-and-thanks' | 'short-notice' | { issueId: string } | { campaignId: string }
  monthLabel: string
}): Promise<{ started: ApiNewsletterIssue } | { refused: ApiNewsletterIssueRefused }> {
  const response = await fetch('/api/admin/mail/newsletter/issue/start', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(payload),
  })
  if (response.status === 409) {
    const refused = (await response.clone().json().catch(() => null)) as ApiNewsletterIssueRefused | null
    if (refused && typeof refused.reason === 'string') return { refused }
  }
  return { started: await handleResponse<ApiNewsletterIssue>(response) }
}

/** The last newsletters, at most 20, newest first, without their words. */
export async function getLastNewsletters(): Promise<{ issues: ApiLastNewsletter[] }> {
  const response = await fetch('/api/admin/mail/newsletter/issues', {
    headers: await authHeaders(),
  })
  return handleResponse(response)
}

// The media manager (WS16 step 6): whether the signed-in member sends the newsletter as the media manager, which only
// Admin's pages and the account menu ask, through src/areas/admin/useMediaManager.ts, once a session.

/** What GET /api/me/media-manager answers (mediaManagerResponseSchema), about the person signed in and no one else. */
export interface ApiMediaManager {
  /** True for anyone but an LCA admin and the president who holds the Media manager seat now, an officer among them; false while the newsletter is off. */
  mediaManager: boolean
  /** Whether the session carries a second factor, which sending asks of the media manager. */
  secondFactor: boolean
}

/** Asks whether the person signed in is the media manager. The answer draws the page; the newsletter's guard is the grant. */
export async function getMediaManager(): Promise<ApiMediaManager> {
  const response = await fetch('/api/me/media-manager', {
    headers: await authHeaders(),
  })
  return handleResponse(response)
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
