// functions/utils/mail/lists.ts
//
// Who the LCA newsletter is for, written once, in SQL, so the email
// preferences endpoint (functions/api/mail/preferences/[token].ts) and the
// newsletter's send read the same rule. The lists' ids are in
// domain/mail/lists.ts. The newsletter's own reads and writes are here too
// (WS16 step 4): its counts and recent sends, the one batch that makes a
// send, and the stop. Every statement uses the audience clause at most
// once, in a subquery of its own, and binds a few values whatever the
// list's size.
//
// The newsletter's audience is K's rule (decision 28 of the WS16 plan, D38
// and Q40): every address on an account with an active membership, once.
// "You need to be active to get the newsletter": the list is not widened to
// lapsed members or to every account unless K says so. A member row counts
// when its membership_status is 'active', its role is not 'guest' (a
// walk-in placeholder) and its email is a list address as isListAddress in
// domain/mail/address.ts reads one, here written as clauses from that
// file's own names. Each address is trimmed of the spaces JavaScript's
// trim() takes off, as normalizeAddress trims it, and its ASCII letters
// lowercased, which is all SQLite's lower() folds, so a family's one
// address is one address. A capital letter outside ASCII would not match;
// member addresses come from the sign-in service already lowercased. A
// choice never adds an address to the newsletter: an 'in' on it from
// someone outside the audience counts for nothing.

import { EXAMPLE_DOMAINS, RESERVED_TOP_LEVEL_NAMES, SITE_DOMAIN } from '../../../domain/mail/address'
import { NEWSLETTER_LIST_ID, type Choice } from '../../../domain/mail/lists'
import { STOPPED_WORDS } from '../admin/campaigns'

/**
 * The code points JavaScript's trim() takes off each end, which normalizeAddress trims and isSendableAddress's \s
 * refuses inside an address: ECMAScript's white space and line terminators. Tab, line feed, vertical tab, form feed,
 * carriage return, space, no-break space, the Ogham space mark, the en quad to the hair space, the line and paragraph
 * separators, the narrow no-break space, the medium mathematical space, the ideographic space and the byte order
 * mark. Written as numbers so that this file holds none of them.
 */
const SPACE_CODE_POINTS: readonly number[] = [
  9, 10, 11, 12, 13, 32, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288, 65279,
]

/** Those code points as one SQL string. */
const SPACES = `char(${SPACE_CODE_POINTS.join(', ')})`

/** The longest GLOB pattern D1 takes, in bytes of UTF-8. */
const GLOB_PATTERN_BYTES = 50

/** A code point's length in UTF-8. */
const utf8Bytes = (point: number) => (point < 0x80 ? 1 : point < 0x800 ? 2 : point < 0x10000 ? 3 : 4)

/**
 * The code points in groups, in order, each small enough that '*[', the group and ']*' make a GLOB pattern D1 takes,
 * so an address is looked through for a space in two patterns rather than one D1 would refuse.
 */
const SPACE_GROUPS: readonly (readonly number[])[] = SPACE_CODE_POINTS.reduce<number[][]>((groups, point) => {
  const last = groups[groups.length - 1]
  const bytes = last ? last.reduce((sum, p) => sum + utf8Bytes(p), 4) : Infinity
  if (bytes + utf8Bytes(point) <= GLOB_PATTERN_BYTES) last.push(point)
  else groups.push([point])
  return groups
}, [])

/** A member row's address as the mail tables keep it, trimmed and lowercased, the row aliased m. */
const MEMBER_ADDRESS = `lower(trim(m.email, ${SPACES}))`

/**
 * SQL that is true when the trimmed, lowercased address `address` stands for is a list address: one @ with something
 * in front of it, a dot in the part after it between two names, no space, no top-level name RFC 2606 reserves, and
 * neither the site's own domain nor a documentation name, at the name or under it. Names are matched with GLOB,
 * whose only wildcards, * ? and [, appear in none of them, and a space with one GLOB class for each group of
 * SPACE_GROUPS, since D1 refuses a GLOB pattern longer than 50 bytes and the class of every space is longer.
 */
