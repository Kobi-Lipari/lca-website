// functions/utils/mail/issues.ts
//
// The newsletter's letters (WS16 part two, page step 3), on the table
// newsletter_issues of migration 0061 (functions/db/schema.ts says what each
// column holds): a list's open letter, its save, the start of a new one and
// the last ones. The four methods under functions/api/admin/mail/newsletter/
// call these behind requireListMailer and MAIL_PAGE_ON.
//
// - One open letter for a list: campaign_id and set_aside_at both empty,
//   held by the unique index newsletter_issues_one_open, and each insert
//   carries its own NOT EXISTS, as createListCampaign's insert does, so two
//   first writes at once make one letter and the other is told who made it.
// - Every write moves the version by one and requires the version it was
//   given, so a write made from an older read changes nothing and is
//   answered with who wrote last and when: the name read from members at
//   each read, never copied, and null once that account is gone.
// - What is stored is always the cleaner's own output (cleanLetterHtml):
//   the input bounded before cleaning, the cleaned letter held to
//   LETTER_MAX_BYTES, and a letter whose first heading is a smaller one
//   refused, so the email's outline never skips a level.
// - No row is deleted. A new letter sets the open one aside, its words
//   kept, when it holds any words; an open letter that holds none is reused
//   in place, as the new letter, its version moved. A start whose letter was
//   sent or set aside after it was read writes nothing and is answered with
//   who did it and when, as a save is, and never with an error.
// Nothing here sends anything, and no table but newsletter_issues is
// written. A save writes no activity row: the letter's own row says who
// saved it last and when.
import { LETTER_MAX_BYTES, STARTERS, STARTER_IDS, defaultSubject, type StarterId } from '../../../domain/mail/letter'
import { cleanLetterHtml } from './letterClean'

/**
 * The answer of each of the page's four methods while MAIL_PAGE_ON is unset, given before the request, the session or
 * the database is read, and of a letter or a send that is not the list's, whether or not it is another's: the
 * newsletter tab's own 404, under the page's name.
 */
export { newsletterNotFound as pageNotFound } from './newsletterAnswers'

/** The most UTF-8 bytes a letter sent to be saved may hold before it is cleaned: three times the cap, to bound the work. */
export const LETTER_INPUT_MAX_BYTES = 3 * LETTER_MAX_BYTES

/** The refusals of a letter's words, each said once. The save's and the start's differ only in which letter they name. */
export const LETTER_TOO_LONG = 'This letter is too long for one email. Make it shorter, then save again.'
export const LETTER_NOT_CLEAN = 'This letter holds something an email cannot keep. Take out what was pasted from another page, then save again.'
export const LETTER_STARTS_SMALL = 'This letter has a smaller heading before its first main heading. Start it with a main heading, then save again.'
export const SOURCE_TOO_LONG = 'That newsletter is too long for one email, so a letter cannot be started from it.'
export const SOURCE_NOT_CLEAN = 'That newsletter holds something an email cannot keep, so a letter cannot be started from it.'
export const SOURCE_STARTS_SMALL = 'That newsletter has a smaller heading before its first main heading, so a letter cannot be started from it.'

/** The 409's words: a save refused, with nothing written, and why. */
export const CHANGED_SINCE_READ = 'Someone saved this letter after you opened it, so your words were not saved.'
export const SENT_SINCE_READ = 'This letter was sent after you opened it, so your words were not saved.'
export const SET_ASIDE_SINCE_READ = 'A new letter took this one\'s place after you opened it, so your words were not saved.'
/** A start refused, with nothing written: someone wrote to the open letter, or made one, as it was started. */
export const CHANGED_WHILE_STARTING = 'Someone saved the newsletter\'s letter just now, so no new letter was started. Look at their letter, then try again.'
/** A start refused, with nothing written: the letter it read was sent before it could write. */
export const SENT_WHILE_STARTING = 'The newsletter\'s letter was sent just now, so no new letter was started. Try again to start the next one.'

/** One letter, as the contracts give it (newsletterLetterSchema). */
export interface Letter {
  id: string
  version: number
  monthLabel: string
  subject: string
  preheader: string
  bodyHtml: string
  createdAt: string
  updatedAt: string
}

