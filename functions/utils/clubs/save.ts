// functions/utils/clubs/save.ts
//
// The keepers' save of a club's listing and of its places, while
// CLUB_KEEPERS_ON is set (functions/utils/clubs/pages.ts). Each save is one
// db.batch, so a statement that fails part way leaves nothing of the save
// written: the club's columns, the stamps, an old address and the activity
// log's row go together or not at all.
//
// Every save by a keeper (an LCA admin, the club's rep or the representative
// for its region) is told and checked: told_updated_at and told_by, and
// last_confirmed_at and confirmed_by, are set to now and to the saver,
// whether or not a field changed. The club_edit row of the activity log is
// written when a field changed, as today's save writes it.
//
// The mirror, by K's choice 3 (a) on the WS09 plan: a save also writes
// today's fields beside the new ones, so today's club pages keep showing
// what the keepers wrote. description takes About and meeting_schedule the
// statement of how the club meets, each only when the new text is not
// empty, so no line today's pages show ever goes blank; a places save gives
// location place 1's name and street, and latitude and longitude place 1's
// point, each only when place 1 has one.
//
// With CLUB_KEEPERS_ON unset nothing here runs: today's PATCH writes today's
// columns alone, with no stamp, as before.

import type { MemberRow } from '../../types'

/**
 * The fifteen columns migration 0066 added to clubs, named for the admin
 * answers while CLUB_KEEPERS_ON is set. Today's 13 stay in
 * ADMIN_CLUB_COLUMNS (functions/utils/clubs/adminAnswer.ts).
 */
export const KEEPER_CLUB_COLUMNS =
  'slug, about_text, how_we_meet_text, cost_text, welcome_text, weekend_play, scholastic_friendly, contact_name_public, facebook_url, website_url, other_url, told_updated_at, told_by, last_confirmed_at, confirmed_by'

/** A place's columns, as the admin answers name them. */
const PLACE_COLUMNS = 'id, name, street, note, latitude, longitude'

/** The new listing's text fields: the body's key and the column it is stored in. */
export const KEEPER_TEXT_FIELDS = [
  ['aboutText', 'about_text'],
  ['howWeMeetText', 'how_we_meet_text'],
  ['costText', 'cost_text'],
  ['welcomeText', 'welcome_text'],
  ['contactNamePublic', 'contact_name_public'],
  ['facebookUrl', 'facebook_url'],
  ['websiteUrl', 'website_url'],
  ['otherUrl', 'other_url'],
] as const

/** The new listing's two yes or no fields, stored as 1 or 0. */
export const KEEPER_FLAG_FIELDS = [
  ['weekendPlay', 'weekend_play'],
  ['scholasticFriendly', 'scholastic_friendly'],
] as const

/** Every key of the PATCH body that belongs to the new save: the ten new fields and the slug. */
export const KEEPER_BODY_KEYS: readonly string[] = [
  ...KEEPER_TEXT_FIELDS.map(([key]) => key),
  ...KEEPER_FLAG_FIELDS.map(([key]) => key),
  'slug',
]

/** Whether a body carries any key of the new save. */
export function carriesKeeperFields(body: Record<string, unknown>): boolean {
  return KEEPER_BODY_KEYS.some((key) => Object.hasOwn(body, key))
}

/** The columns a listing save may write, today's eleven and the new ones; nothing else is ever put in its statement. */
const SAVABLE = new Set<string>([
  'name', 'city', 'location', 'description', 'meeting_schedule', 'contact_email', 'color', 'image_url', 'region', 'latitude', 'longitude',
  ...KEEPER_TEXT_FIELDS.map(([, column]) => column),
  ...KEEPER_FLAG_FIELDS.map(([, column]) => column),
  'slug',
])

/** Text as it is stored: trimmed, and null when nothing is left. */
export function storedText(text: string | null | undefined): string | null {
  const trimmed = text?.trim() ?? ''
  return trimmed === '' ? null : trimmed
}

