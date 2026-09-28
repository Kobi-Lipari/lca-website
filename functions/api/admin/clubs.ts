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

interface CreateClubBody {
  name?: string
  city?: string
  region?: string | null
  contactEmail?: string | null
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
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

  let id = slugify(name) || 'club'
  const taken = await context.env.DB.prepare('SELECT 1 FROM clubs WHERE id = ?')
    .bind(id)
    .first()
  if (taken) id = `${id}-${Date.now().toString(36)}`

  await context.env.DB.prepare(
    `INSERT INTO clubs (id, name, city, region, contact_email) VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(id, name, city, body?.region || null, body?.contactEmail || null)
    .run()

  const club = await context.env.DB.prepare('SELECT * FROM clubs WHERE id = ?')
    .bind(id)
    .first()

  return jsonResponse({ club }, 201)
}
