// functions/api/admin/clubs.ts
// Creating a club is an LCA decision, so it is admin-only. Editing an
// existing club (including by its own rep) lives at ./clubs/[id].ts.
import type { Env } from '../../types'
import { isResponse, requireAdmin } from '../../utils/auth'
import {
  errorResponse,
  handleOptions,
  jsonResponse,
  parseJsonBody,
} from '../../utils/response'
import { slugFor, uniqueSlug } from '../../../domain/clubs/slug'
import { ADMIN_CLUB_COLUMNS } from '../../utils/clubs/adminAnswer'
import { isMissingTableOrColumn } from '../../utils/clubs/migrationLag'

/** The one log line for slugs the create could not read; it names no club. */
export const CLUB_SLUGS_UNREAD_LOG = 'club create: the slugs of migration 0066 could not be read; the club is made against the ids alone, with no slug'

interface CreateClubBody {
  name?: string
  city?: string
  region?: string | null
  contactEmail?: string | null
}

/**
 * Every address a club holds: its id, its slug and its old slugs. Before
 * migration 0066 has run there is no slug and no old slug, so the ids alone
 * are read, with one log line, and `slugs` is false.
 */
async function takenAddresses(db: D1Database): Promise<{ taken: string[]; slugs: boolean }> {
  try {
    const { results } = await db.prepare(
      `SELECT id AS taken FROM clubs
       UNION SELECT slug FROM clubs WHERE slug IS NOT NULL
       UNION SELECT old_slug FROM club_slug_history`,
    ).all<{ taken: string }>()
    return { taken: results.map((r) => r.taken), slugs: true }
  } catch (err) {
    if (!isMissingTableOrColumn(err)) throw err
    console.warn(CLUB_SLUGS_UNREAD_LOG)
    const { results } = await db.prepare('SELECT id AS taken FROM clubs').all<{ taken: string }>()
    return { taken: results.map((r) => r.taken), slugs: false }
  }
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const authResult = await requireAdmin(context.request, context.env)
  if (isResponse(authResult)) return authResult

  const body = await parseJsonBody<CreateClubBody>(context.request)
  const name = body?.name?.trim()
  const city = body?.city?.trim()
  if (!name || !city) {
    return errorResponse('name and city are required', 400)
  }
  if (body?.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.contactEmail)) {
    return errorResponse('Contact email is not a valid address', 400)
  }

  // A new club's id is the slug of its name, and its slug is the same value,
  // made free of every club's id, slug and old slug and of the words the club
  // pages keep for their own addresses (domain/clubs/slug.ts), so a name
  // like another club's gets a short suffix on both and never fails on the
  // unique slug index.
  const { taken, slugs } = await takenAddresses(context.env.DB)
  const id = uniqueSlug(slugFor(name), taken)

  if (slugs) {
    await context.env.DB.prepare(
      `INSERT INTO clubs (id, name, city, region, contact_email, slug) VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(id, name, city, body?.region || null, body?.contactEmail || null, id)
      .run()
  } else {
    await context.env.DB.prepare(
      `INSERT INTO clubs (id, name, city, region, contact_email) VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(id, name, city, body?.region || null, body?.contactEmail || null)
      .run()
  }

  // Today's 13 columns by name, so the answer is what it was before 0066.
  const club = await context.env.DB.prepare(`SELECT ${ADMIN_CLUB_COLUMNS} FROM clubs WHERE id = ?`)
    .bind(id)
    .first()

  return jsonResponse({ club }, 201)
}
