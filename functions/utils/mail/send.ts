// functions/utils/mail/send.ts
//
// The one seam every email the site sends goes through. deliver() reads
// MAIL_SENDER at each call, through ./rules, and hands the message to the
// one transport that names. There is no fallback from one service to
// another inside a send: a message goes to exactly one service, so no
// message can be sent by both. Every file here imports relative files
// only, so the daily-emails worker bundles the seam with no package.
//
// Before any service is called, the do-not-send gate in ./gate is asked
// about the message once the engine's rules are on (engineRulesOn() in
// ./rules), and for list mail always, whatever the constants say. With the
// rules off, event mail reads no table and goes as it always has.

import type { MailKind } from '../../../domain/mail/lists'
import { GATE_UNREAD_LOG, emptyGate, openGate, type MailGate, type Refusal } from './gate'
import { sendThroughResend } from './resend'
import { engineRulesOn, senderNow } from './rules'
import type { MailSender } from './switches'

/** The display name a message carries when it names none, kept with every other address in domain/mail/addresses.ts. */
export { SENDER_NAME } from '../../../domain/mail/addresses'

/**
 * The two request shapes Resend has been sent: 'single' is sendEmail's in ../email, 'campaign' Group email's in
 * ../admin/campaigns. They stay apart so that the move behind the seam changed no byte of either; WS16 step 12 drops
 * the distinction with Resend.
 */
export type MailShape = 'single' | 'campaign'

/** What every message carries, whatever its kind. */
interface MailParts {
  /** The bare From address, such as noreply@louisianachess.org. */
  from: string
  /** The display name in front of the From address; SENDER_NAME when it is not given, so a club's mail can carry its own name later. */
  fromName?: string
  to: string
  /** Where replies go: the From address has no mailbox behind it. */
  replyTo: string
  subject: string
  html: string
  /** The plain-text part, sent only when it is given and not empty. */
  text?: string
  shape: MailShape
}

/**
 * One message, as every sender hands it to the seam. Its kind is 'event' when it is not given: event and account
 * mail, which is never refused for a choice. List mail, kind 'optional', always names the list it goes out on.
 */
export type OutgoingMail = MailParts & ({ kind?: Exclude<MailKind, 'optional'>; listId?: undefined } | { kind: 'optional'; listId: string })

/** The bindings the seam needs. The site's and the daily-emails worker's both carry them. */
export interface MailEnv {
  DB: D1Database
  RESEND_API_KEY: string
}

/**
 * What a send came to. A refusal carries the service's status and words; noAnswer marks a request that threw before
 * any answer came, so the message may or may not have reached the service. Three failures reach no service at all:
 * refused, the gate's refusal; gateUnread, list mail held back because the gate could not be read; and limitRefused,
 * a request the runtime would not make because the invocation had used its outside calls.
 */
export type SendResult =
  | { ok: true; providerId?: string }
  | { ok: false; status?: number; code?: string; noAnswer?: true; refused?: Refusal; gateUnread?: true; limitRefused?: true; error: string }

/** The plain words for each refusal, which the logs and Group email's history show. None of them names the address. */
export const REFUSAL_WORDS: Record<Refusal, string> = {
  do_not_send: 'Not sent: this address no longer receives mail.',
  not_sendable: 'Not sent: not a real address.',
  opted_out: 'Not sent: this person turned this email off.',
}

/** The words for list mail held back because the gate could not be read. */
export const GATE_UNREAD_WORDS = 'Not sent yet: the do-not-send list could not be read.'

/**
 * The words the Workers runtime throws from fetch() once an invocation has used its outside calls, as reports of the
 * production runtime's log quote them: "Too many subrequests by single Worker invocation.", followed by a pointer to
 * Cloudflare's limits page. Cloudflare's own pages give the limits, not the words, and the local runtime the tests
 * run in has no such limit, so the seam matches the words "too many subrequests" anywhere in the message, in any case.
 */
export const TOO_MANY_OUTSIDE_CALLS = 'Too many subrequests by single Worker invocation.'
const LIMIT_REFUSED = /\btoo many subrequests\b/i

/** The transport for each service MAIL_SENDER can name. */
const TRANSPORTS: Record<MailSender, (env: MailEnv, mail: OutgoingMail) => Promise<SendResult>> = {
  resend: sendThroughResend,
}

/**
 * The gate's answer for one message, read from the gate given or, for an address it did not read, from a gate of its
 * own: a failure that reaches no service, or null when the message may go. A test send and event mail are asked
 * without a list, so no choice ever stops them.
 */
async function gateAnswer(env: MailEnv, mail: OutgoingMail, kind: MailKind, gate?: MailGate): Promise<SendResult | null> {
  const listId = kind === 'optional' ? mail.listId : undefined
  let refusal = gate?.refusal(mail.to, kind, listId)
  if (refusal === undefined) {
    try {
      refusal = (await openGate(env.DB, [mail.to], listId)).refusal(mail.to, kind, listId)
    } catch {
      // openGate throws only GateUnread; whatever else came, the seam keeps its word and never throws.
      console.warn(GATE_UNREAD_LOG)
      if (kind === 'optional') return { ok: false, gateUnread: true, error: GATE_UNREAD_WORDS }
      // Event and test mail go on as if the gate were empty: only the refusals that need no query still hold.
      refusal = emptyGate().refusal(mail.to, kind)
    }
  }
  // Only list mail that names no list is still unanswered here; with no list to read its choices from, it waits.
  if (refusal === undefined) return { ok: false, gateUnread: true, error: GATE_UNREAD_WORDS }
  return refusal === null ? null : { ok: false, refused: refusal, error: REFUSAL_WORDS[refusal] }
}

/** Sends one message through the one service MAIL_SENDER names now, and says what came of it. Never throws. */
export async function deliver(env: MailEnv, mail: OutgoingMail, gate?: MailGate): Promise<SendResult> {
  const sender = senderNow()
  const transport = TRANSPORTS[sender]
  // A sender with no transport here can only come from a mocked module. The message was handed to no service, so it is
  // answered as a refusal, without noAnswer, the mark of a message that may have gone.
  if (!transport) return { ok: false, error: `No transport for ${String(sender)}` }
  const kind = mail.kind ?? 'event'
  const ruled = engineRulesOn() || kind === 'optional'
  if (ruled) {
    const refused = await gateAnswer(env, mail, kind, gate)
    if (refused) return refused
  }
  try {
    return await transport(env, mail)
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown send error'
    // Under the rules, a request the runtime refused for the invocation's limit never left, so it is not a lost answer.
    if (ruled && LIMIT_REFUSED.test(error)) return { ok: false, limitRefused: true, error }
    return { ok: false, noAnswer: true, error }
  }
}
