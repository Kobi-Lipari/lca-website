// test/unit/helpers/heritagePages.tsx
//
// The six heritage pages as the unit tests draw them (WS01 step 31): the
// visitor each page is drawn for, and a page drawn on its own, as
// src/App.tsx lists the six with themeHeritage off. A test file that draws
// them mocks @/lib/supabase, and @/lib/api with the answers in heritageApi
// (test/unit/helpers/heritageAnswers.ts), before it imports this file.
import { render } from '@testing-library/react'
import type { ComponentType, ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import { AboutPage } from '@/pages/AboutPage'
import { AnnualMeetingPage } from '@/pages/AnnualMeetingPage'
import { BoardPage } from '@/pages/BoardPage'
import { BylawsPage } from '@/pages/BylawsPage'
import { ChampionsPage } from '@/pages/ChampionsPage'
import { MinutesPage } from '@/pages/MinutesPage'

/** A visitor who is not signed in, or an LCA admin, as the pages see them. */
export function visitor(role: 'member' | 'lca_admin' = 'member'): AuthContextValue {
  return {
    user: null, session: null, member: null, role, seats: [], managedClubs: [], isBoardMember: false,
    assuranceLevel: null, mfaRequired: false, loading: false, directedTournamentIds: [], signOut: async () => {},
  } as unknown as AuthContextValue
}

/** The six pages, with their addresses (HERITAGE_ROUTES) and what each waits for before it is drawn in full. */
export const HERITAGE_PAGES: ReadonlyArray<{ name: string; route: string; Page: ComponentType; drawnWhen: string }> = [
  { name: 'about', route: '/about', Page: AboutPage, drawnWhen: 'Who we are' },
  { name: 'board', route: '/governance/board', Page: BoardPage, drawnWhen: 'Player Three' },
  { name: 'bylaws', route: '/governance/bylaws', Page: BylawsPage, drawnWhen: 'Fixture bylaws' },
  { name: 'minutes', route: '/governance/minutes', Page: MinutesPage, drawnWhen: 'Fixture treasurer\'s report' },
  { name: 'meeting', route: '/meeting', Page: AnnualMeetingPage, drawnWhen: 'Join the meeting' },
  { name: 'champions', route: '/champions', Page: ChampionsPage, drawnWhen: 'All champions' },
]

/** A page's element in the router and the signed-in state it needs, at its own address. */
export function inRouter(route: string, element: ReactElement, role: 'member' | 'lca_admin' = 'member'): ReactElement {
  return (
    <AuthContext.Provider value={visitor(role)}>
      <MemoryRouter initialEntries={[route]}>{element}</MemoryRouter>
    </AuthContext.Provider>
  )
}

/** Draws a page on its own, as with themeHeritage off. */
export function drawOnItsOwn(name: string, role: 'member' | 'lca_admin' = 'member') {
  const page = HERITAGE_PAGES.find((p) => p.name === name)!
  return render(inRouter(page.route, <page.Page />, role))
}

/** Markup with every character past plain ASCII written as an escape, so a file holding it holds no dash character. */
export const escaped = (text: string) => text.replace(/[^\x20-\x7e]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`)
