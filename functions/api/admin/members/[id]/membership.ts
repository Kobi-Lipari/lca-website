import type { Env } from '../../../../types'
import { jsonResponse, errorResponse, handleOptions } from '../../../../utils/response'
import { requireAdmin, isResponse } from '../../../../utils/auth'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPatch: PagesFunction<Env> = async (ctx) => {
  const auth = await requireAdmin(ctx.request, ctx.env)
  if (isResponse(auth)) return auth

  const { id } = ctx.params as { id: string }
  const body = await ctx.request.json() as any

  const status = body.membershipStatus as string | undefined
  const expiry = body.membershipExpiry as string | null | undefined

  if (status && !['active', 'expired', 'pending'].includes(status)) {
    return errorResponse('Invalid membership status', 400)
  }

  await ctx.env.DB.prepare(
    'UPDATE members SET membership_status = COALESCE(?, membership_status), membership_expiry = ? WHERE id = ?'
  ).bind(status ?? null, expiry ?? null, id).run()

  const member = await ctx.env.DB.prepare('SELECT * FROM members WHERE id = ?').bind(id).first()
  if (!member) return errorResponse('Member not found', 404)

  return jsonResponse({ member })
}