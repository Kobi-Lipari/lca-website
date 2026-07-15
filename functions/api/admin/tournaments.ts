// functions/api/admin/tournaments.ts
import type { Env } from '../../types'
import { isResponse, requireAuthedMember } from '../../utils/auth'
import { errorResponse, handleOptions, jsonResponse, parseJsonBody } from '../../utils/response'

interface CreateTournamentBody {
  id?: string
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
  clubId?: string | null
  isRated?: boolean
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64)
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const authed = await requireAuthedMember(context.request, context.env)
  if (isResponse(authed)) return authed

  const { member } = authed

  const isAdmin = member.role === 'lca_admin'
  const isClubRep = member.role === 'club_rep'

  // LAUNCH LOCKDOWN: tournament creation is lca_admin-only while the site is
  // being tested with real member accounts. The club_rep path below is kept
  // intact — to re-enable it, delete this guard and the pinning test
  // 'club_rep cannot create tournaments during launch lockdown' will fail,
  // reminding you the policy change is deliberate.
  if (!isAdmin) {
    return errorResponse('Tournament creation is limited to LCA admins during launch testing', 403)
  }

  if (!isAdmin && !isClubRep) {
    return errorResponse('Forbidden', 403)
  }

  const body = await parseJsonBody<CreateTournamentBody>(context.request)
  if (!body?.name || !body.location || !body.date || body.entryFee == null) {
    return errorResponse('name, location, date, and entryFee are required', 400)
  }

  const clubId = body.clubId ?? (isClubRep ? member.club_id : null)
  if (isClubRep && clubId !== member.club_id) {
    return errorResponse('Club reps can only create tournaments for their club', 403)
  }

  if (clubId) {
    const club = await context.env.DB.prepare('SELECT id FROM clubs WHERE id = ?')
      .bind(clubId)
      .first()
    if (!club) return errorResponse('Club not found', 404)
  }

  const sections = body.sections?.length
    ? body.sections
    : [{ name: 'Open', entryFee: body.entryFee }]

  const id = body.id?.trim() || `${slugify(body.name)}-${Date.now().toString(36)}`
  const status = body.status ?? 'upcoming'
  if (!['upcoming', 'active', 'completed'].includes(status)) {
    return errorResponse('Invalid status', 400)
  }

  const isRated = body.isRated !== false ? 1 : 0

  await context.env.DB.prepare(
    `INSERT INTO tournaments (
      id, name, location, venue, date, end_date, entry_fee, sections,
      rounds, max_players, status, description, registration_deadline,
      club_id, created_by, is_rated
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      body.name,
      body.location,
      body.venue ?? null,
      body.date,
      body.endDate ?? null,
      body.entryFee,
      JSON.stringify(sections),
      body.rounds ?? 5,
      body.maxPlayers ?? null,
      status,
      body.description ?? null,
      body.registrationDeadline ?? null,
      clubId,
      member.id,
      isRated,
    )
    .run()

  const tournament = await context.env.DB.prepare(
    'SELECT * FROM tournaments WHERE id = ?',
  )
    .bind(id)
    .first()

  return jsonResponse({ tournament }, 201)
}
