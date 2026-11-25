// functions/utils/clubs/suggestions.ts
//
// Suggest an update (WS09 step 28): what a visitor sends from a club's page
// to say its listing is out of date, saved as a row of club_reports of the
// kind 'suggestion' (migration 0066) and emailed to whoever keeps the
// listing, by the keepers functions/utils/clubs/routing.ts names, read
// through ./emails.ts:
//   1. the club's rep when it has one;
//   2. else each representative whose seat covers the club's region;
//   3. else, while that seat is open, each LCA admin.
// When no email at one keeper's address goes (the mail gate refuses a dead
// address, or the service does not take it), the next keepers in the same
// order are written to, as the contact relay does (./relay.ts). The row is
// saved before any email is sent, so a suggestion no address took still
// shows in My region and on the club's pages, and the visitor is told
// "Sent." all the same.
//
// The row holds the least: the club, the kind, which of the six parts (a
// short fixed key), the visitor's words, the address only if one was given,
// and the club's region as it is at that moment, for the step that sends an
// unanswered suggestion on after 14 days. Never a name, a network address, a
// browser's name or a member id, whoever sends it: the endpoint never reads
// the sign-in. Once a keeper resolves the row its address is emptied in the
// same statement (functions/api/admin/clubs/[id]/reports/[reportId].ts).
//
// The address is shown to nobody. A keeper's email says only whether one was
// left. One email goes to each person, so no keeper sees another's address,
// and none goes to the address the visitor typed, even where it is a
// keeper's own. An email that did not go is logged in fixed words alone,
// never in the words its failure carries, since a mail service's refusal may
// name the address it refused.
import { sendEmail, type EmailEnv } from '../email'
import { resolveSiteUrl } from '../site'
import {
  clubRepsOf, keeperOf, lcaAdmins, regionRepresentativesOf, suggestionKeeperEmail, suggestionLink, type Keeper, type SuggestionKeeperKind, type SuggestionReason,
} from './emails'
import { SUGGESTION_FIELDS, suggestionLabel, type SuggestionField, type SuggestionGoesTo } from '../../../domain/clubs/suggestion'
import { wholeDaysSince } from '../../../domain/clubs/regionCards'
import type { OpenSuggestion } from '../../../domain/contracts/clubReports'

/** The one line an email that did not go leaves in the log: fixed words, with no address and nothing the failure said. */
export const SUGGESTION_NOT_SENT_LOG = 'Suggest an update: an email to a keeper was not sent.'

/** The pause between one keeper's email and the next, the pace the relay keeps. */
const SEND_INTERVAL_MS = 400

/** Who keeps the club first, as one word of the page's answer: never who, never an address. */
export async function suggestionGoesTo(db: D1Database, clubId: string): Promise<SuggestionGoesTo> {
  const first = await keeperOf(db, clubId)
  return first.kind === 'admins' ? 'lca' : first.kind
}

/** The club a suggestion is for, as the endpoint found it. */
export interface SuggestionClub {
  id: string
  slug: string | null
  name: string
  region: string | null
}

/** What the visitor sent, after the contract's check: the address is null when none was given. */
export interface Suggestion {
  field: SuggestionField
  message: string
  email: string | null
}

type SuggestionEnv = EmailEnv & { DB: D1Database; SITE_URL?: string }

/**
 * Where a keeper of each kind answers on the site. Drawn in ./emails.ts since WS09 step 29, so the email of the 14 days
 * (./reportClock.ts) links the same way, and named here as before.
 */
export { suggestionLink }

/** Writes the row and answers its id. */
async function saveRow(db: D1Database, club: SuggestionClub, suggestion: Suggestion): Promise<number> {
  const row = await db.prepare(
    `INSERT INTO club_reports (club_id, kind, field, message, region, reporter_email)
     VALUES (?, 'suggestion', ?, ?, ?, ?)
     RETURNING id`,
  )
    .bind(club.id, suggestion.field, suggestion.message, club.region, suggestion.email)
    .first<{ id: number }>()
  return Number(row!.id)
}

/**
 * Saves the suggestion and emails the club's keepers, in the order above.
 * Answers how many emails went, which the visitor is never told. Never
 * throws for a failed send; a failed write is not caught, and the endpoint
 * answers it as any fault, with nothing sent.
 */
