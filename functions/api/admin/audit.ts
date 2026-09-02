// functions/api/admin/audit.ts
import type { Env } from '../../types'
import { isResponse, requireAdmin } from '../../utils/auth'
import { handleOptions, jsonResponse } from '../../utils/response'

const MAX_LIMIT = 200
const DEFAULT_LIMIT = 100

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

/**
 * Reads the admin audit log, newest first.
 *
 * lca_admin only — deliberately not opened to club_rep or tournament_director,
 * since the entries name members and the roles they hold.
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const authResult = await requireAdmin(context.request, context.env)
  if (isResponse(authResult)) return authResult

  const url = new URL(context.request.url)
  const action = url.searchParams.get('action')

  const parsedLimit = Number(url.searchParams.get('limit') ?? DEFAULT_LIMIT)
  const limit =
    Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(Math.floor(parsedLimit), MAX_LIMIT)
      : DEFAULT_LIMIT

  const where: string[] = []
  const binds: unknown[] = []
  if (action) {
    where.push('action = ?')
    binds.push(action)
  }

  const { results } = await context.env.DB.prepare(
    `SELECT id, actor_id, actor_email, action, target_member_id, target_label,
            detail, created_at
       FROM admin_audit_log
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY created_at DESC, id DESC
      LIMIT ?`,
  )
    .bind(...binds, limit)
    .all()

  return jsonResponse({ entries: results ?? [] })
}
