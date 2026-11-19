// test/integration/region-events-mail-edges.test.ts
//
// The edges of the mail the representatives' club events can cause, under the
// mail engine's rules, beside test/integration/region-events-mail-rules.test.ts:
// - a submit when no LCA admin has an address with an "@": the event goes into
//   review, nothing is sent, and the answer says no LCA admin has an address
//   on file; asking again changes nothing and sends nothing;
// - a submit when the service answers every send with a 503: every LCA admin
//   is still tried, 400 ms apart, the event stays in review, and nothing sends
//   it again;
// - a submit when the do-not-send list cannot be read: the emails go as if the
//   list were empty, as the engine's own words for event mail say;
// - the wrong role gets 401 or 403 on the approval and on the announce, with
//   nothing sent, nothing written and none of the event's data in the answer.
// The cases set every switch they read themselves, through getters on the
// mocked modules, and read no switch as it ships. Every club, person, address
// and event is made up, and mail is read from the test outbox.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EMAIL_WORDS, onRequestPost as approval } from '../../functions/api/admin/tournaments/[id]/approval'
import { onRequestPost as announce } from '../../functions/api/admin/tournaments/[id]/announce'
import { seedClub, seedMember, seedRegistration, seedTournament } from './factories'
import { emailBehavior, emailOutbox, invoke, resetHarness } from './harness'
import { noWaits } from './mailRuns'

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
      return true
    },
    get MAIL_SENDER() {
      return 'resend' as const
    },
  }
})

let waits: number[] = []
beforeEach(() => {
  resetHarness()
  waits = noWaits()
})
afterEach(() => {
  vi.restoreAllMocks()
})

let seq = 0
const REGION = 'Example Bayou Region'

async function seatOver(memberId: string): Promise<void> {
  const seat = `seat-mail-edges-${++seq}`
  await env.DB.prepare(
    `INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active)
     VALUES (?, 'Example Region Representative', '', 99, ?, 'regional_rep', 1)`,
  ).bind(seat, seat).run()
  await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(seat, REGION).run()
  await env.DB.prepare('INSERT INTO board_seat_assignments (id, seat_id, member_id) VALUES (?, ?, ?)').bind(`term-${seat}`, seat, memberId).run()
}

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

const adminAt = (email: string) => seedMember({ role: 'lca_admin', email, fullName: 'Player Two' })
const move = (as: string | undefined, id: string, body: unknown, over?: Partial<Env>) => invoke(approval, { method: 'POST', as, params: { id }, body, env: over })
const words = async (res: { json: <T>() => Promise<T> }) => (await res.json<{ email: string }>()).email
const stored = (id: string) => env.DB.prepare('SELECT is_visible, approval_requested_at, approved_at FROM tournaments WHERE id = ?')
  .bind(id).first<{ is_visible: number; approval_requested_at: string | null; approved_at: string | null }>()
const rows = async (id: string, action: string) => (await env.DB.prepare(
  "SELECT COUNT(*) AS n FROM admin_audit_log WHERE action = ? AND json_extract(detail, '$.tournament_id') = ?",
).bind(action, id).first<{ n: number }>())?.n ?? 0
const log = async (id: string) => (await env.DB.prepare("SELECT COUNT(*) AS n FROM admin_audit_log WHERE json_extract(detail, '$.tournament_id') = ?").bind(id).first<{ n: number }>())?.n ?? 0

