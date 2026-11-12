// functions/utils/mail/sesEvents.ts
//
// Amazon SES's bounces and spam reports, applied to the site's own mail
// tables (migration 0060) once the receiver, functions/api/mail/ses-events.ts,
// has proved that the notification came from the topic K made (WS16 step
// 8). The rules are K's decisions 5 and 18 (D35):
// - A permanent bounce stops all mail to the address: one row of
//   mail_do_not_send with the address, 'bounce', the bounce's kind as Amazon
//   names it, and the time the row is written. A bounce Amazon names
//   EmailValidationSuppressed is the guess of Amazon's paid address
//   validation, not a dead mailbox, and changes nothing; so does a transient
//   or an undetermined bounce.
// - A spam report always stops the list it was pressed on, one of LCA's
//   main mailers included: the 'out' choice on that list, from 'complaint',
//   the list read from the tag the site itself set at the send (LIST_TAG in
//   ./ses). While COMPLAINT_STOPS_OTHER_SENDERS holds it also sets the
//   report's mark, complained_at, which stops the person's mail from every
//   list that is not one of LCA's main mailers until they turn that list
//   back on (complaintStops in ./gate). It never stops event or account
//   mail, and never sets the person's own stop-all, optional_off_at, which
//   only the person sets. A report whose feedback type is not-spam, a
//   provider's word that the person took the message out of the spam
//   folder, changes nothing; so does one with a complaintSubType, such as
//   OnAccountSuppressionList, which Amazon writes itself when it did not
//   try to send the message because the address was already on its own
//   suppression list, so the person reported nothing. A report's 'out'
//   never overrides a newer choice of the person's own on that list: it is
//   written only where there is no choice, or where the choice on record
//   is older than the report.
// - Every other kind of event changes nothing, and so does an event of any
//   account but the topic's own.
//
// A bounce stops the address the message was sent to, as Amazon's record of
// the send names it (mail.destination), and never one the bounce alone
// names: a bounced recipient's address is the Final-Recipient of the
// receiving server's report, which a server that forwards mail writes as
// the address it forwarded to and a server a stranger runs writes as it
// likes. A spam report's addresses are Amazon's own lookup of the send's
// recipients, and are read as they come. Each address is trimmed and
// lowercased as the gate reads it (normalizeAddress); one mail cannot reach
// is not written. Each write is one a second copy of the same notification
// leaves as it was: the bounce's row and the contact are INSERT OR IGNORE,
// the choice is written only where it is not already 'out' and is older
// than the report, and the mark only moves later, to the report's own time. All of one event's writes go
// in one db.batch. Nothing else of a notification is stored: no diagnostic
// code, no headers, no feedback report and no network address.

import { isSendableAddress, normalizeAddress } from '../../../domain/mail/address'
import type { Choice, ChoiceSource, DoNotSendReason } from '../../../domain/mail/lists'
import { makeContact } from './lists'
import { LIST_TAG } from './ses'
import { amazonTime } from './sns'

/** The values written, typed by domain/mail/lists.ts, since no CHECK holds them in the tables. */
const BOUNCE: DoNotSendReason = 'bounce'
const OUT: Choice = 'out'
const FROM_COMPLAINT: ChoiceSource = 'complaint'

/** The bounce's kind for the guess of Amazon's paid address validation, which is skipped. */
const VALIDATION_GUESS = 'EmailValidationSuppressed'

/** The feedback type of a report that says the message is not spam, which is skipped. */
const NOT_SPAM = 'not-spam'

/**
 * Whether a report is one Amazon made itself: a complaintSubType that is a word, OnAccountSuppressionList or
 * OnTenantSuppressionList, means Amazon did not try to send the message because the address was already on its own
 * suppression list, so the person reported nothing. Null or no subtype is the ordinary report.
 */
const amazonsOwn = (complaint: Fields) => typeof complaint.complaintSubType === 'string' && complaint.complaintSubType !== ''

/** The most addresses one event is read for: Amazon SES takes 50 recipients a message, and the site sends each message to one. */
export const MOST_ADDRESSES = 50

