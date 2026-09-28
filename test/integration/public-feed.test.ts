// test/integration/public-feed.test.ts
// The public tournament feed (/api/clearinghouse) behind the homepage,
// Tournaments and Scholastic pages.
import { describe, it, expect } from 'vitest'
import { env } from 'cloudflare:test'
import { invoke } from './harness'
import { seedAdmin, seedMember, seedRegistration, seedTournament } from './factories'

import { onRequestGet as feedGet } from '../../functions/api/clearinghouse'

type FeedRow = { id: string; source: string; registered_count?: number; max_players?: number | null; end_date?: string }

async function feed(as?: string): Promise<FeedRow[]> {
  const res = await invoke(feedGet, { path: '/api/clearinghouse?upcoming=true', ...(as ? { as } : {}) })
  expect(res.status).toBe(200)
  return (await res.json<{ tournaments: FeedRow[] }>()).tournaments
}

describe('public tournament feed', () => {
  it('never lists hidden drafts, even for an admin', async () => {
    const draft = await seedTournament({ isVisible: false, name: 'Secret Draft' })
    const published = await seedTournament({ name: 'Published Open' })
    const admin = await seedAdmin()

    for (const viewer of [undefined, admin]) {
      const ids = (await feed(viewer)).map((t) => t.id)
      expect(ids).toContain(published)
      expect(ids).not.toContain(draft)
    }
  })

  it('carries capacity and a registration count that ignores withdrawals', async () => {
    const tournamentId = await seedTournament({ maxPlayers: 40 })
    const a = await seedMember()
    const b = await seedMember()
    await seedRegistration({ tournamentId, memberId: a })
    await seedRegistration({ tournamentId, memberId: b })
    await env.DB.prepare(
      `UPDATE registrations SET withdrawn_at = datetime('now') WHERE tournament_id = ? AND member_id = ?`,
    ).bind(tournamentId, b).run()

    const row = (await feed()).find((t) => t.id === tournamentId)
    expect(row?.max_players).toBe(40)
    expect(row?.registered_count).toBe(1)
  })
})
