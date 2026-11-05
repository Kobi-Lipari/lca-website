// @vitest-environment jsdom
//
// What the Directors window tells the person naming a director, the window
// the president's Directors button on Admin › Tournaments opens once
// standingDirectors is on (D21). Naming a director gives the member that
// event alone and never changes their role: POST
// /api/admin/tournaments/:id/directors writes a tournament_directors row and
// nothing else (functions/api/admin/tournaments/[id]/directors.ts, "it never
// changes their role"), so a one-event director stays a plain member, and
// the standing director role, which lets its holder create events, is
// granted by an LCA admin on the Members page alone (Q4). With the switch
// off the window is today's, word for word. With it on, the window does not
// tell the president that the member is given a role, nor name the role by
// its old label, which every other page then reads as "Standing director";
// its note says what naming does, DIRECTOR_NOTE, in the place today's note
// stands.
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const flags = vi.hoisted(() => ({ standingDirectors: false }))
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok-dirs' } } }) } },
}))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return {
    ...real,
    FEATURES: new Proxy(real.FEATURES, {
      get: (target, key) => (key === 'standingDirectors' ? flags.standingDirectors : Reflect.get(target, key)),
    }),
  }
})

const { DirectorsModal, DIRECTOR_NOTE } = await import('@/areas/admin/components/DirectorsModal')

/** Today's note under the search, as the window draws it with every switch off. */
const TODAYS_NOTE = 'Members you add are given the Tournament Director role automatically, and it\'s removed again when they no longer direct any tournaments.'

beforeEach(() => {
  flags.standingDirectors = false
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const path = url.split('?')[0]
    const body = path === '/api/admin/members' ? { members: [] }
      : path.endsWith('/directors') ? { directors: [] }
        : { error: 'Not found' }
    return new Response(JSON.stringify(body), { status: 'error' in body ? 404 : 200 })
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  flags.standingDirectors = false
})

async function openWindow() {
  render(<DirectorsModal tournament={{ id: 't-own', name: 'Presidents Cup' }} onClose={() => {}} />)
  await screen.findByText('No directors assigned yet.')
  return document.body.textContent ?? ''
}

describe('the Directors window\'s words', () => {
  it('with the switch off, keeps today\'s note word for word', async () => {
    const text = await openWindow()
    expect(text).toContain(TODAYS_NOTE)
    expect(text).not.toContain(DIRECTOR_NOTE)
  })

  it('with the switch on, does not tell the person naming a director that the member is given a role, since naming one never changes a role', async () => {
    flags.standingDirectors = true
    const text = await openWindow()
    expect(text).not.toMatch(/given the [^.]*\brole\b/i)
    expect(text).not.toContain('Tournament Director')
    // The note says what naming does, where today's note stands: under the search, the window's last words before Done.
    expect(DIRECTOR_NOTE).toBe('A director you add runs this event only. Adding one never changes their role.')
    const note = screen.getByText(DIRECTOR_NOTE)
    expect(note.tagName).toBe('P')
    expect(note.previousElementSibling?.getAttribute('placeholder')).toMatch(/^Search members/)
    expect(text).not.toContain(TODAYS_NOTE)
  })
})
