// @vitest-environment jsdom
//
// FilterChip (WS01 step 26): a toggle with aria-pressed and an optional
// count, and a remove button named "Remove filter: <name>". The toggle and
// the remove button are siblings in the chip, never one inside the other
// (axe's nested-interactive), and the remove button is 24 by 24 pixels
// (WCAG 2.2's target size). Its colours are tokens: off, the surface and the
// ink; on, the soon tag's tint and words with a gold-ink line and a check
// mark, so the state shows by shape as well as colour.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FilterChip } from '@/components/ui/filter-chip'

afterEach(cleanup)

const source = readFileSync(join(__dirname, '../../src/components/ui/filter-chip.tsx'), 'utf8')

describe('the toggle', () => {
  it('is a button that says whether the filter is on, and asks for the other state when pressed', () => {
    const onPressedChange = vi.fn()
    const { rerender } = render(<FilterChip label="Classical" pressed={false} onPressedChange={onPressedChange} />)
    const toggle = screen.getByRole('button', { name: 'Classical' })
    expect(toggle.getAttribute('type')).toBe('button')
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(toggle)
    expect(onPressedChange).toHaveBeenLastCalledWith(true)
    rerender(<FilterChip label="Classical" pressed onPressedChange={onPressedChange} />)
    expect(screen.getByRole('button', { name: 'Classical', pressed: true })).toBe(toggle)
    fireEvent.click(toggle)
    expect(onPressedChange).toHaveBeenLastCalledWith(false)
  })

  it('shows a check mark only when the filter is on, hidden from screen readers', () => {
    const { container, rerender } = render(<FilterChip label="This month" pressed={false} onPressedChange={() => {}} />)
    expect(container.querySelector('svg')).toBeNull()
    rerender(<FilterChip label="This month" pressed onPressedChange={() => {}} />)
    const check = container.querySelector('[data-slot="filter-chip-toggle"] svg')!
    expect(check).not.toBeNull()
    expect(check.getAttribute('aria-hidden')).toBe('true')
    expect(screen.getByRole('button', { name: 'This month' })).toBeTruthy()
  })

  it('takes the soon tag\'s tint and words and a gold-ink line when on, and the surface and ink when off', () => {
    const { container, rerender } = render(<FilterChip label="Classical" pressed={false} onPressedChange={() => {}} />)
    const chip = () => container.querySelector('[data-slot="filter-chip"]') as HTMLElement
    expect(chip().getAttribute('data-state')).toBe('off')
    for (const cls of ['border-hairline', 'bg-surface', 'text-ink']) expect(chip().className.split(' '), cls).toContain(cls)
    rerender(<FilterChip label="Classical" pressed onPressedChange={() => {}} />)
    expect(chip().getAttribute('data-state')).toBe('on')
    for (const cls of ['border-gold-ink', 'bg-status-soon-tint', 'text-status-soon']) expect(chip().className.split(' '), cls).toContain(cls)
    expect(chip().className.split(' ')).not.toContain('bg-surface')
  })

  it('is the tile\'s chip: 32px high, a 6px radius and 13px words', () => {
    const { container } = render(<FilterChip label="Classical" onPressedChange={() => {}} />)
    const chip = container.querySelector('[data-slot="filter-chip"]')!
    for (const cls of ['h-8', 'rounded-sm', 'text-[13px]', 'font-medium']) expect(chip.className.split(' '), cls).toContain(cls)
  })
})

describe('the count', () => {
  it('shows after the name in the monospace face, in the muted ink while off and the chip\'s words while on', () => {
    const { container, rerender } = render(<FilterChip label="Classical" count={2} onPressedChange={() => {}} />)
    const count = () => container.querySelector('[data-slot="filter-chip-count"]') as HTMLElement
    expect(count().textContent).toBe('2')
    expect(count().className).toBe('font-mono text-[11px] tabular-nums text-ink-muted')
    // The name and the count are read apart: "Classical 2".
    expect(screen.getByRole('button').textContent).toBe('Classical 2')
    rerender(<FilterChip label="Classical" count={2} pressed onPressedChange={() => {}} />)
    expect(count().className).toBe('font-mono text-[11px] tabular-nums')
  })

  it('shows a count of 0, and no count when none is given', () => {
    const { container, rerender } = render(<FilterChip label="Classical" count={0} onPressedChange={() => {}} />)
    expect(container.querySelector('[data-slot="filter-chip-count"]')?.textContent).toBe('0')
    rerender(<FilterChip label="Classical" onPressedChange={() => {}} />)
    expect(container.querySelector('[data-slot="filter-chip-count"]')).toBeNull()
    expect(screen.getByRole('button').textContent).toBe('Classical')
  })
})

