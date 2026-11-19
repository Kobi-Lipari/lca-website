// test/integration/region-events-mail-rules.test.ts
//
// The mail the representatives' club events can cause, under the mail
// engine's rules, which the newsletter list's switch turns on: the approval's
// three emails (to each LCA admin on a submit, to the person who drafted the
// event on Approve and publish and on Ask for changes) and the announce to an
// event's entrants from its Email tab. Each is event mail, so no list choice
// stops it; the rules refuse only an address mail cannot reach and one on the
// do-not-send list. Held here, by what the handlers do and answer:
// - a refused address is not sent to, and the move is made all the same, its
//   answer saying in words that the email did not reach everyone;
// - a submit whose every LCA admin is refused still goes into review, sends
//   nothing, says so, and nothing sends it again;
// - a send the service refuses with a 429 does not end the approval's loop
//   or the announce's: the next address is still tried;
// - with the rules off, as before that switch, the same addresses are sent to.
// The cases set every switch they read themselves, through getters on the
// mocked modules: REGION_EVENTS_ON and CLUB_KEEPERS_ON, MAIL_LISTS_ON and
// MAIL_SENDER 'resend'. None reads a switch as it ships. Every club, person,
// address and event is made up, and mail is read from the test outbox.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EMAIL_WORDS, onRequestPost as approval } from '../../functions/api/admin/tournaments/[id]/approval'
import { onRequestPost as announce } from '../../functions/api/admin/tournaments/[id]/announce'
import { seedClub, seedMember, seedRegistration, seedTournament } from './factories'
import { emailBehavior, emailOutbox, invoke, resetHarness } from './harness'
import { noWaits, throttleMail } from './mailRuns'

