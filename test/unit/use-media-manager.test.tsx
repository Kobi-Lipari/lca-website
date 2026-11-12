// @vitest-environment jsdom
//
// useMediaManager (src/areas/admin/useMediaManager.ts, WS16 step 6) on its
// own, with getMediaManager stubbed, so the one question it may ask is held
// to its rules without a page around it:
// - with mailLists off it asks nothing and answers no;
// - it asks only for a signed-in person, only once the session has loaded,
//   only for a role Admin does not let in, and only for a caller that needs
//   the answer;
// - it asks once a session: a re-draw, a second caller and a token refreshed
//   in the same sign-in session ask nothing more; a new sign-in session, a
//   different person and a session stepped up to a second factor each ask once;
// - while the first answer is on the way it says so, and a stepped-up session
//   keeps the answer it had meanwhile;
// - a question that fails reads as no, and is not asked again in a loop;
// - since checkpoint M's review, it asks for an LCA officer who holds a seat
//   and never for one without; it asks nobody before their own record has
//   arrived; and a question that failed answers no for the draw that met it
//   and is asked again the next time a page needs the answer, which waits
//   for it meanwhile.
// The answer only draws a page, so none of this is the grant; the server's
// guard is. Every person here is made up, each case's own, since the answer is
// kept for the session.
import { act, cleanup, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthContextValue } from '@/contexts/AuthContext'
import type { ApiMediaManager } from '@/lib/api'

const flags = vi.hoisted(() => ({ mailLists: true }))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return {
    ...real,
    FEATURES: {
      ...real.FEATURES,
      get mailLists() {
        return flags.mailLists
      },
    },
  }
})
const getMediaManager = vi.hoisted(() => vi.fn<() => Promise<ApiMediaManager>>())
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api')>()), getMediaManager }))

const { useMediaManager } = await import('@/areas/admin/useMediaManager')
const { AuthContext } = await import('@/contexts/auth-context')

let seq = 0
const part = (value: unknown) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
/** A bearer token in the sign-in service's shape, for a person in a sign-in session, at an assurance level. */
const token = (sub: string, sessionId: string, aal: string, extra = '') =>
  `${part({ alg: 'HS256', typ: 'JWT' })}.${part({ sub, session_id: sessionId, aal, role: 'authenticated' })}.sample-signature${extra}`

interface Who { id: string; role: string; loading: boolean; signedIn: boolean; access: string | undefined; seats?: string[]; recordLoading?: boolean }
/** A person of this case's own, signed in, in a session of their own, at aal2. */
function newPerson(role = 'member', seats: string[] = []): Who {
  const id = `member-sample-${++seq}`
  return { id, role, loading: false, signedIn: true, access: token(id, `session-sample-${seq}`, 'aal2'), seats }
}
// The person's own record and seats, as the auth context gives them once the record has arrived (checkpoint M's review).
const valueOf = (who: Who): AuthContextValue =>
  ({
    user: who.signedIn ? { id: who.id } : null,
    session: who.access ? { access_token: who.access } : null,
    member: who.signedIn && !who.recordLoading ? { id: who.id, role: who.role } : null,
    memberLoading: who.recordLoading ?? false,
    seats: (who.seats ?? []).map((slug) => ({ id: `seat-${slug}`, slug })),
    role: who.role,
    loading: who.loading,
  }) as unknown as AuthContextValue

/** The hook drawn for a person, who can be changed between draws. */
function draw(initial: Who, needed = true) {
  let who = initial
  const wrapper = ({ children }: { children: ReactNode }) => createElement(AuthContext.Provider, { value: valueOf(who) }, children)
  const view = renderHook(() => useMediaManager(needed), { wrapper })
  return {
    view,
    change: (next: Who) => {
      who = next
      view.rerender()
    },
  }
}
/** Lets the stubbed question's answer come and React draw it. */
const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve, 10)))

beforeEach(() => {
  flags.mailLists = true
  getMediaManager.mockReset()
  getMediaManager.mockResolvedValue({ mediaManager: true, secondFactor: true })
})
afterEach(cleanup)

