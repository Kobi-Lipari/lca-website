// test/integration/club-confirm-link.test.ts
//
// The Still accurate link of the monthly check (WS09 step 14), GET and POST
// /api/clubs/confirm/:token, through the real handler on D1 built from the
// migrations, read as someone who wants in would read it: what a GET
// changes (nothing), what a POST stamps (one club), the link's 30 days, a
// forged, cut, changed or borrowed link, a missing key, and a seat, a
// member or a club gone since the email. CLUB_KEEPERS_ON is set through a
// getter on the mocked module; the keys are made up and written here, and
// every club and person is made up.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CLUB_GONE, LINK_CLOSED, LINK_EXPIRED, LINK_FORGED, LINK_NO_KEY, MEMBER_GONE, SEAT_ENDED,
  onRequestGet as linkGet, onRequestOptions as linkOptions, onRequestPost as linkPost,
} from '../../functions/api/clubs/confirm/[token]'
import { CONFIRM_PURPOSE, LINK_TTL_SECONDS } from '../../functions/utils/clubs/monthlyCheck'
import { signToken } from '../../functions/utils/tokens'
import { seedAdmin, seedClub, seedMember } from './factories'
import { emailOutbox, invoke, resetHarness } from './harness'
import { countingDb } from './mailRuns'

const flags = vi.hoisted(() => ({ keepersOn: true }))
vi.mock('../../functions/utils/clubs/pages', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/clubs/pages')>()
  return {
    ...real,
    get CLUB_KEEPERS_ON() {
      return flags.keepersOn
    },
  }
})

/** Two made-up keys: the one links are signed with now, and the one before it. */
const KEY = 'example-made-up-signing-key-for-the-link-0001'
const OLD_KEY = 'example-made-up-earlier-signing-key-0000'
const KEYED = { SIGNING_SECRET: KEY }

let seq = 0
const next = () => `${++seq}-${crypto.randomUUID().slice(0, 6)}`

/** A club in a region of its own, held by a seat whose one holder is returned, with a good link for them. */
async function linked(opts: { key?: string; at?: Date } = {}) {
  const region = `Example Region ${next()}`
  const clubId = await seedClub({ name: 'Example Chess Club', city: 'Example City' })
  await env.DB.prepare('UPDATE clubs SET region = ? WHERE id = ?').bind(region, clubId).run()
  const memberId = await seedMember({ fullName: 'Player One', email: `player-${next()}@example.org` })
  const seat = `seat-${next()}`
  await env.DB.prepare(
    `INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active) VALUES (?, 'Example Region Representative', '', 99, ?, 'regional_rep', 1)`,
  ).bind(seat, seat).run()
  await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(seat, region).run()
  await env.DB.prepare('INSERT INTO board_seat_assignments (seat_id, member_id) VALUES (?, ?)').bind(seat, memberId).run()
  const token = await signToken(opts.key ?? KEY, CONFIRM_PURPOSE, { club: clubId, member: memberId }, LINK_TTL_SECONDS, opts.at ?? new Date())
  return { clubId, memberId, seat, region, token }
}

const call = (handler: typeof linkGet, token: string, over: Record<string, unknown> = KEYED, extra: { as?: string } = {}) =>
  invoke(handler, { method: handler === linkPost ? 'POST' : 'GET', params: { token }, body: handler === linkPost ? {} : undefined, env: over, path: `/api/clubs/confirm/${token}`, ...extra })

const clubRow = (id: string) => env.DB.prepare('SELECT * FROM clubs WHERE id = ?').bind(id).first()
const rowCounts = async () => {
  const counts: Record<string, number> = {}
  for (const table of ['admin_audit_log', 'automation_runs', 'club_check_marks', 'club_reports', 'club_rep_requests']) {
    counts[table] = (await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>())!.n
  }
  return counts
}

