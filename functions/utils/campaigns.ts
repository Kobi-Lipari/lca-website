// functions/utils/campaigns.ts
import type { Env } from '../types'

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

const SITE_URL = 'https://louisianachess.org' // matches K's existing Supabase auth templates
const LOGO_URL = 'https://lca-website.pages.dev/lca-logo.jpg' // same asset path as those templates

export function wrapBrandedEmail(subject: string, bodyHtml: string): string {
  const safeSubject = escapeHtmlAttr(subject)
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
              <img src="${LOGO_URL}" alt="Louisiana Chess Association" width="160" style="display:block;margin:0 auto;border-radius:8px;">
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
                <a href="${SITE_URL}" style="color:#1a2744;text-decoration:none;">louisianachess.org</a>
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

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ── Sending ───────────────────────────────────────────────────────────────────

async function sendViaResend(
  env: Env,
  to: string,
  subject: string,
  html: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: `LCA <${env.FROM_EMAIL}>`, to, subject, html }),
    })
    if (!res.ok) return { ok: false, error: `Resend ${res.status}: ${await res.text()}` }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown send error' }
  }
}

/** Sends a single one-off email through the same branded template a real
 *  campaign uses, without touching the campaigns/recipients tables at all —
 *  used by the "send test email" tool so admins can check formatting before
 *  committing to a real send. Not tied to a member; any address works. */
export async function sendTestEmail(
  env: Env,
  to: string,
  subject: string,
  bodyHtml: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const html = wrapBrandedEmail(subject, bodyHtml)
  return sendViaResend(env, to, subject, html)
}

/**
 * Processes every still-pending recipient for a campaign, sending one at a
 * time with a small delay to stay under Resend's rate limit. Safe to call
 * more than once for the same campaign (e.g. a retry, or a periodic sweep) —
 * it only ever touches rows still marked 'pending'.
 */
export async function processCampaign(env: Env, campaignId: string): Promise<void> {
  const db = env.DB
  const pending = await db
    .prepare(
      `SELECT id, email FROM email_campaign_recipients WHERE campaign_id = ? AND status = 'pending'`,
    )
    .bind(campaignId)
    .all<{ id: string; email: string }>()

  const campaign = await db
    .prepare(`SELECT subject, body_html FROM email_campaigns WHERE id = ?`)
    .bind(campaignId)
    .first<{ subject: string; body_html: string }>()

  if (!campaign) return

  const html = wrapBrandedEmail(campaign.subject, campaign.body_html)

  for (const recipient of pending.results ?? []) {
    const result = await sendViaResend(env, recipient.email, campaign.subject, html)

    if (result.ok) {
      await db.batch([
        db
          .prepare(`UPDATE email_campaign_recipients SET status = 'sent', sent_at = datetime('now') WHERE id = ?`)
          .bind(recipient.id),
        db
          .prepare(`UPDATE email_campaigns SET sent_count = sent_count + 1 WHERE id = ?`)
          .bind(campaignId),
      ])
    } else {
      await db.batch([
        db
          .prepare(`UPDATE email_campaign_recipients SET status = 'failed', error = ? WHERE id = ?`)
          .bind(result.error, recipient.id),
        db
          .prepare(`UPDATE email_campaigns SET failed_count = failed_count + 1 WHERE id = ?`)
          .bind(campaignId),
      ])
    }
    // Stay comfortably under Resend's rate limit.
    await new Promise((r) => setTimeout(r, 400))
  }

  const remaining = await db
    .prepare(`SELECT COUNT(*) as count FROM email_campaign_recipients WHERE campaign_id = ? AND status = 'pending'`)
    .bind(campaignId)
    .first<{ count: number }>()

  if ((remaining?.count ?? 0) === 0) {
    await db
      .prepare(
        `UPDATE email_campaigns SET status = 'completed', completed_at = datetime('now') WHERE id = ?`,
      )
      .bind(campaignId)
      .run()
  }
}