export function listAddressSql(address: string): string {
  const domain = `substr(${address}, instr(${address}, '@') + 1)`
  const notAtOrUnder = (name: string) => `${domain} <> '${name}' AND ${domain} NOT GLOB '*.${name}'`
  return [
    `instr(${address}, '@') > 1`,
    `instr(${domain}, '@') = 0`,
    ...SPACE_GROUPS.map((group) => `${address} NOT GLOB ('*[' || char(${group.join(', ')}) || ']*')`),
    `${domain} GLOB '*.*'`,
    `${domain} NOT GLOB '.*'`,
    `${domain} NOT GLOB '*.'`,
    `${domain} NOT GLOB '*..*'`,
    ...RESERVED_TOP_LEVEL_NAMES.map((name) => `${domain} NOT GLOB '*.${name}'`),
    notAtOrUnder(SITE_DOMAIN),
    ...EXAMPLE_DOMAINS.map(notAtOrUnder),
  ].join(' AND ')
}

/** The member rows the newsletter goes to, by their own columns: an active membership, no walk-in, a list address. */
const NEWSLETTER_MEMBER = `m.membership_status = 'active' AND m.role <> 'guest' AND m.email IS NOT NULL AND ${listAddressSql(MEMBER_ADDRESS)}`

/**
 * The newsletter's audience as a query of one column, address: every address on an account with an active
 * membership, trimmed and lowercased, once. WS16 step 4's send selects its recipients from it.
 */
export const NEWSLETTER_AUDIENCE_SQL = `SELECT DISTINCT ${MEMBER_ADDRESS} AS address FROM members m WHERE ${NEWSLETTER_MEMBER}`

/**
 * SQL that is true when the address `address` stands for, already trimmed and lowercased as mail_contacts keeps it,
 * is in the newsletter's audience: some account with an active membership has it.
 */
export function inNewsletterAudienceSql(address: string): string {
  return `EXISTS (SELECT 1 FROM members m WHERE ${MEMBER_ADDRESS} = ${address} AND ${NEWSLETTER_MEMBER})`
}

/** Whether one address, as normalizeAddress writes it, is in the newsletter's audience. One query. */
export async function inNewsletterAudience(db: D1Database, address: string): Promise<boolean> {
  const row = await db.prepare(`SELECT ${inNewsletterAudienceSql('?1')} AS yes`).bind(address).first<{ yes: number }>()
  return row?.yes === 1
}

// ── The newsletter's send ────────────────────────────────────────────────────

/** The choice that keeps a person off a list, typed by domain/mail/lists.ts, since no CHECK holds it in the table. */
const OUT: Choice = 'out'

/** Each list's audience, as a query of one column, address. The newsletter's alone in part one. */
const AUDIENCES: Readonly<Record<string, string>> = { [NEWSLETTER_LIST_ID]: NEWSLETTER_AUDIENCE_SQL }

function audienceOf(listId: string): string {
  const audience = AUDIENCES[listId]
  if (audience === undefined) throw new Error('No audience is written for this list.')
  return audience
}

/**
 * The words an untried row of a stopped newsletter is failed with, which the history shows. Since WS16 step 7 they are
 * written in functions/utils/admin/campaigns.ts, which fails a row put back on a stopped send with them too and which
 * the daily-emails worker runs, and given here under the same name.
 */
export { STOPPED_WORDS }

/**
 * The newsletter's audience counted: every address in it, those whose person turned the newsletter off, those who
 * stopped all optional mail, those on the do-not-send list, and those who will get the next send, which is what is
 * left of the audience after the other three. One address can be in more than one of the three, so they need not add
 * up.
 */
export interface NewsletterCounts {
  addresses: number
  turnedOff: number
  stoppedAll: number
  doNotSend: number
  willGet: number
}

/** The newsletter's counts now. One query. */
export async function newsletterCounts(db: D1Database): Promise<NewsletterCounts> {
  const row = await db
    .prepare(
      `WITH audience(address) AS (${NEWSLETTER_AUDIENCE_SQL}),
            marks AS (
              SELECT EXISTS (SELECT 1 FROM mail_contacts c JOIN mail_list_choices ch ON ch.contact_id = c.id
                              WHERE c.address = a.address AND ch.list_id = ?1 AND ch.choice = ?2) AS turned_off,
                     EXISTS (SELECT 1 FROM mail_contacts c WHERE c.address = a.address AND c.optional_off_at IS NOT NULL) AS stopped_all,
                     EXISTS (SELECT 1 FROM mail_do_not_send d WHERE d.address = a.address) AS dead
                FROM audience a)
       SELECT COUNT(*) AS addresses,
              COALESCE(SUM(turned_off), 0) AS turned_off,
              COALESCE(SUM(stopped_all), 0) AS stopped_all,
              COALESCE(SUM(dead), 0) AS dead,
              COALESCE(SUM(turned_off = 0 AND stopped_all = 0 AND dead = 0), 0) AS will_get
         FROM marks`,
    )
    .bind(NEWSLETTER_LIST_ID, OUT)
    .first<{ addresses: number; turned_off: number; stopped_all: number; dead: number; will_get: number }>()
  return {
    addresses: row?.addresses ?? 0,
    turnedOff: row?.turned_off ?? 0,
    stoppedAll: row?.stopped_all ?? 0,
    doNotSend: row?.dead ?? 0,
    willGet: row?.will_get ?? 0,
  }
}

