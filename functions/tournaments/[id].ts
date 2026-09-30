// functions/tournaments/[id].ts
//
// Serves the normal app shell for /tournaments/:id, with the tournament's
// own link preview written into the <head> so a shared link shows the event
// name, date, place and spots left. Hidden drafts keep the generic preview.
// Nested paths (/tournaments/:id/pairings) are not matched by this file.
import type { Env } from '../types'
import { formatPreviewDate, withLinkPreview } from '../utils/linkPreview'

interface TournamentPreviewRow {
  name: string
  date: string
  end_date: string | null
  location: string | null
  venue: string | null
  rounds: number | null
  time_control: string | null
  max_players: number | null
  registration_status: string | null
  status: string | null
  club_name: string | null
  registered: number
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const shell = await context.next()
  try {
    const id = context.params.id as string
    const t = await context.env.DB.prepare(
      `SELECT t.name, t.date, t.end_date, t.location, t.venue, t.rounds, t.time_control,
              t.max_players, t.registration_status, t.status, c.name AS club_name,
              (SELECT COUNT(*) FROM registrations r
                WHERE r.tournament_id = t.id AND r.withdrawn_at IS NULL AND r.waitlisted_at IS NULL) AS registered
         FROM tournaments t
         LEFT JOIN clubs c ON c.id = t.club_id
        WHERE t.id = ? AND t.is_visible = 1`,
    ).bind(id).first<TournamentPreviewRow>()
    if (!t) return shell

    const when = t.end_date && t.end_date !== t.date
      ? `${formatPreviewDate(t.date)} – ${formatPreviewDate(t.end_date)}`
      : formatPreviewDate(t.date)
    const where = [t.venue, t.location].filter(Boolean).join(', ')
    const format = [t.rounds ? `${t.rounds} rounds` : null, t.time_control].filter(Boolean).join(', ')

    let status: string | null = null
    if (t.status === 'completed') status = 'Results posted'
    else if (t.registration_status === 'open') {
      status = t.max_players
        ? `Registration open · ${Math.max(t.max_players - t.registered, 0)} of ${t.max_players} spots left`
        : 'Registration open'
    }

    const description = [when, where, format, status, t.club_name ? `Hosted by ${t.club_name}` : null]
      .filter(Boolean)
      .join(' · ')

    return withLinkPreview(shell, { title: t.name, description, type: 'article' }, context.env, context.request)
  } catch (err) {
    console.error('tournament link preview failed', err)
    return shell
  }
}
