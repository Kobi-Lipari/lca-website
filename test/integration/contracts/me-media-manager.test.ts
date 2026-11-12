// test/integration/contracts/me-media-manager.test.ts
//
// GET /api/me/media-manager (WS16 step 6) to its contract,
// mediaManagerResponseSchema in domain/contracts/me.ts, on the database every
// integration test runs on: what the signed-in person is, about themselves
// alone. With MAIL_LISTS_ON set, the holder of the Media manager seat whose
// role Admin does not let in reads true, with or without a second factor,
// which secondFactor says, and since checkpoint M's review so does an LCA
// officer who holds it; an LCA admin and the president who hold the seat,
// and anyone with no seat, read false. With it unset everyone
// reads false and no seat is read. Signed out, 401 in the shared error body.
// Every answer carries no-store, and nothing is written. MAIL_LISTS_ON is
// read through a getter on the mocked switches module, set before every
// case, with the module's other constants set beside it. Every name here is
// made up.
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { contracts, errorBodySchema } from '../../../domain/contracts'
import { onRequestGet as mediaManagerGet, onRequestOptions as mediaManagerOptions } from '../../../functions/api/me/media-manager'
import { MEDIA_MANAGER_SEAT } from '../../../functions/utils/admin/mediaManager'
import { seedAdmin, seedMember, seedSeat } from '../factories'
import { expectContract, fetchCount, invoke, resetHarness } from '../harness'
import { countingDb } from '../mailRuns'

