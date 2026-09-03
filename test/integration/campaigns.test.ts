// test/integration/campaigns.test.ts
//
// The mass-email path, with the resumability behaviour as the main subject.
//
// The thing worth protecting here is that no member is ever mailed twice.
// Everything else about a stalled campaign is recoverable; a duplicate send
// to 194 people is not. So the claim mechanism gets the most attention.
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { emailBehavior, emailOutbox, flushWaitUntil, invoke, resetHarness } from './harness'
import { seedAdmin, seedClub, seedMember } from './factories'

import { onRequestPost as campaignsPost } from '../../functions/api/admin/campaigns'
import { processCampaign, sweepPendingCampaigns } from '../../functions/utils/campaigns'

beforeEach(resetHarness)

/** Wipes campaign state so counts in one test can't leak into the next. */
async function clearCampaigns(): Promise<void> {
  await env.DB.prepare('DELETE FROM email_campaign_recipients').run()
  await env.DB.prepare('DELETE FROM email_campaigns').run()
}

async function seedRecipients(
  count: number,
  prefix: string,
  clubId?: string,
): Promise<string[]> {
  const ids: string[] = []
  for (let i = 0; i < count; i++) {
    ids.push(await seedMember({ email: `${prefix}${i}@campaign.lca.invalid`, clubId }))
  }
  return ids
}

/**
 * Endpoint tests filter by club rather than by { all: true }.
 *
 * The migrations seed real members of their own, so "everyone" is a moving
 * target that would make recipient counts depend on schema history. A club
 * nobody else belongs to is a filter the test fully controls.
 */
async function seedClubOfRecipients(count: number, prefix: string) {
  const clubId = await seedClub({ name: `Campaign club ${prefix}` })
  const memberIds = await seedRecipients(count, prefix, clubId)
  return { clubId, memberIds }
}

/**
 * Outbox entries addressed to the members one test seeded, in send order.
 *
 * Scoped by the test's own prefix rather than counting the whole outbox:
 * background sends from an earlier test can still be in flight, and counting
 * everything would make one test's timing another test's failure.
 */
function mailedTo(prefix: string): string[] {
  return emailOutbox.map((e) => e.to).filter((to) => to.startsWith(prefix))
}

/**
 * Creates a campaign directly in the database, bypassing the endpoint.
 *
 * The endpoint kicks off a send in waitUntil, which is exactly what these
 * tests want to control by hand — this leaves the campaign in the state a
 * killed send leaves behind: status 'sending', recipients still pending.
 */
async function stageCampaign(memberIds: string[], id = 'campaign-test'): Promise<string> {
  await env.DB.prepare(
    `INSERT INTO email_campaigns (id, subject, body_html, filter_json, total_recipients)
     VALUES (?, ?, ?, ?, ?)`,
  ).bind(id, 'Test subject', '<p>Body</p>', '{}', memberIds.length).run()

  for (const memberId of memberIds) {
    const member = await env.DB.prepare('SELECT email FROM members WHERE id = ?')
      .bind(memberId).first<{ email: string }>()
    await env.DB.prepare(
      `INSERT INTO email_campaign_recipients (id, campaign_id, member_id, email)
       VALUES (?, ?, ?, ?)`,
    ).bind(`rcpt-${id}-${memberId}`, id, memberId, member!.email).run()
  }
  return id
}

function campaignRow(id: string) {
  return env.DB.prepare(
    'SELECT status, sent_count, failed_count FROM email_campaigns WHERE id = ?',
  ).bind(id).first<{ status: string; sent_count: number; failed_count: number }>()
}

function recipientStatuses(id: string) {
  return env.DB.prepare(
    `SELECT status, COUNT(*) as count FROM email_campaign_recipients
      WHERE campaign_id = ? GROUP BY status`,
  ).bind(id).all<{ status: string; count: number }>()
}

describe('campaigns: access', () => {
  it('a plain member cannot start a campaign', async () => {
    const memberId = await seedMember()
    const { status } = await invoke(campaignsPost, {
      as: memberId,
      method: 'POST',
      body: { subject: 'Hello', bodyHtml: '<p>Hi</p>', filter: { all: true } },
    })
    expect(status).toBe(403)
  })

  it('an admin session without a second factor cannot start a campaign', async () => {
    const adminId = await seedAdmin()
    const { status, json } = await invoke(campaignsPost, {
      as: adminId,
      aal: 'aal1',
      method: 'POST',
      body: { subject: 'Hello', bodyHtml: '<p>Hi</p>', filter: { all: true } },
    })

    // Mass email is the loudest thing an admin account can do, so this is a
    // good place to pin the 2FA requirement down.
    expect(status).toBe(403)
    expect((await json()).mfaRequired).toBe(true)
  })
})

