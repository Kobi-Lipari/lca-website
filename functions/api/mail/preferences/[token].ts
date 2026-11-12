// functions/api/mail/preferences/[token].ts
//
// GET and PATCH /api/mail/preferences/:token: the person's email choices,
// for the email preferences page (WS16 step 5) that the link under every
// optional email opens. Public, signed, with no sign-in and no cookie: the
// person comes from the token alone (functions/utils/mail/links.ts). Its
// contracts are in domain/contracts/mail.ts.
//
// GET answers the address, masked, the lists the person is on, each on or
// off, and their own "Stop all optional email from LCA":
// - the LCA newsletter is listed only while the address is in its audience,
//   an address on an account with an active membership (K's rule, written
//   once in functions/utils/mail/lists.ts), whatever choice the person holds
//   on it; any other list is listed when the person holds a choice on it
//   (none in part one until WS16 step 11);
// - a list is off when the person's choice on it is 'out', or, for a list
//   that is not one of LCA's main mailers, while a spam report's mark stops
//   it: the gate's own rule (complaintStops in functions/utils/mail/gate.ts);
// - optionalOff is the person's own mark only.
//
// PATCH takes { lists?: { [id]: boolean }, optionalOff?: boolean }. A list
// the GET would not show is 400 and nothing is written, so an address
// outside the newsletter's audience can never turn the newsletter on. On
// takes the list's 'out' away; for a list that is not a main mailer, a
// person with a spam report's mark gets an 'in' too, so their own newer
// choice lifts the mark for that list, unless the gate already reads an
// 'in' of theirs as newer than the mark. On one of LCA's main mailers,
// whose audience alone decides who gets them, an 'in' is written only in
// place of an 'out' a spam report wrote (since checkpoint M's review), so a
// later copy of that report, which Amazon may deliver up to the receiver's
// three hours after, finds the person's newer choice and leaves it. Off
// writes 'out'. optionalOff true marks the stop-all and false clears it,
// leaving the list choices as they are. The writes go in one batch, and
// the answer is the GET's.
//
// Every answer is 404 "This link isn't working." unless the links are live
// (MAIL_LISTS_ON, or a list email on record) and the token verifies, for a
// contact that exists. Every answer carries Cache-Control: no-store.
import type { Env } from '../../../types'
import { maskAddress } from '../../../../domain/mail/address'
import { NEWSLETTER_LIST_ID, type Choice, type ChoiceSource } from '../../../../domain/mail/lists'
import { backInSql, complaintStops } from '../../../utils/mail/gate'
import { linkAnswer, linkNotWorking, linkOptions, noStore, openLink, tokenOf, type LinkContact } from '../../../utils/mail/linkAnswers'
import { inNewsletterAudienceSql } from '../../../utils/mail/lists'
import { parseBody } from '../../../utils/response'
import { emailChoicesRequestSchema, type EmailChoicesResponse } from '../../../../domain/contracts/mail'

/** The values the choices are written with, typed by domain/mail/lists.ts, since no CHECK holds them in the table. */
const IN: Choice = 'in'
const OUT: Choice = 'out'
const FROM_PAGE: ChoiceSource = 'preferences'
/** The source of a choice a spam report wrote (functions/utils/mail/sesEvents.ts). */
const FROM_REPORT: ChoiceSource = 'complaint'

/** One list the person is on, as the query reads it. */
interface ListRow {
  id: string
  name: string
  main_mailer: number
  choice: string | null
  /** Who wrote the choice: the person, from a link or this page, or a spam report ('complaint'). */
  source: string | null
  back_in: number
}

/** The lists the GET shows for a contact: the newsletter while the address is in its audience, and every list the person holds a choice on. */
async function listsShown(db: D1Database, contactId: string): Promise<ListRow[]> {
  const { results } = await db
    .prepare(
      `SELECT l.id AS id, l.name AS name, l.main_mailer AS main_mailer, ch.choice AS choice, ch.source AS source,
              ${backInSql('ch', 'c')} AS back_in
         FROM mail_contacts c
         CROSS JOIN mail_lists l
         LEFT JOIN mail_list_choices ch ON ch.contact_id = c.id AND ch.list_id = l.id
        WHERE c.id = ?1
          AND CASE WHEN l.id = ?2 THEN ${inNewsletterAudienceSql('c.address')} ELSE ch.contact_id IS NOT NULL END
        ORDER BY l.id = ?2 DESC, l.name, l.id`,
    )
    .bind(contactId, NEWSLETTER_LIST_ID)
    .all<ListRow>()
  return results ?? []
}

