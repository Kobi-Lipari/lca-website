// functions/utils/registrationOpenNotify.ts
//
// Call from functions/api/admin/tournaments/[id]/registration.ts, only on
// the transition into registration_status = 'open'. Reuses the EXISTING
// tournament_reminders table/subscriber list (populated by the Bell/BellOff
// toggle already on TournamentDetailPage) rather than a separate table —
// this is the one piece that was actually missing.
//
// ASSUMPTION — still don't have functions/utils/email.ts, so this sends via
// Resend directly. Paste that file over and I'll swap the fetch() below for
// your real shared transport instead of running a second ad-hoc client.

import { resolveSiteUrl, type SiteEnv } from './site'

interface NotifyEnv extends SiteEnv {
  DB: D1Database
  RESEND_API_KEY: string
  FROM_EMAIL: string
}

interface ReminderRow {
  id: string
  email: string
  full_name: string | null
}

export async function notifyRegistrationOpen(
  env: NotifyEnv,
  tournamentId: string,
  tournamentName: string,
): Promise<void> {
  const { results } = await env.DB.prepare(
    `SELECT r.id as id, r.email as email, m.full_name as full_name
     FROM tournament_reminders r
     LEFT JOIN members m ON m.id = r.member_id
     WHERE r.tournament_id = ? AND r.registration_opened_notified_at IS NULL`
  ).bind(tournamentId).all<ReminderRow>()

  if (!results || results.length === 0) return

  for (const sub of results) {
    try {
      await sendNotifyEmail(env, sub.email, sub.full_name, tournamentName, tournamentId)
      // Mark-only-on-success, same pattern as the daily-emails worker — a
      // failed send just gets retried the next time this runs (e.g. an
      // admin re-saves the tournament) instead of silently dropping it.
      // We do NOT delete the tournament_reminders row itself, in case it's
      // also relied on by the separate pre-event day-based reminders.
      await env.DB.prepare(
        `UPDATE tournament_reminders SET registration_opened_notified_at = datetime('now') WHERE id = ?`
      ).bind(sub.id).run()
    } catch (err) {
      console.error(`registrationOpenNotify: failed to email subscriber ${sub.id}`, err)
    }
  }
}

async function sendNotifyEmail(
  env: NotifyEnv,
  to: string,
  name: string | null,
  tournamentName: string,
  tournamentId: string,
): Promise<void> {
  const greeting = name ? `Hi ${name},` : 'Hi,'
  const siteUrl = resolveSiteUrl(env)
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
      <div style="background:#1a2744;padding:24px;text-align:center">
        <h1 style="font-family: Georgia, serif; color:#ffffff; font-size:20px; margin:0">Registration is open</h1>
      </div>
      <div style="border-top:4px solid #c8a94a"></div>
      <div style="padding:24px">
        <p>${greeting}</p>
        <p>Registration just opened for <strong>${tournamentName}</strong> — you asked to be notified when it did.</p>
        <p><a href="${siteUrl}/tournaments/${tournamentId}" style="color:#1a2744;font-weight:bold">Register now &rarr;</a></p>
      </div>
      <div style="padding:16px 24px;color:#888888;font-size:12px">
        ${siteUrl.replace(/^https?:\/\//, '')} &middot; support@louisianachess.org
      </div>
    </div>
  `

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.FROM_EMAIL,
      to,
      subject: `Registration is open: ${tournamentName}`,
      html,
    }),
  })

  if (!res.ok) {
    throw new Error(`Resend returned ${res.status}`)
  }
}