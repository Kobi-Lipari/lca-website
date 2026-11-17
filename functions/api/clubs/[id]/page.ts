// functions/api/clubs/[id]/page.ts
//
// GET /api/clubs/:id/page: the read behind the new club page (WS09 step 20).
// Today's club page keeps its own answer, GET /api/clubs/[id], which this
// file does not touch.
//
// Who may read, by the two constants of functions/utils/clubs/pages.ts, each
// read here at every call:
//   - both unset:              404 to everyone, before the sign-in is checked
//                              or anything is read: not one query is made
//   - CLUB_KEEPERS_ON alone:   the page to the people requireClubRep admits
//                              for the club (an LCA admin, the club's rep and
//                              the representative whose seat covers its
//                              region), and to everyone else the same 404 as
//                              for a club that does not exist: requireClubRep's
//                              401 and 403 are never passed on, so nothing
//                              tells a stranger that an unreleased page exists
//   - CLUB_PAGES_ON:           the page to everyone, signed in or not
// Every 404 is the one body, {"error":"Club not found"}, the words today's
// club answer gives for a club that does not exist.
//
// How the club is found and what the answer carries are written once, in
// functions/utils/clubs/pageAnswer.ts (clubNamedBy and clubPageAnswer), which
// the page the server writes before any script, functions/clubs/[id].ts,
// reads too (WS09 step 23): a current slug, then an old slug, then a club's
// id, and an answer of named columns with no email address, officer or
// roster, its events the club's listed events through listedWhere.
//
// Headers: while the page is not public (both constants unset, or
// CLUB_KEEPERS_ON alone) every answer, the 404s included, carries
// Cache-Control: no-store, so no cache keeps a keeper's page or a 404 for
// another viewer. With CLUB_PAGES_ON set the answer is the same for every
// reader and carries the headers today's public club answer carries, with
// no instruction to a cache.
import type { Env } from '../../../types'
import { handleOptions, jsonResponse } from '../../../utils/response'
import { isResponse, requireClubRep } from '../../../utils/auth'
import { CLUB_KEEPERS_ON, CLUB_PAGES_ON } from '../../../utils/clubs/pages'
import { clubNamedBy, clubPageAnswer } from '../../../utils/clubs/pageAnswer'

export { PAGE_NAVY, asSlug } from '../../../utils/clubs/pageAnswer'

/** The words of every 404: the same as today's club answer gives for a club that does not exist. */
export const CLUB_PAGE_NOT_FOUND = 'Club not found'

/** What every answer carries while the page is not public. */
const NOT_PUBLIC_HEADERS = { 'Cache-Control': 'no-store' } as const

function notFound(headers: Record<string, string>): Response {
  return jsonResponse({ error: CLUB_PAGE_NOT_FOUND }, 404, headers)
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const pagesOn = CLUB_PAGES_ON
  const keepersOn = CLUB_KEEPERS_ON
  const headers: Record<string, string> = pagesOn ? {} : { ...NOT_PUBLIC_HEADERS }
  // Both unset: nothing is read, not even the sign-in.
  if (!pagesOn && !keepersOn) return notFound(headers)

  const raw = typeof context.params.id === 'string' ? context.params.id : ''
  const db = context.env.DB
  const club = await clubNamedBy(db, raw)
  if (!club) return notFound(headers)

  if (!pagesOn) {
    // The keepers' preview: requireClubRep's own rule, its refusals all answered as the one 404.
    const authed = await requireClubRep(context.request, context.env, club.id)
    if (isResponse(authed)) return notFound(headers)
  }

  return jsonResponse(await clubPageAnswer(db, club), 200, headers)
}
