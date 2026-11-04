// @vitest-environment jsdom
//
// What the new chrome's bars share, src/components/layout/headerParts.ts,
// read on its own rather than through a bar:
//
// - the brand link's one name;
// - the sign-in pages: /login and the two password pages, each a route of
//   src/App.tsx, and no other page, a page whose address only begins with
//   the same letters among them;
// - the page Log in hands /login: the page the person is on, its query and
//   its hash; on a sign-in page, the page that page was handed, or nothing,
//   whatever else its state holds, and never the sign-in page itself, a
//   sign-in page known as the router knows it, whatever its letters' case
//   and with slashes at its end, since WS02 step 7;
// - the Join slot by the member's status: Renew once a membership has
//   expired, Join LCA for someone with no membership, and nothing for an
//   active member, a status the site does not know, a member not read yet
//   or while the member is read;
// - the person the rows are for, as the sign-in context holds them, with no
//   children yet;
// - a part fetched on demand: drawn on the first ask and kept, each ask
//   counted, opened and closed;
// - a change of page closing the sheet while it is open, and leaving it
//   closed when it was.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type { ApiMember } from '@/areas/membership/api'
import type { AuthContextValue } from '@/contexts/AuthContext'
import { HOME_NAME, SIGN_IN_PAGES, joinSlotOf, logInFrom, personOf, useClosedOnPageChange, useOnDemandPart } from '@/components/layout/headerParts'

const ROOT = join(__dirname, '../..')

/** A place as the router gives it. */
const at = (pathname: string, more: { search?: string; hash?: string; state?: unknown } = {}) => ({ pathname, search: more.search ?? '', hash: more.hash ?? '', state: more.state ?? null })

/** The sign-in context, as far as the shared parts read it. */
function auth(more: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    user: null,
    member: null,
    memberLoading: false,
    role: 'member',
    isBoardMember: false,
    managedClubs: [],
    directedTournamentIds: [],
    ...more,
  } as unknown as AuthContextValue
}
const member = (membership_status: string) => ({ id: 'fx-m-parts', membership_status, membership_expiry: '2027-01-01' }) as unknown as ApiMember

describe('the brand link\'s name', () => {
  it('is "Louisiana Chess Association, home"', () => {
    expect(HOME_NAME).toBe('Louisiana Chess Association, home')
  })
})

describe('the sign-in pages', () => {
  it('are /login and the two password pages, each a route src/App.tsx draws', () => {
    expect([...SIGN_IN_PAGES]).toEqual(['/login', '/forgot-password', '/reset-password'])
    const app = readFileSync(join(ROOT, 'src/App.tsx'), 'utf8')
    for (const page of SIGN_IN_PAGES) expect(app, page).toContain(`<Route path="${page}" element=`)
  })
})

describe('the page Log in hands /login', () => {
  it('is the page the person is on, its query and its hash with it', () => {
    expect(logInFrom(at('/tournaments', { search: '?when=weekend', hash: '#list' }))).toBe('/tournaments?when=weekend#list')
    expect(logInFrom(at('/'))).toBe('/')
    expect(logInFrom(at('/clubs/fx-club-north', { hash: '#map' }))).toBe('/clubs/fx-club-north#map')
    // A page's own state is not the page: elsewhere it is never handed on.
    expect(logInFrom(at('/news', { state: { from: '/membership' } }))).toBe('/news')
  })

  it.each([...SIGN_IN_PAGES])('on %s is the page that page was handed, or nothing, never the page itself', (page) => {
    expect(logInFrom(at(page, { state: { from: '/clubs?region=north#map' } }))).toBe('/clubs?region=north#map')
    for (const state of [null, undefined, {}, { from: undefined }, 'not a place', 7]) {
      expect(logInFrom(at(page, { state })), `${page} with ${JSON.stringify(state)}`).toBeUndefined()
    }
    // The page's own query and hash change nothing: a reset link's hash, its token among it, is never handed on.
    expect(logInFrom(at(page, { search: '?email=fx%40example.org', hash: '#access_token=fx-token&type=recovery' }))).toBeUndefined()
    expect(logInFrom(at(page, { hash: '#access_token=fx-token', state: { from: '/dashboard' } }))).toBe('/dashboard')
  })

  it('treats a page whose address only begins with a sign-in page\'s letters as any other page', () => {
    for (const page of ['/login-help', '/loginx', '/forgot-password-old', '/reset-passwords', '/logins/fx']) {
      expect(logInFrom(at(page, { state: { from: '/clubs' } })), page).toBe(page)
    }
  })

  it.each(['/Login', '/login/', '/FORGOT-PASSWORD', '/reset-password//', '/Reset-Password/'])('knows %s for a sign-in page as the router does, whatever its letters\' case and with slashes at its end, and hands on the page it was handed (WS02 step 7)', (page) => {
    expect(logInFrom(at(page, { state: { from: '/clubs?region=north#map' } }))).toBe('/clubs?region=north#map')
    expect(logInFrom(at(page, { search: '?email=fx%40example.org', hash: '#access_token=fx-token' }))).toBeUndefined()
  })

  it.each(['/login-help', '/logins', '/Login-Help/'])('still takes %s, which only begins with a sign-in page\'s letters, for a page of its own, its query and hash handed with it (WS02 step 7)', (page) => {
    expect(logInFrom(at(page, { search: '?q=fx', hash: '#top', state: { from: '/clubs' } }))).toBe(`${page}?q=fx#top`)
  })
})