/** What the receiver reads of an event beside the notification itself. */
export interface SesEventArgs {
  /** The AWS account the topic's own name holds: an event of any other account's mail changes nothing. */
  accountId: string
  /** COMPLAINT_STOPS_OTHER_SENDERS, read by the caller at the call. */
  complaintStopsOtherSenders: boolean
  /** The notification's own Timestamp, signed by SNS: a report's time, its mark's and its choice's, is it when the report's own is missing or later. */
  publishedAt: number
}

/** What an event came to: the addresses written for each kind, and whether the event was left unread as not the site's. */
export interface SesEventResult {
  bounces: number
  complaints: number
  ignored: boolean
}

type Fields = Record<string, unknown>

const fieldsOf = (value: unknown): Fields | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Fields) : null

const NOTHING: SesEventResult = { bounces: 0, complaints: 0, ignored: false }

/** What a list of recipients names, each recipient's emailAddress, read no further than MOST_ADDRESSES. */
function namesOf(recipients: unknown): unknown[] {
  return Array.isArray(recipients) ? recipients.slice(0, MOST_ADDRESSES).map((recipient) => fieldsOf(recipient)?.emailAddress) : []
}

/** The distinct addresses among a list of names, as the mail tables keep them, read no further than MOST_ADDRESSES. */
function addressesIn(names: unknown): string[] {
  if (!Array.isArray(names)) return []
  const found = new Set<string>()
  for (const named of names.slice(0, MOST_ADDRESSES)) {
    if (typeof named !== 'string') continue
    const address = normalizeAddress(named)
    if (isSendableAddress(address)) found.add(address)
  }
  return [...found]
}

/**
 * The addresses a permanent bounce stops: those the message was sent to, as Amazon's record of the send,
 * mail.destination, names them, and never one only the bounce names, whose own names are the receiving server's
 * Final-Recipient. For a send of one recipient, as every message the site sends is, a bounce that names anyone stops
 * that recipient, whatever it names; for a send of several, each address the bounce names that the record names too;
 * and for a message whose record names no one, nothing.
 */
function bouncedOf(bounce: Fields, mail: Fields): string[] {
  const named = namesOf(bounce.bouncedRecipients).filter((name) => typeof name === 'string' && name.trim() !== '')
  if (named.length === 0) return []
  const sentTo = Array.isArray(mail.destination) ? mail.destination : []
  if (sentTo.length === 1) return addressesIn(sentTo)
  const recorded = new Set(addressesIn(sentTo))
  return addressesIn(named).filter((address) => recorded.has(address))
}

/** The list a message was sent on, from the tag the site set at the send: the first value of LIST_TAG, or null. */
function listOf(mail: Fields): string | null {
  const values = fieldsOf(mail.tags)?.[LIST_TAG]
  const first = Array.isArray(values) ? values[0] : undefined
  return typeof first === 'string' && first !== '' ? first : null
}

/** A report's time, as datetime('now') writes a time, which its mark and its choice take: the report's own, or the notification's when that is missing or later. */
function markOf(reported: unknown, publishedAt: number): string {
  const at = typeof reported === 'string' ? amazonTime(reported) : null
  const when = at === null || at > publishedAt ? publishedAt : at
  return new Date(when).toISOString().slice(0, 19).replace('T', ' ')
}

/** A bounce's row: the address, 'bounce' and the bounce's kind, or nothing when the row is there already. */
const BOUNCE_SQL = 'INSERT OR IGNORE INTO mail_do_not_send (address, reason, detail) VALUES (?1, ?2, ?3)'

/**
 * A report's choice on the list it was pressed on: 'out' from 'complaint', for the contact the batch has made, on a
 * list mail_lists holds, so a tag naming no list writes nothing. It is written where there is no choice, or where the
 * choice on record is older than the report, ?5, compared with julianday() as the mark and the gate compare, a time
 * that cannot be read counting as older; so a choice already 'out' is left as it was, and the person's own newer 'in'
 * wins over a report made before it, however late the report or a second copy of it comes. The row takes the report's
 * time as its updated_at, the time the person pressed the report: every choice of the person's own is written later
 * with datetime('now'), and no reader compares the time of an 'out', so a later 'in' by the person still wins.
 */
