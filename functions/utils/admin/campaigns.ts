// functions/utils/admin/campaigns.ts
//
// Group email's sender, and the LCA newsletter's (WS16). Today's path sends
// a campaign as it always has. Under the mail engine's rules
// (engineRulesOn() in ../mail/rules) every campaign takes the rules path
// instead, and a campaign that names a list (email_campaigns.list_id) takes
// it whatever the constants say: the row decides, so a revert of the change
// that switches the newsletter on, or a worker running this file whose
// deploy lags the site's, can never send the rest of a newsletter the old
// way, without its footer, its headers and its gate. A worker still on the
// code from before WS16 step 4 takes a campaign's rows by their status
// alone, so the newsletter is switched on only once the worker runs this
// file. Under the rules no message is sent twice: a row is marked just
// before its send and never claimed again once marked; an answer that does
// not prove the service refused the message is never tried again; and an
// answer that proves it (a throttle, an account on hold, a key fault) ends
// the run and puts the untried rows back. The sizes are ../mail/plan's, by
// the hosting plan.
import { LIST_SENDERS } from '../../../domain/mail/addresses'
import { listFooterWords } from '../../../domain/mail/footer'
import { DEFAULT_FROM, DEFAULT_REPLY_TO } from '../email'
import { renderEmail } from '../emailLayout'
import { listMailParts } from '../mail/footer'
import { GATE_UNREAD_LOG, GateUnread, openGate, openLoopGate, type MailGate } from '../mail/gate'
import { linkKeyCheck, MailLinkKeyMissing } from '../mail/links'
import { classifyOnce, classifyToday, configFault, type OutcomeKind } from '../mail/outcome'
import { sizes } from '../mail/plan'
import { engineRulesOn } from '../mail/rules'
import { deliver, GATE_UNREAD_WORDS, type MailHeader, type OutgoingMail, type SendResult } from '../mail/send'
import { resolveSiteUrl, type SiteEnv } from '../site'

/**
 * The bindings the campaign send path needs.
 *
 * Same trick as EmailEnv in ./email: both the Pages Functions Env and the
 * cron Worker Env satisfy this structurally, so the sweep can live here and
 * be called from either side without the two learning about each other.
 * The two link keys are read for list mail only: the key its links are
 * signed with, and while it is being changed, the one before it. The two
 * keys of Amazon SES are read by its transport, once it sends.
 */
export interface CampaignEnv extends SiteEnv {
  DB: D1Database
  RESEND_API_KEY: string
  FROM_EMAIL?: string
  REPLY_TO_EMAIL?: string
  MAIL_LINK_SECRET?: string
  MAIL_LINK_SECRET_PREVIOUS?: string
  SES_ACCESS_KEY_ID?: string
  SES_SECRET_ACCESS_KEY?: string
}

export interface CampaignFilter {
  all?: boolean
  roles?: string[]
  clubIds?: string[]
  membershipStatuses?: string[]
}

export interface ResolvedRecipient {
  id: string
  email: string
  full_name: string
}

async function getAllMembers(db: D1Database): Promise<Array<ResolvedRecipient & { guardian_id: string | null }>> {
  const { results } = await db
    .prepare(`SELECT id, email, full_name, guardian_id FROM members ORDER BY full_name ASC`)
    .all<ResolvedRecipient & { guardian_id: string | null }>()
  return results ?? []
}

/**
 * Builds and runs the WHERE clause for a filter. AND across categories, OR
 * within each category.
 *
 * Leaving every category empty (the default, collapsed state of all three
 * filter dropdowns — same convention as the Tournaments/Clubs pages) means
 * "no restriction," i.e. everyone. `filter.all` is kept as an explicit
 * override for callers that want to say so directly, but the two paths
 * converge on the same result.
 */
/**
 * One email per address. A child's profile (family accounts) carries its
 * parent's email, so a family of four would otherwise get four copies.
 * Keeps the first row for each address — ordering is by name, and the
 * parent's own row wins when both match.
 */
function onePerAddress(rows: Array<ResolvedRecipient & { guardian_id?: string | null }>): ResolvedRecipient[] {
  const sorted = [...rows].sort((a, b) => Number(!!a.guardian_id) - Number(!!b.guardian_id))
  const seen = new Set<string>()
  const kept = new Set<string>()
  for (const r of sorted) {
    const key = r.email.trim().toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    kept.add(r.id)
  }
  return rows.filter((r) => kept.has(r.id)).map(({ id, email, full_name }) => ({ id, email, full_name }))
}

export async function resolveRecipients(
  db: D1Database,
  filter: CampaignFilter,
): Promise<ResolvedRecipient[]> {
  return onePerAddress(await resolveRecipientRows(db, filter))
}

async function resolveRecipientRows(
  db: D1Database,
  filter: CampaignFilter,
): Promise<Array<ResolvedRecipient & { guardian_id?: string | null }>> {
  if (filter.all) return getAllMembers(db)

  const clauses: string[] = []
  const binds: unknown[] = []

  if (filter.roles?.length) {
    clauses.push(`role IN (${filter.roles.map(() => '?').join(', ')})`)
    binds.push(...filter.roles)
  }
  if (filter.clubIds?.length) {
    clauses.push(`club_id IN (${filter.clubIds.map(() => '?').join(', ')})`)
    binds.push(...filter.clubIds)
  }
  if (filter.membershipStatuses?.length) {
    clauses.push(`membership_status IN (${filter.membershipStatuses.map(() => '?').join(', ')})`)
    binds.push(...filter.membershipStatuses)
  }

  // No category selected on any axis — dropdowns all at their collapsed
  // defaults — means unrestricted, matching how the Tournaments/Clubs
  // filter dropdowns behave when left untouched.
  if (clauses.length === 0) return getAllMembers(db)

  const sql = `SELECT id, email, full_name, guardian_id FROM members WHERE ${clauses.join(' AND ')} ORDER BY full_name ASC`
  const { results } = await db.prepare(sql).bind(...binds).all<ResolvedRecipient & { guardian_id: string | null }>()
  return results ?? []
}

