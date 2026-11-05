// functions/utils/events/publishedReview.ts
//
// D22's notice: a standing director's event lists the moment it is
// published, and the LCA admins are told after the fact, once per event, by
// one email to each of them. The mark, tournaments.review_notified_at, is
// set by the one statement that decides the send, so two publishes at the
// same moment send once, and an event unpublished and published again sends
// nothing more. The setup save calls sendPublishedReviewNotice at a first
// publish by hand while CREATION_ROLES_ON is set; the console part's
// scheduled publish will call it too.
//
// It imports five files and nothing else: the email transport and its
// layout, the database half of the creation rules, the site's address and
// the date format. It never imports functions/utils/response.ts,
// functions/utils/admin/members.ts, whose sign-in client would reach a
// worker's bundle, or anything under functions/api or domain/contracts, so
// the console part's five-minute phase can import it. The daily-emails
// worker does not import it yet: test/unit/published-review-closure.test.ts
// holds the worker's imports to that.

import { trySendEmail, type EmailEnv, type EmailMessage } from '../email'
import { emailDetails, p, renderEmail } from '../emailLayout'
import { CREATION_ROLES_ON, creatorGrant } from './creation'
import { resolveSiteUrl } from '../site'
import { formatDate } from '../../../domain/format/date'

/**
 * Sets the mark on a published event that has none, in one statement, and
 * answers whether this call set it. The statement is the decision: of two
 * writers at the same moment only one changes the row, and an event whose
 * mark is already set, or that is hidden again, changes nothing.
 */
export async function markReviewNotified(db: D1Database, tournamentId: string): Promise<boolean> {
  const result = await db
    .prepare("UPDATE tournaments SET review_notified_at = datetime('now') WHERE id = ? AND is_visible = 1 AND review_notified_at IS NULL")
    .bind(tournamentId)
    .run()
  return result.meta.changes === 1
}

/**
 * Whether the event's creator holds the standing director grant now, with
 * CREATION_ROLES_ON read at the call. An event whose creator holds an LCA
 * admin's, the president's or a club rep's grant now, one with no creator,
 * and one whose creator has lost the role since all answer false, and with
 * the constant unset every event does. The grant is read now and not as it
 * was at the create, so an event whose creator has become a standing
 * director since answers true.
 */
export async function creatorIsStandingDirector(db: D1Database, tournamentId: string): Promise<boolean> {
  return (await creatorGrant(db, tournamentId, CREATION_ROLES_ON)) === 'standing_director'
}

/**
 * An event's days as the notice writes them, a weekday on each: "Sat, Dec 5,
 * 2026" for one day, with no end date or one equal to the start; "Sat, Dec 5
 * to Sun, Dec 6, 2026" for more, the start with its own year as well when the
 * years differ, "Thu, Dec 31, 2026 to Fri, Jan 1, 2027". formatEventDate in
 * functions/utils/emailLayout.ts is not used here: its two-day form has no
 * weekday and joins the days with a dash.
 */
export function eventDays(date: string, endDate: string | null): string {
  const first = formatDate(date, { year: true })
  const last = endDate ? formatDate(endDate, { year: true }) : first
  if (last === first) return first
  const yearOf = (day: string) => /, (\d{4})$/.exec(day)?.[1]
  return `${yearOf(first) === yearOf(last) ? formatDate(date) : first} to ${last}`
}

/**
 * The pause between one admin's email and the next. Resend limits how fast
 * its API may be called, and a send it refuses for that is not tried again
 * here, so the notice keeps to the pace functions/utils/admin/campaigns.ts
 * sends the group email at. Nothing waits before the first email.
 */
const SEND_INTERVAL_MS = 400

/** The event and its creator's name, as the email reads them. */
interface NoticeEvent {
  id: string
  name: string
  date: string
  end_date: string | null
  full_name: string
}

/**
 * The email, built here with the shared layout rather than in
 * functions/utils/email.ts, which the daily-emails worker bundles. Its `to`
 * is empty, as every template's is, and is filled for each admin.
 */
