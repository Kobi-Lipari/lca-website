// functions/utils/campaigns.ts
import { DEFAULT_FROM } from './email'
import { emailLogoUrl, resolveSiteUrl, type SiteEnv } from './site'

/**
 * The bindings the campaign send path needs.
 *
 * Same trick as EmailEnv in ./email: both the Pages Functions Env and the
 * cron Worker Env satisfy this structurally, so the sweep can live here and
 * be called from either side without the two learning about each other.
 */
export interface CampaignEnv extends SiteEnv {
  DB: D1Database
  RESEND_API_KEY: string
  FROM_EMAIL?: string
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

async function getAllMembers(db: D1Database): Promise<ResolvedRecipient[]> {
  const { results } = await db
    .prepare(`SELECT id, email, full_name FROM members ORDER BY full_name ASC`)
    .all<ResolvedRecipient>()
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
export async function resolveRecipients(
  db: D1Database,
  filter: CampaignFilter,
): Promise<ResolvedRecipient[]> {
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

  const sql = `SELECT id, email, full_name FROM members WHERE ${clauses.join(' AND ')} ORDER BY full_name ASC`
  const { results } = await db.prepare(sql).bind(...binds).all<ResolvedRecipient>()
  return results ?? []
}

// ── Branded template (matches the Supabase auth-email style) ─────────────────
// Table-based markup for email-client compatibility, navy header with logo,
// gold divider, Georgia serif heading, Arial body. Unlike the auth templates
// this is modeled on, there's no fixed CTA button — group email has no single
// canonical action the way "reset password" does, so the admin's own message
// (including any links they add via the editor) renders directly in the body.
// Reintroduces some of the visual signals (colored header, embedded image)
// that the earlier plain version deliberately avoided for inbox placement —
// a deliberate tradeoff, not an oversight; worth retesting placement after
// this change since bulk sending pattern matters as much as content style.

export function wrapBrandedEmail(
  env: SiteEnv,
  subject: string,
  bodyHtml: string,
): string {
  const safeSubject = escapeHtmlAttr(subject)
  const siteUrl = resolveSiteUrl(env)
  const logoUrl = emailLogoUrl(env)
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeSubject}</title>
  <style>
    .lca-body p { margin: 0 0 16px; }
    .lca-body ul, .lca-body ol { margin: 0 0 16px; padding-left: 20px; }
    .lca-body a { color: #c8a94a; text-decoration: underline; }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f0;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f0;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e0ddd5;">

          <!-- Header -->
          <tr>
            <td style="background-color:#1a2744;padding:32px 40px;text-align:center;">
              <img src="${logoUrl}" alt="Louisiana Chess Association" width="160" style="display:block;margin:0 auto;border-radius:8px;">
            </td>
          </tr>

          <!-- Gold bar -->
          <tr>
            <td style="background-color:#c8a94a;height:4px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <h1 style="margin:0 0 16px;font-size:24px;color:#1a2744;font-family:Georgia,serif;">${safeSubject}</h1>
              <div class="lca-body" style="font-size:16px;color:#444;line-height:1.6;font-family:Arial,sans-serif;">
                ${bodyHtml}
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f4f4f0;border-top:1px solid #e0ddd5;padding:24px 40px;text-align:center;">
              <p style="margin:0 0 4px;font-size:12px;color:#999;font-family:Arial,sans-serif;">Louisiana Chess Association</p>
              <p style="margin:0;font-size:12px;font-family:Arial,sans-serif;">
                <a href="${siteUrl}" style="color:#1a2744;text-decoration:none;">${siteLabel(siteUrl)}</a>
                &nbsp;·&nbsp;
                <a href="mailto:support@louisianachess.org" style="color:#1a2744;text-decoration:none;">support@louisianachess.org</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/** "https://louisianachess.org" → "louisianachess.org", for link text. */
function siteLabel(url: string): string {
  return url.replace(/^https?:\/\//, '')
}

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
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
const SEND_INTERVAL_MS = 400

type SendOutcome =
  | { ok: true }
  /** Worth another go later: rate limits, upstream 5xx, network errors. */
  | { ok: false; retryable: true; error: string }
  /** Will never succeed: malformed or rejected address, bad payload. */
  | { ok: false; retryable: false; error: string }

async function sendViaResend(
  env: CampaignEnv,
  to: string,
  subject: string,
  html: string,
): Promise<SendOutcome> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: `LCA <${env.FROM_EMAIL ?? DEFAULT_FROM}>`, to, subject, html }),
    })
    if (res.ok) return { ok: true }

    const error = `Resend ${res.status}: ${await res.text()}`
    // 429 is us sending too fast and 5xx is Resend having a bad moment —
    // both are worth retrying. Anything else is a rejection of this specific
    // message (bad address, blocked domain) and will fail identically next
    // time, so retrying it only delays the campaign.
    const retryable = res.status === 429 || res.status >= 500
    return { ok: false, retryable, error }
  } catch (err) {
    // A thrown fetch is a network problem, not a verdict on the address.
    return {
      ok: false,
      retryable: true,
      error: err instanceof Error ? err.message : 'Unknown send error',
    }
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
  const result = await sendViaResend(env, to, subject, html)
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
}

