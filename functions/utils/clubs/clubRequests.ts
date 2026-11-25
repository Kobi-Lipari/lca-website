// functions/utils/clubs/clubRequests.ts
//
// Suggest a club and Start a club (WS09 step 30): what a visitor sends from
// the form at /clubs/suggest, saved as a row of club_reports of the kind
// 'new_club' or 'start_club' (migration 0066, whose CHECK keeps such a row
// with no club) and emailed to whoever keeps the place it names, by the
// keepers functions/utils/clubs/routing.ts names, read through ./emails.ts:
//   1. each representative whose seat covers the region the place was found
//      in (functions/utils/clubs/places.ts);
//   2. else, while that seat is open, or when the place was not found, or
//      when no representative's address took the email, each LCA admin.
// A guest is never a representative (the seat rule in ./routing.ts). One
// email goes to each person, so no keeper sees another's address, and none
// goes to the address the person typed, even where it is a keeper's own: a
// keeper whose address it is counts as reached, since the row is on their
// own list in My region, so typing a representative's address never turns a
// row over to the admins. A row the representatives could not be reached for
// is counted against the admins' own hour before any admin is written to
// (`adminsMayBeWritten`, from the endpoint), so no region's count is ever
// spent on the admins; with that hour used up no email goes, and the row
// waits in My region.
//
// The row holds the least: no club, the kind, the person's words of where and
// when, their address, the region found (null when the place was not found),
// and in proposed_json the club's name, the city or ZIP code as typed and
// the person's name, and nothing else: never a network address, a browser's
// name or a member id, whoever sends it, since the endpoint never reads the
// sign-in. The row is saved before any email is sent, so a row no address
// took still shows in My region, and the person is told it was sent all the
// same. Mark as handled (functions/api/admin/club-reports/[reportId].ts)
// empties the address and takes the name out of proposed_json in its one
// statement.
//
// The email names neither the person nor their address: both are on the row,
// for the keeper who signs in. An email that did not go is logged in fixed
// words alone, never in the words its failure carries, since a mail service's
// refusal may name the address it refused.
import { sendEmail, type EmailEnv } from '../email'
import { resolveSiteUrl } from '../site'
import { clubRequestKeeperEmail, clubRequestLink, lcaAdmins, representativesOfRegion, type ClubRequestReason, type Keeper } from './emails'
import type { ClubRequestKind } from '../../../domain/clubs/newClub'
import { wholeDaysSince } from '../../../domain/clubs/regionCards'
import type { ClubRequestRow } from '../../../domain/contracts/clubRequests'

/** The one line an email that did not go leaves in the log: fixed words, with no address and none of the person's words. */
export const CLUB_REQUEST_NOT_SENT_LOG = 'Suggest a club: an email to a keeper was not sent.'

/** The pause between one keeper's email and the next, the pace the relay keeps. */
const SEND_INTERVAL_MS = 400

/** What the person sent, after the contract's check, each part trimmed, and the region found for the place. */
export interface ClubRequestSent {
  kind: ClubRequestKind
  clubName: string
  place: string
  message: string
  name: string
  email: string
  region: string | null
}

type ClubRequestEnv = EmailEnv & { DB: D1Database; SITE_URL?: string }

/** The admins' set in the endpoint's count of keepers: no region takes this name. */
export const CLUB_REQUEST_ADMINS_KEY = 'lca'

/**
 * Where a row's emails go first, as the endpoint counts them: the region's name while someone holds its seat, and
 * 'lca' while the seat is open or the place was not found. Never told to the person.
 */
export async function clubRequestGoesTo(db: D1Database, region: string | null): Promise<string> {
  if (!region) return CLUB_REQUEST_ADMINS_KEY
  return (await representativesOfRegion(db, region)).length > 0 ? region : CLUB_REQUEST_ADMINS_KEY
}

/** Writes the row and answers its id. */
async function saveRow(db: D1Database, sent: ClubRequestSent): Promise<number> {
  const proposed = JSON.stringify({ clubName: sent.clubName, place: sent.place, name: sent.name })
  const row = await db.prepare(
    `INSERT INTO club_reports (club_id, kind, message, proposed_json, region, reporter_email)
     VALUES (NULL, ?, ?, ?, ?, ?)
     RETURNING id`,
  )
    .bind(sent.kind, sent.message, proposed, sent.region, sent.email)
    .first<{ id: number }>()
  return Number(row!.id)
}

/**
 * Saves the row and emails its keepers, in the order above. Answers how many
 * emails went, which the person is never told. `adminsMayBeWritten` counts
 * the admins' own hour and answers whether it has room, asked only when a
 * row with representatives falls to the admins. Never throws for a failed
 * send; a failed write is not caught, and the endpoint answers it as any
 * fault, with nothing sent.
 */
