// domain/events/approvalWords.ts
// The approval wait's state in words, for every page that shows it (WS09
// step 19): the manage page's panel, the admin club page's rows and a club's
// Events tab in My region. The state is approvalState's, read from the
// event's own columns, and each date carries its weekday and year, the
// stored times being UTC (datetime('now')) shown in Louisiana time. Nothing
// here rests on a colour: the words are the state.

import { approvalState, type ApprovalState, type ApprovalWaitEvent } from './approval'
import { formatDate } from '../format/date'

/** A stored UTC time as a date with its weekday: "Sat, Nov 14, 2026". */
const dayOf = (stamp: string | null) => formatDate(stamp, { year: true, stored: 'utc' })

/**
 * The wait's state in one line: a draft not yet sent, sent for review with
 * the day it was sent, or approved with the day it was approved; null for an
 * event that never waits.
 */
export function waitWords(event: ApprovalWaitEvent): string | null {
  const state: ApprovalState = approvalState(event)
  if (state === 'not_marked') return null
  if (state === 'draft') return 'Draft. Not sent for LCA review yet.'
  if (state === 'in_review') return `Waiting for LCA approval. Sent for review on ${dayOf(event.approval_requested_at)}.`
  return `Approved by LCA on ${dayOf(event.approved_at)}.`
}

