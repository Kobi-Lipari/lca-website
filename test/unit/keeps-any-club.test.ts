// keepsAnyClub (src/areas/admin/roles.ts), which Your club's page's route
// asks before it knows which club an address names (WS09 step 9): it admits
// exactly the people canManageClub admits to some club, so the route never
// lets in a person the page's own check would send away for want of any
// club, and never sends away one it would admit.
import { describe, expect, it } from 'vitest'
import { MEMBER_ROLES, canManageClub, keepsAnyClub, type MemberRole } from '@/areas/admin/roles'

describe('keepsAnyClub', () => {
  it('admits an LCA admin, a rep who has a club and a member whose seat covers a club', () => {
    expect(keepsAnyClub('lca_admin', null, [])).toBe(true)
    expect(keepsAnyClub('club_rep', 'example-chess-club', [])).toBe(true)
    expect(keepsAnyClub('member', null, ['example-chess-club'])).toBe(true)
    expect(keepsAnyClub('club_rep', null, ['example-chess-club'])).toBe(true)
  })

  it('refuses a rep with no club and no seat, a member of a club, and every role that keeps none', () => {
    expect(keepsAnyClub('club_rep', null, [])).toBe(false)
    expect(keepsAnyClub('club_rep', undefined, [])).toBe(false)
    expect(keepsAnyClub('club_rep', '', [])).toBe(false)
    for (const role of MEMBER_ROLES.filter((r) => r !== 'lca_admin' && r !== 'club_rep')) {
      expect(keepsAnyClub(role, 'example-chess-club', []), role).toBe(false)
      expect(keepsAnyClub(role, null), role).toBe(false)
    }
  })

  it('answers the same as canManageClub does for some club, for every role, club and seat', () => {
    const clubs = ['example-chess-club', 'other-example-club']
    const homes: Array<string | null | undefined> = [null, undefined, '', ...clubs]
    const seats: string[][] = [[], [clubs[0]], [clubs[1]], clubs]
    for (const role of MEMBER_ROLES as MemberRole[]) {
      for (const home of homes) {
        for (const seat of seats) {
          // An admin is admitted to any club, so the clubs asked here are the clubs that exist.
          const some = clubs.some((club) => canManageClub(role, home, club, seat))
          // A rep whose own club is not one of the two asked still keeps a club; the rule is about having one.
          const keeps = keepsAnyClub(role, home, seat)
          if (some) expect(keeps, `${role} ${String(home)} ${seat.join('+')}`).toBe(true)
          if (!keeps) expect(some, `${role} ${String(home)} ${seat.join('+')}`).toBe(false)
        }
      }
    }
  })
})