/** One newsletter send in the newsletter's own history. Its status is one of the three migration 0021's CHECK allows. */
export interface NewsletterSend {
  id: string
  subject: string
  totalRecipients: number
  sentCount: number
  failedCount: number
  skippedCount: number
  status: 'sending' | 'completed' | 'failed'
  createdAt: string
  completedAt: string | null
}

/**
 * What the newsletter tab shows: the counts, the last 10 newsletter sends, newest first, and why the newsletter that is
 * sending waits, when it does. This is the newsletter's own history for everyone who may send it, since Group email's
 * history (GET /api/admin/campaigns) keeps requireMailer. Three queries.
 *
 * `waits` is the error words of the next untried row of the newsletter that is sending, the row a run would send next:
 * a list campaign that cannot go from a deployment, for its link key, its sender or a gate it cannot read, or that
 * waits for Amazon SES, writes its reason there (functions/utils/admin/campaigns.ts), and no other answer carries it.
 * Null when no newsletter is sending or that row holds no words.
 */
export async function newsletterSummary(db: D1Database): Promise<NewsletterCounts & { recent: NewsletterSend[]; waits: string | null }> {
  const counts = await newsletterCounts(db)
  const { results } = await db
    .prepare(
      `SELECT id, subject, total_recipients, sent_count, failed_count, skipped_count, status, created_at, completed_at
         FROM email_campaigns WHERE list_id = ?1
        ORDER BY created_at DESC, rowid DESC LIMIT 10`,
    )
    .bind(NEWSLETTER_LIST_ID)
    .all<{
      id: string; subject: string; total_recipients: number; sent_count: number; failed_count: number; skipped_count: number
      status: NewsletterSend['status']; created_at: string; completed_at: string | null
    }>()
  // The sending newsletter as sendingListCampaign reads it, and its next untried row as the campaign sender picks it.
  const next = await db
    .prepare(
      `SELECT r.error AS error
         FROM email_campaign_recipients r
        WHERE r.campaign_id = (SELECT id FROM email_campaigns WHERE list_id = ?1 AND status = 'sending' ORDER BY created_at, rowid LIMIT 1)
          AND r.status = 'pending' AND r.sending_at IS NULL
        ORDER BY r.rowid LIMIT 1`,
    )
    .bind(NEWSLETTER_LIST_ID)
    .first<{ error: string | null }>()
  return {
    ...counts,
    waits: next?.error ?? null,
    recent: (results ?? []).map((row) => ({
      id: row.id,
      subject: row.subject,
      totalRecipients: row.total_recipients,
      sentCount: row.sent_count,
      failedCount: row.failed_count,
      skippedCount: row.skipped_count,
      status: row.status,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    })),
  }
}

/**
 * Makes one send on a list, in one db.batch, which D1 runs as one transaction and counts as one query:
 * - the campaign row, inserted only while no other send on the list is sending, so two presses at the same moment make
 *   one: id `campaign-${Date.now().toString(36)}` as Group email's, status 'sending', the list's id, and in filter_json
 *   the list and the 16 characters of the link key it was made with (linkKeyCheck in ./links);
 * - a contact for every address of the audience that has none yet, which puts the address on no list;
 * - a recipient row for each contact whose address is in the audience, has no 'out' on the list, has not stopped all
 *   optional mail and is not on the do-not-send list, in the order of the addresses. The recipients are the audience
 *   alone: a choice never adds an address to the newsletter (K's rule, decision 28), and a spam report's mark does not
 *   keep anyone off it, since both of LCA's lists are main mailers and a report made on the newsletter wrote an 'out';
 * - the campaign's total, counted from its rows.
 * Each statement after the first writes only when the first made the campaign. Answers null when it did not.
 */
