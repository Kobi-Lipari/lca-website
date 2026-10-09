// functions/api/admin/tournaments.ts
import type { Env, TournamentRow } from '../../types'
import { isResponse, requireAuthedMember } from '../../utils/auth'
import { errorResponse, handleOptions, jsonResponse, parseBody } from '../../utils/response'
import { recordAdminAction } from '../../utils/audit'
import { getDb } from '../../db/client'
import { tournaments } from '../../db/schema'
import { createTournamentRequestSchema } from '../../../domain/contracts/events'
import { buildSaveSections, isSectionsConflict, loadSections, runBatch, toTournamentResponse } from '../../utils/events/sectionsRepo'
import { loadSchedules } from '../../utils/events/schedulesRepo'
import { SECTIONS_CHANGED_MESSAGE } from '../../../domain/events/sections'
import { LCA_RUN_NEEDS_MEMBERSHIP } from '../../../domain/membership/requirement'

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64)
}

/** A section of a create request, without the id it may carry. */
function withoutId<S extends { id?: string }>(section: S): S {
  const copy: S = { ...section }
  delete copy.id
  return copy
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

  const body = await parseBody(context.request, createTournamentRequestSchema)
  if (isResponse(body)) return body
  if (!body.name || !body.location || !body.date || body.entryFee == null) {
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

  // A new event has no section rows yet, so an id sent with a section (the
  // wizard copies the sections of an existing event as the list gave them)
  // names another event's row: each section is added as a new one.
  const sections = body.sections?.length
    ? body.sections.map((s) => (typeof s === 'string' ? s : withoutId(s)))
    : [{ name: 'Open', entryFee: body.entryFee }]

  const id = (isAdmin && body.id?.trim()) || `${slugify(body.name)}-${Date.now().toString(36)}`
  const taken = await context.env.DB.prepare('SELECT 1 FROM tournaments WHERE id = ?').bind(id).first()
  if (taken) return errorResponse('A tournament with that id already exists', 409)
  const status = body.status ?? 'upcoming'
  if (!['upcoming', 'active', 'completed'].includes(status)) {
    return errorResponse('Invalid status', 400)
  }

  const isRated = body.isRated !== false ? 1 : 0

  // A club-run event starts without the LCA membership requirement (clubs
  // get tournament creation first, free of charge); an LCA-run event always
  // has it. Only an admin or a club rep reaches this point, and a rep's event
  // is always their own club's, so either may set it.
  if (body.requiresLcaMembership === false && !clubId) {
    return errorResponse(LCA_RUN_NEEDS_MEMBERSHIP, 400)
  }
  const requiresLcaMembership = !clubId ? 1 : body.requiresLcaMembership ? 1 : 0
  const db = getDb(context.env.DB)

  // The row goes in with no sections (the column's default, '[]'), then
  // the one section writer adds the rows and the JSON, all in one batch.
  const plan = await buildSaveSections(db, id, sections, { reportSettings: null })
  if (!plan.ok) return errorResponse(plan.error, 400)

  // is_visible = 0: new tournaments are true drafts, hidden from public pages
  // until made visible from the management page. This makes the wizard's
  // "created as a draft" banner accurate (the column otherwise defaults to 1).
  const insert = db.insert(tournaments).values({
    id,
    name: body.name,
    location: body.location,
    venue: body.venue ?? null,
    date: body.date,
    endDate: body.endDate ?? null,
    entryFee: body.entryFee,
    rounds: body.rounds ?? 5,
    maxPlayers: body.maxPlayers ?? null,
    status,
    description: body.description ?? null,
    registrationDeadline: body.registrationDeadline ?? null,
    clubId,
    createdBy: member.id,
    isRated,
    isVisible: 0,
    timeControl: body.timeControl ?? null,
    registrationClosesAt: body.registrationClosesAt ?? null,
    customDetails: body.customDetails?.length ? JSON.stringify(body.customDetails) : null,
    requiresLcaMembership,
  })
  try {
    await runBatch(db, [insert, ...plan.queries])
  } catch (err) {
    if (isSectionsConflict(err)) return errorResponse(SECTIONS_CHANGED_MESSAGE, 409)
    throw err
  }

  const tournament = await context.env.DB.prepare(
    'SELECT * FROM tournaments WHERE id = ?',
  )
    .bind(id)
    .first<TournamentRow>()
  if (!tournament) return errorResponse('Tournament not found', 404)

  await recordAdminAction(context.env.DB, member, {
    action: 'tournament_create',
    targetLabel: body.name,
    detail: { tournament_id: id },
  })

  return jsonResponse({ tournament: toTournamentResponse(tournament, await loadSections(db, id), await loadSchedules(db, id)) }, 201)
}
