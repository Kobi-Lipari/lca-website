// functions/utils/mail/send.ts
//
// The one seam every email the site sends goes through. deliver() reads
// MAIL_SENDER at each call, through ./rules, and hands the message to the
// one transport that names. There is no fallback from one service to
// another inside a send: a message goes to exactly one service, so no
// message can be sent by both. Every file here imports relative files
// only, so the daily-emails worker bundles the seam with no package.

import { sendThroughResend } from './resend'
import { senderNow } from './rules'
import type { MailSender } from './switches'

/** The display name a message carries when it names none, kept with every other address in domain/mail/addresses.ts. */
export { SENDER_NAME } from '../../../domain/mail/addresses'

/**
 * The two request shapes Resend has been sent: 'single' is sendEmail's in ../email, 'campaign' Group email's in
 * ../admin/campaigns. They stay apart so that the move behind the seam changed no byte of either; WS16 step 12 drops
 * the distinction with Resend.
 */
export type MailShape = 'single' | 'campaign'

/** One message, as every sender hands it to the seam. */
export interface OutgoingMail {
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

/** The bindings the seam needs. The site's and the daily-emails worker's both carry them. */
export interface MailEnv {
  RESEND_API_KEY: string
}

/**
 * What a send came to. A refusal carries the service's status and words; noAnswer marks a request that threw before
 * any answer came, so the message may or may not have reached the service.
 */
export type SendResult =
  | { ok: true; providerId?: string }
  | { ok: false; status?: number; code?: string; noAnswer?: true; error: string }

/** The transport for each service MAIL_SENDER can name. */
const TRANSPORTS: Record<MailSender, (env: MailEnv, mail: OutgoingMail) => Promise<SendResult>> = {
  resend: sendThroughResend,
}

/** Sends one message through the one service MAIL_SENDER names now, and says what came of it. Never throws. */
export async function deliver(env: MailEnv, mail: OutgoingMail): Promise<SendResult> {
  const sender = senderNow()
  const transport = TRANSPORTS[sender]
  // A sender with no transport here can only come from a mocked module. The message was handed to no service, so it is
  // answered as a refusal, without noAnswer, the mark of a message that may have gone.
  if (!transport) return { ok: false, error: `No transport for ${String(sender)}` }
  try {
    return await transport(env, mail)
  } catch (err) {
    return { ok: false, noAnswer: true, error: err instanceof Error ? err.message : 'Unknown send error' }
  }
}
