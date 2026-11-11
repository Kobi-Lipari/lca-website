// functions/utils/mail/outcome.ts
//
// What an answer from the seam means for a message that may be tried
// again: sent, worth another try later, or never.

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