export async function saveSuggestion(env: SuggestionEnv, request: Request, club: SuggestionClub, suggestion: Suggestion): Promise<number> {
  const rowId = await saveRow(env.DB, club, suggestion)
  const siteUrl = resolveSiteUrl(env, request)
  const typed = suggestion.email?.trim().toLowerCase() ?? ''
  // Each address is tried once, whichever keeper it belongs to, and the visitor's own is never tried.
  const tried = new Set<string>(typed ? [typed] : [])
  let sends = 0
  let sent = 0

  // Set once the order of keepers is read below: whether the admins are the club's first keepers or the last resort.
  let reason: SuggestionReason = 'no_keeper'

  const sendTo = async (person: Keeper, kind: SuggestionKeeperKind): Promise<boolean> => {
    const key = person.email.trim().toLowerCase()
    if (tried.has(key)) return false
    tried.add(key)
    if (sends++ > 0) await new Promise((resolve) => setTimeout(resolve, SEND_INTERVAL_MS))
    const mail = suggestionKeeperEmail({
      siteUrl,
      clubName: club.name,
      region: club.region,
      kind,
      reason,
      choice: suggestionLabel(suggestion.field),
      message: suggestion.message,
      hasAddress: suggestion.email !== null,
      link: suggestionLink(siteUrl, club, kind, rowId),
    })
    try {
      // The reply-to is left to sendEmail, LCA's own: never the visitor's.
      await sendEmail(env, { ...mail, to: person.email })
      sent++
      return true
    } catch {
      // The failure's own words are not logged: a service's refusal may name the address it refused.
      console.warn(SUGGESTION_NOT_SENT_LOG)
      return false
    }
  }

  const sendToEach = async (people: Keeper[], kind: SuggestionKeeperKind): Promise<boolean> => {
    let any = false
    for (const person of people) if (await sendTo(person, kind)) any = true
    return any
  }

  // Who keeps the club first, then each keeper after it in the same order, only while no address has taken one.
  const first = await keeperOf(env.DB, club.id)
  const tiers: Array<[SuggestionKeeperKind, () => Promise<Keeper[]>]> = [
    ['club_rep', () => clubRepsOf(env.DB, club.id)],
    ['region', () => regionRepresentativesOf(env.DB, club.id)],
    ['lca', () => lcaAdmins(env.DB)],
  ]
  const start = first.kind === 'club_rep' ? 0 : first.kind === 'region' ? 1 : 2
  reason = start === 2 ? 'no_keeper' : 'unreachable'
  for (let i = start; i < tiers.length; i++) {
    const [kind, read] = tiers[i]
    const people = i === start ? first.people : await read()
    if (await sendToEach(people, kind)) break
  }
  return sent
}

/** One open suggestion's row, as read for the keeper's pages. */
interface OpenRow {
  id: number
  club_id: string
  field: string
  message: string
  has_address: number
  created_at: string
  escalated_at: string | null
}

/**
 * The open suggestions of each club named, oldest first, as the keeper's
 * pages read them: never the address, only whether one was left, the age
 * in whole days against `nowMs`, the one time the answer is read against,
 * and when it was passed on after 14 days, only once it was (WS09 step 29).
 * A club with none is not in the map.
 */
export async function openSuggestionsOf(db: D1Database, clubIds: readonly string[], nowMs: number): Promise<Map<string, OpenSuggestion[]>> {
  const byClub = new Map<string, OpenSuggestion[]>()
  if (clubIds.length === 0) return byClub
  const { results } = await db.prepare(
    `SELECT id, club_id, field, message, reporter_email IS NOT NULL AND TRIM(reporter_email) <> '' AS has_address, created_at, escalated_at
       FROM club_reports
      WHERE club_id IN (SELECT value FROM json_each(?))
        AND kind = 'suggestion' AND status = 'open'
      ORDER BY created_at, id`,
  )
    .bind(JSON.stringify(clubIds))
    .all<OpenRow>()
  for (const row of results ?? []) {
    const list = byClub.get(row.club_id) ?? []
    list.push({
      kind: 'suggestion',
      id: Number(row.id),
      // A key the six do not hold, which no write of this step makes, reads as Something else.
      field: (SUGGESTION_FIELDS as readonly string[]).includes(row.field) ? row.field as SuggestionField : 'other',
      message: row.message,
      hasAddress: Number(row.has_address) === 1,
      ageDays: wholeDaysSince(row.created_at, nowMs),
      // When it was passed on to the LCA admins after 14 days (./reportClock.ts), and only once it was, so a row not
      // passed on reads as before.
      ...(row.escalated_at ? { passedOnAt: row.escalated_at } : {}),
    })
    byClub.set(row.club_id, list)
  }
  return byClub
}

/** Whether the club has a suggestion no keeper has answered yet: Still accurate waits while it does. */
export async function hasOpenSuggestion(db: D1Database, clubId: string): Promise<boolean> {
  const row = await db.prepare(
    `SELECT 1 FROM club_reports WHERE club_id = ? AND kind = 'suggestion' AND status = 'open' LIMIT 1`,
  ).bind(clubId).first()
  return !!row
}
