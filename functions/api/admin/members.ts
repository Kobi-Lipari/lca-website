// functions/api/admin/members.ts
import type { Env } from '../../types'
import { isResponse, requireMemberDirectory } from '../../utils/auth'
import { handleOptions, jsonResponse } from '../../utils/response'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const authResult = await requireMemberDirectory(context.request, context.env)
  if (isResponse(authResult)) return authResult

  const isAdmin = authResult.member.role === 'lca_admin'

  // A tournament director gets exactly the columns their view renders, plus
  // the USCF id the search box matches on. Hiding a column in the UI is not
  // hiding it — anyone can open the network tab — so role, club and the rest
  // are left out of the response rather than out of the table.
  const columns = isAdmin
    ? 'm.*, c.name as club_name'
    : 'm.id, m.full_name, m.email, m.uscf_id, m.membership_status, m.membership_expiry'

  // role != 'guest' keeps walk-in synthetic members out of member management
  const { results } = await context.env.DB.prepare(
    `SELECT ${columns}
     FROM members m
     LEFT JOIN clubs c ON c.id = m.club_id
     WHERE m.role != 'guest'
     ORDER BY m.full_name ASC`,
  ).all()

  return jsonResponse({ members: results ?? [] })
}