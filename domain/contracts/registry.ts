// domain/contracts/registry.ts
// Which contract each endpoint keeps, keyed the way Pages file routing names
// the handler file under functions/api: functions/api/tournaments.ts is
// 'tournaments', functions/api/tournaments/[id].ts is 'tournaments/[id]', and
// an index.ts takes its folder's name.
//
// A route lists only the methods its file exports (onRequestGet is GET, and
// so on). OPTIONS is never listed: handleOptions answers it with no body.
//
// test/unit/contract-coverage.test.ts holds this list against the handler
// files. An endpoint with no entry here must be named in
// test/unit/contracts-pending.ts; when you add a contract, take its line out
// of that list and lower the count pinned there.
import type { ZodType } from 'zod'
import {
  adminClubResponseSchema,
  clubConfirmRequestSchema,
  clubConfirmResponseSchema,
  clubDetailResponseSchema,
  clubLinkConfirmRequestSchema,
  clubLinkConfirmResponseSchema,
  clubLinkResponseSchema,
  clubListResponseSchema,
  clubPlacesRequestSchema,
  clubPlacesResponseSchema,
  monthlyCheckRequestSchema,
  monthlyCheckResponseSchema,
  updateClubRequestSchema,
  updateClubResponseSchema,
  workspaceRegionResponseSchema,
} from './clubs'
import { clubContactRequestSchema, clubContactResponseSchema } from './clubContact'
import { clubPageResponseSchema } from './clubPage'
import {
  adminTournamentResponseSchema,
  clearinghouseQuerySchema,
  clearinghouseResponseSchema,
  createTournamentRequestSchema,
  ratingReportResponseSchema,
  registrationSettingsRequestSchema,
  tournamentApprovalRequestSchema,
  tournamentApprovalResponseSchema,
  tournamentDetailResponseSchema,
  tournamentDirectorRequestSchema,
  tournamentDirectorsResponseSchema,
  tournamentManageResponseSchema,
  tournamentsListResponseSchema,
  updateTournamentRequestSchema,
} from './events'
import {
  emailChoicesRequestSchema,
  emailChoicesResponseSchema,
  newsletterRequestSchema,
  newsletterResponseSchema,
  newsletterStopResponseSchema,
  newsletterSummaryResponseSchema,
  newsletterTestRequestSchema,
  newsletterTestResponseSchema,
  sesEventsResponseSchema,
  unsubscribeLinkResponseSchema,
  unsubscribeResponseSchema,
} from './mail'
import { mediaManagerResponseSchema, payoutRequestRequestSchema, payoutRequestResponseSchema, tournamentCreationResponseSchema } from './me'
import {
  batchRegistrationRequestSchema,
  batchRegistrationResponseSchema,
  createRegistrationRequestSchema,
  createRegistrationResponseSchema,
  updateRegistrationRequestSchema,
  updateRegistrationResponseSchema,
  waitlistOfferRequestSchema,
  waitlistOfferResponseSchema,
  walkInRequestSchema,
  walkInResponseSchema,
} from './registration'
import { searchQuerySchema, searchResponseSchema } from './search'

export const CONTRACT_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const
export type ContractMethod = (typeof CONTRACT_METHODS)[number]

export interface MethodContract {
  /** The JSON body the handler accepts. Loose: unknown keys pass through. */
  request?: ZodType
  /** The query string, as an object of strings. */
  query?: ZodType
  /** The JSON body of a successful answer. Strict, and checked by contract tests only. */
  response: ZodType
}

export type RouteContracts = Partial<Record<ContractMethod, MethodContract>>

