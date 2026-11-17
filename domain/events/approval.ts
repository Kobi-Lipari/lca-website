// domain/events/approval.ts
// The wait for an LCA admin's approval (WS09, the brief's data model): a
// regional representative's club event is marked needs_lca_approval 1 and
// may not list until an LCA admin approves it, which sets approved_at. Every
// event not marked lists as today. The rule reads the event's own columns
// (migration 0070) and nothing else, so the server and the pages get the
// same answer. The setup save (PATCH /api/admin/tournaments/[id]) refuses a
// publish in its words since WS09 step 17; Submit for LCA review, Approve and
// publish and Ask for changes (POST /api/admin/tournaments/[id]/approval)
// move an event between the wait's states since WS09 step 18, and the pages
// that show the wait come with WS09 step 19.

/** The two columns of a tournament the wait reads. */
export interface ApprovalEvent {
  /** 1 while the event waits for an LCA admin's approval; 0 for every event not marked. */
  needs_lca_approval: number
  /** When an LCA admin approved it; null until then. */
  approved_at: string | null
}

/** The refusal of a publish while the event waits: what the person is told, in words. */
export const WAITING_FOR_APPROVAL = 'This event is waiting for LCA approval. An LCA admin publishes it.'

/** Whether a stored time is set: a string with something in it. */
const isSet = (value: string | null | undefined) => typeof value === 'string' && value.trim() !== ''

/**
 * Whether the event may list: false while it is marked for approval
 * (needs_lca_approval 1) and approved_at is empty, true once approved_at is
 * set, and true for every event not marked.
 */
export function mayList(event: ApprovalEvent): boolean {
  if (event.needs_lca_approval !== 1) return true
  return isSet(event.approved_at)
}

/** The three columns of a tournament the wait's state reads. */
export interface ApprovalWaitEvent extends ApprovalEvent {
  /** When the event was sent for LCA review; null while it is a draft, and again once an LCA admin asks for changes. */
  approval_requested_at: string | null
}

/**
 * Where a marked event stands in the wait: a draft (nothing sent), in
 * review (sent and not yet approved) or approved; and not_marked for every
 * event that never waits. The mark is read as mayList reads it, the number
 * 1 alone, and an empty or blank time reads as not set.
 */
export type ApprovalState = 'not_marked' | 'draft' | 'in_review' | 'approved'

export function approvalState(event: ApprovalWaitEvent): ApprovalState {
  if (event.needs_lca_approval !== 1) return 'not_marked'
  if (isSet(event.approved_at)) return 'approved'
  return isSet(event.approval_requested_at) ? 'in_review' : 'draft'
}
