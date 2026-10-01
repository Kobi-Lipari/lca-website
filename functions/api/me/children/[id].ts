// functions/api/me/children/[id].ts — edit or remove one of your children.
import type { Env } from '../../../types'
import { isResponse, requireAuthedMember } from '../../../utils/auth'
import { listChildren } from '../../../utils/family'
import { validateFullName } from '../../../utils/members'
import { isValidUscfId, refreshUscfSoon } from '../../../utils/uscf'
import { errorResponse, handleOptions, jsonResponse, parseJsonBody } from '../../../utils/response'

interface EditChildBody {
  fullName?: string
  uscfId?: string | null
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

async function ownChild(db: D1Database, childId: string, guardianId: string) {
  return db
    .prepare('SELECT id, full_name, uscf_id FROM members WHERE id = ? AND guardian_id = ?')
    .bind(childId, guardianId)
    .first<{ id: string; full_name: string; uscf_id: string | null }>()
}

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const authed = await requireAuthedMember(context.request, context.env)
  if (isResponse(authed)) return authed

  const childId = context.params.id as string
  const child = await ownChild(context.env.DB, childId, authed.member.id)
  if (!child) return errorResponse('Not found', 404)

  const body = await parseJsonBody<EditChildBody>(context.request)
  if (!body) return errorResponse('Invalid JSON body', 400)

  let fullName = child.full_name
  if (body.fullName !== undefined) {
    const problem = validateFullName(body.fullName)
    if (problem) return errorResponse(problem, 400)
    fullName = body.fullName.trim()
  }

  let uscfId = child.uscf_id
  if (body.uscfId !== undefined) {
    uscfId = body.uscfId?.trim() || null
    if (uscfId && !isValidUscfId(uscfId)) return errorResponse('A USCF ID is 8 digits', 400)
    if (uscfId && uscfId !== child.uscf_id) {
      const taken = await context.env.DB.prepare(
        `SELECT 1 FROM members WHERE uscf_id = ? AND id != ? AND role != 'guest'`,
      ).bind(uscfId, childId).first()
      if (taken) return errorResponse('That USCF ID already belongs to another LCA account', 409)
    }
  }

  await context.env.DB.prepare('UPDATE members SET full_name = ?, uscf_id = ? WHERE id = ?')
    .bind(fullName, uscfId, childId)
    .run()
  if (uscfId && uscfId !== child.uscf_id) await refreshUscfSoon(context.env.DB, childId, uscfId)

  return jsonResponse({ children: await listChildren(context.env.DB, authed.member.id) })
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const authed = await requireAuthedMember(context.request, context.env)
  if (isResponse(authed)) return authed

  const childId = context.params.id as string
  const child = await ownChild(context.env.DB, childId, authed.member.id)
  if (!child) return errorResponse('Not found', 404)

  // A child who has played keeps their record: games, standings and rating
  // reports point at this row. Only a profile that was never used can go.
  const used = await context.env.DB.prepare(
    `SELECT 1 FROM registrations WHERE member_id = ?
     UNION ALL SELECT 1 FROM payments WHERE member_id = ? LIMIT 1`,
  ).bind(childId, childId).first()
  if (used) {
    return errorResponse(
      `${child.full_name} has tournament history, so their profile can't be removed. Contact us if you need it changed.`,
      409,
    )
  }

  await context.env.DB.prepare('DELETE FROM members WHERE id = ? AND guardian_id = ?')
    .bind(childId, authed.member.id)
    .run()

  return jsonResponse({ children: await listChildren(context.env.DB, authed.member.id) })
}
