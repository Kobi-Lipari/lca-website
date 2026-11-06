// @vitest-environment jsdom
//
// The edges of the one line on what the standing director role allows, on
// today's Members page (D20, Q4), with standingDirectors on. Each member who
// holds the role has a line of their own beside their role select, which
// that select alone names as its description, so two standing directors in
// one table never share or swap a line. The line follows the role the table
// is given, not the select's own state: choosing the role asks the page to
// save it and draws nothing until the saved role comes back, and the line
// goes when the role is taken away. It is text a sighted reader sees, never
// hidden or kept for screen readers alone, and it stays while the row saves.
// The search box narrows the rows without moving a line to another row.
import { cleanup, fireEvent, render, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiAdminMember } from '@/lib/api'
import type { MembersTableAdminProps } from '@/areas/admin/components/MembersTable'

const flags = vi.hoisted(() => ({ standingDirectors: true }))
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return {
    ...real,
    FEATURES: new Proxy(real.FEATURES, {
      get: (target, key) => (key === 'standingDirectors' ? flags.standingDirectors : Reflect.get(target, key)),
    }),
  }
})

const { MembersTable } = await import('@/areas/admin/components/MembersTable')
const { STANDING_DIRECTOR_LINE } = await import('@/areas/admin/roles')

beforeEach(() => {
  flags.standingDirectors = true
})
afterEach(() => {
  cleanup()
  flags.standingDirectors = true
})

function member(id: string, name: string, role: string): ApiAdminMember {
  return {
    id, email: `${id}@example.invalid`, full_name: name, uscf_id: null, membership_status: 'active', membership_expiry: '2027-06-30',
    role, club_id: null, club_name: null,
  }
}

function adminProps(over: Partial<MembersTableAdminProps> = {}): MembersTableAdminProps {
  return {
    clubs: [], savingId: null, boardSeats: [], seatHolders: [],
    onRoleChange: () => {}, onClubChange: () => {}, onMembershipChange: () => {}, onNameChange: async () => true,
    onDelete: () => {}, onImpersonate: () => {}, onSeatAdd: () => {}, onSeatRemove: () => {},
    ...over,
  }
}

/** Each body row of the table, by the name in its name cell. */
function rows(container: HTMLElement): Map<string, HTMLElement> {
  const out = new Map<string, HTMLElement>()
  for (const row of container.querySelectorAll<HTMLElement>('tbody tr')) {
    const name = (row.querySelector('input') as HTMLInputElement | null)?.value
    if (name) out.set(name, row)
  }
  return out
}
function roleSelect(row: HTMLElement): HTMLSelectElement {
  const select = [...row.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.value === 'tournament_director'))
  if (!select) throw new Error('no role select')
  return select
}
/** The line a select names as its description, or null. */
function lineOf(select: HTMLSelectElement): HTMLElement | null {
  const id = select.getAttribute('aria-describedby')
  return id ? select.ownerDocument.getElementById(id) : null
}

const LANDRY = member('m-landry', 'Gerald Landry', 'tournament_director')
const BOUDREAUX = member('m-boudreaux', 'Claire Boudreaux', 'tournament_director')
const GUIDRY = member('m-guidry', 'Remy Guidry', 'member')

