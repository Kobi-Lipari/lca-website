// functions/api/admin/members/[id]/membership.ts
import type { Env, MemberRow } from '../../../../types'
import { jsonResponse, errorResponse, handleOptions } from '../../../../utils/response'
import { recordAdminAction } from '../../../../utils/audit'
import { requireAdmin, isResponse } from '../../../../utils/auth'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPatch: PagesFunction<Env> = async (ctx) => {
  const auth = await requireAdmin(ctx.request, ctx.env)
  if (isResponse(auth)) return auth

  const { id } = ctx.params as { id: string }
  const body = (await ctx.request.json()) as Record<string, unknown>

  let status = body.membershipStatus as string | undefined
  const expiryProvided = 'membershipExpiry' in body
  const expiry = body.membershipExpiry as string | null | undefined

  if (status !== undefined && !['active', 'expired', 'pending'].includes(status)) {
    return errorResponse('Invalid membership status', 400)
  }
  if (expiryProvided && expiry !== null && typeof expiry !== 'string') {
    return errorResponse('Invalid membership expiry', 400)
  }
  if (status === undefined && !expiryProvided) {
    return errorResponse('Nothing to update', 400)
  }

  // Status is a stored column and nothing recomputes it on a schedule (the
  // cron Worker doesn't exist yet — ledger #3). So when an admin sets a new
  // expiry date without explicitly setting a status, derive the status from
  // the date: past → expired, today/future → active. An explicit status in
  // the same request still wins (so 'pending' can be set manually), and an
  // explicit-null expiry derives nothing (no date to derive from).
  if (expiryProvided && status === undefined && typeof expiry === 'string') {
    const today = new Date().toISOString().slice(0, 10)
    status = expiry.slice(0, 10) >= today ? 'active' : 'expired'
  }

  // Captured before the write so the log can show what it changed from.
  const before = await ctx.env.DB.prepare(
    'SELECT membership_status, membership_expiry FROM members WHERE id = ?',
  )
    .bind(id)
    .first<Pick<MemberRow, 'membership_status' | 'membership_expiry'>>()

  // Build SET clause only from fields actually being written, so PATCHing
  // status alone can never wipe the expiry (and vice versa).
  const sets: string[] = []
  const binds: unknown[] = []
  if (status !== undefined) {
    sets.push('membership_status = ?')
    binds.push(status)
  }
  if (expiryProvided) {
    sets.push('membership_expiry = ?')
    binds.push(expiry ?? null)
  }
  binds.push(id)

  await ctx.env.DB.prepare(
    `UPDATE members SET ${sets.join(', ')} WHERE id = ?`,
  ).bind(...binds).run()

  const member = await ctx.env.DB.prepare('SELECT * FROM members WHERE id = ?')
    .bind(id)
    .first<MemberRow>()
  if (!member) return errorResponse('Member not found', 404)

  // Membership status decides who gets member rates and who appears in
  // member-only sends, so an override is worth being able to attribute.
  await recordAdminAction(ctx.env.DB, auth.member, {
    action: 'membership_override',
    targetMemberId: member.id,
    targetLabel: `${member.full_name} <${member.email}>`,
    detail: {
      from: {
        status: before?.membership_status ?? null,
        expiry: before?.membership_expiry ?? null,
      },
      to: {
        status: member.membership_status,
        expiry: member.membership_expiry,
      },
    },
  })

  return jsonResponse({ member })
}