/**
 * Atomically takes ownership of up to `limit` pending recipients.
 *
 * This is the whole reason a sweep is safe to run alongside the original
 * send. D1 serializes writes, so the UPDATE either claims a row or finds it
 * already claimed — two runs can never come away holding the same recipient
 * and mail somebody twice. Rows whose claim has gone stale are fair game
 * again, which is what lets a killed run's batch be finished by someone else.
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
             AND (claimed_at IS NULL OR claimed_at <= datetime('now', ?2))
           ORDER BY rowid
           LIMIT ?3
        )
        RETURNING id, email, attempts`,
    )
    .bind(campaignId, CLAIM_TIMEOUT, limit)
    .all<ClaimedRecipient>()
  return results ?? []
}

/**
 * Sends the next batch of pending recipients for a campaign.
 *
 * Deliberately does *not* try to finish the whole campaign in one call. It
 * claims a bounded batch, sends it, and reports what is left; the caller
 * decides whether to come back. Safe to call concurrently with itself — see
 * claimRecipients — and safe to call on a campaign with nothing outstanding,
 * which is what makes the cron sweep harmless when there is no work to do.
 */
export async function processCampaign(
  env: CampaignEnv,
  campaignId: string,
  limit: number = REQUEST_PATH_BATCH,
): Promise<CampaignRunResult> {
  const db = env.DB

  const campaign = await db
    .prepare(`SELECT subject, body_html FROM email_campaigns WHERE id = ?`)
    .bind(campaignId)
    .first<{ subject: string; body_html: string }>()

  if (!campaign) return { sent: 0, failed: 0, remaining: 0, done: true }

  const html = wrapBrandedEmail(env, campaign.subject, campaign.body_html)
  const claimed = await claimRecipients(db, campaignId, limit)

  let sent = 0
  let failed = 0

  for (const [index, recipient] of claimed.entries()) {
    // Pace between sends, not before the first — an idle wait on a
    // one-recipient batch is pure latency.
    if (index > 0) await new Promise((r) => setTimeout(r, SEND_INTERVAL_MS))

    const result = await sendViaResend(env, recipient.email, campaign.subject, html)

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

  return { sent, failed, remaining, done: remaining === 0 }
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
  budget: number = SWEEP_BATCH,
): Promise<{ campaignsTouched: number; sent: number; failed: number }> {
  const { results } = await env.DB.prepare(
    `SELECT id FROM email_campaigns WHERE status = 'sending' ORDER BY created_at ASC LIMIT 20`,
  ).all<{ id: string }>()

  let campaignsTouched = 0
  let sent = 0
  let failed = 0
  let left = budget

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
