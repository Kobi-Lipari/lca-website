// test/integration/unlisted-seat.test.ts
//
// A board seat that counts but is not shown publicly (board_members.is_listed
// = 0, migration 0073). To a visitor it does not exist: the two public seat
// reads (GET /api/board/seats, GET /api/governance/board) hold no trace of it,
// and a message that names it by slug or id is a general inquiry, exactly as
// one naming a seat nobody has. Its holder keeps everything the seat gives:
// my-seats lists it, and the Media manager seat still counts for sending.
// Every person here is made up; "Media manager" is the seat's own title.
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { onRequestGet as mediaManagerGet } from '../../functions/api/me/media-manager'
import { onRequestGet as seatsGet } from '../../functions/api/board/seats'
import { onRequestGet as boardGet } from '../../functions/api/governance/board'
import { onRequestGet as mySeatsGet } from '../../functions/api/board/my-seats'
import { onRequestPost as contactPost } from '../../functions/api/contact'
import { onRequestPost as supportPost } from '../../functions/api/support'
import { MEDIA_MANAGER_SEAT, holdsMediaManagerSeat } from '../../functions/utils/admin/mediaManager'
import { onRequestGet as adminSeatsGet, onRequestPost as adminSeatsPost } from '../../functions/api/admin/board-seats'
import { seedAdmin, seedMember, seedSeat } from './factories'
import { invoke, resetHarness } from './harness'
import { migrationModules, splitSql } from './setup'

vi.mock('../../functions/utils/mail/switches', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/mail/switches')>()
  return { ...real, MAIL_LISTS_ON: true }
})

const HOLDER = 'Sample Holder Nine'
const PHOTO = '/api/officer-photos/member-sample-nine.jpg'

/** An active unlisted Media manager seat held by a made-up member with a photo, and a listed seat beside it. */
async function seedBoth() {
  const holder = await seedMember({ fullName: HOLDER })
  await env.DB.prepare('UPDATE members SET photo_url = ? WHERE id = ?').bind(PHOTO, holder).run()
  const unlisted = await seedSeat({ slug: MEDIA_MANAGER_SEAT, role: 'Media manager', isListed: false }, [holder])
  const listedHolder = await seedMember({ fullName: 'Sample Holder Ten' })
  const listed = await seedSeat({ slug: 'sample-listed-seat', role: 'Sample listed seat' }, [listedHolder])
  return { holder, unlisted, listed, listedHolder }
}

/** Each piece of the unlisted seat a visitor must never see. */
const traces = (unlisted: string) => [unlisted, MEDIA_MANAGER_SEAT, 'Media manager', HOLDER, PHOTO]

beforeEach(async () => {
  resetHarness()
  // A ticket routed to a seat holds it by a foreign key; let it go before the seat does.
  await env.DB.prepare(`UPDATE support_tickets SET seat_id = NULL WHERE seat_id LIKE 'seat-%'`).run()
  await env.DB.prepare(`DELETE FROM board_members WHERE id LIKE 'seat-%'`).run()
})

describe('the public seat reads leave an unlisted seat out', () => {
  it('GET /api/board/seats holds no trace of it, and the listed seat beside it is as before', async () => {
    const { unlisted, listed } = await seedBoth()
    const res = await invoke(seatsGet, { path: '/api/board/seats' })
    expect(res.status).toBe(200)
    const body = await res.json<{ seats: Array<{ id: string; slug: string; role: string; holder_name: string; holder_count: number }> }>()
    const text = JSON.stringify(body)
    for (const piece of traces(unlisted)) expect(text, piece).not.toContain(piece)
    const shown = body.seats.find((s) => s.id === listed)
    expect(shown).toMatchObject({ slug: 'sample-listed-seat', role: 'Sample listed seat', holder_name: 'Sample Holder Ten', holder_count: 1 })
  })

  it('GET /api/governance/board holds no trace of it, signed out or signed in, and the listed seat is there', async () => {
    const { unlisted, listed, holder } = await seedBoth()
    for (const as of [undefined, holder]) {
      const res = await invoke(boardGet, { path: '/api/governance/board', as })
      expect(res.status).toBe(200)
      const body = await res.json<{ members: Array<{ id: string; role: string }> }>()
      const text = JSON.stringify(body)
      for (const piece of traces(unlisted)) expect(text, `${piece} as ${as ?? 'a visitor'}`).not.toContain(piece)
      expect(body.members.some((m) => m.id === listed && m.role === 'Sample listed seat')).toBe(true)
    }
  })
})