// ── Branded template ─────────────────────────────────────────────────────────
// Group email uses the same layout as every other email the site sends
// (utils/emailLayout). There's no fixed button: the admin's own message,
// including any links they add in the editor, is the body.

export function wrapBrandedEmail(
  env: SiteEnv,
  subject: string,
  bodyHtml: string,
  /** One person's footer on a list (listMailParts in ../mail/footer); without it the page is today's, byte for byte. */
  listFooter?: string,
): string {
  return renderEmail({
    siteUrl: resolveSiteUrl(env),
    heading: subject,
    body: bodyHtml,
    ...(listFooter === undefined ? {} : { listFooter }),
  })
}

// ── Sending ───────────────────────────────────────────────────────────────────

/**
 * How many recipients the request path sends before handing off.
 *
 * Kept small on purpose. This work runs in waitUntil() on the admin request
 * that created the campaign, and waitUntil is the least durable place in the
 * system — the isolate can be evicted out from under it. At the pacing below
 * a full batch is about 16 seconds, so a modest campaign still finishes
 * before the admin has looked away, and anything larger is the sweep's.
 */
const REQUEST_PATH_BATCH = 40

/**
 * How many recipients one cron sweep sends.
 *
 * Much larger, because a scheduled invocation has real headroom and the
 * work is almost entirely waiting on Resend rather than burning CPU. At 150
 * per five-minute run, a stalled send of any size the LCA actually has
 * finishes on the next sweep rather than trickling out over an hour.
 */
const SWEEP_BATCH = 150

/** A claim older than this is assumed to belong to a run that died. */
const CLAIM_TIMEOUT = '-15 minutes'

/** Transient failures are retried by later sweeps, but not forever. */
const MAX_ATTEMPTS = 3

/** Pacing between sends — stays comfortably under Resend's rate limit. */
export const SEND_INTERVAL_MS = 400

type SendOutcome =
  | { ok: true }
  /** Worth another go later: rate limits, upstream 5xx, network errors. */
  | { ok: false; retryable: true; error: string }
  /** Will never succeed: malformed or rejected address, bad payload. */
  | { ok: false; retryable: false; error: string }

/**
 * Sends one campaign email through the mail seam, in the request shape Group
 * email has always sent, and reads the answer as this sender always has:
 * whether a failure is worth another try is classifyToday's rule in
 * ../mail/outcome, and the error keeps the words the recipients' error
 * column and the history show.
 */
async function sendOne(
  env: CampaignEnv,
  to: string,
  subject: string,
  html: string,
): Promise<SendOutcome> {
  // reply_to matters: the From address has no mailbox behind it, so
  // without it every reply to a group email was lost.
  const result = await deliver(env, {
    from: env.FROM_EMAIL ?? DEFAULT_FROM,
    to,
    replyTo: env.REPLY_TO_EMAIL ?? DEFAULT_REPLY_TO,
    subject,
    html,
    shape: 'campaign',
  })
  if (result.ok) return { ok: true }
  // A thrown fetch is a network problem, not a verdict on the address.
  if (result.noAnswer) return { ok: false, retryable: true, error: result.error }
  // Under the mail engine's rules a message can also reach no service, and then carries the seam's own words: the
  // gate's refusal is never tried again, while a gate that could not be read or a call the runtime refused waits for
  // another run.
  if (result.refused) return { ok: false, retryable: false, error: result.error }
  if (result.gateUnread || result.limitRefused) return { ok: false, retryable: true, error: result.error }
  // Amazon SES's answers, and a message for it on a deployment without its keys, carry their own words, which name the
  // service; only Resend's answers take today's form, word for word.
  if (result.fromSes || result.keyMissing) return { ok: false, retryable: classifyToday(result) === 'later', error: result.error }
  return {
    ok: false,
    retryable: classifyToday(result) === 'later',
    error: `Resend ${result.status}: ${result.error}`,
  }
}

/** Sends a single one-off email through the same branded template a real
 *  campaign uses, without touching the campaigns/recipients tables at all —
 *  used by the "send test email" tool so admins can check formatting before
 *  committing to a real send. Not tied to a member; any address works. */
export async function sendTestEmail(
  env: CampaignEnv,
  to: string,
  subject: string,
  bodyHtml: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const html = wrapBrandedEmail(env, subject, bodyHtml)
  const result = await sendOne(env, to, subject, html)
  return result.ok ? { ok: true } : { ok: false, error: result.error }
}

export interface CampaignRunResult {
  /** Handed to Resend successfully on this run. */
  sent: number
  /** Given up on during this run. */
  failed: number
  /** Still pending afterwards — non-zero means a sweep should come back. */
  remaining: number
  /** True once the campaign has no pending recipients left. */
  done: boolean
}

interface ClaimedRecipient {
  id: string
  email: string
  attempts: number
  /** The recipient's mail contact, which a list campaign's links are signed for; null on Group email's rows. */
  contact_id: string | null
}