describe('the remove button', () => {
  it('is named "Remove filter: <name>" and calls onRemove, apart from the toggle', () => {
    const onRemove = vi.fn()
    const onPressedChange = vi.fn()
    render(<FilterChip label="Scholastic" count={2} onPressedChange={onPressedChange} onRemove={onRemove} />)
    const remove = screen.getByRole('button', { name: 'Remove filter: Scholastic' })
    expect(remove.getAttribute('type')).toBe('button')
    fireEvent.click(remove)
    expect(onRemove).toHaveBeenCalledTimes(1)
    expect(onPressedChange).not.toHaveBeenCalled()
    // Its icon says nothing of its own; the name does.
    expect(remove.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(remove.textContent).toBe('')
  })

  it('sits beside the toggle in a group named for the filter, never inside it', () => {
    const { container } = render(<FilterChip label="Scholastic" onPressedChange={() => {}} onRemove={() => {}} />)
    const group = screen.getByRole('group', { name: 'Scholastic' })
    const toggle = screen.getByRole('button', { name: 'Scholastic' })
    const remove = screen.getByRole('button', { name: 'Remove filter: Scholastic' })
    expect(toggle.parentElement).toBe(group)
    expect(remove.parentElement).toBe(group)
    expect(toggle.contains(remove)).toBe(false)
    expect(remove.contains(toggle)).toBe(false)
    // No interactive element inside another anywhere in the chip.
    for (const el of container.querySelectorAll('button, a, input')) expect(el.querySelector('button, a, input'), el.outerHTML).toBeNull()
  })

  it('is 24 by 24 pixels, the smallest target WCAG 2.2 allows', () => {
    render(<FilterChip label="Scholastic" onRemove={() => {}} />)
    const classes = screen.getByRole('button', { name: 'Remove filter: Scholastic' }).className.split(' ')
    expect(classes).toContain('size-6')
    expect(classes).toContain('flex-none')
  })

  it('leaves out the group and the button when the chip cannot be removed', () => {
    render(<FilterChip label="Classical" onPressedChange={() => {}} />)
    expect(screen.queryByRole('group')).toBeNull()
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })
})

describe('a chip that can only be removed', () => {
  it('shows its name as a label, not a toggle, with its remove button', () => {
    render(<FilterChip label="Next 3 months" onRemove={() => {}} />)
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Remove filter: Next 3 months' })).toBeTruthy()
    const label = screen.getByText('Next 3 months')
    expect(label.getAttribute('data-slot')).toBe('filter-chip-label')
    expect(label.hasAttribute('aria-pressed')).toBe(false)
  })
})

describe('the file\'s colours', () => {
  it('are tokens, with no gold text class: the words on the gold tint are the soon tag\'s, beside its tint', () => {
    // The gold text classes, put together when the test runs, so Tailwind, which reads this file, builds no CSS for them.
    const gold = ['lca-gold', 'gold-ink', 'gold'].map((g) => ['text', g].join('-'))
    for (const cls of gold) expect(source, cls).not.toMatch(new RegExp(`(?<![\\w-])${cls}(?![\\w-])`))
    expect(source).not.toMatch(/#[0-9a-fA-F]{6}\b/)
    expect(source).toContain('"border-gold-ink bg-status-soon-tint text-status-soon"')
    // No token with an opacity modifier, which would need a line in the block for browsers that cannot mix colours.
    expect(source).not.toMatch(/\b(?:bg|text|border)-[a-z-]+\/\d+/)
  })
})
