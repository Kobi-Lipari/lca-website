// functions/api/mail/ses-events.ts
//
// POST /api/mail/ses-events: the one address Amazon SNS posts Amazon SES's
// reports to, the bounces and spam reports of the configuration set
// lca-mail, published to the topic K made (WS16 step 8). It is the one
// address on the site that anyone on the internet can post to and that
// writes to the do-not-send list, so a notification is acted on only once
// its topic and its signature are proved, and nothing is fetched or written
// before the check that allows it. Its contract is in
// domain/contracts/mail.ts; SNS's body is not checked by a request schema,
// as Stripe's webhook's is not.
//
// Every answer, a browser's OPTIONS check among them, is 404
// { error: 'Not found' } before the body is read, unless the engine's rules
// are on (engineRulesOn in functions/utils/mail/rules.ts) and
// SES_SNS_TOPIC_ARN is set, a secret of the production Pages project alone.
// Then, in this order:
// 1. A body that declares, or turns out to hold, more than
//    SNS_MAX_BODY_BYTES: 400, read no further and never parsed.
// 2. A body that is not JSON, or not a message whose fields are strings: 400.
// 3. A TopicArn other than SES_SNS_TOPIC_ARN: 400, with nothing fetched.
// 4. An x-amz-sns-message-type header that names another type: 400.
// 5. A Timestamp that cannot be read as a time: 400.
// 6. A SubscriptionConfirmation whose SubscribeURL is not on SNS's own host
//    for the region over https (subscribeUrlAllowed): 400, with no GET.
// 7. The signature (verifySnsMessage in functions/utils/mail/sns.ts): a
//    version other than 1 and 2, a type SNS does not sign, a signature that
//    is not base64 or not the length of an RSA signature, or a certificate
//    address certUrlAllowed refuses, 400 with nothing fetched; then the
//    certificate, fetched once, never through a redirect, and kept: none to
//    be had, a redirect's 3xx among them, or one fetched from SNS's host
//    that cannot be read, 500, so SNS tries again, since after Amazon
//    changes its certificate that is a fault of this code and a 400 would
//    lose the notification for good; a signature that does not verify, 400.
// Every refusal answers the same words, so a prober learns nothing of the
// check that refused it. Then by type:
// - SubscriptionConfirmation: one GET of its SubscribeURL confirms the
//   subscription, 200; 500 when that GET fails or answers a redirect, which
//   is never followed.
// - UnsubscribeConfirmation: 200 and one warning line, since it means the
//   site's subscription to the topic was removed.
// - A Notification more than SNS_MAX_AGE_MS old by its signed Timestamp: 200
//   and nothing else, so a stored copy of a signed bounce, replayed after an
//   LCA admin clears the address (WS16 step 9), cannot put it back.
// - A Notification: applySesEvent in functions/utils/mail/sesEvents.ts,
//   with the topic's own account and COMPLAINT_STOPS_OTHER_SENDERS, 200
//   { received: true }; 500 when the database cannot be written, so SNS
//   tries again.
// Every answer carries Cache-Control: no-store. A log line holds counts or
// a fixed sentence, and never an address, a topic's name or an account
// number.
import type { Env } from '../../types'
import { NO_STORE, noStore } from '../../utils/mail/linkAnswers'
import { engineRulesOn } from '../../utils/mail/rules'
import { SES_REGION } from '../../utils/mail/ses'
import { applySesEvent, type SesEventResult } from '../../utils/mail/sesEvents'
import {
  SNS_MAX_AGE_MS, SNS_MAX_BODY_BYTES, SNS_MAX_CERT_BYTES, amazonTime, readCapped, readSnsMessage, subscribeUrlAllowed, topicAccount, verifySnsMessage,
  type SnsCheck,
} from '../../utils/mail/sns'
import { COMPLAINT_STOPS_OTHER_SENDERS } from '../../utils/mail/switches'
import { handleOptions, jsonResponse } from '../../utils/response'
import type { SesEventsResponse } from '../../../domain/contracts/mail'

/** The words of every refusal, whatever check refused the request. */
export const NOT_ACCEPTED = 'This notification was not accepted.'

/** The words of every 500, which SNS answers by trying again later. */
export const TRY_AGAIN = 'This notification could not be taken now. Send it again later.'

/** The log lines, each a fixed sentence or counts, never an address, a topic's name or an account number. */
export const RECEIVER_LOG = {
  confirmed: 'mail receiver: the subscription to the topic is confirmed',
  unconfirmed: 'mail receiver: the subscription could not be confirmed; SNS will try again',
  unsubscribed: 'mail receiver: Amazon SNS says the site\'s subscription to the topic was removed, so no more reports will come until it is subscribed again',
  certUnreachable: 'mail receiver: the signing certificate could not be fetched; SNS will try again',
  certUnusable: 'mail receiver: the signing certificate could not be read; SNS will try again',
  unwritten: 'mail receiver: the notification could not be written; SNS will try again',
} as const

