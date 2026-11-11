// functions/utils/mail/gate.ts
//
// The do-not-send gate: what stops a message before any service is called.
// openGate reads, in one query for each 90 addresses, the addresses on the
// do-not-send list and, for list mail, each person's choices on that list,
// so a loop reads its whole list before it sends and each send then asks
// the gate without a query of its own. deliver() in ./send asks the gate
// once the engine's rules are on, and for list mail always.
//
// What the gate refuses, in this order:
// - not_sendable: an address mail cannot reach (isSendableAddress in
//   domain/mail/address.ts: walk-in placeholders and the other reserved
//   top-level names) and, for list mail and test sends, an address no LCA
//   list sends to (isListAddress: the site's own domain and the
//   documentation names). No query is needed for it.
// - do_not_send: an address on mail_do_not_send, which stops all mail.
// - opted_out, for list mail only: the person turned that list off, or
//   stopped all optional mail, or a spam report's mark stops it, which it
//   does while COMPLAINT_STOPS_OTHER_SENDERS holds, for a list that is not
//   one of LCA's main mailers, unless the person turned the list back on
//   after the report.
// Event and account mail is never refused for a choice.

import { isListAddress, isSendableAddress, normalizeAddress } from '../../../domain/mail/address'
import type { MailKind } from '../../../domain/mail/lists'
import { COMPLAINT_STOPS_OTHER_SENDERS } from './switches'

/** Why the gate stops a message. */
export type Refusal = 'not_sendable' | 'do_not_send' | 'opted_out'

/** The gate a loop reads once and asks for each message. */
export interface MailGate {
  /**
   * Why the message may not go, or null when it may; undefined when the address, or for list mail the list, was not
   * read into this gate, so the caller reads it on its own.
   */
  refusal(address: string, kind: MailKind, listId?: string): Refusal | null | undefined
}

/**
 * A read of the gate that failed: a D1 error, or a table missing because a migration did not run. deliver() lets
 * event and test mail go on as if the gate were empty and holds list mail back.
 */
export class GateUnread extends Error {
  constructor(cause: unknown) {
    super('The do-not-send list could not be read.', { cause })
    this.name = 'GateUnread'
  }
}

/** The one log line for a gate that could not be read. It names no address. */
export const GATE_UNREAD_LOG = 'mail gate: the do-not-send list could not be read; event mail goes on, list mail waits'

/** Addresses read in one query. D1 binds at most 100 values to a query, so 90 leave room for the list's id. */
export const GATE_QUERY_SIZE = 90

/** What one query tells the gate of a person on the list. */
interface ContactRow {
  address: string
  dead: number
  optional_off_at: string | null
  complained_at: string | null
  choice: string | null
  back_in: number
  main_mailer: number | null
}

/** One person's marks and choice, as the gate keeps them. */
interface Contact {
  optionalOff: boolean
  complained: boolean
  choice: string | null
  /** An 'in' choice on the list made after the spam report's mark. */
  backIn: boolean
}

/** The refusal that needs no query: an address mail cannot reach, or, for list mail and test sends, one no list sends to. */
function unreachable(address: string, kind: MailKind): Refusal | null {
  if (!isSendableAddress(address)) return 'not_sendable'
  if (kind !== 'event' && !isListAddress(address)) return 'not_sendable'
  return null
}

/** The query for a chunk of addresses: the do-not-send list alone, or with the list's choices when a list is named. */
function chunkQuery(db: D1Database, chunk: string[], listId?: string): D1PreparedStatement {
  const slots = chunk.map((_, i) => `?${i + 1}`)
  if (listId === undefined) {
    return db.prepare(`SELECT address FROM mail_do_not_send WHERE address IN (${slots.join(', ')})`).bind(...chunk)
  }
  const list = `?${chunk.length + 1}`
  return db
    .prepare(
      `WITH wanted(address) AS (VALUES ${slots.map((s) => `(${s})`).join(', ')})
       SELECT w.address AS address,
              EXISTS (SELECT 1 FROM mail_do_not_send d WHERE d.address = w.address) AS dead,
              c.optional_off_at AS optional_off_at,
              c.complained_at AS complained_at,
              ch.choice AS choice,
              CASE WHEN ch.choice = 'in' AND c.complained_at IS NOT NULL
                        AND julianday(ch.updated_at) > julianday(c.complained_at) THEN 1 ELSE 0 END AS back_in,
              (SELECT l.main_mailer FROM mail_lists l WHERE l.id = ${list}) AS main_mailer
         FROM wanted w
         LEFT JOIN mail_contacts c ON c.address = w.address
         LEFT JOIN mail_list_choices ch ON ch.contact_id = c.id AND ch.list_id = ${list}
        WHERE c.id IS NOT NULL OR EXISTS (SELECT 1 FROM mail_do_not_send d WHERE d.address = w.address)`,
    )
    .bind(...chunk, listId)
}

