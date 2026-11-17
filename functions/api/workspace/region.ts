// functions/api/workspace/region.ts
//
// GET: My region's answer. A member who holds an active regional seat gets
// in whatever their role, and gets the clubs of every region the seat's
// seat_regions cover (getRegionalClubIds in
// functions/utils/admin/permissions.ts), an open seat's region an LCA admin
// has added to the seat among them; an LCA admin gets every club. Anyone
// else gets 403: a member with no seat, a holder whose seat is inactive or
// whose term has ended, a club's rep with no seat, an observer with no
// seat, a guest and a child account. An observer who holds a seat gets in
// as its holder.
//
// Each club comes as its card: the listing's name, town, region, colour,
// logo address and statement, the last check with its words, the count of
// its events the person is shown and its open items (empty until WS09 steps
// 19 and 28 fill them), in My region's order (domain/clubs/regionCards.ts).
// This month gives the next check (domain/clubs/monthlyCheck.ts) and how
// many clubs were checked in the last 90 days and how many not, and the
// regions name who else keeps them: the name and seat title of each other
// holder of an active seat, never an address.
//
// Nothing here answers a roster, an officer, a member's or a club's email.
// A person admitted to a club by the region alone (admittedByRegionAlone in
// functions/utils/clubs/memberView.ts) is counted only the club's visible
// events, so the count never tells that hidden drafts exist.
//
// While REGION_EVENTS_ON is set (WS09 step 19) each card also counts the
// club's events in LCA review, `inReview`, and This month their sum, and
// every event of a club the person keeps is counted, drafts among them,
// since the person runs them; with it unset the answer is as before, with
// no query more.
//
// While CLUB_KEEPERS_ON is unset everyone gets 403 in words before anything
// is read: no sign in is checked and no query is made.
import type { Env, MemberRow } from '../../types'
import { isResponse, requireAuthedMember } from '../../utils/auth'
import { errorResponse, handleOptions, jsonResponse } from '../../utils/response'
import { CLUB_KEEPERS_ON } from '../../utils/clubs/pages'
import { REGION_EVENTS_ON } from '../../utils/clubs/pages'
import { getRegionalClubIds } from '../../utils/admin/permissions'
import { admittedByRegionAlone } from '../../utils/clubs/memberView'
import { checkCounts, checkWords, needsCheck, sortRegionCards } from '../../../domain/clubs/regionCards'
import { nextCheckWords } from '../../../domain/clubs/monthlyCheck'
import type { RegionClub, WorkspaceRegionResponse } from '../../../domain/contracts/clubs'

/** The 403 everyone gets while CLUB_KEEPERS_ON is unset. */
export const REGION_CLOSED = 'My region is not open yet.'

/** The 403 for a signed in person who holds no active regional seat and is not an LCA admin. */
export const REGION_FOR_SEATS = 'My region is for the holders of a regional representative\'s seat and the LCA admins.'

interface ClubRow {
  id: string
  name: string
  city: string
  region: string | null
  color: string | null
  image_url: string | null
  how_we_meet_text: string | null
  last_confirmed_at: string | null
}

const CLUB_COLUMNS = 'id, name, city, region, color, image_url, how_we_meet_text, last_confirmed_at'

/** The regions of the member's active regional seats; an empty list when they hold none. */
async function seatRegionsOf(db: D1Database, memberId: string): Promise<Array<{ region: string | null }>> {
  const { results } = await db
    .prepare(
      `SELECT r.region
         FROM board_seat_assignments a
         JOIN board_members s     ON s.id = a.seat_id
         LEFT JOIN seat_regions r ON r.seat_id = s.id
        WHERE a.member_id = ?
          AND a.ended_at IS NULL
          AND s.is_active = 1
          AND s.category = 'regional_rep'`,
    )
    .bind(memberId)
    .all<{ region: string | null }>()
  return results ?? []
}

async function clubsFor(db: D1Database, member: MemberRow): Promise<ClubRow[]> {
  if (member.role === 'lca_admin') {
    return (await db.prepare(`SELECT ${CLUB_COLUMNS} FROM clubs`).all<ClubRow>()).results ?? []
  }
  const ids = await getRegionalClubIds(db, member.id)
  if (ids.length === 0) return []
  return (await db
    .prepare(`SELECT ${CLUB_COLUMNS} FROM clubs WHERE id IN (SELECT value FROM json_each(?))`)
    .bind(JSON.stringify(ids))
    .all<ClubRow>()).results ?? []
}

/**
 * Each club's count of events: every event for a club whose drafts the
 * person is shown, and the visible ones alone for the rest, so a hidden
 * draft is never read for a person who is not shown it.
 */
async function eventCounts(db: D1Database, clubIds: string[], draftsShown: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (clubIds.length === 0) return counts
  const { results } = await db
    .prepare(
      `SELECT club_id, COUNT(*) AS n
         FROM tournaments
        WHERE club_id IN (SELECT value FROM json_each(?1))
          AND (is_visible = 1 OR club_id IN (SELECT value FROM json_each(?2)))
        GROUP BY club_id`,
    )
    .bind(JSON.stringify(clubIds), JSON.stringify(draftsShown))
    .all<{ club_id: string; n: number }>()
  for (const row of results ?? []) counts.set(row.club_id, Number(row.n))
  return counts
}

