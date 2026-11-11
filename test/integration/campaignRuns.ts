// test/integration/campaignRuns.ts
//
// One copy of the campaign helpers WS16 step 4's three suites share,
// test/integration/newsletter.test.ts, newsletter-edges.test.ts and
// test/integration/campaigns-once.test.ts: a campaign staged by hand, as a
// run that died leaves one, its rows and its counters read back, and the
// pause between two sends taken out of a case's time. It depends on no
// mock: each suite keeps its own vi.mock of functions/utils/mail/switches.
// The daily run's helpers, the statement-counting database and the host
// log stay in test/integration/mailRuns.ts.
import { env } from 'cloudflare:test'
import { vi } from 'vitest'

let seq = 0
/** The next number of the counter every suite that stages a campaign here draws its ids from. */
export const nextCampaignSeq = (): number => ++seq

export interface StagedRecipient {
  email: string
  /** The row's mail contact, as a list campaign's rows carry one; none for Group email's. */
  contactId?: string | null
  /** The row's claim and mark, as a run left them: written as SQL, such as "datetime('now', '-20 minutes')". */
  claimedAt?: string
  sendingAt?: string
  attempts?: number
}

/**
 * A campaign written straight into the tables, bypassing every endpoint, in the state a send that was cut off leaves
 * it: status 'sending' and its rows pending. A list campaign names its list and carries filter_json as the
 * newsletter's send writes it; createdAt orders campaigns for the sweep. Each row's id is the campaign's and its
 * place, written with four digits, so the rows sort by id as they were written.
 */
export async function stageCampaign(opts: {
  id?: string
  subject?: string
  listId?: string | null
  filterJson?: string
  createdAt?: string
  recipients: StagedRecipient[]
}): Promise<string> {
  const id = opts.id ?? `campaign-staged-${nextCampaignSeq()}`
  await env.DB.prepare(
    `INSERT INTO email_campaigns (id, subject, body_html, filter_json, total_recipients, list_id, created_at)
     VALUES (?, ?, '<p>Example words for a sample message.</p>', ?, ?, ?, COALESCE(?, datetime('now')))`,
  ).bind(id, opts.subject ?? 'Sample message one', opts.filterJson ?? '{}', opts.recipients.length, opts.listId ?? null, opts.createdAt ?? null).run()
  const statements = opts.recipients.map((r, index) =>
    env.DB.prepare(
      `INSERT INTO email_campaign_recipients (id, campaign_id, member_id, email, contact_id, claimed_at, sending_at, attempts)
       VALUES (?, ?, NULL, ?, ?, ${r.claimedAt ?? 'NULL'}, ${r.sendingAt ?? 'NULL'}, ?)`,
    ).bind(`${id}-${String(index).padStart(4, '0')}`, id, r.email, r.contactId ?? null, r.attempts ?? 0),
  )
  for (let at = 0; at < statements.length; at += 50) await env.DB.batch(statements.slice(at, at + 50))
  return id
}

export interface RecipientRow {
  id: string
  email: string
  status: string
  error: string | null
  attempts: number
  claimed_at: string | null
  sending_at: string | null
  contact_id: string | null
}

/** A campaign's rows, in the order they were written. */
export async function rowsOf(campaignId: string): Promise<RecipientRow[]> {
  const { results } = await env.DB.prepare(
    `SELECT id, email, status, error, attempts, claimed_at, sending_at, contact_id
       FROM email_campaign_recipients WHERE campaign_id = ? ORDER BY rowid`,
  ).bind(campaignId).all<RecipientRow>()
  return results ?? []
}

export interface CampaignCounters {
  status: string
  total_recipients: number
  sent_count: number
  failed_count: number
  skipped_count: number
  list_id: string | null
  filter_json: string
}

/** A campaign's status and counters. */
export function campaignOf(campaignId: string): Promise<CampaignCounters | null> {
  return env.DB.prepare(
    `SELECT status, total_recipients, sent_count, failed_count, skipped_count, list_id, filter_json FROM email_campaigns WHERE id = ?`,
  ).bind(campaignId).first<CampaignCounters>()
}

/**
 * The sender waits 400 ms between two sends. Here setTimeout calls back on the next microtask, and moves a held clock
 * (vi.useFakeTimers on Date, as test/integration/mailRuns.ts's holdClock holds it) on by the wait, so a run of 300
 * sends takes no time and a deadline is met when its time has passed. Nothing else the cases run sets a timer.
 */
export function quickPauses(): void {
  vi.spyOn(globalThis, 'setTimeout').mockImplementation(((callback: () => void, ms?: number) => {
    if (vi.isFakeTimers()) vi.setSystemTime(Date.now() + (ms ?? 0))
    queueMicrotask(callback)
    return 0
  }) as unknown as typeof setTimeout)
}
