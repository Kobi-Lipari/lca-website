// The LCA membership requirement (decision D12): an LCA-run event always
// requires a current membership; a club-run event follows its own
// requires_lca_membership column; FORCE_LCA_MEMBERSHIP (off today) would turn
// it on everywhere. needsMembershipAtCheckout is the rule the WS06 checkout
// calls; nothing calls it yet.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  FORCE_LCA_MEMBERSHIP,
  LCA_RUN_NEEDS_MEMBERSHIP,
  hasActiveMembershipOn,
  needsMembershipAtCheckout,
  requiresLcaMembership,
} from '../../domain/membership/requirement'

const ROOT = join(__dirname, '../..')

describe('requiresLcaMembership', () => {
  it('is always true for an LCA-run event (no club), whatever the column says', () => {
    expect(requiresLcaMembership({ club_id: null, requires_lca_membership: 1 })).toBe(true)
    expect(requiresLcaMembership({ club_id: null, requires_lca_membership: 0 })).toBe(true)
    expect(requiresLcaMembership({ club_id: null })).toBe(true)
    expect(requiresLcaMembership({ club_id: '', requires_lca_membership: 0 })).toBe(true)
  })

  it('follows the column for a club-run event', () => {
    expect(requiresLcaMembership({ club_id: 'club-1', requires_lca_membership: 0 })).toBe(false)
    expect(requiresLcaMembership({ club_id: 'club-1', requires_lca_membership: 1 })).toBe(true)
    expect(requiresLcaMembership({ club_id: 'club-1', requires_lca_membership: false })).toBe(false)
    expect(requiresLcaMembership({ club_id: 'club-1', requires_lca_membership: true })).toBe(true)
  })

  it('reads a missing or null column as required, the column default', () => {
    expect(requiresLcaMembership({ club_id: 'club-1' })).toBe(true)
    expect(requiresLcaMembership({ club_id: 'club-1', requires_lca_membership: null })).toBe(true)
  })

  it('the site-wide override is off today, and when on it requires a membership on every event', () => {
    expect(FORCE_LCA_MEMBERSHIP).toBe(false)
    expect(requiresLcaMembership({ club_id: 'club-1', requires_lca_membership: 0 }, { forceAll: true })).toBe(true)
    expect(requiresLcaMembership({ club_id: 'club-1', requires_lca_membership: 0 }, { forceAll: false })).toBe(false)
  })
})

describe('hasActiveMembershipOn', () => {
  it('needs an active status', () => {
    for (const status of ['pending', 'expired', 'cancelled', null]) {
      expect(hasActiveMembershipOn({ membership_status: status, membership_expiry: '2099-12-31' }, '2026-10-24'), String(status)).toBe(false)
    }
  })

  it('counts a membership expiring on the day of the event, and not one that ends the day before', () => {
    expect(hasActiveMembershipOn({ membership_status: 'active', membership_expiry: '2026-10-24' }, '2026-10-24')).toBe(true)
    expect(hasActiveMembershipOn({ membership_status: 'active', membership_expiry: '2026-10-23' }, '2026-10-24')).toBe(false)
    expect(hasActiveMembershipOn({ membership_status: 'active', membership_expiry: '2027-01-01' }, '2026-10-24')).toBe(true)
  })

  it('takes an active membership with no expiry on record as current', () => {
    expect(hasActiveMembershipOn({ membership_status: 'active', membership_expiry: null }, '2026-10-24')).toBe(true)
  })

  it('compares the date part only', () => {
    expect(hasActiveMembershipOn({ membership_status: 'active', membership_expiry: '2026-10-24T00:00:00Z' }, '2026-10-24')).toBe(true)
  })
})

describe('needsMembershipAtCheckout', () => {
  const lcaRun = { club_id: null, requires_lca_membership: 1, date: '2026-10-24' }
  const clubOff = { club_id: 'club-1', requires_lca_membership: 0, date: '2026-10-24' }
  const clubOn = { club_id: 'club-1', requires_lca_membership: 1, date: '2026-10-24' }
  const member = { membership_status: 'active', membership_expiry: '2027-06-30' }
  const lapsesBefore = { membership_status: 'active', membership_expiry: '2026-10-01' }
  const nonMember = { membership_status: 'pending', membership_expiry: null }

  it('asks a player without a current membership to add one for an event that requires it', () => {
    expect(needsMembershipAtCheckout(nonMember, lcaRun)).toBe(true)
    expect(needsMembershipAtCheckout(lapsesBefore, lcaRun)).toBe(true)
    expect(needsMembershipAtCheckout(nonMember, clubOn)).toBe(true)
  })

  it('never asks a current member', () => {
    expect(needsMembershipAtCheckout(member, lcaRun)).toBe(false)
    expect(needsMembershipAtCheckout(member, clubOn)).toBe(false)
  })

  it('never asks anyone for a club-run event with the requirement off, unless the override is on', () => {
    expect(needsMembershipAtCheckout(nonMember, clubOff)).toBe(false)
    expect(needsMembershipAtCheckout(lapsesBefore, clubOff)).toBe(false)
    expect(needsMembershipAtCheckout(nonMember, clubOff, { forceAll: true })).toBe(true)
  })
})

describe('the module', () => {
  const source = readFileSync(join(ROOT, 'domain/membership/requirement.ts'), 'utf8')

  it('is pure: no zod, no site, server or database import', () => {
    expect(source).not.toMatch(/from ['"]zod['"]/)
    expect(source).not.toMatch(/^import /m)
  })

  it('says that the override becomes a site setting and that enforcement is the checkout work', () => {
    expect(source).toContain('membership_required_for_all')
    expect(source).toContain('WS06')
  })

  it('refuses in plain words', () => {
    expect(LCA_RUN_NEEDS_MEMBERSHIP).toMatch(/^An LCA membership is always required for an event LCA runs\./)
    expect(LCA_RUN_NEEDS_MEMBERSHIP).not.toMatch(/requires_lca_membership|club_id|USCF/)
  })
})