const flags = vi.hoisted(() => ({ listsOn: true }))
vi.mock('../../functions/utils/clubs/pages', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/clubs/pages')>()
  return {
    ...real,
    get CLUB_KEEPERS_ON() {
      return true
    },
    get REGION_EVENTS_ON() {
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

let waits: number[] = []
beforeEach(() => {
  resetHarness()
  flags.listsOn = true
  waits = noWaits()
})
afterEach(() => {
  flags.listsOn = true
  vi.restoreAllMocks()
})

let seq = 0
const REGION = 'Example Bayou Region'

async function seatOver(memberId: string): Promise<void> {
  const seat = `seat-mail-rules-${++seq}`
  await env.DB.prepare(
    `INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active)
     VALUES (?, 'Example Region Representative', '', 99, ?, 'regional_rep', 1)`,
  ).bind(seat, seat).run()
  await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(seat, REGION).run()
  await env.DB.prepare('INSERT INTO board_seat_assignments (id, seat_id, member_id) VALUES (?, ?, ?)').bind(`term-${seat}`, seat, memberId).run()
}

/** An address on the do-not-send list, as a bounce report would put it there. */
const noLongerReceives = (address: string) =>
  env.DB.prepare("INSERT OR IGNORE INTO mail_do_not_send (address, reason, detail) VALUES (?, 'bounce', 'General')").bind(address).run()

/** A club of the region, its representative, and a hidden event the representative drafted for it, marked for approval. */
async function world(state: 'draft' | 'review' = 'draft') {
  const n = ++seq
  const club = await seedClub({ name: `Example Chess Club ${n}` })
  await env.DB.prepare('UPDATE clubs SET region = ? WHERE id = ?').bind(REGION, club).run()
  const repAddress = `player.one.${n}@example.org`
  const representative = await seedMember({ fullName: 'Player One', email: repAddress })
  await seatOver(representative)
  const id = await seedTournament({
    name: `Example Fall Open ${n}`, date: '2026-12-12', clubId: club, createdBy: representative, entryFee: 0, sections: [{ name: 'Open', entryFee: 0 }], isVisible: false,
  })
  await env.DB.prepare('UPDATE tournaments SET needs_lca_approval = 1, approval_requested_at = ? WHERE id = ?').bind(state === 'review' ? '2026-11-14 18:00:00' : null, id).run()
  return { n, club, representative, repAddress, id }
}

/** One LCA admin with the address given. */
const adminAt = (email: string) => seedMember({ role: 'lca_admin', email, fullName: 'Player Two' })

const move = (as: string, id: string, body: unknown) => invoke(approval, { method: 'POST', as, params: { id }, body })
const mailTo = (address: string) => emailOutbox.filter((e) => e.to === address)
const words = async (res: { json: <T>() => Promise<T> }) => (await res.json<{ email: string }>()).email
const stored = (id: string) => env.DB.prepare('SELECT is_visible, approval_requested_at, approved_at FROM tournaments WHERE id = ?')
  .bind(id).first<{ is_visible: number; approval_requested_at: string | null; approved_at: string | null }>()
const rows = async (id: string, action: string) => (await env.DB.prepare(
  "SELECT COUNT(*) AS n FROM admin_audit_log WHERE action = ? AND json_extract(detail, '$.tournament_id') = ?",
).bind(action, id).first<{ n: number }>())?.n ?? 0
const everyAdminAddress = async () => (await env.DB.prepare("SELECT email FROM members WHERE role = 'lca_admin' AND email LIKE '%@%'").all<{ email: string }>()).results.map((r) => r.email.trim())

describe('the approval\'s emails under the mail engine\'s rules', () => {
  it('skips an LCA admin on the do-not-send list and one whose address mail cannot reach, emails the rest, and says the email did not reach every LCA admin', async () => {
    const w = await world()
    const reached = `player.two.${w.n}@example.org`
    const bounced = `player.five.${w.n}@example.org`
    const unreachable = `player.six.${w.n}@example.invalid`
    for (const address of [reached, bounced, unreachable]) await adminAt(address)
    await noLongerReceives(bounced)

    const res = await move(w.representative, w.id, { action: 'submit' })
    expect(res.status).toBe(200)
    expect(await words(res)).toBe(EMAIL_WORDS.reviewPartly)
    expect(mailTo(reached)).toHaveLength(1)
    expect(mailTo(bounced)).toEqual([])
    expect(mailTo(unreachable)).toEqual([])
    expect(mailTo(w.repAddress)).toEqual([])
    // The move is made whatever the mail did: in review, one row in the activity log.
    expect((await stored(w.id))?.approval_requested_at).not.toBeNull()
    expect(await rows(w.id, 'tournament_submitted')).toBe(1)
  })

  it('puts a submit into review when every LCA admin is refused, sends nothing, says so, and nothing sends it again', async () => {
    const w = await world()
    await adminAt(`player.two.${w.n}@example.org`)
    for (const address of await everyAdminAddress()) await noLongerReceives(address)

    const res = await move(w.representative, w.id, { action: 'submit' })
    expect(res.status).toBe(200)
    expect(await words(res)).toBe(EMAIL_WORDS.reviewNotSent)
    expect(emailOutbox).toEqual([])
    expect((await stored(w.id))?.approval_requested_at).not.toBeNull()
    expect(await rows(w.id, 'tournament_submitted')).toBe(1)

    // A second press changes nothing and sends nothing: the event waits on its pages, with no LCA admin told.
    const again = await move(w.representative, w.id, { action: 'submit' })
    expect(again.status).toBe(200)
    expect(await words(again)).toBe(EMAIL_WORDS.alreadyInReview)
    expect(emailOutbox).toEqual([])
    expect(await rows(w.id, 'tournament_submitted')).toBe(1)
  })

  it('goes on to the next LCA admin when the service refuses one send with a 429, 400 ms apart', async () => {
    const w = await world()
    const refused = `player.two.${w.n}@example.org`
    const next = `player.three.${w.n}@example.org`
    await adminAt(refused)
    await adminAt(next)
    emailBehavior.succeed = false
    emailBehavior.status = 429
    emailBehavior.failFor = [refused]

    const res = await move(w.representative, w.id, { action: 'submit' })
    expect(res.status).toBe(200)
    expect(await words(res)).toBe(EMAIL_WORDS.reviewPartly)
    expect(mailTo(refused)).toEqual([])
    expect(mailTo(next)).toHaveLength(1)
    expect(waits.length).toBeGreaterThan(0)
    expect(waits.every((ms) => ms === 400)).toBe(true)
  })

  it('lists the event on Approve and publish, and sends Ask for changes back to a draft, when the drafter is on the do-not-send list, saying the email was not sent', async () => {
    const approved = await world('review')
    const admin = await adminAt(`player.two.${approved.n}@example.org`)
    await noLongerReceives(approved.repAddress)
    const yes = await move(admin, approved.id, { action: 'approve' })
    expect(yes.status).toBe(200)
    expect(await words(yes)).toBe(EMAIL_WORDS.approvedNotSent)
    expect(await stored(approved.id)).toMatchObject({ is_visible: 1 })
    expect((await stored(approved.id))?.approved_at).not.toBeNull()

    const asked = await world('review')
    await noLongerReceives(asked.repAddress)
    const changes = await move(admin, asked.id, { action: 'ask_changes', note: 'Example note: please add the room number.' })
    expect(changes.status).toBe(200)
    expect(await words(changes)).toBe(EMAIL_WORDS.changesNotSent)
    expect(await stored(asked.id)).toMatchObject({ is_visible: 0, approval_requested_at: null, approved_at: null })
    expect(mailTo(approved.repAddress)).toEqual([])
    expect(mailTo(asked.repAddress)).toEqual([])
  })

  it('sends to the same LCA admin with the rules off, as before the newsletter list\'s switch', async () => {
    flags.listsOn = false
    const w = await world()
    const bounced = `player.five.${w.n}@example.org`
    await adminAt(bounced)
    await noLongerReceives(bounced)
    const res = await move(w.representative, w.id, { action: 'submit' })
    expect(res.status).toBe(200)
    expect(mailTo(bounced)).toHaveLength(1)
  })
})

describe('the announce to an event\'s entrants under the mail engine\'s rules', () => {
  async function running() {
    const w = await world()
    await env.DB.prepare("UPDATE tournaments SET approved_at = datetime('now'), is_visible = 1 WHERE id = ?").bind(w.id).run()
    const entrants = {
      reached: `player.seven.${w.n}@example.org`,
      bounced: `player.eight.${w.n}@example.org`,
      throttled: `player.nine.${w.n}@example.org`,
      unreachable: `player.ten.${w.n}@example.invalid`,
    }
    for (const [name, email] of Object.entries(entrants)) {
      const member = await seedMember({ fullName: `Player ${name}`, email })
      await seedRegistration({ tournamentId: w.id, memberId: member, paymentStatus: 'pending' })
    }
    await noLongerReceives(entrants.bounced)
    return { ...w, entrants }
  }
  const send = (as: string, id: string) => invoke(announce, { method: 'POST', as, params: { id }, body: { subject: 'Example subject', body: 'Example body' } })

  it('counts a refused entrant failed with no call to the service, and a 429 for one entrant does not end the loop', async () => {
    const w = await running()
    emailBehavior.succeed = false
    emailBehavior.status = 429
    emailBehavior.failFor = [w.entrants.throttled]
    const watch = throttleMail(() => false)
    try {
      const res = await send(w.representative, w.id)
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ sent: 1, failed: 3, total: 4 })
      // The service was asked twice: the reached entrant and the throttled one; the two refused were never sent.
      expect(watch.mail()).toHaveLength(2)
    } finally {
      watch.stop()
    }
    expect(emailOutbox.map((e) => e.to)).toEqual([w.entrants.reached])
    expect(await rows(w.id, 'announcement_sent')).toBe(1)
  })

  it('sends to the entrant on the do-not-send list and the one mail cannot reach with the rules off, as before the newsletter list\'s switch', async () => {
    flags.listsOn = false
    const w = await running()
    const res = await send(w.representative, w.id)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ sent: 4, failed: 0, total: 4 })
    expect(emailOutbox.map((e) => e.to).sort()).toEqual(Object.values(w.entrants).sort())
  })
})
