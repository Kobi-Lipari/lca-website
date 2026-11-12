// domain/contracts/me.ts
// The contracts of the endpoints under functions/api/me/ that WS08 step 7
// and WS16 step 6 add, each for the signed-in member alone:
// - GET /api/me/tournament-creation, what the person may create, as the
//   creation rules in domain/events/creation.ts answer it;
// - POST /api/me/payout-request, the request for a payout account, which
//   opens one support ticket of kind payout_request per member and answers
//   the open one while it stays open, by its id and never its number;
// - GET /api/me/media-manager (WS16 step 6), whether the person sends the
//   LCA newsletter as the media manager and whether their session carries a
//   second factor.
//
// Response schemas are strict, like the other contracts: a field the
// endpoint starts or stops sending fails its contract test until the schema
// says so. The request is loose, as every request schema is, so a key a page
// sends beside the ones named here passes through and is ignored.
import { z } from 'zod'
import { idSchema } from './common'

/**
 * The grant a person creates with, the five CreationGrant names in
 * domain/events/creation.ts. The president and the standing director count
 * only while CREATION_ROLES_ON is set, and read as none until then.
 */
export const creationGrantSchema = z.enum(['admin', 'president', 'standing_director', 'club_rep', 'none'])

/**
 * GET /api/me/tournament-creation: the person's grant; canCreate, whether
 * they may create an LCA-run event, one with no club; canChargeFees, whether
 * they may set an entry fee above $0 (D24); and clubId, the club they manage
 * as its club rep, null for everyone else. A club rep reads canCreate false
 * and creates through its own club, as today.
 */
export const tournamentCreationResponseSchema = z.strictObject({
  grant: creationGrantSchema,
  canCreate: z.boolean(),
  canChargeFees: z.boolean(),
  clubId: idSchema.nullable(),
})

/**
 * POST /api/me/payout-request's body: the event the request is about, if
 * any. It is named on the ticket only when the member manages the event.
 */
export const payoutRequestRequestSchema = z.looseObject({
  tournamentId: z.string().nullable().optional(),
})

/**
 * POST /api/me/payout-request: the member's open payout request, and whether
 * this request opened it (201) or found it open (200), status being the
 * ticket's own, open or in progress. The ticket carries no number: ticket
 * numbers are for staff and board members only, so a member's own support
 * list and conversation (functions/api/support.ts and support/[id].ts) and
 * the confirmation email leave it out, and this answer does too.
 */
export const payoutRequestResponseSchema = z.strictObject({
  ticket: z.strictObject({
    id: z.string(),
    kind: z.literal('payout_request'),
    status: z.string(),
  }),
  created: z.boolean(),
})

/**
 * GET /api/me/media-manager: mediaManager, whether the person sends as the
 * media manager, false for everyone while the newsletter is switched off on
 * the server, and otherwise true for a member whose role Admin does not let
 * in who holds the Media manager seat now; and secondFactor, whether the
 * session carries a second factor. The site draws from it; the newsletter's
 * guard reads the seat again at each request.
 */
export const mediaManagerResponseSchema = z.strictObject({
  mediaManager: z.boolean(),
  secondFactor: z.boolean(),
})

export type CreationGrant = z.infer<typeof creationGrantSchema>
export type TournamentCreationResponse = z.infer<typeof tournamentCreationResponseSchema>
export type PayoutRequestRequest = z.infer<typeof payoutRequestRequestSchema>
export type PayoutRequestResponse = z.infer<typeof payoutRequestResponseSchema>
export type MediaManagerResponse = z.infer<typeof mediaManagerResponseSchema>
