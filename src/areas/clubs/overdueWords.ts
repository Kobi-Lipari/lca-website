// src/areas/clubs/overdueWords.ts
//
// The words of "Send overdue suggestions on", the LCA admin's button in My
// region for the visitors' suggestions no keeper has answered in 14 days
// (WS09 step 29, src/areas/clubs/components/OverdueSuggestionsButton.tsx):
// its one question and what a press did, in numbers and plain words. The
// figure is the rule's own, SUGGESTION_DUE_DAYS in domain/clubs/regionCards.ts.
import { SUGGESTION_DUE_DAYS } from '@domain/clubs/regionCards'
import type { ReportClockResponse } from '@domain/contracts'
import { errorWords, refusedBeforeSending } from '@/areas/clubs/region'

/** The button's words. */
export const OVERDUE_BUTTON = 'Send overdue suggestions on'

/** "1 suggestion" or "3 suggestions". */
export function suggestionsWord(n: number): string {
  return `${n} ${n === 1 ? 'suggestion' : 'suggestions'}`
}

/** "1 email" or "4 emails". */
export function emailsWord(n: number): string {
  return `${n} ${n === 1 ? 'email' : 'emails'}`
}

/** The one question, naming how many are due. */
export function overdueQuestion(due: number): string {
  return due === 1
    ? `1 suggestion has waited ${SUGGESTION_DUE_DAYS} days or more with no answer. Send it on to the LCA admins and the region's representatives?`
    : `${due} suggestions have waited ${SUGGESTION_DUE_DAYS} days or more with no answer. Send them on to the LCA admins and the regions' representatives?`
}

/** The question's send button. */
export const OVERDUE_SEND = 'Send on'

/** What a press says when nothing is waiting any more: another admin's press, or a keeper's answer, came first. */
export const NONE_DUE = 'No suggestion is waiting to be sent on now.'

/** What the status says while the emails go. */
export const OVERDUE_SENDING = 'Sending the overdue suggestions on…'

/** What a press did: how many were passed on, how many emails went and did not, how many could not be passed on, and how many wait for another press. */
export function overdueSentWords(done: ReportClockResponse): string {
  if (done.due === 0) return NONE_DUE
  const emails = `${emailsWord(done.sent)} sent, ${done.notSent} not sent.`
  // Those this press tried, and of them the ones none of whose emails was taken: they stay waiting.
  const tried = done.due - done.notReached
  const untaken = tried - done.passedOn
  const parts: string[] = []
  if (done.passedOn > 0) {
    parts.push(`${suggestionsWord(done.passedOn)} passed on: ${emails}`)
    if (untaken > 0) parts.push(`${untaken} more could not be passed on and ${untaken === 1 ? 'is' : 'are'} still waiting, so you can try again later.`)
  } else if (tried > 0) {
    parts.push(`None could be passed on: ${emails} ${tried === 1 ? 'It is' : 'They are'} still waiting, so you can try again later.`)
  }
  if (done.notReached > 0) {
    const one = done.notReached === 1
    parts.push(`${done.notReached} more ${one ? 'suggestion waits' : 'suggestions wait'}: press again to send ${one ? 'it' : 'them'} on.`)
  }
  return parts.join(' ')
}

/** What a press says when the send may have stopped part way. */
export const OVERDUE_UNSURE = 'The send may not have finished, so some emails may already have gone. Pressing again sends on only the suggestions not yet passed on.'

/** The status when a press of Send on failed: "Not sent" only for a refusal before sending. */
export function overdueSendFailedWords(err: unknown): string {
  return refusedBeforeSending(err) ? `Not sent: ${errorWords(err)}` : OVERDUE_UNSURE
}

/** The status when asking how many are waiting failed: nothing is claimed about sending. */
export function overdueAskFailedWords(err: unknown): string {
  return `Could not ask how many suggestions are waiting: ${errorWords(err)}`
}
