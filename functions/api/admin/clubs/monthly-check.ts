// functions/api/admin/clubs/monthly-check.ts
//
// POST /api/admin/clubs/monthly-check: the LCA admin's button in My region,
// "Send this month's check now". With `send` false it answers how many
// people the check goes to, for the button's one question, and sends
// nothing; with `send` true it sends the monthly check
// (functions/utils/clubs/monthlyCheck.ts) to every holder of an active
// regional seat whose seats keep a club, as a forced call: the due rule and
// the monthly marks are not read and no mark is written, so every press
// sends to everyone and a press never stands in for the first Monday's
// timed send. The run is recorded as club_monthly_check, marked manual, and
// a press that sent (send true and the check ran) writes one row to the
// activity log, club_monthly_check_sent, naming the LCA admin who pressed
// it, with the month in words and the counts; asking how many, a press that
// found nobody left to send to, and a refusal, write none.
//
// Who may: an LCA admin with a second factor (requireAdmin). Anyone else
// gets 403; an LCA admin without the second factor gets requireAdmin's
// words, which say what is needed.
//
// The answer is in numbers only: the month in words, how many people the
// check goes to, how many emails went, how many did not and how many people
// one press could not reach (PRESS_SENDS). While CLUB_KEEPERS_ON is unset
// everyone gets 403 in words before anything is read: no sign in is checked
// and no query is made. With no signing secret the admin is told why and
// nothing is sent or written.
//
// This static file sits beside functions/api/admin/clubs/[id].ts. Pages
// routes the more specific address first, a static segment before a
// dynamic one, so /api/admin/clubs/monthly-check reaches this file and not
// the club handler with the id "monthly-check".
import type { Env } from '../../../types'
import { isResponse, requireAdmin } from '../../../utils/auth'
import { errorResponse, handleOptions, jsonResponse, parseBody } from '../../../utils/response'
import { CLUB_KEEPERS_ON } from '../../../utils/clubs/pages'
import { monthlyCheckPeople, runMonthlyCheck, signingKeyReady } from '../../../utils/clubs/monthlyCheck'
import { recordAdminAction } from '../../../utils/admin/audit'
import { monthInWords } from '../../../../domain/clubs/monthlyCheck'
import { monthlyCheckRequestSchema, type MonthlyCheckResponse } from '../../../../domain/contracts/clubs'

/** The 403 everyone gets while CLUB_KEEPERS_ON is unset. */
export const CHECK_CLOSED = 'The monthly check cannot be sent yet.'

/** The 503 an LCA admin gets while this deployment has no signing secret: nothing is sent. */
export const CHECK_NO_KEY = 'The monthly check can\'t be sent: the site\'s signing key is not set yet. Once it is set in the site\'s settings on Cloudflare, the check can go.'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  if (!CLUB_KEEPERS_ON) return errorResponse(CHECK_CLOSED, 403)

  const authResult = await requireAdmin(context.request, context.env)
  if (isResponse(authResult)) return authResult

  const body = await parseBody(context.request, monthlyCheckRequestSchema)
  if (isResponse(body)) return body

  if (!signingKeyReady(context.env)) return errorResponse(CHECK_NO_KEY, 503)

  const now = new Date()
  if (!body.send) {
    const asked: MonthlyCheckResponse = { month: monthInWords(now), people: await monthlyCheckPeople(context.env.DB), sent: 0, notSent: 0, notReached: 0 }
    return jsonResponse(asked)
  }

  const done = await runMonthlyCheck(context.env, now, true, { request: context.request })
  // Who pressed it, in the activity log, as announce.ts logs an email to entrants: the month
  // in words and the counts alone. Only a press where the check ran writes the row: when
  // nobody was left to send to (stopped 'nobody'), nothing was tried and no run was recorded,
  // so there is nothing to log. recordAdminAction never throws, so a failed write never fails
  // the answer of a press that has already sent.
  if (done.stopped === null) {
    await recordAdminAction(context.env.DB, authResult.member, {
      action: 'club_monthly_check_sent',
      targetLabel: done.month,
      detail: { sent: done.sent, notSent: done.notSent, notReached: done.notReached },
    })
  }
  const sent: MonthlyCheckResponse = { month: done.month, people: done.people, sent: done.sent, notSent: done.notSent, notReached: done.notReached }
  return jsonResponse(sent)
}