/**
 * Reads the gate for a loop's addresses: one query for each 90 of them, after dropping repeats and the addresses
 * refused without a query. With a list named, it reads each person's choices on that list as well, and the list's
 * main_mailer. Throws GateUnread when a read fails.
 */
export async function openGate(db: D1Database, addresses: string[], listId?: string): Promise<MailGate> {
  // A gate for a list reads only the addresses that list may send to; any other gate, every address mail can reach.
  const readFor: MailKind = listId === undefined ? 'event' : 'optional'
  const read = [...new Set(addresses.map(normalizeAddress))].filter((address) => unreachable(address, readFor) === null)
  const dead = new Set<string>()
  const contacts = new Map<string, Contact>()
  let mainMailer = false
  try {
    for (let at = 0; at < read.length; at += GATE_QUERY_SIZE) {
      const chunk = read.slice(at, at + GATE_QUERY_SIZE)
      if (listId === undefined) {
        const { results } = await chunkQuery(db, chunk).all<{ address: string }>()
        for (const row of results ?? []) dead.add(row.address)
        continue
      }
      const { results } = await chunkQuery(db, chunk, listId).all<ContactRow>()
      for (const row of results ?? []) {
        if (row.dead) dead.add(row.address)
        // A list that is not in mail_lists is read as not one of LCA's main mailers, the stricter reading for a spam report.
        mainMailer = row.main_mailer === 1
        contacts.set(row.address, {
          optionalOff: row.optional_off_at !== null,
          complained: row.complained_at !== null,
          choice: row.choice,
          backIn: row.back_in === 1,
        })
      }
    }
  } catch (err) {
    throw new GateUnread(err)
  }
  const known = new Set(read)

  return {
    refusal(address, kind, askedList) {
      const value = normalizeAddress(address)
      const cannot = unreachable(value, kind)
      if (cannot) return cannot
      // List mail is answered only by a gate read for its own list.
      if (kind === 'optional' && (askedList === undefined || askedList !== listId)) return undefined
      if (!known.has(value)) return undefined
      if (dead.has(value)) return 'do_not_send'
      if (kind !== 'optional') return null
      const contact = contacts.get(value)
      if (!contact) return null
      if (contact.choice === 'out' || contact.optionalOff) return 'opted_out'
      if (contact.complained && COMPLAINT_STOPS_OTHER_SENDERS && !mainMailer && !contact.backIn) return 'opted_out'
      return null
    },
  }
}

/**
 * The gate for a loop of event mail: openGate, and when the read fails, one log line and a gate that answers as an
 * empty one would, so the loop's messages go on. List mail asked of it is left to deliver(), which reads the gate
 * again and holds the message back if that read fails too.
 */
export async function openLoopGate(db: D1Database, addresses: string[], listId?: string): Promise<MailGate> {
  try {
    return await openGate(db, addresses, listId)
  } catch (err) {
    if (!(err instanceof GateUnread)) throw err
    console.warn(GATE_UNREAD_LOG)
    return emptyGate()
  }
}

/**
 * A gate with nothing read into it, for a read that failed: the refusals that need no query still hold, so a walk-in
 * placeholder is never sent to, and event and test mail otherwise goes on; list mail is answered undefined.
 */
export function emptyGate(): MailGate {
  return {
    refusal(address, kind) {
      const cannot = unreachable(normalizeAddress(address), kind)
      if (cannot) return cannot
      return kind === 'optional' ? undefined : null
    },
  }
}
