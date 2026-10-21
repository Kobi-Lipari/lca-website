// @vitest-environment jsdom
//
// FilterChip at its edges (WS01 step 26).
//
// - It is controlled: pressing the toggle asks for the other state and the
//   chip shows what its pressed prop says, so a list that refuses the change
//   keeps the chip as it was.
// - Its two buttons never submit a form they sit in, since a filter bar may
//   live inside one.
// - In a row of chips each remove button names its own filter, and no name
//   is shared; the remove button's name never carries the count, while the
//   toggle's is the filter's name and then the count.
// - A chip that can only be removed is not a toggle: nothing in it says
//   pressed, and it is not read as one.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FilterChip } from '@/components/ui/filter-chip'

afterEach(cleanup)

describe('a controlled toggle', () => {
  it('keeps showing its pressed prop when the list does not change it, and asks for the other state each time', () => {
    const onPressedChange = vi.fn()
    render(<FilterChip label="Classical" pressed={false} onPressedChange={onPressedChange} />)
    const toggle = screen.getByRole('button', { name: 'Classical' })
    fireEvent.click(toggle)
    fireEvent.click(toggle)
    expect(onPressedChange.mock.calls).toEqual([[true], [true]])
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    expect(toggle.closest('[data-slot="filter-chip"]')?.getAttribute('data-state')).toBe('off')
  })
})

describe('inside a form', () => {
  it('neither the toggle nor the remove button submits it', () => {
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault())
    render(
      <form onSubmit={onSubmit} aria-label="Filters">
        <FilterChip label="Scholastic" count={2} onPressedChange={() => {}} onRemove={() => {}} />
      </form>,
    )
    const form = screen.getByRole('form', { name: 'Filters' })
    const buttons = within(form).getAllByRole('button')
    expect(buttons).toHaveLength(2)
    for (const button of buttons) {
      expect(button.getAttribute('type')).toBe('button')
      fireEvent.click(button)
    }
    expect(onSubmit).not.toHaveBeenCalled()
  })
})

describe('a row of chips', () => {
  const filters = [
    { label: 'This month', count: 4 },
    { label: 'Classical', count: 2 },
    { label: 'Under 1600 & scholastic', count: 0 },
    { label: 'Near me' },
  ]

  it('gives every remove button its own filter\'s name, and the toggles their name and then their count', () => {
    const removed: string[] = []
    render(
      <div>
        {filters.map((f) => (
          <FilterChip key={f.label} label={f.label} count={f.count} onPressedChange={() => {}} onRemove={() => removed.push(f.label)} />
        ))}
      </div>,
    )
    const removes = screen.getAllByRole('button', { name: /^Remove filter: / })
    expect(removes.map((b) => b.getAttribute('aria-label'))).toEqual(filters.map((f) => `Remove filter: ${f.label}`))
    for (const b of removes) expect(b.getAttribute('aria-label')).not.toMatch(/\d+$/)
    const toggles = screen.getAllByRole('button', { pressed: false })
    expect(toggles.map((b) => b.textContent)).toEqual(filters.map((f) => (f.count === undefined ? f.label : `${f.label} ${f.count}`)))
    // Each name once, so a screen reader's list of buttons tells them apart.
    const names = [...removes, ...toggles].map((b) => b.getAttribute('aria-label') ?? b.textContent)
    expect(new Set(names).size).toBe(names.length)
    fireEvent.click(removes[2])
    expect(removed).toEqual(['Under 1600 & scholastic'])
  })

  it('names each group for its filter, so a removable chip is one thing among the rest', () => {
    render(
      <div>
        {filters.map((f) => (
          <FilterChip key={f.label} label={f.label} onPressedChange={() => {}} onRemove={() => {}} />
        ))}
      </div>,
    )
    expect(screen.getAllByRole('group').map((g) => g.getAttribute('aria-label'))).toEqual(filters.map((f) => f.label))
    for (const f of filters) {
      const group = screen.getByRole('group', { name: f.label })
      expect(within(group).getAllByRole('button')).toHaveLength(2)
    }
  })
})

describe('a chip that can only be removed', () => {
  it('says nothing about being pressed, even when it is on', () => {
    const { container } = render(<FilterChip label="Next 3 months" pressed onRemove={() => {}} />)
    expect(container.querySelector('[aria-pressed]')).toBeNull()
    expect(screen.queryByRole('button', { pressed: true })).toBeNull()
    expect(screen.getAllByRole('button')).toEqual([screen.getByRole('button', { name: 'Remove filter: Next 3 months' })])
    // Its check mark, when drawn, is decoration only.
    for (const svg of container.querySelectorAll('svg')) expect(svg.getAttribute('aria-hidden')).toBe('true')
  })

  it('removes itself with one press, and only once per press', () => {
    const onRemove = vi.fn()
    render(<FilterChip label="Next 3 months" onRemove={onRemove} />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove filter: Next 3 months' }))
    expect(onRemove).toHaveBeenCalledTimes(1)
  })
})

describe('a chip with neither control', () => {
  it('is a plain label: no button, no group', () => {
    const { container } = render(<FilterChip label="Classical" count={2} />)
    expect(screen.queryAllByRole('button')).toEqual([])
    expect(screen.queryByRole('group')).toBeNull()
    expect(container.textContent).toBe('Classical 2')
  })
})
