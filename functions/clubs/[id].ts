// functions/clubs/[id].ts
//
// Serves the normal app shell for /clubs/:id with the club's own link
// preview: name, city and meeting time, and its logo when one is uploaded.
import type { Env } from '../types'
import { withLinkPreview } from '../utils/linkPreview'

interface ClubPreviewRow {
  name: string
  city: string | null
  meeting_schedule: string | null
  location: string | null
  description: string | null
  image_url: string | null
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const shell = await context.next()
  try {
    const id = context.params.id as string
    const club = await context.env.DB.prepare(
      `SELECT name, city, meeting_schedule, location, description, image_url FROM clubs WHERE id = ?`,
    ).bind(id).first<ClubPreviewRow>()
    if (!club) return shell

    const meets = [club.meeting_schedule, club.location].filter(Boolean).join(' at ')
    const description = [
      club.city ? `Chess club in ${club.city}, Louisiana` : 'Chess club in Louisiana',
      meets ? `Meets ${meets}` : null,
      club.description,
    ].filter(Boolean).join(' · ')

    return withLinkPreview(
      shell,
      {
        title: club.name,
        description,
        // Only logos uploaded through the site (served from our own
        // storage) — never an arbitrary external URL.
        image: club.image_url?.startsWith('/api/clubs/') ? club.image_url : null,
        imageIsSquare: true,
      },
      context.env,
      context.request,
    )
  } catch (err) {
    console.error('club link preview failed', err)
    return shell
  }
}
