// functions/api/admin/members/export.ts
//
// Download the member list as CSV. Admins and observers.
//   ?type=emails   name and email, one row per address (a parent and
//                  their children share an email, so it appears once)
//   ?type=full     name, email, LCA membership status and expiry,
//                  US Chess ID and expiry
//   &who=all | current (LCA membership active) | lapsed (expired or never paid)
//   &children=1    include children on family accounts (full list only)
//   &format=list   emails only as plain text, one per line (for Copy)
// Every export is written to the admin activity log.
import type { Env } from '../../../types'
import { isResponse, requireAdminView } from '../../../utils/auth'
import { recordAdminAction } from '../../../utils/audit'
import { toCsv } from '../../../utils/csv'
import { errorResponse, handleOptions } from '../../../utils/response'

interface Row {
  id: string
  full_name: string
  email: string
  role: string
  membership_status: string
  membership_expiry: string | null
  membership_type: string | null
  club_name: string | null
  uscf_id: string | null
  uscf_rating: number | null
  uscf_expiration: string | null
  guardian_id: string | null
  guardian_name: string | null
  created_at: string
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const auth = await requireAdminView(context.request, context.env)
  if (isResponse(auth)) return auth

  const url = new URL(context.request.url)
  const type = url.searchParams.get('type') === 'full' ? 'full' : 'emails'
  const who = (['all', 'current', 'lapsed'] as const).find((w) => w === url.searchParams.get('who')) ?? 'all'
  const children = type === 'full' && url.searchParams.get('children') === '1'
  const asList = type === 'emails' && url.searchParams.get('format') === 'list'

  const where = ["m.role != 'guest'"]
  if (who === 'current') where.push("m.membership_status = 'active'")
  if (who === 'lapsed') where.push("m.membership_status != 'active'")
  if (!children) where.push('m.guardian_id IS NULL')

  const { results } = await context.env.DB.prepare(
    `SELECT m.id, m.full_name, m.email, m.role, m.membership_status, m.membership_expiry, m.membership_type,
            c.name AS club_name, m.uscf_id, m.uscf_rating, m.uscf_expiration, m.guardian_id,
            g.full_name AS guardian_name, m.created_at
       FROM members m
       LEFT JOIN clubs c ON c.id = m.club_id
       LEFT JOIN members g ON g.id = m.guardian_id
      WHERE ${where.join(' AND ')}
      ORDER BY m.full_name COLLATE NOCASE`,
  ).all<Row>()
  const rows = results ?? []

  let csv: string
  let count: number
  if (type === 'emails') {
    const seen = new Set<string>()
    const unique = rows.filter((r) => {
      const key = r.email.trim().toLowerCase()
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
    count = unique.length
    csv = asList
      ? unique.map((r) => r.email.trim()).join('\n')
      : toCsv(['Name', 'Email'], unique.map((r) => [r.full_name, r.email.trim()]))
  } else {
    count = rows.length
    csv = toCsv(
      ['Name', 'Email', 'LCA membership', 'LCA expires', 'US Chess ID', 'US Chess expires'],
      rows.map((r) => [
        r.full_name, r.email, r.membership_status, r.membership_expiry,
        r.uscf_id, r.uscf_expiration?.slice(0, 10) ?? null,
      ]),
    )
  }
  if (count === 0) return errorResponse('Nobody matches those options', 404)

  await recordAdminAction(context.env.DB, auth.member, {
    action: 'members_export',
    targetLabel: `${count} ${type === 'emails' ? 'email addresses' : 'members'}`,
    detail: { type, who, children, count, copied: asList },
  })

  if (asList) {
    return new Response(csv, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Row-Count': String(count) } })
  }
  const stamp = new Date().toISOString().slice(0, 10)
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="lca-${type === 'emails' ? 'emails' : 'members'}-${who}-${stamp}.csv"`,
      'Cache-Control': 'no-store',
      'X-Row-Count': String(count),
    },
  })
}