describe('a message naming an unlisted seat is a general inquiry', () => {
  const message = (seatRef: string) => ({ name: 'Sample Visitor', email: 'visitor@example.org', subject: 'A question', body: 'Hello there.', seatRef })

  for (const [label, handler, path] of [['POST /api/contact', contactPost, '/api/contact'], ['POST /api/support', supportPost, '/api/support']] as const) {
    it(`${label} answers for its slug and its id exactly as for a slug nobody has, and the ticket has no seat`, async () => {
      const { unlisted } = await seedBoth()
      const nobody = await invoke(handler, { method: 'POST', path, body: message('no-such-seat') })
      const nobodyBody = await nobody.json<{ ticketId: string }>()
      expect(typeof nobodyBody.ticketId).toBe('string')
      const nobodyRest = Object.fromEntries(Object.entries(nobodyBody).filter(([key]) => key !== 'ticketId'))
      expect(nobody.status).toBe(201)
      for (const ref of [MEDIA_MANAGER_SEAT, unlisted]) {
        const res = await invoke(handler, { method: 'POST', path, body: message(ref) })
        expect(res.status, ref).toBe(nobody.status)
        const body = await res.json<{ ticketId: string }>()
        const { ticketId, ...rest } = body
        expect(rest, ref).toEqual(nobodyRest)
        expect(rest, ref).toEqual({ success: true, routedTo: null })
        const row = await env.DB.prepare('SELECT seat_id FROM support_tickets WHERE id = ?').bind(ticketId).first<{ seat_id: string | null }>()
        expect(row, ref).toEqual({ seat_id: null })
      }
    })
  }
})

describe('the holder keeps what the seat gives', () => {
  it('GET /api/board/my-seats gives the unlisted seat to its holder', async () => {
    const { holder, unlisted } = await seedBoth()
    const res = await invoke(mySeatsGet, { path: '/api/board/my-seats', as: holder })
    expect(res.status).toBe(200)
    const body = await res.json<{ seats: Array<{ id: string; slug: string; role: string }> }>()
    expect(body.seats.map((s) => [s.id, s.slug, s.role])).toEqual([[unlisted, MEDIA_MANAGER_SEAT, 'Media manager']])
  })

  it('holdsMediaManagerSeat is true for the holder of an active unlisted Media manager seat', async () => {
    const { holder, listedHolder } = await seedBoth()
    expect(await holdsMediaManagerSeat(env.DB, holder)).toBe(true)
    expect(await holdsMediaManagerSeat(env.DB, listedHolder)).toBe(false)
  })

  it('GET /api/me/media-manager says so for the holder, with a second factor', async () => {
    const { holder, listedHolder } = await seedBoth()
    const res = await invoke(mediaManagerGet, { path: '/api/me/media-manager', as: holder })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ mediaManager: true, secondFactor: true })
    const other = await invoke(mediaManagerGet, { path: '/api/me/media-manager', as: listedHolder })
    expect(await other.json()).toEqual({ mediaManager: false, secondFactor: true })
  })
})

describe('Admin sees the unlisted seat', () => {
  it('GET /api/admin/board-seats lists it with is_listed 0, and the listed seat with 1', async () => {
    const { unlisted, listed } = await seedBoth()
    const admin = await seedAdmin()
    const res = await invoke(adminSeatsGet, { path: '/api/admin/board-seats', as: admin })
    expect(res.status).toBe(200)
    const body = await res.json<{ seats: Array<{ id: string; is_listed: number; is_active: number }> }>()
    expect(body.seats.find((s) => s.id === unlisted)).toMatchObject({ is_listed: 0, is_active: 1 })
    expect(body.seats.find((s) => s.id === listed)).toMatchObject({ is_listed: 1, is_active: 1 })
  })
})

