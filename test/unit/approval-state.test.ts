// test/unit/approval-state.test.ts
//
// Where an event stands in the LCA admins' wait (domain/events/approval.ts,
// WS09 steps 16 and 18): approvalState names the four states from the three
// stored columns, and agrees with mayList on every row. A time that is empty
// or only spaces reads as not set; the mark is the number 1 alone.
import { describe, expect, it } from 'vitest'
import { approvalState, mayList, type ApprovalWaitEvent } from '../../domain/events/approval'

const STAMP = '2026-12-01 18:30:00'

const event = (over: Partial<ApprovalWaitEvent>): ApprovalWaitEvent => ({
  needs_lca_approval: 1,
  approved_at: null,
  approval_requested_at: null,
  ...over,
})

describe('approvalState', () => {
  it.each([
    ['a marked event with nothing set is a draft', event({}), 'draft'],
    ['a marked event sent for review is in review', event({ approval_requested_at: STAMP }), 'in_review'],
    ['a marked event approved is approved', event({ approved_at: STAMP }), 'approved'],
    ['approval wins over a request left standing', event({ approved_at: STAMP, approval_requested_at: STAMP }), 'approved'],
    ['an empty approved_at reads as not set: a draft', event({ approved_at: '' }), 'draft'],
    ['an approved_at of spaces reads as not set: in review when sent', event({ approved_at: '   ', approval_requested_at: STAMP }), 'in_review'],
    ['an empty request reads as not sent', event({ approval_requested_at: '' }), 'draft'],
    ['a request of spaces reads as not sent', event({ approval_requested_at: ' \t ' }), 'draft'],
    ['an event not marked is not_marked', event({ needs_lca_approval: 0 }), 'not_marked'],
    ['an event not marked stays not_marked with every time set', event({ needs_lca_approval: 0, approved_at: STAMP, approval_requested_at: STAMP }), 'not_marked'],
    ['a mark that is not the number 1 is not a mark', event({ needs_lca_approval: 2 }), 'not_marked'],
    ['a mark of null is not a mark', event({ needs_lca_approval: null as unknown as number }), 'not_marked'],
  ])('%s', (_, row, state) => {
    expect(approvalState(row)).toBe(state)
  })

  it('agrees with mayList: only a marked event not yet approved may not list', () => {
    const rows: ApprovalWaitEvent[] = [
      event({}), event({ approval_requested_at: STAMP }), event({ approved_at: STAMP }), event({ approved_at: '  ' }),
      event({ needs_lca_approval: 0 }), event({ needs_lca_approval: 0, approved_at: STAMP }),
    ]
    for (const row of rows) {
      const state = approvalState(row)
      expect(mayList(row), JSON.stringify(row)).toBe(state === 'approved' || state === 'not_marked')
    }
  })
})
