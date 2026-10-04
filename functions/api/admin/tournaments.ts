// functions/api/admin/tournaments.ts
import type { Env } from '../../types'
import { isResponse, requireAdmin, requireAuthedMember } from '../../utils/auth'
import { errorResponse, handleOptions, jsonResponse, parseJsonBody } from '../../utils/response'
import { recordAdminAction } from '../../utils/audit'

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
  timeControl?: string | null
  registrationClosesAt?: string | null
  customDetails?: Array<{ title: string; body: string }>
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

  if (!isAdmin && !isClubRep) {
    return errorResponse('Forbidden', 403)
  }
  if (isAdmin) {
    // Second factor, as on every other admin action.
    const admin = await requireAdmin(context.request, context.env)
    if (isResponse(admin)) return admin
  }

  const body = await parseJsonBody<CreateTournamentBody>(context.request)
  if (!body?.name || !body.location || !body.date || body.entryFee == null) {
    return errorResponse('name, location, date, and entryFee are required', 400)
  }

  // A club rep always creates for their own club. A rep with no club would
  // create an event nobody but an admin could ever manage, so refuse instead.
  if (isClubRep && !member.club_id) {
    return errorResponse('Your account is not linked to a club yet. Ask an LCA admin to assign you one.', 403)
  }
  if (isClubRep && body.clubId && body.clubId !== member.club_id) {
    return errorResponse('Club reps can only create tournaments for their club', 403)
  }
  const clubId = isClubRep ? member.club_id : (body.clubId ?? null)

  if (clubId) {
    const club = await context.env.DB.prepare('SELECT id FROM clubs WHERE id = ?')
      .bind(clubId)
      .first()
    if (!club) return errorResponse('Club not found', 404)
  }

  const sections = body.sections?.length
    ? body.sections
    : [{ name: 'Open', entryFee: body.entryFee }]

  const id = (isAdmin && body.id?.trim()) || `${slugify(body.name)}-${Date.now().toString(36)}`
  const taken = await context.env.DB.prepare('SELECT 1 FROM tournaments WHERE id = ?').bind(id).first()
  if (taken) return errorResponse('A tournament with that id already exists', 409)
  const status = body.status ?? 'upcoming'
  if (!['upcoming', 'active', 'completed'].includes(status)) {
    return errorResponse('Invalid status', 400)
  }

  const isRated = body.isRated !== false ? 1 : 0

  // is_visible = 0: new tournaments are true drafts, hidden from public pages
  // until made visible from the management page. This makes the wizard's
  // "created as a draft" banner accurate (the column otherwise defaults to 1).
  await context.env.DB.prepare(
    `INSERT INTO tournaments (
      id, name, location, venue, date, end_date, entry_fee, sections,
      rounds, max_players, status, description, registration_deadline,
      club_id, created_by, is_rated, is_visible,
      time_control, registration_closes_at, custom_details
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
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
      body.timeControl ?? null,
      body.registrationClosesAt ?? null,
      body.customDetails?.length ? JSON.stringify(body.customDetails) : null,
    )
    .run()

  const tournament = await context.env.DB.prepare(
    'SELECT * FROM tournaments WHERE id = ?',
  )
    .bind(id)
    .first()

  await recordAdminAction(context.env.DB, member, {
    action: 'tournament_create',
    targetLabel: body.name,
    detail: { tournament_id: id },
  })

  return jsonResponse({ tournament }, 201)
}
