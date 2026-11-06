// functions/api/me/tournament-creation.ts
//
// GET /api/me/tournament-creation: what the signed-in member may create, the
// creation rules' answer (domain/events/creation.ts) for the person their
// database half reads (functions/utils/events/creation.ts), and nothing
// about anyone else. The setup checklist, Events you direct and My LCA's
// line read it once their pages come (WS08 steps 8 and 10); no page calls it
// yet. Its contract is tournamentCreationResponseSchema in
// domain/contracts/me.ts.
//
// canCreate is the answer for an LCA-run event, one with no club, so a club
// rep reads false here and creates through its own club as today, the page
// keeping its own rule for a rep, which clubId names. With CREATION_ROLES_ON
// unset the answer is today's grants: an LCA admin's and a club rep's, none
// for everyone else, and canChargeFees true for everyone, since today anyone
// who manages an event may set a fee.
import type { Env } from '../../types'
import { isResponse, requireAuthedMember } from '../../utils/auth'
import { handleOptions, jsonResponse } from '../../utils/response'
import { CREATION_ROLES_ON, creationPerson } from '../../utils/events/creation'
import { canChargeFees, canCreate } from '../../../domain/events/creation'
import type { TournamentCreationResponse } from '../../../domain/contracts/me'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const authed = await requireAuthedMember(context.request, context.env)
  if (isResponse(authed)) return authed

  // CREATION_ROLES_ON is read here, at each request, as the create reads it;
  // while it is unset the seat and the tournament_director role grant
  // nothing, so the answer is today's.
  const rolesOn = CREATION_ROLES_ON
  const person = await creationPerson(context.env.DB, authed.member, rolesOn)
  const answer: TournamentCreationResponse = {
    grant: person.grant,
    canCreate: canCreate(person, null, rolesOn),
    canChargeFees: canChargeFees(person, { clubId: person.repClubId, createdBy: null }, rolesOn),
    clubId: person.repClubId,
  }
  return jsonResponse(answer)
}
