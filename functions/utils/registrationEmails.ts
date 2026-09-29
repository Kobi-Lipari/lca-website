// functions/utils/registrationEmails.ts
//
// "You're registered" emails. Sent once an entry is actually confirmed:
// straight away for free sections, and from the Stripe webhook for paid ones
// (never at checkout start, when the player may still walk away).
//
// Entries are grouped by the address they go to. A child's email is their
// parent's, so a parent who enters three children (and maybe themselves)
// gets one email listing everyone, not four.

import { registrationConfirmationEmail, trySendEmail, type ConfirmedEntry, type EmailEnv } from './email'

interface EntryRow {
  id: string
  tournament_id: string
  section: string
  bye_rounds: string | null
  player_name: string
  player_email: string
  guardian_name: string | null
  guardian_email: string | null
  amount: number | null
  t_name: string
  t_date: string
  t_end_date: string | null
  t_location: string | null
  t_venue: string | null
}

function parseByes(raw: string | null): number[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v.filter((n): n is number => typeof n === 'number') : []
  } catch {
    return []
  }
}

/**
 * Best-effort: a mail failure never fails the registration or the webhook.
 * Returns how many emails went out, for tests and logging.
 */
export async function sendRegistrationConfirmations(
  env: EmailEnv & { DB: D1Database },
  siteUrl: string,
  registrationIds: string[],
): Promise<number> {
  if (registrationIds.length === 0) return 0
  const placeholders = registrationIds.map(() => '?').join(', ')
  const { results } = await env.DB.prepare(
    `SELECT r.id, r.tournament_id, r.section, r.bye_rounds,
            m.full_name AS player_name, m.email AS player_email,
            g.full_name AS guardian_name, g.email AS guardian_email,
            (SELECT p.amount FROM payments p
              WHERE p.reference_id = r.id AND p.type = 'tournament'
              ORDER BY p.created_at DESC LIMIT 1) AS amount,
            t.name AS t_name, t.date AS t_date, t.end_date AS t_end_date,
            t.location AS t_location, t.venue AS t_venue
       FROM registrations r
       JOIN members m ON m.id = r.member_id
       JOIN tournaments t ON t.id = r.tournament_id
       LEFT JOIN members g ON g.id = m.guardian_id
      WHERE r.id IN (${placeholders})
        AND r.withdrawn_at IS NULL
      ORDER BY m.guardian_id IS NOT NULL, m.full_name`,
  ).bind(...registrationIds).all<EntryRow>()

  // key: tournament + recipient address
  const groups = new Map<string, { to: string; name: string; rows: EntryRow[] }>()
  for (const row of results ?? []) {
    const to = (row.guardian_email ?? row.player_email ?? '').trim()
    if (!to || to.endsWith('.invalid')) continue
    const key = `${row.tournament_id}|${to.toLowerCase()}`
    const group = groups.get(key) ?? { to, name: row.guardian_name ?? row.player_name, rows: [] as EntryRow[] }
    group.rows.push(row)
    groups.set(key, group)
  }

  let sent = 0
  for (const { to, name, rows } of groups.values()) {
    const t = rows[0]
    const entries: ConfirmedEntry[] = rows.map((r) => ({
      playerName: r.player_name,
      section: r.section,
      byeRounds: parseByes(r.bye_rounds),
      amount: r.amount ?? 0,
    }))
    const ok = await trySendEmail(env, {
      ...registrationConfirmationEmail({
        siteUrl,
        recipientName: name,
        tournament: {
          name: t.t_name,
          date: t.t_date,
          endDate: t.t_end_date,
          location: t.t_location,
          venue: t.t_venue,
          url: `${siteUrl}/tournaments/${t.tournament_id}`,
        },
        entries,
      }),
      to,
    })
    if (ok) sent++
  }
  return sent
}
