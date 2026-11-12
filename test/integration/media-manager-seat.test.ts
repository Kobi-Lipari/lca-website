// test/integration/media-manager-seat.test.ts
//
// WS16 step 6, the seat read on its own and the answers at its edges, on the
// database every integration test builds from the migrations:
// - holdsMediaManagerSeat (functions/utils/admin/mediaManager.ts) for a member
//   with several terms, a seat with several holders and a seat held by someone
//   else, so the one read matches the member's own current term on the active
//   seat and nothing nearby;
// - the browser's check before a call (OPTIONS) on the newsletter's three
//   addresses and on GET /api/me/media-manager answers 204 with no guard and
//   reads no seat, with the constant set and unset;
// - GET /api/me/media-manager says secondFactor true only for a claim that is
//   exactly 'aal2', as the guard reads it, and the newsletter agrees with it
//   for each claim.
// MAIL_LISTS_ON and the module's other constants are read through getters on
// the mocked functions/utils/mail/switches, set before every case. Every name
// here is made up but the seat's own title, "Media manager".
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { onRequestOptions as mediaManagerOptions, onRequestGet as mediaManagerGet } from '../../functions/api/me/media-manager'
import { onRequestOptions as newsletterOptions, onRequestGet as newsletterGet } from '../../functions/api/admin/mail/newsletter'
import { onRequestOptions as stopOptions } from '../../functions/api/admin/mail/newsletter/stop'
import { onRequestOptions as testOptions } from '../../functions/api/admin/mail/newsletter/test'
import { MEDIA_MANAGER_SEAT, holdsMediaManagerSeat } from '../../functions/utils/admin/mediaManager'
import { seedMember, seedSeat } from './factories'
import { invoke, resetHarness } from './harness'
import { countingDb } from './mailRuns'

const flags = vi.hoisted(() => ({ listsOn: true, sender: 'resend', plan: 'free', complaintStops: true }))
vi.mock('../../functions/utils/mail/switches', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/mail/switches')>()
  return {
    ...real,
    get MAIL_LISTS_ON() {
      return flags.listsOn
    },
    get MAIL_SENDER() {
      return flags.sender
    },
    get WORKERS_PLAN() {
      return flags.plan
    },
    get COMPLAINT_STOPS_OTHER_SENDERS() {
      return flags.complaintStops
    },
  }
})

const ended = (seat: string, member: string) =>
  env.DB.prepare(`UPDATE board_seat_assignments SET ended_at = datetime('now') WHERE seat_id = ? AND member_id = ?`).bind(seat, member).run()

