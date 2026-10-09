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
  adminTournamentResponseSchema,
  createTournamentRequestSchema,
  tournamentsListResponseSchema,
  updateTournamentRequestSchema,
} from './events'
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
  'admin/tournaments': {
    POST: { request: createTournamentRequestSchema, response: adminTournamentResponseSchema },
  },
  'admin/tournaments/[id]': {
    PATCH: { request: updateTournamentRequestSchema, response: adminTournamentResponseSchema },
  },
  'admin/tournaments/[id]/waitlist': {
    POST: { request: waitlistOfferRequestSchema, response: waitlistOfferResponseSchema },
  },
  'admin/tournaments/[id]/walk-ins': {
    POST: { request: walkInRequestSchema, response: walkInResponseSchema },
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
} satisfies Record<string, RouteContracts>

export type ContractRoute = keyof typeof contracts
