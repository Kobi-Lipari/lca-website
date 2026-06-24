// functions/api/registrations/[id].ts
import type { Env } from '../../types'
import { isResponse, requireAuthedMember } from '../../utils/auth'
import { errorResponse, handleOptions, jsonResponse, parseJsonBody } from '../../utils/response'

interface UpdateRegistrationBody {
  byeRounds?: number[]
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const registrationId = context.params.id as string
  const authed = await requireAuthedMember(context.request, context.env)
  if (isResponse(authed)) return authed

  const registration = await context.env.DB.prepare(
    'SELECT * FROM registrations WHERE id = ?',
  ).bind(registrationId).first<{
    id: string
    tournament_id: string
    member_id: string
    bye_rounds: string | null
  }>()

  if (!registration) return errorResponse('Registration not found', 404)

  // Members can only update their own registration; admins can update any
  if (
    registration.member_id !== authed.member.id &&
    authed.member.role !== 'lca_admin'
  ) {
    return errorResponse('Forbidden', 403)
  }

  const body = await parseJsonBody<UpdateRegistrationBody>(context.request)
  if (!body) return errorResponse('Invalid JSON body', 400)

  // Get tournament to validate rounds
  const tournament = await context.env.DB.prepare(
    'SELECT rounds, registration_status FROM tournaments WHERE id = ?',
  ).bind(registration.tournament_id).first<{
    rounds: number
    registration_status: string
  }>()

  if (!tournament) return errorResponse('Tournament not found', 404)

  const byeRounds = body.byeRounds ?? []
  const maxByes = tournament.rounds - 1

  if (byeRounds.length > maxByes) {
    return errorResponse(
      `You can request at most ${maxByes} bye${maxByes !== 1 ? 's' : ''} (one less than total rounds)`,
      400,
    )
  }

  const invalidRound = byeRounds.find((r) => r < 1 || r > tournament.rounds)
  if (invalidRound !== undefined) {
    return errorResponse(`Round ${invalidRound} is not valid for this tournament`, 400)
  }

  await context.env.DB.prepare(
    'UPDATE registrations SET bye_rounds = ? WHERE id = ?',
  ).bind(
    byeRounds.length > 0 ? JSON.stringify(byeRounds) : null,
    registrationId,
  ).run()

  const updated = await context.env.DB.prepare(
    'SELECT * FROM registrations WHERE id = ?',
  ).bind(registrationId).first()

  return jsonResponse({ registration: updated })
}