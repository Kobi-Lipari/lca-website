// src/areas/governance/api.ts
//
// The governance area's calls to the site's API: board seats and officer
// photos, board members, governance documents and the board inbox.
//
// Moved whole from src/lib/api.ts by scripts/split-api.ts, following
// scripts/moves/api-split.json. src/lib/api.ts re-exports everything here,
// so pages and components may keep importing from '@/lib/api'. A type
// another area owns is imported from that area's api.ts, never from
// '@/lib/api', which re-exports this file.

import { authHeaders, handleResponse } from '@/lib/http'

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
  /** Club regions this seat covers (regional representative seats). */
  regions?: string[]
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
  /** Club count per region; '' is clubs with no region set. */
  regionClubs?: { region: string; clubs: number }[]
}> {
  const response = await fetch('/api/admin/board-seats', {
    headers: await authHeaders(),
  })
  return handleResponse(response)
}

/** Which club regions a regional representative's seat covers. */
export async function adminSetSeatRegions(seatId: string, regions: string[]): Promise<{ seatId: string; regions: string[] }> {
  const response = await fetch('/api/admin/seat-regions', {
    method: 'PUT',
    headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ seatId, regions }),
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
  /** Club regions a regional seat covers. Empty for officer seats. */
  regions?: string[]
}

/** A club this member manages as its region's representative. */
export interface ApiManagedClub {
  id: string
  name: string
  region: string | null
}

export async function getMySeats(): Promise<{ seats: ApiMySeat[]; managedClubs?: ApiManagedClub[] }> {
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
