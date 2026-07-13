// functions/api/admin/tournaments/[id]/announce.ts
//
// ⚠️ ADAPT BEFORE DEPLOY: this file assumes utils/email.ts exports
//   sendEmail(env, { to, subject, text })
// I have not seen utils/email.ts — match the import and the call below
// to its actual signature. Everything else in this file is final.

import type { Env } from '../../../../types'
import { isResponse, requireTournamentManager } from '../../../../utils/auth'
import {
  errorResponse,
  handleOptions,
  jsonResponse,
  parseJsonBody,
} from '../../../../utils/response'
// ADAPT: import the real send helper from utils/email
import { sendEmail } from '../../../../utils/email'

interface AnnounceBody {
  subject?: string
  body?: string
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const tournamentId = context.params.id as string
  const authResult = await requireTournamentManager(context.request, context.env, tournamentId)
  if (isResponse(authResult)) return authResult

  const body = await parseJsonBody<AnnounceBody>(context.request)
  const subject = body?.subject?.trim()
  const message = body?.body?.trim()
  if (!subject || !message) return errorResponse('subject and body are required', 400)
  if (subject.length > 200 || message.length > 10000) {
    return errorResponse('subject or body is too long', 400)
  }

  const tournament = await context.env.DB.prepare(
    'SELECT name FROM tournaments WHERE id = ?',
  ).bind(tournamentId).first<{ name: string }>()
  if (!tournament) return errorResponse('Tournament not found', 404)

  // Active entrants with real addresses: not withdrawn, not walk-in guests.
  // Both guest filters are belt-and-suspenders.
  const recipients = await context.env.DB.prepare(
    `SELECT DISTINCT m.email, m.full_name
     FROM registrations r
     JOIN members m ON m.id = r.member_id
     WHERE r.tournament_id = ?
       AND r.withdrawn_at IS NULL
       AND m.role != 'guest'
       AND m.email NOT LIKE '%@walkin.lca.invalid'`,
  ).bind(tournamentId).all<{ email: string; full_name: string }>()

  const list = recipients.results ?? []
  if (list.length === 0) {
    return errorResponse('No entrants with email addresses to notify', 400)
  }

  // Individual sends, not one BCC blast: per-recipient failure isolation,
  // no address leakage. At LCA field sizes the loop cost is nothing.
  let sent = 0
  const failures: string[] = []
  for (const r of list) {
    try {
      // ADAPT: match utils/email.ts's actual signature
      await sendEmail(context.env, {
        to: r.email,
        subject: `[${tournament.name}] ${subject}`,
        text: `${message}\n\n—\nSent by the tournament director via the Louisiana Chess Association website.`,
      })
      sent++
    } catch {
      failures.push(r.email)
    }
  }

  return jsonResponse({ sent, failed: failures.length, total: list.length })
}