/**
 * Atomically takes ownership of up to `limit` pending recipients.
 *
 * This is the whole reason a sweep is safe to run alongside the original
 * send. D1 serializes writes, so the UPDATE either claims a row or finds it
 * already claimed — two runs can never come away holding the same recipient
 * and mail somebody twice. Rows whose claim has gone stale are fair game
 * again, which is what lets a killed run's batch be finished by someone else.
 * A row marked sending (sending_at, written under the engine's rules just
 * before its send) is never claimed again, by any run on either path:
 * today's path never marks a row, so it claims exactly what it always did.
 */
async function claimRecipients(
  db: D1Database,
  campaignId: string,
  limit: number,
): Promise<ClaimedRecipient[]> {
  const { results } = await db
    .prepare(
      `UPDATE email_campaign_recipients
          SET claimed_at = datetime('now'), attempts = attempts + 1
        WHERE id IN (
          SELECT id FROM email_campaign_recipients
           WHERE campaign_id = ?1
             AND status = 'pending'
             AND sending_at IS NULL
             AND (claimed_at IS NULL OR claimed_at <= datetime('now', ?2))
           ORDER BY rowid
           LIMIT ?3
        )
        RETURNING id, email, attempts, contact_id`,
    )
    .bind(campaignId, CLAIM_TIMEOUT, limit)
    .all<ClaimedRecipient>()
  return results ?? []
}

/** A campaign as a run reads it: what it says, and the list it goes out on, with the link key's check, for a list campaign. */
interface CampaignRow {
  subject: string
  body_html: string
  list_id: string | null
  filter_json: string | null
}

/** One run of a campaign as the sweep and the request path read it: CampaignRunResult, and whether the whole run must end. */
interface CampaignRun extends CampaignRunResult {
  /**
   * No more sends in this invocation: an answer that proves the service refused for now and that every send would meet
   * (a throttle, an account on hold, a key fault, the limit of outside calls), or the request path's deadline.
   */
  endRun: boolean
}

/**
 * Sends the next batch of pending recipients for a campaign.
 *
 * Deliberately does *not* try to finish the whole campaign in one call. It
 * claims a bounded batch, sends it, and reports what is left; the caller
 * decides whether to come back. Safe to call concurrently with itself — see
 * claimRecipients — and safe to call on a campaign with nothing outstanding,
 * which is what makes the cron sweep harmless when there is no work to do.
 * The batch is `limit` rows, or by default today's 40, and under the
 * engine's rules the request path's size of ../mail/plan.
 */
export async function processCampaign(
  env: CampaignEnv,
  campaignId: string,
  limit?: number,
): Promise<CampaignRunResult> {
  const { sent, failed, remaining, done } = await runCampaign(env, campaignId, limit)
  return { sent, failed, remaining, done }
}

/**
 * One batch of a campaign, on the path its row and the rules decide: a campaign that names a list, or any campaign
 * under the engine's rules, takes the rules path below; any other takes today's, statement for statement as before.
 */
async function runCampaign(
  env: CampaignEnv,
  campaignId: string,
  limit?: number,
  deadline?: number,
): Promise<CampaignRun> {
  const db = env.DB

  const campaign = await db
    .prepare(`SELECT subject, body_html, list_id, filter_json FROM email_campaigns WHERE id = ?`)
    .bind(campaignId)
    .first<CampaignRow>()

  if (!campaign) return { sent: 0, failed: 0, remaining: 0, done: true, endRun: false }

  // The row decides: a list campaign is sent only under the rules, whatever MAIL_LISTS_ON says.
  if (campaign.list_id != null || engineRulesOn()) {
    return runUnderRules(env, campaignId, campaign, limit ?? sizes().requestBatch, deadline)
  }

  const html = wrapBrandedEmail(env, campaign.subject, campaign.body_html)
  const claimed = await claimRecipients(db, campaignId, limit ?? REQUEST_PATH_BATCH)

  let sent = 0
  let failed = 0

  for (const [index, recipient] of claimed.entries()) {
    // Pace between sends, not before the first — an idle wait on a
    // one-recipient batch is pure latency.
    if (index > 0) await new Promise((r) => setTimeout(r, SEND_INTERVAL_MS))

    const result = await sendOne(env, recipient.email, campaign.subject, html)

    if (result.ok) {
      sent++
      await db.batch([
        db
          .prepare(`UPDATE email_campaign_recipients SET status = 'sent', sent_at = datetime('now'), error = NULL WHERE id = ?`)
          .bind(recipient.id),
        db
          .prepare(`UPDATE email_campaigns SET sent_count = sent_count + 1 WHERE id = ?`)
          .bind(campaignId),
      ])
      continue
    }

    if (result.retryable && recipient.attempts < MAX_ATTEMPTS) {
      // Stays pending and goes back in the pool. The error is recorded so a
      // campaign that is quietly struggling is visible before it gives up.
      await db
        .prepare(`UPDATE email_campaign_recipients SET claimed_at = NULL, error = ? WHERE id = ?`)
        .bind(result.error, recipient.id)
        .run()
      continue
    }

    failed++
    await db.batch([
      db
        .prepare(`UPDATE email_campaign_recipients SET status = 'failed', error = ? WHERE id = ?`)
        .bind(result.error, recipient.id),
      db
        .prepare(`UPDATE email_campaigns SET failed_count = failed_count + 1 WHERE id = ?`)
        .bind(campaignId),
    ])
  }

  const remaining = await remainingAfterRun(db, campaignId)
  return { sent, failed, remaining, done: remaining === 0, endRun: false }
}

