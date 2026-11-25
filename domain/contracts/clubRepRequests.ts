// domain/contracts/clubRepRequests.ts
//
// The contracts of Ask to be its named rep (WS09 step 31).
//
// POST /api/clubs/[id]/rep-requests (sendRepRequest) is what a signed-in
// member sends from a club's page: how they are connected to the club, one
// of four, and a note that may be empty. Nothing else: the member is the one
// the session names, and a key the contract does not name is dropped before
// the handler reads the body, so no member id, recipient or link can come
// from a request. The answer says only that it was sent: never who has it.
//
// repRequestRowSchema is one open request as My region and a club in My
// region show it to a keeper who may decide it: its id, the club, the
// member's name and address (for the keeper to write to them), the
// connection's key, the note, the day it was sent in words with its weekday,
// the member's role as it stands (which the decision names back), and the
// words the row draws: the question Name as rep asks, or why the keeper
// cannot name this member through this door.
//
// POST /api/admin/clubs/[id]/rep-requests/[requestId] (decideRepRequest) is
// a keeper's decision, approve or decline; an approve names the role the
// question named, and is refused in words if the member's role has changed
// since. The answer names the request and its new status alone.
import { z } from 'zod'
import { REP_CONNECTION_KEYS, REP_REQUEST_FIELD_WORDS as W, REP_REQUEST_LIMITS as L } from '../clubs/repRequest'

/** POST /api/clubs/[id]/rep-requests. */
export const repRequestSchema = z.object({
  connection: z.enum(REP_CONNECTION_KEYS, W.connectionMissing),
  note: z.string().refine((v) => v.length <= L.note, W.noteLong).optional(),
})

/** The answer once the request is saved: the same wherever it went. */
export const repRequestResponseSchema = z.strictObject({
  sent: z.literal(true),
})

/** One open request, as a keeper who may decide it reads it. */
export const repRequestRowSchema = z.strictObject({
  id: z.number().int().positive(),
  clubId: z.string(),
  clubName: z.string(),
  /** The member's name and address, for the keeper to write to them from their own mail. */
  memberName: z.string(),
  memberEmail: z.string(),
  connection: z.enum(REP_CONNECTION_KEYS),
  /** The member's note, or empty for none. */
  note: z.string(),
  /** The day it was sent, with its weekday: "Tue, Oct 20". */
  sentOn: z.string(),
  /** The member's role as it stands, which an approve names back. */
  memberRole: z.string(),
  /** The question Name as rep asks first, with what naming replaces or moves when it does. */
  nameQuestion: z.string(),
  /** Why this keeper cannot name this member, in place of Name as rep; null when they may. */
  noName: z.string().nullable(),
})

/** POST /api/admin/clubs/[id]/rep-requests/[requestId]. */
export const repDecisionRequestSchema = z.object({
  decision: z.enum(['approve', 'decline'], 'Choose Name as rep or Decline.'),
  /** For approve: the member's role as the question named it. */
  role: z.string().max(40).optional(),
})

/** The answer once the request is decided, with whether the email to the member went (told). */
export const repDecisionResponseSchema = z.strictObject({
  id: z.number().int().positive(),
  status: z.enum(['approved', 'declined']),
  told: z.boolean(),
})

export type RepRequest = z.infer<typeof repRequestSchema>
export type RepRequestResponse = z.infer<typeof repRequestResponseSchema>
export type RepRequestRow = z.infer<typeof repRequestRowSchema>
export type RepDecisionRequest = z.infer<typeof repDecisionRequestSchema>
export type RepDecisionResponse = z.infer<typeof repDecisionResponseSchema>