/** A list's open letter, with the name of who wrote to it last and when. */
export interface OpenIssue {
  letter: Letter
  lastSavedBy: string | null
  lastSavedAt: string
}

/** Why a write changed nothing, who made the change it lost to, by name, and when. */
export interface Refusal {
  reason: 'changed' | 'sent' | 'set_aside'
  changedBy: string | null
  changedAt: string
}

/** A letter's words refused before anything is written: the status and the words to answer with. */
export interface LetterRefusal {
  status: 400 | 413
  error: string
}

interface LetterRow {
  id: string
  version: number
  month_label: string
  subject: string
  preheader: string
  body_html: string
  created_at: string
  updated_at: string
  saved_by: string | null
}

/** The open letter's columns and its last writer's name, as the reads below select them from `i`, joined to members as `m`. */
const LETTER_COLUMNS = 'i.id, i.version, i.month_label, i.subject, i.preheader, i.body_html, i.created_at, i.updated_at, m.full_name AS saved_by'
/** A list's open letter, as the unique index holds it. */
const OPEN = 'i.campaign_id IS NULL AND i.set_aside_at IS NULL'

/** A name as an account holds it, or null for an account that is gone or holds none. */
const nameOf = (name: string | null | undefined): string | null => (typeof name === 'string' && name.trim() !== '' ? name : null)