describe('useMediaManager, whether it asks', () => {
  it('asks nothing with mailLists off, and answers no', async () => {
    flags.mailLists = false
    const { view } = draw(newPerson())
    await settle()
    expect(getMediaManager).not.toHaveBeenCalled()
    expect(view.result.current).toEqual({ asking: false, mediaManager: false, secondFactor: false })
  })

  it('asks nothing for a caller that does not need the answer', async () => {
    const { view } = draw(newPerson(), false)
    await settle()
    expect(getMediaManager).not.toHaveBeenCalled()
    expect(view.result.current).toEqual({ asking: false, mediaManager: false, secondFactor: false })
  })

  it('asks nothing for a signed-out person, or while the session is still loading, and asks once it has loaded', async () => {
    const out = newPerson()
    const { view, change } = draw({ ...out, signedIn: false, access: undefined })
    await settle()
    expect(getMediaManager).not.toHaveBeenCalled()
    change({ ...out, loading: true })
    await settle()
    expect(getMediaManager).not.toHaveBeenCalled()
    expect(view.result.current.asking).toBe(false)
    change(out)
    await settle()
    expect(getMediaManager).toHaveBeenCalledTimes(1)
    expect(view.result.current).toEqual({ asking: false, mediaManager: true, secondFactor: true })
  })

  it.each(['lca_admin', 'lca_observer', 'lca_officer'])('asks nothing for %s, whom Admin lets in by role, holding no seat', async (role) => {
    const { view } = draw(newPerson(role))
    await settle()
    expect(getMediaManager).not.toHaveBeenCalled()
    expect(view.result.current).toEqual({ asking: false, mediaManager: false, secondFactor: false })
  })

  it.each(['lca_admin', 'lca_observer'])('asks nothing for %s even with a seat: an LCA admin and the president send as themselves', async (role) => {
    draw(newPerson(role, ['media-manager']))
    await settle()
    expect(getMediaManager).not.toHaveBeenCalled()
  })

  it('asks for an LCA officer who holds a seat, once, and gives the answer (checkpoint M\'s review)', async () => {
    const { view } = draw(newPerson('lca_officer', ['media-manager']))
    await settle()
    expect(getMediaManager).toHaveBeenCalledTimes(1)
    expect(view.result.current).toEqual({ asking: false, mediaManager: true, secondFactor: true })
  })

  it('asks nobody before their own record has arrived, and asks once it has (checkpoint M\'s review)', async () => {
    const who = newPerson()
    const { view, change } = draw({ ...who, recordLoading: true })
    await settle()
    expect(getMediaManager).not.toHaveBeenCalled()
    expect(view.result.current).toEqual({ asking: false, mediaManager: false, secondFactor: false })
    change(who)
    await settle()
    expect(getMediaManager).toHaveBeenCalledTimes(1)
  })

  it.each(['member', 'club_rep', 'tournament_director', 'lca_auditor', 'guest'])('asks for %s, whom Admin does not let in', async (role) => {
    draw(newPerson(role))
    await settle()
    expect(getMediaManager).toHaveBeenCalledTimes(1)
  })
})

