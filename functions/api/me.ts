import type { Env } from '../types'
import { isResponse, requireUser } from '../utils/auth'
import {
  getMemberById,
  updateMemberProfile,
  upsertMemberFromAuth,
  validateFullName,
} from '../utils/members'
import { isValidUscfId, refreshUscfSoon } from '../utils/uscf'
import { getDirectedTournamentIds } from '../utils/permissions'
import { listChildren } from '../utils/family'
import {
  errorResponse,
  handleOptions,
  jsonResponse,
  parseJsonBody,
} from '../utils/response'

interface PatchMeBody {
  fullName?: string
  uscfId?: string | null
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const authResult = await requireUser(context.request, context.env)
  if (isResponse(authResult)) return authResult

  let member = await getMemberById(context.env.DB, authResult.id)
  if (!member) {
    member = await upsertMemberFromAuth(context.env.DB, authResult, context.env)
  }

  // The member's own entries plus their children's (family accounts), with
  // the player's name so the dashboard can say who each entry is for.
  const registrations = await context.env.DB.prepare(
    `SELECT r.*, t.name as tournament_name, t.date as tournament_date, t.location as tournament_location,
            p.full_name AS player_name, (r.member_id != ?1) AS is_child_entry
     FROM registrations r
     JOIN tournaments t ON t.id = r.tournament_id
     JOIN members p ON p.id = r.member_id
     WHERE r.member_id = ?1 OR p.guardian_id = ?1
     ORDER BY r.registered_at DESC`,
  )
    .bind(authResult.id)
    .all()

  const children = await listChildren(context.env.DB, authResult.id)

  const directedTournamentIds = await getDirectedTournamentIds(
    context.env.DB,
    authResult.id,
  )

  let directedTournaments: unknown[] = []
  if (directedTournamentIds.length > 0) {
    const placeholders = directedTournamentIds.map(() => '?').join(', ')
    const directed = await context.env.DB.prepare(
      `SELECT id, name, date, status FROM tournaments WHERE id IN (${placeholders})`,
    )
      .bind(...directedTournamentIds)
      .all()
    directedTournaments = directed.results ?? []
  }

  return jsonResponse({
    member,
    registrations: registrations.results ?? [],
    directedTournaments,
    children,
  })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const authResult = await requireUser(context.request, context.env)
  if (isResponse(authResult)) return authResult

  const member = await upsertMemberFromAuth(context.env.DB, authResult, context.env)
  return jsonResponse({ member }, 201)
}

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const authResult = await requireUser(context.request, context.env)
  if (isResponse(authResult)) return authResult

  const body = await parseJsonBody<PatchMeBody>(context.request)
  if (!body) {
    return errorResponse('Invalid JSON body', 400)
  }

  // Validate before touching the row. Absent fields are left alone; the
  // difference between "not sent" and "sent empty" is the whole contract of
  // a PATCH, and only the latter is an error.
  if (body.fullName !== undefined) {
    const problem = validateFullName(body.fullName)
    if (problem) return errorResponse(problem, 400)
  }

  // null clears the ID deliberately. Anything else has to be a real one —
  // a malformed value here silently breaks the ratings lookup later, where
  // it is much harder to trace back to the profile form.
  if (body.uscfId !== undefined && body.uscfId !== null && body.uscfId !== '') {
    if (!isValidUscfId(body.uscfId)) {
      return errorResponse('A USCF ID is 8 digits', 400)
    }
  }

  // Make sure the row exists before updating it — someone who registered but
  // has never loaded their dashboard has a Supabase user and no members row.
  // The earlier US Chess ID tells us below whether it just changed.
  const before = await getMemberById(context.env.DB, authResult.id)
  if (!before) {
    await upsertMemberFromAuth(context.env.DB, authResult, context.env)
  }

  const updated = await updateMemberProfile(context.env.DB, authResult.id, {
    fullName: body.fullName?.trim(),
    // An empty string means "remove it", same as null — the form sends one
    // or the other depending on whether the field was cleared or never set.
    uscfId: body.uscfId === '' ? null : body.uscfId?.trim() ?? body.uscfId,
  })

  if (!updated) {
    return errorResponse('Member not found', 404)
  }

  // A new or changed US Chess ID: fetch its rating and expiry now.
  if (updated.uscf_id && updated.uscf_id !== (before?.uscf_id ?? null)) {
    await refreshUscfSoon(context.env.DB, updated.id, updated.uscf_id)
    return jsonResponse({ member: (await getMemberById(context.env.DB, updated.id)) ?? updated })
  }

  return jsonResponse({ member: updated })
}