function openOf(row: LetterRow): OpenIssue {
  return {
    letter: {
      id: row.id,
      version: row.version,
      monthLabel: row.month_label,
      subject: row.subject,
      preheader: row.preheader,
      bodyHtml: row.body_html,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
    lastSavedBy: nameOf(row.saved_by),
    lastSavedAt: row.updated_at,
  }
}

const openStatement = (db: D1Database, listId: string) =>
  db.prepare(`SELECT ${LETTER_COLUMNS} FROM newsletter_issues i LEFT JOIN members m ON m.id = i.updated_by WHERE i.list_id = ?1 AND ${OPEN}`).bind(listId)

/** A list's open letter, or null when it has none. One query. */
export async function openIssue(db: D1Database, listId: string): Promise<OpenIssue | null> {
  const row = await openStatement(db, listId).first<LetterRow>()
  return row ? openOf(row) : null
}

/** Whether a cleaned letter's first heading is a smaller one: an h3 with no h2 before it. The cleaner writes each heading exactly as <h2> or <h3>. */
export function startsWithSmallHeading(cleaned: string): boolean {
  const small = cleaned.indexOf('<h3>')
  const main = cleaned.indexOf('<h2>')
  return small !== -1 && (main === -1 || small < main)
}

/**
 * Whether a cleaned letter's body is one of LCA's starters exactly as a start writes it (starterLetter), untouched, once
 * what an editor may write its own way is dropped, and nothing else: every line break, every run of spaces between two
 * tags, and then every empty paragraph. What is left must be the starter's headings alone, each an h2 holding nothing
 * but its own words, in the starter's order. Anything else is not untouched, a hidden space among it. A "<" that is a
 * word is read before anything is dropped: in the cleaner's own form every "<" before a lower-case letter or "/" starts
 * one of its tags, and any other "<" is a word, which no starter holds. Read after the drops, a "<" typed just before a
 * line break would join the words after it and pass for a tag.
 */
function untouchedStarter(body: string): boolean {
  if (/<(?![a-z/])/.test(body)) return false
  const asStarted = (html: string) =>
    html
      .replace(/<br>/g, '')
      .replace(/(<\/?[a-z][a-z0-9]*(?: [^<>]*)?>)[ \t\n\f\r]+(?=<\/?[a-z])/g, '$1')
      .replace(/<p><\/p>/g, '')
  const form = asStarted(body)
  return STARTER_IDS.some((id) => form === asStarted(starterLetter(id)))
}

/**
 * Whether a letter holds anything a person wrote: words in its body, its headings among them, an inbox preview line, or
 * a subject other than its month's. The body is a cleaned letter, so only the kept tags, as the cleaner writes them,
 * are taken out; a "<" that is a word stays a word. A body that is one of LCA's starters untouched (untouchedStarter)
 * holds nothing a person wrote, so a start reuses that letter as it reuses a blank one. Where the words came from is
 * not read: a copy of a past letter or a send that nobody touched is set aside like any letter that holds words, kept
 * rather than guessed at. A copy whose words are themselves a starter's headings untouched reads as that starter and
 * is reused; its source is kept.
 */
export function holdsWords(letter: Pick<Letter, 'monthLabel' | 'subject' | 'preheader' | 'bodyHtml'>): boolean {
  const words = letter.bodyHtml
    .replace(/<\/?(?:p|br|strong|em|h2|h3|ul|ol|li|hr|a)(?: [^<>]*)?>/g, ' ')
    .replace(/&nbsp;|&#160;|&#xa0;/gi, ' ')
    .trim()
  if (words !== '' && !untouchedStarter(letter.bodyHtml)) return true
  if (letter.preheader.trim() !== '') return true
  return letter.subject.trim() !== '' && letter.subject !== defaultSubject(letter.monthLabel)
}

/** A starter's letter: each of its headings as an h2 with an empty paragraph under it, as the editor writes a part; '' for one with none. */
export function starterLetter(id: StarterId): string {
  const text = (words: string) => words.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return STARTERS[id].headings.map((heading) => `<h2>${text(heading)}</h2><p></p>`).join('')
}

/**
 * A letter's words as they would be stored, in this order, or why not: over LETTER_INPUT_MAX_BYTES in UTF-8 before
 * cleaning; one the cleaner answers null for; a cleaned letter over LETTER_MAX_BYTES; and one whose first heading is a
 * smaller one. `words` gives the refusals for the letter being saved, or for the newsletter a letter is started from.
 */
export async function cleanedLetter(html: string, words: 'save' | 'start' = 'save'): Promise<{ cleaned: string } | { refused: LetterRefusal }> {
  const save = words === 'save'
  const bytes = (text: string) => new TextEncoder().encode(text).byteLength
  if (bytes(html) > LETTER_INPUT_MAX_BYTES) return { refused: { status: 413, error: save ? LETTER_TOO_LONG : SOURCE_TOO_LONG } }
  const cleaned = await cleanLetterHtml(html)
  if (cleaned === null) return { refused: { status: 400, error: save ? LETTER_NOT_CLEAN : SOURCE_NOT_CLEAN } }
  if (bytes(cleaned) > LETTER_MAX_BYTES) return { refused: { status: 413, error: save ? LETTER_TOO_LONG : SOURCE_TOO_LONG } }
  if (startsWithSmallHeading(cleaned)) return { refused: { status: 400, error: save ? LETTER_STARTS_SMALL : SOURCE_STARTS_SMALL } }
  return { cleaned }
}

/** The 409's words for a refusal's reason. */
export function refusalWords(reason: Refusal['reason']): string {
  return reason === 'sent' ? SENT_SINCE_READ : reason === 'set_aside' ? SET_ASIDE_SINCE_READ : CHANGED_SINCE_READ
}

/** A start's 409 words for a refusal's reason: a letter sent as it was started has its own, and any other is a write to the letter. */
export function startRefusalWords(reason: Refusal['reason']): string {
  return reason === 'sent' ? SENT_WHILE_STARTING : CHANGED_WHILE_STARTING
}

/** A letter's state as a write that changed nothing reads it: its last write, its send or its setting aside, and who did each. */
interface StateRow {
  version: number
  updated_at: string
  campaign_id: string | null
  set_aside_at: string | null
  saved_by: string | null
  sent_at: string | null
  sent_by: string | null
}

/** One letter of a list by its id, as StateRow, with its last writer's name and its send's maker and time; nothing for a letter not the list's. */
const stateStatement = (db: D1Database, id: string, listId: string) =>
  db
    .prepare(
      `SELECT i.version, i.updated_at, i.campaign_id, i.set_aside_at, m.full_name AS saved_by, c.created_at AS sent_at, s.full_name AS sent_by
         FROM newsletter_issues i
         LEFT JOIN members m ON m.id = i.updated_by
         LEFT JOIN email_campaigns c ON c.id = i.campaign_id
         LEFT JOIN members s ON s.id = c.created_by
        WHERE i.id = ?1 AND i.list_id = ?2`,
    )
    .bind(id, listId)

/** Why a write to a letter changed nothing, as the letter now stands: it was sent, it was set aside, or it was written to since it was read. */
function refusalOf(row: StateRow): Refusal {
  if (row.campaign_id !== null) return { reason: 'sent', changedBy: nameOf(row.sent_by), changedAt: row.sent_at ?? row.updated_at }
  if (row.set_aside_at !== null) return { reason: 'set_aside', changedBy: nameOf(row.saved_by), changedAt: row.set_aside_at }
  return { reason: 'changed', changedBy: nameOf(row.saved_by), changedAt: row.updated_at }
}

export interface SaveArgs {
  listId: string
  /** The letter the page read, or null for the first save when it read none. */
  id: string | null
  /** The version the page read; not read when id is null. */
  version: number
  monthLabel: string
  subject: string
  preheader: string
  /** The letter as cleanedLetter answered it, never what the page sent. */
  bodyHtml: string
  /** The member saving it. */
  by: string
}

export type SaveResult =
  | { saved: { id: string; version: number; savedAt: string } }
  | { refused: Refusal }
  | { notFound: true }

/**
 * Saves the open letter of a list, in one db.batch, which D1 runs as one transaction: one statement that writes the
 * letter and its three plain fields WHERE id = ? AND version = ? AND campaign_id IS NULL AND set_aside_at IS NULL and
 * moves the version by one, then one read of the letter as it now stands. With id null the statement is the insert of
 * the list's open letter at version 1, WHERE NOT EXISTS an open letter for the list. When the statement changed nothing,
 * the read says why, and nothing was written: the letter is not this list's (not found), or it was sent, or set aside,
 * or written to since the version given ('changed'), each with who did it and when.
 */
export async function saveIssue(db: D1Database, args: SaveArgs): Promise<SaveResult> {
  if (args.id === null) {
    const [insert, read] = await db.batch([
      db
        .prepare(
          `INSERT INTO newsletter_issues (id, list_id, month_label, subject, preheader, body_html, version, created_by, updated_by)
           SELECT lower(hex(randomblob(16))), ?1, ?2, ?3, ?4, ?5, 1, ?6, ?6
            WHERE NOT EXISTS (SELECT 1 FROM newsletter_issues i WHERE i.list_id = ?1 AND ${OPEN})`,
        )
        .bind(args.listId, args.monthLabel, args.subject, args.preheader, args.bodyHtml, args.by),
      openStatement(db, args.listId),
    ])
    // The batch is one transaction, so the list now has an open letter: the one this insert made, or the one that kept
    // it from being made. Were it ever to have none, the save is answered as not found, never with an error.
    const row = (read.results as LetterRow[])[0]
    if (!row) return { notFound: true }
    if (insert.meta.changes === 1) return { saved: { id: row.id, version: row.version, savedAt: row.updated_at } }
    return { refused: { reason: 'changed', changedBy: nameOf(row.saved_by), changedAt: row.updated_at } }
  }

  const [update, read] = await db.batch([
    db
      .prepare(
        `UPDATE newsletter_issues
            SET month_label = ?4, subject = ?5, preheader = ?6, body_html = ?7, version = version + 1, updated_by = ?8, updated_at = datetime('now')
          WHERE id = ?1 AND list_id = ?2 AND version = ?3 AND campaign_id IS NULL AND set_aside_at IS NULL`,
      )
      .bind(args.id, args.listId, args.version, args.monthLabel, args.subject, args.preheader, args.bodyHtml, args.by),
    stateStatement(db, args.id, args.listId),
  ])
  const row = (read.results as StateRow[])[0]
  if (!row) return { notFound: true }
  if (update.meta.changes === 1) return { saved: { id: args.id, version: row.version, savedAt: row.updated_at } }
  return { refused: refusalOf(row) }
}

/** Where a new letter's words come from, as the start's contract reads it. */
export type StartFrom = StarterId | { issueId: string } | { campaignId: string }

export interface StartArgs {
  listId: string
  from: StartFrom
  /** The month the new letter is for, as the band writes it; its subject is that month's (defaultSubject). */
  monthLabel: string
  /** The member starting it. */
  by: string
}

export type StartResult =
  | { started: OpenIssue }
  | { refused: Refusal }
  | { letterRefused: LetterRefusal }
  | { notFound: true }

/** The words a new letter starts from, as stored before they are cleaned again: a starter's, a past letter's of the list, or a send's on the list. */
async function sourceWords(db: D1Database, listId: string, from: StartFrom): Promise<string | null> {
  if (typeof from === 'string') return starterLetter(from)
  if ('issueId' in from && typeof from.issueId === 'string') {
    const row = await db.prepare('SELECT body_html FROM newsletter_issues WHERE id = ?1 AND list_id = ?2').bind(from.issueId, listId).first<{ body_html: string }>()
    return row?.body_html ?? null
  }
  const campaignId = (from as { campaignId: string }).campaignId
  const row = await db.prepare('SELECT body_html FROM email_campaigns WHERE id = ?1 AND list_id = ?2').bind(campaignId, listId).first<{ body_html: string }>()
  return row?.body_html ?? null
}

/**
 * Starts a new letter for a list, from a blank letter, one of LCA's starters, a past letter of the list or a newsletter
 * sent on it, whose words are cleaned as they are copied and refused in words when cleanedLetter refuses them. A letter
 * or a send that is not this list's is not found, whether or not it is another's. Then one db.batch, one transaction:
 * - an open letter that holds words (holdsWords) is set aside, its words kept, with who did it and when and its version
 *   moved, only at the version read, and the new letter is inserted only once that letter is set aside and while the
 *   list then has no open letter;
 * - an open letter that holds none is reused in place: the new letter's words, month, subject and preview line are
 *   written over it, it is named as started by this member now, and its version moves, only at the version read;
 * - with no open letter, the new letter is inserted only while the list has none;
 * then one read of the open letter and, when a letter was open, one of that letter as it now stands. When the write made
 * nothing, the start is refused with who and when, nothing written: 'changed' when someone wrote to the open letter, or
 * made one, after it was read, and 'sent' or 'set_aside' when the letter read was sent or set aside since and nothing
 * took its place. The new letter's month is the one given, its subject that month's, and its preview line empty.
 */
export async function startIssue(db: D1Database, args: StartArgs): Promise<StartResult> {
  const words = await sourceWords(db, args.listId, args.from)
  if (words === null) return { notFound: true }
  const letter = await cleanedLetter(words, 'start')
  if ('refused' in letter) return { letterRefused: letter.refused }

  const subject = defaultSubject(args.monthLabel)
  const open = await openIssue(db, args.listId)
  /** The new letter, made only while the list has no open letter and, when it takes the place of `replaces`, only once that one is set aside. */
  const insert = (replaces: string | null) =>
    db
      .prepare(
        `INSERT INTO newsletter_issues (id, list_id, month_label, subject, preheader, body_html, version, created_by, updated_by)
         SELECT lower(hex(randomblob(16))), ?1, ?2, ?3, '', ?4, 1, ?5, ?5
          WHERE NOT EXISTS (SELECT 1 FROM newsletter_issues i WHERE i.list_id = ?1 AND ${OPEN})
            AND (?6 IS NULL OR EXISTS (SELECT 1 FROM newsletter_issues i WHERE i.id = ?6 AND i.set_aside_at IS NOT NULL))`,
      )
      .bind(args.listId, args.monthLabel, subject, letter.cleaned, args.by, replaces)

  let statements: D1PreparedStatement[]
  if (open === null) {
    statements = [insert(null)]
  } else if (holdsWords(open.letter)) {
    statements = [
      db
        .prepare(
          `UPDATE newsletter_issues
              SET set_aside_at = datetime('now'), version = version + 1, updated_by = ?4, updated_at = datetime('now')
            WHERE id = ?1 AND list_id = ?2 AND version = ?3 AND campaign_id IS NULL AND set_aside_at IS NULL`,
        )
        .bind(open.letter.id, args.listId, open.letter.version, args.by),
      insert(open.letter.id),
    ]
  } else {
    statements = [
      db
        .prepare(
          `UPDATE newsletter_issues
              SET month_label = ?4, subject = ?5, preheader = '', body_html = ?6, version = version + 1,
                  created_by = ?7, created_at = datetime('now'), updated_by = ?7, updated_at = datetime('now')
            WHERE id = ?1 AND list_id = ?2 AND version = ?3 AND campaign_id IS NULL AND set_aside_at IS NULL`,
        )
        .bind(open.letter.id, args.listId, open.letter.version, args.monthLabel, subject, letter.cleaned, args.by),
    ]
  }

  const reads = [openStatement(db, args.listId)]
  if (open !== null) reads.push(stateStatement(db, open.letter.id, args.listId))
  const results = await db.batch([...statements, ...reads])
  const wrote = results[statements.length - 1]?.meta.changes === 1
  const now = (results[statements.length]?.results as LetterRow[] | undefined)?.[0]
  if (now && wrote) return { started: openOf(now) }
  if (now) return { refused: { reason: 'changed', changedBy: nameOf(now.saved_by), changedAt: now.updated_at } }
  // Nothing was written and the list has no open letter: the letter read was sent, or set aside, after it was read, and
  // nothing took its place, so the start is refused with who did that and when, as a save to that letter would be.
  // Not found answers only what cannot happen, since the batch is one transaction and no row is ever deleted: no letter
  // read and none made, or the letter read gone. It is never an error.
  const read = open === null ? undefined : (results[statements.length + 1]?.results as StateRow[] | undefined)?.[0]
  return read ? { refused: refusalOf(read) } : { notFound: true }
}

/** One of the last newsletters, as the contracts give it (lastNewsletterSchema). */
export interface LastNewsletter {
  issueId: string | null
  campaignId: string | null
  monthLabel: string
  subject: string
  state: 'sending' | 'completed' | 'failed' | 'set_aside'
  at: string
  by: string | null
  totalRecipients: number | null
}

/**
 * The last newsletters of a list, at most 20, newest first, without their words: each letter sent, with its send's
 * status, time, sender and count; each letter set aside, with when and by whom; and each send on the list that has no
 * letter, a newsletter sent from the plain tab, with its own. Who is named as the open letter names a person. One query.
 */
export async function lastIssues(db: D1Database, listId: string): Promise<LastNewsletter[]> {
  const { results } = await db
    .prepare(
      `SELECT x.issue_id, x.campaign_id, x.month_label, x.subject, x.state, x.at, m.full_name AS by_name, x.total_recipients
         FROM (
           SELECT i.id AS issue_id, i.campaign_id AS campaign_id, i.month_label AS month_label, COALESCE(c.subject, i.subject) AS subject,
                  CASE WHEN i.campaign_id IS NULL THEN 'set_aside' ELSE COALESCE(c.status, 'completed') END AS state,
                  CASE WHEN i.campaign_id IS NULL THEN i.set_aside_at ELSE COALESCE(c.created_at, i.updated_at) END AS at,
                  CASE WHEN i.campaign_id IS NULL THEN i.updated_by ELSE c.created_by END AS by_id,
                  c.total_recipients AS total_recipients, i.rowid AS seq, 0 AS kind
             FROM newsletter_issues i LEFT JOIN email_campaigns c ON c.id = i.campaign_id
            WHERE i.list_id = ?1 AND (i.campaign_id IS NOT NULL OR i.set_aside_at IS NOT NULL)
           UNION ALL
           SELECT NULL, c.id, '', c.subject, c.status, c.created_at, c.created_by, c.total_recipients, c.rowid, 1
             FROM email_campaigns c
            WHERE c.list_id = ?1 AND NOT EXISTS (SELECT 1 FROM newsletter_issues i WHERE i.campaign_id = c.id)
         ) x
         LEFT JOIN members m ON m.id = x.by_id
        ORDER BY x.at DESC, x.seq DESC, x.kind
        LIMIT 20`,
    )
    .bind(listId)
    .all<{
      issue_id: string | null; campaign_id: string | null; month_label: string; subject: string; state: LastNewsletter['state']
      at: string; by_name: string | null; total_recipients: number | null
    }>()
  return (results ?? []).map((row) => ({
    issueId: row.issue_id,
    campaignId: row.campaign_id,
    monthLabel: row.month_label,
    subject: row.subject,
    state: row.state,
    at: row.at,
    by: nameOf(row.by_name),
    totalRecipients: row.total_recipients,
  }))
}
