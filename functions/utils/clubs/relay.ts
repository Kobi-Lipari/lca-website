// functions/utils/clubs/relay.ts
//
// The contact relay (WS09 step 26, D29: relayed, never shown, never stored).
// A message a visitor sends from a club's page goes, by the keepers
// functions/utils/clubs/routing.ts names, read through ./emails.ts, to:
//   1. the club's own address (clubs.contact_email) when it has one, with
//      the visitor's address as the reply-to, so the club answers directly;
//   2. else each representative whose seat covers the club's region;
//   3. else, while that seat is open, each LCA admin.
// What came of each copy is read from the seam's own answer, sendEmailOutcome
// in functions/utils/email.ts (classify in functions/utils/mail/outcome.ts):
//   - 'sent': that address took it;
//   - 'never': that address was refused (the mail gate's refusal of a dead
//     address, or a refusal of this message), so the relay goes on to the
//     next keeper in the same order, and the copy then says the club's email
//     could not be reached;
//   - 'later': the service did not take it for now (busy, unavailable, or a
//     fault of its own), which says nothing of the address, so the relay
//     stops there: no further keeper is written to and the visitor is told
//     the message was not sent.
// Which failures give which answer is the seam's rule, not this file's: with
// the engine's rules on (MAIL_LISTS_ON) a 500, a 502, a 504 and a request with
// no answer read 'never', since the service may have taken the message, so
// for those the relay goes on as before; with the rules off they read
// 'later'. Only when no keeper's address takes the message is the visitor
// told it could not be sent.
//
// The visitor's address is the reply-to on the club's own copy alone, and
// stands in that copy's body. A representative's or an admin's copy carries
// it nowhere (WS09 step 27): Reply through LCA stands in its place, a link to
// /clubs/reply/{token} whose token is sealed by ./reply.ts, made once for the
// message and only when a copy goes to a representative or an admin, and the
// reply-to is the site's own. No recipient, copy or subject ever comes from the
// request, and no copy goes to the address the visitor typed, even where it
// is a keeper's own. The words of every copy are drawn in ./emails.ts by
// renderEmail, and every copy goes through sendEmail, one email to each
// person, so no keeper sees another's address.
//
// Nothing is written: the message, the visitor's name and the visitor's
// address are held only while the copies are sent. A copy that did not go is
// logged by this file in fixed words alone, and by the seam in its own line,
// which may carry the service's words. The copies go only to a club's or a
// keeper's address, never to the visitor's own, and this file's line carries
// neither what was typed nor an address. The club's own copy has the
// visitor's address as its reply-to, so a service's refusal that quoted the
// fields it was sent could carry that address into the seam's line.
//
// The page's answer reads relayKind alone: which of the three the message
// goes to, by the same reads, never a name, an address, a count or whether
// an address works.
import { sendEmailOutcome, type EmailEnv } from '../email'
import { resolveSiteUrl } from '../site'
import { replyLink } from './reply'
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

/** What came of one copy, by the seam's own answer. */
type CopyOutcome = 'sent' | 'never' | 'later'

type RelayEnv = EmailEnv & { DB: D1Database; SITE_URL?: string; SIGNING_SECRET?: string; SIGNING_SECRET_PREVIOUS?: string }

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
  // The Reply through LCA link, sealed once for the message the first time a representative's or an admin's copy needs it.
  let link: Promise<string | null> | null = null
  const linkFor = () => (link ??= replyLink(env, siteUrl, visitor, club.id))

  /** One copy: what came of it, or 'never' for an address tried already, which is passed over as a refused one is. */
  const sendTo = async (address: string, kind: RelayCopyKind, reason: RelayReason): Promise<CopyOutcome> => {
    const key = address.trim().toLowerCase()
    if (tried.has(key)) return 'never'
    tried.add(key)
    if (sends++ > 0) await new Promise((resolve) => setTimeout(resolve, SEND_INTERVAL_MS))
    const replyUrl = kind === 'club' ? null : await linkFor()
    const copy = relayCopyEmail({ siteUrl, clubName: club.name, region: club.region, kind, reason, visitor, replyUrl })
    const outcome = await sendEmailOutcome(env, { ...copy, to: address, ...(kind === 'club' ? { replyTo: visitor.email.trim() } : {}) })
    // This file's own line is fixed words; the seam has logged its own.
    if (outcome !== 'sent') console.warn(COPY_NOT_SENT_LOG)
    return outcome
  }

  /** A copy to each person of one tier: 'sent' when any took it, 'later' when the service stopped the walk first. */
  const sendToEach = async (people: Keeper[], kind: RelayCopyKind, reason: RelayReason): Promise<CopyOutcome> => {
    let any = false
    for (const person of people) {
      const outcome = await sendTo(person.email, kind, reason)
      if (outcome === 'sent') any = true
      else if (outcome === 'later') return any ? 'sent' : 'later'
    }
    return any ? 'sent' : 'never'
  }

  const own = await clubAddressOf(env.DB, club.id)
  if (own) {
    const outcome = await sendTo(own, 'club', 'no_address')
    if (outcome === 'sent') return 'sent'
    if (outcome === 'later') return 'not_sent'
  }
  const reason: RelayReason = own ? 'unreachable' : 'no_address'

  const representatives = await regionRepresentativesOf(env.DB, club.id)
  const region = await sendToEach(representatives, 'region', reason)
  if (region === 'sent') return 'sent'
  if (region === 'later') return 'not_sent'

  return (await sendToEach(await lcaAdmins(env.DB), 'lca', reason)) === 'sent' ? 'sent' : 'not_sent'
}
