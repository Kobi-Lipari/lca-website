// @vitest-environment jsdom
//
// The three modules step 23 made to fix lint errors in files it rewrote
// (react-refresh/only-export-components: a component file exports only
// components). Each kept its code as it was; these tests hold what it does
// and where it is reached from:
//
// - usChessState (src/areas/membership/usChess.ts, through the area's
//   index): none, unknown, valid, soon (inside 45 days) and expired, with
//   the expiry day counted to 23:59:59 local time, at midnight and on both
//   2026 clock changes in America/Chicago;
// - the club map helpers (src/areas/clubs/clubMap.ts, through the area's
//   index): the directions link, a club's spot from its own location or the
//   original club list, finding a pin by name, and the whole-state view;
// - useViewOnly (src/hooks/useViewOnly.ts): an LCA Observer gets the
//   disabled fieldset and the note, anyone else the controls as they are.
import { cleanup, render, screen } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import * as membership from '@/areas/membership'
import { usChessState } from '@/areas/membership/usChess'
import * as clubs from '@/areas/clubs'
import { CLUB_MAP_PINS } from '@/areas/clubs/clubMapData'
import { LCA } from '@/lib/brand'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))

afterEach(cleanup)

describe('usChessState, from the membership area', () => {
  const zone = process.env.TZ
  beforeAll(() => {
    process.env.TZ = 'America/Chicago'
  })
  afterAll(() => {
    if (zone === undefined) delete process.env.TZ
    else process.env.TZ = zone
  })

  /** A local time in America/Chicago. */
  const at = (local: string) => new Date(local)
  const DAY = 86_400_000

  it('is the same function through the area index and its own module', () => {
    expect(membership.usChessState).toBe(usChessState)
  })

  it('runs in America/Chicago: CDT before Sun, Nov 1, 2026 and CST after', () => {
    expect(at('2026-10-31T12:00:00').getTimezoneOffset()).toBe(300)
    expect(at('2026-11-02T12:00:00').getTimezoneOffset()).toBe(360)
  })

  it('says none without an ID and unknown without a date or with one it cannot read', () => {
    expect(usChessState(null, '2027-01-31')).toBe('none')
    expect(usChessState('', '2027-01-31')).toBe('none')
    expect(usChessState('12345678', null)).toBe('unknown')
    expect(usChessState('12345678', '')).toBe('unknown')
    expect(usChessState('12345678', 'not a date')).toBe('unknown')
  })

  it('counts the expiry day to 23:59:59 local time, so the membership is current all that day', () => {
    const exp = '2026-10-31'
    expect(usChessState('12345678', exp, at('2026-10-31T00:00:00'))).toBe('soon')
    expect(usChessState('12345678', exp, at('2026-10-31T23:59:59'))).toBe('soon')
    // Midnight after the expiry day.
    expect(usChessState('12345678', exp, at('2026-11-01T00:00:00'))).toBe('expired')
    // A date with a time part is read by its day.
    expect(usChessState('12345678', '2026-10-31 00:00:00', at('2026-10-31T20:00:00'))).toBe('soon')
  })

  it('is soon inside 45 days of the end of the expiry day, and valid from 45 days out', () => {
    const exp = '2027-03-20'
    const end = at('2027-03-20T23:59:59').getTime()
    expect(usChessState('12345678', exp, new Date(end - 45 * DAY))).toBe('valid')
    expect(usChessState('12345678', exp, new Date(end - 45 * DAY + 1))).toBe('soon')
    expect(usChessState('12345678', exp, new Date(end - DAY))).toBe('soon')
  })

  it('reads the expiry day by the local clock on both 2026 clock changes (Sun, Mar 8 and Sun, Nov 1)', () => {
    // Spring forward: 2:00 AM becomes 3:00 AM on Sunday, March 8, 2026.
    expect(usChessState('12345678', '2026-03-08', at('2026-03-08T23:30:00'))).toBe('soon')
    expect(usChessState('12345678', '2026-03-08', at('2026-03-09T00:00:00'))).toBe('expired')
    // Fall back: 2:00 AM becomes 1:00 AM again on Sunday, November 1, 2026.
    expect(usChessState('12345678', '2026-11-01', at('2026-11-01T01:30:00'))).toBe('soon')
    expect(usChessState('12345678', '2026-11-01', at('2026-11-01T23:59:59'))).toBe('soon')
    expect(usChessState('12345678', '2026-11-01', at('2026-11-02T00:00:00'))).toBe('expired')
  })

  it('is valid for a membership that ends next year, and expired for one that ended last year', () => {
    const now = at('2026-10-19T12:00:00')
    expect(usChessState('12345678', '2027-10-31', now)).toBe('valid')
    expect(usChessState('12345678', '2025-10-31', now)).toBe('expired')
  })
})

