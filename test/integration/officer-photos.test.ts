// test/integration/officer-photos.test.ts
// Admins upload officer photos; the public board shows them.
import { beforeEach, describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import { invoke, resetHarness } from './harness'
import { seedAdmin, seedMember } from './factories'
import { onRequestPost as photoPost, onRequestDelete as photoDelete } from '../../functions/api/admin/officer-photo'
import { onRequestGet as seatsGet } from '../../functions/api/board/seats'
import { onRequestGet as photoGet } from '../../functions/api/officer-photos/[key]'

beforeEach(resetHarness)

async function aSeat(): Promise<string> {
  const s = await env.DB.prepare('SELECT id FROM board_members WHERE is_active = 1 LIMIT 1').first<{ id: string }>()
  if (s) return s.id
  await env.DB.prepare(`INSERT INTO board_members (id, role, name, sort_order) VALUES ('seat-p', 'President', 'TBD', 1)`).run()
  return 'seat-p'
}

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9])

describe('officer photos', () => {
  it('lets an admin add a holder photo that the public board then shows', async () => {
    const admin = await seedAdmin()
    const officer = await seedMember({ fullName: 'Pat President' })
    const seat = await aSeat()
    await env.DB.prepare('INSERT INTO board_seat_assignments (seat_id, member_id, appointed_by) VALUES (?, ?, ?)').bind(seat, officer, admin).run()

    const up = await invoke(photoPost, {
      method: 'POST', as: admin, path: `/api/admin/officer-photo?member=${officer}`,
      headers: { 'Content-Type': 'image/jpeg' }, rawBody: jpeg as unknown as string,
    })
    expect(up.status).toBe(200)
    const { photoUrl } = await up.json<{ photoUrl: string }>()
    expect(photoUrl).toMatch(new RegExp(`^/api/officer-photos/member-${officer}\\?v=`))

    const seats = await (await invoke(seatsGet, {})).json<{ seats: Array<{ id: string; holders: Array<{ photo_url: string }> }> }>()
    expect(seats.seats.find((s) => s.id === seat)?.holders[0].photo_url).toBe(photoUrl)

    const served = await invoke(photoGet, { params: { key: `member-${officer}` } })
    expect(served.status).toBe(200)

    expect((await invoke(photoDelete, { method: 'DELETE', as: admin, path: `/api/admin/officer-photo?member=${officer}` })).status).toBe(200)
    const after = await env.DB.prepare('SELECT photo_url FROM members WHERE id = ?').bind(officer).first<{ photo_url: string | null }>()
    expect(after?.photo_url).toBeNull()
  })

  it('is admin-only', async () => {
    const someone = await seedMember()
    const seat = await aSeat()
    const res = await invoke(photoPost, {
      method: 'POST', as: someone, path: `/api/admin/officer-photo?seat=${seat}`,
      headers: { 'Content-Type': 'image/jpeg' }, rawBody: jpeg as unknown as string,
    })
    expect(res.status).toBe(403)
  })
})
