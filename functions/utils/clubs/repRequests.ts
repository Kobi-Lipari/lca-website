// functions/utils/clubs/repRequests.ts
//
// Ask to be its named rep (WS09 step 31): a signed-in member's request to be
// named a club's rep, saved as a row of club_rep_requests (migration 0066:
// the club, the member, the connection, the note, and the outcome once a
// keeper decides) and emailed to the keepers who may decide it, by the
// people functions/utils/clubs/routing.ts names, read through ./emails.ts:
//   - each representative whose seat covers the club's region
//     (regionRepresentativesOf), and
//   - each LCA admin (lcaAdmins),
// one email to each person, a person in both written to once, a guest never
// (the seat rule in ./routing.ts), and never the member who asked, even when
// they are a keeper themselves.
//
// One open request for a member and a club is held by the insert's own
// statement: it writes only when no open row of that member and club stands,
// so of two sends at once one row is written and the other is told in words.
// The row is saved before any email goes, so a request no address took is
// saved all the same and shows on the keepers' rows. The row holds the least:
// the club, the member's id, the connection's key and the note, never a
// network address or a browser's name.
//
// The email names neither the member nor their address: both are on the
// row, for the keeper who signs in. An email that did not go is logged in
// fixed words alone, never in the words its failure carries, since a mail
// service's refusal may name the address it refused.
//
// The rows (openRepRequests) are read here too, for My region and for a club
// in My region: each with the words its keeper's buttons need, built by the
// rules in domain/clubs/repRequest.ts.
import type { MemberRow } from '../../types'
import { sendEmail, type EmailEnv } from '../email'
import { isRegionalRepFor } from '../admin/permissions'
import { resolveSiteUrl } from '../site'
import { clubRepsOf, lcaAdmins, regionRepresentativesOf, repRequestKeeperEmail, repRequestLink, type Keeper, type RepRequestReason } from './emails'
import { CLUB_PAGES_ON } from './pages'
import {
  accountClubWords, adminsDecideRow, connectionWords, movesWords, nameQuestion, neverNamed, replacesWords, type RepConnection,
} from '../../../domain/clubs/repRequest'
import { formatDate } from '../../../domain/format/date'
import type { RepRequestRow } from '../../../domain/contracts/clubRepRequests'

/** The one line an email that did not go leaves in the log: fixed words, with no address and none of the member's words. */
export const REP_REQUEST_NOT_SENT_LOG = 'Ask to be its named rep: an email to a keeper was not sent.'

/** The pause between one keeper's email and the next, the pace the relay keeps. */
const SEND_INTERVAL_MS = 400

/** The admins' set in the endpoint's count of keepers: no region takes this name. */
export const REP_REQUEST_ADMINS_KEY = 'lca'

type RepRequestEnv = EmailEnv & { DB: D1Database; SITE_URL?: string }

/** The club a request is for, as the endpoint found it. */
export interface RepRequestClub {
  id: string
  name: string
  region: string | null
}

/**
 * Who the keepers' count is counted as: the club's region while someone holds its seat, and the LCA admins otherwise.
 * Never told to the member.
 */
export async function repRequestGoesTo(db: D1Database, club: RepRequestClub): Promise<string> {
  if (!club.region) return REP_REQUEST_ADMINS_KEY
  return (await regionRepresentativesOf(db, club.id)).length > 0 ? club.region : REP_REQUEST_ADMINS_KEY
}

/** Whether the club has a named rep, by the routing's own rule (clubRepsOf), the one the page's invitation reads. */
export async function clubHasRep(db: D1Database, clubId: string): Promise<boolean> {
  return (await clubRepsOf(db, clubId)).length > 0
}

/** Whether the member already has an open request for the club: read for the refusal's words alone. */
export async function hasOpenRepRequest(db: D1Database, clubId: string, memberId: string): Promise<boolean> {
  const row = await db.prepare(`SELECT 1 FROM club_rep_requests WHERE club_id = ? AND member_id = ? AND status = 'open' LIMIT 1`)
    .bind(clubId, memberId).first()
  return !!row
}

/**
 * Writes the request when no open one of the member and the club stands, in one statement, and answers its id, or
 * null when one stands already (two sends at once: the second is told in words).
 */
async function saveRow(db: D1Database, clubId: string, memberId: string, connection: RepConnection, note: string | null): Promise<number | null> {
  const row = await db.prepare(
    `INSERT INTO club_rep_requests (club_id, member_id, connection, note)
     SELECT ?1, ?2, ?3, ?4
      WHERE NOT EXISTS (SELECT 1 FROM club_rep_requests WHERE club_id = ?1 AND member_id = ?2 AND status = 'open')
     RETURNING id`,
  )
    .bind(clubId, memberId, connection, note)
    .first<{ id: number }>()
  return row ? Number(row.id) : null
}

/**
 * Saves the request and emails its keepers. Answers null when an open request of the member and the club stood
 * already, with nothing sent; else how many emails went, which the member is never told. Never throws for a failed
 * send; a failed write is not caught.
 */
