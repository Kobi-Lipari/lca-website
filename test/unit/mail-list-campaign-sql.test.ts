// test/unit/mail-list-campaign-sql.test.ts
//
// The newsletter tab's send batch, createListCampaign in
// functions/utils/mail/lists.ts, holds its four statements byte for byte: the
// campaign insert, the contacts, the recipients and the total, each with its
// bind values, in that order. The literals below were copied from the file
// before its three audience statements moved into a helper the page's send
// shares, so a change that moves one byte of the tab's send turns this red.
// A fake D1 records each statement's text and binds; nothing is run.
//
// Every subject, word and id here is made up.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createListCampaign, NEWSLETTER_AUDIENCE_SQL } from '../../functions/utils/mail/lists'

interface Recorded {
  sql: string
  binds: unknown[]
}

/** A D1 stand-in that records each prepared statement and answers a batch with the changes given, in order. */
function recordingDb(changes: number[]) {
  const batches: Recorded[][] = []
  const db = {
    prepare(sql: string) {
      const statement: Recorded & { bind: (...values: unknown[]) => Recorded } = {
        sql,
        binds: [],
        bind(...values: unknown[]) {
          statement.binds = values
          return statement
        },
      }
      return statement
    },
    async batch(statements: Recorded[]) {
      batches.push(statements.map((s) => ({ sql: s.sql, binds: s.binds })))
      return statements.map((_, i) => ({ meta: { changes: changes[i] ?? 0 } }))
    },
  }
  return { db: db as unknown as D1Database, batches }
}

const NOW = 1_800_000_000_000
const ID = `campaign-${NOW.toString(36)}`
const MADE = 'EXISTS (SELECT 1 FROM email_campaigns WHERE id = ?1 AND list_id = ?2)'
const ARGS = { listId: 'lca-newsletter', subject: 'Sample subject one', bodyHtml: '<p>Example words.</p>', createdBy: 'member-sample-one', linkCheck: 'abcdef0123456789' }

const INSERT = [
  'INSERT INTO email_campaigns (id, subject, body_html, filter_json, total_recipients, created_by, status, list_id)',
  "         SELECT ?1, ?3, ?4, ?5, 0, ?6, 'sending', ?2",
  "          WHERE NOT EXISTS (SELECT 1 FROM email_campaigns WHERE list_id = ?2 AND status = 'sending')",
].join('\n')
const CONTACTS = [
  'INSERT OR IGNORE INTO mail_contacts (id, address)',
  `         SELECT lower(hex(randomblob(16))), a.address FROM (${NEWSLETTER_AUDIENCE_SQL}) a WHERE ${MADE}`,
].join('\n')
const RECIPIENTS = [
  'INSERT OR IGNORE INTO email_campaign_recipients (id, campaign_id, member_id, email, contact_id)',
  "         SELECT 'rcpt-' || ?1 || '-' || c.id, ?1, NULL, c.address, c.id",
  '           FROM mail_contacts c',
  `          WHERE ${MADE}`,
  `            AND c.address IN (${NEWSLETTER_AUDIENCE_SQL})`,
  '            AND NOT EXISTS (SELECT 1 FROM mail_list_choices ch WHERE ch.contact_id = c.id AND ch.list_id = ?2 AND ch.choice = ?3)',
  '            AND c.optional_off_at IS NULL',
  '            AND NOT EXISTS (SELECT 1 FROM mail_do_not_send d WHERE d.address = c.address)',
  '          ORDER BY c.address',
].join('\n')
const TOTAL = 'UPDATE email_campaigns SET total_recipients = (SELECT COUNT(*) FROM email_campaign_recipients WHERE campaign_id = ?1) WHERE id = ?1 AND list_id = ?2'

afterEach(() => vi.restoreAllMocks())

describe('createListCampaign, the newsletter tab\'s send batch', () => {
  it('runs exactly its four statements in one batch, each text and each bind value byte for byte as before', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
    const { db, batches } = recordingDb([1, 2, 5, 1])
    await createListCampaign(db, ARGS)
    expect(batches).toHaveLength(1)
    expect(batches[0]).toEqual([
      { sql: INSERT, binds: [ID, 'lca-newsletter', 'Sample subject one', '<p>Example words.</p>', '{"list":"lca-newsletter","linkCheck":"abcdef0123456789"}', 'member-sample-one'] },
      { sql: CONTACTS, binds: [ID, 'lca-newsletter'] },
      { sql: RECIPIENTS, binds: [ID, 'lca-newsletter', 'out'] },
      { sql: TOTAL, binds: [ID, 'lca-newsletter'] },
    ])
    // Names no letter: the tab's send never reads or writes newsletter_issues.
    for (const statement of batches[0]) expect(statement.sql).not.toMatch(/newsletter_issues/)
  })

  it('answers the campaign and the recipients the third statement wrote, or null when the insert made nothing', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
    expect(await createListCampaign(recordingDb([1, 2, 5, 1]).db, ARGS)).toEqual({ campaignId: ID, totalRecipients: 5 })
    expect(await createListCampaign(recordingDb([0, 0, 0, 0]).db, ARGS)).toBeNull()
  })
})
