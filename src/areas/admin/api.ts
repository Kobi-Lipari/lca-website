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

import { ApiError, authHeaders, handleResponse } from '@/lib/http'

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
// the contracts in domain/contracts/newsletter.ts, written here by hand, as the newsletter's above are. The page's
// own files under src/areas/admin/newsletter call them.

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
 * when; every other refusal throws ApiError with the server's words. A 400 that names a field (parseBody's `fields`)
 * throws that field's words, the first when it names more, since they say what to mend where the sentence above them
 * does not. A 400 or a 413 that brings no words of the server's own, as an empty body or a page from the edge, throws
 * with no words, so the page says it could not save rather than give a status code.
 *
 * As the page is left, the page sends the save with sign-in headers it read ahead and `keepalive`, so the request
 * starts at once, before the page goes, and outlives it (the newsletter's own page, WS16 part two, page step 4).
 */
export async function saveNewsletterIssue(payload: {
  id: string | null
  version: number
  monthLabel: string
  subject: string
  preheader: string
  bodyHtml: string
}, asPageGoes?: { headers: HeadersInit; keepalive: true }): Promise<{ saved: ApiNewsletterIssueSaved } | { refused: ApiNewsletterIssueRefused }> {
  const response = await fetch('/api/admin/mail/newsletter/issue', {
    method: 'PUT',
    headers: asPageGoes ? asPageGoes.headers : await authHeaders(),
    body: JSON.stringify(payload),
    ...(asPageGoes ? { keepalive: true } : {}),
  })
  if (response.status === 409) {
    const refused = (await response.clone().json().catch(() => null)) as ApiNewsletterIssueRefused | null
    if (refused && typeof refused.reason === 'string') return { refused }
  }
  if (response.status === 400 || response.status === 413) {
    const refused = (await response.clone().json().catch(() => null)) as { error?: unknown; fields?: unknown } | null
    const words = response.status === 400 && refused && typeof refused.fields === 'object' && refused.fields !== null ? Object.values(refused.fields)[0] : undefined
    if (typeof words === 'string' && words !== '') throw new ApiError(words, 400)
    if (typeof refused?.error !== 'string' || refused.error === '') throw new ApiError('', response.status)
  }
  return { saved: await handleResponse<ApiNewsletterIssueSaved>(response) }
}

/**
 * Starts a new letter for a month, from a blank letter or one of LCA's starters by its id (STARTER_IDS in
 * domain/mail/letter.ts), a past letter, a past send or a saved template. The open letter is set aside, its words kept, when it holds any.
 */
export async function startNewsletterIssue(payload: {
  from: 'blank' | 'monthly' | 'results-and-thanks' | 'short-notice' | { issueId: string } | { campaignId: string } | { templateId: string }
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

/** One saved template, without its words (newsletterTemplateSchema): its name, when it was saved, and by whom by first name. */
export interface ApiNewsletterTemplate {
  id: string
  name: string
  savedAt: string
  /** The first name of who saved it; null once that account is gone. */
  by: string | null
  version: number
}

/** A rename or a remove that changed nothing (newsletterTemplateChangedSchema): someone wrote to the template after the list was read. */
export interface ApiNewsletterTemplateChanged {
  error: string
  changedBy: string | null
  changedAt: string
}

/** The newsletter's saved templates, newest first, shared by everyone who may open the page. */
export async function getNewsletterTemplates(): Promise<{ templates: ApiNewsletterTemplate[] }> {
  const response = await fetch('/api/admin/mail/newsletter/templates', {
    headers: await authHeaders(),
  })
  return handleResponse(response)
}

/**
 * Saves a copy of words as a template under a name: the letter on the page by its words, or a past newsletter by its
 * letter's or its send's id. The letter on the page is not changed. Every refusal throws ApiError with the server's
 * words: a 400 in the words of the field it names, as a save of the letter does, or with no words when the server gave
 * none.
 */
export async function saveNewsletterTemplate(payload: { name: string; bodyHtml: string } | { name: string; from: { issueId: string } | { campaignId: string } }): Promise<ApiNewsletterTemplate> {
  const response = await fetch('/api/admin/mail/newsletter/templates', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(payload),
  })
  if (response.status === 400 || response.status === 413) {
    const refused = (await response.clone().json().catch(() => null)) as { error?: unknown; fields?: unknown } | null
    const words = response.status === 400 && refused && typeof refused.fields === 'object' && refused.fields !== null ? Object.values(refused.fields)[0] : undefined
    if (typeof words === 'string' && words !== '') throw new ApiError(words, 400)
    if (typeof refused?.error !== 'string' || refused.error === '') throw new ApiError('', response.status)
  }
  return (await handleResponse<{ template: ApiNewsletterTemplate }>(response)).template
}

/**
 * Renames a saved template, by the version read. A 409 that lost to someone's write since then is answered, not
 * thrown; a 409 for a name taken throws its words, and a 400 the words of the field it names.
 */
export async function renameNewsletterTemplate(payload: { id: string; version: number; name: string }): Promise<{ saved: ApiNewsletterTemplate } | { changed: ApiNewsletterTemplateChanged }> {
  const response = await fetch('/api/admin/mail/newsletter/templates', {
    method: 'PUT',
    headers: await authHeaders(),
    body: JSON.stringify(payload),
  })
  if (response.status === 409) {
    const changed = (await response.clone().json().catch(() => null)) as ApiNewsletterTemplateChanged | null
    if (changed && typeof changed.changedAt === 'string') return { changed }
  }
  if (response.status === 400 || response.status === 413) {
    const refused = (await response.clone().json().catch(() => null)) as { error?: unknown; fields?: unknown } | null
    const words = response.status === 400 && refused && typeof refused.fields === 'object' && refused.fields !== null ? Object.values(refused.fields)[0] : undefined
    if (typeof words === 'string' && words !== '') throw new ApiError(words, 400)
    if (typeof refused?.error !== 'string' || refused.error === '') throw new ApiError('', response.status)
  }
  return { saved: (await handleResponse<{ template: ApiNewsletterTemplate }>(response)).template }
}

/**
 * Takes a saved template out of the list for everyone, by the version read; its words are kept on the server. A 409
 * that lost to someone's write since then is answered, not thrown.
 */
export async function removeNewsletterTemplate(payload: { id: string; version: number }): Promise<{ removed: true } | { changed: ApiNewsletterTemplateChanged }> {
  const response = await fetch('/api/admin/mail/newsletter/templates', {
    method: 'DELETE',
    headers: await authHeaders(),
    body: JSON.stringify(payload),
  })
  if (response.status === 409) {
    const changed = (await response.clone().json().catch(() => null)) as ApiNewsletterTemplateChanged | null
    if (changed && typeof changed.changedAt === 'string') return { changed }
  }
  return handleResponse(response)
}

/**
 * "Send a test to me" (page step 6): a test of the stored letter, by the id and version the page holds, to the
 * signed-in account's own address, in the navy look with the real footer, through POST /api/admin/mail/newsletter/test's
 * second form, which the server takes only while the page is switched on there. It answers the address the test went
 * to. A 409 is answered, not thrown, as a save's is, with who changed, sent or replaced the letter and when; every
 * other refusal throws ApiError with the server's own words, or with none for an answer that brings none, as a page
 * from the edge, so the page says the test could not be sent rather than give a status code.
 */
export async function sendNewsletterIssueTest(payload: { issueId: string; version: number }): Promise<{ sent: { to: string } } | { refused: ApiNewsletterIssueRefused }> {
  const response = await fetch('/api/admin/mail/newsletter/test', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(payload),
  })
  const answer = (await response.clone().json().catch(() => null)) as { error?: unknown; reason?: unknown; sent?: unknown; to?: unknown } | null
  if (response.status === 409 && answer && typeof answer.reason === 'string') return { refused: answer as unknown as ApiNewsletterIssueRefused }
  // A 200 is a test the mail service took; the address is said when the answer names it.
  if (response.ok && answer?.sent === true) return { sent: { to: typeof answer.to === 'string' ? answer.to : '' } }
  throw new ApiError(!response.ok && typeof answer?.error === 'string' ? answer.error : '', response.status)
}

// The media manager (WS16 step 6): whether the signed-in member sends the newsletter as the media manager, which only
// Admin's pages and the account menu ask, through src/areas/admin/useMediaManager.ts, once a session.

/** What GET /api/me/media-manager answers (mediaManagerResponseSchema), about the person signed in and no one else. */
export interface ApiMediaManager {
  /** True for anyone but an LCA admin who holds the Media manager seat now, an officer or LCA Observer among them; false while the newsletter is off. */
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

// ── The LCA admins' wait for a representative's club event (WS09 step 19) ──

// Kept with the call it serves rather than at the head of the file, so the
// lines of this block stay together. An import is hoisted wherever it sits.
import type { TournamentApprovalRequest, TournamentApprovalResponse } from '@domain/contracts'

/**
 * POST /api/admin/tournaments/:id/approval: one of the wait's three moves,
 * Submit for LCA review, Approve and publish or Ask for changes with its
 * note. Answers the event's four columns after the move and, in words a
 * page shows as they come, whether the email went. A refusal rejects with
 * the server's own words; a note the server refuses rejects with the note
 * field's own words as `noteError` beside them, so the form ties them to
 * the field.
 */
export async function moveTournamentApproval(
  tournamentId: string,
  body: TournamentApprovalRequest,
): Promise<TournamentApprovalResponse> {
  const response = await fetch(`/api/admin/tournaments/${encodeURIComponent(tournamentId)}/approval`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  })
  const noteError = response.ok
    ? undefined
    : await response.clone().json().then((data: { fields?: { note?: unknown } }) => data?.fields?.note, () => undefined)
  try {
    return await handleResponse<TournamentApprovalResponse>(response)
  } catch (err) {
    if (typeof noteError === 'string' && err instanceof Error) Object.assign(err, { noteError })
    throw err
  }
}