/** What a campaign has left after a run, and its close once nothing is: two statements, one when something is left. */
async function remainingAfterRun(db: D1Database, campaignId: string): Promise<number> {
  const remainingRow = await db
    .prepare(`SELECT COUNT(*) as count FROM email_campaign_recipients WHERE campaign_id = ? AND status = 'pending'`)
    .bind(campaignId)
    .first<{ count: number }>()
  const remaining = remainingRow?.count ?? 0

  if (remaining === 0) {
    // A campaign where every single send failed is not "completed" in any
    // sense the admin cares about, and the schema already has a status for
    // it. Guarding on status = 'sending' keeps this idempotent, so a sweep
    // arriving late cannot reopen or relabel a finished campaign.
    await db
      .prepare(
        `UPDATE email_campaigns
            SET status = CASE
                  WHEN sent_count = 0 AND failed_count > 0 THEN 'failed'
                  ELSE 'completed'
                END,
                completed_at = datetime('now')
          WHERE id = ? AND status = 'sending'`,
      )
      .bind(campaignId)
      .run()
  }

  return remaining
}

// ── Under the engine's rules ─────────────────────────────────────────────────
//
// The words below go into a recipient's error column, which Group email's
// history shows. None of them names an address.

/** A row written off because its run died between its mark and its outcome: the service may have the message. */
export const WRITTEN_OFF_WORDS = 'Not sent again: the mail service may have taken it, and a second try could send it twice.'

/** A row whose request had no answer, which is never tried again. */
export const NO_CLEAR_ANSWER_WORDS = 'No clear answer from the mail service; not sent again so it cannot arrive twice.'

/** On the next row of a list campaign whose deployment holds another link key than the one the campaign was made with. */
export const LINK_KEY_DIFFERS_WORDS = 'Not sent yet: the link key on this deployment is not the one this email was made with.'

/** On the next row of a list campaign on a deployment with no link key, and on a row the service refused for its key. */
export const MAIL_KEY_MISSING_WORDS = 'Not sent yet: the mail key is missing on this deployment.'

/** On the next row of a list campaign whose list this deployment holds no sender or no footer words for. */
export const NO_LIST_SENDER_WORDS = 'Not sent yet: this deployment has no sender for this list.'

/** A list row with no contact to sign its links for, which the list's own send never writes. */
export const NO_LINK_WORDS = 'Not sent: no unsubscribe link could be made for this address.'

/**
 * The words of a stopped newsletter's row that was not sent, counted in failed_count: each untried row the stop fails
 * (stopListCampaign in ../mail/lists, which gives the words under the same name), and, since WS16 step 7, a row a run
 * puts back on a send the stop has closed. They live here, since the daily-emails worker runs this file and never
 * reaches that one.
 */
export const STOPPED_WORDS = 'Not sent: the send was stopped.'

/**
 * The words a failure is recorded with under the rules. An answer that reached no service carries the seam's own words
 * (a refusal's, list mail held back while Resend sends or while the gate cannot be read, a call the runtime would not
 * make, a message for Amazon SES on a deployment without its keys); a request with no answer, NO_CLEAR_ANSWER_WORDS;
 * an answer from Amazon SES, its own words, which name the service, its status and its code; for Resend, a refusal of
 * the key, MAIL_KEY_MISSING_WORDS; and any other refusal by Resend, its status and its words, as today's
 * "Resend <status>: <body>".
 */
export function wordsUnderRules(result: Exclude<SendResult, { ok: true }>): string {
  if (result.refused || result.gateUnread || result.waitForSes || result.limitRefused || result.keyMissing) return result.error
  if (result.noAnswer) return NO_CLEAR_ANSWER_WORDS
  if (result.fromSes) return result.error
  if (configFault(result)) return MAIL_KEY_MISSING_WORDS
  return result.status === undefined ? result.error : `Resend ${result.status}: ${result.error}`
}

/** The parts of one email on an LCA list for one person, as the seam takes them. */
export interface ListMessage {
  /** The list's own From address and display name, from LIST_SENDERS in domain/mail/addresses.ts. */
  from: string
  fromName: string
  /** Where replies go, as for Group email: REPLY_TO_EMAIL or DEFAULT_REPLY_TO. */
  replyTo: string
  /** List-Unsubscribe, then List-Unsubscribe-Post. */
  headers: MailHeader[]
  /** The page, with the person's own footer under the message. */
  html: string
}

/**
 * One person's email on an LCA list: the list's sender, the page with the person's footer, and the two one-click
 * headers (listMailParts in ../mail/footer), which sign the person's two links. Throws MailLinkKeyMissing without the
 * link key, and an Error for a list with no sender or no footer words, or a contact no link can name.
 */
export async function listMessage(
  env: CampaignEnv,
  args: { listId: string; contactId: string; subject: string; bodyHtml: string },
): Promise<ListMessage> {
  const sender = LIST_SENDERS[args.listId]
  if (!sender) throw new Error('No sender is written for this list.')
  const parts = await listMailParts(env, { contactId: args.contactId, listId: args.listId })
  return {
    from: sender.from,
    fromName: sender.name,
    replyTo: env.REPLY_TO_EMAIL ?? DEFAULT_REPLY_TO,
    headers: parts.headers,
    html: wrapBrandedEmail(env, args.subject, args.bodyHtml, parts.footerHtml),
  }
}

/** The link key's check a list campaign was made with (filter_json's linkCheck), or null when it holds none. */
function linkCheckOf(filterJson: string | null): string | null {
  try {
    const filter = JSON.parse(filterJson ?? 'null') as { linkCheck?: unknown } | null
    return typeof filter?.linkCheck === 'string' ? filter.linkCheck : null
  } catch {
    return null
  }
}