/** Whether a list reads as on: no 'out' from the person, and no spam report's mark that stops it. */
function isOn(contact: LinkContact, row: ListRow): boolean {
  return row.choice !== OUT && !complaintStops(contact.complained_at !== null, row.main_mailer === 1, row.back_in === 1)
}

/** The GET's answer for a contact. */
async function choicesOf(db: D1Database, contact: LinkContact): Promise<EmailChoicesResponse> {
  const lists = await listsShown(db, contact.id)
  return {
    address: maskAddress(contact.address),
    lists: lists.map((row) => ({ id: row.id, name: row.name, on: isOn(contact, row) })),
    optionalOff: contact.optional_off_at !== null,
  }
}

/** The contact as it is now, after a write. */
async function contactNow(db: D1Database, id: string): Promise<LinkContact | null> {
  return db.prepare('SELECT id, address, optional_off_at, complained_at FROM mail_contacts WHERE id = ?').bind(id).first<LinkContact>()
}

/** The statement that writes the person's own 'in' on one list, now, over any choice on record. */
function writeIn(db: D1Database, contact: LinkContact, row: ListRow): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO mail_list_choices (contact_id, list_id, choice, source) VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT (contact_id, list_id) DO UPDATE SET choice = ?3, source = ?4, updated_at = datetime('now')`,
    )
    .bind(contact.id, row.id, IN, FROM_PAGE)
}

/**
 * The statement that turns one list on for the person, or null when there is nothing to write. For a list that is not
 * a main mailer, a person with a spam report's mark gets an 'in' of their own, newer than the mark, which lifts it for
 * this list; when the gate already reads an 'in' of theirs as newer than the mark (back_in, from backInSql in
 * functions/utils/mail/gate.ts), it is left as it is, so the rule is the gate's alone. Where the 'out' being turned
 * back on was written by a spam report (its source 'complaint'), the person's 'in' is written in its place, at this
 * moment, so a later copy of the same report finds a newer choice and leaves it (checkpoint M's review). Anyone else
 * has the list's 'out' taken away, as before.
 */
function turnOn(db: D1Database, contact: LinkContact, row: ListRow): D1PreparedStatement | null {
  if (row.main_mailer !== 1 && contact.complained_at !== null) {
    if (row.back_in === 1) return null
    return writeIn(db, contact, row)
  }
  if (row.choice === OUT && row.source === FROM_REPORT) return writeIn(db, contact, row)
  return db.prepare('DELETE FROM mail_list_choices WHERE contact_id = ? AND list_id = ? AND choice = ?').bind(contact.id, row.id, OUT)
}

/** The statement that turns one list off for the person; nothing changes for a list already off by their choice. */
function turnOff(db: D1Database, contact: LinkContact, row: ListRow): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO mail_list_choices (contact_id, list_id, choice, source) VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT (contact_id, list_id) DO UPDATE SET choice = ?3, source = ?4, updated_at = datetime('now')
       WHERE choice <> ?3`,
    )
    .bind(contact.id, row.id, OUT, FROM_PAGE)
}

export const onRequestOptions: PagesFunction<Env> = async () => linkOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const opened = await openLink(context.env, tokenOf(context.params), 'preferences')
  if (!opened) return linkNotWorking()
  return linkAnswer(await choicesOf(context.env.DB, opened.contact))
}

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const db = context.env.DB
  const opened = await openLink(context.env, tokenOf(context.params), 'preferences')
  if (!opened) return linkNotWorking()
  const change = await parseBody(context.request, emailChoicesRequestSchema)
  if (change instanceof Response) return noStore(change)

  const { contact } = opened
  const shown = new Map((await listsShown(db, contact.id)).map((row) => [row.id, row]))
  const asked = Object.entries(change.lists ?? {})
  if (asked.some(([id]) => !shown.has(id))) return linkAnswer({ error: 'That list is not one of yours.' }, 400)

  const writes = asked
    .map(([id, on]) => (on ? turnOn(db, contact, shown.get(id)!) : turnOff(db, contact, shown.get(id)!)))
    .filter((statement): statement is D1PreparedStatement => statement !== null)
  if (change.optionalOff === true) {
    writes.push(db.prepare(`UPDATE mail_contacts SET optional_off_at = COALESCE(optional_off_at, datetime('now')) WHERE id = ?`).bind(contact.id))
  } else if (change.optionalOff === false) {
    writes.push(db.prepare('UPDATE mail_contacts SET optional_off_at = NULL WHERE id = ?').bind(contact.id))
  }
  if (writes.length > 0) await db.batch(writes)

  const now = await contactNow(db, contact.id)
  if (!now) return linkNotWorking()
  return linkAnswer(await choicesOf(db, now))
}