const flags = vi.hoisted(() => ({ listsOn: true, sender: 'resend', plan: 'free', complaintStops: true }))
vi.mock('../../../functions/utils/mail/switches', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../functions/utils/mail/switches')>()
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

const answer = contracts['me/media-manager'].GET
const PATH = '/api/me/media-manager'
const ask = (as: string | undefined, opts: { aal?: 'aal1' | 'aal2'; path?: string } = {}) =>
  invoke(mediaManagerGet, { method: 'GET', as, aal: opts.aal, path: opts.path ?? PATH })

/** How many rows the tables a caller could change hold, to show a call wrote nothing. */
async function rows() {
  const count = async (table: string) => (await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>())!.n
  return { members: await count('members'), seats: await count('board_members'), terms: await count('board_seat_assignments'), audit: await count('admin_audit_log') }
}

beforeEach(async () => {
  resetHarness()
  flags.listsOn = true
  flags.sender = 'resend'
  flags.plan = 'free'
  flags.complaintStops = true
  // The seats a case made, with their terms, which cascade.
  await env.DB.prepare(`DELETE FROM board_members WHERE id LIKE 'seat-%'`).run()
})

describe('GET /api/me/media-manager, to its contract', () => {
  it('answers the media manager true, with secondFactor as the session carries it, with the constant set', async () => {
    const holder = await seedMember({ fullName: 'Player One' })
    await seedSeat({ slug: MEDIA_MANAGER_SEAT, role: 'Media manager' }, [holder])
    const before = await rows()

    const withFactor = await ask(holder)
    expect(withFactor.status).toBe(200)
    expect(await expectContract(withFactor, answer.response)).toEqual({ mediaManager: true, secondFactor: true })
    const without = await ask(holder, { aal: 'aal1' })
    expect(without.status).toBe(200)
    expect(await expectContract(without, answer.response)).toEqual({ mediaManager: true, secondFactor: false })
    expect(await rows()).toEqual(before)
  })

  it('answers everyone else false with the constant set: no seat, another seat, and an LCA admin and the president who hold the seat', async () => {
    const plain = await seedMember({ fullName: 'Player Two' })
    const otherSeat = await seedMember({ fullName: 'Player Three' })
    await seedSeat({ slug: 'sample-seat-one', role: 'Sample seat one' }, [otherSeat])
    const admin = await seedAdmin()
    const officerElsewhere = await seedMember({ role: 'lca_officer', fullName: 'Player Four' })
    await seedSeat({ slug: 'sample-seat-two', role: 'Sample seat two' }, [officerElsewhere])
    const president = await seedMember({ role: 'lca_observer', fullName: 'Player Five' })
    await seedSeat({ slug: MEDIA_MANAGER_SEAT, role: 'Media manager' }, [admin, president])
    for (const who of [plain, otherSeat, admin, officerElsewhere, president]) {
      const res = await ask(who)
      expect(res.status, who).toBe(200)
      expect(await expectContract(res, answer.response), who).toEqual({ mediaManager: false, secondFactor: true })
    }
  })

  it('answers an LCA officer who holds the seat true, by the guard\'s own rule, and false once the constant is unset (checkpoint M\'s review)', async () => {
    const officer = await seedMember({ role: 'lca_officer', fullName: 'Player Four' })
    await seedSeat({ slug: MEDIA_MANAGER_SEAT, role: 'Media manager' }, [officer])
    const before = await rows()
    for (const aal of ['aal2', 'aal1'] as const) {
      const res = await ask(officer, { aal })
      expect(res.status, aal).toBe(200)
      expect(await expectContract(res, answer.response), aal).toEqual({ mediaManager: true, secondFactor: aal === 'aal2' })
    }
    flags.listsOn = false
    expect(await expectContract(await ask(officer), answer.response)).toEqual({ mediaManager: false, secondFactor: true })
    expect(await rows()).toEqual(before)
  })

  it('answers everyone false while the constant is unset, the seat holder among them, and reads no seat', async () => {
    flags.listsOn = false
    const holder = await seedMember({ fullName: 'Player One' })
    await seedSeat({ slug: MEDIA_MANAGER_SEAT, role: 'Media manager' }, [holder])
    const counting = countingDb()
    for (const aal of ['aal2', 'aal1'] as const) {
      const res = await invoke(mediaManagerGet, { method: 'GET', as: holder, aal, path: PATH, env: { DB: counting.db } })
      expect(res.status).toBe(200)
      expect(await expectContract(res, answer.response)).toEqual({ mediaManager: false, secondFactor: aal === 'aal2' })
    }
    expect(counting.ran.filter((r) => r.sql.includes('board_seat_assignments'))).toEqual([])
  })

  it('tells the person signed in about themselves alone, whatever the address names', async () => {
    const holder = await seedMember({ fullName: 'Player One' })
    const asker = await seedMember({ fullName: 'Player Two' })
    await seedSeat({ slug: MEDIA_MANAGER_SEAT, role: 'Media manager' }, [holder])
    for (const path of [PATH, `${PATH}?member=${holder}`, `${PATH}?id=${holder}&memberId=${holder}`]) {
      const res = await ask(asker, { path })
      expect(await expectContract(res, answer.response), path).toEqual({ mediaManager: false, secondFactor: true })
    }
    expect(await expectContract(await ask(holder, { path: `${PATH}?member=${asker}` }), answer.response)).toEqual({ mediaManager: true, secondFactor: true })
  })

  it('reads the seat at each request: true while the term runs, false the moment it ends', async () => {
    const holder = await seedMember({ fullName: 'Player One' })
    const seat = await seedSeat({ slug: MEDIA_MANAGER_SEAT, role: 'Media manager' }, [holder])
    expect((await expectContract(await ask(holder), answer.response)).mediaManager).toBe(true)
    await env.DB.prepare(`UPDATE board_seat_assignments SET ended_at = datetime('now') WHERE seat_id = ? AND member_id = ?`).bind(seat, holder).run()
    expect(await expectContract(await ask(holder), answer.response)).toEqual({ mediaManager: false, secondFactor: true })
  })

  it('answers a signed-out caller 401 in the shared error body, verifying nothing more, and every answer carries no-store', async () => {
    const signedOut = await ask(undefined)
    expect(signedOut.status).toBe(401)
    expect(await expectContract(signedOut, errorBodySchema)).toEqual({ error: 'Unauthorized' })
    expect(signedOut.response.headers.get('Cache-Control')).toBe('no-store')
    expect(fetchCount).toBe(0)

    const holder = await seedMember({ fullName: 'Player One' })
    const ok = await ask(holder)
    expect(ok.response.headers.get('Cache-Control')).toBe('no-store')
    expect(ok.response.headers.get('Content-Type')).toBe('application/json')

    const options = await mediaManagerOptions({ request: new Request(`https://lca-website.pages.dev${PATH}`, { method: 'OPTIONS' }) } as never)
    expect(options.status).toBe(204)
    expect(options.headers.get('Cache-Control')).toBe('no-store')
  })
})
