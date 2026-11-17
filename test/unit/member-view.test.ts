// test/unit/member-view.test.ts
// functions/utils/clubs/memberView.ts: who counts as admitted by a regional
// seat alone, and what the officers rows lose.
import { describe, expect, it } from 'vitest'
import { admittedByRegionAlone, officersWithoutEmail, ROSTER_KEPT_BACK } from '../../functions/utils/clubs/memberView'

describe('admittedByRegionAlone', () => {
  // Each case is its own plain line, so that the step's record test can count them.
  const on = (role: string, club_id: string | null) => admittedByRegionAlone({ role, club_id }, 'example-club')

  it('an LCA admin', () => { expect(on('lca_admin', null)).toBe(false) })
  it('an LCA admin with another club', () => { expect(on('lca_admin', 'example-other-club')).toBe(false) })
  it('an observer', () => { expect(on('lca_observer', null)).toBe(false) })
  it('an LCA officer', () => { expect(on('lca_officer', null)).toBe(false) })
  it('the club\'s own rep', () => { expect(on('club_rep', 'example-club')).toBe(false) })
  it('another club\'s rep', () => { expect(on('club_rep', 'example-other-club')).toBe(true) })
  it('a rep with no club', () => { expect(on('club_rep', null)).toBe(true) })
  it('a member of the club', () => { expect(on('member', 'example-club')).toBe(true) })
  it('a member with no club', () => { expect(on('member', null)).toBe(true) })
  it('a tournament director', () => { expect(on('tournament_director', null)).toBe(true) })
})

describe('officersWithoutEmail', () => {
  it('drops email, keeps every other key in its order, and leaves the input alone', () => {
    const rows = [{ id: 'o1', member_id: 'm1', role: 'President', full_name: 'Player One', email: 'player.one@example.org' }]
    const out = officersWithoutEmail(rows)
    expect(Object.keys(out[0])).toEqual(['id', 'member_id', 'role', 'full_name'])
    expect(rows[0].email).toBe('player.one@example.org')
    expect(officersWithoutEmail([])).toEqual([])
  })
})

describe('ROSTER_KEPT_BACK', () => {
  it('is plain words, with no long dash', () => {
    expect(ROSTER_KEPT_BACK).toMatch(/^A club's roster is kept for LCA admins and the club's own rep\.$/)
    expect(ROSTER_KEPT_BACK).not.toMatch(new RegExp('[\\u2013\\u2014]'))
  })
})