describe('POST /api/admin/board-seats brings a retired seat back', () => {
  const activeOf = async (id: string) =>
    (await env.DB.prepare('SELECT is_active FROM board_members WHERE id = ?').bind(id).first<{ is_active: number }>())?.is_active

  it('an admin with a second factor brings a retired seat back, and the seat is still unlisted and has no holder', async () => {
    const admin = await seedAdmin()
    const seat = await seedSeat({ slug: MEDIA_MANAGER_SEAT, role: 'Media manager', isActive: false, isListed: false })
    const res = await invoke(adminSeatsPost, { method: 'POST', path: '/api/admin/board-seats', as: admin, body: { seatId: seat, reactivate: true } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, seatId: seat, reactivated: true })
    expect(await activeOf(seat)).toBe(1)
    const row = await env.DB.prepare('SELECT is_listed FROM board_members WHERE id = ?').bind(seat).first<{ is_listed: number }>()
    expect(row).toEqual({ is_listed: 0 })
    const terms = await env.DB.prepare('SELECT COUNT(*) AS n FROM board_seat_assignments WHERE seat_id = ? AND ended_at IS NULL').bind(seat).first<{ n: number }>()
    expect(terms).toEqual({ n: 0 })
  })

  it('records who brought the seat back in the admin audit log, as the other seat changes are recorded', async () => {
    const admin = await seedAdmin()
    const seat = await seedSeat({ slug: 'sample-retired-seat', role: 'Sample retired seat', isActive: false })
    const res = await invoke(adminSeatsPost, { method: 'POST', path: '/api/admin/board-seats', as: admin, body: { seatId: seat, reactivate: true } })
    expect(res.status).toBe(200)
    const rows = await env.DB.prepare(`SELECT actor_id, action, target_member_id, target_label, detail FROM admin_audit_log WHERE action = 'seat_reactivate' AND actor_id = ?`)
      .bind(admin)
      .all<{ actor_id: string; action: string; target_member_id: string | null; target_label: string; detail: string }>()
    expect(rows.results).toHaveLength(1)
    expect(rows.results[0]).toMatchObject({ actor_id: admin,target_member_id: null, target_label: 'Sample retired seat' })
    expect(JSON.parse(rows.results[0].detail)).toEqual({ seat_id: seat, seat: 'Sample retired seat' })
  })

  it('refuses an admin without a second factor, an LCA Observer and a member as the handler refuses them today, and the seat stays retired', async () => {
    const admin = await seedAdmin()
    const observer = await seedMember({ role: 'lca_observer' })
    const member = await seedMember()
    const seat = await seedSeat({ slug: 'sample-retired-seat', role: 'Sample retired seat', isActive: false })
    for (const [who, as, aal] of [['an admin without a second factor', admin, 'aal1'], ['an LCA Observer', observer, 'aal2'], ['a member', member, 'aal2'], ['a visitor', undefined, 'aal2']] as const) {
      const today = await invoke(adminSeatsPost, { method: 'POST', path: '/api/admin/board-seats', as, aal, body: { seatId: seat, vacate: true } })
      const res = await invoke(adminSeatsPost, { method: 'POST', path: '/api/admin/board-seats', as, aal, body: { seatId: seat, reactivate: true } })
      expect(res.status, who).toBe(today.status)
      expect(res.status, who).toBeGreaterThanOrEqual(401)
      expect(await res.json(), who).toEqual(await today.json())
      expect(await activeOf(seat), who).toBe(0)
    }
  })

  it('a listed seat brought back shows on the public seat list as open, not under the name or photo it had before it was retired', async () => {
    const admin = await seedAdmin()
    const seat = await seedSeat({ slug: 'sample-retired-seat', role: 'Sample retired seat', isActive: false })
    await env.DB.prepare('UPDATE board_members SET name = ?, photo_url = ? WHERE id = ?')
      .bind('Sample Old Name', '/api/officer-photos/sample-old-seat-photo.jpg', seat).run()
    const res = await invoke(adminSeatsPost, { method: 'POST', path: '/api/admin/board-seats', as: admin, body: { seatId: seat, reactivate: true } })
    expect(res.status).toBe(200)
    const list = await (await invoke(seatsGet, { path: '/api/board/seats' })).json<{ seats: Array<{ id: string; holder_name: string; holder_count: number }> }>()
    expect(list.seats.find((s) => s.id === seat)).toMatchObject({ holder_name: 'TBD', holder_count: 0 })
    expect(JSON.stringify(list)).not.toContain('Sample Old Name')
    expect(JSON.stringify(list)).not.toContain('sample-old-seat-photo')
    const row = await env.DB.prepare('SELECT photo_url FROM board_members WHERE id = ?').bind(seat).first<{ photo_url: string | null }>()
    expect(row?.photo_url).toBeNull()
  })

  it('a seat that is already in use answers the same and leaves nothing in the audit log', async () => {
    const admin = await seedAdmin()
    const seat = await seedSeat({ slug: 'sample-active-seat', role: 'Sample active seat' })
    const res = await invoke(adminSeatsPost, { method: 'POST', path: '/api/admin/board-seats', as: admin, body: { seatId: seat, reactivate: true } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, seatId: seat, reactivated: true })
    const row = await env.DB.prepare('SELECT is_active, name FROM board_members WHERE id = ?').bind(seat).first<{ is_active: number; name: string }>()
    expect(row).toEqual({ is_active: 1, name: 'Player One' })
    const rows = await env.DB.prepare(`SELECT COUNT(*) AS n FROM admin_audit_log WHERE action = 'seat_reactivate' AND actor_id = ?`).bind(admin).first<{ n: number }>()
    expect(rows).toEqual({ n: 0 })
  })

  it('answers an unknown seat as the handler does', async () => {
    const admin = await seedAdmin()
    const res = await invoke(adminSeatsPost, { method: 'POST', path: '/api/admin/board-seats', as: admin, body: { seatId: 'no-such-seat', reactivate: true } })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Seat not found' })
  })
})

