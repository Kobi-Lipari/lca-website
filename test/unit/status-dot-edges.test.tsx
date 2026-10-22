// @vitest-environment jsdom
//
// StatusDot's words under the new look (WS01 step 26), at their edges. The
// dot's one caller, the /tournaments list, draws it for every upcoming LCA
// event, whatever its registration status: tournaments.registration_status
// is draft, open or closed (migrations/0005), and the event page says
// "Registration is closed." for the last. With newLook on the dot's words
// are what a visitor reads in the list (acceptance criterion 5), so they
// must say the same thing the event page does, and there must always be
// some: a label that is blank leaves the dot its state's words, as a status
// tag's blank words leave it its default ones. With newLook off see
// status-badge.test.tsx and status-badge-edges.test.tsx.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return { ...real, FEATURES: { ...real.FEATURES, newLook: true } }
})

const { StatusDot } = await import('@/components/StatusBadge')
const { FEATURES } = await import('@/lib/features')

afterEach(cleanup)

const ROOT = join(__dirname, '../..')

/** The dot as drawn, with the words a visitor sees beside it. */
function dot(props: Parameters<typeof StatusDot>[0]) {
  const { container } = render(<StatusDot {...props} />)
  const wrap = container.firstElementChild as HTMLElement
  return { wrap, words: (wrap.textContent ?? '').trim() }
}

describe('StatusDot, newLook on', () => {
  it('runs with the switch on', () => {
    expect(FEATURES.newLook).toBe(true)
  })

  it('the database allows the three registration statuses the dot is drawn for', () => {
    const migration = readFileSync(join(ROOT, 'migrations/0005_email_registration_support.sql'), 'utf8')
    expect(migration).toContain("CHECK (registration_status IN ('draft', 'open', 'closed'))")
  })

  it('says registration is open, and opening soon, for open and draft', () => {
    expect(dot({ regStatus: 'open' }).words).toBe('Registration open')
    expect(dot({ regStatus: 'draft' }).words).toBe('Opening soon')
  })

  it('says registration is closed for a closed registration, as the event page does, never that it is coming soon', () => {
    const { words } = dot({ regStatus: 'closed' })
    expect(words).toMatch(/closed/i)
    expect(words).not.toMatch(/coming soon|opening soon|open$/i)
  })

  it('keeps its state\'s words for an empty or a blank label, so the dot is never shown without words', () => {
    const wordless: string[] = []
    for (const label of ['', '   ']) {
      cleanup()
      const { wrap, words } = dot({ regStatus: 'open', label })
      if (words !== 'Registration open') wordless.push(`label ${JSON.stringify(label)} shows ${JSON.stringify(wrap.textContent)}`)
      expect(wrap.hasAttribute('title')).toBe(false)
    }
    expect(wordless).toEqual([])
  })

  it('each state has words of its own, so no two read alike', () => {
    const said = ['open', 'draft', 'closed'].map((regStatus) => {
      cleanup()
      return dot({ regStatus }).words
    })
    expect(new Set(said).size).toBe(3)
    for (const words of said) expect(words).not.toBe('')
  })
})