export async function saveClubRequest(
  env: ClubRequestEnv,
  request: Request,
  sent: ClubRequestSent,
  adminsMayBeWritten: () => Promise<boolean>,
): Promise<number> {
  const rowId = await saveRow(env.DB, sent)
  const siteUrl = resolveSiteUrl(env, request)
  const link = clubRequestLink(siteUrl, rowId)
  const own = sent.email.trim().toLowerCase()
  // Each address is tried once, whichever keeper it belongs to.
  const tried = new Set<string>()
  let sends = 0
  let delivered = 0

  /** True when the keeper is reached: written to, or the person themselves, whose own list holds the row. */
  const sendTo = async (person: Keeper, reason: ClubRequestReason): Promise<boolean> => {
    const key = person.email.trim().toLowerCase()
    if (key === own) return true
    if (tried.has(key)) return false
    tried.add(key)
    if (sends++ > 0) await new Promise((resolve) => setTimeout(resolve, SEND_INTERVAL_MS))
    const mail = clubRequestKeeperEmail({
      siteUrl, kind: sent.kind, reason, region: sent.region, clubName: sent.clubName, place: sent.place, message: sent.message, link,
    })
    try {
      // The reply-to is left to sendEmail, LCA's own: never the person's.
      await sendEmail(env, { ...mail, to: person.email })
      delivered++
      return true
    } catch {
      // The failure's own words are not logged: a service's refusal may name the address it refused.
      console.warn(CLUB_REQUEST_NOT_SENT_LOG)
      return false
    }
  }

  const sendToEach = async (people: Keeper[], reason: ClubRequestReason): Promise<boolean> => {
    let any = false
    for (const person of people) if (await sendTo(person, reason)) any = true
    return any
  }

  const reps = sent.region ? await representativesOfRegion(env.DB, sent.region) : []
  if (reps.length > 0) {
    if (await sendToEach(reps, 'region')) return delivered
    // Not one representative was reached: the admins' own hour is counted before the row falls to them.
    if (!(await adminsMayBeWritten())) return delivered
  }
  const reason: ClubRequestReason = !sent.region ? 'not_found' : reps.length === 0 ? 'open_seat' : 'unreachable'
  await sendToEach(await lcaAdmins(env.DB), reason)
  return delivered
}

/** The regions a member's active regional seats cover, read by the seat rule; a guest's seat covers none. */
export async function seatRegionsCovered(db: D1Database, memberId: string): Promise<string[]> {
  const { results } = await db
    .prepare(
      `SELECT DISTINCT r.region
         FROM board_seat_assignments a
         JOIN board_members s ON s.id = a.seat_id
         JOIN seat_regions r  ON r.seat_id = s.id
         JOIN members m       ON m.id = a.member_id
        WHERE a.member_id = ?
          AND a.ended_at IS NULL
          AND s.is_active = 1
          AND s.category = 'regional_rep'
          AND m.role <> 'guest'
        ORDER BY r.region`,
    )
    .bind(memberId)
    .all<{ region: string }>()
  return (results ?? []).map((row) => row.region)
}

interface OpenRow {
  id: number
  kind: string
  message: string
  proposed_json: string | null
  region: string | null
  reporter_email: string | null
  created_at: string
}

/** A string part of proposed_json, or '' when it is missing or not a string. */
function partOf(json: string | null, key: 'clubName' | 'place' | 'name'): string {
  try {
    const value = (JSON.parse(json ?? '{}') as Record<string, unknown>)[key]
    return typeof value === 'string' ? value : ''
  } catch {
    return ''
  }
}

/**
 * The open rows of the two kinds a keeper sees, oldest first: every one for
 * an LCA admin (`all`), those with no region among them; for a holder of a
 * seat, those of the regions named. Each with its age in whole days against
 * `nowMs`, the one time the answer is read against.
 */
export async function openClubRequests(db: D1Database, keeps: { all: boolean; regions: readonly string[] }, nowMs: number): Promise<ClubRequestRow[]> {
  if (!keeps.all && keeps.regions.length === 0) return []
  const { results } = await db.prepare(
    `SELECT id, kind, message, proposed_json, region, reporter_email, created_at
       FROM club_reports
      WHERE club_id IS NULL
        AND kind IN ('new_club', 'start_club')
        AND status = 'open'
        AND (?1 = 1 OR region IN (SELECT value FROM json_each(?2)))
      ORDER BY created_at, id`,
  )
    .bind(keeps.all ? 1 : 0, JSON.stringify(keeps.regions))
    .all<OpenRow>()
  return (results ?? []).map((row) => ({
    id: Number(row.id),
    kind: row.kind === 'start_club' ? 'start_club' : 'new_club',
    clubName: partOf(row.proposed_json, 'clubName'),
    place: partOf(row.proposed_json, 'place'),
    message: row.message,
    name: partOf(row.proposed_json, 'name'),
    email: row.reporter_email?.trim() ?? '',
    region: row.region || null,
    ageDays: wholeDaysSince(row.created_at, nowMs),
  }))
}
