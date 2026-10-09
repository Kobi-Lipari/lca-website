// functions/api/admin/tournaments/[id]/waitlist.ts
//
// The director offers a waitlisted player a spot. The entry leaves the
// waitlist; a free entry is confirmed on the spot, a paid one gets a
// pending payment the player completes from the tournament page. The
// player (or their parent) is emailed either way.
//
// The price is worked out now, the way an online entry would be: the
// entry's section row (tournament_sections, found by the entry's
// section_id, else by its name) and the tournament's live pricing columns,
// through priceEntry. A section with no row is priced at the event fee, as
// the old reader of the sections JSON did.
import type { Env } from '../../../../types'
import { isResponse, requireTournamentManager } from '../../../../utils/auth'
import { recordAdminAction } from '../../../../utils/audit'
import { priceEntry } from '../../../../utils/pricing'
import { getDb } from '../../../../db/client'
import { loadSections } from '../../../../utils/events/sectionsRepo'
import { waitlistOfferRequestSchema } from '../../../../../domain/contracts/registration'
import { sendRegistrationConfirmations } from '../../../../utils/registrationEmails'
import { resolveSiteUrl } from '../../../../utils/site'
import { escapeHtml, trySendEmail } from '../../../../utils/email'
import { renderEmail, p } from '../../../../utils/emailLayout'
import { errorResponse, handleOptions, jsonResponse, parseBody } from '../../../../utils/response'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const tournamentId = context.params.id as string
  const authResult = await requireTournamentManager(context.request, context.env, tournamentId)
  if (isResponse(authResult)) return authResult

  const body = await parseBody(context.request, waitlistOfferRequestSchema)
  if (isResponse(body)) return body
  const db = context.env.DB

  const reg = await db.prepare(
    `SELECT r.id, r.member_id, r.section, r.section_id, r.waitlisted_at, r.withdrawn_at,
            m.full_name, m.email, m.membership_status, g.email AS guardian_email
       FROM registrations r
       JOIN members m ON m.id = r.member_id
       LEFT JOIN members g ON g.id = m.guardian_id
      WHERE r.id = ? AND r.tournament_id = ?`,
  ).bind(body.registrationId, tournamentId).first<{
    id: string; member_id: string; section: string; section_id: string | null
    waitlisted_at: string | null; withdrawn_at: string | null
    full_name: string; email: string; membership_status: string; guardian_email: string | null
  }>()
  if (!reg || !reg.waitlisted_at || reg.withdrawn_at) return errorResponse('That player is not on the waitlist', 404)

  const t = await db.prepare('SELECT * FROM tournaments WHERE id = ?').bind(tournamentId).first<{
    id: string; name: string; entry_fee: number
    early_deadline: string | null; early_discount: number | null; late_after: string | null
    late_fee: number | null; member_discount: number | null
  }>()
  if (!t) return errorResponse('Tournament not found', 404)

  // Archived rows too: the entry keeps its place in a section even if the
  // section has been archived since. A live row wins over an archived one of
  // the same name (loadSections lists the live rows first).
  const rows = await loadSections(getDb(db), t.id, { includeArchived: true })
  const section = rows.find((s) => reg.section_id != null && s.id === reg.section_id)
    ?? rows.find((s) => s.name === reg.section)
    ?? { feeRegular: null }
  const amount = priceEntry(section, t, Date.now(), { isLcaMember: reg.membership_status === 'active' }).amount
  const paymentId = `pay-${reg.id}`
  const free = amount <= 0
  await db.batch([
    db.prepare(`UPDATE registrations SET waitlisted_at = NULL, payment_status = ? WHERE id = ?`).bind(free ? 'paid' : 'pending', reg.id),
    db.prepare(
      `INSERT OR IGNORE INTO payments (id, member_id, amount, type, reference_id, status)
       VALUES (?, ?, ?, 'tournament', ?, ?)`,
    ).bind(paymentId, reg.member_id, amount, reg.id, free ? 'completed' : 'pending'),
  ])

  const siteUrl = resolveSiteUrl(context.env, context.request)
  if (free) {
    await sendRegistrationConfirmations(context.env, siteUrl, [reg.id])
  } else {
    const url = `${siteUrl}/tournaments/${tournamentId}`
    await trySendEmail(context.env, {
      to: reg.guardian_email ?? reg.email,
      subject: `A spot opened: ${t.name}`,
      html: renderEmail({
        siteUrl,
        heading: 'A spot opened up',
        body: p(`Good news: there's now room for <strong>${escapeHtml(reg.full_name)}</strong> in <strong>${escapeHtml(t.name)}</strong> (${escapeHtml(reg.section)}).`) +
          p(`Complete the $${amount.toFixed(2)} entry fee on the tournament page to hold the spot.`),
        cta: { label: 'Complete entry', url },
      }),
      text: `A spot opened for ${reg.full_name} in ${t.name} (${reg.section}). Complete the $${amount.toFixed(2)} entry fee to hold it: ${url}`,
    })
  }

  await recordAdminAction(db, authResult.member, {
    action: 'waitlist_offer',
    targetMemberId: reg.member_id,
    targetLabel: `${reg.full_name} (${t.name})`,
    detail: { tournament_id: tournamentId, registration_id: reg.id, amount },
  })

  return jsonResponse({ success: true, amount })
}
