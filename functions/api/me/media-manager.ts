// functions/api/me/media-manager.ts
//
// GET /api/me/media-manager: whether the signed-in member sends the LCA
// newsletter as the media manager (WS16 step 6), and whether their session
// carries a second factor, about themselves alone. Its contract is
// mediaManagerResponseSchema in domain/contracts/me.ts. With mailLists on,
// the site asks it once a session, only for a signed-in member whose role
// Admin does not let in, or for an LCA officer who holds a seat
// (src/areas/admin/useMediaManager.ts), to draw Admin with Group email, alone
// or beside an officer's read-only sections, and the account menu's Group
// email link. Since checkpoint M's review it reads true for an officer who
// holds the Media manager seat, by the guard's own rule.
//
// It is never the grant: requireListMailer reads the seat again at each
// request, so a page told true by an answer that has gone stale is still
// refused once the term has ended. mediaManager is false for everyone while
// MAIL_LISTS_ON is unset, and no seat is read then; with it set it is
// sendsAsMediaManager's answer, the rule the guard applies. secondFactor is
// the token's own claim, read as requireAdmin reads it. Every answer, the
// 401 and the browser's check before a call among them, carries
// Cache-Control: no-store, so no copy of a person's answer is kept on the way.
import type { Env } from '../../types'
import { hasSecondFactor, isResponse, requireAuthedMember, sendsAsMediaManager } from '../../utils/auth'
import { MAIL_LISTS_ON } from '../../utils/mail/switches'
import { handleOptions, jsonResponse } from '../../utils/response'
import type { MediaManagerResponse } from '../../../domain/contracts/me'

/** The answer as it is, with no-store set on it. */
function noStore(response: Response): Response {
  response.headers.set('Cache-Control', 'no-store')
  return response
}

export const onRequestOptions: PagesFunction<Env> = async () => noStore(handleOptions())

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const authed = await requireAuthedMember(context.request, context.env)
  if (isResponse(authed)) return noStore(authed)

  const answer: MediaManagerResponse = {
    mediaManager: MAIL_LISTS_ON ? await sendsAsMediaManager(context.env.DB, authed.member) : false,
    secondFactor: hasSecondFactor(context.request),
  }
  return jsonResponse(answer, 200, { 'Cache-Control': 'no-store' })
}
