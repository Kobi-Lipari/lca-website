// functions/utils/mail/outcome.ts
//
// What an answer from the seam means for a message that may be tried
// again: sent, worth another try later, or never.
//
// Two rules. classifyToday is the one Group email has always used, and
// holds while the engine's rules are off. classifyOnce holds once they are
// on: a message is tried again only when the answer proves the service did
// not take it, so no message is ever sent twice. classify picks between
// them at each call.

import { engineRulesOn } from './rules'
import type { SendResult } from './send'

export type OutcomeKind = 'sent' | 'later' | 'never'

/**
 * Today's rule, moved word for word from Group email's sender in ../admin/campaigns. A request that threw is a
 * network problem, not a verdict on the address, so it is tried again. 429 is us sending too fast and 5xx is the
 * service having a bad moment: both are worth retrying. Anything else is a rejection of this specific message (bad
 * address, blocked domain) and will fail identically next time, so retrying it only delays the campaign.
 */
export function classifyToday(result: SendResult): OutcomeKind {
  if (result.ok) return 'sent'
  if (result.noAnswer) return 'later'
  const status = result.status ?? 0
  return status === 429 || status >= 500 ? 'later' : 'never'
}

/** The statuses that prove the message was not taken: too many requests, and the service unavailable. */
const NOT_TAKEN_STATUSES = new Set([429, 503])

/**
 * Amazon's error codes that prove the message was not taken: a throttle, sending paused, or the account suspended.
 * WS16 step 7 adds the codes of a fault in the account's own setup.
 */
const NOT_TAKEN_CODES = new Set(['TooManyRequestsException', 'ThrottlingException', 'Throttling', 'SendingPausedException', 'AccountSuspendedException'])

/** True for a refusal of the key or its permissions (401 or 403): every message after it would meet the same. */
export function configFault(result: SendResult): boolean {
  return !result.ok && (result.status === 401 || result.status === 403)
}

/**
 * The rule under the engine's rules: sent; later only for an answer that proves the service did not take the message
 * (a 429 or a 503, one of Amazon's codes for a throttle or a pause, a key or permission fault, list mail held back
 * because the gate could not be read, or a request the runtime would not make); never for everything else, the
 * gate's refusals, a request with no answer and every other 5xx among them, since each may come after the service
 * took the message. Resend's answers fall into the same rule by their status.
 */
export function classifyOnce(result: SendResult): OutcomeKind {
  if (result.ok) return 'sent'
  if (result.refused) return 'never'
  if (result.gateUnread || result.limitRefused) return 'later'
  if (result.status !== undefined && NOT_TAKEN_STATUSES.has(result.status)) return 'later'
  if (result.code !== undefined && NOT_TAKEN_CODES.has(result.code)) return 'later'
  if (configFault(result)) return 'later'
  return 'never'
}

/** The rule that holds now: classifyOnce under the engine's rules, classifyToday otherwise, read at each call. */
export function classify(result: SendResult): OutcomeKind {
  return engineRulesOn() ? classifyOnce(result) : classifyToday(result)
}
