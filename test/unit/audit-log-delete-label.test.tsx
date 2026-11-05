// @vitest-environment jsdom
//
// test/unit/audit-log-delete-label.test.tsx
//
// The activity log's row for a deleted event (WS08 step 5). Once
// CREATION_ROLES_ON is set, every delete writes a tournament_delete row; the
// panel in src/areas/admin/components/AuditLogPanel.tsx draws it as "Deleted
// event", with the bin icon on the red tint the removed document's row uses,
// beside the event's name and who deleted it, never as the action's own
// name; and the Events filter asks for it, beside tournament_unpublish, in a
// list the audit endpoint reads whole (it reads the first 20 names of a
// list). Every action the Events filter asks for draws a label of its own.
// No row of the action exists while the constant is unset, so the panel is
// today's until then; here the rows are made up and the API is mocked.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiAuditEntry } from '@/lib/api'

const api = vi.hoisted(() => ({
  rows: [] as unknown[],
  asked: [] as Array<{ action?: string; limit?: number } | undefined>,
}))
vi.mock('@/lib/api', () => ({
  adminGetAuditLog: vi.fn(async (params?: { action?: string; limit?: number }) => {
    api.asked.push(params)
    return api.rows
  }),
}))

import { AuditLogPanel } from '@/areas/admin/components/AuditLogPanel'

afterEach(() => {
  cleanup()
  api.rows = []
  api.asked = []
})

/** The most actions the audit endpoint reads from one list (functions/api/admin/audit.ts). */
const ENDPOINT_READS = 20

let seq = 0
/** A made-up row of the activity log. */
function row(action: string, targetLabel: string, detail: Record<string, unknown> | null = null): ApiAuditEntry {
  return {
    id: `fx-${++seq}`,
    actor_id: 'fx-director',
    actor_email: 'gerald.landry@example.org',
    action,
    target_member_id: null,
    target_label: targetLabel,
    detail: detail ? JSON.stringify(detail) : null,
    created_at: '2026-11-05 19:00:00',
  }
}

/** The badge a row draws its label in. */
const badgeOf = (label: string) => screen.getByText(label, { selector: 'span' })

describe('the activity log draws a deleted event', () => {
  it('as "Deleted event", beside the event\'s name and who deleted it, never as the action\'s own name', async () => {
    api.rows = [row('tournament_delete', 'Lafayette Winter Quads', { tournament_id: 'fx-event', entries: 0, was_visible: 0, grant: 'standing_director' })]
    render(<AuditLogPanel />)
    const badge = await screen.findByText('Deleted event', { selector: 'span' })
    const line = badge.closest('div.min-w-0')
    expect(line?.textContent).toContain('Lafayette Winter Quads')
    expect(line?.textContent).toContain('by gerald.landry@example.org')
    expect(document.body.textContent).not.toContain('tournament_delete')
  })

  it('with the bin icon on the red tint the removed document\'s row uses, and not the unknown action\'s grey', async () => {
    api.rows = [
      row('tournament_delete', 'Lafayette Winter Quads'),
      row('document_remove', 'Minutes, Sat, Oct 24, 2026', { category: 'minutes' }),
      row('fx_unknown_action', 'Something new'),
    ]
    render(<AuditLogPanel />)
    const deleted = await screen.findByText('Deleted event', { selector: 'span' })
    const removed = badgeOf('Removed document')
    const unknown = badgeOf('fx_unknown_action')
    expect(deleted.className).toBe(removed.className)
    expect(deleted.className).toContain('bg-bad-100 text-bad-800')
    expect(deleted.className).not.toBe(unknown.className)
    const icon = (el: HTMLElement) => el.querySelector('svg')?.getAttribute('class')
    expect(icon(deleted)).toBeTruthy()
    expect(icon(deleted)).toBe(icon(removed))
    expect(icon(deleted)).not.toBe(icon(unknown))
  })
})

describe('the Events filter', () => {
  /** The list of actions the Events button asks for. */
  async function eventsList(): Promise<string[]> {
    render(<AuditLogPanel />)
    await waitFor(() => expect(api.asked.length).toBeGreaterThan(0))
    // All actions, first: no list at all.
    expect(api.asked[0]).toEqual({ action: undefined, limit: 200 })
    fireEvent.click(screen.getByRole('button', { name: 'Events' }))
    await waitFor(() => expect(api.asked.length).toBeGreaterThan(1))
    const asked = api.asked.at(-1)
    expect(asked?.limit).toBe(200)
    return (asked?.action ?? '').split(',')
  }

  it('asks for tournament_delete, right after tournament_unpublish, once, in a list the endpoint reads whole', async () => {
    const list = await eventsList()
    expect(list.filter((a) => a === 'tournament_delete')).toHaveLength(1)
    expect(list[list.indexOf('tournament_unpublish') + 1]).toBe('tournament_delete')
    expect(list.slice(0, 4)).toEqual(['tournament_create', 'tournament_publish', 'tournament_unpublish', 'tournament_delete'])
    expect(list.length).toBeLessThanOrEqual(ENDPOINT_READS)
    expect(new Set(list).size).toBe(list.length)
  })

  it('draws every action it asks for with a label of its own, never the action\'s name', async () => {
    const list = await eventsList()
    cleanup()
    api.rows = list.map((action, i) => row(action, `Event ${i + 1}`))
    render(<AuditLogPanel />)
    await screen.findByText('Event 1')
    for (const action of list) {
      expect(screen.queryByText(action, { selector: 'span' }), action).toBeNull()
    }
    expect(screen.getAllByText('Deleted event', { selector: 'span' })).toHaveLength(1)
  })
})
