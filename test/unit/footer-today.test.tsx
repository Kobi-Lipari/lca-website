// @vitest-environment jsdom
//
// Today's footer, the one every visitor sees with every switch off, against
// a copy of itself (WS02 step 8): test/unit/fixtures/footer-today.tsx is
// src/components/layout/Footer.tsx as it stood at commit 7683c68, word for
// word but for its first comment, its export's name and the three dashes of
// its comments, which render nothing. Both are drawn under the same router
// and their markup is compared byte for byte:
//
// - at three addresses: the home page, /clubs and /contact, the two pages
//   the new footer's links reach into;
// - with newLook and newNav in the three mixes that leave the chrome off:
//   with both on (the chrome), Footer draws the new footer at every width,
//   which test/unit/footer.test.tsx holds, and none of today's words.
import { cleanup, render } from '@testing-library/react'
import type { User } from '@supabase/supabase-js'
import type { ComponentType } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'

const flags = vi.hoisted(() => ({ newLook: false, newNav: false }))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return {
    ...real,
    FEATURES: {
      ...real.FEATURES,
      get newLook() {
        return flags.newLook
      },
      get newNav() {
        return flags.newNav
      },
    },
  }
})
vi.mock('@/lib/supabase', () => ({ supabase: {} }))

const { Footer } = await import('@/components/layout/Footer')
const { FooterToday } = await import('./fixtures/footer-today')

/** The addresses the two footers are drawn at. */
const PATHS = ['/', '/clubs', '/contact'] as const

/**
 * newLook and newNav in the three mixes where Footer draws today's footer.
 * With both on, the chrome, it draws the new footer, so that mix is drawn
 * once below, to show it is not today's.
 */
const SWITCHES = [
  { newLook: false, newNav: false },
  { newLook: true, newNav: false },
  { newLook: false, newNav: true },
] as const

/** A visitor signed out, as the new footer reads one; today's footer reads no one. */
const SIGNED_OUT = {
  user: null as User | null,
  session: null,
  member: null,
  role: 'member',
  seats: [],
  managedClubs: [],
  isBoardMember: false,
  assuranceLevel: null,
  mfaRequired: false,
  directedTournaments: [],
  directedTournamentIds: [],
  loading: false,
  memberLoading: false,
  signOut: async () => {},
} as unknown as AuthContextValue

/** One footer's markup at an address. */
function markup(Which: ComponentType, path: string): string {
  const { container } = render(
    <AuthContext.Provider value={SIGNED_OUT}>
      <MemoryRouter initialEntries={[path]}>
        <Which />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  const html = container.innerHTML
  cleanup()
  return html
}

afterEach(() => {
  cleanup()
  Object.assign(flags, { newLook: false, newNav: false })
})

describe('today\'s footer, with the chrome off', () => {
  for (const mix of SWITCHES) {
    for (const path of PATHS) {
      it(`with newLook ${mix.newLook ? 'on' : 'off'} and newNav ${mix.newNav ? 'on' : 'off'}, at ${path}: the live footer is the copy, byte for byte`, () => {
        Object.assign(flags, mix)
        const live = markup(Footer, path)
        const copy = markup(FooterToday, path)
        expect(live).toBe(copy)
        // It is today's footer, read by its own words, not an empty drawing.
        expect(live).toContain('Serving Louisiana players since 1915')
        expect(live).toContain('Follow us on Facebook')
        expect(live).not.toContain('site-footer')
      })
    }
  }
})

describe('the new footer, with the chrome on', () => {
  it.each(PATHS)('at %s: the live Footer draws the new footer, with none of today\'s words', (path) => {
    Object.assign(flags, { newLook: true, newNav: true })
    const live = markup(Footer, path)
    expect(live).toContain('data-slot="site-footer"')
    for (const words of ['Serving Louisiana players since 1915', 'Follow us on Facebook', 'Find a tournament', 'All rights reserved', 'Chess clubs', 'Meeting minutes', 'Contact us']) {
      expect(live, words).not.toContain(words)
    }
    expect(live).not.toBe(markup(FooterToday, path))
  })
})