/**
 * Why this deployment cannot send a list campaign, in the words its history shows, or null when it can: the list needs
 * its sender and its footer words here, and this deployment's link key, or the key before it while the key is being
 * changed, must be the one the campaign was made with. A worker whose only key was typed differently from the site's
 * sends nothing. The match on the key before is safe only when a key change sets the site's two keys first and the
 * worker's after: every link is signed under this deployment's MAIL_LINK_SECRET (listMailParts in ../mail/footer),
 * never under the key before, so the site must already read that key. A worker given the new key first, or a new key
 * typed differently beside the right key before, would sign links that do not open for a campaign made under the old
 * key.
 */
async function listFault(env: CampaignEnv, listId: string, filterJson: string | null): Promise<string | null> {
  if (!LIST_SENDERS[listId] || !listFooterWords(listId)) return NO_LIST_SENDER_WORDS
  let current: string
  try {
    current = await linkKeyCheck(env.MAIL_LINK_SECRET)
  } catch (err) {
    if (err instanceof MailLinkKeyMissing) return MAIL_KEY_MISSING_WORDS
    throw err
  }
  const made = linkCheckOf(filterJson)
  if (made !== null && made === current) return null
  if (made !== null && env.MAIL_LINK_SECRET_PREVIOUS && made === (await linkKeyCheck(env.MAIL_LINK_SECRET_PREVIOUS))) return null
  return LINK_KEY_DIFFERS_WORDS
}

/**
 * The two statements that write off a campaign's rows that are marked sending and whose claim has expired: their run
 * died between the mark and the outcome, so the service may have taken the message, and a second try could send it
 * twice. Each is failed with WRITTEN_OFF_WORDS and counted in failed_count.
 */
function writeOff(db: D1Database, campaignId: string): D1PreparedStatement[] {
  const stale = `campaign_id = ?1 AND status = 'pending' AND sending_at IS NOT NULL AND (claimed_at IS NULL OR claimed_at <= datetime('now', ?2))`
  return [
    db
      .prepare(
        `UPDATE email_campaigns SET failed_count = failed_count + (SELECT COUNT(*) FROM email_campaign_recipients WHERE ${stale})
          WHERE id = ?1 AND EXISTS (SELECT 1 FROM email_campaign_recipients WHERE ${stale})`,
      )
      .bind(campaignId, CLAIM_TIMEOUT),
    db.prepare(`UPDATE email_campaign_recipients SET status = 'failed', error = ?3 WHERE ${stale}`).bind(campaignId, CLAIM_TIMEOUT, WRITTEN_OFF_WORDS),
  ]
}

/** The two statements that take the rows the gate refused out of a list campaign, counted in skipped_count and out of the total. */
function skipRefused(db: D1Database, campaignId: string, rows: ClaimedRecipient[]): D1PreparedStatement[] {
  const ids = JSON.stringify(rows.map((r) => r.id))
  const counted = `(SELECT COUNT(*) FROM email_campaign_recipients WHERE id IN (SELECT value FROM json_each(?2)) AND status = 'pending')`
  return [
    db
      .prepare(`UPDATE email_campaigns SET skipped_count = skipped_count + ${counted}, total_recipients = total_recipients - ${counted} WHERE id = ?1`)
      .bind(campaignId, ids),
    db.prepare(`DELETE FROM email_campaign_recipients WHERE id IN (SELECT value FROM json_each(?1)) AND status = 'pending'`).bind(ids),
  ]
}

/** A row's mark, just before its send. Only a row still pending and not marked takes it, so a row a stop failed meanwhile is never sent. */
function markSending(db: D1Database, id: string): D1PreparedStatement {
  return db
    .prepare(`UPDATE email_campaign_recipients SET sending_at = datetime('now') WHERE id = ? AND status = 'pending' AND sending_at IS NULL`)
    .bind(id)
}

/**
 * One statement that puts claimed rows back in the pool, unclaimed and unmarked, each with the attempt the claim counted
 * given back, but for `kept`, the row a service answered later; the words go on `noted`, so the history says why the
 * campaign waits. A row that is no longer pending, such as one a stop failed, is left as it is.
 */