/** A bearer token in the harness's shape with the claims given. */
function tokenWith(claims: Record<string, unknown>): string {
  const part = (value: unknown) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${part({ alg: 'HS256', typ: 'JWT' })}.${part(claims)}.harness-not-a-signature`
}

beforeEach(async () => {
  resetHarness()
  flags.listsOn = true
  flags.sender = 'resend'
  flags.plan = 'free'
  flags.complaintStops = true
  await env.DB.prepare(`DELETE FROM board_members WHERE id LIKE 'seat-%'`).run()
})

describe('holdsMediaManagerSeat', () => {
  it('is true for a current term on the active seat, and false for a member with no term at all', async () => {
    const holder = await seedMember({ fullName: 'Player One' })
    const bystander = await seedMember({ fullName: 'Player Two' })
    await seedSeat({ slug: MEDIA_MANAGER_SEAT, role: 'Media manager' }, [holder])
    expect(await holdsMediaManagerSeat(env.DB, holder)).toBe(true)
    expect(await holdsMediaManagerSeat(env.DB, bystander)).toBe(false)
    expect(await holdsMediaManagerSeat(env.DB, 'no-such-member')).toBe(false)
  })

  it('reads the member\'s own terms: an ended term and a current one on the seat is true, and two holders of one seat are each true until their own term ends', async () => {
    const first = await seedMember({ fullName: 'Player One' })
    const second = await seedMember({ fullName: 'Player Two' })
    const seat = await seedSeat({ slug: MEDIA_MANAGER_SEAT, role: 'Media manager' }, [first, second])
    expect(await holdsMediaManagerSeat(env.DB, first)).toBe(true)
    expect(await holdsMediaManagerSeat(env.DB, second)).toBe(true)
    await ended(seat, first)
    expect(await holdsMediaManagerSeat(env.DB, first)).toBe(false)
    expect(await holdsMediaManagerSeat(env.DB, second)).toBe(true)
    // A new term for the same person on the same seat, after the old one ended, holds again.
    await env.DB.prepare(`INSERT INTO board_seat_assignments (id, seat_id, member_id, started_at) VALUES ('term-sample-again', ?, ?, datetime('now'))`).bind(seat, first).run()
    expect(await holdsMediaManagerSeat(env.DB, first)).toBe(true)
  })

  it('is not moved by a term on another seat: the Media manager seat\'s own holder is true, another seat\'s holder is false, and a person with an ended Media manager term and a current term elsewhere is false', async () => {
    const mine = await seedMember({ fullName: 'Player One' })
    const elsewhere = await seedMember({ fullName: 'Player Two' })
    const both = await seedMember({ fullName: 'Player Three' })
    const seat = await seedSeat({ slug: MEDIA_MANAGER_SEAT, role: 'Media manager' }, [mine, both])
    await seedSeat({ slug: 'sample-seat-one', role: 'Sample seat one' }, [elsewhere, both])
    await ended(seat, both)
    expect(await holdsMediaManagerSeat(env.DB, mine)).toBe(true)
    expect(await holdsMediaManagerSeat(env.DB, elsewhere)).toBe(false)
    expect(await holdsMediaManagerSeat(env.DB, both)).toBe(false)
  })

  it('is false for a current term on a seat marked inactive, and true again when the seat is marked active', async () => {
    const holder = await seedMember({ fullName: 'Player One' })
    const seat = await seedSeat({ slug: MEDIA_MANAGER_SEAT, role: 'Media manager', isActive: false }, [holder])
    expect(await holdsMediaManagerSeat(env.DB, holder)).toBe(false)
    await env.DB.prepare('UPDATE board_members SET is_active = 1 WHERE id = ?').bind(seat).run()
    expect(await holdsMediaManagerSeat(env.DB, holder)).toBe(true)
  })

  it('makes one read of one statement, binding the member and the link name, and writes nothing', async () => {
    const holder = await seedMember({ fullName: 'Player One' })
    await seedSeat({ slug: MEDIA_MANAGER_SEAT, role: 'Media manager' }, [holder])
    const counting = countingDb()
    expect(await holdsMediaManagerSeat(counting.db, holder)).toBe(true)
    expect(counting.ran).toHaveLength(1)
    expect(counting.ran[0].binds).toBe(2)
    expect(counting.ran[0].sql).not.toMatch(/SELECT\s+\*/i)
    expect(counting.ran[0].sql).not.toMatch(/\b(INSERT|UPDATE|DELETE)\b/i)
  })
})

describe('the browser\'s check before a call', () => {
  it('answers 204 with no guard and reads no seat on each address, the constant set and unset', async () => {
    for (const on of [true, false]) {
      flags.listsOn = on
      const counting = countingDb()
      for (const options of [newsletterOptions, stopOptions, testOptions, mediaManagerOptions]) {
        const res = await invoke(options, { method: 'OPTIONS', env: { DB: counting.db } })
        expect(res.status, `constant ${on}`).toBe(204)
        expect(await res.response.text()).toBe('')
      }
      expect(counting.ran).toEqual([])
    }
  })
})

describe('the second factor as the answer and the guard read it', () => {
  it('says secondFactor true only for a claim of exactly aal2, and the newsletter lets the holder in for the same claims', async () => {
    const holder = await seedMember({ fullName: 'Player One' })
    await seedSeat({ slug: MEDIA_MANAGER_SEAT, role: 'Media manager' }, [holder])
    for (const claim of [undefined, 'aal1', 'AAL2', 'aal2 ', 'aal3', true, 2, ['aal2'], null, 'aal2']) {
      const claims: Record<string, unknown> = { sub: holder, role: 'authenticated' }
      if (claim !== undefined) claims.aal = claim
      const headers = { Authorization: `Bearer ${tokenWith(claims)}` }
      const told = await invoke(mediaManagerGet, { headers, path: '/api/me/media-manager' })
      const exact = claim === 'aal2'
      expect(await told.json(), JSON.stringify(claim)).toEqual({ mediaManager: true, secondFactor: exact })
      const read = await invoke(newsletterGet, { headers })
      expect(read.status, JSON.stringify(claim)).toBe(exact ? 200 : 403)
    }
  })
})