export const contracts = {
  tournaments: {
    GET: { response: tournamentsListResponseSchema },
  },
  'admin/clubs/[id]': {
    GET: { response: adminClubResponseSchema },
    PATCH: { request: updateClubRequestSchema, response: updateClubResponseSchema },
  },
  'admin/clubs/[id]/confirm': {
    POST: { request: clubConfirmRequestSchema, response: clubConfirmResponseSchema },
  },
  'admin/clubs/[id]/places': {
    PUT: { request: clubPlacesRequestSchema, response: clubPlacesResponseSchema },
  },
  'admin/clubs/monthly-check': {
    POST: { request: monthlyCheckRequestSchema, response: monthlyCheckResponseSchema },
  },
  'admin/mail/newsletter': {
    GET: { response: newsletterSummaryResponseSchema },
    POST: { request: newsletterRequestSchema, response: newsletterResponseSchema },
  },
  'admin/mail/newsletter/stop': {
    POST: { response: newsletterStopResponseSchema },
  },
  'admin/mail/newsletter/test': {
    POST: { request: newsletterTestRequestSchema, response: newsletterTestResponseSchema },
  },
  'admin/tournaments': {
    POST: { request: createTournamentRequestSchema, response: adminTournamentResponseSchema },
  },
  'admin/tournaments/[id]': {
    PATCH: { request: updateTournamentRequestSchema, response: adminTournamentResponseSchema },
  },
  'admin/tournaments/[id]/approval': {
    POST: { request: tournamentApprovalRequestSchema, response: tournamentApprovalResponseSchema },
  },
  'admin/tournaments/[id]/directors': {
    GET: { response: tournamentDirectorsResponseSchema },
    POST: { request: tournamentDirectorRequestSchema, response: tournamentDirectorsResponseSchema },
    DELETE: { request: tournamentDirectorRequestSchema, response: tournamentDirectorsResponseSchema },
  },
  'admin/tournaments/[id]/manage': {
    GET: { response: tournamentManageResponseSchema },
  },
  'admin/tournaments/[id]/rating-report': {
    GET: { response: ratingReportResponseSchema },
  },
  'admin/tournaments/[id]/registration': {
    PATCH: { request: registrationSettingsRequestSchema, response: adminTournamentResponseSchema },
  },
  'admin/tournaments/[id]/waitlist': {
    POST: { request: waitlistOfferRequestSchema, response: waitlistOfferResponseSchema },
  },
  'admin/tournaments/[id]/walk-ins': {
    POST: { request: walkInRequestSchema, response: walkInResponseSchema },
  },
  clearinghouse: {
    GET: { query: clearinghouseQuerySchema, response: clearinghouseResponseSchema },
  },
  clubs: {
    GET: { response: clubListResponseSchema },
  },
  'clubs/[id]': {
    GET: { response: clubDetailResponseSchema },
  },
  'clubs/[id]/contact': {
    POST: { request: clubContactRequestSchema, response: clubContactResponseSchema },
  },
  'clubs/[id]/page': {
    GET: { response: clubPageResponseSchema },
  },
  'clubs/confirm/[token]': {
    GET: { response: clubLinkResponseSchema },
    POST: { request: clubLinkConfirmRequestSchema, response: clubLinkConfirmResponseSchema },
  },
  'mail/preferences/[token]': {
    GET: { response: emailChoicesResponseSchema },
    PATCH: { request: emailChoicesRequestSchema, response: emailChoicesResponseSchema },
  },
  'mail/ses-events': {
    POST: { response: sesEventsResponseSchema },
  },
  'mail/unsubscribe/[token]': {
    GET: { response: unsubscribeLinkResponseSchema },
    POST: { response: unsubscribeResponseSchema },
  },
  'me/media-manager': {
    GET: { response: mediaManagerResponseSchema },
  },
  'me/payout-request': {
    POST: { request: payoutRequestRequestSchema, response: payoutRequestResponseSchema },
  },
  'me/tournament-creation': {
    GET: { response: tournamentCreationResponseSchema },
  },
  registrations: {
    POST: { request: createRegistrationRequestSchema, response: createRegistrationResponseSchema },
  },
  'registrations/batch': {
    POST: { request: batchRegistrationRequestSchema, response: batchRegistrationResponseSchema },
  },
  'registrations/[id]': {
    PATCH: { request: updateRegistrationRequestSchema, response: updateRegistrationResponseSchema },
  },
  search: {
    GET: { query: searchQuerySchema, response: searchResponseSchema },
  },
  'tournaments/[id]': {
    GET: { response: tournamentDetailResponseSchema },
  },
  'workspace/region': {
    GET: { response: workspaceRegionResponseSchema },
  },
} satisfies Record<string, RouteContracts>

export type ContractRoute = keyof typeof contracts