describe('the club map helpers, from the clubs area', () => {
  const first = CLUB_MAP_PINS[0]

  it('are reached through the area index', () => {
    for (const name of ['MAP_STYLES', 'LOUISIANA_CENTER', 'LOUISIANA_BOUNDS', 'fitLouisiana', 'directionsUrl', 'clubLocation', 'findPinByName', 'loadMapsScript']) {
      expect(clubs, name).toHaveProperty(name)
    }
  })

  it('builds the directions link from a spot', () => {
    expect(clubs.directionsUrl({ lat: 30.45, lng: -91.15 })).toBe('https://www.google.com/maps/dir/?api=1&destination=30.45,-91.15')
  })

  it('finds a pin by its name, whatever the case and punctuation, then by part of it', () => {
    expect(clubs.findPinByName(first.name)).toBe(first)
    expect(clubs.findPinByName(first.name.toUpperCase().replace(/ /g, '  '))).toBe(first)
    const word = first.name.split(' ')[0]
    expect(clubs.findPinByName(word)?.name.toLowerCase()).toContain(word.toLowerCase())
    expect(clubs.findPinByName('')).toBeUndefined()
    expect(clubs.findPinByName('  !! ')).toBeUndefined()
    expect(clubs.findPinByName('Fixture Club That Does Not Exist Anywhere')).toBeUndefined()
  })

  it('puts a club at its own location when it has one, with the original list\'s note, or else at its pin', () => {
    expect(clubs.clubLocation({ name: first.name, latitude: 30.1, longitude: -91.2 })).toEqual({ lat: 30.1, lng: -91.2, description: first.description })
    expect(clubs.clubLocation({ name: first.name, latitude: null, longitude: null })).toEqual(first)
    expect(clubs.clubLocation({ name: 'Fixture Club That Does Not Exist Anywhere', latitude: 30.1, longitude: -91.2 })).toEqual({ lat: 30.1, lng: -91.2, description: undefined })
    expect(clubs.clubLocation({ name: 'Fixture Club That Does Not Exist Anywhere' })).toBeUndefined()
    // A latitude of 0 is still a number: a set location is never second-guessed.
    expect(clubs.clubLocation({ name: 'Fixture Club That Does Not Exist Anywhere', latitude: 0, longitude: 0 })).toEqual({ lat: 0, lng: 0, description: undefined })
  })

  it('frames Louisiana and draws the state outline in the brand navy', () => {
    const b = clubs.LOUISIANA_BOUNDS
    expect(b.south).toBeLessThan(b.north)
    expect(b.west).toBeLessThan(b.east)
    expect(clubs.LOUISIANA_CENTER.lat).toBeGreaterThan(b.south)
    expect(clubs.LOUISIANA_CENTER.lat).toBeLessThan(b.north)
    const outline = clubs.MAP_STYLES.find((s) => s.featureType === 'administrative.province' && s.elementType === 'geometry.stroke')
    expect(outline?.stylers).toContainEqual({ color: LCA.navy })
  })
})

describe('useViewOnly, from its own module', () => {
  const as = (role: string) => ({ user: { id: 'fx-m-p1' }, member: { id: 'fx-m-p1', role }, session: null, role, loading: false }) as unknown as AuthContextValue

  it('disables the controls and shows the note for an LCA Observer, and leaves them for an admin', async () => {
    const { ViewOnlyFieldset, ViewOnlyNote } = await import('@/lib/viewOnly')
    const screenFor = (role: string) =>
      render(
        <AuthContext.Provider value={as(role)}>
          <ViewOnlyNote />
          <ViewOnlyFieldset>
            <button type="button">Save</button>
          </ViewOnlyFieldset>
        </AuthContext.Provider>,
      )
    screenFor('lca_observer')
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).matches(':disabled')).toBe(true)
    expect(screen.getByText(/View only: you can see everything here/)).toBeTruthy()
    cleanup()
    screenFor('admin')
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).matches(':disabled')).toBe(false)
    expect(screen.queryByText(/View only/)).toBeNull()
  })

  it('is the hook the view-only fieldset uses', async () => {
    const { useViewOnly } = await import('@/hooks/useViewOnly')
    function Probe() {
      return <p>{useViewOnly() ? 'observer' : 'editor'}</p>
    }
    render(<AuthContext.Provider value={as('lca_observer')}><Probe /></AuthContext.Provider>)
    expect(screen.getByText('observer')).toBeTruthy()
  })
})
