// test/integration/club-tables-edges.test.ts
//
// The edges of the two deletes and the create around migration 0066's tables
// (WS09 step 4):
// - a member who decided a request of their own, who is named on many clubs
//   and reports, or whose delete is sent twice, is deleted once and cleanly;
// - a club's delete leaves the reports that name no club (a new club or a
//   club someone wants to start), and the members who saved, checked, asked
//   or decided in it, and a replay answers 404 with nothing moved;
// - two creates of one name sent together never leave a club with an id and
//   a slug that differ, and never leave a club with no slug.
// Every club, person and address here is made up.
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { onRequestPost as clubCreate } from '../../functions/api/admin/clubs'
import { onRequestDelete as clubDelete } from '../../functions/api/admin/clubs/[id]'
import { onRequestDelete as memberDelete } from '../../functions/api/admin/members/[id]'
import { seedAdmin, seedClub, seedMember } from './factories'
import { invoke, resetHarness } from './harness'

beforeEach(resetHarness)

const count = async (sql: string, ...binds: unknown[]) => (await env.DB.prepare(sql).bind(...binds).first<{ n: number }>())!.n

describe('a member who is named in many places', () => {
  it('is deleted when they decided a request of their own, and the request goes with them', async () => {
    const admin = await seedAdmin()
    const member = await seedMember({ fullName: 'Player One', email: 'player.one@example.org' })
    const clubId = await seedClub({ id: 'example-self-decided', name: 'Example Self Decided Club' })
    await env.DB.prepare(
      `INSERT INTO club_rep_requests (club_id, member_id, connection, status, decided_by, decided_at)
       VALUES (?, ?, 'other', 'approved', ?, '2026-11-04 17:00:00')`,
    ).bind(clubId, member, member).run()
    const res = await invoke(memberDelete, { method: 'DELETE', as: admin, params: { id: member } })
    expect(res.status).toBe(200)
    expect(await count('SELECT COUNT(*) AS n FROM club_rep_requests WHERE club_id = ?', clubId)).toBe(0)
    expect(await count('SELECT COUNT(*) AS n FROM members WHERE id = ?', member)).toBe(0)
  })

  it('is deleted when they saved and checked many clubs, resolved many reports and asked at many clubs', async () => {
    const admin = await seedAdmin()
    const member = await seedMember({ fullName: 'Player One', email: 'player.one@example.org' })
    const other = await seedMember({ fullName: 'Player Two', email: 'player.two@example.org' })
    const clubs: string[] = []
    for (let i = 1; i <= 4; i++) {
      const id = await seedClub({ id: `example-many-${i}`, name: `Example Many Club ${i}` })
      clubs.push(id)
      await env.DB.prepare('UPDATE clubs SET told_by = ?, confirmed_by = ? WHERE id = ?').bind(member, i % 2 ? member : other, id).run()
      await env.DB.prepare(
        `INSERT INTO club_reports (club_id, kind, message, status, resolved_by) VALUES (?, 'suggestion', 'A made up note.', 'dismissed', ?)`,
      ).bind(id, member).run()
      await env.DB.prepare(`INSERT INTO club_rep_requests (club_id, member_id, connection) VALUES (?, ?, 'keeps_page')`).bind(id, member).run()
      await env.DB.prepare(`INSERT INTO club_rep_requests (club_id, member_id, connection, status, decided_by) VALUES (?, ?, 'runs_it', 'declined', ?)`).bind(id, other, member).run()
    }
    const res = await invoke(memberDelete, { method: 'DELETE', as: admin, params: { id: member } })
    expect(res.status).toBe(200)
    expect(await count(`SELECT COUNT(*) AS n FROM clubs WHERE id LIKE 'example-many-%' AND (told_by IS NOT NULL OR confirmed_by = ?)`, member)).toBe(0)
    expect(await count('SELECT COUNT(*) AS n FROM clubs WHERE confirmed_by = ?', other)).toBe(2)
    expect(await count(`SELECT COUNT(*) AS n FROM club_reports WHERE club_id LIKE 'example-many-%' AND resolved_by IS NOT NULL`)).toBe(0)
    expect(await count(`SELECT COUNT(*) AS n FROM club_reports WHERE club_id LIKE 'example-many-%'`)).toBe(4)
    expect(await count('SELECT COUNT(*) AS n FROM club_rep_requests WHERE member_id = ?', member)).toBe(0)
    expect(await count('SELECT COUNT(*) AS n FROM club_rep_requests WHERE member_id = ? AND decided_by IS NULL AND status = ?', other, 'declined')).toBe(4)
  })

  it('answers 404 to a second delete of the same member and moves no row', async () => {
    const admin = await seedAdmin()
    const member = await seedMember({ fullName: 'Player One', email: 'player.one@example.org' })
    const clubId = await seedClub({ id: 'example-replay-member', name: 'Example Replay Member Club' })
    await env.DB.prepare('UPDATE clubs SET told_by = ? WHERE id = ?').bind(member, clubId).run()
    expect((await invoke(memberDelete, { method: 'DELETE', as: admin, params: { id: member } })).status).toBe(200)
    const again = await invoke(memberDelete, { method: 'DELETE', as: admin, params: { id: member } })
    expect(again.status).toBe(404)
    expect(await again.json()).toEqual({ error: 'Member not found' })
    expect(await env.DB.prepare('SELECT told_by FROM clubs WHERE id = ?').bind(clubId).first()).toEqual({ told_by: null })
  })
})