export async function createListCampaign(
  db: D1Database,
  args: { listId: string; subject: string; bodyHtml: string; createdBy: string; linkCheck: string },
): Promise<{ campaignId: string; totalRecipients: number } | null> {
  const audience = audienceOf(args.listId)
  const campaignId = `campaign-${Date.now().toString(36)}`
  const made = 'EXISTS (SELECT 1 FROM email_campaigns WHERE id = ?1 AND list_id = ?2)'
  const results = await db.batch([
    db
      .prepare(
        `INSERT INTO email_campaigns (id, subject, body_html, filter_json, total_recipients, created_by, status, list_id)
         SELECT ?1, ?3, ?4, ?5, 0, ?6, 'sending', ?2
          WHERE NOT EXISTS (SELECT 1 FROM email_campaigns WHERE list_id = ?2 AND status = 'sending')`,
      )
      .bind(campaignId, args.listId, args.subject, args.bodyHtml, JSON.stringify({ list: args.listId, linkCheck: args.linkCheck }), args.createdBy),
    db
      .prepare(
        `INSERT OR IGNORE INTO mail_contacts (id, address)
         SELECT lower(hex(randomblob(16))), a.address FROM (${audience}) a WHERE ${made}`,
      )
      .bind(campaignId, args.listId),
    // OR IGNORE: a second press in the same millisecond carries the same campaign id and finds the rows already there.
    db
      .prepare(
        `INSERT OR IGNORE INTO email_campaign_recipients (id, campaign_id, member_id, email, contact_id)
         SELECT 'rcpt-' || ?1 || '-' || c.id, ?1, NULL, c.address, c.id
           FROM mail_contacts c
          WHERE ${made}
            AND c.address IN (${audience})
            AND NOT EXISTS (SELECT 1 FROM mail_list_choices ch WHERE ch.contact_id = c.id AND ch.list_id = ?2 AND ch.choice = ?3)
            AND c.optional_off_at IS NULL
            AND NOT EXISTS (SELECT 1 FROM mail_do_not_send d WHERE d.address = c.address)
          ORDER BY c.address`,
      )
      .bind(campaignId, args.listId, OUT),
    db
      .prepare(`UPDATE email_campaigns SET total_recipients = (SELECT COUNT(*) FROM email_campaign_recipients WHERE campaign_id = ?1) WHERE id = ?1 AND list_id = ?2`)
      .bind(campaignId, args.listId),
  ])
  if (!results[0]?.meta.changes) return null
  return { campaignId, totalRecipients: results[2]?.meta.changes ?? 0 }
}

/** The send on a list that is sending now, if any: its id and its subject. One query. */
export async function sendingListCampaign(db: D1Database, listId: string): Promise<{ id: string; subject: string } | null> {
  return db
    .prepare(`SELECT id, subject FROM email_campaigns WHERE list_id = ?1 AND status = 'sending' ORDER BY created_at, rowid LIMIT 1`)
    .bind(listId)
    .first<{ id: string; subject: string }>()
}

/**
 * Stops the send on a list that is sending, in one db.batch: its untried rows (pending, and not marked sending) are
 * failed with STOPPED_WORDS and counted in failed_count, and the send is closed as the campaign sender closes one,
 * 'completed', or 'failed' when nothing went, so the sweep and the next send pass over it. A row already marked sending
 * is left to its run, which sends it; a run that holds rows it has not marked finds them failed and sends none of
 * them. Answers the number of rows stopped, or null when nothing on the list was sending.
 */
export async function stopListCampaign(db: D1Database, listId: string): Promise<number | null> {
  const results = await db.batch([
    db
      .prepare(
        `UPDATE email_campaigns
            SET failed_count = failed_count + (SELECT COUNT(*) FROM email_campaign_recipients r
                                                WHERE r.campaign_id = email_campaigns.id AND r.status = 'pending' AND r.sending_at IS NULL)
          WHERE list_id = ?1 AND status = 'sending'`,
      )
      .bind(listId),
    db
      .prepare(
        `UPDATE email_campaign_recipients SET status = 'failed', error = ?2
          WHERE status = 'pending' AND sending_at IS NULL
            AND campaign_id IN (SELECT id FROM email_campaigns WHERE list_id = ?1 AND status = 'sending')`,
      )
      .bind(listId, STOPPED_WORDS),
    db
      .prepare(
        `UPDATE email_campaigns
            SET status = CASE WHEN sent_count = 0 AND failed_count > 0 THEN 'failed' ELSE 'completed' END,
                completed_at = datetime('now')
          WHERE list_id = ?1 AND status = 'sending'`,
      )
      .bind(listId),
  ])
  if (!results[2]?.meta.changes) return null
  return results[1]?.meta.changes ?? 0
}

