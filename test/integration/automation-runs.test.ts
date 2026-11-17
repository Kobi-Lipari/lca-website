// test/integration/automation-runs.test.ts
//
// The run record of migration 0068 on D1 (WS09 step 13):
// - recordRun writes one row for each run, opened as failed with no
//   finished_at while the work runs, and closed with the outcome and the
//   counts the work gives; ok, partial and failed are each written as the
//   table's CHECK allows, and an outcome the CHECK would refuse is written
//   as failed;
// - a phase that throws is recorded as failed and recordRun does not throw
//   on, and the detail never carries an address or a token, the thrown
//   words included;
// - with the table not there yet, or a write refused, the job still runs
//   and its answer still comes back, with one log line naming no person;
// - lastRun reads a job's latest run, the later row first when two started
//   in the same second;
// - the member delete sets seen_by to NULL on that member's rows and keeps
//   them, leaves other members' rows as they were, answers as before with
//   the table there or not, and lets only an LCA admin delete.
// Every person, address and token here is made up.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { onRequestDelete as memberDelete, RUN_MARKS_UNCLEARED_LOG } from '../../functions/api/admin/members/[id]'
import { lastRun, recordRun, RUN_NOT_RECORDED_LOG, RUN_THREW_LOG, THROWN_UNREADABLE_DETAIL } from '../../functions/utils/admin/automations'
import { laggingDb } from './clubTables'
import { seedAdmin, seedClub, seedMember } from './factories'
import { invoke, resetHarness } from './harness'

beforeEach(async () => {
  resetHarness()
  await env.DB.prepare('DELETE FROM automation_runs').run()
})
afterEach(() => {
  vi.restoreAllMocks()
})

const ANSWER = '{"success":true,"authDeleted":false}'
const rows = async () => (await env.DB.prepare(
  'SELECT id, job, started_at, finished_at, outcome, sent_count, failed_count, detail, seen_at, seen_by FROM automation_runs ORDER BY id',
).all<Record<string, unknown>>()).results
const missingTable = () => laggingDb({ name: 'automation_runs', kind: 'table' })
const quiet = () => vi.spyOn(console, 'warn').mockImplementation(() => {})
const remove = (as: string | undefined, id: string, db?: D1Database) =>
  invoke(memberDelete, { method: 'DELETE', as, params: { id }, env: db ? { DB: db } : undefined })
const exists = async (id: string) => (await env.DB.prepare('SELECT id FROM members WHERE id = ?').bind(id).first()) !== null

