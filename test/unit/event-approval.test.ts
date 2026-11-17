// test/unit/event-approval.test.ts
//
// The wait for an LCA admin's approval, mayList in domain/events/approval.ts
// (WS09 step 16):
// - an event marked for approval (needs_lca_approval 1) may not list while
//   approved_at is empty, and may once approved_at is set;
// - every event not marked lists, whatever approved_at holds;
// - the refusal's words are the step's, one plain sentence each;
// - the file imports nothing, so the server and the pages can both read it,
//   and reads no switch and no clock.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { mayList, WAITING_FOR_APPROVAL } from '../../domain/events/approval'

const ROOT = resolve(__dirname, '../..')

describe('mayList', () => {
  it('is false while the event is marked and approved_at is empty', () => {
    expect(mayList({ needs_lca_approval: 1, approved_at: null })).toBe(false)
    expect(mayList({ needs_lca_approval: 1, approved_at: '' })).toBe(false)
    expect(mayList({ needs_lca_approval: 1, approved_at: '   ' })).toBe(false)
  })

  it('is true once approved_at is set', () => {
    expect(mayList({ needs_lca_approval: 1, approved_at: '2026-11-15 18:00:00' })).toBe(true)
  })

  it('is true for every event not marked, whatever approved_at holds', () => {
    for (const approved of [null, '', '2026-11-15 18:00:00']) expect(mayList({ needs_lca_approval: 0, approved_at: approved }), String(approved)).toBe(true)
  })

  it('reads a row as the database gives it, with the other columns beside the two', () => {
    const row = { id: 'example-fall-open', name: 'Example Fall Open', is_visible: 0, needs_lca_approval: 1, approved_at: null, approved_by: null }
    expect(mayList(row)).toBe(false)
    expect(mayList({ ...row, approved_at: '2026-11-15 18:00:00', approved_by: 'member-player-one' })).toBe(true)
  })
})

describe('the refusal', () => {
  it('says the event waits and who publishes it, in two plain sentences', () => {
    expect(WAITING_FOR_APPROVAL).toBe('This event is waiting for LCA approval. An LCA admin publishes it.')
    expect(WAITING_FOR_APPROVAL).not.toContain('\n')
  })
})

describe('domain/events/approval.ts', () => {
  const source = readFileSync(join(ROOT, 'domain/events/approval.ts'), 'utf8')

  it('imports nothing and reads no switch, no clock and no setting', () => {
    expect(source).not.toMatch(/^\s*(?:import|export\s[^\n]*\sfrom)\s/m)
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(code).not.toMatch(/REGION_EVENTS_ON|CREATION_ROLES_ON|FEATURES|Date\.now|new Date|process\.|import\.meta/)
  })
})