/** The one log line for a notification taken: its counts. */
export function receivedLog(result: SesEventResult): string {
  if (result.ignored) return 'mail receiver: a notification left unread, not of the site\'s own mail'
  return `mail receiver: ${result.bounces} bounced address(es) and ${result.complaints} spam report address(es) written`
}

/** A JSON answer with no-store, as every answer here carries. */
const answer = (data: unknown, status: number) => jsonResponse(data, status, NO_STORE)
const notFound = () => answer({ error: 'Not found' }, 404)
const refused = () => answer({ error: NOT_ACCEPTED }, 400)
const tryAgain = () => answer({ error: TRY_AGAIN }, 500)
const received = () => {
  const body: SesEventsResponse = { received: true }
  return answer(body, 200)
}

/** The topic this deployment takes reports from, while the receiver is live: the engine's rules on and the topic bound. */
function liveTopic(env: Env): string | null {
  return engineRulesOn() && env.SES_SNS_TOPIC_ARN ? env.SES_SNS_TOPIC_ARN : null
}

/**
 * Every fetch here is made with redirect 'manual', so a redirect is never followed and its 3xx is not ok: nothing
 * fetched from any host but SNS's own for the region is ever read, kept or trusted.
 */
const NO_REDIRECT: RequestInit = { redirect: 'manual' }

/**
 * The text of the certificate at an address certUrlAllowed passed, read no further than SNS_MAX_CERT_BYTES; throws when
 * none is to be had: no answer, or an answer that is not a 2xx, a redirect among them. A longer certificate is read as
 * empty, which cannot be walked.
 */
async function certificateText(url: string): Promise<string> {
  const response = await fetch(url, NO_REDIRECT)
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined)
    throw new Error('No certificate at that address.')
  }
  const bytes = await readCapped(response.body, SNS_MAX_CERT_BYTES)
  return bytes === null ? '' : new TextDecoder().decode(bytes)
}

/** One GET of a confirmation's SubscribeURL, which confirms the subscription; an answer that is not a 2xx, a redirect among them, does not. */
async function confirm(url: string): Promise<Response> {
  try {
    const response = await fetch(url, NO_REDIRECT)
    await response.body?.cancel().catch(() => undefined)
    if (!response.ok) throw new Error('Not confirmed.')
  } catch {
    console.error(RECEIVER_LOG.unconfirmed)
    return tryAgain()
  }
  console.log(RECEIVER_LOG.confirmed)
  return received()
}

const CERT_FAULT_LOG: Record<Exclude<SnsCheck, 'valid' | 'invalid'>, string> = {
  cert_unreachable: RECEIVER_LOG.certUnreachable,
  cert_unusable: RECEIVER_LOG.certUnusable,
}

export const onRequestOptions: PagesFunction<Env> = async (context) => (liveTopic(context.env) ? noStore(handleOptions()) : notFound())

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const topic = liveTopic(context.env)
  if (topic === null) return notFound()
  const { request } = context

  const declared = request.headers.get('content-length')
  if (declared !== null && !(Number(declared) <= SNS_MAX_BODY_BYTES)) return refused()
  const bytes = await readCapped(request.body, SNS_MAX_BODY_BYTES)
  if (bytes === null) return refused()
  let parsed: unknown
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return refused()
  }
  const message = readSnsMessage(parsed)
  if (!message || message.TopicArn !== topic) return refused()
  if (request.headers.get('x-amz-sns-message-type') !== message.Type) return refused()
  const publishedAt = amazonTime(message.Timestamp)
  if (publishedAt === null) return refused()
  if (message.Type === 'SubscriptionConfirmation' && !(message.SubscribeURL && subscribeUrlAllowed(message.SubscribeURL, SES_REGION))) return refused()

  const check = await verifySnsMessage(message, SES_REGION, certificateText)
  if (check === 'invalid') return refused()
  if (check !== 'valid') {
    console.error(CERT_FAULT_LOG[check])
    return tryAgain()
  }

  if (message.Type === 'SubscriptionConfirmation') return confirm(message.SubscribeURL as string)
  if (message.Type === 'UnsubscribeConfirmation') {
    console.warn(RECEIVER_LOG.unsubscribed)
    return received()
  }
  if (Date.now() - publishedAt > SNS_MAX_AGE_MS) return received()

  // A message on the topic that is not JSON is not one of Amazon SES's events, and is read as one that changes nothing.
  let event: unknown
  try {
    event = JSON.parse(message.Message)
  } catch {
    event = null
  }
  try {
    const result = await applySesEvent(context.env.DB, event, {
      accountId: topicAccount(topic),
      complaintStopsOtherSenders: COMPLAINT_STOPS_OTHER_SENDERS,
      publishedAt,
    })
    console.log(receivedLog(result))
  } catch {
    console.error(RECEIVER_LOG.unwritten)
    return tryAgain()
  }
  return received()
}
