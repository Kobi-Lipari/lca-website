// functions/utils/registrationOpenNotify.ts
//
// Called from functions/api/admin/tournaments/[id]/registration.ts, only on
// the transition into registration_status = 'open'. Emails everyone who
// tapped the bell on the tournament page (tournament_reminders).
//
// The daily cron Worker also sends a "registration is open" email off the
// same table. Both flags are set here, so a subscriber told right away isn't
// told again the next morning.

import { registrationOpenReminderEmail, sendEmail, type EmailEnv } from './email'
import { resolveSiteUrl, type SiteEnv } from './site'

interface NotifyEnv extends SiteEnv, EmailEnv {
  DB: D1Database
}

interface ReminderRow {
  id: string
  email: string
  full_name: string | null
}

interface TournamentRow {
  name: string
  date: string
  end_date: string | null
  location: string | null
  venue: string | null
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
     WHERE r.tournament_id = ?
       AND r.registration_opened_notified_at IS NULL
       AND r.sent_registration_open = 0`
  ).bind(tournamentId).all<ReminderRow>()

  if (!results || results.length === 0) return

  const t = await env.DB.prepare(
    'SELECT name, date, end_date, location, venue FROM tournaments WHERE id = ?',
  ).bind(tournamentId).first<TournamentRow>()
  const siteUrl = resolveSiteUrl(env)

  for (const sub of results) {
    try {
      await sendEmail(env, {
        ...registrationOpenReminderEmail({
          siteUrl,
          memberName: sub.full_name,
          tournament: {
            name: t?.name ?? tournamentName,
            date: t?.date ?? '',
            endDate: t?.end_date,
            location: t?.location,
            venue: t?.venue,
            url: `${siteUrl}/tournaments/${tournamentId}`,
          },
        }),
        to: sub.email,
      })
      // Mark only on success: a failed send is retried by the morning cron.
      // The row itself stays, since the pre-event reminders also use it.
      await env.DB.prepare(
        `UPDATE tournament_reminders
            SET registration_opened_notified_at = datetime('now'), sent_registration_open = 1
          WHERE id = ?`
      ).bind(sub.id).run()
    } catch (err) {
      console.error(`registrationOpenNotify: failed to email subscriber ${sub.id}`, err)
    }
  }
}
