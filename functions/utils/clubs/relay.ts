// functions/utils/clubs/relay.ts
//
// The contact relay (WS09 step 26, D29: relayed, never shown, never stored).
// A message a visitor sends from a club's page goes, by the keepers
// functions/utils/clubs/routing.ts names, read through ./emails.ts, to:
//   1. the club's own address (clubs.contact_email) when it has one, with
//      the visitor's address as the reply-to, so the club answers directly;
//   2. else each representative whose seat covers the club's region;
//   3. else, while that seat is open, each LCA admin.
// When no copy at one keeper's address goes (the mail gate refuses a dead
// address, or the service does not take it), the relay goes on to the next
// keeper in the same order, and the copy then says the club's email could
// not be reached. Only when no keeper's address takes the message is the
// visitor told it could not be sent.
//
// The visitor's address is the reply-to on the club's own copy alone; on a
// representative's or an admin's copy it stands in the body, and the reply-to
// is the site's own. No recipient, copy or subject ever comes from the
// request, and no copy goes to the address the visitor typed, even where it
// is a keeper's own. The words of every copy are drawn in ./emails.ts by
// renderEmail, and every copy goes through sendEmail, one email to each
// person, so no keeper sees another's address.
//
// Nothing is written: the message, the visitor's name and the visitor's
// address are held only while the copies are sent. A copy that did not go is
// logged in fixed words alone, never in the words its failure carries, since
// a mail service's own words for a refusal may name the address it refused;
// so no log line of this file carries what was typed or any keeper's address.
//
// The page's answer reads relayKind alone: which of the three the message
// goes to, by the same reads, never a name, an address, a count or whether
// an address works.
import { sendEmail, type EmailEnv } from '../email'
import { resolveSiteUrl } from '../site'
import {
  lcaAdmins, regionRepresentativesOf, relayCopyEmail, type Keeper, type RelayCopyKind, type RelayedMessage, type RelayReason,
} from './emails'
import type { ContactGoesTo } from '../../../domain/clubs/contactMessage'

/** The one line a copy that did not go leaves in the log: fixed words, with no address and nothing the failure said. */
export const COPY_NOT_SENT_LOG = 'Contact relay: a copy was not sent.'

/** The pause between one keeper's copy and the next, the pace the save notice keeps. */
const SEND_INTERVAL_MS = 400

/** An address the club can be written to at: the form the club's editor saves it in. */
const ADDRESS = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** The club's own address, or null when it has none that can be written to. */
async function clubAddressOf(db: D1Database, clubId: string): Promise<string | null> {
  const row = await db.prepare('SELECT contact_email FROM clubs WHERE id = ?').bind(clubId).first<{ contact_email: string | null }>()
  const address = row?.contact_email?.trim() ?? ''
  return ADDRESS.test(address) ? address : null
}

/**
 * Where a message to this club goes, as the page's answer says it before the
 * visitor sends: the club's own address, the region's representative, or LCA.
 * Whether an address would be refused is never read here, so the answer
 * never says that an address has died.
 */
export async function relayKind(db: D1Database, clubId: string): Promise<ContactGoesTo> {
  if (await clubAddressOf(db, clubId)) return 'club'
  return (await regionRepresentativesOf(db, clubId)).length > 0 ? 'region' : 'lca'
}

/** What came of a message: some keeper's address took it, or none did. */
export type RelayOutcome = 'sent' | 'not_sent'

type RelayEnv = EmailEnv & { DB: D1Database; SITE_URL?: string }

/** The club a message is for, as the endpoint found it. */
export interface RelayClub {
  id: string
  name: string
  region: string | null
}

/**
 * Sends the visitor's message to the club's keepers, in the order above, and
 * answers whether any address took it. Never throws for a failed send; a
 * failed read is not caught, and the endpoint answers it as any fault.
 */
export async function relayMessage(env: RelayEnv, request: Request, club: RelayClub, visitor: RelayedMessage): Promise<RelayOutcome> {
  const siteUrl = resolveSiteUrl(env, request)
  const typed = visitor.email.trim().toLowerCase()
  // Each address is tried once, whichever keeper it belongs to, and the visitor's own is never tried.
  const tried = new Set<string>([typed])
  let sends = 0

  const sendTo = async (address: string, kind: RelayCopyKind, reason: RelayReason): Promise<boolean> => {
    const key = address.trim().toLowerCase()
    if (tried.has(key)) return false
    tried.add(key)
    if (sends++ > 0) await new Promise((resolve) => setTimeout(resolve, SEND_INTERVAL_MS))
    const copy = relayCopyEmail({ siteUrl, clubName: club.name, region: club.region, kind, reason, visitor })
    try {
      await sendEmail(env, { ...copy, to: address, ...(kind === 'club' ? { replyTo: visitor.email.trim() } : {}) })
      return true
    } catch {
      // The failure's own words are not logged: a service's refusal may name the address it refused.
      console.warn(COPY_NOT_SENT_LOG)
      return false
    }
  }

  const sendToEach = async (people: Keeper[], kind: RelayCopyKind, reason: RelayReason): Promise<boolean> => {
    let any = false
    for (const person of people) if (await sendTo(person.email, kind, reason)) any = true
    return any
  }

  const own = await clubAddressOf(env.DB, club.id)
  if (own && await sendTo(own, 'club', 'no_address')) return 'sent'
  const reason: RelayReason = own ? 'unreachable' : 'no_address'

  const representatives = await regionRepresentativesOf(env.DB, club.id)
  if (await sendToEach(representatives, 'region', reason)) return 'sent'

  if (await sendToEach(await lcaAdmins(env.DB), 'lca', reason)) return 'sent'
  return 'not_sent'
}