function putBack(db: D1Database, rows: ClaimedRecipient[], opts: { kept?: string; noted?: string; words?: string } = {}): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE email_campaign_recipients
          SET claimed_at = NULL, sending_at = NULL,
              attempts = CASE WHEN id = ?2 THEN attempts ELSE attempts - 1 END,
              error = CASE WHEN id = ?3 THEN ?4 ELSE error END
        WHERE id IN (SELECT value FROM json_each(?1)) AND status = 'pending'`,
    )
    .bind(JSON.stringify(rows.map((r) => r.id)), opts.kept ?? null, opts.noted ?? null, opts.words ?? null)
}

/**
 * The two statements that fail, with STOPPED_WORDS and counted in failed_count, the rows given that are still pending
 * on a campaign whose send a stop has closed: a stopped newsletter's rows a run put back, so the send keeps no pending
 * row and its counts add up. On a campaign that is sending they change nothing.
 */
function failStopped(db: D1Database, campaignId: string, rows: ClaimedRecipient[]): D1PreparedStatement[] {
  const ids = JSON.stringify(rows.map((r) => r.id))
  const pending = `id IN (SELECT value FROM json_each(?2)) AND status = 'pending'`
  return [
    db
      .prepare(`UPDATE email_campaigns SET failed_count = failed_count + (SELECT COUNT(*) FROM email_campaign_recipients WHERE ${pending}) WHERE id = ?1 AND status <> 'sending'`)
      .bind(campaignId, ids),
    db
      .prepare(`UPDATE email_campaign_recipients SET status = 'failed', error = ?3 WHERE ${pending} AND EXISTS (SELECT 1 FROM email_campaigns WHERE id = ?1 AND status <> 'sending')`)
      .bind(campaignId, ids, STOPPED_WORDS),
  ]
}

/**
 * Puts claimed rows back, as putBack does: for Group email's campaigns in its one statement, as before; for a list
 * campaign in one batch with failStopped, so a row put back on a newsletter a stop has closed meanwhile is failed with
 * the stop's words rather than left pending for good, since no run reads a closed send again.
 */
async function putBackRows(
  db: D1Database,
  campaignId: string,
  listId: string | null,
  rows: ClaimedRecipient[],
  opts: { kept?: string; noted?: string; words?: string } = {},
): Promise<void> {
  if (listId == null) {
    await putBack(db, rows, opts).run()
    return
  }
  await db.batch([putBack(db, rows, opts), ...failStopped(db, campaignId, rows)])
}

/**
 * The two statements that write off, with WRITTEN_OFF_WORDS and counted in failed_count, the rows of every list
 * campaign a stop has closed that are still marked sending once their claim has expired: the stop leaves a marked row
 * to its run, and when that run dies between the mark and the outcome no run reads the closed send again, so the sweep
 * does, as the write-off of a sending campaign does in runUnderRules. A row still under a live claim is left to its run.
 */
function writeOffClosed(db: D1Database): D1PreparedStatement[] {
  const stale = (row: string) =>
    `${row}status = 'pending' AND ${row}sending_at IS NOT NULL AND (${row}claimed_at IS NULL OR ${row}claimed_at <= datetime('now', ?1))`
  const closed = `list_id IS NOT NULL AND status <> 'sending'`
  return [
    db
      .prepare(
        `UPDATE email_campaigns
            SET failed_count = failed_count + (SELECT COUNT(*) FROM email_campaign_recipients r WHERE r.campaign_id = email_campaigns.id AND ${stale('r.')})
          WHERE ${closed} AND EXISTS (SELECT 1 FROM email_campaign_recipients r WHERE r.campaign_id = email_campaigns.id AND ${stale('r.')})`,
      )
      .bind(CLAIM_TIMEOUT),
    db
      .prepare(`UPDATE email_campaign_recipients SET status = 'failed', error = ?2 WHERE ${stale('')} AND campaign_id IN (SELECT id FROM email_campaigns WHERE ${closed})`)
      .bind(CLAIM_TIMEOUT, WRITTEN_OFF_WORDS),
  ]
}

/** The words on the next row a run would send, written without claiming it: how a list campaign that cannot go from here says why. */
function noteOnNext(db: D1Database, campaignId: string, words: string): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE email_campaign_recipients SET error = ?2
        WHERE id = (SELECT id FROM email_campaign_recipients WHERE campaign_id = ?1 AND status = 'pending' AND sending_at IS NULL ORDER BY rowid LIMIT 1)`,
    )
    .bind(campaignId, words)
}

/** What came of one send under the rules. */
interface RuledOutcome {
  kind: OutcomeKind
  /** For a row failed or put back: the words its error keeps. */
  words: string
  /** For 'later': an answer every later send would meet too (a throttle, an account on hold, a key fault, the limit), so the run ends. */
  endRun: boolean
  /** For 'later': no service took this row's request as a try (the key's fault, or the message reached none), so its attempt is given back. */
  untried: boolean
}

/** One send under the rules: Group email's message as today's, or a list's with the person's footer, headers and the list's sender. */
async function sendRuled(
  env: CampaignEnv,
  campaign: CampaignRow,
  recipient: ClaimedRecipient,
  html: string,
  gate: MailGate,
): Promise<RuledOutcome> {
  const listId = campaign.list_id
  let mail: OutgoingMail
  if (listId == null) {
    mail = { from: env.FROM_EMAIL ?? DEFAULT_FROM, to: recipient.email, replyTo: env.REPLY_TO_EMAIL ?? DEFAULT_REPLY_TO, subject: campaign.subject, html, shape: 'campaign' }
  } else {
    try {
      if (recipient.contact_id === null) throw new Error('A list row names its contact.')
      const message = await listMessage(env, { listId, contactId: recipient.contact_id, subject: campaign.subject, bodyHtml: campaign.body_html })
      mail = { kind: 'optional', listId, headers: message.headers, from: message.from, fromName: message.fromName, to: recipient.email, replyTo: message.replyTo, subject: campaign.subject, html: message.html, shape: 'campaign' }
    } catch (err) {
      if (err instanceof MailLinkKeyMissing) return { kind: 'later', words: MAIL_KEY_MISSING_WORDS, endRun: false, untried: true }
      return { kind: 'never', words: NO_LINK_WORDS, endRun: false, untried: false }
    }
  }
  const result = await deliver(env, mail, gate)
  if (result.ok) return { kind: 'sent', words: '', endRun: false, untried: false }
  const kind = classifyOnce(result)
  const reachedNone = !!(result.waitForSes || result.gateUnread || result.limitRefused)
  return {
    kind,
    words: wordsUnderRules(result),
    // List mail held back, while Resend sends or while its gate cannot be read, waits on this campaign alone.
    endRun: kind === 'later' && !result.waitForSes && !result.gateUnread,
    untried: kind === 'later' && (reachedNone || configFault(result)),
  }
}