beforeEach(() => {
  resetHarness()
  flags.keepersOn = true
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('GET /api/clubs/confirm/:token', () => {
  it('GET changes nothing', async () => {
    const { clubId, token } = await linked()
    const before = await clubRow(clubId)
    const rows = await rowCounts()
    for (let i = 0; i < 3; i++) {
      const result = await call(linkGet, token)
      expect(result.status).toBe(200)
      // Changed at checkpoint V: the answer names the club's meeting words too, null for a listing with none.
      expect(await result.json()).toEqual({ name: 'Example Chess Club', city: 'Example City', statement: null })
    }
    expect(await clubRow(clubId)).toEqual(before)
    expect(await rowCounts()).toEqual(rows)
    expect(emailOutbox).toHaveLength(0)
  })

  it('every answer is kept by no cache, sends no referrer and asks not to be indexed', async () => {
    const { token } = await linked()
    for (const result of [await call(linkGet, token), await call(linkGet, 'not-a-token'), await call(linkPost, 'not-a-token'), await invoke(linkOptions, { method: 'OPTIONS' })]) {
      expect(result.response.headers.get('Cache-Control')).toBe('no-store')
      expect(result.response.headers.get('Referrer-Policy')).toBe('no-referrer')
      expect(result.response.headers.get('X-Robots-Tag')).toBe('noindex')
    }
  })
})

describe('the meeting words in the GET (WS09 checkpoint V)', () => {
  const setStatement = (clubId: string, words: string | null) =>
    env.DB.prepare('UPDATE clubs SET how_we_meet_text = ? WHERE id = ?').bind(words, clubId).run()

  it('a good link\'s GET carries the club\'s meeting words, as one line', async () => {
    const { clubId, token } = await linked()
    await setStatement(clubId, '  Saturdays from 10:00 AM\n\tat the Example Library. Bring a board.  ')
    const result = await call(linkGet, token)
    expect(result.status).toBe(200)
    expect(await result.json()).toEqual({ name: 'Example Chess Club', city: 'Example City', statement: 'Saturdays from 10:00 AM at the Example Library. Bring a board.' })
  })

  it('null for a listing with no words, and for one whose words are only white space', async () => {
    for (const words of [null, '', '   \n\t  ']) {
      const { clubId, token } = await linked()
      await setStatement(clubId, words)
      const result = await call(linkGet, token)
      expect(result.status, JSON.stringify(words)).toBe(200)
      expect(await result.json(), JSON.stringify(words)).toEqual({ name: 'Example Chess Club', city: 'Example City', statement: null })
    }
  })

  it('the GET with words still changes nothing: the club\'s row, no row anywhere and no email', async () => {
    const { clubId, token } = await linked()
    await setStatement(clubId, 'Saturdays from 10:00 AM at the Example Library.')
    const before = await clubRow(clubId)
    const rows = await rowCounts()
    expect((await call(linkGet, token)).status).toBe(200)
    expect(await clubRow(clubId)).toEqual(before)
    expect(await rowCounts()).toEqual(rows)
    expect(emailOutbox).toHaveLength(0)
  })

  it('the POST\'s answer is unchanged: the name, the town and the month, and no meeting words', async () => {
    const { clubId, token } = await linked()
    await setStatement(clubId, 'Saturdays from 10:00 AM at the Example Library.')
    const result = await call(linkPost, token)
    expect(result.status).toBe(200)
    expect(Object.keys(await result.json<Record<string, unknown>>())).toEqual(['name', 'city', 'month'])
  })

  it('every refused GET is byte for byte the base\'s answer, and none carries the meeting words', async () => {
    const words = 'Saturdays from 10:00 AM at the Example Library.'
    /** The base's refusals, written out as the base answers them. */
    const BASE = {
      closed: [403, '{"error":"Still accurate cannot be used yet."}'],
      forged: [400, '{"error":"This link can\'t be read. Check that the whole link was copied from the email."}'],
      expired: [410, '{"error":"This link has expired. Log in to mark the club from My region."}'],
      noKey: [503, '{"error":"Links from the monthly check can\'t be read on the site right now. Try again later."}'],
      clubGone: [404, '{"error":"This club is no longer listed on the site."}'],
      memberGone: [404, '{"error":"The account this link was sent to is no longer on the site."}'],
      seatEnded: [403, '{"error":"Your seat no longer covers this club."}'],
    } as const
    const seen: Array<[keyof typeof BASE, number, string]> = []
    const take = async (name: keyof typeof BASE, result: Awaited<ReturnType<typeof call>>) => seen.push([name, result.status, await result.response.text()])

    const good = await linked()
    await setStatement(good.clubId, words)
    const [version, kind, payload] = good.token.split('.')
    await take('forged', await call(linkGet, 'not-a-token'))
    await take('forged', await call(linkGet, good.token.slice(0, -4)))
    await take('forged', await call(linkGet, `${version}.${kind}.${payload}`))
    await take('forged', await call(linkGet, await signToken(KEY, 'waitlist:claim', { club: good.clubId, member: good.memberId }, LINK_TTL_SECONDS)))
    await take('noKey', await call(linkGet, good.token, { SIGNING_SECRET: undefined }))
    const old = await linked({ at: new Date(Date.now() - LINK_TTL_SECONDS * 1000 - 60_000) })
    await setStatement(old.clubId, words)
    await take('expired', await call(linkGet, old.token))
    const clubGone = await linked()
    await env.DB.prepare('DELETE FROM clubs WHERE id = ?').bind(clubGone.clubId).run()
    await take('clubGone', await call(linkGet, clubGone.token))
    const memberGone = await linked()
    await setStatement(memberGone.clubId, words)
    await env.DB.prepare('DELETE FROM members WHERE id = ?').bind(memberGone.memberId).run()
    await take('memberGone', await call(linkGet, memberGone.token))
    const ended = await linked()
    await setStatement(ended.clubId, words)
    await env.DB.prepare("UPDATE board_seat_assignments SET ended_at = datetime('now') WHERE seat_id = ?").bind(ended.seat).run()
    await take('seatEnded', await call(linkGet, ended.token))
    flags.keepersOn = false
    await take('closed', await call(linkGet, good.token))

    expect(new Set(seen.map(([name]) => name))).toEqual(new Set(Object.keys(BASE)))
    for (const [name, status, body] of seen) {
      expect([status, body], name).toEqual(BASE[name])
      expect(body, name).not.toContain('statement')
      expect(body, name).not.toContain('Example Library')
    }
    // The words the handler exports are still the base's.
    expect([LINK_CLOSED, LINK_FORGED, LINK_EXPIRED, LINK_NO_KEY, CLUB_GONE, MEMBER_GONE, SEAT_ENDED].map((w) => JSON.stringify({ error: w })))
      .toEqual([BASE.closed, BASE.forged, BASE.expired, BASE.noKey, BASE.clubGone, BASE.memberGone, BASE.seatEnded].map(([, body]) => body))
  })

  it('with CLUB_KEEPERS_ON unset the GET still refuses before anything is read, words or none', async () => {
    const { clubId, token } = await linked()
    await setStatement(clubId, 'Saturdays from 10:00 AM at the Example Library.')
    flags.keepersOn = false
    const { db, ran } = countingDb()
    const result = await call(linkGet, token, { ...KEYED, DB: db })
    expect(result.status).toBe(403)
    expect(await result.json()).toEqual({ error: LINK_CLOSED })
    expect(ran).toEqual([])
  })

  it('role safety: a signed-in session of any role gets the link\'s own answer, and a forged link the same refusal', async () => {
    const { clubId, token } = await linked()
    await setStatement(clubId, 'Saturdays from 10:00 AM at the Example Library.')
    const admin = await seedAdmin()
    const member = await seedMember({ fullName: 'Player Two' })
    for (const as of [undefined, admin, member]) {
      const good = await call(linkGet, token, KEYED, as ? { as } : {})
      expect(good.status, String(as)).toBe(200)
      expect(await good.json(), String(as)).toEqual({ name: 'Example Chess Club', city: 'Example City', statement: 'Saturdays from 10:00 AM at the Example Library.' })
      const forged = await call(linkGet, 'not-a-token', KEYED, as ? { as } : {})
      expect(forged.status, String(as)).toBe(400)
      expect(await forged.json(), String(as)).toEqual({ error: LINK_FORGED })
    }
  })
})

describe('POST /api/clubs/confirm/:token', () => {
  it('POST stamps that club only', async () => {
    const { clubId, memberId, region, token } = await linked()
    const neighbour = await seedClub({ name: 'Example Knights Club', city: 'Example City' })
    await env.DB.prepare('UPDATE clubs SET region = ? WHERE id = ?').bind(region, neighbour).run()
    const saver = await seedMember({ fullName: 'Player Two' })
    await env.DB.prepare("UPDATE clubs SET told_updated_at = '2026-10-01 12:00:00', told_by = ? WHERE id = ?").bind(saver, clubId).run()
    const neighbourBefore = await clubRow(neighbour)
    const result = await call(linkPost, token)
    expect(result.status).toBe(200)
    const body = await result.json<{ name: string; city: string; month: string }>()
    expect(body.name).toBe('Example Chess Club')
    expect(body.city).toBe('Example City')
    expect(body.month).toMatch(/^(January|February|March|April|May|June|July|August|September|October|November|December) \d{4}$/)
    const after = await env.DB.prepare('SELECT last_confirmed_at, confirmed_by, told_updated_at, told_by FROM clubs WHERE id = ?').bind(clubId)
      .first<{ last_confirmed_at: string | null; confirmed_by: string | null; told_updated_at: string; told_by: string }>()
    expect(after!.last_confirmed_at).not.toBeNull()
    expect(after!.confirmed_by).toBe(memberId)
    expect(after!.told_updated_at).toBe('2026-10-01 12:00:00')
    expect(after!.told_by).toBe(saver)
    expect(await clubRow(neighbour)).toEqual(neighbourBefore)
  })

  it('a second POST is harmless, and a POST writes no activity row and sends no email', async () => {
    const { clubId, memberId, token } = await linked()
    const rows = await rowCounts()
    expect((await call(linkPost, token)).status).toBe(200)
    expect((await call(linkPost, token)).status).toBe(200)
    expect(await rowCounts()).toEqual(rows)
    expect(emailOutbox).toHaveLength(0)
    expect(await env.DB.prepare('SELECT confirmed_by FROM clubs WHERE id = ?').bind(clubId).first('confirmed_by')).toBe(memberId)
  })

  it('a signed-in person\'s session changes nothing: the link\'s own member is the one stamped', async () => {
    const { clubId, memberId, token } = await linked()
    const other = await seedAdmin()
    expect((await call(linkPost, token, KEYED, { as: other })).status).toBe(200)
    expect(await env.DB.prepare('SELECT confirmed_by FROM clubs WHERE id = ?').bind(clubId).first('confirmed_by')).toBe(memberId)
  })

  it('an LCA admin\'s own link works, with no seat', async () => {
    const clubId = await seedClub({ name: 'Example Rooks Club', city: 'Example City' })
    const admin = await seedAdmin()
    const token = await signToken(KEY, CONFIRM_PURPOSE, { club: clubId, member: admin }, LINK_TTL_SECONDS)
    expect((await call(linkGet, token)).status).toBe(200)
    expect((await call(linkPost, token)).status).toBe(200)
    expect(await env.DB.prepare('SELECT confirmed_by FROM clubs WHERE id = ?').bind(clubId).first('confirmed_by')).toBe(admin)
  })
})

describe('the link\'s life, its key and its forgeries', () => {
  it('expired at 30 days', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const start = new Date('2026-12-07T14:00:00.000Z')
    vi.setSystemTime(start)
    const { clubId, token } = await linked({ at: start })
    vi.setSystemTime(new Date(start.getTime() + LINK_TTL_SECONDS * 1000 - 1000))
    expect((await call(linkGet, token)).status).toBe(200)
    vi.setSystemTime(new Date(start.getTime() + LINK_TTL_SECONDS * 1000))
    const before = await clubRow(clubId)
    for (const handler of [linkGet, linkPost]) {
      const result = await call(handler, token)
      expect(result.status).toBe(410)
      expect(await result.json()).toEqual({ error: LINK_EXPIRED })
    }
    expect(await clubRow(clubId)).toEqual(before)
  })

  it('forged', async () => {
    const { clubId, memberId, token } = await linked()
    const [version, kind, payload, mac] = token.split('.')
    const flipped = `${mac[0] === 'A' ? 'B' : 'A'}${mac.slice(1)}`
    const forgeries = [
      'not-a-token',
      token.slice(0, -4),
      `${version}.${kind}.${payload}`,
      `${version}.${kind}.${payload}.${flipped}`,
      await signToken('example-made-up-key-of-someone-else-0009', CONFIRM_PURPOSE, { club: clubId, member: memberId }, LINK_TTL_SECONDS),
      await signToken(KEY, 'waitlist:claim', { club: clubId, member: memberId }, LINK_TTL_SECONDS),
      await signToken(KEY, CONFIRM_PURPOSE, { club: 'example-no-such-club', member: memberId }, LINK_TTL_SECONDS).then((t) => t.slice(0, -2)),
      'x'.repeat(5000),
    ]
    const before = await clubRow(clubId)
    for (const forged of forgeries) {
      for (const handler of [linkGet, linkPost]) {
        const result = await call(handler, forged)
        expect(result.status, forged.slice(0, 40)).toBe(400)
        expect(await result.json(), forged.slice(0, 40)).toEqual({ error: LINK_FORGED })
      }
    }
    expect(await clubRow(clubId)).toEqual(before)
  })

  it('a forged link reads nothing from the database, so no answer tells whether a club exists', async () => {
    const { db, ran } = countingDb()
    const memberId = await seedMember()
    const forged = await signToken('example-made-up-key-of-someone-else-0009', CONFIRM_PURPOSE, { club: 'example-no-such-club', member: memberId }, LINK_TTL_SECONDS)
    const result = await call(linkGet, forged, { ...KEYED, DB: db })
    expect(result.status).toBe(400)
    expect(ran).toEqual([])
  })

  it('a link signed under the earlier key reads, and no key answers its words', async () => {
    const { token } = await linked({ key: OLD_KEY })
    expect((await call(linkGet, token)).status).toBe(400)
    expect((await call(linkGet, token, { SIGNING_SECRET: KEY, SIGNING_SECRET_PREVIOUS: OLD_KEY })).status).toBe(200)
    expect((await call(linkPost, token, { SIGNING_SECRET: KEY, SIGNING_SECRET_PREVIOUS: OLD_KEY })).status).toBe(200)
    for (const over of [{ SIGNING_SECRET: undefined }, { SIGNING_SECRET: 'example-short-key' }]) {
      for (const handler of [linkGet, linkPost]) {
        const result = await call(handler, token, over)
        expect(result.status).toBe(503)
        expect(await result.json()).toEqual({ error: LINK_NO_KEY })
      }
    }
  })

  it('with CLUB_KEEPERS_ON unset both methods refuse with no query made', async () => {
    const { token } = await linked()
    flags.keepersOn = false
    const { db, ran } = countingDb()
    for (const handler of [linkGet, linkPost]) {
      const result = await call(handler, token, { ...KEYED, DB: db })
      expect(result.status).toBe(403)
      expect(await result.json()).toEqual({ error: LINK_CLOSED })
    }
    expect(ran).toEqual([])
  })
})

describe('what has changed since the email, read at the moment of use', () => {
  it('a member whose seat has ended is refused at POST', async () => {
    const { clubId, memberId, seat, token } = await linked()
    expect((await call(linkGet, token)).status).toBe(200)
    await env.DB.prepare("UPDATE board_seat_assignments SET ended_at = datetime('now') WHERE seat_id = ? AND member_id = ?").bind(seat, memberId).run()
    const before = await clubRow(clubId)
    for (const handler of [linkPost, linkGet]) {
      const result = await call(handler, token)
      expect(result.status).toBe(403)
      expect(await result.json()).toEqual({ error: SEAT_ENDED })
    }
    expect(await clubRow(clubId)).toEqual(before)
  })

  it('a seat whose regions no longer cover the club, and a guest\'s, are refused at POST', async () => {
    const moved = await linked()
    await env.DB.prepare("UPDATE clubs SET region = 'Example Region Elsewhere' WHERE id = ?").bind(moved.clubId).run()
    expect((await call(linkPost, moved.token)).status).toBe(403)
    const guest = await linked()
    await env.DB.prepare("UPDATE members SET role = 'guest' WHERE id = ?").bind(guest.memberId).run()
    const result = await call(linkPost, guest.token)
    expect(result.status).toBe(403)
    expect(await result.json()).toEqual({ error: SEAT_ENDED })
  })

  it('a member deleted and a club deleted since the email are each refused in their words', async () => {
    const gone = await linked()
    await env.DB.prepare('DELETE FROM members WHERE id = ?').bind(gone.memberId).run()
    for (const handler of [linkPost, linkGet]) {
      const result = await call(handler, gone.token)
      expect(result.status).toBe(404)
      expect(await result.json()).toEqual({ error: MEMBER_GONE })
    }
    const closed = await linked()
    await env.DB.prepare('DELETE FROM clubs WHERE id = ?').bind(closed.clubId).run()
    for (const handler of [linkPost, linkGet]) {
      const result = await call(handler, closed.token)
      expect(result.status).toBe(404)
      expect(await result.json()).toEqual({ error: CLUB_GONE })
    }
  })
})
