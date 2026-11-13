// functions/api/admin/clubs/[id].ts
// The single write path for club edits: this is what the admin UI calls.
// Merged from the two previous copies: full field set (color, imageUrl,
// region) from one, hex-color validation from the other.
//
// With CLUB_KEEPERS_ON set (functions/utils/clubs/pages.ts) the GET also
// answers the listing's fifteen new columns and its places, and the PATCH
// takes the new fields and an admin's new page address, saved in one batch
// with the keepers' stamps (functions/utils/clubs/save.ts). With it unset
// both answer and write exactly what they did before, and a body carrying a
// new field is refused 403.
import type { Env, MemberRow } from '../../../types'
import { isResponse, requireClubRep, requireAdmin, requireClubView } from '../../../utils/auth'
import {
  errorResponse,
  handleOptions,
  jsonResponse,
  parseBody,
} from '../../../utils/response'
import { recordAdminAction } from '../../../utils/admin/audit'
import { admittedByRegionAlone, officersWithoutEmail } from '../../../utils/clubs/memberView'
import { ADMIN_CLUB_COLUMNS } from '../../../utils/clubs/adminAnswer'
import { isMissingTableOrColumn } from '../../../utils/clubs/migrationLag'
import { CLUB_KEEPERS_ON } from '../../../utils/clubs/pages'
import {
  KEEPER_FLAG_FIELDS,
  KEEPER_TEXT_FIELDS,
  carriesKeeperFields,
  readKeeperColumns,
  readPlaces,
  saveListing,
  slugLeadsElsewhere,
  storedText,
} from '../../../utils/clubs/save'
import { sendClubSaveNotice } from '../../../utils/clubs/emails'
import { isReservedSlug } from '../../../../domain/clubs/slug'
import {
  todaysClubSaveRequestSchema,
  updateClubRequestSchemaFor,
  type UpdateClubRequest,
} from '../../../../domain/contracts/clubs'

/** The one log line for a club's rows in migration 0066's tables that the delete could not clear; it names no club. */
export const CLUB_ROWS_UNCLEARED_LOG = 'club delete: the club tables of migration 0066 could not be read; the delete goes on without them'

/** The 403 a body carrying any of the new listing's fields gets while CLUB_KEEPERS_ON is unset. */
export const KEEPER_FIELDS_CLOSED = 'The new club page fields cannot be saved yet.'

/** The 403 a club's rep or a region's representative gets for a new page address. */
export const SLUG_KEPT_FOR_ADMINS = 'Only LCA admins can change a club\'s page address'

/** The 400 for an address the club pages keep for their own use. */
export const SLUG_RESERVED = 'That page address is kept for the club pages\' own use'

/** The 409 for an address that leads, or once led, to another club. */
export const SLUG_ELSEWHERE = 'That page address leads to another club, so it cannot be used'

