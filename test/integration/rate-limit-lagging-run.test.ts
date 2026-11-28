// test/integration/rate-limit-lagging-run.test.ts
//
// A migration run that lags the site's build (WS09 step 25): the confirm
// endpoints of the monthly check, live wherever CLUB_KEEPERS_ON is on, on a
// database with no rate_limits table. Each call writes one log line, which
// holds no address, and goes on as on the base; nothing is refused for want
// of the table. This file drops the table once, so no other file is touched
// (each file has a database of its own). CLUB_KEEPERS_ON is set by each case
// through a getter on the mocked module; the key is made up and written
// here, every club and person is made up, and the address is from a range
// set aside for documentation.
import { env } from 'cloudflare:test'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { onRequestGet as linkGet, onRequestPost as linkPost } from '../../functions/api/clubs/confirm/[token]'
import { CONFIRM_PURPOSE, LINK_TTL_SECONDS } from '../../functions/utils/clubs/monthlyCheck'
import { ADDRESS_HEADER, RATE_LIMITS_MISSING_LOG } from '../../functions/utils/rateLimit'
import { signToken } from '../../functions/utils/tokens'
import { seedClub, seedMember } from './factories'
import { invoke, resetHarness } from './harness'

const flags = vi.hoisted(() => ({ keepersOn: false }))
vi.mock('../../functions/utils/clubs/pages', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/clubs/pages')>()
  return {
    ...real,
    get CLUB_KEEPERS_ON() {
      return flags.keepersOn
    },
  }
})

const KEY = 'example-made-up-signing-key-for-the-limit-0004'
const ADDRESS = '198.51.100.40'

beforeAll(async () => {
  await env.DB.prepare('DROP TABLE rate_limits').run()
})
beforeEach(() => {
  resetHarness()
  flags.keepersOn = false
})
afterEach(() => {
  flags.keepersOn = false
  vi.restoreAllMocks()
})

async function linked() {
  const region = `Example Region ${crypto.randomUUID().slice(0, 8)}`
  const clubId = await seedClub({ name: 'Example Chess Club', city: 'Example City' })
  await env.DB.prepare('UPDATE clubs SET region = ? WHERE id = ?').bind(region, clubId).run()
  const memberId = await seedMember({ fullName: 'Player One', email: `player-${crypto.randomUUID().slice(0, 8)}@example.org` })
  const seat = `seat-${crypto.randomUUID().slice(0, 8)}`
  await env.DB.prepare(
    `INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active) VALUES (?, 'Example Region Representative', '', 99, ?, 'regional_rep', 1)`,
  ).bind(seat, seat).run()
  await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(seat, region).run()
  await env.DB.prepare('INSERT INTO board_seat_assignments (seat_id, member_id) VALUES (?, ?)').bind(seat, memberId).run()
  return signToken(KEY, CONFIRM_PURPOSE, { club: clubId, member: memberId }, LINK_TTL_SECONDS, new Date())
}

const call = (handler: typeof linkGet, token: string) =>
  invoke(handler, {
    method: handler === linkPost ? 'POST' : 'GET', params: { token }, body: handler === linkPost ? {} : undefined,
    env: { SIGNING_SECRET: KEY }, path: `/api/clubs/confirm/${token}`, headers: { [ADDRESS_HEADER]: ADDRESS },
  })

describe('the confirm endpoints on a database before 0071', () => {
  it('with CLUB_KEEPERS_ON off: the base\'s 403, and no log line, since nothing is read', async () => {
    const token = await linked()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    for (const handler of [linkGet, linkPost]) expect((await call(handler, token)).status).toBe(403)
    expect(warn).not.toHaveBeenCalled()
  })

  it('with it on: each call answers as on the base with one log line naming no address, past the limit\'s 30 as well', async () => {
    flags.keepersOn = true
    const token = await linked()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const got = await call(linkGet, token)
    expect(got.status).toBe(200)
    expect(await got.response.clone().text()).toBe('{"name":"Example Chess Club","city":"Example City","statement":null}')
    expect(warn.mock.calls).toEqual([[RATE_LIMITS_MISSING_LOG]])
    const pressed = await call(linkPost, token)
    expect(pressed.status).toBe(200)
    expect(warn.mock.calls).toEqual([[RATE_LIMITS_MISSING_LOG], [RATE_LIMITS_MISSING_LOG]])
    for (let i = 0; i < 31; i++) expect((await call(linkGet, token)).status).toBe(200)
    expect(RATE_LIMITS_MISSING_LOG).not.toMatch(/\d+\.\d+\.\d+\.\d+|198\.51|player|@/i)
    for (const [line] of warn.mock.calls) expect(String(line)).not.toContain(ADDRESS)
  })
})
