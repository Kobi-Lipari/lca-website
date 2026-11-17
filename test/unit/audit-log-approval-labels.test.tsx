// @vitest-environment jsdom
//
// test/unit/audit-log-approval-labels.test.tsx
//
// The activity log's rows for the three moves of a representative's club
// event through the LCA admins' wait (WS09 step 18). Each move that goes
// through writes one row (functions/api/admin/tournaments/[id]/approval.ts)
// with the event's name as its label and its id alone as its detail; the
// panel in src/areas/admin/components/AuditLogPanel.tsx draws each in words,
// beside the event's name and who made the move, never the action's own name.
// No such row exists while REGION_EVENTS_ON is unset, so the panel is today's
// until then; here the rows are made up and the API is mocked.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { adminGetAuditLog, type ApiAuditEntry } from '@/lib/api'

const api = vi.hoisted(() => ({ rows: [] as unknown[] }))
vi.mock('@/lib/api', () => ({
  adminGetAuditLog: vi.fn(async () => api.rows),
}))

import { AuditLogPanel } from '@/areas/admin/components/AuditLogPanel'

afterEach(() => {
  cleanup()
  api.rows = []
})

let seq = 0
/** A made-up row of the activity log about one event. */
function row(action: string): ApiAuditEntry {
  return {
    id: `fx-${++seq}`,
    actor_id: 'fx-admin',
    actor_email: 'player.one@example.org',
    action,
    target_member_id: null,
    target_label: 'Example Winter Open',
    detail: JSON.stringify({ tournament_id: 'example-winter-open' }),
    created_at: '2026-12-03 19:00:00',
  }
}

const LABELS = [
  ['tournament_submitted', 'Sent event for LCA review'],
  ['tournament_approved', 'Approved and published event'],
  ['tournament_changes_asked', 'Asked for changes to event'],
] as const

describe('the activity log draws the approval wait\'s three moves', () => {
  it('each in words, beside the event\'s name and who made the move, never the action\'s name', async () => {
    api.rows = LABELS.map(([action]) => row(action))
    render(<AuditLogPanel />)
    for (const [action, label] of LABELS) {
      const badge = await screen.findByText(label, { selector: 'span' })
      const line = badge.closest('div.min-w-0')
      expect(line?.textContent, action).toContain('Example Winter Open')
      expect(line?.textContent, action).toContain('by player.one@example.org')
      expect(document.body.textContent, action).not.toContain(action)
    }
  })

  it('asks for the three moves under the Events filter, within the 20 actions the server reads', async () => {
    render(<AuditLogPanel />)
    fireEvent.click(await screen.findByRole('button', { name: 'Events' }))
    await waitFor(() => expect(vi.mocked(adminGetAuditLog).mock.calls.some(([query]) => query?.action?.includes('tournament_approved'))).toBe(true))
    const asked = vi.mocked(adminGetAuditLog).mock.calls.map(([query]) => query?.action).find((action) => action?.includes('tournament_approved')) ?? ''
    const actions = asked.split(',')
    for (const [action] of LABELS) expect(actions, action).toContain(action)
    expect(actions).toContain('tournament_publish')
    expect(actions.length).toBeLessThanOrEqual(20)
  })
})