/** What a run under the rules comes to, with what the campaign has left. */
async function finishRun(db: D1Database, campaignId: string, sent: number, failed: number, endRun: boolean): Promise<CampaignRun> {
  const remaining = await remainingAfterRun(db, campaignId)
  return { sent, failed, remaining, done: remaining === 0, endRun }
}

/**
 * One batch under the engine's rules, for Group email's campaigns and, whatever the constants say, every list campaign:
 * a. the campaign's rows marked sending by a run that died are written off, never sent again;
 * b. a list campaign is checked before anything is claimed: its list's sender and footer words, and the link key it was
 *    made with (listFault); a fault sends nothing, claims nothing and puts its words on the next row;
 * c. the claim takes no row marked sending, and on the request path's deadline no more rows than fit in the time left;
 * d. the gate is read once for the batch: for a list, openGate on that list, and a gate that cannot be read puts every
 *    claimed row back untried, while the rows it refuses are taken out of the campaign as skipped, never sent; for
 *    Group email, openLoopGate, and a refused row is failed in the seam's words;
 * e. each row is marked just before its send, the first in a statement of its own and each later one in the batch that
 *    records the row before it, and a row that does not take its mark (a stop failed it) ends the batch;
 * f. each answer is read by classifyOnce: sent; never, failed with its words (a request with no answer among them); or
 *    later, which puts this row and every claimed row not yet tried back in one statement and ends the batch, and the
 *    whole run for an answer every send would meet; the deadline, checked before each send, puts back what it leaves.
 */
async function runUnderRules(
  env: CampaignEnv,
  campaignId: string,
  campaign: CampaignRow,
  limit: number,
  deadline?: number,
): Promise<CampaignRun> {
  const db = env.DB
  const listId = campaign.list_id
  let sent = 0
  // The rows written off are given up on during this run, so they count in its failed.
  let failed = (await db.batch(writeOff(db, campaignId)))[1]?.meta.changes ?? 0

  if (listId != null) {
    const fault = await listFault(env, listId, campaign.filter_json)
    if (fault !== null) {
      await noteOnNext(db, campaignId, fault).run()
      return finishRun(db, campaignId, sent, failed, false)
    }
  }

  const room = deadline === undefined ? limit : Math.min(limit, Math.ceil((deadline - Date.now()) / SEND_INTERVAL_MS))
  const claimed = room > 0 ? await claimRecipients(db, campaignId, room) : []
  if (claimed.length === 0) return finishRun(db, campaignId, sent, failed, false)

  let gate: MailGate
  let rows = claimed
  if (listId != null) {
    try {
      gate = await openGate(db, claimed.map((r) => r.email), listId)
    } catch (err) {
      if (!(err instanceof GateUnread)) throw err
      // The list waits, untried: no list mail goes while the do-not-send list cannot be read.
      console.warn(GATE_UNREAD_LOG)
      await putBackRows(db, campaignId, listId, claimed, { noted: claimed[0].id, words: GATE_UNREAD_WORDS })
      return finishRun(db, campaignId, sent, failed, false)
    }
    const listGate = gate
    const refused = claimed.filter((r) => {
      const why = listGate.refusal(r.email, 'optional', listId)
      return why !== null && why !== undefined
    })
    if (refused.length > 0) {
      await db.batch(skipRefused(db, campaignId, refused))
      rows = claimed.filter((r) => !refused.includes(r))
    }
  } else {
    gate = await openLoopGate(db, claimed.map((r) => r.email))
  }
  if (rows.length === 0) return finishRun(db, campaignId, sent, failed, false)

  // Group email's page is the same for everyone; a list's carries each person's own footer.
  const html = listId == null ? wrapBrandedEmail(env, campaign.subject, campaign.body_html) : ''

  if (!(await markSending(db, rows[0].id).run()).meta.changes) {
    await putBackRows(db, campaignId, listId, rows)
    return finishRun(db, campaignId, sent, failed, false)
  }

  for (const [index, recipient] of rows.entries()) {
    if (index > 0) await new Promise((r) => setTimeout(r, SEND_INTERVAL_MS))
    if (deadline !== undefined && Date.now() >= deadline) {
      // Not reached before the deadline: this row, marked but not sent, and the rest go back, each attempt given back.
      await putBackRows(db, campaignId, listId, rows.slice(index))
      return finishRun(db, campaignId, sent, failed, true)
    }

    const outcome = await sendRuled(env, campaign, recipient, html, gate)

    if (outcome.kind === 'later') {
      await putBackRows(db, campaignId, listId, rows.slice(index), { kept: outcome.untried ? undefined : recipient.id, noted: recipient.id, words: outcome.words })
      return finishRun(db, campaignId, sent, failed, outcome.endRun)
    }

    const next = rows[index + 1]
    const statements =
      outcome.kind === 'sent'
        ? [
            db
              .prepare(`UPDATE email_campaign_recipients SET status = 'sent', sent_at = datetime('now'), error = NULL WHERE id = ?`)
              .bind(recipient.id),
            db.prepare(`UPDATE email_campaigns SET sent_count = sent_count + 1 WHERE id = ?`).bind(campaignId),
          ]
        : [
            db.prepare(`UPDATE email_campaign_recipients SET status = 'failed', error = ? WHERE id = ?`).bind(outcome.words, recipient.id),
            db.prepare(`UPDATE email_campaigns SET failed_count = failed_count + 1 WHERE id = ?`).bind(campaignId),
          ]
    if (next) statements.push(markSending(db, next.id))
    const results = await db.batch(statements)
    if (outcome.kind === 'sent') sent++
    else failed++

    if (next && !results[2]?.meta.changes) {
      // The next row did not take its mark, so a stop failed it or the member delete took it out: none of the rows after
      // this one is sent.
      await putBackRows(db, campaignId, listId, rows.slice(index + 1))
      return finishRun(db, campaignId, sent, failed, false)
    }
  }

  return finishRun(db, campaignId, sent, failed, false)
}

