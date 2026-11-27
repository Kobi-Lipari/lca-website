// domain/contracts/clubContact.ts
//
// The contract of POST /api/clubs/[id]/contact (sendClubMessage), the
// message a visitor sends a club from its page (WS09 step 26). The request
// is the visitor's three fields and the spam check's token, and nothing
// else: a key it does not name is dropped before the handler reads the body,
// so no recipient, copy or subject can come from a request. Each field is
// held to the rules of domain/clubs/contactMessage.ts, which the form reads
// too, so the form and the server refuse in the same words.
//
// The answer is the same small body for every message that went, whoever
// took it: it never says which keeper, and never an address.
import { z } from 'zod'
import { CONTACT_FIELD_WORDS as W, CONTACT_LIMITS, hasLineBreak, hasText, isPlainAddress } from '../clubs/contactMessage'

/** POST /api/clubs/[id]/contact. */
export const clubContactRequestSchema = z.object({
  name: z.string(W.nameMissing)
    .refine(hasText, W.nameMissing)
    .refine((v) => v.length <= CONTACT_LIMITS.name, W.nameLong)
    .refine((v) => !hasLineBreak(v), W.nameBreak),
  email: z.string(W.emailMissing)
    .refine(hasText, W.emailMissing)
    .refine((v) => v.length <= CONTACT_LIMITS.email, W.emailLong)
    .refine((v) => !hasLineBreak(v) && isPlainAddress(v.trim()), W.emailForm),
  message: z.string(W.messageMissing)
    .refine(hasText, W.messageMissing)
    .refine((v) => v.length <= CONTACT_LIMITS.message, W.messageLong),
  /** The spam check's token; the check itself refuses one that is missing or empty. */
  token: z.string().optional(),
})

/** The answer once some keeper's address took the message. */
export const clubContactResponseSchema = z.strictObject({
  sent: z.literal(true),
})

export type ClubContactRequest = z.infer<typeof clubContactRequestSchema>
export type ClubContactResponse = z.infer<typeof clubContactResponseSchema>
