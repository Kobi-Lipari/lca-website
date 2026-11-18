// domain/contracts/clubReply.ts
//
// The contract of GET and POST /api/clubs/reply/[token] (getClubReply and
// sendClubReply), Reply through LCA (WS09 step 27): a representative of the
// club's region or an LCA admin answers a message a visitor sent from a
// club's page, with no address shown either way.
//
// The GET answers the least: the visitor's first name, the club's name and
// the first lines of the message, as the sealed link holds them. Never the
// visitor's address, never their whole name, never a volunteer's.
//
// The POST's request is the answer's words and nothing else: a key it does
// not name is dropped before the handler reads the body, so no recipient,
// copy, subject or reply-to can come from a request. Its answer is that the
// reply went, with the first name the page's sent words use.
import { z } from 'zod'
import { REPLY_FIELD_WORDS as W, REPLY_MESSAGE_LIMIT } from '../clubs/replyMessage'

/** GET /api/clubs/reply/[token]. */
export const clubReplyResponseSchema = z.strictObject({
  /** The visitor's first name. */
  firstName: z.string(),
  /** The club's name. */
  club: z.string(),
  /** The first lines of the visitor's message, as the link holds them. */
  excerpt: z.string(),
})

/** POST /api/clubs/reply/[token]. */
export const clubReplyRequestSchema = z.object({
  message: z.string(W.missing)
    .refine((v) => v.trim() !== '', W.missing)
    .refine((v) => v.length <= REPLY_MESSAGE_LIMIT, W.long),
})

/** The answer once the reply went. */
export const clubReplySentResponseSchema = z.strictObject({
  sent: z.literal(true),
  firstName: z.string(),
})

export type ClubReplyResponse = z.infer<typeof clubReplyResponseSchema>
export type ClubReplyRequest = z.infer<typeof clubReplyRequestSchema>
export type ClubReplySentResponse = z.infer<typeof clubReplySentResponseSchema>