/**
 * How long the request path keeps working before leaving the rest to cron.
 */
const REQUEST_DRAIN_MS = 60_000

/**
 * Sends as much of a fresh campaign as the request path reasonably can.
 *
 * Runs in waitUntil, so this is best-effort by construction: it stops at a
 * deadline rather than trying to see the campaign through, and whatever is
 * left is the sweep's problem. That split is the point — the request path
 * is fast when it works and costs nothing when it is cut off, because no
 * recipient is ever the responsibility of this run alone.
 */
export async function drainCampaign(env: CampaignEnv, campaignId: string): Promise<void> {
  if (engineRulesOn()) return drainUnderRules(env, campaignId)
  const deadline = Date.now() + REQUEST_DRAIN_MS
  while (Date.now() < deadline) {
    const run = await processCampaign(env, campaignId)
    if (run.done) return
    // Nothing claimed: either another run holds every pending row, or the
    // remainder is waiting out a retry backoff. Either way, not ours.
    if (run.sent + run.failed === 0) return
  }
}

/**
 * The request path under the engine's rules, by the plan's sizes (../mail/plan): on the free plan one batch, and the
 * rest is the sweep's; on Workers Paid, batches until the deadline, each checking it before every send and claiming no
 * more rows than fit in the time left, with the pause between two sends kept between two batches as well, so the
 * work ends well inside the 30 seconds waitUntil lasts after the answer. REQUEST_DRAIN_MS is not read here. Only the
 * two POSTs that start a campaign call this, and the newsletter's answers 404 unless MAIL_LISTS_ON, which turns the
 * rules on, so a list campaign is always drained here.
 */
async function drainUnderRules(env: CampaignEnv, campaignId: string): Promise<void> {
  const { requestBatch, requestDeadlineMs } = sizes()
  if (requestDeadlineMs === null) {
    await runCampaign(env, campaignId, requestBatch)
    return
  }
  const deadline = Date.now() + requestDeadlineMs
  while (Date.now() < deadline) {
    const run = await runCampaign(env, campaignId, requestBatch, deadline)
    if (run.done || run.endRun || run.sent + run.failed === 0) return
    await new Promise((r) => setTimeout(r, SEND_INTERVAL_MS))
  }
}

/**
 * Finishes any campaign that still has work left.
 *
 * Called from the cron worker. This is what turns "the send died halfway"
 * from a dead end into a few minutes of delay: every in-flight campaign gets
 * revisited until its recipients are all resolved one way or the other.
 *
 * Campaigns are taken oldest-first so a stalled send is not starved by newer
 * ones, and the total is capped per run so one enormous campaign cannot make
 * the sweep itself run long.
 */
export async function sweepPendingCampaigns(
  env: CampaignEnv,
  budget?: number,
): Promise<{ campaignsTouched: number; sent: number; failed: number }> {
  if (engineRulesOn()) return sweepUnderRules(env, budget)
  const { results } = await env.DB.prepare(
    `SELECT id FROM email_campaigns WHERE status = 'sending' ORDER BY created_at ASC LIMIT 20`,
  ).all<{ id: string }>()

  let campaignsTouched = 0
  let sent = 0
  let failed = 0
  let left = budget ?? SWEEP_BATCH

  for (const { id } of results ?? []) {
    if (left <= 0) break
    const run = await processCampaign(env, id, left)
    // A campaign with nothing claimable — every pending row held by a live
    // run — costs nothing and should not count against the budget.
    if (run.sent === 0 && run.failed === 0) continue
    campaignsTouched++
    sent += run.sent
    failed += run.failed
    left -= run.sent + run.failed
  }

  return { campaignsTouched, sent, failed }
}

/**
 * The sweep under the engine's rules, by the plan's sizes (../mail/plan): on the free plan 20 sends from the oldest
 * campaign that is sending, one campaign a run; on Workers Paid up to 300 across up to 20 campaigns, oldest first. An
 * answer every send would meet (a throttle, an account on hold, a key fault, the limit) ends the run, and the untried rows
 * wait in the pool for the next one. Its first query, one batch, also writes off a stopped newsletter's rows whose run
 * died after their mark (writeOffClosed), which count in the run's failed.
 */
async function sweepUnderRules(
  env: CampaignEnv,
  budget?: number,
): Promise<{ campaignsTouched: number; sent: number; failed: number }> {
  const { sweepBatch, sweepCampaigns } = sizes()
  const [closedCampaigns, closedRows, sending] = await env.DB.batch([
    ...writeOffClosed(env.DB),
    env.DB.prepare(`SELECT id FROM email_campaigns WHERE status = 'sending' ORDER BY created_at ASC LIMIT ?`).bind(sweepCampaigns),
  ])
  const results = (sending?.results ?? []) as Array<{ id: string }>

  let campaignsTouched = closedCampaigns?.meta.changes ?? 0
  let sent = 0
  let failed = closedRows?.meta.changes ?? 0
  let left = budget ?? sweepBatch

  for (const { id } of results) {
    if (left <= 0) break
    const run = await runCampaign(env, id, left)
    if (run.sent > 0 || run.failed > 0) {
      campaignsTouched++
      sent += run.sent
      failed += run.failed
      left -= run.sent + run.failed
    }
    if (run.endRun) break
  }

  return { campaignsTouched, sent, failed }
}
