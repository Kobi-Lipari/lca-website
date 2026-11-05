// test/unit/roles-label.test.ts
//
// The standing director's label and its one line (D20, Q4). ROLE_LABELS
// names tournament_director "Tournament Director" while standingDirectors is
// off and "Standing director" while it is on, read each time the label is
// read, so every page that draws it (the Members table, the Workspace badge,
// the Dashboard's tools heading and the activity log) follows the switch;
// every other label stays as it was. STANDING_DIRECTOR_LINE says what the
// role allows and names the Members page, where an LCA admin grants it.
import { afterEach, describe, expect, it, vi } from 'vitest'

const flags = vi.hoisted(() => ({ standingDirectors: false }))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return {
    ...real,
    FEATURES: new Proxy(real.FEATURES, {
      get: (target, key) => (key === 'standingDirectors' ? flags.standingDirectors : Reflect.get(target, key)),
    }),
  }
})

const { MEMBER_ROLES, ROLE_LABELS, STANDING_DIRECTOR_LINE } = await import('@/areas/admin/roles')
const { FEATURES: REAL_FEATURES } = await vi.importActual<typeof import('@/lib/features')>('@/lib/features')

afterEach(() => {
  flags.standingDirectors = false
})

/** Every label as the site draws it today. */
const TODAY = {
  member: 'Member',
  lca_auditor: 'LCA Auditor',
  lca_officer: 'LCA Officer',
  lca_observer: 'LCA Observer',
  club_rep: 'Club Representative',
  tournament_director: 'Tournament Director',
  lca_admin: 'LCA Admin',
}
const labels = () => Object.fromEntries(MEMBER_ROLES.map((role) => [role, ROLE_LABELS[role]]))

describe('the label of the tournament_director role', () => {
  it('ships behind standingDirectors, which starts off', () => {
    expect(REAL_FEATURES.standingDirectors).toBe(false)
  })

  it('is "Tournament Director" with the switch off, every label as today', () => {
    expect(ROLE_LABELS.tournament_director).toBe('Tournament Director')
    expect(labels()).toEqual(TODAY)
  })

  it('is "Standing director" with the switch on, every other label as it was', () => {
    flags.standingDirectors = true
    expect(ROLE_LABELS.tournament_director).toBe('Standing director')
    expect(labels()).toEqual({ ...TODAY, tournament_director: 'Standing director' })
  })

  it('reads the switch each time the label is read, so a page that draws it again follows the switch', () => {
    expect(ROLE_LABELS.tournament_director).toBe('Tournament Director')
    flags.standingDirectors = true
    expect(ROLE_LABELS['tournament_director' as keyof typeof ROLE_LABELS]).toBe('Standing director')
    flags.standingDirectors = false
    expect(ROLE_LABELS.tournament_director).toBe('Tournament Director')
  })

  it('stays one key of the record among the others, in the order the roles are offered', () => {
    expect(Object.keys(ROLE_LABELS)).toEqual(MEMBER_ROLES)
    expect(Object.keys(ROLE_LABELS)).toEqual(Object.keys(TODAY))
  })
})

describe('the one line on what the role allows', () => {
  it('says a standing director creates and runs their own LCA-run tournaments, and names the Members page, where an LCA admin grants the role', () => {
    expect(STANDING_DIRECTOR_LINE).toBe(
      'A standing director creates and runs their own LCA-run tournaments here. An LCA admin grants the role on the Members page.',
    )
    expect(STANDING_DIRECTOR_LINE).toContain('the Members page')
    expect(STANDING_DIRECTOR_LINE).toContain('LCA-run')
  })

  it('is the same with the switch on and off, since only its place on the page follows the switch', () => {
    const off = STANDING_DIRECTOR_LINE
    flags.standingDirectors = true
    expect(STANDING_DIRECTOR_LINE).toBe(off)
  })

  it('is plain words: two sentences, no dash and no old initials for US Chess', () => {
    expect(STANDING_DIRECTOR_LINE.split('. ')).toHaveLength(2)
    expect(STANDING_DIRECTOR_LINE.endsWith('.')).toBe(true)
    expect(STANDING_DIRECTOR_LINE).not.toMatch(new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`))
    expect(STANDING_DIRECTOR_LINE).not.toMatch(new RegExp(`\\b${'US' + 'CF'}\\b`))
  })
})
