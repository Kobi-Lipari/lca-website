// @vitest-environment jsdom
//
// test/unit/audit-log-monthly-check-label.test.tsx
//
// The activity log's row for a press of "Send this month's check now"
// (WS09 checkpoint U's review). A press that sent writes a
// club_monthly_check_sent row (functions/api/admin/clubs/monthly-check.ts)
// with the month in words as its label and the counts as its detail; the
// panel in src/areas/admin/components/AuditLogPanel.tsx draws it as "Sent
// the monthly check", with the mail icon on the tint the other sent emails
// use, beside the month, who pressed it and the counts in words, never the
// action's own name. No row of the action exists while CLUB_KEEPERS_ON is
// unset, so the panel is today's until then; here the rows are made up and
// the API is mocked.
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiAuditEntry } from '@/lib/api'

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
/** A made-up row of the activity log. */
function row(action: string, targetLabel: string, detail: Record<string, unknown> | null = null): ApiAuditEntry {
  return {
    id: `fx-${++seq}`,
    actor_id: 'fx-admin',
    actor_email: 'player.one@example.org',
    action,
    target_member_id: null,
    target_label: targetLabel,
    detail: detail ? JSON.stringify(detail) : null,
    created_at: '2026-12-03 19:00:00',
  }
}

describe('the activity log draws a press of the monthly check', () => {
  it('as "Sent the monthly check", beside the month, who pressed it and the counts in words, never the action\'s name', async () => {
    api.rows = [
      row('club_monthly_check_sent', 'December 2026', { sent: 44, notSent: 1, notReached: 2 }),
      row('group_email_sent', 'Example newsletter', { recipients: 3 }),
    ]
    render(<AuditLogPanel />)
    const badge = await screen.findByText('Sent the monthly check', { selector: 'span' })
    const line = badge.closest('div.min-w-0')
    expect(line?.textContent).toContain('December 2026')
    expect(line?.textContent).toContain('by player.one@example.org · 44 sent, 1 not sent, 2 not reached')
    expect(document.body.textContent).not.toContain('club_monthly_check_sent')
    const other = screen.getByText('Sent group email', { selector: 'span' })
    expect(badge.className).toBe(other.className)
    expect(badge.querySelector('svg')?.getAttribute('class')).toBe(other.querySelector('svg')?.getAttribute('class'))
  })
})