/** The fifteen new columns of one club, or null for a club that is not there. */
export async function readKeeperColumns(db: D1Database, clubId: string): Promise<Record<string, unknown> | null> {
  return db.prepare(`SELECT ${KEEPER_CLUB_COLUMNS} FROM clubs WHERE id = ?`).bind(clubId).first<Record<string, unknown>>()
}

/** One place as the admin answers carry it. */
export interface PlaceRow {
  id: number
  name: string
  street: string | null
  note: string | null
  latitude: number | null
  longitude: number | null
}

/** The club's places, place 1 first. */
export async function readPlaces(db: D1Database, clubId: string): Promise<PlaceRow[]> {
  const { results } = await db
    .prepare(`SELECT ${PLACE_COLUMNS} FROM club_places WHERE club_id = ? ORDER BY sort, id`)
    .bind(clubId)
    .all<PlaceRow>()
  return results ?? []
}

/**
 * Whether an address leads to another club today, or once did: another
 * club's id, any other club's slug, or an old slug another club held. An
 * address is never given to a second club, so a link someone shared keeps
 * leading where it led ("monroe" stays Monroe Chess Club's for good). The
 * club's own id and its own old slugs are not held against it.
 */
export async function slugLeadsElsewhere(db: D1Database, slug: string, clubId: string): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT 1 FROM clubs WHERE id = ? AND id != ?
       UNION ALL SELECT 1 FROM clubs WHERE slug = ? AND id != ?
       UNION ALL SELECT 1 FROM club_slug_history WHERE old_slug = ? AND club_id != ?
       LIMIT 1`,
    )
    .bind(slug, clubId, slug, clubId, slug, clubId)
    .first()
  return !!row
}

/** The columns whose value the save changes, in the order given. */
export function changedColumns(existing: Record<string, unknown>, next: Record<string, unknown>): string[] {
  return Object.keys(next).filter((column) => (next[column] ?? null) !== (existing[column] ?? null))
}

/** The four stamps of a keeper's save, set to now and to the saver. */
const STAMPS = 'told_updated_at = datetime(\'now\'), told_by = ?, last_confirmed_at = datetime(\'now\'), confirmed_by = ?'

/** The activity log's club_edit row, as recordAdminAction in functions/utils/admin/audit.ts writes one, prepared for the save's batch. */
function auditRow(db: D1Database, saver: MemberRow, label: string, clubId: string, fields: string[]): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO admin_audit_log
         (id, actor_id, actor_email, action, target_member_id, target_label, detail)
       VALUES (?, ?, ?, 'club_edit', NULL, ?, ?)`,
    )
    .bind(
      `aud-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      saver.id,
      saver.email,
      label,
      JSON.stringify({ club_id: clubId, fields }),
    )
}

/** One listing save: the club as read before it, and every column the save writes with its new value. */
export interface ListingSave {
  clubId: string
  saver: MemberRow
  /** The club's row as it was read before the save. */
  existing: Record<string, unknown>
  /** Each column the save writes, with its value; `slug` only when an admin changes it. */
  next: Record<string, unknown>
}

/**
 * Writes one listing save in one batch: the club's columns with the four
 * stamps; when the slug changes, the old slug into club_slug_history, after
 * taking out the club's own row for the slug it takes back, if it held that
 * one before; and the activity log's row when a field changed. Answers the
 * columns that changed. A failed statement fails the whole batch, and the
 * error is thrown to the caller with nothing written.
 */
export async function saveListing(db: D1Database, save: ListingSave): Promise<string[]> {
  const columns = Object.keys(save.next)
  for (const column of columns) if (!SAVABLE.has(column)) throw new Error(`club save: ${column} is not a listing column`)
  const changed = changedColumns(save.existing, save.next)
  const label = String(save.next.name ?? save.existing.name)

  const statements: D1PreparedStatement[] = [
    db
      .prepare(`UPDATE clubs SET ${columns.map((column) => `${column} = ?`).join(', ')}, ${STAMPS} WHERE id = ?`)
      .bind(...columns.map((column) => save.next[column] ?? null), save.saver.id, save.saver.id, save.clubId),
  ]
  const oldSlug = save.existing.slug
  if (changed.includes('slug') && typeof oldSlug === 'string' && oldSlug !== '') {
    statements.push(
      db.prepare('DELETE FROM club_slug_history WHERE old_slug = ? AND club_id = ?').bind(save.next.slug, save.clubId),
      db.prepare('INSERT INTO club_slug_history (old_slug, club_id) VALUES (?, ?)').bind(oldSlug, save.clubId),
    )
  }
  if (changed.length > 0) statements.push(auditRow(db, save.saver, label, save.clubId, changed))

  await db.batch(statements)
  return changed
}

/** One place as a keeper saves it. */
export interface PlaceInput {
  name: string
  street?: string | null
  note?: string | null
  point?: { lat: number; lng: number } | null
}

/** A number of degrees as the save stores it, to six places, as today's map pin is. */
const degrees = (value: number) => Math.round(value * 1e6) / 1e6

/** The line today's location field takes from a place: its name, and its street after a comma. */
export function locationLine(place: { name: string; street?: string | null }): string {
  const street = storedText(place.street)
  return street ? `${place.name.trim()}, ${street}` : place.name.trim()
}

/** One places save: the club as read before it and the places that replace its own. */
export interface PlacesSave {
  clubId: string
  saver: MemberRow
  existing: Record<string, unknown>
  places: PlaceInput[]
}

/**
 * Writes the club's places in one batch: its places taken out and the new
 * ones written in their order, today's location, latitude and longitude
 * taken from place 1 where place 1 has them, the four stamps, and the
 * activity log's row when anything changed. Answers the fields that
 * changed, 'places' among them when the places differ from those before.
 */
export async function savePlaces(db: D1Database, save: PlacesSave): Promise<string[]> {
  const before = await readPlaces(db, save.clubId)
  const after = save.places.map((place) => ({
    name: place.name.trim(),
    street: storedText(place.street),
    note: storedText(place.note),
    latitude: place.point ? degrees(place.point.lat) : null,
    longitude: place.point ? degrees(place.point.lng) : null,
  }))
  const same = before.length === after.length && before.every((row, i) =>
    row.name === after[i].name && row.street === after[i].street && row.note === after[i].note
    && row.latitude === after[i].latitude && row.longitude === after[i].longitude)

  const mirror: Record<string, unknown> = {
    location: save.existing.location ?? null,
    latitude: save.existing.latitude ?? null,
    longitude: save.existing.longitude ?? null,
  }
  const first = save.places[0]
  if (first) {
    mirror.location = locationLine(first)
    if (first.point) {
      mirror.latitude = degrees(first.point.lat)
      mirror.longitude = degrees(first.point.lng)
    }
  }
  const changed = [...(same ? [] : ['places']), ...changedColumns(save.existing, mirror)]

  const statements: D1PreparedStatement[] = [
    db.prepare('DELETE FROM club_places WHERE club_id = ?').bind(save.clubId),
    ...after.map((place, sort) =>
      db
        .prepare('INSERT INTO club_places (club_id, name, street, note, latitude, longitude, sort) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(save.clubId, place.name, place.street, place.note, place.latitude, place.longitude, sort),
    ),
    db
      .prepare(`UPDATE clubs SET location = ?, latitude = ?, longitude = ?, ${STAMPS} WHERE id = ?`)
      .bind(mirror.location, mirror.latitude, mirror.longitude, save.saver.id, save.saver.id, save.clubId),
  ]
  if (changed.length > 0) statements.push(auditRow(db, save.saver, String(save.existing.name), save.clubId, changed))

  await db.batch(statements)
  return changed
}