/**
 * The three statements the member delete (functions/api/admin/members/[id].ts) runs in one batch once the member's row
 * is gone, so a person whose account an LCA admin deletes is not sent the newsletter that is sending: that send's rows
 * for the deleted account's address that are pending and not marked sending, when no account in the newsletter's
 * audience holds the address any more, by the audience clause above, are counted into skipped_count and taken out, and
 * the send's total is counted again from its rows, as a list campaign's total always is. A family's address stays
 * while another account on it holds an active membership, and a row a run has marked is left to that run. With no
 * newsletter sending, or no row for the address, they change nothing. Each statement uses the audience clause at most
 * once.
 */
export function leaveSendingNewsletter(db: D1Database, email: string | null): D1PreparedStatement[] {
  const sending = (list: string) => `list_id = ${list} AND status = 'sending'`
  const leaving = (row: string) =>
    `${row}status = 'pending' AND ${row}sending_at IS NULL AND ${row}email = lower(trim(?1, ${SPACES})) AND NOT ${inNewsletterAudienceSql(`${row}email`)}`
  return [
    db
      .prepare(
        `UPDATE email_campaigns
            SET skipped_count = skipped_count + (SELECT COUNT(*) FROM email_campaign_recipients r WHERE r.campaign_id = email_campaigns.id AND ${leaving('r.')})
          WHERE ${sending('?2')}`,
      )
      .bind(email, NEWSLETTER_LIST_ID),
    db
      .prepare(
        `DELETE FROM email_campaign_recipients
          WHERE ${leaving('email_campaign_recipients.')} AND campaign_id IN (SELECT id FROM email_campaigns WHERE ${sending('?2')})`,
      )
      .bind(email, NEWSLETTER_LIST_ID),
    db
      .prepare(`UPDATE email_campaigns SET total_recipients = (SELECT COUNT(*) FROM email_campaign_recipients r WHERE r.campaign_id = email_campaigns.id) WHERE ${sending('?1')}`)
      .bind(NEWSLETTER_LIST_ID),
  ]
}

/**
 * The statement the member delete runs in the same batch, after leaveSendingNewsletter's three (checkpoint M's review):
 * the contact of the deleted account's address is removed when no member's account holds the address any more and the
 * contact holds nothing, no choice on any list, no stop-all and no spam report's mark, since a contact that holds
 * nothing serves no purpose once nobody holds the address. A contact that holds any of them stays: a choice and a
 * stop-all are the person's own word, and a report's mark must outlive the account. With no contact for the address,
 * which is always while MAIL_LISTS_ON is unset and no list email or test was ever sent, it changes nothing.
 */
export function forgetEmptyContact(db: D1Database, email: string | null): D1PreparedStatement {
  return db
    .prepare(
      `DELETE FROM mail_contacts
        WHERE address = lower(trim(?1, ${SPACES}))
          AND optional_off_at IS NULL AND complained_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM mail_list_choices c WHERE c.contact_id = mail_contacts.id)
          AND NOT EXISTS (SELECT 1 FROM members m WHERE ${MEMBER_ADDRESS} = mail_contacts.address)`,
    )
    .bind(email)
}

/**
 * The statement that makes the contact for one address when it has none, which puts the address on no list: its id 32
 * random hex characters. contactFor runs it on its own, and the receiver of Amazon's reports in the batch of a spam
 * report (./sesEvents, WS16 step 8), so every contact is made the one way.
 */
export function makeContact(db: D1Database, address: string): D1PreparedStatement {
  return db.prepare('INSERT OR IGNORE INTO mail_contacts (id, address) VALUES (lower(hex(randomblob(16))), ?1)').bind(address)
}

/**
 * The contact for one address, made when it has none, which puts the address on no list: a test send carries the real
 * links for the address it goes to. Two queries.
 */
export async function contactFor(db: D1Database, address: string): Promise<string> {
  await makeContact(db, address).run()
  const row = await db.prepare('SELECT id FROM mail_contacts WHERE address = ?1').bind(address).first<{ id: string }>()
  if (!row) throw new Error('The contact could not be made.')
  return row.id
}