function publishedReviewEmail(siteUrl: string, event: NoticeEvent): EmailMessage {
  const by = `${event.full_name}, standing director`
  const when = eventDays(event.date, event.end_date)
  const url = `${siteUrl}/admin/tournaments/${encodeURIComponent(event.id)}`
  const afterTheFact = "After the fact: nothing holds a standing director's event. It is already listed. Look it over when you can."
  return {
    to: '',
    subject: `Published by ${by}: ${event.name} (${when})`,
    html: renderEmail({
      siteUrl,
      heading: 'A standing director published an event',
      body: emailDetails([
        ['Published by', by],
        ['Event', event.name],
        ['When', when],
        ['Listed', 'now, on Tournaments'],
      ]) + p(afterTheFact),
      cta: { label: 'Look it over', url },
    }),
    text: [
      'A standing director published an event.',
      '',
      `Published by: ${by}`,
      `Event: ${event.name}`,
      `When: ${when}`,
      'Listed: now, on Tournaments',
      '',
      afterTheFact,
      '',
      `Look it over: ${url}`,
    ].join('\n'),
  }
}

/**
 * D22's notice for one event. When the event's creator holds the standing
 * director grant now and this call sets the mark, it sends one email to each
 * LCA admin's address, never one message to several, so no admin sees
 * another's address (functions/utils/admin/tickets.ts sends a seat's holders
 * one each for the same reason); two admin rows that share an address get
 * one. notified is whether this call set the mark, and is false as well when
 * the creator is not a standing director, since the mark is then never
 * tried; sent is how many emails went. The mark is set before the first
 * email and a failed send is not tried again, so an event is never announced
 * twice, and an email outage leaves the mark set. The emails go one at a
 * time, SEND_INTERVAL_MS apart, so a publish's answer waits that long for
 * each admin after the first. With CREATION_ROLES_ON unset no creator holds
 * the grant, so nothing is marked or sent.
 *
 * Never throws. The setup save calls it once its own writes have landed, and
 * a failure here must not turn a publish that worked into a 500: the event
 * would be listed with no row in the activity log, and the same publish sent
 * again would find it listed and do nothing. An error from any statement it
 * runs is logged for the Worker tail and swallowed, and the answer says what
 * had happened by then: notified false until the mark's statement has
 * answered that it set the mark, so after a failure before then the next
 * publish tries the mark again, and true from then on, with the emails that
 * had gone.
 */
export async function sendPublishedReviewNotice(
  env: EmailEnv & { DB: D1Database; SITE_URL?: string },
  tournamentId: string,
): Promise<{ notified: boolean; sent: number }> {
  let notified = false
  let sent = 0
  try {
    if (!(await creatorIsStandingDirector(env.DB, tournamentId))) return { notified: false, sent: 0 }
    if (!(await markReviewNotified(env.DB, tournamentId))) return { notified: false, sent: 0 }
    notified = true

    const event = await env.DB
      .prepare('SELECT t.id, t.name, t.date, t.end_date, m.full_name FROM tournaments t JOIN members m ON m.id = t.created_by WHERE t.id = ?')
      .bind(tournamentId)
      .first<NoticeEvent>()
    if (!event) return { notified, sent }

    const { results: admins } = await env.DB
      .prepare("SELECT email, full_name FROM members WHERE role = 'lca_admin' AND email LIKE '%@%' ORDER BY email")
      .all<{ email: string; full_name: string }>()
    const addresses = new Map<string, string>()
    for (const admin of admins) {
      const address = admin.email.trim()
      if (!addresses.has(address.toLowerCase())) addresses.set(address.toLowerCase(), address)
    }

    const message = publishedReviewEmail(resolveSiteUrl(env), event)
    let index = 0
    for (const to of addresses.values()) {
      if (index++ > 0) await new Promise((resolve) => setTimeout(resolve, SEND_INTERVAL_MS))
      if (await trySendEmail(env, { ...message, to })) sent++
    }
  } catch (err) {
    console.warn(
      `published review notice failed for ${tournamentId} (${notified ? 'after' : 'before'} the mark, ${sent} sent):`,
      err instanceof Error ? err.message : String(err),
    )
  }
  return { notified, sent }
}