describe('the Join slot', () => {
  it.each([
    ['expired', 'renew'],
    ['none', 'joinLca'],
    ['active', null],
    ['pending', null],
    ['', null],
  ] as const)('for a member whose status is "%s" is %s', (status, slot) => {
    expect(joinSlotOf(auth({ member: member(status) }))).toBe(slot)
  })

  it('is nothing while the member is read, whatever the status already held, and nothing with no member read', () => {
    for (const status of ['expired', 'none', 'active']) expect(joinSlotOf(auth({ member: member(status), memberLoading: true })), status).toBeNull()
    expect(joinSlotOf(auth({ member: null }))).toBeNull()
  })
})

describe('the person the rows are for', () => {
  it('is the sign-in context\'s role, seat and counts, with no children yet', () => {
    const held = personOf(
      auth({
        role: 'regional_rep',
        isBoardMember: true,
        managedClubs: [{ id: 'fx-club-1' }, { id: 'fx-club-2' }] as unknown as AuthContextValue['managedClubs'],
        directedTournamentIds: ['fx-event-1', 'fx-event-2', 'fx-event-3'],
      }),
    )
    expect(held).toEqual({ role: 'regional_rep', isBoardMember: true, managedClubs: 2, directedEvents: 3, hasChildren: false })
    expect(personOf(auth())).toEqual({ role: 'member', isBoardMember: false, managedClubs: 0, directedEvents: 0, hasChildren: false })
  })
})

describe('a part fetched on demand', () => {
  it('is not drawn until it is first asked for, then drawn for good, each ask counted, open on each ask and closed when told', () => {
    const { result } = renderHook(() => useOnDemandPart())
    expect([result.current.open, result.current.drawn, result.current.tries]).toEqual([false, false, 0])
    act(() => result.current.show())
    expect([result.current.open, result.current.drawn, result.current.tries]).toEqual([true, true, 1])
    act(() => result.current.setOpen(false))
    expect([result.current.open, result.current.drawn, result.current.tries]).toEqual([false, true, 1])
    act(() => result.current.show())
    act(() => result.current.show())
    expect([result.current.open, result.current.drawn, result.current.tries]).toEqual([true, true, 3])
  })
})

describe('a change of page', () => {
  /** A sheet's part and the router's navigate, as a bar holds them. */
  function sheetOnPage(path: string) {
    const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
    return renderHook(
      () => {
        const sheet = useOnDemandPart()
        useClosedOnPageChange(sheet)
        return { sheet, navigate: useNavigate() }
      },
      { wrapper },
    )
  }

  it('closes the sheet while it is open, and it opens again on the next ask', () => {
    const { result } = sheetOnPage('/tournaments')
    act(() => result.current.sheet.show())
    expect(result.current.sheet.open).toBe(true)
    act(() => result.current.navigate('/clubs'))
    expect(result.current.sheet.open).toBe(false)
    expect(result.current.sheet.drawn).toBe(true)
    act(() => result.current.sheet.show())
    expect(result.current.sheet.open).toBe(true)
  })

  it('leaves a closed sheet closed, and never draws one not yet asked for', () => {
    const { result } = sheetOnPage('/tournaments')
    act(() => result.current.navigate('/clubs'))
    expect([result.current.sheet.open, result.current.sheet.drawn]).toEqual([false, false])
    act(() => result.current.sheet.show())
    act(() => result.current.sheet.setOpen(false))
    act(() => result.current.navigate('/news'))
    expect([result.current.sheet.open, result.current.sheet.drawn]).toEqual([false, true])
  })

  it('closes it once for each change, and a later ask on the new page keeps it open', () => {
    const { result } = sheetOnPage('/')
    for (const next of ['/clubs', '/news', '/membership']) {
      act(() => result.current.sheet.show())
      act(() => result.current.navigate(next))
      expect(result.current.sheet.open, next).toBe(false)
    }
    act(() => result.current.sheet.show())
    expect(result.current.sheet.open).toBe(true)
  })
})
