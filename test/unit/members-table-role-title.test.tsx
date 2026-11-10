// @vitest-environment jsdom
//
// The one line on what the standing director role allows, on today's
// Members page (D20, Q4). The Members table draws each member's role as a
// select for an LCA admin. With standingDirectors on, the select of a member
// who holds tournament_director names the role "Standing director" and has
// the line beside it, as visible text that is the select's description; with
// the switch off the cell is today's. The line is never a title, on that
// option or any other, since a title reaches a mouse alone.
import { cleanup, render, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiAdminMember } from '@/lib/api'
import type { MembersTableAdminProps } from '@/areas/admin/components/MembersTable'

const flags = vi.hoisted(() => ({ standingDirectors: false }))
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

afterEach(() => {
  cleanup()
  flags.standingDirectors = false
})

function member(id: string, name: string, role: string): ApiAdminMember {
  return {
    id, email: `${id}@example.invalid`, full_name: name, uscf_id: null, membership_status: 'active', membership_expiry: '2027-06-30',
    role, club_id: null, club_name: null,
  }
}

/** The admin props of an LCA admin: empty lists and handlers that do nothing, so every edit control draws. */
function adminProps(over: Partial<MembersTableAdminProps> = {}): MembersTableAdminProps {
  return {
    clubs: [], savingId: null, boardSeats: [], seatHolders: [],
    onRoleChange: () => {}, onClubChange: () => {}, onMembershipChange: () => {}, onNameChange: async () => true,
    onDelete: () => {}, onImpersonate: () => {}, onSeatAdd: () => {}, onSeatRemove: () => {},
    ...over,
  }
}

const DIRECTOR = member('m-td', 'Gerald Landry', 'tournament_director')
const PLAIN = member('m-plain', 'Remy Guidry', 'member')

function drawTable(members: ApiAdminMember[], over: Partial<MembersTableAdminProps> = {}) {
  return render(<MembersTable members={members} admin={adminProps(over)} />)
}

/** The row of the member with this name. */
function rowOf(container: HTMLElement, name: string): HTMLElement {
  const row = [...container.querySelectorAll('tbody tr')].find((r) => (r.querySelector('input') as HTMLInputElement | null)?.value === name || r.textContent?.includes(name))
  if (!row) throw new Error(`no row for ${name}`)
  return row as HTMLElement
}

/** A row's role select: the select whose options are the roles. */
function roleSelect(row: HTMLElement): HTMLSelectElement {
  const select = [...row.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.value === 'tournament_director'))
  if (!select) throw new Error('no role select')
  return select
}

describe('the role select on the Members page', () => {
  it('draws one role select for the admin, with the seven roles as options', () => {
    const { container } = drawTable([DIRECTOR])
    const select = roleSelect(rowOf(container, 'Gerald Landry'))
    expect([...select.options].map((o) => o.value)).toEqual(['member', 'lca_auditor', 'lca_officer', 'lca_observer', 'club_rep', 'tournament_director', 'lca_admin'])
    expect(select.value).toBe('tournament_director')
  })

  it('with the switch on, names the role "Standing director" and draws the one line beside a standing director\'s choice, as its description', () => {
    flags.standingDirectors = true
    const { container } = drawTable([DIRECTOR])
    const row = rowOf(container, 'Gerald Landry')
    const select = roleSelect(row)
    expect(select.selectedOptions[0].textContent).toBe('Standing director')
    const described = select.getAttribute('aria-describedby')
    expect(described).toBe('standing-director-line-m-td')
    const line = container.ownerDocument.getElementById(described!)
    expect(line?.textContent).toBe(STANDING_DIRECTOR_LINE)
    // Visible text in the role's own cell, right beside the select.
    expect(line?.tagName).toBe('P')
    expect(line?.parentElement).toBe(select.parentElement)
    expect(line?.previousElementSibling).toBe(select)
    expect(within(row).getByText(STANDING_DIRECTOR_LINE)).toBe(line)
  })

  it('with the switch on, draws no line beside the choice of a member who holds another role', () => {
    flags.standingDirectors = true
    const { container } = drawTable([DIRECTOR, PLAIN])
    const plain = roleSelect(rowOf(container, 'Remy Guidry'))
    expect(plain.value).toBe('member')
    expect(plain.hasAttribute('aria-describedby')).toBe(false)
    expect(within(rowOf(container, 'Remy Guidry')).queryByText(STANDING_DIRECTOR_LINE)).toBeNull()
    expect(container.querySelectorAll('[id^="standing-director-line-"]')).toHaveLength(1)
  })

  it('with the switch off, names the role "Tournament Director" and draws no line and no description', () => {
    const { container } = drawTable([DIRECTOR, PLAIN])
    const select = roleSelect(rowOf(container, 'Gerald Landry'))
    expect(select.selectedOptions[0].textContent).toBe('Tournament Director')
    expect(select.hasAttribute('aria-describedby')).toBe(false)
    expect(container.textContent).not.toContain(STANDING_DIRECTOR_LINE)
    expect(container.querySelectorAll('[id^="standing-director-line-"]')).toHaveLength(0)
  })

  it.each([false, true])('gives no option of any role select a title, with the switch %s', (on) => {
    flags.standingDirectors = on
    const { container } = drawTable([DIRECTOR, PLAIN])
    const options = [...container.querySelectorAll('select option')]
    expect(options.length).toBeGreaterThan(14)
    expect(options.filter((o) => o.hasAttribute('title')).map((o) => o.textContent)).toEqual([])
    expect([...container.querySelectorAll('select')].filter((s) => s.hasAttribute('title'))).toEqual([])
  })

  it('draws the label, and no line, in the view-only table an officer reads, which has no role select', () => {
    flags.standingDirectors = true
    const { container } = drawTable([DIRECTOR], { viewOnly: true })
    const row = rowOf(container, 'Gerald Landry')
    expect([...row.querySelectorAll('select')]).toEqual([])
    expect(within(row).getByText('Standing director')).toBeTruthy()
    expect(container.textContent).not.toContain(STANDING_DIRECTOR_LINE)
  })

  it('draws neither the line nor the role column in the read-only lookup a director or auditor gets', () => {
    flags.standingDirectors = true
    const { container } = render(<MembersTable members={[DIRECTOR]} />)
    expect(container.querySelectorAll('select')).toHaveLength(0)
    expect(container.textContent).not.toContain(STANDING_DIRECTOR_LINE)
    expect(container.textContent).not.toContain('Standing director')
  })
})