/**
 * Each club's count of events in LCA review: marked for approval
 * (needs_lca_approval 1), sent (approval_requested_at set) and not approved
 * (approved_at empty), as approvalState in domain/events/approval.ts reads
 * the in_review state, an empty or blank time read as not set. Read only
 * while REGION_EVENTS_ON is set.
 */
async function reviewCounts(db: D1Database, clubIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (clubIds.length === 0) return counts
  const { results } = await db
    .prepare(
      `SELECT club_id, COUNT(*) AS n
         FROM tournaments
        WHERE club_id IN (SELECT value FROM json_each(?1))
          AND needs_lca_approval = 1
          AND approval_requested_at IS NOT NULL AND TRIM(approval_requested_at) <> ''
          AND (approved_at IS NULL OR TRIM(approved_at) = '')
        GROUP BY club_id`,
    )
    .bind(JSON.stringify(clubIds))
    .all<{ club_id: string; n: number }>()
  for (const row of results ?? []) counts.set(row.club_id, Number(row.n))
  return counts
}

/** Who keeps each region besides the person: the holders of active seats over it, by name and seat title; a guest, whom both endpoints refuse, is never named. */
async function keepersOf(db: D1Database, regions: string[], memberId: string): Promise<WorkspaceRegionResponse['regions']> {
  if (regions.length === 0) return []
  const { results } = await db
    .prepare(
      `SELECT DISTINCT r.region, m.full_name AS name, s.role AS seat, a.member_id
         FROM seat_regions r
         JOIN board_members s          ON s.id = r.seat_id
         JOIN board_seat_assignments a ON a.seat_id = s.id
         JOIN members m                ON m.id = a.member_id
        WHERE r.region IN (SELECT value FROM json_each(?1))
          AND a.member_id != ?2
          AND m.role != 'guest'
          AND a.ended_at IS NULL
          AND s.is_active = 1
          AND s.category = 'regional_rep'`,
    )
    .bind(JSON.stringify(regions), memberId)
    .all<{ region: string; name: string; seat: string; member_id: string }>()
  const byRegion = new Map<string, Array<{ name: string; seat: string }>>(regions.map((r) => [r, []]))
  for (const row of results ?? []) byRegion.get(row.region)?.push({ name: row.name, seat: row.seat })
  return regions.map((region) => ({
    region,
    keepers: (byRegion.get(region) ?? []).sort((a, b) => byText(a.name, b.name) || byText(a.seat, b.seat)),
  }))
}

function byText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  if (!CLUB_KEEPERS_ON) return errorResponse(REGION_CLOSED, 403)

  const authResult = await requireAuthedMember(context.request, context.env)
  if (isResponse(authResult)) return authResult
  const { member } = authResult
  if (member.role === 'guest') return errorResponse(REGION_FOR_SEATS, 403)

  const db = context.env.DB
  const isAdmin = member.role === 'lca_admin'
  const seats = await seatRegionsOf(db, member.id)
  if (!isAdmin && seats.length === 0) return errorResponse(REGION_FOR_SEATS, 403)

  const rows = await clubsFor(db, member)
  const ids = rows.map((r) => r.id)
  // While REGION_EVENTS_ON is set the person runs every event of the clubs
  // they keep (canManageTournament), drafts among them, so each is counted;
  // and the events in LCA review are counted for each club, by one query more.
  const regionEvents = REGION_EVENTS_ON
  const counts = await eventCounts(db, ids, regionEvents ? ids : ids.filter((id) => !admittedByRegionAlone(member, id)))
  const inReview = regionEvents ? await reviewCounts(db, ids) : null
  const now = Date.now()
  const cards: RegionClub[] = sortRegionCards(rows.map((row) => ({
    id: row.id,
    name: row.name,
    city: row.city,
    region: row.region || null,
    color: row.color,
    logoUrl: row.image_url,
    statement: row.how_we_meet_text,
    lastConfirmedAt: row.last_confirmed_at,
    lastCheckWords: checkWords(row.last_confirmed_at, now),
    needsCheck: needsCheck(row.last_confirmed_at, now),
    events: counts.get(row.id) ?? 0,
    openItems: [],
    ...(inReview ? { inReview: inReview.get(row.id) ?? 0 } : {}),
  })))

  // The regions the seats cover, an empty one among them, and for an LCA admin every region a club is in.
  const regions = new Set<string>()
  for (const seat of seats) if (seat.region) regions.add(seat.region)
  if (isAdmin) for (const card of cards) if (card.region) regions.add(card.region)

  const answer: WorkspaceRegionResponse = {
    clubs: cards,
    thisMonth: { nextCheck: nextCheckWords(now), ...checkCounts(cards) },
    regions: await keepersOf(db, [...regions].sort(byText), member.id),
  }
  // This month's count of the events in LCA review, only while REGION_EVENTS_ON is set.
  if (inReview) answer.thisMonth.inReview = [...inReview.values()].reduce((sum, n) => sum + n, 0)
  return jsonResponse(answer)
}
