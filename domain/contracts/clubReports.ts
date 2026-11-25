// domain/contracts/clubReports.ts
//
// The contracts of Suggest an update (WS09 step 28).
//
// POST /api/clubs/[id]/reports (sendClubSuggestion) is what a visitor sends
// from a club's page: which of the six parts changed, by its fixed key, what
// changed in their own words, an address only if they give one, and the spam
// check's token. Nothing else: a key it does not name is dropped before the
// handler reads the body, so no recipient, copy, subject or link can come
// from a request. Each part is held to the rules of
// domain/clubs/suggestion.ts, which the sheet reads too. The answer is the
// same small body for every suggestion saved, whoever keeps the club.
//
// POST /api/admin/clubs/[id]/reports/[reportId] (resolveClubSuggestion) is a
// keeper's answer to one open suggestion of that club: apply, answer with
// the keeper's words, or dismiss. Its answer names the row and its new
// status, and never the visitor's address or words.
//
// openSuggestionSchema is one open suggestion as My region's cards and the
// club's pages read it: its id, which part, the visitor's words, whether an
// address was left and its age in whole days. Never the address.
import { z } from 'zod'
import { SUGGESTION_FIELDS, SUGGESTION_FIELD_WORDS as W, SUGGESTION_LIMITS, hasSuggestionText } from '../clubs/suggestion'
import { REPLY_FIELD_WORDS, REPLY_MESSAGE_LIMIT } from '../clubs/replyMessage'
import { hasLineBreak, isPlainAddress } from '../clubs/contactMessage'

/** POST /api/clubs/[id]/reports. */
export const clubSuggestionRequestSchema = z.object({
  field: z.enum(SUGGESTION_FIELDS, W.fieldMissing),
  message: z.string(W.messageMissing)
    .refine(hasSuggestionText, W.messageMissing)
    .refine((v) => v.length <= SUGGESTION_LIMITS.message, W.messageLong),
  /** The visitor's address, only if they give one; empty is none. */
  email: z.string(W.emailForm)
    .refine((v) => v.length <= SUGGESTION_LIMITS.email, W.emailLong)
    .refine((v) => v.trim() === '' || (!hasLineBreak(v) && isPlainAddress(v.trim())), W.emailForm)
    .optional(),
  /** The spam check's token; the check itself refuses one that is missing or empty. */
  token: z.string().optional(),
})

/** The answer once the suggestion is saved. */
export const clubSuggestionResponseSchema = z.strictObject({
  sent: z.literal(true),
})

/** One open suggestion, as the keeper's pages read it: never the address. */
export const openSuggestionSchema = z.strictObject({
  kind: z.literal('suggestion'),
  id: z.number().int().positive(),
  field: z.enum(SUGGESTION_FIELDS),
  message: z.string(),
  hasAddress: z.boolean(),
  ageDays: z.number().int().nonnegative(),
})

/** The three things a keeper can do with an open suggestion. */
export const SUGGESTION_ACTIONS = ['apply', 'answer', 'dismiss'] as const

/** POST /api/admin/clubs/[id]/reports/[reportId]: the action, and for answer the keeper's words. */
export const clubReportActionRequestSchema = z.object({
  action: z.enum(SUGGESTION_ACTIONS, 'Choose apply, answer or dismiss.'),
  message: z.string(REPLY_FIELD_WORDS.missing)
    .refine((v) => v.length <= REPLY_MESSAGE_LIMIT, REPLY_FIELD_WORDS.long)
    .optional(),
}).refine((body) => body.action !== 'answer' || (body.message ?? '').trim() !== '', { message: REPLY_FIELD_WORDS.missing, path: ['message'] })

/** The answer once the action is done: the row and its new status. */
export const clubReportActionResponseSchema = z.strictObject({
  id: z.number().int().positive(),
  status: z.enum(['applied', 'answered', 'dismissed']),
})

export type ClubSuggestionRequest = z.infer<typeof clubSuggestionRequestSchema>
export type ClubSuggestionResponse = z.infer<typeof clubSuggestionResponseSchema>
export type OpenSuggestion = z.infer<typeof openSuggestionSchema>
export type SuggestionAction = (typeof SUGGESTION_ACTIONS)[number]
export type ClubReportActionRequest = z.infer<typeof clubReportActionRequestSchema>
export type ClubReportActionResponse = z.infer<typeof clubReportActionResponseSchema>