describe('campaigns: sending', () => {
  beforeEach(clearCampaigns)

  it('mails everyone the filter resolved and completes', async () => {
    const adminId = await seedAdmin()
    const { clubId } = await seedClubOfRecipients(3, 'send')

    const { status } = await invoke(campaignsPost, {
      as: adminId,
      method: 'POST',
      body: { subject: 'Hello', bodyHtml: '<p>Hi</p>', filter: { clubIds: [clubId] } },
    })
    expect(status).toBe(201)

    const campaign = await env.DB.prepare(
      'SELECT id, total_recipients FROM email_campaigns LIMIT 1',
    ).first<{ id: string; total_recipients: number }>()

    expect(campaign!.total_recipients).toBe(3)

    // The endpoint responds before the send finishes; this is that send.
    await flushWaitUntil()

    const row = await campaignRow(campaign!.id)
    expect(row!.sent_count).toBe(3)
    expect(row!.status).toBe('completed')
    expect(mailedTo('send')).toHaveLength(3)
  })

  it('does not mail members the admin excluded', async () => {
    const adminId = await seedAdmin()
    const { clubId, memberIds } = await seedClubOfRecipients(2, 'exclude')
    const [keep, drop] = memberIds

    await invoke(campaignsPost, {
      as: adminId,
      method: 'POST',
      body: {
        subject: 'Hello',
        bodyHtml: '<p>Hi</p>',
        filter: { clubIds: [clubId] },
        excludeMemberIds: [drop],
      },
    })

    await flushWaitUntil()

    const mailed = mailedTo('exclude')
    const dropped = await env.DB.prepare('SELECT email FROM members WHERE id = ?')
      .bind(drop).first<{ email: string }>()
    const kept = await env.DB.prepare('SELECT email FROM members WHERE id = ?')
      .bind(keep).first<{ email: string }>()

    expect(mailed).toContain(kept!.email)
    expect(mailed).not.toContain(dropped!.email)
  })
})

describe('campaigns: resuming a stalled send', () => {
  beforeEach(clearCampaigns)

  it('the sweep finishes a campaign whose send was cut off', async () => {
    const ids = await seedRecipients(3, 'stall')
    const campaignId = await stageCampaign(ids)

    // What an evicted isolate leaves behind: nothing sent, nothing claimed.
    const before = await campaignRow(campaignId)
    expect(before!.status).toBe('sending')
    expect(before!.sent_count).toBe(0)

    const result = await sweepPendingCampaigns(env)

    expect(result.sent).toBe(3)
    expect(mailedTo('stall')).toHaveLength(3)
    const after = await campaignRow(campaignId)
    expect(after!.status).toBe('completed')
  })

  it('the sweep leaves completed campaigns alone', async () => {
    const ids = await seedRecipients(2, 'done')
    const campaignId = await stageCampaign(ids)
    await sweepPendingCampaigns(env)
    emailOutbox.length = 0

    const result = await sweepPendingCampaigns(env)

    expect(result.campaignsTouched).toBe(0)
    expect(mailedTo('done')).toHaveLength(0)
    expect((await campaignRow(campaignId))!.sent_count).toBe(2)
  })

  it('sends the batch in pieces when the run is bounded', async () => {
    const ids = await seedRecipients(5, 'batch')
    const campaignId = await stageCampaign(ids)

    const first = await processCampaign(env, campaignId, 2)
    expect(first.sent).toBe(2)
    expect(first.remaining).toBe(3)
    expect(first.done).toBe(false)
    expect((await campaignRow(campaignId))!.status).toBe('sending')

    const rest = await sweepPendingCampaigns(env)
    expect(rest.sent).toBe(3)
    expect((await campaignRow(campaignId))!.status).toBe('completed')

    // Five recipients, five emails — the split changed the pacing, not the
    // recipient list.
    expect(mailedTo('batch')).toHaveLength(5)
  })
})

