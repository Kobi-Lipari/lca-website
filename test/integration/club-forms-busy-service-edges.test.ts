// test/integration/club-forms-busy-service-edges.test.ts
//
// The one fix of WS09 checkpoint X's review that depends on the mail engine's
// rules (F3): a copy to a club's address or to a keeper's is sorted by the
// seam's own answer (sendEmailOutcome). What holds under both states of
// MAIL_LISTS_ON is that a 429 and a 503 are the service not taking the
// message for now, which says nothing of the address, so the walk stops
// there: the contact relay tells the visitor it was not sent, the new-club
// request writes to no further tier, and nothing is sent twice. Each case
// stands in the mail switches itself, so none reads a shipped value of any
// switch, and runs the loop twice, once with the rules off and once on.
// Every club, person and address is made up.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CONTACT_NOT_SENT } from '../../domain/clubs/contactMessage'
import { REGIONS } from '../../domain/clubs/regions'
import { onRequestPost as contactPost } from '../../functions/api/clubs/[id]/contact'
import { onRequestPost as requestPost } from '../../functions/api/clubs/reports'
import { ADDRESS_HEADER } from '../../functions/utils/rateLimit'
import { seedMember } from './factories'
import { emailBehavior, emailOutbox, invoke, resetHarness } from './harness'

const flags = vi.hoisted(() => ({ listsOn: false }))
vi.mock('../../functions/utils/clubs/pages', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/clubs/pages')>()
  return {
    ...real,
    get CLUB_PAGES_ON() {
      return true
    },
    get CLUB_KEEPERS_ON() {
      return true
    },
  }
})
vi.mock('../../functions/utils/mail/switches', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/mail/switches')>()
  return {
    ...real,
    get MAIL_LISTS_ON() {
      return flags.listsOn
    },
    get MAIL_SENDER() {
      return 'resend' as const
    },
  }
})

const KEYED = {
  SIGNING_SECRET: 'example-made-up-signing-key-for-the-busy-service-0099',
  TURNSTILE_SECRET_KEY: 'example-made-up-spam-check-secret-0099',
}
const LAKE_CHARLES = REGIONS[3]

let seq = 0
const mark = () => `${++seq}${crypto.randomUUID().slice(0, 6)}`
/** A made-up place of its own for each call, from 198.51.100.0/24 and 203.0.113.0/24. */
const place = () => (++seq % 2 === 0 ? `198.51.100.${seq % 250}` : `203.0.113.${seq % 250}`)