const CHOICE_SQL = `INSERT INTO mail_list_choices (contact_id, list_id, choice, source, updated_at)
  SELECT c.id, l.id, ?3, ?4, ?5 FROM mail_contacts c JOIN mail_lists l ON l.id = ?2 WHERE c.address = ?1
  ON CONFLICT (contact_id, list_id) DO UPDATE SET choice = ?3, source = ?4, updated_at = ?5
  WHERE choice <> ?3 AND (julianday(updated_at) IS NULL OR julianday(updated_at) < julianday(?5))`

/**
 * A report's mark, moved only later, compared with julianday() as the gate compares it, so a report delivered late
 * never moves the mark back and a second copy of the same report changes nothing.
 */
const MARK_SQL = `UPDATE mail_contacts SET complained_at = ?2
  WHERE address = ?1 AND (complained_at IS NULL OR julianday(complained_at) IS NULL OR julianday(complained_at) < julianday(?2))`

async function applyBounce(db: D1Database, bounce: Fields | null, mail: Fields): Promise<SesEventResult> {
  if (!bounce || bounce.bounceType !== 'Permanent' || bounce.bounceSubType === VALIDATION_GUESS) return NOTHING
  const addresses = bouncedOf(bounce, mail)
  if (addresses.length === 0) return NOTHING
  // The bounce's kind as Amazon names it, a word such as General or NoEmail, and nothing else of the notification.
  const kind = typeof bounce.bounceSubType === 'string' && /^[A-Za-z]{1,64}$/.test(bounce.bounceSubType) ? bounce.bounceSubType : null
  await db.batch(addresses.map((address) => db.prepare(BOUNCE_SQL).bind(address, BOUNCE, kind)))
  return { ...NOTHING, bounces: addresses.length }
}

async function applyComplaint(db: D1Database, complaint: Fields | null, mail: Fields, args: SesEventArgs): Promise<SesEventResult> {
  if (!complaint || amazonsOwn(complaint)) return NOTHING
  if (typeof complaint.complaintFeedbackType === 'string' && complaint.complaintFeedbackType.toLowerCase() === NOT_SPAM) return NOTHING
  const addresses = addressesIn(namesOf(complaint.complainedRecipients))
  const listId = listOf(mail)
  // The report's own time, worked out whatever the setting: the list's choice is held to it, and the mark takes it.
  const reportedAt = markOf(complaint.timestamp, args.publishedAt)
  const mark = args.complaintStopsOtherSenders ? reportedAt : null
  if (addresses.length === 0 || (listId === null && mark === null)) return NOTHING
  await db.batch(
    addresses.flatMap((address) => [
      makeContact(db, address),
      ...(listId === null ? [] : [db.prepare(CHOICE_SQL).bind(address, listId, OUT, FROM_COMPLAINT, reportedAt)]),
      ...(mark === null ? [] : [db.prepare(MARK_SQL).bind(address, mark)]),
    ]),
  )
  return { ...NOTHING, complaints: addresses.length }
}

/**
 * Applies one event Amazon SES published, as the receiver hands it over: a permanent bounce and a spam report, each in
 * one db.batch, and nothing else. The event's kind is its eventType, or its notificationType for a notification an
 * identity sends; an event whose mail.sendingAccountId is not the topic's own account, or that holds no kind or no
 * mail, is left unread and answered ignored. A write that fails throws, so the receiver answers 500 and SNS tries again.
 */
export async function applySesEvent(db: D1Database, event: unknown, args: SesEventArgs): Promise<SesEventResult> {
  const body = fieldsOf(event)
  const kind = body?.eventType ?? body?.notificationType
  const mail = fieldsOf(body?.mail)
  if (!body || typeof kind !== 'string' || !mail || args.accountId === '' || mail.sendingAccountId !== args.accountId) {
    return { ...NOTHING, ignored: true }
  }
  if (kind === 'Bounce') return applyBounce(db, fieldsOf(body.bounce), mail)
  if (kind === 'Complaint') return applyComplaint(db, fieldsOf(body.complaint), mail, args)
  return NOTHING
}