describe('recordRun', () => {
  it('records a run once, with its counts and its outcome, opened as failed while it runs', async () => {
    let whileRunning: Record<string, unknown>[] = []
    const answer = await recordRun(env.DB, 'daily:reminders', async () => {
      whileRunning = await rows()
      return { outcome: 'ok' as const, sentCount: 12, failedCount: 0, detail: 'Twelve reminders sent.' }
    })
    expect(answer).toEqual({ outcome: 'ok', sentCount: 12, failedCount: 0, detail: 'Twelve reminders sent.' })
    expect(whileRunning).toHaveLength(1)
    expect(whileRunning[0]).toMatchObject({ job: 'daily:reminders', outcome: 'failed', finished_at: null, sent_count: null, failed_count: null, detail: null })
    const after = await rows()
    expect(after).toHaveLength(1)
    expect(after[0]).toMatchObject({ id: whileRunning[0].id, job: 'daily:reminders', outcome: 'ok', sent_count: 12, failed_count: 0, detail: 'Twelve reminders sent.', seen_at: null, seen_by: null })
    expect(after[0].started_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    expect(after[0].finished_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  })

  it('writes ok, partial and failed as the table allows, each run its own row, and an outcome it would refuse as failed', async () => {
    for (const outcome of ['ok', 'partial', 'failed'] as const) {
      await recordRun(env.DB, `daily:${outcome}`, async () => ({ outcome, sentCount: 1, failedCount: outcome === 'ok' ? 0 : 1 }))
    }
    await recordRun(env.DB, 'daily:odd', async () => ({ outcome: 'done' as never, sentCount: -1, failedCount: 2.5 }))
    expect((await rows()).map((r) => [r.job, r.outcome, r.sent_count, r.failed_count])).toEqual([
      ['daily:ok', 'ok', 1, 0], ['daily:partial', 'partial', 1, 1], ['daily:failed', 'failed', 1, 1], ['daily:odd', 'failed', null, null],
    ])
    await expect(env.DB.prepare(`INSERT INTO automation_runs (job, outcome) VALUES ('daily:odd', 'done')`).run()).rejects.toThrow(/CHECK constraint failed/)
    await expect(env.DB.prepare(`INSERT INTO automation_runs (job) VALUES ('daily:odd')`).run()).rejects.toThrow(/NOT NULL constraint failed/)
  })

  it('records a thrown phase as failed and does not throw on', async () => {
    const warn = quiet()
    const answer = await recordRun(env.DB, 'five_minute:offers', async () => {
      throw new Error('The offers could not be read.')
    })
    expect(answer).toEqual({ outcome: 'failed', sentCount: null, failedCount: null, detail: 'The offers could not be read.', thrown: true })
    expect(await rows()).toEqual([expect.objectContaining({ job: 'five_minute:offers', outcome: 'failed', detail: 'The offers could not be read.' })])
    expect((await rows())[0].finished_at).not.toBeNull()
    expect(warn.mock.calls).toEqual([[RUN_THREW_LOG, 'five_minute:offers']])
    // A thrown value that is not an Error is recorded too.
    await recordRun(env.DB, 'five_minute:offers', async () => {
      throw 'a plain text thrown'
    })
    expect((await rows()).at(-1)).toMatchObject({ outcome: 'failed', detail: 'a plain text thrown' })
  })

  it('records a phase that throws something with no words to read as failed, and does not throw on', async () => {
    const warn = quiet()
    const noText = Object.create(null) as object
    const badToString = { toString: () => { throw new Error('player.one@example.org') } }
    const badMessage = new Error('hidden')
    Object.defineProperty(badMessage, 'message', { get: () => { throw new Error('player.one@example.org') } })
    for (const thrownValue of [noText, badToString, badMessage]) {
      const answer = await recordRun(env.DB, 'daily:digest', async () => {
        throw thrownValue
      })
      expect(answer).toEqual({ outcome: 'failed', sentCount: null, failedCount: null, detail: THROWN_UNREADABLE_DETAIL, thrown: true })
    }
    // A work report whose detail has no text to give closes its row too.
    const report = await recordRun(env.DB, 'daily:digest', async () => ({ outcome: 'partial' as const, detail: noText as never }))
    expect(report.outcome).toBe('partial')
    expect((await rows()).map((r) => [r.outcome, r.detail, r.finished_at === null])).toEqual([
      ['failed', THROWN_UNREADABLE_DETAIL, false], ['failed', THROWN_UNREADABLE_DETAIL, false], ['failed', THROWN_UNREADABLE_DETAIL, false], ['partial', null, false],
    ])
    expect(warn.mock.calls).toEqual([[RUN_THREW_LOG, 'daily:digest'], [RUN_THREW_LOG, 'daily:digest'], [RUN_THREW_LOG, 'daily:digest']])
  })

  it('masks an address and a token in the detail, the thrown words and the work\'s own alike, and cuts it short', async () => {
    quiet()
    const token = 'v1.s.eyJwIjoiY2x1Yl9jb25maXJtIiwiYyI6eyJtZW1iZXJJZCI6InBsYXllci1vbmUifX0.AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCd'
    await recordRun(env.DB, 'daily:digest', async () => {
      throw new Error(`Sending to player.one@example.org failed with link https://example.org/confirm?t=${token} and token=${token}`)
    })
    await recordRun(env.DB, 'daily:digest', async () => ({ outcome: 'partial' as const, detail: `Bounced: player.two@example.org, ${token}\nsecond line ${'more words '.repeat(40)}` }))
    for (const row of await rows()) {
      const detail = String(row.detail)
      expect(detail).not.toMatch(/@|confirm\?t=|eyJ|AbCdEf|player\.(one|two)/)
      expect(detail).not.toContain('\n')
      expect(detail.length).toBeLessThanOrEqual(200)
    }
    expect((await rows())[0].detail).toBe('Sending to [address] failed with link https://example.org/confirm?[hidden] and token=[hidden]')
    expect(String((await rows())[1].detail).startsWith('Bounced: [address], [hidden] second line more words')).toBe(true)
  })

  it('still runs the job and gives back its answer when the table is not there, with one log line naming no person', async () => {
    const warn = quiet()
    const job = vi.fn(async () => ({ outcome: 'ok' as const, sentCount: 4, failedCount: 0 }))
    expect(await recordRun(missingTable(), 'daily:reminders', job)).toEqual({ outcome: 'ok', sentCount: 4, failedCount: 0 })
    expect(job).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls).toEqual([[RUN_NOT_RECORDED_LOG]])
    expect(RUN_NOT_RECORDED_LOG).not.toMatch(/player|@/i)
    // A thrown phase on the missing table is still contained.
    warn.mockClear()
    const thrown = await recordRun(missingTable(), 'daily:reminders', async () => {
      throw new Error('stopped')
    })
    expect(thrown).toMatchObject({ outcome: 'failed', thrown: true })
    expect(warn.mock.calls).toEqual([[RUN_NOT_RECORDED_LOG], [RUN_THREW_LOG, 'daily:reminders']])
    expect(await rows()).toEqual([])
  })

  it('gives back the job\'s answer when the closing write is refused, and leaves the run reading as failed', async () => {
    const warn = quiet()
    const db = env.DB
    const closingRefused = {
      prepare: (sql: string) => (sql.startsWith('UPDATE automation_runs')
        ? { bind: () => ({ run: async () => { throw new Error('D1_ERROR: database is locked: SQLITE_BUSY') } }) }
        : db.prepare(sql)),
    } as unknown as D1Database
    expect(await recordRun(closingRefused, 'clearinghouse_sync', async () => ({ outcome: 'ok' as const, sentCount: 9 }))).toEqual({ outcome: 'ok', sentCount: 9 })
    expect(warn.mock.calls).toEqual([[RUN_NOT_RECORDED_LOG]])
    expect(await rows()).toEqual([expect.objectContaining({ job: 'clearinghouse_sync', outcome: 'failed', finished_at: null })])
  })
})

describe('lastRun', () => {
  it('reads the latest run of a job, the later row first when two started in the same second, and null for a job never run', async () => {
    for (const [job, started, outcome] of [
      ['daily:reminders', '2026-11-14 18:00:00', 'ok'], ['daily:reminders', '2026-11-14 19:00:00', 'partial'], ['daily:reminders', '2026-11-14 19:00:00', 'failed'],
      ['daily:digest', '2026-11-14 20:00:00', 'ok'],
    ]) {
      await env.DB.prepare('INSERT INTO automation_runs (job, started_at, outcome) VALUES (?, ?, ?)').bind(job, started, outcome).run()
    }
    expect(await lastRun(env.DB, 'daily:reminders')).toMatchObject({ job: 'daily:reminders', started_at: '2026-11-14 19:00:00', outcome: 'failed' })
    expect(await lastRun(env.DB, 'daily:digest')).toMatchObject({ outcome: 'ok' })
    expect(await lastRun(env.DB, 'clearinghouse_sync')).toBeNull()
    // Two runs recorded one after the other, most likely in one second: the second is the latest.
    await recordRun(env.DB, 'five_minute:offers', async () => ({ outcome: 'ok' as const }))
    await recordRun(env.DB, 'five_minute:offers', async () => ({ outcome: 'partial' as const }))
    expect(await lastRun(env.DB, 'five_minute:offers')).toMatchObject({ outcome: 'partial' })
  })
})

describe('the member delete and seen_by', () => {
  async function seen(by: string, job = 'clearinghouse_sync'): Promise<number> {
    const row = await env.DB.prepare(
      `INSERT INTO automation_runs (job, outcome, finished_at, seen_at, seen_by) VALUES (?, 'ok', '2026-11-14 18:05:00', '2026-11-14 19:00:00', ?) RETURNING id`,
    ).bind(job, by).first<{ id: number }>()
    return row!.id
  }

  it('sets seen_by to NULL on the member\'s rows, keeps the rows, and leaves another member\'s as they were', async () => {
    const admin = await seedAdmin()
    const leaving = await seedMember({ role: 'lca_admin', fullName: 'Player One', email: 'player.one@example.org' })
    const staying = await seedMember({ role: 'lca_admin', fullName: 'Player Two', email: 'player.two@example.org' })
    const mine = [await seen(leaving), await seen(leaving, 'daily:reminders')]
    const theirs = await seen(staying)
    const warn = quiet()
    const res = await remove(admin, leaving)
    expect(res.status).toBe(200)
    expect(await res.response.text()).toBe(ANSWER)
    expect(await exists(leaving)).toBe(false)
    expect(warn.mock.calls.map(([line]) => line)).not.toContain(RUN_MARKS_UNCLEARED_LOG)
    const after = await rows()
    expect(after.map((r) => [r.id, r.seen_at, r.seen_by])).toEqual([
      [mine[0], '2026-11-14 19:00:00', null], [mine[1], '2026-11-14 19:00:00', null], [theirs, '2026-11-14 19:00:00', staying],
    ])
  })

  it('answers as before with the table not there yet: the delete succeeds, with one log line naming no member', async () => {
    const admin = await seedAdmin()
    const member = await seedMember({ fullName: 'Player Three', email: 'player.three@example.org' })
    const warn = quiet()
    const res = await remove(admin, member, missingTable())
    expect(res.status).toBe(200)
    expect(await res.response.text()).toBe(ANSWER)
    expect(await exists(member)).toBe(false)
    const lines = warn.mock.calls.filter(([line]) => typeof line === 'string' && line.startsWith('member delete: '))
    expect(lines).toEqual([[RUN_MARKS_UNCLEARED_LOG]])
    expect(JSON.stringify(lines)).not.toContain(member)
    expect(JSON.stringify(lines)).not.toContain('player.three')
  })

  it('does not take another failure of the clear for a missing table: the delete stops and the member stays', async () => {
    const admin = await seedAdmin()
    const member = await seedMember({ fullName: 'Player Four', email: 'player.four@example.org' })
    const db = env.DB
    const failing = {
      prepare: (sql: string) => (sql.startsWith('UPDATE automation_runs')
        ? { bind: () => ({ run: async () => { throw new Error('D1_ERROR: database is locked: SQLITE_BUSY') } }) }
        : db.prepare(sql)),
      batch: (statements: D1PreparedStatement[]) => db.batch(statements),
    } as unknown as D1Database
    await expect(remove(admin, member, failing)).rejects.toThrow(/database is locked/)
    expect(await exists(member)).toBe(true)
  })

  it('role safety: a club\'s rep, a member and a visitor are refused and no run\'s mark moves', async () => {
    const target = await seedMember({ role: 'lca_admin', fullName: 'Player Five', email: 'player.five@example.org' })
    const run = await seen(target)
    const clubId = await seedClub({ name: 'Example Chess Club' })
    const rep = await seedMember({ role: 'club_rep', clubId, fullName: 'Club Rep One', email: 'club.rep.one@example.org' })
    const plain = await seedMember({ fullName: 'Player Six', email: 'player.six@example.org' })
    for (const [who, as, status] of [['a club\'s rep', rep, 403], ['a member', plain, 403], ['a visitor', undefined, 401]] as const) {
      expect((await remove(as, target)).status, who).toBe(status)
    }
    expect(await exists(target)).toBe(true)
    expect(await rows()).toEqual([expect.objectContaining({ id: run, seen_by: target })])
  })
})
