// domain/contracts/clubRequests.ts
//
// The contracts of Suggest a club and Start a club (WS09 step 30).
//
// POST /api/clubs/reports (sendClubRequest) is what a visitor sends from the
// form at /clubs/suggest: which of the two kinds, the club's name, a city or
// ZIP code as they typed it, where and when in their own words, their name,
// their address and the spam check's token. Nothing else: a key it does not
// name is dropped before the handler reads the body, so no recipient, copy,
// subject or link can come from a request. Each field is held to the rules
// of domain/clubs/newClub.ts, which the form reads too. The answer says only
// that it was sent: never the region found, never who it went to.
//
// clubRequestRowSchema is one open row of the two kinds as My region shows
// it to a keeper of its region and to an LCA admin: its id, its kind, the
// club's name, the place as typed, the words, the person's name and address
// (for the keeper to check with them), its region or none when the place was
// not found, and its age in whole days.
//
// POST /api/admin/club-reports/[reportId] (markClubRequestHandled) is Mark
// as handled for one such row: its one action, and an answer that names the
// row and its new status alone.
import { z } from 'zod'
import { CLUB_REQUEST_FIELD_WORDS as W, CLUB_REQUEST_KINDS, CLUB_REQUEST_LIMITS as L } from '../clubs/newClub'
import { hasLineBreak, hasText, isPlainAddress } from '../clubs/contactMessage'

/** A field of one line, with its three refusals. */
function oneLineField(max: number, missing: string, long: string, brk: string) {
  return z.string(missing)
    .refine(hasText, missing)
    .refine((v) => v.length <= max, long)
    .refine((v) => !hasLineBreak(v), brk)
}

/** POST /api/clubs/reports. */
export const clubRequestSchema = z.object({
  kind: z.enum(CLUB_REQUEST_KINDS, W.kindMissing),
  clubName: oneLineField(L.clubName, W.clubNameMissing, W.clubNameLong, W.clubNameBreak),
  place: oneLineField(L.place, W.placeMissing, W.placeLong, W.placeBreak),
  message: z.string(W.messageMissing)
    .refine(hasText, W.messageMissing)
    .refine((v) => v.length <= L.message, W.messageLong),
  name: oneLineField(L.name, W.nameMissing, W.nameLong, W.nameBreak),
  email: z.string(W.emailMissing)
    .refine(hasText, W.emailMissing)
    .refine((v) => v.length <= L.email, W.emailLong)
    .refine((v) => !hasLineBreak(v) && isPlainAddress(v.trim()), W.emailForm),
  /** The spam check's token; the check itself refuses one that is missing or empty. */
  token: z.string().optional(),
})

/** The answer once the row is saved: the same for every request, wherever it went. */
export const clubRequestResponseSchema = z.strictObject({
  sent: z.literal(true),
})

/** One open row of the two kinds, as My region shows it to a keeper of its region and to an LCA admin. */
export const clubRequestRowSchema = z.strictObject({
  id: z.number().int().positive(),
  kind: z.enum(CLUB_REQUEST_KINDS),
  clubName: z.string(),
  place: z.string(),
  message: z.string(),
  /** The person's name and address as they typed them, for the keeper to check with them; emptied once it is handled. */
  name: z.string(),
  email: z.string(),
  /** The region the place was found in; null when it was not found, which makes the row the LCA admins' alone. */
  region: z.string().nullable(),
  ageDays: z.number().int().nonnegative(),
})

/** POST /api/admin/club-reports/[reportId]: its one action. */
export const clubRequestHandledRequestSchema = z.object({
  action: z.literal('handled', 'Choose Mark as handled.'),
})

/** The answer once the row is marked: the row and its new status. */
export const clubRequestHandledResponseSchema = z.strictObject({
  id: z.number().int().positive(),
  status: z.literal('answered'),
})

export type ClubRequest = z.infer<typeof clubRequestSchema>
export type ClubRequestResponse = z.infer<typeof clubRequestResponseSchema>
export type ClubRequestRow = z.infer<typeof clubRequestRowSchema>
export type ClubRequestHandledRequest = z.infer<typeof clubRequestHandledRequestSchema>
export type ClubRequestHandledResponse = z.infer<typeof clubRequestHandledResponseSchema>