describe('useMediaManager, once a session', () => {
  it('says it is asking while the first answer is on the way, then gives it', async () => {
    let release!: (answer: ApiMediaManager) => void
    getMediaManager.mockReturnValue(new Promise<ApiMediaManager>((resolve) => { release = resolve }))
    const { view } = draw(newPerson())
    expect(view.result.current).toEqual({ asking: true, mediaManager: false, secondFactor: false })
    await act(async () => release({ mediaManager: false, secondFactor: true }))
    expect(view.result.current).toEqual({ asking: false, mediaManager: false, secondFactor: true })
  })

  it('asks nothing more for a second caller, a re-draw or a token refreshed in the same sign-in session', async () => {
    const who = newPerson()
    const first = draw(who)
    const second = draw(who)
    await settle()
    expect(getMediaManager).toHaveBeenCalledTimes(1)
    first.view.rerender()
    // The same sign-in session and level under a new token, as a refresh gives.
    const refreshed = token(who.id, `session-sample-${seq}`, 'aal2', 'x')
    first.change({ ...who, access: refreshed })
    second.change({ ...who, access: refreshed })
    await settle()
    expect(getMediaManager).toHaveBeenCalledTimes(1)
    expect(second.view.result.current.mediaManager).toBe(true)
  })

  it('asks once more for a new sign-in session of the same person, and once for a different person', async () => {
    const who = newPerson()
    const { change } = draw(who)
    await settle()
    expect(getMediaManager).toHaveBeenCalledTimes(1)
    change({ ...who, access: token(who.id, 'session-sample-another', 'aal2') })
    await settle()
    expect(getMediaManager).toHaveBeenCalledTimes(2)
    draw(newPerson())
    await settle()
    expect(getMediaManager).toHaveBeenCalledTimes(3)
  })

  it('asks once more when the session is stepped up to a second factor, and shows the answer it had meanwhile, never the loading state', async () => {
    const who = newPerson()
    const aal1 = { ...who, access: token(who.id, `session-sample-${seq}`, 'aal1') }
    getMediaManager.mockResolvedValueOnce({ mediaManager: true, secondFactor: false })
    const { view, change } = draw(aal1)
    await settle()
    expect(view.result.current).toEqual({ asking: false, mediaManager: true, secondFactor: false })

    let release!: (answer: ApiMediaManager) => void
    getMediaManager.mockReturnValueOnce(new Promise<ApiMediaManager>((resolve) => { release = resolve }))
    change({ ...who, access: token(who.id, `session-sample-${seq}`, 'aal2') })
    expect(getMediaManager).toHaveBeenCalledTimes(2)
    expect(view.result.current).toEqual({ asking: false, mediaManager: true, secondFactor: false })
    await act(async () => release({ mediaManager: true, secondFactor: true }))
    expect(view.result.current).toEqual({ asking: false, mediaManager: true, secondFactor: true })
  })
})

describe('useMediaManager, when the question fails', () => {
  it('reads as no for a person it has no earlier answer for, and does not ask again in a loop', async () => {
    getMediaManager.mockRejectedValue(new Error('Sample network failure'))
    const { view } = draw(newPerson())
    await settle()
    await settle()
    expect(getMediaManager).toHaveBeenCalledTimes(1)
    expect(view.result.current).toEqual({ asking: false, mediaManager: false, secondFactor: false })
  })

  it('keeps the answer the session had when a stepped-up session\'s question fails', async () => {
    const who = newPerson()
    const { view, change } = draw({ ...who, access: token(who.id, `session-sample-${seq}`, 'aal1') })
    await settle()
    expect(view.result.current.mediaManager).toBe(true)
    getMediaManager.mockRejectedValueOnce(new Error('Sample network failure'))
    change({ ...who, access: token(who.id, `session-sample-${seq}`, 'aal2') })
    await settle()
    expect(view.result.current).toEqual({ asking: false, mediaManager: true, secondFactor: true })
  })

  it('asks again the next time a page needs the answer, saying it is asking meanwhile, and gives that answer (checkpoint M\'s review)', async () => {
    const who = newPerson()
    getMediaManager.mockRejectedValueOnce(new Error('Sample network failure'))
    const first = draw(who)
    await settle()
    expect(first.view.result.current).toEqual({ asking: false, mediaManager: false, secondFactor: false })
    expect(getMediaManager).toHaveBeenCalledTimes(1)
    let release!: (answer: ApiMediaManager) => void
    getMediaManager.mockReturnValueOnce(new Promise<ApiMediaManager>((resolve) => { release = resolve }))
    first.view.unmount()
    const next = draw(who)
    expect(next.view.result.current).toEqual({ asking: true, mediaManager: false, secondFactor: false })
    expect(getMediaManager).toHaveBeenCalledTimes(2)
    await act(async () => release({ mediaManager: true, secondFactor: true }))
    expect(next.view.result.current).toEqual({ asking: false, mediaManager: true, secondFactor: true })
  })

  it('reads a token it cannot read as a session of no id, and still asks once', async () => {
    const who = newPerson()
    draw({ ...who, access: 'not-a-token' })
    await settle()
    expect(getMediaManager).toHaveBeenCalledTimes(1)
  })
})
