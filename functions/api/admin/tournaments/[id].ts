import type { Env } from '../../../types'
import {
  isResponse,
  requireTournamentManager,
} from '../../../utils/auth'
import {
  errorResponse,
  handleOptions,
  jsonResponse,
  parseJsonBody,
} from '../../../utils/response'

interface UpdateTournamentBody {
  name?: string
  location?: string
  venue?: string | null
  date?: string
  endDate?: string | null
  entryFee?: number
  sections?: Array<{ name: string; entryFee: number; prizeFund?: string }>
  rounds?: number
  maxPlayers?: number | null
  status?: string
  description?: string | null
  registrationDeadline?: string | null
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const tournamentId = context.params.id as string
  const authResult = await requireTournamentManager(
    context.request,
    context.env,
    tournamentId,
  )
  if (isResponse(authResult)) return authResult

  const existing = await context.env.DB.prepare(
    'SELECT * FROM tournaments WHERE id = ?',
  )
    .bind(tournamentId)
    .first<Record<string, unknown>>()

  if (!existing) {
    return errorResponse('Tournament not found', 404)
  }

  const body = await parseJsonBody<UpdateTournamentBody>(context.request)
  if (!body) {
    return errorResponse('Invalid JSON body', 400)
  }

  if (body.status && !['upcoming', 'active', 'completed'].includes(body.status)) {
    return errorResponse('Invalid status', 400)
  }

  const sections =
    body.sections != null
      ? JSON.stringify(body.sections)
      : (existing.sections as string)

  await context.env.DB.prepare(
    `UPDATE tournaments SET
      name = ?, location = ?, venue = ?, date = ?, end_date = ?,
      entry_fee = ?, sections = ?, rounds = ?, max_players = ?,
      status = ?, description = ?, registration_deadline = ?
     WHERE id = ?`,
  )
    .bind(
      body.name ?? existing.name,
      body.location ?? existing.location,
      body.venue !== undefined ? body.venue : existing.venue,
      body.date ?? existing.date,
      body.endDate !== undefined ? body.endDate : existing.end_date,
      body.entryFee ?? existing.entry_fee,
      sections,
      body.rounds ?? existing.rounds,
      body.maxPlayers !== undefined ? body.maxPlayers : existing.max_players,
      body.status ?? existing.status,
      body.description !== undefined ? body.description : existing.description,
      body.registrationDeadline !== undefined
        ? body.registrationDeadline
        : existing.registration_deadline,
      tournamentId,
    )
    .run()

  const tournament = await context.env.DB.prepare(
    'SELECT * FROM tournaments WHERE id = ?',
  )
    .bind(tournamentId)
    .first()

  let parsedSections: unknown[] = []
  try {
    parsedSections = JSON.parse(
      (tournament as Record<string, unknown>).sections as string,
    ) as unknown[]
  } catch {
    parsedSections = []
  }

  return jsonResponse({
    tournament: { ...(tournament as object), sections: parsedSections },
  })
}