describe('a club that is named in many places', () => {
  it('goes with its own rows and leaves the reports that name no club, and the members who saved, checked, asked or decided in it', async () => {
    const admin = await seedAdmin()
    const saver = await seedMember({ fullName: 'Player One', email: 'player.one@example.org' })
    const asker = await seedMember({ fullName: 'Player Two', email: 'player.two@example.org' })
    const clubId = await seedClub({ id: 'example-goes-club', name: 'Example Goes Club' })
    await env.DB.prepare('UPDATE clubs SET told_by = ?, confirmed_by = ? WHERE id = ?').bind(saver, saver, clubId).run()
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO club_reports (club_id, kind, message, status, resolved_by) VALUES (?, 'suggestion', 'A made up note.', 'applied', ?)`).bind(clubId, saver),
      env.DB.prepare(`INSERT INTO club_reports (club_id, kind, message, region) VALUES (NULL, 'new_club', 'A made up new club.', 'Example Region')`),
      env.DB.prepare(`INSERT INTO club_reports (club_id, kind, message, region) VALUES (NULL, 'start_club', 'A made up wish.', 'Example Region')`),
      env.DB.prepare(`INSERT INTO club_rep_requests (club_id, member_id, connection, status, decided_by) VALUES (?, ?, 'runs_it', 'approved', ?)`).bind(clubId, asker, saver),
      env.DB.prepare('INSERT INTO club_slug_history (old_slug, club_id) VALUES (?, ?), (?, ?)').bind('example-goes-old-one', clubId, 'example-goes-old-two', clubId),
      env.DB.prepare(`INSERT INTO club_places (club_id, name) VALUES (?, 'Example Library')`).bind(clubId),
    ])
    const res = await invoke(clubDelete, { method: 'DELETE', as: admin, params: { id: clubId } })
    expect(res.status).toBe(200)
    expect(await count(`SELECT COUNT(*) AS n FROM club_reports WHERE club_id = ?`, clubId)).toBe(0)
    expect(await count(`SELECT COUNT(*) AS n FROM club_reports WHERE club_id IS NULL AND region = 'Example Region' AND kind IN ('new_club', 'start_club')`)).toBe(2)
    expect(await count('SELECT COUNT(*) AS n FROM members WHERE id IN (?, ?)', saver, asker)).toBe(2)
    expect(await count('SELECT COUNT(*) AS n FROM club_slug_history WHERE club_id = ?', clubId)).toBe(0)
    expect(await count('SELECT COUNT(*) AS n FROM club_places WHERE club_id = ?', clubId)).toBe(0)
    expect(await count('SELECT COUNT(*) AS n FROM club_rep_requests WHERE club_id = ?', clubId)).toBe(0)
  })

  it('answers 404 to a second delete of the same club and moves no row', async () => {
    const admin = await seedAdmin()
    const clubId = await seedClub({ id: 'example-replay-club', name: 'Example Replay Club' })
    await env.DB.prepare(`INSERT INTO club_places (club_id, name) VALUES (?, 'Example Library')`).bind(clubId).run()
    const other = await seedClub({ id: 'example-other-replay', name: 'Example Other Replay Club' })
    await env.DB.prepare(`INSERT INTO club_places (club_id, name) VALUES (?, 'Example Coffee House')`).bind(other).run()
    expect((await invoke(clubDelete, { method: 'DELETE', as: admin, params: { id: clubId } })).status).toBe(200)
    const again = await invoke(clubDelete, { method: 'DELETE', as: admin, params: { id: clubId } })
    expect(again.status).toBe(404)
    expect(await count('SELECT COUNT(*) AS n FROM club_places WHERE club_id = ?', other)).toBe(1)
  })

  it('deletes a club once its report and request rows are gone, with a rep request from the member who then stays a member', async () => {
    const admin = await seedAdmin()
    const asker = await seedMember({ fullName: 'Player Two', email: 'player.two@example.org' })
    const clubId = await seedClub({ id: 'example-asked-club', name: 'Example Asked Club' })
    await env.DB.prepare(`INSERT INTO club_rep_requests (club_id, member_id, connection) VALUES (?, ?, 'helps_run_it')`).bind(clubId, asker).run()
    expect((await invoke(clubDelete, { method: 'DELETE', as: admin, params: { id: clubId } })).status).toBe(200)
    expect(await count('SELECT COUNT(*) AS n FROM members WHERE id = ?', asker)).toBe(1)
  })
})

describe('two creates of one name sent together', () => {
  it('leave every club with an id equal to its slug, and none with no slug', async () => {
    const admin = await seedAdmin()
    const sent = await Promise.allSettled(
      [1, 2, 3].map((n) => invoke(clubCreate, { method: 'POST', as: admin, body: { name: 'Example Race Club', city: `Example City ${n}` } })),
    )
    const made = sent.filter((r) => r.status === 'fulfilled' && r.value.status === 201).length
    expect(made).toBeGreaterThanOrEqual(1)
    const rows = (await env.DB.prepare(`SELECT id, slug FROM clubs WHERE name = 'Example Race Club'`).all<{ id: string; slug: string | null }>()).results
    expect(rows).toHaveLength(made)
    for (const row of rows) expect(row.slug).toBe(row.id)
    // Which of the others is refused is not held here: the id and the slug are read before the insert, as the id alone was before 0066,
    // so a create that reads the same addresses as another fails on the key; the follow-up is in the report. What is held is that
    // no club is half written.
  })
})