describe('the one line beside each standing director\'s role select', () => {
  it('gives two standing directors a line each, each select naming its own, with ids that differ', () => {
    const { container } = render(<MembersTable members={[LANDRY, BOUDREAUX, GUIDRY]} admin={adminProps()} />)
    const byName = rows(container)
    const lines = ['Gerald Landry', 'Claire Boudreaux'].map((name) => {
      const row = byName.get(name)!
      const line = lineOf(roleSelect(row))
      expect(line, name).not.toBeNull()
      expect(row.contains(line), name).toBe(true)
      expect(line!.textContent, name).toBe(STANDING_DIRECTOR_LINE)
      return line!
    })
    expect(lines[0].id).not.toBe(lines[1].id)
    expect(new Set([...container.querySelectorAll('[id]')].map((e) => e.id)).size).toBe(container.querySelectorAll('[id]').length)
    expect(lineOf(roleSelect(byName.get('Remy Guidry')!))).toBeNull()
    expect(within(container).getAllByText(STANDING_DIRECTOR_LINE)).toHaveLength(2)
  })

  it('follows the role the table is given: choosing the role asks the page to save it and draws the line once the saved role comes back, and takes it away with the role', () => {
    const onRoleChange = vi.fn()
    const { container, rerender } = render(<MembersTable members={[GUIDRY]} admin={adminProps({ onRoleChange })} />)
    const select = roleSelect(rows(container).get('Remy Guidry')!)
    fireEvent.change(select, { target: { value: 'tournament_director' } })
    expect(onRoleChange).toHaveBeenCalledWith('m-guidry', 'tournament_director')
    // The page has not saved yet: the table still holds the member's old role, so no line.
    rerender(<MembersTable members={[GUIDRY]} admin={adminProps({ onRoleChange, savingId: 'm-guidry' })} />)
    expect(within(container).queryByText(STANDING_DIRECTOR_LINE)).toBeNull()

    rerender(<MembersTable members={[{ ...GUIDRY, role: 'tournament_director' }]} admin={adminProps({ onRoleChange })} />)
    const granted = roleSelect(rows(container).get('Remy Guidry')!)
    expect(granted.value).toBe('tournament_director')
    expect(lineOf(granted)?.textContent).toBe(STANDING_DIRECTOR_LINE)

    rerender(<MembersTable members={[{ ...GUIDRY, role: 'club_rep' }]} admin={adminProps({ onRoleChange })} />)
    const taken = roleSelect(rows(container).get('Remy Guidry')!)
    expect(taken.hasAttribute('aria-describedby')).toBe(false)
    expect(within(container).queryByText(STANDING_DIRECTOR_LINE)).toBeNull()
  })

  it('is text a sighted reader sees: not hidden, not kept for screen readers alone, and still there while the row saves', () => {
    const { container } = render(<MembersTable members={[LANDRY]} admin={adminProps({ savingId: 'm-landry' })} />)
    const select = roleSelect(rows(container).get('Gerald Landry')!)
    expect(select.disabled).toBe(true)
    const line = lineOf(select)!
    expect(line).not.toBeNull()
    for (let el: HTMLElement | null = line; el && el !== container; el = el.parentElement) {
      expect(el.hasAttribute('hidden'), el.tagName).toBe(false)
      expect(el.getAttribute('aria-hidden'), el.tagName).not.toBe('true')
      expect(el.className, el.tagName).not.toMatch(/\b(sr-only|hidden|invisible)\b/)
    }
  })

  it('keeps each line with its own member when the search narrows the rows', () => {
    const { container } = render(<MembersTable members={[LANDRY, BOUDREAUX, GUIDRY]} admin={adminProps()} />)
    const search = container.querySelector('input[type="search"], input[placeholder]') as HTMLInputElement
    fireEvent.change(search, { target: { value: 'boudreaux' } })
    const byName = rows(container)
    expect([...byName.keys()]).toEqual(['Claire Boudreaux'])
    expect(lineOf(roleSelect(byName.get('Claire Boudreaux')!))?.id).toBe('standing-director-line-m-boudreaux')
    expect(within(container).getAllByText(STANDING_DIRECTOR_LINE)).toHaveLength(1)
  })

  it('draws no line for any row with the switch off, whoever holds the role', () => {
    flags.standingDirectors = false
    const { container } = render(<MembersTable members={[LANDRY, BOUDREAUX, GUIDRY]} admin={adminProps()} />)
    for (const row of rows(container).values()) expect(roleSelect(row).hasAttribute('aria-describedby')).toBe(false)
    expect(container.textContent).not.toContain(STANDING_DIRECTOR_LINE)
  })
})