export async function saveRepRequest(
  env: RepRequestEnv,
  request: Request,
  club: RepRequestClub,
  member: Pick<MemberRow, 'id' | 'email'>,
  sent: { connection: RepConnection; note: string },
): Promise<number | null> {
  const note = sent.note.trim()
  const rowId = await saveRow(env.DB, club.id, member.id, sent.connection, note === '' ? null : note)
  if (rowId === null) return null
  const siteUrl = resolveSiteUrl(env, request)
  const link = repRequestLink(siteUrl, rowId)
  const own = member.email.trim().toLowerCase()

  // The region's representatives first, then each admin; each person once, by id and by address, never the member.
  const people: Array<{ person: Keeper; reason: RepRequestReason }> = []
  const ids = new Set<string>([member.id])
  const addresses = new Set<string>(own ? [own] : [])
  const add = (list: Keeper[], reason: RepRequestReason) => {
    for (const person of list) {
      const address = person.email.trim().toLowerCase()
      if (ids.has(person.id) || addresses.has(address)) continue
      ids.add(person.id)
      addresses.add(address)
      people.push({ person, reason })
    }
  }
  add(await regionRepresentativesOf(env.DB, club.id), 'region')
  add(await lcaAdmins(env.DB), 'admin')

  let delivered = 0
  for (const [i, { person, reason }] of people.entries()) {
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, SEND_INTERVAL_MS))
    const mail = repRequestKeeperEmail({
      siteUrl, reason, region: club.region, clubName: club.name, connection: connectionWords(sent.connection), note, link,
    })
    try {
      // The reply-to is left to sendEmail, LCA's own: never the member's.
      await sendEmail(env, { ...mail, to: person.email })
      delivered++
    } catch {
      // The failure's own words are not logged: a service's refusal may name the address it refused.
      console.warn(REP_REQUEST_NOT_SENT_LOG)
    }
  }
  return delivered
}

interface OpenRow {
  id: number
  club_id: string
  club_name: string
  full_name: string
  email: string
  role: string
  member_club: string | null
  member_club_name: string | null
  connection: string
  note: string | null
  created_at: string
}

/** Who reads the rows: an LCA admin every club's, a holder of a seat those of the regions the seat covers. */
export interface RepRequestReader {
  member: Pick<MemberRow, 'id' | 'role' | 'club_id'>
  all: boolean
  regions: readonly string[]
  /** One club's requests alone, for a club in My region. */
  clubId?: string
}

/**
 * The open requests a keeper may decide, oldest first: never the keeper's own, and never one of the club whose rep
 * the keeper is. Each with the words its row draws: the question Name as rep asks, with what naming replaces or
 * moves, and, in place of Name as rep, why this keeper cannot name the member.
 */
export async function openRepRequests(db: D1Database, reader: RepRequestReader): Promise<RepRequestRow[]> {
  if (!reader.all && reader.regions.length === 0) return []
  const { member } = reader
  const { results } = await db.prepare(
    `SELECT q.id, q.club_id, c.name AS club_name, m.full_name, m.email, m.role, m.club_id AS member_club,
            oc.name AS member_club_name, q.connection, q.note, q.created_at
       FROM club_rep_requests q
       JOIN clubs c        ON c.id = q.club_id
       JOIN members m      ON m.id = q.member_id
       LEFT JOIN clubs oc  ON oc.id = m.club_id
      WHERE q.status = 'open'
        AND q.member_id <> ?1
        AND (?2 IS NULL OR q.club_id = ?2)
        AND (?3 = 1 OR c.region IN (SELECT value FROM json_each(?4)))
        AND NOT (?5 = 'club_rep' AND c.id = ?6)
      ORDER BY q.created_at, q.id`,
  )
    .bind(member.id, reader.clubId ?? null, reader.all ? 1 : 0, JSON.stringify(reader.regions), member.role, member.club_id ?? '')
    .all<OpenRow>()
  const isAdmin = member.role === 'lca_admin'
  return (results ?? []).map((row) => {
    const name = row.full_name
    const otherClub = row.member_club && row.member_club !== row.club_id ? row.member_club_name : null
    let question = nameQuestion(name, row.club_name)
    // With the club pages on no page shows a roster, so the sentence names the member's account instead.
    const moves = CLUB_PAGES_ON ? accountClubWords : movesWords
    if (row.role === 'member' && otherClub) question = `${question} ${moves(name, otherClub, row.club_name)}`
    else if (row.role !== 'member' && isAdmin) question = `${question} ${replacesWords(name, row.role, otherClub)}`
    const noName = neverNamed(name, row.role) ?? (row.role !== 'member' && !isAdmin ? adminsDecideRow(name, row.role, otherClub) : null)
    return {
      id: Number(row.id),
      clubId: row.club_id,
      clubName: row.club_name,
      memberName: name,
      memberEmail: row.email.trim(),
      connection: row.connection as RepConnection,
      note: row.note ?? '',
      sentOn: formatDate(row.created_at, { stored: 'utc' }),
      memberRole: row.role,
      nameQuestion: question,
      noName,
    }
  })
}

/**
 * One club's open requests for a club in My region, GET /api/admin/clubs/[id]: only to a keeper who may decide them,
 * an LCA admin or a holder of the club's regional seat who is not a guest and not the club's own rep; everyone else
 * the club's GET admits (an observer, the club's own rep) gets none. Asks who may only when a request is open, so a
 * club with none costs one statement.
 */
export async function repRequestsFor(db: D1Database, member: MemberRow, clubId: string): Promise<RepRequestRow[]> {
  const any = await db.prepare(`SELECT 1 FROM club_rep_requests WHERE club_id = ? AND status = 'open' LIMIT 1`).bind(clubId).first()
  if (!any) return []
  if (member.role === 'guest' || (member.role === 'club_rep' && member.club_id === clubId)) return []
  if (member.role !== 'lca_admin' && !(await isRegionalRepFor(db, member.id, clubId))) return []
  return openRepRequests(db, { member, all: true, regions: [], clubId })
}