/** The 409 for a save whose batch failed on a unique key, as when another save took the address first. */
export const SAVE_CLASHED = 'The page address clashed with one already kept, so nothing was saved.'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const clubId = context.params.id as string
  const authResult = await requireClubView(context.request, context.env, clubId)
  if (isResponse(authResult)) return authResult

  // Today's 13 columns by name, so the answer is what it was before 0066.
  const club = await context.env.DB.prepare(`SELECT ${ADMIN_CLUB_COLUMNS} FROM clubs WHERE id = ?`)
    .bind(clubId)
    .first()

  if (!club) return errorResponse('Club not found', 404)

  // A person admitted by a regional seat alone gets the club, its officers
  // without their emails and an empty roster (functions/utils/clubs/memberView.ts).
  const regionAlone = admittedByRegionAlone(authResult.member, clubId)

  const officers = await context.env.DB.prepare(
    `SELECT co.id, co.member_id, co.role, m.full_name, m.email
     FROM club_officers co
     JOIN members m ON co.member_id = m.id
     WHERE co.club_id = ? ORDER BY co.created_at`,
  ).bind(clubId).all()

  const roster = regionAlone
    ? { results: [] }
    : await context.env.DB.prepare(
      `SELECT m.id, m.full_name, m.email, m.uscf_id, m.uscf_rating, m.membership_status
       FROM members m WHERE m.club_id = ? AND m.role != 'guest' ORDER BY m.full_name`,
    ).bind(clubId).all()

  // Unlike the public club endpoint, this includes hidden drafts: the people
  // allowed here are exactly the people who manage those drafts.
  const tournaments = await context.env.DB.prepare(
    `SELECT id, name, date, end_date, status, is_visible, registration_status
     FROM tournaments WHERE club_id = ? ORDER BY date DESC`,
  ).bind(clubId).all()

  const answer = {
    club,
    officers: regionAlone ? officersWithoutEmail(officers.results) : officers.results,
    roster: roster.results,
    tournaments: tournaments.results,
  }
  if (!CLUB_KEEPERS_ON) return jsonResponse(answer)

  // With CLUB_KEEPERS_ON set the club's fifteen new columns join it (two of
  // them member ids, never an email) and its places follow, for each person
  // admitted; the roster rule above stays as it is.
  return jsonResponse({
    ...answer,
    club: { ...club, ...(await readKeeperColumns(context.env.DB, clubId)) },
    places: await readPlaces(context.env.DB, clubId),
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

  // While CLUB_KEEPERS_ON is unset the body is read by today's contract
  // alone, and one that carries any of the new listing's fields is refused
  // before anything is checked or written; once it is set the new fields
  // are read with their limits (domain/contracts/clubs.ts), and a field of
  // today's already stored over its limit may come back unchanged.
  const keepersOn = CLUB_KEEPERS_ON
  const schema = keepersOn
    ? updateClubRequestSchemaFor({
        name: existing.name,
        city: existing.city,
        location: existing.location,
        description: existing.description,
        meetingSchedule: existing.meeting_schedule,
        contactEmail: existing.contact_email,
        color: existing.color,
        imageUrl: existing.image_url,
        region: existing.region,
      })
    : todaysClubSaveRequestSchema
  const parsed = await parseBody(context.request, schema)
  if (isResponse(parsed)) return parsed
  const body = parsed as UpdateClubRequest
  if (!keepersOn && carriesKeeperFields(body)) return errorResponse(KEEPER_FIELDS_CLOSED, 403)

  // A club's name and region decide how it is listed and filtered site-wide,
  // so those stay with LCA admins. Sending the unchanged value is fine: the
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
    // The page's address too: an old address keeps leading to the club, so
    // a change is for an LCA admin to weigh.
    if (body.slug !== undefined && body.slug !== existing.slug) {
      return errorResponse(SLUG_KEPT_FOR_ADMINS, 403)
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

  let latitude = existing.latitude ?? null
  let longitude = existing.longitude ?? null
  if (body.mapLocation !== undefined) {
    if (body.mapLocation === null) {
      latitude = null
      longitude = null
    } else {
      const lat = Number(body.mapLocation?.lat)
      const lng = Number(body.mapLocation?.lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        return errorResponse('Map location must be a valid latitude and longitude', 400)
      }
      latitude = Math.round(lat * 1e6) / 1e6
      longitude = Math.round(lng * 1e6) / 1e6
    }
  }

  // Hex-validate color when provided; explicit null clears it, an invalid
  // string is ignored in favor of the existing value.
  const color = body.color !== undefined
    ? (body.color === null
        ? null
        : /^#[0-9A-Fa-f]{6}$/.test(body.color) ? body.color : existing.color)
    : existing.color

  // Today's eleven columns, as today's save has always written them.
  const todays: Record<string, unknown> = {
    name: body.name?.trim() ?? existing.name,
    city: body.city?.trim() ?? existing.city,
    location: body.location !== undefined ? body.location : existing.location,
    description: body.description !== undefined ? body.description : existing.description,
    meeting_schedule: body.meetingSchedule !== undefined ? body.meetingSchedule : existing.meeting_schedule,
    contact_email: body.contactEmail !== undefined ? body.contactEmail : existing.contact_email,
    color,
    image_url: body.imageUrl !== undefined ? body.imageUrl : existing.image_url,
    region: body.region !== undefined ? (body.region || null) : existing.region,
    latitude,
    longitude,
  }

  if (keepersOn) {
    const refused = await saveKeepersListing(context, authResult.member, existing, todays, body)
    if (refused) return refused
  } else {
    await context.env.DB.prepare(
      `UPDATE clubs SET
        name = ?, city = ?, location = ?, description = ?,
        meeting_schedule = ?, contact_email = ?,
        color = ?, image_url = ?, region = ?, latitude = ?, longitude = ?
       WHERE id = ?`,
    ).bind(
      todays.name,
      todays.city,
      todays.location,
      todays.description,
      todays.meeting_schedule,
      todays.contact_email,
      todays.color,
      todays.image_url,
      todays.region,
      todays.latitude,
      todays.longitude,
      clubId,
    ).run()
  }

  // Today's 13 columns by name, so the answer is what it was before 0066.
  const club = await context.env.DB.prepare(`SELECT ${ADMIN_CLUB_COLUMNS} FROM clubs WHERE id = ?`)
    .bind(clubId).first<Record<string, unknown>>()

  // With CLUB_KEEPERS_ON set the save above wrote its own activity row in
  // its batch, and the answer carries the fifteen new columns too.
  if (keepersOn) {
    return jsonResponse({ club: { ...club, ...(await readKeeperColumns(context.env.DB, clubId)) } })
  }

  // Which fields actually changed, for the activity log.
  const COLUMNS = ['name', 'city', 'location', 'description', 'meeting_schedule',
    'contact_email', 'color', 'image_url', 'region', 'latitude', 'longitude']
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

/**
 * The keepers' save, while CLUB_KEEPERS_ON is set: today's eleven columns,
 * the new fields the body carries, the mirror of About and the statement
 * into today's description and meeting schedule, and an admin's new page
 * address, written in one batch with the stamps and the activity row
 * (functions/utils/clubs/save.ts); then the notice to the region's
 * representatives, after the answer. Answers a refusal, or null once the
 * save is written.
 */
async function saveKeepersListing(
  context: EventContext<Env, string, unknown>,
  saver: MemberRow,
  existing: Record<string, unknown>,
  todays: Record<string, unknown>,
  body: UpdateClubRequest,
): Promise<Response | null> {
  const clubId = context.params.id as string
  const next: Record<string, unknown> = { ...todays }
  const fields = body as Record<string, unknown>
  for (const [key, column] of KEEPER_TEXT_FIELDS) {
    if (fields[key] !== undefined) next[column] = storedText(fields[key] as string | null)
  }
  for (const [key, column] of KEEPER_FLAG_FIELDS) {
    if (fields[key] !== undefined) next[column] = fields[key] ? 1 : 0
  }
  // The mirror: a new text that is not empty is written to today's field
  // too, over what the body sent for it; an empty one leaves today's alone.
  if (typeof next.about_text === 'string') next.description = next.about_text
  if (typeof next.how_we_meet_text === 'string') next.meeting_schedule = next.how_we_meet_text

  if (body.slug !== undefined && body.slug !== existing.slug) {
    if (isReservedSlug(body.slug)) return errorResponse(SLUG_RESERVED, 400)
    if (await slugLeadsElsewhere(context.env.DB, body.slug, clubId)) return errorResponse(SLUG_ELSEWHERE, 409)
    next.slug = body.slug
  }

  let changed: string[]
  try {
    changed = await saveListing(context.env.DB, { clubId, saver, existing, next })
  } catch (err) {
    if (/UNIQUE constraint failed/i.test(err instanceof Error ? err.message : String(err))) return errorResponse(SAVE_CLASHED, 409)
    throw err
  }

  context.waitUntil(sendClubSaveNotice(context.env, context.request, {
    clubId,
    clubName: String(next.name ?? existing.name),
    saver,
    columns: changed,
  }))
  return null
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
  // The club's rows in migration 0066's tables, which reference it with no
  // delete action, go in one batch with the club itself, so a club whose own
  // delete fails keeps its places, old slugs, reports and rep requests. A club
  // that owns a mail list (mail_lists.club_id, 0060) still cannot be deleted,
  // as before. Before 0066 has run the four tables are not there, and the club
  // is deleted on its own as before, with one log line.
  try {
    await context.env.DB.batch([
      context.env.DB.prepare('DELETE FROM club_places WHERE club_id = ?').bind(clubId),
      context.env.DB.prepare('DELETE FROM club_slug_history WHERE club_id = ?').bind(clubId),
      context.env.DB.prepare('DELETE FROM club_reports WHERE club_id = ?').bind(clubId),
      context.env.DB.prepare('DELETE FROM club_rep_requests WHERE club_id = ?').bind(clubId),
      context.env.DB.prepare('DELETE FROM clubs WHERE id = ?').bind(clubId),
    ])
  } catch (err) {
    if (!isMissingTableOrColumn(err)) throw err
    console.warn(CLUB_ROWS_UNCLEARED_LOG)
    await context.env.DB.prepare('DELETE FROM clubs WHERE id = ?').bind(clubId).run()
  }

  return jsonResponse({ success: true })
}
