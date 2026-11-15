// domain/events/approval.ts
// The wait for an LCA admin's approval (WS09, the brief's data model): a
// regional representative's club event is marked needs_lca_approval 1 and
// may not list until an LCA admin approves it, which sets approved_at. Every
// event not marked lists as today. The rule reads the event's own two
// columns (migration 0070) and nothing else, so the server and the pages get
// the same answer; nothing calls it yet, since the publish paths and the
// pages that show the wait come with WS09 steps 17 to 19.

/** The two columns of a tournament the wait reads. */
export interface ApprovalEvent {
  /** 1 while the event waits for an LCA admin's approval; 0 for every event not marked. */
  needs_lca_approval: number
  /** When an LCA admin approved it; null until then. */
  approved_at: string | null
}

/** The refusal of a publish while the event waits: what the person is told, in words. */
export const WAITING_FOR_APPROVAL = 'This event is waiting for LCA approval. An LCA admin publishes it.'

/**
 * Whether the event may list: false while it is marked for approval
 * (needs_lca_approval 1) and approved_at is empty, true once approved_at is
 * set, and true for every event not marked.
 */
export function mayList(event: ApprovalEvent): boolean {
  if (event.needs_lca_approval !== 1) return true
  return typeof event.approved_at === 'string' && event.approved_at.trim() !== ''
}
