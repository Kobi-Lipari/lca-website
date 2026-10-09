// @vitest-environment jsdom
//
// Proves the component test setup: this file runs in jsdom (opted in by the
// comment above), compiles its JSX without importing React, and resolves
// '@/...' imports to src/. Later component tests follow the same pattern.
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { StatusBadge } from '@/components/StatusBadge'

afterEach(cleanup)

describe('component test setup', () => {
  it('runs in jsdom', () => {
    expect(typeof document).toBe('object')
    expect(navigator.userAgent).toContain('jsdom')
  })

  it('renders StatusBadge with its words and tone', () => {
    render(
      <StatusBadge tone="emerald" on="light">
        Registration open
      </StatusBadge>,
    )
    const badge = screen.getByText('Registration open')
    expect(badge.tagName).toBe('SPAN')
    expect(badge.className).toContain('rounded-full')
    expect(badge.className).toContain('bg-emerald-100')
    expect(badge.className).toContain('text-emerald-800')
  })

  it('uses the navy surface by default', () => {
    render(<StatusBadge tone="muted">Coming soon</StatusBadge>)
    expect(screen.getByText('Coming soon').className).toContain('text-white/60')
  })
})