/** The database as the handler sees it, with every statement about the do-not-send list refused, as a read that fails would be. */
function withoutDoNotSendList(): Partial<Env> {
  const db = new Proxy(env.DB, {
    get(target, key) {
      if (key === 'prepare') {
        return (sql: string) => {
          if (sql.includes('mail_do_not_send')) throw new Error('the do-not-send list cannot be read')
          return target.prepare(sql)
        }
      }
      const value = Reflect.get(target, key, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
  return { DB: db as D1Database }
}

describe('a submit with nobody to tell, with every send refused, and with the do-not-send list unread', () => {
  it('puts a submit into review with no LCA admin address on file, sends nothing, says so, and a second press changes nothing', async () => {
    const w = await world()
    await env.DB.prepare("UPDATE members SET email = 'no address on file' WHERE role = 'lca_admin'").run()
    await adminAt('no address either')

    const res = await move(w.representative, w.id, { action: 'submit' })
    expect(res.status).toBe(200)
    expect(await words(res)).toBe(EMAIL_WORDS.reviewNoAdmin)
    expect(emailOutbox).toEqual([])
    expect((await stored(w.id))?.approval_requested_at).not.toBeNull()
    expect(await rows(w.id, 'tournament_submitted')).toBe(1)

    const again = await move(w.representative, w.id, { action: 'submit' })
    expect(await words(again)).toBe(EMAIL_WORDS.alreadyInReview)
    expect(emailOutbox).toEqual([])
    expect(await rows(w.id, 'tournament_submitted')).toBe(1)
  })

  it('tries every LCA admin when the service answers each send with a 503, 400 ms apart, keeps the event in review and tells nobody again', async () => {
    const w = await world()
    const admins = [`player.two.${w.n}@example.org`, `player.three.${w.n}@example.org`, `player.four.${w.n}@example.org`]
    for (const address of admins) await adminAt(address)
    const onFile = (await env.DB.prepare("SELECT COUNT(*) AS n FROM members WHERE role = 'lca_admin' AND email LIKE '%@%'").first<{ n: number }>())?.n ?? 0
    emailBehavior.succeed = false
    emailBehavior.status = 503

    const res = await move(w.representative, w.id, { action: 'submit' })
    expect(res.status).toBe(200)
    expect(await words(res)).toBe(EMAIL_WORDS.reviewNotSent)
    expect(emailOutbox).toEqual([])
    // One wait between each pair of sends: every LCA admin on file was tried, none was skipped after the refusals.
    expect(waits).toHaveLength(onFile - 1)
    expect(waits.every((ms) => ms === 400)).toBe(true)
    expect((await stored(w.id))?.approval_requested_at).not.toBeNull()

    const again = await move(w.representative, w.id, { action: 'submit' })
    expect(await words(again)).toBe(EMAIL_WORDS.alreadyInReview)
    expect(waits).toHaveLength(onFile - 1)
    expect(await rows(w.id, 'tournament_submitted')).toBe(1)
  })

  it('sends the emails as if the do-not-send list were empty when that list cannot be read', async () => {
    const w = await world()
    const address = `player.two.${w.n}@example.org`
    await adminAt(address)
    await env.DB.prepare('INSERT OR IGNORE INTO mail_do_not_send (address, reason, detail) VALUES (?, ?, ?)').bind(address, 'bounce', 'General').run()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const res = await move(w.representative, w.id, { action: 'submit' }, withoutDoNotSendList())
    expect(res.status).toBe(200)
    expect(await words(res)).toBe(EMAIL_WORDS.reviewSent)
    expect(emailOutbox.filter((e) => e.to === address)).toHaveLength(1)
    expect(warn).toHaveBeenCalled()
  })
})

describe('the wrong role on the approval and the announce, with the rules on', () => {
  it('answers 401 signed out and 403 for a plain member and for the drafting representative on Approve and publish and Ask for changes, with nothing sent, written or told', async () => {
    const w = await world('review')
    await adminAt(`player.two.${w.n}@example.org`)
    const member = await seedMember({ fullName: 'Player Three', email: `player.three.${w.n}@example.org` })
    const before = await stored(w.id)
    const logged = await log(w.id)

    const bodies = [{ action: 'approve' }, { action: 'ask_changes', note: 'Example note: please add the room number.' }]
    for (const body of bodies) {
      const out = await move(undefined, w.id, body)
      expect(out.status).toBe(401)
      for (const who of [member, w.representative]) {
        const res = await move(who, w.id, body)
        expect(res.status).toBe(403)
        const text = JSON.stringify(await res.json())
        expect(text).not.toContain(`Example Fall Open ${w.n}`)
        expect(text).not.toContain(w.id)
      }
    }
    expect(emailOutbox).toEqual([])
    expect(await stored(w.id)).toEqual(before)
    expect(await log(w.id)).toBe(logged)
  })

  it('answers 401 signed out and 403 for a plain member on the announce, with nothing sent and no entrant named', async () => {
    const w = await world()
    await env.DB.prepare("UPDATE tournaments SET approved_at = datetime('now'), is_visible = 1 WHERE id = ?").bind(w.id).run()
    const entrant = `player.seven.${w.n}@example.org`
    await seedRegistration({ tournamentId: w.id, memberId: await seedMember({ fullName: 'Player Seven', email: entrant }), paymentStatus: 'pending' })
    const member = await seedMember({ fullName: 'Player Three', email: `player.three.${w.n}@example.org` })
    const send = (as?: string) => invoke(announce, { method: 'POST', as, params: { id: w.id }, body: { subject: 'Example subject', body: 'Example body' } })

    expect((await send()).status).toBe(401)
    const res = await send(member)
    expect(res.status).toBe(403)
    expect(JSON.stringify(await res.json())).not.toContain(entrant)
    expect(emailOutbox).toEqual([])
    expect(await rows(w.id, 'announcement_sent')).toBe(0)
  })
})