describe('campaigns: no double sends', () => {
  beforeEach(clearCampaigns)

  it('concurrent runs never mail the same member twice', async () => {
    const ids = await seedRecipients(6, 'race')
    const campaignId = await stageCampaign(ids)

    // Two runs racing is the real scenario: the original waitUntil send is
    // still going when a sweep fires. Both go after the same pending rows.
    await Promise.all([
      processCampaign(env, campaignId),
      processCampaign(env, campaignId),
      sweepPendingCampaigns(env),
    ])

    const mailed = mailedTo('race')
    expect(mailed).toHaveLength(6)
    expect(new Set(mailed).size).toBe(6)

    const row = await campaignRow(campaignId)
    expect(row!.sent_count).toBe(6)
    expect(row!.status).toBe('completed')
  })

  it('a live claim is not stolen by a second run', async () => {
    const ids = await seedRecipients(2, 'claim')
    const campaignId = await stageCampaign(ids)

    // Simulate a run that claimed everything and then died before sending.
    await env.DB.prepare(
      `UPDATE email_campaign_recipients SET claimed_at = datetime('now') WHERE campaign_id = ?`,
    ).bind(campaignId).run()

    const result = await sweepPendingCampaigns(env)

    // The claim is fresh, so the sweep correctly assumes someone else has it.
    expect(result.sent).toBe(0)
    expect(mailedTo('claim')).toHaveLength(0)
    expect((await campaignRow(campaignId))!.status).toBe('sending')
  })

  it('reclaims a batch whose owner died', async () => {
    const ids = await seedRecipients(2, 'stale')
    const campaignId = await stageCampaign(ids)

    // Same as above, but the claim is older than the timeout — nobody is
    // coming back for these.
    await env.DB.prepare(
      `UPDATE email_campaign_recipients
          SET claimed_at = datetime('now', '-30 minutes')
        WHERE campaign_id = ?`,
    ).bind(campaignId).run()

    const result = await sweepPendingCampaigns(env)

    expect(result.sent).toBe(2)
    expect((await campaignRow(campaignId))!.status).toBe('completed')
  })
})

describe('campaigns: failure handling', () => {
  beforeEach(clearCampaigns)

  it('retries a transient failure on the next sweep', async () => {
    const ids = await seedRecipients(1, 'transient')
    const campaignId = await stageCampaign(ids)

    emailBehavior.succeed = false
    emailBehavior.status = 500
    const first = await processCampaign(env, campaignId)

    // Not sent, but not written off either — still pending for the sweep.
    expect(first.sent).toBe(0)
    expect(first.failed).toBe(0)
    expect(first.remaining).toBe(1)
    const statuses = await recipientStatuses(campaignId)
    expect(statuses.results).toEqual([{ status: 'pending', count: 1 }])

    emailBehavior.succeed = true
    const second = await sweepPendingCampaigns(env)
    expect(second.sent).toBe(1)
    expect((await campaignRow(campaignId))!.status).toBe('completed')
  })

  it('gives up on a transient failure that never clears', async () => {
    const ids = await seedRecipients(1, 'persistent')
    const campaignId = await stageCampaign(ids)

    emailBehavior.succeed = false
    emailBehavior.status = 500

    // Three attempts is the cap; the third writes the recipient off rather
    // than leaving the campaign to be swept forever.
    await processCampaign(env, campaignId)
    await processCampaign(env, campaignId)
    const third = await processCampaign(env, campaignId)

    expect(third.failed).toBe(1)
    expect(third.done).toBe(true)
    const row = await campaignRow(campaignId)
    expect(row!.failed_count).toBe(1)
    // The only recipient was written off, so the campaign as a whole failed.
    expect(row!.status).toBe('failed')
  })

  it('marks a campaign failed when nothing got through', async () => {
    const ids = await seedRecipients(2, 'allbad')
    const campaignId = await stageCampaign(ids)

    emailBehavior.succeed = false
    emailBehavior.status = 422

    await processCampaign(env, campaignId)

    // Every recipient rejected. "Completed" would read as success in the
    // campaign list; this is the one case where the distinction matters.
    const row = await campaignRow(campaignId)
    expect(row!.sent_count).toBe(0)
    expect(row!.failed_count).toBe(2)
    expect(row!.status).toBe('failed')
  })

  it('writes off a rejected address immediately', async () => {
    const ids = await seedRecipients(1, 'rejected')
    const campaignId = await stageCampaign(ids)

    emailBehavior.succeed = false
    emailBehavior.status = 422

    const result = await processCampaign(env, campaignId)

    // A rejection of this specific address will read the same next time, so
    // there is nothing to retry.
    expect(result.failed).toBe(1)
    expect(result.done).toBe(true)
    const failed = await env.DB.prepare(
      `SELECT status, error, attempts FROM email_campaign_recipients WHERE campaign_id = ?`,
    ).bind(campaignId).first<{ status: string; error: string; attempts: number }>()
    expect(failed!.status).toBe('failed')
    expect(failed!.attempts).toBe(1)
    expect(failed!.error).toContain('422')
  })

  it('one bad address does not stop the rest of the batch', async () => {
    const ids = await seedRecipients(4, 'mixed')
    const campaignId = await stageCampaign(ids)

    const bad = await env.DB.prepare('SELECT email FROM members WHERE id = ?')
      .bind(ids[1]).first<{ email: string }>()
    emailBehavior.succeed = false
    emailBehavior.status = 422
    emailBehavior.failFor = [bad!.email]

    const result = await processCampaign(env, campaignId)

    expect(result.sent).toBe(3)
    expect(result.failed).toBe(1)
    expect(result.done).toBe(true)
    expect(mailedTo('mixed')).not.toContain(bad!.email)
    expect((await campaignRow(campaignId))!.status).toBe('completed')
  })
})
