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
 * Amazon's error codes that prove the message was not taken and that end the run with the row's attempt kept: a
 * throttle (TooManyRequestsException; ThrottlingException, which also carries "Maximum sending rate exceeded" and
 * "Daily message quota exceeded", and comes with a 400; Throttling), sending paused, or the account suspended, both
 * with a 400. The codes of a fault in the key or in the account's own setup are below, since they give the attempt
 * back as well.
 */
const NOT_TAKEN_CODES = new Set(['TooManyRequestsException', 'ThrottlingException', 'Throttling', 'SendingPausedException', 'AccountSuspendedException'])

/**
 * Amazon's codes for a refusal of the key, its signature or its permissions, whatever status they come with: Amazon's
 * common errors page for SES's v2 API, read on Thursday, November 12, 2026, gives most of them with a 403 and
 * NotAuthorized with a 401, and a 401 or a 403 is a key fault by its status alone.
 */
const KEY_FAULT_CODES = new Set([
  'AccessDeniedException', 'UnrecognizedClientException', 'InvalidClientTokenId', 'SignatureDoesNotMatch', 'IncompleteSignature',
  'ExpiredTokenException', 'MissingAuthenticationToken', 'NotAuthorized', 'OptInRequired',
])

/**
 * Amazon's codes for a fault in the account's own setup, which every message of the run would meet: NotFoundException,
 * which a configuration set misnamed, or made in another region, answers to every send, and
 * MailFromDomainNotVerifiedException, for a return path whose DNS Amazon cannot read.
 */
const SETUP_FAULT_CODES = new Set(['NotFoundException', 'MailFromDomainNotVerifiedException'])

/**
 * True for an answer every message after it would meet the same, so the run ends with this row and the rest back,
 * their attempts given back: a refusal of the key or its permissions (401 or 403, or one of Amazon's codes for it), a
 * message for Amazon SES on a deployment without its keys, or a fault in the account's own setup.
 */
export function configFault(result: SendResult): boolean {
  if (result.ok) return false
  if (result.status === 401 || result.status === 403 || result.keyMissing) return true
  return result.code !== undefined && (KEY_FAULT_CODES.has(result.code) || SETUP_FAULT_CODES.has(result.code))
}

/**
 * The rule under the engine's rules: sent; later only for an answer that proves the service did not take the message
 * (a 429 or a 503, one of Amazon's codes for a throttle or a pause, a fault in the key or the account's setup, list mail
 * held back because the gate could not be read or because Resend sends, a message for Amazon SES with no key here, or
 * a request the runtime would not make); never for everything else, the seam's and the gate's refusals, a request with
 * no answer, a 500, a 502, a 504, a 408, every other 4xx and every code not named here among them, since each may come
 * after the service took the message, or would fail the same way again. Resend's answers fall into the same rule by
 * their status. List mail is always under the rules, so classifyToday is never asked about it.
 */
export function classifyOnce(result: SendResult): OutcomeKind {
  if (result.ok) return 'sent'
  if (result.refused) return 'never'
  if (result.gateUnread || result.waitForSes || result.limitRefused) return 'later'
  if (result.status !== undefined && NOT_TAKEN_STATUSES.has(result.status)) return 'later'
  if (result.code !== undefined && NOT_TAKEN_CODES.has(result.code)) return 'later'
  if (configFault(result)) return 'later'
  return 'never'
}

/** The rule that holds now: classifyOnce under the engine's rules, classifyToday otherwise, read at each call. */
export function classify(result: SendResult): OutcomeKind {
  return engineRulesOn() ? classifyOnce(result) : classifyToday(result)
}
