// test/integration/ticket-kinds.test.ts
//
// Migration 0059 (WS08 step 2) on the D1 database every integration test
// runs on, which test/integration/setup.ts builds from every file in
// migrations/, and the two factories the later steps of WS08 read:
// - support_tickets.kind and support_tickets.about_id and
//   tournaments.review_notified_at are there, each text, nullable, with no
//   default, no key and no index, and what today's code writes leaves each
//   NULL: an event the admin create makes and a ticket the contact form opens;
// - seedTournament writes created_by from createdBy, and null without it;
// - seedPresident gives a member a current term on the President seat, the
//   one holdsPresidentSeat reads, and adds the seat's row, active, when the
//   database lacks it.
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { contracts } from '../../domain/contracts'
import { onRequestPost as createTournament } from '../../functions/api/admin/tournaments'
import type { Env } from '../../functions/types'
import { createTicket } from '../../functions/utils/admin/tickets'
import { holdsPresidentSeat } from '../../functions/utils/events/creation'
import { seedAdmin, seedMember, seedPresident, seedTournament } from './factories'
import { expectContract, invoke, resetHarness } from './harness'

beforeEach(resetHarness)

interface ColumnInfo {
  name: string
  type: string
  notnull: number
  dflt_value: string | null
  pk: number
}

const NEW_COLUMNS = [
  ['support_tickets', 'kind'],
  ['support_tickets', 'about_id'],
  ['tournaments', 'review_notified_at'],
] as const

const columnsOf = async (table: string) => (await env.DB.prepare(`PRAGMA table_info(${table})`).all<ColumnInfo>()).results

describe('migration 0059 on the test database', () => {
  it.each(NEW_COLUMNS)('%s.%s is text, nullable, with no default and no part in the key', async (table, name) => {
    const column = (await columnsOf(table)).find((c) => c.name === name)
    expect(column, `${table}.${name}`).toBeDefined()
    expect(column!.type.toLowerCase()).toBe('text')
    expect(column!.notnull).toBe(0)
    expect(column!.dflt_value).toBeNull()
    expect(column!.pk).toBe(0)
  })

  it('gives none of the three a foreign key or an index', async () => {
    for (const table of ['support_tickets', 'tournaments']) {
      const fks = (await env.DB.prepare(`PRAGMA foreign_key_list(${table})`).all<{ from: string }>()).results
      const indexes = (await env.DB.prepare(`PRAGMA index_list(${table})`).all<{ name: string }>()).results
      const indexed: string[] = []
      for (const { name } of indexes) {
        const info = (await env.DB.prepare(`PRAGMA index_info(${name})`).all<{ name: string }>()).results
        indexed.push(...info.map((c) => c.name))
      }
      for (const [owner, name] of NEW_COLUMNS) {
        if (owner !== table) continue
        expect(fks.map((f) => f.from), `${table}.${name}`).not.toContain(name)
        expect(indexed, `${table}.${name}`).not.toContain(name)
      }
    }
  })

  it('leaves review_notified_at NULL on an event the admin create makes, and the admin\'s answer carries it as null', async () => {
    const admin = await seedAdmin()
    const result = await invoke(createTournament, {
      method: 'POST', as: admin, body: { name: 'Lafayette Winter Quads', location: 'Lafayette, LA', date: '2026-12-05', entryFee: 0 },
    })
    expect(result.status).toBe(201)
    const body = await expectContract(result, contracts['admin/tournaments'].POST.response)
    expect(body.tournament.review_notified_at).toBeNull()
    const row = await env.DB.prepare('SELECT review_notified_at FROM tournaments WHERE id = ?').bind(body.tournament.id).first()
    expect(row).toEqual({ review_notified_at: null })
  })

  it('leaves kind and about_id NULL on a ticket the contact form opens, an ordinary ticket', async () => {
    const { ticketId } = await createTicket(env as unknown as Env, {
      name: 'Pat Visitor', email: 'pat.visitor@example.org', subject: 'Parking at the Winter Quads', body: 'Where do we park?',
      siteUrl: 'https://www.louisianachess.org',
    })
    const row = await env.DB.prepare('SELECT kind, about_id FROM support_tickets WHERE id = ?').bind(ticketId).first()
    expect(row).toEqual({ kind: null, about_id: null })
  })
})

describe('seedTournament\'s creator', () => {
  it('writes created_by from createdBy, and null when it is left out', async () => {
    const creator = await seedMember({ role: 'tournament_director' })
    const own = await seedTournament({ createdBy: creator })
    const plain = await seedTournament()
    const createdBy = async (id: string) => (await env.DB.prepare('SELECT created_by FROM tournaments WHERE id = ?').bind(id).first<{ created_by: string | null }>())?.created_by
    expect(await createdBy(own)).toBe(creator)
    expect(await createdBy(plain)).toBeNull()
  })
})

describe('seedPresident', () => {
  /** The member's current terms on the seat whose slug is president. */
  const currentTerms = (memberId: string) =>
    env.DB.prepare(
      `SELECT s.slug, s.is_active, s.category, a.ended_at FROM board_seat_assignments a JOIN board_members s ON s.id = a.seat_id
        WHERE a.member_id = ? AND a.ended_at IS NULL`,
    ).bind(memberId).all<{ slug: string; is_active: number; category: string; ended_at: string | null }>()

  it('gives the member a current term on the President seat the migrations made, which holdsPresidentSeat reads', async () => {
    const president = await seedMember({ role: 'lca_observer' })
    expect(await holdsPresidentSeat(env.DB, president)).toBe(false)
    await seedPresident(president)
    expect(await holdsPresidentSeat(env.DB, president)).toBe(true)
    expect((await currentTerms(president)).results).toEqual([{ slug: 'president', is_active: 1, category: 'officer', ended_at: null }])
    const seats = await env.DB.prepare(`SELECT COUNT(*) AS n FROM board_members WHERE slug = 'president'`).first<{ n: number }>()
    expect(seats?.n).toBe(1)
  })

  it('adds the seat\'s row, active, when the database lacks it, and the term on it', async () => {
    const seat = await env.DB.prepare(`SELECT id FROM board_members WHERE slug = 'president'`).first<{ id: string }>()
    expect(seat).not.toBeNull()
    await env.DB.prepare(`UPDATE board_members SET slug = 'president-set-aside' WHERE id = ?`).bind(seat!.id).run()
    try {
      const president = await seedMember({ role: 'lca_observer' })
      await seedPresident(president)
      const added = await env.DB.prepare(`SELECT id, role, is_active, category FROM board_members WHERE slug = 'president'`).first<{ id: string; role: string; is_active: number; category: string }>()
      expect(added).toMatchObject({ role: 'President', is_active: 1, category: 'officer' })
      expect(added!.id).not.toBe(seat!.id)
      expect(await holdsPresidentSeat(env.DB, president)).toBe(true)
      await env.DB.prepare('DELETE FROM board_members WHERE id = ?').bind(added!.id).run()
    } finally {
      await env.DB.prepare(`UPDATE board_members SET slug = 'president' WHERE id = ?`).bind(seat!.id).run()
    }
  })
})
