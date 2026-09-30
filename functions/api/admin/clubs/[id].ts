// functions/api/admin/clubs/[id].ts
// The single write path for club edits — this is what the admin UI calls.
// Merged from the two previous copies: full field set (color, imageUrl,
// region) from one, hex-color validation from the other.
import type { Env } from '../../../types'
import { isResponse, requireClubRep, requireAdmin, requireClubView } from '../../../utils/auth'
import {
  errorResponse,
  handleOptions,
  jsonResponse,
  parseJsonBody,
} from '../../../utils/response'
import { recordAdminAction } from '../../../utils/audit'

interface UpdateClubBody {
  name?: string
  city?: string
  location?: string | null
  description?: string | null
  meetingSchedule?: string | null
  contactEmail?: string | null
  color?: string | null
  imageUrl?: string | null
  region?: string | null
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const clubId = context.params.id as string
  const authResult = await requireClubView(context.request, context.env, clubId)
  if (isResponse(authResult)) return authResult

  const club = await context.env.DB.prepare('SELECT * FROM clubs WHERE id = ?')
    .bind(clubId)
    .first()

  if (!club) return errorResponse('Club not found', 404)

  const officers = await context.env.DB.prepare(
    `SELECT co.id, co.member_id, co.role, m.full_name, m.email
     FROM club_officers co
     JOIN members m ON co.member_id = m.id
     WHERE co.club_id = ? ORDER BY co.created_at`,
  ).bind(clubId).all()

  const roster = await context.env.DB.prepare(
    `SELECT m.id, m.full_name, m.email, m.uscf_id, m.uscf_rating, m.membership_status
     FROM members m WHERE m.club_id = ? AND m.role != 'guest' ORDER BY m.full_name`,
  ).bind(clubId).all()

  // Unlike the public club endpoint, this includes hidden drafts: the people
  // allowed here are exactly the people who manage those drafts.
  const tournaments = await context.env.DB.prepare(
    `SELECT id, name, date, end_date, status, is_visible, registration_status
     FROM tournaments WHERE club_id = ? ORDER BY date DESC`,
  ).bind(clubId).all()

  return jsonResponse({
    club,
    officers: officers.results,
    roster: roster.results,
    tournaments: tournaments.results,
  })
}

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const clubId = context.params.id as string
  const authResult = await requireClubRep(context.request, context.env, clubId)
  if (isResponse(authResult)) return authResult

  const existing = await context.env.DB.prepare('SELECT * FROM clubs WHERE id = ?')
    .bind(clubId)
    .first<Record<string, unknown>>()

  if (!existing) return errorResponse('Club not found', 404)

  const body = await parseJsonBody<UpdateClubBody>(context.request)
  if (!body) return errorResponse('Invalid JSON body', 400)

  // A club's name and region decide how it is listed and filtered site-wide,
  // so those stay with LCA admins. Sending the unchanged value is fine — the
  // edit form always sends the whole record.
  const isAdmin = authResult.member.role === 'lca_admin'
  if (!isAdmin) {
    if (body.name !== undefined && body.name !== existing.name) {
      return errorResponse('Only LCA admins can rename a club', 403)
    }
    if (body.region !== undefined && (body.region || null) !== (existing.region || null)) {
      return errorResponse('Only LCA admins can change a club\'s region', 403)
    }
    // Logos go through the upload endpoint, which stores them on our own
    // storage; a rep pointing image_url at an arbitrary site is not needed.
    if (body.imageUrl !== undefined && body.imageUrl !== existing.image_url) {
      return errorResponse('Upload a new image instead of setting its URL', 403)
    }
  }

  if (body.name !== undefined && !body.name.trim()) {
    return errorResponse('Club name cannot be empty', 400)
  }
  if (body.city !== undefined && !body.city.trim()) {
    return errorResponse('City cannot be empty', 400)
  }
  if (body.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.contactEmail)) {
    return errorResponse('Contact email is not a valid address', 400)
  }

  // Hex-validate color when provided; explicit null clears it, an invalid
  // string is ignored in favor of the existing value.
  const color = body.color !== undefined
    ? (body.color === null
        ? null
        : /^#[0-9A-Fa-f]{6}$/.test(body.color) ? body.color : existing.color)
    : existing.color

  await context.env.DB.prepare(
    `UPDATE clubs SET
      name = ?, city = ?, location = ?, description = ?,
      meeting_schedule = ?, contact_email = ?,
      color = ?, image_url = ?, region = ?
     WHERE id = ?`,
  ).bind(
    body.name?.trim() ?? existing.name,
    body.city?.trim() ?? existing.city,
    body.location !== undefined ? body.location : existing.location,
    body.description !== undefined ? body.description : existing.description,
    body.meetingSchedule !== undefined ? body.meetingSchedule : existing.meeting_schedule,
    body.contactEmail !== undefined ? body.contactEmail : existing.contact_email,
    color,
    body.imageUrl !== undefined ? body.imageUrl : existing.image_url,
    body.region !== undefined ? (body.region || null) : existing.region,
    clubId,
  ).run()

  const club = await context.env.DB.prepare('SELECT * FROM clubs WHERE id = ?')
    .bind(clubId).first<Record<string, unknown>>()

  // Which fields actually changed, for the activity log.
  const COLUMNS = ['name', 'city', 'location', 'description', 'meeting_schedule',
    'contact_email', 'color', 'image_url', 'region']
  const changed = club
    ? COLUMNS.filter((c) => (club[c] ?? null) !== ((existing as Record<string, unknown>)[c] ?? null))
    : []
  if (changed.length) {
    await recordAdminAction(context.env.DB, authResult.member, {
      action: 'club_edit',
      targetLabel: String(club?.name ?? existing.name),
      detail: { club_id: clubId, fields: changed },
    })
  }

  return jsonResponse({ club })
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const clubId = context.params.id as string
  const authResult = await requireAdmin(context.request, context.env)
  if (isResponse(authResult)) return authResult

  const existing = await context.env.DB.prepare('SELECT * FROM clubs WHERE id = ?')
    .bind(clubId).first()

  if (!existing) return errorResponse('Club not found', 404)

  await context.env.DB.prepare('UPDATE members SET club_id = NULL WHERE club_id = ?').bind(clubId).run()
  // Tournaments keep their history but stop pointing at a deleted club
  await context.env.DB.prepare('UPDATE tournaments SET club_id = NULL WHERE club_id = ?').bind(clubId).run()
  await context.env.DB.prepare('DELETE FROM club_officers WHERE club_id = ?').bind(clubId).run()
  await context.env.DB.prepare('DELETE FROM club_news WHERE club_id = ?').bind(clubId).run()
  await context.env.DB.prepare('DELETE FROM clubs WHERE id = ?').bind(clubId).run()

  return jsonResponse({ success: true })
}