beforeEach(async () => {
  resetHarness()
  flags.listsOn = false
  // The middle of the run's own hour, held still, so every call of a case lands in one hour.
  const middle = new Date()
  middle.setUTCMinutes(30, 0, 0)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(middle)
  await env.DB.prepare(`UPDATE board_seat_assignments SET ended_at = datetime('now') WHERE ended_at IS NULL`).run()
  await env.DB.prepare(`UPDATE club_reports SET status = 'answered' WHERE club_id IS NULL AND status = 'open'`).run()
  await env.DB.prepare('DELETE FROM rate_limits').run()
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

interface Person { id: string; name: string; email: string }

/** A made-up member, an LCA admin when asked. */
async function person(role?: 'lca_admin'): Promise<Person> {
  const m = mark()
  const made = { id: '', name: `Example Person ${m}`, email: `person-${m}@example.org` }
  made.id = await seedMember({ fullName: made.name, email: made.email, role })
  return made
}

/** The case's own LCA admin, and the only one on file. */
async function onlyAdmin(): Promise<Person> {
  await env.DB.prepare(`UPDATE members SET role = 'member' WHERE role = 'lca_admin'`).run()
  return person('lca_admin')
}

/** A seat over the region, held now by a new member. */
async function representative(region: string): Promise<Person> {
  const made = await person()
  const seat = `seat-${mark()}`
  await env.DB.prepare(
    `INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active) VALUES (?, 'Example Region Representative', '', 99, ?, 'regional_rep', 1)`,
  ).bind(seat, seat).run()
  await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(seat, region).run()
  await env.DB.prepare('INSERT INTO board_seat_assignments (seat_id, member_id) VALUES (?, ?)').bind(seat, made.id).run()
  return made
}

/** A club with a slug, a region and an address of its own. */
async function club(region: string): Promise<{ slug: string; email: string }> {
  const m = mark()
  const email = `club-${m}@example.org`
  const slug = `example-chess-club-${m}`
  await env.DB.prepare(
    `INSERT INTO clubs (id, name, city, slug, region, contact_email, contact_name_public, about_text, how_we_meet_text) VALUES (?, ?, 'Example City', ?, ?, ?, 'Contact P.', 'A made up club.', 'Tuesdays at 7:00 PM')`,
  ).bind(`club-${m}`, `Example Chess Club ${m}`, slug, region, email).run()
  return { slug, email }
}

const busyWays = [429, 503] as const

describe('a busy service is no verdict on an address, with the engine\'s rules off and on', () => {
  it('the contact relay stops at the club\'s address: the visitor is told it was not sent, no representative or admin is written to, and nothing goes twice', async () => {
    for (const listsOn of [false, true]) {
      for (const status of busyWays) {
        const way = `rules ${listsOn ? 'on' : 'off'}, ${status}`
        flags.listsOn = listsOn
        emailOutbox.length = 0
        const region = `Example Region ${mark()}`
        const holder = await representative(region)
        const admin = await onlyAdmin()
        const target = await club(region)
        emailBehavior.succeed = false
        emailBehavior.status = status
        emailBehavior.failFor = [target.email]
        const visitor = mark()
        const result = await invoke(contactPost, {
          method: 'POST',
          params: { id: target.slug },
          body: { name: `Player One ${visitor}`, email: `player-${visitor}@example.org`, message: 'When do you meet?', token: 'example-made-up-token' },
          env: KEYED,
          path: `/api/clubs/${target.slug}/contact`,
          headers: { [ADDRESS_HEADER]: place() },
        })
        expect(result.status, way).toBe(503)
        expect(await result.json(), way).toEqual({ error: CONTACT_NOT_SENT })
        expect(emailOutbox.filter((m) => m.to === holder.email || m.to === admin.email), way).toEqual([])
        expect(emailOutbox, way).toEqual([])
        emailBehavior.succeed = true
        emailBehavior.failFor = null
      }
    }
  }, 60_000)

  it('a new-club request stops at the region\'s representative: no admin is written to, the row waits in My region, and the person is told it was sent', async () => {
    for (const listsOn of [false, true]) {
      for (const status of busyWays) {
        const way = `rules ${listsOn ? 'on' : 'off'}, ${status}`
        flags.listsOn = listsOn
        emailOutbox.length = 0
        const admin = await onlyAdmin()
        const holder = await representative(LAKE_CHARLES)
        emailBehavior.succeed = false
        emailBehavior.status = status
        emailBehavior.failFor = [holder.email]
        const m = mark()
        const result = await invoke(requestPost, {
          method: 'POST',
          body: {
            kind: 'new_club', clubName: `Example Knights Club ${m}`, place: 'Sulphur', message: 'Tuesdays at 7:00 PM at the Example Library.',
            name: `Player One ${m}`, email: `player-${m}@example.org`, token: 'example-made-up-token',
          },
          env: KEYED,
          path: '/api/clubs/reports',
          headers: { [ADDRESS_HEADER]: place() },
        })
        expect(result.status, way).toBe(200)
        expect(await result.json(), way).toEqual({ sent: true })
        expect(emailOutbox.filter((e) => e.to === admin.email), way).toEqual([])
        expect(emailOutbox, way).toEqual([])
        const row = await env.DB.prepare('SELECT region, status FROM club_reports WHERE club_id IS NULL ORDER BY id DESC LIMIT 1').first<{ region: string; status: string }>()
        expect(row, way).toEqual({ region: LAKE_CHARLES, status: 'open' })
        await env.DB.prepare(`UPDATE board_seat_assignments SET ended_at = datetime('now') WHERE ended_at IS NULL`).run()
        await env.DB.prepare(`UPDATE club_reports SET status = 'answered' WHERE club_id IS NULL AND status = 'open'`).run()
        emailBehavior.succeed = true
        emailBehavior.failFor = null
      }
    }
  }, 60_000)
})