describe('migration 0073', () => {
  it('its data statement leaves a retired Media manager seat retired and unlisted, and touches no other seat', async () => {
    const mediaManager = await seedSeat({ slug: MEDIA_MANAGER_SEAT, role: 'Media manager', isActive: false })
    const other = await seedSeat({ slug: 'sample-other-seat', role: 'Sample other seat' })
    const retired = await seedSeat({ slug: 'sample-retired-seat', role: 'Sample retired seat', isActive: false })
    const read = () => env.DB.prepare(`SELECT id, is_active, is_listed FROM board_members WHERE id LIKE 'seat-%' ORDER BY id`).all<{ id: string; is_active: number; is_listed: number }>()
    const before = (await read()).results
    const path = Object.keys(migrationModules).find((p) => p.endsWith('/0073_seat_listing.sql'))
    expect(path).toBeDefined()
    const data = splitSql(migrationModules[path!]).filter((statement) => /^UPDATE/i.test(statement.trim()))
    expect(data).toHaveLength(1)
    // Twice in a row, as the file's header says it is safe to.
    for (let run = 0; run < 2; run++) await env.DB.prepare(data[0]).run()
    const after = (await read()).results
    expect(after.find((r) => r.id === mediaManager)).toEqual({ id: mediaManager, is_active: 0, is_listed: 0 })
    for (const id of [other, retired]) expect(after.find((r) => r.id === id), id).toEqual(before.find((r) => r.id === id))
    expect(after.filter((r) => r.id !== mediaManager)).toEqual(before.filter((r) => r.id !== mediaManager))
  })
})
